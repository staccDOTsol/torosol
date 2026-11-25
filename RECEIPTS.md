# toroSOL On-Chain Receipts

Independently verifiable Solana mainnet proof snapshot generated directly from live RPC state at **slot `473859292`** (`2026-11-25T19:13:12.165Z`).
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
| **On-Chain NAV Floor** | **`1.203431 SOL / toroSOL`** (**`+20.34%`** in SOL since `1.000000` launch) |
| **Total SOL Backing (TVL)** | `6.438493 SOL` (`2.4368 SOL` instant ReserveStake + `4.0033 SOL` Helius 0% staked) |
| **Circulating Supply** | `5.350116 toroSOL` |
| **Total Permanently Burned** | **`1.0893 toroSOL`** (`1.0023` keeper + `0.0870` init) |
| **Epoch & Helius Yield ETA** | Epoch `1096` (`89.7%`) · Epoch `1097` in `~5.0h` |
| **Matador Arb Engine** | `231 waves · 215 sniped / 8 unsniped (96.4% all-time)` |

### Native Helius 0% Validator Stake Accounts

| Validator | Validator Stake Account (VSA) | VSA Balance | Transient Stake Account (TSA) | TSA Balance |
|---|---|---|---|---|
| Helius 0% (`he1iusun...`) | [`J7AQFxiEN6nhxTuNxhk5TywUtjakt3DkGGsRG2Bg4ZMa`](https://solscan.io/account/J7AQFxiEN6nhxTuNxhk5TywUtjakt3DkGGsRG2Bg4ZMa) | `1.0017 SOL` (act epoch 1096) | [`EJM8gotcWQGMtgycfec1fEc2HY5zBQui2MZD9fiMEqhS`](https://solscan.io/account/EJM8gotcWQGMtgycfec1fEc2HY5zBQui2MZD9fiMEqhS) | `3.0017 SOL` (act epoch 1096) |

---

## 3. Dual Concentrated Orca Whirlpools

| Pool | Address | Live Spot | Depth (Bid / Ask) | Liquidity (`L`) | Fees |
|---|---|---|---|---|---|
| **SOL / toroSOL** (`ts=8`) | [`3m5V1UfeYiFUiMRQxvdZQv6kktUcSCHzbMa4HsVSt2Up`](https://www.geckoterminal.com/solana/pools/3m5V1UfeYiFUiMRQxvdZQv6kktUcSCHzbMa4HsVSt2Up) | `1.227812 SOL` (`+2.03%` vs NAV) | `2.3692 SOL / 0.8807 toroSOL` | `708.6B` | `0.30%` (`25%` proto rake) |
| **USDC / toroSOL** (`ts=64`) | [`559rsvoXtSiwdXZJX6rYhvanz7frfrCb7V1HHSfEXAd3`](https://www.geckoterminal.com/solana/pools/559rsvoXtSiwdXZJX6rYhvanz7frfrCb7V1HHSfEXAd3) | `$86.11` (SOL `$70.05`) | `$40.48 USDC / 0.1472 toroSOL` | `1676068152` | `0.30%` (`25%` proto rake) |

---

## 4. Recent Confirmed Mainnet Transactions (Live Proof)

| UTC Timestamp | Action | On-Chain Result | Solscan Receipt |
|---|---|---|---|
| `2026-11-25 19:12:33 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.03389 / burned 0.01688 toroSOL · NAV 1.199646 → 1.203431 | [`5owmKcCQYrJTem...`](https://solscan.io/tx/5owmKcCQYrJTemNLGFGp8Sch3uzxxv7QWCfyrMygmBSeSNLKrLZLi5cdw4U3kF6GVo9xNAVMuN5az87HcCoygqb1) |
| `2026-11-25 19:12:29 UTC` | `muleta:1tx-walk+anchor[-2080,-1992]` | Wave #231 · 1.22790 -> 1.22929 · L=709B | [`5TwE9CQLpgTgQk...`](https://solscan.io/tx/5TwE9CQLpgTgQkH8tnDZNLVwvDEJzVFcKWCK4JkvQVE8v9RknK4xYenCTu5wXih6HQZ2sMZvxZMMyzX1woDqEmSd) |
| `2026-11-25 19:11:17 UTC` | `collect:lp+proto(est=0.00776+redeem=0.086)` | collect:lp+proto(est=0.00776+redeem=0.086) | [`5YPn4yzsNhUYtq...`](https://solscan.io/tx/5YPn4yzsNhUYtq3BAnhQShKXQydxAGc6Wgzt2AMkZ9aPn9Da1KGwmnKiXeqgzy6DCoMv2V1Nm4Rp1WE9JLdhYPps) |
| `2026-11-25 19:10:33 UTC` | `rebalance:atomic-lp-to-sol-boost` | L 687B→1020B · recycled 0.743 toroSOL -> +0.89 SOL | [`Zi4ythkEnC1zLa...`](https://solscan.io/tx/Zi4ythkEnC1zLaJmbLE1GsrnM7GUo4MQeqmw9Q8B5BhvHz74vVs6wcjCKPyxAvnAkhSF9pMBepEcKkKLhXbizw1) |
| `2026-11-25 19:10:30 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00695 / burned 0.00035 toroSOL · NAV 1.199574 → 1.199646 | [`3gvuAXBtDexkwd...`](https://solscan.io/tx/3gvuAXBtDexkwdfPSwmtrDNS5yqbL3AToi2kbdvUoHufZt5GsZRob3UH6fzodWS55fDSCeePzjNdUH4Y74t8vxm3) |
| `2026-11-25 19:10:27 UTC` | `rebalance:withdraw-idle-toro` | redeemed 0.1823 idle toroSOL -> SOL | [`4W9nFDeKBnRgx6...`](https://solscan.io/tx/4W9nFDeKBnRgx6kAf3qWkf9fepYmaTiZHHrjSG27fGT2NGNC9RqX8QQyKaynMQ1bwv9198z5wZQ7mURWJ2CXgMtJ) |
| `2026-11-25 19:10:23 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00761 / burned 0.00038 toroSOL · NAV 1.199494 → 1.199574 | [`3a41MM6wjHxgCn...`](https://solscan.io/tx/3a41MM6wjHxgCntp7rvyNsZguybs7zDT59R6YLiKxUdLyWweyYVCmdW4oMUaAVLXU4MNP4QqksgKSQhso7WNpcSm) |
| `2026-11-25 19:10:20 UTC` | `muleta:1tx-walk+anchor[-2096,-1992]` | Wave #230 · 1.22758 -> 1.22913 · L=687B | [`4RaeG3JBsRXUJ8...`](https://solscan.io/tx/4RaeG3JBsRXUJ8nwFhdu4KF1yyqDVTzZeY1DpJHwNGsq14c5d8wtbeiohfqQ8VcA8HEd4utkdEqACuKBUq9YjhZo) |
| `2026-11-25 19:09:56 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00805 / burned 0.00040 toroSOL · NAV 1.199402 → 1.199494 | [`XWYnGuiWcDTkkK...`](https://solscan.io/tx/XWYnGuiWcDTkkKy3fP133ekUMCGBDvau2SUcuoBB4ZP8GxECzv57cXeG49jUdjh2sj1n4NUhTo1QgvrDaUJEpAd) |
| `2026-11-25 19:08:12 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00918 / burned 0.00046 toroSOL · NAV 1.199290 → 1.199402 | [`2VpokbfrkNRP5R...`](https://solscan.io/tx/2VpokbfrkNRP5RuUe5kpizo9nxoTQpFTTQLbS2NkLwDWFKq4hAywMUzjUw3N64p1MyZ7pdSv4s5xh5M2QTvhQXMM) |
| `2026-11-25 19:08:08 UTC` | `muleta:1tx-walk+anchor[-2080,-1992]` | Wave #229 · 1.22715 -> 1.22892 · L=829B | [`42E9hN1WojwY1s...`](https://solscan.io/tx/42E9hN1WojwY1sicuWciZc6csaRQD7UuNyFeMprqEGPdfyeNagt3TXXMbpzksTGhx4KW3hS8x4jUTtmHSQgjSv7M) |
| `2026-11-25 19:06:15 UTC` | `collect:lp+proto(est=0.00402+redeem=0.051)` | collect:lp+proto(est=0.00402+redeem=0.051) | [`P32crSPW48s6x1...`](https://solscan.io/tx/P32crSPW48s6x1rQtFz78KSfWCxf8jU5m1o4TQtxDzw9YgZt6WwnR9s3CX2qxMPNiSSMm6b4vm1aqT6iyzpG9C1) |
| `2026-11-25 19:06:12 UTC` | `rebalance:atomic-lp-to-sol-boost` | L 744B→1028B · recycled 0.536 toroSOL -> +0.64 SOL | [`5HJ5AjZZrhkf7K...`](https://solscan.io/tx/5HJ5AjZZrhkf7K3ZpLHv6dwXEQ5kUmQmgcFLBjdDkE9Gb5eEr6sySTbRNGUKa4MRhkDnws17YmYTCuddCEG6onEi) |
| `2026-11-25 19:06:09 UTC` | `rebalance:withdraw-idle-toro` | idle toroSOL -> SOL | [`5cTekdTXj2yUpK...`](https://solscan.io/tx/5cTekdTXj2yUpKDkDd8Kw55nbT6mnyxB2NpjcCtwg11Yd7QBoYghxQwumgFgMptHP8amWyopvTFc7akBFJgapnSA) |
| `2026-11-25 19:06:02 UTC` | `muleta:1tx-walk+anchor[-2088,-1992]` | Wave #228 · 1.22722 -> 1.22881 · L=744B | [`Gz24VSbYih8ucg...`](https://solscan.io/tx/Gz24VSbYih8ucgxM8RevvExU5nNfy2CePqtirGw5Q9yA6V9Hu2Guyf9rzMsjkiT2k5zQez7LjWDzbfoz98YLgjz) |

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
