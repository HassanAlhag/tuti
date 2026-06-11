/**
 * Tuti — Web Storefront App
 *
 * This app handles ONLY the customer-facing storefront website.
 * Seller portal → apps/seller
 * Admin console → apps/admin
 */

import { useEffect, useMemo, useState } from "react";
import { useAuthStore }  from "@tuti/shared/store/authStore.js";
import { marketplaceApi } from "@tuti/shared/api/client.js";
import { useCartStore }  from "./store/cartStore.js";
import { useWishlistStore } from "@tuti/shared/store/wishlistStore.js";

// ── Page components (client-owned, no seller/admin code) ──────────
import { ClientLayout }       from "./features/layout/ClientLayout.jsx";
import { HomePage }           from "./features/pages/HomePage.jsx";
import { ShopPage }           from "./features/pages/ShopPage.jsx";
import { ProductPage }        from "./features/pages/ProductPage.jsx";
import { CartPage }           from "./features/pages/CartPage.jsx";
import { BuildYourBoxPage }   from "./features/pages/BuildYourBoxPage.jsx";
import { CollectionsPage }    from "./features/pages/CollectionsPage.jsx";
import { CollectionPage }     from "./features/pages/CollectionPage.jsx";
import { ShopsPage }          from "./features/pages/ShopsPage.jsx";
import { AboutPage }          from "./features/pages/AboutPage.jsx";
import { SellerBrandPage }    from "./features/pages/SellerBrandPage.jsx";
import { SellerLandingPage }  from "./features/pages/SellerLandingPage.jsx";
import {
  FragranceFinderPage,
  GiftingPage,
  OffersPage,
  JournalPage,
  CustomerServicePage,
  AccountPage,
  OrderConfirmationPage,
  ResetPasswordPage,
  StoreLocatorPage,
  LegalPage,
} from "./features/pages/SitemapPages.jsx";
import { SupportTicketsPage } from "./features/pages/SupportTicketsPage.jsx";

// ── Route helpers ─────────────────────────────────────────────────
function getRoute() {
  const p = window.location.pathname;
  if (p.startsWith("/sellers/"))      return "seller-brand";
  if (p.startsWith("/collections/") && p !== "/collections/") return "collection";
  if (p.startsWith("/orders/"))        return "order-confirmation";
  if (p.startsWith("/shop"))             return "shop";
  if (p.startsWith("/products/"))        return "product";
  if (p.startsWith("/cart"))             return "cart";
  if (p.startsWith("/collections"))      return "collections";
  if (p.startsWith("/shops"))            return "shops";
  if (p.startsWith("/sell"))             return "sell";
  if (p.startsWith("/about"))            return "about";
  if (p.startsWith("/fragrance-finder")) return "fragrance-finder";
  if (p.startsWith("/build-a-box"))      return "build-a-box";
  if (p.startsWith("/gifting"))          return "gifting";
  if (p.startsWith("/offers"))           return "offers";
  if (p.startsWith("/journal"))          return "journal";
  if (p.startsWith("/contact"))          return "contact";
  if (p.startsWith("/support"))          return "support";
  if (p.startsWith("/customer-service")) return "customer-service";
  if (p.startsWith("/account"))          return "account";
  if (p.startsWith("/reset-password"))   return "reset-password";
  if (p.startsWith("/store-locator"))    return "store-locator";
  if (p.startsWith("/legal"))            return "legal";
  return "home";
}

function getCategory() {
  return new URLSearchParams(window.location.search).get("c") || "all";
}

function getCollectionSlug() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] !== "collections" || parts.length < 2) return "";
  try {
    return decodeURIComponent(parts[1] || "").trim();
  } catch {
    return String(parts[1] || "").trim();
  }
}

function getProductId() {
  const [, section, id] = window.location.pathname.split("/");
  return section === "products" ? id : "";
}

function getOccasion() {
  return new URLSearchParams(window.location.search).get("occasion") || "";
}

function getSellerBrandSlug() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] !== "sellers") return "";
  return decodeURIComponent(parts[1] || "").trim();
}

const DEFAULT_REVIEW = { rating: 5, title: "", body: "", verified: true, scent: 5, longevity: 4, value: 4 };

