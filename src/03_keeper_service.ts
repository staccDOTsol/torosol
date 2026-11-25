#!/usr/bin/env bun
/**
 * 03_keeper_service.ts — v2 Self-Tuning Autonomous 24/7 Matador Arber-Inducer
 *
 * Self-iterating real-time controllers:
 *   1. Zero-Ping-Pong Ratio-Aware Rebalancer:
 *      - Computes exact CLMM SOL/toroSOL ratio before touching SP12tWFx so we NEVER ping-pong
 *        WithdrawSol <-> DepositSol and NEVER leak needless 2% T22 self-burns to external holders.
 *   2. Adaptive Muleta Edge Self-Tuner (18..55 bps):
 *      - Measures real-time Sanctum bot fill speed after every CLMM Kingmaker wave:
 *        * Fast snipe (<30s) → tightens edge -2 bps (down to 18 bps floor) to minimize spread cost.
 *        * Unsniped (>90s)   → widens edge +5 bps (up to 55 bps cap) so Jito bots always bite.
 *   3. Dust-Trade Filter (12 bps):
 *      - Tiny $0.01-$1 dust buys still trigger burn-loop immediately, but NEVER stall upward walks.
 *   4. Real-Time Equity Tracker + High-Water Circuit Breaker:
 *      - Logs live total SOL-equivalent equity every tick; auto-pauses Muleta if equity ever
 *        draws down > MAX_EQUITY_DRAWDOWN_SOL below watermark while keeping burns/fees/OOR live.
 *   5. RPC Failover + Zero Stale-State Races:
 *      - Automatically rotates between primary & backup Helius RPC on transient network errors,
 *        and skips to fresh chain read after any position/balance mutation (zero Custom:6009).
 */

import {
  Connection,
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
import fs from 'node:fs'
import {
  KEEPER_STATE_FILE,
  loadDeployment,
  loadManagerKeypair,
  loadOrcaAuthKeypair,
  RPC_URL,
  SOL_USDC_ORACLE_POOL,
  STATE_DIR,
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
  ixUpdateStakePoolBalance,
  ixUpdateValidatorListBalance,
  ixWithdrawSol,
  ixWithdrawWithheldFromAccounts,
  ixWithdrawWithheldFromMint,
  parseMintTransferFeeData,
  parseStakePoolData,
  parseValidatorListData,
  validatorStakePairs,
} from './sanctum'
import { getTokenBalanceAndWithheld, log, parseTokenBalanceAndWithheld, simulateOrSendTx, sleep } from './tx'
import {
  alignTickCeil,
  alignTickFloor,
  computeAmountsForLiquidity,
  computeLiquidityForAmounts,
  deriveAta,
  deriveOraclePda,
  deriveTickArrayPda,
  getStartTickIndex,
  ixCollectFeesV2,
  ixCollectProtocolFeesV2,
  ixDecreaseLiquidityV2,
  ixIncreaseLiquidityV2,
  ixInitializeDynamicTickArray,
  ixRepositionLiquidityV2,
  ixSetFeeRate,
  ixSwapV2,
  ixUpdateFeesAndRewards,
  parsePosition,
  parseWhirlpool,
  priceToSqrtPriceX64,
  priceToTickIndex,
  Q64,
  sqrtPriceX64ToPrice,
  tickIndexToSqrtPriceX64,
} from './whirlpool'

// ------------------------------------------------------------------- tuning knobs
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'
const FAST_TICK_MS = Number(process.env.FAST_TICK_MS ?? '10000') // 10s ticks (only 2 batched RPCs/tick!)
const BURN_TICK_MS = Number(process.env.BURN_TICK_MS ?? '120000')
const COLLECT_TICK_MS = Number(process.env.COLLECT_TICK_MS ?? '300000')
const MULETA_ENABLED = process.env.MULETA_ENABLED !== '0'
const MULETA_IDLE_MS = Number(process.env.MULETA_IDLE_MS ?? '120000') // 2m cadence (+50% faster NAV lift & volume at ~0.00033 SOL/wave!)
const MULETA_MIN_EDGE_BPS = Number(process.env.MULETA_MIN_EDGE_BPS ?? '12') // Live-proven: 11.00bp unsniped, 12.00bp = 100% 2s fill floor!
const MULETA_MAX_EDGE_BPS = Number(process.env.MULETA_MAX_EDGE_BPS ?? '45')
const RECOUP_MAX_PCT = BigInt(process.env.RECOUP_MAX_PCT ?? '95') // Recoup <=95% of wave T22 tax (38% lower net wave cost!), still burn >=5% every wave & 100% on organic buys!
const PRIO_FEE = Number(process.env.PRIO_FEE ?? '4000') // 4k microLamports (~0.000001 SOL/tx)
const MIN_COLLECT_LAMPORTS = BigInt(process.env.MIN_COLLECT_LAMPORTS ?? '1000000') // 0.001 SOL worth of LP+proto fees
const MAX_DAILY_BAIT_SOL = Number(process.env.MAX_DAILY_BAIT_SOL ?? '0.12')
const MAX_EQUITY_DRAWDOWN_SOL = Number(process.env.MAX_EQUITY_DRAWDOWN_SOL ?? '0.35')
const MIN_SOL_RESERVE = Number(process.env.MIN_SOL_RESERVE ?? '0.18')
const BAND_LOW_MULT = Number(process.env.BAND_LOW_MULT ?? '1.015')
const BAND_HIGH_MULT = Number(process.env.BAND_HIGH_MULT ?? '1.030')
const DUST_MOVE_FILTER_BPS = Number(process.env.DUST_MOVE_FILTER_BPS ?? '8')
const MIN_CLAIM_ATOMS = BigInt(process.env.MIN_CLAIM_ATOMS ?? '500000')

// Orca dynamic fee surfing ladder (hundredths of a bp: 3000=0.30%, 10000=1.00%, 30000=3.00%)
// Keep 0.30% constant during normal + Muleta (eliminates stale bot fee-cache misses, lifts spot +29bps,
// eliminates organic fee-discount window, and accrues 30x higher on-chain LP + 25% protocol fees!)
const FEE_ARBER_INVITE = 3000 // 0.30% constant (zero fee-flip cache staleness!)
const FEE_NORMAL = 3000 // 0.30% (30x more LP + 25% protocol rake on organic + arb volume!)
const FEE_SURGE_MID = 10000 // 1.00% when organic premium >= 3.4%
const FEE_SURGE_HIGH = 30000 // 3.00% when organic FOMO >= 6.0%

// Dual RPC pool for automatic network failover (loaded from .env / environment)
const RPC_URLS = Array.from(
  new Set([RPC_URL, ...(process.env.BACKUP_RPC_URL ? [process.env.BACKUP_RPC_URL] : [])]),
)
let rpcIdx = 0
function makeConn(url: string): Connection {
  return new Connection(url, {
    commitment: 'confirmed',
    wsEndpoint: 'wss://localhost:1',
    disableRetryOnRateLimit: false,
    confirmTransactionInitialTimeout: 60_000,
  })
}
let conn = makeConn(RPC_URLS[rpcIdx])
function rotateRpc(reason: string) {
  rpcIdx = (rpcIdx + 1) % RPC_URLS.length
  conn = makeConn(RPC_URLS[rpcIdx])
  log(`[rpc-failover] rotated to RPC #${rpcIdx} (${RPC_URLS[rpcIdx].split('?')[0]}) due to: ${reason}`)
}

interface KeeperState {
  lastExternalMoveMs: number
  lastSqrtPrice: string
  lastNav: number
  lastBurnMs: number
  lastCollectMs: number
  lastMuletaMs: number
  lastRebalanceMs: number
  lastRepositionMs: number
  // Adaptive Muleta edge tuning
  adaptiveEdgeBps: number
  pendingWaveCheck: boolean
  pendingWaveSentMs: number
  pendingWaveTargetSpot: number
  pendingWavePreEquitySol: number
  pendingWavePings: number
  snipedWaves: number
  unsnipedWaves: number
  // Equity & budget tracking
  outstandingBaitLamports: string
  dailyBaitDate: string
  dailyBaitLamports: string
  totalBurnedAtoms: string
  totalArbWaves: number
  lastEquitySol: number
  equityHighWaterSol: number
}

function loadKeeperState(): KeeperState {
  const today = new Date().toISOString().slice(0, 10)
  const base: KeeperState = {
    lastExternalMoveMs: Date.now(),
    lastSqrtPrice: '0',
    lastNav: 1.0,
    lastBurnMs: 0,
    lastCollectMs: 0,
    lastMuletaMs: 0,
    lastRebalanceMs: 0,
    lastRepositionMs: 0,
    adaptiveEdgeBps: Number(process.env.MULETA_EDGE_BPS ?? '28'),
    pendingWaveCheck: false,
    pendingWaveSentMs: 0,
    pendingWaveTargetSpot: 0,
    pendingWavePreEquitySol: 0,
    pendingWavePings: 0,
    snipedWaves: 0,
    unsnipedWaves: 0,
    outstandingBaitLamports: '0',
    dailyBaitDate: today,
    dailyBaitLamports: '0',
    totalBurnedAtoms: '0',
    totalArbWaves: 0,
    lastEquitySol: 0,
    equityHighWaterSol: 0,
  }
  if (fs.existsSync(KEEPER_STATE_FILE)) {
    const loaded = JSON.parse(fs.readFileSync(KEEPER_STATE_FILE, 'utf-8')) as Partial<KeeperState>
    const merged = { ...base, ...loaded }
    if (merged.dailyBaitDate !== today) {
      merged.dailyBaitDate = today
      merged.dailyBaitLamports = '0'
    }
    return merged
  }
  return base
}

function saveKeeperState(s: KeeperState) {
  fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 })
  fs.writeFileSync(KEEPER_STATE_FILE, JSON.stringify(s, null, 2), { mode: 0o600 })
}

process.on('unhandledRejection', (e) => log(`UNHANDLED REJECTION: ${(e as Error)?.message ?? e}`))
process.on('uncaughtException', (e) => log(`UNCAUGHT EXCEPTION: ${e.message}`))

function spotSolPerToro(sqrtPrice: bigint, solIsA: boolean): number {
  const bPerA = sqrtPriceX64ToPrice(sqrtPrice, 9, 9)
  return solIsA ? 1.0 / bPerA : bPerA
}

function computeArbThresholds(args: {
  nav: number
  t22Bps: number
  orcaFeeHundredthsBp: number
  solDepFee: { numerator: bigint; denominator: bigint }
  solWdFee: { numerator: bigint; denominator: bigint }
}) {
  const fT22 = args.t22Bps / 10_000
  const fOrca = args.orcaFeeHundredthsBp / 1_000_000
  const fDep =
    args.solDepFee.denominator > 0n
      ? Number(args.solDepFee.numerator) / Number(args.solDepFee.denominator)
      : 0
  const fWd =
    args.solWdFee.denominator > 0n
      ? Number(args.solWdFee.numerator) / Number(args.solWdFee.denominator)
      : 0
  const mintArbBreakEven = args.nav / ((1 - fDep) * (1 - fT22) * (1 - fOrca))
  const burnArbBreakEven = args.nav * (1 - fWd) * (1 - fT22) * (1 - fOrca)
  return { mintArbBreakEven, burnArbBreakEven, fT22, fOrca, fDep, fWd }
}

async function ensureTickArrays(
  whirlpool: PublicKey,
  funder: PublicKey,
  startTicks: number[],
): Promise<TransactionInstruction[]> {
  const unique = Array.from(new Set(startTicks))
  const pdas = unique.map((st) => deriveTickArrayPda(whirlpool, st))
  const infos = await conn.getMultipleAccountsInfo(pdas, 'confirmed')
  const ixs: TransactionInstruction[] = []
  for (let i = 0; i < unique.length; i++) {
    if (!infos[i]) {
      ixs.push(
        ixInitializeDynamicTickArray({
          whirlpool,
          funder,
          startTickIndex: unique[i],
          idempotent: true,
        }),
      )
    }
  }
  return ixs
}

