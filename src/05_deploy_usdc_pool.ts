#!/usr/bin/env bun
/**
 * 05_deploy_usdc_pool.ts — Deploy secondary USDC / toroSOL Orca Whirlpool on our owned
 * 12Nqk2jy WhirlpoolsConfig (ts=64, 0.30% swap fee, 25% protocol rake → 331, Dynamic Tick Arrays).
 *
 * Converts natural ±2% SOL/USD volatility into zero-bait, 100%-net-profitable cross-pool bot arbs
 * (USDC ↔ toroSOL ↔ SOL) and unlocks direct Jupiter USDC ↔ toroSOL routing!
 *
 * Usage:
 *   bun run src/05_deploy_usdc_pool.ts            # dry-run simulation
 *   bun run src/05_deploy_usdc_pool.ts --execute  # mainnet deploy
 */

import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js'
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
} from '@solana/spl-token'
import {
  loadDeployment,
  loadManagerKeypair,
  loadOrcaAuthKeypair,
  ORCA_CONFIG,
  ORCA_PROTOCOL_FEE_RATE,
  saveDeployment,
  SOL_USDC_ORACLE_POOL,
  TOKEN_2022_PROGRAM,
  TOKEN_PROGRAM,
  USDC_MINT,
  WSOL_MINT,
} from './config'
import {
  fetchMintTransferFeeBps,
  fetchStakePoolState,
  ixDepositSol,
  ixWithdrawWithheldFromAccounts,
} from './sanctum'
import { createConnection, getTokenBalanceAndWithheld, log, simulateOrSendTx } from './tx'
import {
  alignTickCeil,
  alignTickFloor,
  computeAmountsForLiquidity,
  computeLiquidityForAmounts,
  deriveAta,
  deriveFeeTierPda,
  deriveOraclePda,
  derivePositionPda,
  deriveTickArrayPda,
  deriveWhirlpoolPda,
  getStartTickIndex,
  ixDecreaseLiquidityV2,
  ixIncreaseLiquidityV2,
  ixInitializeDynamicTickArray,
  ixInitializeFeeTier,
  ixInitializePoolV2,
  ixOpenPositionWithTokenExtensions,
  ixSetFeeRate,
  ixSetProtocolFeeRate,
  ixSwapV2,
  orderMints,
  parsePosition,
  parseWhirlpool,
  priceToSqrtPriceX64,
  priceToTickIndex,
  sqrtPriceX64ToPrice,
  tickIndexToSqrtPriceX64,
} from './whirlpool'

const USDC_POOL_TICK_SPACING = 64
const USDC_POOL_FEE_RATE = 3000 // 0.30% constant swap fee (25% protocol rake → 331)
const DEPLOY_SOL_EACH_SIDE = Number(process.env.USDC_DEPLOY_SOL_EACH_SIDE ?? '0.40') // 0.40 SOL → USDC + 0.40 SOL → toroSOL (~0.80 SOL total)
const BAND_PCT = Number(process.env.USDC_BAND_PCT ?? '0.11') // ±11% around live USD/toroSOL (stiff depth + wide SOL/USD runway!)

