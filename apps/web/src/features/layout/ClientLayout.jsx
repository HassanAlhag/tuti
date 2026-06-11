import { useEffect, useRef, useState } from "react";
import {
  ChevronDown, Headphones, LogOut, Menu, Package,
  Search, Settings, ShoppingBag,
  Sparkles, X,
} from "lucide-react";
import { brand }            from "@tuti/shared/brand.js";
import { useAuthStore }     from "@tuti/shared/store/authStore.js";
import { NotificationBell } from "../notifications/NotificationBell.jsx";
import { AuthModal }         from "../auth/AuthModal.jsx";
import { ClientFooter }      from "./ClientFooter.jsx";
import { useCartStore }      from "../../store/cartStore.js";
import { getPortalUrl }      from "./portalUrls.js";

const SEARCH_CATEGORIES = [
  { value: "all",      label: "All" },
  { value: "perfume",  label: "Perfumes" },
  { value: "cake",     label: "Cakes & Desserts" },
  { value: "gift_box", label: "Gift Sets" },
  { value: "dessert",  label: "Sweets" },
  { value: "bundle",   label: "Bundles" },
];

// Desktop primary navigation — six approved destinations only
const CATEGORY_RAIL = [
  { id: "shop", category: "perfume",  label: "Perfumes" },
  { id: "shop", category: "cake",     label: "Cakes & Desserts" },
  { id: "shop", category: "gift_box", label: "Gift Sets" },
  { id: "build-a-box",                label: "Build a Box" },
  { id: "shops",                      label: "Sellers" },
  { id: "fragrance-finder",           label: "Find a Scent ✦", finder: true },
];

// Mobile drawer link groups
const DRAWER_GROUPS = [
  {
    group: "Shop",
    items: [
      { label: "Perfumes",         id: "shop",             category: "perfume" },
      { label: "Cakes & Desserts", id: "shop",             category: "cake" },
      { label: "Gift Sets",        id: "shop",             category: "gift_box" },
      { label: "Build a Box",      id: "build-a-box" },
      { label: "Sellers",          id: "shops" },
      { label: "Collections",      id: "collections" },
    ],
  },
  {
    group: "Discover",
    items: [
      { label: "Find a Scent",  id: "fragrance-finder" },
      { label: "Offers",        id: "offers" },
      { label: "Gifting",       id: "gifting" },
      { label: "Journal",       id: "journal" },
      { label: "Our Story",     id: "about" },
    ],
  },
  {
    group: "Help",
    items: [
      { label: "Support",  id: "support" },
      { label: "Account",  id: "account" },
      { label: "Orders",   id: "account" },
      { label: "Legal",    id: "legal" },
    ],
  },
  {
    group: "Partners",
    items: [
      { label: "Sell on Tuti",   id: "sell" },
      {
        label: "Seller Central",
        portal: getPortalUrl("VITE_SELLER_URL"),
      },
      {
        label: "Driver Portal",
        portal: getPortalUrl("VITE_DRIVER_URL"),
      },
      {
        label: "Sales Rep Portal",
        portal: getPortalUrl("VITE_SR_URL"),
      },
    ],
  },
];

