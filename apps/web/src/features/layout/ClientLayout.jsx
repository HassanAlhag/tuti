import { useEffect, useRef, useState } from "react";
import {
  ChevronDown, ChevronRight, Headphones, LogOut, Menu, Package,
  Search, Settings, ShoppingBag, Sparkles, X,
} from "lucide-react";
import { brand }            from "@tuti/shared/brand.js";
import { useAuthStore }     from "@tuti/shared/store/authStore.js";
import { NotificationBell } from "../notifications/NotificationBell.jsx";
import { AuthModal }         from "../auth/AuthModal.jsx";
import { ClientFooter }      from "./ClientFooter.jsx";
import { CookieConsent }     from "./CookieConsent.jsx";
import { useCartStore }      from "../../store/cartStore.js";
import { getPortalUrl }      from "./portalUrls.js";
import { headerNavRoutes, mobileDrawerRoutes } from "../../config/customerRoutes.js";
import {
  customerMegaMenus,
  MEGA_ROUTE_MAP,
  mobileDrawerSubcategories,
  CATEGORY_MOBILE_KEY,
} from "../../config/customerMegaMenus.js";

const SEARCH_CATEGORIES = [
  { value: "all",      label: "All" },
  { value: "perfume",  label: "Perfumes" },
  { value: "cake",     label: "Cakes & Desserts" },
  { value: "gift_box", label: "Gift Boxes" },
  { value: "dessert",  label: "Sweets" },
  { value: "bundle",   label: "Gift Boxes" },
];

const MEGA_FEATURE_POINTS = {
  perfumes: ["Signature scents", "Oud & musk", "Gift-ready bottles"],
  cakes: ["Celebration cakes", "Dessert boxes", "Same-day treats"],
  giftBoxes: ["Graduation gifts", "Occasion boxes", "Boutique packages"],
};

const MEGA_PANEL_STEPS = ["Select items", "Add message", "Boutique prepares it"];

// ─── Mega menu panel ─────────────────────────────────────────────────────────

