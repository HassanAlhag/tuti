/**
 * Driver.shopId -> DriverShopAccess migration utility (Task 9).
 *
 * Every existing Driver document with a non-null legacy `shopId` gets
 * exactly one already-active DriverShopAccess row for that shop, so no
 * seller/admin workflow that currently depends on that relationship
 * breaks the moment authorization switches over to reading
 * DriverShopAccess instead of Driver.shopId.
 *
 * What it does, per driver with a non-null shopId:
 *   1. Skips (as already-migrated) if an active DriverShopAccess for
 *      (driverId, shopId) already exists -- idempotent, safe to re-run.
 *   2. Verifies the referenced Shop document actually exists; if not,
 *      reports it as "missing shop" and does NOT create a row pointing
 *      at a shop that doesn't exist.
 *   3. Creates ONE DriverShopAccess row: status "active",
 *      requestedByType "admin", approvedByUserId "migration-tool",
 *      approvedAt = now. No new Driver or User document is ever
 *      created -- this only adds the missing relationship record for
 *      an existing driver.
 *   4. Driver.shopId is left completely untouched (legacy/compat field,
 *      see models/Driver.js) -- this migration only ADDS
 *      DriverShopAccess rows, it never deletes or rewrites anything.
 *
 * Usage:
 *   Dry run (default, makes zero writes):
 *     MONGO_URI="mongodb+srv://..." node backend/src/tools/migrateDriverShopAccess.js
 *
 *   Apply (creates DriverShopAccess rows; never touches Driver/User/Shop):
 *     MONGO_URI="mongodb+srv://..." node backend/src/tools/migrateDriverShopAccess.js --apply
 */

import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Driver } from "../models/Driver.js";
import { Shop } from "../models/Shop.js";
import { DriverShopAccess } from "../models/DriverShopAccess.js";

const APPLY = process.argv.includes("--apply");
export const MIGRATION_ACTOR_ID = "migration-tool";

function section(title) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 60 - title.length))}`);
}

/**
 * Pure decision logic, exported for unit testing without a live MongoDB
 * connection (see migrateDriverShopAccess.test.js) -- no I/O here, just
 * "given what's already true, what should happen to this driver."
 */
export function planMigrationForDriver({ driver, existingAccessRow, shopExists }) {
  if (!driver?.shopId) return { action: "skip_no_shop_id" };
  if (existingAccessRow) return { action: "skip_already_migrated" };
  if (!shopExists) return { action: "skip_missing_shop", shopId: driver.shopId };
  return { action: "migrate", driverId: driver.id, shopId: driver.shopId };
}

export function buildMigratedAccessRecord({ driverId, shopId, now = new Date(), idFactory = () => randomUUID() }) {
  return {
    id: `dsa-migrated-${idFactory().slice(0, 10)}`,
    driverId,
    shopId,
    status: "active",
    requestedByType: "admin",
    requestedByUserId: MIGRATION_ACTOR_ID,
    approvedByUserId: MIGRATION_ACTOR_ID,
    approvedAt: now,
    canReceiveBroadcasts: true,
    canBeDirectlyAssigned: true,
  };
}

async function run() {
  if (!env.mongoUri) {
    console.error("No MONGO_URI configured. This migration only targets a real MongoDB deployment.");
    process.exitCode = 2;
    return;
  }

  console.log(APPLY
    ? "Running in APPLY mode -- DriverShopAccess rows WILL be created."
    : "Running in DRY-RUN mode (default) -- no writes will be made. Pass --apply to write.");

  await mongoose.connect(env.mongoUri);

  let migrated = 0;
  let skippedAlreadyMigrated = 0;
  let skippedNoShopId = 0;
  let skippedMissingShop = 0;
  let failed = 0;
  const missingShopIds = new Set();

  try {
    const drivers = await Driver.find({}).lean();

    for (const driver of drivers) {
      const existingAccessRow = driver.shopId
        ? await DriverShopAccess.findOne({ driverId: driver.id, shopId: driver.shopId }).lean()
        : null;
      const shop = driver.shopId ? await Shop.findOne({ id: driver.shopId }).lean() : null;

      const plan = planMigrationForDriver({ driver, existingAccessRow, shopExists: Boolean(shop) });

      if (plan.action === "skip_no_shop_id") { skippedNoShopId += 1; continue; }
      if (plan.action === "skip_already_migrated") { skippedAlreadyMigrated += 1; continue; }
      if (plan.action === "skip_missing_shop") {
        skippedMissingShop += 1;
        missingShopIds.add(plan.shopId);
        console.log(`  ${driver.id} (${driver.name}): shopId "${plan.shopId}" -> SKIPPED (shop does not exist)`);
        continue;
      }

      console.log(`  ${driver.id} (${driver.name}): shopId "${plan.shopId}" (${shop.name}) -> new active DriverShopAccess${APPLY ? "" : " (dry run)"}`);

      if (APPLY) {
        try {
          await DriverShopAccess.create(buildMigratedAccessRecord({ driverId: plan.driverId, shopId: plan.shopId }));
        } catch (err) {
          failed += 1;
          console.error(`  FAILED for driver ${driver.id}:`, err.message);
          continue;
        }
      }
      migrated += 1;
    }

    section("Summary");
    console.log(`  Drivers scanned:                ${drivers.length}`);
    console.log(`  Migrated (new access row):      ${migrated}`);
    console.log(`  Skipped (already migrated):     ${skippedAlreadyMigrated}`);
    console.log(`  Skipped (no legacy shopId):     ${skippedNoShopId}`);
    console.log(`  Skipped (shop does not exist):  ${skippedMissingShop}`);
    console.log(`  Failed:                         ${failed}`);
    if (missingShopIds.size) {
      console.log(`  Missing shop ids referenced:    ${[...missingShopIds].join(", ")}`);
    }
    if (!APPLY) {
      console.log("\n  This was a dry run -- nothing was written. Re-run with --apply to create records.");
    }
    process.exitCode = failed > 0 ? 1 : 0;
  } finally {
    await mongoose.disconnect();
  }
}

// Only run when executed directly (`node migrateDriverShopAccess.js`) --
// merely importing this module (e.g. from its unit test, which only
// needs the pure functions above) must never open a live MongoDB
// connection as a side effect.
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    console.error("Migration failed to run:", err);
    process.exitCode = 2;
  });
}
