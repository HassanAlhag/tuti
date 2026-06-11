import { useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck, CheckCircle2, ShoppingBag, Package, Star, AlertTriangle, Wallet, Truck, MessageSquare } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "../api/client.js";
import { useAuthStore } from "../store/authStore.js";

const TYPE_ICON = {
  new_order: ShoppingBag,
  order_status: Package,
  order_delivered: CheckCircle2,
  product_approved: Check,
  product_rejected: AlertTriangle,
  payout_ready: Wallet,
  payout_released: Wallet,
  new_review: Star,
  dispute_opened: AlertTriangle,
  payment_captured: Wallet,
  low_stock: AlertTriangle,
  delivery_offer: Truck,
  delivery_offer_accepted: CheckCircle2,
  delivery_offer_cancelled: AlertTriangle,
  support_ticket_created: MessageSquare,
  support_ticket_replied: MessageSquare,
  support_ticket_status_changed: MessageSquare,
  support_ticket_assigned: MessageSquare,
  support_ticket_internal_note: MessageSquare,
};

function humanize(value) {
  return String(value || "").replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function notificationMetaLabel(notification) {
  if (String(notification?.type || "").startsWith("support_ticket")) {
    return "Support Ticket";
  }
  const entity = notification?.entityType ? humanize(notification.entityType) : "";
  const type = notification?.type ? humanize(notification.type) : "";
  if (entity && type && entity === type) return entity;
  if (entity && type) return `${entity} · ${type}`;
  return entity || type || "System";
}

function buildNotificationPath(notification, role) {
  const entityType = notification?.entityType;
  const entityId = notification?.entityId;

  if (entityType === "support" || String(notification?.type || "").startsWith("support_ticket")) {
    const ticketParam = entityId ? `?ticket=${encodeURIComponent(entityId)}` : "";
    if (role === "customer") {
      return `/support${ticketParam}`;
    }
    if (role === "seller") {
      return `/seller/support${ticketParam}`;
    }
    if (role === "driver") {
      return `/?section=support${ticketParam}`;
    }
    if (role === "admin" || role === "support") {
      return `/admin/support-tickets${ticketParam}`;
    }
  }

  if (role === "customer") {
    if ((entityType === "order" || entityType === "support") && entityId) {
      return `/account?order=${encodeURIComponent(entityId)}`;
    }
    return "/account";
  }

  if (role === "seller") {
    if (entityType === "delivery_offer") {
      return "/?section=drivers";
    }
    if ((entityType === "order" || entityType === "support") && entityId) {
      return `/?section=orders&order=${encodeURIComponent(entityId)}`;
    }
    if (entityType === "product" && entityId) {
      return `/?section=products&product=${encodeURIComponent(entityId)}`;
    }
    if (entityType === "shop") {
      return "/?section=overview";
    }
    return "";
  }

  if (role === "admin" || role === "support") {
    if (entityType === "delivery_offer") {
      return "/admin/drivers";
    }
    if (entityType === "order" && entityId) {
      return `/?section=orders&order=${encodeURIComponent(entityId)}`;
    }
    if (entityType === "support" && entityId) {
      return `/?section=support&order=${encodeURIComponent(entityId)}`;
    }
    if (entityType === "shop" && entityId) {
      return `/?section=shops&shop=${encodeURIComponent(entityId)}`;
    }
    if (entityType === "product") {
      return "/?section=shops";
    }
    return "";
  }

  return "";
}

function navigatePath(path) {
  if (!path) return;
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function NotificationBell({ onNotificationNavigate = null }) {
  const { isAuthenticated, user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const qc = useQueryClient();

  const { data: countData } = useQuery({
    queryKey: ["notifications-count", user?.sub],
    queryFn: () => notificationsApi.count(),
    enabled: isAuthenticated(),
    refetchInterval: 30_000,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.sub],
    queryFn: () => notificationsApi.list(),
    enabled: open && isAuthenticated(),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!isAuthenticated()) return null;

  const unreadCount = countData?.count || 0;

  return (
    <div className="notification-bell" ref={panelRef}>
      <button
        className="icon-button notification-trigger"
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        type="button"
      >
        <Bell size={18} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-panel notification-menu" role="dialog" aria-label="Notifications">
          <div className="notification-panel-head notification-menu-head">
            <div className="notification-menu-title">
              <strong>Notifications</strong>
              <span className="notification-menu-count">{unreadCount} unread</span>
            </div>
            {unreadCount > 0 && (
              <button
                className="ghost-action compact"
                onClick={() => markAllMutation.mutate()}
                type="button"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-list notification-menu-list">
            {notifications.length === 0 ? (
              <div className="notification-empty notification-menu-empty">No notifications yet.</div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICON[n.type] || Bell;
                const deepLinkPath = buildNotificationPath(n, user?.role);
                return (
                  <button
                    key={n._id || n.id}
                    className={`notification-item notification-menu-item${n.read ? "" : " unread"}`}
                    type="button"
                    onClick={async () => {
                      if (!n.read) {
                        try {
                          await markReadMutation.mutateAsync(n.id || n._id);
                        } catch {
                          return;
                        }
                      }
                      if (deepLinkPath) {
                        navigatePath(deepLinkPath);
                      } else if (typeof onNotificationNavigate === "function") {
                        onNotificationNavigate(n, "");
                      }
                      setOpen(false);
                    }}
                  >
                    <span className="notification-icon notification-menu-icon"><Icon size={14} /></span>
                    <div className="notification-body notification-menu-body">
                      <strong>{n.title}</strong>
                      <p>{n.message}</p>
                      <small className="notification-menu-meta">{notificationMetaLabel(n)} · {timeAgo(n.createdAt)}</small>
                    </div>
                    {!n.read && <span className="unread-dot notification-menu-dot" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
