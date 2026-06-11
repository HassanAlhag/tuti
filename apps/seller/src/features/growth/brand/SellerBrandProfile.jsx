import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Eye,
  Globe2,
  Save,
  Sparkles,
  Store,
} from "lucide-react";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";
import { sellerBrandProfileApi } from "@tuti/shared/api/client.js";
import { useAuthStore } from "@tuti/shared/store/authStore.js";
import { SellerChecklistPanel, SellerPageHeader } from "../../shared/SellerDashboardPrimitives.jsx";

function splitListText(value) {
  return String(value || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatListText(value) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function parsePolicies(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split(/[:|]/);
      const cleanLabel = String(label || "").trim();
      const cleanValue = rest.join(":").trim();
      if (!cleanLabel && !cleanValue) return null;
      if (!cleanValue) return { label: "", value: cleanLabel };
      return { label: cleanLabel, value: cleanValue };
    })
    .filter(Boolean);
}

function formatPolicies(value) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (!item) return "";
      if (typeof item === "string") return item;
      if (item.label && item.value) return `${item.label}: ${item.value}`;
      return item.value || item.label || "";
    })
    .filter(Boolean)
    .join("\n");
}

function parseSocialLinks(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split(/[:|]/);
      const cleanLabel = String(label || "").trim();
      const cleanUrl = rest.join(":").trim();
      if (!cleanLabel && !cleanUrl) return null;
      if (!cleanUrl) return { label: "", url: cleanLabel };
      return { label: cleanLabel, url: cleanUrl };
    })
    .filter(Boolean);
}

function formatSocialLinks(value) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (!item) return "";
      if (typeof item === "string") return item;
      if (item.label && item.url) return `${item.label}: ${item.url}`;
      return item.url || item.label || "";
    })
    .filter(Boolean)
    .join("\n");
}

function isImageUrl(value) {
  return /^(https?:\/\/|\/uploads\/|data:)/i.test(String(value || ""));
}

function getClientBaseUrl() {
  return import.meta.env?.VITE_CLIENT_URL || "http://localhost:5173";
}

function buildPublicBrandUrl(slug) {
  if (!slug) return "";
  try {
    return new URL(`/sellers/${encodeURIComponent(slug)}`, getClientBaseUrl()).toString();
  } catch {
    return "";
  }
}

function mapProfileToForm(profile) {
  return {
    displayName: profile?.displayName || "",
    displayNameAr: profile?.displayNameAr || "",
    shortTagline: profile?.shortTagline || "",
    shortTaglineAr: profile?.shortTaglineAr || "",
    brandStory: profile?.brandStory || "",
    brandStoryAr: profile?.brandStoryAr || "",
    logoUrl: profile?.logoUrl || "",
    bannerUrl: profile?.bannerUrl || "",
    fragranceIdentityTags: formatListText(profile?.fragranceIdentityTags),
    specialties: formatListText(profile?.specialties),
    trustBadges: formatListText(profile?.trustBadges),
    sellerPoliciesText: formatPolicies(profile?.sellerPolicies),
    socialLinksText: formatSocialLinks(profile?.socialLinks),
    published: Boolean(profile?.published),
  };
}

