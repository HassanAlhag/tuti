/**
 * Product.imagePath -> MediaAsset/ProductMediaLink migration utility.
 *
 * DESIGN ONLY for this pass -- this has NOT been run against production and
 * should not be until it has been reviewed and dry-run against a staging
 * copy of real data. It is safe to read-run (the default) at any time.
 *
 * What it does, per product with a non-empty imagePath and no existing
 * primary ProductMediaLink:
 *   1. Only local `/uploads/...` paths are migrated. This script never
 *      makes outbound network calls, so an external/S3 imagePath (already
 *      a permanent URL from some earlier system) is left untouched and
 *      counted separately -- it still works today via the legacy fallback
 *      chain (Task 10), it's just not backfilled into a MediaAsset by this
 *      tool. Migrating those would require fetching the remote file, which
 *      is a deliberately separate, reviewed operation.
 *   2. For a local file, reads the real bytes from disk and runs them
 *      through the exact same Sharp optimize + S3/local persist pipeline a
 *      fresh upload would use (shared/mediaStorage.js) -- producing real
 *      thumbnail/card/detail WebP variants, not a synthetic record.
 *   3. Skips if a MediaAsset for that shop already has a matching checksum
 *      of the original file bytes -- this is the "skip duplicates" rule,
 *      so re-running the script is safe and idempotent.
 *   4. Creates one MediaAsset (ownerType:"shop", moderationStatus
 *      explicitly "approved" -- these images were already Live/published
 *      under the old system, so treating them as unmoderated "pending"
 *      would be a regression) and one ProductMediaLink(role:"primary").
 *   5. Product.imagePath itself is NEVER modified or cleared by this
 *      script -- it remains the compatibility fallback regardless of
 *      whether migration has run (see Task 10).
 *
 * Usage:
 *   Dry run (default, makes zero writes -- including zero S3 uploads):
 *     MONGO_URI="mongodb+srv://..." node backend/src/tools/migrateImagePathToMediaAsset.js
 *
 *   Apply (uploads optimized variants to S3/local disk, creates MediaAsset
 *   + ProductMediaLink rows; never touches Product.imagePath or deletes
 *   anything):
 *     MONGO_URI="mongodb+srv://..." node backend/src/tools/migrateImagePathToMediaAsset.js --apply
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Product } from "../models/Product.js";
import { MediaAsset } from "../models/MediaAsset.js";
import { ProductMediaLink } from "../models/ProductMediaLink.js";
import { optimizeAndPersistImage, sha256 } from "../shared/mediaStorage.js";

const APPLY = process.argv.includes("--apply");
const UPLOADS_DIR = env.uploadDir
  ? path.resolve(env.uploadDir)
  : path.resolve(process.cwd(), "backend/uploads");

function section(title) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 60 - title.length))}`);
}

async function loadLocalFile(imagePath) {
  if (!imagePath.startsWith("/uploads/")) return null;
  const filePath = path.join(UPLOADS_DIR, imagePath.replace(/^\/uploads\//, ""));
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

async function run() {
  if (!env.mongoUri) {
    console.error("No MONGO_URI configured. This migration only targets a real MongoDB deployment.");
    process.exitCode = 2;
    return;
  }

  console.log(APPLY
    ? "Running in APPLY mode -- MediaAsset/ProductMediaLink rows WILL be created, and optimized variants WILL be uploaded to S3/local disk."
    : "Running in DRY-RUN mode (default) -- no writes and no uploads will be made. Pass --apply to write.");

  await mongoose.connect(env.mongoUri);

  let migrated = 0;
  let skippedAlreadyLinked = 0;
  let skippedNoImagePath = 0;
  let skippedDuplicate = 0;
  let skippedExternal = 0;
  let failed = 0;

  try {
    const products = await Product.find({}).lean();

    for (const product of products) {
      if (!product.imagePath) { skippedNoImagePath += 1; continue; }

      const existingPrimary = await ProductMediaLink.findOne({ productId: product.id, role: "primary" }).lean();
      if (existingPrimary) { skippedAlreadyLinked += 1; continue; }

      const localBuffer = await loadLocalFile(product.imagePath);
      if (!localBuffer) {
        skippedExternal += 1;
        console.log(`  ${product.id} (${product.shopId}): ${product.imagePath} -> SKIPPED (not a local file; external/S3 URLs require manual migration, see file header)`);
        continue;
      }

      try {
        const checksum = sha256(localBuffer);
        const duplicate = await MediaAsset.findOne({ shopId: product.shopId, checksum }).lean();
        if (duplicate) {
          skippedDuplicate += 1;
          if (APPLY) {
            await ProductMediaLink.create({
              id: randomUUID(), productId: product.id, mediaAssetId: duplicate.id,
              shopId: product.shopId, role: "primary", position: 0,
            });
          }
          continue;
        }

        console.log(`  ${product.id} (${product.shopId}): ${product.imagePath} -> new MediaAsset${APPLY ? "" : " (dry run -- not uploaded)"}`);

        if (APPLY) {
          const assetId = randomUUID();
          const { format, storageProvider, originalWidth, originalHeight, variants } = await optimizeAndPersistImage({
            buffer: localBuffer,
            ownerType: "shop",
            ownerId: product.shopId,
            assetId,
            uploadedByUserId: null,
            uploadsDir: UPLOADS_DIR,
          });

          await MediaAsset.create({
            id: assetId,
            ownerType: "shop",
            ownerId: product.shopId,
            shopId: product.shopId,
            uploadedByUserId: null,
            uploadedByRole: "seller",
            storageProvider,
            variants,
            originalFilename: "",
            mimeType: format,
            width: originalWidth,
            height: originalHeight,
            checksum,
            altText: "",
            caption: "",
            status: "active",
            // Already-live under the pre-migration system -- do not
            // regress these to "pending" moderation.
            moderationStatus: "approved",
          });
          await ProductMediaLink.create({
            id: randomUUID(), productId: product.id, mediaAssetId: assetId,
            shopId: product.shopId, role: "primary", position: 0,
          });
        }
        migrated += 1;
      } catch (err) {
        failed += 1;
        console.error(`  FAILED for product ${product.id}:`, err.message);
      }
    }

    section("Summary");
    console.log(`  Products scanned:           ${products.length}`);
    console.log(`  Migrated (new MediaAsset):  ${migrated}`);
    console.log(`  Skipped (already linked):   ${skippedAlreadyLinked}`);
    console.log(`  Skipped (no imagePath):     ${skippedNoImagePath}`);
    console.log(`  Skipped (duplicate found):  ${skippedDuplicate}`);
    console.log(`  Skipped (external URL):     ${skippedExternal}`);
    console.log(`  Failed:                     ${failed}`);
    if (!APPLY) {
      console.log("\n  This was a dry run -- nothing was written or uploaded. Re-run with --apply to create records.");
    }
    process.exitCode = failed > 0 ? 1 : 0;
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error("Migration failed to run:", err);
  process.exitCode = 2;
});
