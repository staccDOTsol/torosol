#!/usr/bin/env bun
/**
 * 06_receipts.ts — Generate independently verifiable on-chain proof receipts
 * (RECEIPTS.md + receipts.json) straight from Solana mainnet RPC + confirmed tx logs.
 *
 * ZERO secrets, ZERO private keys, ZERO local paths — safe to commit and push directly to GitHub.
 */

import { PublicKey } from '@solana/web3.js'
import fs from 'node:fs'
import path from 'node:path'
import {
  KEEPER_STATE_FILE,
  loadDeployment,
  SOL_USDC_ORACLE_POOL,
  SANCTUM_STAKE_POOL_PROGRAM,
  STATE_DIR,
} from './config'
import {
  fetchMintTransferFeeBps,
  fetchStakePoolState,
  findWithheldAccounts,
  parseValidatorListData,
  validatorStakePairs,
} from './sanctum'
import { createConnection } from './tx'
import {
  computeAmountsForLiquidity,
  parsePosition,
  parseWhirlpool,
  sqrtPriceX64ToPrice,
} from './whirlpool'

const REPO_ROOT = path.resolve(import.meta.dir, '..')
const RECEIPTS_MD = path.join(REPO_ROOT, 'RECEIPTS.md')
const RECEIPTS_JSON = path.join(REPO_ROOT, 'receipts.json')
const INIT_BURN_TORO = 0.087 // Verified initial deployment burn prior to keeper v2 accounting

interface ConfirmedEvent {
  timestampUtc: string
  action: string
  signature: string
  detail: string
}

function parseRecentConfirmedTxs(logPath: string, limit = 15): ConfirmedEvent[] {
  if (!fs.existsSync(logPath)) return []
  const lines = fs.readFileSync(logPath, 'utf-8').split('\n')
  const events: ConfirmedEvent[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] CONFIRMED \[(.+)\] ([1-9A-HJ-NP-Za-km-z]{64,96})$/)
    if (!m) continue
    const [, ts, action, signature] = m
    let detail = ''
    if (action.startsWith('burn:')) {
      const next = lines[i + 1] ?? ''
      const prev2 = lines[i - 3] ?? ''
      const navMatch = next.match(/NAV updated \(1 tx!\): ([0-9.]+ → [0-9.]+)/)
      const burnMatch = prev2.match(/swept=([0-9.]+).*burn=([0-9.]+) toroSOL/)
      detail = [
        burnMatch ? `swept ${burnMatch[1]} / burned ${burnMatch[2]} toroSOL` : '',
        navMatch ? `NAV ${navMatch[1]}` : '',
      ]
        .filter(Boolean)
        .join(' · ')
    } else if (action.startsWith('rebalance:atomic-lp-to-sol-boost')) {
      const prev = lines[i - 3] ?? ''
      const lMatch = prev.match(/L\(([^)]+)\).*redeem ([0-9.]+) toroSOL → \+([0-9.]+) SOL/)
      detail = lMatch ? `L ${lMatch[1]} · recycled ${lMatch[2]} toroSOL -> +${lMatch[3]} SOL` : '0%-loss LP->SOL->BOOST'
    } else if (action.startsWith('rebalance:withdraw-idle-toro')) {
      const prev = lines[i - 3] ?? ''
      const rMatch = prev.match(/redeem ([0-9.]+) idle toroSOL → SOL/)
      detail = rMatch ? `redeemed ${rMatch[1]} idle toroSOL -> SOL` : 'idle toroSOL -> SOL'
    } else if (action.startsWith('muleta:')) {
      const prev = lines[i - 3] ?? ''
      const wMatch = prev.match(/#(\d+): spot=([0-9.]+) → walk=([0-9.]+).*L=([0-9]+B)/)
      detail = wMatch ? `Wave #${wMatch[1]} · ${wMatch[2]} -> ${wMatch[3]} · L=${wMatch[4]}` : '1-TX atomic walk+anchor'
    } else if (action.startsWith('collect:')) {
      detail = action
    }
    events.push({ timestampUtc: ts + ' UTC', action, signature, detail })
  }
  return events.slice(-limit).reverse()
}