function buildChecklist(form, score) {
  const tags = splitListText(form?.fragranceIdentityTags);
  const specialties = splitListText(form?.specialties);
  const badges = splitListText(form?.trustBadges);
  const policies = parsePolicies(form?.sellerPoliciesText);
  const links = parseSocialLinks(form?.socialLinksText);
  const hasArabic = Boolean(form?.displayNameAr || form?.shortTaglineAr || form?.brandStoryAr);

  return [
    { label: "Brand name", detail: "Shown first on the public page.", state: form?.displayName ? "Done" : "Missing", status: form?.displayName ? "success" : "warning" },
    { label: "Arabic presentation", detail: "Optional but valuable for bilingual shoppers.", state: hasArabic ? "Done" : "Missing", status: hasArabic ? "success" : "warning" },
    { label: "Short tagline", detail: "A compact summary of the brand.", state: form?.shortTagline ? "Done" : "Missing", status: form?.shortTagline ? "success" : "warning" },
    { label: "Brand story", detail: "Tell the fragrance story in your own voice.", state: form?.brandStory ? "Done" : "Missing", status: form?.brandStory ? "success" : "warning" },
    { label: "Visual identity", detail: "Logo or banner gives the page a finished look.", state: form?.logoUrl || form?.bannerUrl ? "Done" : "Missing", status: form?.logoUrl || form?.bannerUrl ? "success" : "warning" },
    { label: "Fragrance tags", detail: "Used to describe scent style and identity.", state: tags.length ? "Done" : "Missing", status: tags.length ? "success" : "warning" },
    { label: "Specialties", detail: "What makes the shop stand out.", state: specialties.length ? "Done" : "Missing", status: specialties.length ? "success" : "warning" },
    { label: "Trust badges", detail: "Quick proof points for shoppers.", state: badges.length ? "Done" : "Missing", status: badges.length ? "success" : "warning" },
    { label: "Seller policies", detail: "Return, delivery, or gifting notes.", state: policies.length ? "Done" : "Missing", status: policies.length ? "success" : "warning" },
    { label: "Social links", detail: "Optional links for discovery and trust.", state: links.length ? "Done" : "Missing", status: links.length ? "success" : "warning" },
    { label: "Publish switch", detail: "Controls whether the public page can go live later.", state: form?.published ? "On" : "Off", status: form?.published ? "success" : "warning" },
    { label: "Completeness", detail: score ? `${score}% complete` : "Fill out the fields to improve the score.", state: `${score || 0}%`, status: score >= 70 ? "success" : "warning" },
  ];
}

