/**
 * Tuti — Seller Portal App
 *
 * This app is ONLY for sellers. It has NO knowledge of the customer
 * storefront or the admin console.
 *
 * Authentication: if the user is not authenticated or not a seller,
 * they see the login screen — not a redirect to the client app.
 *
 * Routing: /seller, /seller/products, /seller/orders, ...
 */

import { useEffect, useState } from "react";
import { useAuthStore }    from "@tuti/shared/store/authStore.js";
import { marketplaceApi, uploadApi } from "@tuti/shared/api/client.js";
import { SellerLayout }    from "./features/shell/SellerLayout.jsx";
import { SellerLogin }     from "./features/auth/SellerLogin.jsx";
import {
  SellerOverview,
  SellerBrandProfile,
  SellerDrivers,
  SellerProducts,
  SellerOrders,
  SellerCustomers,
  SellerAnalytics,
  SellerPayouts,
  SellerSupportTickets,
} from "./features/shell/SellerPortal.jsx";

const SECTIONS  = ["overview", "brand", "products", "orders", "drivers", "customers", "analytics", "payouts", "support"];

function getSectionFromQuery() {
  const section = new URLSearchParams(window.location.search).get("section");
  return SECTIONS.includes(section) ? section : null;
}

function getSection() {
  const querySection = getSectionFromQuery();
  if (querySection) return querySection;
  const s = window.location.pathname.split("/")[2] || "overview";
  return SECTIONS.includes(s) ? s : "overview";
}

const DEFAULT_PRODUCT = {
  name: "", category: "perfume", family: "Oud", gender: "Unisex",
  price: 320, size: "75ml", stock: 12, notes: "oud, amber, musk",
  cakeType: "", servings: "", flavors: "", allergens: "", occasionTags: "",
  leadTimeDays: 0, customMessageAvailable: false, imageName: "",
};

export default function App() {
  const { user, isAuthenticated, isSeller, isAdmin } = useAuthStore();
  const [section,    setSection]    = useState(getSection);
  const [seller,     setSeller]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState("");
  const [newProduct, setNewProduct] = useState(DEFAULT_PRODUCT);
  const [uploadNote, setUploadNote] = useState("");
  const [deepLinkTarget, setDeepLinkTarget] = useState({ orderId: "", productId: "", notice: "" });

  const canAccess = isAuthenticated() && (isSeller() || isAdmin());

  // ── Load seller data ────────────────────────────────────────────
  useEffect(() => {
    if (!canAccess) { setLoading(false); return; }

    let mounted = true;
    setLoading(true);

    marketplaceApi.getSeller(user?.shopId || undefined)
      .then((data)  => { if (mounted) setSeller(data); })
      .catch((e)    => { if (mounted) setLoadError(e.message); })
      .finally(()   => { if (mounted) setLoading(false); });

    function onPopState() {
      const params = new URLSearchParams(window.location.search);
      setSection(getSection());
      setDeepLinkTarget({
        orderId: params.get("order") || "",
        productId: params.get("product") || "",
        notice: "",
      });
    }
    onPopState();
    window.addEventListener("popstate", onPopState);
    return () => { mounted = false; window.removeEventListener("popstate", onPopState); };
  }, [canAccess, user?.sub]);

  // ── Navigation ──────────────────────────────────────────────────
  function goToSection(id) {
    const path = id === "overview" ? "/seller?section=overview" : `/seller/${id}?section=${id}`;
    window.history.pushState(null, "", path);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setSection(id);
    setDeepLinkTarget({ orderId: "", productId: "", notice: "" });
  }

  function goToStore() {
    window.location.href = import.meta.env.VITE_CLIENT_URL || "/";
  }

  function handleNotificationNavigate(_notification, path) {
    if (!path) return;
    window.history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Refresh seller data (called after product edits / stock updates) ──
  async function refreshSeller() {
    try {
      const data = await marketplaceApi.getSeller(user?.shopId || undefined);
      setSeller(data);
    } catch { /* silently ignore; next full reload will reconcile */ }
  }

  // ── Submit new product ──────────────────────────────────────────
  async function submitProduct(e) {
    e.preventDefault();
    if (!newProduct.name.trim()) return;
    const split = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);
    const payload = { ...newProduct, price: Number(newProduct.price), stock: Number(newProduct.stock), shopId: seller?.shop?.id || user?.shopId };

    // Remove internal file reference — never send File objects to JSON API
    const imageFile = payload._imageFile;
    delete payload._imageFile;

    if (newProduct.category !== "perfume") {
      payload.family = ""; payload.gender = "";
      payload.flavors = split(newProduct.flavors);
      payload.allergens = split(newProduct.allergens);
      payload.occasionTags = split(newProduct.occasionTags);
    }

    if (imageFile) {
      setUploadNote("Uploading image…");
      try {
        const { url } = await uploadApi.uploadImage(imageFile);
        payload.imagePath = url;
      } catch (err) {
        setUploadNote(err?.message || "Image upload failed.");
        return;
      }
    }

    await marketplaceApi.createSellerProduct(payload);
    const fresh = await marketplaceApi.getSeller(user?.shopId || undefined);
    setSeller(fresh);
    setUploadNote(`${newProduct.name} submitted for approval.`);
    setNewProduct(DEFAULT_PRODUCT);
  }

  // ── Auth gate ───────────────────────────────────────────────────
  if (!loading && !canAccess) {
    return <SellerLogin />;
  }

  if (loading) return <div className="sd-loading" style={{ minHeight: "100vh" }}>Loading…</div>;
  if (loadError) return (
    <div className="sd-loading" style={{ minHeight: "100vh", color: "var(--danger)" }}>
      <strong>Cannot connect</strong> — {loadError}
    </div>
  );

  // ── Section content ─────────────────────────────────────────────
  const content = {
    overview:  <SellerOverview  seller={seller} />,
    brand:     <SellerBrandProfile seller={seller} />,
    products:  <SellerProducts  seller={seller} productDraft={newProduct} setProductDraft={setNewProduct} onProductSubmit={submitProduct} uploadNote={uploadNote} onRefreshSeller={refreshSeller} focusedProductId={deepLinkTarget.productId} onFocusHandled={(notice) => setDeepLinkTarget((current) => ({ ...current, notice: notice || "" }))} />,
    orders:    <SellerOrders focusedOrderId={deepLinkTarget.orderId} onFocusHandled={(notice) => setDeepLinkTarget((current) => ({ ...current, notice: notice || "" }))} />,
    drivers:   <SellerDrivers seller={seller} />,
    customers: <SellerCustomers seller={seller} />,
    analytics: <SellerAnalytics seller={seller} />,
    payouts:   <SellerPayouts   seller={seller} />,
    support:   <SellerSupportTickets seller={seller} onOpenOrder={(orderId) => {
      setSection("orders");
      setDeepLinkTarget({ orderId, productId: "", notice: "" });
    }} />,
  }[section];

  return (
    <SellerLayout
      activeSection={section}
      onSectionChange={goToSection}
      shopName={seller?.shop?.name}
      shop={seller?.shop}
      onBack={goToStore}
      onNotificationNavigate={handleNotificationNavigate}
    >
      {deepLinkTarget.notice ? <p className="sd-deeplink-note">{deepLinkTarget.notice}</p> : null}
      {content}
    </SellerLayout>
  );
}
