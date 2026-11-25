#!/usr/bin/env bun
/**
 * 01_deploy_lst.ts — Deploy toroSOL Token-2022 Mint + Sanctum SP12tWFx Stake Pool + Initial Deposit.
 *
 * Dry-run by default (simulates Tx 1 with sigVerify=true and prints full rent/cost breakdown).
 * Pass `--execute` to broadcast all 3 transactions on mainnet and persist state/deployment.json.
 *
 * Usage:
 *   bun run deploy:lst              # dry-run simulation
 *   bun run deploy:lst --execute    # broadcast mainnet deploy
 */

import {
  Authorized,
  Keypair,
  LAMPORTS_PER_SOL,
  Lockup,
  PublicKey,
  StakeProgram,
  SystemProgram,
} from '@solana/web3.js'
import {
  AuthorityType,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  createSetAuthorityInstruction,
  ExtensionType,
  getMintLen,
  LENGTH_SIZE,
  TYPE_SIZE,
} from '@solana/spl-token'
import { createInitializeInstruction, pack, TokenMetadata } from '@solana/spl-token-metadata'
import {
  INITIAL_DEPOSIT_FEE,
  INITIAL_DEPOSIT_SOL,
  INITIAL_EPOCH_FEE,
  INITIAL_MAX_VALIDATORS,
  INITIAL_REFERRAL_FEE_PCT,
  INITIAL_TRANSFER_FEE_BPS,
  INITIAL_WITHDRAWAL_FEE,
  loadDeployment,
  loadManagerKeypair,
  loadOrcaAuthKeypair,
  MAX_TRANSFER_FEE_ATOMS,
  SANCTUM_STAKE_POOL_PROGRAM,
  saveDeployment,
  TOKEN_2022_PROGRAM,
  TOKEN_DECIMALS,
  TOKEN_NAME,
  TOKEN_SYMBOL,
  TOKEN_URI,
} from './config'
import {
  deriveManagerAta,
  deriveWithdrawAuthority,
  fetchStakePoolState,
  ixDepositSol,
  ixSanctumInitialize,
  MINIMUM_RESERVE_LAMPORTS,
  STAKE_ACCOUNT_SIZE,
  STAKE_POOL_ACCOUNT_SIZE,
  validatorListSize,
} from './sanctum'
import { createConnection, log, simulateOrSendTx } from './tx'

