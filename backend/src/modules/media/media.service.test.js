import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";

// Deterministic regardless of what's in the real .env, and isolates every
// local-disk write this file makes to a throwaway tmp directory instead of
// the real backend/uploads -- all of config/env.js's exports (including
// shared/uploadsDir.js's module-level constant) are resolved once at
// import time, so these must be set before ANY import below.
const testUploadsDir = fsSync.mkdtempSync(path.join(os.tmpdir(), "tuti-media-test-"));
process.env.UPLOAD_DIR = testUploadsDir;
process.env.MONGO_URI = "";
process.env.AWS_REGION = "";
process.env.AWS_S3_BUCKET = "";
process.env.AWS_ACCESS_KEY_ID = "";
process.env.AWS_SECRET_ACCESS_KEY = "";
process.env.AWS_CLOUDFRONT_DOMAIN = "";

const {
  createMediaAsset,
  listSellerMedia,
  getSellerMediaById,
  updateSellerMedia,
  deleteSellerMedia,
  listAdminMedia,
  getAdminMediaById,
  updateMediaModeration,
  deleteAdminMedia,
  applyProductMediaLinks,
  getProductMedia,
  __setProductMediaFailureStepForTests,
  __resetProductMediaFailureStepForTests,
} = await import("./media.service.js");
const { seedRepository } = await import("../../repositories/seedRepository.js");
const { createSellerProduct, updateProductStatus, updateSellerProduct } = await import("../marketplace/marketplace.service.js");
const { MediaAsset } = await import("../../models/MediaAsset.js");
const { __setS3ClientForTests, __resetS3ClientForTests, __setStorageModeForTests, __resetStorageModeForTests } = await import("../../shared/s3Storage.js");
const { S3Client } = await import("@aws-sdk/client-s3");

async function realJpeg(width = 1600, height = 1600) {
  return sharp({ create: { width, height, channels: 3, background: { r: 180, g: 90, b: 40 } } }).jpeg().toBuffer();
}

const NOT_AN_IMAGE = Buffer.from("this is definitely not an image file, just text", "utf8");

let jpegBuffer;

async function upload(overrides = {}) {
  return createMediaAsset({
    ownerType: "shop",
    ownerId: "shop-media-test-001",
    shopId: "shop-media-test-001",
    uploadedByUserId: "user-media-seller-001",
    uploadedByRole: "seller",
    buffer: jpegBuffer,
    originalFilename: "photo.jpg",
    ...overrides,
  });
}

function resetState() {
  const state = seedRepository.getState();
  state.mediaAssets.length = 0;
  state.productMediaLinks.length = 0;
  state.products.length = 0;
  state.shops.length = 0;
  state.shops.push(
    { id: "shop-media-test-001", name: "Media Test Shop A", ownerId: "user-media-seller-001", status: "Approved", category: "perfume", categories: ["perfume"] },
    { id: "shop-media-test-002", name: "Media Test Shop B", ownerId: "user-media-seller-002", status: "Approved", category: "perfume", categories: ["perfume"] }
  );
}

beforeEach(async () => {
  resetState();
  jpegBuffer = await realJpeg();
  __setStorageModeForTests("local");
});

afterEach(() => {
  __resetProductMediaFailureStepForTests();
  __resetS3ClientForTests();
  __resetStorageModeForTests();
});

// ── Upload: creates a MediaAsset, real Sharp variants, dimension capture ──

