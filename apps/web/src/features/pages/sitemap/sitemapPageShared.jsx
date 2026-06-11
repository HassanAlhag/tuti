import { ArrowRight, CheckCircle2, Gift, PackageCheck, PauseCircle, ShoppingBag, Sparkles, User } from "lucide-react";
import { formatCurrency } from "@tuti/shared/utils/money.js";

export function PageHero({ kicker, title, text, children }) {
  return (
    <section className="sitemap-hero">
      <span className="eyebrow">{kicker}</span>
      <h1>{title}</h1>
      <p>{text}</p>
      {children ? <div className="sitemap-hero-actions">{children}</div> : null}
    </section>
  );
}

export function FeatureGrid({ items, icon: Icon = Sparkles, onNavigate }) {
  return (
    <section className="sitemap-grid">
      {items.map((item) => (
        <article className="sitemap-card" key={item.title}>
          <span className="sitemap-card-icon"><Icon size={20} /></span>
          <h2>{item.title}</h2>
          <p>{item.text || item.description}</p>
          {item.path ? (
            <button className="ghost-action compact" onClick={() => onNavigate(item.path)} type="button">
              Explore
              <ArrowRight size={15} />
            </button>
          ) : null}
        </article>
      ))}
    </section>
  );
}

export function formatOrderDate(value) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatPaymentMethod(method) {
  if (method === "cod") return "Cash on delivery";
  if (method === "card") return "Card payment";
  return method || "Payment method pending";
}

export function customerResolutionSummary(resolutionDecision) {
  if (!resolutionDecision) return null;
  const liabilityText = {
    seller_fault: "The seller will follow up and make it right.",
    customer_fault: "We did not find a seller-side issue with the delivery.",
    mixed: "We reviewed the case and recorded the outcome.",
    inconclusive: "We reviewed the case and recorded the outcome.",
  }[resolutionDecision.liability] || "We reviewed the case and recorded the outcome.";

  return {
    status: resolutionDecision.status || "decided",
    refundDecision: resolutionDecision.refundDecision || "none",
    orderDecision: resolutionDecision.orderDecision || "keep_order",
    codResolution: resolutionDecision.codResolution || "no_refund_due",
    message: liabilityText,
    decidedAt: resolutionDecision.decidedAt || null,
    executedAt: resolutionDecision.executedAt || null,
  };
}

export function formatResolutionValue(value) {
  return String(value || "—").replace(/_/g, " ");
}

export function formatDeliverySummary(order) {
  if (!order?.deliveryDate) return "Delivery slot not set";
  return `${formatOrderDate(order.deliveryDate)}${order.deliveryTime ? ` at ${order.deliveryTime}` : ""}`;
}

export function getCheckoutModeLabel(mode, authenticated) {
  if (mode === "account") return authenticated ? "Signed in" : "Account checkout";
  return "Guest checkout";
}

export const ORDER_TIMELINE_STEPS = [
  "Pending",
  "Confirmed",
  "Processing",
  "Ready for Delivery",
  "Shipped",
  "Delivered",
  "Customer Accepted",
  "Disputed",
  "Cancelled",
  "Refunded",
];

