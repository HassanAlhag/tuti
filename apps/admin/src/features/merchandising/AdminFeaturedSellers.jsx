import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Eye,
  Globe2,
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

function buildPublicUrl(slug) {
  if (!slug) return "";
  const base = import.meta.env?.VITE_CLIENT_URL || "http://localhost:5173";
  try {
    return new URL(`/sellers/${encodeURIComponent(slug)}`, base).toString();
  } catch {
    return "";
  }
}

function selectDefaultBrandProfile(brandProfiles = []) {
  return brandProfiles.find((profile) => profile.published) || null;
}

function emptyForm(brandProfiles = []) {
  const profile = selectDefaultBrandProfile(brandProfiles);
  return {
    id: "",
    brandProfileId: profile?.id || "",
    shopId: profile?.shopId || "",
    placementKey: "homepage_featured_sellers",
    titleOverride: "",
    subtitleOverride: "",
    imageOverrideUrl: "",
    priority: "0",
    startsAt: "",
    endsAt: "",
    active: true,
  };
}

function formFromPlacement(placement) {
  return {
    id: placement?.id || "",
    brandProfileId: placement?.brandProfileId || placement?.brandProfile?.id || "",
    shopId: placement?.shopId || placement?.brandProfile?.shopId || "",
    placementKey: placement?.placementKey || "homepage_featured_sellers",
    titleOverride: placement?.titleOverride || "",
    subtitleOverride: placement?.subtitleOverride || "",
    imageOverrideUrl: placement?.imageOverrideUrl || "",
    priority: String(placement?.priority ?? 0),
    startsAt: toDateTimeInput(placement?.startsAt),
    endsAt: toDateTimeInput(placement?.endsAt),
    active: Boolean(placement?.active),
  };
}

function asIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function badgeTone(active, published) {
  if (!published) return "warning";
  return active ? "success" : "muted";
}

function Badge({ tone = "muted", children }) {
  return <span className={`merch-badge merch-badge--${tone}`}>{children}</span>;
}