test("seller upload creates a MediaAsset owned by their shop, with 3 real WebP variants and dimensions captured", async () => {
  const { asset, dimensionWarning } = await upload();

  assert.equal(asset.ownerType, "shop");
  assert.equal(asset.shopId, "shop-media-test-001");
  assert.equal(asset.mimeType, "image/jpeg");
  assert.equal(asset.width, 1600);
  assert.equal(asset.height, 1600);
  assert.equal(asset.status, "active");
  assert.equal(asset.moderationStatus, "pending");
  assert.equal(dimensionWarning, null, "1600x1600 is above the recommended minimum, no warning expected");
  // checksum/uploaderId/storageProvider are internal-only -- never on the sanitized response.
  assert.equal(asset.checksum, undefined);
  assert.equal(asset.uploadedByUserId, undefined);

  for (const name of ["thumbnail", "card", "detail"]) {
    assert.ok(asset.urls[name], `expected a resolvable ${name} URL`);
    const filePath = path.join(testUploadsDir, asset.urls[name].replace(/^\/uploads\//, ""));
    const written = await fs.readFile(filePath);
    const meta = await sharp(written).metadata();
    assert.equal(meta.format, "webp");
  }
  assert.equal(asset.variantMeta.card.width, 720);
  assert.equal(asset.variantMeta.thumbnail.width, 320);
});

test("upload with a low-resolution source returns an advisory dimension warning", async () => {
  const small = await realJpeg(400, 400);
  const { dimensionWarning } = await upload({ buffer: small });
  assert.ok(dimensionWarning);
  assert.match(dimensionWarning, /400×400/);
});

test("upload rejects a file whose real content is not an accepted image type", async () => {
  await assert.rejects(
    upload({ buffer: NOT_AN_IMAGE }),
    (error) => { assert.equal(error.status, 400); return true; }
  );
});

// ── Seller scoping ──────────────────────────────────────────────────────

test("seller lists only their own shop's media", async () => {
  await upload();
  await upload({ ownerId: "shop-media-test-002", shopId: "shop-media-test-002" });

  const own = await listSellerMedia("shop-media-test-001");
  assert.equal(own.total, 1);
  assert.equal(own.items[0].shopId, "shop-media-test-001");
});

test("seller cannot open another shop's media by id", async () => {
  const { asset } = await upload({ ownerId: "shop-media-test-002", shopId: "shop-media-test-002" });

  await assert.rejects(
    getSellerMediaById("shop-media-test-001", asset.id),
    (error) => { assert.equal(error.status, 404); return true; }
  );
});

test("seller cannot edit or delete another shop's media", async () => {
  const { asset } = await upload({ ownerId: "shop-media-test-002", shopId: "shop-media-test-002" });

  await assert.rejects(
    updateSellerMedia("shop-media-test-001", asset.id, { altText: "hijacked" }),
    (error) => { assert.equal(error.status, 404); return true; }
  );
  await assert.rejects(
    deleteSellerMedia("shop-media-test-001", asset.id),
    (error) => { assert.equal(error.status, 404); return true; }
  );
});

test("seller can edit altText/caption on their own media", async () => {
  const { asset } = await upload();
  const updated = await updateSellerMedia("shop-media-test-001", asset.id, { altText: "Oud bottle", caption: "Front view" });
  assert.equal(updated.altText, "Oud bottle");
  assert.equal(updated.caption, "Front view");
});

// ── Admin access ─────────────────────────────────────────────────────────

test("admin lists media across every shop", async () => {
  await upload();
  await upload({ ownerId: "shop-media-test-002", shopId: "shop-media-test-002" });

  const all = await listAdminMedia({});
  assert.equal(all.total, 2);
});

test("admin media filters by shop and moderation status", async () => {
  const { asset: a } = await upload();
  await upload({ ownerId: "shop-media-test-002", shopId: "shop-media-test-002" });
  await updateMediaModeration(a.id, "approve");

  const byShop = await listAdminMedia({ shopId: "shop-media-test-001" });
  assert.equal(byShop.total, 1);

  const approved = await listAdminMedia({ moderationStatus: "approved" });
  assert.equal(approved.total, 1);
  assert.equal(approved.items[0].id, a.id);
});

test("admin can approve, reject, and quarantine media", async () => {
  const { asset } = await upload();

  const approved = await updateMediaModeration(asset.id, "approve");
  assert.equal(approved.moderationStatus, "approved");
  assert.equal(approved.status, "active");

  const rejected = await updateMediaModeration(asset.id, "reject");
  assert.equal(rejected.moderationStatus, "rejected");

  const quarantined = await updateMediaModeration(asset.id, "quarantine");
  assert.equal(quarantined.status, "quarantined");
});

test("admin detail view includes usage references but never checksum or uploader id", async () => {
  const { asset } = await upload();
  const product = await createSellerProduct({
    shopId: "shop-media-test-001", name: "Oud Test", price: 100, category: "perfume",
    primaryMediaAssetId: asset.id,
  });

  const detail = await getAdminMediaById(asset.id);
  assert.equal(detail.referenceCount, 1);
  assert.equal(detail.usedByProducts[0].id, product.id);
  assert.equal(detail.checksum, undefined);
  assert.equal(detail.uploadedByUserId, undefined);
});

// ── Product primary image link + ordered gallery ──────────────────────────

test("product primary image link is created and reflected in product media as card/detail/thumbnail URLs", async () => {
  const { asset } = await upload();
  const product = await createSellerProduct({
    shopId: "shop-media-test-001", name: "Oud Primary Test", price: 100, category: "perfume",
    primaryMediaAssetId: asset.id,
  });

  assert.equal(product.imagePath, asset.urls.card);
  assert.equal(product.primaryImage.card, asset.urls.card);

  const media = await getProductMedia(product.id);
  assert.equal(media.primaryImage.card, asset.urls.card);
  assert.equal(media.primaryImage.detail, asset.urls.detail);
  assert.equal(media.images[0].card, asset.urls.card);
});

test("seller can create a Draft product without media", async () => {
  const product = await createSellerProduct({
    shopId: "shop-media-test-001",
    name: "Draft Without Media",
    price: 100,
    category: "perfume",
    status: "Draft",
  });

  assert.equal(product.status, "Draft");
  assert.equal(product.imagePath, null);
});

test("seller cannot create a default Needs approval product without a primary image", async () => {
  await assert.rejects(
    createSellerProduct({ shopId: "shop-media-test-001", name: "Missing Media", price: 100, category: "perfume" }),
    (error) => {
      assert.equal(error.status, 422);
      assert.equal(error.message, "A primary product image is required before submitting for approval.");
      return true;
    }
  );
  assert.equal(seedRepository.getState().products.length, 0);
});

test("client raw imagePath cannot satisfy new product submission", async () => {
  await assert.rejects(
    createSellerProduct({
      shopId: "shop-media-test-001",
      name: "Raw URL Attempt",
      price: 100,
      category: "perfume",
      imagePath: "https://example.com/raw.jpg",
    }),
    (error) => { assert.equal(error.status, 422); return true; }
  );
  assert.equal(seedRepository.getState().products.length, 0);
});

test("failed media link during product creation leaves no Product or ProductMediaLink", async () => {
  const { asset } = await upload();
  __setProductMediaFailureStepForTests("after-delete");

  await assert.rejects(
    createSellerProduct({
      shopId: "shop-media-test-001",
      name: "Rollback Product",
      price: 100,
      category: "perfume",
      primaryMediaAssetId: asset.id,
    }),
    (error) => { assert.equal(error.status, 599); return true; }
  );

  assert.equal(seedRepository.getState().products.length, 0);
  assert.equal(seedRepository.getState().productMediaLinks.length, 0);
  assert.equal(seedRepository.getState().mediaAssets.length, 1, "uploaded MediaAsset remains reusable in My Media");
});

test("seller updates Draft to Needs approval with an active primary image", async () => {
  const { asset } = await upload();
  const product = await createSellerProduct({
    shopId: "shop-media-test-001",
    name: "Draft Submit With Media",
    price: 100,
    category: "perfume",
    status: "Draft",
  });

  const updated = await updateSellerProduct(product.id, "shop-media-test-001", {
    status: "Needs approval",
    primaryMediaAssetId: asset.id,
  });

  assert.equal(updated.status, "Needs approval");
  assert.equal(updated.primaryImage.card, asset.urls.card);
});

test("Draft to Needs approval without image is rejected", async () => {
  const product = await createSellerProduct({
    shopId: "shop-media-test-001",
    name: "Draft Submit Missing Media",
    price: 100,
    category: "perfume",
    status: "Draft",
  });

  await assert.rejects(
    updateSellerProduct(product.id, "shop-media-test-001", { status: "Needs approval" }),
    (error) => { assert.equal(error.status, 422); return true; }
  );
  assert.equal(seedRepository.getState().products[0].status, "Draft");
});

test("quarantined primary cannot satisfy seller submission", async () => {
  const { asset } = await upload();
  await updateMediaModeration(asset.id, "quarantine");
  const product = await createSellerProduct({
    shopId: "shop-media-test-001",
    name: "Draft Submit Quarantined",
    price: 100,
    category: "perfume",
    status: "Draft",
  });

  await assert.rejects(
    updateSellerProduct(product.id, "shop-media-test-001", { status: "Needs approval", primaryMediaAssetId: asset.id }),
    (error) => { assert.equal(error.status, 422); return true; }
  );
});

test("cross-shop media remains rejected during new product submission", async () => {
  const { asset } = await upload({ ownerId: "shop-media-test-002", shopId: "shop-media-test-002" });

  await assert.rejects(
    createSellerProduct({
      shopId: "shop-media-test-001",
      name: "Cross Shop Submission",
      price: 100,
      category: "perfume",
      primaryMediaAssetId: asset.id,
    }),
    (error) => { assert.equal(error.status, 403); return true; }
  );
});

test("legacy existing product may resubmit when no MediaAsset links exist and imagePath is present", async () => {
  const state = seedRepository.getState();
  state.products.push({
    id: "legacy-resubmit-001",
    shopId: "shop-media-test-001",
    name: "Legacy Resubmit",
    price: 100,
    category: "perfume",
    status: "Draft",
    imagePath: "/uploads/legacy-product.jpg",
  });

  const updated = await updateSellerProduct("legacy-resubmit-001", "shop-media-test-001", { status: "Needs approval" });
  assert.equal(updated.status, "Needs approval");
});

test("admin cannot set image-less product Live", async () => {
  seedRepository.getState().products.push({
    id: "admin-imageless-001",
    shopId: "shop-media-test-001",
    name: "Imageless Admin Block",
    price: 100,
    category: "perfume",
    status: "Needs approval",
    imagePath: "",
  });

  await assert.rejects(
    updateProductStatus("admin-imageless-001", "Live", { role: "admin", sub: "admin-media-test" }),
    (error) => { assert.equal(error.status, 422); return true; }
  );
});

test("admin can set product with active primary Live", async () => {
  const { asset } = await upload();
  const product = await createSellerProduct({
    shopId: "shop-media-test-001",
    name: "Admin Live With Image",
    price: 100,
    category: "perfume",
    primaryMediaAssetId: asset.id,
  });

  const live = await updateProductStatus(product.id, "Live", { role: "admin", sub: "admin-media-test" });
  assert.equal(live.status, "Live");
});

test("admin cannot set product with quarantined or rejected primary Live", async () => {
  const { asset: quarantined } = await upload();
  const quarantinedProduct = await createSellerProduct({
    shopId: "shop-media-test-001",
    name: "Admin Live Quarantined",
    price: 100,
    category: "perfume",
    primaryMediaAssetId: quarantined.id,
  });
  await updateMediaModeration(quarantined.id, "quarantine");

  await assert.rejects(
    updateProductStatus(quarantinedProduct.id, "Live", { role: "admin", sub: "admin-media-test" }),
    (error) => { assert.equal(error.status, 422); return true; }
  );

  const { asset: rejected } = await upload();
  const rejectedProduct = await createSellerProduct({
    shopId: "shop-media-test-001",
    name: "Admin Live Rejected",
    price: 100,
    category: "perfume",
    primaryMediaAssetId: rejected.id,
  });
  await updateMediaModeration(rejected.id, "reject");

  await assert.rejects(
    updateProductStatus(rejectedProduct.id, "Live", { role: "admin", sub: "admin-media-test" }),
    (error) => { assert.equal(error.status, 422); return true; }
  );
});

test("admin can approve a genuine legacy imagePath product", async () => {
  const state = seedRepository.getState();
  state.products.push({
    id: "legacy-live-001",
    shopId: "shop-media-test-001",
    name: "Legacy Live",
    price: 100,
    category: "perfume",
    status: "Needs approval",
    imagePath: "/uploads/legacy-live.jpg",
  });

  const live = await updateProductStatus("legacy-live-001", "Live", { role: "admin", sub: "admin-media-test" });
  assert.equal(live.status, "Live");
});

test("stale mirrored imagePath does not satisfy approval when product has unavailable media links", async () => {
  const { asset } = await upload();
  const product = await createSellerProduct({
    shopId: "shop-media-test-001",
    name: "Stale Mirror",
    price: 100,
    category: "perfume",
    primaryMediaAssetId: asset.id,
  });
  await updateMediaModeration(asset.id, "quarantine");
  assert.ok(seedRepository.getState().products.find((item) => item.id === product.id).imagePath);

  await assert.rejects(
    updateProductStatus(product.id, "Live", { role: "admin", sub: "admin-media-test" }),
    (error) => { assert.equal(error.status, 422); return true; }
  );
});

test("gallery order is preserved", async () => {
  const { asset: primary } = await upload();
  const { asset: g1 } = await upload();
  const { asset: g2 } = await upload();
  const { asset: g3 } = await upload();

  const product = await createSellerProduct({ shopId: "shop-media-test-001", name: "Gallery Order Test", price: 100, category: "perfume", status: "Draft" });
  await applyProductMediaLinks(product.id, "shop-media-test-001", {
    primaryMediaAssetId: primary.id,
    galleryMediaAssetIds: [g3.id, g1.id, g2.id],
  });

  const media = await getProductMedia(product.id);
  assert.deepEqual(media.images.map((i) => i.card), [primary.urls.card, g3.urls.card, g1.urls.card, g2.urls.card]);
});

test("seed media replacement restores old links after delete failure point and retry succeeds", async () => {
  const { asset: oldPrimary } = await upload();
  const { asset: oldGallery } = await upload();
  const { asset: nextPrimary } = await upload();
  const product = await createSellerProduct({
    shopId: "shop-media-test-001",
    name: "Replace Rollback Delete",
    price: 100,
    category: "perfume",
    primaryMediaAssetId: oldPrimary.id,
    galleryMediaAssetIds: [oldGallery.id],
  });
  const oldImagePath = product.imagePath;

  __setProductMediaFailureStepForTests("after-delete");
  await assert.rejects(
    applyProductMediaLinks(product.id, "shop-media-test-001", { primaryMediaAssetId: nextPrimary.id, galleryMediaAssetIds: [] }),
    (error) => { assert.equal(error.status, 599); return true; }
  );

  let media = await getProductMedia(product.id);
  assert.equal(media.primaryMediaAssetId, oldPrimary.id);
  assert.deepEqual(media.galleryMediaAssetIds, [oldGallery.id]);
  assert.equal(seedRepository.getState().products.find((item) => item.id === product.id).imagePath, oldImagePath);

  __resetProductMediaFailureStepForTests();
  media = await applyProductMediaLinks(product.id, "shop-media-test-001", { primaryMediaAssetId: nextPrimary.id, galleryMediaAssetIds: [] });
  assert.equal(media.primaryMediaAssetId, nextPrimary.id);
  assert.deepEqual(media.galleryMediaAssetIds, []);
});

test("seed media replacement restores old links after insert failure point", async () => {
  const { asset: oldPrimary } = await upload();
  const { asset: oldGallery } = await upload();
  const { asset: nextPrimary } = await upload();
  const product = await createSellerProduct({
    shopId: "shop-media-test-001",
    name: "Replace Rollback Insert",
    price: 100,
    category: "perfume",
    primaryMediaAssetId: oldPrimary.id,
    galleryMediaAssetIds: [oldGallery.id],
  });

  __setProductMediaFailureStepForTests("after-insert");
  await assert.rejects(
    applyProductMediaLinks(product.id, "shop-media-test-001", { primaryMediaAssetId: nextPrimary.id, galleryMediaAssetIds: [] }),
    (error) => { assert.equal(error.status, 599); return true; }
  );

  const media = await getProductMedia(product.id);
  assert.equal(media.primaryMediaAssetId, oldPrimary.id);
  assert.deepEqual(media.galleryMediaAssetIds, [oldGallery.id]);
});

test("seed media replacement restores old links and imagePath after imagePath update failure point", async () => {
  const { asset: oldPrimary } = await upload();
  const { asset: oldGallery } = await upload();
  const { asset: nextPrimary } = await upload();
  const product = await createSellerProduct({
    shopId: "shop-media-test-001",
    name: "Replace Rollback ImagePath",
    price: 100,
    category: "perfume",
    primaryMediaAssetId: oldPrimary.id,
    galleryMediaAssetIds: [oldGallery.id],
  });
  const oldImagePath = product.imagePath;

  __setProductMediaFailureStepForTests("after-image-path");
  await assert.rejects(
    applyProductMediaLinks(product.id, "shop-media-test-001", { primaryMediaAssetId: nextPrimary.id, galleryMediaAssetIds: [] }),
    (error) => { assert.equal(error.status, 599); return true; }
  );

  const media = await getProductMedia(product.id);
  assert.equal(media.primaryMediaAssetId, oldPrimary.id);
  assert.deepEqual(media.galleryMediaAssetIds, [oldGallery.id]);
  assert.equal(seedRepository.getState().products.find((item) => item.id === product.id).imagePath, oldImagePath);
});

// ── Cross-shop and quarantined/rejected attachment rejected ──────────────

test("cross-shop media attachment is rejected", async () => {
  const { asset: otherShopAsset } = await upload({ ownerId: "shop-media-test-002", shopId: "shop-media-test-002" });
  const product = await createSellerProduct({ shopId: "shop-media-test-001", name: "Cross Shop Test", price: 100, category: "perfume", status: "Draft" });

  await assert.rejects(
    applyProductMediaLinks(product.id, "shop-media-test-001", { primaryMediaAssetId: otherShopAsset.id }),
    (error) => { assert.equal(error.status, 403); return true; }
  );
});

test("quarantined and rejected media cannot be newly attached to a product", async () => {
  const { asset: quarantinedAsset } = await upload();
  await updateMediaModeration(quarantinedAsset.id, "quarantine");
  const { asset: rejectedAsset } = await upload();
  await updateMediaModeration(rejectedAsset.id, "reject");

  const product = await createSellerProduct({ shopId: "shop-media-test-001", name: "Bad Media Test", price: 100, category: "perfume", status: "Draft" });

  await assert.rejects(
    applyProductMediaLinks(product.id, "shop-media-test-001", { primaryMediaAssetId: quarantinedAsset.id }),
    (error) => { assert.equal(error.status, 422); return true; }
  );
  await assert.rejects(
    applyProductMediaLinks(product.id, "shop-media-test-001", { primaryMediaAssetId: rejectedAsset.id }),
    (error) => { assert.equal(error.status, 422); return true; }
  );
});

// ── Referenced media cannot be deleted; unreferenced can, and variants are removed ──

test("media referenced by a product cannot be deleted", async () => {
  const { asset } = await upload();
  await createSellerProduct({ shopId: "shop-media-test-001", name: "Ref Delete Test", price: 100, category: "perfume", primaryMediaAssetId: asset.id });

  await assert.rejects(
    deleteSellerMedia("shop-media-test-001", asset.id),
    (error) => { assert.equal(error.status, 409); return true; }
  );
  await assert.rejects(
    deleteAdminMedia(asset.id),
    (error) => { assert.equal(error.status, 409); return true; }
  );
});

test("unreferenced media can be deleted safely by its owning seller, and its stored variants are removed from disk", async () => {
  const { asset } = await upload();
  const cardPath = path.join(testUploadsDir, asset.urls.card.replace(/^\/uploads\//, ""));
  await fs.readFile(cardPath); // exists before delete

  const result = await deleteSellerMedia("shop-media-test-001", asset.id);
  assert.equal(result.ok, true);

  await assert.rejects(
    getSellerMediaById("shop-media-test-001", asset.id),
    (error) => { assert.equal(error.status, 404); return true; }
  );
  await assert.rejects(fs.readFile(cardPath), "the card variant file should have been deleted from disk");
});

test("detaching media from a product does not delete the underlying MediaAsset", async () => {
  const { asset } = await upload();
  const product = await createSellerProduct({ shopId: "shop-media-test-001", name: "Detach Test", price: 100, category: "perfume", primaryMediaAssetId: asset.id });

  await applyProductMediaLinks(product.id, "shop-media-test-001", { primaryMediaAssetId: null, galleryMediaAssetIds: [] });

  const media = await getProductMedia(product.id);
  assert.equal(media.primaryImage, null);

  const stillThere = await getSellerMediaById("shop-media-test-001", asset.id);
  assert.equal(stillThere.id, asset.id);
  assert.equal(stillThere.referenceCount, 0);
});

test("getProductMedia excludes quarantined/rejected assets even if still linked", async () => {
  const { asset } = await upload();
  const product = await createSellerProduct({ shopId: "shop-media-test-001", name: "Quarantine Visibility Test", price: 100, category: "perfume", primaryMediaAssetId: asset.id });

  await updateMediaModeration(asset.id, "quarantine");

  const media = await getProductMedia(product.id);
  assert.equal(media.primaryImage, null);
  assert.deepEqual(media.images, []);
});

// ── Max gallery size ─────────────────────────────────────────────────────

test("a product may have at most 10 images total", async () => {
  const assets = [];
  for (let i = 0; i < 11; i += 1) {
    const { asset } = await upload();
    assets.push(asset);
  }
  const product = await createSellerProduct({ shopId: "shop-media-test-001", name: "Too Many Images Test", price: 100, category: "perfume", status: "Draft" });

  await assert.rejects(
    applyProductMediaLinks(product.id, "shop-media-test-001", {
      primaryMediaAssetId: assets[0].id,
      galleryMediaAssetIds: assets.slice(1).map((a) => a.id),
    }),
    (error) => { assert.equal(error.status, 422); return true; }
  );
});

// ── S3 upload/DB failure cleanup (Task 9) ─────────────────────────────────

function createFakeS3Client({ failOn } = {}) {
  const store = new Map();
  const client = new S3Client({ region: "us-east-1", credentials: { accessKeyId: "test-key", secretAccessKey: "test-secret" } });
  client.send = async (command) => {
    const name = command.constructor.name;
    if (failOn && name === failOn.command && failOn.match(command.input)) {
      throw new Error(failOn.message || "Simulated failure");
    }
    if (name === "PutObjectCommand") { store.set(command.input.Key, true); return {}; }
    if (name === "DeleteObjectsCommand") {
      const keys = command.input.Delete.Objects.map((o) => o.Key);
      const deleted = [];
      for (const key of keys) { if (store.has(key)) { store.delete(key); deleted.push({ Key: key }); } }
      return { Deleted: deleted, Errors: [] };
    }
    throw new Error(`Unhandled command: ${name}`);
  };
  return { client, store };
}

test("a partial variant upload failure rolls back every already-uploaded variant for that asset and creates no MediaAsset", async () => {
  __setStorageModeForTests("s3");
  // Fail specifically on the "detail" key -- thumbnail and card must have
  // already been "uploaded" to the fake bucket by the time this throws.
  const { client, store } = createFakeS3Client({
    failOn: { command: "PutObjectCommand", match: (input) => input.Key.endsWith("/detail.webp"), message: "simulated network failure" },
  });
  __setS3ClientForTests(client);

  await assert.rejects(
    upload(),
    (error) => { assert.equal(error.status, 502); return true; }
  );

  assert.equal(store.size, 0, "thumbnail/card should have been rolled back after the detail upload failed");
  const all = await listAdminMedia({});
  assert.equal(all.total, 0, "no MediaAsset should exist for a failed upload");
});

test("a DB failure after successful S3 upload cleans up every uploaded variant", async () => {
  __setStorageModeForTests("s3");
  const { client, store } = createFakeS3Client();
  __setS3ClientForTests(client);

  const originalCreate = MediaAsset.create;
  // seed mode never calls MediaAsset.create (env.mongoUri is empty in this
  // suite), so simulate the failure at the seed-mode insert point instead
  // by monkey-patching the seed state push to throw once.
  const state = seedRepository.getState();
  const originalUnshift = state.mediaAssets.unshift.bind(state.mediaAssets);
  state.mediaAssets.unshift = () => { throw new Error("simulated DB failure"); };

  try {
    await assert.rejects(upload(), /simulated DB failure/);
  } finally {
    state.mediaAssets.unshift = originalUnshift;
    MediaAsset.create = originalCreate;
  }

  assert.equal(store.size, 0, "every uploaded variant should have been cleaned up after the DB insert failed");
});

// ── Safe S3 deletion: DB record only soft-deletes after ALL variants succeed ──

function rawAssetRecord(assetId) {
  return seedRepository.getState().mediaAssets.find((m) => m.id === assetId);
}

/**
 * A deletion-focused fake client: unlike createFakeS3Client (all-or-nothing
 * per command), this reports per-key Deleted/Errors -- exactly like real
 * S3's DeleteObjects, and exactly what's needed to simulate "2 of 3 variants
 * deleted fine, 1 failed" rather than the whole request throwing.
 */
function createDeletionFakeS3Client({ failKeys = [] } = {}) {
  const client = new S3Client({ region: "us-east-1", credentials: { accessKeyId: "test-key", secretAccessKey: "test-secret" } });
  const calls = [];
  client.send = async (command) => {
    calls.push(command.constructor.name);
    if (command.constructor.name !== "DeleteObjectsCommand") throw new Error(`Unhandled command: ${command.constructor.name}`);
    const keys = command.input.Delete.Objects.map((o) => o.Key);
    const deleted = [];
    const errors = [];
    for (const key of keys) {
      if (failKeys.includes(key)) errors.push({ Key: key, Code: "InternalError", Message: "Simulated transient failure" });
      // A key that's already absent from the (real) bucket is not an error
      // in S3 -- DeleteObjects reports it deleted regardless, which is
      // exactly the idempotency this fake mirrors.
      else deleted.push({ Key: key });
    }
    return { Deleted: deleted, Errors: errors };
  };
  return { client, calls };
}

test("card deletion failing (thumbnail succeeds) keeps the MediaAsset active with storage keys intact, and returns 502", async () => {
  const { asset } = await upload();
  const rawAsset = rawAssetRecord(asset.id);
  const cardKey = rawAsset.variants.card.storageKey;

  __setStorageModeForTests("s3");
  const { client } = createDeletionFakeS3Client({ failKeys: [cardKey] });
  __setS3ClientForTests(client);

  await assert.rejects(
    deleteSellerMedia("shop-media-test-001", asset.id),
    (error) => { assert.equal(error.status, 502); return true; }
  );

  // Still fully visible/active -- not hidden from admin cleanup tools, and
  // every storage key is untouched (nothing was cleared on the record).
  // Switch back to local mode purely so this lookup's URL resolution step
  // doesn't itself need the (unset, in this test file) real S3 bucket.
  __setStorageModeForTests("local");
  const stillThere = await getSellerMediaById("shop-media-test-001", asset.id);
  assert.equal(stillThere.status, "active");
  assert.deepEqual(rawAssetRecord(asset.id).variants, rawAsset.variants);
});

test("a variant that's already absent from storage is treated as a successful deletion, not a failure", async () => {
  const { asset } = await upload();
  __setStorageModeForTests("s3");
  // No failKeys at all -- every key, including a hypothetically-already-gone
  // "detail" object, comes back in Deleted (S3's real idempotent behavior).
  const { client } = createDeletionFakeS3Client({ failKeys: [] });
  __setS3ClientForTests(client);

  const result = await deleteSellerMedia("shop-media-test-001", asset.id);
  assert.equal(result.ok, true);
  await assert.rejects(
    getSellerMediaById("shop-media-test-001", asset.id),
    (error) => { assert.equal(error.status, 404); return true; }
  );
});

test("retrying after a transient deletion failure succeeds once the underlying issue clears, and is idempotent", async () => {
  const { asset } = await upload();
  const rawAsset = rawAssetRecord(asset.id);
  const cardKey = rawAsset.variants.card.storageKey;

  __setStorageModeForTests("s3");
  const failing = createDeletionFakeS3Client({ failKeys: [cardKey] });
  __setS3ClientForTests(failing.client);

  await assert.rejects(deleteSellerMedia("shop-media-test-001", asset.id), (error) => { assert.equal(error.status, 502); return true; });
  assert.equal(rawAssetRecord(asset.id).status, "active", "must still be active after the failed attempt");

  // Same asset, retried -- this time nothing fails.
  const recovered = createDeletionFakeS3Client({ failKeys: [] });
  __setS3ClientForTests(recovered.client);

  const result = await deleteSellerMedia("shop-media-test-001", asset.id);
  assert.equal(result.ok, true);
  assert.equal(rawAssetRecord(asset.id).status, "deleted");
});

test("all three variants deleting successfully results in the MediaAsset being marked deleted", async () => {
  const { asset } = await upload();
  __setStorageModeForTests("s3");
  const { client } = createDeletionFakeS3Client({ failKeys: [] });
  __setS3ClientForTests(client);

  await deleteAdminMedia(asset.id);
  assert.equal(rawAssetRecord(asset.id).status, "deleted");
});

test("a referenced asset is rejected with 409 before any storage deletion is attempted", async () => {
  const { asset } = await upload();
  await createSellerProduct({ shopId: "shop-media-test-001", name: "Delete Guard Test", price: 100, category: "perfume", primaryMediaAssetId: asset.id });

  __setStorageModeForTests("s3");
  const { client, calls } = createDeletionFakeS3Client({ failKeys: [] });
  __setS3ClientForTests(client);

  await assert.rejects(
    deleteSellerMedia("shop-media-test-001", asset.id),
    (error) => { assert.equal(error.status, 409); return true; }
  );
  assert.equal(calls.length, 0, "no S3 delete call should have been made for a still-referenced asset");
});
