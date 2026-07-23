import { useState } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart2,
  CheckCircle2,
  Package,
  Rocket,
  Sparkles,
  Store,
  Upload,
} from "lucide-react";
import { brand } from "@tuti/shared/brand.js";
import { uploadApi, marketplaceApi } from "@tuti/shared/api/client.js";
import { useAuthStore } from "@tuti/shared/store/authStore.js";
import { getAllowedProductCategories } from "../shared/sellerDashboardHelpers.jsx";

const STEPS = [
  { id: "welcome",  label: "Welcome",  icon: Store },
  { id: "brand",    label: "Brand",    icon: Sparkles },
  { id: "product",  label: "Product",  icon: Package },
  { id: "launch",   label: "Launch",   icon: Rocket },
];

const BRAND_CHECKLIST = [
  { field: "displayName",  label: "Display name (English)" },
  { field: "logoUrl",      label: "Brand logo" },
  { field: "shortTagline", label: "Tagline" },
  { field: "brandStory",   label: "Brand story" },
];

function storageKey(shopId) {
  return `tuti_onboarding_done_${shopId}`;
}

export function isOnboardingDone(shopId) {
  try { return Boolean(localStorage.getItem(storageKey(shopId))); }
  catch { return false; }
}

function markOnboardingDone(shopId) {
  try { localStorage.setItem(storageKey(shopId), "1"); }
  catch { /* ignore */ }
}

