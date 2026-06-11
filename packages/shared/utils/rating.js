export function bayesianScore(rating, reviewCount, platformAverage = 4.2, minReviews = 12) {
  const score =
    (reviewCount / (reviewCount + minReviews)) * rating +
    (minReviews / (reviewCount + minReviews)) * platformAverage;
  return Number(score.toFixed(2));
}

export function calculateShopScore(shop, products) {
  const shopProducts = products.filter((p) => p.shopId === shop.id);
  const weightedProducts = shopProducts.length
    ? shopProducts.reduce((s, p) => s + bayesianScore(p.rating, p.reviews) * p.orders, 0) /
      shopProducts.reduce((s, p) => s + p.orders, 0)
    : 4;
  const score =
    weightedProducts * 0.58 +
    (shop.fulfillmentRate / 20) * 0.32 +
    shop.serviceRating * 0.1 -
    shop.disputeRate * 0.18;
  return Number(Math.max(0, Math.min(score, 5)).toFixed(2));
}

export function rankPerfumes(products) {
  return [...products]
    .map((p) => ({ ...p, score: bayesianScore(p.rating, p.reviews) }))
    .sort((a, b) => b.score - a.score);
}

export function rankShops(shops, products) {
  return [...shops]
    .map((s) => ({ ...s, score: calculateShopScore(s, products) }))
    .sort((a, b) => b.score - a.score);
}
