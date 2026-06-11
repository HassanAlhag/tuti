export function computeSellerHealth(shop, products = []) {
  if (shop.status === "Suspended")  return { score: 0, level: "Suspended",   tone: "danger",  metrics: [], improvements: [] };
  if (shop.status === "Terminated") return { score: 0, level: "Terminated",  tone: "danger",  metrics: [], improvements: [] };
  if (shop.status !== "Approved")   return { score: 0, level: "Needs Review", tone: "warning", metrics: [], improvements: ["Contact admin to complete your shop review and get approved."] };

  const liveCount  = products.filter((p) => p.status === "Live").length;
  const totalCount = products.length;

  // fulfillmentScore: up to 40 points
  const fr = shop.fulfillmentRate || 0;
  const fulfillmentScore = fr >= 97 ? 40 : fr >= 95 ? 35 : fr >= 92 ? 28 : fr >= 90 ? 20 : fr >= 85 ? 10 : 4;

  // ratingScore: up to 30 points
  const sr = shop.serviceRating || 0;
  const ratingScore = sr >= 4.8 ? 30 : sr >= 4.5 ? 25 : sr >= 4.2 ? 18 : sr >= 4.0 ? 13 : sr >= 3.5 ? 7 : 2;

  // productScore: up to 15 points — live/total ratio
  const ratio = totalCount > 0 ? liveCount / totalCount : 0;
  const productScore = totalCount === 0 ? 0 : ratio >= 0.9 ? 15 : ratio >= 0.7 ? 12 : ratio >= 0.5 ? 8 : ratio >= 0.25 ? 4 : 2;

  // baselineScore: 10 points — placeholder until real order defect rate exists
  const baselineScore = 10;

  // disputePenalty: up to -15 points (higher rate = larger deduction)
  const dr = shop.disputeRate || 0;
  const disputePenalty = dr === 0 ? 0 : dr <= 0.5 ? 3 : dr <= 1 ? 7 : dr <= 2 ? 11 : 15;

  const score = Math.min(100, Math.max(0, fulfillmentScore + ratingScore + productScore + baselineScore - disputePenalty));
  const level = score >= 75 ? "Healthy" : score >= 55 ? "Warning" : "At Risk";
  const tone  = score >= 75 ? "success" : score >= 55 ? "warning" : "danger";

  const metrics = [
    { label: "Fulfillment",    earned: fulfillmentScore, max: 40, detail: `${fr}% on-time delivery` },
    { label: "Service rating", earned: ratingScore,      max: 30, detail: `${sr} star avg rating` },
    { label: "Live products",  earned: productScore,     max: 15, detail: totalCount > 0 ? `${liveCount} of ${totalCount} products live` : "No products yet" },
    { label: "Account base",   earned: baselineScore,    max: 10, detail: "Standing placeholder" },
    { label: "Disputes",       earned: disputePenalty,   max: 15, detail: `${dr}% dispute rate`, isPenalty: true },
  ];

  const improvements = [];
  if (fulfillmentScore < 28)   improvements.push("Confirm orders quickly and meet delivery dates to raise your fulfillment rate.");
  if (ratingScore < 18)        improvements.push("Respond to buyers promptly and resolve concerns before they escalate.");
  if (productScore < 8)        improvements.push(liveCount === 0 ? "Submit your first product to activate your storefront." : "Get more products approved to improve your live product ratio.");
  if (disputePenalty >= 7)     improvements.push("Reduce disputes with clear product descriptions and proactive customer communication.");

  return { score, level, tone, metrics, improvements };
}