function StepIndicator({ steps, current }) {
  const idx = steps.findIndex((s) => s.id === current);
  return (
    <div className="so-steps" aria-label="Onboarding progress">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const done    = i < idx;
        const active  = i === idx;
        return (
          <div key={step.id} className={`so-step${done ? " done" : ""}${active ? " active" : ""}`}>
            <div className="so-step-icon" aria-hidden="true">
              {done ? <CheckCircle2 size={16} /> : <Icon size={16} />}
            </div>
            <span className="so-step-label">{step.label}</span>
            {i < steps.length - 1 && <div className="so-step-line" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}

function WelcomeStep({ shopName, onNext }) {
  return (
    <div className="so-pane">
      <div className="so-hero">
        <div className="so-hero-mark">{brand.mark}</div>
        <h1>Welcome to Seller Central{shopName ? `, ${shopName}` : ""}!</h1>
        <p>Let's get your shop ready for customers in three quick steps.</p>
      </div>

      <div className="so-checklist-preview">
        {[
          { icon: Sparkles,       text: "Set up your brand identity" },
          { icon: Package,        text: "Add your first product" },
          { icon: Rocket,         text: "Submit for review and go live" },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="so-preview-row">
            <Icon size={18} aria-hidden="true" />
            <span>{text}</span>
          </div>
        ))}
      </div>

      <div className="so-actions">
        <button className="primary-action" type="button" onClick={onNext}>
          Get started
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function BrandStep({ brandProfile, onGoToBrand, onNext, onSkip }) {
  const filled = BRAND_CHECKLIST.filter((c) => Boolean(brandProfile?.[c.field]));
  const pct    = Math.round((filled.length / BRAND_CHECKLIST.length) * 100);

  return (
    <div className="so-pane">
      <div className="so-pane-header">
        <Sparkles size={22} aria-hidden="true" />
        <div>
          <h2>Build your brand page</h2>
          <p>A complete brand page builds customer trust and drives repeat purchases.</p>
        </div>
      </div>

      <div className="so-brand-meter">
        <div className="so-brand-meter-track">
          <div className="so-brand-meter-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="so-brand-pct">{pct}% complete</span>
      </div>

      <ul className="so-brand-checklist">
        {BRAND_CHECKLIST.map(({ field, label }) => {
          const done = Boolean(brandProfile?.[field]);
          return (
            <li key={field} className={`so-brand-item${done ? " done" : ""}`}>
              {done ? <CheckCircle2 size={14} aria-hidden="true" /> : <div className="so-dot" aria-hidden="true" />}
              {label}
            </li>
          );
        })}
      </ul>

      <div className="so-actions">
        <button className="secondary-action" type="button" onClick={onGoToBrand}>
          <Sparkles size={15} aria-hidden="true" />
          Open Brand editor
        </button>
        <button className="primary-action" type="button" onClick={onNext}>
          Continue
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
      <button className="ghost-action compact so-skip" type="button" onClick={onSkip}>
        Skip for now
      </button>
    </div>
  );
}

function ProductStep({ shop, onProductCreated, onSkip }) {
  const { user } = useAuthStore();
  const categoryOptions = getAllowedProductCategories(shop);
  const defaultCategory = categoryOptions[0]?.value || "gift_box";
  const [form, setForm] = useState({
    name: "", category: defaultCategory, price: 320, stock: 10, notes: "oud, amber, musk",
    family: "Oud", gender: "Unisex",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key, val) { setForm((f) => ({ ...f, [key]: val })); }

  function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Product name is required."); return; }
    setSaving(true);
    setError("");
    try {
      let imagePath = null;
      if (imageFile) {
        const { url } = await uploadApi.uploadImage(imageFile);
        imagePath = url;
      }
      const payload = {
        ...form,
        price: Number(form.price),
        stock: Number(form.stock),
        shopId: shop?.id || user?.shopId,
        ...(imagePath ? { imagePath } : {}),
      };
      await marketplaceApi.createSellerProduct(payload);
      onProductCreated();
    } catch (err) {
      setError(err.message || "Could not create product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="so-pane">
      <div className="so-pane-header">
        <Package size={22} aria-hidden="true" />
        <div>
          <h2>Add your first product</h2>
          <p>You can add more products and refine details from the Products section later.</p>
        </div>
      </div>

      <form className="so-product-form" onSubmit={handleSubmit}>
        <label className="so-label">
          Product name <span aria-hidden="true">*</span>
          <input
            type="text"
            required
            placeholder="e.g. Midnight Oud EDP 75ml"
            value={form.name}
            onChange={(e) => { set("name", e.target.value); setError(""); }}
          />
        </label>

        <div className="so-row">
          <label className="so-label">
            Category
            <select value={form.category} onChange={(e) => set("category", e.target.value)}>
              {categoryOptions.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="so-label">
            Price (AED)
            <input
              type="number" min={1} step={0.01}
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
            />
          </label>

          <label className="so-label">
            Stock
            <input
              type="number" min={0} step={1}
              value={form.stock}
              onChange={(e) => set("stock", e.target.value)}
            />
          </label>
        </div>

        <label className="so-label so-label-file">
          Product image
          <div className="so-image-upload">
            {imagePreview
              ? <img src={imagePreview} alt="Preview" className="so-image-preview" />
              : <div className="so-image-placeholder"><Upload size={24} aria-hidden="true" /><span>Click to upload</span></div>
            }
            <input type="file" accept="image/*" onChange={onFileChange} className="so-file-input" />
          </div>
        </label>

        {error && <p className="so-error" role="alert">{error}</p>}

        <div className="so-actions">
          <button className="primary-action" type="submit" disabled={saving}>
            {saving ? "Adding product…" : "Add product"}
            {!saving && <ArrowRight size={15} aria-hidden="true" />}
          </button>
        </div>
      </form>
      <button className="ghost-action compact so-skip" type="button" onClick={onSkip}>
        Skip for now
      </button>
    </div>
  );
}

function LaunchStep({ seller, onGoToSection, onFinish }) {
  const productCount = seller?.products?.length || 0;

  return (
    <div className="so-pane">
      <div className="so-hero">
        <div className="so-hero-mark" style={{ background: "var(--brand-light)", color: "var(--brand-dark)" }}>
          <CheckCircle2 size={32} />
        </div>
        <h1>You're set up!</h1>
        <p>
          {productCount > 0
            ? `${productCount} product${productCount === 1 ? "" : "s"} submitted for review. We'll notify you once your shop is approved.`
            : "Your shop profile is ready. Add products whenever you're ready."}
        </p>
      </div>

      <div className="so-launch-cards">
        {[
          { icon: Package,         label: "Manage products",  section: "products"  },
          { icon: Sparkles,        label: "Polish brand page", section: "brand"     },
          { icon: BarChart2,       label: "View analytics",   section: "analytics" },
          { icon: BadgeDollarSign, label: "Track payouts",    section: "payouts"   },
        ].map(({ icon: Icon, label, section }) => (
          <button
            key={section}
            className="so-launch-card"
            type="button"
            onClick={() => { onFinish(); onGoToSection(section); }}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
            <ArrowRight size={14} aria-hidden="true" className="so-launch-arrow" />
          </button>
        ))}
      </div>

      <div className="so-actions">
        <button className="primary-action" type="button" onClick={onFinish}>
          Go to dashboard
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function SellerOnboarding({ seller, brandProfile, onGoToSection, onFinish }) {
  const shopId = seller?.shop?.id;
  const [stepId, setStepId] = useState("welcome");

  function next() {
    const idx = STEPS.findIndex((s) => s.id === stepId);
    if (idx < STEPS.length - 1) setStepId(STEPS[idx + 1].id);
  }

  function goToStep(id) { setStepId(id); }

  function handleGoToBrand() {
    onGoToSection("brand");
  }

  function handleProductCreated() {
    setStepId("launch");
  }

  function handleFinish() {
    markOnboardingDone(shopId);
    onFinish();
  }

  return (
    <section className="so-root" aria-labelledby="so-heading">
      <h1 id="so-heading" className="so-sr-only">Seller onboarding</h1>
      <div className="so-card">
        <StepIndicator steps={STEPS} current={stepId} />
        <div className="so-body">
          {stepId === "welcome"  && (
            <WelcomeStep
              shopName={seller?.shop?.name}
              onNext={next}
            />
          )}
          {stepId === "brand" && (
            <BrandStep
              brandProfile={brandProfile}
              onGoToBrand={handleGoToBrand}
              onNext={next}
              onSkip={next}
            />
          )}
          {stepId === "product" && (
            <ProductStep
              shop={seller?.shop}
              onProductCreated={handleProductCreated}
              onSkip={() => goToStep("launch")}
            />
          )}
          {stepId === "launch" && (
            <LaunchStep
              seller={seller}
              onGoToSection={onGoToSection}
              onFinish={handleFinish}
            />
          )}
        </div>
      </div>
    </section>
  );
}
