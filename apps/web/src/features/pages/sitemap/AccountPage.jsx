import { useEffect, useState } from "react";
import { CheckCircle2, Heart, HelpCircle, MapPin, PackageCheck, Pencil, Plus, Settings, ShoppingBag, Star, Trash2, User } from "lucide-react";
import { authApi, ordersApi } from "@tuti/shared/api/client.js";
import { useWishlistStore } from "@tuti/shared/store/wishlistStore.js";
import { BottleArt } from "@tuti/shared/components/BottleArt.jsx";
import { StatusBadge } from "@tuti/shared/components/StatusBadge.jsx";
import { useAuthStore } from "@tuti/shared/store/authStore.js";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import {
  BuildGiftCartSummary,
  CustomerTimeline,
  ItemFacts,
  customerResolutionSummary,
  formatDeliverySummary,
  formatOrderDate,
  formatPaymentMethod,
  getOrderItemCount,
  isCustomizedGiftItem,
} from "./sitemapPageShared.jsx";
import "../account.css";

export function AccountPage({ getShop, onNavigate, products = [] }) {
  const { user, isAuthenticated, updateUser } = useAuthStore();
  const { ids: wishlistIds, toggle: toggleWishlist } = useWishlistStore();
  const [accountTab, setAccountTab] = useState("orders");
  const [ordersState, setOrdersState] = useState({ loading: false, error: "", orders: [] });
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [orderFeedback, setOrderFeedback] = useState({});
  const [disputeNotes, setDisputeNotes] = useState({});
  const [feedbackLoading, setFeedbackLoading] = useState({});
  const [deepLinkNotice, setDeepLinkNotice] = useState("");

  const [profileEdit, setProfileEdit] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", phone: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [addresses, setAddresses] = useState([]);
  const [addrEdit, setAddrEdit] = useState(null);
  const [addrForm, setAddrForm] = useState({ label: "Home", line1: "", line2: "", city: "", isDefault: false });
  const [addrSaving, setAddrSaving] = useState(false);
  const [addrError, setAddrError] = useState("");

  const defaultSettings = { emailNotifications: true, whatsappNotifications: false, marketingEmails: true };
  const [settingsForm, setSettingsForm] = useState(defaultSettings);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsOk, setSettingsOk] = useState(false);

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

  async function saveProfile(event) {
    event.preventDefault();
    setProfileSaving(true);
    setProfileError("");
    try {
      const updated = await authApi.updateMe({ name: profileForm.name, phone: profileForm.phone });
      updateUser({ name: updated.name, phone: updated.phone });
      setProfileEdit(false);
    } catch (err) {
      setProfileError(err.message || "Could not save profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  function openProfileEdit() {
    setProfileForm({ name: user?.name || "", phone: user?.phone || "" });
    setProfileEdit(true);
    setProfileError("");
  }

  async function saveAddress(event) {
    event.preventDefault();
    setAddrSaving(true);
    setAddrError("");
    try {
      let updated;
      if (addrEdit === "new") {
        updated = await authApi.addAddress(addrForm);
      } else {
        updated = await authApi.updateAddress(addrEdit, addrForm);
      }
      setAddresses(updated);
      setAddrEdit(null);
    } catch (err) {
      setAddrError(err.message || "Could not save address.");
    } finally {
      setAddrSaving(false);
    }
  }

  async function removeAddress(id) {
    try {
      const updated = await authApi.deleteAddress(id);
      setAddresses(updated);
    } catch { /* non-critical */ }
  }

  async function setDefaultAddress(id) {
    try {
      const updated = await authApi.updateAddress(id, { isDefault: true });
      setAddresses(updated);
    } catch { /* non-critical */ }
  }

  function openNewAddress() {
    setAddrForm({ label: "Home", line1: "", line2: "", city: "", isDefault: false });
    setAddrEdit("new");
    setAddrError("");
  }

  function openEditAddress(addr) {
    setAddrForm({ label: addr.label || "Home", line1: addr.line1 || "", line2: addr.line2 || "", city: addr.city || "", isDefault: addr.isDefault || false });
    setAddrEdit(addr.id);
    setAddrError("");
  }

  async function saveSettings(e) {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsOk(false);
    try {
      const updated = await authApi.updateSettings(settingsForm);
      updateUser({ settings: updated });
      setSettingsOk(true);
      setTimeout(() => setSettingsOk(false), 3000);
    } catch { /* non-critical */ } finally {
      setSettingsSaving(false);
    }
  }

  useEffect(() => {
    if (authenticated && user?.addresses) setAddresses(user.addresses);
  }, [authenticated, user?.addresses]);

  useEffect(() => {
    if (authenticated && user?.settings) setSettingsForm({ ...defaultSettings, ...user.settings });
  }, [authenticated, user?.settings]);

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
  const wishlistProducts = products.filter((product) => wishlistIds.has(product.id));

  const activeOrders = ordersState.orders.filter(
    (o) => !["Delivered", "Customer Accepted", "Cancelled", "Refunded"].includes(o.status)
  ).length;
  const deliveredOrders = ordersState.orders.filter(
    (o) => ["Delivered", "Customer Accepted"].includes(o.status)
  ).length;
  const customizedGifts = ordersState.orders.filter(
    (o) => (o.items || []).some((item) => isCustomizedGiftItem(item))
  ).length;

  return (
    <main className="tuti-account">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="tuti-account__hero">
        <div className="tuti-account__hero-main">
          <div>
            <span className="tuti-account__hero-kicker">My account</span>
            {authenticated ? (
              <>
                <h1 className="tuti-account__hero-title">Track your Tuti orders</h1>
                <p className="tuti-account__hero-sub">Follow boutique preparation, delivery, and gift details in one place.</p>
              </>
            ) : (
              <>
                <h1 className="tuti-account__hero-title">Welcome to Tuti</h1>
                <p className="tuti-account__hero-sub">Sign in to track orders, manage addresses, and save wishlist items.</p>
              </>
            )}
          </div>
          <div className="tuti-account__hero-actions">
            <button className="secondary-action compact" onClick={() => onNavigate("/cart")} type="button">
              <ShoppingBag size={16} aria-hidden="true" /> View cart
            </button>
          </div>
        </div>

        {/* Stats strip — only when authenticated and orders exist */}
        {authenticated && !ordersState.loading && ordersState.orders.length > 0 ? (
          <div className="tuti-account__hero-stats">
            <div className="tuti-account__hero-stats-inner">
              <div className="tuti-account__hero-stat">
                <span className="tuti-account__hero-stat-value">{activeOrders}</span>
                <span className="tuti-account__hero-stat-label">Active</span>
              </div>
              <div className="tuti-account__hero-stat">
                <span className="tuti-account__hero-stat-value">{deliveredOrders}</span>
                <span className="tuti-account__hero-stat-label">Delivered</span>
              </div>
              {customizedGifts > 0 ? (
                <div className="tuti-account__hero-stat">
                  <span className="tuti-account__hero-stat-value">{customizedGifts}</span>
                  <span className="tuti-account__hero-stat-label">Gift builds</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="tuti-account__body">
        {!authenticated ? (
          /* Premium guest state */
          <div className="tuti-account__guest">
            <div className="tuti-account__guest-prompt">
              <div>
                <h2>Sign in to your account</h2>
                <p>Track orders, manage delivery addresses, save wishlist items, and access your gift builds.</p>
              </div>
              <div className="tuti-account__guest-actions">
                <button
                  className="primary-action compact"
                  onClick={() => window.dispatchEvent(new CustomEvent("tuti:open-auth", { detail: { mode: "login" } }))}
                  type="button"
                >
                  Sign in
                </button>
                <button className="ghost-action compact" onClick={() => onNavigate("/shop")} type="button">
                  Browse shop
                </button>
              </div>
            </div>
            <div className="tuti-account__guest-cards">
              {[
                { Icon: PackageCheck, label: "Orders",    desc: "Track deliveries and review your order history." },
                { Icon: Heart,        label: "Wishlist",  desc: "Save perfumes and gift ideas for later." },
                { Icon: MapPin,       label: "Addresses", desc: "Saved delivery addresses for faster checkout." },
                { Icon: Star,         label: "Rewards",   desc: "Loyalty perks and gift credits — coming soon." },
              ].map(({ Icon, label, desc }) => (
                <div className="tuti-account__guest-card" key={label}>
                  <div className="tuti-account__guest-card-icon"><Icon size={15} aria-hidden="true" /></div>
                  <div>
                    <strong>{label}</strong>
                    <span>{desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Tab nav */}
            <nav className="account-tabs" aria-label="Account sections">
              {[
                { key: "orders",    label: "Orders",    Icon: PackageCheck },
                { key: "profile",   label: "Profile",   Icon: User },
                { key: "addresses", label: "Addresses", Icon: MapPin },
                { key: "wishlist",  label: "Wishlist",  Icon: Heart },
                { key: "settings",  label: "Settings",  Icon: Settings },
              ].map(({ key, label, Icon }) => (
                <button
                  aria-current={accountTab === key ? "page" : undefined}
                  className={accountTab === key ? "account-tab active" : "account-tab"}
                  key={key}
                  onClick={() => setAccountTab(key)}
                  type="button"
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </nav>

            {/* ── Profile ─────────────────────────────────────────────── */}
            {accountTab === "profile" ? (
              <section className="account-form-section">
                <div className="checkout-form-card">
                  <div className="checkout-card-heading">
                    <span className="sitemap-card-icon"><User size={19} aria-hidden="true" /></span>
                    <div>
                      <h2>Profile</h2>
                      <p>Your name and contact details.</p>
                    </div>
                    {!profileEdit ? (
                      <button className="ghost-action compact" onClick={openProfileEdit} type="button">
                        <Pencil size={15} aria-hidden="true" /> Edit
                      </button>
                    ) : null}
                  </div>
                  {!profileEdit ? (
                    <div className="account-profile-display">
                      <span><strong>Name</strong>{user?.name || "—"}</span>
                      <span><strong>Email</strong>{user?.email || "—"}</span>
                      <span><strong>Phone</strong>{user?.phone || "Not set"}</span>
                      <span><strong>Role</strong>{user?.role || "customer"}</span>
                    </div>
                  ) : (
                    <form className="checkout-form-grid" onSubmit={saveProfile}>
                      <label>
                        Full name
                        <input required value={profileForm.name} onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))} />
                      </label>
                      <label>
                        Phone / WhatsApp
                        <input value={profileForm.phone} onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+971..." />
                      </label>
                      {profileError ? <p className="error-state checkout-error checkout-field-wide">{profileError}</p> : null}
                      <div className="account-form-actions">
                        <button className="primary-action compact" disabled={profileSaving} type="submit">
                          {profileSaving ? "Saving…" : "Save changes"}
                        </button>
                        <button className="ghost-action compact" onClick={() => setProfileEdit(false)} type="button">Cancel</button>
                      </div>
                    </form>
                  )}
                </div>
              </section>
            ) : null}

            {/* ── Addresses ───────────────────────────────────────────── */}
            {accountTab === "addresses" ? (
              <section className="account-form-section">
                <div className="checkout-form-card">
                  <div className="checkout-card-heading">
                    <span className="sitemap-card-icon"><MapPin size={19} aria-hidden="true" /></span>
                    <div>
                      <h2>Saved addresses</h2>
                      <p>Delivery addresses for faster checkout.</p>
                    </div>
                    {addrEdit === null ? (
                      <button className="ghost-action compact" onClick={openNewAddress} type="button">
                        <Plus size={15} aria-hidden="true" /> Add
                      </button>
                    ) : null}
                  </div>

                  {addrEdit ? (
                    <form className="checkout-form-grid" onSubmit={saveAddress}>
                      <label>
                        Label (e.g. Home, Work)
                        <input value={addrForm.label} onChange={(e) => setAddrForm((f) => ({ ...f, label: e.target.value }))} />
                      </label>
                      <label>
                        Address line 1
                        <input required value={addrForm.line1} onChange={(e) => setAddrForm((f) => ({ ...f, line1: e.target.value }))} placeholder="Building, street" />
                      </label>
                      <label>
                        Address line 2
                        <input value={addrForm.line2} onChange={(e) => setAddrForm((f) => ({ ...f, line2: e.target.value }))} placeholder="Apartment, area" />
                      </label>
                      <label>
                        City
                        <input value={addrForm.city} onChange={(e) => setAddrForm((f) => ({ ...f, city: e.target.value }))} placeholder="Dubai" />
                      </label>
                      <label className="checkout-item-checkbox checkout-field-wide">
                        <input
                          checked={addrForm.isDefault}
                          onChange={(e) => setAddrForm((f) => ({ ...f, isDefault: e.target.checked }))}
                          type="checkbox"
                        />
                        Set as default address
                      </label>
                      {addrError ? <p className="error-state checkout-error checkout-field-wide">{addrError}</p> : null}
                      <div className="account-form-actions">
                        <button className="primary-action compact" disabled={addrSaving} type="submit">
                          {addrSaving ? "Saving…" : addrEdit === "new" ? "Add address" : "Save address"}
                        </button>
                        <button className="ghost-action compact" onClick={() => setAddrEdit(null)} type="button">Cancel</button>
                      </div>
                    </form>
                  ) : addresses.length ? (
                    <div className="account-address-list">
                      {addresses.map((addr) => (
                        <div className="account-address-row" key={addr.id}>
                          <div>
                            <strong>{addr.label}{addr.isDefault ? <span className="account-address-default-badge">Default</span> : null}</strong>
                            <span>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}{addr.city ? `, ${addr.city}` : ""}</span>
                          </div>
                          <div className="account-address-actions">
                            {!addr.isDefault ? (
                              <button className="ghost-action compact" onClick={() => setDefaultAddress(addr.id)} title="Set as default" type="button">
                                <Star size={14} aria-hidden="true" /> Default
                              </button>
                            ) : null}
                            <button className="ghost-action compact" onClick={() => openEditAddress(addr)} type="button">
                              <Pencil size={14} aria-hidden="true" /> Edit
                            </button>
                            <button className="ghost-action compact" onClick={() => removeAddress(addr.id)} type="button">
                              <Trash2 size={14} aria-hidden="true" /> Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="account-empty-state">
                      <MapPin size={22} aria-hidden="true" />
                      <h3>No addresses saved</h3>
                      <p>Add a delivery address for faster checkout.</p>
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {/* ── Wishlist ─────────────────────────────────────────────── */}
            {accountTab === "wishlist" ? (
              <section className="account-form-section">
                <div className="checkout-form-card">
                  <div className="checkout-card-heading">
                    <span className="sitemap-card-icon"><Heart size={19} aria-hidden="true" /></span>
                    <div>
                      <h2>Saved items</h2>
                      <p>Products you've saved for later.</p>
                    </div>
                  </div>
                  {wishlistProducts.length > 0 ? (
                    <div className="account-wishlist-grid">
                      {wishlistProducts.map((product) => {
                        const shop = getShop?.(product.shopId);
                        return (
                          <div className="account-wishlist-item" key={product.id}>
                            <button
                              aria-label={`View ${product.name}`}
                              className="account-wishlist-media"
                              onClick={() => onNavigate?.(`/products/${product.id}`)}
                              type="button"
                            >
                              {product.imagePath ? (
                                <img alt={product.name} loading="lazy" src={product.imagePath} />
                              ) : (
                                <BottleArt compact product={product} />
                              )}
                            </button>
                            <div className="account-wishlist-copy">
                              <strong>{product.name}</strong>
                              <span className="muted-label">{shop?.name || "Marketplace seller"}</span>
                              <strong className="account-wishlist-price">{formatCurrency(product.price)}</strong>
                            </div>
                            <div className="account-address-actions">
                              <button className="ghost-action compact" onClick={() => onNavigate?.(`/products/${product.id}`)} type="button">
                                View
                              </button>
                              <button
                                aria-label={`Remove ${product.name} from wishlist`}
                                className="icon-button danger"
                                onClick={() => toggleWishlist(product.id, product.name)}
                                type="button"
                              >
                                <Trash2 size={15} aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="account-empty-state">
                      <Heart size={22} aria-hidden="true" />
                      <h3>No saved items</h3>
                      <p>Tap the heart on any product to save it here.</p>
                      <button className="primary-action compact" onClick={() => onNavigate?.("/shop")} type="button">
                        Browse products
                      </button>
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {/* ── Settings ─────────────────────────────────────────────── */}
            {accountTab === "settings" ? (
              <section className="account-form-section">
                <div className="checkout-form-card">
                  <div className="checkout-card-heading">
                    <span className="sitemap-card-icon"><Settings size={19} aria-hidden="true" /></span>
                    <div>
                      <h2>Notification settings</h2>
                      <p>Choose how you hear from Tuti.</p>
                    </div>
                  </div>
                  <form className="account-settings-list" onSubmit={saveSettings}>
                    {[
                      { key: "emailNotifications",    label: "Order and delivery updates by email",   desc: "Confirmations, status changes, and delivery notifications." },
                      { key: "whatsappNotifications", label: "Order updates via WhatsApp",             desc: "Real-time messages when your order status changes." },
                      { key: "marketingEmails",       label: "Promotions and new arrivals",            desc: "Offers, seasonal collections, and gift ideas." },
                    ].map(({ key, label, desc }) => (
                      <label className="account-settings-row" key={key}>
                        <div>
                          <strong>{label}</strong>
                          <span>{desc}</span>
                        </div>
                        <input
                          checked={settingsForm[key] ?? true}
                          onChange={(e) => setSettingsForm((f) => ({ ...f, [key]: e.target.checked }))}
                          type="checkbox"
                          className="account-settings-toggle"
                        />
                      </label>
                    ))}
                    <div className="account-settings-actions">
                      <button className="primary-action compact" disabled={settingsSaving} type="submit">
                        {settingsSaving ? "Saving…" : "Save preferences"}
                      </button>
                      {settingsOk ? <span className="account-settings-saved">Saved ✓</span> : null}
                    </div>
                  </form>
                </div>
              </section>
            ) : null}

            {/* ── Orders ───────────────────────────────────────────────── */}
            {accountTab === "orders" ? (
              <section className="account-orders-layout">

                {/* Left: order list */}
                <div className="account-orders-panel">
                  <div className="account-section-heading">
                    <span className="sitemap-card-icon"><PackageCheck size={19} aria-hidden="true" /></span>
                    <div>
                      <h2>Your orders</h2>
                      <p>Tap an order to see preparation and delivery updates.</p>
                    </div>
                  </div>

                  {ordersState.loading ? <p className="muted-label">Loading your orders…</p> : null}
                  {ordersState.error ? <p className="error-state checkout-error">Could not load your orders. Please try again in a moment.</p> : null}
                  {deepLinkNotice ? <p className="checkout-error">We could not find that order in your history.</p> : null}
                  {!ordersState.loading && !ordersState.error && !ordersState.orders.length ? (
                    <div className="account-empty-state">
                      <ShoppingBag size={24} aria-hidden="true" />
                      <h3>No orders yet</h3>
                      <p>Your confirmed Tuti orders will appear here after checkout.</p>
                      <button className="primary-action compact" onClick={() => onNavigate("/shop")} type="button">
                        Shop now
                      </button>
                    </div>
                  ) : null}

                  <div className="account-order-list">
                    {ordersState.orders.map((order) => {
                      const preview = order.items?.[0]?.productName || `${getOrderItemCount(order)} item${getOrderItemCount(order) === 1 ? "" : "s"}`;
                      return (
                        <button
                          key={order.orderId}
                          className={`tuti-account__order-card${order.orderId === selectedOrder?.orderId ? " tuti-account__order-card--active" : ""}`}
                          onClick={() => setSelectedOrderId(order.orderId)}
                          type="button"
                        >
                          <div className="tuti-account__order-card-top">
                            <span className="tuti-account__order-card-id">{order.orderId}</span>
                            <StatusBadge status={order.status} />
                          </div>
                          <span className="tuti-account__order-card-preview">{preview}</span>
                          <div className="tuti-account__order-card-bottom">
                            <span className="tuti-account__order-card-date">{formatOrderDate(order.createdAt)}</span>
                            <strong className="tuti-account__order-card-total">{formatCurrency(order.subtotal)}</strong>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right: order detail */}
                {selectedOrder ? (() => {
                  const hasGiftBuild = (selectedOrder.items || []).some((item) => isCustomizedGiftItem(item));
                  return (
                    <aside className="account-order-detail">
                      {/* Header */}
                      <div className="tuti-account__detail-header">
                        <div>
                          <span className="tuti-account__detail-eyebrow">Order</span>
                          <strong className="tuti-account__detail-id">{selectedOrder.orderId}</strong>
                        </div>
                        <div className="tuti-account__detail-header-right">
                          <StatusBadge status={selectedOrder.status} />
                          <strong className="tuti-account__detail-total">{formatCurrency(selectedOrder.subtotal)}</strong>
                        </div>
                      </div>

                      {/* Meta: delivery + payment */}
                      <div className="tuti-account__detail-meta">
                        <div className="tuti-account__detail-meta-item">
                          <span className="tuti-account__detail-meta-label">Delivery</span>
                          <span className="tuti-account__detail-meta-value">{formatDeliverySummary(selectedOrder)}</span>
                        </div>
                        <div className="tuti-account__detail-meta-item">
                          <span className="tuti-account__detail-meta-label">Payment</span>
                          <span className="tuti-account__detail-meta-value">{formatPaymentMethod(selectedOrder.paymentMethod)}</span>
                        </div>
                        {selectedOrder.deliveryAddress ? (
                          <div className="tuti-account__detail-meta-item" style={{ gridColumn: "1 / -1" }}>
                            <span className="tuti-account__detail-meta-label">Address</span>
                            <span className="tuti-account__detail-meta-value">{selectedOrder.deliveryAddress}</span>
                          </div>
                        ) : null}
                      </div>

                      {/* Customer timeline */}
                      <CustomerTimeline order={selectedOrder} />

                      {/* Items */}
                      <div className="tuti-account__detail-items">
                        {(selectedOrder.items || []).map((item, index) => {
                          const isGiftBuild = isCustomizedGiftItem(item);
                          return (
                            <div
                              key={`${selectedOrder.orderId}-${item.productId}-${index}`}
                              className="tuti-account__detail-item"
                            >
                              <div className="tuti-account__detail-item-info">
                                <div className="tuti-account__detail-item-name">{item.productName}</div>
                                <ItemFacts item={item} />
                                {isGiftBuild ? (
                                  <>
                                    <span className="tuti-account__gift-badge">✦ Customized gift</span>
                                    <BuildGiftCartSummary item={item} />
                                  </>
                                ) : null}
                              </div>
                              <div className="tuti-account__detail-item-right">
                                <span className="tuti-account__detail-item-qty">Qty {item.quantity}</span>
                                <span className="tuti-account__detail-item-price">{formatCurrency(item.price * item.quantity)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Note — labelled correctly based on order type */}
                      {(selectedOrder.giftMessage || selectedOrder.notes) ? (
                        <div className="tuti-account__detail-note">
                          {selectedOrder.giftMessage ? (
                            <p><strong>{hasGiftBuild ? "Gift message" : "Order note"}:</strong> {selectedOrder.giftMessage}</p>
                          ) : null}
                          {selectedOrder.notes ? <p><strong>Order note:</strong> {selectedOrder.notes}</p> : null}
                        </div>
                      ) : null}

                      {/* Resolution (customer-facing summary only) */}
                      {selectedOrder.resolutionDecision ? (
                        <div className="tuti-account__detail-note">
                          {(() => {
                            const safeDecision = customerResolutionSummary(selectedOrder.resolutionDecision);
                            return safeDecision ? <p>{safeDecision.message}</p> : null;
                          })()}
                        </div>
                      ) : null}

                      {/* Total */}
                      <div className="tuti-account__detail-totals">
                        <span className="tuti-account__detail-totals-label">Order total</span>
                        <span className="tuti-account__detail-totals-value">{formatCurrency(selectedOrder.subtotal)}</span>
                      </div>

                      {/* Delivery feedback */}
                      {selectedOrder.status === "Customer Accepted" ? (
                        <div className="tuti-account__detail-feedback">
                          <p className="account-order-note-row">
                            <CheckCircle2 size={14} aria-hidden="true" />
                            <strong>Delivery confirmed.</strong>&nbsp;This order is closed from your side.
                          </p>
                        </div>
                      ) : null}

                      {selectedOrder.status === "Delivered" && (
                        <div className="tuti-account__detail-feedback">
                          {orderFeedback[selectedOrder.orderId] === "accepted" ? (
                            <p className="account-order-note-row">
                              <CheckCircle2 size={14} aria-hidden="true" />
                              <strong>Delivery confirmed.</strong>&nbsp;Thank you. Your feedback has been recorded.
                            </p>
                          ) : orderFeedback[selectedOrder.orderId] === "reported" ? (
                            <p className="account-order-note-row">
                              <HelpCircle size={14} aria-hidden="true" />
                              <strong>Dispute reported.</strong>&nbsp;Our support team will follow up shortly.
                            </p>
                          ) : orderFeedback[selectedOrder.orderId]?.startsWith("error:") ? (
                            <>
                              <p className="account-order-feedback-error">
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
                                className="account-dispute-textarea"
                              />
                              <div className="account-order-feedback-actions">
                                <button
                                  className="secondary-action compact"
                                  type="button"
                                  disabled={!disputeNotes[selectedOrder.orderId]?.trim() || feedbackLoading[selectedOrder.orderId]}
                                  onClick={() => handleCustomerAction(selectedOrder.orderId, "dispute", disputeNotes[selectedOrder.orderId])}
                                >
                                  <HelpCircle size={15} aria-hidden="true" />
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
                              <div className="account-order-feedback-actions">
                                <button
                                  className="secondary-action compact"
                                  type="button"
                                  disabled={feedbackLoading[selectedOrder.orderId]}
                                  onClick={() => handleCustomerAction(selectedOrder.orderId, "accept", null)}
                                >
                                  <CheckCircle2 size={15} aria-hidden="true" />
                                  {feedbackLoading[selectedOrder.orderId] ? "Confirming…" : "I received my order"}
                                </button>
                                <button
                                  className="ghost-action compact"
                                  type="button"
                                  onClick={() => setOrderFeedback((prev) => ({ ...prev, [selectedOrder.orderId]: "reporting" }))}
                                >
                                  <HelpCircle size={15} aria-hidden="true" />
                                  Report issue
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Support CTA */}
                      <div className="tuti-account__support">
                        <div className="tuti-account__support-text">
                          <strong>Need help?</strong>
                          <span>Our support team can assist with any order question.</span>
                        </div>
                        <button className="ghost-action compact" onClick={() => onNavigate("/support")} type="button">
                          <HelpCircle size={15} aria-hidden="true" /> Get help
                        </button>
                      </div>

                      {/* View full order page */}
                      <button
                        className="tuti-account__detail-link"
                        onClick={() => onNavigate(`/orders/${selectedOrder.orderId}`)}
                        type="button"
                      >
                        View full order page →
                      </button>
                    </aside>
                  );
                })() : (
                  <aside className="account-order-detail">
                    <div className="account-empty-state">
                      <PackageCheck size={24} aria-hidden="true" />
                      <h3>No order selected</h3>
                      <p>Select an order from the list to see updates.</p>
                    </div>
                  </aside>
                )}

              </section>
            ) : null}

          </>
        )}
      </div>
    </main>
  );
}
