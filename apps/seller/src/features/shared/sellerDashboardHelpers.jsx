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
} from "./SellerDashboardPrimitives.jsx";

/* ─── Shop-type helpers ────────────────────────────────────────── */
function getShopType(shop) {
  const cat = (shop?.category || "").toLowerCase();
  if (cat === "cakes" || cat === "cake" || cat === "bakery") return "cakes";
  if (cat === "gift_sets" || cat === "gifts" || cat === "gift") return "gifts";
  return "perfume";
}

const SHOP_TYPE_META = {
  perfume: { label: "Perfume shop",        Icon: Sparkles, accent: "brand"  },
  cakes:   { label: "Cake & dessert shop",  Icon: Cake,     accent: "rose"   },
  gifts:   { label: "Gift set shop",        Icon: Gift,     accent: "amber"  },
};

const SHOP_CATEGORIES = {
  perfume: [
    { value: "perfume",  label: "Perfume"         },
    { value: "gift_box", label: "Gift box"         },
  ],
  cakes: [
    { value: "cake",     label: "Cake"            },
    { value: "dessert",  label: "Dessert / sweets" },
    { value: "gift_box", label: "Gift box"         },
  ],
  gifts: [
    { value: "gift_box", label: "Gift box"         },
    { value: "bundle",   label: "Bundle"           },
  ],
};

const DEFAULT_BY_TYPE = {
  perfume: {
    name: "", category: "perfume", family: "Oud", gender: "Unisex",
    price: 320, size: "75ml", stock: 12, notes: "oud, amber, musk",
    cakeType: "", servings: "", flavors: "", allergens: "", occasionTags: "",
    leadTimeDays: 0, customMessageAvailable: false, imageName: "",
  },
  cakes: {
    name: "", category: "cake", family: "", gender: "",
    price: 165, size: "", stock: 8, notes: "",
    cakeType: "Signature", servings: "8-10", flavors: "chocolate, vanilla",
    allergens: "dairy, eggs", occasionTags: "birthday, anniversary",
    leadTimeDays: 1, customMessageAvailable: true, imageName: "",
  },
  gifts: {
    name: "", category: "gift_box", family: "", gender: "",
    price: 350, size: "", stock: 6, notes: "",
    cakeType: "Luxury gift box", servings: "", flavors: "perfume, sweets, card",
    allergens: "", occasionTags: "birthday, anniversary",
    leadTimeDays: 2, customMessageAvailable: true, imageName: "",
  },
};

function productTypeLabel(p) {
  if (p.category === "gift_box") return "Gift box";
  if (p.category === "bundle")   return "Bundle";
  if (p.category === "dessert")  return "Dessert";
  if (p.category === "cake")     return "Cake";
  return "Perfume";
}

function getStockHealth(stock) {
  if (stock <= 0) return { label: "Out of stock", tone: "danger" };
  if (stock <= 5) return { label: "Low stock", tone: "warning" };
  return { label: "Healthy stock", tone: "success" };
}

function orderNextAction(order) {
  if (order.status === "Pending")             return "Confirm stock availability";
  if (order.status === "Confirmed")           return "Prepare & package order";
  if (order.status === "Processing")          return "Mark ready for handover";
  if (order.status === "Ready for Delivery")  return "Assign driver or broadcast";
  if (order.status === "Shipped")             return "Delivery handled in Drivers";
  if (order.status === "Delivered")           return "Delivery completed";
  if (order.status === "Customer Accepted")   return "Payout eligible";
  if (order.status === "Disputed")            return "Support review in progress";
  return "Review";
}

function getSellerPrimaryAction(order) {
  const actions = getAllowedOrderActions(order.status, "seller");
  return actions[0] || "";
}

function renderOrderMetadata(item) {
  const metadata = item?.metadata || {};
  const lines = [];
  if (metadata.cakeWriting) lines.push(`Cake writing: ${metadata.cakeWriting}`);
  if (metadata.allergyNote) lines.push(`Allergy note: ${metadata.allergyNote}`);
  if (metadata.itemMessage) lines.push(`Card message: ${metadata.itemMessage}`);
  if (metadata.giftWrap !== undefined) lines.push(`Gift wrap: ${metadata.giftWrap ? "Yes" : "No"}`);
  return lines;
}

function renderOrderItemSummary(item) {
  const base = `${item.quantity}× ${item.productName} · ${formatCurrency(item.price)}`;
  const config = item?.configuration || {};
  if (config.type !== "build_your_box") {
    return { base, details: renderOrderMetadata(item) };
  }

  const perfumeName = config.selectedPerfume?.name || config.selectedPerfume?.productName || "Perfume";
  const treatName = config.selectedTreat?.name || config.selectedTreat?.productName || "Treat";
  const details = [
    `Build Your Box: ${perfumeName} + ${treatName}`,
    ...renderOrderMetadata(item),
  ];
  return { base, details };
}

