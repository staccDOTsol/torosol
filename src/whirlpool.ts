import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from '@solana/web3.js'
import {
  ATA_PROGRAM,
  MEMO_PROGRAM,
  ORCA_NFT_UPDATE_AUTH,
  ORCA_WHIRLPOOL_PROGRAM,
  TOKEN_2022_PROGRAM,
} from './config'

// Verified Anchor 8-byte discriminators (sha256("global:<name>")[0..8])
export const DISC = {
  initializeFeeTier: Buffer.from([183, 74, 156, 160, 112, 2, 42, 30]),
  initializeTokenBadge: Buffer.from([253, 77, 205, 95, 27, 224, 89, 223]),
  initializePoolV2: Buffer.from([207, 45, 87, 242, 27, 63, 204, 67]),
  initializeDynamicTickArray: Buffer.from([41, 33, 165, 200, 120, 231, 142, 50]),
  openPositionWithTokenExtensions: Buffer.from([212, 47, 95, 92, 114, 102, 131, 250]),
  increaseLiquidityV2: Buffer.from([133, 29, 89, 223, 69, 238, 176, 10]),
  decreaseLiquidityV2: Buffer.from([58, 127, 188, 62, 79, 82, 196, 96]),
  repositionLiquidityV2: Buffer.from([191, 169, 224, 11, 131, 19, 158, 253]),
  setFeeRate: Buffer.from([53, 243, 137, 65, 8, 140, 158, 6]),
  setProtocolFeeRate: Buffer.from([95, 7, 4, 50, 154, 79, 156, 131]),
  collectFeesV2: Buffer.from([207, 117, 95, 191, 229, 180, 226, 15]),
  collectProtocolFeesV2: Buffer.from([103, 128, 222, 134, 114, 200, 22, 200]),
  updateFeesAndRewards: Buffer.from([154, 230, 250, 13, 236, 209, 75, 223]),
  swapV2: Buffer.from([43, 4, 237, 11, 26, 201, 30, 98]),
  closePositionWithTokenExtensions: Buffer.from([1, 182, 135, 59, 155, 25, 99, 223]),
} as const

export const TICK_ARRAY_SIZE = 88
export const MIN_TICK_INDEX = -443636
export const MAX_TICK_INDEX = 443636
export const Q64 = 1n << 64n

// ------------------------------------------------------------------- encoding helpers
function u16le(v: number): Buffer {
  const b = Buffer.alloc(2)
  b.writeUInt16LE(v, 0)
  return b
}
function i32le(v: number): Buffer {
  const b = Buffer.alloc(4)
  b.writeInt32LE(v, 0)
  return b
}
function u64le(v: bigint): Buffer {
  const b = Buffer.alloc(8)
  b.writeBigUInt64LE(v, 0)
  return b
}
function u128le(v: bigint): Buffer {
  const b = Buffer.alloc(16)
  b.writeBigUInt64LE(v & 0xffffffffffffffffn, 0)
  b.writeBigUInt64LE(v >> 64n, 8)
  return b
}

// ------------------------------------------------------------------- PDA derivations
export function orderMints(mint1: PublicKey, mint2: PublicKey): [PublicKey, PublicKey] {
  return Buffer.compare(mint1.toBuffer(), mint2.toBuffer()) < 0 ? [mint1, mint2] : [mint2, mint1]
}

export function deriveFeeTierPda(config: PublicKey, tickSpacing: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('fee_tier'), config.toBuffer(), u16le(tickSpacing)],
    ORCA_WHIRLPOOL_PROGRAM,
  )[0]
}

export function deriveTokenBadgePda(config: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('token_badge'), config.toBuffer(), mint.toBuffer()],
    ORCA_WHIRLPOOL_PROGRAM,
  )[0]
}

export function deriveWhirlpoolPda(
  config: PublicKey,
  mintA: PublicKey,
  mintB: PublicKey,
  tickSpacing: number,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('whirlpool'),
      config.toBuffer(),
      mintA.toBuffer(),
      mintB.toBuffer(),
      u16le(tickSpacing),
    ],
    ORCA_WHIRLPOOL_PROGRAM,
  )[0]
}

