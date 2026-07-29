import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { DriverCashTransaction } from "../../models/DriverCashTransaction.js";

/**
 * Per-shop COD cash ledger (Task 8). Every collection/remittance is one
 * immutable row here, always carrying driverId+shopId+orderId -- this is
 * what makes "Shop A's cash" and "Shop B's cash" for the same shared
 * driver provably separable, instead of relying on Driver.codBalance (one
 * global number with no shop attribution). See models/DriverCashTransaction.js.
 */

const seedDriverCashTransactions = [];

export function __resetDriverCashLedgerForTests() {
  seedDriverCashTransactions.length = 0;
}
export function __getSeedDriverCashTransactionsForTests() {
  return [...seedDriverCashTransactions];
}

function normalizeTransaction(tx) {
  if (!tx) return null;
  const raw = typeof tx.toObject === "function" ? tx.toObject() : tx;
  return {
    id: raw.id,
    driverId: raw.driverId,
    shopId: raw.shopId,
    orderId: raw.orderId,
    assignmentId: raw.assignmentId || null,
    type: raw.type,
    amount: Number(raw.amount) || 0,
    status: raw.status,
    settlementRef: raw.settlementRef || null,
    recordedByUserId: raw.recordedByUserId || null,
    createdAt: raw.createdAt || null,
  };
}

async function findExistingTransaction(orderId, type) {
  if (env.mongoUri) {
    const tx = await DriverCashTransaction.findOne({ orderId, type }).lean();
    return normalizeTransaction(tx);
  }
  return normalizeTransaction(seedDriverCashTransactions.find((t) => t.orderId === orderId && t.type === type));
}

/**
 * One row per order, ever -- if a collection row already exists for this
 * order (e.g. a duplicate driver-delivery submission being retried at
 * the network layer), this is a no-op returning the existing row rather
 * than a duplicate insert. Amount <= 0 records nothing (no COD was
 * actually collected).
 */
export async function recordCodCollection({ driverId, shopId, orderId, assignmentId, amount, recordedByUserId = null }) {
  const numericAmount = Number(amount) || 0;
  if (numericAmount <= 0) return null;

  const existing = await findExistingTransaction(orderId, "cod_collected");
  if (existing) return existing;

  const record = {
    id: `dct-${randomUUID().slice(0, 10)}`,
    driverId,
    shopId,
    orderId,
    assignmentId: assignmentId || null,
    type: "cod_collected",
    amount: numericAmount,
    status: "pending_remittance",
    settlementRef: null,
    recordedByUserId,
  };

  if (env.mongoUri) {
    try {
      const doc = await DriverCashTransaction.create(record);
      return normalizeTransaction(doc);
    } catch (err) {
      // Unique (orderId, type) index -- a concurrent caller already won.
      if (err?.code === 11000) return findExistingTransaction(orderId, "cod_collected");
      throw err;
    }
  }
  const seedRecord = { ...record, createdAt: new Date().toISOString() };
  seedDriverCashTransactions.push(seedRecord);
  return normalizeTransaction(seedRecord);
}

/**
 * Marks the matching collection row settled and records a companion
 * remittance row -- called once per order from the admin COD settlement
 * flow (finance/codSettlement.js). No-ops if the order was never
 * recorded as collected (defensive; codSettlement.js already validates
 * codCollected===true before calling this) or was already settled.
 */
export async function recordCodRemittance({ driverId, shopId, orderId, assignmentId, amount, settlementRef, recordedByUserId = null }) {
  const collected = await findExistingTransaction(orderId, "cod_collected");
  if (!collected || collected.status === "settled") return collected;

  const remittedExisting = await findExistingTransaction(orderId, "cod_remitted");
  if (remittedExisting) return remittedExisting;

  const numericAmount = Number(amount) || collected.amount;
  const remittanceRecord = {
    id: `dct-${randomUUID().slice(0, 10)}`,
    driverId,
    shopId,
    orderId,
    assignmentId: assignmentId || collected.assignmentId || null,
    type: "cod_remitted",
    amount: numericAmount,
    status: "settled",
    settlementRef: settlementRef || null,
    recordedByUserId,
  };

  if (env.mongoUri) {
    await DriverCashTransaction.findOneAndUpdate(
      { orderId, type: "cod_collected" },
      { $set: { status: "settled", settlementRef: settlementRef || null } }
    );
    try {
      const doc = await DriverCashTransaction.create(remittanceRecord);
      return normalizeTransaction(doc);
    } catch (err) {
      if (err?.code === 11000) return findExistingTransaction(orderId, "cod_remitted");
      throw err;
    }
  }

  collected.status = "settled";
  collected.settlementRef = settlementRef || null;
  const seedRecord = { ...remittanceRecord, createdAt: new Date().toISOString() };
  seedDriverCashTransactions.push(seedRecord);
  return normalizeTransaction(seedRecord);
}

async function listTransactions({ driverId, shopId } = {}) {
  if (env.mongoUri) {
    const filter = {};
    if (driverId) filter.driverId = driverId;
    if (shopId) filter.shopId = shopId;
    const rows = await DriverCashTransaction.find(filter).sort({ createdAt: -1 }).lean();
    return rows.map(normalizeTransaction);
  }
  return seedDriverCashTransactions
    .filter((t) => (!driverId || t.driverId === driverId) && (!shopId || t.shopId === shopId))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .map(normalizeTransaction);
}

function summarize(transactions) {
  let pendingCollected = 0;
  let totalCollected = 0;
  let totalRemitted = 0;
  for (const tx of transactions) {
    if (tx.type === "cod_collected") {
      totalCollected += tx.amount;
      if (tx.status === "pending_remittance") pendingCollected += tx.amount;
    } else if (tx.type === "cod_remitted") {
      totalRemitted += tx.amount;
    }
  }
  return { pendingCollected, totalCollected, totalRemitted };
}

/**
 * The seller-safe read: this shop's slice of a shared driver's cash
 * movements only. A seller must never be able to derive another shop's
 * balance from this -- callers always pass the seller's own
 * server-resolved shopId, never a client-supplied one.
 */
export async function getShopDriverCodSummary(shopId, driverId = null) {
  const transactions = await listTransactions({ shopId, driverId });
  return { shopId, driverId, ...summarize(transactions), transactionCount: transactions.length };
}

/** Admin aggregate view: this driver's cash position broken out per shop. */
export async function getDriverCodSummaryAcrossShops(driverId) {
  const transactions = await listTransactions({ driverId });
  const byShop = new Map();
  for (const tx of transactions) {
    if (!byShop.has(tx.shopId)) byShop.set(tx.shopId, []);
    byShop.get(tx.shopId).push(tx);
  }
  const perShop = [...byShop.entries()].map(([shopId, txs]) => ({ shopId, ...summarize(txs) }));
  return { driverId, perShop, ...summarize(transactions) };
}

export async function listShopDriverCodTransactions(shopId, driverId = null) {
  return listTransactions({ shopId, driverId });
}