async function main() {
  const execute = process.argv.includes('--execute')
  const force = process.argv.includes('--force')

  const existing = loadDeployment()
  if (existing && !force) {
    log(`state/deployment.json already exists (mint=${existing.mint}, pool=${existing.stakePool}).`)
    log(`Pass --force if you intentionally want to deploy a brand-new LST.`)
    return
  }

  const conn = createConnection()
  const manager = loadManagerKeypair()
  const orcaAuth = loadOrcaAuthKeypair()
  const balLamports = await conn.getBalance(manager.publicKey, 'confirmed')

  log(`=== 01_deploy_lst (${execute ? 'MAINNET EXECUTE' : 'DRY-RUN SIMULATION'}) ===`)
  log(`manager (331): ${manager.publicKey.toBase58()} | balance=${(balLamports / 1e9).toFixed(6)} SOL`)
  log(`token:         ${TOKEN_NAME} (${TOKEN_SYMBOL})`)
  log(`metadata uri:  ${TOKEN_URI}`)
  log(
    `fees:          T22=${INITIAL_TRANSFER_FEE_BPS}bps (${(INITIAL_TRANSFER_FEE_BPS / 100).toFixed(2)}%) | ` +
      `solDeposit=${INITIAL_DEPOSIT_FEE.numerator}/${INITIAL_DEPOSIT_FEE.denominator} | ` +
      `solWithdraw=${INITIAL_WITHDRAWAL_FEE.numerator}/${INITIAL_WITHDRAWAL_FEE.denominator} | ` +
      `epoch=${INITIAL_EPOCH_FEE.numerator}/${INITIAL_EPOCH_FEE.denominator} | ` +
      `referral=${INITIAL_REFERRAL_FEE_PCT}%`,
  )
  log(`init deposit:  ${INITIAL_DEPOSIT_SOL} SOL`)

  // Generate fresh accounts for the LST + Stake Pool
  const mintKp = Keypair.generate()
  const stakePoolKp = Keypair.generate()
  const validatorListKp = Keypair.generate()
  const reserveStakeKp = Keypair.generate()

  const withdrawAuth = deriveWithdrawAuthority(stakePoolKp.publicKey)
  const managerFeeAta = deriveManagerAta(manager.publicKey, mintKp.publicKey)

  // Compute exact Token-2022 mint sizes & rent
  const metadata: TokenMetadata = {
    updateAuthority: manager.publicKey,
    mint: mintKp.publicKey,
    name: TOKEN_NAME,
    symbol: TOKEN_SYMBOL,
    uri: TOKEN_URI,
    additionalMetadata: [],
  }
  const baseMintLen = getMintLen([ExtensionType.TransferFeeConfig, ExtensionType.MetadataPointer])
  const metadataExtLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length
  const totalMintLen = baseMintLen + metadataExtLen
  const vListLen = validatorListSize(INITIAL_MAX_VALIDATORS)

  const [mintRent, poolRent, vListRent, stakeRent] = await Promise.all([
    conn.getMinimumBalanceForRentExemption(totalMintLen),
    conn.getMinimumBalanceForRentExemption(STAKE_POOL_ACCOUNT_SIZE),
    conn.getMinimumBalanceForRentExemption(vListLen),
    conn.getMinimumBalanceForRentExemption(STAKE_ACCOUNT_SIZE),
  ])
  const reserveLamports = BigInt(stakeRent) + MINIMUM_RESERVE_LAMPORTS
  const totalRentSol = (mintRent + poolRent + vListRent + Number(reserveLamports) + 2_200_000) / 1e9

  log(`generated pubkeys:`)
  log(`  mint:          ${mintKp.publicKey.toBase58()} (baseLen=${baseMintLen}, finalLen=${totalMintLen})`)
  log(`  stakePool:     ${stakePoolKp.publicKey.toBase58()}`)
  log(`  withdrawAuth:  ${withdrawAuth.toBase58()}`)
  log(`  validatorList: ${validatorListKp.publicKey.toBase58()} (maxValidators=${INITIAL_MAX_VALIDATORS}, len=${vListLen})`)
  log(`  reserveStake:  ${reserveStakeKp.publicKey.toBase58()}`)
  log(`  managerFeeAta: ${managerFeeAta.toBase58()}`)
  log(`estimated rent+reserve: ~${totalRentSol.toFixed(5)} SOL`)

  // -----------------------------------------------------------------
  // TX 1: Create Token-2022 Mint (TransferFeeConfig + MetadataPointer + TokenMetadata)
  //       + Transfer MintAuthority → Sanctum withdrawAuth + Create manager ATA
  // -----------------------------------------------------------------
  const tx1Ixs = [
    SystemProgram.createAccount({
      fromPubkey: manager.publicKey,
      newAccountPubkey: mintKp.publicKey,
      space: baseMintLen,
      lamports: mintRent, // pre-fund final size so TokenMetadata realloc succeeds!
      programId: TOKEN_2022_PROGRAM,
    }),
    createInitializeTransferFeeConfigInstruction(
      mintKp.publicKey,
      manager.publicKey, // transferFeeConfigAuthority KEPT on 331
      manager.publicKey, // withdrawWithheldAuthority KEPT on 331
      INITIAL_TRANSFER_FEE_BPS,
      MAX_TRANSFER_FEE_ATOMS,
      TOKEN_2022_PROGRAM,
    ),
    createInitializeMetadataPointerInstruction(
      mintKp.publicKey,
      manager.publicKey, // metadataPointerAuthority KEPT on 331
      mintKp.publicKey, // metadata stored inside mint itself
      TOKEN_2022_PROGRAM,
    ),
    createInitializeMintInstruction(
      mintKp.publicKey,
      TOKEN_DECIMALS,
      manager.publicKey, // temp mintAuthority so tokenMetadataInitialize can sign!
      null, // freezeAuthority = None (required for Orca Whirlpool without TokenBadge!)
      TOKEN_2022_PROGRAM,
    ),
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM,
      metadata: mintKp.publicKey,
      updateAuthority: manager.publicKey, // KEPT on 331
      mint: mintKp.publicKey,
      mintAuthority: manager.publicKey,
      name: TOKEN_NAME,
      symbol: TOKEN_SYMBOL,
      uri: TOKEN_URI,
    }),
    createSetAuthorityInstruction(
      mintKp.publicKey,
      manager.publicKey,
      AuthorityType.MintTokens,
      withdrawAuth, // hand MintTokens cleanly to Sanctum SP12tWFx withdrawAuth PDA!
      [],
      TOKEN_2022_PROGRAM,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      manager.publicKey,
      managerFeeAta,
      manager.publicKey,
      mintKp.publicKey,
      TOKEN_2022_PROGRAM,
    ),
  ]

  // -----------------------------------------------------------------
  // TX 2: Allocate StakePool + ValidatorList + ReserveStake & Sanctum Initialize
  // -----------------------------------------------------------------
  const tx2Ixs = [
    SystemProgram.createAccount({
      fromPubkey: manager.publicKey,
      newAccountPubkey: stakePoolKp.publicKey,
      space: STAKE_POOL_ACCOUNT_SIZE,
      lamports: poolRent,
      programId: SANCTUM_STAKE_POOL_PROGRAM,
    }),
    SystemProgram.createAccount({
      fromPubkey: manager.publicKey,
      newAccountPubkey: validatorListKp.publicKey,
      space: vListLen,
      lamports: vListRent,
      programId: SANCTUM_STAKE_POOL_PROGRAM,
    }),
    SystemProgram.createAccount({
      fromPubkey: manager.publicKey,
      newAccountPubkey: reserveStakeKp.publicKey,
      space: STAKE_ACCOUNT_SIZE,
      lamports: Number(reserveLamports),
      programId: StakeProgram.programId,
    }),
    StakeProgram.initialize({
      stakePubkey: reserveStakeKp.publicKey,
      authorized: new Authorized(withdrawAuth, withdrawAuth),
      lockup: new Lockup(0, 0, PublicKey.default),
    }),
    ixSanctumInitialize({
      stakePool: stakePoolKp.publicKey,
      manager: manager.publicKey,
      staker: manager.publicKey,
      validatorList: validatorListKp.publicKey,
      reserveStake: reserveStakeKp.publicKey,
      poolMint: mintKp.publicKey,
      managerFeeAccount: managerFeeAta,
      epochFee: INITIAL_EPOCH_FEE,
      withdrawalFee: INITIAL_WITHDRAWAL_FEE,
      depositFee: INITIAL_DEPOSIT_FEE,
      referralFee: INITIAL_REFERRAL_FEE_PCT,
      maxValidators: INITIAL_MAX_VALIDATORS,
    }),
  ]

  // -----------------------------------------------------------------
  // TX 3: Initial DepositSol (mints initial toroSOL supply into 331)
  // -----------------------------------------------------------------
  const depositLamports = BigInt(Math.round(INITIAL_DEPOSIT_SOL * LAMPORTS_PER_SOL))
  const tx3Ixs = [
    ixDepositSol({
      stakePool: stakePoolKp.publicKey,
      reserveStake: reserveStakeKp.publicKey,
      funder: manager.publicKey,
      destinationTokenAccount: managerFeeAta,
      managerFeeAccount: managerFeeAta,
      referrerTokenAccount: managerFeeAta,
      poolMint: mintKp.publicKey,
      lamports: depositLamports,
    }),
  ]

  if (!execute) {
    await simulateOrSendTx(conn, tx1Ixs, manager, [mintKp], {
      cuLimit: 300_000,
      dryRun: true,
      label: 'tx1:create-t22-mint-metadata',
    })
    // Verify tx2 StakePool + ValidatorList + ReserveStake allocation + StakeProgram.initialize
    // (Sanctum Initialize ix requires mint & ATA from tx1 to exist on-chain first.)
    await simulateOrSendTx(
      conn,
      tx2Ixs.slice(0, 4),
      manager,
      [stakePoolKp, validatorListKp, reserveStakeKp],
      {
        cuLimit: 300_000,
        dryRun: true,
        label: 'tx2-prep:alloc-pool+vlist+init-reserve-stake',
      },
    )
    log(`tx2 Sanctum Initialize payload: ${tx2Ixs[4].data.length} bytes (expected 54), ${tx2Ixs[4].keys.length} accounts (expected 9)`)
    log(`tx3 Sanctum DepositSol payload: ${tx3Ixs[0].data.length} bytes (expected 9), ${tx3Ixs[0].keys.length} accounts (expected 10)`)
    log(`DRY-RUN PASSED! Run with --execute to broadcast on mainnet.`)
    return
  }

  // Execute live on mainnet in 3 clean transactions
  await simulateOrSendTx(conn, tx1Ixs, manager, [mintKp], {
    cuLimit: 300_000,
    cuPriceMicroLamports: 25_000,
    dryRun: false,
    label: 'tx1:create-t22-mint-metadata',
  })

  await simulateOrSendTx(
    conn,
    tx2Ixs,
    manager,
    [stakePoolKp, validatorListKp, reserveStakeKp],
    {
      cuLimit: 400_000,
      cuPriceMicroLamports: 25_000,
      dryRun: false,
      label: 'tx2:sanctum-initialize-pool',
    },
  )

  // Save deployment state right after pool init so even if DepositSol retries we never lose addresses
  saveDeployment({
    createdAt: new Date().toISOString(),
    network: 'mainnet-beta',
    manager: manager.publicKey.toBase58(),
    orcaAuthority: orcaAuth.publicKey.toBase58(),
    mint: mintKp.publicKey.toBase58(),
    stakePool: stakePoolKp.publicKey.toBase58(),
    validatorList: validatorListKp.publicKey.toBase58(),
    reserveStake: reserveStakeKp.publicKey.toBase58(),
    withdrawAuthority: withdrawAuth.toBase58(),
    managerFeeAccount: managerFeeAta.toBase58(),
    tokenName: TOKEN_NAME,
    tokenSymbol: TOKEN_SYMBOL,
    tokenUri: TOKEN_URI,
    transferFeeBps: INITIAL_TRANSFER_FEE_BPS,
  })

  await simulateOrSendTx(conn, tx3Ixs, manager, [], {
    cuLimit: 250_000,
    cuPriceMicroLamports: 25_000,
    dryRun: false,
    label: `tx3:deposit-${INITIAL_DEPOSIT_SOL}-sol`,
  })

  const state = await fetchStakePoolState(conn, stakePoolKp.publicKey)
  log(`=== LST DEPLOYED SUCCESSFULLY ===`)
  log(`  mint:      ${mintKp.publicKey.toBase58()}`)
  log(`  stakePool: ${stakePoolKp.publicKey.toBase58()}`)
  log(`  TVL:       ${(Number(state.totalLamports) / 1e9).toFixed(6)} SOL`)
  log(`  supply:    ${(Number(state.poolTokenSupply) / 1e9).toFixed(6)} ${TOKEN_SYMBOL}`)
  log(`  NAV:       ${state.navSolPerToken.toFixed(6)} SOL/${TOKEN_SYMBOL}`)
  log(`Saved to state/deployment.json. Next: bun run deploy:orca --execute`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
