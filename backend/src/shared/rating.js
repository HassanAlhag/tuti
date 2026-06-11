export function bayesianScore(rating, reviewCount, platformAverage = 4.2, minReviews = 12) {
  const score = (reviewCount / (reviewCount + minReviews)) * rating
    + (minReviews / (reviewCount + minReviews)) * platformAverage;

  return Number(score.toFixed(2));
}

export function calculateShopScore(shop, products) {
  const shopProducts = products.filter((product) => product.shopId === shop.id);
  const orderVolume = shopProducts.reduce((sum, product) => sum + product.orders, 0);
  const weightedProducts = orderVolume
    ? shopProducts.reduce(
        (sum, product) => sum + bayesianScore(product.rating, product.reviews) * product.orders,
        0
      ) / orderVolume
    : 4;

  const fulfillmentScore = shop.fulfillmentRate / 20;
  const disputePenalty = shop.disputeRate * 0.18;
  const score = weightedProducts * 0.58 + fulfillmentScore * 0.32 + shop.serviceRating * 0.1 - disputePenalty;

  return Number(Math.max(0, Math.min(score, 5)).toFixed(2));
}

export function rankPerfumes(products) {
  return [...products]
    .map((product) => ({
      ...product,
      score: bayesianScore(product.rating, product.reviews),
    }))
    .sort((a, b) => b.score - a.score);
}

export function rankShops(shops, products) {
  return [...shops]
    .map((shop) => ({
      ...shop,
      score: calculateShopScore(shop, products),
    }))
    .sort((a, b) => b.score - a.score);
}