export function AdminFeaturedSellers() {
  const qc = useQueryClient();
  const [editor, setEditor] = useState(() => emptyForm([]));
  const [mode, setMode] = useState("create");
  const [feedback, setFeedback] = useState("");

  const placementsQuery = useQuery({
    queryKey: ["admin-featured-sellers"],
    queryFn: () => adminMerchandisingApi.listFeaturedSellers(),
  });

  const brandProfilesQuery = useQuery({
    queryKey: ["admin-featured-seller-brand-profiles"],
    queryFn: () => adminMerchandisingApi.listBrandProfiles(),
  });

  const placements = Array.isArray(placementsQuery.data) ? placementsQuery.data : [];
  const brandProfiles = Array.isArray(brandProfilesQuery.data) ? brandProfilesQuery.data : [];
  const selectedBrandProfile = brandProfiles.find((profile) => profile.id === editor.brandProfileId) || null;
  const publicUrl = buildPublicUrl(selectedBrandProfile?.slug);
  const previewTitle = editor.titleOverride || selectedBrandProfile?.displayName || "Featured seller";
  const previewSubtitle = editor.subtitleOverride || selectedBrandProfile?.shortTagline || "Public seller spotlight";
  const previewImage = editor.imageOverrideUrl || selectedBrandProfile?.bannerUrl || selectedBrandProfile?.logoUrl || "";
  const editableProfilePublished = selectedBrandProfile ? Boolean(selectedBrandProfile.published) : false;

  const createMutation = useMutation({
    mutationFn: (payload) => adminMerchandisingApi.createFeaturedSeller(payload),
    onSuccess: async (data) => {
      setFeedback("Featured seller placement created.");
      setMode("edit");
      setEditor(formFromPlacement(data));
      await qc.invalidateQueries({ queryKey: ["admin-featured-sellers"] });
    },
    onError: (error) => setFeedback(error?.message || "Unable to create placement."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => adminMerchandisingApi.updateFeaturedSeller(id, payload),
    onSuccess: async (data) => {
      setFeedback("Featured seller placement saved.");
      setMode("edit");
      setEditor(formFromPlacement(data));
      await qc.invalidateQueries({ queryKey: ["admin-featured-sellers"] });
    },
    onError: (error) => setFeedback(error?.message || "Unable to save placement."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => adminMerchandisingApi.deleteFeaturedSeller(id),
    onSuccess: async () => {
      setFeedback("Featured seller placement deactivated.");
      if (editor.id) {
        setEditor((current) => ({ ...current, active: false }));
      }
      await qc.invalidateQueries({ queryKey: ["admin-featured-sellers"] });
    },
    onError: (error) => setFeedback(error?.message || "Unable to deactivate placement."),
  });

  const metrics = useMemo(() => {
    const active = placements.filter((placement) => placement.active).length;
    const publishedLinked = placements.filter((placement) => placement.brandProfile?.published).length;
    const scheduled = placements.filter((placement) => placement.startsAt || placement.endsAt).length;
    return { active, publishedLinked, scheduled, total: placements.length };
  }, [placements]);

  function openCreate() {
    const next = emptyForm(brandProfiles);
    setMode("create");
    setFeedback("");
    setEditor(next);
  }

  function openEdit(placement) {
    setMode("edit");
    setFeedback("");
    setEditor(formFromPlacement(placement));
  }

  function resetEditor() {
    setMode("create");
    setFeedback("");
    setEditor(emptyForm(brandProfiles));
  }

  function updateField(name, value) {
    setFeedback("");
    setEditor((current) => ({ ...(current || emptyForm(brandProfiles)), [name]: value }));
  }

  function submitForm(event) {
    event.preventDefault();
    if (!editor.brandProfileId || !selectedBrandProfile) {
      setFeedback("Select a published seller brand profile first.");
      return;
    }
    if (!selectedBrandProfile.published) {
      setFeedback("The linked brand profile must be published before it can be featured.");
      return;
    }

    const payload = {
      brandProfileId: editor.brandProfileId,
      shopId: editor.shopId || selectedBrandProfile.shopId,
      placementKey: editor.placementKey || "homepage_featured_sellers",
      titleOverride: editor.titleOverride,
      subtitleOverride: editor.subtitleOverride,
      imageOverrideUrl: editor.imageOverrideUrl,
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

  const loading = placementsQuery.isLoading || brandProfilesQuery.isLoading;
  const error = placementsQuery.error || brandProfilesQuery.error || createMutation.error || updateMutation.error || deleteMutation.error;

  useEffect(() => {
    if (mode !== "create" || !brandProfiles.length) return;
    setEditor((current) => {
      const currentProfile = brandProfiles.find((profile) => profile.id === current.brandProfileId) || null;
      if (currentProfile?.published) return current;
      const preferredProfile = selectDefaultBrandProfile(brandProfiles);
      if (!preferredProfile) return current;
      if (current.brandProfileId === preferredProfile.id && current.shopId === preferredProfile.shopId) return current;
      return {
        ...current,
        brandProfileId: preferredProfile.id,
        shopId: preferredProfile.shopId,
      };
    });
  }, [mode, brandProfiles]);

  return (
    <section className="merch-page">
      <PageTitle
        kicker="Merchandising"
        title="Featured sellers"
        description="Admin-controlled seller placements for the future Tuti fragrance storefront."
      />

      <section className="metric-grid">
        <MetricCard icon={Globe2} label="Placements" value={metrics.total} note="Featured seller records" />
        <MetricCard icon={CheckCircle2} label="Active" value={metrics.active} note="Visible when published and in range" />
        <MetricCard icon={Store} label="Published linked profiles" value={metrics.publishedLinked} note="Eligible brand profiles" />
        <MetricCard icon={CalendarClock} label="Scheduled" value={metrics.scheduled} note="Has start or end dates" />
      </section>

      <section className="merch-toolbar">
        <div>
          <strong>Placement management</strong>
          <p>Create, edit, and deactivate featured seller placements without touching the storefront rail yet.</p>
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
          <PanelHeader icon={Eye} title="Featured seller placements" action={`${placements.length} record${placements.length === 1 ? "" : "s"}`} />
          {loading ? (
            <div className="app-status">Loading featured sellers…</div>
          ) : placements.length === 0 ? (
            <EmptyState icon={Sparkles} text="No featured sellers yet. Create the first placement when a seller brand profile is ready." />
          ) : (
            <div className="merch-list">
              {placements.map((placement) => {
                const brandProfile = placement.brandProfile || null;
                const previewTitle = placement.titleOverride || brandProfile?.displayName || "Featured seller";
                const previewSubtitle = placement.subtitleOverride || brandProfile?.shortTagline || "";
                const previewImage = placement.imageOverrideUrl || brandProfile?.bannerUrl || brandProfile?.logoUrl || "";
                return (
                  <article className="merch-row" key={placement.id}>
                    <button className="merch-row-main" type="button" onClick={() => openEdit(placement)}>
                      <div className="merch-row-media">
                        {previewImage ? (
                          <img alt="" src={previewImage} />
                        ) : (
                          <span className="merch-row-media-fallback"><Store size={18} /></span>
                        )}
                      </div>
                      <div className="merch-row-copy">
                        <strong>{brandProfile?.displayName || brandProfile?.shopName || "Seller brand"}</strong>
                        <span>{brandProfile?.shopName || brandProfile?.slug || "Linked profile"}</span>
                        <div className="merch-row-badges">
                          <Badge tone={badgeTone(placement.active, brandProfile?.published)}>{brandProfile?.published ? "Published" : "Draft"}</Badge>
                          <Badge tone={placement.active ? "success" : "muted"}>{placement.active ? "Active" : "Inactive"}</Badge>
                          <Badge tone="brand">{placement.placementKey}</Badge>
                        </div>
                      </div>
                      <div className="merch-row-preview">
                        <strong>{previewTitle}</strong>
                        <span>{previewSubtitle || "No subtitle override"}</span>
                        <small>Priority {placement.priority} · {formatDateTime(placement.startsAt) !== "—" ? `Starts ${formatDateTime(placement.startsAt)}` : "Always on"}{placement.endsAt ? ` · Ends ${formatDateTime(placement.endsAt)}` : ""}</small>
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

          {!brandProfiles.length ? (
            <EmptyState icon={AlertTriangle} text="No brand profiles found yet. Publish a seller brand profile first, then return here to create a featured placement." />
          ) : (
            <>
              <div className="merch-form-grid">
                <label>
                  <span>Seller brand profile</span>
                  <select
                    value={editor.brandProfileId}
                    onChange={(event) => {
                      const profile = brandProfiles.find((item) => item.id === event.target.value) || null;
                      setFeedback("");
                      setEditor((current) => ({
                        ...(current || emptyForm(brandProfiles)),
                        brandProfileId: profile?.id || "",
                        shopId: profile?.shopId || "",
                      }));
                    }}
                    disabled={mode === "edit"}
                  >
                    <option value="">Select a brand profile</option>
                    {brandProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id} disabled={!profile.published}>
                        {profile.displayName || profile.shopName || profile.slug} {profile.published ? "" : "(draft)"}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Placement key</span>
                  <input
                    value={editor.placementKey}
                    onChange={(event) => updateField("placementKey", event.target.value)}
                    placeholder="homepage_featured_sellers"
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
                  <small>{selectedBrandProfile?.displayNameAr || selectedBrandProfile?.shortTaglineAr || "Public preview will appear here."}</small>
                </div>
              </div>

              <div className="merch-meta-stack">
                <div className="merch-meta-row">
                  <strong>Linked profile status</strong>
                  <Badge tone={editableProfilePublished ? "success" : "warning"}>{editableProfilePublished ? "Published" : "Draft"}</Badge>
                </div>
                <div className="merch-meta-row merch-meta-row--stack">
                  <span>Public URL</span>
                  {publicUrl ? (
                    <a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a>
                  ) : (
                    <span>Public URL will appear once a brand profile is selected.</span>
                  )}
                </div>
                <div className="merch-meta-row merch-meta-row--stack">
                  <span>Visibility note</span>
                  <small>
                    {editableProfilePublished
                      ? "This placement can become public once it is active and within the date window."
                      : "This placement stays private until the linked brand profile is published."}
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
