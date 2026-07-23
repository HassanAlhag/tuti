import { useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Image as ImageIcon, Star, Upload, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { sellerMediaApi, uploadApi } from "@tuti/shared/api/client.js";

const MAX_IMAGES = 10;

/**
 * Minimal primary + gallery image picker for the seller product forms.
 * Manages primaryMediaAssetId/galleryMediaAssetIds directly -- upload and
 * "choose from My Media" both resolve to a mediaAssetId, which is all the
 * product create/update API needs (see Task G / applyProductMediaLinks).
 */
export function SellerMediaPicker({ primaryMediaAssetId, galleryMediaAssetIds = [], onChange, resolvedImages = {} }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [tab, setTab] = useState("upload");
  const [uploadNote, setUploadNote] = useState("");
  const [uploading, setUploading] = useState(false);
  // Local object-URL preview shown immediately on file selection, before
  // the upload/optimize round-trip completes -- the seller sees their
  // photo right away rather than staring at a blank tile while Sharp
  // resizes/encodes it server-side.
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState("");

  const totalCount = (primaryMediaAssetId ? 1 : 0) + galleryMediaAssetIds.length;
  const atMax = totalCount >= MAX_IMAGES;

  const libraryQuery = useQuery({
    queryKey: ["seller-media-picker"],
    queryFn: () => sellerMediaApi.list({ limit: 60 }),
    enabled: panelOpen && tab === "library",
  });

  function addAsset(assetId, imageUrl) {
    resolvedImages[assetId] = imageUrl;
    if (!primaryMediaAssetId) {
      onChange(assetId, galleryMediaAssetIds);
    } else if (!galleryMediaAssetIds.includes(assetId) && assetId !== primaryMediaAssetId) {
      onChange(primaryMediaAssetId, [...galleryMediaAssetIds, assetId]);
    }
    setPanelOpen(false);
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const localPreviewUrl = URL.createObjectURL(file);
    setPendingPreviewUrl(localPreviewUrl);
    setUploading(true);
    setUploadNote("Uploading & optimizing…");
    try {
      const result = await uploadApi.uploadImage(file);
      setUploadNote(result.dimensionWarning || "");
      addAsset(result.mediaAssetId, result.url);
    } catch (err) {
      setUploadNote(err.message || "Upload failed.");
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localPreviewUrl);
      setPendingPreviewUrl("");
    }
  }

  function removeAsset(assetId) {
    if (assetId === primaryMediaAssetId) {
      const [nextPrimary, ...rest] = galleryMediaAssetIds;
      onChange(nextPrimary || null, rest);
    } else {
      onChange(primaryMediaAssetId, galleryMediaAssetIds.filter((id) => id !== assetId));
    }
  }

  function makePrimary(assetId) {
    if (assetId === primaryMediaAssetId) return;
    const nextGallery = [primaryMediaAssetId, ...galleryMediaAssetIds.filter((id) => id !== assetId)].filter(Boolean);
    onChange(assetId, nextGallery);
  }

  function moveGalleryItem(assetId, direction) {
    const index = galleryMediaAssetIds.indexOf(assetId);
    const swapWith = index + direction;
    if (index === -1 || swapWith < 0 || swapWith >= galleryMediaAssetIds.length) return;
    const next = [...galleryMediaAssetIds];
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    onChange(primaryMediaAssetId, next);
  }

  function urlFor(assetId) {
    return resolvedImages[assetId] || "";
  }

  return (
    <div className="sd-media-picker">
      <div className="sd-media-picker-grid">
        {primaryMediaAssetId ? (
          <div className="sd-media-picker-tile sd-media-picker-tile--primary">
            <img src={urlFor(primaryMediaAssetId)} alt="Primary" />
            <span className="sd-media-picker-badge"><Star size={11} /> Primary</span>
            <button type="button" className="sd-media-picker-remove" onClick={() => removeAsset(primaryMediaAssetId)} aria-label="Remove primary image">
              <X size={13} />
            </button>
          </div>
        ) : null}

        {galleryMediaAssetIds.map((assetId, index) => (
          <div className="sd-media-picker-tile" key={assetId}>
            <img src={urlFor(assetId)} alt={`Gallery ${index + 1}`} />
            <div className="sd-media-picker-tile-actions">
              <button type="button" onClick={() => makePrimary(assetId)} title="Set as primary" aria-label="Set as primary">
                <Star size={12} />
              </button>
              <button type="button" onClick={() => moveGalleryItem(assetId, -1)} disabled={index === 0} title="Move earlier" aria-label="Move earlier">
                <ArrowLeft size={12} />
              </button>
              <button type="button" onClick={() => moveGalleryItem(assetId, 1)} disabled={index === galleryMediaAssetIds.length - 1} title="Move later" aria-label="Move later">
                <ArrowRight size={12} />
              </button>
            </div>
            <button type="button" className="sd-media-picker-remove" onClick={() => removeAsset(assetId)} aria-label={`Remove image ${index + 1}`}>
              <X size={13} />
            </button>
          </div>
        ))}

        {pendingPreviewUrl ? (
          <div className="sd-media-picker-tile sd-media-picker-tile--pending">
            <img src={pendingPreviewUrl} alt="Uploading preview" />
            <span className="sd-media-picker-pending-badge">Optimizing…</span>
          </div>
        ) : null}

        {!atMax ? (
          <button type="button" className="sd-media-picker-add" onClick={() => setPanelOpen((v) => !v)}>
            <ImageIcon size={18} />
            <span>{primaryMediaAssetId ? "Add image" : "Choose primary image"}</span>
          </button>
        ) : null}
      </div>

      {totalCount === 0 ? <p className="sd-media-picker-hint">A primary image is recommended before submitting for approval.</p> : null}
      {uploadNote ? <p className="sd-media-picker-note">{uploadNote}</p> : null}

      {panelOpen ? (
        <div className="sd-media-picker-panel">
          <div className="sd-media-picker-tabs">
            <button type="button" className={tab === "upload" ? "is-active" : ""} onClick={() => setTab("upload")}>Upload new</button>
            <button type="button" className={tab === "library" ? "is-active" : ""} onClick={() => setTab("library")}>My Media</button>
            <button type="button" className="sd-media-picker-panel-close" onClick={() => setPanelOpen(false)} aria-label="Close"><X size={14} /></button>
          </div>

          {tab === "upload" ? (
            <label className="sd-drop-zone sd-media-picker-dropzone">
              <Upload size={20} />
              <span>{uploading ? "Uploading & optimizing…" : "Click or drag to upload"}</span>
              <small>JPG, PNG, WebP · Max 8 MB</small>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} disabled={uploading} />
            </label>
          ) : (
            <div className="sd-media-picker-library">
              {libraryQuery.isLoading ? (
                <p>Loading…</p>
              ) : !libraryQuery.data?.items?.length ? (
                <p>No media uploaded yet. Use "Upload new" instead.</p>
              ) : (
                libraryQuery.data.items.map((item) => {
                  const disabled = item.id === primaryMediaAssetId || galleryMediaAssetIds.includes(item.id)
                    || item.status !== "active" || item.moderationStatus === "rejected";
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="sd-media-picker-library-item"
                      disabled={disabled}
                      onClick={() => addAsset(item.id, item.urls?.card || item.publicUrl)}
                      title={disabled ? "Already selected or unavailable" : item.originalFilename}
                    >
                      <img src={item.urls?.thumbnail || item.publicUrl} alt="" />
                      {item.status !== "active" || item.moderationStatus === "rejected" ? (
                        <span className="sd-media-picker-library-flag"><AlertTriangle size={11} /></span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