export function SellerBrandProfile({ seller }) {
  const { user } = useAuthStore();
  const shopId = seller?.shop?.id || user?.shopId || "";
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [saveMessage, setSaveMessage] = useState("");

  const profileQuery = useQuery({
    queryKey: ["seller-brand-profile", shopId],
    queryFn: sellerBrandProfileApi.get,
    enabled: Boolean(shopId),
  });

  const previewQuery = useQuery({
    queryKey: ["seller-brand-profile-preview", shopId],
    queryFn: sellerBrandProfileApi.preview,
    enabled: Boolean(shopId),
  });

  useEffect(() => {
    if (profileQuery.data) {
      setForm(mapProfileToForm(profileQuery.data));
    }
  }, [profileQuery.data]);

  const completenessScore = previewQuery.data?.completenessScore ?? profileQuery.data?.completenessScore ?? 0;
  const previewSlug = previewQuery.data?.slug || profileQuery.data?.slug || "";
  const previewUrl = buildPublicBrandUrl(previewSlug);
  const checklistItems = useMemo(() => buildChecklist(form || profileQuery.data || {}, completenessScore), [form, profileQuery.data, completenessScore]);

  const saveMutation = useMutation({
    mutationFn: (payload) => sellerBrandProfileApi.update(payload),
    onSuccess: async (data) => {
      setForm(mapProfileToForm(data));
      setSaveMessage(data.published
        ? "Brand profile saved and published."
        : "Brand profile saved as a private draft.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller-brand-profile", shopId] }),
        queryClient.invalidateQueries({ queryKey: ["seller-brand-profile-preview", shopId] }),
      ]);
    },
    onError: (error) => setSaveMessage(error?.message || "Save failed."),
  });

  const loading = !shopId || (profileQuery.isLoading && !form);
  const error = profileQuery.error || previewQuery.error || saveMutation.error;

  function updateField(name, value) {
    setSaveMessage("");
    setForm((current) => ({ ...(current || mapProfileToForm({})), [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!form) return;
    setSaveMessage("");
    saveMutation.mutate({
      displayName: form.displayName,
      displayNameAr: form.displayNameAr,
      shortTagline: form.shortTagline,
      shortTaglineAr: form.shortTaglineAr,
      brandStory: form.brandStory,
      brandStoryAr: form.brandStoryAr,
      logoUrl: form.logoUrl,
      bannerUrl: form.bannerUrl,
      fragranceIdentityTags: splitListText(form.fragranceIdentityTags),
      specialties: splitListText(form.specialties),
      trustBadges: splitListText(form.trustBadges),
      sellerPolicies: parsePolicies(form.sellerPoliciesText),
      socialLinks: parseSocialLinks(form.socialLinksText),
      published: Boolean(form.published),
    });
  }

  if (!shopId) {
    return (
      <div className="sd-section">
        <EmptyState icon={Store} text="Seller profile is not linked yet." />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="sd-section">
        <EmptyState icon={Sparkles} text="Loading brand profile…" />
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="sd-section">
        <div className="sd-panel sd-brand-state sd-brand-state--error">
          <div className="sd-brand-state-icon">
            <AlertTriangle size={18} />
          </div>
          <strong>Could not load brand profile</strong>
          <p>{error.message || "Something went wrong while loading the seller brand profile."}</p>
        </div>
      </div>
    );
  }

  const publishedLabel = form?.published ? "Published" : "Private draft";
  const publicPageNote = form?.published
    ? (previewUrl ? "Public page is live and ready to view." : "Public page is live.")
    : (previewUrl ? "Private until published. Preview the future public URL below." : "Private until published. Public page URL will appear after save.");

  return (
    <div className="sd-section">
      <SellerPageHeader
        eyebrow="Growth"
        title="Brand"
        subtitle="Shape the public-facing identity for your perfume shop."
        meta={(
          <div className="sd-brand-header-meta">
            <span className={`sd-brand-status ${form?.published ? "sd-brand-status--published" : "sd-brand-status--draft"}`}>
              {publishedLabel}
            </span>
            <span className="sd-brand-score">{Number.isFinite(completenessScore) ? `${completenessScore}% complete` : "0% complete"}</span>
          </div>
        )}
      />

      <div className="sd-brand-editor-grid">
        <form className="sd-panel sd-brand-form" onSubmit={handleSubmit}>
          <PanelHeader
            icon={BadgeCheck}
            title="Brand profile"
            action={<span className="sd-brand-note">Use this to tell shoppers who you are.</span>}
          />

          <div className="sd-form-block">
            <label className="sd-field sd-brand-field wide">
              <span>Display name</span>
              <input
                value={form?.displayName || ""}
                onChange={(event) => updateField("displayName", event.target.value)}
                placeholder="Oud Lane"
              />
            </label>
            <label className="sd-field sd-brand-field wide">
              <span>Display name in Arabic</span>
              <input
                value={form?.displayNameAr || ""}
                onChange={(event) => updateField("displayNameAr", event.target.value)}
                placeholder="درب العود"
              />
            </label>
            <div className="sd-field-grid">
              <label className="sd-field sd-brand-field wide">
                <span>Short tagline</span>
                <input
                  value={form?.shortTagline || ""}
                  onChange={(event) => updateField("shortTagline", event.target.value)}
                  placeholder="Luxury oud and amber"
                />
              </label>
              <label className="sd-field sd-brand-field wide">
                <span>Tagline in Arabic</span>
                <input
                  value={form?.shortTaglineAr || ""}
                  onChange={(event) => updateField("shortTaglineAr", event.target.value)}
                  placeholder="العود والعنبر الفاخر"
                />
              </label>
            </div>
          </div>

          <div className="sd-form-block">
            <label className="sd-field sd-brand-field wide">
              <span>Brand story</span>
              <textarea
                className="sd-brand-textarea"
                value={form?.brandStory || ""}
                onChange={(event) => updateField("brandStory", event.target.value)}
                placeholder="Tell the story behind your fragrance selection, craft, and positioning."
              />
            </label>
            <label className="sd-field sd-brand-field wide">
              <span>Brand story in Arabic</span>
              <textarea
                className="sd-brand-textarea"
                value={form?.brandStoryAr || ""}
                onChange={(event) => updateField("brandStoryAr", event.target.value)}
                placeholder="اكتب قصة علامتك التجارية باللغة العربية."
              />
            </label>
          </div>

          <div className="sd-form-block">
            <label className="sd-field sd-brand-field wide">
              <span>Logo URL or text mark</span>
              <input
                value={form?.logoUrl || ""}
                onChange={(event) => updateField("logoUrl", event.target.value)}
                placeholder="https://... or OL"
              />
            </label>
            <label className="sd-field sd-brand-field wide">
              <span>Banner URL or banner text</span>
              <input
                value={form?.bannerUrl || ""}
                onChange={(event) => updateField("bannerUrl", event.target.value)}
                placeholder="https://... or Luxury oud blends"
              />
            </label>
          </div>

          <div className="sd-form-block">
            <label className="sd-field sd-brand-field wide">
              <span>Fragrance identity tags</span>
              <textarea
                className="sd-brand-textarea"
                value={form?.fragranceIdentityTags || ""}
                onChange={(event) => updateField("fragranceIdentityTags", event.target.value)}
                placeholder="oud, amber, musk, floral, gifting"
              />
              <small className="sd-brand-field-note">Comma-separated scent identity tags.</small>
            </label>
            <label className="sd-field sd-brand-field wide">
              <span>Specialties</span>
              <textarea
                className="sd-brand-textarea"
                value={form?.specialties || ""}
                onChange={(event) => updateField("specialties", event.target.value)}
                placeholder="luxury, gifting, daily wear, niche scents"
              />
              <small className="sd-brand-field-note">What makes the shop stand out to shoppers.</small>
            </label>
            <label className="sd-field sd-brand-field wide">
              <span>Trust badges</span>
              <textarea
                className="sd-brand-textarea"
                value={form?.trustBadges || ""}
                onChange={(event) => updateField("trustBadges", event.target.value)}
                placeholder="Approved seller, High fulfillment, 4.8 rating"
              />
              <small className="sd-brand-field-note">Short credibility cues for the public page.</small>
            </label>
          </div>

          <div className="sd-form-block">
            <label className="sd-field sd-brand-field wide">
              <span>Seller policies</span>
              <textarea
                className="sd-brand-textarea"
                value={form?.sellerPoliciesText || ""}
                onChange={(event) => updateField("sellerPoliciesText", event.target.value)}
                placeholder={"Returns: 7 days\nDelivery: Seller delivery only"}
              />
              <small className="sd-brand-field-note">One policy per line. Use “Label: Value”.</small>
            </label>
            <label className="sd-field sd-brand-field wide">
              <span>Social links</span>
              <textarea
                className="sd-brand-textarea"
                value={form?.socialLinksText || ""}
                onChange={(event) => updateField("socialLinksText", event.target.value)}
                placeholder={"Instagram: https://instagram.com/oudlane\nTikTok: https://tiktok.com/@oudlane"}
              />
              <small className="sd-brand-field-note">One social link per line. Use “Label: URL”.</small>
            </label>
          </div>

          <div className="sd-form-block sd-form-block--last">
            <label className="sd-field sd-field--check sd-brand-toggle-row">
              <input
                type="checkbox"
                checked={Boolean(form?.published)}
                onChange={(event) => updateField("published", event.target.checked)}
              />
              <span>Publish profile</span>
            </label>
            <p className="sd-form-hint">
              {form?.published
                ? "This profile is marked published, but the public brand page will ship in the next slice."
                : "Keep this profile private while you work on it. The public brand page comes next."}
            </p>
          </div>

          <div className="sd-form-footer">
            <button className="primary-action full-width" type="submit" disabled={saveMutation.isPending}>
              <Save size={15} />
              {saveMutation.isPending ? "Saving…" : "Save changes"}
            </button>
            {saveMessage && <p className="sd-upload-note">{saveMessage}</p>}
          </div>
        </form>

        <div className="sd-brand-side">
        <div className="sd-panel sd-brand-preview">
            <PanelHeader
              icon={Eye}
              title="Preview"
              action={<span className="sd-brand-note">{previewUrl ? "Public URL shown below." : "Public URL appears after save."}</span>}
            />

            {previewQuery.isLoading && !previewQuery.data ? (
              <EmptyState icon={Sparkles} text="Loading preview…" />
            ) : previewQuery.error && !previewQuery.data ? (
              <EmptyState icon={AlertTriangle} text={previewQuery.error.message || "Preview unavailable."} />
            ) : previewQuery.data ? (
              <div className="sd-brand-preview-body">
                <div className="sd-brand-preview-hero">
                  <div className="sd-brand-preview-mark">
                    {isImageUrl(previewQuery.data.logoUrl) ? (
                      <img src={previewQuery.data.logoUrl} alt={previewQuery.data.displayName || "Brand logo"} />
                    ) : (
                      <span>{String(previewQuery.data.logoUrl || previewQuery.data.displayName || "TS").slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="sd-brand-preview-copy">
                    <div className="sd-brand-preview-title-row">
                      <strong>{previewQuery.data.displayName || "Brand name"}</strong>
                      <span className={`sd-brand-status ${previewQuery.data.published ? "sd-brand-status--published" : "sd-brand-status--draft"}`}>
                        {previewQuery.data.published ? "Published" : "Private"}
                      </span>
                    </div>
                    {previewQuery.data.displayNameAr && <span className="sd-brand-preview-ar">{previewQuery.data.displayNameAr}</span>}
                    {previewQuery.data.shortTagline && <p>{previewQuery.data.shortTagline}</p>}
                    {previewQuery.data.shortTaglineAr && <p>{previewQuery.data.shortTaglineAr}</p>}
                    {previewQuery.data.brandStory && <span>{previewQuery.data.brandStory}</span>}
                    {previewQuery.data.brandStoryAr && <span>{previewQuery.data.brandStoryAr}</span>}
                  </div>
                </div>

                <div className="sd-brand-preview-card">
                  <div className="sd-brand-preview-row">
                    <span>Slug</span>
                    <strong>{previewSlug || "Pending"}</strong>
                  </div>
                  <div className="sd-brand-preview-row">
                    <span>Public page URL</span>
                    <strong className="sd-brand-preview-url">{previewUrl || "Pending"}</strong>
                  </div>
                  <div className="sd-brand-preview-row">
                    <span>Visibility</span>
                    <strong>{previewQuery.data.published ? "Published" : "Private draft"}</strong>
                  </div>
                  <div className="sd-brand-preview-row">
                    <span>Completeness</span>
                    <strong>{Number.isFinite(completenessScore) ? `${completenessScore}%` : "0%"}</strong>
                  </div>
                </div>

                <div className="sd-brand-preview-card">
                  <span className="sd-brand-preview-label">Identity tags</span>
                  <div className="sd-brand-preview-tags">
                    {(previewQuery.data.fragranceIdentityTags || []).length ? (
                      previewQuery.data.fragranceIdentityTags.map((tag) => (
                        <span className="sd-brand-pill" key={tag}>{tag}</span>
                      ))
                    ) : (
                      <span className="sd-brand-empty">Add scent identity tags to make the page easier to scan.</span>
                    )}
                  </div>
                </div>

                <div className="sd-brand-preview-card">
                  <span className="sd-brand-preview-label">Policies</span>
                  {(previewQuery.data.sellerPolicies || []).length ? (
                    <div className="sd-brand-preview-list">
                      {previewQuery.data.sellerPolicies.map((policy, index) => (
                        <div className="sd-brand-preview-row sd-brand-preview-row--list" key={`${policy.label || policy.value || index}`}>
                          <strong>{policy.label || "Policy"}</strong>
                          <span>{policy.value || ""}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="sd-brand-empty">Add delivery, return, or gifting notes.</span>
                  )}
                </div>

                <div className="sd-brand-preview-card">
                  <span className="sd-brand-preview-label">Social links</span>
                  {(previewQuery.data.socialLinks || []).length ? (
                    <div className="sd-brand-preview-links">
                      {previewQuery.data.socialLinks.map((link, index) => (
                        <a href={link.url || "#"} key={`${link.label || link.url || index}`} target="_blank" rel="noreferrer">
                          <Globe2 size={14} />
                          <span>{link.label || link.url}</span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <span className="sd-brand-empty">Add Instagram, TikTok, or other social links.</span>
                  )}
                </div>

                <div className="sd-brand-preview-footer">
                  <div className="sd-brand-preview-footer-note">
                    <BadgeCheck size={14} />
                    <span>{publicPageNote}</span>
                  </div>
                  {previewUrl ? (
                    form?.published ? (
                      <a className="secondary-action compact" href={previewUrl} target="_blank" rel="noreferrer">
                        View public brand page
                      </a>
                    ) : (
                      <span className="sd-brand-note">Publish your page to make this link public.</span>
                    )
                  ) : null}
                </div>
              </div>
            ) : (
              <EmptyState icon={Eye} text="Preview unavailable." />
            )}
          </div>

          <SellerChecklistPanel
            icon={CheckCircle2}
            title="Completeness checklist"
            items={checklistItems}
          />
        </div>
      </div>
    </div>
  );
}
