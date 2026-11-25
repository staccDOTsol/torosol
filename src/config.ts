import { Keypair, PublicKey } from '@solana/web3.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// ------------------------------------------------------------------- programs
export const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
export const TOKEN_2022_PROGRAM = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb')
export const ATA_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
export const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
export const SANCTUM_STAKE_POOL_PROGRAM = new PublicKey('SP12tWFxD9oJsVWNavTTBZvMbA6gkAmxtVgxdqvyvhY')
export const ORCA_WHIRLPOOL_PROGRAM = new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc')
export const ORCA_NFT_UPDATE_AUTH = new PublicKey('3axbTs2z5GBy6usVbNVoqEgZMng3vZvMnAoX29BFfwhr')
export const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112')
export const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
// Orca canonical SOL/USDC (ts=4, 0.04% fee) — used as zero-API on-chain SOL/USD price oracle & swap venue
export const SOL_USDC_ORACLE_POOL = new PublicKey('Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE')

// Our owned Orca WhirlpoolsConfig (12Nqk2jy = all 5 authorities, 25% default protocol rake)
export const ORCA_CONFIG = new PublicKey(
  process.env.ORCA_CONFIG ?? '2JFwRaPCGHEaMKBqHWzAx4bZS8ZRQ9GohUzG3fKYB52Z',
)

// ------------------------------------------------------------------- RPC & API (loaded from .env / environment)
export const RPC_URL =
  process.env.RPC_URL ?? 'https://api.mainnet-beta.solana.com'

export const JUPITER_API_KEY = process.env.JUPITER_API_KEY ?? ''
export const JUPITER_URL = process.env.JUPITER_URL ?? 'https://api.jup.ag'

// ------------------------------------------------------------------- token params
export const TOKEN_NAME = process.env.TOKEN_NAME ?? 'toroSOL'
export const TOKEN_SYMBOL = process.env.TOKEN_SYMBOL ?? 'toroSOL'
export const TOKEN_URI = process.env.TOKEN_URI ?? 'https://raw.githubusercontent.com/staccDOTsol/torosol/main/toro.json'
export const TOKEN_DECIMALS = 9

// Arber-magnet Token-2022 transfer fee (200 bps = 2.00% default; authority KEPT on 331!)
export const INITIAL_TRANSFER_FEE_BPS = Number(process.env.TRANSFER_FEE_BPS ?? '200')
export const MAX_TRANSFER_FEE_ATOMS = BigInt(process.env.MAX_TRANSFER_FEE ?? '100000000000000') // 100k toroSOL

// Sanctum Stake Pool initial fees (authority + manager_fee_account = 331 → net 0% for us)
export const INITIAL_EPOCH_FEE = { numerator: 0n, denominator: 100n }
export const INITIAL_WITHDRAWAL_FEE = { numerator: 50n, denominator: 10_000n } // 0.50%
export const INITIAL_DEPOSIT_FEE = { numerator: 0n, denominator: 10_000n } // 0.00% (instant knob!)
export const INITIAL_REFERRAL_FEE_PCT = 100 // 100% of deposit fee to referrer
export const INITIAL_MAX_VALIDATORS = 5
export const INITIAL_DEPOSIT_SOL = Number(process.env.INITIAL_DEPOSIT_SOL ?? '4.5')

// Orca CLMM defaults (ts = 8 → 8 bps per tick, surgical arber-edge precision)
export const ORCA_TICK_SPACING = Number(process.env.ORCA_TICK_SPACING ?? '8')
export const ORCA_INITIAL_FEE_RATE = Number(process.env.ORCA_INITIAL_FEE_RATE ?? '500') // 5 bps (0.05%)
export const ORCA_PROTOCOL_FEE_RATE = Number(process.env.ORCA_PROTOCOL_FEE_RATE ?? '2500') // 25% of swap fee
export const ORCA_DEPLOY_SOL = Number(process.env.ORCA_DEPLOY_SOL ?? '2.15')
export const ORCA_DEPLOY_TORO = Number(process.env.ORCA_DEPLOY_TORO ?? '4.45')

// ------------------------------------------------------------------- state persistence
export const PROJECT_ROOT = path.resolve(import.meta.dir, '..')
export const STATE_DIR = path.join(PROJECT_ROOT, 'state')
export const DEPLOYMENT_FILE = path.join(STATE_DIR, 'deployment.json')
export const KEEPER_STATE_FILE = path.join(STATE_DIR, 'keeper_state.json')

export interface DeploymentState {
  createdAt: string
  network: 'mainnet-beta'
  manager: string
  orcaAuthority: string
  // LST / Sanctum
  mint: string
  stakePool: string
  validatorList: string
  reserveStake: string
  withdrawAuthority: string
  managerFeeAccount: string
  tokenName: string
  tokenSymbol: string
  tokenUri: string
  transferFeeBps: number
  // Orca Whirlpool (SOL / toroSOL)
  orcaConfig?: string
  feeTier?: string
  tickSpacing?: number
  whirlpool?: string
  tokenMintA?: string
  tokenMintB?: string
  tokenVaultA?: string
  tokenVaultB?: string
  solIsA?: boolean
  position?: string
  positionMint?: string
  positionTokenAccount?: string
  // Optional USDC / toroSOL cross-arb pool
  usdcWhirlpool?: string
  usdcTickSpacing?: number
  usdcTokenMintA?: string
  usdcTokenMintB?: string
  usdcTokenVaultA?: string
  usdcTokenVaultB?: string
  usdcPosition?: string
  usdcPositionMint?: string
  usdcPositionTokenAccount?: string
}

export function loadDeployment(): DeploymentState | null {
  if (!fs.existsSync(DEPLOYMENT_FILE)) return null
  return JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, 'utf-8')) as DeploymentState
}

export function saveDeployment(state: DeploymentState): void {
  fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 })
  fs.writeFileSync(DEPLOYMENT_FILE, JSON.stringify(state, null, 2), { mode: 0o600 })
}

// ------------------------------------------------------------------- keypair loaders
function expandHome(p: string): string {
  return p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p
}

export function loadKeypairFile(filePath: string): Keypair {
  const full = expandHome(filePath)
  const raw = JSON.parse(fs.readFileSync(full, 'utf-8')) as number[]
  return Keypair.fromSecretKey(Uint8Array.from(raw))
}

/** Manager / fee-payer / LP owner (configured via MANAGER_KEYPAIR in .env) */
export function loadManagerKeypair(): Keypair {
  return loadKeypairFile(process.env.MANAGER_KEYPAIR ?? '~/.config/solana/id.json')
}

/** Orca WhirlpoolsConfig authority (~/.config/solana/id.json → 12Nqk2jy...) */
export function loadOrcaAuthKeypair(): Keypair {
  return loadKeypairFile(process.env.ORCA_AUTH_KEYPAIR ?? '~/.config/solana/id.json')
}
