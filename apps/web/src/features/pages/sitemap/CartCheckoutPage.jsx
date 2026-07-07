import { useRef, useState } from "react";
import { CreditCard, Gift, ShieldCheck, ShoppingBag, User, WalletCards } from "lucide-react";
import { ordersApi } from "@tuti/shared/api/client.js";
import { useAuthStore } from "@tuti/shared/store/authStore.js";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import { TutiCartItem } from "../../../ui/customer/commerce/TutiCartItem.jsx";
import { TutiTrustStrip } from "../../../ui/customer/commerce/TutiTrustStrip.jsx";
import "../cart-checkout.css";
import {
  ItemConfigurationSummary,
  ItemFacts,
  compactOrderItem,
  getCartLineKey,
  isCakeLikeItem,
  isGiftLikeItem,
} from "./sitemapPageShared.jsx";

const CART_TRUST_ITEMS = [
  { id: "cod", title: "Cash on delivery", description: "No online payment needed", icon: <WalletCards size={17} /> },
  { id: "verified", title: "Verified boutiques", description: "Screened UAE sellers", icon: <ShieldCheck size={17} /> },
  { id: "gift", title: "Gift-ready delivery", description: "Packaging included", icon: <Gift size={17} /> },
];

function buildBoutiqueNote(cart) {
  const shops = [...new Set(cart.map((item) => item.shopName || item.sellerName).filter(Boolean))];
  if (shops.length === 1) return `Prepared by ${shops[0]}`;
  if (shops.length > 1) return `Prepared by ${shops.length} boutiques · Each boutique prepares its items separately.`;
  return null;
}

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

  const isAccountCheckout = isAuthenticated() && checkoutMode === "account";

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function requestLogin() {
    window.dispatchEvent(new CustomEvent("tuti:open-auth"));
  }

  function updateMetadata(lineKey, field, value) {
    updateItemMetadata?.(lineKey, { [field]: value });
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

  // ── Empty cart ──────────────────────────────────────────────────────────────
  if (!cart.length) {
    return (
      <main className="page-shell tuti-cart">
        <div className="tuti-cart__empty">
          <div className="tuti-cart__empty-inner">
            <span className="tuti-cart__empty-icon" aria-hidden="true">
              <ShoppingBag size={36} />
            </span>
            <h1>Your cart is empty</h1>
            <p>Discover perfumes, cakes, desserts, and gift boxes from our verified boutiques — or build a personal gift in a few steps.</p>
            <div className="tuti-cart__empty-actions">
              <button type="button" className="tuti-cart__primary-btn" onClick={() => onNavigate?.("/shop")}>
                <ShoppingBag size={16} aria-hidden="true" />
                Browse the shop
              </button>
              <button type="button" className="tuti-cart__ghost-btn" onClick={() => onNavigate?.("/build-a-box")}>
                <Gift size={16} aria-hidden="true" />
                Build a gift
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── Cart with items ─────────────────────────────────────────────────────────
  return (
    <main className="page-shell tuti-cart">

      {/* Compact checkout header */}
      <div className="tuti-cart__hero">
        <div className="tuti-cart__hero-inner">
          <div className="tuti-cart__hero-text">
            <span className="tuti-cart__eyebrow">Your Tuti cart</span>
            <h1>Review &amp; place your order</h1>
            <p>Cash on delivery · Verified boutiques · Gift-ready packaging</p>
          </div>
          <TutiTrustStrip items={CART_TRUST_ITEMS} variant="inline" className="tuti-cart__hero-trust" />
        </div>
      </div>

      {/* Main two-column layout */}
      <div className="tuti-cart__shell">

        {/* ── Left: items + checkout form ── */}
        <div className="tuti-cart__panel">

          {/* Cart items */}
          <section className="tuti-cart__items" aria-label="Cart items">
            <div className="tuti-cart__section-heading">
              <h2>Cart items</h2>
              <span>{cart.length} item{cart.length !== 1 ? "s" : ""}</span>
            </div>
            {cart.map((item) => (
              <div className="tuti-cart__item" key={getCartLineKey(item)}>
                <TutiCartItem
                  item={item}
                  onQuantityChange={(_itemId, nextQty, cartItem) => updateCartQuantity(getCartLineKey(cartItem), nextQty)}
                  onRemove={(_itemId, cartItem) => updateCartQuantity(getCartLineKey(cartItem), 0)}
                />
                {item.shopName || item.sellerName ? (
                  <p className="tuti-cart__item-shop">From {item.shopName || item.sellerName}</p>
                ) : null}
                {(isCakeLikeItem(item) || isGiftLikeItem(item)) ? (
                  <div className="tuti-cart__item-meta">
                    {isCakeLikeItem(item) ? (
                      <>
                        <label>
                          Cake writing
                          <input
                            value={item.metadata?.cakeWriting || ""}
                            onChange={(e) => updateMetadata(getCartLineKey(item), "cakeWriting", e.target.value)}
                            placeholder="Happy birthday, name, or short message"
                          />
                        </label>
                        <label>
                          Allergy note
                          <input
                            value={item.metadata?.allergyNote || ""}
                            onChange={(e) => updateMetadata(getCartLineKey(item), "allergyNote", e.target.value)}
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
                            onChange={(e) => updateMetadata(getCartLineKey(item), "itemMessage", e.target.value)}
                            placeholder="Message for this gift box"
                          />
                        </label>
                        <label className="tuti-cart__item-meta-check">
                          <input
                            type="checkbox"
                            checked={Boolean(item.metadata?.giftWrap)}
                            onChange={(e) => updateMetadata(getCartLineKey(item), "giftWrap", e.target.checked)}
                          />
                          Add gift wrap
                        </label>
                      </>
                    ) : null}
                    <ItemFacts item={item} />
                    <ItemConfigurationSummary item={item} />
                  </div>
                ) : null}
              </div>
            ))}
          </section>

          {/* Checkout form */}
          <form className="tuti-checkout" id="checkout-form" onSubmit={placeOrder} noValidate={false}>

            {/* Step 1 — Customer mode */}
            <section className="tuti-checkout__panel" aria-label="Checkout identity">
              <div className="tuti-checkout__panel-heading">
                <span className="tuti-checkout__step" aria-hidden="true">1</span>
                <div>
                  <h2>How would you like to checkout?</h2>
                </div>
              </div>
              <div className="tuti-checkout__steps" role="radiogroup" aria-label="Checkout mode">
                <button
                  type="button"
                  role="radio"
                  aria-checked={isAccountCheckout}
                  aria-pressed={isAccountCheckout}
                  className={`tuti-checkout__mode-card${isAccountCheckout ? " is-active" : ""}${!isAuthenticated() ? " is-locked" : ""}`}
                  disabled={!isAuthenticated()}
                  onClick={() => setCheckoutMode("account")}
                >
                  <User size={19} aria-hidden="true" />
                  <div>
                    <strong>Client account</strong>
                    <span>
                      {isAuthenticated()
                        ? `Ordering as ${user?.name || user?.email}`
                        : "Sign in to save your orders and addresses"}
                    </span>
                  </div>
                  {!isAuthenticated() ? <span className="tuti-checkout__mode-lock">Sign in first</span> : null}
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!isAccountCheckout}
                  aria-pressed={!isAccountCheckout}
                  className={`tuti-checkout__mode-card${!isAccountCheckout ? " is-active" : ""}${isAuthenticated() ? " is-locked" : ""}`}
                  disabled={isAuthenticated()}
                  onClick={() => setCheckoutMode("guest")}
                >
                  <ShoppingBag size={19} aria-hidden="true" />
                  <div>
                    <strong>Guest checkout</strong>
                    <span>
                      {isAuthenticated()
                        ? "Unavailable while signed in."
                        : "No account needed. Confirmation sent by email."}
                    </span>
                  </div>
                </button>
              </div>
              {isAuthenticated() ? (
                <p className="tuti-checkout__auth-note">Your order will be saved to your account automatically.</p>
              ) : (
                <button type="button" className="tuti-checkout__login-link" onClick={requestLogin}>
                  <User size={14} aria-hidden="true" />
                  Sign in instead
                </button>
              )}
            </section>

            {/* Step 2 — Customer details */}
            <section className="tuti-checkout__panel">
              <div className="tuti-checkout__panel-heading">
                <span className="tuti-checkout__step" aria-hidden="true">2</span>
                <div>
                  <h2>Customer details</h2>
                </div>
              </div>
              <div className="tuti-checkout__form-grid">
                <label>
                  Full name
                  <input
                    required
                    value={form.customerName}
                    onChange={(e) => updateForm("customerName", e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </label>
                <label>
                  Email
                  <input
                    required
                    type="email"
                    value={form.customerEmail}
                    onChange={(e) => updateForm("customerEmail", e.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                  />
                </label>
                <label>
                  Phone / WhatsApp
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={(e) => updateForm("phone", e.target.value)}
                    placeholder="+971..."
                    autoComplete="tel"
                  />
                </label>
                <label className="tuti-checkout__field-wide">
                  Delivery address
                  <input
                    required
                    value={form.deliveryAddress}
                    onChange={(e) => updateForm("deliveryAddress", e.target.value)}
                    placeholder="Area, street, building, city"
                    autoComplete="street-address"
                  />
                </label>
              </div>
            </section>

            {/* Step 3 — Delivery & gift details */}
            <section className="tuti-checkout__panel">
              <div className="tuti-checkout__panel-heading">
                <span className="tuti-checkout__step" aria-hidden="true">3</span>
                <div>
                  <h2>Delivery &amp; gift details</h2>
                  <p>Required for cakes, desserts, and gift boxes.</p>
                </div>
              </div>
              <div className="tuti-checkout__form-grid">
                <label>
                  Delivery date
                  <input
                    type="date"
                    value={form.deliveryDate}
                    onChange={(e) => updateForm("deliveryDate", e.target.value)}
                  />
                </label>
                <label>
                  Preferred time
                  <input
                    type="time"
                    value={form.deliveryTime}
                    onChange={(e) => updateForm("deliveryTime", e.target.value)}
                  />
                </label>
                <label className="tuti-checkout__field-wide">
                  Gift message
                  <textarea
                    value={form.giftMessage}
                    onChange={(e) => updateForm("giftMessage", e.target.value)}
                    placeholder="Write a message for the gift card"
                    rows="3"
                  />
                </label>
                <label className="tuti-checkout__field-wide">
                  Special instructions
                  <textarea
                    value={form.notes}
                    onChange={(e) => updateForm("notes", e.target.value)}
                    placeholder="Cake writing, delivery notes, allergies, or timing requests"
                    rows="3"
                  />
                </label>
              </div>
            </section>

            {/* Step 4 — Payment */}
            <section className="tuti-checkout__panel">
              <div className="tuti-checkout__panel-heading">
                <span className="tuti-checkout__step" aria-hidden="true">4</span>
                <div>
                  <h2>Payment method</h2>
                </div>
              </div>
              <div className="tuti-checkout__payment" role="radiogroup" aria-label="Payment method">
                <button
                  type="button"
                  role="radio"
                  aria-checked={paymentMethod === "cod"}
                  aria-pressed={paymentMethod === "cod"}
                  className={`tuti-checkout__pay-card${paymentMethod === "cod" ? " is-active" : ""}`}
                  onClick={() => setPaymentMethod("cod")}
                >
                  <WalletCards size={22} aria-hidden="true" />
                  <div>
                    <strong>Cash on delivery</strong>
                    <span>Pay cash on delivery. Online card payments will be added later.</span>
                  </div>
                  <span className="tuti-checkout__pay-badge">Active</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={false}
                  aria-pressed={false}
                  aria-disabled="true"
                  className="tuti-checkout__pay-card tuti-checkout__pay-card--disabled"
                  disabled
                >
                  <CreditCard size={22} aria-hidden="true" />
                  <div>
                    <strong>Card payment</strong>
                    <span>Coming soon — a verified payment gateway is being integrated.</span>
                  </div>
                  <span className="tuti-checkout__pay-badge tuti-checkout__pay-badge--soon">Coming soon</span>
                </button>
              </div>
            </section>

            {/* Error */}
            <div aria-atomic="true" aria-live="polite" role="status">
              {orderError ? (
                <p className="tuti-checkout__error">
                  {orderError}
                  {orderError.includes("retry") ? " Use the button below to try again — your cart is still intact." : ""}
                </p>
              ) : null}
            </div>

          </form>
        </div>

        {/* ── Right: Order summary (sticky on desktop, first on mobile via CSS order) ── */}
        <aside className="tuti-cart__summary" aria-label="Order summary">
          <div className="tuti-cart__summary-inner">
            <h2>Order summary</h2>

            {/* Item list */}
            <div className="tuti-cart__summary-items" aria-label="Items in your order">
              {cart.map((item) => (
                <div className="tuti-cart__summary-item" key={getCartLineKey(item)}>
                  <span className="tuti-cart__summary-item-name">{item.name}</span>
                  <span className="tuti-cart__summary-item-qty" aria-label={`Quantity ${item.quantity}`}>×{item.quantity}</span>
                  <span className="tuti-cart__summary-item-price">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            {/* Boutique prep note */}
            {buildBoutiqueNote(cart) ? (
              <p className="tuti-cart__boutique-note">{buildBoutiqueNote(cart)}</p>
            ) : null}

            {/* Totals */}
            <div className="tuti-cart__summary-lines">
              <div className="tuti-cart__summary-line">
                <span>Subtotal</span>
                <strong>{formatCurrency(cartTotal)}</strong>
              </div>
              <div className="tuti-cart__summary-line">
                <span>Delivery</span>
                <strong>Arranged at checkout</strong>
              </div>
              <div className="tuti-cart__summary-line tuti-cart__summary-line--total">
                <span>Total</span>
                <strong>{formatCurrency(cartTotal)}</strong>
              </div>
            </div>

            {/* Place order CTA */}
            <button
              className="tuti-cart__place-order"
              disabled={!cart.length || isPlacingOrder}
              form="checkout-form"
              type="submit"
            >
              {isPlacingOrder ? (
                "Placing order…"
              ) : (
                <>
                  <WalletCards size={17} aria-hidden="true" />
                  Place COD order
                </>
              )}
            </button>

            <p className="tuti-cart__summary-cod-note">
              No online payment is taken. Your order is confirmed after the seller accepts it, and you pay cash on delivery.
            </p>
            <p className="tuti-cart__summary-support">
              Questions? <a href="/info/support">Contact support</a>
            </p>
          </div>
        </aside>

      </div>
    </main>
  );
}
