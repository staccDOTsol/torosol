import {
  type AccountInfo,
  Connection,
  PublicKey,
  StakeProgram,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_STAKE_HISTORY_PUBKEY,
  TransactionInstruction,
} from '@solana/web3.js'
import { SANCTUM_STAKE_POOL_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_DECIMALS } from './config'
import { deriveAta } from './whirlpool'

export const STAKE_CONFIG_ID = new PublicKey('StakeConfig11111111111111111111111111111111')
export const STAKE_POOL_ACCOUNT_SIZE = 611
export const VALIDATOR_LIST_HEADER_SIZE = 9 // 1 (type) + 4 (max_validators) + 4 (vec len)
export const VALIDATOR_STAKE_INFO_SIZE = 73
export const STAKE_ACCOUNT_SIZE = 200
// SPL stake-pool v2.2.0 (also deployed by this Sanctum pool) adds zero to rent.
export const MINIMUM_RESERVE_LAMPORTS = 0n

export function reserveRentFloor(account: AccountInfo<Buffer> | null, currentRent: number): bigint {
  if (!account?.owner.equals(StakeProgram.programId) || account.data.length !== STAKE_ACCOUNT_SIZE ||
      account.data.readUInt32LE(0) !== 1 || currentRent <= 0) throw new Error('Cannot verify the stake reserve')
  const recordedRent = account.data.readBigUInt64LE(4)
  return recordedRent > BigInt(currentRent) ? recordedRent : BigInt(currentRent)
}


export interface PoolFee {
  numerator: bigint
  denominator: bigint
}

export function validatorListSize(maxValidators: number): number {
  return VALIDATOR_LIST_HEADER_SIZE + VALIDATOR_STAKE_INFO_SIZE * maxValidators
}

export function deriveWithdrawAuthority(stakePool: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [stakePool.toBuffer(), Buffer.from('withdraw')],
    SANCTUM_STAKE_POOL_PROGRAM,
  )[0]
}

export function deriveValidatorStakeAccount(
  voteAccount: PublicKey,
  stakePool: PublicKey,
  seed?: number,
): PublicKey {
  const seeds: Buffer[] = [voteAccount.toBuffer(), stakePool.toBuffer()]
  if (seed && seed > 0) seeds.push(u32le(seed))
  return PublicKey.findProgramAddressSync(seeds, SANCTUM_STAKE_POOL_PROGRAM)[0]
}

export function deriveTransientStakeAccount(
  voteAccount: PublicKey,
  stakePool: PublicKey,
  transientSeedSuffix: bigint,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('transient'), voteAccount.toBuffer(), stakePool.toBuffer(), u64le(transientSeedSuffix)],
    SANCTUM_STAKE_POOL_PROGRAM,
  )[0]
}

export interface ParsedValidatorInfo {
  activeStakeLamports: bigint
  transientStakeLamports: bigint
  lastUpdateEpoch: bigint
  transientSeedSuffix: bigint
  validatorSeedSuffix: number
  status: number
  voteAccount: PublicKey
}

export function parseValidatorListData(d: Buffer): ParsedValidatorInfo[] {
  if (d.length < VALIDATOR_LIST_HEADER_SIZE) return []
  const count = d.readUInt32LE(5)
  const out: ParsedValidatorInfo[] = []
  for (let i = 0; i < count; i++) {
    const off = VALIDATOR_LIST_HEADER_SIZE + i * VALIDATOR_STAKE_INFO_SIZE
    if (off + VALIDATOR_STAKE_INFO_SIZE > d.length) break
    out.push({
      activeStakeLamports: d.readBigUInt64LE(off),
      transientStakeLamports: d.readBigUInt64LE(off + 8),
      lastUpdateEpoch: d.readBigUInt64LE(off + 16),
      transientSeedSuffix: d.readBigUInt64LE(off + 24),
      validatorSeedSuffix: d.readUInt32LE(off + 36),
      status: d[off + 40],
      voteAccount: new PublicKey(d.subarray(off + 41, off + 73)),
    })
  }
  return out
}

export function validatorStakePairs(
  stakePool: PublicKey,
  validators: ParsedValidatorInfo[],
): { validatorStake: PublicKey; transientStake: PublicKey }[] {
  return validators.map((v) => ({
    validatorStake: deriveValidatorStakeAccount(v.voteAccount, stakePool, v.validatorSeedSuffix),
    transientStake: deriveTransientStakeAccount(v.voteAccount, stakePool, v.transientSeedSuffix),
  }))
}