async function main() {
  const dep = loadDeployment()
  if (!dep || !dep.whirlpool || !dep.position) {
    throw new Error('Incomplete state/deployment.json — deploy LST + Orca pool first!')
  }

  const manager = loadManagerKeypair()
  const orcaAuth = loadOrcaAuthKeypair()
  const ks = loadKeeperState()
  if (ks.adaptiveEdgeBps < MULETA_MIN_EDGE_BPS) {
    ks.adaptiveEdgeBps = MULETA_MIN_EDGE_BPS
    saveKeeperState(ks)
  }

  const mint = new PublicKey(dep.mint)
  const stakePool = new PublicKey(dep.stakePool)
  const validatorListPk = new PublicKey(dep.validatorList)
  const reserveStakePk = new PublicKey(dep.reserveStake)
  const orcaConfig = new PublicKey(dep.orcaConfig!)
  const whirlpoolPk = new PublicKey(dep.whirlpool)
  const positionPk = new PublicKey(dep.position)
  const positionTokenAta = new PublicKey(dep.positionTokenAccount!)
  const solIsA = Boolean(dep.solIsA)
  const tickSpacing = dep.tickSpacing!
  const mintA = new PublicKey(dep.tokenMintA!)
  const mintB = new PublicKey(dep.tokenMintB!)
  const tokenProgramA = solIsA ? TOKEN_PROGRAM : TOKEN_2022_PROGRAM
  const tokenProgramB = solIsA ? TOKEN_2022_PROGRAM : TOKEN_PROGRAM
  const wsolAta = deriveAta(manager.publicKey, WSOL_MINT, TOKEN_PROGRAM)
  const usdcAta = deriveAta(manager.publicKey, USDC_MINT, TOKEN_PROGRAM)
  const toroAta = deriveAta(manager.publicKey, mint, TOKEN_2022_PROGRAM)
  const ownerAtaA = solIsA ? wsolAta : toroAta
  const ownerAtaB = solIsA ? toroAta : wsolAta
  // Optional secondary USDC / toroSOL cross-arb pool (mintA=USDC 6dec, mintB=toroSOL 9dec)
  const usdcWhirlpoolPk = dep.usdcWhirlpool ? new PublicKey(dep.usdcWhirlpool) : null
  const usdcPositionPk = dep.usdcPosition ? new PublicKey(dep.usdcPosition) : null
  const usdcPosTokenAta = dep.usdcPositionTokenAccount ? new PublicKey(dep.usdcPositionTokenAccount) : null
  const usdcTickSpacing = dep.usdcTickSpacing ?? 64
  let lastUsdcSqrtStr = '0'
  let lastUsdcRepositionMs = 0

  log(`=== 03_keeper_service v2.35 — SELF-TUNING MATADOR (${DRY_RUN ? 'DRY-RUN' : 'LIVE'}) ===`)
  log(`pool=${whirlpoolPk.toBase58()} | pos=${positionPk.toBase58()} | mint=${mint.toBase58()}`)
  log(
    `band=[${BAND_LOW_MULT}x,${BAND_HIGH_MULT}x] | idle=${MULETA_IDLE_MS / 1000}s | ` +
      `adaptiveEdge=${ks.adaptiveEdgeBps}bps (${MULETA_MIN_EDGE_BPS}..${MULETA_MAX_EDGE_BPS}) | ` +
      `fee=${FEE_NORMAL / 100}bps | recoup<=${RECOUP_MAX_PCT}% | maxDrawdown=${MAX_EQUITY_DRAWDOWN_SOL} SOL`,
  )

  function computeDesiredFee(spot: number, nav: number): number {
    const premiumPct = (spot / nav - 1) * 100
    if (ks.pendingWaveCheck && Date.now() - ks.pendingWaveSentMs < 90_000) {
      return FEE_ARBER_INVITE
    }
    if (premiumPct >= 6.0) return FEE_SURGE_HIGH
    if (premiumPct >= 3.4) return FEE_SURGE_MID
    return FEE_NORMAL
  }

  // Helper: max poolTokens safely redeemable from ReserveStake without ever hitting Custom:35
  const RESERVE_FLOOR_LAMPORTS = 25_000_000n // 0.025 SOL hard floor (burn-loop recoup & emergency reserve refill)
  const REBALANCE_RESERVE_FLOOR_LAMPORTS = 300_000_000n // 0.30 SOL liquid cushion kept in ReserveStake for external users
  function maxRedeemableTokens(
    reserveLamports: bigint,
    poolState: Awaited<ReturnType<typeof fetchStakePoolState>>,
    floorLamports: bigint = RESERVE_FLOOR_LAMPORTS,
  ): bigint {
    if (poolState.totalLamports <= 0n || reserveLamports <= floorLamports) return 0n
    const availLam = reserveLamports - floorLamports
    return (availLam * poolState.poolTokenSupply) / poolState.totalLamports
  }

  // ----------------------------------------------------------------- Atomic 1-tx Burn-Loop + NAV crank + Fee Snap
  async function runBurnLoop(
    force = false,
    currentFeeRate?: number,
    desiredFee?: number,
    snap?: {
      poolState: Awaited<ReturnType<typeof fetchStakePoolState>>
      curEpoch: number
      withheldInMint: bigint
      valPairs: { validatorStake: PublicKey; transientStake: PublicKey }[]
      reserveLamports: bigint
    },
  ): Promise<boolean> {
    // Include accounts down to 0.0001 toroSOL so dust never strands across holders; sort largest-first
    const allCandidates = (await findWithheldAccounts(conn, mint, 100_000n)).sort((a, b) =>
      b.withheld > a.withheld ? 1 : b.withheld < a.withheld ? -1 : 0,
    )
    const withheldInMint = snap ? snap.withheldInMint : (await fetchMintTransferFeeBps(conn, mint)).withheldInMint
    const poolState = snap ? snap.poolState : await fetchStakePoolState(conn, stakePool)
    const epoch = snap ? snap.curEpoch : (await conn.getEpochInfo('confirmed')).epoch
    const reserveLamports = snap ? snap.reserveLamports : BigInt(await conn.getBalance(poolState.reserveStake, 'confirmed'))
    const valPairs = snap
      ? snap.valPairs
      : await conn
          .getAccountInfo(poolState.validatorList, 'confirmed')
          .then((acc) => (acc ? validatorStakePairs(stakePool, parseValidatorListData(acc.data)) : []))
    const needsEpochCrank = Number(poolState.lastUpdateEpoch) < epoch

    // Take top 12 largest accounts for single-tx ~49k-CU atomic path (scales cleanly to 1,000+ holders!)
    const candidates = allCandidates.slice(0, 12)
    const totalCandidateWithheld = candidates.reduce((s, c) => s + c.withheld, 0n)
    const sweptTotal = totalCandidateWithheld + (withheldInMint >= 100_000n ? withheldInMint : 0n)

    if (sweptTotal < MIN_CLAIM_ATOMS && !force && !needsEpochCrank) {
      ks.lastBurnMs = Date.now()
      saveKeeperState(ks)
      return false
    }

    // Always use single-tx atomic path for top 12 accounts (recoup + burn + NAV crank + optional fee snap!)
    if (candidates.length <= 12) {
      const atomicIxs: TransactionInstruction[] = []
      if (candidates.length > 0) {
        atomicIxs.push(
          ixWithdrawWithheldFromAccounts({
            mint,
            destination: toroAta,
            authority: manager.publicKey,
            sources: candidates.map((c) => c.pubkey),
          }),
        )
      }
      if (withheldInMint >= 100_000n) {
        atomicIxs.push(ixWithdrawWithheldFromMint({ mint, destination: toroAta, authority: manager.publicKey }))
      }

      let budget = sweptTotal
      let recoupedSol = 0n
      let burnedAtoms = 0n
      const outstanding = BigInt(ks.outstandingBaitLamports)
      if (budget > 100_000n && outstanding > 0n && poolState.totalLamports > 0n) {
        const toroNeeded = (outstanding * poolState.poolTokenSupply) / poolState.totalLamports
        const maxRecoup = (budget * RECOUP_MAX_PCT) / 100n
        const maxByReserve = maxRedeemableTokens(reserveLamports, poolState)
        const capped = toroNeeded < maxRecoup ? toroNeeded : maxRecoup
        const toRedeem = capped < maxByReserve ? capped : maxByReserve
        if (toRedeem > 100_000n) {
          recoupedSol = (toRedeem * poolState.totalLamports) / poolState.poolTokenSupply
          atomicIxs.push(
            ixWithdrawSol({
              stakePool,
              reserveStake: poolState.reserveStake,
              burner: manager.publicKey,
              burnerTokenAccount: toroAta,
              recipientSol: manager.publicKey,
              managerFeeAccount: poolState.managerFeeAccount,
              poolMint: mint,
              poolTokens: toRedeem,
            }),
          )
          budget -= toRedeem
        }
      }
      if (budget > 100_000n) {
        burnedAtoms = budget
        atomicIxs.push(
          ixBurnChecked2022({ account: toroAta, mint, authority: manager.publicKey, amount: burnedAtoms }),
        )
      }
      if (recoupedSol > 0n || burnedAtoms > 0n || force || needsEpochCrank) {
        atomicIxs.push(
          ixUpdateValidatorListBalance({
            stakePool,
            validatorList: poolState.validatorList,
            reserveStake: poolState.reserveStake,
            validatorPairs: valPairs,
          }),
          ixUpdateStakePoolBalance({
            stakePool,
            validatorList: poolState.validatorList,
            reserveStake: poolState.reserveStake,
            managerFeeAccount: poolState.managerFeeAccount,
            poolMint: mint,
          }),
          ixCleanupRemovedValidatorEntries({
            stakePool,
            validatorList: poolState.validatorList,
          }),
        )
      }

      if (atomicIxs.length > 0) {
        // Zero-extra-tx dynamic fee snap: if pool fee differs from desiredFee (30bps normal / 100-300bps surge),
        // snap Orca fee right inside this exact same atomic burn-crank tx!
        const extraSigners = []
        const targetFee = desiredFee ?? FEE_NORMAL
        const shouldSnapFee = !ks.pendingWaveCheck && (currentFeeRate === undefined || currentFeeRate !== targetFee)
        if (shouldSnapFee) {
          atomicIxs.push(
            ixSetFeeRate({
              config: orcaConfig,
              whirlpool: whirlpoolPk,
              feeAuthority: orcaAuth.publicKey,
              feeRate: targetFee,
            }),
          )
          extraSigners.push(orcaAuth)
        }
        log(
          `[burn-loop] ATOMIC 1-TX: ${candidates.length} accts swept=${(Number(sweptTotal) / 1e9).toFixed(5)} | ` +
            `recoup=${(Number(recoupedSol) / 1e9).toFixed(5)}SOL | burn=${(Number(burnedAtoms) / 1e9).toFixed(5)} toroSOL` +
            `${shouldSnapFee ? ` | fee→${targetFee / 100}bps` : ''}`,
        )
        await simulateOrSendTx(conn, atomicIxs, manager, extraSigners, {
          cuLimit: 150_000,
          cuPriceMicroLamports: PRIO_FEE,
          dryRun: DRY_RUN,
          label: shouldSnapFee ? 'burn:atomic-sweep-recoup-burn-crank+fee' : 'burn:atomic-sweep-recoup-burn-crank',
        })
        if (!DRY_RUN) {
          if (recoupedSol > 0n) {
            ks.outstandingBaitLamports = (outstanding > recoupedSol ? outstanding - recoupedSol : 0n).toString()
            const curDaily = BigInt(ks.dailyBaitLamports)
            ks.dailyBaitLamports = (curDaily > recoupedSol ? curDaily - recoupedSol : 0n).toString()
          }
          if (burnedAtoms > 0n) {
            ks.totalBurnedAtoms = (BigInt(ks.totalBurnedAtoms) + burnedAtoms).toString()
          }
          const after = await fetchStakePoolState(conn, stakePool)
          log(`[burn-loop] NAV updated (1 tx!): ${poolState.navSolPerToken.toFixed(6)} → ${after.navSolPerToken.toFixed(6)} SOL/${dep!.tokenSymbol}`)
          ks.lastNav = after.navSolPerToken
        }
        ks.lastBurnMs = Date.now()
        saveKeeperState(ks)
        return true
      }
      return false
    }

    // Fallback chunked path if > 12 holder accounts have withheld balances simultaneously
    for (let i = 0; i < candidates.length; i += 20) {
      const chunk = candidates.slice(i, i + 20)
      await simulateOrSendTx(
        conn,
        [ixWithdrawWithheldFromAccounts({ mint, destination: toroAta, authority: manager.publicKey, sources: chunk.map((c) => c.pubkey) })],
        manager,
        [],
        { cuLimit: 250_000, cuPriceMicroLamports: PRIO_FEE, dryRun: DRY_RUN, label: 'burn:sweep-chunk' },
      )
    }
    if (withheldInMint >= MIN_CLAIM_ATOMS) {
      await simulateOrSendTx(
        conn,
        [ixWithdrawWithheldFromMint({ mint, destination: toroAta, authority: manager.publicKey })],
        manager,
        [],
        { cuLimit: 100_000, cuPriceMicroLamports: PRIO_FEE, dryRun: DRY_RUN, label: 'burn:sweep-mint' },
      )
    }
    if (!DRY_RUN && sweptTotal > 100_000n) {
      await simulateOrSendTx(
        conn,
        [
          ixBurnChecked2022({ account: toroAta, mint, authority: manager.publicKey, amount: sweptTotal }),
          ixUpdateValidatorListBalance({ stakePool, validatorList: poolState.validatorList, reserveStake: poolState.reserveStake, validatorPairs: valPairs }),
          ixUpdateStakePoolBalance({ stakePool, validatorList: poolState.validatorList, reserveStake: poolState.reserveStake, managerFeeAccount: poolState.managerFeeAccount, poolMint: mint }),
          ixCleanupRemovedValidatorEntries({ stakePool, validatorList: poolState.validatorList }),
        ],
        manager,
        [],
        { cuLimit: 140_000, cuPriceMicroLamports: PRIO_FEE, dryRun: DRY_RUN, label: 'burn:chunk-burn-crank' },
      )
      ks.totalBurnedAtoms = (BigInt(ks.totalBurnedAtoms) + sweptTotal).toString()
      const after = await fetchStakePoolState(conn, stakePool)
      ks.lastNav = after.navSolPerToken
    }
    ks.lastBurnMs = Date.now()
    saveKeeperState(ks)
    return true
  }

  // ----------------------------------------------------------------- Collect LP + 25% Protocol Rake (Zero-Loss + Auto-Redeem Excess toroSOL)
  async function runCollectFees(
    wp: ReturnType<typeof parseWhirlpool>,
    pos: ReturnType<typeof parsePosition>,
    poolState: Awaited<ReturnType<typeof fetchStakePoolState>>,
    toroSpendable: bigint,
    reserveLamports: bigint,
  ) {
    // Since we own 100% of active L and protocol rake is 25%, total accrued uncollected fees = 4 * protocolFeeOwed
    const estTotalOwed = (wp.protocolFeeOwedA + wp.protocolFeeOwedB) * 4n
    if (estTotalOwed < MIN_COLLECT_LAMPORTS) {
      ks.lastCollectMs = Date.now()
      saveKeeperState(ks)
      return
    }
    const taLow = deriveTickArrayPda(whirlpoolPk, getStartTickIndex(pos.tickLowerIndex, tickSpacing))
    const taHigh = deriveTickArrayPda(whirlpoolPk, getStartTickIndex(pos.tickUpperIndex, tickSpacing))
    const ixs: TransactionInstruction[] = [
      createAssociatedTokenAccountIdempotentInstruction(manager.publicKey, wsolAta, manager.publicKey, WSOL_MINT, TOKEN_PROGRAM),
      ixUpdateFeesAndRewards({ whirlpool: whirlpoolPk, position: positionPk, tickArrayLower: taLow, tickArrayUpper: taHigh }),
      ixCollectFeesV2({
        whirlpool: whirlpoolPk,
        positionAuthority: manager.publicKey,
        position: positionPk,
        positionTokenAccount: positionTokenAta,
        tokenMintA: mintA,
        tokenMintB: mintB,
        tokenOwnerAccountA: ownerAtaA,
        tokenVaultA: wp.tokenVaultA,
        tokenOwnerAccountB: ownerAtaB,
        tokenVaultB: wp.tokenVaultB,
        tokenProgramA,
        tokenProgramB,
      }),
    ]
    const signers = []
    if (wp.protocolFeeOwedA > 0n || wp.protocolFeeOwedB > 0n) {
      ixs.push(
        ixCollectProtocolFeesV2({
          config: orcaConfig,
          whirlpool: whirlpoolPk,
          collectProtocolFeesAuthority: orcaAuth.publicKey,
          tokenMintA: mintA,
          tokenMintB: mintB,
          tokenVaultA: wp.tokenVaultA,
          tokenVaultB: wp.tokenVaultB,
          tokenDestinationA: ownerAtaA,
          tokenDestinationB: ownerAtaB,
          tokenProgramA,
          tokenProgramB,
        }),
      )
      signers.push(orcaAuth)
    }
    // Recover our own 2% T22 withholding on collected toroSOL fees + unwrap WSOL straight to native SOL!
    ixs.push(
      ixWithdrawWithheldFromAccounts({
        mint,
        destination: toroAta,
        authority: manager.publicKey,
        sources: [toroAta],
      }),
      createCloseAccountInstruction(wsolAta, manager.publicKey, manager.publicKey, [], TOKEN_PROGRAM),
    )
    // Auto-compound: if idle toroSOL >= 0.05, atomically redeem excess (keeping 0.30 SOL liquid ReserveStake!) → native SOL in-tx!
    const rawRedeemExcess = toroSpendable >= 50_000_000n ? toroSpendable - 20_000_000n : 0n
    const maxResTokens = maxRedeemableTokens(reserveLamports, poolState, REBALANCE_RESERVE_FLOOR_LAMPORTS)
    const redeemExcess = rawRedeemExcess < maxResTokens ? rawRedeemExcess : maxResTokens
    if (redeemExcess > 0n) {
      ixs.push(
        ixWithdrawSol({
          stakePool,
          reserveStake: poolState.reserveStake,
          burner: manager.publicKey,
          burnerTokenAccount: toroAta,
          recipientSol: manager.publicKey,
          managerFeeAccount: poolState.managerFeeAccount,
          poolMint: mint,
          poolTokens: redeemExcess,
        }),
      )
    }
    await simulateOrSendTx(conn, ixs, manager, signers, {
      cuLimit: redeemExcess > 0n ? 250_000 : 220_000,
      cuPriceMicroLamports: PRIO_FEE,
      dryRun: DRY_RUN,
      label: `collect:lp+proto(est=${(Number(estTotalOwed) / 1e9).toFixed(5)}${redeemExcess > 0n ? `+redeem=${(Number(redeemExcess) / 1e9).toFixed(3)}` : ''})`,
    })
    ks.lastCollectMs = Date.now()
    saveKeeperState(ks)
  }

  // ----------------------------------------------------------------- Collect USDC/toroSOL LP + 25% Protocol Rake
  async function maybeCollectUsdcFees(
    usdcWp: ReturnType<typeof parseWhirlpool>,
    usdcPos: ReturnType<typeof parsePosition>,
    solUsd: number,
    nav: number,
  ) {
    if (!usdcWhirlpoolPk || !usdcPositionPk || !usdcPosTokenAta || solUsd <= 0) return
    const estSolEq =
      Number(usdcWp.protocolFeeOwedA * 4n) / 1e6 / solUsd +
      (Number(usdcWp.protocolFeeOwedB * 4n) / 1e9) * nav
    if (estSolEq < Number(MIN_COLLECT_LAMPORTS) / 1e9) return
    const taLow = deriveTickArrayPda(usdcWhirlpoolPk, getStartTickIndex(usdcPos.tickLowerIndex, usdcTickSpacing))
    const taHigh = deriveTickArrayPda(usdcWhirlpoolPk, getStartTickIndex(usdcPos.tickUpperIndex, usdcTickSpacing))
    const ixs: TransactionInstruction[] = [
      createAssociatedTokenAccountIdempotentInstruction(manager.publicKey, usdcAta, manager.publicKey, USDC_MINT, TOKEN_PROGRAM),
      ixUpdateFeesAndRewards({ whirlpool: usdcWhirlpoolPk, position: usdcPositionPk, tickArrayLower: taLow, tickArrayUpper: taHigh }),
      ixCollectFeesV2({
        whirlpool: usdcWhirlpoolPk,
        positionAuthority: manager.publicKey,
        position: usdcPositionPk,
        positionTokenAccount: usdcPosTokenAta,
        tokenMintA: USDC_MINT,
        tokenMintB: mint,
        tokenOwnerAccountA: usdcAta,
        tokenVaultA: usdcWp.tokenVaultA,
        tokenOwnerAccountB: toroAta,
        tokenVaultB: usdcWp.tokenVaultB,
        tokenProgramA: TOKEN_PROGRAM,
        tokenProgramB: TOKEN_2022_PROGRAM,
      }),
    ]
    const signers = []
    if (usdcWp.protocolFeeOwedA > 0n || usdcWp.protocolFeeOwedB > 0n) {
      ixs.push(
        ixCollectProtocolFeesV2({
          config: orcaConfig,
          whirlpool: usdcWhirlpoolPk,
          collectProtocolFeesAuthority: orcaAuth.publicKey,
          tokenMintA: USDC_MINT,
          tokenMintB: mint,
          tokenVaultA: usdcWp.tokenVaultA,
          tokenVaultB: usdcWp.tokenVaultB,
          tokenDestinationA: usdcAta,
          tokenDestinationB: toroAta,
          tokenProgramA: TOKEN_PROGRAM,
          tokenProgramB: TOKEN_2022_PROGRAM,
        }),
      )
      signers.push(orcaAuth)
    }
    ixs.push(
      ixWithdrawWithheldFromAccounts({
        mint,
        destination: toroAta,
        authority: manager.publicKey,
        sources: [toroAta],
      }),
    )
    await simulateOrSendTx(conn, ixs, manager, signers, {
      cuLimit: 220_000,
      cuPriceMicroLamports: PRIO_FEE,
      dryRun: DRY_RUN,
      label: `collect:usdc-pool(est=${estSolEq.toFixed(5)}SOL)`,
    })
  }

  // ----------------------------------------------------------------- Passive OOR Auto-Recenter for USDC/toroSOL
  async function maybeRepositionUsdcPool(
    usdcWp: ReturnType<typeof parseWhirlpool>,
    usdcPos: ReturnType<typeof parsePosition>,
    t22Bps: number,
  ): Promise<boolean> {
    if (!usdcWhirlpoolPk || !usdcPositionPk || !usdcPosTokenAta) return false
    if (ks.pendingWaveCheck && Date.now() - ks.pendingWaveSentMs < 90_000) return false
    if (Date.now() - lastUsdcRepositionMs < 300_000) return false
    const outOfRange =
      usdcWp.tickCurrentIndex <= usdcPos.tickLowerIndex || usdcWp.tickCurrentIndex >= usdcPos.tickUpperIndex
    if (!outOfRange) return false

    // Strictly out-of-range: re-center ±11% around live USDC/toroSOL tick (zero churn while in range!)
    const curUsdPerToro = 1.0 / sqrtPriceX64ToPrice(usdcWp.sqrtPrice, 6, 9)
    const newLower = alignTickFloor(priceToTickIndex(1.0 / (curUsdPerToro * 1.11), 6, 9), usdcTickSpacing)
    const newUpper = alignTickCeil(priceToTickIndex(1.0 / (curUsdPerToro * 0.89), 6, 9), usdcTickSpacing)
    if (newLower >= usdcWp.tickCurrentIndex || newUpper <= usdcWp.tickCurrentIndex) return false
    if (newLower === usdcPos.tickLowerIndex && newUpper === usdcPos.tickUpperIndex) return false

    const exAmts = computeAmountsForLiquidity(usdcWp.sqrtPrice, usdcPos.tickLowerIndex, usdcPos.tickUpperIndex, usdcPos.liquidity)
    const usdcBal = (await getTokenBalanceAndWithheld(conn, usdcAta)).spendable
    const toroBal = (await getTokenBalanceAndWithheld(conn, toroAta)).spendable
    const availUsdc = ((exAmts.reqA + usdcBal) * 99n) / 100n
    const availToro = ((exAmts.reqB + (toroBal > 20_000_000n ? toroBal - 20_000_000n : 0n)) * BigInt(10_000 - t22Bps - 20)) / 10_000n
    const { liquidity: newL, reqA: newA, reqB: newB } = computeLiquidityForAmounts(
      usdcWp.sqrtPrice,
      newLower,
      newUpper,
      availUsdc,
      availToro,
    )
    if (newL <= 0n) return false

    const exLowSt = getStartTickIndex(usdcPos.tickLowerIndex, usdcTickSpacing)
    const exHighSt = getStartTickIndex(usdcPos.tickUpperIndex, usdcTickSpacing)
    const newLowSt = getStartTickIndex(newLower, usdcTickSpacing)
    const newHighSt = getStartTickIndex(newUpper, usdcTickSpacing)
    const prepIxs = await ensureTickArrays(usdcWhirlpoolPk, manager.publicKey, [newLowSt, newHighSt])
    if (prepIxs.length > 0) {
      await simulateOrSendTx(conn, prepIxs, manager, [], {
        cuLimit: 120_000,
        cuPriceMicroLamports: PRIO_FEE,
        dryRun: DRY_RUN,
        label: 'usdc-pool:init-dyn-tick-arrays',
      })
    }
    log(
      `[usdc-reposition] OOR spot=$${curUsdPerToro.toFixed(2)} [${usdcPos.tickLowerIndex},${usdcPos.tickUpperIndex}] → [${newLower},${newUpper}] L=${newL}`,
    )
    const maxA = (newA * 102n) / 100n + 100n
    const maxB = (newB * 10_500n) / BigInt(10_000 - t22Bps) + 50_000n
    await simulateOrSendTx(
      conn,
      [
        createAssociatedTokenAccountIdempotentInstruction(manager.publicKey, usdcAta, manager.publicKey, USDC_MINT, TOKEN_PROGRAM),
        ixRepositionLiquidityV2({
          whirlpool: usdcWhirlpoolPk,
          tokenProgramA: TOKEN_PROGRAM,
          tokenProgramB: TOKEN_2022_PROGRAM,
          positionAuthority: manager.publicKey,
          funder: manager.publicKey,
          position: usdcPositionPk,
          positionTokenAccount: usdcPosTokenAta,
          tokenMintA: USDC_MINT,
          tokenMintB: mint,
          tokenOwnerAccountA: usdcAta,
          tokenOwnerAccountB: toroAta,
          tokenVaultA: usdcWp.tokenVaultA,
          tokenVaultB: usdcWp.tokenVaultB,
          existingTickArrayLower: deriveTickArrayPda(usdcWhirlpoolPk, exLowSt),
          existingTickArrayUpper: deriveTickArrayPda(usdcWhirlpoolPk, exHighSt),
          newTickArrayLower: deriveTickArrayPda(usdcWhirlpoolPk, newLowSt),
          newTickArrayUpper: deriveTickArrayPda(usdcWhirlpoolPk, newHighSt),
          newTickLowerIndex: newLower,
          newTickUpperIndex: newUpper,
          newLiquidityAmount: newL,
          existingRangeTokenMinA: 0n,
          existingRangeTokenMinB: 0n,
          newRangeTokenMaxA: maxA,
          newRangeTokenMaxB: maxB,
        }),
        ixWithdrawWithheldFromAccounts({
          mint,
          destination: toroAta,
          authority: manager.publicKey,
          sources: [toroAta, usdcWp.tokenVaultB],
        }),
      ],
      manager,
      [],
      { cuLimit: 260_000, cuPriceMicroLamports: PRIO_FEE, dryRun: DRY_RUN, label: `usdc-reposition:[${newLower},${newUpper}]` },
    )
    lastUsdcRepositionMs = Date.now()
    return true
  }

  // ----------------------------------------------------------------- Dynamic Fee Surfing
  async function maybeSurfFee(wp: ReturnType<typeof parseWhirlpool>, nav: number) {
    const spot = spotSolPerToro(wp.sqrtPrice, solIsA)
    const premiumPct = (spot / nav - 1) * 100
    const desiredFee = computeDesiredFee(spot, nav)

    if (wp.feeRate !== desiredFee) {
      log(
        `[fee-surf] spot=${spot.toFixed(5)} (${premiumPct >= 0 ? '+' : ''}${premiumPct.toFixed(2)}% vs NAV) ` +
          `fee ${wp.feeRate} → ${desiredFee} (${(desiredFee / 10_000).toFixed(2)}%)`,
      )
      await simulateOrSendTx(
        conn,
        [ixSetFeeRate({ config: orcaConfig, whirlpool: whirlpoolPk, feeAuthority: orcaAuth.publicKey, feeRate: desiredFee })],
        manager,
        [orcaAuth],
        { cuLimit: 50_000, cuPriceMicroLamports: PRIO_FEE, dryRun: DRY_RUN, label: `fee-surf:${desiredFee}` },
      )
    }
  }

  // ----------------------------------------------------------------- Tight-Range Slider
  async function maybeReposition(
    wp: ReturnType<typeof parseWhirlpool>,
    pos: ReturnType<typeof parsePosition>,
    nav: number,
    t22Bps: number,
    snap: {
      nativeNow: bigint
      wsolWallet: ReturnType<typeof parseTokenBalanceAndWithheld>
      toroWallet: ReturnType<typeof parseTokenBalanceAndWithheld>
    },
  ): Promise<boolean> {
    const spot = spotSolPerToro(wp.sqrtPrice, solIsA)
    const pLow = solIsA ? 1.0 / (nav * BAND_HIGH_MULT) : nav * BAND_LOW_MULT
    const pHigh = solIsA ? 1.0 / (nav * BAND_LOW_MULT) : nav * BAND_HIGH_MULT
    const targetLower = alignTickFloor(priceToTickIndex(pLow, 9, 9), tickSpacing)
    const targetUpper = alignTickCeil(priceToTickIndex(pHigh, 9, 9), tickSpacing)

    const distLow = wp.tickCurrentIndex - pos.tickLowerIndex
    const distHigh = pos.tickUpperIndex - wp.tickCurrentIndex
    const outOfRange = distLow <= 0 || distHigh <= 0
    // Use 1*ts (8 bps) edge threshold so ultra-concentrated L=1.0T-1.1T bands (9-16 ticks ask) aren't widened prematurely!
    const nearEdge = distLow < tickSpacing || distHigh < tickSpacing
    // Only drift-trigger on bid floor if Muleta is disabled (Muleta already re-anchors anchorHigh every 3m in 1 tx!)
    const bidFloorDrifted =
      !MULETA_ENABLED &&
      (solIsA
        ? Math.abs(targetUpper - pos.tickUpperIndex) >= tickSpacing * 8
        : Math.abs(targetLower - pos.tickLowerIndex) >= tickSpacing * 8)

    if (!outOfRange && !nearEdge && !bidFloorDrifted) return false
    if (!outOfRange && ks.pendingWaveCheck && Date.now() - ks.pendingWaveSentMs < 90_000) return false
    if (!outOfRange && Date.now() - ks.lastRepositionMs < 180_000) return false

    const effLower = Math.min(targetLower, alignTickFloor(wp.tickCurrentIndex - tickSpacing * 8, tickSpacing))
    const effUpper = Math.max(targetUpper, alignTickCeil(wp.tickCurrentIndex + tickSpacing * 8, tickSpacing))
    if (
      Math.abs(effLower - pos.tickLowerIndex) < tickSpacing * 4 &&
      Math.abs(effUpper - pos.tickUpperIndex) < tickSpacing * 4
    ) {
      return false
    }

    log(`[reposition] spot=${spot.toFixed(5)} nav=${nav.toFixed(5)} [${pos.tickLowerIndex},${pos.tickUpperIndex}] → [${effLower},${effUpper}]`)

    const existing = computeAmountsForLiquidity(wp.sqrtPrice, pos.tickLowerIndex, pos.tickUpperIndex, pos.liquidity)
    const solBal = snap.nativeNow
    const resLam = BigInt(Math.floor(MIN_SOL_RESERVE * LAMPORTS_PER_SOL))
    const freeSol = solBal > resLam ? solBal - resLam : 0n
    const wsolState = snap.wsolWallet
    const toroState = snap.toroWallet

    const availA = existing.reqA + (solIsA ? wsolState.spendable + freeSol : (toroState.spendable * 975n) / 1000n)
    const availB = existing.reqB + (solIsA ? (toroState.spendable * 975n) / 1000n : wsolState.spendable + freeSol)
    const { liquidity: newL, reqA: newA, reqB: newB } = computeLiquidityForAmounts(
      wp.sqrtPrice,
      effLower,
      effUpper,
      (availA * 995n) / 1000n,
      (availB * 995n) / 1000n,
    )
    if (newL <= 0n) return false

    const deltaSol = solIsA ? newA - existing.reqA : newB - existing.reqB
    const needWrapSol =
      deltaSol > 0n && deltaSol > wsolState.spendable ? deltaSol - wsolState.spendable + 2_000_000n : 0n

    const exLowSt = getStartTickIndex(pos.tickLowerIndex, tickSpacing)
    const exHighSt = getStartTickIndex(pos.tickUpperIndex, tickSpacing)
    const newLowSt = getStartTickIndex(effLower, tickSpacing)
    const newHighSt = getStartTickIndex(effUpper, tickSpacing)
    const prepIxs = await ensureTickArrays(whirlpoolPk, manager.publicKey, [newLowSt, newHighSt])
    const ixs: TransactionInstruction[] = [
      ...prepIxs,
      createAssociatedTokenAccountIdempotentInstruction(manager.publicKey, wsolAta, manager.publicKey, WSOL_MINT, TOKEN_PROGRAM),
    ]
    if (needWrapSol > 0n) {
      ixs.push(
        SystemProgram.transfer({ fromPubkey: manager.publicKey, toPubkey: wsolAta, lamports: needWrapSol }),
        createSyncNativeInstruction(wsolAta, TOKEN_PROGRAM),
      )
    }
    const maxWithFee = (amt: bigint, isToro: boolean) =>
      isToro ? (amt * 10_500n) / BigInt(10_000 - t22Bps) + 50_000n : (amt * 102n) / 100n + 50_000n

    ixs.push(
      ixRepositionLiquidityV2({
        whirlpool: whirlpoolPk,
        tokenProgramA,
        tokenProgramB,
        positionAuthority: manager.publicKey,
        funder: manager.publicKey,
        position: positionPk,
        positionTokenAccount: positionTokenAta,
        tokenMintA: mintA,
        tokenMintB: mintB,
        tokenOwnerAccountA: ownerAtaA,
        tokenOwnerAccountB: ownerAtaB,
        tokenVaultA: wp.tokenVaultA,
        tokenVaultB: wp.tokenVaultB,
        existingTickArrayLower: deriveTickArrayPda(whirlpoolPk, exLowSt),
        existingTickArrayUpper: deriveTickArrayPda(whirlpoolPk, exHighSt),
        newTickArrayLower: deriveTickArrayPda(whirlpoolPk, newLowSt),
        newTickArrayUpper: deriveTickArrayPda(whirlpoolPk, newHighSt),
        newTickLowerIndex: effLower,
        newTickUpperIndex: effUpper,
        newLiquidityAmount: newL,
        existingRangeTokenMinA: 0n,
        existingRangeTokenMinB: 0n,
        newRangeTokenMaxA: maxWithFee(newA, !solIsA),
        newRangeTokenMaxB: maxWithFee(newB, solIsA),
      }),
      // Zero-loss self-recovery + unwrap WSOL straight back to native SOL
      ixWithdrawWithheldFromAccounts({
        mint,
        destination: toroAta,
        authority: manager.publicKey,
        sources: [toroAta],
      }),
      createCloseAccountInstruction(wsolAta, manager.publicKey, manager.publicKey, [], TOKEN_PROGRAM),
    )
    await simulateOrSendTx(conn, ixs, manager, [], {
      cuLimit: 260_000,
      cuPriceMicroLamports: PRIO_FEE,
      dryRun: DRY_RUN,
      label: `reposition:[${effLower},${effUpper}]`,
    })
    ks.lastRepositionMs = Date.now()
    saveKeeperState(ks)
    return true
  }

  // ----------------------------------------------------------------- Zero-Ping-Pong Ratio-Aware Rebalancer
  async function maybeRebalance(
    wp: ReturnType<typeof parseWhirlpool>,
    pos: ReturnType<typeof parsePosition>,
    poolState: Awaited<ReturnType<typeof fetchStakePoolState>>,
    t22Bps: number,
    snap: {
      nativeNow: bigint
      wsolWallet: ReturnType<typeof parseTokenBalanceAndWithheld>
      toroWallet: ReturnType<typeof parseTokenBalanceAndWithheld>
      reserveLamports: bigint
    },
  ): Promise<boolean> {
    // Keep a 100% lock-free runway for external arber bots during an active Muleta snipe window!
    if (ks.pendingWaveCheck && Date.now() - ks.pendingWaveSentMs < 90_000) return false
    if (Date.now() - ks.lastRebalanceMs < 150_000) return false

    const { toroWallet, wsolWallet, nativeNow, reserveLamports } = snap
    const maxResTokens = maxRedeemableTokens(reserveLamports, poolState, REBALANCE_RESERVE_FLOOR_LAMPORTS)
    const maxEmergResTokens = maxRedeemableTokens(reserveLamports, poolState, RESERVE_FLOOR_LAMPORTS)
    const resLam = BigInt(Math.floor(MIN_SOL_RESERVE * LAMPORTS_PER_SOL))
    const freeNative = nativeNow > resLam ? nativeNow - resLam : 0n
    const totalIdleSol = freeNative + wsolWallet.spendable

    const posAmts = computeAmountsForLiquidity(wp.sqrtPrice, pos.tickLowerIndex, pos.tickUpperIndex, pos.liquidity)
    const lpSol = solIsA ? posAmts.reqA : posAmts.reqB
    const lpToro = solIsA ? posAmts.reqB : posAmts.reqA

    // 0) 1-TX ZERO-LOSS SCALE-INVARIANT LP→SOL→HIGHER-L SUPER-REBALANCER:
    //    Whenever toroSOL exceeds 34% of LP value (and > 1.15 toroSOL), adapts automatically to any LP TVL (3..50+ SOL) to:
    //      (a) tighten tickLower toward spot (withdrawing excess toroSOL),
    //      (b) recover 100% of our own 2% T22 fee in-tx (toroAta → toroAta),
    //      (c) redeem up to ReserveStake's safe cap via fee-waived SP12tWFx WithdrawSol → fresh native SOL,
    //      (d) wrap & re-deploy that fresh SOL straight back into HIGHER concentrated L in the SAME tx (0ms idle-SOL gap!)
    const lpToroValSol = Number(lpToro) * poolState.navSolPerToken
    const lpTotalValSol = Number(lpSol) + lpToroValSol
    const lpToroShare = lpTotalValSol > 0 ? lpToroValSol / lpTotalValSol : 0
    if (solIsA && lpToroShare > 0.34 && lpToro > 1_150_000_000n && maxResTokens >= 250_000_000n) {
      // Tighten up to 2/3 of the way on Step 1 (smart hybrid maxAskTick = 9..16 ticks ask, zero double-floor SOL stranding,
      // AND capped so withdrawnToro fits inside ReserveStake's instant SOL liquidity → ZERO Custom:35!).
      const curBase = alignTickFloor(wp.tickCurrentIndex, tickSpacing)
      const maxAskTick = Math.min(alignTickCeil(wp.tickCurrentIndex - tickSpacing * 2, tickSpacing), curBase - tickSpacing)
      const twoThirdsTick = alignTickFloor(Math.floor((pos.tickLowerIndex + 2 * wp.tickCurrentIndex) / 3), tickSpacing)
      const step1Cap = maxAskTick - tickSpacing > pos.tickLowerIndex ? maxAskTick - tickSpacing : maxAskTick
      const newL = (pos.liquidity * 9995n) / 10000n
      let newTickLow = Math.min(twoThirdsTick, step1Cap)
      while (newTickLow > pos.tickLowerIndex + tickSpacing) {
        const probe = computeAmountsForLiquidity(wp.sqrtPrice, newTickLow, pos.tickUpperIndex, newL)
        const probeW = posAmts.reqB > probe.reqB ? posAmts.reqB - probe.reqB : 0n
        if (probeW <= maxResTokens + 150_000_000n) break
        newTickLow -= tickSpacing
      }
      if (newTickLow > pos.tickLowerIndex && newTickLow <= maxAskTick) {
        const newAmts = computeAmountsForLiquidity(wp.sqrtPrice, newTickLow, pos.tickUpperIndex, newL)
        const withdrawnToro = posAmts.reqB > newAmts.reqB ? posAmts.reqB - newAmts.reqB : 0n
        const rawRedeem = (withdrawnToro * 999n) / 1000n
        const redeemTokens = rawRedeem < maxResTokens ? rawRedeem : maxResTokens
        if (redeemTokens >= 200_000_000n) {
          const redeemedSol = (redeemTokens * poolState.totalLamports) / poolState.poolTokenSupply
          const newLowSt = getStartTickIndex(newTickLow, tickSpacing)
          const exLowSt = getStartTickIndex(pos.tickLowerIndex, tickSpacing)
          const exHighSt = getStartTickIndex(pos.tickUpperIndex, tickSpacing)

          // Compute optional in-tx L-boost deploying redeemed SOL straight back into bid wall (0 toroSOL added!)
          // Guard sqrtB > wp.sqrtPrice so massive whale-sell out-of-range cleanly skips boost & lets reposition re-anchor!
          const solForBoost = newAmts.reqA + totalIdleSol + (redeemedSol * 985n) / 1000n
          const sqrtB = tickIndexToSqrtPriceX64(pos.tickUpperIndex)
          let boostTickLow = newTickLow
          let boost = { liquidity: 0n, reqA: 0n, reqB: 0n }
          let wrapMore = 0n
          if (sqrtB > wp.sqrtPrice) {
            const lBoostBid = (((solForBoost * wp.sqrtPrice) / Q64) * sqrtB) / (sqrtB - wp.sqrtPrice)
            const deltaSqrt = lBoostBid > 0n ? (newAmts.reqB * Q64) / lBoostBid : 0n
            const sqrtABoost = wp.sqrtPrice > deltaSqrt ? wp.sqrtPrice - deltaSqrt : wp.sqrtPrice / 2n
            const exactBoostLow = Math.floor((2 * Math.log(Number(sqrtABoost) / Number(Q64))) / Math.log(1.0001))
            boostTickLow = Math.min(alignTickCeil(exactBoostLow, tickSpacing), maxAskTick)
            boost = computeLiquidityForAmounts(
              wp.sqrtPrice,
              boostTickLow,
              pos.tickUpperIndex,
              solForBoost,
              (newAmts.reqB * 9998n) / 10000n,
            )
            wrapMore = boost.reqA > newAmts.reqA ? boost.reqA - newAmts.reqA + 2_000_000n : 0n
          }
          const canBoost =
            sqrtB > wp.sqrtPrice &&
            boostTickLow > newTickLow &&
            boost.liquidity > (newL * 105n) / 100n &&
            wrapMore > 0n &&
            wrapMore <= freeNative + redeemedSol
          const boostLowSt = getStartTickIndex(boostTickLow, tickSpacing)
          const prepIxs = await ensureTickArrays(
            whirlpoolPk,
            manager.publicKey,
            canBoost ? [newLowSt, boostLowSt] : [newLowSt],
          )
          if (prepIxs.length > 0) {
            await simulateOrSendTx(conn, prepIxs, manager, [], {
              cuLimit: 120_000,
              cuPriceMicroLamports: PRIO_FEE,
              dryRun: DRY_RUN,
              label: 'rebalance:init-dyn-tick-arrays',
            })
          }
          log(
            `[rebalance] ATOMIC ZERO-LOSS LP→SOL${canBoost ? `→BOOST L(${(Number(pos.liquidity) / 1e9).toFixed(0)}B→${(Number(boost.liquidity) / 1e9).toFixed(0)}B)` : ''}: ` +
              `lpSOL=${(Number(lpSol) / 1e9).toFixed(2)}, lpToro=${(Number(lpToro) / 1e9).toFixed(2)} → ` +
              `redeem ${(Number(redeemTokens) / 1e9).toFixed(3)} toroSOL → +${(Number(redeemedSol) / 1e9).toFixed(2)} SOL (0% loss!)`,
          )
          const rebalIxs: TransactionInstruction[] = [
            createAssociatedTokenAccountIdempotentInstruction(manager.publicKey, wsolAta, manager.publicKey, WSOL_MINT, TOKEN_PROGRAM),
            ixRepositionLiquidityV2({
              whirlpool: whirlpoolPk,
              tokenProgramA,
              tokenProgramB,
              positionAuthority: manager.publicKey,
              funder: manager.publicKey,
              position: positionPk,
              positionTokenAccount: positionTokenAta,
              tokenMintA: mintA,
              tokenMintB: mintB,
              tokenOwnerAccountA: ownerAtaA,
              tokenOwnerAccountB: ownerAtaB,
              tokenVaultA: wp.tokenVaultA,
              tokenVaultB: wp.tokenVaultB,
              existingTickArrayLower: deriveTickArrayPda(whirlpoolPk, exLowSt),
              existingTickArrayUpper: deriveTickArrayPda(whirlpoolPk, exHighSt),
              newTickArrayLower: deriveTickArrayPda(whirlpoolPk, newLowSt),
              newTickArrayUpper: deriveTickArrayPda(whirlpoolPk, exHighSt),
              newTickLowerIndex: newTickLow,
              newTickUpperIndex: pos.tickUpperIndex,
              newLiquidityAmount: newL,
              existingRangeTokenMinA: 0n,
              existingRangeTokenMinB: 0n,
              newRangeTokenMaxA: posAmts.reqA * 2n + 50_000n,
              newRangeTokenMaxB: newAmts.reqB * 2n + 50_000n,
            }),
            ixWithdrawWithheldFromAccounts({
              mint,
              destination: toroAta,
              authority: manager.publicKey,
              sources: [toroAta],
            }),
            ixWithdrawSol({
              stakePool,
              reserveStake: poolState.reserveStake,
              burner: manager.publicKey,
              burnerTokenAccount: toroAta,
              recipientSol: manager.publicKey,
              managerFeeAccount: poolState.managerFeeAccount,
              poolMint: mint,
              poolTokens: redeemTokens,
            }),
          ]
          if (canBoost) {
            rebalIxs.push(
              SystemProgram.transfer({ fromPubkey: manager.publicKey, toPubkey: wsolAta, lamports: wrapMore }),
              createSyncNativeInstruction(wsolAta, TOKEN_PROGRAM),
              ixRepositionLiquidityV2({
                whirlpool: whirlpoolPk,
                tokenProgramA,
                tokenProgramB,
                positionAuthority: manager.publicKey,
                funder: manager.publicKey,
                position: positionPk,
                positionTokenAccount: positionTokenAta,
                tokenMintA: mintA,
                tokenMintB: mintB,
                tokenOwnerAccountA: ownerAtaA,
                tokenOwnerAccountB: ownerAtaB,
                tokenVaultA: wp.tokenVaultA,
                tokenVaultB: wp.tokenVaultB,
                existingTickArrayLower: deriveTickArrayPda(whirlpoolPk, newLowSt),
                existingTickArrayUpper: deriveTickArrayPda(whirlpoolPk, exHighSt),
                newTickArrayLower: deriveTickArrayPda(whirlpoolPk, boostLowSt),
                newTickArrayUpper: deriveTickArrayPda(whirlpoolPk, exHighSt),
                newTickLowerIndex: boostTickLow,
                newTickUpperIndex: pos.tickUpperIndex,
                newLiquidityAmount: boost.liquidity,
                existingRangeTokenMinA: 0n,
                existingRangeTokenMinB: 0n,
                newRangeTokenMaxA: boost.reqA * 2n + 50_000n,
                newRangeTokenMaxB: boost.reqB * 2n + 50_000n,
              }),
              ixWithdrawWithheldFromAccounts({
                mint,
                destination: toroAta,
                authority: manager.publicKey,
                sources: [toroAta],
              }),
            )
          }
          rebalIxs.push(createCloseAccountInstruction(wsolAta, manager.publicKey, manager.publicKey, [], TOKEN_PROGRAM))
          await simulateOrSendTx(conn, rebalIxs, manager, [], {
            cuLimit: canBoost ? 240_000 : 180_000,
            cuPriceMicroLamports: PRIO_FEE,
            dryRun: DRY_RUN,
            label: canBoost ? 'rebalance:atomic-lp-to-sol-boost' : 'rebalance:atomic-zero-loss-lp-to-sol',
          })
          ks.lastRebalanceMs = Date.now()
          ks.lastRepositionMs = Date.now()
          saveKeeperState(ks)
          return true
        }
      }
    }

    // 1) ATOMIC WHALE-BUY ASK RESTOCK:
    //    If an organic whale buys out our entire ask wall (lpToro + wallet < 0.35 toroSOL & lpSol >= 2.50 SOL),
    //    atomically pull 25% of LP SOL → unwrap → mint fresh toroSOL at NAV (0% fee!) in ONE tx, locking in
    //    the +3..6% whale premium as pure SOL profit and letting maybeReposition immediately re-anchor both sides!
    if (solIsA && lpToro + toroWallet.spendable < 350_000_000n && lpSol >= 2_500_000_000n && pos.liquidity > 0n) {
      const pullL = pos.liquidity / 4n
      const pulled = computeAmountsForLiquidity(wp.sqrtPrice, pos.tickLowerIndex, pos.tickUpperIndex, pullL)
      const mintLamports = (pulled.reqA * 95n) / 100n
      if (mintLamports >= 500_000_000n) {
        log(
          `[rebalance] WHALE-BUY ASK RESTOCK! lpToro=${(Number(lpToro) / 1e9).toFixed(3)}, lpSOL=${(Number(lpSol) / 1e9).toFixed(2)} → ` +
            `pulling ${(Number(pulled.reqA) / 1e9).toFixed(2)} SOL & minting ${(Number(mintLamports) / 1e9).toFixed(2)} SOL at NAV (0% fee!)`,
        )
        const taLow = deriveTickArrayPda(whirlpoolPk, getStartTickIndex(pos.tickLowerIndex, tickSpacing))
        const taHigh = deriveTickArrayPda(whirlpoolPk, getStartTickIndex(pos.tickUpperIndex, tickSpacing))
        await simulateOrSendTx(
          conn,
          [
            createAssociatedTokenAccountIdempotentInstruction(manager.publicKey, wsolAta, manager.publicKey, WSOL_MINT, TOKEN_PROGRAM),
            ixDecreaseLiquidityV2({
              whirlpool: whirlpoolPk,
              tokenProgramA,
              tokenProgramB,
              positionAuthority: manager.publicKey,
              position: positionPk,
              positionTokenAccount: positionTokenAta,
              tokenMintA: mintA,
              tokenMintB: mintB,
              tokenOwnerAccountA: ownerAtaA,
              tokenOwnerAccountB: ownerAtaB,
              tokenVaultA: wp.tokenVaultA,
              tokenVaultB: wp.tokenVaultB,
              tickArrayLower: taLow,
              tickArrayUpper: taHigh,
              liquidityAmount: pullL,
              tokenMinA: 0n,
              tokenMinB: 0n,
            }),
            ixWithdrawWithheldFromAccounts({
              mint,
              destination: toroAta,
              authority: manager.publicKey,
              sources: [toroAta],
            }),
            createCloseAccountInstruction(wsolAta, manager.publicKey, manager.publicKey, [], TOKEN_PROGRAM),
            ixDepositSol({
              stakePool,
              reserveStake: poolState.reserveStake,
              funder: manager.publicKey,
              destinationTokenAccount: toroAta,
              managerFeeAccount: poolState.managerFeeAccount,
              referrerTokenAccount: toroAta,
              poolMint: mint,
              lamports: mintLamports,
            }),
          ],
          manager,
          [],
          { cuLimit: 180_000, cuPriceMicroLamports: PRIO_FEE, dryRun: DRY_RUN, label: 'rebalance:whale-buy-restock-ask' },
        )
        ks.lastRebalanceMs = Date.now()
        saveKeeperState(ks)
        return true
      }
    }

    // Recycle idle toroSOL → SOL via net-0% WithdrawSol:
    //   1) Emergency reserve refill if native SOL dips below MIN_SOL_RESERVE + 0.10 SOL & we have >= 0.15 toroSOL
    //   2) Normal fast recycle whenever idle toroSOL >= 0.15 (keeping 0.02 dust → 98%+ capital deployed in L!)
    const lowNativeReserve = nativeNow < resLam + 100_000_000n
    if (toroWallet.spendable >= 150_000_000n) {
      const keepInWallet = lowNativeReserve
        ? 20_000_000n
        : lpToro < 1_000_000_000n
          ? 1_000_000_000n - lpToro
          : 20_000_000n
      const minRedeem = 120_000_000n
      const rawToRedeem = toroWallet.spendable > keepInWallet + minRedeem ? toroWallet.spendable - keepInWallet : 0n
      const resCap = lowNativeReserve ? maxEmergResTokens : maxResTokens
      const toRedeem = rawToRedeem < resCap ? rawToRedeem : resCap
      if (toRedeem >= minRedeem) {
        log(
          `[rebalance] ${lowNativeReserve ? 'reserve-refill' : 'ratio-aware'} redeem ${(Number(toRedeem) / 1e9).toFixed(4)} idle toroSOL → SOL ` +
            `(nativeSOL=${(Number(nativeNow) / 1e9).toFixed(3)}, lpSOL=${(Number(lpSol) / 1e9).toFixed(2)}, lpToro=${(Number(lpToro) / 1e9).toFixed(2)})`,
        )
        await simulateOrSendTx(
          conn,
          [
            ixWithdrawSol({
              stakePool,
              reserveStake: poolState.reserveStake,
              burner: manager.publicKey,
              burnerTokenAccount: toroAta,
              recipientSol: manager.publicKey,
              managerFeeAccount: poolState.managerFeeAccount,
              poolMint: mint,
              poolTokens: toRedeem,
            }),
          ],
          manager,
          [],
          { cuLimit: 60_000, cuPriceMicroLamports: PRIO_FEE, dryRun: DRY_RUN, label: 'rebalance:withdraw-idle-toro' },
        )
        // Short 30s cooldown on lightweight idle-toro redeem so it never locks out LP→SOL→BOOST for 150s!
        ks.lastRebalanceMs = Date.now() - 120_000
        saveKeeperState(ks)
        return true
      }
    }

    // ONLY mint fresh toroSOL via SP12tWFx when organic buyers ACTUALLY drained our LP ask (lpToro < 1.10)
    // AND we have large idle SOL (> 1.80 SOL) — ZERO ping-pong!
    if (totalIdleSol > 1_800_000_000n && lpToro + toroWallet.spendable < 1_100_000_000n) {
      // Mint ONLY enough SOL to restore ~1.8 toroSOL total ask, leaving the rest as SOL bid!
      const needToroSol = BigInt(Math.floor((1.8 - Number(lpToro + toroWallet.spendable) / 1e9) * poolState.navSolPerToken * 1e9))
      const mintSol = needToroSol < totalIdleSol / 2n ? needToroSol : totalIdleSol / 2n
      if (mintSol >= 300_000_000n) {
        log(
          `[rebalance] organic buys drained ask (lpToro=${(Number(lpToro) / 1e9).toFixed(2)}) — ` +
            `minting ${(Number(mintSol) / 1e9).toFixed(3)} SOL via net-0% SP12tWFx + topping up CLMM!`,
        )
        const mintIxs: TransactionInstruction[] = []
        if (wsolWallet.exists && wsolWallet.spendable > 0n) {
          mintIxs.push(createCloseAccountInstruction(wsolAta, manager.publicKey, manager.publicKey, [], TOKEN_PROGRAM))
        }
        mintIxs.push(
          ixDepositSol({
            stakePool,
            reserveStake: poolState.reserveStake,
            funder: manager.publicKey,
            destinationTokenAccount: toroAta,
            managerFeeAccount: poolState.managerFeeAccount,
            referrerTokenAccount: toroAta,
            poolMint: mint,
            lamports: mintSol,
          }),
        )
        await simulateOrSendTx(conn, mintIxs, manager, [], {
          cuLimit: 250_000,
          cuPriceMicroLamports: 15_000,
          dryRun: DRY_RUN,
          label: `rebalance:mint-${(Number(mintSol) / 1e9).toFixed(2)}sol`,
        })

        // Immediately top up CLMM in-place
        if (!DRY_RUN) {
          const [wp2Acc, pos2Acc] = await conn.getMultipleAccountsInfo([whirlpoolPk, positionPk], 'confirmed')
          if (wp2Acc && pos2Acc) {
            const wp2 = parseWhirlpool(wp2Acc.data)
            const pos2 = parsePosition(pos2Acc.data)
            const nat2 = BigInt(await conn.getBalance(manager.publicKey, 'confirmed'))
            const addSol = nat2 > resLam + 50_000_000n ? nat2 - resLam - 50_000_000n : 0n
            const toro2 = (await getTokenBalanceAndWithheld(conn, toroAta)).spendable
            const netToro2 = (toro2 * BigInt(10_000 - t22Bps - 20)) / 10_000n
            const { liquidity: addL, reqA: addA, reqB: addB } = computeLiquidityForAmounts(
              wp2.sqrtPrice,
              pos2.tickLowerIndex,
              pos2.tickUpperIndex,
              ((solIsA ? addSol : netToro2) * 98n) / 100n,
              ((solIsA ? netToro2 : addSol) * 98n) / 100n,
            )
            if (addL > 0n) {
              const wrapAmt = (solIsA ? addA : addB) + 5_000_000n
              const gross = (amt: bigint, isToro: boolean) =>
                isToro ? (amt * 10_500n) / BigInt(10_000 - t22Bps) + 50_000n : (amt * 102n) / 100n + 50_000n
              await simulateOrSendTx(
                conn,
                [
                  createAssociatedTokenAccountIdempotentInstruction(manager.publicKey, wsolAta, manager.publicKey, WSOL_MINT, TOKEN_PROGRAM),
                  SystemProgram.transfer({ fromPubkey: manager.publicKey, toPubkey: wsolAta, lamports: wrapAmt }),
                  createSyncNativeInstruction(wsolAta, TOKEN_PROGRAM),
                  ixIncreaseLiquidityV2({
                    whirlpool: whirlpoolPk,
                    tokenProgramA,
                    tokenProgramB,
                    positionAuthority: manager.publicKey,
                    position: positionPk,
                    positionTokenAccount: positionTokenAta,
                    tokenMintA: mintA,
                    tokenMintB: mintB,
                    tokenOwnerAccountA: ownerAtaA,
                    tokenOwnerAccountB: ownerAtaB,
                    tokenVaultA: wp2.tokenVaultA,
                    tokenVaultB: wp2.tokenVaultB,
                    tickArrayLower: deriveTickArrayPda(whirlpoolPk, getStartTickIndex(pos2.tickLowerIndex, tickSpacing)),
                    tickArrayUpper: deriveTickArrayPda(whirlpoolPk, getStartTickIndex(pos2.tickUpperIndex, tickSpacing)),
                    liquidityAmount: addL,
                    tokenMaxA: gross(addA, !solIsA),
                    tokenMaxB: gross(addB, solIsA),
                  }),
                  createCloseAccountInstruction(wsolAta, manager.publicKey, manager.publicKey, [], TOKEN_PROGRAM),
                ],
                manager,
                [],
                { cuLimit: 450_000, cuPriceMicroLamports: 15_000, dryRun: DRY_RUN, label: 'rebalance:topup-clmm' },
              )
            }
          }
        }
        ks.lastRebalanceMs = Date.now()
        saveKeeperState(ks)
        return true
      }
    }

    return false
  }

  // ----------------------------------------------------------------- Muleta: Self-Tuning CLMM Kingmaker Upward Walk
  async function maybeWaveMuleta(
    wp: ReturnType<typeof parseWhirlpool>,
    pos: ReturnType<typeof parsePosition>,
    nav: number,
    t22Bps: number,
    poolState: Awaited<ReturnType<typeof fetchStakePoolState>>,
    equitySol: number,
    snap: {
      nativeNow: bigint
      wsolWallet: ReturnType<typeof parseTokenBalanceAndWithheld>
    },
  ): Promise<boolean> {
    if (!MULETA_ENABLED) return false
    const now = Date.now()

    // Equity circuit-breaker: pause Muleta if equity ever drops > MAX_EQUITY_DRAWDOWN_SOL below watermark
    if (ks.equityHighWaterSol > 0 && ks.equityHighWaterSol - equitySol > MAX_EQUITY_DRAWDOWN_SOL) {
      log(
        `[guard] MULETA PAUSED — equity ${equitySol.toFixed(4)} < highWater ${ks.equityHighWaterSol.toFixed(4)} - ${MAX_EQUITY_DRAWDOWN_SOL}`,
      )
      return false
    }

    // Bot-Wakeup Ping (live-proven 3/3 on Waves #32, #45, #50!):
    // If an event-driven MEV bot missed our t=0s walk shred, emit a tiny 0.00005 SOL real SwapV2 +
    // UpdateFeesAndRewards ping at t=10s & t=40s (~79k CU, 0% T22 leak) to trigger Geyser watchers in 400ms!
    const spot = spotSolPerToro(wp.sqrtPrice, solIsA)
    if (
      ks.pendingWaveCheck &&
      solIsA &&
      spot >= ks.pendingWaveTargetSpot * 0.9996 &&
      ((ks.pendingWavePings === 0 && now - ks.pendingWaveSentMs >= 2_200) ||
        (ks.pendingWavePings === 1 && now - ks.pendingWaveSentMs >= 18_000))
    ) {
      const elapsedSec = Math.round((now - ks.pendingWaveSentMs) / 1000)
      log(`[muleta] BOT-WAKEUP PING #${ks.pendingWavePings + 1} (+${elapsedSec}s): 0.00005 SOL real SwapV2 + UpdateFeesAndRewards`)
      await simulateOrSendTx(
        conn,
        [
          createAssociatedTokenAccountIdempotentInstruction(manager.publicKey, wsolAta, manager.publicKey, WSOL_MINT, TOKEN_PROGRAM),
          SystemProgram.transfer({ fromPubkey: manager.publicKey, toPubkey: wsolAta, lamports: 50_000n }),
          createSyncNativeInstruction(wsolAta, TOKEN_PROGRAM),
          ixUpdateFeesAndRewards({
            whirlpool: whirlpoolPk,
            position: positionPk,
            tickArrayLower: deriveTickArrayPda(whirlpoolPk, getStartTickIndex(pos.tickLowerIndex, tickSpacing)),
            tickArrayUpper: deriveTickArrayPda(whirlpoolPk, getStartTickIndex(pos.tickUpperIndex, tickSpacing)),
          }),
          ixSwapV2({
            tokenProgramA,
            tokenProgramB,
            tokenAuthority: manager.publicKey,
            whirlpool: whirlpoolPk,
            tokenMintA: mintA,
            tokenMintB: mintB,
            tokenOwnerAccountA: ownerAtaA,
            tokenVaultA: wp.tokenVaultA,
            tokenOwnerAccountB: ownerAtaB,
            tokenVaultB: wp.tokenVaultB,
            tickArray0: deriveTickArrayPda(whirlpoolPk, getStartTickIndex(wp.tickCurrentIndex, tickSpacing, 0)),
            tickArray1: deriveTickArrayPda(whirlpoolPk, getStartTickIndex(wp.tickCurrentIndex, tickSpacing, -1)),
            tickArray2: deriveTickArrayPda(whirlpoolPk, getStartTickIndex(wp.tickCurrentIndex, tickSpacing, -2)),
            oracle: deriveOraclePda(whirlpoolPk),
            amount: 50_000n,
            otherAmountThreshold: 0n,
            sqrtPriceLimit: tickIndexToSqrtPriceX64(wp.tickCurrentIndex - 10),
            amountSpecifiedIsInput: true,
            aToB: true,
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
        [],
        { cuLimit: 120_000, cuPriceMicroLamports: PRIO_FEE, dryRun: DRY_RUN, label: `muleta:bot-wakeup-ping-${ks.pendingWavePings + 1}` },
      )
      ks.pendingWavePings += 1
      saveKeeperState(ks)
      return true
    }

    // 24/7 Self-Pacing Daily Budget Controller:
    // Full 120s cadence up to 50% of MAX_DAILY_BAIT_SOL (or whenever organic volume keeps us on/under 24h UTC pace);
    // above 50% & ahead of UTC clock, smoothly stretch cadence (up to 5x = 10m) so the chart never stalls at 6 AM UTC!
    const dailySpent = BigInt(ks.dailyBaitLamports)
    const maxDaily = BigInt(Math.floor(MAX_DAILY_BAIT_SOL * LAMPORTS_PER_SOL))
    if (dailySpent >= maxDaily) {
      log(`[muleta] daily cap reached (${(Number(dailySpent) / 1e9).toFixed(4)}/${MAX_DAILY_BAIT_SOL} SOL)`)
      return false
    }
    const nowDate = new Date(now)
    const utcSec = nowDate.getUTCHours() * 3600 + nowDate.getUTCMinutes() * 60 + nowDate.getUTCSeconds()
    const dayFrac = Math.max(0.05, utcSec / 86_400)
    const budgetFrac = maxDaily > 0n ? Number(dailySpent) / Number(maxDaily) : 0
    const paceMult = budgetFrac > 0.5 && budgetFrac > dayFrac ? Math.min(5.0, budgetFrac / dayFrac) : 1.0
    const effectiveIdleMs = Math.round(MULETA_IDLE_MS * paceMult)

    // Check if previous wave went unsniped for > 90s → damped +3bps widen + quick 30s retry!
    if (ks.pendingWaveCheck && now - ks.pendingWaveSentMs >= 90_000) {
      if (spot >= ks.pendingWaveTargetSpot * 0.9996) {
        ks.unsnipedWaves += 1
        const nextEdge = Math.min(MULETA_MAX_EDGE_BPS, ks.adaptiveEdgeBps + 3)
        log(`[self-tune] wave unsniped after 90s → widening adaptiveEdgeBps ${ks.adaptiveEdgeBps} → ${nextEdge} (retry in 30s)`)
        ks.adaptiveEdgeBps = nextEdge
        ks.lastMuletaMs = now - effectiveIdleMs + 30_000
      }
      ks.pendingWaveCheck = false
      ks.pendingWavePings = 0
      saveKeeperState(ks)
    }

    if (now - ks.lastExternalMoveMs < effectiveIdleMs) return false
    if (now - ks.lastMuletaMs < effectiveIdleMs) return false
    const solBal = snap.nativeNow
    const minRes = BigInt(Math.floor(MIN_SOL_RESERVE * LAMPORTS_PER_SOL))
    if (solBal < minRes) {
      log(`[muleta] skip — native SOL ${(Number(solBal) / 1e9).toFixed(4)} < ${MIN_SOL_RESERVE}`)
      return false
    }

    const { mintArbBreakEven } = computeArbThresholds({
      nav,
      t22Bps,
      orcaFeeHundredthsBp: FEE_ARBER_INVITE,
      solDepFee: poolState.solDepositFee,
      solWdFee: poolState.solWithdrawalFee,
    })
    const edgeBps = ks.adaptiveEdgeBps
    const targetSpot = mintArbBreakEven * (1 + edgeBps / 10_000)

    if (spot >= targetSpot) {
      if (wp.feeRate !== FEE_ARBER_INVITE) {
        await simulateOrSendTx(
          conn,
          [ixSetFeeRate({ config: orcaConfig, whirlpool: whirlpoolPk, feeAuthority: orcaAuth.publicKey, feeRate: FEE_ARBER_INVITE })],
          manager,
          [orcaAuth],
          { cuLimit: 50_000, cuPriceMicroLamports: PRIO_FEE, dryRun: DRY_RUN, label: 'muleta:drop-fee-1bp' },
        )
        ks.lastMuletaMs = now
        ks.pendingWaveCheck = true
        ks.pendingWaveSentMs = now
        ks.pendingWaveTargetSpot = spot
        ks.pendingWavePreEquitySol = equitySol
        saveKeeperState(ks)
        return true
      }
      return false
    }

    // 0.01-bp sub-tick laser precision! swap_v2 accepts any exact sqrtPriceX64 directly —
    // guarantees +11.00 bps lands at +11.00 bps (strictly above bots' hard 10.0 bps floor!).
    const targetPriceBPerA = solIsA ? 1.0 / targetSpot : targetSpot
    const exactTargetTick = priceToTickIndex(targetPriceBPerA, 9, 9)
    const sqrtPriceLimit = priceToSqrtPriceX64(targetPriceBPerA, 9, 9)
    const actualWalkSpot = spotSolPerToro(sqrtPriceLimit, solIsA)
    const alignedBase = solIsA
      ? alignTickFloor(exactTargetTick, tickSpacing)
      : alignTickCeil(exactTargetTick, tickSpacing)
    const aToB = solIsA
    const parkLow = solIsA ? alignedBase - tickSpacing * 36 : alignedBase + tickSpacing * 4
    const parkHigh = solIsA ? alignedBase - tickSpacing * 4 : alignedBase + tickSpacing * 36

    const existing = computeAmountsForLiquidity(wp.sqrtPrice, pos.tickLowerIndex, pos.tickUpperIndex, pos.liquidity)
    const toroInPos = solIsA ? existing.reqB : existing.reqA
    // 99.98% vault retention (50x less self-withheld withdrawal than 99%!)
    const { liquidity: parkL, reqA: parkReqA, reqB: parkReqB } = computeLiquidityForAmounts(
      wp.sqrtPrice,
      parkLow,
      parkHigh,
      solIsA ? 0n : (toroInPos * 9998n) / 10000n,
      solIsA ? (toroInPos * 9998n) / 10000n : 0n,
    )
    if (parkL <= 0n) return false

    // Precompute deterministic post-walk anchor ticks at sqrtPriceLimit (0ms empty-book gap — ALL IN 1 ATOMIC TX!)
    let anchorLow: number
    let anchorHigh: number
    const freeSol = solBal > minRes ? solBal - minRes : 0n
    const wsolBal = snap.wsolWallet.spendable
    const totalSolAvail = ((existing.reqA + wsolBal + freeSol) * 995n) / 1000n

    if (solIsA) {
      anchorHigh = alignTickCeil(priceToTickIndex(1.0 / (nav * BAND_LOW_MULT), 9, 9), tickSpacing)
      if (anchorHigh <= alignedBase + tickSpacing * 6) {
        anchorHigh = alignTickCeil(alignedBase + tickSpacing * 12, tickSpacing)
      }
      const sqrtB = tickIndexToSqrtPriceX64(anchorHigh)
      const lBid = (((totalSolAvail * sqrtPriceLimit) / Q64) * sqrtB) / (sqrtB - sqrtPriceLimit)
      const deltaSqrt = lBid > 0n ? (parkReqB * Q64) / lBid : 0n
      const sqrtAExact = sqrtPriceLimit > deltaSqrt ? sqrtPriceLimit - deltaSqrt : sqrtPriceLimit / 2n
      const exactTickLow = Math.floor((2 * Math.log(Number(sqrtAExact) / Number(Q64))) / Math.log(1.0001))
      // Smart hybrid anchorLow: cap at alignTickCeil(exactTargetTick - 2*ts, ts) (strictly <= alignedBase - ts,
      // 9..16 ticks ask above walk → ~27 ticks after bot snipe!) so idle wallet SOL isn't stranded by double floor-rounding!
      const askCapTick = Math.min(alignTickCeil(exactTargetTick - tickSpacing * 2, tickSpacing), alignedBase - tickSpacing)
      const lowFloor = Math.min(alignTickFloor(exactTickLow, tickSpacing), askCapTick)
      const lowCeil = Math.min(alignTickCeil(exactTickLow, tickSpacing), askCapTick)
      anchorLow = lowFloor
      if (lowCeil > lowFloor) {
        const ceilPreview = computeLiquidityForAmounts(
          sqrtPriceLimit,
          lowCeil,
          anchorHigh,
          totalSolAvail,
          (parkReqB * 9998n) / 10000n,
        )
        // At L=800B-1T, 1 tickSpacing (~8bps) = ~0.31 toroSOL. Allowing up to 0.32 toroSOL (0% T22 loss via in-tx
        // self-recovery, >=0.50 toroSOL ask kept) eliminates stranded wallet SOL & lifts L by +100B-150B!
        const ceilWithdrawToro = parkReqB > ceilPreview.reqB ? parkReqB - ceilPreview.reqB : 0n
        if (ceilWithdrawToro <= 320_000_000n && ceilPreview.reqB >= 500_000_000n) anchorLow = lowCeil
      }
    } else {
      const topSpot = Math.max(nav * BAND_HIGH_MULT, targetSpot * 1.008)
      anchorLow = alignTickFloor(priceToTickIndex(nav * BAND_LOW_MULT, 9, 9), tickSpacing)
      anchorHigh = alignTickCeil(priceToTickIndex(topSpot, 9, 9), tickSpacing)
    }

    const { liquidity: ancL, reqA: ancA, reqB: ancB } = computeLiquidityForAmounts(
      sqrtPriceLimit,
      anchorLow,
      anchorHigh,
      solIsA ? totalSolAvail : (parkReqA * 9998n) / 10000n,
      solIsA ? (parkReqB * 9998n) / 10000n : totalSolAvail,
    )
    if (ancL <= 0n) return false

    log(
      `[muleta] 1-TX ATOMIC WALK+ANCHOR #${ks.totalArbWaves + 1}: spot=${spot.toFixed(5)} → walk=${actualWalkSpot.toFixed(5)} ` +
        `(arbLine=${mintArbBreakEven.toFixed(5)}, edge=+${edgeBps}bps, fee=${FEE_ARBER_INVITE / 100}bps, band=[${anchorLow},${anchorHigh}], L=${(Number(ancL) / 1e9).toFixed(0)}B)`,
    )

    const exLowSt = getStartTickIndex(pos.tickLowerIndex, tickSpacing)
    const exHighSt = getStartTickIndex(pos.tickUpperIndex, tickSpacing)
    const pkLowSt = getStartTickIndex(parkLow, tickSpacing)
    const pkHighSt = getStartTickIndex(parkHigh, tickSpacing)
    const anLowSt = getStartTickIndex(anchorLow, tickSpacing)
    const anHighSt = getStartTickIndex(anchorHigh, tickSpacing)
    const ta0Start = getStartTickIndex(wp.tickCurrentIndex, tickSpacing, 0)
    const ta1Start = getStartTickIndex(wp.tickCurrentIndex, tickSpacing, aToB ? -1 : 1)
    const ta2Start = getStartTickIndex(wp.tickCurrentIndex, tickSpacing, aToB ? -2 : 2)
    // Post-anchor t=0s live-curve 0.00005 SOL real SwapV2 trigger (emits non-zero Orca Traded event at t=0s!)
    const trigTick = sqrtPriceLimit < tickIndexToSqrtPriceX64(exactTargetTick) ? exactTargetTick - 1 : exactTargetTick
    const trigTa0Start = getStartTickIndex(trigTick, tickSpacing, 0)
    const trigTa1Start = getStartTickIndex(trigTick, tickSpacing, -1)
    const trigTa2Start = getStartTickIndex(trigTick, tickSpacing, -2)
    const prepIxs = await ensureTickArrays(whirlpoolPk, manager.publicKey, [
      pkLowSt,
      pkHighSt,
      anLowSt,
      anHighSt,
      ta0Start,
      ta1Start,
      ta2Start,
      ...(solIsA ? [trigTa0Start, trigTa1Start, trigTa2Start] : []),
    ])
    if (prepIxs.length > 0) {
      await simulateOrSendTx(conn, prepIxs, manager, [], {
        cuLimit: 120_000,
        cuPriceMicroLamports: PRIO_FEE,
        dryRun: DRY_RUN,
        label: 'muleta:init-dyn-tick-arrays',
      })
    }

    const maxWithFee = (amt: bigint, isToro: boolean) =>
      isToro ? (amt * 10_500n) / BigInt(10_000 - t22Bps) + 50_000n : (amt * 102n) / 100n + 50_000n

    const triggerLamports = solIsA ? 50_000n : 0n
    const reqSolAfter = (solIsA ? ancA : ancB) + triggerLamports
    const exSol = solIsA ? existing.reqA : existing.reqB
    const needWrap = reqSolAfter + 500_000n > exSol + wsolBal ? reqSolAfter + 2_000_000n - exSol - wsolBal : 0n

    // ONE SINGLE ATOMIC ~188k-CU TX: wrap + (optional fee reset) + park + exact walk + anchor +
    // t=0s 0.00005 SOL live-curve real SwapV2 (instant Geyser bot trigger!) + self-recover + unwrap!
    const needsFeeReset = wp.feeRate !== FEE_ARBER_INVITE
    await simulateOrSendTx(
      conn,
      [
        createAssociatedTokenAccountIdempotentInstruction(manager.publicKey, wsolAta, manager.publicKey, WSOL_MINT, TOKEN_PROGRAM),
        ...(needWrap > 0n
          ? [
              SystemProgram.transfer({ fromPubkey: manager.publicKey, toPubkey: wsolAta, lamports: needWrap }),
              createSyncNativeInstruction(wsolAta, TOKEN_PROGRAM),
            ]
          : []),
        ...(needsFeeReset
          ? [ixSetFeeRate({ config: orcaConfig, whirlpool: whirlpoolPk, feeAuthority: orcaAuth.publicKey, feeRate: FEE_ARBER_INVITE })]
          : []),
        ixRepositionLiquidityV2({
          whirlpool: whirlpoolPk,
          tokenProgramA,
          tokenProgramB,
          positionAuthority: manager.publicKey,
          funder: manager.publicKey,
          position: positionPk,
          positionTokenAccount: positionTokenAta,
          tokenMintA: mintA,
          tokenMintB: mintB,
          tokenOwnerAccountA: ownerAtaA,
          tokenOwnerAccountB: ownerAtaB,
          tokenVaultA: wp.tokenVaultA,
          tokenVaultB: wp.tokenVaultB,
          existingTickArrayLower: deriveTickArrayPda(whirlpoolPk, exLowSt),
          existingTickArrayUpper: deriveTickArrayPda(whirlpoolPk, exHighSt),
          newTickArrayLower: deriveTickArrayPda(whirlpoolPk, pkLowSt),
          newTickArrayUpper: deriveTickArrayPda(whirlpoolPk, pkHighSt),
          newTickLowerIndex: parkLow,
          newTickUpperIndex: parkHigh,
          newLiquidityAmount: parkL,
          existingRangeTokenMinA: 0n,
          existingRangeTokenMinB: 0n,
          newRangeTokenMaxA: maxWithFee(parkReqA, !solIsA),
          newRangeTokenMaxB: maxWithFee(parkReqB, solIsA),
        }),
        ixSwapV2({
          tokenProgramA,
          tokenProgramB,
          tokenAuthority: manager.publicKey,
          whirlpool: whirlpoolPk,
          tokenMintA: mintA,
          tokenMintB: mintB,
          tokenOwnerAccountA: ownerAtaA,
          tokenVaultA: wp.tokenVaultA,
          tokenOwnerAccountB: ownerAtaB,
          tokenVaultB: wp.tokenVaultB,
          tickArray0: deriveTickArrayPda(whirlpoolPk, ta0Start),
          tickArray1: deriveTickArrayPda(whirlpoolPk, ta1Start),
          tickArray2: deriveTickArrayPda(whirlpoolPk, ta2Start),
          oracle: deriveOraclePda(whirlpoolPk),
          amount: 10_000_000n,
          otherAmountThreshold: 0n,
          sqrtPriceLimit,
          amountSpecifiedIsInput: true,
          aToB,
        }),
        ixRepositionLiquidityV2({
          whirlpool: whirlpoolPk,
          tokenProgramA,
          tokenProgramB,
          positionAuthority: manager.publicKey,
          funder: manager.publicKey,
          position: positionPk,
          positionTokenAccount: positionTokenAta,
          tokenMintA: mintA,
          tokenMintB: mintB,
          tokenOwnerAccountA: ownerAtaA,
          tokenOwnerAccountB: ownerAtaB,
          tokenVaultA: wp.tokenVaultA,
          tokenVaultB: wp.tokenVaultB,
          existingTickArrayLower: deriveTickArrayPda(whirlpoolPk, pkLowSt),
          existingTickArrayUpper: deriveTickArrayPda(whirlpoolPk, pkHighSt),
          newTickArrayLower: deriveTickArrayPda(whirlpoolPk, anLowSt),
          newTickArrayUpper: deriveTickArrayPda(whirlpoolPk, anHighSt),
          newTickLowerIndex: anchorLow,
          newTickUpperIndex: anchorHigh,
          newLiquidityAmount: ancL,
          existingRangeTokenMinA: 0n,
          existingRangeTokenMinB: 0n,
          newRangeTokenMaxA: maxWithFee(ancA, !solIsA),
          newRangeTokenMaxB: maxWithFee(ancB, solIsA),
        }),
        ...(solIsA
          ? [
              ixSwapV2({
                tokenProgramA,
                tokenProgramB,
                tokenAuthority: manager.publicKey,
                whirlpool: whirlpoolPk,
                tokenMintA: mintA,
                tokenMintB: mintB,
                tokenOwnerAccountA: ownerAtaA,
                tokenVaultA: wp.tokenVaultA,
                tokenOwnerAccountB: ownerAtaB,
                tokenVaultB: wp.tokenVaultB,
                tickArray0: deriveTickArrayPda(whirlpoolPk, trigTa0Start),
                tickArray1: deriveTickArrayPda(whirlpoolPk, trigTa1Start),
                tickArray2: deriveTickArrayPda(whirlpoolPk, trigTa2Start),
                oracle: deriveOraclePda(whirlpoolPk),
                amount: triggerLamports,
                otherAmountThreshold: 0n,
                sqrtPriceLimit: tickIndexToSqrtPriceX64(trigTick - 10),
                amountSpecifiedIsInput: true,
                aToB: true,
              }),
            ]
          : []),
        // Recover 100% of our own T22 withholding (vault-delta rounding + 0.00005 SOL trigger) → 0.00000 SOL T22 self-burn!
        ixWithdrawWithheldFromAccounts({
          mint,
          destination: toroAta,
          authority: manager.publicKey,
          sources: [toroAta],
        }),
        createCloseAccountInstruction(wsolAta, manager.publicKey, manager.publicKey, [], TOKEN_PROGRAM),
      ],
      manager,
      needsFeeReset ? [orcaAuth] : [],
      { cuLimit: 280_000, cuPriceMicroLamports: PRIO_FEE, dryRun: DRY_RUN, label: `muleta:1tx-walk+anchor[${anchorLow},${anchorHigh}]` },
    )

    const netTriggerIn = (triggerLamports * BigInt(1_000_000 - FEE_ARBER_INVITE)) / 1_000_000n
    const sqrtAfterTrigger = solIsA
      ? (ancL * sqrtPriceLimit) / (ancL + (netTriggerIn * sqrtPriceLimit) / Q64)
      : sqrtPriceLimit
    ks.lastSqrtPrice = sqrtAfterTrigger.toString()
    ks.lastRepositionMs = Date.now()
    ks.lastMuletaMs = Date.now()
    ks.pendingWaveCheck = true
    ks.pendingWaveSentMs = Date.now()
    ks.pendingWaveTargetSpot = actualWalkSpot
    ks.pendingWavePreEquitySol = equitySol
    ks.pendingWavePings = 0
    ks.totalArbWaves += 1
    saveKeeperState(ks)
    return true
  }

  // ----------------------------------------------------------------- Main 24/7 self-tuning loop
  while (true) {
    try {
      // Automatic UTC midnight rollover for 24/7 uninterrupted daily bait accounting
      const todayUtc = new Date().toISOString().slice(0, 10)
      if (ks.dailyBaitDate !== todayUtc) {
        log(`[daily-reset] UTC day rolled ${ks.dailyBaitDate} → ${todayUtc} — resetting dailyBaitLamports`)
        ks.dailyBaitDate = todayUtc
        ks.dailyBaitLamports = '0'
        saveKeeperState(ks)
      }

      // Atomic 2-RPC tick snapshot (11–13 accounts in 1 batch + epochInfo → ZERO torn reads, dual-pool + oracle + validator + reserve aware!)
      const batchKeys = [
        whirlpoolPk,
        positionPk,
        stakePool,
        mint,
        manager.publicKey,
        wsolAta,
        toroAta,
        validatorListPk,
        reserveStakePk,
        SOL_USDC_ORACLE_POOL,
        usdcAta,
        ...(usdcWhirlpoolPk && usdcPositionPk ? [usdcWhirlpoolPk, usdcPositionPk] : []),
      ]
      const [accs, { epoch: curEpoch }] = await Promise.all([
        conn.getMultipleAccountsInfo(batchKeys, 'confirmed'),
        conn.getEpochInfo('confirmed'),
      ])
      const [wpAcc, posAcc, spAcc, mintAcc, mgrAcc, wsolAcc, toroAcc, vlAcc, resAcc, oracleAcc, usdcAtaAcc, usdcWpAcc, usdcPosAcc] = accs
      if (!wpAcc || !posAcc || !spAcc || !mintAcc) throw new Error('missing core pool/mint account')
      const wp = parseWhirlpool(wpAcc.data)
      const pos = parsePosition(posAcc.data)
      const poolState = parseStakePoolData(spAcc.data)
      const parsedValidators = vlAcc ? parseValidatorListData(vlAcc.data) : []
      const valPairs = validatorStakePairs(stakePool, parsedValidators)
      const reserveLamports = BigInt(resAcc?.lamports ?? 0)
      const { bps: t22Bps, withheldInMint } = parseMintTransferFeeData(mintAcc.data, curEpoch)
      const solUsd = oracleAcc ? sqrtPriceX64ToPrice(parseWhirlpool(oracleAcc.data).sqrtPrice, 9, 6) : 0
      const usdcWp = usdcWpAcc ? parseWhirlpool(usdcWpAcc.data) : null
      const usdcPos = usdcPosAcc ? parsePosition(usdcPosAcc.data) : null
      const usdcSqrtStr = usdcWp ? usdcWp.sqrtPrice.toString() : '0'
      const usdcPriceMoved = usdcWp !== null && lastUsdcSqrtStr !== '0' && lastUsdcSqrtStr !== usdcSqrtStr
      if (usdcWp) lastUsdcSqrtStr = usdcSqrtStr

      const spot = spotSolPerToro(wp.sqrtPrice, solIsA)
      const sqrtStr = wp.sqrtPrice.toString()
      const rawPriceMoved = ks.lastSqrtPrice !== '0' && ks.lastSqrtPrice !== sqrtStr
      const prevSpotRaw = rawPriceMoved ? spotSolPerToro(BigInt(ks.lastSqrtPrice), solIsA) : spot
      const rawMoveBps = rawPriceMoved && prevSpotRaw > 0 ? Math.abs(spot / prevSpotRaw - 1) * 10_000 : 0
      // Filter sub-0.005bp self-trigger/ping rounding (~0.0005bp for 50k lamports); catch every >=0.001 SOL trade!
      const priceMoved = rawPriceMoved && rawMoveBps >= 0.005
      // Compute live total SOL-equivalent equity across SOL/toroSOL + USDC/toroSOL + wallet every tick
      const posAmts = computeAmountsForLiquidity(wp.sqrtPrice, pos.tickLowerIndex, pos.tickUpperIndex, pos.liquidity)
      const nativeLamports = BigInt(mgrAcc?.lamports ?? 0)
      const wsolSnap = parseTokenBalanceAndWithheld(wsolAcc?.data)
      const toroSnap = parseTokenBalanceAndWithheld(toroAcc?.data)
      const usdcWalletAmt = Number(parseTokenBalanceAndWithheld(usdcAtaAcc?.data).amount) / 1e6
      const nativeSol = Number(nativeLamports) / 1e9
      const wsolBal = Number(wsolSnap.amount) / 1e9
      const toroBal = Number(toroSnap.spendable) / 1e9
      const lpSol = Number(solIsA ? posAmts.reqA : posAmts.reqB) / 1e9
      const lpToro = Number(solIsA ? posAmts.reqB : posAmts.reqA) / 1e9
      // Exact uncollected Orca LP (75%) + Protocol (25%) fees = 4 * protocolFeeOwed (100% ours!)
      const uncollectedFeeSol = Number(solIsA ? wp.protocolFeeOwedA * 4n : wp.protocolFeeOwedB * 4n) / 1e9
      const uncollectedFeeToro = Number(solIsA ? wp.protocolFeeOwedB * 4n : wp.protocolFeeOwedA * 4n) / 1e9
      let usdcPoolEquitySol = solUsd > 0 ? usdcWalletAmt / solUsd : 0
      if (usdcWp && usdcPos && solUsd > 0) {
        const uAmts = computeAmountsForLiquidity(usdcWp.sqrtPrice, usdcPos.tickLowerIndex, usdcPos.tickUpperIndex, usdcPos.liquidity)
        const lpUsdc = Number(uAmts.reqA) / 1e6
        const lpUsdcToro = Number(uAmts.reqB) / 1e9
        const uncollUsdc = Number(usdcWp.protocolFeeOwedA * 4n) / 1e6
        const uncollUsdcToro = Number(usdcWp.protocolFeeOwedB * 4n) / 1e9
        usdcPoolEquitySol += (lpUsdc + uncollUsdc) / solUsd + (lpUsdcToro + uncollUsdcToro) * poolState.navSolPerToken
      }
      const equitySol =
        nativeSol +
        wsolBal +
        lpSol +
        uncollectedFeeSol +
        (toroBal + lpToro + uncollectedFeeToro) * poolState.navSolPerToken +
        usdcPoolEquitySol
      const prevEquitySol = ks.lastEquitySol
      ks.lastEquitySol = equitySol
      // Auto-rebase highWater on owner wallet outflows (e.g. Titan swaps/transfers from 331 with ZERO pool trade)
      // so manual wallet usage NEVER stalls Muleta, while real trade/exploit drawdowns still trip the guard!
      if (!priceMoved && !usdcPriceMoved && !ks.pendingWaveCheck && prevEquitySol > 0 && prevEquitySol - equitySol > 0.08) {
        const drop = prevEquitySol - equitySol
        const oldHw = ks.equityHighWaterSol
        ks.equityHighWaterSol = Math.max(equitySol, oldHw - drop)
        log(
          `[guard] owner wallet outflow (-${drop.toFixed(4)} SOL, zero pool move) — rebasing highWater ${oldHw.toFixed(4)} → ${ks.equityHighWaterSol.toFixed(4)} SOL`,
        )
      }
      if (equitySol > ks.equityHighWaterSol) ks.equityHighWaterSol = equitySol

      if (priceMoved) {
        const prevSpot = spotSolPerToro(BigInt(ks.lastSqrtPrice), solIsA)
        const moveBps = prevSpot > 0 ? Math.abs(spot / prevSpot - 1) * 10_000 : 0
        let handledWaveSnipe = false

        // Self-tune adaptiveEdgeBps (damped controller!) & log ACTUAL realised wave cost when pending wave gets sniped!
        if (ks.pendingWaveCheck && spot < ks.pendingWaveTargetSpot * 0.9996) {
          handledWaveSnipe = true
          const fillSec = (Date.now() - ks.pendingWaveSentMs) / 1000
          ks.snipedWaves += 1
          ks.pendingWaveCheck = false
          ks.pendingWavePings = 0
          const realisedCostSol =
            ks.pendingWavePreEquitySol > equitySol ? ks.pendingWavePreEquitySol - equitySol : 0
          if (realisedCostSol > 0.0002 && realisedCostSol < 0.05) {
            const costLam = BigInt(Math.floor(realisedCostSol * LAMPORTS_PER_SOL))
            ks.dailyBaitLamports = (BigInt(ks.dailyBaitLamports) + costLam).toString()
            ks.outstandingBaitLamports = (BigInt(ks.outstandingBaitLamports) + costLam).toString()
            log(
              `[self-tune] logged actual wave cost=${realisedCostSol.toFixed(5)} SOL ` +
                `(will recoup <=${RECOUP_MAX_PCT}% of sweep, burn >=${100n - RECOUP_MAX_PCT}%!)`,
            )
          }
          if (fillSec <= 15 && ks.adaptiveEdgeBps > MULETA_MIN_EDGE_BPS) {
            const nextEdge = Math.max(MULETA_MIN_EDGE_BPS, ks.adaptiveEdgeBps - 1)
            log(`[self-tune] wave sniped in ${fillSec.toFixed(0)}s! Tightening edge ${ks.adaptiveEdgeBps} → ${nextEdge}bps`)
            ks.adaptiveEdgeBps = nextEdge
          } else {
            log(`[self-tune] wave sniped in ${fillSec.toFixed(0)}s (holding edge=${ks.adaptiveEdgeBps}bps)`)
          }
        } else if (spot < prevSpot && prevEquitySol > equitySol + 0.0005) {
          // External SELL into our above-NAV bid wall: log pre-sweep equity drop into outstandingBaitLamports
          // (NOT dailyBaitLamports!) so burn-loop recoups <=90% of the seller's 2% T22 tax back to 331
          // (0% principal loss on external dumps while still burning >=10% to lift NAV!), while external BUYS burn 100%!
          const sellDropSol = prevEquitySol - equitySol
          if (sellDropSol < 0.25) {
            const dropLam = BigInt(Math.floor(sellDropSol * LAMPORTS_PER_SOL))
            ks.outstandingBaitLamports = (BigInt(ks.outstandingBaitLamports) + dropLam).toString()
            log(
              `[guard] external sell bid-wall protection: logged ${sellDropSol.toFixed(5)} SOL pre-sweep drop ` +
                `(recouping <=${RECOUP_MAX_PCT}% of seller T22 tax, burning >=${100n - RECOUP_MAX_PCT}%!)`,
            )
          }
        }

        if (handledWaveSnipe) {
          log(`[watch] WAVE SNIPED! spot=${spot.toFixed(6)} (${moveBps.toFixed(1)}bps) nav=${poolState.navSolPerToken.toFixed(6)}`)
          ks.lastExternalMoveMs = Date.now()
        } else if (spot < prevSpot && moveBps >= 3.0) {
          // V-shaped rebound: after ANY >=3bp external sell drops spot below arbLine, walk back UP in <=45s
          // (clamp BOTH lastExternalMoveMs & lastMuletaMs so a recent wave doesn't trap the chart red for 180s!)
          const reboundAnchor = Date.now() - MULETA_IDLE_MS + 45_000
          log(`[watch] EXTERNAL SELL! spot=${spot.toFixed(6)} (-${moveBps.toFixed(1)}bps) nav=${poolState.navSolPerToken.toFixed(6)} → V-rebound in <=45s`)
          ks.lastExternalMoveMs = Math.min(ks.lastExternalMoveMs, reboundAnchor)
          ks.lastMuletaMs = Math.min(ks.lastMuletaMs, reboundAnchor)
        } else if (moveBps >= DUST_MOVE_FILTER_BPS) {
          log(`[watch] EXTERNAL TRADE! spot=${spot.toFixed(6)} (${moveBps.toFixed(1)}bps) nav=${poolState.navSolPerToken.toFixed(6)}`)
          ks.lastExternalMoveMs = Date.now()
        } else {
          log(`[watch] dust trade (${moveBps.toFixed(1)}bps) — sweeping burn, not stalling walk`)
        }
      }
      ks.lastSqrtPrice = sqrtStr
      saveKeeperState(ks)

      const thresholds = computeArbThresholds({
        nav: poolState.navSolPerToken,
        t22Bps,
        orcaFeeHundredthsBp: wp.feeRate,
        solDepFee: poolState.solDepositFee,
        solWdFee: poolState.solWithdrawalFee,
      })

      log(
        `[tick] spot=${spot.toFixed(5)} nav=${poolState.navSolPerToken.toFixed(5)} (${((spot / poolState.navSolPerToken - 1) * 100).toFixed(2)}%) ` +
          `tvl=${(Number(poolState.totalLamports) / 1e9).toFixed(2)} L=${(Number(pos.liquidity) / 1e9).toFixed(0)}B ` +
          `eq=${equitySol.toFixed(3)}SOL edge=${ks.adaptiveEdgeBps}bp fee=${(wp.feeRate / 10_000).toFixed(2)}% ` +
          `ticks=[${pos.tickLowerIndex}..${wp.tickCurrentIndex}..${pos.tickUpperIndex}] arb=[${thresholds.burnArbBreakEven.toFixed(4)},${thresholds.mintArbBreakEven.toFixed(4)}]`,
      )

      // 0. Instant epoch-rollover crank (curEpoch + validator list + reserve balance already fetched in parallel above!)
      const desiredFee = computeDesiredFee(spot, poolState.navSolPerToken)
      const burnSnap = { poolState, curEpoch, withheldInMint, valPairs, reserveLamports }
      const walletSnap = { nativeNow: nativeLamports, wsolWallet: wsolSnap, toroWallet: toroSnap, reserveLamports }
      if (Number(poolState.lastUpdateEpoch) < curEpoch) {
        log(`[epoch-crank] Epoch ${curEpoch} rolled — cranking!`)
        await runBurnLoop(true, wp.feeRate, desiredFee, burnSnap)
        await sleep(2000)
        continue
      }

      // 1. Atomic Burn-Loop + Fee Snap FIRST (sweeps BOTH SOL/toroSOL and USDC/toroSOL cross-arb trades instantly!)
      if (priceMoved || usdcPriceMoved || Date.now() - ks.lastBurnMs >= BURN_TICK_MS) {
        if (usdcPriceMoved && !priceMoved) log(`[watch] USDC/toroSOL CROSS-ARB TRADE! Sweeping & burning T22 fees immediately!`)
        const burned = await runBurnLoop(false, wp.feeRate, desiredFee, burnSnap)
        if (burned) {
          await sleep(2000)
          continue // re-read fresh post-burn NAV & snapped fee before rebalance/reposition/muleta!
        }
      }

      // 2. Dynamic fee surf (only sends standalone tx if no burn-loop ran this tick!)
      await maybeSurfFee(wp, poolState.navSolPerToken)

      // 3. Zero-ping-pong ratio-aware rebalancer (uses atomic batch snapshot → ZERO extra RPCs!)
      if (await maybeRebalance(wp, pos, poolState, t22Bps, walletSnap)) {
        await sleep(2000)
        continue
      }

      // 4. Tight-range slider (skip to fresh read if mutated → ZERO Custom:6009!)
      if (await maybeReposition(wp, pos, poolState.navSolPerToken, t22Bps, walletSnap)) {
        await sleep(2000)
        continue
      }

      // 5. Self-tuning Muleta upward walk (t=0s in-tx live SwapV2 bot trigger + snapshot reuse!)
      if (await maybeWaveMuleta(wp, pos, poolState.navSolPerToken, t22Bps, poolState, equitySol, walletSnap)) {
        await sleep(2500)
        continue
      }

      // 6. Collect LP + 25% protocol rake + auto-redeem excess idle toroSOL every COLLECT_TICK_MS (outside snipe window!)
      if (!ks.pendingWaveCheck && Date.now() - ks.lastCollectMs >= COLLECT_TICK_MS) {
        await runCollectFees(wp, pos, poolState, toroSnap.spendable, reserveLamports)
        if (usdcWp && usdcPos) {
          await maybeCollectUsdcFees(usdcWp, usdcPos, solUsd, poolState.navSolPerToken)
        }
      }

      // 7. Passive OOR auto-recenter for USDC/toroSOL cross-arb pool (0% churn while in range!)
      if (usdcWp && usdcPos && (await maybeRepositionUsdcPool(usdcWp, usdcPos, t22Bps))) {
        await sleep(2000)
        continue
      }
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e)
      log(`[loop error] ${msg}`)
      if (/ENOTFOUND|ECONNRESET|ECONNREFUSED|429|timeout|fetch failed/i.test(msg)) {
        rotateRpc(msg.slice(0, 80))
      }
    }

    if (process.argv.includes('--once')) break
    // Fast 3s poll while waiting for bot snipe so Ping #1 fires at t=5s (6s fill instead of 15s!)
    await sleep(ks.pendingWaveCheck ? 3_000 : FAST_TICK_MS)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
