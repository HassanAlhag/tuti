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

export function AdminSupport({ adminData, focusedOrderId = "", onFocusHandled = () => {} }) {
  const qc = useQueryClient();
  const customers = adminData.customers || [];
  const payments  = adminData.payments  || [];
  const orders = adminData.orders || [];
  const [query, setQuery] = useState("");
  const [selectedDisputeId, setSelectedDisputeId] = useState(null);
  const [internalNotes, setInternalNotes] = useState({});
  const [decisionDrafts, setDecisionDrafts] = useState({});
  const [decisionErrors, setDecisionErrors] = useState({});
  const [finalizeTargetOrderId, setFinalizeTargetOrderId] = useState(null);

  const openTickets   = customers.filter((c) => c.openTickets > 0);
  const disputeHolds  = payments.filter((p)  => p.status === "Dispute hold");
  const highRiskCases = customers.filter((c) => c.risk === "High");
  const mediumRisk    = customers.filter((c) => c.risk === "Medium");
  const resolvedToday = Math.floor(openTickets.length * 0.4);
  const disputeQueue = orders.filter(
    (order) =>
      order.status === "Disputed" ||
      order.paymentStatus === "Dispute hold" ||
      order.customerResponse?.action === "dispute"
  );
  const deliveredAwaitingCustomer = orders.filter((order) => order.status === "Delivered").length;
  const customerAcceptedCount = orders.filter((order) => order.status === "Customer Accepted").length;
  const closedCount = orders.filter((order) => ["Cancelled", "Refunded"].includes(order.status)).length;
  const selectedDispute = selectedDisputeId
    ? disputeQueue.find((order) => order.orderId === selectedDisputeId) || null
    : disputeQueue[0] || null;

  useEffect(() => {
    if (!focusedOrderId) return;
    const found = disputeQueue.find((order) => order.orderId === focusedOrderId);
    if (!found) {
      onFocusHandled("Order not found in dispute queue.");
      return;
    }
    setSelectedDisputeId(focusedOrderId);
    onFocusHandled("");
  }, [focusedOrderId, disputeQueue, onFocusHandled]);
  const supportCaseMutation = useMutation({
    mutationFn: ({ orderId, payload }) => ordersApi.updateSupportCase(orderId, payload),
    onSuccess: (_data, variables) => {
      if (variables?.payload?.action === "add_note") {
        setInternalNotes((current) => ({ ...current, [variables.orderId]: "" }));
      }
      qc.invalidateQueries({ queryKey: ["admin-data"] });
    },
  });
  const resolutionDecisionMutation = useMutation({
    mutationFn: ({ orderId, payload }) => ordersApi.updateResolutionDecision(orderId, payload),
    onSuccess: (data, variables) => {
      const saved = data?.resolutionDecision;
      if (saved && variables?.orderId) {
        setDecisionDrafts((current) => ({
          ...current,
          [variables.orderId]: {
            liability: saved.liability || "",
            refundDecision: saved.refundDecision || "",
            payoutDecision: saved.payoutDecision || "",
            orderDecision: saved.orderDecision || "",
            codResolution: saved.codResolution || "",
            decisionNote: saved.decisionNote || "",
            requiresFollowUp: Boolean(saved.requiresFollowUp),
            followUpBy: saved.followUpBy ? new Date(saved.followUpBy).toISOString().slice(0, 10) : "",
            gatewayProvider: saved.gatewayProvider || "",
            gatewayRefundIntentId: saved.gatewayRefundIntentId || "",
            gatewayRefundStatus: saved.gatewayRefundStatus || "",
          },
        }));
      }
      if (variables?.orderId) {
        setDecisionErrors((current) => ({ ...current, [variables.orderId]: "" }));
      }
      qc.invalidateQueries({ queryKey: ["admin-data"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (error, variables) => {
      if (variables?.orderId) {
        setDecisionErrors((current) => ({
          ...current,
          [variables.orderId]: error?.message || "Unable to save resolution decision.",
        }));
      }
    },
  });
  const finalizeDecisionMutation = useMutation({
    mutationFn: ({ orderId }) => ordersApi.finalizeResolutionDecision(orderId),
    onSuccess: (_data, variables) => {
      if (variables?.orderId) {
        setDecisionErrors((current) => ({ ...current, [variables.orderId]: "" }));
      }
      setFinalizeTargetOrderId(null);
      qc.invalidateQueries({ queryKey: ["admin-data"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (error, variables) => {
      if (variables?.orderId) {
        setDecisionErrors((current) => ({
          ...current,
          [variables.orderId]: error?.message || "Unable to finalize resolution decision.",
        }));
      }
    },
  });

  const priorityQueue = [...openTickets]
    .sort((a, b) => {
      const riskScore = { High: 3, Medium: 2, Low: 1 };
      return (riskScore[b.risk] || 0) - (riskScore[a.risk] || 0) || b.openTickets - a.openTickets;
    })
    .filter((c) => {
      const q = query.trim().toLowerCase();
      return !q || [c.name, c.email, c.phone, c.city].join(" ").toLowerCase().includes(q);
    });

  useEffect(() => {
    if (!selectedDispute?.orderId) return;
    setDecisionDrafts((current) => {
      if (current[selectedDispute.orderId]) return current;
      const existing = selectedDispute.resolutionDecision || {};
      return {
        ...current,
        [selectedDispute.orderId]: {
          liability: existing.liability || "",
          refundDecision: existing.refundDecision || "",
          payoutDecision: existing.payoutDecision || "",
          orderDecision: existing.orderDecision || "",
          codResolution: existing.codResolution || "",
          decisionNote: existing.decisionNote || "",
          requiresFollowUp: Boolean(existing.requiresFollowUp),
          followUpBy: existing.followUpBy ? new Date(existing.followUpBy).toISOString().slice(0, 10) : "",
          gatewayProvider: existing.gatewayProvider || "",
          gatewayRefundIntentId: existing.gatewayRefundIntentId || "",
          gatewayRefundStatus: existing.gatewayRefundStatus || "",
        },
      };
    });
  }, [selectedDispute]);

  function renderOrderMetadata(item) {
    const metadata = item?.metadata || {};
    const details = [];
    if (metadata.cakeWriting) details.push(`Cake writing: ${metadata.cakeWriting}`);
    if (metadata.allergyNote) details.push(`Allergy note: ${metadata.allergyNote}`);
    if (metadata.itemMessage) details.push(`Item message: ${metadata.itemMessage}`);
    if (metadata.giftWrap !== undefined) details.push(`Gift wrap: ${metadata.giftWrap ? "Yes" : "No"}`);
    return details;
  }

  function renderOrderItemSummary(item) {
    const base = `${item.quantity}× ${item.productName} · ${formatCurrency(item.price)}`;
    const config = item?.configuration || {};
    if (config.type !== "build_your_box") {
      return { base, details: renderOrderMetadata(item) };
    }
    const perfume = config.selectedPerfume?.name || config.selectedPerfume?.productName || "Perfume";
    const treat = config.selectedTreat?.name || config.selectedTreat?.productName || "Treat";
    return { base, details: [`Build Your Box: ${perfume} + ${treat}`, ...renderOrderMetadata(item)] };
  }

  function updateSupportCase(orderId, action, note) {
    const payload = { action };
    if (note && note.trim()) payload.note = note.trim();
    supportCaseMutation.mutate({ orderId, payload });
  }

  function updateDecisionDraft(orderId, key, value) {
    setDecisionDrafts((current) => ({
      ...current,
      [orderId]: {
        ...(current[orderId] || {}),
        [key]: value,
      },
    }));
  }

  function saveResolutionDecision(order) {
    const draft = decisionDrafts[order.orderId] || {};
    const payload = {
      liability: draft.liability,
      refundDecision: draft.refundDecision,
      payoutDecision: draft.payoutDecision,
      orderDecision: draft.orderDecision,
      codResolution: draft.codResolution,
      decisionNote: (draft.decisionNote || "").trim(),
      requiresFollowUp: Boolean(draft.requiresFollowUp),
      followUpBy: draft.requiresFollowUp ? (draft.followUpBy || null) : null,
      gatewayProvider: draft.gatewayProvider || null,
      gatewayRefundIntentId: draft.gatewayRefundIntentId || null,
      gatewayRefundStatus: draft.gatewayRefundStatus || null,
    };
    resolutionDecisionMutation.mutate({ orderId: order.orderId, payload });
  }

  function finalizeResolutionDecision(order) {
    finalizeDecisionMutation.mutate({ orderId: order.orderId });
  }

  return (
    <main className="workspace">
      <PageTitle
        kicker="Support center"
        title="Customer care & disputes"
        description="Resolve customer care cases, manage payment disputes, and monitor high-risk customer cases from one operational view."
      />

      <section className="metric-grid">
        <MetricCard icon={Ticket}       label="Open tickets"   value={openTickets.length}   note={`${resolvedToday} resolved today`} />
        <MetricCard icon={AlertTriangle} label="Dispute holds"  value={disputeHolds.length}  note={`${formatCurrency(disputeHolds.reduce((s, p) => s + p.amount, 0))} at risk`} />
        <MetricCard icon={ShieldCheck}  label="High risk"      value={highRiskCases.length} note="Needs immediate care" />
        <MetricCard icon={Clock}        label="Avg response"   value="~2h"                  note="Platform SLA target: 4h" />
      </section>

      <section className="support-triage-summary">
        <span className="support-triage-chip"><strong>{disputeQueue.length}</strong>Total disputes</span>
        <span className="support-triage-chip support-triage-chip--warn"><strong>{disputeQueue.filter((order) => order.paymentStatus === "Dispute hold").length}</strong>Dispute hold</span>
        <span className="support-triage-chip"><strong>{deliveredAwaitingCustomer}</strong>Delivered awaiting customer</span>
        <span className="support-triage-chip"><strong>{customerAcceptedCount}</strong>Customer accepted</span>
        <span className="support-triage-chip"><strong>{closedCount}</strong>Cancelled / Refunded</span>
      </section>

      <section className="support-command-strip">
        <div className="support-sla-bar">
          <span className="support-sla-label">SLA health</span>
          <div className="support-sla-track">
            <div className="support-sla-fill" style={{ width: `${Math.min(100, Math.round((resolvedToday / Math.max(1, openTickets.length + resolvedToday)) * 100))}%` }} />
          </div>
          <strong>{Math.round((resolvedToday / Math.max(1, openTickets.length + resolvedToday)) * 100)}%</strong>
        </div>
        <label className="management-search support-search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer, phone, city..." />
        </label>
      </section>

      <section className="dashboard-grid split-strong">
        <section className="panel">
          <PanelHeader icon={Headphones} title="Customer care queue" action={`${priorityQueue.length} open`} />
          <div className="support-ticket-list">
            {priorityQueue.length === 0 ? (
              <EmptyState icon={CheckCircle2} text="No open customer care cases. Great work!" />
            ) : (
              priorityQueue.map((customer) => (
                <article className="support-ticket-row" key={customer.id}>
                  <span className={`priority-dot ${riskClass[customer.risk] || "success"}`} />
                  <span className="customer-avatar support-avatar">
                    {customer.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                  </span>
                  <div className="support-ticket-body">
                    <strong>{customer.name}</strong>
                    <p>
                      <span className={`risk ${riskClass[customer.risk] || "success"}`}>{customer.risk} risk</span>
                      {" · "}
                      {customer.openTickets} open ticket{customer.openTickets !== 1 ? "s" : ""}
                      {" · "}
                      {customer.segment}
                    </p>
                    <small>{customer.notes}</small>
                  </div>
                  <div className="support-ticket-contact">
                    <span><Mail size={12} /> {customer.email}</span>
                    <span><Phone size={12} /> {customer.phone}</span>
                  </div>
                  <div className="row-actions">
                    <button className="secondary-action compact" type="button">
                      <MessageSquare size={14} />
                      Respond
                    </button>
                    <button className="icon-button success" title="Mark resolved" type="button">
                      <CheckCircle2 size={16} />
                    </button>
                    <button className="icon-button" title="View history" type="button">
                      <Eye size={16} />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="panel">
          <PanelHeader icon={AlertTriangle} title="Dispute queue" action={`${disputeQueue.length} cases`} />
          <div className="support-dispute-list">
            {disputeQueue.length === 0 ? (
              <EmptyState icon={ShieldCheck} text="No disputed orders in queue." />
            ) : (
              disputeQueue.map((order) => {
                const isSelected = selectedDispute?.orderId === order.orderId;
                return (
                  <article
                    className={`support-dispute-row${isSelected ? " support-dispute-row--selected" : ""}`}
                    key={order.orderId}
                    onClick={() => setSelectedDisputeId(order.orderId)}
                  >
                    <div className="support-dispute-head">
                      <strong>{order.orderId}</strong>
                      <StatusBadge status={order.status} />
                    </div>
                    <p>{order.customerName} · {order.paymentStatus} · {formatCurrency(order.subtotal)}</p>
                    <div className="support-dispute-meta">
                      <small>{order.customerEmail || "No email"}</small>
                      <small>{order.phone || "No phone"}</small>
                      <small>Shop IDs: {(order.shopIds || []).join(", ") || "N/A"}</small>
                      <small>Dispute note: {order.customerResponse?.note || "No customer note provided."}</small>
                      <small>Dispute case: {formatCaseStatusLabel(order.supportCase?.status)} · {order.supportCase?.priority || "normal"}</small>
                      <small>Updated: {order.updatedAt ? new Date(order.updatedAt).toLocaleString() : "N/A"}</small>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {selectedDispute ? (
            <div className="support-dispute-detail">
              <div className="support-dispute-detail-head">
                <strong>{selectedDispute.orderId}</strong>
                <span className="muted-label">{selectedDispute.createdAt ? new Date(selectedDispute.createdAt).toLocaleString() : "No date"}</span>
              </div>
              <div className="support-dispute-meta">
                <small>Dispute status: {formatCaseStatusLabel(selectedDispute.supportCase?.status)}</small>
                <small>Case priority: {selectedDispute.supportCase?.priority || "normal"}</small>
                {selectedDispute.supportCase?.lastActionAt ? (
                  <small>Last case action: {new Date(selectedDispute.supportCase.lastActionAt).toLocaleString()}</small>
                ) : null}
              </div>
              <div className="support-dispute-detail-grid">
                <div>
                  <strong>Customer</strong>
                  <p>{selectedDispute.customerName}</p>
                  <small>{selectedDispute.customerEmail || "No email"} · {selectedDispute.phone || "No phone"}</small>
                </div>
                <div>
                  <strong>Delivery</strong>
                  <p>{selectedDispute.deliveryAddress || "No address provided"}</p>
                  <small>{selectedDispute.deliveryDate || "No date"} {selectedDispute.deliveryTime || ""}</small>
                </div>
              </div>
              <div className="support-dispute-items">
                <strong>Items</strong>
                {(selectedDispute.items || []).map((item, index) => {
                  const summary = renderOrderItemSummary(item);
                  return (
                    <div className="support-dispute-item-row" key={`${selectedDispute.orderId}-${index}`}>
                      <span>{summary.base}</span>
                      {summary.details.map((line) => <small key={line}>{line}</small>)}
                    </div>
                  );
                })}
              </div>
              <div className="support-dispute-customer-note">
                <strong>Customer dispute note</strong>
                <p>{selectedDispute.customerResponse?.note || "No dispute note submitted."}</p>
              </div>
              <div className="support-resolution-decision">
                <div className="support-resolution-decision-head">
                  <strong>Resolution decision</strong>
                  <span className="muted-label">{selectedDispute.resolutionDecision?.status || "Pending decision"}</span>
                </div>
                {selectedDispute.resolutionDecision ? (
                  <>
                    <div className="support-resolution-decision-grid">
                      <small><strong>Liability:</strong> {selectedDispute.resolutionDecision.liability || "—"}</small>
                      <small><strong>Refund:</strong> {selectedDispute.resolutionDecision.refundDecision || "—"}</small>
                      <small><strong>Payout:</strong> {selectedDispute.resolutionDecision.payoutDecision || "—"}</small>
                      <small><strong>Order:</strong> {selectedDispute.resolutionDecision.orderDecision || "—"}</small>
                      <small><strong>COD:</strong> {selectedDispute.resolutionDecision.codResolution || "—"}</small>
                      <small><strong>Follow-up:</strong> {selectedDispute.resolutionDecision.requiresFollowUp ? "Required" : "Not required"}</small>
                    </div>
                    <p>{selectedDispute.resolutionDecision.decisionNote || "No decision note provided."}</p>
                    <div className="support-resolution-decision-meta">
                      <small>Decided by: {selectedDispute.resolutionDecision.decidedBy || "—"} ({selectedDispute.resolutionDecision.decidedRole || "—"})</small>
                      <small>Decided at: {selectedDispute.resolutionDecision.decidedAt ? new Date(selectedDispute.resolutionDecision.decidedAt).toLocaleString() : "—"}</small>
                      {selectedDispute.resolutionDecision.executedAt ? (
                        <small>
                          Finalized by: {selectedDispute.resolutionDecision.executedBy || "—"} ({selectedDispute.resolutionDecision.executedRole || "—"}) · {new Date(selectedDispute.resolutionDecision.executedAt).toLocaleString()}
                        </small>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="muted-label">No saved decision yet.</p>
                )}

                <div className="support-resolution-form">
                  <label>
                    <span>Liability</span>
                    <select
                      value={decisionDrafts[selectedDispute.orderId]?.liability || ""}
                      onChange={(event) => updateDecisionDraft(selectedDispute.orderId, "liability", event.target.value)}
                    >
                      <option value="">Select liability</option>
                      <option value="seller_fault">Seller fault</option>
                      <option value="customer_fault">Customer fault</option>
                      <option value="mixed">Mixed</option>
                      <option value="inconclusive">Inconclusive</option>
                    </select>
                  </label>
                  <label>
                    <span>Refund decision</span>
                    <select
                      value={decisionDrafts[selectedDispute.orderId]?.refundDecision || ""}
                      onChange={(event) => updateDecisionDraft(selectedDispute.orderId, "refundDecision", event.target.value)}
                    >
                      <option value="">Select refund decision</option>
                      <option value="none">None</option>
                      <option value="required">Required</option>
                      <option value="goodwill">Goodwill</option>
                    </select>
                  </label>
                  <label>
                    <span>Payout decision</span>
                    <select
                      value={decisionDrafts[selectedDispute.orderId]?.payoutDecision || ""}
                      onChange={(event) => updateDecisionDraft(selectedDispute.orderId, "payoutDecision", event.target.value)}
                    >
                      <option value="">Select payout decision</option>
                      <option value="hold">Hold</option>
                      <option value="release_approved">Release approved</option>
                      <option value="clawback_planned">Clawback planned</option>
                    </select>
                  </label>
                  <label>
                    <span>Order decision</span>
                    <select
                      value={decisionDrafts[selectedDispute.orderId]?.orderDecision || ""}
                      onChange={(event) => updateDecisionDraft(selectedDispute.orderId, "orderDecision", event.target.value)}
                    >
                      <option value="">Select order decision</option>
                      <option value="keep_order">Keep order</option>
                      <option value="cancel_order">Cancel order</option>
                    </select>
                  </label>
                  <label>
                    <span>COD resolution</span>
                    <select
                      value={decisionDrafts[selectedDispute.orderId]?.codResolution || ""}
                      onChange={(event) => updateDecisionDraft(selectedDispute.orderId, "codResolution", event.target.value)}
                    >
                      <option value="">Select COD resolution</option>
                      <option value="no_cash_collected">No cash collected</option>
                      <option value="seller_to_refund_cash">Seller to refund cash</option>
                      <option value="platform_to_refund_cash">Platform to refund cash</option>
                      <option value="no_refund_due">No refund due</option>
                    </select>
                  </label>
                  <label className="support-resolution-field-wide">
                    <span>Decision note</span>
                    <textarea
                      rows={3}
                      maxLength={1000}
                      value={decisionDrafts[selectedDispute.orderId]?.decisionNote || ""}
                      onChange={(event) => updateDecisionDraft(selectedDispute.orderId, "decisionNote", event.target.value)}
                      placeholder="Required: summary of responsibility and decision rationale."
                    />
                  </label>
                  <label className="support-resolution-followup">
                    <input
                      type="checkbox"
                      checked={Boolean(decisionDrafts[selectedDispute.orderId]?.requiresFollowUp)}
                      onChange={(event) => updateDecisionDraft(selectedDispute.orderId, "requiresFollowUp", event.target.checked)}
                    />
                    <span>Requires follow-up</span>
                  </label>
                  <label>
                    <span>Follow-up by</span>
                    <input
                      type="date"
                      value={decisionDrafts[selectedDispute.orderId]?.followUpBy || ""}
                      onChange={(event) => updateDecisionDraft(selectedDispute.orderId, "followUpBy", event.target.value)}
                      disabled={!decisionDrafts[selectedDispute.orderId]?.requiresFollowUp}
                    />
                  </label>
                  <fieldset className="support-resolution-gateway" disabled>
                    <legend>Future online payment integration (disabled)</legend>
                    <label>
                      <span>Gateway provider</span>
                      <input
                        value={decisionDrafts[selectedDispute.orderId]?.gatewayProvider || ""}
                        onChange={(event) => updateDecisionDraft(selectedDispute.orderId, "gatewayProvider", event.target.value)}
                        placeholder="Coming soon"
                      />
                    </label>
                    <label>
                      <span>Gateway refund intent ID</span>
                      <input
                        value={decisionDrafts[selectedDispute.orderId]?.gatewayRefundIntentId || ""}
                        onChange={(event) => updateDecisionDraft(selectedDispute.orderId, "gatewayRefundIntentId", event.target.value)}
                        placeholder="Coming soon"
                      />
                    </label>
                    <label>
                      <span>Gateway refund status</span>
                      <input
                        value={decisionDrafts[selectedDispute.orderId]?.gatewayRefundStatus || ""}
                        onChange={(event) => updateDecisionDraft(selectedDispute.orderId, "gatewayRefundStatus", event.target.value)}
                        placeholder="Coming soon"
                      />
                    </label>
                  </fieldset>
                  <div className="support-resolution-actions">
                    <button
                      className="secondary-action compact"
                      type="button"
                      disabled={resolutionDecisionMutation.isPending || finalizeDecisionMutation.isPending}
                      onClick={() => saveResolutionDecision(selectedDispute)}
                    >
                      {resolutionDecisionMutation.isPending ? "Saving..." : "Save decision"}
                    </button>
                    {selectedDispute.resolutionDecision?.status === "decided" ? (
                      <>
                        {finalizeTargetOrderId === selectedDispute.orderId ? (
                          <div className="support-resolution-finalize-confirm">
                            <small>
                              COD mode: this only records operational settlement status. No payment transfer is executed.
                            </small>
                            <div className="support-resolution-finalize-actions">
                              <button
                                className="secondary-action compact"
                                type="button"
                                disabled={finalizeDecisionMutation.isPending}
                                onClick={() => finalizeResolutionDecision(selectedDispute)}
                              >
                                {finalizeDecisionMutation.isPending ? "Finalizing..." : "Confirm finalize"}
                              </button>
                              <button
                                className="ghost-action compact"
                                type="button"
                                disabled={finalizeDecisionMutation.isPending}
                                onClick={() => setFinalizeTargetOrderId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="ghost-action compact"
                            type="button"
                            disabled={finalizeDecisionMutation.isPending}
                            onClick={() => setFinalizeTargetOrderId(selectedDispute.orderId)}
                          >
                            Finalize decision
                          </button>
                        )}
                      </>
                    ) : null}
                    {selectedDispute.resolutionDecision?.status === "executed" ? (
                      <small className="support-resolution-finalized-badge">Finalized</small>
                    ) : null}
                    {decisionErrors[selectedDispute.orderId] ? (
                      <small className="support-resolution-error">{decisionErrors[selectedDispute.orderId]}</small>
                    ) : null}
                  </div>
                </div>
                <p className="support-resolution-disclaimer">
                  COD mode: this records responsibility only. No refund or payout transfer is executed automatically.
                </p>
              </div>
              {(selectedDispute.statusHistory || []).length > 0 ? (
                <div className="support-dispute-history">
                  <strong>Status history</strong>
                  {[...(selectedDispute.statusHistory || [])].reverse().slice(0, 6).map((entry, index) => (
                    <div className="support-dispute-history-row" key={`${selectedDispute.orderId}-history-${index}`}>
                      <span>{entry.from || "—"} → {entry.to}</span>
                      <small>{entry.role} · {entry.by}</small>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="support-dispute-actions">
                <button className="ghost-action compact" disabled={supportCaseMutation.isPending} onClick={() => updateSupportCase(selectedDispute.orderId, "reviewing")} type="button">{supportCaseMutation.isPending ? "Saving..." : "Mark as reviewing"}</button>
                <button className="ghost-action compact" disabled={supportCaseMutation.isPending} onClick={() => updateSupportCase(selectedDispute.orderId, "contact_customer")} type="button">{supportCaseMutation.isPending ? "Saving..." : "Contact customer"}</button>
                <button className="ghost-action compact" disabled={supportCaseMutation.isPending} onClick={() => updateSupportCase(selectedDispute.orderId, "contact_seller")} type="button">{supportCaseMutation.isPending ? "Saving..." : "Contact seller"}</button>
                <button className="ghost-action compact" disabled={supportCaseMutation.isPending} onClick={() => updateSupportCase(selectedDispute.orderId, "escalate")} type="button">{supportCaseMutation.isPending ? "Saving..." : "Escalate to admin"}</button>
                <button className="ghost-action compact" disabled={supportCaseMutation.isPending} onClick={() => updateSupportCase(selectedDispute.orderId, "resolve")} type="button">{supportCaseMutation.isPending ? "Saving..." : "Resolve"}</button>
              </div>
              <p className="support-dispute-resolve-note">
                Resolve updates dispute-case tracking only. It does not process refund or change order/payment status yet.
              </p>
              <div className="support-dispute-note-entry">
                <label htmlFor={`support-note-${selectedDispute.orderId}`}>Internal note</label>
                <textarea
                  id={`support-note-${selectedDispute.orderId}`}
                  rows={3}
                  value={internalNotes[selectedDispute.orderId] || ""}
                  onChange={(event) =>
                    setInternalNotes((current) => ({ ...current, [selectedDispute.orderId]: event.target.value }))
                  }
                  placeholder="Internal-only support note"
                />
                <button
                  className="secondary-action compact"
                  disabled={supportCaseMutation.isPending}
                  onClick={() => updateSupportCase(selectedDispute.orderId, "add_note", internalNotes[selectedDispute.orderId] || "")}
                  type="button"
                >
                  {supportCaseMutation.isPending ? "Saving..." : "Add internal note"}
                </button>
                {supportCaseMutation.isError ? <small className="muted-label">Unable to update dispute case right now.</small> : null}
              </div>
              {(selectedDispute.supportCase?.internalNotes || []).length > 0 ? (
                <div className="support-dispute-history">
                  <strong>Internal notes</strong>
                  {[...(selectedDispute.supportCase?.internalNotes || [])].slice().reverse().map((entry, index) => (
                    <div className="support-dispute-history-row" key={`${selectedDispute.orderId}-note-${index}`}>
                      <span>{entry.note}</span>
                      <small>{entry.role} · {entry.by} · {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}</small>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="support-risk-summary">
            <PanelHeader icon={ShieldCheck} title="Risk profile" action="All customers" />
            <div className="support-risk-bars">
              {[
                { label: "High risk",   count: highRiskCases.length, tone: "danger" },
                { label: "Medium risk", count: mediumRisk.length,    tone: "warning" },
                { label: "Low risk",    count: customers.filter((c) => c.risk === "Low").length, tone: "success" },
              ].map(({ label, count, tone }) => (
                <div className="analytics-risk-row" key={label}>
                  <span className={`risk ${tone}`}>{label}</span>
                  <div className="risk-bar-wrap">
                    <div className={`risk-bar ${tone.replace("danger", "high").replace("warning", "medium").replace("success", "low")}`}
                      style={{ width: `${customers.length ? (count / customers.length) * 100 : 0}%` }} />
                  </div>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

/* ─── Sales Reps (Foundation) ──────────────────────── */
const SR_REPS_FALLBACK = [
  { id: "REP-001", name: "Hassan Al Haj",  code: "HASSAN-AE", email: "hassan@tuti.example", phone: "+971 50 123 4567", plan: "Premium",    status: "Active",  referrals: 7, activeShops: 5, totalGmv: 42800, pendingCommission: 2140, paidCommission: 3800 },
  { id: "REP-002", name: "Lina Khalil",    code: "LINA-KW",   email: "lina@tuti.example",   phone: "+965 99 876 543", plan: "Standard",   status: "Active",  referrals: 3, activeShops: 3, totalGmv: 18500, pendingCommission:  555, paidCommission:  890 },
  { id: "REP-003", name: "Omar Farouq",    code: "OMAR-BH",   email: "omar@tuti.example",   phone: "+973 39 112 233", plan: "Starter",    status: "Pending", referrals: 1, activeShops: 0, totalGmv:     0, pendingCommission:    0, paidCommission:    0 },
];

const SR_REFERRALS_FALLBACK = [
  { id: "REF-001", repCode: "HASSAN-AE", shopName: "Oud Palace",         status: "Active",     gmv: 18400, firstSaleDate: "2026-01-25" },
  { id: "REF-002", repCode: "HASSAN-AE", shopName: "Rose Garden Cakes",  status: "Active",     gmv: 12600, firstSaleDate: "2026-02-08" },
  { id: "REF-003", repCode: "HASSAN-AE", shopName: "Desert Bloom Gifts", status: "Registered", gmv:     0, firstSaleDate: null },
  { id: "REF-004", repCode: "LINA-KW",   shopName: "Amber Night",        status: "Active",     gmv:  9800, firstSaleDate: "2026-03-05" },
  { id: "REF-005", repCode: "LINA-KW",   shopName: "Sweet Layers",       status: "First Sale", gmv:  4200, firstSaleDate: "2026-04-12" },
  { id: "REF-006", repCode: "OMAR-BH",   shopName: "Crystal Oud",        status: "Referred",   gmv:     0, firstSaleDate: null },
];

const SR_LEDGER_FALLBACK = [
  { id: "COM-001", repName: "Hassan Al Haj", type: "GMV Commission",  shop: "Oud Palace",         amount:  552, status: "Paid",    date: "2026-03-01" },
  { id: "COM-002", repName: "Hassan Al Haj", type: "Signup Bonus",    shop: "Rose Garden Cakes",  amount:  100, status: "Paid",    date: "2026-02-02" },
  { id: "COM-003", repName: "Hassan Al Haj", type: "First Sale Bonus",shop: "Rose Garden Cakes",  amount:  250, status: "Paid",    date: "2026-02-09" },
  { id: "COM-004", repName: "Hassan Al Haj", type: "GMV Commission",  shop: "Rose Garden Cakes",  amount:  378, status: "Pending", date: "2026-05-01" },
  { id: "COM-005", repName: "Lina Khalil",   type: "Signup Bonus",    shop: "Amber Night",        amount:   50, status: "Paid",    date: "2026-03-01" },
  { id: "COM-006", repName: "Lina Khalil",   type: "GMV Commission",  shop: "Amber Night",        amount:  294, status: "Pending", date: "2026-05-01" },
];
