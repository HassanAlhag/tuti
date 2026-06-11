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

/* ─── Orders ───────────────────────────────────────────────────── */
export function SellerOrders({ focusedOrderId = "", onFocusHandled = () => {} }) {
  const { user }   = useAuthStore();
  const qc         = useQueryClient();
  const [filter,          setFilter]          = useState("all");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [disputeNotes,    setDisputeNotes]    = useState({});
  const [disputeErrors,   setDisputeErrors]   = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ["seller-orders", user?.sub],
    queryFn:  () => ordersApi.list({ limit: 50 }),
    enabled:  Boolean(user),
  });

  const updateMutation = useMutation({
    mutationFn: ({ orderId, status }) => ordersApi.updateStatus(orderId, status),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["seller-orders"] }),
  });
  const supportCaseMutation = useMutation({
    mutationFn: ({ orderId, payload }) => ordersApi.updateSupportCase(orderId, payload),
    onSuccess: (_data, variables) => {
      if (variables?.orderId) {
        setDisputeNotes((current) => ({ ...current, [variables.orderId]: "" }));
        setDisputeErrors((current) => ({ ...current, [variables.orderId]: "" }));
      }
      qc.invalidateQueries({ queryKey: ["seller-orders"] });
    },
    onError: (error, variables) => {
      if (variables?.orderId) {
        setDisputeErrors((current) => ({ ...current, [variables.orderId]: error?.message || "Unable to update dispute case." }));
      }
    },
  });

  const orders      = data?.orders || [];
  const shown       = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const open        = orders.filter((o) => !["Delivered", "Customer Accepted", "Cancelled", "Refunded"].includes(o.status));
  const cod         = orders.filter((o) => o.paymentMethod === "cod");
  const detailOrder = selectedOrderId ? shown.find((o) => o.orderId === selectedOrderId) || null : null;
  const queueStatuses = ["Pending", "Confirmed", "Processing", "Ready for Delivery"];
  const primaryAction = detailOrder ? getSellerPrimaryAction(detailOrder) : "";

  useEffect(() => {
    if (!focusedOrderId) return;
    const found = orders.find((order) => order.orderId === focusedOrderId);
    if (!found) {
      onFocusHandled("Order not found or not visible.");
      return;
    }
    if (filter !== "all") setFilter("all");
    setSelectedOrderId(focusedOrderId);
    onFocusHandled("");
  }, [focusedOrderId, orders, filter, onFocusHandled]);

  if (isLoading) return <div className="sd-loading">Loading orders…</div>;

  return (
    <div className="sd-section">
      <div className="sd-section-header">
        <div>
          <h2 className="sd-section-title">Orders</h2>
          <p className="sd-section-sub">
            {data?.total || 0} total orders · preparation stops at Ready for Delivery, then Drivers handles delivery
          </p>
        </div>
      </div>

      <section className="sd-metric-grid">
        <MetricCard icon={Package}       label="Open"      value={open.length}                                           note="Needs action" />
        <MetricCard icon={WalletCards}   label="COD"       value={cod.length}                                            note="Confirm cash" />
        <MetricCard icon={Truck}         label="Delivered" value={orders.filter((o) => o.status === "Delivered").length} note="Payout eligible" />
        <MetricCard icon={AlertTriangle} label="On hold"   value={orders.filter((o) => o.paymentStatus === "Dispute hold").length} note="Dispute case" />
      </section>

      {open.length > 0 && (
        <div className="sd-queue-summary">
          {queueStatuses.map((s) => {
            const cnt = orders.filter((o) => o.status === s).length;
            const tone = s === "Pending" ? "rose" : s === "Delivered" ? "success" : "amber";
            return (
              <button
                key={s}
                type="button"
                className={filter === s ? "sd-queue-chip sd-queue-chip--active" : "sd-queue-chip"}
                onClick={() => setFilter(s)}
              >
                <span className={`sd-queue-dot sd-queue-dot--${tone}`} />
                <strong>{cnt}</strong>
                <span>{s}</span>
              </button>
            );
          })}
          <span className="sd-queue-summary-label">{open.length} order{open.length !== 1 ? "s" : ""} need action</span>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="sd-panel">
          <EmptyState icon={Package} text="No orders yet. Share your shop link to get your first sale." />
        </div>
      ) : (
        <div className="sd-panel">
          <div className="sd-table-toolbar">
            <PanelHeader icon={Package} title="All orders" action={`${shown.length} shown`} />
            <div className="sd-filter-row">
              {["all", "Pending", "Confirmed", "Processing", "Ready for Delivery"].map((s) => (
                <button
                  key={s} type="button"
                  className={filter === s ? "filter-tab active" : "filter-tab"}
                  onClick={() => setFilter(s)}
                >
                  {s === "all" ? "All" : s}
                </button>
              ))}
            </div>
          </div>

          <div className="sd-order-table">
            <div className="sd-order-head">
              <span>Order</span>
              <span>Customer</span>
              <span>Delivery</span>
              <span>Total</span>
              <span>Status</span>
              <span>Prep step</span>
            </div>
            {shown.map((order) => (
              <div
                className={`sd-order-row${selectedOrderId === order.orderId ? " sd-order-row--selected" : ""}`}
                key={order.orderId}
                onClick={() => setSelectedOrderId(selectedOrderId === order.orderId ? null : order.orderId)}
              >
                <div>
                  <strong>{order.orderId}</strong>
                  <small>{new Date(order.createdAt).toLocaleDateString()} · {order.paymentMethod?.toUpperCase()}</small>
                </div>
                <div>
                  <span>{order.customerName}</span>
                  <small>{order.phone || order.customerEmail}</small>
                </div>
                <div>
                  <span>{order.deliveryDate || "—"} {order.deliveryTime || ""}</span>
                  <small>{orderNextAction(order)}</small>
                </div>
                <strong>{formatCurrency(order.subtotal)}</strong>
                <div>
                  <StatusBadge status={order.status} />
                  <small className="sd-payment-status">{order.paymentStatus}</small>
                </div>
                <div className="sd-row-actions">
                  {getAllowedOrderActions(order.status, "seller").map((s) => (
                    <button
                      key={s} type="button"
                      className={order.status === s ? "sd-status-btn sd-status-btn--active" : "sd-status-btn"}
                      disabled={order.status === s || updateMutation.isPending}
                      onClick={(e) => { e.stopPropagation(); updateMutation.mutate({ orderId: order.orderId, status: s }); }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {detailOrder && (
            <div className="sd-order-detail">
              <div className="sd-order-detail-grid">
                <div className="sd-order-detail-block">
                  <strong>Customer Contact</strong>
                  <span>{detailOrder.customerName}</span>
                  <span>{detailOrder.customerEmail}</span>
                  <span>{detailOrder.phone}</span>
                </div>
                <div className="sd-order-detail-block">
                  <strong>Delivery</strong>
                  <span>{detailOrder.deliveryAddress || "Address not provided"}</span>
                  <span>{detailOrder.deliveryDate || "No date set"}</span>
                  <span>{detailOrder.deliveryTime || "No delivery time set"}</span>
                </div>
                <div className="sd-order-detail-block">
                  <strong>Items</strong>
                  {(detailOrder.items || []).map((item, i) => {
                    const summary = renderOrderItemSummary(item);
                    return (
                      <div className="sd-order-item-summary" key={i}>
                        <span>{summary.base}</span>
                        {summary.details.map((line) => (
                          <small key={`${i}-${line}`}>{line}</small>
                        ))}
                      </div>
                    );
                  })}
                  {!(detailOrder.items || []).length && <span className="sd-order-detail-empty">No item detail available</span>}
                </div>
                <div className="sd-order-detail-block">
                  <strong>Payment &amp; Fulfillment</strong>
                  <StatusBadge status={detailOrder.status} />
                  <span>{detailOrder.paymentMethod?.toUpperCase() || "N/A"} · {detailOrder.paymentStatus}</span>
                  <span className="sd-order-next-action">{orderNextAction(detailOrder)}</span>
                </div>
              </div>
              {(detailOrder.giftMessage || detailOrder.notes) ? (
                <div className="sd-order-notes">
                  {detailOrder.giftMessage ? <p><strong>Gift message:</strong> {detailOrder.giftMessage}</p> : null}
                  {detailOrder.notes ? <p><strong>Order notes:</strong> {detailOrder.notes}</p> : null}
                </div>
              ) : null}
              {detailOrder.resolutionDecision ? (
                <div className="sd-order-resolution">
                  <strong>Resolution decision</strong>
                  <div className="sd-order-resolution-grid">
                    <span><small>Status</small>{formatResolutionLabel(detailOrder.resolutionDecision.status)}</span>
                    <span><small>Liability</small>{formatResolutionLabel(detailOrder.resolutionDecision.liability)}</span>
                    <span><small>Refund</small>{formatResolutionLabel(detailOrder.resolutionDecision.refundDecision)}</span>
                    <span><small>Payout</small>{formatResolutionLabel(detailOrder.resolutionDecision.payoutDecision)}</span>
                    <span><small>Order</small>{formatResolutionLabel(detailOrder.resolutionDecision.orderDecision)}</span>
                    <span><small>COD</small>{formatResolutionLabel(detailOrder.resolutionDecision.codResolution)}</span>
                    {detailOrder.resolutionDecision.decidedAt ? (
                      <span><small>Decided at</small>{new Date(detailOrder.resolutionDecision.decidedAt).toLocaleString()}</span>
                    ) : null}
                    {detailOrder.resolutionDecision.executedAt ? (
                      <span><small>Finalized at</small>{new Date(detailOrder.resolutionDecision.executedAt).toLocaleString()}</span>
                    ) : null}
                  </div>
                  <p>
                    This decision was recorded by Tuti support/admin to document dispute outcome and COD settlement responsibility.
                  </p>
                </div>
              ) : null}
              {detailOrder.supportCase ? (
                <div className="sd-order-resolution">
                  <strong>Dispute case</strong>
                  <div className="sd-order-resolution-grid">
                    <span><small>Status</small>{formatCaseStatusLabel(detailOrder.supportCase.status)}</span>
                    <span><small>Priority</small>{formatCaseStatusLabel(detailOrder.supportCase.priority)}</span>
                    <span><small>Last action</small>{detailOrder.supportCase.lastActionAt ? new Date(detailOrder.supportCase.lastActionAt).toLocaleString() : "—"}</span>
                    <span><small>Notes</small>{(detailOrder.supportCase.internalNotes || []).length}</span>
                  </div>
                  <label className="sd-field" style={{ marginTop: "0.75rem" }}>
                    <span>Add seller note</span>
                    <textarea
                      rows={3}
                      value={disputeNotes[detailOrder.orderId] || ""}
                      onChange={(e) => setDisputeNotes((current) => ({ ...current, [detailOrder.orderId]: e.target.value }))}
                      placeholder="Add context for support or the customer."
                    />
                  </label>
                  <div className="sd-order-primary-action" style={{ marginTop: "0.75rem" }}>
                    <button
                      className="secondary-action compact"
                      type="button"
                      disabled={supportCaseMutation.isPending}
                      onClick={() => supportCaseMutation.mutate({
                        orderId: detailOrder.orderId,
                        payload: { action: "reviewing", note: disputeNotes[detailOrder.orderId] || "" },
                      })}
                    >
                      Mark under review
                    </button>
                    <button
                      className="ghost-action compact"
                      type="button"
                      disabled={supportCaseMutation.isPending}
                      onClick={() => supportCaseMutation.mutate({
                        orderId: detailOrder.orderId,
                        payload: { action: "contact_customer", note: disputeNotes[detailOrder.orderId] || "" },
                      })}
                    >
                      Request customer follow-up
                    </button>
                    <button
                      className="ghost-action compact"
                      type="button"
                      disabled={supportCaseMutation.isPending || !disputeNotes[detailOrder.orderId]?.trim()}
                      onClick={() => supportCaseMutation.mutate({
                        orderId: detailOrder.orderId,
                        payload: { action: "add_note", note: disputeNotes[detailOrder.orderId] || "" },
                      })}
                    >
                      Add note
                    </button>
                  </div>
                  {disputeErrors[detailOrder.orderId] ? (
                    <small className="sd-modal-error" style={{ marginTop: "0.5rem" }}>{disputeErrors[detailOrder.orderId]}</small>
                  ) : null}
                </div>
              ) : null}
              <div className="sd-order-primary-action">
                <strong>Recommended next step</strong>
                {primaryAction ? (
                  <button
                    className="primary-action compact"
                    type="button"
                    disabled={updateMutation.isPending}
                    onClick={() => updateMutation.mutate({
                      orderId: detailOrder.orderId,
                      status: primaryAction,
                    })}
                  >
                    {primaryAction}
                  </button>
                ) : (
                  <span className="sd-order-detail-empty">
                    {detailOrder.status === "Ready for Delivery"
                      ? "Ready for delivery. Hand off in Drivers."
                      : "No transition available"}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