function u64le(v: bigint | number): Buffer {
  const b = Buffer.alloc(8)
  b.writeBigUInt64LE(BigInt(v), 0)
  return b
}
function u32le(v: number): Buffer {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(v, 0)
  return b
}
function encodeFee(fee: PoolFee): Buffer {
  // spl_stake_pool::state::Fee { denominator: u64, numerator: u64 }
  return Buffer.concat([u64le(fee.denominator), u64le(fee.numerator)])
}

/**
 * StakePoolInstruction::Initialize (variant 0)
 * Data: [0, fee(16), withdrawal_fee(16), deposit_fee(16), referral_fee(u8), max_validators(u32)]
 */
export function ixSanctumInitialize(args: {
  stakePool: PublicKey
  manager: PublicKey
  staker: PublicKey
  validatorList: PublicKey
  reserveStake: PublicKey
  poolMint: PublicKey
  managerFeeAccount: PublicKey
  epochFee: PoolFee
  withdrawalFee: PoolFee
  depositFee: PoolFee
  referralFee: number
  maxValidators: number
}): TransactionInstruction {
  const withdrawAuth = deriveWithdrawAuthority(args.stakePool)
  const data = Buffer.concat([
    Buffer.from([0]),
    encodeFee(args.epochFee),
    encodeFee(args.withdrawalFee),
    encodeFee(args.depositFee),
    Buffer.from([args.referralFee]),
    u32le(args.maxValidators),
  ])
  return new TransactionInstruction({
    programId: SANCTUM_STAKE_POOL_PROGRAM,
    keys: [
      { pubkey: args.stakePool, isSigner: false, isWritable: true },
      { pubkey: args.manager, isSigner: true, isWritable: false },
      { pubkey: args.staker, isSigner: false, isWritable: false },
      { pubkey: withdrawAuth, isSigner: false, isWritable: false },
      { pubkey: args.validatorList, isSigner: false, isWritable: true },
      { pubkey: args.reserveStake, isSigner: false, isWritable: false },
      { pubkey: args.poolMint, isSigner: false, isWritable: true },
      { pubkey: args.managerFeeAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_2022_PROGRAM, isSigner: false, isWritable: false },
    ],
    data,
  })
}

/**
 * StakePoolInstruction::DepositSol (variant 14)
 */
