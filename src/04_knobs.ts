#!/usr/bin/env bun
/**
 * 04_knobs.ts — Instant CLI cockpit for every toroSOL LST + Token-2022 + Orca CLMM knob.
 *
 * Commands:
 *   status                                 — Live full-stack dashboard
 *   set-orca-fee <0..60000>                — Instant Orca swap fee (100=0.01%, 60000=6%)
 *   set-proto-fee <0..2500>                — Instant Orca protocol rake (2500=25%)
 *   set-deposit-fee <num> <den>            — Instant SP12tWFx SolDepositFee
 *   set-withdraw-fee <num> <den>           — SP12tWFx SolWithdrawalFee (2 epochs)
 *   set-t22-fee <0..10000>                 — Token-2022 SetTransferFee (2 epochs)
 *   set-uri <url>                          — Instant Token-2022 TokenMetadata URI update
 *   harvest-burn                           — Sweep all T22 withheld → burn → crank NAV
 *   collect-fees                           — Collect LP + 25% protocol fees → 331
 *   mint-lst <sol>                         — Net-0% SP12tWFx DepositSol
 *   burn-lst <toro>                        — Net-0% SP12tWFx WithdrawSol
 *   jup-check                              — Probe Jupiter /swap/v1/quote both directions
 */

import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
} from '@solana/spl-token'
import { createUpdateFieldInstruction } from '@solana/spl-token-metadata'
import fs from 'node:fs'
import {
  JUPITER_API_KEY,
  JUPITER_URL,
  KEEPER_STATE_FILE,
  loadDeployment,
  loadManagerKeypair,
  loadOrcaAuthKeypair,
  MAX_TRANSFER_FEE_ATOMS,
  SOL_USDC_ORACLE_POOL,
  TOKEN_2022_PROGRAM,
  TOKEN_PROGRAM,
  USDC_MINT,
  WSOL_MINT,
} from './config'
import {
  fetchMintTransferFeeBps,
  fetchStakePoolState,
  findWithheldAccounts,
  ixBurnChecked2022,
  ixCleanupRemovedValidatorEntries,
  ixDepositSol,
  ixSetStakePoolFee,
  ixSetTransferFee,
  ixUpdateStakePoolBalance,
  ixUpdateValidatorListBalance,
  ixWithdrawSol,
  ixWithdrawWithheldFromAccounts,
  ixWithdrawWithheldFromMint,
  parseValidatorListData,
  validatorStakePairs,
} from './sanctum'
import { createConnection, getTokenBalanceAndWithheld, log, simulateOrSendTx } from './tx'
import {
  computeAmountsForLiquidity,
  deriveAta,
  deriveTickArrayPda,
  getStartTickIndex,
  ixCollectFeesV2,
  ixCollectProtocolFeesV2,
  ixSetFeeRate,
  ixSetProtocolFeeRate,
  ixUpdateFeesAndRewards,
  parsePosition,
  parseWhirlpool,
  sqrtPriceX64ToPrice,
} from './whirlpool'

