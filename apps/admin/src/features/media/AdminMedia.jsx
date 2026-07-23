import { useState } from "react";
import { AlertTriangle, CheckCircle2, Image as ImageIcon, Package, Search, ShieldOff, Trash2, X, XCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { MetricCard } from "@tuti/shared/components/MetricCard.jsx";
import { PageTitle } from "@tuti/shared/components/PageTitle.jsx";
import { adminMediaApi } from "@tuti/shared/api/client.js";

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MODERATION_FILTERS = [
  { id: "", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

const OWNER_TYPE_FILTERS = [
  { id: "", label: "All owners" },
  { id: "shop", label: "Shops" },
  { id: "admin", label: "Admin" },
  { id: "driver", label: "Drivers" },
];

function AdminMediaDetail({ item, onClose }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const { data: detail } = useQuery({
    queryKey: ["admin-media-detail", item.id],
    queryFn: () => adminMediaApi.get(item.id),
  });

  const moderateMutation = useMutation({
    mutationFn: (action) => adminMediaApi.moderate(item.id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-media"] });
      queryClient.invalidateQueries({ queryKey: ["admin-media-detail", item.id] });
    },
    onError: (err) => setNote(err.message || "Could not update moderation state."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminMediaApi.remove(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-media"] });
      onClose();
    },
    onError: (err) => setNote(err.message || "Could not delete."),
  });

  const view = detail || item;
  const canDelete = (view.referenceCount || 0) === 0;

  return (
    <div className="admin-media-detail-backdrop" onClick={onClose}>
      <div className="admin-media-detail" onClick={(e) => e.stopPropagation()}>
        <button className="admin-media-detail-close" type="button" onClick={onClose} aria-label="Close"><X size={16} /></button>
        <img className="admin-media-detail-preview" src={view.urls?.detail || view.publicUrl} alt={view.altText || ""} />
        <div className="admin-media-detail-body">
          <p className="admin-media-detail-filename">{view.originalFilename || "Untitled image"}</p>
          <dl className="admin-media-detail-meta">
            <div><dt>Uploader role</dt><dd>{view.uploadedByRole}</dd></div>
            <div><dt>Owner</dt><dd>{view.ownerType}{view.shopId ? ` · ${view.shopId}` : ""}</dd></div>
            <div><dt>Original dimensions</dt><dd>{view.width && view.height ? `${view.width}×${view.height}px` : "Unknown"}</dd></div>
            <div><dt>Thumbnail</dt><dd>{view.variantMeta?.thumbnail ? `${view.variantMeta.thumbnail.width}×${view.variantMeta.thumbnail.height}px · ${formatBytes(view.variantMeta.thumbnail.sizeBytes)}` : "—"}</dd></div>
            <div><dt>Card</dt><dd>{view.variantMeta?.card ? `${view.variantMeta.card.width}×${view.variantMeta.card.height}px · ${formatBytes(view.variantMeta.card.sizeBytes)}` : "—"}</dd></div>
            <div><dt>Detail</dt><dd>{view.variantMeta?.detail ? `${view.variantMeta.detail.width}×${view.variantMeta.detail.height}px · ${formatBytes(view.variantMeta.detail.sizeBytes)}` : "—"}</dd></div>
            <div><dt>Uploaded</dt><dd>{view.createdAt ? new Date(view.createdAt).toLocaleString() : "—"}</dd></div>
            <div><dt>Status</dt><dd>{view.status} / {view.moderationStatus}</dd></div>
          </dl>

          <div className="admin-media-detail-usage">
            <Package size={14} />
            {view.referenceCount
              ? `Used by ${view.referenceCount} product${view.referenceCount === 1 ? "" : "s"}${view.usedByProducts?.length ? `: ${view.usedByProducts.map((p) => p.name).join(", ")}` : ""}`
              : "Not used by any product (safe to delete)."}
          </div>

          {note ? <p className="admin-media-detail-note">{note}</p> : null}

          <div className="admin-media-detail-actions">
            <button className="primary-action compact" type="button" onClick={() => moderateMutation.mutate("approve")} disabled={moderateMutation.isPending}>
              <CheckCircle2 size={13} /> Approve
            </button>
            <button className="secondary-action compact" type="button" onClick={() => moderateMutation.mutate("reject")} disabled={moderateMutation.isPending}>
              <XCircle size={13} /> Reject
            </button>
            <button className="secondary-action compact" type="button" onClick={() => moderateMutation.mutate("quarantine")} disabled={moderateMutation.isPending}>
              <ShieldOff size={13} /> Quarantine
            </button>
            <button
              className="ghost-action compact"
              type="button"
              onClick={() => deleteMutation.mutate()}
              disabled={!canDelete || deleteMutation.isPending}
              title={canDelete ? "Delete" : "Referenced by a product — cannot delete"}
            >
              <Trash2 size={13} /> {canDelete ? "Delete" : "Referenced"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Admin Media ──────────────────────────────────────────────── */
export function AdminMedia() {
  const [query, setQuery] = useState("");
  const [ownerType, setOwnerType] = useState("");
  const [moderationStatus, setModerationStatus] = useState("");
  const [orphanedOnly, setOrphanedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-media", query, ownerType, moderationStatus, orphanedOnly, page],
    queryFn: () => adminMediaApi.list({ q: query, ownerType, moderationStatus, orphanedOnly: orphanedOnly || undefined, page, limit: 30 }),
  });

  const total = data?.total || 0;
  const pages = data?.pages || 1;
  const pendingCount = (data?.items || []).filter((m) => m.moderationStatus === "pending").length;
  const orphanCount = (data?.items || []).filter((m) => !m.referenceCount).length;

  function resetPage(setter) {
    return (value) => { setter(value); setPage(1); };
  }

  return (
    <main className="workspace admin-media-page">
      <PageTitle kicker="Content" title="Media" description="Every image uploaded by every seller, admin, and driver." />

      <section className="admin-media-metrics">
        <MetricCard icon={ImageIcon} label="Total images" value={total} note="All owners" />
        <MetricCard icon={AlertTriangle} label="Pending review" value={pendingCount} note="This page" />
        <MetricCard icon={Package} label="Unreferenced" value={orphanCount} note="This page" />
      </section>

      <div className="panel admin-media-toolbar">
        <label className="admin-media-search">
          <Search size={15} />
          <input value={query} onChange={(e) => resetPage(setQuery)(e.target.value)} placeholder="Search filename…" />
        </label>

        <select value={ownerType} onChange={(e) => resetPage(setOwnerType)(e.target.value)}>
          {OWNER_TYPE_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>

        <select value={moderationStatus} onChange={(e) => resetPage(setModerationStatus)(e.target.value)}>
          {MODERATION_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>

        <label className="admin-media-orphan-toggle">
          <input type="checkbox" checked={orphanedOnly} onChange={(e) => resetPage(setOrphanedOnly)(e.target.checked)} />
          Orphaned only
        </label>
      </div>

      <div className="panel admin-media-panel">
        {isLoading ? (
          <p className="admin-media-loading">Loading…</p>
        ) : !data?.items?.length ? (
          <EmptyState icon={ImageIcon} text="No media matches these filters." />
        ) : (
          <>
            <div className="admin-media-grid">
              {data.items.map((item) => (
                <button key={item.id} type="button" className="admin-media-card" onClick={() => setSelected(item)}>
                  <span className="admin-media-card-thumb-wrap">
                    <img src={item.urls?.thumbnail || item.publicUrl} alt={item.altText || ""} loading="lazy" />
                    {item.moderationStatus === "rejected" || item.status === "quarantined" ? (
                      <span className="admin-media-card-flag"><AlertTriangle size={11} /></span>
                    ) : null}
                    {!item.referenceCount ? <span className="admin-media-card-orphan">Orphan</span> : null}
                  </span>
                  <span className="admin-media-card-name">{item.originalFilename || "Untitled"}</span>
                  <span className="admin-media-card-meta">{item.ownerType}{item.shopId ? ` · ${item.shopId}` : ""}</span>
                  <span className="admin-media-card-meta">{item.moderationStatus}</span>
                </button>
              ))}
            </div>

            {pages > 1 ? (
              <div className="admin-media-pagination">
                <button className="ghost-action compact" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span>Page {page} of {pages}</span>
                <button className="ghost-action compact" type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {selected ? <AdminMediaDetail item={selected} onClose={() => setSelected(null)} /> : null}
    </main>
  );
}
