import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart2,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  Package,
  ShoppingBag,
  ShieldCheck,
  Star,
  Store,
  Ticket,
  RefreshCw,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { MetricCard } from "@tuti/shared/components/MetricCard.jsx";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";
import { StatusBadge } from "@tuti/shared/components/StatusBadge.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import { sellerPerformanceApi } from "@tuti/shared/api/client.js";

function formatDateLabel(isoDate) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatMoney(value) {
  return formatCurrency(Number(value || 0));
}

function buildTrendLabel(item) {
  return item?.label || formatDateLabel(item?.bucketStart) || "—";
}

function analyticsSummaryFallback() {
  return {
    range: { key: "30d", label: "Last 30 days", startDate: "", endDate: "" },
    sales: {
      totalOrders: 0,
      gmv: 0,
      averageOrderValue: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      refundedOrders: 0,
      disputedOrders: 0,
      trend: [],
    },
    topProducts: [],
    operations: {
      supportTicketCount: 0,
      openSupportTicketCount: 0,
      disputeCount: 0,
      cancellationRate: 0,
      refundRate: 0,
      disputeRate: 0,
      operationalAlerts: [],
    },
    catalog: {
      liveProducts: 0,
      draftProducts: 0,
      inactiveProducts: 0,
      lowStockProducts: 0,
      totalProducts: 0,
    },
    brand: {
      hasProfile: false,
      published: false,
      completenessScore: 0,
      publicSlug: "",
      publicUrl: "",
      missingFields: [],
    },
    merchandising: {
      featuredSellerPlacements: 0,
      featuredProductPlacements: 0,
      collectionMemberships: 0,
      activePlacementCount: 0,
      notes: [],
    },
    finance: {
      pendingBalance: 0,
      availableBalance: 0,
      holdBalance: 0,
      paidBalance: 0,
    },
    emptyState: {
      isNewSeller: true,
      message: "Your analytics will start filling in once orders and products are live.",
      nextActions: ["Add products", "Publish your brand page", "Share your shop"],
    },
  };
}