async function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  const dryRun = rest.includes('--dry-run')
  const args = rest.filter((a) => a !== '--dry-run')

  const dep = loadDeployment()
  if (!dep) throw new Error('state/deployment.json not found — deploy LST first!')

  const conn = createConnection()
  const manager = loadManagerKeypair()
  const orcaAuth = loadOrcaAuthKeypair()
  const mint = new PublicKey(dep.mint)
  const stakePool = new PublicKey(dep.stakePool)
  const toroAta = deriveAta(manager.publicKey, mint, TOKEN_2022_PROGRAM)
  const wsolAta = deriveAta(manager.publicKey, WSOL_MINT, TOKEN_PROGRAM)

  switch (cmd) {
    case 'status': {
      const pool = await fetchStakePoolState(conn, stakePool)
      const { bps, withheldInMint, supply } = await fetchMintTransferFeeBps(conn, mint)
      const withheldAccts = await findWithheldAccounts(conn, mint, 1n)
      const totalWithheld = withheldAccts.reduce((s, a) => s + a.withheld, 0n) + withheldInMint
      const solBal = (await conn.getBalance(manager.publicKey, 'confirmed')) / 1e9
      const toroBal = await getTokenBalanceAndWithheld(conn, toroAta)
      const [vlAcc, resAcc] = await conn.getMultipleAccountsInfo([pool.validatorList, pool.reserveStake], 'confirmed')
      const validators = vlAcc ? parseValidatorListData(vlAcc.data) : []
      const resSol = (resAcc?.lamports ?? 0) / 1e9
      const stakedSol = validators.reduce((s, v) => s + Number(v.activeStakeLamports + v.transientStakeLamports) / 1e9, 0)

      console.log(`\n=== ${dep.tokenSymbol} LIVE STATUS ===`)
      console.log(`Mint:        ${dep.mint}`)
      console.log(`StakePool:   ${dep.stakePool}`)
      console.log(`TVL / Supp:  ${(Number(pool.totalLamports) / 1e9).toFixed(6)} SOL / ${(Number(supply) / 1e9).toFixed(6)} ${dep.tokenSymbol}`)
      console.log(`Staking:     reserve=${resSol.toFixed(4)} SOL | staked=${stakedSol.toFixed(4)} SOL (${validators.length} validators${validators.length ? ': ' + validators.map((v) => v.voteAccount.toBase58().slice(0, 8)).join(',') : ''})`)
      console.log(`NAV:         ${pool.navSolPerToken.toFixed(6)} SOL/${dep.tokenSymbol}`)
      console.log(`T22 Fee:     ${bps} bps (${(bps / 100).toFixed(2)}%) | pending sweep=${(Number(totalWithheld) / 1e9).toFixed(6)} (${withheldAccts.length} accts)`)
      console.log(`SP Fees:     solDep=${pool.solDepositFee.numerator}/${pool.solDepositFee.denominator} | solWd=${pool.solWithdrawalFee.numerator}/${pool.solWithdrawalFee.denominator} | epoch=${pool.epochFee.numerator}/${pool.epochFee.denominator}`)
      console.log(`331 Wallet:  ${solBal.toFixed(6)} SOL | ${(Number(toroBal.spendable) / 1e9).toFixed(6)} ${dep.tokenSymbol}`)

      if (dep.whirlpool && dep.position) {
        const [wpAcc, posAcc] = await conn.getMultipleAccountsInfo(
          [new PublicKey(dep.whirlpool), new PublicKey(dep.position)],
          'confirmed',
        )
        if (wpAcc && posAcc) {
          const wp = parseWhirlpool(wpAcc.data)
          const pos = parsePosition(posAcc.data)
          const bPerA = sqrtPriceX64ToPrice(wp.sqrtPrice, 9, 9)
          const spot = dep.solIsA ? 1.0 / bPerA : bPerA
          const fT22 = bps / 10_000
          const fOrca = wp.feeRate / 1_000_000
          const fDep = pool.solDepositFee.denominator > 0n ? Number(pool.solDepositFee.numerator) / Number(pool.solDepositFee.denominator) : 0
          const fWd = pool.solWithdrawalFee.denominator > 0n ? Number(pool.solWithdrawalFee.numerator) / Number(pool.solWithdrawalFee.denominator) : 0
          const mintArb = pool.navSolPerToken / ((1 - fDep) * (1 - fT22) * (1 - fOrca))
          const burnArb = pool.navSolPerToken * (1 - fWd) * (1 - fT22) * (1 - fOrca)
          console.log(`Orca Pool:   ${dep.whirlpool} (ts=${wp.tickSpacing})`)
          console.log(`Spot Price:  ${spot.toFixed(6)} SOL/${dep.tokenSymbol} (${((spot / pool.navSolPerToken - 1) * 100).toFixed(2)}% vs NAV)`)
          console.log(`Arb Lines:   Buy→Burn < ${burnArb.toFixed(5)} | Mint→Sell > ${mintArb.toFixed(5)}`)
          console.log(`Orca Fees:   swap=${(wp.feeRate / 10_000).toFixed(3)}% | protoRake=${(wp.protocolFeeRate / 100).toFixed(1)}%`)
          console.log(`Position:    L=${pos.liquidity} | ticks=[${pos.tickLowerIndex} .. ${wp.tickCurrentIndex} .. ${pos.tickUpperIndex}]`)
          console.log(`Owed Fees:   LP(A=${(Number(pos.feeOwedA) / 1e9).toFixed(6)}, B=${(Number(pos.feeOwedB) / 1e9).toFixed(6)}) | Proto(A=${(Number(wp.protocolFeeOwedA) / 1e9).toFixed(6)}, B=${(Number(wp.protocolFeeOwedB) / 1e9).toFixed(6)})`)
          const posAmts = computeAmountsForLiquidity(wp.sqrtPrice, pos.tickLowerIndex, pos.tickUpperIndex, pos.liquidity)
          const wsolState = await getTokenBalanceAndWithheld(conn, wsolAta)
          const lpSol = Number(dep.solIsA ? posAmts.reqA : posAmts.reqB) / 1e9
          const lpToro = Number(dep.solIsA ? posAmts.reqB : posAmts.reqA) / 1e9
          const uncollSol = Number(dep.solIsA ? wp.protocolFeeOwedA * 4n : wp.protocolFeeOwedB * 4n) / 1e9
          const uncollToro = Number(dep.solIsA ? wp.protocolFeeOwedB * 4n : wp.protocolFeeOwedA * 4n) / 1e9
          let usdcEqSol = 0
          if (dep.usdcWhirlpool && dep.usdcPosition) {
            const usdcAta = deriveAta(manager.publicKey, USDC_MINT, TOKEN_PROGRAM)
            const [uWpAcc, uPosAcc, oAcc, uAtaAcc] = await conn.getMultipleAccountsInfo(
              [new PublicKey(dep.usdcWhirlpool), new PublicKey(dep.usdcPosition), SOL_USDC_ORACLE_POOL, usdcAta],
              'confirmed',
            )
            if (uWpAcc && uPosAcc && oAcc) {
              const uWp = parseWhirlpool(uWpAcc.data)
              const uPos = parsePosition(uPosAcc.data)
              const solUsd = sqrtPriceX64ToPrice(parseWhirlpool(oAcc.data).sqrtPrice, 9, 6)
              const uAmts = computeAmountsForLiquidity(uWp.sqrtPrice, uPos.tickLowerIndex, uPos.tickUpperIndex, uPos.liquidity)
              const uSpotUsd = 1.0 / sqrtPriceX64ToPrice(uWp.sqrtPrice, 6, 9)
              const lpUsdc = Number(uAmts.reqA) / 1e6
              const lpUsdcToro = Number(uAmts.reqB) / 1e9
              const uncollUsdc = Number(uWp.protocolFeeOwedA * 4n) / 1e6
              const uncollUsdcToro = Number(uWp.protocolFeeOwedB * 4n) / 1e9
              const walUsdc = uAtaAcc && uAtaAcc.data.length >= 72 ? Number(uAtaAcc.data.readBigUInt64LE(64)) / 1e6 : 0
              usdcEqSol = (walUsdc + lpUsdc + uncollUsdc) / solUsd + (lpUsdcToro + uncollUsdcToro) * pool.navSolPerToken
              console.log(`USDC Pool:   ${dep.usdcWhirlpool} (ts=${uWp.tickSpacing}, fee=${(uWp.feeRate / 10_000).toFixed(2)}%, proto=${(uWp.protocolFeeRate / 100).toFixed(0)}%)`)
              console.log(`USDC Split:  $${lpUsdc.toFixed(2)} USDC | ${lpUsdcToro.toFixed(4)} ${dep.tokenSymbol} | spot=$${uSpotUsd.toFixed(2)} (SOL=$${solUsd.toFixed(2)}) | L=${uPos.liquidity}`)
            }
          }
          const totalEq =
            solBal +
            Number(wsolState.amount) / 1e9 +
            lpSol +
            uncollSol +
            (Number(toroBal.spendable) / 1e9 + lpToro + uncollToro) * pool.navSolPerToken +
            usdcEqSol
          console.log(`LP Split:    ${lpSol.toFixed(4)} SOL bid | ${lpToro.toFixed(4)} ${dep.tokenSymbol} ask`)
          console.log(`331 Equity:  ${totalEq.toFixed(6)} SOL (incl. uncollected LP+proto fees${usdcEqSol > 0 ? ' + USDC pool' : ''})`)
        }
      }
      if (fs.existsSync(KEEPER_STATE_FILE)) {
        const ks = JSON.parse(fs.readFileSync(KEEPER_STATE_FILE, 'utf-8'))
        console.log(
          `Keeper KPIs: waves=${ks.totalArbWaves} (sniped=${ks.snipedWaves}, unsniped=${ks.unsnipedWaves}) | ` +
            `edge=${ks.adaptiveEdgeBps}bps | burned=${(Number(ks.totalBurnedAtoms ?? 0) / 1e9).toFixed(4)} ${dep.tokenSymbol} | ` +
            `highWater=${Number(ks.equityHighWaterSol ?? 0).toFixed(4)} SOL`,
        )
      }
      break
    }

    case 'set-orca-fee': {
      const feeRate = Number(args[0])
      if (!Number.isInteger(feeRate) || feeRate < 0 || feeRate > 60_000) {
        throw new Error('feeRate must be 0..60000 (100 = 0.01%, 60000 = 6.00%)')
      }
      await simulateOrSendTx(
        conn,
        [
          ixSetFeeRate({
            config: new PublicKey(dep.orcaConfig!),
            whirlpool: new PublicKey(dep.whirlpool!),
            feeAuthority: orcaAuth.publicKey,
            feeRate,
          }),
        ],
        manager,
        [orcaAuth],
        { cuLimit: 100_000, cuPriceMicroLamports: 15_000, dryRun, label: `set-orca-fee:${feeRate}` },
      )
      break
    }

    case 'set-proto-fee': {
      const protocolFeeRate = Number(args[0])
      if (!Number.isInteger(protocolFeeRate) || protocolFeeRate < 0 || protocolFeeRate > 2_500) {
        throw new Error('protocolFeeRate must be 0..2500 (2500 = 25%)')
      }
      await simulateOrSendTx(
        conn,
        [
          ixSetProtocolFeeRate({
            config: new PublicKey(dep.orcaConfig!),
            whirlpool: new PublicKey(dep.whirlpool!),
            feeAuthority: orcaAuth.publicKey,
            protocolFeeRate,
          }),
        ],
        manager,
        [orcaAuth],
        { cuLimit: 100_000, cuPriceMicroLamports: 15_000, dryRun, label: `set-proto-fee:${protocolFeeRate}` },
      )
      break
    }

    case 'set-deposit-fee': {
      const num = BigInt(args[0])
      const den = BigInt(args[1] ?? '10000')
      await simulateOrSendTx(
        conn,
        [
          ixSetStakePoolFee({
            stakePool,
            manager: manager.publicKey,
            feeType: { kind: 'SolDeposit', fee: { numerator: num, denominator: den } },
          }),
        ],
        manager,
        [],
        { cuLimit: 120_000, cuPriceMicroLamports: 15_000, dryRun, label: `set-sol-deposit-fee:${num}/${den}` },
      )
      break
    }

    case 'set-withdraw-fee': {
      const num = BigInt(args[0])
      const den = BigInt(args[1] ?? '10000')
      await simulateOrSendTx(
        conn,
        [
          ixSetStakePoolFee({
            stakePool,
            manager: manager.publicKey,
            feeType: { kind: 'SolWithdrawal', fee: { numerator: num, denominator: den } },
          }),
        ],
        manager,
        [],
        { cuLimit: 120_000, cuPriceMicroLamports: 15_000, dryRun, label: `set-sol-withdraw-fee:${num}/${den}` },
      )
      break
    }

    case 'set-t22-fee': {
      const bps = Number(args[0])
      await simulateOrSendTx(
        conn,
        [ixSetTransferFee({ mint, authority: manager.publicKey, bps, maxFee: MAX_TRANSFER_FEE_ATOMS })],
        manager,
        [],
        { cuLimit: 100_000, cuPriceMicroLamports: 15_000, dryRun, label: `set-t22-fee:${bps}bps` },
      )
      break
    }

    case 'set-uri': {
      const uri = args[0]
      if (!uri) throw new Error('provide new uri')
      await simulateOrSendTx(
        conn,
        [
          createUpdateFieldInstruction({
            programId: TOKEN_2022_PROGRAM,
            metadata: mint,
            updateAuthority: manager.publicKey,
            field: 'uri',
            value: uri,
          }),
        ],
        manager,
        [],
        { cuLimit: 120_000, cuPriceMicroLamports: 15_000, dryRun, label: `set-uri` },
      )
      break
    }

    case 'harvest-burn': {
      const accts = await findWithheldAccounts(conn, mint, 1n)
      const { withheldInMint } = await fetchMintTransferFeeBps(conn, mint)
      let total = withheldInMint
      for (let i = 0; i < accts.length; i += 20) {
        const chunk = accts.slice(i, i + 20)
        total += chunk.reduce((s, c) => s + c.withheld, 0n)
        await simulateOrSendTx(
          conn,
          [
            ixWithdrawWithheldFromAccounts({
              mint,
              destination: toroAta,
              authority: manager.publicKey,
              sources: chunk.map((c) => c.pubkey),
            }),
          ],
          manager,
          [],
          { cuLimit: 350_000, cuPriceMicroLamports: 15_000, dryRun, label: 'harvest-accounts' },
        )
      }
      if (withheldInMint > 0n) {
        await simulateOrSendTx(
          conn,
          [ixWithdrawWithheldFromMint({ mint, destination: toroAta, authority: manager.publicKey })],
          manager,
          [],
          { cuLimit: 150_000, cuPriceMicroLamports: 15_000, dryRun, label: 'harvest-mint' },
        )
      }
      if (total > 0n) {
        await simulateOrSendTx(
          conn,
          [ixBurnChecked2022({ account: toroAta, mint, authority: manager.publicKey, amount: total })],
          manager,
          [],
          { cuLimit: 150_000, cuPriceMicroLamports: 15_000, dryRun, label: `burn-${Number(total) / 1e9}` },
        )
      }
      const pool = await fetchStakePoolState(conn, stakePool)
      const vlAcc = await conn.getAccountInfo(pool.validatorList, 'confirmed')
      const valPairs = vlAcc ? validatorStakePairs(stakePool, parseValidatorListData(vlAcc.data)) : []
      await simulateOrSendTx(
        conn,
        [
          ixUpdateValidatorListBalance({ stakePool, validatorList: pool.validatorList, reserveStake: pool.reserveStake, validatorPairs: valPairs }),
          ixUpdateStakePoolBalance({
            stakePool,
            validatorList: pool.validatorList,
            reserveStake: pool.reserveStake,
            managerFeeAccount: pool.managerFeeAccount,
            poolMint: mint,
          }),
          ixCleanupRemovedValidatorEntries({ stakePool, validatorList: pool.validatorList }),
        ],
        manager,
        [],
        { cuLimit: 350_000, cuPriceMicroLamports: 15_000, dryRun, label: 'crank-nav' },
      )
      break
    }

    case 'collect-fees': {
      const wpPk = new PublicKey(dep.whirlpool!)
      const posPk = new PublicKey(dep.position!)
      const [wpAcc, posAcc] = await conn.getMultipleAccountsInfo([wpPk, posPk], 'confirmed')
      const wp = parseWhirlpool(wpAcc!.data)
      const pos = parsePosition(posAcc!.data)
      const solIsA = Boolean(dep.solIsA)
      const mintA = new PublicKey(dep.tokenMintA!)
      const mintB = new PublicKey(dep.tokenMintB!)
      const tpA = solIsA ? TOKEN_PROGRAM : TOKEN_2022_PROGRAM
      const tpB = solIsA ? TOKEN_2022_PROGRAM : TOKEN_PROGRAM
      const ataA = solIsA ? wsolAta : toroAta
      const ataB = solIsA ? toroAta : wsolAta
      const taLow = deriveTickArrayPda(wpPk, getStartTickIndex(pos.tickLowerIndex, wp.tickSpacing))
      const taHigh = deriveTickArrayPda(wpPk, getStartTickIndex(pos.tickUpperIndex, wp.tickSpacing))
      await simulateOrSendTx(
        conn,
        [
          createAssociatedTokenAccountIdempotentInstruction(manager.publicKey, wsolAta, manager.publicKey, WSOL_MINT, TOKEN_PROGRAM),
          ixUpdateFeesAndRewards({ whirlpool: wpPk, position: posPk, tickArrayLower: taLow, tickArrayUpper: taHigh }),
          ixCollectFeesV2({
            whirlpool: wpPk,
            positionAuthority: manager.publicKey,
            position: posPk,
            positionTokenAccount: new PublicKey(dep.positionTokenAccount!),
            tokenMintA: mintA,
            tokenMintB: mintB,
            tokenOwnerAccountA: ataA,
            tokenVaultA: wp.tokenVaultA,
            tokenOwnerAccountB: ataB,
            tokenVaultB: wp.tokenVaultB,
            tokenProgramA: tpA,
            tokenProgramB: tpB,
          }),
          ixCollectProtocolFeesV2({
            config: new PublicKey(dep.orcaConfig!),
            whirlpool: wpPk,
            collectProtocolFeesAuthority: orcaAuth.publicKey,
            tokenMintA: mintA,
            tokenMintB: mintB,
            tokenVaultA: wp.tokenVaultA,
            tokenVaultB: wp.tokenVaultB,
            tokenDestinationA: ataA,
            tokenDestinationB: ataB,
            tokenProgramA: tpA,
            tokenProgramB: tpB,
          }),
          ixWithdrawWithheldFromAccounts({
            mint,
            destination: toroAta,
            authority: manager.publicKey,
            sources: [toroAta],
          }),
          createCloseAccountInstruction(wsolAta, manager.publicKey, manager.publicKey, [], TOKEN_PROGRAM),
        ],
        manager,
        [orcaAuth],
        { cuLimit: 220_000, cuPriceMicroLamports: 4_000, dryRun, label: 'collect-lp+protocol-fees' },
      )
      break
    }

    case 'mint-lst': {
      const sol = Number(args[0])
      const pool = await fetchStakePoolState(conn, stakePool)
      await simulateOrSendTx(
        conn,
        [
          ixDepositSol({
            stakePool,
            reserveStake: pool.reserveStake,
            funder: manager.publicKey,
            destinationTokenAccount: toroAta,
            managerFeeAccount: pool.managerFeeAccount,
            referrerTokenAccount: toroAta,
            poolMint: mint,
            lamports: BigInt(Math.round(sol * LAMPORTS_PER_SOL)),
          }),
        ],
        manager,
        [],
        { cuLimit: 250_000, cuPriceMicroLamports: 15_000, dryRun, label: `mint-lst:${sol}SOL` },
      )
      break
    }

    case 'burn-lst': {
      const amt = Number(args[0])
      const pool = await fetchStakePoolState(conn, stakePool)
      await simulateOrSendTx(
        conn,
        [
          ixWithdrawSol({
            stakePool,
            reserveStake: pool.reserveStake,
            burner: manager.publicKey,
            burnerTokenAccount: toroAta,
            recipientSol: manager.publicKey,
            managerFeeAccount: pool.managerFeeAccount,
            poolMint: mint,
            poolTokens: BigInt(Math.round(amt * 1e9)),
          }),
        ],
        manager,
        [],
        { cuLimit: 250_000, cuPriceMicroLamports: 15_000, dryRun, label: `burn-lst:${amt}` },
      )
      break
    }

    case 'jup-check': {
      for (const [label, inp, out] of [
        ['SOL → toroSOL', WSOL_MINT.toBase58(), dep.mint],
        ['toroSOL → SOL', dep.mint, WSOL_MINT.toBase58()],
      ]) {
        const r = await fetch(
          `${JUPITER_URL}/swap/v1/quote?inputMint=${inp}&outputMint=${out}&amount=100000000&slippageBps=300`,
          { headers: { 'x-api-key': JUPITER_API_KEY } },
        )
        const j = await r.json()
        log(`${label} (${r.status}): ${JSON.stringify(j).slice(0, 320)}`)
      }
      break
    }

    default:
      console.log(
        `Usage: bun run knobs <status|set-orca-fee|set-proto-fee|set-deposit-fee|set-withdraw-fee|set-t22-fee|set-uri|harvest-burn|collect-fees|mint-lst|burn-lst|jup-check> [args] [--dry-run]`,
      )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
