import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  BarChart2,
  Cake,
  CalendarClock,
  CheckCircle2,
  ArrowRight,
  ClipboardCheck,
  CreditCard,
  Clock,
  Gift,
  Headphones,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  PackageCheck,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Ticket,
  TrendingUp,
  Truck,
  Upload,
  Users,
  WalletCards,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SellerMediaPicker } from "../media/SellerMediaPicker.jsx";
import { BottleArt } from "@tuti/shared/components/BottleArt.jsx";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { MetricCard } from "@tuti/shared/components/MetricCard.jsx";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";
import { StatusBadge } from "@tuti/shared/components/StatusBadge.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import { computeSellerHealth } from "@tuti/shared/utils/sellerHealth.js";
import { marketplaceApi, ordersApi, sellerDeliveryOffersApi, sellerDriversApi, sellerFinanceApi, supportTicketsApi } from "@tuti/shared/api/client.js";
import { useAuthStore } from "@tuti/shared/store/authStore.js";
import { GENDER_OPTIONS, SCENT_FAMILIES } from "@tuti/shared/constants";
import { getAllowedOrderActions } from "@tuti/shared/workflows";
import {
  SellerChecklistPanel,
  SellerInsightCard,
  SellerPageHeader,
  SellerQueuePanel,
} from "../shared/SellerDashboardPrimitives.jsx";
import {
  DEFAULT_BY_TYPE,
  SHOP_TYPE_META,
  SupportPill,
  SellerSupportTicketDetail,
  driverMatchesBroadcastZone,
  driverStatusTone,
  formatCaseStatusLabel,
  formatDriverStatus,
  formatDriverVehicle,
  formatOfferCountdown,
  formatOfferExpiry,
  formatResolutionLabel,
  formatSellerOrderStatusLabel,
  formatSupportCategory,
  formatSupportDate,
  getShopType,
  getAllowedProductCategories,
  getSellerPrimaryAction,
  getStockHealth,
  isDriverAssignableOrder,
  isSellerDriverActive,
  orderNextAction,
  ownShopOrder,
  productTypeLabel,
  renderOrderItemSummary,
  renderOrderMetadata,
  resolveOrderDeliveryZone,
  SUPPORT_CATEGORY_OPTIONS,
  SUPPORT_PRIORITY_OPTIONS,
  SUPPORT_STATUS_OPTIONS,
  supportOrderLabel,
  supportPriorityTone,
  supportStatusTone,
} from "../shared/sellerDashboardHelpers.jsx";