export function getStartTickIndex(tickIndex: number, tickSpacing: number, offset = 0): number {
  const ticksInArray = TICK_ARRAY_SIZE * tickSpacing
  const base = Math.floor(tickIndex / ticksInArray) * ticksInArray
  return base + offset * ticksInArray
}

export function deriveTickArrayPda(whirlpool: PublicKey, startTickIndex: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('tick_array'), whirlpool.toBuffer(), Buffer.from(String(startTickIndex), 'utf-8')],
    ORCA_WHIRLPOOL_PROGRAM,
  )[0]
}

export function derivePositionPda(positionMint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('position'), positionMint.toBuffer()],
    ORCA_WHIRLPOOL_PROGRAM,
  )[0]
}

export function deriveAta(owner: PublicKey, mint: PublicKey, tokenProgram: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()],
    ATA_PROGRAM,
  )[0]
}

// ------------------------------------------------------------------- CLMM math
// Price is always tokenB per tokenA (adjusted for decimals: price_raw = price_ui * 10^(decB - decA))
export function priceToSqrtPriceX64(priceBPerA: number, decimalsA = 9, decimalsB = 9): bigint {
  const rawPrice = priceBPerA * Math.pow(10, decimalsB - decimalsA)
  const sqrtP = Math.sqrt(rawPrice)
  // Scale cleanly in float with 64-bit split to retain full 53-bit precision
  const hi = Math.floor(sqrtP * 4294967296) // * 2^32
  const lo = Math.round((sqrtP * 4294967296 - hi) * 4294967296)
  return (BigInt(hi) << 32n) + BigInt(lo)
}

export function sqrtPriceX64ToPrice(sqrtPriceX64: bigint, decimalsA = 9, decimalsB = 9): number {
  const sqrtP = Number(sqrtPriceX64) / Number(Q64)
  return sqrtP * sqrtP * Math.pow(10, decimalsA - decimalsB)
}

export function priceToTickIndex(priceBPerA: number, decimalsA = 9, decimalsB = 9): number {
  const rawPrice = priceBPerA * Math.pow(10, decimalsB - decimalsA)
  return Math.floor(Math.log(rawPrice) / Math.log(1.0001))
}

export function tickIndexToSqrtPriceX64(tickIndex: number): bigint {
  const sqrtP = Math.pow(1.0001, tickIndex / 2)
  const hi = Math.floor(sqrtP * 4294967296)
  const lo = Math.round((sqrtP * 4294967296 - hi) * 4294967296)
  return (BigInt(hi) << 32n) + BigInt(lo)
}

export function alignTickFloor(tick: number, tickSpacing: number): number {
  return Math.floor(tick / tickSpacing) * tickSpacing
}

export function alignTickCeil(tick: number, tickSpacing: number): number {
  return Math.ceil(tick / tickSpacing) * tickSpacing
}

/**
 * Compute max liquidity L that fits inside (amountA, amountB) at current sqrtPrice
 * for range [tickLower, tickUpper], plus exact required (reqA, reqB).
 */
export function computeLiquidityForAmounts(
  sqrtPrice: bigint,
  tickLower: number,
  tickUpper: number,
  maxA: bigint,
  maxB: bigint,
): { liquidity: bigint; reqA: bigint; reqB: bigint } {
  const sqrtA = tickIndexToSqrtPriceX64(tickLower)
  const sqrtB = tickIndexToSqrtPriceX64(tickUpper)
  if (sqrtA >= sqrtB) throw new Error(`invalid tick range: ${tickLower} >= ${tickUpper}`)

  const liqFromA = (sa: bigint, sb: bigint, amtA: bigint): bigint => {
    if (sb <= sa || amtA <= 0n) return 0n
    // L = amtA * (sa * sb / Q64) / (sb - sa)
    const num = (amtA * sa) / Q64
    return (num * sb) / (sb - sa)
  }
  const liqFromB = (sa: bigint, sb: bigint, amtB: bigint): bigint => {
    if (sb <= sa || amtB <= 0n) return 0n
    return (amtB * Q64) / (sb - sa)
  }

  let L: bigint
  if (sqrtPrice <= sqrtA) {
    L = liqFromA(sqrtA, sqrtB, maxA)
  } else if (sqrtPrice >= sqrtB) {
    L = liqFromB(sqrtA, sqrtB, maxB)
  } else {
    const la = liqFromA(sqrtPrice, sqrtB, maxA)
    const lb = liqFromB(sqrtA, sqrtPrice, maxB)
    L = la < lb ? la : lb
  }

  const { reqA, reqB } = computeAmountsForLiquidity(sqrtPrice, tickLower, tickUpper, L)
  return { liquidity: L, reqA, reqB }
}

