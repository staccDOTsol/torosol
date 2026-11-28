# toroSOL — The Undying Bull

**100% SOL-backed Token-2022 Liquid Staking Token** running on the unmodified [Sanctum SPL Stake Pool](https://solscan.io/account/SP12tWFxD9oJsVWNavTTBZvMbA6gkAmxtVgxdqvyvhY) (`SP12tWFx`), combining **native validator staking with a Holosol delegation policy** with an automated **2.00% Token-2022 transfer-fee burn-loop** and **24/7 dual-pool Orca CLMM liquidity** (`SOL/toroSOL` + `USDC/toroSOL`).

---

## Verified Mainnet Addresses

| Component | Address |
|---|---|
| **toroSOL Mint (Token-2022, 200 bps fee, `freezeAuthority = None`)** | [`Gmd2K22WVRjhMH7eFfAWNa2y782zKSgHcgd8Gd457Mzt`](https://solscan.io/token/Gmd2K22WVRjhMH7eFfAWNa2y782zKSgHcgd8Gd457Mzt) |
| **Sanctum SPL Stake Pool (`SP12tWFx`, unmodified)** | [`3X1zrKG6mkWPrbKNuBckNEwUKeQkEB3FEcbSAUdzzAfp`](https://solscan.io/account/3X1zrKG6mkWPrbKNuBckNEwUKeQkEB3FEcbSAUdzzAfp) |
| **Target validator vote account** | [Holosol · `MJnfCZPZFDjKVMDSiNAug4gdeURDM1CpJQtFyL23NL9`](https://solscan.io/account/MJnfCZPZFDjKVMDSiNAug4gdeURDM1CpJQtFyL23NL9) |
| **Primary Orca Whirlpool (`SOL / toroSOL`, `ts=8`, `0.30%` fee)** | [`3m5V1UfeYiFUiMRQxvdZQv6kktUcSCHzbMa4HsVSt2Up`](https://www.geckoterminal.com/solana/pools/3m5V1UfeYiFUiMRQxvdZQv6kktUcSCHzbMa4HsVSt2Up) |
| **Secondary Orca Whirlpool (`USDC / toroSOL`, `ts=64`, `0.30%` fee)** | [`559rsvoXtSiwdXZJX6rYhvanz7frfrCb7V1HHSfEXAd3`](https://www.geckoterminal.com/solana/pools/559rsvoXtSiwdXZJX6rYhvanz7frfrCb7V1HHSfEXAd3) |
| **Orca `WhirlpoolsConfig` (25% Protocol Fee Rake)** | [`2JFwRaPCGHEaMKBqHWzAx4bZS8ZRQ9GohUzG3fKYB52Z`](https://solscan.io/account/2JFwRaPCGHEaMKBqHWzAx4bZS8ZRQ9GohUzG3fKYB52Z) |

- **Live On-Chain Receipts**: [`RECEIPTS.md`](./RECEIPTS.md) · [`receipts.json`](./receipts.json) (verifiable slot, NAV, validator stake accounts, burn totals & Solscan tx proofs)
- **Trade on Jupiter**: [jup.ag/swap/SOL-Gmd2K22WVRjhMH7eFfAWNa2y782zKSgHcgd8Gd457Mzt](https://jup.ag/swap/SOL-Gmd2K22WVRjhMH7eFfAWNa2y782zKSgHcgd8Gd457Mzt)
- **Live Charts (GeckoTerminal)**: [toroSOL / SOL](https://www.geckoterminal.com/solana/pools/3m5V1UfeYiFUiMRQxvdZQv6kktUcSCHzbMa4HsVSt2Up) · [toroSOL / USDC](https://www.geckoterminal.com/solana/pools/559rsvoXtSiwdXZJX6rYhvanz7frfrCb7V1HHSfEXAd3)

---

## Delegation and withdrawals

toroSOL targets all stake the pool can deploy to Holosol. At finalized slot 475094487 in epoch 1099, 2.913065512 SOL was activating toward Holosol and 4.001173602 SOL on the previous Helius vote account was deactivating. The reserve held 0.002282880 SOL, equal to the stake account’s recorded rent reserve. After cooldown, the operator can move the returned stake to Holosol. [Holosol delegation transaction](https://solscan.io/tx/24R735aJT8xbmDhPDpBHiGenJrWS4KMZ8vgxrtEuVWFG6R4a9AsohPWDxMt4QHPH7Ysg7q4TUrvhogCvjF6KHtWH)

NAV includes pool stake during activation and cooldown. A native `WithdrawSol` must fit the reserve available after rent when the transaction executes. Deposits and cooled-down stake can replenish that reserve. A swap on Orca uses the market’s own liquidity and price. The keeper reserves deployable SOL for delegation. Rent and amounts too small to delegate remain in the reserve without a fixed liquidity cushion.

## How the Flywheel Works

```
                 +-----------------------------------+
                 |   Sanctum Stake Pool (SP12tWFx)   |
                 |  - WithdrawSol within available reserve|
                 |  - Holosol validator delegation |
                 |  - NAV = totalLamports / supply   |
                 +-----------------+-----------------+
                                   |
          Mint at NAV (0% dep fee) | Burn swept T22 fees -> NAV strictly UP
                                   v
+------------------------+   +-----+------------------+   +----------------------+
|  USDC / toroSOL Pool   |<->|   SOL / toroSOL Pool   |<->|  External MEV Arbers |
|  ts=64, 0.30%, ±11%    |   |  ts=8, 0.30%, ~1T L    |   |  & Organic Traders   |
|  Zero-bait SOL/USD arb |   |  Autonomous Matador    |   |  (Jupiter / Sanctum) |
+------------------------+   +------------------------+   +----------------------+
```

1. **Monotonically Rising SOL-Backed Floor (NAV)**:
   - Every transfer/swap of `toroSOL` withholds a **2.00% Token-2022 transfer fee**.
   - The keeper (`src/03_keeper_service.ts`) atomically sweeps withheld fees, burns `toroSOL` directly from circulating supply via `BurnChecked`, and cranks `UpdateValidatorListBalance` + `UpdateStakePoolBalance` in a single ~51k-CU transaction — permanently raising the SOL backing per `toroSOL`.
   - Effective delegated stake can earn Solana staking rewards. Activation and cooldown follow epoch boundaries.
2. **Self-Tuning Matador CLMM Engine (`src/03_keeper_service.ts`)**:
   - **Atomic 2-RPC Tick Snapshot**: Batches all core accounts (both Orca pools, positions, StakePool, ValidatorList, ReserveStake, Token-2022 mint, wallet balances, and Orca's canonical `SOL/USDC` oracle) into a single `getMultipleAccountsInfo` call + `getEpochInfo`.
   - **1-TX Atomic Walk + Anchor + `t=0s` Trigger**: Uses Orca Dynamic Tick Arrays (`148 B`) + `reposition_liquidity_v2` + `0.01-bp` `priceToSqrtPriceX64` precision + an in-tx `0.00005 SOL` live-curve `swap_v2` event trigger (with `+2.5s` wakeup ping fallback) to induce Sanctum-aware arber bots consistently.
   - **Zero-Loss Capital Recycling**: Reserve-capped 1-TX `LP -> SOL -> Higher-L` rebalancer (eligible only when the remaining reserve is below the size of another delegation), external-sell bid-wall principal shield, and passive OOR auto-recentering for `USDC/toroSOL`.
   - **Simulation-First Safety**: Every transaction simulates with `sigVerify: true` before broadcast (`src/tx.ts`), with automatic RPC failover and a high-water equity circuit breaker.

---

## Repository Layout

| File | Purpose |
|---|---|
| `src/config.ts` | Program IDs, env-backed RPC/API config, deployment state persistence |
| `src/sanctum.ts` | Zero-dependency `SP12tWFx` StakePool + Token-2022 TransferFee & Burn builders/parsers |
| `src/whirlpool.ts` | Zero-dependency Orca Whirlpool v2 (`DynamicTickArray`, `reposition_liquidity_v2`, `swap_v2`, CLMM math) |
| `src/tx.ts` | Mandatory `sigVerify: true` simulation gate, fast polling + rebroadcast confirmation |
| `src/01_deploy_lst.ts` | Deploy Token-2022 mint + Sanctum Stake Pool + initial SOL backing |
| `src/02_deploy_orca_pool.ts` | Deploy primary `SOL/toroSOL` Orca Whirlpool (`ts=8`, 25% protocol rake) |
| `src/05_deploy_usdc_pool.ts` | Deploy secondary `USDC/toroSOL` Orca Whirlpool (`ts=64`, 25% protocol rake) |
| `src/03_keeper_service.ts` | 24/7 autonomous dual-pool Matador keeper daemon |
| `src/04_knobs.ts` | Live cockpit CLI (`status`, `harvest-burn`, `collect-fees`, `set-orca-fee`, `set-uri`, `jup-check`) |
| `src/06_receipts.ts` | Live on-chain proof generator (`bun run receipts` -> `RECEIPTS.md` + `receipts.json`) |
| `RECEIPTS.md` / `receipts.json` | Independently verifiable mainnet receipts (NAV, validator stake accounts, burn count, Solscan tx links) |
| `toro.json` | Token-2022 off-chain metadata JSON |

---

## Quick Start

```bash
cp .env.example .env
# Populate RPC_URL, BACKUP_RPC_URL, JUPITER_API_KEY, and keypair paths in .env
bun install

# Live full-stack dashboard
bun run knobs status

# Dry-run keeper tick (simulates without broadcasting)
DRY_RUN=1 bun run keeper --once

# Run 24/7 live keeper
bun run keeper
```

## License

MIT
