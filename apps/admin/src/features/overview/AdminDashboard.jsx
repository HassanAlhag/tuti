import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BadgeDollarSign,
  BarChart2,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock,
  CreditCard,
  Crown,
  Eye,
  FileText,
  Headphones,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  PauseCircle,
  Phone,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingBag,
  Settings2,
  SlidersHorizontal,
  Star,
  Ticket,
  Truck,
  UserCheck,
  UserCog,
  UserCircle,
  Users,
  WalletCards,
  Warehouse,
  XCircle,
} from "lucide-react";
import { marketplaceApi, ordersApi } from "@tuti/shared/api/client.js";
import { NotificationBell } from "@tuti/shared/components/NotificationBell.jsx";
import { brand } from "@tuti/shared/brand.js";
import { BottleArt } from "@tuti/shared/components/BottleArt.jsx";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { MetricCard } from "@tuti/shared/components/MetricCard.jsx";
import { PageTitle } from "@tuti/shared/components/PageTitle.jsx";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";
import { StatusBadge } from "@tuti/shared/components/StatusBadge.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import { computeSellerHealth } from "@tuti/shared/utils/sellerHealth.js";
import { DEFAULT_COMMISSION_PLANS } from "@tuti/shared/constants/commission.js";
import { getAllowedOrderActions, getAllowedProductActions } from "@tuti/shared/workflows";
import { AdminUsers } from "../users/AdminUsers.jsx";
import { AdminCRM } from "../crm/AdminCRM.jsx";
import { AdminDrivers } from "../drivers/AdminDrivers.jsx";
import { AdminOperationsDashboard } from "../operations/AdminOperationsDashboard.jsx";
import { AdminPayouts } from "../payouts/AdminPayouts.jsx";
import { AdminSellerPipeline } from "../sellers/AdminSellerPipeline.jsx";
import { AdminSupportTickets } from "../support-tickets/AdminSupportTickets.jsx";
import {
  CONTRACT_ACTIONS,
  FlowStep,
  PRODUCT_ACTION_META,
  RuleControl,
  SellerPaymentRulesPanel,
  TimelineItem,
  formatCaseStatusLabel,
  getContractControlActions,
  getSellerHealth,
  managementRiskClass,
  riskClass,
} from "../shared/adminConsoleShared.jsx";

