# toroSOL On-Chain Receipts

Independently verifiable Solana mainnet proof snapshot generated directly from live RPC state at **slot `473978625`** (`2026-11-26T02:21:00.119Z`).
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
| **On-Chain NAV Floor** | **`1.219823 SOL / toroSOL`** (**`+21.98%`** in SOL since `1.000000` launch) |
| **Total SOL Backing (TVL)** | `5.423598 SOL` (`1.4236 SOL` instant ReserveStake + `4.0017 SOL` Helius 0% staked) |
| **Circulating Supply** | `4.446217 toroSOL` |
| **Total Permanently Burned** | **`1.1600 toroSOL`** (`1.0730` keeper + `0.0870` init) |
| **Epoch & Helius Yield ETA** | Epoch `1097` (`17.3%`) · Epoch `1098` in `~39.7h` |
| **Matador Arb Engine** | `404 waves · 388 sniped / 8 unsniped (98% all-time)` |

### Native Helius 0% Validator Stake Accounts

| Validator | Validator Stake Account (VSA) | VSA Balance | Transient Stake Account (TSA) | TSA Balance |
|---|---|---|---|---|
| Helius 0% (`he1iusun...`) | [`J7AQFxiEN6nhxTuNxhk5TywUtjakt3DkGGsRG2Bg4ZMa`](https://solscan.io/account/J7AQFxiEN6nhxTuNxhk5TywUtjakt3DkGGsRG2Bg4ZMa) | `4.0017 SOL` (act epoch 1096) | [`EJM8gotcWQGMtgycfec1fEc2HY5zBQui2MZD9fiMEqhS`](https://solscan.io/account/EJM8gotcWQGMtgycfec1fEc2HY5zBQui2MZD9fiMEqhS) | `0.0000 SOL` (act epoch n/a) |

---

## 3. Dual Concentrated Orca Whirlpools

| Pool | Address | Live Spot | Depth (Bid / Ask) | Liquidity (`L`) | Fees |
|---|---|---|---|---|---|
| **SOL / toroSOL** (`ts=8`) | [`3m5V1UfeYiFUiMRQxvdZQv6kktUcSCHzbMa4HsVSt2Up`](https://www.geckoterminal.com/solana/pools/3m5V1UfeYiFUiMRQxvdZQv6kktUcSCHzbMa4HsVSt2Up) | `1.248378 SOL` (`+2.34%` vs NAV) | `2.8805 SOL / 0.5301 toroSOL` | `881.8B` | `0.30%` (`25%` proto rake) |
| **USDC / toroSOL** (`ts=64`) | [`559rsvoXtSiwdXZJX6rYhvanz7frfrCb7V1HHSfEXAd3`](https://www.geckoterminal.com/solana/pools/559rsvoXtSiwdXZJX6rYhvanz7frfrCb7V1HHSfEXAd3) | `$86.46` (SOL `$71.47`) | `$41.47 USDC / 0.1357 toroSOL` | `1676068152` | `0.30%` (`25%` proto rake) |

---

## 4. Recent Confirmed Mainnet Transactions (Live Proof)

| UTC Timestamp | Action | On-Chain Result | Solscan Receipt |
|---|---|---|---|
| `2026-11-26 02:19:51 UTC` | `rebalance:atomic-lp-to-sol-boost` | L 624B→882B · recycled 0.669 toroSOL -> +0.82 SOL | [`4Mcm4ySUT36R1k...`](https://solscan.io/tx/4Mcm4ySUT36R1kdQgqtfe5owhm7B4S6beoUNPCpCPbvMrCGjGoDFxWEC8XxihRfriXc5PTEmHynZB2bWkWocQ6h3) |
| `2026-11-26 02:19:48 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00686 / burned 0.00034 toroSOL · NAV 1.219741 → 1.219823 | [`3ub9NkvzrsNxW6...`](https://solscan.io/tx/3ub9NkvzrsNxW6F9mWV5mUnQHdj4t6WU6KpevKJ3ea3hGp8MrEEpujUCqTn7kA2kgzy56o5qpDUZYjanLXP4e6Rp) |
| `2026-11-26 02:19:44 UTC` | `muleta:1tx-walk+anchor[-2264,-2160]` | Wave #404 · 1.24828 -> 1.24988 · L=624B | [`2n2ayujduRRmGV...`](https://solscan.io/tx/2n2ayujduRRmGVxF17p29rtJ6MiZxMQTD62MWZ1s3mwndoC2apL8LShxGFgiKmHDGMoT7tEosKXBUj55gDXbfXoQ) |
| `2026-11-26 02:18:32 UTC` | `collect:lp+proto(est=0.00206+redeem=0.047)` | collect:lp+proto(est=0.00206+redeem=0.047) | [`3SaFDSWc86hM7y...`](https://solscan.io/tx/3SaFDSWc86hM7yEpe6psrwvhxRmLntrLeBB19qJenSQPWXtLDnRqcxoBA31M5pNWJc3585R28iL8qEA8CnZ6VDgG) |
| `2026-11-26 02:17:39 UTC` | `rebalance:withdraw-idle-toro` | redeemed 0.1478 idle toroSOL -> SOL | [`WV2XDhgwo9b5oW...`](https://solscan.io/tx/WV2XDhgwo9b5oWK3yHGFYV6u49sj9mXNZ19WL5q3dU8tHy58Dhu1i9QueGhS1ncMBgv4j4mKmo6XBxtFM3kdbfP) |
| `2026-11-26 02:17:36 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00759 / burned 0.00038 toroSOL · NAV 1.219648 → 1.219741 | [`6uBp3Hx4tp4k9M...`](https://solscan.io/tx/6uBp3Hx4tp4k9MxbjYUGbzqp33dDgzDvvdJtXvJN5CbzNdHwNZiDwvzy1mfc8oAY9Gkn19mxg1MKYPugEyQYXSe) |
| `2026-11-26 02:17:32 UTC` | `muleta:1tx-walk+anchor[-2248,-2160]` | Wave #403 · 1.24850 -> 1.24978 · L=691B | [`4wWivPofudEkKD...`](https://solscan.io/tx/4wWivPofudEkKDXjru9m5SyC3xdiSNRCuzRHM2EBP3WvMKZ9knDxL2P3dgQPMLVovQvhZudB5HqDMWC2XXnANMk8) |
| `2026-11-26 02:15:28 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00485 / burned 0.00024 toroSOL · NAV 1.219584 → 1.219648 | [`4JXLRGwuxUQwMt...`](https://solscan.io/tx/4JXLRGwuxUQwMtZWoTNPmN4CSo3ozp3eu9vahkWRpomQnB68ptwXWqcehnwsh6Ha8SJHyGq6UKxTkoxBxyyGg1sr) |
| `2026-11-26 02:15:24 UTC` | `muleta:1tx-walk+anchor[-2248,-2160]` | Wave #402 · 1.24778 -> 1.24972 · L=542B | [`3hFu8qxe59fg7o...`](https://solscan.io/tx/3hFu8qxe59fg7omjuauAuEnpReouY4voLGMxTZr13ce42WVQWkbhM6phdn3anQm3driGEsj3jyyzf19NaVTHz4E4) |
| `2026-11-26 02:14:10 UTC` | `rebalance:atomic-lp-to-sol-boost` | L 634B→994B · recycled 0.679 toroSOL -> +0.83 SOL | [`p43yM55Bf4msXJ...`](https://solscan.io/tx/p43yM55Bf4msXJYjXBik2mjEqokoutQvgYahbg8EDFGkCHzRdf5CfSZKB5YcX3v2UeuRhHeq2TAjnqvmovbWaK5) |
| `2026-11-26 02:14:07 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00155 / burned 0.00008 toroSOL · NAV 1.219565 → 1.219584 | [`3CeoU5zZ6roxAD...`](https://solscan.io/tx/3CeoU5zZ6roxADZobBBCc3RS1gmAKqGgDBwB9uZU3g4reuUqcVGmsMoJs5RtVUS5e7HqkmMFwodazurYWDtT6boJ) |
| `2026-11-26 02:13:26 UTC` | `collect:lp+proto(est=0.00322)` | collect:lp+proto(est=0.00322) | [`LPVydHnutnTC3W...`](https://solscan.io/tx/LPVydHnutnTC3WgWM1YDu62WJmTSyePjvnpkVw7foMg6wJQit5YtDTepfpBFL7Nv3wbtCcKVezv8FSqfCVTv1ke) |
| `2026-11-26 02:13:23 UTC` | `rebalance:withdraw-idle-toro` | redeemed 0.1998 idle toroSOL -> SOL | [`2iSy1wcYszogfB...`](https://solscan.io/tx/2iSy1wcYszogfBVPRUvFNwaCcu4DoHe2Grni1EReHhBREn6Z5R51iEcgFdq5YXrZ2QeEA7ZFMkwWq5M1upq5etA4) |
| `2026-11-26 02:13:20 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00696 / burned 0.00035 toroSOL · NAV 1.219484 → 1.219565 | [`kutNN415K3cx3e...`](https://solscan.io/tx/kutNN415K3cx3eBJ3xYYvJhevU7RHxRjkxivm9bpByPYYVpLoqGYScuxyLBbsJeTsTkbjDeDk7SpvgPJ1G6kJ4C) |
| `2026-11-26 02:13:16 UTC` | `muleta:1tx-walk+anchor[-2256,-2160]` | Wave #401 · 1.24812 -> 1.24961 · L=634B | [`5vdzfSVnPEoH14...`](https://solscan.io/tx/5vdzfSVnPEoH14SswTReinfzfbPH9QgkqrTgVRbQHK7LGwfTQRsWuAkdgAp4covNXkkoVJzc3Y6yhkFJzH2LnCmi) |

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