export default function App() {
  const { user, isAuthenticated }  = useAuthStore();
  const { items, addItem, updateQuantity, updateItemMetadata, clearCart, total } = useCartStore();
  const { hydrate: hydrateWishlist } = useWishlistStore();

  const [route,       setRoute]       = useState(getRoute);
  const [category,    setCategory]    = useState(getCategory);
  const [collectionSlug, setCollectionSlug] = useState(getCollectionSlug);
  const [storefront,  setStorefront]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState("");
  const [query,       setQuery]       = useState("");
  const [family,      setFamily]      = useState("All");
  const [reviewDraft, setReviewDraft] = useState(DEFAULT_REVIEW);
  const [reviewNote,  setReviewNote]  = useState("");
  const [checkoutNote, setCheckoutNote] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [occasion,          setOccasion]          = useState(getOccasion);
  const [cartNotice,        setCartNotice]        = useState("");
  const [sellerBrandSlug,   setSellerBrandSlug]   = useState(getSellerBrandSlug);

  // ── Load storefront data ────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    setLoading(true);

    marketplaceApi.getStorefront()
      .then((data) => { if (mounted) { setStorefront(data); setSelectedProductId((c) => getProductId() || c || data.products?.[0]?.id || ""); } })
      .catch((e)   => { if (mounted) setLoadError(e.message); })
      .finally(()  => { if (mounted) setLoading(false); });

    function onPopState() {
      setRoute(getRoute());
      setCategory(getCategory());
      setCollectionSlug(getCollectionSlug());
      setOccasion(getOccasion());
      setSellerBrandSlug(getSellerBrandSlug());
      setSelectedProductId((c) => getProductId() || c);
    }
    window.addEventListener("popstate", onPopState);
    return () => { mounted = false; window.removeEventListener("popstate", onPopState); };
  }, [isAuthenticated()]);

  // Hydrate wishlist from persisted user data when auth changes
  useEffect(() => {
    hydrateWishlist(user?.wishlist || []);
  }, [user?.wishlist, hydrateWishlist]);

  // ── Navigation ──────────────────────────────────────────────────
  function push(path) {
    window.history.pushState(null, "", path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function navigate(id, cat, occ) {
    const paths = {
      home: "/", cart: "/cart", collections: "/collections", shops: "/shops",
      sell: "/sell", about: "/about",
      "fragrance-finder": "/fragrance-finder",
      "build-a-box":      "/build-a-box",
      gifting:            "/gifting",
      offers:             "/offers",
      journal:            "/journal",
      contact:            "/contact",
      "customer-service": "/customer-service",
      support:            "/support",
      account:            "/account",
      "store-locator":    "/store-locator",
      legal:              "/legal",
    };
    if (id === "shop") {
      const params = new URLSearchParams();
      if (cat && cat !== "all") params.set("c", cat);
      if (occ) params.set("occasion", occ);
      const qs = params.toString();
      push(qs ? `/shop?${qs}` : "/shop");
      setRoute("shop"); setCategory(cat || "all"); setOccasion(occ || "");
    } else if (paths[id]) {
      push(paths[id]); setRoute(id);
    }
  }

  function navigatePath(path) {
    if (!path) return;
    if (path === "/" || path === "")                        return navigate("home");
    if (path === "/cart")                                   return navigate("cart");
    if (path === "/shop")                                   return navigate("shop");
    if (path.startsWith("/shop/"))                          return navigate("shop", path.replace("/shop/", ""));
    if (path.startsWith("/collections/") && path !== "/collections/") {
      push(path);
      setRoute("collection");
      setCollectionSlug(getCollectionSlug());
      return;
    }
    if (path === "/collections")                            return navigate("collections");
    if (path === "/shops")                                  return navigate("shops");
    if (path === "/about" || path.startsWith("/about#"))    return navigate("about");
    if (path === "/sell")                                   return navigate("sell");
    if (path === "/journal")                                return navigate("journal");
    if (path === "/contact")                                return navigate("contact");
    if (path === "/support" || path.startsWith("/support?")) {
      push(path);
      setRoute("support");
      return;
    }
    if (path.startsWith("/customer-service"))               return navigate("customer-service");
    if (path === "/account" || path.startsWith("/account?")) {
      push(path);
      setRoute("account");
      return;
    }
    if (path.startsWith("/orders/")) {
      push(path);
      setRoute("order-confirmation");
      return;
    }
    if (path.startsWith("/sellers/")) {
      push(path);
      setRoute("seller-brand");
      setSellerBrandSlug(getSellerBrandSlug());
      return;
    }
    if (path === "/store-locator")                          return navigate("store-locator");
    if (path.startsWith("/legal"))                          return navigate("legal");
    if (path === "/build-a-box")                             return navigate("build-a-box");
    if (path === "/gifting" || path.startsWith("/gifting/")) return navigate("gifting");
    if (path === "/offers")                                 return navigate("offers");
    if (path === "/fragrance-finder")                       return navigate("fragrance-finder");
    push(path);
    setRoute(getRoute());
  }

  function goToProduct(productId) {
    setSelectedProductId(productId);
    push(`/products/${productId}`);
    setRoute("product");
  }

  // ── Derived ─────────────────────────────────────────────────────
  const products    = storefront?.products    || [];
  const shops       = storefront?.shops       || [];
  const reviews     = storefront?.reviews     || [];
  const promotions  = storefront?.promotions  || [];
  const collections = storefront?.collections || [];
  const topPerfumes = storefront?.rankings?.topPerfumes || [];
  const topShops    = storefront?.rankings?.topShops    || [];
  const families    = useMemo(
    () => ["All", ...[...new Set(products.filter((p) => !p.category || p.category === "perfume").map((p) => p.family).filter(Boolean))]],
    [products]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const shop = shops.find((s) => s.id === p.shopId);
      const hay = [p.name, p.family, p.gender, shop?.name, (p.notes || []).join(" "), (p.tags || []).join(" "), (p.flavors || []).join(" "), (p.occasionTags || []).join(" ")].join(" ").toLowerCase();
      return (!q || hay.includes(q)) && (family === "All" || p.family === family);
    });
  }, [family, products, query, shops]);

  const productId    = route === "product" ? getProductId() : selectedProductId;
  const reviewTarget = products.find((p) => p.id === productId) || products[0];
  const productDetail = route === "product" ? products.find((p) => p.id === getProductId()) : null;
  const cartSubtotal = total();
  const platformFee  = Math.round(cartSubtotal * 0.14);

  // ── Actions ─────────────────────────────────────────────────────
  async function submitReview(e) {
    e.preventDefault();
    if (!reviewTarget) return;
    await marketplaceApi.createReview({
      productId: reviewTarget.id,
      customer:  user?.name || "Guest",
      rating:    Number(reviewDraft.rating),
      title:     reviewDraft.title,
      body:      reviewDraft.body,
      verified:  reviewDraft.verified,
      aspects:   { scent: Number(reviewDraft.scent), longevity: Number(reviewDraft.longevity), value: Number(reviewDraft.value) },
    });
    setReviewNote(`${reviewTarget.name} rating updated.`);
    setReviewDraft(DEFAULT_REVIEW);
  }

  function addToCartWithFeedback(product, quantity = 1, options = {}) {
    addItem(product, quantity, options);
    setCartNotice("Added to cart");
  }

  useEffect(() => {
    if (!cartNotice) return undefined;
    const timer = window.setTimeout(() => setCartNotice(""), 1800);
    return () => window.clearTimeout(timer);
  }, [cartNotice]);

  function submitCheckout() {
    if (!items.length) return;
    setCheckoutNote("Payment authorized. Vendor payout stays pending until delivery and reserve checks pass.");
  }

  // ── Render ──────────────────────────────────────────────────────
  if (loading) return <div className="cl-loading">Loading…</div>;
  if (loadError) return (
    <div className="cl-error">
      <strong>Cannot connect</strong>
      <span>{loadError}</span>
      <button className="primary-action" onClick={() => window.location.reload()} type="button">Retry</button>
    </div>
  );

  const shared = {
    cart: items, cartTotal: cartSubtotal, checkoutNote, collections, families, family,
    filteredProducts: filtered, getProduct: (id) => products.find((p) => p.id === id),
    getShop: (id) => shops.find((s) => s.id === id), platformFee, promotions, products,
    query, reviewDraft, reviewList: reviews, reviewNote, reviewTarget,
    selectedReviewProduct: reviewTarget,
    setFamily, setQuery, setReviewDraft, onAddToCart: addToCartWithFeedback,
    shops, submitCheckout, submitCustomerReview: submitReview,
    topPerfumes, topShops, updateCartQuantity: updateQuantity, updateItemMetadata,
    vendorNet: cartSubtotal - platformFee, onViewProduct: goToProduct,
  };

  const pages = {
    home: (
      <HomePage
        collections={collections} getProduct={shared.getProduct} getShop={shared.getShop}
        goToAbout={() => navigate("about")} goToGifting={() => navigate("gifting")}
        goToBuildBox={() => navigate("build-a-box")}
        goToCollections={() => navigate("collections")}
        goToFragranceFinder={() => navigate("fragrance-finder")}
        goToJournal={() => navigate("journal")}
        goToSell={() => navigate("sell")}
        goToShops={() => navigate("shops")}
        goToSellerBrand={(slug) => navigatePath(`/sellers/${slug}`)}
        goToShop={(c) => navigate("shop", c)} onAddToCart={addToCartWithFeedback} products={products}
        promotions={promotions} shops={shops} topPerfumes={topPerfumes} topShops={topShops}
      />
    ),
    shop: (
      <ShopPage
        {...shared}
        initialCategory={category}
        initialOccasion={occasion}
        onCategoryChange={(c) => navigate("shop", c)}
      />
    ),
    product: (
      <ProductPage
        {...shared}
        product={productDetail}
        goToCart={() => navigate("cart")}
        goToShop={(c) => navigate("shop", c)}
        onRateProduct={setSelectedProductId}
      />
    ),
    cart: (
      <CartPage
        cart={items} cartTotal={cartSubtotal} clearCart={clearCart}
        checkoutNote={checkoutNote} platformFee={platformFee}
        submitCheckout={submitCheckout} updateCartQuantity={updateQuantity}
        updateItemMetadata={updateItemMetadata}
        onNavigate={navigatePath}
        vendorNet={cartSubtotal - platformFee}
      />
    ),
    "order-confirmation": (
      <OrderConfirmationPage onNavigate={navigatePath} />
    ),
    collections: (
      <CollectionsPage
        collections={collections} getProduct={shared.getProduct} getShop={shared.getShop}
        goToShop={(c) => navigate("shop", c)} onAddToCart={addToCartWithFeedback} onRateProduct={goToProduct}
      />
    ),
    collection: (
      <CollectionPage
        slug={collectionSlug}
        onNavigate={navigatePath}
        onViewProduct={goToProduct}
      />
    ),
    sell:  <SellerLandingPage />,
    shops: <ShopsPage shops={shops} />,
    about: <AboutPage roles={storefront?.roles || []} />,
    "seller-brand": (
      <SellerBrandPage
        slug={sellerBrandSlug}
        onAddToCart={addToCartWithFeedback}
        onNavigate={navigatePath}
        onViewProduct={goToProduct}
      />
    ),
    "fragrance-finder": (
      <FragranceFinderPage
        products={products}
        getShop={shared.getShop}
        onAddToCart={addToCartWithFeedback}
        onNavigate={navigatePath}
        onViewProduct={goToProduct}
        onShopWithPreferences={(fam) => { setFamily(fam); navigate("shop", "perfume"); }}
      />
    ),
    "build-a-box": (
      <BuildYourBoxPage
        products={products}
        getShop={shared.getShop}
        onAddToCart={addToCartWithFeedback}
        onNavigate={navigatePath}
      />
    ),
    gifting: (
      <GiftingPage
        products={products}
        getShop={shared.getShop}
        onAddToCart={addToCartWithFeedback}
        onNavigate={navigatePath}
      />
    ),
    offers: (
      <OffersPage
        promotions={promotions}
        getProduct={shared.getProduct}
        onNavigate={navigatePath}
      />
    ),
    journal:            <JournalPage />,
    contact:            <CustomerServicePage mode="contact" onNavigate={navigatePath} />,
    "customer-service": <CustomerServicePage onNavigate={navigatePath} />,
    support: (
      <SupportTicketsPage
        onNavigate={navigatePath}
      />
    ),
    account:            <AccountPage onNavigate={navigatePath} />,
    "reset-password":   <ResetPasswordPage onNavigate={navigatePath} />,
    "store-locator":    <StoreLocatorPage />,
    legal:              <LegalPage />,
  };

  return (
    <>
      <ClientLayout
        route={route}
        shopCategory={category}
        onNavigate={navigate}
        onGoToSeller={() => { window.location.href = import.meta.env.VITE_SELLER_URL || "/seller"; }}
      >
        {pages[route] || pages.home}
      </ClientLayout>
      {cartNotice ? <div className="cart-toast">{cartNotice}</div> : null}
    </>
  );
}