/* ─── Products ─────────────────────────────────────────────────── */
export function SellerProducts({ productDraft, seller, setProductDraft = () => {}, onProductSubmit, uploadNote, onRefreshSeller, focusedProductId = "", onFocusHandled = () => {} }) {
  const shop     = seller?.shop;
  const products = seller?.products || [];
  const qc       = useQueryClient();

  /* ── Edit state ─────────────────────────────────────────────── */
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm]             = useState(null);
  const [editNote, setEditNote]             = useState("");
  const [editMediaResolved, setEditMediaResolved] = useState({});

  useEffect(() => {
    if (!editingProduct) { setEditForm(null); setEditNote(""); setEditMediaResolved({}); return; }
    const p = editingProduct;
    setEditForm({
      name:                   p.name || "",
      price:                  p.price ?? 0,
      stock:                  p.stock ?? 0,
      description:            p.description || "",
      family:                 p.family || "",
      gender:                 p.gender || "",
      notes:                  Array.isArray(p.notes) ? p.notes.join(", ") : (p.notes || ""),
      size:                   p.size || "",
      category:               p.category || "perfume",
      cakeType:               p.cakeType || "",
      servings:               p.servings || "",
      flavors:                Array.isArray(p.flavors) ? p.flavors.join(", ") : "",
      allergens:              Array.isArray(p.allergens) ? p.allergens.join(", ") : "",
      occasionTags:           Array.isArray(p.occasionTags) ? p.occasionTags.join(", ") : "",
      leadTimeDays:           p.leadTimeDays ?? 0,
      customMessageAvailable: Boolean(p.customMessageAvailable),
      primaryMediaAssetId:    p.primaryMediaAssetId || null,
      galleryMediaAssetIds:   p.galleryMediaAssetIds || [],
    });
    // Seed the picker's URL cache from the already-resolved gallery so
    // thumbnails render immediately without a refetch.
    const resolved = {};
    const urlFor = (image) => image?.card || image?.thumbnail || image?.detail || "";
    if (p.primaryMediaAssetId && p.images?.[0]) resolved[p.primaryMediaAssetId] = urlFor(p.images[0]);
    (p.galleryMediaAssetIds || []).forEach((id, i) => {
      const image = p.images?.[i + 1];
      if (image) resolved[id] = urlFor(image);
    });
    setEditMediaResolved(resolved);
    setEditNote("");
  }, [editingProduct]);

  useEffect(() => {
    if (!focusedProductId) return;
    const found = products.find((product) => product.id === focusedProductId);
    if (!found) {
      onFocusHandled("Product not found or not visible.");
      return;
    }
    onFocusHandled("");
  }, [focusedProductId, products, onFocusHandled]);

  function invalidateSellerData() {
    onRefreshSeller?.();
    qc.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.some((k) => typeof k === "string" && k.includes("seller")) });
  }

  const editMutation = useMutation({
    mutationFn: (payload) => marketplaceApi.updateSellerProduct(editingProduct.id, payload),
    onSuccess: () => {
      setEditingProduct(null);
      invalidateSellerData();
    },
    onError: (err) => setEditNote(err?.message || "Save failed."),
  });

  const stockMutation = useMutation({
    mutationFn: ({ productId, delta }) => marketplaceApi.updateSellerStock(productId, { delta }),
    onSuccess: () => invalidateSellerData(),
  });

  const draftMutation = useMutation({
    mutationFn: ({ productId, status }) => marketplaceApi.updateSellerProduct(productId, { status }),
    onSuccess: () => invalidateSellerData(),
  });

  /* ── Add-form media picker cache (assetId -> resolved url) ────── */
  const [addMediaResolved, setAddMediaResolved] = useState({});

  /* ── Bulk stock adjustment ──────────────────────────────────── */
  const [bulkMode,   setBulkMode]   = useState(false);
  const [bulkDrafts, setBulkDrafts] = useState({});
  const [bulkNote,   setBulkNote]   = useState("");

  const bulkMutation = useMutation({
    mutationFn: (items) => marketplaceApi.updateSellerStockBulk(items),
    onSuccess: (results) => {
      const failed = results.filter((r) => !r.ok);
      if (failed.length) {
        setBulkNote(`${failed.length} product(s) failed to update.`);
      } else {
        setBulkNote("");
        setBulkMode(false);
        setBulkDrafts({});
        invalidateSellerData();
      }
    },
    onError: (err) => setBulkNote(err?.message || "Bulk update failed."),
  });

  function openBulkMode() {
    const initial = {};
    products.forEach((p) => { initial[p.id] = String(p.stock ?? 0); });
    setBulkDrafts(initial);
    setBulkNote("");
    setBulkMode(true);
  }

  function closeBulkMode() {
    setBulkMode(false);
    setBulkDrafts({});
    setBulkNote("");
  }

  function handleBulkSubmit() {
    const items = products
      .filter((p) => String(bulkDrafts[p.id] ?? p.stock) !== String(p.stock))
      .map((p) => ({ productId: p.id, stock: Number(bulkDrafts[p.id]) }));
    if (!items.length) { closeBulkMode(); return; }
    bulkMutation.mutate(items);
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!editForm || !editingProduct) return;
    const split = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);
    const payload = {
      name:                   editForm.name,
      price:                  Number(editForm.price),
      stock:                  Number(editForm.stock),
      description:            editForm.description,
      leadTimeDays:           Number(editForm.leadTimeDays),
      customMessageAvailable: Boolean(editForm.customMessageAvailable),
    };
    const cat = editingProduct.category;
    if (cat === "perfume") {
      payload.family       = editForm.family;
      payload.gender       = editForm.gender;
      payload.notes        = split(editForm.notes);
      payload.size         = editForm.size;
    } else {
      payload.cakeType     = editForm.cakeType;
      payload.servings     = editForm.servings;
      payload.flavors      = split(editForm.flavors);
      payload.allergens    = split(editForm.allergens);
    }
    payload.occasionTags = split(editForm.occasionTags);
    payload.primaryMediaAssetId = editForm.primaryMediaAssetId || null;
    payload.galleryMediaAssetIds = editForm.galleryMediaAssetIds || [];

    // Rejected products always resubmit for approval on save, regardless of which fields changed.
    if (editingProduct.status === "Rejected") {
      payload.status = "Needs approval";
    }

    editMutation.mutate(payload);
  }

  /* ── Derived product categories ─────────────────────────────── */
  const shopType              = getShopType(shop);
  const { label: typeLabel, Icon: ShopIcon } = SHOP_TYPE_META[shopType];
  const categories            = getAllowedProductCategories(shop);
  const allowedCategoryValues = categories.map((c) => c.value);

  const defaultForm = DEFAULT_BY_TYPE[shopType];
  const form        = productDraft ?? defaultForm;
  const setForm     = setProductDraft;

  useEffect(() => {
    if (shop && !allowedCategoryValues.includes(form.category)) {
      setProductDraft(defaultForm);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopType]);

  const addCategory  = form.category;
  const addIsPerfume = addCategory === "perfume";
  const addIsCake    = addCategory === "cake" || addCategory === "dessert";
  const addIsGiftBox = addCategory === "gift_box";

  if (!shop) return <EmptyState icon={Package} text="Loading products…" />;

  const liveCount          = products.filter((p) => p.status === "Live").length;
  const pendingCount       = products.filter((p) => p.status === "Needs approval").length;
  const draftCount         = products.filter((p) => p.status === "Draft").length;
  const rejectedCount      = products.filter((p) => p.status === "Rejected").length;
  const lowStock           = products.filter((p) => p.stock <= 5);
  const outOfStock         = products.filter((p) => p.stock <= 0);

  function handleAddCategoryChange(val) {
    setForm({
      ...DEFAULT_BY_TYPE[shopType],
      name: form.name,
      price: form.price,
      stock: form.stock,
      primaryMediaAssetId: form.primaryMediaAssetId,
      galleryMediaAssetIds: form.galleryMediaAssetIds,
      category: val,
    });
  }

  /* ── Edit-form category helpers ─────────────────────────────── */
  const editCat      = editingProduct?.category || "";
  const editIsPerfume= editCat === "perfume";
  const editIsCake   = editCat === "cake" || editCat === "dessert";
  const editIsGiftBox= editCat === "gift_box";

  /* ── Status-change helpers ──────────────────────────────────── */
  function sensitiveFieldsChanged() {
    if (!editingProduct || !editForm) return false;
    if ((editForm.primaryMediaAssetId || null) !== (editingProduct.primaryMediaAssetId || null)) return true;
    const origGallery = (editingProduct.galleryMediaAssetIds || []).join(",");
    const nextGallery = (editForm.galleryMediaAssetIds || []).join(",");
    if (origGallery !== nextGallery) return true;
    const p = editingProduct;
    const origNotes    = Array.isArray(p.notes)        ? p.notes.join(", ")        : (p.notes || "");
    const origFlavors  = Array.isArray(p.flavors)      ? p.flavors.join(", ")      : "";
    const origAllergens= Array.isArray(p.allergens)    ? p.allergens.join(", ")    : "";
    return (
      editForm.name        !== p.name                    ||
      Number(editForm.price) !== p.price                 ||
      editForm.description !== (p.description || "")     ||
      editForm.family      !== (p.family || "")          ||
      editForm.gender      !== (p.gender || "")          ||
      editForm.size        !== (p.size || "")            ||
      editForm.notes       !== origNotes                 ||
      editForm.cakeType    !== (p.cakeType || "")        ||
      editForm.servings    !== (p.servings || "")        ||
      editForm.flavors     !== origFlavors               ||
      editForm.allergens   !== origAllergens
    );
  }

  const isRejected = editingProduct?.status === "Rejected";

  // For Rejected products a dedicated banner is shown; this generic warning is only for Live→edits.
  const willTriggerApproval = editingProduct &&
    !isRejected &&
    editingProduct.status !== "Draft" &&
    sensitiveFieldsChanged();

  return (
    <div className="sd-section">
      {/* ── Section header ──────────────────────────────────────── */}
      <div className="sd-section-header">
        <div>
          <h2 className="sd-section-title">Products</h2>
          <p className="sd-section-sub">
            {products.length} total &nbsp;·&nbsp; {liveCount} live &nbsp;·&nbsp; {pendingCount} pending
            {lowStock.length > 0 && <span className="sd-sub-warn"> &nbsp;·&nbsp; {lowStock.length} low stock</span>}
          </p>
        </div>
        <div className="sd-section-header-actions">
          {products.length > 0 && !bulkMode && (
            <button className="secondary-action compact" type="button" onClick={openBulkMode}>
              <Package size={14} />
              Adjust stock
            </button>
          )}
          <span className="sd-type-pill sd-type-pill--sm">
            <ShopIcon size={12} />
            {typeLabel}
          </span>
        </div>
      </div>

      {/* ── Bulk stock editor ───────────────────────────────────── */}
      {bulkMode && (
        <div className="sd-bulk-stock">
          <div className="sd-bulk-stock-header">
            <strong>Adjust stock quantities</strong>
            <p>Change the values below and click Save. Only modified rows are sent.</p>
          </div>
          <div className="sd-bulk-stock-table">
            {products.map((product) => {
              const changed = String(bulkDrafts[product.id] ?? product.stock) !== String(product.stock);
              return (
                <div key={product.id} className={`sd-bulk-row${changed ? " changed" : ""}`}>
                  <div className="sd-bulk-row-name">
                    <span className="sd-bulk-row-title">{product.name}</span>
                    <span className="sd-bulk-row-current">current: {product.stock}</span>
                  </div>
                  <input
                    className="sd-bulk-input"
                    type="number"
                    min={0}
                    step={1}
                    aria-label={`New stock for ${product.name}`}
                    value={bulkDrafts[product.id] ?? product.stock}
                    onChange={(e) => setBulkDrafts((d) => ({ ...d, [product.id]: e.target.value }))}
                  />
                </div>
              );
            })}
          </div>
          {bulkNote && <p className="sd-bulk-note" role="alert">{bulkNote}</p>}
          <div className="sd-bulk-actions">
            <button className="ghost-action compact" type="button" onClick={closeBulkMode}>
              Cancel
            </button>
            <button
              className="primary-action compact"
              type="button"
              onClick={handleBulkSubmit}
              disabled={bulkMutation.isPending}
            >
              {bulkMutation.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}

      {/* ── Summary chips ───────────────────────────────────────── */}
      <div className="sd-products-summary">
        <span className="sd-products-chip"><strong>{products.length}</strong> Total</span>
        <span className="sd-products-chip"><strong>{liveCount}</strong> Live</span>
        <span className="sd-products-chip"><strong>{pendingCount}</strong> Needs approval</span>
        <span className="sd-products-chip"><strong>{draftCount}</strong> Draft</span>
        <span className="sd-products-chip"><strong>{rejectedCount}</strong> Rejected</span>
        <span className="sd-products-chip sd-products-chip--warn"><strong>{lowStock.length}</strong> Low stock</span>
        <span className="sd-products-chip sd-products-chip--danger"><strong>{outOfStock.length}</strong> Out of stock</span>
      </div>

      <div className="sd-products-layout">

        {/* ── Left panel: Add new  OR  Edit existing ─────────────── */}
        {editingProduct && editForm ? (
          /* ── EDIT FORM ─────────────────────────────────────────── */
          <form className="sd-panel sd-upload-form" onSubmit={handleEditSubmit}>
            <div className="sd-form-head sd-form-head--edit">
              {isRejected ? <RefreshCw size={16} /> : <Upload size={16} />}
              <strong>{isRejected ? "Fix & resubmit" : "Edit product"}</strong>
              <span className="sd-form-head-note">{editingProduct.name}</span>
              <button
                className="ghost-action compact sd-edit-cancel"
                type="button"
                onClick={() => setEditingProduct(null)}
              >
                Cancel
              </button>
            </div>

            {isRejected && (
              <div className="sd-rejected-notice">
                <AlertTriangle size={13} />
                Admin rejected this product. Update the details and resubmit for approval.
              </div>
            )}
            {willTriggerApproval && (
              <div className="sd-edit-reapproval-notice">
                <AlertTriangle size={13} />
                Saving these changes will move this product back to <strong>Needs approval</strong> for admin review.
              </div>
            )}

            {/* Basic info */}
            <div className="sd-form-block">
              <label className="sd-block-label">Basic info</label>
              <div className="sd-field-grid">
                <label className="sd-field wide">
                  <span>Product name</span>
                  <input
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </label>
                <label className="sd-field wide">
                  <span>Description</span>
                  <input
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Short product description for customers"
                  />
                </label>
                {editIsPerfume && (
                  <>
                    <label className="sd-field">
                      <span>Scent family</span>
                      <select value={editForm.family} onChange={(e) => setEditForm({ ...editForm, family: e.target.value })}>
                        {SCENT_FAMILIES.map((f) => <option key={f}>{f}</option>)}
                      </select>
                    </label>
                    <label className="sd-field">
                      <span>Gender</span>
                      <select value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
                        {GENDER_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </label>
                  </>
                )}
                {(editIsCake || editIsGiftBox) && (
                  <>
                    <label className="sd-field">
                      <span>{editIsGiftBox ? "Gift box type" : "Cake type"}</span>
                      <input value={editForm.cakeType} onChange={(e) => setEditForm({ ...editForm, cakeType: e.target.value })} />
                    </label>
                    {editIsCake && (
                      <label className="sd-field">
                        <span>Servings</span>
                        <input value={editForm.servings} onChange={(e) => setEditForm({ ...editForm, servings: e.target.value })} />
                      </label>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Pricing & stock */}
            <div className="sd-form-block">
              <label className="sd-block-label">Pricing &amp; stock</label>
              <div className="sd-field-grid">
                <label className="sd-field">
                  <span>Price (AED)</span>
                  <input type="number" min="1" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
                </label>
                <label className="sd-field">
                  <span>Stock qty</span>
                  <input type="number" min="0" value={editForm.stock} onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })} />
                </label>
                {editIsPerfume && (
                  <label className="sd-field">
                    <span>Bottle size</span>
                    <input value={editForm.size} onChange={(e) => setEditForm({ ...editForm, size: e.target.value })} placeholder="75ml" />
                  </label>
                )}
                {(editIsCake || editIsGiftBox) && (
                  <label className="sd-field">
                    <span>Lead time (days)</span>
                    <input type="number" min="0" value={editForm.leadTimeDays} onChange={(e) => setEditForm({ ...editForm, leadTimeDays: e.target.value })} />
                  </label>
                )}
              </div>
            </div>

            {/* Category-specific details */}
            <div className="sd-form-block">
              <label className="sd-block-label">Category details</label>
              <div className="sd-field-grid">
                {editIsPerfume && (
                  <label className="sd-field wide">
                    <span>Scent notes</span>
                    <input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="oud, amber, vanilla, musk" />
                  </label>
                )}
                {(editIsCake || editIsGiftBox) && (
                  <>
                    <label className="sd-field wide">
                      <span>{editIsGiftBox ? "Included items" : "Flavours"}</span>
                      <input value={editForm.flavors} onChange={(e) => setEditForm({ ...editForm, flavors: e.target.value })} />
                    </label>
                    {editIsCake && (
                      <label className="sd-field wide">
                        <span>Allergens</span>
                        <input value={editForm.allergens} onChange={(e) => setEditForm({ ...editForm, allergens: e.target.value })} placeholder="dairy, gluten, nuts" />
                      </label>
                    )}
                    <label className="sd-field wide sd-field--check">
                      <input type="checkbox" checked={editForm.customMessageAvailable} onChange={(e) => setEditForm({ ...editForm, customMessageAvailable: e.target.checked })} />
                      <span>Allow custom message / card note</span>
                    </label>
                  </>
                )}
                <label className="sd-field wide">
                  <span>Occasion tags</span>
                  <input value={editForm.occasionTags} onChange={(e) => setEditForm({ ...editForm, occasionTags: e.target.value })} placeholder="birthday, eid, anniversary" />
                </label>
              </div>
            </div>

            {/* Product image */}
            <div className="sd-form-block">
              <label className="sd-block-label">Product images</label>
              <p className="sd-form-hint">Changing images requires re-approval.</p>
              <SellerMediaPicker
                primaryMediaAssetId={editForm.primaryMediaAssetId}
                galleryMediaAssetIds={editForm.galleryMediaAssetIds}
                resolvedImages={editMediaResolved}
                onChange={(primary, gallery) => setEditForm({ ...editForm, primaryMediaAssetId: primary, galleryMediaAssetIds: gallery })}
              />
            </div>

            {/* Visibility */}
            <div className="sd-form-block sd-form-block--last">
              <label className="sd-block-label">Visibility</label>
              <p className="sd-form-hint">
                Current status: <StatusBadge status={editingProduct.status} />
                {editingProduct.status === "Rejected" && (
                  <span> — fix the issues above, then save to resubmit for admin review.</span>
                )}
                {editingProduct.status === "Draft" && (
                  <span> — product is hidden. Save as "Submit for approval" to put it back in the queue.</span>
                )}
              </p>
            </div>

            <div className="sd-form-footer sd-edit-footer">
              {editingProduct.status === "Draft" || editingProduct.status === "Rejected" ? (
                /* Draft / Rejected → submit / resubmit for approval */
                <button
                  className="primary-action full-width"
                  type="submit"
                  disabled={editMutation.isPending}
                >
                  {isRejected ? <RefreshCw size={15} /> : <Upload size={15} />}
                  {editMutation.isPending
                    ? (isRejected ? "Resubmitting…" : "Saving…")
                    : (isRejected ? "Save & resubmit for approval" : "Save & submit for approval")}
                </button>
              ) : (
                <button
                  className="primary-action full-width"
                  type="submit"
                  disabled={editMutation.isPending}
                >
                  <CheckCircle2 size={15} />
                  {editMutation.isPending ? "Saving…" : "Save changes"}
                </button>
              )}
              {editNote && (
                <p className="sd-upload-note">
                  {editNote}
                </p>
              )}
            </div>
          </form>
        ) : (
          /* ── ADD FORM ─────────────────────────────────────────── */
          <form className="sd-panel sd-upload-form" onSubmit={onProductSubmit}>
            <div className="sd-form-head">
              <Upload size={16} />
              <strong>Add new product</strong>
              <span className="sd-form-head-note">Requires admin approval</span>
            </div>

            {categories.length > 1 && (
              <div className="sd-form-block">
                <label className="sd-block-label">Product type</label>
                <div className="sd-cat-tabs">
                  {categories.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      className={form.category === cat.value ? "sd-cat-btn active" : "sd-cat-btn"}
                      onClick={() => handleAddCategoryChange(cat.value)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Basic info */}
            <div className="sd-form-block">
              <label className="sd-block-label">Basic product info</label>
              <div className="sd-field-grid">
                <label className="sd-field wide">
                  <span>Product name</span>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={addIsPerfume ? "e.g. Amber Oud Night" : addIsCake ? "e.g. Rose Velvet Dream" : "e.g. Eid Luxury Gift Box"}
                  />
                </label>
                {addIsPerfume && (
                  <>
                    <label className="sd-field">
                      <span>Scent family</span>
                      <select value={form.family} onChange={(e) => setForm({ ...form, family: e.target.value })}>
                        {SCENT_FAMILIES.map((f) => <option key={f}>{f}</option>)}
                      </select>
                    </label>
                    <label className="sd-field">
                      <span>Gender</span>
                      <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                        {GENDER_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                      </select>
                    </label>
                  </>
                )}
                {(addIsCake || addIsGiftBox) && (
                  <>
                    <label className="sd-field">
                      <span>{addIsGiftBox ? "Gift box type" : "Cake type"}</span>
                      <input
                        value={form.cakeType}
                        onChange={(e) => setForm({ ...form, cakeType: e.target.value })}
                        placeholder={addIsGiftBox ? "Luxury gift box" : addCategory === "dessert" ? "Assorted box" : "Signature cake"}
                      />
                    </label>
                    {addIsCake && (
                      <label className="sd-field">
                        <span>Servings</span>
                        <input value={form.servings} onChange={(e) => setForm({ ...form, servings: e.target.value })} placeholder="8–10 servings" />
                      </label>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Pricing & stock */}
            <div className="sd-form-block">
              <label className="sd-block-label">Pricing &amp; stock</label>
              <div className="sd-field-grid">
                <label className="sd-field">
                  <span>Price (AED)</span>
                  <input type="number" min="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </label>
                <label className="sd-field">
                  <span>Stock qty</span>
                  <input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                </label>
                {addIsPerfume && (
                  <label className="sd-field">
                    <span>Bottle size</span>
                    <input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="75ml" />
                  </label>
                )}
                {(addIsCake || addIsGiftBox) && (
                  <label className="sd-field">
                    <span>Lead time (days)</span>
                    <input type="number" min="0" value={form.leadTimeDays} onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })} />
                  </label>
                )}
              </div>
            </div>

            {/* Category details */}
            <div className="sd-form-block">
              <label className="sd-block-label">Category-specific details</label>
              <div className="sd-field-grid">
                {addIsPerfume && (
                  <label className="sd-field wide">
                    <span>Scent notes</span>
                    <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="oud, amber, vanilla, musk" />
                  </label>
                )}
                {(addIsCake || addIsGiftBox) && (
                  <>
                    <label className="sd-field wide">
                      <span>{addIsGiftBox ? "Included items" : "Flavours"}</span>
                      <input
                        value={form.flavors}
                        onChange={(e) => setForm({ ...form, flavors: e.target.value })}
                        placeholder={addIsGiftBox ? "perfume 50ml, mini cake, card" : "vanilla, chocolate, pistachio"}
                      />
                    </label>
                    {addIsCake && (
                      <label className="sd-field wide">
                        <span>Allergens</span>
                        <input value={form.allergens} onChange={(e) => setForm({ ...form, allergens: e.target.value })} placeholder="dairy, gluten, nuts" />
                      </label>
                    )}
                    <label className="sd-field wide">
                      <span>Occasion tags</span>
                      <input value={form.occasionTags} onChange={(e) => setForm({ ...form, occasionTags: e.target.value })} placeholder="birthday, eid, anniversary, wedding" />
                    </label>
                    <label className="sd-field wide sd-field--check">
                      <input type="checkbox" checked={Boolean(form.customMessageAvailable)} onChange={(e) => setForm({ ...form, customMessageAvailable: e.target.checked })} />
                      <span>Allow custom message / card note</span>
                    </label>
                  </>
                )}
              </div>
            </div>

            {/* Publishing / approval */}
            <div className="sd-form-block">
              <label className="sd-block-label">Publishing / approval</label>
              <p className="sd-form-hint">
                New products are submitted as <strong>Needs approval</strong> before they can go live in the storefront.
              </p>
            </div>

            {/* Image */}
            <div className="sd-form-block sd-form-block--last">
              <label className="sd-block-label">Product images</label>
              <SellerMediaPicker
                primaryMediaAssetId={form.primaryMediaAssetId || null}
                galleryMediaAssetIds={form.galleryMediaAssetIds || []}
                resolvedImages={addMediaResolved}
                onChange={(primary, gallery) => setForm({ ...form, primaryMediaAssetId: primary, galleryMediaAssetIds: gallery })}
              />
            </div>

            <div className="sd-form-footer">
              <button className="primary-action full-width" type="submit">
                <Upload size={15} />
                Submit for approval
              </button>
              {uploadNote && <p className="sd-upload-note">{uploadNote}</p>}
            </div>
          </form>
        )}

        {/* ── Inventory panel ──────────────────────────────────────── */}
        <div className="sd-panel sd-inventory-panel">
          <PanelHeader icon={PackageCheck} title="Your inventory" action={`${products.length} products`} />
          {products.length === 0 ? (
            <EmptyState icon={Package} text="No products yet. Add your first product and submit it for approval to start selling." />
          ) : (
            <div className="sd-inventory">
              {products.map((product) => {
                const isEditing   = editingProduct?.id === product.id;
                const stockHealth = getStockHealth(product.stock);
                const rowClass    = [
                  "sd-inventory-row",
                  isEditing                                           ? " sd-inventory-row--editing"  : "",
                  product.status === "Needs approval"                 ? " sd-inventory-row--pending"  : "",
                  product.status === "Draft"                          ? " sd-inventory-row--draft"    : "",
                  product.status === "Rejected"                       ? " sd-inventory-row--rejected" : "",
                  product.stock <= 3 && product.stock > 0 && product.status === "Live" ? " sd-inventory-row--low" : "",
                ].join("");

                return (
                  <div className={`${rowClass}${focusedProductId === product.id ? " sd-inventory-row--focused" : ""}`} key={product.id}>
                    <BottleArt product={product} compact />

                    <div className="sd-inventory-info">
                      <strong>{product.name}</strong>
                      <span>
                        {productTypeLabel(product)}
                        {product.family   ? ` · ${product.family}` : ""}
                        {product.cakeType && !product.family ? ` · ${product.cakeType}` : ""}
                        {product.size     ? ` · ${product.size}` : ""}
                      </span>
                      <small>{formatCurrency(product.price)}</small>
                    </div>

                    {/* Stock quick controls */}
                    <div className="sd-inventory-meta">
                      <div className="sd-stock-ctrl">
                        <button
                          className="sd-stock-btn"
                          type="button"
                          aria-label="Decrease stock"
                          disabled={product.stock <= 0 || stockMutation.isPending}
                          onClick={() => stockMutation.mutate({ productId: product.id, delta: -1 })}
                        >
                          −
                        </button>
                        <span className={`sd-stock${product.stock <= 5 ? " sd-stock--low" : ""}`}>
                          {product.stock}
                        </span>
                        <button
                          className="sd-stock-btn"
                          type="button"
                          aria-label="Increase stock"
                          disabled={stockMutation.isPending}
                          onClick={() => stockMutation.mutate({ productId: product.id, delta: +1 })}
                        >
                          +
                        </button>
                      </div>
                      <span className={`sd-stock-health sd-stock-health--${stockHealth.tone}`}>
                        {stockHealth.label}
                      </span>
                      <span className="sd-score">{product.orders || 0} orders</span>
                    </div>

                    <StatusBadge status={product.status} />

                    {/* Row actions */}
                    <div className="sd-inventory-actions">
                      <button
                        className={`ghost-action compact sd-edit-btn${isEditing ? " sd-edit-btn--active" : ""}`}
                        type="button"
                        onClick={() => setEditingProduct(isEditing ? null : product)}
                      >
                        {isEditing ? "Cancel" : "Edit"}
                      </button>

                      {/* Status CTA — varies by product status */}
                      {product.status === "Draft" ? (
                        <button
                          className="secondary-action compact sd-submit-btn"
                          type="button"
                          disabled={draftMutation.isPending}
                          onClick={() => draftMutation.mutate({ productId: product.id, status: "Needs approval" })}
                          title="Submit this draft for admin approval"
                        >
                          Submit
                        </button>
                      ) : product.status === "Rejected" ? (
                        <button
                          className="sd-fix-resubmit-btn"
                          type="button"
                          onClick={() => setEditingProduct(isEditing ? null : product)}
                          title="Fix issues and resubmit for approval"
                        >
                          <RefreshCw size={11} />
                          Fix &amp; resubmit
                        </button>
                      ) : (
                        <button
                          className="ghost-action compact sd-draft-btn"
                          type="button"
                          disabled={draftMutation.isPending}
                          onClick={() => draftMutation.mutate({ productId: product.id, status: "Draft" })}
                          title="Hide product (move to draft)"
                        >
                          Draft
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="sd-stock-alert">
              <AlertTriangle size={13} />
              {lowStock.length} product{lowStock.length !== 1 ? "s are" : " is"} low on stock. Refill soon to avoid missed orders.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
