# toroSOL On-Chain Receipts

Independently verifiable Solana mainnet proof snapshot generated directly from live RPC state at **slot `473913370`** (`2026-11-25T22:26:57.320Z`).
Machine-readable JSON: [`receipts.json`](./receipts.json).

---

## 1. Immutable Backing & Security Invariants

| Proof | Verified On-Chain Value | Link |
|---|---|---|
| **Stake Pool Program** | `SP12tWFxD9oJsVWNavTTBZvMbA6gkAmxtVgxdqvyvhY` (unmodified Sanctum SPL Stake Pool) | [Solscan](https://solscan.io/account/SP12tWFxD9oJsVWNavTTBZvMbA6gkAmxtVgxdqvyvhY) |
| **Stake Pool Account** | `3X1zrKG6mkWPrbKNuBckNEwUKeQkEB3FEcbSAUdzzAfp` | [Solscan](https://solscan.io/account/3X1zrKG6mkWPrbKNuBckNEwUKeQkEB3FEcbSAUdzzAfp) |
| **Token-2022 Mint** | `Gmd2K22WVRjhMH7eFfAWNa2y782zKSgHcgd8Gd457Mzt` | [Solscan](https://solscan.io/token/Gmd2K22WVRjhMH7eFfAWNa2y782zKSgHcgd8Gd457Mzt) |
| **Mint Authority** | `yGRadR1WvSvozEPdJ318qvABDZ4nY1aAg1eovx6ia8k` (Sanctum withdraw-authority PDA; only SOL deposits mint) | [Solscan](https://solscan.io/account/yGRadR1WvSvozEPdJ318qvABDZ4nY1aAg1eovx6ia8k) |
| **Freeze Authority** | `None (permanently revoked)` | Verifiable via `spl-token display` |
| **Token-2022 Transfer Fee** | `200 bps` (`2.00%`) | Swept & burned on-chain |
| **Stake Pool Deposit / Epoch Fee** | `0/10000` deposit · `0/100` epoch · `50/10000` withdrawal | Live StakePool state |

---

## 2. Live SOL Backing & Monotonic NAV Floor

| Metric | Live Mainnet Value |
|---|---|
| **On-Chain NAV Floor** | **`1.210546 SOL / toroSOL`** (**`+21.05%`** in SOL since `1.000000` launch) |
| **Total SOL Backing (TVL)** | `5.970160 SOL` (`1.9702 SOL` instant ReserveStake + `4.0017 SOL` Helius 0% staked) |
| **Circulating Supply** | `4.931792 toroSOL` |
| **Total Permanently Burned** | **`1.1212 toroSOL`** (`1.0342` keeper + `0.0870` init) |
| **Epoch & Helius Yield ETA** | Epoch `1097` (`2.2%`) · Epoch `1098` in `~47.0h` |
| **Matador Arb Engine** | `303 waves · 287 sniped / 8 unsniped (97.3% all-time)` |

### Native Helius 0% Validator Stake Accounts

| Validator | Validator Stake Account (VSA) | VSA Balance | Transient Stake Account (TSA) | TSA Balance |
|---|---|---|---|---|
| Helius 0% (`he1iusun...`) | [`J7AQFxiEN6nhxTuNxhk5TywUtjakt3DkGGsRG2Bg4ZMa`](https://solscan.io/account/J7AQFxiEN6nhxTuNxhk5TywUtjakt3DkGGsRG2Bg4ZMa) | `4.0017 SOL` (act epoch 1096) | [`EJM8gotcWQGMtgycfec1fEc2HY5zBQui2MZD9fiMEqhS`](https://solscan.io/account/EJM8gotcWQGMtgycfec1fEc2HY5zBQui2MZD9fiMEqhS) | `0.0000 SOL` (act epoch n/a) |

---

## 3. Dual Concentrated Orca Whirlpools

| Pool | Address | Live Spot | Depth (Bid / Ask) | Liquidity (`L`) | Fees |
|---|---|---|---|---|---|
| **SOL / toroSOL** (`ts=8`) | [`3m5V1UfeYiFUiMRQxvdZQv6kktUcSCHzbMa4HsVSt2Up`](https://www.geckoterminal.com/solana/pools/3m5V1UfeYiFUiMRQxvdZQv6kktUcSCHzbMa4HsVSt2Up) | `1.238869 SOL` (`+2.34%` vs NAV) | `3.1784 SOL / 0.4703 toroSOL` | `1057.3B` | `0.30%` (`25%` proto rake) |
| **USDC / toroSOL** (`ts=64`) | [`559rsvoXtSiwdXZJX6rYhvanz7frfrCb7V1HHSfEXAd3`](https://www.geckoterminal.com/solana/pools/559rsvoXtSiwdXZJX6rYhvanz7frfrCb7V1HHSfEXAd3) | `$86.46` (SOL `$70.32`) | `$41.47 USDC / 0.1357 toroSOL` | `1676068152` | `0.30%` (`25%` proto rake) |

---

## 4. Recent Confirmed Mainnet Transactions (Live Proof)

| UTC Timestamp | Action | On-Chain Result | Solscan Receipt |
|---|---|---|---|
| `2026-11-25 22:26:12 UTC` | `rebalance:atomic-lp-to-sol-boost` | L 817B→1057B · recycled 0.586 toroSOL -> +0.71 SOL | [`2LJEAXgsUpueuN...`](https://solscan.io/tx/2LJEAXgsUpueuNhcknkQE3q6H5n29o6U3t9tzkDXnyKcnMb6unmtkPfvB7HM57kUhUnNQs6bpjvZmrjr7PsuVhgu) |
| `2026-11-25 22:26:09 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00899 / burned 0.00045 toroSOL · NAV 1.210447 → 1.210546 | [`RQnrx5XGTCUbGf...`](https://solscan.io/tx/RQnrx5XGTCUbGfKgjJcMJQVjDmnsP8bV8ecng26EEVUbarmFjfyJUUod6Cvysq37on9iorXsc6TKJzRBmcemdkh) |
| `2026-11-25 22:26:05 UTC` | `muleta:1tx-walk+anchor[-2176,-2088]` | Wave #303 · 1.23876 -> 1.24035 · L=817B | [`3nBzgbLG8s2gNR...`](https://solscan.io/tx/3nBzgbLG8s2gNRMTDY9F9atnYfsEQtngJKf8PK2WPSwCTRAiseZTa2kMGTXGuX6ogeex1By4U5BogcKtQKdT9WjN) |
| `2026-11-25 22:24:00 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00849 / burned 0.00042 toroSOL · NAV 1.210346 → 1.210447 | [`3sB36BUfvCZyie...`](https://solscan.io/tx/3sB36BUfvCZyieqfc69aAH1F2CCayPidYoi42qCFrb8sSY7b28KAZ3yfokFCzDkQtvy8PWkWTQmyH98XHhskSGEZ) |
| `2026-11-25 22:23:57 UTC` | `muleta:1tx-walk+anchor[-2168,-2088]` | Wave #302 · 1.23868 -> 1.24025 · L=771B | [`BYh4f9KTjFfiWv...`](https://solscan.io/tx/BYh4f9KTjFfiWvcZ5urhEfctoqjxAdQxkAnwPjiVYKLEYnistEFDhhDUSTLghG8g9UemXzhY96WaS7UJpjJhdr8) |
| `2026-11-25 22:22:17 UTC` | `collect:lp+proto(est=0.00247+redeem=0.138)` | collect:lp+proto(est=0.00247+redeem=0.138) | [`5hP4pJyXSkP4et...`](https://solscan.io/tx/5hP4pJyXSkP4etf3idzo2VkxsDfg6FrmKU9Sqqm6DtWYihjrvVDL351oU11KJDgAJwC5nnvQCoiYKauGszw8AYSj) |
| `2026-11-25 22:21:22 UTC` | `rebalance:atomic-lp-to-sol-boost` | L 714B→992B · recycled 0.768 toroSOL -> +0.93 SOL | [`3dsL5nuQwdmXMK...`](https://solscan.io/tx/3dsL5nuQwdmXMKncF5Fb3orBoJWx3juEA3XKQjeptYkjATo61mA3hS1YVqBJ45U5UsmNkPJjYLCmakw8k19xo1q4) |
| `2026-11-25 22:21:18 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00787 / burned 0.00039 toroSOL · NAV 1.210260 → 1.210346 | [`27hZsypoGkpe5p...`](https://solscan.io/tx/27hZsypoGkpe5pQoZvj7yE72rX8cNsaEMHspiKwo18S7TabjofY7Kps75aMsm1xXbAPPYukSZMc1bLv5myM94zCH) |
| `2026-11-25 22:21:14 UTC` | `muleta:1tx-walk+anchor[-2184,-2080]` | Wave #301 · 1.23857 -> 1.24016 · L=714B | [`5ZidP9gyKnxYbi...`](https://solscan.io/tx/5ZidP9gyKnxYbidcYgx45vrkhMuY486EMD4WTJ485RZJJw8UZYGq8JB73EWBbTeT2Ab7393yeuCkPyGjEi8ideoW) |
| `2026-11-25 22:19:09 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00892 / burned 0.00045 toroSOL · NAV 1.210156 → 1.210260 | [`41PH5R5SiL15Nd...`](https://solscan.io/tx/41PH5R5SiL15Ndx9AdFdrUVqHZrihDALzPPSUHsyi5yVPE2e7xTB14VhaLGcv4F8D64Y7EkYdPM3wV4nvzQefMkM) |
| `2026-11-25 22:19:05 UTC` | `muleta:1tx-walk+anchor[-2168,-2080]` | Wave #300 · 1.23848 -> 1.24006 · L=808B | [`32C5nh9zEr91zB...`](https://solscan.io/tx/32C5nh9zEr91zBt43P95WhsMpBvtf2d1WFYffuaGoZNog7uugi5nRBKMCC75miXctumcQbSfNC7mfeGnRqMfpTUJ) |
| `2026-11-25 22:17:12 UTC` | `collect:lp+proto(est=0.00343+redeem=0.077)` | collect:lp+proto(est=0.00343+redeem=0.077) | [`mmUGuzcSdJ6xj8...`](https://solscan.io/tx/mmUGuzcSdJ6xj8dAUgh9frHbRWg32FaeW8EebuxE7bAqSiwHGpbT6CAMTkxsfyPVxpDQAocXChUr6tycbTtozdw) |
| `2026-11-25 22:17:08 UTC` | `rebalance:atomic-lp-to-sol-boost` | L 709B→1013B · recycled 0.509 toroSOL -> +0.62 SOL | [`56sQpVGFL3NW1U...`](https://solscan.io/tx/56sQpVGFL3NW1Uer5FRa4HJgPgDmF5CqwiFW5gbWNcfuJuQCm4CQSXgz9YdvFA7xZJnwqAKMCS5YShH3NMf9z4gY) |
| `2026-11-25 22:17:05 UTC` | `rebalance:withdraw-idle-toro` | redeemed 0.3025 idle toroSOL -> SOL | [`2ezRV1mfWzEkYv...`](https://solscan.io/tx/2ezRV1mfWzEkYvquNG3N3t3zzK3EdmTCtjvnCJPF1LrkydXxVGz7ooGykukW9LuCD3JtD7MBN7qjPGZrLMsEQQfE) |
| `2026-11-25 22:17:02 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00783 / burned 0.00039 toroSOL · NAV 1.210072 → 1.210156 | [`3ZevtJ8FxLRgya...`](https://solscan.io/tx/3ZevtJ8FxLRgyavbNiPbKrCWnUoSkkERbxq1yKq5w9mBxEAfn2XmCkXBieRGee63EQchMCEoBCi4foDbes6xfqk7) |

---

## 5. Verify Independently in 5 Seconds (No Trust Required)

```bash
# 1. Verify Stake Pool is owned by unmodified Sanctum SP12tWFx program
solana account 3X1zrKG6mkWPrbKNuBckNEwUKeQkEB3FEcbSAUdzzAfp

# 2. Verify Token-2022 Mint has freezeAuthority = None and mintAuthority = Sanctum PDA
spl-token display Gmd2K22WVRjhMH7eFfAWNa2y782zKSgHcgd8Gd457Mzt --program-2022

# 3. Verify live Helius 0% stake accounts directly on-chain
solana stake-account J7AQFxiEN6nhxTuNxhk5TywUtjakt3DkGGsRG2Bg4ZMa
solana stake-account EJM8gotcWQGMtgycfec1fEc2HY5zBQui2MZD9fiMEqhS

# 4. Re-generate this exact receipt file against your own Solana RPC
bun run receipts
```