export function computeAmountsForLiquidity(
  sqrtPrice: bigint,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
): { reqA: bigint; reqB: bigint } {
  const sqrtA = tickIndexToSqrtPriceX64(tickLower)
  const sqrtB = tickIndexToSqrtPriceX64(tickUpper)
  let reqA = 0n
  let reqB = 0n
  if (sqrtPrice <= sqrtA) {
    reqA = ceilDiv(liquidity * (sqrtB - sqrtA) * Q64, sqrtA * sqrtB)
  } else if (sqrtPrice >= sqrtB) {
    reqB = ceilDiv(liquidity * (sqrtB - sqrtA), Q64)
  } else {
    reqA = ceilDiv(liquidity * (sqrtB - sqrtPrice) * Q64, sqrtPrice * sqrtB)
    reqB = ceilDiv(liquidity * (sqrtPrice - sqrtA), Q64)
  }
  return { reqA, reqB }
}

function ceilDiv(a: bigint, b: bigint): bigint {
  return a === 0n ? 0n : (a + b - 1n) / b
}

// ------------------------------------------------------------------- on-chain state parsers
export interface ParsedWhirlpool {
  whirlpoolsConfig: PublicKey
  tickSpacing: number
  feeRate: number
  protocolFeeRate: number
  liquidity: bigint
  sqrtPrice: bigint
  tickCurrentIndex: number
  protocolFeeOwedA: bigint
  protocolFeeOwedB: bigint
  tokenMintA: PublicKey
  tokenVaultA: PublicKey
  tokenMintB: PublicKey
  tokenVaultB: PublicKey
}

/**
 * Exact Whirlpool account layout (653 bytes):
 *   0..8     disc
 *   8..40    whirlpools_config
 *   40       whirlpool_bump [1]
 *   41..43   tick_spacing u16
 *   43..45   fee_tier_index_seed [2]
 *   45..47   fee_rate u16
 *   47..49   protocol_fee_rate u16
 *   49..65   liquidity u128
 *   65..81   sqrt_price u128
 *   81..85   tick_current_index i32
 *   85..93   protocol_fee_owed_a u64
 *   93..101  protocol_fee_owed_b u64
 *   101..133 token_mint_a
 *   133..165 token_vault_a
 *   165..181 fee_growth_global_a u128
 *   181..213 token_mint_b
 *   213..245 token_vault_b
 */
export function parseWhirlpool(data: Buffer): ParsedWhirlpool {
  const readU128 = (off: number) =>
    data.readBigUInt64LE(off) + (data.readBigUInt64LE(off + 8) << 64n)
  return {
    whirlpoolsConfig: new PublicKey(data.subarray(8, 40)),
    tickSpacing: data.readUInt16LE(41),
    feeRate: data.readUInt16LE(45),
    protocolFeeRate: data.readUInt16LE(47),
    liquidity: readU128(49),
    sqrtPrice: readU128(65),
    tickCurrentIndex: data.readInt32LE(81),
    protocolFeeOwedA: data.readBigUInt64LE(85),
    protocolFeeOwedB: data.readBigUInt64LE(93),
    tokenMintA: new PublicKey(data.subarray(101, 133)),
    tokenVaultA: new PublicKey(data.subarray(133, 165)),
    tokenMintB: new PublicKey(data.subarray(181, 213)),
    tokenVaultB: new PublicKey(data.subarray(213, 245)),
  }
}

export interface ParsedPosition {
  whirlpool: PublicKey
  positionMint: PublicKey
  liquidity: bigint
  tickLowerIndex: number
  tickUpperIndex: number
  feeOwedA: bigint
  feeOwedB: bigint
}

