import { useEffect, useState } from "react";
import { CheckCircle2, HelpCircle, PackageCheck, ShoppingBag, User } from "lucide-react";
import { ordersApi } from "@tuti/shared/api/client.js";
import { StatusBadge } from "@tuti/shared/components/StatusBadge.jsx";
import { useAuthStore } from "@tuti/shared/store/authStore.js";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import {
  ItemConfigurationSummary,
  ItemFacts,
  ItemMetadataSummary,
  OrderStatusTimeline,
  PageHero,
  customerResolutionSummary,
  formatDeliverySummary,
  formatOrderDate,
  formatPaymentMethod,
  formatResolutionValue,
  getOrderItemCount,
} from "./sitemapPageShared.jsx";

export function AccountPage({ onNavigate }) {
  const { user, isAuthenticated } = useAuthStore();
  const [ordersState, setOrdersState] = useState({ loading: false, error: "", orders: [] });
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [orderFeedback, setOrderFeedback] = useState({});
  const [disputeNotes, setDisputeNotes] = useState({});
  const [feedbackLoading, setFeedbackLoading] = useState({});
  const [deepLinkNotice, setDeepLinkNotice] = useState("");
  const authenticated = isAuthenticated();

  async function handleCustomerAction(orderId, action, note) {
    setFeedbackLoading((prev) => ({ ...prev, [orderId]: true }));
    try {
      const updatedOrder = await ordersApi.customerAction(orderId, action, note);
      setOrdersState((current) => ({
        ...current,
        orders: current.orders.map((order) => (order.orderId === orderId ? { ...order, ...updatedOrder } : order)),
      }));
      setOrderFeedback((prev) => ({ ...prev, [orderId]: action === "accept" ? "accepted" : "reported" }));
    } catch (err) {
      setOrderFeedback((prev) => ({ ...prev, [orderId]: `error:${err.message}` }));
    } finally {
      setFeedbackLoading((prev) => ({ ...prev, [orderId]: false }));
    }
  }

  useEffect(() => {
    let mounted = true;
    if (!authenticated) {
      setOrdersState({ loading: false, error: "", orders: [] });
      setSelectedOrderId("");
      return () => { mounted = false; };
    }

    setOrdersState((current) => ({ ...current, loading: true, error: "" }));
    ordersApi.list({ page: 1, limit: 10 })
      .then((result) => {
        if (!mounted) return;
        const orders = result?.orders || [];
        setOrdersState({ loading: false, error: "", orders });
        setSelectedOrderId((current) => current || orders[0]?.orderId || "");
      })
      .catch((error) => {
        if (mounted) setOrdersState({ loading: false, error: error.message, orders: [] });
      });

    return () => { mounted = false; };
  }, [authenticated, user?.email]);

  useEffect(() => {
    if (!authenticated || ordersState.loading) return;
    const requestedOrderId = new URLSearchParams(window.location.search).get("order");
    if (!requestedOrderId) return;
    const requestedOrder = ordersState.orders.find((order) => order.orderId === requestedOrderId);
    if (requestedOrder) {
      setSelectedOrderId(requestedOrderId);
      setDeepLinkNotice("");
      return;
    }
    setDeepLinkNotice("Order not found or not visible.");
  }, [authenticated, ordersState.loading, ordersState.orders]);

  const selectedOrder = ordersState.orders.find((order) => order.orderId === selectedOrderId) || null;

  return (
    <main className="page-shell">
      <PageHero
        kicker="Account"
        title={authenticated ? `${user?.name}'s account` : "Login, register, orders, wishlist, and rewards"}
        text={authenticated ? "Review recent orders, delivery details, and support actions from your customer account." : "Login to save orders, addresses, wishlist items, and rewards."}
      >
        <button className="secondary-action" onClick={() => onNavigate("/cart")} type="button">
          <ShoppingBag size={18} />
          View cart
        </button>
      </PageHero>

      {!authenticated ? (
        <section className="account-grid">
          {["Orders", "Wishlist", "Rewards", "Saved addresses"].map((section, index) => (
            <article className={index < 2 ? "account-card highlighted" : "account-card"} key={section}>
              <span className="sitemap-card-icon">{section.includes("Order") ? <PackageCheck size={19} /> : <User size={19} />}</span>
              <h2>{section}</h2>
              <p>{section === "Wishlist" ? "Saved perfumes and future gift ideas." : "Login to unlock saved account activity and order history."}</p>
            </article>
          ))}
        </section>
      ) : (
        <section className="account-orders-layout">
          <div className="account-orders-panel">
            <div className="account-section-heading">
              <span className="sitemap-card-icon"><PackageCheck size={19} /></span>
              <div>
                <h2>Recent orders</h2>
                <p>Latest account orders from the Tuti marketplace.</p>
              </div>
            </div>

            {ordersState.loading ? <p className="muted-label">Loading your orders...</p> : null}
            {ordersState.error ? <p className="error-state checkout-error">We could not load your orders right now. Please try again in a moment.</p> : null}
            {deepLinkNotice ? <p className="checkout-error">We could not find that order in your history.</p> : null}
            {!ordersState.loading && !ordersState.error && !ordersState.orders.length ? (
              <div className="account-empty-state">
                <ShoppingBag size={24} />
                <h3>No orders yet</h3>
                <p>Your confirmed Tuti orders will appear here after checkout.</p>
                <button className="primary-action compact" onClick={() => onNavigate("/shop")} type="button">
                  Shop now
                </button>
              </div>
            ) : null}

            <div className="account-order-list">
              {ordersState.orders.map((order) => (
                <button
                  className={order.orderId === selectedOrder?.orderId ? "account-order-row active" : "account-order-row"}
                  key={order.orderId}
                  onClick={() => setSelectedOrderId(order.orderId)}
                  type="button"
                >
                  <div>
                    <strong>{order.orderId}</strong>
                    <span>{formatOrderDate(order.createdAt)} · {getOrderItemCount(order)} item{getOrderItemCount(order) === 1 ? "" : "s"}</span>
                  </div>
                  <div>
                    <StatusBadge status={order.status} />
                    <small>{order.paymentStatus}</small>
                  </div>
                  <strong>{formatCurrency(order.subtotal)}</strong>
                </button>
              ))}
            </div>
          </div>

          {selectedOrder ? (
            <aside className="account-order-detail">
              <div className="account-section-heading">
                <span className="sitemap-card-icon"><CheckCircle2 size={19} /></span>
                <div>
                  <h2>{selectedOrder.orderId}</h2>
                  <p>{formatPaymentMethod(selectedOrder.paymentMethod)} · {selectedOrder.paymentStatus}</p>
                </div>
                <button
                  className="ghost-action compact"
                  onClick={() => onNavigate(`/orders/${selectedOrder.orderId}`)}
                  type="button"
                  title="Open persistent order page"
                >
                  View full order
                </button>
              </div>
              <div className="order-confirmation-meta">
                <span><strong>Status</strong><StatusBadge status={selectedOrder.status} /></span>
                <span><strong>Payment method</strong>{formatPaymentMethod(selectedOrder.paymentMethod)}</span>
                <span><strong>Payment status</strong>{selectedOrder.paymentStatus || "Pending"}</span>
                <span><strong>Delivery</strong>{formatDeliverySummary(selectedOrder)}</span>
                <span><strong>Address</strong>{selectedOrder.deliveryAddress || "Address not provided"}</span>
              </div>
              <OrderStatusTimeline order={selectedOrder} />
              <div className="account-order-items">
                {(selectedOrder.items || []).map((item, index) => {
                  const hasBuildBox = item?.configuration?.type === "build_your_box";
                  return (
                    <div className="order-summary-item account-order-item-group" key={`${selectedOrder.orderId}-${item.productId}-${index}`}>
                      <div className="account-order-item-main">
                        <span>
                          <strong>{item.productName}</strong>
                          {hasBuildBox ? <small className="account-order-item-tag">Build Your Box</small> : null}
                          <ItemFacts item={item} />
                          <ItemConfigurationSummary item={item} />
                          <ItemMetadataSummary item={item} />
                        </span>
                      </div>
                      <small>Qty {item.quantity}</small>
                      <strong>{formatCurrency(item.price * item.quantity)}</strong>
                    </div>
                  );
                })}
              </div>
              {(selectedOrder.giftMessage || selectedOrder.notes) ? (
                <div className="account-order-note">
                  {selectedOrder.giftMessage ? <p><strong>Gift message:</strong> {selectedOrder.giftMessage}</p> : null}
                  {selectedOrder.notes ? <p><strong>Notes:</strong> {selectedOrder.notes}</p> : null}
                </div>
              ) : null}
              {selectedOrder.resolutionDecision ? (
                <div className="account-order-resolution">
                  <strong>Dispute update</strong>
                  {(() => {
                    const safeDecision = customerResolutionSummary(selectedOrder.resolutionDecision);
                    if (!safeDecision) return null;
                    return (
                      <>
                        <div className="account-order-resolution-grid">
                          <span><small>Status</small>{formatResolutionValue(safeDecision.status)}</span>
                          <span><small>Refund</small>{formatResolutionValue(safeDecision.refundDecision)}</span>
                          <span><small>Order</small>{formatResolutionValue(safeDecision.orderDecision)}</span>
                          <span><small>COD</small>{formatResolutionValue(safeDecision.codResolution)}</span>
                          {safeDecision.decidedAt ? (
                            <span><small>Decided at</small>{new Date(safeDecision.decidedAt).toLocaleString()}</span>
                          ) : null}
                          {safeDecision.executedAt ? (
                            <span><small>Finalized at</small>{new Date(safeDecision.executedAt).toLocaleString()}</span>
                          ) : null}
                        </div>
                        <p>{safeDecision.message}</p>
                      </>
                    );
                  })()}
                </div>
              ) : null}
              <div className="order-confirmation-totals">
                <span><strong>Items</strong>{formatCurrency(selectedOrder.subtotal)}</span>
                <span><strong>Delivery</strong>{selectedOrder.deliveryDate ? formatDeliverySummary(selectedOrder) : "Included at checkout"}</span>
                <span><strong>Total</strong>{formatCurrency(selectedOrder.subtotal)}</span>
              </div>
              {selectedOrder.status === "Customer Accepted" ? (
                <div className="account-order-note">
                  <p style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <CheckCircle2 size={14} />
                    <strong>Order accepted.</strong>&nbsp;Thanks for confirming delivery. This order is now closed from your side.
                  </p>
                </div>
              ) : null}
              {selectedOrder.status === "Disputed" ? (
                <div className="account-order-note">
                  <p style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <HelpCircle size={14} />
                    <strong>Dispute review opened.</strong>&nbsp;Your report was received. Tuti support will review the dispute and follow up.
                  </p>
                </div>
              ) : null}
              {selectedOrder.status === "Delivered" && (
                <div className="account-order-note">
                  {orderFeedback[selectedOrder.orderId] === "accepted" ? (
                    <p style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <CheckCircle2 size={14} />
                      <strong>Delivery confirmed.</strong>&nbsp;Thank you. Your feedback has been recorded.
                    </p>
                  ) : orderFeedback[selectedOrder.orderId] === "reported" ? (
                    <p style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <HelpCircle size={14} />
                      <strong>Dispute reported.</strong>&nbsp;Our support team will follow up shortly on the dispute.
                    </p>
                  ) : orderFeedback[selectedOrder.orderId]?.startsWith("error:") ? (
                    <>
                      <p style={{ color: "var(--danger, #b42318)", marginBottom: "0.5rem" }}>
                        {orderFeedback[selectedOrder.orderId].slice(6)}
                      </p>
                      <button
                        className="ghost-action compact"
                        type="button"
                        onClick={() => setOrderFeedback((prev) => ({ ...prev, [selectedOrder.orderId]: undefined }))}
                      >
                        Try again
                      </button>
                    </>
                  ) : orderFeedback[selectedOrder.orderId] === "reporting" ? (
                    <>
                      <p>Please describe the issue so our support team can review the dispute.</p>
                      <textarea
                        value={disputeNotes[selectedOrder.orderId] || ""}
                        onChange={(e) => setDisputeNotes((prev) => ({ ...prev, [selectedOrder.orderId]: e.target.value }))}
                        placeholder="e.g. Order arrived damaged, wrong item, missing item…"
                        rows={3}
                        style={{ width: "100%", marginTop: "0.5rem", padding: "0.5rem", borderRadius: "6px", border: "1px solid #cdd5d0", fontSize: "0.875rem", fontFamily: "inherit", resize: "vertical" }}
                      />
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                        <button
                          className="secondary-action compact"
                          type="button"
                          disabled={!disputeNotes[selectedOrder.orderId]?.trim() || feedbackLoading[selectedOrder.orderId]}
                          onClick={() => handleCustomerAction(selectedOrder.orderId, "dispute", disputeNotes[selectedOrder.orderId])}
                        >
                          <HelpCircle size={15} />
                          {feedbackLoading[selectedOrder.orderId] ? "Submitting…" : "Open dispute"}
                        </button>
                        <button
                          className="ghost-action compact"
                          type="button"
                          disabled={feedbackLoading[selectedOrder.orderId]}
                          onClick={() => setOrderFeedback((prev) => ({ ...prev, [selectedOrder.orderId]: undefined }))}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>Did everything arrive as expected?</p>
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                        <button
                          className="secondary-action compact"
                          type="button"
                          disabled={feedbackLoading[selectedOrder.orderId]}
                          onClick={() => handleCustomerAction(selectedOrder.orderId, "accept", null)}
                        >
                          <CheckCircle2 size={15} />
                          {feedbackLoading[selectedOrder.orderId] ? "Confirming…" : "I received my order"}
                        </button>
                        <button
                          className="ghost-action compact"
                          type="button"
                          onClick={() => setOrderFeedback((prev) => ({ ...prev, [selectedOrder.orderId]: "reporting" }))}
                        >
                          <HelpCircle size={15} />
                          Contact support
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </aside>
          ) : (
            <aside className="account-order-detail">
              <div className="account-empty-state">
                <PackageCheck size={24} />
                <h3>No order selected</h3>
                <p>Select an order from the list to view delivery details and support options.</p>
              </div>
            </aside>
          )}
        </section>
      )}
    </main>
  );
}
