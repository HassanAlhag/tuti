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

export function AnalyticsDashboard({ adminData, analyticsSummary }) {
  const { products, shops } = adminData;
  const summaryOrders = analyticsSummary?.orders;
  const summaryProducts = analyticsSummary?.products;
  const summaryShops = analyticsSummary?.shops;
  const summarySupport = analyticsSummary?.support;
  const financeOperational = analyticsSummary?.financeOperational || {};

  const deliveredGmv = Number(financeOperational.deliveredGmv || 0);
  const deliveredCount = Number(summaryOrders?.delivered || 0) + Number(summaryOrders?.customerAccepted || 0);
  const avgDeliveredOrder = deliveredCount ? Math.round(deliveredGmv / deliveredCount) : 0;
  const liveProducts = summaryProducts?.live ?? products.filter((p) => p.status === "Live").length;
  const pendingApprovals = summaryProducts?.needsApproval ?? products.filter((p) => p.status === "Needs approval").length;
  const approvedShops = summaryShops?.approved ?? shops.filter((s) => s.status === "Approved").length;
  const pendingReviewShops = summaryShops?.pendingReview ?? (shops.length - approvedShops);

  const riskBreakdown = {
    openSupport: summarySupport?.openSupportCases ?? 0,
    escalated: summarySupport?.escalatedSupportCases ?? 0,
    resolved: summarySupport?.resolvedSupportCases ?? 0,
  };

  const shopRows = adminData.rankings?.topShops || shops.slice(0, 5);

  return (
    <main className="workspace">
      <PageTitle
        kicker="Platform analytics"
        title="Operations overview"
        description="Operational metrics across delivery pipeline, disputes, inventory, and shop health."
      />

      <section className="metric-grid">
        <MetricCard icon={CircleDollarSign} label="Delivered GMV" value={formatCurrency(deliveredGmv)} note={`${deliveredCount} delivered/accepted orders`} />
        <MetricCard icon={BadgeDollarSign} label="COD orders" value={financeOperational.codOrders || 0} note="Order count" />
        <MetricCard icon={CreditCard} label="Avg delivered order" value={formatCurrency(avgDeliveredOrder)} note="Operational average" />
        <MetricCard icon={WalletCards} label="Dispute hold" value={financeOperational.disputeHold || 0} note="Needs support decision" />
      </section>
      <p className="muted-label">{financeOperational.note || "COD operational markers only. No payment gateway or payout execution."}</p>

      <section className="dashboard-grid two-columns">
        <section className="panel">
          <PanelHeader icon={BarChart2} title="Customer care and dispute breakdown" action={`${(summarySupport?.openSupportCases || 0) + (summarySupport?.resolvedSupportCases || 0)} cases`} />
          <div className="analytics-risk-list">
            {Object.entries(riskBreakdown).map(([level, count]) => (
              <div className="analytics-risk-row" key={level}>
                <span className={`risk ${level === "escalated" ? "high" : level === "resolved" ? "low" : "medium"}`}>{level}</span>
                <div className="risk-bar-wrap">
                  <div
                    className={`risk-bar ${level === "escalated" ? "high" : level === "resolved" ? "low" : "medium"}`}
                    style={{ width: `${Math.min(100, Number(count || 0) * 10)}%` }}
                  />
                </div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <PanelHeader icon={ClipboardCheck} title="Inventory health" action={`${products.length} total`} />
          <div className="analytics-inventory">
            <div className="inventory-stat">
              <strong>{liveProducts}</strong>
              <span>Live products</span>
            </div>
            <div className="inventory-stat warning">
              <strong>{pendingApprovals}</strong>
              <span>Pending approval</span>
            </div>
            <div className="inventory-stat">
              <strong>{approvedShops}</strong>
              <span>Approved shops</span>
            </div>
            <div className="inventory-stat">
              <strong>{pendingReviewShops}</strong>
              <span>Pending shops</span>
            </div>
          </div>
        </section>
      </section>

      <section className="panel">
        <PanelHeader icon={Star} title="Top shops by performance score" action="Weighted ranking" />
        <div className="rank-list shop-rank-list">
          {shopRows.map((shop, i) => (
            <div className="rank-row" key={shop.id}>
              <span className="rank-index">{i + 1}</span>
              <div className="shop-avatar">{shop.avatar}</div>
              <div>
                <strong>{shop.name}</strong>
                <span>{shop.city} · {shop.fulfillmentRate}% fulfillment · {shop.disputeRate}% disputes</span>
              </div>
              <div>
                <strong>{shop.score || shop.serviceRating}</strong>
                <span className="muted-label">{formatCurrency(shop.pendingBalance)} pending</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
