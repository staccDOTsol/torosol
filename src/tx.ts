import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Signer,
  Transaction,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js'
import { RPC_URL } from './config'

export function createConnection(): Connection {
  return new Connection(RPC_URL, {
    commitment: 'confirmed',
    wsEndpoint: 'wss://localhost:1', // HTTP polling only (avoids Helius WS disconnects)
    disableRetryOnRateLimit: false,
    confirmTransactionInitialTimeout: 60_000,
  })
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function log(msg: string) {
  const t = new Date().toISOString().replace('T', ' ').slice(0, 19)
  console.log(`[${t}] ${msg}`)
}

export async function confirmByPolling(
  conn: Connection,
  sig: string,
  lastValidBlockHeight: number,
  timeoutMs = 90_000,
  rawTx?: Buffer,
): Promise<{ err: unknown }> {
  const start = Date.now()
  let polls = 0
  let lastRebroadcast = start
  while (Date.now() - start < timeoutMs) {
    polls += 1
    try {
      const res = await conn.getSignatureStatuses([sig], { searchTransactionHistory: false })
      const status = res.value[0]
      if (status) {
        if (status.err) return { err: status.err }
        if (
          status.confirmationStatus === 'confirmed' ||
          status.confirmationStatus === 'finalized'
        ) {
          return { err: null }
        }
      }
      // Only check blockhash expiry every 4th poll (~3s) to save 75% RPC calls
      if (polls % 4 === 0) {
        const bh = await conn.getBlockHeight('confirmed')
        if (bh > lastValidBlockHeight) return { err: 'blockhash expired before confirmation' }
      }
      // Rebroadcast every 5s if still unconfirmed (recovers cleanly from skipped leaders)
      if (rawTx && Date.now() - lastRebroadcast >= 5000) {
        lastRebroadcast = Date.now()
        conn.sendRawTransaction(rawTx, { skipPreflight: true, maxRetries: 0 }).catch(() => {})
      }
    } catch {
      /* transient RPC error */
    }
    await sleep(750)
  }
  return { err: 'confirmation timeout' }
}

export interface SendTxOpts {
  cuLimit?: number
  cuPriceMicroLamports?: number
  dryRun?: boolean
  label: string
}

/**
 * Build, simulate (with sigVerify=true!), and optionally broadcast+confirm a legacy Transaction.
 */
export async function simulateOrSendTx(
  conn: Connection,
  ixs: TransactionInstruction[],
  feePayer: Keypair,
  extraSigners: Signer[] = [],
  opts: SendTxOpts,
): Promise<{ sig: string | null; unitsConsumed?: number; logs?: string[] }> {
  const tx = new Transaction()
  if (opts.cuLimit) {
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: opts.cuLimit }))
  }
  if (opts.cuPriceMicroLamports && opts.cuPriceMicroLamports > 0) {
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: opts.cuPriceMicroLamports }))
  }
  for (const ix of ixs) tx.add(ix)

  tx.feePayer = feePayer.publicKey
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed')
  tx.recentBlockhash = blockhash

  const allSigners: Signer[] = [feePayer]
  const seen = new Set([feePayer.publicKey.toBase58()])
  for (const s of extraSigners) {
    if (!seen.has(s.publicKey.toBase58())) {
      seen.add(s.publicKey.toBase58())
      allSigners.push(s)
    }
  }
  tx.sign(...allSigners)

  // Always simulate with sigVerify=true via VersionedTransaction wrapper (web3.js v1.99 supports SimulateTransactionConfig on VersionedTransaction)
  const vtx = VersionedTransaction.deserialize(tx.serialize())
  const sim = await conn.simulateTransaction(vtx, {
    sigVerify: true,
    commitment: 'confirmed',
  })

  if (sim.value.err) {
    log(`SIM FAILED [${opts.label}]: ${JSON.stringify(sim.value.err)}`)
    for (const l of sim.value.logs ?? []) log(`  | ${l}`)
    throw new Error(`Simulation failed for ${opts.label}: ${JSON.stringify(sim.value.err)}`)
  }

  log(
    `SIM OK [${opts.label}] cu=${sim.value.unitsConsumed ?? '?'} (${opts.dryRun ? 'DRY-RUN' : 'BROADCASTING'})`,
  )
  if (opts.dryRun) {
    return {
      sig: null,
      unitsConsumed: sim.value.unitsConsumed ?? undefined,
      logs: sim.value.logs ?? undefined,
    }
  }

  const rawTx = tx.serialize()
  const sig = await conn.sendRawTransaction(rawTx, { skipPreflight: true })
  log(`SENT [${opts.label}] ${sig}`)
  const conf = await confirmByPolling(conn, sig, lastValidBlockHeight, 90_000, rawTx)
  if (conf.err) {
    throw new Error(`TX FAILED [${opts.label}] ${sig}: ${JSON.stringify(conf.err)}`)
  }
  log(`CONFIRMED [${opts.label}] ${sig}`)
  return { sig, unitsConsumed: sim.value.unitsConsumed ?? undefined }
}

export function parseTokenBalanceAndWithheld(
  data: Buffer | null | undefined,
): { exists: boolean; amount: bigint; withheld: bigint; spendable: bigint } {
  if (!data || data.length < 72) return { exists: false, amount: 0n, withheld: 0n, spendable: 0n }
  const amount = data.readBigUInt64LE(64)
  let withheld = 0n
  if (data.length > 165 && data[165] === 2) {
    let off = 166
    while (off + 4 <= data.length) {
      const type = data.readUInt16LE(off)
      const len = data.readUInt16LE(off + 2)
      if (type === 0) break
      if (type === 2) {
        withheld = data.readBigUInt64LE(off + 4)
        break
      }
      off += 4 + len
    }
  }
  return { exists: true, amount, withheld, spendable: amount - withheld }
}

export async function getTokenBalanceAndWithheld(
  conn: Connection,
  ata: PublicKey,
): Promise<{ exists: boolean; amount: bigint; withheld: bigint; spendable: bigint }> {
  const acc = await conn.getAccountInfo(ata, 'confirmed')
  return parseTokenBalanceAndWithheld(acc?.data)
}
