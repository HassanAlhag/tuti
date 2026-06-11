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

export function PaymentsCenter({ adminData, capturePayment, updatePayout }) {
  const authorized = adminData.payments.filter((payment) => payment.capture !== "Captured").length;
  const disputeAmount = adminData.payments
    .filter((payment) => payment.status === "Dispute hold")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const gatewaySuccess = Math.round(
    (adminData.payments.filter((payment) => payment.risk !== "High").length / adminData.payments.length) * 100
  );

  return (
    <main className="workspace">
      <PageTitle
        kicker="Payment management"
        title="Ledger, reserve, and payouts"
        description="Track every dirham from authorization to capture, payout hold, refund window, commission, and vendor payout."
      />

      <section className="metric-grid">
        <MetricCard icon={CreditCard} label="Manual captures" value={authorized} note="Needs payment action" />
        <MetricCard icon={LockKeyhole} label="Dispute hold" value={formatCurrency(disputeAmount)} note="Protected from payout" />
        <MetricCard icon={ShieldCheck} label="Gateway health" value={`${gatewaySuccess}%`} note="Low and medium risk" />
        <MetricCard icon={ReceiptText} label="Reserve rule" value="5-7 days" note="After delivery" />
      </section>

      <section className="payment-flow">
        <FlowStep icon={CreditCard} title="Authorize" text="Customer card or wallet is authorized." />
        <FlowStep icon={CircleDollarSign} title="Capture" text="Funds are captured after stock check." />
        <FlowStep icon={LockKeyhole} title="Payout hold" text="Vendor net stays pending until rules pass." />
        <FlowStep icon={Truck} title="Delivery" text="Courier completion starts reserve timer." />
        <FlowStep icon={WalletCards} title="Payout" text="Admin rule releases shop balance." />
      </section>

      <section className="dashboard-grid split-strong">
        <section className="panel">
          <PanelHeader icon={ReceiptText} title="Payment ledger" action={`${adminData.payments.length} records`} />
          <div className="payment-list">
            {adminData.payments.map((payment) => {
              const shop = adminData.shops.find((item) => item.id === payment.shopId);
              return (
                <article className="payment-row" key={payment.id}>
                  <div className="payment-main">
                    <span className="muted-label">{payment.orderId}</span>
                    <strong>{payment.customer}</strong>
                    <span>{shop?.name} · {payment.gateway}</span>
                  </div>
                  <div>
                    <strong>{formatCurrency(payment.amount)}</strong>
                    <span>Net {formatCurrency(payment.vendorNet)}</span>
                  </div>
                  <div>
                    <StatusBadge status={payment.status} />
                    <span className={`risk ${riskClass[payment.risk]}`}>{payment.risk} risk</span>
                  </div>
                  <div className="row-actions">
                    {payment.capture !== "Captured" ? (
                      <button className="secondary-action compact" onClick={() => capturePayment(payment.id)} type="button">
                        <CircleDollarSign size={16} />
                        Capture
                      </button>
                    ) : (
                      <button className="icon-button" title="View payment" type="button">
                        <Eye size={18} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="panel">
          <PanelHeader icon={SlidersHorizontal} title="Payment rules" action="Admin controlled" />
          <div className="rule-list">
            <RuleControl label="Commission" value="14%" min="8" max="20" />
            <RuleControl label="Reserve hold" value="5 days" min="1" max="14" />
            <RuleControl label="Refund reserve" value="8%" min="0" max="20" />
            <label className="toggle-row">
              <span>
                <strong>Manual capture</strong>
                <small>For new shops and medium risk orders</small>
              </span>
              <input type="checkbox" defaultChecked />
            </label>
            <label className="toggle-row">
              <span>
                <strong>Auto payout</strong>
                <small>Only when delivery, reserve, and dispute checks pass</small>
              </span>
              <input type="checkbox" />
            </label>
          </div>
        </aside>
      </section>

      <section className="dashboard-grid two-columns">
        <section className="panel">
          <PanelHeader icon={WalletCards} title="Payout queue" action="Release controls" />
          <div className="compact-stack">
            {adminData.payouts.map((payout) => {
              const shop = adminData.shops.find((item) => item.id === payout.shopId);
              return (
                <div className="compact-row" key={payout.id}>
                  <div>
                    <strong>{shop?.name}</strong>
                    <span>{payout.releaseDate} · {payout.method}</span>
                  </div>
                  <strong>{formatCurrency(payout.amount)}</strong>
                  <StatusBadge status={payout.status} />
                  <button className="icon-button success" onClick={() => updatePayout(payout.id, "Approved")} title="Approve payout" type="button">
                    <CheckCircle2 size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <PanelHeader icon={AlertTriangle} title="Audit trail" action="Recent events" />
          <div className="timeline-list">
            {adminData.auditEvents.map((event) => (
              <TimelineItem key={event} icon={ShieldCheck} label={event} detail="Logged by payment policy engine." />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