/**
 * Exact Position account layout (216 bytes):
 *   0..8     disc
 *   8..40    whirlpool
 *   40..72   position_mint
 *   72..88   liquidity u128
 *   88..92   tick_lower_index i32
 *   92..96   tick_upper_index i32
 *   96..112  fee_growth_checkpoint_a u128
 *   112..120 fee_owed_a u64
 *   120..136 fee_growth_checkpoint_b u128
 *   136..144 fee_owed_b u64
 */
export function parsePosition(data: Buffer): ParsedPosition {
  const readU128 = (off: number) =>
    data.readBigUInt64LE(off) + (data.readBigUInt64LE(off + 8) << 64n)
  return {
    whirlpool: new PublicKey(data.subarray(8, 40)),
    positionMint: new PublicKey(data.subarray(40, 72)),
    liquidity: readU128(72),
    tickLowerIndex: data.readInt32LE(88),
    tickUpperIndex: data.readInt32LE(92),
    feeOwedA: data.readBigUInt64LE(112),
    feeOwedB: data.readBigUInt64LE(136),
  }
}

// ------------------------------------------------------------------- instruction builders
export function ixInitializeFeeTier(args: {
  config: PublicKey
  funder: PublicKey
  feeAuthority: PublicKey
  tickSpacing: number
  defaultFeeRate: number
}): TransactionInstruction {
  const feeTier = deriveFeeTierPda(args.config, args.tickSpacing)
  return new TransactionInstruction({
    programId: ORCA_WHIRLPOOL_PROGRAM,
    keys: [
      { pubkey: args.config, isSigner: false, isWritable: false },
      { pubkey: feeTier, isSigner: false, isWritable: true },
      { pubkey: args.funder, isSigner: true, isWritable: true },
      { pubkey: args.feeAuthority, isSigner: true, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([DISC.initializeFeeTier, u16le(args.tickSpacing), u16le(args.defaultFeeRate)]),
  })
}

export function ixInitializePoolV2(args: {
  config: PublicKey
  tokenMintA: PublicKey
  tokenMintB: PublicKey
  tokenProgramA: PublicKey
  tokenProgramB: PublicKey
  funder: PublicKey
  tokenVaultA: PublicKey
  tokenVaultB: PublicKey
  tickSpacing: number
  initialSqrtPrice: bigint
}): TransactionInstruction {
  const whirlpool = deriveWhirlpoolPda(args.config, args.tokenMintA, args.tokenMintB, args.tickSpacing)
  const feeTier = deriveFeeTierPda(args.config, args.tickSpacing)
  const badgeA = deriveTokenBadgePda(args.config, args.tokenMintA)
  const badgeB = deriveTokenBadgePda(args.config, args.tokenMintB)
  return new TransactionInstruction({
    programId: ORCA_WHIRLPOOL_PROGRAM,
    keys: [
      { pubkey: args.config, isSigner: false, isWritable: false },
      { pubkey: args.tokenMintA, isSigner: false, isWritable: false },
      { pubkey: args.tokenMintB, isSigner: false, isWritable: false },
      { pubkey: badgeA, isSigner: false, isWritable: false },
      { pubkey: badgeB, isSigner: false, isWritable: false },
      { pubkey: args.funder, isSigner: true, isWritable: true },
      { pubkey: whirlpool, isSigner: false, isWritable: true },
      { pubkey: args.tokenVaultA, isSigner: true, isWritable: true },
      { pubkey: args.tokenVaultB, isSigner: true, isWritable: true },
      { pubkey: feeTier, isSigner: false, isWritable: false },
      { pubkey: args.tokenProgramA, isSigner: false, isWritable: false },
      { pubkey: args.tokenProgramB, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      DISC.initializePoolV2,
      u16le(args.tickSpacing),
      u128le(args.initialSqrtPrice),
    ]),
  })
}

export function ixInitializeDynamicTickArray(args: {
  whirlpool: PublicKey
  funder: PublicKey
  startTickIndex: number
  idempotent?: boolean
}): TransactionInstruction {
  const tickArray = deriveTickArrayPda(args.whirlpool, args.startTickIndex)
  return new TransactionInstruction({
    programId: ORCA_WHIRLPOOL_PROGRAM,
    keys: [
      { pubkey: args.whirlpool, isSigner: false, isWritable: false },
      { pubkey: args.funder, isSigner: true, isWritable: true },
      { pubkey: tickArray, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      DISC.initializeDynamicTickArray,
      i32le(args.startTickIndex),
      Buffer.from([args.idempotent ?? true ? 1 : 0]),
    ]),
  })
}

export function ixOpenPositionWithTokenExtensions(args: {
  funder: PublicKey
  owner: PublicKey
  positionMint: PublicKey
  whirlpool: PublicKey
  tickLowerIndex: number
  tickUpperIndex: number
  withTokenMetadata?: boolean
}): TransactionInstruction {
  const position = derivePositionPda(args.positionMint)
  const positionTokenAccount = deriveAta(args.owner, args.positionMint, TOKEN_2022_PROGRAM)
  return new TransactionInstruction({
    programId: ORCA_WHIRLPOOL_PROGRAM,
    keys: [
      { pubkey: args.funder, isSigner: true, isWritable: true },
      { pubkey: args.owner, isSigner: false, isWritable: false },
      { pubkey: position, isSigner: false, isWritable: true },
      { pubkey: args.positionMint, isSigner: true, isWritable: true },
      { pubkey: positionTokenAccount, isSigner: false, isWritable: true },
      { pubkey: args.whirlpool, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: ATA_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: ORCA_NFT_UPDATE_AUTH, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      DISC.openPositionWithTokenExtensions,
      i32le(args.tickLowerIndex),
      i32le(args.tickUpperIndex),
      Buffer.from([args.withTokenMetadata ?? true ? 1 : 0]),
    ]),
  })
}

export function ixIncreaseLiquidityV2(args: {
  whirlpool: PublicKey
  tokenProgramA: PublicKey
  tokenProgramB: PublicKey
  positionAuthority: PublicKey
  position: PublicKey
  positionTokenAccount: PublicKey
  tokenMintA: PublicKey
  tokenMintB: PublicKey
  tokenOwnerAccountA: PublicKey
  tokenOwnerAccountB: PublicKey
  tokenVaultA: PublicKey
  tokenVaultB: PublicKey
  tickArrayLower: PublicKey
  tickArrayUpper: PublicKey
  liquidityAmount: bigint
  tokenMaxA: bigint
  tokenMaxB: bigint
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: ORCA_WHIRLPOOL_PROGRAM,
    keys: [
      { pubkey: args.whirlpool, isSigner: false, isWritable: true },
      { pubkey: args.tokenProgramA, isSigner: false, isWritable: false },
      { pubkey: args.tokenProgramB, isSigner: false, isWritable: false },
      { pubkey: MEMO_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: args.positionAuthority, isSigner: true, isWritable: false },
      { pubkey: args.position, isSigner: false, isWritable: true },
      { pubkey: args.positionTokenAccount, isSigner: false, isWritable: false },
      { pubkey: args.tokenMintA, isSigner: false, isWritable: false },
      { pubkey: args.tokenMintB, isSigner: false, isWritable: false },
      { pubkey: args.tokenOwnerAccountA, isSigner: false, isWritable: true },
      { pubkey: args.tokenOwnerAccountB, isSigner: false, isWritable: true },
      { pubkey: args.tokenVaultA, isSigner: false, isWritable: true },
      { pubkey: args.tokenVaultB, isSigner: false, isWritable: true },
      { pubkey: args.tickArrayLower, isSigner: false, isWritable: true },
      { pubkey: args.tickArrayUpper, isSigner: false, isWritable: true },
    ],
    // Option<RemainingAccountsInfo> = None (0x00)
    data: Buffer.concat([
      DISC.increaseLiquidityV2,
      u128le(args.liquidityAmount),
      u64le(args.tokenMaxA),
      u64le(args.tokenMaxB),
      Buffer.from([0]),
    ]),
  })
}

export function ixDecreaseLiquidityV2(args: {
  whirlpool: PublicKey
  tokenProgramA: PublicKey
  tokenProgramB: PublicKey
  positionAuthority: PublicKey
  position: PublicKey
  positionTokenAccount: PublicKey
  tokenMintA: PublicKey
  tokenMintB: PublicKey
  tokenOwnerAccountA: PublicKey
  tokenOwnerAccountB: PublicKey
  tokenVaultA: PublicKey
  tokenVaultB: PublicKey
  tickArrayLower: PublicKey
  tickArrayUpper: PublicKey
  liquidityAmount: bigint
  tokenMinA: bigint
  tokenMinB: bigint
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: ORCA_WHIRLPOOL_PROGRAM,
    keys: [
      { pubkey: args.whirlpool, isSigner: false, isWritable: true },
      { pubkey: args.tokenProgramA, isSigner: false, isWritable: false },
      { pubkey: args.tokenProgramB, isSigner: false, isWritable: false },
      { pubkey: MEMO_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: args.positionAuthority, isSigner: true, isWritable: false },
      { pubkey: args.position, isSigner: false, isWritable: true },
      { pubkey: args.positionTokenAccount, isSigner: false, isWritable: false },
      { pubkey: args.tokenMintA, isSigner: false, isWritable: false },
      { pubkey: args.tokenMintB, isSigner: false, isWritable: false },
      { pubkey: args.tokenOwnerAccountA, isSigner: false, isWritable: true },
      { pubkey: args.tokenOwnerAccountB, isSigner: false, isWritable: true },
      { pubkey: args.tokenVaultA, isSigner: false, isWritable: true },
      { pubkey: args.tokenVaultB, isSigner: false, isWritable: true },
      { pubkey: args.tickArrayLower, isSigner: false, isWritable: true },
      { pubkey: args.tickArrayUpper, isSigner: false, isWritable: true },
    ],
    data: Buffer.concat([
      DISC.decreaseLiquidityV2,
      u128le(args.liquidityAmount),
      u64le(args.tokenMinA),
      u64le(args.tokenMinB),
      Buffer.from([0]),
    ]),
  })
}