function MegaMenuPanel({ data, onNav }) {
  if (!data) return null;

  if (data.layout === "shop") {
    return (
      <div className="cl-mega-inner cl-mega-inner--shop">
        {/* Left: editorial feature */}
        <div className="cl-mega-feature">
          <span className="cl-mega-eyebrow">{data.eyebrow}</span>
          <div className="cl-mega-feature-title">{data.title}</div>
          <p className="cl-mega-feature-body">{data.body}</p>
          <p className="cl-mega-feature-desc">{data.description}</p>
          <div className="cl-mega-feature-actions">
            <button
              className="cl-mega-cta cl-mega-cta--primary"
              type="button"
              onClick={() => onNav(data.primaryCta.routeId, data.primaryCta.category)}
            >
              {data.primaryCta.label}
            </button>
            <button
              className="cl-mega-cta cl-mega-cta--ghost"
              type="button"
              onClick={() => onNav(data.secondaryCta.routeId, data.secondaryCta.category)}
            >
              {data.secondaryCta.label}
            </button>
          </div>
        </div>

        {/* Right: 2×2 category cards */}
        <div className="cl-mega-cards">
          {data.cards.map((card) => (
            <button
              key={card.key}
              type="button"
              className={`cl-mega-card cl-mega-card--${card.key}`}
              onClick={() => onNav(card.routeId, card.category || undefined)}
            >
              <div className="cl-mega-card-icon">{card.icon}</div>
              <div>
                <div className="cl-mega-card-label">{card.label}</div>
                <div className="cl-mega-card-desc">{card.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (data.layout === "category") {
    return (
      <div className="cl-mega-inner cl-mega-inner--category">
        {/* Left: feature editorial */}
        <div className="cl-mega-feature">
          <span className="cl-mega-eyebrow">{data.featureEyebrow}</span>
          <div className="cl-mega-feature-title">{data.featureTitle}</div>
          <p className="cl-mega-feature-body">{data.featureBody}</p>
          <div className="cl-mega-feature-actions">
            <button
              className="cl-mega-cta cl-mega-cta--primary"
              type="button"
              onClick={() => onNav(data.primaryCta.routeId, data.primaryCta.category)}
            >
              {data.primaryCta.label}
            </button>
            {data.secondaryCta ? (
              <button
                className="cl-mega-cta cl-mega-cta--ghost"
                type="button"
                onClick={() => onNav(data.secondaryCta.routeId, data.secondaryCta.category)}
              >
                {data.secondaryCta.label}
              </button>
            ) : null}
          </div>
          {MEGA_FEATURE_POINTS[data.key]?.length ? (
            <div className="cl-mega-feature-points" aria-label={`${data.featureTitle} highlights`}>
              {MEGA_FEATURE_POINTS[data.key].map((point) => (
                <span className="cl-mega-feature-point" key={point}>
                  {point}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Middle: subcategory links */}
        <div className="cl-mega-sub">
          <div className="cl-mega-sub-heading">{data.subcategoriesHeading}</div>
          <p className="cl-mega-sub-helper">Explore popular ways to shop this category.</p>
          <div className="cl-mega-sub-grid">
            {data.subcategories.map((sub) => (
              <button
                key={sub.label}
                type="button"
                className="cl-mega-sub-link"
                onClick={() => onNav(sub.routeId, sub.category)}
              >
                <span>{sub.label}</span>
                <ChevronRight size={14} strokeWidth={2.2} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        {/* Right: Build a Gift highlight panel */}
        <div className="cl-mega-panel">
          <span className="cl-mega-panel-eyebrow">{data.panelEyebrow}</span>
          <div className="cl-mega-panel-title">{data.panelTitle}</div>
          <p className="cl-mega-panel-body">{data.panelBody}</p>
          <div className="cl-mega-panel-steps" aria-label="Build a Gift steps">
            {MEGA_PANEL_STEPS.map((step) => (
              <span className="cl-mega-panel-step" key={step}>
                {step}
              </span>
            ))}
          </div>
          <button
            className="cl-mega-cta cl-mega-cta--primary"
            type="button"
            style={{ marginTop: "auto" }}
            onClick={() => onNav(data.panelCta.routeId)}
          >
            {data.panelCta.label}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Main layout ─────────────────────────────────────────────────────────────

export function ClientLayout({ route, shopCategory, onNavigate, onGoToSeller, children }) {
  const { user, isAuthenticated, clearAuth, isSeller, isAdmin } = useAuthStore();
  const { itemCount } = useCartStore();

  const [showAuth,      setShowAuth]      = useState(false);
  const [authDefaults,  setAuthDefaults]  = useState({ mode: "login" });
  const [showMenu,      setShowMenu]      = useState(false);
  const [showDrawer,    setShowDrawer]    = useState(false);
  const [immersivePassed, setImmersivePassed] = useState(false);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchCat,     setSearchCat]     = useState("all");
  const [activeMega,    setActiveMega]    = useState(null);
  const [drawerExpanded, setDrawerExpanded] = useState({});

  const menuRef     = useRef(null);
  const drawerRef   = useRef(null);
  const megaTimerRef = useRef(null);
  const cartCount   = itemCount();

  const currentMega = activeMega ? customerMegaMenus[activeMega] : null;

  function openMega(key) {
    clearTimeout(megaTimerRef.current);
    setActiveMega(key);
  }

  function closeMegaDelayed() {
    megaTimerRef.current = setTimeout(() => setActiveMega(null), 100);
  }

  function cancelMegaClose() {
    clearTimeout(megaTimerRef.current);
  }

  function megaNav(routeId, category) {
    setActiveMega(null);
    onNavigate(routeId, category);
  }

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

  // Close mega menu on outside click
  useEffect(() => {
    if (!activeMega) return undefined;
    function close(e) {
      const topbar = document.querySelector(".cl-topbar");
      if (topbar && !topbar.contains(e.target)) setActiveMega(null);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [activeMega]);

  // Close mega on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape" && activeMega) setActiveMega(null); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeMega]);

  // Close drawer on Escape, lock body scroll while open, reset expanded on close
  useEffect(() => {
    if (!showDrawer) {
      setDrawerExpanded({});
      return undefined;
    }
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
      const storyRoot = document.querySelector(".is-story");
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

  function toggleDrawerExpand(key) {
    setDrawerExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const accountName = user?.name?.split(" ")[0] || "Sign in";
  const isAuth = isAuthenticated();
  const immersiveRoute = route === "home";
  const showTopbarSearch = true;

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
          <button
            className="cl-logo"
            type="button"
            onClick={() => { setActiveMega(null); onNavigate("home"); }}
          >
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
                placeholder="Search perfumes, cakes, Gift Boxes…"
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
        <nav
          className="cl-bar2"
          aria-label="Product categories"
          onMouseLeave={closeMegaDelayed}
        >
          {headerNavRoutes.map(({ id, routeKey, category, label, finder }) => {
            const megaKey = MEGA_ROUTE_MAP[routeKey];
            const isOpen  = megaKey && activeMega === megaKey;
            const active  = category
              ? route === "shop" && shopCategory === category
              : route === id && !(id === "shop" && shopCategory && shopCategory !== "all");
            return (
              <button
                key={label}
                type="button"
                className={[
                  "cl-rail-btn",
                  active    ? "active"              : "",
                  finder    ? "cl-rail-btn--finder" : "",
                  isOpen    ? "cl-rail-btn--mega-open" : "",
                ].filter(Boolean).join(" ")}
                aria-current={active ? "page" : undefined}
                aria-haspopup={megaKey ? "true" : undefined}
                aria-expanded={megaKey ? isOpen : undefined}
                onClick={() => { setActiveMega(null); onNavigate(id, category); }}
                onMouseEnter={() => megaKey ? openMega(megaKey) : setActiveMega(null)}
                onFocus={() => megaKey ? openMega(megaKey) : undefined}
              >
                {label}
                {megaKey ? (
                  <ChevronDown
                    size={11}
                    className="cl-rail-chevron"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* ══ Mega menu panel ════════════════════════════════════════ */}
        {currentMega ? (
          <div
            className={`cl-mega cl-mega--${activeMega}`}
            role="navigation"
            aria-label={`${currentMega.featureTitle || currentMega.title || ""} menu`}
            onMouseEnter={cancelMegaClose}
            onMouseLeave={closeMegaDelayed}
          >
            <MegaMenuPanel data={currentMega} onNav={megaNav} />
          </div>
        ) : null}
      </header>

      {/* Page body */}
      <div className="cl-body" onClick={() => { showMenu && setShowMenu(false); activeMega && setActiveMega(null); }}>
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
              {mobileDrawerRoutes.map(({ group, items }) => (
                <div key={group} className="cl-drawer-group">
                  <p className="cl-drawer-group-label">{group}</p>
                  {items.map(({ label, id, category, portalKey }) => {
                    const portal = portalKey ? getPortalUrl(portalKey) : "";
                    const active = category
                      ? route === "shop" && shopCategory === category
                      : route === id && !(id === "shop" && shopCategory && shopCategory !== "all");
                    const subKey = category ? CATEGORY_MOBILE_KEY[category] : null;
                    const subs   = subKey ? mobileDrawerSubcategories[subKey] : null;
                    const isExpanded = subKey ? Boolean(drawerExpanded[subKey]) : false;

                    if (portalKey && !portal) return null;

                    if (portal) {
                      return (
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
                      );
                    }

                    if (subs) {
                      return (
                        <div key={label} className="cl-drawer-expandable">
                          <div className="cl-drawer-expand-row">
                            <button
                              type="button"
                              className={active ? "cl-drawer-link active" : "cl-drawer-link"}
                              aria-current={active ? "page" : undefined}
                              onClick={() => drawerNavigate(id, category)}
                            >
                              {label}
                            </button>
                            <button
                              type="button"
                              className="cl-drawer-expand-toggle"
                              aria-expanded={isExpanded}
                              aria-label={`${isExpanded ? "Collapse" : "Expand"} ${label} subcategories`}
                              onClick={() => toggleDrawerExpand(subKey)}
                            >
                              <ChevronRight
                                size={14}
                                className={isExpanded ? "cl-drawer-chevron cl-drawer-chevron--open" : "cl-drawer-chevron"}
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                          {isExpanded && (
                            <div className="cl-drawer-subs">
                              {subs.map((sub) => (
                                <button
                                  key={sub.label}
                                  type="button"
                                  className="cl-drawer-sub-link"
                                  onClick={() => drawerNavigate(sub.routeId, sub.category)}
                                >
                                  {sub.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={label}
                        type="button"
                        className={active ? "cl-drawer-link active" : "cl-drawer-link"}
                        aria-current={active ? "page" : undefined}
                        data-id={id}
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

      <CookieConsent />
    </div>
  );
}