async function main() {
  const execute = process.argv.includes('--execute')
  const dep = loadDeployment()
  if (!dep || !dep.whirlpool || !dep.position) {
    throw new Error('Incomplete state/deployment.json — deploy SOL/toroSOL pool first!')
  }
  if (dep.usdcWhirlpool && dep.usdcPosition) {
    log(`USDC/toroSOL pool ALREADY deployed: pool=${dep.usdcWhirlpool} pos=${dep.usdcPosition}`)
    return
  }

  const conn = createConnection()
  const manager = loadManagerKeypair()
  const orcaAuth = loadOrcaAuthKeypair()
  const toroMint = new PublicKey(dep.mint)
  const stakePool = new PublicKey(dep.stakePool)
  const solWhirlpoolPk = new PublicKey(dep.whirlpool)
  const solPositionPk = new PublicKey(dep.position)
  const solPosTokenAta = new PublicKey(dep.positionTokenAccount!)

  const [solWpAcc, solPosAcc, oracleWpAcc] = await conn.getMultipleAccountsInfo(
    [solWhirlpoolPk, solPositionPk, SOL_USDC_ORACLE_POOL],
    'confirmed',
  )
  if (!solWpAcc || !solPosAcc || !oracleWpAcc) throw new Error('failed to load core whirlpool accounts')
  const solWp = parseWhirlpool(solWpAcc.data)
  const solPos = parsePosition(solPosAcc.data)
  const oracleWp = parseWhirlpool(oracleWpAcc.data)
  const poolState = await fetchStakePoolState(conn, stakePool)
  const { bps: t22Bps } = await fetchMintTransferFeeBps(conn, toroMint)

  const solUsd = sqrtPriceX64ToPrice(oracleWp.sqrtPrice, 9, 6)
  const bPerASol = sqrtPriceX64ToPrice(solWp.sqrtPrice, 9, 9)
  const spotSolPerToro = dep.solIsA ? 1.0 / bPerASol : bPerASol
  const spotUsdPerToro = solUsd * spotSolPerToro

  // Verify mint ordering: USDC (6 dec) vs toroSOL (9 dec)
  const [mintA, mintB] = orderMints(USDC_MINT, toroMint)
  const usdcIsA = mintA.equals(USDC_MINT)
  if (!usdcIsA) throw new Error('Unexpected mint ordering: expected USDC < toroSOL')
  const decA = 6
  const decB = 9
  const tokenProgramA = TOKEN_PROGRAM
  const tokenProgramB = TOKEN_2022_PROGRAM

  // Orca price = tokenB / tokenA = toroSOL per USDC = 1 / spotUsdPerToro
  const initPriceBPerA = 1.0 / spotUsdPerToro
  const initSqrtPrice = priceToSqrtPriceX64(initPriceBPerA, decA, decB)
  const initTick = priceToTickIndex(initPriceBPerA, decA, decB)
  // Higher USD/toroSOL = LOWER B/A tick; lower USD/toroSOL = HIGHER B/A tick
  const pLowBPerA = 1.0 / (spotUsdPerToro * (1 + BAND_PCT))
  const pHighBPerA = 1.0 / (spotUsdPerToro * (1 - BAND_PCT))
  const tickLower = alignTickFloor(priceToTickIndex(pLowBPerA, decA, decB), USDC_POOL_TICK_SPACING)
  const tickUpper = alignTickCeil(priceToTickIndex(pHighBPerA, decA, decB), USDC_POOL_TICK_SPACING)

  const feeTierPda = deriveFeeTierPda(ORCA_CONFIG, USDC_POOL_TICK_SPACING)
  const usdcWhirlpoolPda = deriveWhirlpoolPda(ORCA_CONFIG, mintA, mintB, USDC_POOL_TICK_SPACING)
  const uniqueStarts = Array.from(
    new Set([
      getStartTickIndex(initTick, USDC_POOL_TICK_SPACING, -1),
      getStartTickIndex(tickLower, USDC_POOL_TICK_SPACING),
      getStartTickIndex(initTick, USDC_POOL_TICK_SPACING),
      getStartTickIndex(tickUpper, USDC_POOL_TICK_SPACING),
      getStartTickIndex(initTick, USDC_POOL_TICK_SPACING, 1),
    ]),
  ).sort((a, b) => a - b)

  const wsolAta = deriveAta(manager.publicKey, WSOL_MINT, TOKEN_PROGRAM)
  const usdcAta = deriveAta(manager.publicKey, USDC_MINT, TOKEN_PROGRAM)
  const toroAta = deriveAta(manager.publicKey, toroMint, TOKEN_2022_PROGRAM)

  const [nativeLam, usdcState, toroState, feeTierAcc, usdcPoolAcc] = await Promise.all([
    conn.getBalance(manager.publicKey, 'confirmed'),
    getTokenBalanceAndWithheld(conn, usdcAta),
    getTokenBalanceAndWithheld(conn, toroAta),
    conn.getAccountInfo(feeTierPda, 'confirmed'),
    conn.getAccountInfo(usdcWhirlpoolPda, 'confirmed'),
  ])

  log(`=== 05_deploy_usdc_pool (${execute ? 'MAINNET EXECUTE' : 'DRY-RUN SIMULATION'}) ===`)
  log(`SOL/USD:     $${solUsd.toFixed(4)} | spot=${spotSolPerToro.toFixed(5)} SOL/toroSOL → $${spotUsdPerToro.toFixed(4)}/toroSOL`)
  log(`whirlpool:   ${usdcWhirlpoolPda.toBase58()} (ts=${USDC_POOL_TICK_SPACING}, fee=${USDC_POOL_FEE_RATE / 100}bps, proto=25%)`)
  log(
    `band:        [${tickLower}, ${tickUpper}] ($${(spotUsdPerToro * (1 - BAND_PCT)).toFixed(2)} .. $${(spotUsdPerToro * (1 + BAND_PCT)).toFixed(2)} / toroSOL, initTick=${initTick})`,
  )
  log(`dyn ticks:   ${uniqueStarts.join(', ')} (${uniqueStarts.length} × 148 B)`)
  log(
    `wallet now:  SOL=${(nativeLam / 1e9).toFixed(4)} | USDC=$${(Number(usdcState.spendable) / 1e6).toFixed(2)} | toroSOL=${(Number(toroState.spendable) / 1e9).toFixed(4)}`,
  )

  // Step 0: Ensure wallet has enough SOL + USDC + toroSOL without draining SOL reserve (<0.22 SOL).
  // If needed, gently trim ~7% of our SOL/toroSOL position (0% loss via in-tx T22 self-recovery!).
  const targetUsdcAtoms = BigInt(Math.floor(DEPLOY_SOL_EACH_SIDE * solUsd * 1e6))
  const targetToroGrossAtoms = BigInt(Math.floor((DEPLOY_SOL_EACH_SIDE / spotSolPerToro) * 1.03 * 1e9))
  const needUsdc = targetUsdcAtoms > usdcState.spendable ? targetUsdcAtoms - usdcState.spendable : 0n
  const solForUsdc = needUsdc > 0n ? BigInt(Math.ceil((Number(needUsdc) / 1e6 / solUsd) * 1.005 * 1e9)) : 0n
  const needToro = targetToroGrossAtoms > toroState.spendable ? targetToroGrossAtoms - toroState.spendable : 0n
  const solForToro = needToro > 0n ? BigInt(Math.ceil((Number(needToro) / 1e9) * poolState.navSolPerToken * 1.005 * 1e9)) : 0n
  const totalSolNeeded = solForUsdc + solForToro + 260_000_000n // keep >=0.24 SOL reserve + ~0.02 SOL rent

  if (BigInt(nativeLam) < totalSolNeeded) {
    const shortfallSol = totalSolNeeded - BigInt(nativeLam)
    const curAmts = computeAmountsForLiquidity(solWp.sqrtPrice, solPos.tickLowerIndex, solPos.tickUpperIndex, solPos.liquidity)
    const lpSol = dep.solIsA ? curAmts.reqA : curAmts.reqB
    // Pull just enough L (min 6%, max 14%) to supply the SOL + bonus toroSOL cleanly
    const fracBps = Math.min(1400, Math.max(600, Math.ceil((Number(shortfallSol) / Number(lpSol)) * 10_000) + 100))
    const pullL = (solPos.liquidity * BigInt(fracBps)) / 10_000n
    const pulled = computeAmountsForLiquidity(solWp.sqrtPrice, solPos.tickLowerIndex, solPos.tickUpperIndex, pullL)
    log(
      `[tx0:fund] pulling ${(fracBps / 100).toFixed(1)}% of SOL/toroSOL LP → +${(Number(pulled.reqA) / 1e9).toFixed(3)} SOL & +${(Number(pulled.reqB) / 1e9).toFixed(3)} toroSOL (0% loss)`,
    )
    const taLow = deriveTickArrayPda(solWhirlpoolPk, getStartTickIndex(solPos.tickLowerIndex, dep.tickSpacing!))
    const taHigh = deriveTickArrayPda(solWhirlpoolPk, getStartTickIndex(solPos.tickUpperIndex, dep.tickSpacing!))
    await simulateOrSendTx(
      conn,
      [
        createAssociatedTokenAccountIdempotentInstruction(manager.publicKey, wsolAta, manager.publicKey, WSOL_MINT, TOKEN_PROGRAM),
        ixDecreaseLiquidityV2({
          whirlpool: solWhirlpoolPk,
          tokenProgramA: TOKEN_PROGRAM,
          tokenProgramB: TOKEN_2022_PROGRAM,
          positionAuthority: manager.publicKey,
          position: solPositionPk,
          positionTokenAccount: solPosTokenAta,
          tokenMintA: new PublicKey(dep.tokenMintA!),
          tokenMintB: new PublicKey(dep.tokenMintB!),
          tokenOwnerAccountA: wsolAta,
          tokenOwnerAccountB: toroAta,
          tokenVaultA: solWp.tokenVaultA,
          tokenVaultB: solWp.tokenVaultB,
          tickArrayLower: taLow,
          tickArrayUpper: taHigh,
          liquidityAmount: pullL,
          tokenMinA: 0n,
          tokenMinB: 0n,
        }),
        ixWithdrawWithheldFromAccounts({
          mint: toroMint,
          destination: toroAta,
          authority: manager.publicKey,
          sources: [toroAta],
        }),
        createCloseAccountInstruction(wsolAta, manager.publicKey, manager.publicKey, [], TOKEN_PROGRAM),
      ],
      manager,
      [],
      { cuLimit: 180_000, cuPriceMicroLamports: 10_000, dryRun: !execute, label: 'usdc-deploy:tx0-pull-lp-funding' },
    )
  }

  // Step 1: Atomically swap SOL → USDC (on Orca canonical 0.04% SOL/USDC pool) + mint any remaining toroSOL at 0% fee!
  const freshUsdc = execute ? (await getTokenBalanceAndWithheld(conn, usdcAta)).spendable : usdcState.spendable
  const freshToro = execute ? (await getTokenBalanceAndWithheld(conn, toroAta)).spendable : toroState.spendable
  const swapSolIn =
    targetUsdcAtoms > freshUsdc
      ? BigInt(Math.ceil((Number(targetUsdcAtoms - freshUsdc) / 1e6 / solUsd) * 1.003 * 1e9))
      : 0n
  const mintToroSolIn =
    targetToroGrossAtoms > freshToro
      ? BigInt(Math.ceil((Number(targetToroGrossAtoms - freshToro) / 1e9) * poolState.navSolPerToken * 1.005 * 1e9))
      : 0n

  if (swapSolIn > 10_000_000n || mintToroSolIn > 10_000_000n) {
    const prepFundIxs: TransactionInstruction[] = [
      createAssociatedTokenAccountIdempotentInstruction(manager.publicKey, usdcAta, manager.publicKey, USDC_MINT, TOKEN_PROGRAM),
    ]
    if (swapSolIn > 10_000_000n) {
      const oTs = oracleWp.tickSpacing
      const oTa0 = deriveTickArrayPda(SOL_USDC_ORACLE_POOL, getStartTickIndex(oracleWp.tickCurrentIndex, oTs, 0))
      const oTa1 = deriveTickArrayPda(SOL_USDC_ORACLE_POOL, getStartTickIndex(oracleWp.tickCurrentIndex, oTs, -1))
      const oTa2 = deriveTickArrayPda(SOL_USDC_ORACLE_POOL, getStartTickIndex(oracleWp.tickCurrentIndex, oTs, -2))
      prepFundIxs.push(
        createAssociatedTokenAccountIdempotentInstruction(manager.publicKey, wsolAta, manager.publicKey, WSOL_MINT, TOKEN_PROGRAM),
        SystemProgram.transfer({ fromPubkey: manager.publicKey, toPubkey: wsolAta, lamports: swapSolIn }),
        createSyncNativeInstruction(wsolAta, TOKEN_PROGRAM),
        ixSwapV2({
          tokenProgramA: TOKEN_PROGRAM,
          tokenProgramB: TOKEN_PROGRAM,
          tokenAuthority: manager.publicKey,
          whirlpool: SOL_USDC_ORACLE_POOL,
          tokenMintA: WSOL_MINT,
          tokenMintB: USDC_MINT,
          tokenOwnerAccountA: wsolAta,
          tokenVaultA: oracleWp.tokenVaultA,
          tokenOwnerAccountB: usdcAta,
          tokenVaultB: oracleWp.tokenVaultB,
          tickArray0: oTa0,
          tickArray1: oTa1,
          tickArray2: oTa2,
          oracle: deriveOraclePda(SOL_USDC_ORACLE_POOL),
          amount: swapSolIn,
          otherAmountThreshold: (targetUsdcAtoms * 97n) / 100n,
          sqrtPriceLimit: tickIndexToSqrtPriceX64(oracleWp.tickCurrentIndex - 200),
          amountSpecifiedIsInput: true,
          aToB: true,
        }),
        createCloseAccountInstruction(wsolAta, manager.publicKey, manager.publicKey, [], TOKEN_PROGRAM),
      )
    }
    if (mintToroSolIn > 10_000_000n) {
      prepFundIxs.push(
        ixDepositSol({
          stakePool,
          reserveStake: poolState.reserveStake,
          funder: manager.publicKey,
          destinationTokenAccount: toroAta,
          managerFeeAccount: poolState.managerFeeAccount,
          referrerTokenAccount: toroAta,
          poolMint: toroMint,
          lamports: mintToroSolIn,
        }),
      )
    }
    log(
      `[tx1:acquire] swap ${(Number(swapSolIn) / 1e9).toFixed(4)} SOL → USDC (Orca 0.04%)` +
        (mintToroSolIn > 10_000_000n ? ` + mint ${(Number(mintToroSolIn) / 1e9).toFixed(4)} SOL → toroSOL (0% fee)` : ''),
    )
    await simulateOrSendTx(conn, prepFundIxs, manager, [], {
      cuLimit: 240_000,
      cuPriceMicroLamports: 10_000,
      dryRun: !execute,
      label: 'usdc-deploy:tx1-acquire-usdc+toro',
    })
  }

  // Step 2+3: Initialize FeeTier(ts=64) (if needed) + USDC/toroSOL Whirlpool + 0.30% fee + 25% proto rake + Dynamic Tick Arrays in ONE atomic tx!
  const vaultAKp = Keypair.generate()
  const vaultBKp = Keypair.generate()
  let vaultAPub = vaultAKp.publicKey
  let vaultBPub = vaultBKp.publicKey

  if (!usdcPoolAcc) {
    const initPoolIxs: TransactionInstruction[] = []
    if (!feeTierAcc) {
      initPoolIxs.push(
        ixInitializeFeeTier({
          config: ORCA_CONFIG,
          funder: manager.publicKey,
          feeAuthority: orcaAuth.publicKey,
          tickSpacing: USDC_POOL_TICK_SPACING,
          defaultFeeRate: USDC_POOL_FEE_RATE,
        }),
      )
    } else {
      log(`FeeTier(ts=64) already exists: ${feeTierPda.toBase58()}`)
    }
    initPoolIxs.push(
      ixInitializePoolV2({
        config: ORCA_CONFIG,
        tokenMintA: mintA,
        tokenMintB: mintB,
        tokenProgramA,
        tokenProgramB,
        funder: manager.publicKey,
        tokenVaultA: vaultAKp.publicKey,
        tokenVaultB: vaultBKp.publicKey,
        tickSpacing: USDC_POOL_TICK_SPACING,
        initialSqrtPrice: initSqrtPrice,
      }),
      ixSetFeeRate({
        config: ORCA_CONFIG,
        whirlpool: usdcWhirlpoolPda,
        feeAuthority: orcaAuth.publicKey,
        feeRate: USDC_POOL_FEE_RATE,
      }),
      ixSetProtocolFeeRate({
        config: ORCA_CONFIG,
        whirlpool: usdcWhirlpoolPda,
        feeAuthority: orcaAuth.publicKey,
        protocolFeeRate: ORCA_PROTOCOL_FEE_RATE,
      }),
      ...uniqueStarts.map((st) =>
        ixInitializeDynamicTickArray({
          whirlpool: usdcWhirlpoolPda,
          funder: manager.publicKey,
          startTickIndex: st,
          idempotent: true,
        }),
      ),
    )
    await simulateOrSendTx(conn, initPoolIxs, manager, [orcaAuth, vaultAKp, vaultBKp], {
      cuLimit: 550_000,
      cuPriceMicroLamports: 10_000,
      dryRun: !execute,
      label: 'usdc-deploy:tx2-init-feetier+pool+ticks',
    })
  } else {
    log(`USDC/toroSOL Whirlpool already exists: ${usdcWhirlpoolPda.toBase58()}`)
    vaultAPub = new PublicKey(usdcPoolAcc.data.subarray(133, 165))
    vaultBPub = new PublicKey(usdcPoolAcc.data.subarray(213, 245))
  }

  if (!execute) {
    log(`=== DRY-RUN COMPLETE — all pre-pool txs simulated cleanly! Re-run with --execute to deploy live. ===`)
    return
  }

  // Step 4: Open Token-2022 Position + Deposit Liquidity + Recover 100% of our own 2% T22 seed fee in-tx!
  const postUsdc = (await getTokenBalanceAndWithheld(conn, usdcAta)).spendable
  const postToro = (await getTokenBalanceAndWithheld(conn, toroAta)).spendable
  // Leave 0.02 toroSOL dust cushion in wallet for SOL/toroSOL keeper
  const deployToroGross = postToro > 20_000_000n ? postToro - 20_000_000n : 0n
  const deployToroNet = (deployToroGross * BigInt(10_000 - t22Bps - 15)) / 10_000n
  const deployUsdc = (postUsdc * 995n) / 1000n

  const { liquidity, reqA, reqB } = computeLiquidityForAmounts(
    initSqrtPrice,
    tickLower,
    tickUpper,
    deployUsdc,
    deployToroNet,
  )
  if (liquidity <= 0n) throw new Error(`Computed liquidity <= 0 (usdc=${deployUsdc}, toroNet=${deployToroNet})`)

  const tokenMaxA = (reqA * 102n) / 100n + 100n
  const tokenMaxB = ((reqB * 10_000n) / BigInt(10_000 - t22Bps)) * 102n / 100n + 50_000n

  const posMintKp = Keypair.generate()
  const posPda = derivePositionPda(posMintKp.publicKey)
  const posTokenAta = deriveAta(manager.publicKey, posMintKp.publicKey, TOKEN_2022_PROGRAM)
  const taLower = deriveTickArrayPda(usdcWhirlpoolPda, getStartTickIndex(tickLower, USDC_POOL_TICK_SPACING))
  const taUpper = deriveTickArrayPda(usdcWhirlpoolPda, getStartTickIndex(tickUpper, USDC_POOL_TICK_SPACING))

  log(
    `[tx4:seed] L=${liquidity.toString()} | USDC=$${(Number(reqA) / 1e6).toFixed(2)} | toroSOL=${(Number(reqB) / 1e9).toFixed(4)} (self-recovering 100% T22 seed fee in-tx!)`,
  )
  await simulateOrSendTx(
    conn,
    [
      ixOpenPositionWithTokenExtensions({
        funder: manager.publicKey,
        owner: manager.publicKey,
        positionMint: posMintKp.publicKey,
        whirlpool: usdcWhirlpoolPda,
        tickLowerIndex: tickLower,
        tickUpperIndex: tickUpper,
        withTokenMetadata: true,
      }),
      ixIncreaseLiquidityV2({
        whirlpool: usdcWhirlpoolPda,
        tokenProgramA,
        tokenProgramB,
        positionAuthority: manager.publicKey,
        position: posPda,
        positionTokenAccount: posTokenAta,
        tokenMintA: mintA,
        tokenMintB: mintB,
        tokenOwnerAccountA: usdcAta,
        tokenOwnerAccountB: toroAta,
        tokenVaultA: vaultAPub,
        tokenVaultB: vaultBPub,
        tickArrayLower: taLower,
        tickArrayUpper: taUpper,
        liquidityAmount: liquidity,
        tokenMaxA,
        tokenMaxB,
      }),
      // Zero-loss seed: recover 100% of our own 2% T22 withholding from vaultB right back into toroAta!
      ixWithdrawWithheldFromAccounts({
        mint: toroMint,
        destination: toroAta,
        authority: manager.publicKey,
        sources: [vaultBPub],
      }),
    ],
    manager,
    [posMintKp],
    { cuLimit: 450_000, cuPriceMicroLamports: 10_000, dryRun: false, label: 'usdc-deploy:tx4-open-pos+seed+recover' },
  )

  saveDeployment({
    ...dep,
    usdcWhirlpool: usdcWhirlpoolPda.toBase58(),
    usdcTickSpacing: USDC_POOL_TICK_SPACING,
    usdcTokenMintA: mintA.toBase58(),
    usdcTokenMintB: mintB.toBase58(),
    usdcTokenVaultA: vaultAPub.toBase58(),
    usdcTokenVaultB: vaultBPub.toBase58(),
    usdcPosition: posPda.toBase58(),
    usdcPositionMint: posMintKp.publicKey.toBase58(),
    usdcPositionTokenAccount: posTokenAta.toBase58(),
  })

  log(`=== USDC / toroSOL WHIRLPOOL LIVE ===`)
  log(`  whirlpool: ${usdcWhirlpoolPda.toBase58()} (ts=${USDC_POOL_TICK_SPACING}, fee=0.30%, proto=25%)`)
  log(`  position:  ${posPda.toBase58()} (ticks [${tickLower}, ${tickUpper}], L=${liquidity.toString()})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