export function ClientLayout({ route, shopCategory, onNavigate, onGoToSeller, children }) {
  const { user, isAuthenticated, clearAuth, isSeller, isAdmin } = useAuthStore();
  const { itemCount } = useCartStore();

  const [showAuth,     setShowAuth]     = useState(false);
  const [authDefaults, setAuthDefaults] = useState({ mode: "login" });
  const [showMenu,     setShowMenu]     = useState(false);
  const [showDrawer,   setShowDrawer]   = useState(false);
  const [immersivePassed, setImmersivePassed] = useState(false);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [searchCat,    setSearchCat]    = useState("all");

  const menuRef   = useRef(null);
  const drawerRef = useRef(null);
  const cartCount = itemCount();

  // Open auth modal from custom events (used by product pages etc.)
  useEffect(() => {
    function open(e) {
      setAuthDefaults({ mode: e.detail?.mode || "login" });
      setShowAuth(true);
    }
    window.addEventListener("tuti:open-auth", open);
    return () => window.removeEventListener("tuti:open-auth", open);
  }, []);

  // Close user dropdown on outside click
  useEffect(() => {
    function close(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    }
    if (showMenu) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showMenu]);

  // Close drawer on Escape and lock body scroll while open
  useEffect(() => {
    if (!showDrawer) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e) { if (e.key === "Escape") setShowDrawer(false); }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [showDrawer]);

  useEffect(() => {
    const immersiveRoutes = route === "home";
    if (!immersiveRoutes || typeof window === "undefined") {
      setImmersivePassed(false);
      return undefined;
    }

    function syncImmersiveHeader() {
      const storyRoot = document.querySelector(".is-outer, .is-mobile");
      const header = document.querySelector(".cl-topbar");
      if (!storyRoot || !header) {
        setImmersivePassed(false);
        return;
      }
      const headerHeight = header.getBoundingClientRect().height;
      const storyBottom = storyRoot.getBoundingClientRect().bottom;
      setImmersivePassed(storyBottom <= headerHeight + 8);
    }

    syncImmersiveHeader();
    window.addEventListener("scroll", syncImmersiveHeader, { passive: true });
    window.addEventListener("resize", syncImmersiveHeader);
    return () => {
      window.removeEventListener("scroll", syncImmersiveHeader);
      window.removeEventListener("resize", syncImmersiveHeader);
    };
  }, [route]);

  function handleSearch(e) {
    e.preventDefault();
    onNavigate("shop", searchCat === "all" ? undefined : searchCat);
    setTimeout(() => {
      const input = document.getElementById("catalog-search-input");
      if (input) {
        input.value = searchQuery;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, 120);
  }

  function drawerNavigate(id, category) {
    onNavigate(id, category);
    setShowDrawer(false);
  }

  const accountName = user?.name?.split(" ")[0] || "Sign in";
  const isAuth = isAuthenticated();
  const immersiveRoute = route === "home";
  const showTopbarSearch = route !== "shop";

  function handleNotificationNavigate(notification) {
    if (!notification?.entityType) return;
    if (notification.entityType === "order" || notification.entityType === "support") {
      onNavigate("account");
    }
  }

  return (
    <div className="cl-shell">
      {/* ══ Row 1 — main bar ════════════════════════════════════════ */}
      <header
        className={[
          "cl-topbar",
          immersiveRoute ? "cl-topbar--immersive" : "",
          immersiveRoute && immersivePassed ? "cl-topbar--solid" : "",
        ].filter(Boolean).join(" ")}
        role="banner"
      >
        <div className="cl-bar1">
          {/* Logo */}
          <button className="cl-logo" type="button" onClick={() => onNavigate("home")}>
            <span className="cl-logo-mark">{brand.mark}</span>
            <span className="cl-logo-name">{brand.name}</span>
            <span className="cl-logo-tld">.ae</span>
          </button>

          {/* Search */}
          {showTopbarSearch ? (
            <form className="cl-search-bar" onSubmit={handleSearch} role="search">
              <select
                className="cl-search-cat"
                value={searchCat}
                onChange={(e) => setSearchCat(e.target.value)}
                aria-label="Search category"
              >
                {SEARCH_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <input
                id="topbar-search"
                className="cl-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${brand.name} for perfumes, cakes, gift sets…`}
                aria-label="Search"
              />
              <button className="cl-search-btn" type="submit" aria-label="Search">
                <Search size={20} />
              </button>
            </form>
          ) : null}

          {/* Right chips — desktop */}
          <div className="cl-bar1-right">
            {/* Account */}
            <div className="cl-user-wrap" ref={menuRef}>
              <button
                className="cl-account-chip"
                type="button"
                onClick={() => isAuth ? setShowMenu(v => !v) : setShowAuth(true)}
              >
                <span className="cl-chip-top">
                  {isAuth ? `Hello, ${accountName}` : "Hello, sign in"}
                </span>
                <span className="cl-chip-bot">
                  Account &amp; Lists <ChevronDown size={12} />
                </span>
              </button>

              {showMenu && isAuth && (
                <div className="cl-account-dropdown">
                  <div className="cl-dropdown-head">
                    <strong>{user?.name}</strong>
                    <small>{user?.email}</small>
                    <span className="cl-role-chip">{user?.role}</span>
                  </div>
                  {(isSeller() || isAdmin()) && (
                    <button className="cl-dropdown-item" type="button"
                      onClick={() => { setShowMenu(false); onGoToSeller(); }}>
                      <Settings size={14} /> Seller Portal
                    </button>
                  )}
                  <button className="cl-dropdown-item" type="button"
                    onClick={() => { setShowMenu(false); onNavigate("account"); }}>
                    <Package size={14} /> My Orders
                  </button>
                  <button className="cl-dropdown-item" type="button"
                    onClick={() => { setShowMenu(false); onNavigate("support"); }}>
                    <Headphones size={14} /> Help &amp; Support
                  </button>
                  <div className="cl-dropdown-divider" />
                  <button className="cl-dropdown-item cl-dropdown-item--danger" type="button"
                    onClick={() => { clearAuth(); setShowMenu(false); onNavigate("home"); }}>
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>

            {/* Notifications */}
            <NotificationBell onNotificationNavigate={handleNotificationNavigate} />

            {/* Cart */}
            <button
              className="cl-cart-chip"
              type="button"
              onClick={() => onNavigate("cart")}
              aria-label={`Cart, ${cartCount} items`}
            >
              <div className="cl-cart-icon-wrap">
                <ShoppingBag size={28} />
                <span className="cl-cart-count">{cartCount > 99 ? "99+" : cartCount}</span>
              </div>
              <span className="cl-chip-bot cl-cart-label">Cart</span>
            </button>

            {/* Hamburger — mobile only */}
            <button
              className="cl-hamburger"
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={showDrawer}
              aria-controls="cl-mobile-drawer"
              onClick={() => setShowDrawer(true)}
            >
              <Menu size={22} />
            </button>
          </div>
        </div>

        {/* ══ Row 2 — desktop category rail ═══════════════════════════ */}
        <nav className="cl-bar2" aria-label="Product categories">
          {CATEGORY_RAIL.map(({ id, category, label, finder }) => {
            const active = category
              ? route === id && shopCategory === category
              : route === id;
            return (
              <button
                key={label}
                type="button"
                className={[
                  "cl-rail-btn",
                  active ? "active" : "",
                  finder ? "cl-rail-btn--finder" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => onNavigate(id, category)}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Page body */}
      <div className="cl-body" onClick={() => showMenu && setShowMenu(false)}>
        {children}
      </div>

      <ClientFooter onNavigate={onNavigate} />

      {/* ══ Mobile drawer ═══════════════════════════════════════════ */}
      {showDrawer && (
        <>
          {/* Overlay */}
          <div
            className="cl-drawer-overlay"
            aria-hidden="true"
            onClick={() => setShowDrawer(false)}
          />

          {/* Drawer panel */}
          <nav
            id="cl-mobile-drawer"
            className="cl-drawer"
            ref={drawerRef}
            aria-label="Site navigation"
          >
            <div className="cl-drawer-header">
              <span className="cl-drawer-brand">
                <span className="cl-logo-mark" style={{ width: "1.75rem", height: "1.75rem", fontSize: "0.95rem" }}>
                  {brand.mark}
                </span>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: "1rem" }}>{brand.name}</span>
              </span>
              <button
                className="cl-drawer-close"
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setShowDrawer(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="cl-drawer-body">
              {DRAWER_GROUPS.map(({ group, items }) => (
                <div key={group} className="cl-drawer-group">
                  <p className="cl-drawer-group-label">{group}</p>
                  {items.map(({ label, id, category, portal }) => {
                    // portal === null means env var absent in production — hide the item
                    if (portal === null) return null;
                    return portal ? (
                      <a
                        key={label}
                        href={portal}
                        className="cl-drawer-link"
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setShowDrawer(false)}
                      >
                        {label}
                      </a>
                    ) : (
                      <button
                        key={label}
                        type="button"
                        className="cl-drawer-link"
                        onClick={() => drawerNavigate(id, category)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="cl-drawer-foot">
              {isAuth ? (
                <button
                  type="button"
                  className="cl-drawer-foot-account"
                  onClick={() => { drawerNavigate("account"); }}
                >
                  {accountName}
                </button>
              ) : (
                <button
                  type="button"
                  className="cl-drawer-foot-signin"
                  onClick={() => { setShowDrawer(false); setShowAuth(true); }}
                >
                  Sign In
                </button>
              )}
              <button
                type="button"
                className="cl-drawer-foot-cart"
                onClick={() => drawerNavigate("cart")}
                aria-label={`Cart, ${cartCount} items`}
              >
                <ShoppingBag size={18} />
                Cart
                {cartCount > 0 && (
                  <span className="cl-drawer-cart-badge">{cartCount > 99 ? "99+" : cartCount}</span>
                )}
              </button>
            </div>
          </nav>
        </>
      )}

      {/* Auth modal */}
      {showAuth && (
        <AuthModal
          initialMode={authDefaults.mode}
          onClose={() => setShowAuth(false)}
        />
      )}
    </div>
  );
}
