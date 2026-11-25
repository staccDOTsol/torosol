# toroSOL On-Chain Receipts

Independently verifiable Solana mainnet proof snapshot generated directly from live RPC state at **slot `473875719`** (`2026-11-25T20:12:02.757Z`).
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
| **On-Chain NAV Floor** | **`1.206189 SOL / toroSOL`** (**`+20.62%`** in SOL since `1.000000` launch) |
| **Total SOL Backing (TVL)** | `6.358649 SOL` (`2.3570 SOL` instant ReserveStake + `4.0033 SOL` Helius 0% staked) |
| **Circulating Supply** | `5.271684 toroSOL` |
| **Total Permanently Burned** | **`1.1019 toroSOL`** (`1.0149` keeper + `0.0870` init) |
| **Epoch & Helius Yield ETA** | Epoch `1096` (`93.5%`) · Epoch `1097` in `~3.1h` |
| **Matador Arb Engine** | `258 waves · 242 sniped / 8 unsniped (96.8% all-time)` |

### Native Helius 0% Validator Stake Accounts

| Validator | Validator Stake Account (VSA) | VSA Balance | Transient Stake Account (TSA) | TSA Balance |
|---|---|---|---|---|
| Helius 0% (`he1iusun...`) | [`J7AQFxiEN6nhxTuNxhk5TywUtjakt3DkGGsRG2Bg4ZMa`](https://solscan.io/account/J7AQFxiEN6nhxTuNxhk5TywUtjakt3DkGGsRG2Bg4ZMa) | `1.0017 SOL` (act epoch 1096) | [`EJM8gotcWQGMtgycfec1fEc2HY5zBQui2MZD9fiMEqhS`](https://solscan.io/account/EJM8gotcWQGMtgycfec1fEc2HY5zBQui2MZD9fiMEqhS) | `3.0017 SOL` (act epoch 1096) |

---

## 3. Dual Concentrated Orca Whirlpools

| Pool | Address | Live Spot | Depth (Bid / Ask) | Liquidity (`L`) | Fees |
|---|---|---|---|---|---|
| **SOL / toroSOL** (`ts=8`) | [`3m5V1UfeYiFUiMRQxvdZQv6kktUcSCHzbMa4HsVSt2Up`](https://www.geckoterminal.com/solana/pools/3m5V1UfeYiFUiMRQxvdZQv6kktUcSCHzbMa4HsVSt2Up) | `1.234402 SOL` (`+2.34%` vs NAV) | `2.6894 SOL / 1.1292 toroSOL` | `836.3B` | `0.30%` (`25%` proto rake) |
| **USDC / toroSOL** (`ts=64`) | [`559rsvoXtSiwdXZJX6rYhvanz7frfrCb7V1HHSfEXAd3`](https://www.geckoterminal.com/solana/pools/559rsvoXtSiwdXZJX6rYhvanz7frfrCb7V1HHSfEXAd3) | `$86.46` (SOL `$70.26`) | `$41.47 USDC / 0.1357 toroSOL` | `1676068152` | `0.30%` (`25%` proto rake) |

---

## 4. Recent Confirmed Mainnet Transactions (Live Proof)

| UTC Timestamp | Action | On-Chain Result | Solscan Receipt |
|---|---|---|---|
| `2026-11-25 20:10:57 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00923 / burned 0.00046 toroSOL · NAV 1.206084 → 1.206189 | [`3QwzGK6fQmPsni...`](https://solscan.io/tx/3QwzGK6fQmPsniA1gcoZrjNoiAKuxW7zZdfLKuxovKdFneNcvReYhLbwSy9NGj5828J2pnRn5AJKGS5igXZ9ZTNX) |
| `2026-11-25 20:10:54 UTC` | `muleta:1tx-walk+anchor[-2136,-2048]` | Wave #258 · 1.23431 -> 1.23588 · L=836B | [`3kU5E2VqDPJFmk...`](https://solscan.io/tx/3kU5E2VqDPJFmksHVYagLLbQG2qr7B5XhLdDtTk3SmdGL8iutpvUnVHx8hTMJGr7tS8jarjKFcrLSA4sgp5138cE) |
| `2026-11-25 20:08:49 UTC` | `rebalance:atomic-lp-to-sol-boost` | L 724B→1023B · recycled 0.780 toroSOL -> +0.94 SOL | [`5dxZvbShGRfHpH...`](https://solscan.io/tx/5dxZvbShGRfHpHSXaXYAorEVZXifzRD9UdgzjGNfa85cwLadaYxRSrDsp6aoCrKPZa9EqPKZZf8HpYKWqRL8wshp) |
| `2026-11-25 20:08:46 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00800 / burned 0.00040 toroSOL · NAV 1.205998 → 1.206084 | [`c9JdcrgCWevBJd...`](https://solscan.io/tx/c9JdcrgCWevBJdKBG5yEeDWM5pvMP1eokdwwZ6cdtNS2uKA5oeEB9c4hAtSJAxqYm6t9cFRibWafQqQPSxMayPg) |
| `2026-11-25 20:08:42 UTC` | `muleta:1tx-walk+anchor[-2152,-2048]` | Wave #257 · 1.23421 -> 1.23579 · L=724B | [`2vdYdrcdonMZfq...`](https://solscan.io/tx/2vdYdrcdonMZfqnhpXcczHnXprGL8CwZBMV1qUMwTy7H9gebbTt3AdmZKDJYZVjh213Uvekah2pRfFmcgwa4in39) |
| `2026-11-25 20:07:50 UTC` | `collect:lp+proto(est=0.00266)` | collect:lp+proto(est=0.00266) | [`57GoneHMHxhG7E...`](https://solscan.io/tx/57GoneHMHxhG7Eo8xvGAqJ5YdrYyV8VJtEvEXRnJwnCfhSPZfoERxnSyEk58jbGsmyuc7xKoZNnHhTsyC7dDD7zn) |
| `2026-11-25 20:06:37 UTC` | `rebalance:withdraw-idle-toro` | redeemed 0.2208 idle toroSOL -> SOL | [`4WJqTPtzZCSfHx...`](https://solscan.io/tx/4WJqTPtzZCSfHxojc2dEqdgETgRvKJjTDaTAdU3odFU1fhzW6iupKeDAJmUf8iRd9WcWTeGfsiwr6Uqk9sedQGsV) |
| `2026-11-25 20:06:34 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00884 / burned 0.00044 toroSOL · NAV 1.205899 → 1.205998 | [`5d9AdNzhP2qjve...`](https://solscan.io/tx/5d9AdNzhP2qjve7sJL2Rk175QY8oUhVaTrPPnhNKYmYRp1y3NkyitvZHo91EfGRakkLWmJs6y1d86ApaPiGChEot) |
| `2026-11-25 20:06:30 UTC` | `muleta:1tx-walk+anchor[-2136,-2048]` | Wave #256 · 1.23410 -> 1.23569 · L=800B | [`2DGkYtFpCMEJtU...`](https://solscan.io/tx/2DGkYtFpCMEJtUW8NBxXsvy7MxvV88dg4tYG6GWiTrMzyKxEyGMZUAMZSRAENpP2yqUyLEBjakFYVvKhJ9joAcJu) |
| `2026-11-25 20:04:26 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00923 / burned 0.00046 toroSOL · NAV 1.205788 → 1.205899 | [`5gG6AGJKTJayYo...`](https://solscan.io/tx/5gG6AGJKTJayYobrVTQ9WQ3yDhse81FvxF9MfGrRrXYmaCGefQJuu1bDk7nG6hrBcDAJvz5UC8fiUJ7yJySSJ4As) |
| `2026-11-25 20:04:22 UTC` | `muleta:1tx-walk+anchor[-2128,-2048]` | Wave #255 · 1.23400 -> 1.23558 · L=836B | [`4i7Z2733pQ1uGH...`](https://solscan.io/tx/4i7Z2733pQ1uGHGPMMtZRTvV9E5tGv5W6gM8ywZZ27mG2ZLQEC9K7VZRuxKEDMLWi9fbzGzhD5puKHXStQisCrBc) |
| `2026-11-25 20:02:40 UTC` | `collect:lp+proto(est=0.00396+redeem=0.156)` | collect:lp+proto(est=0.00396+redeem=0.156) | [`4xt8MwNuuEm6wE...`](https://solscan.io/tx/4xt8MwNuuEm6wEY8HvdMZJzDwVxVSCXJa6QEhAy5TgzwdsPFKUt39SrbLoh8oTisU8bMBCaQJdu6o2jMkxgYRe3L) |
| `2026-11-25 20:02:27 UTC` | `rebalance:atomic-lp-to-sol-boost` | L 803B→1121B · recycled 0.577 toroSOL -> +0.70 SOL | [`5inSmznYJFQHBx...`](https://solscan.io/tx/5inSmznYJFQHBxABfKkHwHLa3gqVJwkLeEc4ufNcGY15i5rX6FvxiXwYYjdYC9bTQnMbNHnzvnqPojwhBLa78rnV) |
| `2026-11-25 20:02:24 UTC` | `rebalance:withdraw-idle-toro` | redeemed 0.2108 idle toroSOL -> SOL | [`2fagb363dJk5Tb...`](https://solscan.io/tx/2fagb363dJk5TbQJfRGnrGLUWaDDJLL9y8srnogPZJma5L6JjaxvyzBDPp4G7KrkK891NpCiSjQmts5FF8cPMDF5) |
| `2026-11-25 20:02:21 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00888 / burned 0.00044 toroSOL · NAV 1.205690 → 1.205788 | [`PVzUx2YnrkKAte...`](https://solscan.io/tx/PVzUx2YnrkKAteYEbbZpbzC23q8vjPzMLqJWe3bDbHTXPrdAY4KLQCoSzvnCdJWa6rrzKAZu3ZGQpr8DyHEbAxp) |

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
