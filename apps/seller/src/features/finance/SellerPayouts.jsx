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
import { marketplaceApi, ordersApi, sellerDeliveryOffersApi, sellerDriversApi, sellerFinanceApi, supportTicketsApi, uploadApi } from "@tuti/shared/api/client.js";
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

/* ─── Payouts ──────────────────────────────────────────────────── */
export function SellerPayouts({ seller }) {
  const shop = seller?.shop;
  const { user } = useAuthStore();

  const { data: balanceData } = useQuery({
    queryKey: ["seller-balance"],
    queryFn:  () => sellerFinanceApi.getBalance(),
    enabled:  Boolean(user),
  });
  // request() already unwraps payload.data
  const balance = balanceData ?? {
    pendingBalance:   shop?.pendingBalance || 0,
    availableBalance: 0, holdBalance: 0, paidBalance: 0,
  };

  const { data: payoutsData } = useQuery({
    queryKey: ["seller-payouts"],
    queryFn:  () => sellerFinanceApi.getPayouts({ limit: 20 }),
    enabled:  Boolean(user),
  });
  const payoutHistory = payoutsData?.payouts || [];

  if (!shop) return <EmptyState icon={WalletCards} text="Loading payout data…" />;

  return (
    <div className="sd-section">
      <div className="sd-section-header">
        <div>
          <h2 className="sd-section-title">Payouts</h2>
          <p className="sd-section-sub">Net revenue after commission and reserve hold</p>
        </div>
      </div>

      <section className="sd-metric-grid">
        <MetricCard icon={WalletCards}     label="Pending"     value={formatCurrency(balance.pendingBalance)}   note={`${shop.payoutHoldDays}-day hold`} />
        <MetricCard icon={BadgeDollarSign} label="Available"   value={formatCurrency(balance.availableBalance)} note="Ready for payout" />
        <MetricCard icon={ShieldCheck}     label="On hold"     value={formatCurrency(balance.holdBalance)}      note="Frozen in dispute" />
        <MetricCard icon={CheckCircle2}    label="Total paid"  value={formatCurrency(balance.paidBalance)}      note="All time" />
      </section>

      <div className="sd-panel">
        <PanelHeader icon={WalletCards} title="Payout policy" action="Admin controlled" />
        <div className="sd-payout-rules">
          {[
            { icon: CheckCircle2, cls: "success", title: `Reserve: ${shop.payoutHoldDays} days`,  body: "Funds held after delivery to cover refunds and disputes." },
            { icon: CheckCircle2, cls: "success", title: `Commission: ${shop.commissionRate}%`,    body: "Platform fee deducted automatically before each payout." },
            { icon: ShieldCheck,  cls: "brand",   title: "Dispute protection",                     body: "Payouts paused during disputes, reviewed by support team." },
            { icon: CreditCard,   cls: "",        title: "Payment method",                         body: "Bank transfer or connected account. Contact support to update." },
          ].map(({ icon: Icon, cls, title, body }) => (
            <div className="sd-payout-rule" key={title}>
              <Icon size={16} className={`sd-rule-icon${cls ? ` sd-rule-icon--${cls}` : ""}`} />
              <div>
                <strong>{title}</strong>
                <p>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payout history */}
      <div className="sd-panel">
        <PanelHeader icon={BadgeDollarSign} title="Payout history" action={`${payoutHistory.length} record${payoutHistory.length !== 1 ? "s" : ""}`} />
        {payoutHistory.length === 0 ? (
          <EmptyState icon={WalletCards} text="No payouts processed yet. Earnings appear here once admin initiates a payout." />
        ) : (
          <div className="sd-order-preview">
            {payoutHistory.map((p) => (
              <div className="sd-order-preview-row" key={p.id}>
                <div className="sd-order-id-col">
                  <strong>{p.id}</strong>
                  <span>{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}</span>
                </div>
                <span className="sd-order-customer">{p.method?.replace(/_/g, " ") || "—"}</span>
                <strong className="sd-order-amount">{formatCurrency(p.amount)}</strong>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
