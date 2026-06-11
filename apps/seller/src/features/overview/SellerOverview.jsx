import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  BarChart2,
  Cake,
  CalendarClock,
  CheckCircle2,
  ArrowRight,
  ClipboardCheck,
  CreditCard,
  Clock,
  Gift,
  Headphones,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  PackageCheck,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Ticket,
  TrendingUp,
  Truck,
  Upload,
  Users,
  WalletCards,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BottleArt } from "@tuti/shared/components/BottleArt.jsx";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { MetricCard } from "@tuti/shared/components/MetricCard.jsx";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";
import { StatusBadge } from "@tuti/shared/components/StatusBadge.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import { computeSellerHealth } from "@tuti/shared/utils/sellerHealth.js";
import { marketplaceApi, ordersApi, sellerBrandProfileApi, sellerDeliveryOffersApi, sellerDriversApi, sellerFinanceApi, supportTicketsApi, uploadApi } from "@tuti/shared/api/client.js";
import { useAuthStore } from "@tuti/shared/store/authStore.js";
import { GENDER_OPTIONS, SCENT_FAMILIES } from "@tuti/shared/constants";
import { getAllowedOrderActions } from "@tuti/shared/workflows";
import {
  SellerChecklistPanel,
  SellerInsightCard,
  SellerPageHeader,
  SellerQueuePanel,
} from "../shared/SellerDashboardPrimitives.jsx";
import {
  DEFAULT_BY_TYPE,
  SHOP_CATEGORIES,
  SHOP_TYPE_META,
  SupportPill,
  SellerSupportTicketDetail,
  driverMatchesBroadcastZone,
  driverStatusTone,
  formatCaseStatusLabel,
  formatDriverStatus,
  formatDriverVehicle,
  formatOfferCountdown,
  formatOfferExpiry,
  formatResolutionLabel,
  formatSellerOrderStatusLabel,
  formatSupportCategory,
  formatSupportDate,
  getShopType,
  getSellerPrimaryAction,
  getStockHealth,
  isDriverAssignableOrder,
  isSellerDriverActive,
  orderNextAction,
  ownShopOrder,
  productTypeLabel,
  renderOrderItemSummary,
  renderOrderMetadata,
  resolveOrderDeliveryZone,
  SUPPORT_CATEGORY_OPTIONS,
  SUPPORT_PRIORITY_OPTIONS,
  SUPPORT_STATUS_OPTIONS,
  supportOrderLabel,
  supportPriorityTone,
  supportStatusTone,
} from "../shared/sellerDashboardHelpers.jsx";

function getClientBaseUrl() {
  return import.meta.env?.VITE_CLIENT_URL || "http://localhost:5173";
}

function buildPublicBrandUrl(slug) {
  if (!slug) return "";
  try {
    return new URL(`/sellers/${encodeURIComponent(slug)}`, getClientBaseUrl()).toString();
  } catch {
    return "";
  }
}

