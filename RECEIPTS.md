# toroSOL On-Chain Receipts

Independently verifiable Solana mainnet proof snapshot generated directly from live RPC state at **slot `473953104`** (`2026-11-26T00:49:39.925Z`).
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
| **On-Chain NAV Floor** | **`1.216191 SOL / toroSOL`** (**`+21.62%`** in SOL since `1.000000` launch) |
| **Total SOL Backing (TVL)** | `6.106853 SOL` (`2.1069 SOL` instant ReserveStake + `4.0017 SOL` Helius 0% staked) |
| **Circulating Supply** | `5.021295 toroSOL` |
| **Total Permanently Burned** | **`1.1448 toroSOL`** (`1.0578` keeper + `0.0870` init) |
| **Epoch & Helius Yield ETA** | Epoch `1097` (`11.4%`) · Epoch `1098` in `~42.5h` |
| **Matador Arb Engine** | `362 waves · 346 sniped / 8 unsniped (97.7% all-time)` |

### Native Helius 0% Validator Stake Accounts

| Validator | Validator Stake Account (VSA) | VSA Balance | Transient Stake Account (TSA) | TSA Balance |
|---|---|---|---|---|
| Helius 0% (`he1iusun...`) | [`J7AQFxiEN6nhxTuNxhk5TywUtjakt3DkGGsRG2Bg4ZMa`](https://solscan.io/account/J7AQFxiEN6nhxTuNxhk5TywUtjakt3DkGGsRG2Bg4ZMa) | `4.0017 SOL` (act epoch 1096) | [`EJM8gotcWQGMtgycfec1fEc2HY5zBQui2MZD9fiMEqhS`](https://solscan.io/account/EJM8gotcWQGMtgycfec1fEc2HY5zBQui2MZD9fiMEqhS) | `0.0000 SOL` (act epoch n/a) |

---

## 3. Dual Concentrated Orca Whirlpools

| Pool | Address | Live Spot | Depth (Bid / Ask) | Liquidity (`L`) | Fees |
|---|---|---|---|---|---|
| **SOL / toroSOL** (`ts=8`) | [`3m5V1UfeYiFUiMRQxvdZQv6kktUcSCHzbMa4HsVSt2Up`](https://www.geckoterminal.com/solana/pools/3m5V1UfeYiFUiMRQxvdZQv6kktUcSCHzbMa4HsVSt2Up) | `1.244193 SOL` (`+2.3%` vs NAV) | `2.2903 SOL / 1.0027 toroSOL` | `721.8B` | `0.30%` (`25%` proto rake) |
| **USDC / toroSOL** (`ts=64`) | [`559rsvoXtSiwdXZJX6rYhvanz7frfrCb7V1HHSfEXAd3`](https://www.geckoterminal.com/solana/pools/559rsvoXtSiwdXZJX6rYhvanz7frfrCb7V1HHSfEXAd3) | `$86.46` (SOL `$70.67`) | `$41.47 USDC / 0.1357 toroSOL` | `1676068152` | `0.30%` (`25%` proto rake) |

---

## 4. Recent Confirmed Mainnet Transactions (Live Proof)

| UTC Timestamp | Action | On-Chain Result | Solscan Receipt |
|---|---|---|---|
| `2026-11-26 00:48:48 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.01020 / burned 0.00051 toroSOL · NAV 1.216067 → 1.216191 | [`5TVFpur6fJJEHV...`](https://solscan.io/tx/5TVFpur6fJJEHVczjs6aPNKxGUuomNQFohnRdjLSgTheDx6nznFkz5S56AtNmKZAQ424TpQsFPHY8hFUaAdCMcTk) |
| `2026-11-26 00:48:44 UTC` | `muleta:1tx-walk+anchor[-2216,-2128]` | Wave #362 · 1.24439 -> 1.24611 · L=722B | [`54oxE8L77kmaya...`](https://solscan.io/tx/54oxE8L77kmayadMVGZ4YFk5qkYTzbThzERSbEoVKrFJxquYqV4xAg6TJ5tTguy2xqyysx2ryvsLoqHwrRRgqFMP) |
| `2026-11-26 00:47:20 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00159 / burned 0.00008 toroSOL · NAV 1.216046 → 1.216067 | [`45pz2eRLyiivLz...`](https://solscan.io/tx/45pz2eRLyiivLzx4DwKqdNs5LDZwRevfWPCzixSNaP9zumHiWnnGcJNgR9qi5hzFWpvssuKNe9oegbgyTdtbidsz) |
| `2026-11-26 00:46:46 UTC` | `rebalance:atomic-lp-to-sol-boost` | L 574B→870B · recycled 0.821 toroSOL -> +1.00 SOL | [`3uRJAqbHnmBwQE...`](https://solscan.io/tx/3uRJAqbHnmBwQE3YoddkFrR7wZSfg9cjekPUUZryahKfSkYLYSbu45gfzXyZANswNL9HadRwuJvYw9XShS1kna7D) |
| `2026-11-26 00:46:43 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00788 / burned 0.00039 toroSOL · NAV 1.215956 → 1.216046 | [`493SxdkUCxMFyn...`](https://solscan.io/tx/493SxdkUCxMFynpac8ZoTsY6zC7zTSCYmCcsawufC7RiZd6nef3nn9ijC9J36MLCEdwfmWcY5mdMiEDxxAzskYoC) |
| `2026-11-26 00:46:39 UTC` | `muleta:1tx-walk+anchor[-2240,-2128]` | Wave #361 · 1.24380 -> 1.24600 · L=574B | [`5CGCoawLWnf68g...`](https://solscan.io/tx/5CGCoawLWnf68gjFonNnkW5muZt1oZ9g7pTwnyrVmEXVwR17Ku1vKkewZtkGtJSBAbcUkdAQbZ42oSWkdgPtctfN) |
| `2026-11-26 00:45:47 UTC` | `collect:lp+proto(est=0.00263+redeem=0.052)` | collect:lp+proto(est=0.00263+redeem=0.052) | [`asVAtMySKAsQPE...`](https://solscan.io/tx/asVAtMySKAsQPEAyrtEAc1g3ujbkf4ZYUjMyUrJqNbC9ov3NiU5vPcChHD5Cu1bH75axCsLWZtKptPfMagDxG57) |
| `2026-11-26 00:44:34 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.01102 / burned 0.00055 toroSOL · NAV 1.215822 → 1.215956 | [`yEuHf5zak9xCDV...`](https://solscan.io/tx/yEuHf5zak9xCDVuizRBcrqLESwfZY5q5KAVim4BVedpHeTAWt6MxZBPY89XudbGzzR5EK2xBkNa7AutCjAth7Et) |
| `2026-11-26 00:44:30 UTC` | `muleta:1tx-walk+anchor[-2216,-2128]` | Wave #360 · 1.24428 -> 1.24586 · L=726B | [`2Bke6xLfmM7wtw...`](https://solscan.io/tx/2Bke6xLfmM7wtwhsvNDTiBfA5VdhCJgTFeEug7hWi4xMEoPpq1XjP5uPFXwMMrQXJfRHrYJAKd9DfupCkjQRVPMa) |
| `2026-11-26 00:42:20 UTC` | `rebalance:atomic-lp-to-sol-boost` | L 621B→895B · recycled 0.667 toroSOL -> +0.81 SOL | [`3EuzpBXpsCJytG...`](https://solscan.io/tx/3EuzpBXpsCJytGrhzoRSAbjPpbf98EQ8vSZxk3Mn6aXxGFMVjFS8f4KXsZ8YtRK5ULJzLnzGi4Jnz25HG84GaSnY) |
| `2026-11-26 00:42:17 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00684 / burned 0.00034 toroSOL · NAV 1.215742 → 1.215822 | [`2Y6R9mPpcyzgjS...`](https://solscan.io/tx/2Y6R9mPpcyzgjSayNRsM8wNBvBAPEJC1vbeNvDsWWb5CgkSsWaN2xEMsw73jt3FCUUc3XgmHRNTECE4LFgHKWzCe) |
| `2026-11-26 00:42:13 UTC` | `muleta:1tx-walk+anchor[-2232,-2128]` | Wave #359 · 1.24417 -> 1.24578 · L=621B | [`4oTb36WbLj8EW5...`](https://solscan.io/tx/4oTb36WbLj8EW5seqdgiZGLt6p1NtvaBb7Ga8gozhcD1o6tKobAYC2LRUaQTXULzH1xCcWwnw8YRtirKMTYtdQYN) |
| `2026-11-26 00:40:41 UTC` | `collect:lp+proto(est=0.00311)` | collect:lp+proto(est=0.00311) | [`3iuqA8GWSFRJyW...`](https://solscan.io/tx/3iuqA8GWSFRJyWdaKqoeJ2E3XoUumsYbsx3k3dCH2QZ3tMmWYmLpCtdyCJgqQYQxtfUuiY6rsQL3SUkADCFEK2fa) |
| `2026-11-26 00:40:07 UTC` | `burn:atomic-sweep-recoup-burn-crank` | swept 0.00760 / burned 0.00038 toroSOL · NAV 1.215645 → 1.215742 | [`4vwjUT4KKrH6k4...`](https://solscan.io/tx/4vwjUT4KKrH6k4nMqBehPE7JxEhyDFo6Us3BSxktxPw5d8q6Kvyc18cmXZsyL5AnpT6hsS437NaMGuPn9byjTLUJ) |
| `2026-11-26 00:40:03 UTC` | `muleta:1tx-walk+anchor[-2216,-2128]` | Wave #358 · 1.24429 -> 1.24568 · L=682B | [`4CG4PMTTWWPWdh...`](https://solscan.io/tx/4CG4PMTTWWPWdhoimf1Pk8pixnpME54mPwaXHqAhW2mJhojyk881CUcZ1YJqa9unkQdpKT4MdoS6cLs3yJhvzY1t) |

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