export function ixRepositionLiquidityV2(args: {
  whirlpool: PublicKey
  tokenProgramA: PublicKey
  tokenProgramB: PublicKey
  positionAuthority: PublicKey
  funder: PublicKey
  position: PublicKey
  positionTokenAccount: PublicKey
  tokenMintA: PublicKey
  tokenMintB: PublicKey
  tokenOwnerAccountA: PublicKey
  tokenOwnerAccountB: PublicKey
  tokenVaultA: PublicKey
  tokenVaultB: PublicKey
  existingTickArrayLower: PublicKey
  existingTickArrayUpper: PublicKey
  newTickArrayLower: PublicKey
  newTickArrayUpper: PublicKey
  newTickLowerIndex: number
  newTickUpperIndex: number
  newLiquidityAmount: bigint
  existingRangeTokenMinA: bigint
  existingRangeTokenMinB: bigint
  newRangeTokenMaxA: bigint
  newRangeTokenMaxB: bigint
}): TransactionInstruction {
  // Args: new_tick_lower_index: i32, new_tick_upper_index: i32,
  //       method: RepositionLiquidityMethod::ByLiquidity (enum 0) { new_liquidity_amount: u128, ...4 u64s },
  //       remaining_accounts_info: Option<...> = None (0)
  return new TransactionInstruction({
    programId: ORCA_WHIRLPOOL_PROGRAM,
    keys: [
      { pubkey: args.whirlpool, isSigner: false, isWritable: true },
      { pubkey: args.tokenProgramA, isSigner: false, isWritable: false },
      { pubkey: args.tokenProgramB, isSigner: false, isWritable: false },
      { pubkey: MEMO_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: args.positionAuthority, isSigner: true, isWritable: false },
      { pubkey: args.funder, isSigner: true, isWritable: true },
      { pubkey: args.position, isSigner: false, isWritable: true },
      { pubkey: args.positionTokenAccount, isSigner: false, isWritable: false },
      { pubkey: args.tokenMintA, isSigner: false, isWritable: false },
      { pubkey: args.tokenMintB, isSigner: false, isWritable: false },
      { pubkey: args.tokenOwnerAccountA, isSigner: false, isWritable: true },
      { pubkey: args.tokenOwnerAccountB, isSigner: false, isWritable: true },
      { pubkey: args.tokenVaultA, isSigner: false, isWritable: true },
      { pubkey: args.tokenVaultB, isSigner: false, isWritable: true },
      { pubkey: args.existingTickArrayLower, isSigner: false, isWritable: true },
      { pubkey: args.existingTickArrayUpper, isSigner: false, isWritable: true },
      { pubkey: args.newTickArrayLower, isSigner: false, isWritable: true },
      { pubkey: args.newTickArrayUpper, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      DISC.repositionLiquidityV2,
      i32le(args.newTickLowerIndex),
      i32le(args.newTickUpperIndex),
      Buffer.from([0]), // RepositionLiquidityMethod::ByLiquidity
      u128le(args.newLiquidityAmount),
      u64le(args.existingRangeTokenMinA),
      u64le(args.existingRangeTokenMinB),
      u64le(args.newRangeTokenMaxA),
      u64le(args.newRangeTokenMaxB),
      Buffer.from([0]), // remaining_accounts_info = None
    ]),
  })
}

