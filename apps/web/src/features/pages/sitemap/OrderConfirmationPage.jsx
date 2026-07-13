import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, HelpCircle, Lock, PackageCheck, RefreshCw, ShoppingBag } from "lucide-react";
import { ordersApi } from "@tuti/shared/api/client.js";
import { StatusBadge } from "@tuti/shared/components/StatusBadge.jsx";
import { useAuthStore } from "@tuti/shared/store/authStore.js";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import {
  BuildGiftCartSummary,
  CustomerTimeline,
  ItemFacts,
  PageHero,
  formatDeliverySummary,
  formatOrderDate,
  formatPaymentMethod,
  isCustomizedGiftItem,
} from "./sitemapPageShared.jsx";
import "../account.css";

function getOrderIdFromPath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] !== "orders" || !parts[1]) return "";
  return decodeURIComponent(parts[1]).trim();
}

function getGuestToken(orderId) {
  if (!orderId) return null;
  try { return sessionStorage.getItem(`tuti_order_token_${orderId}`) || null; } catch { return null; }
}

export function OrderConfirmationPage({ onNavigate }) {
  const { isAuthenticated } = useAuthStore();
  const [orderId] = useState(getOrderIdFromPath);
  const [state, setState] = useState({ status: "loading", order: null, error: "" });

  useEffect(() => {
    if (!orderId) {
      setState({ status: "not-found", order: null, error: "" });
      return;
    }

    let mounted = true;
    setState({ status: "loading", order: null, error: "" });

    const guestToken = getGuestToken(orderId);
    ordersApi.get(orderId, guestToken)
      .then((order) => {
        if (mounted) setState({ status: "loaded", order, error: "" });
      })
      .catch((err) => {
        if (!mounted) return;
        const msg = err.message || "";
        if (msg.includes("not found") || msg.includes("404")) {
          setState({ status: "not-found", order: null, error: "" });
        } else if (msg.includes("Access denied") || msg.includes("403") || msg.includes("401")) {
          setState({ status: "unauthorized", order: null, error: "" });
        } else {
          setState({ status: "error", order: null, error: "We could not load your order right now. Please try again." });
        }
      });

    return () => { mounted = false; };
  }, [orderId]);

  const { status, order, error } = state;

  if (status === "loading") {
    return (
      <main className="page-shell">
        <PageHero kicker="Order" title="Loading your order…" text="Retrieving your order details." />
        <section className="order-confirmation-panel">
          <p className="muted-label">Please wait…</p>
        </section>
      </main>
    );
  }

  if (status === "not-found") {
    return (
      <main className="page-shell">
        <PageHero kicker="Order" title="Order not found" text="We could not find an order with that reference." />
        <section className="order-confirmation-panel">
          <div className="order-confirmation-header">
            <span className="sitemap-card-icon"><AlertCircle size={22} /></span>
            <div>
              <p>The order reference may be incorrect or the order may have been removed.</p>
            </div>
          </div>
          <div className="order-confirmation-actions">
            <button className="primary-action compact" onClick={() => onNavigate?.("/shop")} type="button">
              <ShoppingBag size={16} /> Continue shopping
            </button>
            {isAuthenticated() ? (
              <button className="secondary-action compact" onClick={() => onNavigate?.("/account")} type="button">
                <PackageCheck size={16} /> My orders
              </button>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  if (status === "unauthorized") {
    return (
      <main className="page-shell">
        <PageHero kicker="Order" title="Access not permitted" text="You do not have permission to view this order." />
        <section className="order-confirmation-panel">
          <div className="order-confirmation-header">
            <span className="sitemap-card-icon"><Lock size={22} /></span>
            <div>
              <p>This order belongs to a different account, or the confirmation link has expired.</p>
              {isAuthenticated() ? null : (
                <p className="order-confirmation-subnote">If you placed this order as a guest, please use the link from your checkout confirmation.</p>
              )}
            </div>
          </div>
          <div className="order-confirmation-actions">
            {isAuthenticated() ? (
              <button className="secondary-action compact" onClick={() => onNavigate?.("/account")} type="button">
                <PackageCheck size={16} /> My orders
              </button>
            ) : null}
            <button className="primary-action compact" onClick={() => onNavigate?.("/shop")} type="button">
              <ShoppingBag size={16} /> Continue shopping
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="page-shell">
        <PageHero kicker="Order" title="Could not load order" text={error} />
        <section className="order-confirmation-panel">
          <button className="secondary-action compact" onClick={() => setState({ status: "loading", order: null, error: "" })} type="button">
            <RefreshCw size={16} /> Retry
          </button>
        </section>
      </main>
    );
  }

  // Loaded — premium confirmation view
  return (
    <main className="tuti-account">
      {/* Premium confirmation hero */}
      <div className="tuti-account__conf-hero">
        <div className="tuti-account__conf-hero-inner">
          <div className="tuti-account__conf-hero-icon"><CheckCircle2 size={22} /></div>
          <div className="tuti-account__conf-hero-info">
            <span className="tuti-account__conf-hero-kicker">Order confirmed</span>
            <h1 className="tuti-account__conf-hero-title">{order.orderId}</h1>
            <span className="tuti-account__conf-hero-sub">
              Placed {formatOrderDate(order.createdAt)} · {formatCurrency(order.subtotal)}
            </span>
          </div>
        </div>
      </div>

      <div className="tuti-account__body">
        <section className="order-confirmation-panel">
          <div className="order-confirmation-meta">
            <span><strong>Status</strong><StatusBadge status={order.status} /></span>
            <span><strong>Payment method</strong>{formatPaymentMethod(order.paymentMethod)}</span>
            {order.paymentStatus ? <span><strong>Payment status</strong>{order.paymentStatus}</span> : null}
            <span><strong>Customer</strong>{order.customerName} · {order.customerEmail}</span>
            {order.phone ? <span><strong>Phone</strong>{order.phone}</span> : null}
            <span><strong>Delivery address</strong>{order.deliveryAddress || "Not provided"}</span>
            <span><strong>Delivery</strong>{formatDeliverySummary(order)}</span>
          </div>

          {(order.giftMessage || order.notes) ? (() => {
            const hasGiftBuild = (order.items || []).some((item) => isCustomizedGiftItem(item));
            return (
              <div className="order-confirmation-note">
                {order.giftMessage ? <p><strong>{hasGiftBuild ? "Gift message" : "Order note"}:</strong> {order.giftMessage}</p> : null}
                {order.notes ? <p><strong>Order note:</strong> {order.notes}</p> : null}
              </div>
            );
          })() : null}

          <div className="order-confirmation-items">
            {(order.items || []).map((item, index) => {
              const isGiftBuild = isCustomizedGiftItem(item);
              return (
                <div className="order-summary-item" key={`${order.orderId}-${item.productId}-${index}`}>
                  <div>
                    <span>{item.productName}</span>
                    <ItemFacts item={item} />
                    {isGiftBuild ? (
                      <>
                        <span className="tuti-account__gift-badge">✦ Customized gift</span>
                        <BuildGiftCartSummary item={item} />
                      </>
                    ) : null}
                  </div>
                  <small>Qty {item.quantity} · {formatCurrency(item.price)}</small>
                  <strong>{formatCurrency(item.price * item.quantity)}</strong>
                </div>
              );
            })}
          </div>

          <div className="order-confirmation-totals">
            <span><strong>Items</strong>{formatCurrency(order.subtotal)}</span>
            <span><strong>Delivery</strong>{order.deliveryDate ? formatDeliverySummary(order) : "Included at checkout"}</span>
            <span><strong>Total</strong>{formatCurrency(order.subtotal)}</span>
          </div>

          <CustomerTimeline order={order} />

          <div className="order-next-steps">
            <strong>What happens next</strong>
            <ol className="order-next-steps-list">
              <li>The seller reviews and confirms your order — usually within a few hours.</li>
              <li>
                {order.paymentMethod === "cod"
                  ? "A driver will be assigned to collect and deliver your order."
                  : "Your order is prepared and dispatched once payment is confirmed."}
              </li>
              <li>
                {order.deliveryDate
                  ? `Your order is scheduled for delivery on ${formatDeliverySummary(order)}.`
                  : "You will receive an update when your order is ready for delivery."}
              </li>
              <li>
                {order.paymentMethod === "cod"
                  ? "Pay the driver in cash when your order arrives."
                  : "Payment is already captured — no further action needed."}
              </li>
            </ol>
            <p className="order-tracking-note">
              Tracking updates will appear in the delivery timeline above as your order progresses. Keep this page bookmarked for real-time status.
            </p>
          </div>

          {/* Support CTA */}
          <div className="tuti-account__support">
            <div className="tuti-account__support-text">
              <strong>Need help with this order?</strong>
              <span>Contact our support team for any questions about your order.</span>
            </div>
            <button className="ghost-action compact" onClick={() => onNavigate?.("/support")} type="button">
              <HelpCircle size={15} /> Get help
            </button>
          </div>

          <div className="order-confirmation-actions">
            <button className="primary-action compact" onClick={() => onNavigate?.("/shop")} type="button">
              <ShoppingBag size={16} /> Continue shopping
            </button>
            {isAuthenticated() ? (
              <button className="secondary-action compact" onClick={() => onNavigate?.("/account")} type="button">
                <PackageCheck size={16} /> My orders
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
