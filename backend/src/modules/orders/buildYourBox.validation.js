const BUILD_YOUR_BOX_PRODUCT_ID = "build-box";
const BUILD_YOUR_BOX_TYPE = "build_your_box";

function makeError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isBuildYourBoxItem(item) {
  return item?.configuration?.type === BUILD_YOUR_BOX_TYPE;
}

function requireConfigurationValue(value, message) {
  if (value === undefined || value === null || value === "") throw makeError(message, 400);
  return value;
}

function assertEqual(actual, expected, message, status = 409) {
  if (actual !== expected) throw makeError(message, status);
}

function getProductById(products, productId) {
  return products.find((product) => product.id === productId);
}

function assertBuildYourBoxShape(item, configuration) {
  assertEqual(item.productId, BUILD_YOUR_BOX_PRODUCT_ID, "Build Your Box productId must be build-box.", 400);
  assertEqual(item.category, "bundle", "Build Your Box category must be bundle.", 400);
  assertEqual(item.quantity, 1, "Build Your Box quantity must be 1.", 400);
  assertEqual(configuration.version, 1, "Build Your Box configuration version must be 1.", 400);
}

function assertConfiguredShopDoesNotConflict(configuredProduct, actualProduct, label) {
  if (!configuredProduct?.shopId) return;
  assertEqual(
    configuredProduct.shopId,
    actualProduct.shopId,
    `Build Your Box ${label} shopId conflicts with the product record.`
  );
}

export function getBuildYourBoxProductIds(items) {
  const ids = [];
  for (const item of items) {
    if (!isBuildYourBoxItem(item)) continue;
    const configuration = item.configuration || {};
    const perfumeId = configuration.selectedPerfume?.productId;
    const treatId = configuration.selectedTreat?.productId;
    if (perfumeId) ids.push(perfumeId);
    if (treatId) ids.push(treatId);
  }
  return [...new Set(ids)];
}

export function validateBuildYourBoxItems(items, products) {
  for (const item of items) {
    if (!isBuildYourBoxItem(item)) continue;

    const configuration = item.configuration || {};
    assertBuildYourBoxShape(item, configuration);

    const perfumeId = requireConfigurationValue(
      configuration.selectedPerfume?.productId,
      "Build Your Box selectedPerfume.productId is required."
    );
    const treatId = requireConfigurationValue(
      configuration.selectedTreat?.productId,
      "Build Your Box selectedTreat.productId is required."
    );

    const perfume = getProductById(products, perfumeId);
    const treat = getProductById(products, treatId);
    if (!perfume) throw makeError("Build Your Box selected perfume was not found.", 400);
    if (!treat) throw makeError("Build Your Box selected treat was not found.", 400);

    assertEqual(perfume.category || "perfume", "perfume", "Build Your Box selected perfume must be a perfume.");
    if (!["cake", "dessert"].includes(treat.category)) {
      throw makeError("Build Your Box selected treat must be a cake or dessert.", 409);
    }
    assertEqual(perfume.status, "Live", "Build Your Box selected perfume is not live.");
    assertEqual(treat.status, "Live", "Build Your Box selected treat is not live.");
    assertEqual(perfume.shopId, treat.shopId, "Build Your Box selected products must come from the same shop.");
    assertEqual(item.shopId, perfume.shopId, "Build Your Box shopId must match the selected shop.");

    assertConfiguredShopDoesNotConflict(configuration.selectedPerfume, perfume, "selected perfume");
    assertConfiguredShopDoesNotConflict(configuration.selectedTreat, treat, "selected treat");

    const expectedTotal = Number(perfume.price) + Number(treat.price);
    assertEqual(item.price, expectedTotal, "Build Your Box item price must equal selected perfume plus selected treat.");
    assertEqual(
      configuration.totalPrice,
      item.price,
      "Build Your Box configuration totalPrice must equal item price."
    );
  }
}
