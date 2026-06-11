import { useRef, useState } from "react";
import { CreditCard, ShoppingBag, User, WalletCards } from "lucide-react";
import { ordersApi } from "@tuti/shared/api/client.js";
import { BottleArt } from "@tuti/shared/components/BottleArt.jsx";
import { useAuthStore } from "@tuti/shared/store/authStore.js";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import {
  ItemConfigurationSummary,
  ItemFacts,
  PageHero,
  compactOrderItem,
  formatPaymentMethod,
  getCartLineKey,
  isCakeLikeItem,
  isGiftLikeItem,
} from "./sitemapPageShared.jsx";

export function CartCheckoutPage({ cart, cartTotal, clearCart, onNavigate, platformFee, updateCartQuantity, updateItemMetadata, vendorNet }) {
  const { user, isAuthenticated } = useAuthStore();
  const [checkoutMode, setCheckoutMode] = useState(isAuthenticated() ? "account" : "guest");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [orderError, setOrderError] = useState("");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  // Idempotency key: generated lazily on first submit; reused on retry; reset after success
  const idempotencyKeyRef = useRef(null);
  const [form, setForm] = useState({
    customerName: user?.name || "",
    customerEmail: user?.email || "",
    phone: "",
    deliveryAddress: "",
    deliveryDate: "",
    deliveryTime: "",
    giftMessage: "",
    notes: "",
  });

  const payableNow = paymentMethod === "card" ? cartTotal : 0;
  const isAccountCheckout = isAuthenticated() && checkoutMode === "account";

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function requestLogin() {
    window.dispatchEvent(new CustomEvent("tuti:open-auth"));
  }

  function updateMetadata(productId, field, value) {
    updateItemMetadata?.(productId, { [field]: value });
  }

  function getOrCreateIdempotencyKey() {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    return idempotencyKeyRef.current;
  }

  async function placeOrder(event) {
    event.preventDefault();
    if (!cart.length || isPlacingOrder) return;

    setOrderError("");
    setIsPlacingOrder(true);
    const idemKey = getOrCreateIdempotencyKey();
    try {
      const order = await ordersApi.create({
        checkoutMode: isAccountCheckout ? "account" : "guest",
        paymentMethod,
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        phone: form.phone,
        deliveryAddress: form.deliveryAddress,
        deliveryDate: form.deliveryDate,
        deliveryTime: form.deliveryTime,
        giftMessage: form.giftMessage,
        notes: form.notes,
        items: cart.map(compactOrderItem),
      }, idemKey);

      // Reset idempotency key after confirmed success
      idempotencyKeyRef.current = null;

      // Persist guest token in sessionStorage for confirmation page access
      if (order.guestToken) {
        try { sessionStorage.setItem(`tuti_order_token_${order.orderId}`, order.guestToken); } catch { /* private browsing */ }
      }

      // Clear cart only after backend confirms success
      clearCart?.();

      // Navigate to persistent confirmation route
      if (onNavigate) {
        onNavigate(`/orders/${order.orderId}`);
      } else {
        window.history.pushState(null, "", `/orders/${order.orderId}`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    } catch (error) {
      setOrderError(mapCheckoutError(error.message));
    } finally {
      setIsPlacingOrder(false);
    }
  }

  function mapCheckoutError(message) {
    if (!message) return "We could not place your order. Please try again.";
    if (message.includes("no longer available")) return message;
    if (message.includes("sold out")) return message;
    if (message.includes("pairing")) return message;
    if (message.includes("changed")) return message;
    if (message.includes("network") || message.toLowerCase().includes("fetch")) {
      return "We could not confirm the order yet. Please retry — your order will not be duplicated.";
    }
    if (message.includes("Authentication") || message.includes("token") || message.includes("401")) {
      return "Your session has expired. Please sign in again and retry.";
    }
    return "We could not place your order. Please try again.";
  }

  return (
    <main className="page-shell">
      <PageHero
        kicker="Cart & checkout"
        title="Continue your order"
        text="Review your order, confirm your delivery details, and choose from the payment options shown at checkout."
      />

      <section className="checkout-layout">
        <form className="checkout-form-panel" id="checkout-form" onSubmit={placeOrder}>
          <section className="checkout-choice-grid" aria-label="Checkout identity" role="radiogroup">
            <button
              aria-checked={isAccountCheckout}
              aria-pressed={isAccountCheckout}
              className={isAccountCheckout ? "checkout-choice active" : "checkout-choice"}
              disabled={!isAuthenticated()}
              onClick={() => setCheckoutMode("account")}
              role="radio"
              type="button"
            >
              <User size={19} aria-hidden="true" />
              <strong>Client login</strong>
              <span>{isAuthenticated() ? `Ordering as ${user?.name || user?.email}` : "Login to save orders and addresses"}</span>
            </button>
            <button
              aria-checked={!isAccountCheckout}
              aria-pressed={!isAccountCheckout}
              className={!isAccountCheckout ? "checkout-choice active" : "checkout-choice"}
              disabled={isAuthenticated()}
              onClick={() => setCheckoutMode("guest")}
              role="radio"
              type="button"
            >
              <ShoppingBag size={19} aria-hidden="true" />
              <strong>Guest checkout</strong>
              <span>{isAuthenticated() ? "Unavailable while signed in." : "No account required. We send the order confirmation by email."}</span>
            </button>
          </section>

          {isAuthenticated() ? (
            <p className="checkout-auth-helper">You are signed in, so this order will be saved to your account.</p>
          ) : null}

          {!isAuthenticated() ? (
            <button className="secondary-action compact checkout-login-link" onClick={requestLogin} type="button">
              <User size={16} />
              Login instead
            </button>
          ) : null}

          <section className="checkout-form-card">
            <div className="checkout-card-heading">
              <span>1</span>
              <div>
                <h2>Customer details</h2>
                <p>Use a customer account or continue as guest.</p>
              </div>
            </div>
            <div className="checkout-form-grid">
              <label>
                Full name
                <input required value={form.customerName} onChange={(event) => updateForm("customerName", event.target.value)} placeholder="Your name" />
              </label>
              <label>
                Email
                <input required type="email" value={form.customerEmail} onChange={(event) => updateForm("customerEmail", event.target.value)} placeholder="name@example.com" />
              </label>
              <label>
                Phone / WhatsApp
                <input required value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="+971..." />
              </label>
              <label>
                Delivery address
                <input required value={form.deliveryAddress} onChange={(event) => updateForm("deliveryAddress", event.target.value)} placeholder="Area, street, building, city" />
              </label>
            </div>
          </section>

          <section className="checkout-form-card">
            <div className="checkout-card-heading">
              <span>2</span>
              <div>
                <h2>Delivery and gift details</h2>
                <p>Important for cakes, sweets, and gift boxes.</p>
              </div>
            </div>
            <div className="checkout-form-grid">
              <label>
                Delivery date
                <input type="date" value={form.deliveryDate} onChange={(event) => updateForm("deliveryDate", event.target.value)} />
              </label>
              <label>
                Delivery time
                <input type="time" value={form.deliveryTime} onChange={(event) => updateForm("deliveryTime", event.target.value)} />
              </label>
              <label className="checkout-field-wide">
                Gift message
                <textarea value={form.giftMessage} onChange={(event) => updateForm("giftMessage", event.target.value)} placeholder="Write a message for the card" rows="3" />
              </label>
              <label className="checkout-field-wide">
                Special instructions
                <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Cake writing, delivery notes, allergies, or timing requests" rows="3" />
              </label>
            </div>
          </section>

          <section className="checkout-form-card">
            <div className="checkout-card-heading">
              <span>3</span>
              <div>
                <h2>Payment method</h2>
                <p>Payment options are shown at checkout. Your order will be confirmed before preparation.</p>
              </div>
            </div>
            <div className="payment-method-grid" role="radiogroup" aria-label="Payment method">
              <button
                aria-checked={paymentMethod === "card"}
                aria-pressed={paymentMethod === "card"}
                className={paymentMethod === "card" ? "payment-method active" : "payment-method"}
                disabled
                role="radio"
                type="button"
              >
                <CreditCard size={20} aria-hidden="true" />
                <strong>Secure checkout</strong>
                <span>Payment options are shown at checkout.</span>
              </button>
              <button
                aria-checked={paymentMethod === "cod"}
                aria-pressed={paymentMethod === "cod"}
                className={paymentMethod === "cod" ? "payment-method active" : "payment-method"}
                onClick={() => setPaymentMethod("cod")}
                role="radio"
                type="button"
              >
                <WalletCards size={20} aria-hidden="true" />
                <strong>Cash on delivery</strong>
                <span>Pay when the order arrives.</span>
              </button>
            </div>
          </section>

          <div aria-atomic="true" aria-live="polite" role="status">
            {orderError ? (
              <p className="error-state checkout-error">
                {orderError}
                {orderError.includes("retry") ? " Use the button below to try again — your cart is still intact." : ""}
              </p>
            ) : null}
          </div>
        </form>

        <aside className="checkout-summary-card">
          <h2>Order summary</h2>
          <div className="cart-items">
            {cart.length ? cart.map((item) => (
              <div className="cart-item" key={getCartLineKey(item)}>
                <BottleArt product={item} compact />
                <div>
                  <strong>{item.name}</strong>
                  <span>{formatCurrency(item.price)} · Qty {item.quantity}</span>
                  <ItemFacts item={item} />
                  <ItemConfigurationSummary item={item} />
                  {(isCakeLikeItem(item) || isGiftLikeItem(item)) ? (
                    <div className="checkout-item-metadata-fields">
                      {isCakeLikeItem(item) ? (
                        <>
                          <label>
                            Cake writing / custom message
                            <input
                              value={item.metadata?.cakeWriting || ""}
                              onChange={(event) => updateMetadata(getCartLineKey(item), "cakeWriting", event.target.value)}
                              placeholder="Happy birthday, name, or short message"
                            />
                          </label>
                          <label>
                            Allergy note
                            <input
                              value={item.metadata?.allergyNote || ""}
                              onChange={(event) => updateMetadata(getCartLineKey(item), "allergyNote", event.target.value)}
                              placeholder="Optional allergy or dietary note"
                            />
                          </label>
                        </>
                      ) : null}
                      {isGiftLikeItem(item) ? (
                        <>
                          <label>
                            Gift card message
                            <input
                              value={item.metadata?.itemMessage || ""}
                              onChange={(event) => updateMetadata(getCartLineKey(item), "itemMessage", event.target.value)}
                              placeholder="Message for this gift box"
                            />
                          </label>
                          <label className="checkout-item-checkbox">
                            <input
                              checked={Boolean(item.metadata?.giftWrap)}
                              onChange={(event) => updateMetadata(getCartLineKey(item), "giftWrap", event.target.checked)}
                              type="checkbox"
                            />
                            Add gift wrap
                          </label>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <button aria-label={`Remove one ${item.name} from cart`} className="icon-button" onClick={() => updateCartQuantity(getCartLineKey(item), -1)} type="button">-</button>
              </div>
            )) : <p className="muted-label">Your cart is empty.</p>}
          </div>
          <div className="checkout-box">
            <div className="summary-line"><span>Items</span><strong>{formatCurrency(cartTotal)}</strong></div>
            <div className="summary-line"><span>Delivery</span><strong>{checkoutMode === "guest" ? "Choose a slot" : "Saved with your account"}</strong></div>
            <div className="summary-line strong"><span>Total</span><strong>{formatCurrency(cartTotal)}</strong></div>
            <button className="primary-action full-width" disabled={!cart.length || isPlacingOrder} form="checkout-form" type="submit">
              {paymentMethod === "card" ? <CreditCard size={18} /> : <WalletCards size={18} />}
              {isPlacingOrder ? "Placing order..." : paymentMethod === "card" ? "Authorize card order" : "Place COD order"}
            </button>
            <p className="checkout-method-note">
              {paymentMethod === "card"
                ? "Your order will be confirmed before preparation."
                : "The seller will prepare your order after confirmation."}
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
