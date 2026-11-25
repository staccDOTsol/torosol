# toroSOL On-Chain Receipts

Independently verifiable Solana mainnet proof snapshot generated directly from live RPC state at **slot `473905174`** (`2026-11-25T21:57:28.502Z`).
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
| **On-Chain NAV Floor** | **`1.209213 SOL / toroSOL`** (**`+20.92%`** in SOL since `1.000000` launch) |
| **Total SOL Backing (TVL)** | `6.781439 SOL` (`2.7814 SOL` instant ReserveStake + `4.0017 SOL` Helius 0% staked) |
| **Circulating Supply** | `5.608143 toroSOL` |
| **Total Permanently Burned** | **`1.1152 toroSOL`** (`1.0282` keeper + `0.0870` init) |
| **Epoch & Helius Yield ETA** | Epoch `1097` (`0.3%`) · Epoch `1098` in `~47.9h` |
| **Matador Arb Engine** | `289 waves · 273 sniped / 8 unsniped (97.2% all-time)` |

### Native Helius 0% Validator Stake Accounts

| Validator | Validator Stake Account (VSA) | VSA Balance | Transient Stake Account (TSA) | TSA Balance |
|---|---|---|---|---|
| Helius 0% (`he1iusun...`) | [`J7AQFxiEN6nhxTuNxhk5TywUtjakt3DkGGsRG2Bg4ZMa`](https://solscan.io/account/J7AQFxiEN6nhxTuNxhk5TywUtjakt3DkGGsRG2Bg4ZMa) | `4.0017 SOL` (act epoch 1096) | [`EJM8gotcWQGMtgycfec1fEc2HY5zBQui2MZD9fiMEqhS`](https://solscan.io/account/EJM8gotcWQGMtgycfec1fEc2HY5zBQui2MZD9fiMEqhS) | `0.0000 SOL` (act epoch n/a) |

---

## 3. Dual Concentrated Orca Whirlpools

| Pool | Address | Live Spot | Depth (Bid / Ask) | Liquidity (`L`) | Fees |
|---|---|---|---|---|---|
| **SOL / toroSOL** (`ts=8`) | [`3m5V1UfeYiFUiMRQxvdZQv6kktUcSCHzbMa4HsVSt2Up`](https://www.geckoterminal.com/solana/pools/3m5V1UfeYiFUiMRQxvdZQv6kktUcSCHzbMa4HsVSt2Up) | `1.237604 SOL` (`+2.35%` vs NAV) | `2.3691 SOL / 1.4112 toroSOL` | `712.4B` | `0.30%` (`25%` proto rake) |
| **USDC / toroSOL** (`ts=64`) | [`559rsvoXtSiwdXZJX6rYhvanz7frfrCb7V1HHSfEXAd3`](https://www.geckoterminal.com/solana/pools/559rsvoXtSiwdXZJX6rYhvanz7frfrCb7V1HHSfEXAd3) | `$86.46` (SOL `$70.63`) | `$41.47 USDC / 0.1357 toroSOL` | `1676068152` | `0.30%` (`25%` proto rake) |

---

## 4. Recent Confirmed Mainnet Transactions (Live Proof)

| UTC Timestamp | Action | On-Chain Result | Solscan Receipt |
|---|---|---|---|
| `2026-11-25 21:57:28 UTC` | `muleta:1tx-walk+anchor[-2176,-2072]` | Wave #290 · 1.23750 -> 1.23909 · L=712B | [`E9i4EqU1GR7ebk...`](https://solscan.io/tx/E9i4EqU1GR7ebku9pxydFNrJbXzxuCWq6pt6fBmWQRuunVWBVpmwd9i4fdnR2vmAAZAvsLRNMrhBmTkdzczZRXp) |
| `2026-11-25 21:55:33 UTC` | `collect:lp+proto(est=0.00374+redeem=0.078)` | collect:lp+proto(est=0.00374+redeem=0.078) | [`3yWaCXcJHbsMAu...`](https://solscan.io/tx/3yWaCXcJHbsMAurEUDR4oRtPZCbbzF6d3kfDT6WZJSDEvNHc4JDjzTfChvh1BFjgJ5KCqAHsBQsn9VAqmY46Sjri) |
| `2026-11-25 21:55:28 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00902 / burned 0.00045 toroSOL · NAV 1.209110 → 1.209213 | [`2Ey2VStQT5BuGb...`](https://solscan.io/tx/2Ey2VStQT5BuGb9McFv9p1RxqfcGRFwiw4q8Jzki2J6GjAkS8pz7ABBq74hbWGfA47Bu7NzLNWeMcCzdod1qv93e) |
| `2026-11-25 21:55:22 UTC` | `muleta:1tx-walk+anchor[-2160,-2072]` | Wave #289 · 1.23741 -> 1.23898 · L=817B | [`37fQn5AhW95hLd...`](https://solscan.io/tx/37fQn5AhW95hLdrx7xKVRh1HmkrhTXjnPpH1znABQwwTJFkNEw3AcjDJhPjYysBEosbbgb4RtfGzQrxFejMFW2kz) |
| `2026-11-25 21:55:19 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00000 / burned 0.00000 toroSOL · NAV 1.209110 → 1.209110 | [`5RiUpZqwmJ8rFA...`](https://solscan.io/tx/5RiUpZqwmJ8rFA4cj9fs9TmpJi4w1nN65SuQFFayrVT4y4mk9AW3pfAj73fffekw878ZkKbAEaURZczApYhbu9e2) |
| `2026-11-25 21:52:02 UTC` | `rebalance:atomic-lp-to-sol-boost` | L 716B→1014B · recycled 0.771 toroSOL -> +0.93 SOL | [`3FGqSBHmmBHCdZ...`](https://solscan.io/tx/3FGqSBHmmBHCdZhbTg57jNBGG27U833G1My2pPtPsjBGyiD4Xf8rmPo5b2dprPdpiHvG1f6xtmeXgkozmuHMYuxb) |
| `2026-11-25 21:51:58 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00790 / burned 0.00040 toroSOL · NAV 1.209025 → 1.209110 | [`5hxnx3NiHLxjXA...`](https://solscan.io/tx/5hxnx3NiHLxjXAMoU5LmbL4wU2HJd14EhdX6r5WKjXybAA3hiwPLuFKbVEpwq5tpeTu1PSBXGgU4NQ5PFHwfs1zk) |
| `2026-11-25 21:51:55 UTC` | `muleta:1tx-walk+anchor[-2176,-2072]` | Wave #288 · 1.23737 -> 1.23890 · L=716B | [`5NgLwDfMsvQ1nG...`](https://solscan.io/tx/5NgLwDfMsvQ1nG4RrQxwhovbm2EYMxQSNCxHEY18HqBPgvxfShSsxnPRd9r7gYvDnsbwm1F2RGZsuXh9AgfCbA8t) |
| `2026-11-25 21:49:50 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00852 / burned 0.00043 toroSOL · NAV 1.208927 → 1.209025 | [`5TmYGe6WW7mPRL...`](https://solscan.io/tx/5TmYGe6WW7mPRL9ryKtXvz8D4EFkJb5TKy8W3MBsndD7idoRjG6YHQLgPod7kgpvqmvNf5FCZFfbwobg9eeM5a1c) |
| `2026-11-25 21:49:46 UTC` | `muleta:1tx-walk+anchor[-2160,-2072]` | Wave #287 · 1.23720 -> 1.23880 · L=803B | [`3aXMU2JNZ4vZqV...`](https://solscan.io/tx/3aXMU2JNZ4vZqVfafjhH9U3W4at5giuK8pDV29cDkxT1gTLRZKsjjPkSsCzDpaufZvMULJQoWyRpFzKb4W992dRW) |
| `2026-11-25 21:49:34 UTC` | `collect:lp+proto(est=0.00279+redeem=0.241)` | collect:lp+proto(est=0.00279+redeem=0.241) | [`4FJ5S2wYyA2ddE...`](https://solscan.io/tx/4FJ5S2wYyA2ddE4kdPZgV5Yi3iH4h1Ko5Eoic4YPFg8W9Rg5NS2HWERcqX4GRU51Jv6PyMsNcFcKbS4oajjboKgL) |
| `2026-11-25 21:47:40 UTC` | `rebalance:atomic-lp-to-sol-boost` | L 845B→968B · recycled 0.303 toroSOL -> +0.37 SOL | [`zRE9rUvqBwWcYY...`](https://solscan.io/tx/zRE9rUvqBwWcYYVbicyoC75gSTPQbs3FkJcYV7cyd4Tv3xKJE2vAjs2Yv1MeHH54GuSvYgTZXzE3FWCjmHL9hga) |
| `2026-11-25 21:47:36 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00931 / burned 0.00047 toroSOL · NAV 1.208822 → 1.208927 | [`3AMvTannR22Mva...`](https://solscan.io/tx/3AMvTannR22MvahacriHSVmv9SixNwfYzp1JtxQdiWw7Tw1Tz3f3HBo4UxnXJXdr33R383vEA98D41vY4WytJx3z) |
| `2026-11-25 21:47:33 UTC` | `muleta:1tx-walk+anchor[-2160,-2072]` | Wave #286 · 1.23710 -> 1.23869 · L=845B | [`WHKQToZUC1GxaM...`](https://solscan.io/tx/WHKQToZUC1GxaMqADgcUZrTxpMZv8NzyRiX9pQZgKPXQaXwtjrBtidD66eDRuA2K5a4QYrK5A17RYapSkmZHxzX) |
| `2026-11-25 21:45:28 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00767 / burned 0.00038 toroSOL · NAV 1.208727 → 1.208822 | [`3p5uStG1oJvQPN...`](https://solscan.io/tx/3p5uStG1oJvQPNsxsWuGiaFTWJnRHQ5xPdtSabbCaMy3f5ejm2f9R6kUe4yTvaK9tETKQySVmUBwEceAQad78Zbb) |

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
