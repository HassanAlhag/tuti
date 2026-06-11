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

export const riskClass = {
  Low: "success",
  Medium: "warning",
  High: "danger",
};

export const PRODUCT_ACTION_META = {
  Live: {
    Icon: CheckCircle2,
    className: "icon-button success",
    title: "Approve",
  },
  Rejected: {
    Icon: PauseCircle,
    className: "icon-button danger",
    title: "Reject",
  },
  Draft: {
    Icon: PauseCircle,
    className: "icon-button",
    title: "Move to draft",
  },
};

export const CONTRACT_ACTIONS = {
  warning: { key: "warning", label: "Send Warning", tone: "warning", deadline: true, Icon: AlertTriangle },
  actionPlan: { key: "actionPlan", label: "Request Action Plan", tone: "warning", deadline: true, Icon: ClipboardCheck },
  suspend: { key: "suspend", label: "Suspend Seller", tone: "danger", deadline: false, Icon: PauseCircle },
  reactivate: { key: "reactivate", label: "Reactivate Seller", tone: "success", deadline: false, Icon: CheckCircle2 },
  approveSeller: { key: "reactivate", label: "Approve Seller", tone: "success", deadline: false, Icon: CheckCircle2 },
  terminate: { key: "terminate", label: "Mark for Termination", tone: "danger", deadline: false, Icon: XCircle },
};

export function getContractControlActions(shop, health) {
  if (shop.status === "Terminated") return [];
  if (shop.status === "Pending review") return [CONTRACT_ACTIONS.approveSeller];
  if (shop.status === "Suspended") return [CONTRACT_ACTIONS.reactivate, CONTRACT_ACTIONS.terminate];

  const actions = [];
  if (health.level === "At Risk") {
    actions.push(CONTRACT_ACTIONS.warning, CONTRACT_ACTIONS.actionPlan);
  } else if (health.level === "Healthy" || health.level === "Warning") {
    actions.push(CONTRACT_ACTIONS.warning);
  }

  if (shop.status === "Approved" && health.score <= 35) {
    actions.push(CONTRACT_ACTIONS.suspend);
  }

  return actions.filter((action, index, list) => list.findIndex((item) => item.key === action.key) === index);
}

export function formatCaseStatusLabel(status) {
  return String(status || "open").replace(/_/g, " ");
}

export function FlowStep({ icon: Icon, title, text }) {
  return (
    <article className="flow-step">
      <span><Icon size={20} /></span>
      <strong>{title}</strong>
      <p>{text}</p>
    </article>
  );
}

export function TimelineItem({ icon: Icon, label, detail }) {
  return (
    <div className="timeline-item">
      <span><Icon size={16} /></span>
      <div>
        <strong>{label}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}

export function RuleControl({ label, value, min, max }) {
  return (
    <label className="rule-control">
      <span>
        <strong>{label}</strong>
        <small>{value}</small>
      </span>
      <input type="range" min={min} max={max} defaultValue={parseInt(value, 10)} />
    </label>
  );
}

export function managementRiskClass(risk = "Low") {
  return riskClass[risk] || "success";
}

export function getSellerHealth(shop, pendingProducts = 0) {
  if (shop.status !== "Approved") return { label: "Needs review", tone: "warning" };
  if (shop.disputeRate >= 2.5 || shop.fulfillmentRate < 90) return { label: "Watch list", tone: "danger" };
  if (pendingProducts > 0 || shop.fulfillmentRate < 94) return { label: "Needs attention", tone: "warning" };
  return { label: "Healthy", tone: "success" };
}


export function SellerPaymentRulesPanel({ shop, onSaved }) {
  const qc = useQueryClient();
  const defaults = shop.paymentRules || {
    commissionRate:   shop.commissionRate,
    holdDays:         shop.payoutHoldDays,
    refundWindowDays: 7,
    minPayoutAmount:  500,
    manualCapture:    false,
    autoPayout:       false,
    payoutMethod:     "bank",
    notes:            "",
  };

  const [rules, setRules] = useState(defaults);
  const [saved, setSaved]   = useState(false);

  const mutation = useMutation({
    mutationFn: (r) => marketplaceApi.updateShopPaymentRules(shop.id, r),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      qc.invalidateQueries({ queryKey: ["admin-data"] });
      if (onSaved) onSaved();
    },
  });

  function field(key) {
    return (e) => setRules((prev) => ({ ...prev, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  }

  return (
    <div className="spr-panel">
      <div className="spr-panel-head">
        <Settings2 size={15} />
        <strong>Payment rules</strong>
        <span className="spr-panel-note">Overrides global admin defaults for this seller</span>
      </div>

      <div className="spr-grid">
        <label className="spr-field">
          <span>Commission rate (%)</span>
          <input type="number" min="0" max="50" step="0.5"
            value={rules.commissionRate}
            onChange={field("commissionRate")} />
        </label>
        <label className="spr-field">
          <span>Reserve hold (days)</span>
          <input type="number" min="0" max="30"
            value={rules.holdDays}
            onChange={field("holdDays")} />
        </label>
        <label className="spr-field">
          <span>Refund window (days)</span>
          <input type="number" min="0" max="60"
            value={rules.refundWindowDays}
            onChange={field("refundWindowDays")} />
        </label>
        <label className="spr-field">
          <span>Min payout (AED)</span>
          <input type="number" min="0"
            value={rules.minPayoutAmount}
            onChange={field("minPayoutAmount")} />
        </label>
        <label className="spr-field">
          <span>Payout method</span>
          <select value={rules.payoutMethod} onChange={field("payoutMethod")}>
            <option value="bank">Bank transfer</option>
            <option value="wallet">Connected wallet</option>
            <option value="cod_hold">COD hold</option>
          </select>
        </label>
        <label className="spr-field spr-field--wide">
          <span>Admin notes</span>
          <input value={rules.notes || ""} onChange={field("notes")} placeholder="Internal note about this seller's payment terms" />
        </label>
        <label className="spr-toggle">
          <input type="checkbox" checked={Boolean(rules.manualCapture)} onChange={field("manualCapture")} />
          <div>
            <strong>Manual capture</strong>
            <p>Require admin to manually capture each payment before processing.</p>
          </div>
        </label>
        <label className="spr-toggle">
          <input type="checkbox" checked={Boolean(rules.autoPayout)} onChange={field("autoPayout")} />
          <div>
            <strong>Auto payout</strong>
            <p>Release payout automatically once delivery, hold, and dispute checks pass.</p>
          </div>
        </label>
      </div>

      <div className="spr-footer">
        <button
          className="primary-action compact"
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(rules)}
        >
          <CheckCircle2 size={14} />
          {mutation.isPending ? "Saving…" : "Save rules"}
        </button>
        {saved && <span className="spr-saved">Saved</span>}
        {mutation.isError && <span className="spr-error">{mutation.error?.message}</span>}
        {rules.notes && <p className="spr-note-preview">{rules.notes}</p>}
      </div>
    </div>
  );
}
