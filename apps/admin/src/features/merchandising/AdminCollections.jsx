import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Eye,
  Plus,
  Save,
  Store,
  Trash2,
} from "lucide-react";
import { adminMerchandisingApi } from "@tuti/shared/api/client.js";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { MetricCard } from "@tuti/shared/components/MetricCard.jsx";
import { PageTitle } from "@tuti/shared/components/PageTitle.jsx";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";
import { StatusBadge } from "@tuti/shared/components/StatusBadge.jsx";

const COLLECTION_TYPES = [
  { value: "product", label: "Product" },
  { value: "seller", label: "Seller" },
];

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

function normalizeText(value) {
  return String(value ?? "").trim();
}

function Badge({ tone = "muted", children }) {
  return <span className={`merch-badge merch-badge--${tone}`}>{children}</span>;
}

function collectionStatusTone(active, published) {
  if (!published) return "warning";
  return active ? "success" : "muted";
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

function selectDefaultBrandProfile(brandProfiles = []) {
  return brandProfiles.find((profile) => profile.published) || brandProfiles[0] || null;
}

function createCollectionItem(type, products = [], shops = [], brandProfiles = []) {
  if (type === "seller") {
    const profile = selectDefaultBrandProfile(brandProfiles);
    return {
      type: "seller",
      productId: "",
      shopId: profile?.shopId || "",
      brandProfileId: profile?.id || "",
      titleOverride: "",
      subtitleOverride: "",
      imageOverrideUrl: "",
      badgeLabel: "",
      priority: "0",
    };
  }

  const product = selectDefaultProduct(products, shops);
  return {
    type: "product",
    productId: product?.id || "",
    shopId: product?.shopId || "",
    brandProfileId: "",
    titleOverride: "",
    subtitleOverride: "",
    imageOverrideUrl: "",
    badgeLabel: "",
    priority: "0",
  };
}

function mapCollectionItemToForm(item) {
  return {
    type: item?.type === "seller" ? "seller" : "product",
    productId: item?.productId || item?.product?.id || "",
    shopId: item?.shopId || item?.shop?.id || item?.product?.shopId || item?.seller?.shopId || "",
    brandProfileId: item?.brandProfileId || item?.seller?.id || "",
    titleOverride: item?.titleOverride || "",
    subtitleOverride: item?.subtitleOverride || "",
    imageOverrideUrl: item?.imageOverrideUrl || "",
    badgeLabel: item?.badgeLabel || "",
    priority: String(item?.priority ?? 0),
  };
}

function emptyForm() {
  return {
    id: "",
    slug: "",
    title: "",
    titleAr: "",
    subtitle: "",
    subtitleAr: "",
    description: "",
    descriptionAr: "",
    bannerUrl: "",
    mobileBannerUrl: "",
    placementKey: "",
    theme: "",
    priority: "0",
    startsAt: "",
    endsAt: "",
    active: true,
    published: false,
    items: [],
  };
}

function formFromCollection(collection) {
  return {
    id: collection?.id || "",
    slug: collection?.slug || "",
    title: collection?.title || "",
    titleAr: collection?.titleAr || "",
    subtitle: collection?.subtitle || "",
    subtitleAr: collection?.subtitleAr || "",
    description: collection?.description || "",
    descriptionAr: collection?.descriptionAr || "",
    bannerUrl: collection?.bannerUrl || "",
    mobileBannerUrl: collection?.mobileBannerUrl || "",
    placementKey: collection?.placementKey || "",
    theme: collection?.theme || "",
    priority: String(collection?.priority ?? 0),
    startsAt: toDateTimeInput(collection?.startsAt),
    endsAt: toDateTimeInput(collection?.endsAt),
    active: Boolean(collection?.active),
    published: Boolean(collection?.published),
    items: Array.isArray(collection?.items) ? collection.items.map(mapCollectionItemToForm) : [],
  };
}

function productLabel(product, shop) {
  const parts = [product?.name || product?.id || "Product"];
  if (shop?.name) parts.push(shop.name);
  if (product?.status) parts.push(product.status);
  return parts.join(" · ");
}

function sellerLabel(profile) {
  const parts = [profile?.displayName || profile?.slug || "Seller"];
  if (profile?.shopName) parts.push(profile.shopName);
  parts.push(profile?.published ? "Published" : "Draft");
  return parts.join(" · ");
}

function collectionVisibilityLabel(collection) {
  if (!collection?.published) return "Draft";
  return collection?.active ? "Published" : "Inactive";
}

function collectionItemVisibilityTone(item, product, shop, seller) {
  if (item.type === "seller") {
    return seller?.published ? "success" : "warning";
  }
  return product?.status === "Live" && shop?.status === "Approved" ? "success" : "warning";
}

function collectionItemVisibilityLabel(item, product, shop, seller) {
  if (item.type === "seller") {
    return seller?.published ? "Public-ready" : "Hidden in public";
  }
  return product?.status === "Live" && shop?.status === "Approved" ? "Public-ready" : "Hidden in public";
}

function safeText(value, fallback = "—") {
  const text = normalizeText(value);
  return text || fallback;
}

export function AdminCollections({ adminData }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState("create");
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [editor, setEditor] = useState(() => emptyForm());
  const [feedback, setFeedback] = useState("");

  const collectionsQuery = useQuery({
    queryKey: ["admin-collections"],
    queryFn: () => adminMerchandisingApi.listCollections(),
  });

  const brandProfilesQuery = useQuery({
    queryKey: ["admin-collection-brand-profiles"],
    queryFn: () => adminMerchandisingApi.listBrandProfiles(),
  });

  const collections = Array.isArray(collectionsQuery.data) ? collectionsQuery.data : [];
  const brandProfiles = Array.isArray(brandProfilesQuery.data) ? brandProfilesQuery.data : [];
  const products = Array.isArray(adminData?.products) ? adminData.products : [];
  const shops = Array.isArray(adminData?.shops) ? adminData.shops : [];

  const productById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products]);
  const shopById = useMemo(() => new Map(shops.map((shop) => [String(shop.id), shop])), [shops]);
  const brandProfileById = useMemo(() => new Map(brandProfiles.map((profile) => [String(profile.id), profile])), [brandProfiles]);

  const metrics = useMemo(() => {
    const total = collections.length;
    const active = collections.filter((collection) => collection.active).length;
    const published = collections.filter((collection) => collection.published).length;
    const scheduled = collections.filter((collection) => collection.startsAt || collection.endsAt).length;
    return { total, active, published, scheduled };
  }, [collections]);

  const createMutation = useMutation({
    mutationFn: (payload) => adminMerchandisingApi.createCollection(payload),
    onSuccess: async (data) => {
      setFeedback("Collection created.");
      setMode("edit");
      setSelectedCollectionId(data?.id || "");
      setEditor(formFromCollection(data));
      await qc.invalidateQueries({ queryKey: ["admin-collections"] });
    },
    onError: (error) => setFeedback(error?.message || "Unable to create collection."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => adminMerchandisingApi.updateCollection(id, payload),
    onSuccess: async (data) => {
      setFeedback("Collection saved.");
      setMode("edit");
      setSelectedCollectionId(data?.id || selectedCollectionId);
      setEditor(formFromCollection(data));
      await qc.invalidateQueries({ queryKey: ["admin-collections"] });
    },
    onError: (error) => setFeedback(error?.message || "Unable to save collection."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => adminMerchandisingApi.deleteCollection(id),
    onSuccess: async (data) => {
      setFeedback("Collection deactivated.");
      if (data?.id || editor.id) {
        setEditor((current) => ({ ...current, active: false }));
      }
      await qc.invalidateQueries({ queryKey: ["admin-collections"] });
    },
    onError: (error) => setFeedback(error?.message || "Unable to deactivate collection."),
  });

  useEffect(() => {
    if (mode !== "edit") return;
    const detail = collections.find((collection) => String(collection.id) === String(selectedCollectionId)) || null;
    if (!detail) return;
    setEditor((current) => {
      if (current.id && String(current.id) === String(detail.id)) return formFromCollection(detail);
      return formFromCollection(detail);
    });
  }, [collections, mode, selectedCollectionId]);

  function openCreate() {
    setMode("create");
    setSelectedCollectionId("");
    setFeedback("");
    setEditor(emptyForm());
  }

  function openEdit(collection) {
    setMode("edit");
    setSelectedCollectionId(collection?.id || "");
    setFeedback("");
    setEditor(formFromCollection(collection));
  }

  function resetEditor() {
    setMode("create");
    setSelectedCollectionId("");
    setFeedback("");
    setEditor(emptyForm());
  }

  function updateField(name, value) {
    setFeedback("");
    setEditor((current) => ({ ...(current || emptyForm()), [name]: value }));
  }

  function addItem(type) {
    setFeedback("");
    setEditor((current) => ({
      ...(current || emptyForm()),
      items: [...(current?.items || []), createCollectionItem(type, products, shops, brandProfiles)],
    }));
  }

  function updateItem(index, field, value) {
    setFeedback("");
    setEditor((current) => ({
      ...(current || emptyForm()),
      items: (current?.items || []).map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (field === "type") {
          const base = createCollectionItem(value, products, shops, brandProfiles);
          return {
            ...base,
            titleOverride: item.titleOverride || "",
            subtitleOverride: item.subtitleOverride || "",
            imageOverrideUrl: item.imageOverrideUrl || "",
            badgeLabel: item.badgeLabel || "",
            priority: item.priority || "0",
          };
        }
        if (field === "productId") {
          const product = productById.get(String(value)) || null;
          return {
            ...item,
            productId: product?.id || "",
            shopId: product?.shopId || "",
            brandProfileId: "",
          };
        }
        if (field === "brandProfileId") {
          const profile = brandProfileById.get(String(value)) || null;
          return {
            ...item,
            brandProfileId: profile?.id || "",
            shopId: profile?.shopId || "",
            productId: "",
          };
        }
        return { ...item, [field]: value };
      }),
    }));
  }

  function removeItem(index) {
    setFeedback("");
    setEditor((current) => ({
      ...(current || emptyForm()),
      items: (current?.items || []).filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function normalizeItemsForPayload(items = []) {
    return items.map((item) => ({
      type: item.type === "seller" ? "seller" : "product",
      productId: item.productId || "",
      shopId: item.shopId || "",
      brandProfileId: item.brandProfileId || "",
      titleOverride: item.titleOverride || "",
      subtitleOverride: item.subtitleOverride || "",
      imageOverrideUrl: item.imageOverrideUrl || "",
      badgeLabel: item.badgeLabel || "",
      priority: Number(item.priority || 0),
    }));
  }

  function submitForm(event) {
    event.preventDefault();
    if (!normalizeText(editor.title)) {
      setFeedback("Title is required.");
      return;
    }
    if (!normalizeText(editor.placementKey)) {
      setFeedback("Placement key is required.");
      return;
    }

    const normalizedItems = normalizeItemsForPayload(editor.items || []);
    const invalidProductItem = normalizedItems.find((item) => item.type === "product" && (!item.productId || !item.shopId));
    const invalidSellerItem = normalizedItems.find((item) => item.type === "seller" && (!item.brandProfileId || !item.shopId));
    if (invalidProductItem) {
      setFeedback("Select a product and shop for every product item.");
      return;
    }
    if (invalidSellerItem) {
      setFeedback("Select a seller brand profile for every seller item.");
      return;
    }

    const payload = {
      title: editor.title,
      titleAr: editor.titleAr,
      subtitle: editor.subtitle,
      subtitleAr: editor.subtitleAr,
      description: editor.description,
      descriptionAr: editor.descriptionAr,
      bannerUrl: editor.bannerUrl,
      mobileBannerUrl: editor.mobileBannerUrl,
      placementKey: editor.placementKey,
      theme: editor.theme,
      priority: Number(editor.priority || 0),
      startsAt: asIsoOrNull(editor.startsAt),
      endsAt: asIsoOrNull(editor.endsAt),
      active: Boolean(editor.active),
      published: Boolean(editor.published),
      items: normalizedItems,
    };

    if (mode === "create") {
      createMutation.mutate(payload);
      return;
    }

    updateMutation.mutate({ id: editor.id, payload });
  }

  const loading = collectionsQuery.isLoading || brandProfilesQuery.isLoading;
  const error = collectionsQuery.error || brandProfilesQuery.error || createMutation.error || updateMutation.error || deleteMutation.error;

  const previewCollectionItems = useMemo(() => {
    return (editor.items || []).map((item) => {
      const product = productById.get(String(item.productId)) || null;
      const shop = shopById.get(String(item.shopId)) || null;
      const seller = brandProfileById.get(String(item.brandProfileId)) || null;
      const title = item.titleOverride || (item.type === "seller" ? seller?.displayName : product?.name) || "Collection item";
      const subtitle = item.subtitleOverride
        || (item.type === "seller"
          ? seller?.shortTagline
          : product?.family || product?.collection || product?.description)
        || "";
      const imageUrl = item.imageOverrideUrl
        || (item.type === "seller"
          ? seller?.bannerUrl || seller?.logoUrl
          : product?.imagePath)
        || "";
      const badge = item.badgeLabel
        || (item.type === "seller"
          ? (seller?.published ? "Published seller" : "Draft seller")
          : product?.releaseType || "Featured");
      const eligible = item.type === "seller"
        ? Boolean(seller?.published)
        : product?.status === "Live" && shop?.status === "Approved";
      return { item, product, shop, seller, title, subtitle, imageUrl, badge, eligible };
    });
  }, [brandProfileById, editor.items, productById, shopById]);

  const previewBanner = editor.bannerUrl || editor.mobileBannerUrl || previewCollectionItems[0]?.imageUrl || "";
  const previewTitle = editor.title || "Curated collection";
  const previewSubtitle = editor.subtitle || "Editorial perfume edit";
  const previewDescription = editor.description || "A guided edit for the marketplace storefront.";

  return (
    <section className="merch-page">
      <PageTitle
        kicker="Merchandising"
        title="Collections"
        description="Editorial perfume edits that can combine products and sellers into a guided storefront story."
      />

      <section className="metric-grid">
        <MetricCard icon={BookOpen} label="Collections" value={metrics.total} note="Curated editorial records" />
        <MetricCard icon={CheckCircle2} label="Active" value={metrics.active} note="Visible when published and in range" />
        <MetricCard icon={Eye} label="Published" value={metrics.published} note="Eligible for public pages" />
        <MetricCard icon={CalendarClock} label="Scheduled" value={metrics.scheduled} note="Has start or end dates" />
      </section>

      <section className="merch-toolbar">
        <div>
          <strong>Collection management</strong>
          <p>Create, edit, and deactivate curated collections. Public collection pages will come in the next slice.</p>
        </div>
        <div className="merch-toolbar-actions">
          <button className="secondary-action" type="button" onClick={openCreate}>
            <Plus size={16} /> New collection
          </button>
        </div>
      </section>

      {feedback ? <p className="admin-deeplink-note">{feedback}</p> : null}
      {error ? <p className="admin-deeplink-note admin-deeplink-note--error">{error.message || "Something went wrong."}</p> : null}

      <section className="merch-layout">
        <div className="panel merch-list-panel">
          <PanelHeader
            icon={BookOpen}
            title="Curated collections"
            action={`${collections.length} record${collections.length === 1 ? "" : "s"}`}
          />
          {loading ? (
            <div className="app-status">Loading collections…</div>
          ) : collections.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              text="No collections yet. Create the first editorial edit when you want to group products and sellers together."
            />
          ) : (
            <div className="merch-list">
              {collections.map((collection) => {
                const resolvedItems = Array.isArray(collection.items) ? collection.items : [];
                const publicReady = resolvedItems.filter((item) => {
                  if (item.type === "seller") {
                    return Boolean(item.seller?.published);
                  }
                  return item.product?.status === "Live" && item.shop?.status === "Approved";
                }).length;
                const banner = collection.bannerUrl || collection.mobileBannerUrl || resolvedItems[0]?.imageUrl || "";
                return (
                  <article className="merch-row" key={collection.id}>
                    <button className="merch-row-main" type="button" onClick={() => openEdit(collection)}>
                      <div className="merch-row-media">
                        {banner ? (
                          <img alt="" src={banner} />
                        ) : (
                          <span className="merch-row-media-fallback"><BookOpen size={18} /></span>
                        )}
                      </div>
                      <div className="merch-row-copy">
                        <strong>{collection.title || collection.slug || "Collection"}</strong>
                        <span>{safeText(collection.subtitle, collection.placementKey || "Editorial edit")}</span>
                        <div className="merch-row-badges">
                          <Badge tone={collectionStatusTone(collection.active, collection.published)}>
                            {collectionVisibilityLabel(collection)}
                          </Badge>
                          <Badge tone={collection.active ? "success" : "muted"}>
                            {collection.active ? "Active" : "Inactive"}
                          </Badge>
                          <Badge tone={collection.published ? "success" : "warning"}>
                            {collection.published ? "Published" : "Draft"}
                          </Badge>
                          <Badge tone="brand">{collection.placementKey || "No placement key"}</Badge>
                        </div>
                      </div>
                      <div className="merch-row-preview">
                        <strong>{collection.title || "Curated collection"}</strong>
                        <span>{collection.description || collection.descriptionAr || "No description yet"}</span>
                        <small>
                          Priority {collection.priority} · {resolvedItems.length} items · {publicReady} public-ready
                          <br />
                          {formatDateTime(collection.startsAt) !== "—" ? `Starts ${formatDateTime(collection.startsAt)}` : "Always on"}
                          {collection.endsAt ? ` · Ends ${formatDateTime(collection.endsAt)}` : ""}
                        </small>
                      </div>
                    </button>
                    <div className="merch-row-actions">
                      <button className="ghost-action compact" type="button" onClick={() => openEdit(collection)}>
                        Edit
                      </button>
                      <button
                        className="secondary-action compact"
                        type="button"
                        onClick={() => deleteMutation.mutate(collection.id)}
                      >
                        {collection.active ? "Deactivate" : "Delete"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <form className="panel merch-form-panel" onSubmit={submitForm}>
          <PanelHeader
            icon={Plus}
            title={mode === "create" ? "New collection" : "Edit collection"}
            action={mode === "create" ? "Create" : "Update"}
          />

          <div className="merch-collection-preview">
            <div className="merch-collection-preview-media">
              {previewBanner ? <img alt="" src={previewBanner} /> : <span><BookOpen size={20} /></span>}
            </div>
            <div className="merch-collection-preview-copy">
              <strong>{previewTitle}</strong>
              <span>{previewSubtitle || "No subtitle override"}</span>
              <small>{previewDescription}</small>
              <div className="merch-row-badges">
                <Badge tone={collectionStatusTone(editor.active, editor.published)}>
                  {editor.published ? (editor.active ? "Published" : "Inactive") : "Draft"}
                </Badge>
                <Badge tone={editor.active ? "success" : "muted"}>{editor.active ? "Active" : "Inactive"}</Badge>
                <Badge tone={editor.published ? "success" : "warning"}>{editor.published ? "Public" : "Private"}</Badge>
              </div>
            </div>
          </div>

          <div className="merch-form-grid">
            <label className="merch-form-grid--full">
              <span>Title</span>
              <input
                value={editor.title}
                onChange={(event) => updateField("title", event.target.value)}
                placeholder="Eid Gifts"
                required
              />
            </label>

            <label>
              <span>Title Arabic</span>
              <input
                value={editor.titleAr}
                onChange={(event) => updateField("titleAr", event.target.value)}
                placeholder="هدايا العيد"
              />
            </label>

            <label>
              <span>Subtitle</span>
              <input
                value={editor.subtitle}
                onChange={(event) => updateField("subtitle", event.target.value)}
                placeholder="A festive perfume edit"
              />
            </label>

            <label>
              <span>Subtitle Arabic</span>
              <input
                value={editor.subtitleAr}
                onChange={(event) => updateField("subtitleAr", event.target.value)}
                placeholder="تشكيلة عطور موسمية"
              />
            </label>

            <label>
              <span>Placement key</span>
              <input
                value={editor.placementKey}
                onChange={(event) => updateField("placementKey", event.target.value)}
                placeholder="eid_gifts"
              />
            </label>

            <label>
              <span>Theme</span>
              <input
                value={editor.theme}
                onChange={(event) => updateField("theme", event.target.value)}
                placeholder="Luxury, gifting, daily wear..."
              />
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

            <label className="merch-toggle">
              <span>Published</span>
              <input
                type="checkbox"
                checked={Boolean(editor.published)}
                onChange={(event) => updateField("published", event.target.checked)}
              />
            </label>

            <label className="merch-form-grid--full">
              <span>Banner URL</span>
              <input
                value={editor.bannerUrl}
                onChange={(event) => updateField("bannerUrl", event.target.value)}
                placeholder="https://… or /uploads/…"
              />
            </label>

            <label className="merch-form-grid--full">
              <span>Mobile banner URL</span>
              <input
                value={editor.mobileBannerUrl}
                onChange={(event) => updateField("mobileBannerUrl", event.target.value)}
                placeholder="Optional mobile-friendly banner"
              />
            </label>

            <label className="merch-form-grid--full">
              <span>Description</span>
              <textarea
                value={editor.description}
                onChange={(event) => updateField("description", event.target.value)}
                rows={3}
                placeholder="What this collection is about"
              />
            </label>

            <label className="merch-form-grid--full">
              <span>Description Arabic</span>
              <textarea
                value={editor.descriptionAr}
                onChange={(event) => updateField("descriptionAr", event.target.value)}
                rows={3}
                placeholder="وصف المجموعة بالعربية"
              />
            </label>
          </div>

          <div className="merch-collection-items">
            <PanelHeader
              icon={Store}
              title="Collection items"
              action={`${(editor.items || []).length} item${(editor.items || []).length === 1 ? "" : "s"}`}
            />

            <div className="merch-collection-items-actions">
              <button type="button" className="secondary-action compact" onClick={() => addItem("product")}>
                <Plus size={15} /> Add product item
              </button>
              <button type="button" className="secondary-action compact" onClick={() => addItem("seller")}>
                <Plus size={15} /> Add seller item
              </button>
            </div>

            {!(editor.items || []).length ? (
              <EmptyState icon={AlertTriangle} text="Add at least one product or seller item to build the collection." />
            ) : (
              <div className="merch-collection-item-list">
                {(editor.items || []).map((item, index) => {
                  const product = productById.get(String(item.productId)) || null;
                  const shop = shopById.get(String(item.shopId)) || null;
                  const seller = brandProfileById.get(String(item.brandProfileId)) || null;
                  const resolvedTitle = item.titleOverride || (item.type === "seller" ? seller?.displayName : product?.name) || "Collection item";
                  const resolvedSubtitle = item.subtitleOverride
                    || (item.type === "seller"
                      ? seller?.shortTagline
                      : product?.family || product?.collection || product?.description)
                    || "";
                  const resolvedImage = item.imageOverrideUrl
                    || (item.type === "seller" ? seller?.bannerUrl || seller?.logoUrl : product?.imagePath)
                    || "";
                  const resolvedBadge = item.badgeLabel
                    || (item.type === "seller"
                      ? (seller?.published ? "Published seller" : "Draft seller")
                      : product?.releaseType || "Featured");
                  const eligible = collectionItemVisibilityTone(item, product, shop, seller);
                  const visibilityLabel = collectionItemVisibilityLabel(item, product, shop, seller);
                  return (
                    <article className="merch-collection-item" key={`${index}-${item.type}-${item.productId || item.brandProfileId || "empty"}`}>
                      <div className="merch-collection-item-head">
                        <div>
                          <strong>Item {index + 1}</strong>
                          <p>{item.type === "seller" ? "Seller item" : "Product item"}</p>
                        </div>
                        <div className="merch-row-badges">
                          <Badge tone={eligible}>{visibilityLabel}</Badge>
                          <button
                            type="button"
                            className="ghost-action compact"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 size={15} />
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="merch-collection-item-grid">
                        <label>
                          <span>Item type</span>
                          <select
                            value={item.type}
                            onChange={(event) => updateItem(index, "type", event.target.value)}
                          >
                            {COLLECTION_TYPES.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span>Priority</span>
                          <input
                            type="number"
                            value={item.priority}
                            onChange={(event) => updateItem(index, "priority", event.target.value)}
                            min="0"
                            step="1"
                          />
                        </label>

                        {item.type === "product" ? (
                          <label className="merch-collection-item-grid--full">
                            <span>Product</span>
                            <select
                              value={item.productId}
                              onChange={(event) => updateItem(index, "productId", event.target.value)}
                            >
                              <option value="">Select a product</option>
                              {products.map((product) => {
                                const shop = shopById.get(String(product.shopId)) || null;
                                return (
                                  <option key={product.id} value={product.id}>
                                    {productLabel(product, shop)}
                                  </option>
                                );
                              })}
                            </select>
                          </label>
                        ) : (
                          <label className="merch-collection-item-grid--full">
                            <span>Seller brand profile</span>
                            <select
                              value={item.brandProfileId}
                              onChange={(event) => updateItem(index, "brandProfileId", event.target.value)}
                            >
                              <option value="">Select a brand profile</option>
                              {brandProfiles.map((profile) => (
                                <option key={profile.id} value={profile.id}>
                                  {sellerLabel(profile)}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}

                        <label>
                          <span>Title override</span>
                          <input
                            value={item.titleOverride}
                            onChange={(event) => updateItem(index, "titleOverride", event.target.value)}
                            placeholder="Optional title"
                          />
                        </label>

                        <label>
                          <span>Subtitle override</span>
                          <input
                            value={item.subtitleOverride}
                            onChange={(event) => updateItem(index, "subtitleOverride", event.target.value)}
                            placeholder="Optional supporting line"
                          />
                        </label>

                        <label className="merch-collection-item-grid--full">
                          <span>Image override URL</span>
                          <input
                            value={item.imageOverrideUrl}
                            onChange={(event) => updateItem(index, "imageOverrideUrl", event.target.value)}
                            placeholder="https://… or /uploads/…"
                          />
                        </label>

                        <label>
                          <span>Badge label</span>
                          <input
                            value={item.badgeLabel}
                            onChange={(event) => updateItem(index, "badgeLabel", event.target.value)}
                            placeholder="New, Gift, Featured..."
                          />
                        </label>

                        <div className="merch-collection-item-preview">
                          <div className="merch-collection-item-preview-media">
                            {resolvedImage ? <img alt="" src={resolvedImage} /> : <span><Store size={18} /></span>}
                          </div>
                          <div className="merch-collection-item-preview-copy">
                            <strong>{resolvedTitle}</strong>
                            <span>{resolvedSubtitle || "No subtitle override"}</span>
                            <small>{resolvedBadge}</small>
                          </div>
                        </div>
                      </div>

                      <div className="merch-meta-stack">
                        <div className="merch-meta-row">
                          <strong>Linked product status</strong>
                          {item.type === "product" ? (
                            <StatusBadge status={product?.status || "Unknown"} />
                          ) : (
                            <StatusBadge status={seller?.published ? "Published" : "Draft"} />
                          )}
                        </div>
                        <div className="merch-meta-row">
                          <strong>Linked shop status</strong>
                          <StatusBadge status={shop?.status || "Unknown"} />
                        </div>
                        <div className="merch-meta-row merch-meta-row--stack">
                          <span>Visibility note</span>
                          <small>
                            {item.type === "seller"
                              ? (seller?.published
                                ? "This seller item can be shown publicly once the collection is active, published, and in range."
                                : "This seller item stays hidden publicly until the brand profile is published.")
                              : (product?.status === "Live" && shop?.status === "Approved"
                                ? "This product item can be shown publicly once the collection is active, published, and in range."
                                : "This product item stays hidden publicly until the product and shop are eligible.")}
                          </small>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="merch-collection-preview-summary">
            <div className="merch-collection-preview-summary-card">
              <strong>Public preview</strong>
              <span>{editor.slug ? `Slug: ${editor.slug}` : "Public page coming next."}</span>
              <small>
                {editor.active && editor.published
                  ? "This collection can become public once its date window is valid."
                  : "Collections stay private until published and within range."}
              </small>
            </div>
          </div>

          <div className="merch-form-actions">
            <button className="primary-action" type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              <Save size={16} />
              {mode === "create" ? "Create collection" : "Save collection"}
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
                {editor.active ? "Deactivate collection" : "Delete collection"}
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </section>
  );
}
