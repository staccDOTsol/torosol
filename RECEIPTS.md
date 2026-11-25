# toroSOL On-Chain Receipts

Independently verifiable Solana mainnet proof snapshot generated directly from live RPC state at **slot `473926257`** (`2026-11-25T23:13:22.892Z`).
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
| **On-Chain NAV Floor** | **`1.212081 SOL / toroSOL`** (**`+21.21%`** in SOL since `1.000000` launch) |
| **Total SOL Backing (TVL)** | `5.466406 SOL` (`1.4664 SOL` instant ReserveStake + `4.0017 SOL` Helius 0% staked) |
| **Circulating Supply** | `4.509933 toroSOL` |
| **Total Permanently Burned** | **`1.1280 toroSOL`** (`1.0410` keeper + `0.0870` init) |
| **Epoch & Helius Yield ETA** | Epoch `1097` (`5.2%`) · Epoch `1098` in `~45.5h` |
| **Matador Arb Engine** | `318 waves · 302 sniped / 8 unsniped (97.4% all-time)` |

### Native Helius 0% Validator Stake Accounts

| Validator | Validator Stake Account (VSA) | VSA Balance | Transient Stake Account (TSA) | TSA Balance |
|---|---|---|---|---|
| Helius 0% (`he1iusun...`) | [`J7AQFxiEN6nhxTuNxhk5TywUtjakt3DkGGsRG2Bg4ZMa`](https://solscan.io/account/J7AQFxiEN6nhxTuNxhk5TywUtjakt3DkGGsRG2Bg4ZMa) | `4.0017 SOL` (act epoch 1096) | [`EJM8gotcWQGMtgycfec1fEc2HY5zBQui2MZD9fiMEqhS`](https://solscan.io/account/EJM8gotcWQGMtgycfec1fEc2HY5zBQui2MZD9fiMEqhS) | `0.0000 SOL` (act epoch n/a) |

---

## 3. Dual Concentrated Orca Whirlpools

| Pool | Address | Live Spot | Depth (Bid / Ask) | Liquidity (`L`) | Fees |
|---|---|---|---|---|---|
| **SOL / toroSOL** (`ts=8`) | [`3m5V1UfeYiFUiMRQxvdZQv6kktUcSCHzbMa4HsVSt2Up`](https://www.geckoterminal.com/solana/pools/3m5V1UfeYiFUiMRQxvdZQv6kktUcSCHzbMa4HsVSt2Up) | `1.240448 SOL` (`+2.34%` vs NAV) | `3.1109 SOL / 0.5618 toroSOL` | `950.9B` | `0.30%` (`25%` proto rake) |
| **USDC / toroSOL** (`ts=64`) | [`559rsvoXtSiwdXZJX6rYhvanz7frfrCb7V1HHSfEXAd3`](https://www.geckoterminal.com/solana/pools/559rsvoXtSiwdXZJX6rYhvanz7frfrCb7V1HHSfEXAd3) | `$86.46` (SOL `$70.52`) | `$41.47 USDC / 0.1357 toroSOL` | `1676068152` | `0.30%` (`25%` proto rake) |

---

## 4. Recent Confirmed Mainnet Transactions (Live Proof)

| UTC Timestamp | Action | On-Chain Result | Solscan Receipt |
|---|---|---|---|
| `2026-11-25 23:13:20 UTC` | `rebalance:atomic-lp-to-sol-boost` | L 699B→951B · recycled 0.501 toroSOL -> +0.61 SOL | [`5EpGUbhY9Aj5rN...`](https://solscan.io/tx/5EpGUbhY9Aj5rNZ7godCweqVamJ6nmsDQAhra5XPi5zJAjCwc5pzXRF9cS5nxrzaHzsjAzeCN2q35xDJR4WoobwU) |
| `2026-11-25 23:13:16 UTC` | `rebalance:withdraw-idle-toro` | redeemed 0.1683 idle toroSOL -> SOL | [`24dwxvWHchqoAT...`](https://solscan.io/tx/24dwxvWHchqoATU2tCAwdTBWp1ResiipqqocdxR3rPjKGkNdyruHgPb71EzWfTzgQirefigHgnJegZ7xU1nLKss5) |
| `2026-11-25 23:13:13 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00770 / burned 0.00038 toroSOL · NAV 1.211991 → 1.212081 | [`4tTJSBDVcpNmsP...`](https://solscan.io/tx/4tTJSBDVcpNmsPbDVvoaFAyC1HHycnqbT9eWjWVds3yYwV1UnMDiJfLB4TtdYKmXaP5xAXUdt1FMJoTTQgJZ5keX) |
| `2026-11-25 23:13:09 UTC` | `muleta:1tx-walk+anchor[-2192,-2096]` | Wave #318 · 1.23947 -> 1.24194 · L=699B | [`4UrqLM2F611YnA...`](https://solscan.io/tx/4UrqLM2F611YnAUNSxPwqzoa2ZKGZ9epBCftfxq4TLDc3ayZyB2TbwZgEemXER8C6RxQ3VzU9X45yskQD358fcb9) |
| `2026-11-25 23:13:06 UTC` | `rebalance:refill-native-gas-from-lp` | - | [`3ajPEJiSGLsfy7...`](https://solscan.io/tx/3ajPEJiSGLsfy78kahcHiazZxAduRWd1P1zdxHkco7ew86YTkyaM6ij3m7ZXmLi6r5BnqNVWZiYCmJonee1L6Sk8) |
| `2026-11-25 22:58:48 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00607 / burned 0.00030 toroSOL · NAV 1.211915 → 1.211991 | [`5Tm1SWULrfv6zV...`](https://solscan.io/tx/5Tm1SWULrfv6zVGZJu4crnpyHaMXFKBiCY1XgqDV3G8r1PFP6L4Ww1Psp1hCvkhZGtMDijuNStVZKwzChV8KG1my) |
| `2026-11-25 22:58:07 UTC` | `collect:lp+proto(est=0.00242+redeem=0.064)` | collect:lp+proto(est=0.00242+redeem=0.064) | [`qdu6XDuQa8vBjj...`](https://solscan.io/tx/qdu6XDuQa8vBjjJ3yCKJ3AxGhVkxQ6ysnrJf6FkkreVRh8rcjvmXT69id1jPBztgdN9MFQx2Sy5XGZYQeBgkaFN) |
| `2026-11-25 22:56:32 UTC` | `rebalance:atomic-lp-to-sol-boost` | L 712B→1012B · recycled 0.765 toroSOL -> +0.93 SOL | [`4ndXFgReaPTgBc...`](https://solscan.io/tx/4ndXFgReaPTgBcj4xPV58YD6eMcqX7degF5QQLfGBZ3jhtKKAug26aHGMpryb4CVwfyoppNNgNR8i813abPvUFu5) |
| `2026-11-25 22:56:29 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00784 / burned 0.00039 toroSOL · NAV 1.211830 → 1.211915 | [`GEgW5UveyXuKgP...`](https://solscan.io/tx/GEgW5UveyXuKgPsK7bZo9tntgq4GDQqZJ8MfJToNgCWQNqF7s4JvpdJ1eqzpYczj49ZTZkRhBUMZ7TVjpj5BYfz) |
| `2026-11-25 22:56:25 UTC` | `muleta:1tx-walk+anchor[-2200,-2096]` | Wave #317 · 1.24018 -> 1.24177 · L=712B | [`2UACJvzPeZVeis...`](https://solscan.io/tx/2UACJvzPeZVeis7cReFQ4PJRjB2Cee2JxaJwVRxNEfnLmaPjWou2XQSPXvpdfLiB7jzeQxexGhaNkYGpU3AdXFBx) |
| `2026-11-25 22:54:20 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00864 / burned 0.00043 toroSOL · NAV 1.211731 → 1.211830 | [`wogjX8nr1hsnUY...`](https://solscan.io/tx/wogjX8nr1hsnUYhimTdaf51WZN1nTuewn4JfSwfewGXsii4sumsZDHF9utnQDdKLN96smcxp7oML455CxTk3ZPK) |
| `2026-11-25 22:54:17 UTC` | `muleta:1tx-walk+anchor[-2184,-2096]` | Wave #316 · 1.24008 -> 1.24167 · L=784B | [`4sAFFJYVgZ5LSG...`](https://solscan.io/tx/4sAFFJYVgZ5LSG3pzG1AAfGHDK8NRNPvNAnbWh5JELzwaTepBiMRmTpEfD7JjQyejDJQcUS4RcxhsvgD5mz8UgwA) |
| `2026-11-25 22:53:04 UTC` | `collect:lp+proto(est=0.00256+redeem=0.314)` | collect:lp+proto(est=0.00256+redeem=0.314) | [`5rGbWUW1dfxWDU...`](https://solscan.io/tx/5rGbWUW1dfxWDUbDxr8PUH1QgSMn4FzireCkAEm77yHRxdNMNfJPFwkdiB51gTADpLoMw7mRFYUCugzywJtCxbuC) |
| `2026-11-25 22:52:30 UTC` | `rebalance:atomic-lp-to-sol-boost` | L 818B→939B · recycled 0.294 toroSOL -> +0.36 SOL | [`58bATnnsdKbSxr...`](https://solscan.io/tx/58bATnnsdKbSxrEZ5b6ye5k99F4UUGeVu4PDvq5ssDdqyFgi3brCa1ctabF1baZkyNo97ptpg9ufaCmZPHiMm3EF) |
| `2026-11-25 22:52:07 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00901 / burned 0.00045 toroSOL · NAV 1.211630 → 1.211731 | [`S34WQCttxCfjN1...`](https://solscan.io/tx/S34WQCttxCfjN1U94YySyGa2HAErDHVu4XrJPFSC783mdY6sWDxfYGBZjeiN1jWVd6bE3gES93N5tcuRQPLxwrM) |

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
