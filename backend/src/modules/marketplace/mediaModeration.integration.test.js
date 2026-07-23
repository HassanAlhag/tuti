import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { seedRepository } from "../../repositories/seedRepository.js";

process.env.MONGO_URI = "";
process.env.AWS_REGION = "";
process.env.AWS_S3_BUCKET = "";
process.env.AWS_ACCESS_KEY_ID = "";
process.env.AWS_SECRET_ACCESS_KEY = "";
process.env.AWS_CLOUDFRONT_DOMAIN = "";

/**
 * Task 3: proves that an already-linked primary image immediately stops
 * appearing publicly the moment it's quarantined/rejected/deleted, across
 * every public read surface -- and that the fallback order is respected:
 * (1) next active/acceptable linked image, (2) valid legacy imagePath,
 * (3) frontend category fallback (nothing to assert backend-side for that
 * last step -- it's simply "primaryImage/images both empty").
 *
 * The bug this guards against: Product.imagePath is a one-time mirror set
 * when media is first linked (see applyProductMediaLinks) and never
 * updated again. Every public serializer must gate its legacy-imagePath
 * fallback on whether the product ever had MediaAsset links at all
 * (media.hasLinks), not on whether the *current* primaryImage happens to
 * be empty -- otherwise moderating an image away silently resurrects the
 * stale pre-moderation URL instead of hiding it.
 */

const { createMediaAsset, applyProductMediaLinks, updateMediaModeration } = await import("../media/media.service.js");
const { getStorefrontData, searchProducts } = await import("./marketplace.service.js");
const { updateSellerBrandProfile, getPublicSellerProductsBySlug, __resetBrandProfilesForTests } = await import("./brandProfile.service.js");
const { createFeaturedProductPlacement, listPublicFeaturedProductPlacements, __resetFeaturedProductPlacementsForTests } = await import("./featured-products.service.js");
const { createCollection, listPublicCollections, __resetCuratedCollectionsForTests } = await import("./collections.service.js");

const SHOP = { id: "shop-modtest-001", name: "Modtest Shop", ownerId: "user-modtest-001", status: "Approved", category: "perfume", categories: ["perfume"], city: "Dubai" };

function resetState() {
  __resetBrandProfilesForTests();
  __resetFeaturedProductPlacementsForTests();
  __resetCuratedCollectionsForTests();
  const state = seedRepository.getState();
  state.mediaAssets.length = 0;
  state.productMediaLinks.length = 0;
  state.products.length = 0;
  state.shops.length = 0;
  state.shops.push({ ...SHOP });
}

let jpegBuffer;
beforeEach(async () => {
  resetState();
  jpegBuffer = await sharp({ create: { width: 1600, height: 1600, channels: 3, background: { r: 120, g: 80, b: 40 } } }).jpeg().toBuffer();
});

async function uploadAsset() {
  const { asset } = await createMediaAsset({
    ownerType: "shop", ownerId: SHOP.id, shopId: SHOP.id,
    uploadedByUserId: "user-modtest-001", uploadedByRole: "seller",
    buffer: jpegBuffer, originalFilename: "modtest.jpg",
  });
  return asset;
}