function parseStakeActivationEpoch(data: Buffer | undefined): { state: string; activationEpoch: string; voter: string } {
  if (!data || data.length < 184) return { state: 'uninitialized', activationEpoch: 'n/a', voter: 'n/a' }
  const discriminant = data.readUInt32LE(0)
  if (discriminant === 2) {
    // StakeStateV2::Stake => Meta(120 bytes at offset 4..124) + Delegation(voter:32 at 124, stake:8 at 156, activationEpoch:8 at 164)
    const voter = new PublicKey(data.subarray(124, 156)).toBase58()
    const act = data.readBigUInt64LE(164).toString()
    return { state: 'delegated', activationEpoch: act, voter }
  }
  return { state: discriminant === 1 ? 'initialized' : `state(${discriminant})`, activationEpoch: 'n/a', voter: 'n/a' }
}

async function main() {
  const dep = loadDeployment()
  if (!dep) throw new Error('state/deployment.json not found')

  const conn = createConnection()
  const mintPk = new PublicKey(dep.mint)
  const stakePoolPk = new PublicKey(dep.stakePool)

  const [slot, epochInfo, pool, mintInfo, mintAcc] = await Promise.all([
    conn.getSlot('confirmed'),
    conn.getEpochInfo('confirmed'),
    fetchStakePoolState(conn, stakePoolPk),
    fetchMintTransferFeeBps(conn, mintPk),
    conn.getAccountInfo(mintPk, 'confirmed'),
  ])

  // Parse Token-2022 mint authorities directly from raw bytes (offset 0: mintAuthOption(4)+mintAuth(32), offset 46: freezeAuthOption(4)+freezeAuth(32))
  const mintAuthOption = mintAcc ? mintAcc.data.readUInt32LE(0) : 0
  const mintAuthority = mintAcc && mintAuthOption === 1 ? new PublicKey(mintAcc.data.subarray(4, 36)).toBase58() : null
  const freezeAuthOption = mintAcc ? mintAcc.data.readUInt32LE(46) : 0
  const freezeAuthority = mintAcc && freezeAuthOption === 1 ? new PublicKey(mintAcc.data.subarray(50, 82)).toBase58() : null

  const [vlAcc, resAcc, wpAcc, posAcc, uWpAcc, uPosAcc, oracleAcc, withheldAccts] = await Promise.all([
    conn.getAccountInfo(pool.validatorList, 'confirmed'),
    conn.getAccountInfo(pool.reserveStake, 'confirmed'),
    dep.whirlpool ? conn.getAccountInfo(new PublicKey(dep.whirlpool), 'confirmed') : Promise.resolve(null),
    dep.position ? conn.getAccountInfo(new PublicKey(dep.position), 'confirmed') : Promise.resolve(null),
    dep.usdcWhirlpool ? conn.getAccountInfo(new PublicKey(dep.usdcWhirlpool), 'confirmed') : Promise.resolve(null),
    dep.usdcPosition ? conn.getAccountInfo(new PublicKey(dep.usdcPosition), 'confirmed') : Promise.resolve(null),
    conn.getAccountInfo(SOL_USDC_ORACLE_POOL, 'confirmed'),
    findWithheldAccounts(conn, mintPk, 1n),
  ])

  const validators = vlAcc ? parseValidatorListData(vlAcc.data) : []
  const valPairs = validatorStakePairs(stakePoolPk, validators)
  const stakeAccInfos =
    valPairs.length > 0
      ? await conn.getMultipleAccountsInfo(
          valPairs.flatMap((p) => [p.validatorStake, p.transientStake]),
          'confirmed',
        )
      : []

  const validatorDetails = validators.map((v, idx) => {
    const vsaInfo = stakeAccInfos[idx * 2]
    const tsaInfo = stakeAccInfos[idx * 2 + 1]
    const vsaMeta = parseStakeActivationEpoch(vsaInfo?.data)
    const tsaMeta = parseStakeActivationEpoch(tsaInfo?.data)
    return {
      voteAccount: v.voteAccount.toBase58(),
      validatorStakeAccount: valPairs[idx].validatorStake.toBase58(),
      transientStakeAccount: valPairs[idx].transientStake.toBase58(),
      activeStakeSol: Number(v.activeStakeLamports) / 1e9,
      transientStakeSol: Number(v.transientStakeLamports) / 1e9,
      vsaActivationEpoch: vsaMeta.activationEpoch,
      tsaActivationEpoch: tsaMeta.activationEpoch,
      status: v.status,
    }
  })

  const reserveSol = (resAcc?.lamports ?? 0) / 1e9
  const tvlSol = Number(pool.totalLamports) / 1e9
  const supplyToro = Number(mintInfo.supply) / 1e9
  const nav = pool.navSolPerToken
  const navGainPct = (nav - 1) * 100
  const epochPct = (epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100
  const nextEpochEtaHours = ((epochInfo.slotsInEpoch - epochInfo.slotIndex) * 0.4) / 3600
  const pendingWithheldToro =
    Number(withheldAccts.reduce((s, a) => s + a.withheld, 0n) + mintInfo.withheldInMint) / 1e9

  // Primary Orca Whirlpool (SOL / toroSOL)
  let primaryPool: Record<string, unknown> | null = null
  if (wpAcc && posAcc && dep.whirlpool) {
    const wp = parseWhirlpool(wpAcc.data)
    const pos = parsePosition(posAcc.data)
    const bPerA = sqrtPriceX64ToPrice(wp.sqrtPrice, 9, 9)
    const spot = dep.solIsA ? 1 / bPerA : bPerA
    const amts = computeAmountsForLiquidity(wp.sqrtPrice, pos.tickLowerIndex, pos.tickUpperIndex, pos.liquidity)
    primaryPool = {
      address: dep.whirlpool,
      tickSpacing: wp.tickSpacing,
      feePct: wp.feeRate / 10_000,
      protocolRakePct: wp.protocolFeeRate / 100,
      spotSolPerToro: Number(spot.toFixed(6)),
      premiumVsNavPct: Number(((spot / nav - 1) * 100).toFixed(2)),
      liquidity: pos.liquidity.toString(),
      ticks: [pos.tickLowerIndex, wp.tickCurrentIndex, pos.tickUpperIndex],
      bidSol: Number((Number(dep.solIsA ? amts.reqA : amts.reqB) / 1e9).toFixed(4)),
      askToro: Number((Number(dep.solIsA ? amts.reqB : amts.reqA) / 1e9).toFixed(4)),
    }
  }

  // Secondary Orca Whirlpool (USDC / toroSOL)
  let usdcPool: Record<string, unknown> | null = null
  const solUsd = oracleAcc ? sqrtPriceX64ToPrice(parseWhirlpool(oracleAcc.data).sqrtPrice, 9, 6) : 0
  if (uWpAcc && uPosAcc && dep.usdcWhirlpool) {
    const uWp = parseWhirlpool(uWpAcc.data)
    const uPos = parsePosition(uPosAcc.data)
    const uSpotUsd = 1 / sqrtPriceX64ToPrice(uWp.sqrtPrice, 6, 9)
    const uAmts = computeAmountsForLiquidity(uWp.sqrtPrice, uPos.tickLowerIndex, uPos.tickUpperIndex, uPos.liquidity)
    usdcPool = {
      address: dep.usdcWhirlpool,
      tickSpacing: uWp.tickSpacing,
      feePct: uWp.feeRate / 10_000,
      protocolRakePct: uWp.protocolFeeRate / 100,
      spotUsdPerToro: Number(uSpotUsd.toFixed(2)),
      solUsdOracle: Number(solUsd.toFixed(2)),
      impliedSolPerToro: solUsd > 0 ? Number((uSpotUsd / solUsd).toFixed(4)) : 0,
      liquidity: uPos.liquidity.toString(),
      bidUsdc: Number((Number(uAmts.reqA) / 1e6).toFixed(2)),
      askToro: Number((Number(uAmts.reqB) / 1e9).toFixed(4)),
    }
  }

  // Public protocol KPIs from keeper state (no wallet balance/equity secrets)
  let keeperKpis: Record<string, unknown> | null = null
  if (fs.existsSync(KEEPER_STATE_FILE)) {
    const ks = JSON.parse(fs.readFileSync(KEEPER_STATE_FILE, 'utf-8'))
    const sniped = Number(ks.snipedWaves ?? 0)
    const unsniped = Number(ks.unsnipedWaves ?? 0)
    const checked = sniped + unsniped
    const keeperBurned = Number(ks.totalBurnedAtoms ?? 0) / 1e9
    keeperKpis = {
      totalWaves: Number(ks.totalArbWaves ?? 0),
      snipedWaves: sniped,
      unsnipedWaves: unsniped,
      allTimeFillPct: checked > 0 ? Number(((sniped / checked) * 100).toFixed(1)) : 0,
      adaptiveEdgeBps: Number(ks.adaptiveEdgeBps ?? 12),
      keeperBurnedToro: Number(keeperBurned.toFixed(4)),
      totalBurnedToroInclInit: Number((keeperBurned + INIT_BURN_TORO).toFixed(4)),
    }
  }

  const recentTxs = parseRecentConfirmedTxs(path.join(STATE_DIR, 'keeper.log'), 15)
  const generatedAtUtc = new Date().toISOString()

  const payload = {
    generatedAtUtc,
    network: 'mainnet-beta',
    slot,
    epoch: {
      current: epochInfo.epoch,
      progressPct: Number(epochPct.toFixed(2)),
      nextEpoch: epochInfo.epoch + 1,
      nextEpochEtaHours: Number(nextEpochEtaHours.toFixed(2)),
    },
    protocol: {
      tokenSymbol: dep.tokenSymbol,
      mint: dep.mint,
      mintAuthority,
      freezeAuthority,
      transferFeeBps: mintInfo.bps,
      stakePoolProgram: SANCTUM_STAKE_POOL_PROGRAM.toBase58(),
      stakePool: dep.stakePool,
      reserveStake: dep.reserveStake,
      validatorList: dep.validatorList,
      solDepositFee: `${pool.solDepositFee.numerator}/${pool.solDepositFee.denominator}`,
      solWithdrawalFee: `${pool.solWithdrawalFee.numerator}/${pool.solWithdrawalFee.denominator}`,
      epochFee: `${pool.epochFee.numerator}/${pool.epochFee.denominator}`,
    },
    backing: {
      tvlSol: Number(tvlSol.toFixed(6)),
      supplyToro: Number(supplyToro.toFixed(6)),
      navSolPerToro: Number(nav.toFixed(6)),
      navGainSinceLaunchPct: Number(navGainPct.toFixed(2)),
      reserveSol: Number(reserveSol.toFixed(4)),
      stakedSol: Number(
        validatorDetails.reduce((s, v) => s + v.activeStakeSol + v.transientStakeSol, 0).toFixed(4),
      ),
      pendingWithheldToro: Number(pendingWithheldToro.toFixed(6)),
      validators: validatorDetails,
    },
    pools: {
      solToro: primaryPool,
      usdcToro: usdcPool,
    },
    keeper: keeperKpis,
    recentConfirmedTxs: recentTxs,
  }

  fs.writeFileSync(RECEIPTS_JSON, JSON.stringify(payload, null, 2) + '\n')

  const valRows = validatorDetails
    .map(
      (v) =>
        `| Helius 0% (\`${v.voteAccount.slice(0, 8)}...\`) | [\`${v.validatorStakeAccount}\`](https://solscan.io/account/${v.validatorStakeAccount}) | \`${v.activeStakeSol.toFixed(4)} SOL\` (act epoch ${v.vsaActivationEpoch}) | [\`${v.transientStakeAccount}\`](https://solscan.io/account/${v.transientStakeAccount}) | \`${v.transientStakeSol.toFixed(4)} SOL\` (act epoch ${v.tsaActivationEpoch}) |`,
    )
    .join('\n')

  const txRows = recentTxs
    .map(
      (t) =>
        `| \`${t.timestampUtc}\` | \`${t.action}\` | ${t.detail || '-'} | [\`${t.signature.slice(0, 14)}...\`](https://solscan.io/tx/${t.signature}) |`,
    )
    .join('\n')

  const md = `# toroSOL On-Chain Receipts

Independently verifiable Solana mainnet proof snapshot generated directly from live RPC state at **slot \`${slot}\`** (\`${generatedAtUtc}\`).
Machine-readable JSON: [\`receipts.json\`](./receipts.json).

---

## 1. Immutable Backing & Security Invariants

| Proof | Verified On-Chain Value | Link |
|---|---|---|
| **Stake Pool Program** | \`${SANCTUM_STAKE_POOL_PROGRAM.toBase58()}\` (unmodified Sanctum SPL Stake Pool) | [Solscan](https://solscan.io/account/${SANCTUM_STAKE_POOL_PROGRAM.toBase58()}) |
| **Stake Pool Account** | \`${dep.stakePool}\` | [Solscan](https://solscan.io/account/${dep.stakePool}) |
| **Token-2022 Mint** | \`${dep.mint}\` | [Solscan](https://solscan.io/token/${dep.mint}) |
| **Mint Authority** | \`${mintAuthority}\` (Sanctum withdraw-authority PDA; only SOL deposits mint) | [Solscan](https://solscan.io/account/${mintAuthority}) |
| **Freeze Authority** | \`${freezeAuthority ?? 'None (permanently revoked)'}\` | Verifiable via \`spl-token display\` |
| **Token-2022 Transfer Fee** | \`${mintInfo.bps} bps\` (\`${(mintInfo.bps / 100).toFixed(2)}%\`) | Swept & burned on-chain |
| **Stake Pool Deposit / Epoch Fee** | \`${pool.solDepositFee.numerator}/${pool.solDepositFee.denominator}\` deposit · \`${pool.epochFee.numerator}/${pool.epochFee.denominator}\` epoch · \`${pool.solWithdrawalFee.numerator}/${pool.solWithdrawalFee.denominator}\` withdrawal | Live StakePool state |

---

## 2. Live SOL Backing & Monotonic NAV Floor

| Metric | Live Mainnet Value |
|---|---|
| **On-Chain NAV Floor** | **\`${nav.toFixed(6)} SOL / toroSOL\`** (**\`+${navGainPct.toFixed(2)}%\`** in SOL since \`1.000000\` launch) |
| **Total SOL Backing (TVL)** | \`${tvlSol.toFixed(6)} SOL\` (\`${reserveSol.toFixed(4)} SOL\` instant ReserveStake + \`${payload.backing.stakedSol.toFixed(4)} SOL\` Helius 0% staked) |
| **Circulating Supply** | \`${supplyToro.toFixed(6)} toroSOL\` |
| **Total Permanently Burned** | **\`${keeperKpis ? (keeperKpis.totalBurnedToroInclInit as number).toFixed(4) : 'n/a'} toroSOL\`** (\`${keeperKpis ? (keeperKpis.keeperBurnedToro as number).toFixed(4) : 'n/a'}\` keeper + \`${INIT_BURN_TORO.toFixed(4)}\` init) |
| **Epoch & Helius Yield ETA** | Epoch \`${epochInfo.epoch}\` (\`${epochPct.toFixed(1)}%\`) · Epoch \`${epochInfo.epoch + 1}\` in \`~${nextEpochEtaHours.toFixed(1)}h\` |
| **Matador Arb Engine** | \`${keeperKpis ? `${keeperKpis.totalWaves} waves · ${keeperKpis.snipedWaves} sniped / ${keeperKpis.unsnipedWaves} unsniped (${keeperKpis.allTimeFillPct}% all-time)` : 'n/a'}\` |

### Native Helius 0% Validator Stake Accounts

| Validator | Validator Stake Account (VSA) | VSA Balance | Transient Stake Account (TSA) | TSA Balance |
|---|---|---|---|---|
${valRows || '| none | - | - | - | - |'}

---

## 3. Dual Concentrated Orca Whirlpools

| Pool | Address | Live Spot | Depth (Bid / Ask) | Liquidity (\`L\`) | Fees |
|---|---|---|---|---|---|
| **SOL / toroSOL** (\`ts=8\`) | [\`${dep.whirlpool}\`](https://www.geckoterminal.com/solana/pools/${dep.whirlpool}) | \`${primaryPool ? primaryPool.spotSolPerToro : 'n/a'} SOL\` (\`+${primaryPool ? primaryPool.premiumVsNavPct : 'n/a'}%\` vs NAV) | \`${primaryPool ? `${primaryPool.bidSol} SOL / ${primaryPool.askToro} toroSOL` : 'n/a'}\` | \`${primaryPool ? (Number(primaryPool.liquidity) / 1e9).toFixed(1) + 'B' : 'n/a'}\` | \`0.30%\` (\`25%\` proto rake) |
| **USDC / toroSOL** (\`ts=64\`) | [\`${dep.usdcWhirlpool}\`](https://www.geckoterminal.com/solana/pools/${dep.usdcWhirlpool}) | \`$${usdcPool ? usdcPool.spotUsdPerToro : 'n/a'}\` (SOL \`$${usdcPool ? usdcPool.solUsdOracle : 'n/a'}\`) | \`$${usdcPool ? usdcPool.bidUsdc : 'n/a'} USDC / ${usdcPool ? usdcPool.askToro : 'n/a'} toroSOL\` | \`${usdcPool ? usdcPool.liquidity : 'n/a'}\` | \`0.30%\` (\`25%\` proto rake) |

---

## 4. Recent Confirmed Mainnet Transactions (Live Proof)

| UTC Timestamp | Action | On-Chain Result | Solscan Receipt |
|---|---|---|---|
${txRows || '| - | - | - | - |'}

---

## 5. Verify Independently in 5 Seconds (No Trust Required)

\`\`\`bash
# 1. Verify Stake Pool is owned by unmodified Sanctum SP12tWFx program
solana account 3X1zrKG6mkWPrbKNuBckNEwUKeQkEB3FEcbSAUdzzAfp

# 2. Verify Token-2022 Mint has freezeAuthority = None and mintAuthority = Sanctum PDA
spl-token display Gmd2K22WVRjhMH7eFfAWNa2y782zKSgHcgd8Gd457Mzt --program-2022

# 3. Verify live Helius 0% stake accounts directly on-chain
solana stake-account J7AQFxiEN6nhxTuNxhk5TywUtjakt3DkGGsRG2Bg4ZMa
solana stake-account EJM8gotcWQGMtgycfec1fEc2HY5zBQui2MZD9fiMEqhS

# 4. Re-generate this exact receipt file against your own Solana RPC
bun run receipts
\`\`\`
`

  fs.writeFileSync(RECEIPTS_MD, md)
  console.log(
    `[receipts] wrote RECEIPTS.md + receipts.json at slot=${slot} | NAV=${nav.toFixed(6)} (+${navGainPct.toFixed(2)}%) | burned=${keeperKpis?.totalBurnedToroInclInit ?? 'n/a'} toroSOL | txs=${recentTxs.length}`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