export function AdminDashboard({ adminData, analyticsSummary, updatePayout, updateProductStatus }) {
  const pendingProducts = adminData.products.filter((product) => product.status === "Needs approval");
  const fallbackDisputeHold = adminData.payments.filter((payment) => payment.status === "Dispute hold").length;
  const fallbackPayoutHold = adminData.payments.filter((payment) => payment.status === "Payout hold").length;
  const fallbackCodOrders = (adminData.orders || []).filter((order) => String(order.paymentMethod || "").toLowerCase() === "cod").length;
  const fallbackDeliveredGmv = (adminData.orders || [])
    .filter((order) => ["Delivered", "Customer Accepted"].includes(order.status))
    .reduce((sum, order) => sum + Number(order.subtotal || 0), 0);
  const financeOperational = analyticsSummary?.financeOperational || {
    disputeHold: fallbackDisputeHold,
    payoutHold: fallbackPayoutHold,
    codOrders: fallbackCodOrders,
    deliveredGmv: fallbackDeliveredGmv,
  };
  const atRiskCustomers = (adminData.customers || []).filter((customer) => customer.openTickets > 0 || customer.risk !== "Low");
  const sellerWatch = adminData.shops.filter((shop) => shop.status !== "Approved" || shop.disputeRate >= 2 || shop.fulfillmentRate < 92);
  const urgentQueues = [
    {
      icon: ClipboardCheck,
      label: "Pending products",
      value: pendingProducts.length,
      detail: pendingProducts.length
        ? `${pendingProducts.length} items waiting for approval`
        : "No approvals are waiting right now.",
      tone: pendingProducts.length ? "warning" : "success",
    },
    {
      icon: AlertTriangle,
      label: "Dispute holds",
      value: financeOperational.disputeHold,
      detail: financeOperational.disputeHold
        ? `${financeOperational.disputeHold} cases need support review`
        : "No active dispute holds.",
      tone: financeOperational.disputeHold ? "danger" : "success",
    },
    {
      icon: Warehouse,
      label: "Seller watch",
      value: sellerWatch.length,
      detail: sellerWatch.length
        ? "Pending review, fulfillment drift, or dispute pressure."
        : "No sellers are currently on watch.",
      tone: sellerWatch.length ? "warning" : "success",
    },
    {
      icon: LockKeyhole,
      label: "COD / payout holds",
      value: `${financeOperational.codOrders}/${financeOperational.payoutHold}`,
      detail: "Operational finance markers that stay under admin control.",
      tone: financeOperational.codOrders || financeOperational.payoutHold ? "brand" : "success",
    },
  ];

  return (
    <main className="workspace">
      <PageTitle
        kicker="Admin dashboard"
        title="Tuti control room"
        description="Approve inventory, protect payments, monitor shop quality, and release payouts from one place."
      />

      {/* Platform status strip */}
      <div className="ac-status-strip">
        <div className="ac-status-item">
          <strong>{adminData.products.length}</strong>
          <span>Products</span>
        </div>
        <div className={`ac-status-item${pendingProducts.length ? " ac-status-item--warn" : " ac-status-item--brand"}`}>
          <strong>{pendingProducts.length}</strong>
          <span>Need approval</span>
        </div>
        <div className={`ac-status-item${sellerWatch.length ? " ac-status-item--warn" : ""}`}>
          <strong>{sellerWatch.length}</strong>
          <span>Seller watch</span>
        </div>
        <div className={`ac-status-item${atRiskCustomers.length ? " ac-status-item--amber" : ""}`}>
          <strong>{atRiskCustomers.length}</strong>
          <span>Client follow-ups</span>
        </div>
        <div className={`ac-status-item${financeOperational.disputeHold ? " ac-status-item--danger" : ""}`}>
          <strong>{financeOperational.disputeHold}</strong>
          <span>Disputes</span>
        </div>
        <div className="ac-status-item ac-status-item--brand">
          <strong>{financeOperational.codOrders}</strong>
          <span>COD orders</span>
        </div>
      </div>

      <section className="ac-priority-grid">
        {urgentQueues.map(({ icon: Icon, label, value, detail, tone }) => (
          <article className={`ac-priority-card ac-priority-card--${tone}`} key={label}>
            <span className="ac-priority-icon"><Icon size={16} /></span>
            <div className="ac-priority-copy">
              <strong>{label}</strong>
              <div className="ac-priority-value">{value}</div>
              <p>{detail}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="metric-grid ac-metric-grid">
        <MetricCard icon={CircleDollarSign} label="Delivered GMV" value={formatCurrency(financeOperational.deliveredGmv)} note="Delivered + customer accepted" />
        <MetricCard icon={BadgeDollarSign} label="COD orders" value={financeOperational.codOrders} note="Operational volume" />
        <MetricCard icon={LockKeyhole} label="Payout hold" value={financeOperational.payoutHold} note="Order marker count" />
        <MetricCard icon={WalletCards} label="Dispute hold" value={financeOperational.disputeHold} note="Needs support review" />
      </section>
      <p className="muted-label">{financeOperational.note || "COD operational markers only. No payment gateway or payout execution."}</p>

      <section className="ops-command-grid ac-ops-grid">
        <article className="ops-command-card">
          <span><ClipboardCheck size={18} /></span>
          <div>
            <strong>{pendingProducts.length} product approval{pendingProducts.length === 1 ? "" : "s"}</strong>
            <p>Review seller submissions before they reach the storefront.</p>
          </div>
        </article>
        <article className="ops-command-card">
          <span><AlertTriangle size={18} /></span>
          <div>
            <strong>{financeOperational.disputeHold} dispute hold{financeOperational.disputeHold === 1 ? "" : "s"}</strong>
            <p>Keep open cases visible until support has a clear resolution path.</p>
          </div>
        </article>
        <article className="ops-command-card">
          <span><Warehouse size={18} /></span>
          <div>
            <strong>{sellerWatch.length} seller account{sellerWatch.length === 1 ? "" : "s"} on watch</strong>
            <p>Verification, fulfillment, and dispute signals are grouped here.</p>
          </div>
        </article>
        <article className="ops-command-card">
          <span><LockKeyhole size={18} /></span>
          <div>
            <strong>{financeOperational.codOrders} COD / {financeOperational.payoutHold} payout holds</strong>
            <p>Finance markers stay visible until reserve and delivery checks pass.</p>
          </div>
        </article>
      </section>

      <section className="dashboard-grid two-columns">
        <section className="panel">
          <PanelHeader icon={ClipboardCheck} title="Product approvals" action={`${pendingProducts.length} pending`} />
          <div className="approval-list">
            {pendingProducts.length ? (
              pendingProducts.map((product) => (
                <div className="approval-row" key={product.id}>
                  <BottleArt product={product} compact />
                  <div>
                    <strong>{product.name}</strong>
                    {product.sellerLastEditedAt && (
                      <span className="ac-resubmit-badge">
                        Re-submitted · {new Date(product.sellerLastEditedAt).toLocaleDateString()}
                      </span>
                    )}
                    <span>{product.family || product.cakeType || "Product"} · {formatCurrency(product.price)} · {product.stock} in stock</span>
                    <span className="ac-approval-shop">{adminData.shops.find((s) => s.id === product.shopId)?.name || "Unknown shop"} · {product.category}</span>
                  </div>
                  <div className="row-actions">
                    {getAllowedProductActions(product.status, "admin").map((status) => {
                      const meta = PRODUCT_ACTION_META[status];
                      if (!meta) return null;
                      const Icon = meta.Icon;
                      return (
                        <button
                          className={meta.className}
                          key={status}
                          onClick={() => updateProductStatus(product.id, status)}
                          title={meta.title}
                          type="button"
                        >
                          <Icon size={18} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState icon={CheckCircle2} text="No product approval is waiting." />
            )}
          </div>
        </section>

        <section className="panel">
          <PanelHeader icon={Star} title="Shop quality ranking" action="Weighted score" />
          <div className="rank-list shop-rank-list">
            {adminData.rankings.topShops.map((shop, index) => (
              <div className="rank-row" key={shop.id}>
                <span className="rank-index">{index + 1}</span>
                <div className="shop-avatar">{shop.avatar}</div>
                <div>
                  <strong>{shop.name}</strong>
                  <span>{shop.city} · {shop.fulfillmentRate}% fulfillment</span>
                </div>
                <strong>{shop.score}</strong>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="panel">
        <PanelHeader icon={WalletCards} title="Payout approvals" action="Release only after reserve checks" />
        <div className="payout-grid">
          {adminData.payouts.map((payout) => {
            const shop = adminData.shops.find((item) => item.id === payout.shopId);
            return (
              <article className="payout-tile" key={payout.id}>
                <div>
                  <span className="muted-label">{payout.id}</span>
                  <h3>{shop?.name}</h3>
                  <p>{payout.orders} order{payout.orders === 1 ? "" : "s"} · {payout.method}</p>
                </div>
                <strong>{formatCurrency(payout.amount)}</strong>
                <StatusBadge status={payout.status} />
                <div className="button-pair">
                  <button className="secondary-action compact" onClick={() => updatePayout(payout.id, "Approved")} type="button">
                    <CheckCircle2 size={16} />
                    Approve
                  </button>
                  <button className="ghost-action compact" onClick={() => updatePayout(payout.id, "On hold")} type="button">
                    <PauseCircle size={16} />
                    Hold
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