export function ixDepositSol(args: {
  stakePool: PublicKey
  reserveStake: PublicKey
  funder: PublicKey
  destinationTokenAccount: PublicKey
  managerFeeAccount: PublicKey
  referrerTokenAccount: PublicKey
  poolMint: PublicKey
  lamports: bigint
}): TransactionInstruction {
  const withdrawAuth = deriveWithdrawAuthority(args.stakePool)
  return new TransactionInstruction({
    programId: SANCTUM_STAKE_POOL_PROGRAM,
    keys: [
      { pubkey: args.stakePool, isSigner: false, isWritable: true },
      { pubkey: withdrawAuth, isSigner: false, isWritable: false },
      { pubkey: args.reserveStake, isSigner: false, isWritable: true },
      { pubkey: args.funder, isSigner: true, isWritable: true },
      { pubkey: args.destinationTokenAccount, isSigner: false, isWritable: true },
      { pubkey: args.managerFeeAccount, isSigner: false, isWritable: true },
      { pubkey: args.referrerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: args.poolMint, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([Buffer.from([14]), u64le(args.lamports)]),
  })
}

/**
 * StakePoolInstruction::WithdrawSol (variant 16)
 */
export function ixWithdrawSol(args: {
  stakePool: PublicKey
  reserveStake: PublicKey
  burner: PublicKey
  burnerTokenAccount: PublicKey
  recipientSol: PublicKey
  managerFeeAccount: PublicKey
  poolMint: PublicKey
  poolTokens: bigint
}): TransactionInstruction {
  const withdrawAuth = deriveWithdrawAuthority(args.stakePool)
  return new TransactionInstruction({
    programId: SANCTUM_STAKE_POOL_PROGRAM,
    keys: [
      { pubkey: args.stakePool, isSigner: false, isWritable: true },
      { pubkey: withdrawAuth, isSigner: false, isWritable: false },
      { pubkey: args.burner, isSigner: true, isWritable: false },
      { pubkey: args.burnerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: args.reserveStake, isSigner: false, isWritable: true },
      { pubkey: args.recipientSol, isSigner: false, isWritable: true },
      { pubkey: args.managerFeeAccount, isSigner: false, isWritable: true },
      { pubkey: args.poolMint, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: StakeProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([Buffer.from([16]), u64le(args.poolTokens)]),
  })
}

export type SanctumFeeKind =
  | { kind: 'SolReferral'; pct: number }
  | { kind: 'StakeReferral'; pct: number }
  | { kind: 'Epoch'; fee: PoolFee }
  | { kind: 'StakeWithdrawal'; fee: PoolFee }
  | { kind: 'SolDeposit'; fee: PoolFee }
  | { kind: 'StakeDeposit'; fee: PoolFee }
  | { kind: 'SolWithdrawal'; fee: PoolFee }

/**
 * StakePoolInstruction::SetFee (variant 12)
 * FeeType borsh enum:
 *   0: SolReferral(u8)
 *   1: StakeReferral(u8)
 *   2: Epoch(Fee)
 *   3: StakeWithdrawal(Fee)
 *   4: SolDeposit(Fee)
 *   5: StakeDeposit(Fee)
 *   6: SolWithdrawal(Fee)
 */
export function ixSetStakePoolFee(args: {
  stakePool: PublicKey
  manager: PublicKey
  feeType: SanctumFeeKind
}): TransactionInstruction {
  let payload: Buffer
  switch (args.feeType.kind) {
    case 'SolReferral':
      payload = Buffer.from([0, args.feeType.pct])
      break
    case 'StakeReferral':
      payload = Buffer.from([1, args.feeType.pct])
      break
    case 'Epoch':
      payload = Buffer.concat([Buffer.from([2]), encodeFee(args.feeType.fee)])
      break
    case 'StakeWithdrawal':
      payload = Buffer.concat([Buffer.from([3]), encodeFee(args.feeType.fee)])
      break
    case 'SolDeposit':
      payload = Buffer.concat([Buffer.from([4]), encodeFee(args.feeType.fee)])
      break
    case 'StakeDeposit':
      payload = Buffer.concat([Buffer.from([5]), encodeFee(args.feeType.fee)])
      break
    case 'SolWithdrawal':
      payload = Buffer.concat([Buffer.from([6]), encodeFee(args.feeType.fee)])
      break
  }
  return new TransactionInstruction({
    programId: SANCTUM_STAKE_POOL_PROGRAM,
    keys: [
      { pubkey: args.stakePool, isSigner: false, isWritable: true },
      { pubkey: args.manager, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([Buffer.from([12]), payload]),
  })
}

/**
 * StakePoolInstruction::AddValidatorToPool (variant 1)
 * Data: [1, u32le(optionalNonZeroSeed)]
 */
export function ixAddValidatorToPool(args: {
  stakePool: PublicKey
  staker: PublicKey
  reserveStake: PublicKey
  validatorList: PublicKey
  voteAccount: PublicKey
  seed?: number
}): TransactionInstruction {
  const withdrawAuth = deriveWithdrawAuthority(args.stakePool)
  const validatorStake = deriveValidatorStakeAccount(args.voteAccount, args.stakePool, args.seed)
  return new TransactionInstruction({
    programId: SANCTUM_STAKE_POOL_PROGRAM,
    keys: [
      { pubkey: args.stakePool, isSigner: false, isWritable: true },
      { pubkey: args.staker, isSigner: true, isWritable: false },
      { pubkey: args.reserveStake, isSigner: false, isWritable: true },
      { pubkey: withdrawAuth, isSigner: false, isWritable: false },
      { pubkey: args.validatorList, isSigner: false, isWritable: true },
      { pubkey: validatorStake, isSigner: false, isWritable: true },
      { pubkey: args.voteAccount, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: STAKE_CONFIG_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: StakeProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([Buffer.from([1]), u32le(args.seed ?? 0)]),
  })
}

/**
 * StakePoolInstruction::IncreaseValidatorStake (variant 4)
 * Data: [4, u64le(lamports), u64le(transientStakeSeed)]
 */
export function ixIncreaseValidatorStake(args: {
  stakePool: PublicKey
  staker: PublicKey
  validatorList: PublicKey
  reserveStake: PublicKey
  voteAccount: PublicKey
  lamports: bigint
  transientStakeSeed: bigint
  validatorSeed?: number
}): TransactionInstruction {
  const withdrawAuth = deriveWithdrawAuthority(args.stakePool)
  const validatorStake = deriveValidatorStakeAccount(args.voteAccount, args.stakePool, args.validatorSeed)
  const transientStake = deriveTransientStakeAccount(args.voteAccount, args.stakePool, args.transientStakeSeed)
  return new TransactionInstruction({
    programId: SANCTUM_STAKE_POOL_PROGRAM,
    keys: [
      { pubkey: args.stakePool, isSigner: false, isWritable: false },
      { pubkey: args.staker, isSigner: true, isWritable: false },
      { pubkey: withdrawAuth, isSigner: false, isWritable: false },
      { pubkey: args.validatorList, isSigner: false, isWritable: true },
      { pubkey: args.reserveStake, isSigner: false, isWritable: true },
      { pubkey: transientStake, isSigner: false, isWritable: true },
      { pubkey: validatorStake, isSigner: false, isWritable: false },
      { pubkey: args.voteAccount, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: STAKE_CONFIG_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: StakeProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([Buffer.from([4]), u64le(args.lamports), u64le(args.transientStakeSeed)]),
  })
}

export function ixUpdateValidatorListBalance(args: {
  stakePool: PublicKey
  validatorList: PublicKey
  reserveStake: PublicKey
  startIndex?: number
  noMerge?: boolean
  validatorPairs?: { validatorStake: PublicKey; transientStake: PublicKey }[]
}): TransactionInstruction {
  const withdrawAuth = deriveWithdrawAuthority(args.stakePool)
  const data = Buffer.alloc(6)
  data.writeUInt8(6, 0)
  data.writeUInt32LE(args.startIndex ?? 0, 1)
  data.writeUInt8(args.noMerge ? 1 : 0, 5)
  const extraKeys = (args.validatorPairs ?? []).flatMap((p) => [
    { pubkey: p.validatorStake, isSigner: false, isWritable: true },
    { pubkey: p.transientStake, isSigner: false, isWritable: true },
  ])
  return new TransactionInstruction({
    programId: SANCTUM_STAKE_POOL_PROGRAM,
    keys: [
      { pubkey: args.stakePool, isSigner: false, isWritable: false },
      { pubkey: withdrawAuth, isSigner: false, isWritable: false },
      { pubkey: args.validatorList, isSigner: false, isWritable: true },
      { pubkey: args.reserveStake, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: StakeProgram.programId, isSigner: false, isWritable: false },
      ...extraKeys,
    ],
    data,
  })
}

export function ixUpdateStakePoolBalance(args: {
  stakePool: PublicKey
  validatorList: PublicKey
  reserveStake: PublicKey
  managerFeeAccount: PublicKey
  poolMint: PublicKey
}): TransactionInstruction {
  const withdrawAuth = deriveWithdrawAuthority(args.stakePool)
  return new TransactionInstruction({
    programId: SANCTUM_STAKE_POOL_PROGRAM,
    keys: [
      { pubkey: args.stakePool, isSigner: false, isWritable: true },
      { pubkey: withdrawAuth, isSigner: false, isWritable: false },
      { pubkey: args.validatorList, isSigner: false, isWritable: true },
      { pubkey: args.reserveStake, isSigner: false, isWritable: false },
      { pubkey: args.managerFeeAccount, isSigner: false, isWritable: true },
      { pubkey: args.poolMint, isSigner: false, isWritable: true },
      { pubkey: TOKEN_2022_PROGRAM, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([7]),
  })
}

export function ixCleanupRemovedValidatorEntries(args: {
  stakePool: PublicKey
  validatorList: PublicKey
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: SANCTUM_STAKE_POOL_PROGRAM,
    keys: [
      { pubkey: args.stakePool, isSigner: false, isWritable: false },
      { pubkey: args.validatorList, isSigner: false, isWritable: true },
    ],
    data: Buffer.from([8]),
  })
}

// ------------------------------------------------------------------- Token-2022 fee & burn helpers
/** TransferFeeExtension (26), sub-ix 3 = WithdrawWithheldTokensFromAccounts */
export function ixWithdrawWithheldFromAccounts(args: {
  mint: PublicKey
  destination: PublicKey
  authority: PublicKey
  sources: PublicKey[]
}): TransactionInstruction {
  if (args.sources.length === 0 || args.sources.length > 255) {
    throw new Error(`invalid withheld source count: ${args.sources.length}`)
  }
  return new TransactionInstruction({
    programId: TOKEN_2022_PROGRAM,
    keys: [
      { pubkey: args.mint, isSigner: false, isWritable: true },
      { pubkey: args.destination, isSigner: false, isWritable: true },
      { pubkey: args.authority, isSigner: true, isWritable: false },
      ...args.sources.map((pk) => ({ pubkey: pk, isSigner: false, isWritable: true })),
    ],
    data: Buffer.from([26, 3, args.sources.length]),
  })
}

/** TransferFeeExtension (26), sub-ix 2 = WithdrawWithheldTokensFromMint */
export function ixWithdrawWithheldFromMint(args: {
  mint: PublicKey
  destination: PublicKey
  authority: PublicKey
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: TOKEN_2022_PROGRAM,
    keys: [
      { pubkey: args.mint, isSigner: false, isWritable: true },
      { pubkey: args.destination, isSigner: false, isWritable: true },
      { pubkey: args.authority, isSigner: true, isWritable: false },
    ],
    data: Buffer.from([26, 2]),
  })
}

/** TransferFeeExtension (26), sub-ix 5 = SetTransferFee */
export function ixSetTransferFee(args: {
  mint: PublicKey
  authority: PublicKey
  bps: number
  maxFee: bigint
}): TransactionInstruction {
  const data = Buffer.alloc(12)
  data.writeUInt8(26, 0)
  data.writeUInt8(5, 1)
  data.writeUInt16LE(args.bps, 2)
  data.writeBigUInt64LE(args.maxFee, 4)
  return new TransactionInstruction({
    programId: TOKEN_2022_PROGRAM,
    keys: [
      { pubkey: args.mint, isSigner: false, isWritable: true },
      { pubkey: args.authority, isSigner: true, isWritable: false },
    ],
    data,
  })
}

/** Token-2022 BurnChecked (15) */
export function ixBurnChecked2022(args: {
  account: PublicKey
  mint: PublicKey
  authority: PublicKey
  amount: bigint
  decimals?: number
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: TOKEN_2022_PROGRAM,
    keys: [
      { pubkey: args.account, isSigner: false, isWritable: true },
      { pubkey: args.mint, isSigner: false, isWritable: true },
      { pubkey: args.authority, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([
      Buffer.from([15]),
      u64le(args.amount),
      Buffer.from([args.decimals ?? TOKEN_DECIMALS]),
    ]),
  })
}

// ------------------------------------------------------------------- on-chain readers
export interface ParsedStakePool {
  manager: PublicKey
  staker: PublicKey
  validatorList: PublicKey
  reserveStake: PublicKey
  poolMint: PublicKey
  managerFeeAccount: PublicKey
  totalLamports: bigint
  poolTokenSupply: bigint
  lastUpdateEpoch: bigint
  epochFee: PoolFee
  solDepositFee: PoolFee
  solWithdrawalFee: PoolFee
  navSolPerToken: number
}

/**
 * Parse StakePool account (611 bytes).
 * Note: variable Option/FutureEpoch fields sit after offset 282, so we read the fixed header
 * offsets and parse sequential Fee fields cleanly!
 */
export function parseStakePoolData(d: Buffer): ParsedStakePool {
  const readFee = (off: number): PoolFee => ({
    denominator: d.readBigUInt64LE(off),
    numerator: d.readBigUInt64LE(off + 8),
  })
  const totalLamports = d.readBigUInt64LE(258)
  const poolTokenSupply = d.readBigUInt64LE(266)
  const lastUpdateEpoch = d.readBigUInt64LE(274)
  // 282..330 = lockup (unix_timestamp: i64, epoch: u64, custodian: Pubkey = 48 bytes)
  const epochFee = readFee(330)

  // Walk FutureEpoch<Fee> & Option fields starting at offset 346:
  let off = 346
  const skipFutureFee = () => {
    const tag = d[off++]
    if (tag !== 0) off += 16
  }
  const skipOptPubkey = () => {
    const tag = d[off++]
    if (tag !== 0) off += 32
  }
  skipFutureFee() // next_epoch_fee
  skipOptPubkey() // preferred_deposit_validator
  skipOptPubkey() // preferred_withdraw_validator
  off += 16 // stake_deposit_fee
  off += 16 // stake_withdrawal_fee
  skipFutureFee() // next_stake_withdrawal_fee
  off += 1 // stake_referral_fee
  skipOptPubkey() // sol_deposit_authority
  const solDepositFee = readFee(off)
  off += 16
  off += 1 // sol_referral_fee
  skipOptPubkey() // sol_withdraw_authority
  const solWithdrawalFee = readFee(off)

  const navSolPerToken =
    poolTokenSupply > 0n ? Number(totalLamports) / Number(poolTokenSupply) : 1.0

  return {
    manager: new PublicKey(d.subarray(1, 33)),
    staker: new PublicKey(d.subarray(33, 65)),
    validatorList: new PublicKey(d.subarray(98, 130)),
    reserveStake: new PublicKey(d.subarray(130, 162)),
    poolMint: new PublicKey(d.subarray(162, 194)),
    managerFeeAccount: new PublicKey(d.subarray(194, 226)),
    totalLamports,
    poolTokenSupply,
    lastUpdateEpoch,
    epochFee,
    solDepositFee,
    solWithdrawalFee,
    navSolPerToken,
  }
}

export async function fetchStakePoolState(
  conn: Connection,
  stakePool: PublicKey,
): Promise<ParsedStakePool> {
  const acc = await conn.getAccountInfo(stakePool, 'confirmed')
  if (!acc) throw new Error(`stake pool not found: ${stakePool.toBase58()}`)
  return parseStakePoolData(acc.data)
}

export async function findWithheldAccounts(
  conn: Connection,
  mint: PublicKey,
  minWithheldAtoms: bigint = 100_000n, // 0.0001 toroSOL
): Promise<{ pubkey: PublicKey; owner: PublicKey; withheld: bigint; balance: bigint }[]> {
  const accs = await conn.getProgramAccounts(TOKEN_2022_PROGRAM, {
    commitment: 'confirmed',
    filters: [{ memcmp: { offset: 0, bytes: mint.toBase58() } }],
  })
  const out: { pubkey: PublicKey; owner: PublicKey; withheld: bigint; balance: bigint }[] = []
  for (const { pubkey, account } of accs) {
    const d = account.data
    if (d.length <= 165 || d[165] !== 2) continue
    const owner = new PublicKey(d.subarray(32, 64))
    const balance = d.readBigUInt64LE(64)
    let off = 166
    let withheld = 0n
    while (off + 4 <= d.length) {
      const type = d.readUInt16LE(off)
      const len = d.readUInt16LE(off + 2)
      if (type === 0) break
      if (type === 2 /* TransferFeeAmount */) {
        withheld = d.readBigUInt64LE(off + 4)
        break
      }
      off += 4 + len
    }
    if (withheld >= minWithheldAtoms) out.push({ pubkey, owner, withheld, balance })
  }
  return out
}

export function parseMintTransferFeeData(
  d: Buffer,
  curEpoch: number,
): { bps: number; withheldInMint: bigint; supply: bigint } {
  const supply = d.readBigUInt64LE(36)
  let bps = 0
  let withheldInMint = 0n
  if (d.length > 165 && d[165] === 1) {
    let off = 166
    while (off + 4 <= d.length) {
      const type = d.readUInt16LE(off)
      const len = d.readUInt16LE(off + 2)
      if (type === 0) break
      if (type === 1 /* TransferFeeConfig */) {
        const base = off + 4
        withheldInMint = d.readBigUInt64LE(base + 64)
        const newerEpoch = d.readBigUInt64LE(base + 90)
        bps = BigInt(curEpoch) >= newerEpoch ? d.readUInt16LE(base + 106) : d.readUInt16LE(base + 88)
        break
      }
      off += 4 + len
    }
  }
  return { bps, withheldInMint, supply }
}

export async function fetchMintTransferFeeBps(
  conn: Connection,
  mint: PublicKey,
): Promise<{ bps: number; withheldInMint: bigint; supply: bigint }> {
  const [acc, { epoch }] = await Promise.all([
    conn.getAccountInfo(mint, 'confirmed'),
    conn.getEpochInfo('confirmed'),
  ])
  if (!acc) throw new Error(`mint not found: ${mint.toBase58()}`)
  return parseMintTransferFeeData(acc.data, epoch)
}

export function deriveManagerAta(manager: PublicKey, mint: PublicKey): PublicKey {
  return deriveAta(manager, mint, TOKEN_2022_PROGRAM)
}