function pushLiveProduct(id) {
  const state = seedRepository.getState();
  const product = {
    id, name: "Modtest Perfume", shopId: SHOP.id, status: "Live", category: "perfume",
    price: 250, stock: 10, rating: 4.5, reviews: 10, verifiedReviews: 5,
    family: "Oud", gender: "Unisex", notes: ["oud"], occasionTags: ["gift"],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  state.products.push(product);
  return product;
}

function findById(list, id) {
  return list.find((item) => item.id === id);
}

// ── Storefront + search ─────────────────────────────────────────────────

test("storefront and search show the primary image while active, then hide it (not fall back to stale imagePath) once quarantined", async () => {
  const asset = await uploadAsset();
  pushLiveProduct("prd-modtest-storefront-001");
  await applyProductMediaLinks("prd-modtest-storefront-001", SHOP.id, { primaryMediaAssetId: asset.id });

  const before = await getStorefrontData();
  const beforeProduct = findById(before.products, "prd-modtest-storefront-001");
  assert.equal(beforeProduct.primaryImage.card, asset.urls.card);
  assert.equal(beforeProduct.imagePath, asset.urls.card);

  const searchBefore = await searchProducts({});
  const searchBeforeProduct = findById(searchBefore.results, "prd-modtest-storefront-001");
  assert.equal(searchBeforeProduct.primaryImage.card, asset.urls.card);

  await updateMediaModeration(asset.id, "quarantine");

  const after = await getStorefrontData();
  const afterProduct = findById(after.products, "prd-modtest-storefront-001");
  assert.equal(afterProduct.primaryImage, null, "quarantined image must not appear as primaryImage");
  assert.deepEqual(afterProduct.images, []);
  assert.equal(afterProduct.imagePath, null, "the stale mirrored imagePath must also be cleared, not resurrected");

  const searchAfter = await searchProducts({});
  const searchAfterProduct = findById(searchAfter.results, "prd-modtest-storefront-001");
  assert.equal(searchAfterProduct.primaryImage, null);
  assert.equal(searchAfterProduct.imagePath, null);
});

test("storefront hides a rejected primary image", async () => {
  const asset = await uploadAsset();
  pushLiveProduct("prd-modtest-rejected-001");
  await applyProductMediaLinks("prd-modtest-rejected-001", SHOP.id, { primaryMediaAssetId: asset.id });
  await updateMediaModeration(asset.id, "reject");

  const data = await getStorefrontData();
  const product = findById(data.products, "prd-modtest-rejected-001");
  assert.equal(product.primaryImage, null);
  assert.equal(product.imagePath, null);
});

test("storefront hides a deleted primary image (defensive: status filter covers 'deleted' even though normal APIs can't reach it while referenced)", async () => {
  const asset = await uploadAsset();
  pushLiveProduct("prd-modtest-deleted-001");
  await applyProductMediaLinks("prd-modtest-deleted-001", SHOP.id, { primaryMediaAssetId: asset.id });

  const state = seedRepository.getState();
  const rawAsset = state.mediaAssets.find((m) => m.id === asset.id);
  rawAsset.status = "deleted";

  const data = await getStorefrontData();
  const product = findById(data.products, "prd-modtest-deleted-001");
  assert.equal(product.primaryImage, null);
  assert.equal(product.imagePath, null);
});

test("a product that never had MediaAsset links still uses its legacy imagePath (fallback order step 2)", async () => {
  const state = seedRepository.getState();
  state.products.push({
    id: "prd-modtest-legacy-001", name: "Legacy Perfume", shopId: SHOP.id, status: "Live", category: "perfume",
    price: 150, stock: 5, imagePath: "/uploads/legacy-perfume.jpg",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });

  const data = await getStorefrontData();
  const product = findById(data.products, "prd-modtest-legacy-001");
  assert.equal(product.primaryImage.card, "/uploads/legacy-perfume.jpg");
  assert.equal(product.imagePath, "/uploads/legacy-perfume.jpg");
});

// ── Public seller/brand profile products ──────────────────────────────────

test("public seller products page hides a quarantined primary image", async () => {
  const asset = await uploadAsset();
  pushLiveProduct("prd-modtest-brand-001");
  await applyProductMediaLinks("prd-modtest-brand-001", SHOP.id, { primaryMediaAssetId: asset.id });

  const profile = await updateSellerBrandProfile(
    SHOP.id,
    { displayName: SHOP.name, brandStory: "Test brand.", published: true },
    { role: "seller", shopId: SHOP.id }
  );

  const before = await getPublicSellerProductsBySlug(profile.slug);
  const beforeProduct = findById(before, "prd-modtest-brand-001");
  assert.equal(beforeProduct.primaryImage.card, asset.urls.card);

  await updateMediaModeration(asset.id, "quarantine");

  const after = await getPublicSellerProductsBySlug(profile.slug);
  const afterProduct = findById(after, "prd-modtest-brand-001");
  assert.equal(afterProduct.primaryImage, null);
  assert.equal(afterProduct.imagePath, null);
});

// ── Featured products ─────────────────────────────────────────────────────

test("featured products placement hides a quarantined primary image and its imageUrl", async () => {
  const asset = await uploadAsset();
  pushLiveProduct("prd-modtest-featured-001");
  await applyProductMediaLinks("prd-modtest-featured-001", SHOP.id, { primaryMediaAssetId: asset.id });

  await createFeaturedProductPlacement(
    { productId: "prd-modtest-featured-001", shopId: SHOP.id, placementKey: "homepage_featured_products", active: true },
    { role: "admin", sub: "admin-modtest" }
  );

  const before = await listPublicFeaturedProductPlacements("homepage_featured_products");
  assert.equal(before.length, 1);
  assert.equal(before[0].product.primaryImage.card, asset.urls.card);
  assert.equal(before[0].imageUrl, asset.urls.card);

  await updateMediaModeration(asset.id, "quarantine");

  const after = await listPublicFeaturedProductPlacements("homepage_featured_products");
  assert.equal(after.length, 1);
  assert.equal(after[0].product.primaryImage, null);
  assert.equal(after[0].product.imagePath, null);
  assert.equal(after[0].imageUrl, "", "the placement's own imageUrl must not fall back to the stale product.imagePath either");
});

// ── Collections ────────────────────────────────────────────────────────────

test("collection product item hides a quarantined primary image and its imageUrl", async () => {
  const asset = await uploadAsset();
  pushLiveProduct("prd-modtest-collection-001");
  await applyProductMediaLinks("prd-modtest-collection-001", SHOP.id, { primaryMediaAssetId: asset.id });

  const collection = await createCollection(
    {
      title: "Modtest Collection",
      subtitle: "Test",
      description: "Test",
      placementKey: "homepage_collections",
      published: true,
      active: true,
      items: [{ type: "product", productId: "prd-modtest-collection-001", shopId: SHOP.id }],
    },
    { role: "admin", sub: "admin-modtest" }
  );

  const before = await listPublicCollections();
  const beforeCollection = before.find((c) => c.id === collection.id);
  assert.equal(beforeCollection.items[0].product.primaryImage.card, asset.urls.card);
  assert.equal(beforeCollection.items[0].imageUrl, asset.urls.card);

  await updateMediaModeration(asset.id, "quarantine");

  const after = await listPublicCollections();
  const afterCollection = after.find((c) => c.id === collection.id);
  assert.equal(afterCollection.items[0].product.primaryImage, null);
  assert.equal(afterCollection.items[0].product.imagePath, null);
  assert.equal(afterCollection.items[0].imageUrl, "", "the collection item's own imageUrl must not fall back to the stale product.imagePath either");
});

// ── Seller/admin internal payloads may still show the broken reference ────

test("seller/admin product listing keeps the raw (unfiltered) primaryMediaAssetId after quarantine, so the reference can be found and fixed", async () => {
  const { getSellerData } = await import("./marketplace.service.js");
  const asset = await uploadAsset();
  pushLiveProduct("prd-modtest-seller-001");
  await applyProductMediaLinks("prd-modtest-seller-001", SHOP.id, { primaryMediaAssetId: asset.id });
  await updateMediaModeration(asset.id, "quarantine");

  const sellerData = await getSellerData(SHOP.id);
  const product = findById(sellerData.products, "prd-modtest-seller-001");
  // The public-safe view is empty (correct)...
  assert.equal(product.primaryImage, null);
  // ...but the raw link is still there so the seller's product form can
  // show "this image is unavailable" and let them replace it.
  assert.equal(product.primaryMediaAssetId, asset.id);
});