function formatResolutionLabel(value) {
  return String(value || "—").replace(/_/g, " ");
}

function formatSellerOrderStatusLabel(status) {
  if (status === "Shipped") return "Delivery in progress";
  return status;
}

function formatCaseStatusLabel(status) {
  return String(status || "open").replace(/_/g, " ");
}

function formatDriverStatus(status) {
  if (status === "on_delivery") return "On delivery";
  if (status === "inactive") return "Inactive";
  return "Active";
}

function isSellerDriverActive(driver) {
  return Boolean(driver) && driver.isActive !== false && driver.status !== "inactive";
}

function driverStatusTone(driver) {
  if (driver.status === "on_delivery") return "amber";
  if (driver.status === "inactive" || driver.isActive === false) return "danger";
  return "success";
}

function formatDriverVehicle(vehicleType) {
  if (!vehicleType) return "Motorcycle";
  return String(vehicleType).replace(/_/g, " ");
}

function ownShopOrder(order, shopId) {
  return Boolean(order && shopId && Array.isArray(order.shopIds) && order.shopIds.includes(shopId));
}

function isDriverAssignableOrder(order, shopId) {
  return ownShopOrder(order, shopId) && order.status === "Ready for Delivery";
}

function resolveOrderDeliveryZone(order) {
  return String(order?.deliveryZone || order?.zone || order?.deliveryAddress || "").trim();
}

function formatOfferExpiry(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatOfferCountdown(value) {
  if (!value) return "—";
  const expires = new Date(value);
  if (Number.isNaN(expires.getTime())) return "—";
  const diff = expires.getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const minutes = Math.ceil(diff / 60000);
  if (minutes < 60) return `${minutes} min left`;
  const hours = Math.ceil(minutes / 60);
  return `${hours}h left`;
}

function driverMatchesBroadcastZone(driver, zone) {
  const driverZone = String(driver?.zone || "").trim().toLowerCase();
  const targetZone = String(zone || "").trim().toLowerCase();
  if (!targetZone) return true;
  if (!driverZone) return false;
  return driverZone.includes(targetZone) || targetZone.includes(driverZone);
}

const SUPPORT_STATUS_OPTIONS = [
  "all",
  "Open",
  "In Progress",
  "Waiting for Customer",
  "Waiting for Seller",
  "Waiting for Driver",
  "Resolved",
  "Closed",
];

const SUPPORT_PRIORITY_OPTIONS = ["all", "low", "normal", "high", "urgent"];

const SUPPORT_CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  { value: "general", label: "General help" },
  { value: "shop_account", label: "Shop account" },
  { value: "product_issue", label: "Product issue" },
  { value: "order_help", label: "Order help" },
  { value: "delivery_help", label: "Delivery help" },
  { value: "payment_question", label: "Payment question" },
  { value: "platform_help", label: "Platform help" },
  { value: "other", label: "Other" },
];

function formatSupportDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatSupportCategory(value) {
  const key = String(value || "").trim();
  if (!key) return "General help";
  const labels = {
    general: "General help",
    shop_account: "Shop account",
    product_issue: "Product issue",
    order_help: "Order help",
    delivery_help: "Delivery help",
    payment_question: "Payment question",
    platform_help: "Platform help",
    other: "Other",
  };
  return labels[key] || key.replace(/_/g, " ");
}

function supportStatusTone(status) {
  switch (status) {
    case "Open": return "warning";
    case "In Progress": return "brand";
    case "Waiting for Customer":
    case "Waiting for Seller":
    case "Waiting for Driver": return "amber";
    case "Resolved": return "success";
    case "Closed": return "muted";
    default: return "brand";
  }
}

function supportPriorityTone(priority) {
  if (priority === "urgent" || priority === "high") return "danger";
  if (priority === "normal") return "brand";
  return "muted";
}

function SupportPill({ value, kind = "status" }) {
  const tone = kind === "priority" ? supportPriorityTone(value) : supportStatusTone(value);
  return <span className={`support-ticket-pill support-ticket-pill--${tone}`}>{value}</span>;
}

function supportOrderLabel(order) {
  if (!order) return "No order linked";
  const status = formatSellerOrderStatusLabel(order.status || "");
  return `Order ${order.orderId}${status ? ` · ${status}` : ""}`;
}

