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

export function AdminOrders({ focusedOrderId = "", onFocusHandled = () => {} }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => ordersApi.list({ limit: 50 }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ orderId, status }) => ordersApi.updateStatus(orderId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-orders"] }),
  });

  const orders      = data?.orders || [];
  const [filter,          setFilter]          = useState("all");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const queueStatuses = [
    "Pending",
    "Confirmed",
    "Processing",
    "Ready for Delivery",
    "Shipped",
    "Delivered",
    "Disputed",
    "Customer Accepted",
    "Closed",
  ];
  const queueCount = (status) => {
    if (status === "Closed") {
      return orders.filter((o) => ["Cancelled", "Refunded"].includes(o.status)).length;
    }
    return orders.filter((o) => o.status === status).length;
  };
  const queueTone = (status) => {
    if (status === "Pending") return "rose";
    if (status === "Shipped") return "brand";
    if (status === "Delivered" || status === "Customer Accepted") return "success";
    if (status === "Disputed" || status === "Closed") return "danger";
    return "amber";
  };
  const queueLabel = (status) => (status === "Closed" ? "Cancelled / Refunded" : status);
  const renderOrderMetadata = (item) => {
    const metadata = item?.metadata || {};
    const details = [];
    if (metadata.cakeWriting) details.push(`Cake writing: ${metadata.cakeWriting}`);
    if (metadata.allergyNote) details.push(`Allergy note: ${metadata.allergyNote}`);
    if (metadata.itemMessage) details.push(`Item message: ${metadata.itemMessage}`);
    if (metadata.giftWrap !== undefined) details.push(`Gift wrap: ${metadata.giftWrap ? "Yes" : "No"}`);
    return details;
  };
  const renderOrderItemSummary = (item) => {
    const base = `${item.quantity}× ${item.productName} · ${formatCurrency(item.price)}`;
    const config = item?.configuration || {};
    if (config.type !== "build_your_box") {
      return { base, details: renderOrderMetadata(item) };
    }
    const perfume = config.selectedPerfume?.name || config.selectedPerfume?.productName || "Perfume";
    const treat = config.selectedTreat?.name || config.selectedTreat?.productName || "Treat";
    return {
      base,
      details: [`Build Your Box: ${perfume} + ${treat}`, ...renderOrderMetadata(item)],
    };
  };
  const getAdminPrimaryAction = (order) => getAllowedOrderActions(order.status, "admin")[0] || "";
  const historyTone = (to) => {
    if (to === "Disputed" || to === "Cancelled") return "critical";
    if (to === "Customer Accepted") return "success";
    return "default";
  };
  const open        = orders.filter((o) => !["Delivered", "Customer Accepted", "Cancelled", "Refunded"].includes(o.status));
  const delivered   = orders.filter((o) => o.status === "Delivered");
  const dispHold    = orders.filter((o) => o.paymentStatus === "Dispute hold");
  const shown       = filter === "all"
    ? orders
    : filter === "Closed"
      ? orders.filter((o) => ["Cancelled", "Refunded"].includes(o.status))
      : orders.filter((o) => o.status === filter);
  const detailOrder = selectedOrderId ? shown.find((o) => o.orderId === selectedOrderId) || null : null;
  const primaryAction = detailOrder ? getAdminPrimaryAction(detailOrder) : "";

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

  return (
    <main className="workspace">
      <PageTitle
        kicker="Order management"
        title="All platform orders"
        description={`${data?.total || 0} orders across all shops`}
      />

      <section className="metric-grid">
        <MetricCard icon={ShoppingBag}   label="Total orders"  value={data?.total || 0}   note="All time" />
        <MetricCard icon={Package}       label="Open"          value={open.length}         note="Needs action" />
        <MetricCard icon={Truck}         label="Delivered"     value={delivered.length}    note="Payout eligible" />
        <MetricCard icon={AlertTriangle} label="Dispute holds" value={dispHold.length}     note={dispHold.length > 0 ? "Review required" : "All clear"} />
      </section>

      {orders.length > 0 && (
        <div className="ac-order-queue">
          {queueStatuses.map((s) => {
            const cnt = queueCount(s);
            return (
              <button
                key={s}
                type="button"
                className={filter === s ? "ac-order-chip ac-order-chip--active" : "ac-order-chip"}
                onClick={() => setFilter(s)}
              >
                <span className={`ac-queue-dot ac-queue-dot--${queueTone(s)}`} />
                <strong>{cnt}</strong>
                <span>{queueLabel(s)}</span>
              </button>
            );
          })}
          <span className="ac-order-queue-label">{open.length} order{open.length !== 1 ? "s" : ""} need attention</span>
        </div>
      )}

      {isLoading ? (
        <div className="app-status">Loading orders…</div>
      ) : orders.length === 0 ? (
        <section className="panel"><EmptyState icon={ShoppingBag} text="No orders yet." /></section>
      ) : (
        <section className="panel">
          <div className="ac-order-filter-row">
            <PanelHeader icon={ShoppingBag} title="All orders" action={`${shown.length} shown`} />
            <div className="segment-tabs">
              {["all", ...queueStatuses].map((s) => (
                <button key={s} type="button"
                  className={filter === s ? "filter-tab active" : "filter-tab"}
                  onClick={() => setFilter(s)}
                >
                  {s === "all" ? "All" : queueLabel(s)}
                </button>
              ))}
            </div>
          </div>
          <div className="admin-order-table">
            <div className="admin-order-head">
              <span>Order ID</span>
              <span>Customer</span>
              <span>Shop</span>
              <span>Total</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {shown.map((o) => (
              <div
                className={`admin-order-row${selectedOrderId === o.orderId ? " admin-order-row--selected" : ""}`}
                key={o.orderId}
                onClick={() => setSelectedOrderId(selectedOrderId === o.orderId ? null : o.orderId)}
              >
                <div>
                  <strong>{o.orderId}</strong>
                  <small>{new Date(o.createdAt).toLocaleDateString()}</small>
                </div>
                <div>
                  <span>{o.customerName}</span>
                  <small>{o.customerEmail}</small>
                </div>
                <span className="muted-label">{o.shopIds?.join(", ")}</span>
                <strong>{formatCurrency(o.subtotal)}</strong>
                <StatusBadge status={o.status} />
                <div className="row-actions">
                  {getAllowedOrderActions(o.status, "admin").map((s) => (
                    <button
                      key={s}
                      className={o.status === s ? "filter-tab active" : "filter-tab"}
                      disabled={o.status === s || updateMutation.isPending}
                      onClick={(e) => { e.stopPropagation(); updateMutation.mutate({ orderId: o.orderId, status: s }); }}
                      title={s}
                      type="button"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {detailOrder && (
            <div className="ac-order-detail">
              <div className="ac-order-detail-grid">
                <div className="ac-order-detail-block">
                  <strong>Customer Info</strong>
                  <span>{detailOrder.customerName}</span>
                  <span>{detailOrder.customerEmail}</span>
                  <span>{detailOrder.phone || "No phone"}</span>
                </div>
                <div className="ac-order-detail-block">
                  <strong>Delivery</strong>
                  <span>{detailOrder.deliveryAddress || "Address not provided"}</span>
                  <span>{detailOrder.deliveryDate || "No date set"}</span>
                  <span>{detailOrder.deliveryTime || "No delivery time set"}</span>
                </div>
                <div className="ac-order-detail-block">
                  <strong>Items</strong>
                  {(detailOrder.items || []).map((item, i) => {
                    const summary = renderOrderItemSummary(item);
                    return (
                      <div className="ac-order-item-summary" key={i}>
                        <span>{summary.base}</span>
                        {summary.details.map((line) => (
                          <small key={`${i}-${line}`}>{line}</small>
                        ))}
                      </div>
                    );
                  })}
                  {!(detailOrder.items || []).length && <span className="ac-order-detail-empty">No item detail available</span>}
                </div>
                <div className="ac-order-detail-block">
                  <strong>Payment &amp; Totals</strong>
                  <StatusBadge status={detailOrder.status} />
                  <span>{detailOrder.paymentMethod?.toUpperCase() || "N/A"} · {detailOrder.paymentStatus}</span>
                  <span>Platform fee: {formatCurrency(detailOrder.platformFee)}</span>
                  <span>Vendor net: {formatCurrency(detailOrder.vendorNet)}</span>
                  <span>Total: {formatCurrency(detailOrder.subtotal)}</span>
                </div>
              </div>
              <div className="ac-order-extra-grid">
                <div className="ac-order-detail-block">
                  <strong>Seller / Shop IDs</strong>
                  <span>{detailOrder.shopIds?.join(", ") || "No shop IDs"}</span>
                </div>
                <div className="ac-order-detail-block">
                  <strong>Recommended Admin Action</strong>
                  {primaryAction ? (
                    <button
                      className="secondary-action compact"
                      type="button"
                      disabled={updateMutation.isPending}
                      onClick={() => updateMutation.mutate({ orderId: detailOrder.orderId, status: primaryAction })}
                    >
                      {primaryAction}
                    </button>
                  ) : (
                    <span className="ac-order-detail-empty">No transition available</span>
                  )}
                  <span className="ac-order-next-action">{detailOrder.status}</span>
                </div>
              </div>
              {(detailOrder.giftMessage || detailOrder.notes) ? (
                <div className="ac-order-notes">
                  {detailOrder.giftMessage ? <p><strong>Gift message:</strong> {detailOrder.giftMessage}</p> : null}
                  {detailOrder.notes ? <p><strong>Order notes:</strong> {detailOrder.notes}</p> : null}
                </div>
              ) : null}
              {detailOrder.status === "Disputed" ? (
                <div className="ac-order-dispute-cue">
                  <AlertTriangle size={14} />
                  Requires support review before any payout release.
                </div>
              ) : null}
              {(detailOrder.statusHistory && detailOrder.statusHistory.length > 0) ? (
                <div className="ac-order-history">
                  <div className="ac-order-history-head">
                    <ShieldCheck size={13} />
                    <span>Status history ({detailOrder.statusHistory.length})</span>
                  </div>
                  {[...detailOrder.statusHistory].reverse().map((entry, i) => (
                    <div className={`ac-history-entry ac-history-entry--${historyTone(entry.to)}`} key={i}>
                      <span className="ac-history-arrow">{entry.from || "—"} → {entry.to}</span>
                      <span className="muted-label">{entry.role} · {entry.by}</span>
                      {entry.note       && <span className="ac-history-note">{entry.note}</span>}
                      {entry.courierRef && <span className="ac-history-note">Courier Ref: {entry.courierRef}</span>}
                      <span className="muted-label">{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ""}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ac-order-history-placeholder">
                  <ShieldCheck size={14} />
                  <span>Status history and evidence will appear here once tracking is enabled.</span>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
