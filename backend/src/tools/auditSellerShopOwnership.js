/**
 * Seller/Shop ownership audit — READ-ONLY.
 *
 * Reports data-integrity issues in the seller <-> shop ownership model
 * introduced by the Phase 0 registration/ownership hotfix:
 *   - duplicate seller User.shopId values (two seller accounts claiming the
 *     same shop)
 *   - seller users whose shopId does not resolve to any Shop document
 *   - shops with a missing/empty ownerId
 *   - shops whose ownerId does not resolve to any User document
 *   - shops whose ownerId points to a User that is not role:"seller"
 *   - seller users whose own shopId points to a shop actually owned by a
 *     DIFFERENT user (the exact shape of bug this hotfix closes)
 *   - a single ownerId recorded as the owner of more than one shop (the
 *     current model is one seller user per shop; flags if that is ever
 *     violated)
 *
 * This script makes ZERO writes. It never mutates, deletes, or creates any
 * document. It only reads User and Shop collections and prints a report.
 *
 * Run this BEFORE deploying the partial unique index on User.shopId --
 * that index will refuse to build if any duplicate seller shopId values
 * already exist in the collection, and this script is how you find them
 * first instead of discovering it as a failed migration in production.
 *
 * Usage (requires a real MONGO_URI -- this script does not run in
 * seed/in-memory mode, since there is nothing durable to audit there):
 *
 *   MONGO_URI="mongodb+srv://..." node backend/src/tools/auditSellerShopOwnership.js
 *
 * Exit code:
 *   0  — no issues found
 *   1  — one or more issues found (see printed report)
 *   2  — could not run the audit (e.g. no MONGO_URI configured)
 */

import mongoose from "mongoose";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { Shop } from "../models/Shop.js";