function SellerSupportTicketDetail({ ticket, orderMap, onOpenOrder, replyDraft, setReplyDraft, replySaving, replyError, onReply, loading, loadError }) {
  const messages = Array.isArray(ticket?.messages) ? ticket.messages : [];
  const ticketOrder = ticket?.orderId ? orderMap.get(ticket.orderId) || null : null;

  return (
    <aside className="support-ticket-detail panel">
      {loadError ? (
        <EmptyState icon={Ticket} text={loadError || "Failed to load ticket details."} />
      ) : loading && !ticket ? (
        <EmptyState icon={Ticket} text="Loading ticket details…" />
      ) : !ticket ? (
        <EmptyState icon={Ticket} text="Select a support ticket to view details and reply." />
      ) : (
        <>
          <PanelHeader
            icon={Ticket}
            title={ticket.ticketNumber}
            action={<SupportPill value={ticket.status || "Open"} />}
          />

          <div className="support-ticket-detail-head">
            <strong>{ticket.subject}</strong>
            <p>{ticket.description}</p>
          </div>

          <div className="support-ticket-context-grid">
            <span><strong>Category</strong>{formatSupportCategory(ticket.category)}</span>
            <span><strong>Priority</strong><SupportPill kind="priority" value={ticket.priority || "normal"} /></span>
            <span><strong>Requester</strong>{ticket.requesterName || ticket.requesterEmail || ticket.requesterRole || "—"}</span>
            <span><strong>Created</strong>{formatSupportDate(ticket.createdAt)}</span>
            <span><strong>Updated</strong>{formatSupportDate(ticket.updatedAt)}</span>
            <span><strong>Assigned</strong>{ticket.assignedToUserName || "Unassigned"}</span>
          </div>

          {ticket.orderId ? (
            <div className="support-ticket-order-link">
              <span>
                <PackageCheck size={14} />
                {supportOrderLabel(ticketOrder || { orderId: ticket.orderId, status: "" })}
              </span>
              <button className="ghost-action compact" type="button" onClick={() => onOpenOrder?.(ticket.orderId)}>
                Open order
                <ArrowRight size={14} />
              </button>
            </div>
          ) : null}

          <section className="support-ticket-thread">
            <span className="support-ticket-thread-head">
              <MessageSquare size={14} />
              Conversation
            </span>
            {messages.length ? (
              messages.map((message) => (
                <article className="support-ticket-message" key={message.id}>
                  <div className="support-ticket-message-head">
                    <strong>{message.by || "System"}</strong>
                    <span>{message.role || "system"} · {formatSupportDate(message.createdAt)}</span>
                  </div>
                  <p>{message.body}</p>
                  {(message.attachments || []).length > 0 ? (
                    <div className="support-ticket-attachments">
                      {message.attachments.map((attachment, index) => (
                        <span className="support-ticket-attachment" key={`${message.id}-attachment-${index}`}>
                          {typeof attachment === "string" ? attachment : attachment?.name || "Attachment"}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <EmptyState icon={MessageSquare} text="No messages yet." />
            )}
          </section>

          <section className="support-ticket-reply">
            <span className="support-ticket-thread-head">
              <MessageSquare size={14} />
              Reply
            </span>
            <textarea
              rows={4}
              value={replyDraft}
              onChange={(event) => setReplyDraft(event.target.value)}
              placeholder="Write your reply here"
            />
            {replyError ? <small className="support-ticket-error">{replyError}</small> : null}
            <div className="support-ticket-reply-actions">
              <button
                className="primary-action"
                type="button"
                disabled={replySaving || !replyDraft.trim()}
                onClick={onReply}
              >
                {replySaving ? "Sending…" : "Send reply"}
              </button>
              <small className="support-ticket-reply-note">
                Replies are visible to your shop and the support team handling this ticket.
              </small>
            </div>
          </section>
        </>
      )}
    </aside>
  );
}

export { getShopType, SHOP_TYPE_META, SHOP_CATEGORIES, DEFAULT_BY_TYPE, productTypeLabel, getStockHealth, orderNextAction, getSellerPrimaryAction, renderOrderMetadata, renderOrderItemSummary, formatResolutionLabel, formatSellerOrderStatusLabel, formatCaseStatusLabel, formatDriverStatus, isSellerDriverActive, driverStatusTone, formatDriverVehicle, ownShopOrder, isDriverAssignableOrder, resolveOrderDeliveryZone, formatOfferExpiry, formatOfferCountdown, driverMatchesBroadcastZone, SUPPORT_STATUS_OPTIONS, SUPPORT_PRIORITY_OPTIONS, SUPPORT_CATEGORY_OPTIONS, formatSupportDate, formatSupportCategory, supportStatusTone, supportPriorityTone, SupportPill, supportOrderLabel, SellerSupportTicketDetail };
