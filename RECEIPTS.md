# toroSOL On-Chain Receipts

Independently verifiable Solana mainnet proof snapshot generated directly from live RPC state at **slot `473857776`** (`2026-11-25T19:07:46.764Z`).
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
| **On-Chain NAV Floor** | **`1.199290 SOL / toroSOL`** (**`+19.93%`** in SOL since `1.000000` launch) |
| **Total SOL Backing (TVL)** | `5.330908 SOL` (`1.3292 SOL` instant ReserveStake + `4.0033 SOL` Helius 0% staked) |
| **Circulating Supply** | `4.445054 toroSOL` |
| **Total Permanently Burned** | **`1.0708 toroSOL`** (`0.9838` keeper + `0.0870` init) |
| **Epoch & Helius Yield ETA** | Epoch `1096` (`89.3%`) · Epoch `1097` in `~5.1h` |
| **Matador Arb Engine** | `228 waves · 212 sniped / 8 unsniped (96.4% all-time)` |

### Native Helius 0% Validator Stake Accounts

| Validator | Validator Stake Account (VSA) | VSA Balance | Transient Stake Account (TSA) | TSA Balance |
|---|---|---|---|---|
| Helius 0% (`he1iusun...`) | [`J7AQFxiEN6nhxTuNxhk5TywUtjakt3DkGGsRG2Bg4ZMa`](https://solscan.io/account/J7AQFxiEN6nhxTuNxhk5TywUtjakt3DkGGsRG2Bg4ZMa) | `1.0017 SOL` (act epoch 1096) | [`EJM8gotcWQGMtgycfec1fEc2HY5zBQui2MZD9fiMEqhS`](https://solscan.io/account/EJM8gotcWQGMtgycfec1fEc2HY5zBQui2MZD9fiMEqhS) | `3.0017 SOL` (act epoch 1096) |

---

## 3. Dual Concentrated Orca Whirlpools

| Pool | Address | Live Spot | Depth (Bid / Ask) | Liquidity (`L`) | Fees |
|---|---|---|---|---|---|
| **SOL / toroSOL** (`ts=8`) | [`3m5V1UfeYiFUiMRQxvdZQv6kktUcSCHzbMa4HsVSt2Up`](https://www.geckoterminal.com/solana/pools/3m5V1UfeYiFUiMRQxvdZQv6kktUcSCHzbMa4HsVSt2Up) | `1.227151 SOL` (`+2.32%` vs NAV) | `3.1315 SOL / 0.7862 toroSOL` | `1028.4B` | `0.30%` (`25%` proto rake) |
| **USDC / toroSOL** (`ts=64`) | [`559rsvoXtSiwdXZJX6rYhvanz7frfrCb7V1HHSfEXAd3`](https://www.geckoterminal.com/solana/pools/559rsvoXtSiwdXZJX6rYhvanz7frfrCb7V1HHSfEXAd3) | `$85.46` (SOL `$69.92`) | `$38.61 USDC / 0.169 toroSOL` | `1676068152` | `0.30%` (`25%` proto rake) |

---

## 4. Recent Confirmed Mainnet Transactions (Live Proof)

| UTC Timestamp | Action | On-Chain Result | Solscan Receipt |
|---|---|---|---|
| `2026-11-25 19:06:15 UTC` | `collect:lp+proto(est=0.00402+redeem=0.051)` | collect:lp+proto(est=0.00402+redeem=0.051) | [`P32crSPW48s6x1...`](https://solscan.io/tx/P32crSPW48s6x1rQtFz78KSfWCxf8jU5m1o4TQtxDzw9YgZt6WwnR9s3CX2qxMPNiSSMm6b4vm1aqT6iyzpG9C1) |
| `2026-11-25 19:06:12 UTC` | `rebalance:atomic-lp-to-sol-boost` | L 744B→1028B · recycled 0.536 toroSOL -> +0.64 SOL | [`5HJ5AjZZrhkf7K...`](https://solscan.io/tx/5HJ5AjZZrhkf7K3ZpLHv6dwXEQ5kUmQmgcFLBjdDkE9Gb5eEr6sySTbRNGUKa4MRhkDnws17YmYTCuddCEG6onEi) |
| `2026-11-25 19:06:09 UTC` | `rebalance:withdraw-idle-toro` | idle toroSOL -> SOL | [`5cTekdTXj2yUpK...`](https://solscan.io/tx/5cTekdTXj2yUpKDkDd8Kw55nbT6mnyxB2NpjcCtwg11Yd7QBoYghxQwumgFgMptHP8amWyopvTFc7akBFJgapnSA) |
| `2026-11-25 19:06:02 UTC` | `muleta:1tx-walk+anchor[-2088,-1992]` | Wave #228 · 1.22722 -> 1.22881 · L=744B | [`Gz24VSbYih8ucg...`](https://solscan.io/tx/Gz24VSbYih8ucgxM8RevvExU5nNfy2CePqtirGw5Q9yA6V9Hu2Guyf9rzMsjkiT2k5zQez7LjWDzbfoz98YLgjz) |
| `2026-11-25 19:03:57 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00927 / burned 0.00046 toroSOL · NAV 1.199065 → 1.199182 | [`39MpwdLmGh5DAL...`](https://solscan.io/tx/39MpwdLmGh5DALCBqfpMrEvnQh7MxVyU4cTS8gA2HFyASa6MhMuTDbSFyio6cqtgPdrK2Gqh3p75ZZqEGHMVBzHE) |
| `2026-11-25 19:03:53 UTC` | `muleta:1tx-walk+anchor[-2072,-1992]` | Wave #227 · 1.22711 -> 1.22869 · L=836B | [`4VCamB6GQoyot5...`](https://solscan.io/tx/4VCamB6GQoyot5q8P5BDkBf2LWDbGbo6nFFZDAHe1BFqQpqwtNRuFEAX83HrjB9KPeboyE8goWwAC5TmgMRKrRLP) |
| `2026-11-25 19:01:58 UTC` | `rebalance:atomic-lp-to-sol-boost` | L 794B→1122B · recycled 0.572 toroSOL -> +0.69 SOL | [`dcNXCnLYUnnrCE...`](https://solscan.io/tx/dcNXCnLYUnnrCEwEqiEcDxmYaPniEzTd1WKC2RPoyBjK9LGP9HvQjKJaikY7r3bYRvHhjZYns61vphVvfnvJa6d) |
| `2026-11-25 19:01:55 UTC` | `rebalance:withdraw-idle-toro` | redeemed 0.2475 idle toroSOL -> SOL | [`33d6m4do3rSLdM...`](https://solscan.io/tx/33d6m4do3rSLdMDtYvgPNegugMcGBND2PXDTzxGca6r3qbjiBRiD3WLbUKe9J7ssXM4jdxqDYXf8HQMK3WfwQ1Tj) |
| `2026-11-25 19:01:52 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00877 / burned 0.00044 toroSOL · NAV 1.198962 → 1.199065 | [`5HotYGA4aLCVzX...`](https://solscan.io/tx/5HotYGA4aLCVzX3K7hrvz5qHTovKKBYNoUGy7Ni4SKJAhVnowq8DEUzP4ieFx5YHSxxYiX2v3obXZJDCbYcyUq9g) |
| `2026-11-25 19:01:48 UTC` | `muleta:1tx-walk+anchor[-2080,-1992]` | Wave #226 · 1.22699 -> 1.22858 · L=794B | [`2hn4XGgfE6hr6L...`](https://solscan.io/tx/2hn4XGgfE6hr6LKhVD3bDUqqmPuFPtd5hExMqTMTmuv5F4sKu2E4EMM8oS733P7Tq1cJs4nXqDTTmCUFP7e6LPEP) |
| `2026-11-25 19:01:06 UTC` | `collect:lp+proto(est=0.00334)` | collect:lp+proto(est=0.00334) | [`4ipFKhrJaan5Sb...`](https://solscan.io/tx/4ipFKhrJaan5SbDD5PZjXfKrxPGz3UFMVb9yob3PhweyakBx4VhHQv3Qy7CyBeA6BncnrnuHCyL3QinjEnFeaQHt) |
| `2026-11-25 18:59:42 UTC` | `rebalance:withdraw-idle-toro` | redeemed 0.2625 idle toroSOL -> SOL | [`5jqCMj9yc3gw6G...`](https://solscan.io/tx/5jqCMj9yc3gw6GbN1iXSPbaRZ8rEUTsuxqsTp3YN66JRGLvFTdkj4MEz5smj47t7sMrmQj6AZ26yzjXtfiHwbrQ6) |
| `2026-11-25 18:59:39 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00943 / burned 0.00047 toroSOL · NAV 1.198847 → 1.198962 | [`5hmg8VSHtgsELK...`](https://solscan.io/tx/5hmg8VSHtgsELKKyY4uGwBuxpYcLXmNQtXP7cHUJ2r6vF5hedugk3Nj6EKzUoyQnAy9y65NkYKNCedHqRyJSg6cT) |
| `2026-11-25 18:59:35 UTC` | `muleta:1tx-walk+anchor[-2072,-1992]` | Wave #225 · 1.22688 -> 1.22847 · L=850B | [`4KPiG1Pe2fmxg6...`](https://solscan.io/tx/4KPiG1Pe2fmxg6q6eDWc6JP2qdNgYf6SwH5oRfmr4e6nkw3TJisrcGJ3jneXnRuJMPEcj2oN2yPYqt6WBJJdStXC) |
| `2026-11-25 18:57:29 UTC` | `rebalance:atomic-lp-to-sol-boost` | L 834B→1085B · recycled 0.601 toroSOL -> +0.72 SOL | [`3dAwVAyVL8omjP...`](https://solscan.io/tx/3dAwVAyVL8omjP8Z9N6gpLdJ9JwDC8ijtaK3RpQgc8GmgSUyKPwWdDjFiYpLArgFZAeoL394AyLHbroxpwRutwUS) |

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
