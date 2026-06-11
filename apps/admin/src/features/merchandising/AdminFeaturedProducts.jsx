import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Eye,
  Package,
  Plus,
  Save,
  Sparkles,
  Store,
  Trash2,
} from "lucide-react";
import { adminMerchandisingApi } from "@tuti/shared/api/client.js";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { MetricCard } from "@tuti/shared/components/MetricCard.jsx";
import { PageTitle } from "@tuti/shared/components/PageTitle.jsx";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";
import { StatusBadge } from "@tuti/shared/components/StatusBadge.jsx";

const PLACEMENT_OPTIONS = [
  { value: "homepage_featured_products", label: "Homepage featured products" },
  { value: "luxury_picks", label: "Luxury picks" },
  { value: "new_arrivals", label: "New arrivals" },
  { value: "gift_sets", label: "Gift sets" },
  { value: "arabic_perfumes", label: "Arabic perfumes" },
  { value: "seasonal_campaign", label: "Seasonal campaign" },
];

function placementLabel(value) {
  return PLACEMENT_OPTIONS.find((option) => option.value === value)?.label || value || "Homepage featured products";
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function toDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function asIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function selectDefaultProduct(products = [], shops = []) {
  const shopById = new Map((shops || []).map((shop) => [String(shop.id), shop]));
  return (
    products.find((product) => {
      const shop = shopById.get(String(product.shopId));
      return product.status === "Live" && shop?.status === "Approved";
    }) ||
    products[0] ||
    null
  );
}

function emptyForm(products = [], shops = []) {
  const product = selectDefaultProduct(products, shops);
  return {
    id: "",
    productId: product?.id || "",
    shopId: product?.shopId || "",
    placementKey: "homepage_featured_products",
    titleOverride: "",
    subtitleOverride: "",
    imageOverrideUrl: "",
    badgeLabel: "",
    priority: "0",
    startsAt: "",
    endsAt: "",
    active: true,
  };
}

function formFromPlacement(placement) {
  return {
    id: placement?.id || "",
    productId: placement?.productId || placement?.product?.id || "",
    shopId: placement?.shopId || placement?.product?.shopId || "",
    placementKey: placement?.placementKey || "homepage_featured_products",
    titleOverride: placement?.titleOverride || "",
    subtitleOverride: placement?.subtitleOverride || "",
    imageOverrideUrl: placement?.imageOverrideUrl || "",
    badgeLabel: placement?.badgeLabel || "",
    priority: String(placement?.priority ?? 0),
    startsAt: toDateTimeInput(placement?.startsAt),
    endsAt: toDateTimeInput(placement?.endsAt),
    active: Boolean(placement?.active),
  };
}

function productLabel(product, shop) {
  const parts = [product?.name || product?.id || "Product"];
  if (shop?.name) parts.push(shop.name);
  if (product?.status) parts.push(product.status);
  return parts.join(" · ");
}

function badgeTone(active, eligible) {
  if (!eligible) return "warning";
  return active ? "success" : "muted";
}

function humanizeBadge(product) {
  const release = String(product?.releaseType || "").trim();
  if (release) return release;
  const category = String(product?.category || "").trim();
  if (!category) return "";
  if (category === "gift_box" || category === "bundle") return "Gift Set";
  if (category === "cake" || category === "dessert") return "Treat";
  if (category === "perfume") return "Perfume";
  return category.replace(/_/g, " ");
}

function Badge({ tone = "muted", children }) {
  return <span className={`merch-badge merch-badge--${tone}`}>{children}</span>;
}

export function AdminFeaturedProducts({ adminData }) {
  const qc = useQueryClient();
  const [editor, setEditor] = useState(() => emptyForm([], []));
  const [mode, setMode] = useState("create");
  const [feedback, setFeedback] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const placementsQuery = useQuery({
    queryKey: ["admin-featured-products"],
    queryFn: () => adminMerchandisingApi.listFeaturedProducts(),
  });

  const placements = Array.isArray(placementsQuery.data) ? placementsQuery.data : [];
  const products = Array.isArray(adminData?.products) ? adminData.products : [];
  const shops = Array.isArray(adminData?.shops) ? adminData.shops : [];
  const shopById = useMemo(() => new Map(shops.map((shop) => [String(shop.id), shop])), [shops]);
  const productById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return [...products].filter((product) => {
      if (!q) return true;
      const shop = shopById.get(String(product.shopId));
      return [
        product.id,
        product.name,
        product.category,
        product.family,
        product.collection,
        product.status,
        shop?.name,
        shop?.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [products, productSearch, shopById]);

  const selectedProduct = productById.get(String(editor.productId)) || null;
  const selectedShop = shopById.get(String(editor.shopId)) || null;
  const previewTitle = editor.titleOverride || selectedProduct?.name || "Featured product";
  const previewSubtitle = editor.subtitleOverride || selectedProduct?.family || selectedProduct?.collection || selectedProduct?.description || "Public product spotlight";
  const previewImage = editor.imageOverrideUrl || selectedProduct?.imagePath || "";
  const previewBadge = editor.badgeLabel || humanizeBadge(selectedProduct) || "Featured";
  const productEligible = selectedProduct?.status === "Live" && selectedShop?.status === "Approved";

  const createMutation = useMutation({
    mutationFn: (payload) => adminMerchandisingApi.createFeaturedProduct(payload),
    onSuccess: async (data) => {
      setFeedback("Featured product placement created.");
      setMode("edit");
      setEditor(formFromPlacement(data));
      await qc.invalidateQueries({ queryKey: ["admin-featured-products"] });
    },
    onError: (error) => setFeedback(error?.message || "Unable to create placement."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => adminMerchandisingApi.updateFeaturedProduct(id, payload),
    onSuccess: async (data) => {
      setFeedback("Featured product placement saved.");
      setMode("edit");
      setEditor(formFromPlacement(data));
      await qc.invalidateQueries({ queryKey: ["admin-featured-products"] });
    },
    onError: (error) => setFeedback(error?.message || "Unable to save placement."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => adminMerchandisingApi.deleteFeaturedProduct(id),
    onSuccess: async () => {
      setFeedback("Featured product placement deactivated.");
      if (editor.id) {
        setEditor((current) => ({ ...current, active: false }));
      }
      await qc.invalidateQueries({ queryKey: ["admin-featured-products"] });
    },
    onError: (error) => setFeedback(error?.message || "Unable to deactivate placement."),
  });

  const metrics = useMemo(() => {
    const active = placements.filter((placement) => placement.active).length;
    const liveProducts = placements.filter((placement) => placement.product?.status === "Live").length;
    const publishedShops = placements.filter((placement) => placement.shop?.status === "Approved").length;
    const scheduled = placements.filter((placement) => placement.startsAt || placement.endsAt).length;
    return { active, liveProducts, publishedShops, scheduled, total: placements.length };
  }, [placements]);

  useEffect(() => {
    if (mode !== "create" || editor.productId || !products.length) return;
    setEditor((current) => {
      if (current.productId) return current;
      const next = emptyForm(products, shops);
      if (!next.productId) return current;
      return next;
    });
  }, [mode, editor.productId, products, shops]);

  function openCreate() {
    setMode("create");
    setFeedback("");
    setProductSearch("");
    setEditor(emptyForm(products, shops));
  }

  function openEdit(placement) {
    setMode("edit");
    setFeedback("");
    setProductSearch("");
    setEditor(formFromPlacement(placement));
  }

  function resetEditor() {
    setMode("create");
    setFeedback("");
    setProductSearch("");
    setEditor(emptyForm(products, shops));
  }

  function updateField(name, value) {
    setFeedback("");
    setEditor((current) => ({ ...(current || emptyForm(products, shops)), [name]: value }));
  }

  function chooseProduct(productId) {
    const product = productById.get(String(productId)) || null;
    setFeedback("");
    setEditor((current) => ({
      ...(current || emptyForm(products, shops)),
      productId: product?.id || "",
      shopId: product?.shopId || "",
    }));
  }

  function submitForm(event) {
    event.preventDefault();
    if (!selectedProduct) {
      setFeedback("Select a product first.");
      return;
    }

    const payload = {
      productId: editor.productId,
      shopId: editor.shopId || selectedProduct.shopId,
      placementKey: editor.placementKey || "homepage_featured_products",
      titleOverride: editor.titleOverride,
      subtitleOverride: editor.subtitleOverride,
      imageOverrideUrl: editor.imageOverrideUrl,
      badgeLabel: editor.badgeLabel,
      priority: Number(editor.priority || 0),
      startsAt: asIsoOrNull(editor.startsAt),
      endsAt: asIsoOrNull(editor.endsAt),
      active: Boolean(editor.active),
    };

    if (mode === "create") {
      createMutation.mutate(payload);
      return;
    }

    updateMutation.mutate({ id: editor.id, payload });
  }

  const loading = placementsQuery.isLoading;
  const error = placementsQuery.error || createMutation.error || updateMutation.error || deleteMutation.error;

  return (
    <section className="merch-page">
      <PageTitle
        kicker="Merchandising"
        title="Featured products"
        description="Admin-controlled product placements for the future Tuti fragrance storefront."
      />

      <section className="metric-grid">
        <MetricCard icon={Package} label="Placements" value={metrics.total} note="Featured product records" />
        <MetricCard icon={CheckCircle2} label="Active" value={metrics.active} note="Visible when live and in range" />
        <MetricCard icon={Store} label="Live products" value={metrics.liveProducts} note="Product visibility eligible" />
        <MetricCard icon={CalendarClock} label="Scheduled" value={metrics.scheduled} note="Has start or end dates" />
      </section>

      <section className="merch-toolbar">
        <div>
          <strong>Placement management</strong>
          <p>Create, edit, and deactivate featured product placements without touching the storefront rail yet.</p>
        </div>
        <div className="merch-toolbar-actions">
          <button className="secondary-action" type="button" onClick={openCreate}>
            <Plus size={16} /> New placement
          </button>
        </div>
      </section>

      {feedback ? <p className="admin-deeplink-note">{feedback}</p> : null}
      {error ? <p className="admin-deeplink-note admin-deeplink-note--error">{error.message || "Something went wrong."}</p> : null}

      <section className="merch-layout">
        <div className="panel merch-list-panel">
          <PanelHeader icon={Eye} title="Featured product placements" action={`${placements.length} record${placements.length === 1 ? "" : "s"}`} />
          {loading ? (
            <div className="app-status">Loading featured products…</div>
          ) : placements.length === 0 ? (
            <EmptyState icon={Sparkles} text="No featured products yet. Create the first placement when a live product is ready." />
          ) : (
            <div className="merch-list">
              {placements.map((placement) => {
                const product = placement.product || null;
                const shop = placement.shop || null;
                const previewTitleText = placement.title || product?.name || "Featured product";
                const previewSubtitleText = placement.subtitle || product?.family || product?.collection || product?.description || "";
                const previewImageText = placement.imageUrl || product?.imagePath || "";
                return (
                  <article className="merch-row" key={placement.id}>
                    <button className="merch-row-main" type="button" onClick={() => openEdit(placement)}>
                      <div className="merch-row-media">
                        {previewImageText ? (
                          <img alt="" src={previewImageText} />
                        ) : (
                          <span className="merch-row-media-fallback"><Store size={18} /></span>
                        )}
                      </div>
                      <div className="merch-row-copy">
                        <strong>{product?.name || product?.id || "Product"}</strong>
                        <span>{productLabel(product, shop)}</span>
                        <div className="merch-row-badges">
                          <Badge tone={placement.active ? "success" : "muted"}>{placement.active ? "Active" : "Inactive"}</Badge>
                          <Badge tone={badgeTone(placement.active, productEligible)}>{productEligible ? "Eligible" : "Needs review"}</Badge>
                          <StatusBadge status={product?.status || "Unknown"} />
                          <StatusBadge status={shop?.status || "Unknown"} />
                          <Badge tone="brand">{placementLabel(placement.placementKey)}</Badge>
                        </div>
                      </div>
                      <div className="merch-row-preview">
                        <strong>{previewTitleText}</strong>
                        <span>{previewSubtitleText || "No subtitle override"}</span>
                        <small>
                          Priority {placement.priority} · {placement.badgeLabel || humanizeBadge(product) || "No badge"}
                          <br />
                          {formatDateTime(placement.startsAt) !== "—" ? `Starts ${formatDateTime(placement.startsAt)}` : "Always on"}
                          {placement.endsAt ? ` · Ends ${formatDateTime(placement.endsAt)}` : ""}
                        </small>
                      </div>
                    </button>
                    <div className="merch-row-actions">
                      <button className="ghost-action compact" type="button" onClick={() => openEdit(placement)}>
                        Edit
                      </button>
                      <button
                        className="secondary-action compact"
                        type="button"
                        onClick={() => deleteMutation.mutate(placement.id)}
                      >
                        {placement.active ? "Deactivate" : "Delete"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <form className="panel merch-form-panel" onSubmit={submitForm}>
          <PanelHeader icon={Plus} title={mode === "create" ? "New placement" : "Edit placement"} action={mode === "create" ? "Create" : "Update"} />

          {!products.length ? (
            <EmptyState icon={AlertTriangle} text="No products found yet. Create a product first, then return here to feature it." />
          ) : (
            <>
              <div className="merch-form-grid">
                <label className="merch-form-grid--full">
                  <span>Search products</span>
                  <input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Search by product, shop, or status"
                  />
                </label>

                <label className="merch-form-grid--full">
                  <span>Product</span>
                  <select
                    value={editor.productId}
                    onChange={(event) => chooseProduct(event.target.value)}
                    disabled={mode === "edit"}
                  >
                    <option value="">Select a product</option>
                    {filteredProducts.map((product) => {
                      const shop = shopById.get(String(product.shopId)) || null;
                      return (
                        <option key={product.id} value={product.id}>
                          {productLabel(product, shop)}
                        </option>
                      );
                    })}
                  </select>
                </label>

                <label>
                  <span>Placement key</span>
                  <select value={editor.placementKey} onChange={(event) => updateField("placementKey", event.target.value)}>
                    {PLACEMENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Priority</span>
                  <input
                    type="number"
                    value={editor.priority}
                    onChange={(event) => updateField("priority", event.target.value)}
                    min="0"
                    step="1"
                  />
                </label>

                <label>
                  <span>Starts at</span>
                  <input
                    type="datetime-local"
                    value={editor.startsAt}
                    onChange={(event) => updateField("startsAt", event.target.value)}
                  />
                </label>

                <label>
                  <span>Ends at</span>
                  <input
                    type="datetime-local"
                    value={editor.endsAt}
                    onChange={(event) => updateField("endsAt", event.target.value)}
                  />
                </label>

                <label className="merch-toggle">
                  <span>Active</span>
                  <input
                    type="checkbox"
                    checked={Boolean(editor.active)}
                    onChange={(event) => updateField("active", event.target.checked)}
                  />
                </label>
              </div>

              <div className="merch-form-grid merch-form-grid--wide">
                <label>
                  <span>Title override</span>
                  <input
                    value={editor.titleOverride}
                    onChange={(event) => updateField("titleOverride", event.target.value)}
                    placeholder="Optional title shown on the placement"
                  />
                </label>

                <label>
                  <span>Subtitle override</span>
                  <input
                    value={editor.subtitleOverride}
                    onChange={(event) => updateField("subtitleOverride", event.target.value)}
                    placeholder="Optional supporting line"
                  />
                </label>

                <label>
                  <span>Badge label</span>
                  <input
                    value={editor.badgeLabel}
                    onChange={(event) => updateField("badgeLabel", event.target.value)}
                    placeholder="Featured, New, Gift, etc."
                  />
                </label>

                <label className="merch-form-grid--full">
                  <span>Image override URL</span>
                  <input
                    value={editor.imageOverrideUrl}
                    onChange={(event) => updateField("imageOverrideUrl", event.target.value)}
                    placeholder="https://… or /uploads/…"
                  />
                </label>
              </div>

              <div className="merch-preview-card">
                <div className="merch-preview-media">
                  {previewImage ? <img alt="" src={previewImage} /> : <span><Store size={20} /></span>}
                </div>
                <div className="merch-preview-copy">
                  <strong>{previewTitle}</strong>
                  <span>{previewSubtitle || "No subtitle override"}</span>
                  <small>{previewBadge} · {selectedShop?.name || "Selected product shop"}</small>
                </div>
              </div>

              <div className="merch-meta-stack">
                <div className="merch-meta-row">
                  <strong>Linked product status</strong>
                  <StatusBadge status={selectedProduct?.status || "Unknown"} />
                </div>
                <div className="merch-meta-row">
                  <strong>Linked shop status</strong>
                  <StatusBadge status={selectedShop?.status || "Unknown"} />
                </div>
                <div className="merch-meta-row merch-meta-row--stack">
                  <span>Visibility note</span>
                  <small>
                    {productEligible
                      ? "This placement can become public once it is active and within the date window."
                      : "Public rails will hide this placement until the linked product and shop are eligible."}
                  </small>
                </div>
              </div>

              <div className="merch-form-actions">
                <button className="primary-action" type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  <Save size={16} />
                  {mode === "create" ? "Create placement" : "Save placement"}
                </button>
                <button className="secondary-action" type="button" onClick={resetEditor}>
                  Reset
                </button>
                {mode === "edit" && editor.id ? (
                  <button
                    className="ghost-action"
                    type="button"
                    onClick={() => deleteMutation.mutate(editor.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 size={16} />
                    {editor.active ? "Deactivate placement" : "Delete placement"}
                  </button>
                ) : null}
              </div>
            </>
          )}
        </form>
      </section>
    </section>
  );
}
