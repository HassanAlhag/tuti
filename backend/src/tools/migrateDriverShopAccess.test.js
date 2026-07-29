import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  planMigrationForDriver,
  buildMigratedAccessRecord,
  MIGRATION_ACTOR_ID,
} from "./migrateDriverShopAccess.js";

test("migration: driver with no legacy shopId is skipped", () => {
  const plan = planMigrationForDriver({ driver: { id: "drv-1", shopId: null }, existingAccessRow: null, shopExists: true });
  assert.equal(plan.action, "skip_no_shop_id");
});

test("migration: driver already migrated (access row exists) is skipped -- idempotent", () => {
  const plan = planMigrationForDriver({
    driver: { id: "drv-1", shopId: "shop-a" },
    existingAccessRow: { id: "dsa-existing", driverId: "drv-1", shopId: "shop-a", status: "active" },
    shopExists: true,
  });
  assert.equal(plan.action, "skip_already_migrated");
});

test("migration: driver referencing a shop that no longer exists is reported, not migrated", () => {
  const plan = planMigrationForDriver({ driver: { id: "drv-1", shopId: "shop-deleted" }, existingAccessRow: null, shopExists: false });
  assert.equal(plan.action, "skip_missing_shop");
  assert.equal(plan.shopId, "shop-deleted");
});

test("migration: eligible driver produces a migrate plan with the right ids", () => {
  const plan = planMigrationForDriver({ driver: { id: "drv-1", shopId: "shop-a" }, existingAccessRow: null, shopExists: true });
  assert.equal(plan.action, "migrate");
  assert.equal(plan.driverId, "drv-1");
  assert.equal(plan.shopId, "shop-a");
});

test("migration: built access record is active, admin-attributed, and self-approved", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const record = buildMigratedAccessRecord({ driverId: "drv-1", shopId: "shop-a", now, idFactory: () => "fixed-uuid-value" });
  assert.equal(record.driverId, "drv-1");
  assert.equal(record.shopId, "shop-a");
  assert.equal(record.status, "active");
  assert.equal(record.requestedByType, "admin");
  assert.equal(record.requestedByUserId, MIGRATION_ACTOR_ID);
  assert.equal(record.approvedByUserId, MIGRATION_ACTOR_ID);
  assert.equal(record.approvedAt, now);
  assert.equal(record.canReceiveBroadcasts, true);
  assert.equal(record.canBeDirectlyAssigned, true);
  assert.ok(record.id.startsWith("dsa-migrated-"));
});

test("migration: re-running the plan for an already-migrated driver never produces a second row (idempotency)", () => {
  const driver = { id: "drv-1", shopId: "shop-a" };
  const firstPlan = planMigrationForDriver({ driver, existingAccessRow: null, shopExists: true });
  assert.equal(firstPlan.action, "migrate");
  const createdRow = buildMigratedAccessRecord({ driverId: firstPlan.driverId, shopId: firstPlan.shopId });

  // Second run now finds the row the first run created.
  const secondPlan = planMigrationForDriver({ driver, existingAccessRow: createdRow, shopExists: true });
  assert.equal(secondPlan.action, "skip_already_migrated");
});

test("migration: importing the module in a subprocess does not run or connect", () => {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", "await import('./backend/src/tools/migrateDriverShopAccess.js'); console.log('import-ok');"],
    {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: "test", MONGO_URI: "mongodb://127.0.0.1:1/should-not-connect" },
      encoding: "utf8",
    }
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /import-ok/);
  assert.doesNotMatch(result.stdout, /Running in/);
  assert.doesNotMatch(result.stderr, /ECONNREFUSED|MongooseServerSelectionError/);
});

test("migration: direct execution without MONGO_URI fails safely before any write path", () => {
  const result = spawnSync(process.execPath, ["backend/src/tools/migrateDriverShopAccess.js"], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "test", MONGO_URI: "" },
    encoding: "utf8",
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /No MONGO_URI configured/);
  assert.doesNotMatch(result.stdout, /WILL be created/);
});