export function getOrderItemCount(order) {
  return (order?.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

export function getCartLineKey(item) {
  return item?.cartLineId || item?.id;
}

export function isCakeLikeItem(item) {
  return item?.category === "cake" || item?.category === "dessert";
}

export function isGiftLikeItem(item) {
  return item?.category === "gift_box" || item?.category === "bundle";
}

export function hasItemFacts(item) {
  return Boolean(
    item?.servings ||
    item?.leadTimeDays ||
    item?.allergens?.length ||
    item?.includes?.length
  );
}

export function hasItemMetadata(item) {
  const metadata = item?.metadata || {};
  return Boolean(metadata.cakeWriting || metadata.itemMessage || metadata.allergyNote || metadata.giftWrap);
}

export function hasItemConfiguration(item) {
  return item?.configuration?.type === "build_your_box";
}

export function getConfiguredBoxParts(item) {
  if (!hasItemConfiguration(item)) return null;
  const configuration = item.configuration || {};
  return {
    perfume: configuration.selectedPerfume,
    treat: configuration.selectedTreat,
    totalPrice: configuration.totalPrice,
  };
}

export function ItemFacts({ item }) {
  if (!hasItemFacts(item)) return null;
  return (
    <div className="checkout-item-facts">
      {item.servings ? <span>Serves {item.servings}</span> : null}
      {item.leadTimeDays ? <span>{item.leadTimeDays === 1 ? "Same-day lead" : `${item.leadTimeDays}-day lead`}</span> : null}
      {item.allergens?.length ? <span>Allergens: {item.allergens.join(", ")}</span> : null}
      {item.includes?.length ? <span>Includes: {item.includes.slice(0, 3).join(", ")}</span> : null}
    </div>
  );
}

export function ItemConfigurationSummary({ item }) {
  const parts = getConfiguredBoxParts(item);
  if (!parts) return null;
  const { perfume, treat, totalPrice } = parts;
  return (
    <div className="checkout-item-configuration-summary">
      {perfume?.name ? <span><strong>Perfume:</strong> {perfume.name}</span> : null}
      {treat?.name ? <span><strong>Treat:</strong> {treat.name}</span> : null}
      {totalPrice ? <span><strong>Box total:</strong> {formatCurrency(totalPrice)}</span> : null}
    </div>
  );
}

export function ItemMetadataSummary({ item }) {
  if (!hasItemMetadata(item)) return null;
  const metadata = item.metadata || {};
  return (
    <div className="checkout-item-metadata-summary">
      {metadata.cakeWriting ? <span><strong>Cake writing:</strong> {metadata.cakeWriting}</span> : null}
      {metadata.itemMessage ? <span><strong>Item message:</strong> {metadata.itemMessage}</span> : null}
      {metadata.allergyNote ? <span><strong>Allergy note:</strong> {metadata.allergyNote}</span> : null}
      {metadata.giftWrap ? <span><strong>Gift wrap:</strong> Requested</span> : null}
    </div>
  );
}

export function OrderStatusTimeline({ order }) {
  const history = Array.isArray(order?.statusHistory) ? order.statusHistory : [];
  const normalizedHistory = history
    .map((entry) => ({
      to: entry?.to || entry?.status || "",
      at: entry?.changedAt || entry?.createdAt || null,
      note: entry?.note || "",
    }))
    .filter((entry) => entry.to);
  const activeStatuses = new Set(normalizedHistory.map((entry) => entry.to));
  if (order?.status) activeStatuses.add(order.status);

  return (
    <div className="account-order-timeline">
      <strong>Delivery timeline</strong>
      <div className="account-order-timeline-list">
        {ORDER_TIMELINE_STEPS.map((status) => {
          const statusEntry = normalizedHistory.find((entry) => entry.to === status);
          const isActive = activeStatuses.has(status);
          return (
            <div className={isActive ? "account-order-timeline-step active" : "account-order-timeline-step"} key={`${order?.orderId}-${status}`}>
              <span>{status}</span>
              {statusEntry?.at ? <small>{new Date(statusEntry.at).toLocaleString()}</small> : <small>Not reached</small>}
              {statusEntry?.note ? <p>{statusEntry.note}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function compactOrderItem(item) {
  const orderItem = {
    productId: item.id,
    productName: item.name,
    shopId: item.shopId,
    price: item.price,
    quantity: item.quantity,
  };

  const optionalScalarFields = [
    "category",
    "family",
    "gender",
    "size",
    "cakeType",
    "servings",
    "leadTimeDays",
  ];
  const optionalArrayFields = [
    "flavors",
    "allergens",
    "bundledProductIds",
    "includes",
    "occasionTags",
  ];

  for (const field of optionalScalarFields) {
    if (item[field] !== undefined && item[field] !== null && item[field] !== "") {
      orderItem[field] = item[field];
    }
  }

  for (const field of optionalArrayFields) {
    if (Array.isArray(item[field]) && item[field].length) {
      orderItem[field] = item[field];
    }
  }

  if (item.metadata && typeof item.metadata === "object") {
    orderItem.metadata = item.metadata;
  }
  if (item.configuration && typeof item.configuration === "object") {
    orderItem.configuration = item.configuration;
  }

  return orderItem;
}
