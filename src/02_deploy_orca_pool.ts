#!/usr/bin/env bun
/**
 * 02_deploy_orca_pool.ts — Deploy SOL/toroSOL Orca Whirlpool on our owned 12Nqk2jy config
 * using Dynamic Tick Arrays (148 B rent), Token-2022 Position NFT, 25% protocol rake,
 * and tight ultra-THICC liquidity centered around live Stake Pool NAV.
 *
 * Usage:
 *   bun run deploy:orca              # dry-run simulation
 *   bun run deploy:orca --execute    # broadcast mainnet deploy
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
  createSyncNativeInstruction,
} from '@solana/spl-token'
import {
  JUPITER_API_KEY,
  JUPITER_URL,
  loadDeployment,
  loadManagerKeypair,
  loadOrcaAuthKeypair,
  ORCA_CONFIG,
  ORCA_DEPLOY_SOL,
  ORCA_DEPLOY_TORO,
  ORCA_INITIAL_FEE_RATE,
  ORCA_PROTOCOL_FEE_RATE,
  ORCA_TICK_SPACING,
  saveDeployment,
  TOKEN_2022_PROGRAM,
  TOKEN_PROGRAM,
  WSOL_MINT,
} from './config'
import { fetchMintTransferFeeBps, fetchStakePoolState } from './sanctum'
import { createConnection, getTokenBalanceAndWithheld, log, simulateOrSendTx } from './tx'
import {
  alignTickCeil,
  alignTickFloor,
  computeLiquidityForAmounts,
  deriveAta,
  deriveFeeTierPda,
  derivePositionPda,
  deriveTickArrayPda,
  deriveWhirlpoolPda,
  getStartTickIndex,
  ixIncreaseLiquidityV2,
  ixInitializeDynamicTickArray,
  ixInitializeFeeTier,
  ixInitializePoolV2,
  ixOpenPositionWithTokenExtensions,
  ixSetFeeRate,
  ixSetProtocolFeeRate,
  orderMints,
  priceToSqrtPriceX64,
  priceToTickIndex,
  sqrtPriceX64ToPrice,
} from './whirlpool'

async function main() {
  const execute = process.argv.includes('--execute')
  const dep = loadDeployment()
  if (!dep) {
    throw new Error('state/deployment.json not found — run `bun run deploy:lst --execute` first!')
  }

  const conn = createConnection()
  const manager = loadManagerKeypair()
  const orcaAuth = loadOrcaAuthKeypair()
  const toroMint = new PublicKey(dep.mint)
  const stakePool = new PublicKey(dep.stakePool)

  const poolState = await fetchStakePoolState(conn, stakePool)
  const { bps: t22Bps } = await fetchMintTransferFeeBps(conn, toroMint)
  const navSolPerToro = poolState.navSolPerToken

  const [mintA, mintB] = orderMints(WSOL_MINT, toroMint)
  const solIsA = mintA.equals(WSOL_MINT)
  const tokenProgramA = solIsA ? TOKEN_PROGRAM : TOKEN_2022_PROGRAM
  const tokenProgramB = solIsA ? TOKEN_2022_PROGRAM : TOKEN_PROGRAM

  // Orca price = tokenB / tokenA
  // If solIsA (A=SOL, B=toroSOL): price = toroSOL per SOL = 1 / navSolPerToro
  // If !solIsA (A=toroSOL, B=SOL): price = SOL per toroSOL = navSolPerToro
  const initPriceBPerA = solIsA ? 1.0 / navSolPerToro : navSolPerToro
  const initSqrtPrice = priceToSqrtPriceX64(initPriceBPerA, 9, 9)
  const initTick = priceToTickIndex(initPriceBPerA, 9, 9)

  // Tight THICC active range around NAV: [0.976x NAV, 1.045x NAV] in SOL/toroSOL terms
  // That puts ~1/3 SOL bid cushion down to the -2.4% buy→burn arber line and ~2/3 toroSOL ask
  // up through the +2.1% mint→sell arber line to +4.5%!
  const lowMultNav = Number(process.env.BAND_LOW_MULT ?? '0.976')
  const highMultNav = Number(process.env.BAND_HIGH_MULT ?? '1.050')
  let pLowBPerA: number
  let pHighBPerA: number
  if (solIsA) {
    // price = 1 / (SOL per toroSOL) → higher SOL/toroSOL = LOWER tick!
    pLowBPerA = 1.0 / (navSolPerToro * highMultNav)
    pHighBPerA = 1.0 / (navSolPerToro * lowMultNav)
  } else {
    pLowBPerA = navSolPerToro * lowMultNav
    pHighBPerA = navSolPerToro * highMultNav
  }
  const tickLower = alignTickFloor(priceToTickIndex(pLowBPerA, 9, 9), ORCA_TICK_SPACING)
  const tickUpper = alignTickCeil(priceToTickIndex(pHighBPerA, 9, 9), ORCA_TICK_SPACING)

  const feeTierPda = deriveFeeTierPda(ORCA_CONFIG, ORCA_TICK_SPACING)
  const whirlpoolPda = deriveWhirlpoolPda(ORCA_CONFIG, mintA, mintB, ORCA_TICK_SPACING)
  const startLower = getStartTickIndex(tickLower, ORCA_TICK_SPACING)
  const startCenter = getStartTickIndex(initTick, ORCA_TICK_SPACING)
  const startUpper = getStartTickIndex(tickUpper, ORCA_TICK_SPACING)
  const uniqueStarts = Array.from(
    new Set([
      getStartTickIndex(initTick, ORCA_TICK_SPACING, -1),
      startLower,
      startCenter,
      startUpper,
      getStartTickIndex(initTick, ORCA_TICK_SPACING, 1),
    ]),
  ).sort((a, b) => a - b)

  log(`=== 02_deploy_orca_pool (${execute ? 'MAINNET EXECUTE' : 'DRY-RUN SIMULATION'}) ===`)
  log(`config:      ${ORCA_CONFIG.toBase58()} (auth=${orcaAuth.publicKey.toBase58()})`)
  log(`whirlpool:   ${whirlpoolPda.toBase58()} (ts=${ORCA_TICK_SPACING})`)
  log(`mintA:       ${mintA.toBase58()} (${solIsA ? 'WSOL' : dep.tokenSymbol})`)
  log(`mintB:       ${mintB.toBase58()} (${solIsA ? dep.tokenSymbol : 'WSOL'})`)
  log(`NAV:         ${navSolPerToro.toFixed(6)} SOL/${dep.tokenSymbol} | T22=${t22Bps}bps`)
  log(
    `init price:  ${sqrtPriceX64ToPrice(initSqrtPrice).toFixed(6)} B/A (tick=${initTick}) | ` +
      `band=[${tickLower}, ${tickUpper}] (${lowMultNav}x..${highMultNav}x NAV)`,
  )
  log(`dyn ticks:   ${uniqueStarts.join(', ')} (${uniqueStarts.length} × 148 B = ~${(uniqueStarts.length * 0.0019).toFixed(4)} SOL)`)

  // Check if FeeTier(ts) already exists
  const feeTierAcc = await conn.getAccountInfo(feeTierPda, 'confirmed')
  const whirlpoolAcc = await conn.getAccountInfo(whirlpoolPda, 'confirmed')

  // Step A: Initialize FeeTier if needed
  if (!feeTierAcc) {
    const ixFt = ixInitializeFeeTier({
      config: ORCA_CONFIG,
      funder: manager.publicKey,
      feeAuthority: orcaAuth.publicKey,
      tickSpacing: ORCA_TICK_SPACING,
      defaultFeeRate: ORCA_INITIAL_FEE_RATE,
    })
    await simulateOrSendTx(conn, [ixFt], manager, [orcaAuth], {
      cuLimit: 120_000,
      cuPriceMicroLamports: 25_000,
      dryRun: !execute,
      label: `tx0:init-fee-tier-ts${ORCA_TICK_SPACING}`,
    })
  } else {
    log(`FeeTier(ts=${ORCA_TICK_SPACING}) already exists: ${feeTierPda.toBase58()}`)
  }

  // Step B: Initialize Pool + Set Fee/ProtocolFee + Initialize Dynamic Tick Arrays
  const vaultAKp = Keypair.generate()
  const vaultBKp = Keypair.generate()
  let vaultAPub = vaultAKp.publicKey
  let vaultBPub = vaultBKp.publicKey

  if (!whirlpoolAcc) {
    const poolIxs: TransactionInstruction[] = [
      ixInitializePoolV2({
        config: ORCA_CONFIG,
        tokenMintA: mintA,
        tokenMintB: mintB,
        tokenProgramA,
        tokenProgramB,
        funder: manager.publicKey,
        tokenVaultA: vaultAKp.publicKey,
        tokenVaultB: vaultBKp.publicKey,
        tickSpacing: ORCA_TICK_SPACING,
        initialSqrtPrice: initSqrtPrice,
      }),
      ixSetFeeRate({
        config: ORCA_CONFIG,
        whirlpool: whirlpoolPda,
        feeAuthority: orcaAuth.publicKey,
        feeRate: ORCA_INITIAL_FEE_RATE,
      }),
      ixSetProtocolFeeRate({
        config: ORCA_CONFIG,
        whirlpool: whirlpoolPda,
        feeAuthority: orcaAuth.publicKey,
        protocolFeeRate: ORCA_PROTOCOL_FEE_RATE,
      }),
      ...uniqueStarts.map((st) =>
        ixInitializeDynamicTickArray({
          whirlpool: whirlpoolPda,
          funder: manager.publicKey,
          startTickIndex: st,
          idempotent: true,
        }),
      ),
    ]
    await simulateOrSendTx(conn, poolIxs, manager, [orcaAuth, vaultAKp, vaultBKp], {
      cuLimit: 500_000,
      cuPriceMicroLamports: 25_000,
      dryRun: !execute,
      label: 'tx1:init-whirlpool-v2+dynamic-tick-arrays',
    })
  } else {
    log(`Whirlpool already exists: ${whirlpoolPda.toBase58()}`)
    vaultAPub = new PublicKey(whirlpoolAcc.data.subarray(133, 165))
    vaultBPub = new PublicKey(whirlpoolAcc.data.subarray(213, 245))
  }

  // Step C: Open Token-2022 Position + Deposit Tight THICC Liquidity
  const wsolAta = deriveAta(manager.publicKey, WSOL_MINT, TOKEN_PROGRAM)
  const toroAta = deriveAta(manager.publicKey, toroMint, TOKEN_2022_PROGRAM)
  const toroBal = await getTokenBalanceAndWithheld(conn, toroAta)

  const maxSolAtoms = BigInt(Math.floor(ORCA_DEPLOY_SOL * LAMPORTS_PER_SOL))
  const availToroAtoms = toroBal.spendable > 0n ? toroBal.spendable : BigInt(Math.floor(ORCA_DEPLOY_TORO * 1e9))
  const targetToroAtoms =
    availToroAtoms < BigInt(Math.floor(ORCA_DEPLOY_TORO * 1e9))
      ? availToroAtoms
      : BigInt(Math.floor(ORCA_DEPLOY_TORO * 1e9))

  // Account for Token-2022 transfer fee on deposit into Orca vault:
  // Orca takes `transfer_fee_included_amount` from user so vault receives `delta`.
  // So max net-in-vault toroSOL = targetToroAtoms * (10000 - t22Bps - 5) / 10000
  const netToroCap = (targetToroAtoms * BigInt(10_000 - t22Bps - 10)) / 10_000n
  const maxNetA = solIsA ? maxSolAtoms : netToroCap
  const maxNetB = solIsA ? netToroCap : maxSolAtoms

  const { liquidity, reqA, reqB } = computeLiquidityForAmounts(
    initSqrtPrice,
    tickLower,
    tickUpper,
    maxNetA,
    maxNetB,
  )
  // Gross transfer amounts including T22 fee + 1% slippage buffer
  const grossFromNet = (net: bigint, isToro: boolean) => {
    if (!isToro || t22Bps === 0) return (net * 101n) / 100n + 1000n
    const withFee = (net * 10_000n) / BigInt(10_000 - t22Bps) + 1000n
    return (withFee * 101n) / 100n
  }
  const tokenMaxA = grossFromNet(reqA, !solIsA)
  const tokenMaxB = grossFromNet(reqB, solIsA)
  const solToWrap = solIsA ? reqA + 5_000_000n : reqB + 5_000_000n

  log(
    `position math: L=${liquidity.toString()} | reqA=${(Number(reqA) / 1e9).toFixed(4)} | ` +
      `reqB=${(Number(reqB) / 1e9).toFixed(4)} | wrapSOL=${(Number(solToWrap) / 1e9).toFixed(4)}`,
  )

  const positionMintKp = Keypair.generate()
  const positionPda = derivePositionPda(positionMintKp.publicKey)
  const positionTokenAta = deriveAta(manager.publicKey, positionMintKp.publicKey, TOKEN_2022_PROGRAM)
  const tickArrayLower = deriveTickArrayPda(whirlpoolPda, startLower)
  const tickArrayUpper = deriveTickArrayPda(whirlpoolPda, startUpper)

  const posIxs: TransactionInstruction[] = [
    createAssociatedTokenAccountIdempotentInstruction(
      manager.publicKey,
      wsolAta,
      manager.publicKey,
      WSOL_MINT,
      TOKEN_PROGRAM,
    ),
    SystemProgram.transfer({
      fromPubkey: manager.publicKey,
      toPubkey: wsolAta,
      lamports: solToWrap,
    }),
    createSyncNativeInstruction(wsolAta, TOKEN_PROGRAM),
    ixOpenPositionWithTokenExtensions({
      funder: manager.publicKey,
      owner: manager.publicKey,
      positionMint: positionMintKp.publicKey,
      whirlpool: whirlpoolPda,
      tickLowerIndex: tickLower,
      tickUpperIndex: tickUpper,
      withTokenMetadata: true,
    }),
    ixIncreaseLiquidityV2({
      whirlpool: whirlpoolPda,
      tokenProgramA,
      tokenProgramB,
      positionAuthority: manager.publicKey,
      position: positionPda,
      positionTokenAccount: positionTokenAta,
      tokenMintA: mintA,
      tokenMintB: mintB,
      tokenOwnerAccountA: solIsA ? wsolAta : toroAta,
      tokenOwnerAccountB: solIsA ? toroAta : wsolAta,
      tokenVaultA: vaultAPub,
      tokenVaultB: vaultBPub,
      tickArrayLower,
      tickArrayUpper,
      liquidityAmount: liquidity,
      tokenMaxA,
      tokenMaxB,
    }),
  ]

  if (!execute) {
    log(`(Position open+increase simulation requires live pool on-chain; run with --execute after LST deploy.)`)
    return
  }

  await simulateOrSendTx(conn, posIxs, manager, [positionMintKp], {
    cuLimit: 600_000,
    cuPriceMicroLamports: 25_000,
    dryRun: false,
    label: 'tx2:open-position-t22+increase-liquidity',
  })

  saveDeployment({
    ...dep,
    orcaConfig: ORCA_CONFIG.toBase58(),
    feeTier: feeTierPda.toBase58(),
    tickSpacing: ORCA_TICK_SPACING,
    whirlpool: whirlpoolPda.toBase58(),
    tokenMintA: mintA.toBase58(),
    tokenMintB: mintB.toBase58(),
    tokenVaultA: vaultAPub.toBase58(),
    tokenVaultB: vaultBPub.toBase58(),
    solIsA,
    position: positionPda.toBase58(),
    positionMint: positionMintKp.publicKey.toBase58(),
    positionTokenAccount: positionTokenAta.toBase58(),
  })

  log(`=== ORCA CLMM LIVE ===`)
  log(`  whirlpool: ${whirlpoolPda.toBase58()}`)
  log(`  position:  ${positionPda.toBase58()} (ticks [${tickLower}, ${tickUpper}])`)

  // Probe Jupiter routing
  try {
    const qUrl = `${JUPITER_URL}/swap/v1/quote?inputMint=${WSOL_MINT.toBase58()}&outputMint=${toroMint.toBase58()}&amount=100000000&slippageBps=300`
    const r = await fetch(qUrl, { headers: { 'x-api-key': JUPITER_API_KEY } })
    const txt = await r.text()
    log(`Jupiter quote probe (${r.status}): ${txt.slice(0, 260)}`)
  } catch (e) {
    log(`Jupiter probe error (indexing may take 1-2 min): ${(e as Error).message}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