export function SellerAnalytics() {
  const [range, setRange] = useState("30d");

  const summaryQuery = useQuery({
    queryKey: ["seller-performance-summary", range],
    queryFn: () => sellerPerformanceApi.getSummary(range),
  });

  const summary = summaryQuery.data || null;
  const data = summary || analyticsSummaryFallback();
  const isLoading = summaryQuery.isLoading && !summary;
  const isError = Boolean(summaryQuery.error);

  const summaryCards = useMemo(() => ([
    {
      icon: ShoppingBag,
      label: "Total orders",
      value: data.sales.totalOrders,
      note: "All seller orders in range",
    },
    {
      icon: BadgeDollarSign,
      label: "GMV",
      value: formatMoney(data.sales.gmv),
      note: "Gross completed sales",
    },
    {
      icon: WalletCards,
      label: "Average order value",
      value: formatMoney(data.sales.averageOrderValue),
      note: "Completed orders only",
    },
    {
      icon: CheckCircle2,
      label: "Completed orders",
      value: data.sales.completedOrders,
      note: "Delivered and accepted",
    },
    {
      icon: AlertTriangle,
      label: "Cancelled orders",
      value: data.sales.cancelledOrders,
      note: `${data.operations.cancellationRate}% cancellation rate`,
    },
    {
      icon: RefreshCw,
      label: "Refunded orders",
      value: data.sales.refundedOrders,
      note: `${data.operations.refundRate}% refund rate`,
    },
    {
      icon: ShieldCheck,
      label: "Disputed orders",
      value: data.sales.disputedOrders,
      note: `${data.operations.disputeRate}% dispute rate`,
    },
  ]), [data]);

  if (isLoading) {
    return (
      <div className="sd-section">
        <EmptyState icon={BarChart2} text="Loading performance summary…" />
      </div>
    );
  }

  if (isError && !summary) {
    return (
      <div className="sd-section">
        <div className="sd-analytics-error">
          <AlertTriangle size={20} />
          <div>
            <strong>We couldn’t load performance analytics right now.</strong>
            <p>{summaryQuery.error?.message || "Please try again in a moment."}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sd-section sd-analytics">
      <div className="sd-page-header sd-analytics-header">
        <div className="sd-page-title-block">
          <span className="sd-page-eyebrow">Seller workspace</span>
          <h2 className="sd-section-title">Analytics</h2>
          <p className="sd-section-sub">Read-only performance, operations, merchandising, and finance state for your shop.</p>
        </div>
        <div className="sd-analytics-range-bar" role="tablist" aria-label="Performance range">
          {[
            { key: "7d", label: "7d" },
            { key: "30d", label: "30d" },
            { key: "90d", label: "90d" },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              className={`sd-analytics-range-btn${range === option.key ? " active" : ""}`}
              onClick={() => setRange(option.key)}
              aria-pressed={range === option.key}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {data.emptyState?.isNewSeller ? (
        <div className="sd-analytics-empty-banner">
          <div>
            <strong>{data.emptyState.message}</strong>
            <p>We’ll show orders, products, visibility, and support pressure here as soon as the shop starts moving.</p>
          </div>
          {Array.isArray(data.emptyState.nextActions) && data.emptyState.nextActions.length > 0 ? (
            <div className="sd-analytics-next-actions">
              {data.emptyState.nextActions.map((action) => (
                <span key={action} className="sd-analytics-chip">{action}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="sd-metric-grid sd-analytics-summary-grid">
        {summaryCards.map((card) => (
          <MetricCard
            key={card.label}
            icon={card.icon}
            label={card.label}
            value={card.value}
            note={card.note}
          />
        ))}
      </section>

      <section className="sd-two-col sd-analytics-two-col">
        <div className="sd-panel">
          <PanelHeader icon={CalendarClock} title="Trend" action={data.range?.label || "Last 30 days"} />
          {Array.isArray(data.sales.trend) && data.sales.trend.length > 0 ? (
            <div className="sd-analytics-table">
              <div className="sd-analytics-table-head sd-analytics-trend-head">
                <span>Date</span>
                <span>Orders</span>
                <span>GMV</span>
                <span>Completed</span>
                <span>Cancelled</span>
                <span>Refunded</span>
                <span>Disputed</span>
              </div>
              {data.sales.trend.map((row) => (
                <div className="sd-analytics-table-row sd-analytics-trend-row" key={`${row.bucketStart}-${row.bucketEnd}`}>
                  <strong>{buildTrendLabel(row)}</strong>
                  <span>{row.totalOrders || 0}</span>
                  <span>{formatMoney(row.gmv)}</span>
                  <span>{row.completedOrders || 0}</span>
                  <span>{row.cancelledOrders || 0}</span>
                  <span>{row.refundedOrders || 0}</span>
                  <span>{row.disputedOrders || 0}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={TrendingUp} text="No trend data yet." />
          )}
        </div>

        <div className="sd-panel">
          <PanelHeader icon={Package} title="Top products" action="By revenue" />
          {Array.isArray(data.topProducts) && data.topProducts.length > 0 ? (
            <div className="sd-analytics-table">
              <div className="sd-analytics-table-head sd-analytics-products-head">
                <span>Name</span>
                <span>Status</span>
                <span>Orders</span>
                <span>Units</span>
                <span>Revenue</span>
              </div>
              {data.topProducts.map((product) => (
                <div className="sd-analytics-table-row sd-analytics-products-row" key={product.productId || product.name}>
                  <div className="sd-analytics-product-name">
                    <strong>{product.name || "Unnamed product"}</strong>
                    {product.route ? <a href={product.route}>Open product</a> : null}
                  </div>
                  <span>
                    {product.status ? <StatusBadge status={product.status} /> : <span className="sd-analytics-muted">Unknown</span>}
                  </span>
                  <span>{product.orderCount || 0}</span>
                  <span>{product.unitsSold ?? 0}</span>
                  <span>{formatMoney(product.revenue)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Package} text="No top products yet." />
          )}
        </div>
      </section>

      <section className="sd-two-col sd-analytics-two-col">
        <div className="sd-panel">
          <PanelHeader icon={Ticket} title="Operations health" action="Support and dispute pressure" />
          <div className="sd-analytics-stack">
            <div className="sd-analytics-keyline">
              <span>Support tickets</span>
              <strong>{data.operations.supportTicketCount}</strong>
            </div>
            <div className="sd-analytics-keyline">
              <span>Open support tickets</span>
              <strong>{data.operations.openSupportTicketCount}</strong>
            </div>
            <div className="sd-analytics-keyline">
              <span>Disputes</span>
              <strong>{data.operations.disputeCount}</strong>
            </div>
            <div className="sd-analytics-rates">
              <span>Cancellation rate <strong>{data.operations.cancellationRate}%</strong></span>
              <span>Refund rate <strong>{data.operations.refundRate}%</strong></span>
              <span>Dispute rate <strong>{data.operations.disputeRate}%</strong></span>
            </div>
            {Array.isArray(data.operations.operationalAlerts) && data.operations.operationalAlerts.length > 0 ? (
              <div className="sd-analytics-chip-list">
                {data.operations.operationalAlerts.map((alert) => (
                  <span key={alert} className="sd-analytics-chip sd-analytics-chip--warn">{alert}</span>
                ))}
              </div>
            ) : (
              <p className="sd-analytics-muted">No current operational alerts.</p>
            )}
          </div>
        </div>

        <div className="sd-panel">
          <PanelHeader icon={Store} title="Catalog" action="Live / draft / inactive" />
          <div className="sd-analytics-stack">
            <div className="sd-analytics-keyline"><span>Total products</span><strong>{data.catalog.totalProducts}</strong></div>
            <div className="sd-analytics-keyline"><span>Live products</span><strong>{data.catalog.liveProducts}</strong></div>
            <div className="sd-analytics-keyline"><span>Draft products</span><strong>{data.catalog.draftProducts}</strong></div>
            <div className="sd-analytics-keyline"><span>Inactive products</span><strong>{data.catalog.inactiveProducts}</strong></div>
            <div className="sd-analytics-keyline"><span>Low stock products</span><strong>{data.catalog.lowStockProducts}</strong></div>
          </div>
        </div>
      </section>

      <section className="sd-two-col sd-analytics-two-col">
        <div className="sd-panel">
          <PanelHeader icon={Star} title="Brand" action={data.brand.hasProfile ? (data.brand.published ? "Published" : "Private") : "No profile"} />
          <div className="sd-analytics-stack">
            <div className="sd-analytics-keyline"><span>Profile status</span><strong>{data.brand.hasProfile ? "Exists" : "Not set up"}</strong></div>
            <div className="sd-analytics-keyline"><span>Public page</span><strong>{data.brand.publicUrl ? <a href={data.brand.publicUrl}>Open page</a> : "Not public yet"}</strong></div>
            <div className="sd-analytics-keyline"><span>Completeness score</span><strong>{data.brand.completenessScore}%</strong></div>
            <div className="sd-analytics-keyline"><span>Missing fields</span><strong>{Array.isArray(data.brand.missingFields) && data.brand.missingFields.length ? data.brand.missingFields.join(", ") : "All set"}</strong></div>
          </div>
        </div>

        <div className="sd-panel">
          <PanelHeader icon={TrendingUp} title="Merchandising visibility" action="Admin placements and collections" />
          <div className="sd-analytics-stack">
            <div className="sd-analytics-keyline"><span>Featured seller placements</span><strong>{data.merchandising.featuredSellerPlacements}</strong></div>
            <div className="sd-analytics-keyline"><span>Featured product placements</span><strong>{data.merchandising.featuredProductPlacements}</strong></div>
            <div className="sd-analytics-keyline"><span>Collection memberships</span><strong>{data.merchandising.collectionMemberships}</strong></div>
            <div className="sd-analytics-keyline"><span>Active placements</span><strong>{data.merchandising.activePlacementCount}</strong></div>
            {Array.isArray(data.merchandising.notes) && data.merchandising.notes.length > 0 ? (
              <div className="sd-analytics-chip-list">
                {data.merchandising.notes.map((note) => (
                  <span key={note} className="sd-analytics-chip sd-analytics-chip--brand">{note}</span>
                ))}
              </div>
            ) : (
              <p className="sd-analytics-muted">No merchandising notes yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="sd-panel">
        <PanelHeader icon={WalletCards} title="Finance state" action="Read-only balance snapshot" />
        <div className="sd-analytics-stack">
          <p className="sd-analytics-muted">These are finance balances, not sales performance.</p>
          <div className="sd-analytics-balance-grid">
            <div className="sd-analytics-balance">
              <span>Available balance</span>
              <strong>{formatMoney(data.finance.availableBalance)}</strong>
            </div>
            <div className="sd-analytics-balance">
              <span>Pending balance</span>
              <strong>{formatMoney(data.finance.pendingBalance)}</strong>
            </div>
            <div className="sd-analytics-balance">
              <span>Hold balance</span>
              <strong>{formatMoney(data.finance.holdBalance)}</strong>
            </div>
            <div className="sd-analytics-balance">
              <span>Paid balance</span>
              <strong>{formatMoney(data.finance.paidBalance)}</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