function section(title) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 60 - title.length))}`);
}

async function run() {
  if (!env.mongoUri) {
    console.error(
      "No MONGO_URI configured. This audit only runs against a real MongoDB\n" +
      "deployment (there is nothing durable to audit in seed/in-memory mode)."
    );
    process.exitCode = 2;
    return;
  }

  // Deliberately does NOT reuse config/db.js's connectDB(), which also runs
  // seedMongoIfNeeded() and can write seed data into an empty database.
  // This script connects directly and performs reads only.
  await mongoose.connect(env.mongoUri);

  let issues = 0;

  try {
    const [sellers, shops] = await Promise.all([
      User.find({ role: "seller" }).select("_id name email shopId").lean(),
      Shop.find({}).select("id name ownerId status").lean(),
    ]);

    const shopById = new Map(shops.map((shop) => [shop.id, shop]));
    const ownerIds = [...new Set(
      shops
        .map((shop) => shop.ownerId)
        .filter(Boolean)
        .map((ownerId) => String(ownerId))
    )];
    const ownerUsers = ownerIds.length
      ? await User.find({ _id: { $in: ownerIds } }).select("_id name email role shopId").lean()
      : [];
    const userById = new Map(ownerUsers.map((user) => [String(user._id), user]));

    // 1. Duplicate seller User.shopId values
    section("Duplicate seller User.shopId values");
    const sellersByShopId = new Map();
    for (const seller of sellers) {
      if (!seller.shopId) continue;
      if (!sellersByShopId.has(seller.shopId)) sellersByShopId.set(seller.shopId, []);
      sellersByShopId.get(seller.shopId).push(seller);
    }
    let duplicateShopIdCount = 0;
    for (const [shopId, group] of sellersByShopId) {
      if (group.length > 1) {
        duplicateShopIdCount += 1;
        console.log(`  shopId "${shopId}" is claimed by ${group.length} seller users:`);
        for (const u of group) console.log(`    - ${u._id} <${u.email}> (${u.name})`);
      }
    }
    if (duplicateShopIdCount === 0) console.log("  none found");
    issues += duplicateShopIdCount;

    // 2. Seller users with missing shops
    section("Seller users whose shopId does not resolve to any Shop");
    const missingShop = sellers.filter((s) => s.shopId && !shopById.has(s.shopId));
    for (const u of missingShop) {
      console.log(`  ${u._id} <${u.email}> -> shopId "${u.shopId}" (no such Shop document)`);
    }
    const noShopAtAll = sellers.filter((s) => !s.shopId);
    for (const u of noShopAtAll) {
      console.log(`  ${u._id} <${u.email}> -> no shopId set at all`);
    }
    if (missingShop.length === 0 && noShopAtAll.length === 0) console.log("  none found");
    issues += missingShop.length + noShopAtAll.length;

    // 3. Shops with missing ownerId
    section("Shops with a missing/empty ownerId");
    const missingOwnerId = shops.filter((s) => !s.ownerId);
    for (const s of missingOwnerId) {
      console.log(`  ${s.id} "${s.name}" (status: ${s.status}) -- no ownerId recorded`);
    }
    if (missingOwnerId.length === 0) console.log("  none found");
    issues += missingOwnerId.length;

    // 4. Shops whose ownerId does not resolve to any User
    section("Shops whose ownerId does not resolve to any User document");
    const shopsWithOwnerId = shops.filter((s) => s.ownerId);
    const orphanedOwnerId = shopsWithOwnerId.filter((s) => !userById.has(String(s.ownerId)));
    for (const s of orphanedOwnerId) {
      console.log(`  ${s.id} "${s.name}" -> ownerId ${s.ownerId} (no matching User)`);
    }
    if (orphanedOwnerId.length === 0) console.log("  none found");
    issues += orphanedOwnerId.length;

    // 5. Shops whose ownerId resolves to a non-seller User
    section("Shops whose ownerId resolves to a non-seller User");
    const nonSellerOwners = shopsWithOwnerId.filter((s) => {
      const owner = userById.get(String(s.ownerId));
      return owner && owner.role !== "seller";
    });
    for (const s of nonSellerOwners) {
      const owner = userById.get(String(s.ownerId));
      console.log(`  ${s.id} "${s.name}" -> ownerId ${s.ownerId} is role "${owner.role}" <${owner.email}>`);
    }
    if (nonSellerOwners.length === 0) console.log("  none found");
    issues += nonSellerOwners.length;

    // 6. Shop ownerId / user mismatch: seller's own shopId points elsewhere
    section("Seller users whose shopId points to a shop owned by a DIFFERENT user");
    let mismatchCount = 0;
    for (const seller of sellers) {
      if (!seller.shopId) continue;
      const shop = shopById.get(seller.shopId);
      if (!shop || !shop.ownerId) continue; // already reported above
      if (String(shop.ownerId) !== String(seller._id)) {
        mismatchCount += 1;
        console.log(
          `  ${seller._id} <${seller.email}> claims shopId "${seller.shopId}", ` +
          `but that shop's ownerId is ${shop.ownerId} (a different user)`
        );
      }
    }
    if (mismatchCount === 0) console.log("  none found");
    issues += mismatchCount;

    // 7. A single ownerId recorded as the owner of more than one shop
    section("Users recorded as ownerId on more than one shop");
    const shopsByOwnerId = new Map();
    for (const s of shopsWithOwnerId) {
      const key = String(s.ownerId);
      if (!shopsByOwnerId.has(key)) shopsByOwnerId.set(key, []);
      shopsByOwnerId.get(key).push(s);
    }
    let multiShopOwnerCount = 0;
    for (const [ownerId, group] of shopsByOwnerId) {
      if (group.length > 1) {
        multiShopOwnerCount += 1;
        console.log(`  ownerId ${ownerId} is recorded on ${group.length} shops: ${group.map((s) => s.id).join(", ")}`);
      }
    }
    if (multiShopOwnerCount === 0) console.log("  none found");
    issues += multiShopOwnerCount;

    section("Summary");
    console.log(`  Seller users checked: ${sellers.length}`);
    console.log(`  Shops checked:        ${shops.length}`);
    console.log(`  Issues found:         ${issues}`);
    if (issues > 0) {
      console.log(
        "\n  Action needed before deploying the partial unique index on\n" +
        "  User.shopId (see docs on index rollout) -- reconcile the records\n" +
        "  above manually. This script does not delete or modify anything."
      );
    } else {
      console.log("\n  No ownership integrity issues found.");
    }

    process.exitCode = issues > 0 ? 1 : 0;
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error("Audit failed to run:", err);
  process.exitCode = 2;
});
