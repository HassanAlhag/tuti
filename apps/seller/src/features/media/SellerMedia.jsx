import { useState } from "react";
import { AlertTriangle, ImageIcon, Package, Search, Trash2, Upload, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { MetricCard } from "@tuti/shared/components/MetricCard.jsx";
import { sellerMediaApi, uploadApi } from "@tuti/shared/api/client.js";

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MediaDetailPanel({ item, onClose, onSaved }) {
  const queryClient = useQueryClient();
  const [altText, setAltText] = useState(item.altText || "");
  const [caption, setCaption] = useState(item.caption || "");
  const [note, setNote] = useState("");

  const saveMutation = useMutation({
    mutationFn: () => sellerMediaApi.update(item.id, { altText, caption }),
    onSuccess: () => {
      setNote("Saved.");
      queryClient.invalidateQueries({ queryKey: ["seller-media"] });
      onSaved?.();
    },
    onError: (err) => setNote(err.message || "Could not save."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => sellerMediaApi.remove(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-media"] });
      onClose();
    },
    onError: (err) => setNote(err.message || "Could not delete."),
  });

  const canDelete = (item.referenceCount || 0) === 0;

  return (
    <div className="sd-media-detail-backdrop" onClick={onClose}>
      <div className="sd-media-detail" onClick={(e) => e.stopPropagation()}>
        <button className="sd-media-detail-close" type="button" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <img className="sd-media-detail-preview" src={item.urls?.detail || item.publicUrl} alt={item.altText || ""} />
        <div className="sd-media-detail-body">
          <p className="sd-media-detail-filename">{item.originalFilename || "Untitled image"}</p>
          <div className="sd-media-detail-meta">
            <span>{item.width && item.height ? `${item.width}×${item.height}px` : "Dimensions unknown"}</span>
            <span>{formatBytes(item.variantMeta?.card?.sizeBytes)}</span>
            <span>{item.mimeType}</span>
          </div>

          {item.moderationStatus === "rejected" || item.status === "quarantined" ? (
            <div className="sd-media-detail-flag">
              <AlertTriangle size={14} />
              {item.status === "quarantined" ? "This image was quarantined by an admin and cannot be used." : "This image was rejected by an admin and cannot be used."}
            </div>
          ) : null}

          <label className="sd-block-label" htmlFor="media-alt-text">Alt text</label>
          <input id="media-alt-text" value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="Describe the image for accessibility" maxLength={200} />

          <label className="sd-block-label" htmlFor="media-caption">Caption</label>
          <input id="media-caption" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Optional caption" maxLength={400} />

          <div className="sd-media-detail-usage">
            <Package size={14} />
            {item.referenceCount
              ? `Used by ${item.referenceCount} product${item.referenceCount === 1 ? "" : "s"}${item.usedByProducts?.length ? `: ${item.usedByProducts.map((p) => p.name).join(", ")}` : ""}`
              : "Not used by any product yet."}
          </div>

          {note ? <p className="sd-media-detail-note">{note}</p> : null}

          <div className="sd-media-detail-actions">
            <button className="primary-action compact" type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </button>
            <button
              className="ghost-action compact"
              type="button"
              onClick={() => deleteMutation.mutate()}
              disabled={!canDelete || deleteMutation.isPending}
              title={canDelete ? "Delete image" : "Remove this image from all products before deleting"}
            >
              <Trash2 size={13} /> {canDelete ? "Delete" : "Referenced — cannot delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── My Media ─────────────────────────────────────────────────── */
export function SellerMedia() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [uploadNote, setUploadNote] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["seller-media", query, page],
    queryFn: () => sellerMediaApi.list({ q: query, page, limit: 24 }),
  });

  const uploadMutation = useMutation({
    mutationFn: (file) => uploadApi.uploadImage(file),
    onMutate: () => setUploadNote("Uploading & optimizing…"),
    onSuccess: (result) => {
      setUploadNote(result.dimensionWarning ? `Uploaded. ${result.dimensionWarning}` : "Uploaded.");
      queryClient.invalidateQueries({ queryKey: ["seller-media"] });
    },
    onError: (err) => setUploadNote(err.message || "Upload failed."),
  });

  function handleFilePicked(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) uploadMutation.mutate(file);
  }

  const total = data?.total || 0;
  const pages = data?.pages || 1;
  const unreferenced = (data?.items || []).filter((m) => !m.referenceCount).length;

  return (
    <div className="sd-section">
      <div className="sd-section-header">
        <div>
          <h2 className="sd-section-title">My Media</h2>
          <p className="sd-section-sub">Images you've uploaded, ready to reuse across your products.</p>
        </div>
        <label className="primary-action compact sd-media-upload-btn">
          <Upload size={14} /> Upload image
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFilePicked} hidden />
        </label>
      </div>

      {uploadNote ? <p className="sd-media-upload-note">{uploadNote}</p> : null}

      <section className="sd-metric-grid">
        <MetricCard icon={ImageIcon} label="Total images" value={total} note="This shop only" />
        <MetricCard icon={Package} label="Unreferenced" value={unreferenced} note="On this page" />
      </section>

      <div className="sd-panel">
        <div className="sd-toolbar">
          <label className="sd-search">
            <Search size={15} />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search by filename…" />
          </label>
          <span className="sd-toolbar-count">{total} image{total === 1 ? "" : "s"}</span>
        </div>

        {isLoading ? (
          <p className="sd-media-loading">Loading…</p>
        ) : !data?.items?.length ? (
          <EmptyState icon={ImageIcon} text={query ? "No images match your search." : "No images uploaded yet."} />
        ) : (
          <>
            <div className="sd-media-grid">
              {data.items.map((item) => (
                <button key={item.id} type="button" className="sd-media-card" onClick={() => setSelected(item)}>
                  <span className="sd-media-card-thumb-wrap">
                    <img src={item.urls?.thumbnail || item.publicUrl} alt={item.altText || ""} loading="lazy" />
                    {item.status === "quarantined" || item.moderationStatus === "rejected" ? (
                      <span className="sd-media-card-flag"><AlertTriangle size={11} /></span>
                    ) : null}
                  </span>
                  <span className="sd-media-card-name">{item.originalFilename || "Untitled"}</span>
                  <span className="sd-media-card-meta">
                    {item.width && item.height ? `${item.width}×${item.height}` : "—"} · {formatBytes(item.variantMeta?.card?.sizeBytes)}
                  </span>
                  <span className="sd-media-card-usage">{item.referenceCount ? `Used ×${item.referenceCount}` : "Unused"}</span>
                </button>
              ))}
            </div>

            {pages > 1 ? (
              <div className="sd-media-pagination">
                <button className="ghost-action compact" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span>Page {page} of {pages}</span>
                <button className="ghost-action compact" type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Load more</button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {selected ? (
        <MediaDetailPanel
          item={selected}
          onClose={() => setSelected(null)}
          onSaved={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