export function ixSetFeeRate(args: {
  config: PublicKey
  whirlpool: PublicKey
  feeAuthority: PublicKey
  feeRate: number // 0..=60_000 (hundredths of a bp → 100 = 1bp = 0.01%, 60_000 = 6%)
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: ORCA_WHIRLPOOL_PROGRAM,
    keys: [
      { pubkey: args.config, isSigner: false, isWritable: false },
      { pubkey: args.whirlpool, isSigner: false, isWritable: true },
      { pubkey: args.feeAuthority, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([DISC.setFeeRate, u16le(args.feeRate)]),
  })
}

export function ixSetProtocolFeeRate(args: {
  config: PublicKey
  whirlpool: PublicKey
  feeAuthority: PublicKey
  protocolFeeRate: number // 0..=2_500 (bps → 2_500 = 25%)
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: ORCA_WHIRLPOOL_PROGRAM,
    keys: [
      { pubkey: args.config, isSigner: false, isWritable: false },
      { pubkey: args.whirlpool, isSigner: false, isWritable: true },
      { pubkey: args.feeAuthority, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([DISC.setProtocolFeeRate, u16le(args.protocolFeeRate)]),
  })
}

export function ixUpdateFeesAndRewards(args: {
  whirlpool: PublicKey
  position: PublicKey
  tickArrayLower: PublicKey
  tickArrayUpper: PublicKey
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: ORCA_WHIRLPOOL_PROGRAM,
    keys: [
      { pubkey: args.whirlpool, isSigner: false, isWritable: true },
      { pubkey: args.position, isSigner: false, isWritable: true },
      { pubkey: args.tickArrayLower, isSigner: false, isWritable: false },
      { pubkey: args.tickArrayUpper, isSigner: false, isWritable: false },
    ],
    data: DISC.updateFeesAndRewards,
  })
}

export function ixCollectFeesV2(args: {
  whirlpool: PublicKey
  positionAuthority: PublicKey
  position: PublicKey
  positionTokenAccount: PublicKey
  tokenMintA: PublicKey
  tokenMintB: PublicKey
  tokenOwnerAccountA: PublicKey
  tokenVaultA: PublicKey
  tokenOwnerAccountB: PublicKey
  tokenVaultB: PublicKey
  tokenProgramA: PublicKey
  tokenProgramB: PublicKey
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: ORCA_WHIRLPOOL_PROGRAM,
    keys: [
      { pubkey: args.whirlpool, isSigner: false, isWritable: false },
      { pubkey: args.positionAuthority, isSigner: true, isWritable: false },
      { pubkey: args.position, isSigner: false, isWritable: true },
      { pubkey: args.positionTokenAccount, isSigner: false, isWritable: false },
      { pubkey: args.tokenMintA, isSigner: false, isWritable: false },
      { pubkey: args.tokenMintB, isSigner: false, isWritable: false },
      { pubkey: args.tokenOwnerAccountA, isSigner: false, isWritable: true },
      { pubkey: args.tokenVaultA, isSigner: false, isWritable: true },
      { pubkey: args.tokenOwnerAccountB, isSigner: false, isWritable: true },
      { pubkey: args.tokenVaultB, isSigner: false, isWritable: true },
      { pubkey: args.tokenProgramA, isSigner: false, isWritable: false },
      { pubkey: args.tokenProgramB, isSigner: false, isWritable: false },
      { pubkey: MEMO_PROGRAM, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([DISC.collectFeesV2, Buffer.from([0])]),
  })
}

export function ixCollectProtocolFeesV2(args: {
  config: PublicKey
  whirlpool: PublicKey
  collectProtocolFeesAuthority: PublicKey
  tokenMintA: PublicKey
  tokenMintB: PublicKey
  tokenVaultA: PublicKey
  tokenVaultB: PublicKey
  tokenDestinationA: PublicKey
  tokenDestinationB: PublicKey
  tokenProgramA: PublicKey
  tokenProgramB: PublicKey
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: ORCA_WHIRLPOOL_PROGRAM,
    keys: [
      { pubkey: args.config, isSigner: false, isWritable: false },
      { pubkey: args.whirlpool, isSigner: false, isWritable: true },
      { pubkey: args.collectProtocolFeesAuthority, isSigner: true, isWritable: false },
      { pubkey: args.tokenMintA, isSigner: false, isWritable: false },
      { pubkey: args.tokenMintB, isSigner: false, isWritable: false },
      { pubkey: args.tokenVaultA, isSigner: false, isWritable: true },
      { pubkey: args.tokenVaultB, isSigner: false, isWritable: true },
      { pubkey: args.tokenDestinationA, isSigner: false, isWritable: true },
      { pubkey: args.tokenDestinationB, isSigner: false, isWritable: true },
      { pubkey: args.tokenProgramA, isSigner: false, isWritable: false },
      { pubkey: args.tokenProgramB, isSigner: false, isWritable: false },
      { pubkey: MEMO_PROGRAM, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([DISC.collectProtocolFeesV2, Buffer.from([0])]),
  })
}

export function ixSwapV2(args: {
  tokenProgramA: PublicKey
  tokenProgramB: PublicKey
  tokenAuthority: PublicKey
  whirlpool: PublicKey
  tokenMintA: PublicKey
  tokenMintB: PublicKey
  tokenOwnerAccountA: PublicKey
  tokenVaultA: PublicKey
  tokenOwnerAccountB: PublicKey
  tokenVaultB: PublicKey
  tickArray0: PublicKey
  tickArray1: PublicKey
  tickArray2: PublicKey
  oracle: PublicKey
  amount: bigint
  otherAmountThreshold: bigint
  sqrtPriceLimit: bigint
  amountSpecifiedIsInput: boolean
  aToB: boolean
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: ORCA_WHIRLPOOL_PROGRAM,
    keys: [
      { pubkey: args.tokenProgramA, isSigner: false, isWritable: false },
      { pubkey: args.tokenProgramB, isSigner: false, isWritable: false },
      { pubkey: MEMO_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: args.tokenAuthority, isSigner: true, isWritable: false },
      { pubkey: args.whirlpool, isSigner: false, isWritable: true },
      { pubkey: args.tokenMintA, isSigner: false, isWritable: false },
      { pubkey: args.tokenMintB, isSigner: false, isWritable: false },
      { pubkey: args.tokenOwnerAccountA, isSigner: false, isWritable: true },
      { pubkey: args.tokenVaultA, isSigner: false, isWritable: true },
      { pubkey: args.tokenOwnerAccountB, isSigner: false, isWritable: true },
      { pubkey: args.tokenVaultB, isSigner: false, isWritable: true },
      { pubkey: args.tickArray0, isSigner: false, isWritable: true },
      { pubkey: args.tickArray1, isSigner: false, isWritable: true },
      { pubkey: args.tickArray2, isSigner: false, isWritable: true },
      { pubkey: args.oracle, isSigner: false, isWritable: true },
    ],
    data: Buffer.concat([
      DISC.swapV2,
      u64le(args.amount),
      u64le(args.otherAmountThreshold),
      u128le(args.sqrtPriceLimit),
      Buffer.from([args.amountSpecifiedIsInput ? 1 : 0]),
      Buffer.from([args.aToB ? 1 : 0]),
      Buffer.from([0]), // remaining_accounts_info = None
    ]),
  })
}

export function deriveOraclePda(whirlpool: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('oracle'), whirlpool.toBuffer()],
    ORCA_WHIRLPOOL_PROGRAM,
  )[0]
}