/* ─── Overview ─────────────────────────────────────────────────── */
export function SellerOverview({ seller }) {
  const shop     = seller?.shop;
  const products = seller?.products || [];
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [planDrafts, setPlanDrafts] = useState({});
  const [planErrors, setPlanErrors] = useState({});
  const [localPlanUpdates, setLocalPlanUpdates] = useState({});

  const { data: ordersData } = useQuery({
    queryKey: ["orders", user?.sub],
    queryFn:  () => ordersApi.list({ limit: 5 }),
    enabled:  Boolean(user),
  });
  const recentOrders = ordersData?.orders || [];

  const { data: balanceData } = useQuery({
    queryKey: ["seller-balance"],
    queryFn:  () => sellerFinanceApi.getBalance(),
    enabled:  Boolean(user),
  });
  // request() already unwraps payload.data — fall back to shop.pendingBalance before first load.
  const balance = balanceData ?? {
    pendingBalance:   shop?.pendingBalance || 0,
    availableBalance: 0,
    holdBalance:      0,
    paidBalance:      0,
  };

  const { data: payoutsListData } = useQuery({
    queryKey: ["seller-payouts"],
    queryFn:  () => sellerFinanceApi.getPayouts({ limit: 5 }),
    enabled:  Boolean(user),
  });
  const sellerPayouts = payoutsListData?.payouts || [];

  const shopId = shop?.id || user?.shopId || "";
  const brandProfileQuery = useQuery({
    queryKey: ["seller-brand-profile-summary", shopId],
    queryFn: sellerBrandProfileApi.get,
    enabled: Boolean(shopId),
  });
  const brandProfile = brandProfileQuery.data || null;
  const brandSlug = brandProfile?.slug || "";
  const brandUrl = buildPublicBrandUrl(brandSlug);
  const brandCompleteness = Number.isFinite(brandProfile?.completenessScore) ? brandProfile.completenessScore : 0;
  const brandPublished = Boolean(brandProfile?.published);

  if (!shop) return <EmptyState icon={Store} text="Loading shop data…" />;

  const shopType = getShopType(shop);
  const { label: typeLabel, Icon: TypeIcon } = SHOP_TYPE_META[shopType];

  const liveProducts    = products.filter((p) => p.status === "Live").length;
  const pendingProducts = products.filter((p) => p.status !== "Live").length;
  const lowStock        = products.filter((p) => p.stock <= 5);
  const sales           = products.reduce((s, p) => s + p.price * (p.orders || 0), 0);
  const openOrders      = recentOrders.filter((o) => ["Pending", "Confirmed", "Processing", "Ready for Delivery"].includes(o.status));
  const codOrders       = recentOrders.filter((o) => o.paymentMethod === "cod");
  const health     = computeSellerHealth(shop, products);
  const shopHealth = health.score;
  const adminNotices = Array.isArray(shop.adminNotices) ? shop.adminNotices : [];
  const activeNotice = adminNotices.find((notice) => notice.type === "action_plan_request") || adminNotices[0] || null;
  const submitPlanMutation = useMutation({
    mutationFn: ({ noticeId, plan }) => marketplaceApi.submitSellerActionPlan(noticeId, plan),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seller-data"] });
      qc.invalidateQueries({ queryKey: ["seller"] });
      qc.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey.some((part) => typeof part === "string" && part.toLowerCase().includes("seller")),
      });
    },
    onError: (error, vars) => {
      setPlanErrors((current) => ({
        ...current,
        [vars.noticeId]: error?.message || "Unable to submit the action plan.",
      }));
    },
  });
  const approvalRatio   = products.length ? Math.round((liveProducts / products.length) * 100) : 0;
  const nextOrders      = openOrders.slice(0, 4).map((order) => ({
    id: order.orderId,
    title: `${order.orderId} · ${order.customerName}`,
    detail: `${order.deliveryDate || "No date"} ${order.deliveryTime || ""} · ${orderNextAction(order)}`,
    meta: formatCurrency(order.subtotal),
    tone: order.paymentMethod === "cod" ? "amber" : "brand",
  }));
  const checklist = [
    {
      label: "Storefront readiness",
      detail: `${liveProducts} live products and ${pendingProducts} waiting for approval`,
      state: liveProducts ? "Ready" : "Needs products",
      status: liveProducts ? "success" : "warning",
      icon: PackageCheck,
    },
    {
      label: "Inventory health",
      detail: lowStock[0] ? `${lowStock[0].name} has ${lowStock[0].stock} left` : "No urgent restock signals",
      state: lowStock.length ? `${lowStock.length} low` : "Healthy",
      status: lowStock.length ? "warning" : "success",
      icon: AlertTriangle,
    },
    {
      label: "Payment reserve",
      detail: `${shop.payoutHoldDays}-day reserve protects refunds and disputes`,
      state: formatCurrency(shop.pendingBalance),
      status: shop.pendingBalance > 0 ? "brand" : "success",
      icon: ShieldCheck,
    },
    {
      label: "Service score",
      detail: `${shop.fulfillmentRate}% fulfillment with ${shop.serviceRating} shop rating`,
      state: `${shopHealth}%`,
      status: shopHealth >= 80 ? "success" : "warning",
      icon: Star,
    },
  ];

  return (
    <div className="sd-section">
      <SellerPageHeader
        eyebrow="Seller workspace"
        title="Today’s control room"
        subtitle="Manage products, orders, cash collection, and payout readiness from one place."
        meta={(
          <span className="sd-type-pill sd-type-pill--sm">
            <TypeIcon size={12} />
            {typeLabel}
          </span>
        )}
      />

      {/* Quick status strip */}
      <div className="sd-status-strip">
        <div className="sd-status-item">
          <strong>{products.length}</strong>
          <span>Total products</span>
        </div>
        <div className="sd-status-item sd-status-item--brand">
          <strong>{liveProducts}</strong>
          <span>Live</span>
        </div>
        {pendingProducts > 0 && (
          <div className="sd-status-item sd-status-item--warn">
            <strong>{pendingProducts}</strong>
            <span>Pending approval</span>
          </div>
        )}
        <div className={`sd-status-item${openOrders.length ? " sd-status-item--amber" : ""}`}>
          <strong>{openOrders.length}</strong>
          <span>Open orders</span>
        </div>
        {lowStock.length > 0 && (
          <div className="sd-status-item sd-status-item--danger">
            <strong>{lowStock.length}</strong>
            <span>Low stock</span>
          </div>
        )}
      </div>

      <section className="sd-next-actions">
        <article className={`sd-next-action-card${openOrders.length ? " sd-next-action-card--brand" : ""}`}>
          <span className="sd-next-action-icon"><ShoppingBag size={15} /></span>
          <div>
            <strong>{openOrders.length ? `${openOrders.length} open order${openOrders.length === 1 ? "" : "s"}` : "No open orders"}</strong>
            <p>{openOrders[0] ? `${openOrders[0].orderId} · ${orderNextAction(openOrders[0])}` : "Your queue is clear for now."}</p>
          </div>
        </article>
        <article className={`sd-next-action-card${lowStock.length ? " sd-next-action-card--warn" : ""}`}>
          <span className="sd-next-action-icon"><AlertTriangle size={15} /></span>
          <div>
            <strong>{lowStock.length ? `${lowStock.length} low-stock item${lowStock.length === 1 ? "" : "s"}` : "Inventory looks healthy"}</strong>
            <p>{lowStock[0] ? `${lowStock[0].name} · ${lowStock[0].stock} left` : "No immediate refill needed."}</p>
          </div>
        </article>
        <article className={`sd-next-action-card${activeNotice ? " sd-next-action-card--rose" : ""}`}>
          <span className="sd-next-action-icon"><ShieldCheck size={15} /></span>
          <div>
            <strong>{activeNotice ? "Admin notice to review" : "No active notices"}</strong>
            <p>{activeNotice ? `${activeNotice.type === "action_plan_request" ? "Action plan requested" : "Contract note"} · ${activeNotice.note}` : "Keep selling clean to stay in good standing."}</p>
          </div>
        </article>
      </section>

      <section className="sd-panel sd-brand-cta-panel">
        <PanelHeader
          icon={Sparkles}
          title="Build your brand page"
          action={brandPublished ? <span className="sd-brand-status sd-brand-status--published">Live</span> : <span className="sd-brand-note">Publish your page to make this link public.</span>}
        />
        <div className="sd-brand-cta-body">
          <div className="sd-brand-cta-copy">
            <strong>{brandProfile?.displayName || shop?.name || "Your fragrance brand"}</strong>
            <p>
              {brandProfile
                ? `${brandCompleteness}% complete · ${brandSlug ? `slug ${brandSlug}` : "slug will appear after save"}`
                : "Start with a logo, story, and fragrance identity."}
            </p>
            <small>
              {brandUrl
                ? `Public page URL: ${brandUrl}`
                : "Your public page URL will appear after your first save."}
            </small>
          </div>
          <div className="sd-brand-cta-actions">
            <a className="primary-action compact" href="/seller/brand?section=brand">Open Brand</a>
            {brandPublished && brandUrl ? (
              <a className="secondary-action compact" href={brandUrl} target="_blank" rel="noreferrer">
                View public page
              </a>
            ) : (
              <span className="sd-brand-note">Publish your page to make this link public.</span>
            )}
          </div>
        </div>
      </section>

      {/* Shop hero banner */}
      <div className={`sd-shop-hero sd-shop-hero--${shopType}`}>
        <div className="sd-shop-hero-main">
          <div className="sd-shop-hero-top">
            <span className="sd-type-pill">
              <TypeIcon size={12} />
              {typeLabel}
            </span>
            <StatusBadge status={shop.status} />
          </div>
          <h2 className="sd-shop-hero-name">{shop.name}</h2>
          <p className="sd-shop-hero-sub">{shop.city}</p>
        </div>
        <div className="sd-shop-hero-stats">
          <div className="sd-hero-stat">
            <strong>{shop.serviceRating}</strong>
            <span>Rating</span>
          </div>
          <div className="sd-hero-stat">
            <strong>{shop.fulfillmentRate}%</strong>
            <span>Fulfillment</span>
          </div>
          <div className="sd-hero-stat">
            <strong>{shop.commissionRate}%</strong>
            <span>Commission</span>
          </div>
          <div className="sd-hero-stat">
            <strong>{shop.payoutHoldDays}d</strong>
            <span>Reserve</span>
          </div>
        </div>
      </div>

      {/* Account Health */}
      <section className="sd-panel sd-health-section">
        <div className="sd-health-body">
          <div className="sd-health-score-col">
            <div className={`sd-health-ring sd-health-ring--${health.tone}`}>
              <strong>{health.score}</strong>
              <span>/100</span>
            </div>
            <span className={`sd-health-level-badge sd-health-level-badge--${health.tone}`}>{health.level}</span>
            <p>Account health</p>
          </div>
          <div className="sd-health-metrics-col">
            {health.metrics.filter((m) => !m.isPenalty).map((m) => (
              <div className="sd-health-metric" key={m.label}>
                <div className="sd-health-metric-head">
                  <span>{m.label}</span>
                  <span className="sd-health-metric-score">{m.earned}<small>/{m.max}</small></span>
                </div>
                <div className="sd-health-bar">
                  <div
                    className="sd-health-bar-fill"
                    style={{ width: `${(m.earned / m.max) * 100}%` }}
                    data-fill={m.earned / m.max >= 0.8 ? "good" : m.earned / m.max >= 0.5 ? "fair" : "poor"}
                  />
                </div>
                <span className="sd-health-metric-note">{m.detail}</span>
              </div>
            ))}
            {health.metrics.filter((m) => m.isPenalty && m.earned > 0).map((m) => (
              <div className="sd-health-metric sd-health-metric--penalty" key={m.label}>
                <div className="sd-health-metric-head">
                  <span>{m.label}</span>
                  <span className="sd-health-metric-score sd-health-metric-score--penalty">−{m.earned}<small>/{m.max}</small></span>
                </div>
                <div className="sd-health-bar">
                  <div
                    className="sd-health-bar-fill"
                    style={{ width: `${(m.earned / m.max) * 100}%` }}
                    data-fill="poor"
                  />
                </div>
                <span className="sd-health-metric-note">{m.detail}</span>
              </div>
            ))}
          </div>
        </div>
        {health.improvements.length > 0 && (
          <div className="sd-health-improvements">
            {health.improvements.map((tip, i) => (
              <span key={i} className="sd-health-tip">
                <AlertTriangle size={11} />
                {tip}
              </span>
            ))}
          </div>
        )}
        <div className="sd-contract-notice-block">
          <div className="sd-contract-notice-head">
            <ShieldCheck size={14} />
            <strong>Admin notices / Contract status</strong>
          </div>
          {adminNotices.length ? (
            <div className="sd-contract-notice-list">
              {adminNotices.map((notice) => (
                <article className="sd-contract-notice" key={notice.id}>
                  <div>
                    <strong>{notice.type === "action_plan_request" ? "Action plan request" : notice.type || "Admin notice"}</strong>
                    <small>{notice.issuedAt ? new Date(notice.issuedAt).toLocaleString() : "—"}</small>
                  </div>
                  <p>{notice.note}</p>
                  {notice.deadline ? <p><strong>Deadline:</strong> {notice.deadline}</p> : null}
                  {notice.type === "action_plan_request" ? (
                    (notice.sellerPlan || localPlanUpdates[notice.id]?.sellerPlan) ? (
                      <div className="sd-seller-plan">
                        <strong>Submitted action plan</strong>
                        <p>{notice.sellerPlan || localPlanUpdates[notice.id]?.sellerPlan}</p>
                        <small>
                          Submitted at{" "}
                          {new Date(notice.sellerPlanAt || localPlanUpdates[notice.id]?.sellerPlanAt || Date.now()).toLocaleString()}
                        </small>
                      </div>
                    ) : (
                      <div className="sd-action-plan-form">
                        <textarea
                          value={planDrafts[notice.id] || ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            setPlanDrafts((current) => ({ ...current, [notice.id]: value }));
                            setPlanErrors((current) => ({ ...current, [notice.id]: "" }));
                          }}
                          maxLength={1000}
                          placeholder="Share the concrete actions, timeline, and accountability steps you will complete."
                          rows={3}
                        />
                        {planErrors[notice.id] ? <small className="sd-action-plan-error">{planErrors[notice.id]}</small> : null}
                        <button
                          className="secondary-action compact"
                          type="button"
                          disabled={submitPlanMutation.isPending || !(planDrafts[notice.id] || "").trim()}
                          onClick={() => {
                            const plan = (planDrafts[notice.id] || "").trim();
                            if (!plan) {
                              setPlanErrors((current) => ({ ...current, [notice.id]: "Action plan is required." }));
                              return;
                            }
                            submitPlanMutation.mutate(
                              { noticeId: notice.id, plan },
                              {
                                onSuccess: () => {
                                  setLocalPlanUpdates((current) => ({
                                    ...current,
                                    [notice.id]: {
                                      sellerPlan: plan,
                                      sellerPlanAt: new Date().toISOString(),
                                    },
                                  }));
                                  setPlanDrafts((current) => ({ ...current, [notice.id]: "" }));
                                },
                              }
                            );
                          }}
                        >
                          {submitPlanMutation.isPending ? "Submitting…" : "Submit Action Plan"}
                        </button>
                      </div>
                    )
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="sd-contract-empty">
              No active admin notices. Keep fulfillment, ratings, and disputes healthy to maintain your seller contract.
            </p>
          )}
        </div>
      </section>

      <section className="sd-insight-grid">
        <SellerInsightCard icon={ClipboardCheck} label="Shop health" value={`${shopHealth}%`} detail="Products, service, inventory, payouts" />
        <SellerInsightCard icon={PackageCheck} label="Approval rate" value={`${approvalRatio}%`} detail={`${pendingProducts} item${pendingProducts !== 1 ? "s" : ""} pending`} tone="blue" />
        <SellerInsightCard icon={ShoppingBag} label="Open queue" value={openOrders.length} detail={openOrders[0] ? orderNextAction(openOrders[0]) : "No urgent orders"} tone={openOrders.length ? "amber" : "success"} />
        <SellerInsightCard icon={WalletCards} label="Cash control" value={codOrders.length} detail="COD orders needing collection check" tone={codOrders.length ? "rose" : "success"} />
      </section>

      {/* KPI row */}
      <section className="sd-metric-grid">
        <MetricCard icon={PackageCheck}    label="Live products"   value={liveProducts}                        note={`${pendingProducts} pending`} />
        <MetricCard icon={BadgeDollarSign} label="Gross sales"     value={formatCurrency(sales)}               note="All-time" />
        <MetricCard icon={Star}            label="Service rating"  value={shop.serviceRating}                  note={`${shop.fulfillmentRate}% on-time`} />
        <MetricCard icon={WalletCards}     label="Pending balance" value={formatCurrency(balance.pendingBalance)} note={balance.availableBalance > 0 ? `${formatCurrency(balance.availableBalance)} available` : `${shop.payoutHoldDays}-day hold`} />
      </section>

      <section className="sd-two-col sd-two-col--priority">
        <SellerChecklistPanel icon={ClipboardCheck} title="Seller readiness" action={`${shopHealth}% health`} items={checklist} />
        <SellerQueuePanel
          icon={Truck}
          title="Fulfillment queue"
          action={`${openOrders.length} open`}
          items={nextOrders}
          emptyIcon={Package}
          emptyText="No open orders right now."
        />
      </section>

      {/* Payout flow + recent orders */}
      <section className="sd-two-col">
        <div className="sd-panel">
          <PanelHeader icon={Truck} title="Payout flow" action="Reserve active" />
          <div className="sd-flow-list">
            {[
              { icon: CreditCard,  label: "Payment captured",  detail: "Customer funds secured by gateway." },
              { icon: Truck,       label: "Delivery completed", detail: "Driver completion starts reserve timer." },
              { icon: ShieldCheck, label: "Reserve check",      detail: "Refund and dispute window reviewed." },
              { icon: WalletCards, label: "Vendor payout",      detail: "Net released after admin rules pass." },
            ].map(({ icon: Icon, label, detail }, i) => (
              <div className="sd-flow-step" key={label}>
                <span className="sd-flow-num">{i + 1}</span>
                <span className="sd-flow-icon"><Icon size={15} /></span>
                <div>
                  <strong>{label}</strong>
                  <p>{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="sd-panel">
          <PanelHeader icon={Package} title="Recent orders" action={`${recentOrders.length} shown`} />
          {recentOrders.length === 0 ? (
            <EmptyState icon={Package} text="No orders yet." />
          ) : (
            <div className="sd-order-preview">
              {recentOrders.map((o) => (
                <div className="sd-order-preview-row" key={o.orderId}>
                  <div className="sd-order-id-col">
                    <strong>{o.orderId}</strong>
                    <span>{new Date(o.createdAt).toLocaleDateString()}</span>
                  </div>
                  <span className="sd-order-customer">{o.customerName}</span>
                  <strong className="sd-order-amount">{formatCurrency(o.subtotal)}</strong>
                  <StatusBadge status={o.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Balance summary + recent payouts */}
      {(balance.availableBalance > 0 || sellerPayouts.length > 0) && (
        <section className="sd-panel">
          <PanelHeader icon={WalletCards} title="Balance & payouts" action={formatCurrency(balance.availableBalance + balance.pendingBalance)} />
          <div className="sd-payout-strip">
            <div className="sd-payout-strip-buckets">
              {balance.pendingBalance   > 0 && <span>Pending <strong>{formatCurrency(balance.pendingBalance)}</strong></span>}
              {balance.availableBalance > 0 && <span className="sd-payout-available">Available <strong>{formatCurrency(balance.availableBalance)}</strong></span>}
              {balance.holdBalance      > 0 && <span className="sd-payout-hold">On hold <strong>{formatCurrency(balance.holdBalance)}</strong></span>}
              {balance.paidBalance      > 0 && <span>Paid out <strong>{formatCurrency(balance.paidBalance)}</strong></span>}
            </div>
            {sellerPayouts.length > 0 && (
              <div className="sd-order-preview">
                {sellerPayouts.slice(0, 3).map((p) => (
                  <div className="sd-order-preview-row" key={p.id}>
                    <div className="sd-order-id-col">
                      <strong>{p.id}</strong>
                      <span>{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}</span>
                    </div>
                    <strong className="sd-order-amount">{formatCurrency(p.amount)}</strong>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
