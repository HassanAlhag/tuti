import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  Cake,
  CheckCircle2,
  FileText,
  Gift,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  UserCheck,
  Users,
  WalletCards,
} from "lucide-react";
import { sellerApplicationsApi } from "@tuti/shared/api/client.js";

// ── Rep code helpers ─────────────────────────────────────────────────
function storeRepCode(code) {
  const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
  try { localStorage.setItem("tuti_rep_code", JSON.stringify({ code, expiry })); } catch {}
}

function getStoredRepCode() {
  try {
    const raw = localStorage.getItem("tuti_rep_code");
    if (!raw) return null;
    const { code, expiry } = JSON.parse(raw);
    if (Date.now() > expiry) { localStorage.removeItem("tuti_rep_code"); return null; }
    return code;
  } catch { return null; }
}

function getSellerAppUrl() {
  return import.meta.env.VITE_SELLER_URL || "http://localhost:5174";
}

// ── Static content ───────────────────────────────────────────────────
const SELLER_TYPES = [
  { icon: Sparkles, title: "Perfume shops",    text: "Oud, musk, floral, fresh, amber, minis, and perfume gift sets." },
  { icon: Cake,     title: "Cake shops",        text: "Signature cakes, custom celebration cakes, cupcakes, and cheesecakes." },
  { icon: Gift,     title: "Gift box makers",   text: "Perfume + cake bundles, Eid gifts, corporate gifting, and build-your-box offers." },
];

// Updated to reflect the new application-first flow
const SELLER_STEPS = [
  { icon: FileText,    label: "Submit application",  text: "Tell us about your business. Takes 3 minutes." },
  { icon: UserCheck,   label: "Team contacts you",   text: "We review your details and reach out to discuss terms." },
  { icon: ShieldCheck, label: "Agreement & contract", text: "Review, negotiate, and sign your seller agreement." },
  { icon: Store,       label: "Seller activation",   text: "Account created, catalog setup, and products go live after approval." },
];

const CATEGORIES = [
  { value: "perfume",  label: "Perfume / oud / fragrance" },
  { value: "cake",     label: "Cakes & celebration" },
  { value: "dessert",  label: "Desserts & sweets" },
  { value: "gift_box", label: "Gift boxes & bundles" },
  { value: "mixed",    label: "Mixed / multi-category" },
  { value: "other",    label: "Other" },
];

const DELIVERY_OPTIONS = [
  { value: "",                  label: "— select —" },
  { value: "seller_delivery",   label: "Own delivery team" },
  { value: "pickup",            label: "Customer pickup" },
  { value: "platform_later",    label: "Platform delivery (future)" },
];

const BLANK_FORM = {
  businessName: "", contactName: "", email: "", phone: "",
  whatsapp: "", city: "", area: "", category: "",
  instagram: "", website: "", expectedProductCount: "",
  deliveryMethod: "", codHandling: "",
  proposedCommissionRate: "", payoutTerms: "",
  salesRepCode: "",
};

// ── Application form ─────────────────────────────────────────────────
function SellerApplicationForm({ repCode }) {
  const [form,       setForm]       = useState({ ...BLANK_FORM, salesRepCode: repCode || "" });
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(null); // success result
  const [serverError, setServerError] = useState("");

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  }

  function validate() {
    const e = {};
    if (!form.businessName.trim()) e.businessName = "Required";
    if (!form.contactName.trim())  e.contactName  = "Required";
    if (!form.city.trim())         e.city         = "Required";
    if (!form.category)            e.category     = "Select a category";
    if (!form.phone.trim() && !form.email.trim()) {
      e.phone = "Provide at least a phone number or email";
    }
    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    setServerError("");
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length) { setErrors(fieldErrors); return; }

    setSubmitting(true);
    try {
      const payload = {
        businessName:          form.businessName.trim(),
        contactName:           form.contactName.trim(),
        email:                 form.email.trim(),
        phone:                 form.phone.trim(),
        whatsapp:              form.whatsapp.trim(),
        city:                  form.city.trim(),
        area:                  form.area.trim(),
        category:              form.category,
        instagram:             form.instagram.trim(),
        website:               form.website.trim(),
        deliveryMethod:        form.deliveryMethod || undefined,
        codHandling:           form.codHandling.trim(),
        payoutTerms:           form.payoutTerms.trim(),
        salesRepCode:          form.salesRepCode.trim(),
      };
      if (form.expectedProductCount) {
        payload.expectedProductCount = Number(form.expectedProductCount);
      }
      if (form.proposedCommissionRate) {
        payload.proposedCommissionRate = Number(form.proposedCommissionRate);
      }

      const result = await sellerApplicationsApi.create(payload);
      setSubmitted(result);
    } catch (err) {
      setServerError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success state ──────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="sell-app-success">
        <div className="sell-app-success-icon"><CheckCircle2 size={32} /></div>
        <h3>Application received</h3>
        <p>
          Our team will contact you to complete the agreement and onboarding.
          We typically reach out within 1–2 business days.
        </p>
        {submitted.id && (
          <div className="sell-app-ref">
            <span>Reference</span>
            <code>{submitted.id}</code>
          </div>
        )}
        <div className="sell-app-next-steps">
          <strong>What happens next</strong>
          <ol>
            <li>Team reviews your application and terms</li>
            <li>We contact you via phone or WhatsApp</li>
            <li>Agreement review and contract signature</li>
            <li>Seller account activated — start adding products</li>
          </ol>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────
  return (
    <form className="sell-app-form" onSubmit={handleSubmit} noValidate>

      {/* Required section */}
      <div className="sell-app-section">
        <h4>Business details <span className="sell-app-required-note">* required</span></h4>
        <div className="sell-app-grid">
          <label className={`sell-app-field${errors.businessName ? " sell-app-field--error" : ""}`}>
            <span>Business / brand name *</span>
            <input
              type="text"
              value={form.businessName}
              onChange={(e) => update("businessName", e.target.value)}
              placeholder="e.g. Layla Oud Perfumes"
              maxLength={120}
            />
            {errors.businessName && <small>{errors.businessName}</small>}
          </label>

          <label className={`sell-app-field${errors.category ? " sell-app-field--error" : ""}`}>
            <span>What do you sell? *</span>
            <select value={form.category} onChange={(e) => update("category", e.target.value)}>
              <option value="">— select category —</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {errors.category && <small>{errors.category}</small>}
          </label>

          <label className={`sell-app-field${errors.city ? " sell-app-field--error" : ""}`}>
            <span>City *</span>
            <input
              type="text"
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              placeholder="e.g. Dubai"
              maxLength={80}
            />
            {errors.city && <small>{errors.city}</small>}
          </label>

          <label className="sell-app-field">
            <span>Area / district</span>
            <input
              type="text"
              value={form.area}
              onChange={(e) => update("area", e.target.value)}
              placeholder="e.g. Jumeirah"
              maxLength={80}
            />
          </label>
        </div>
      </div>

      {/* Contact section */}
      <div className="sell-app-section">
        <h4>Your contact details</h4>
        <div className="sell-app-grid">
          <label className={`sell-app-field sell-app-field--full${errors.contactName ? " sell-app-field--error" : ""}`}>
            <span>Your full name *</span>
            <input
              type="text"
              value={form.contactName}
              onChange={(e) => update("contactName", e.target.value)}
              placeholder="e.g. Fatima Al-Hassan"
              maxLength={100}
            />
            {errors.contactName && <small>{errors.contactName}</small>}
          </label>

          <label className={`sell-app-field${errors.phone ? " sell-app-field--error" : ""}`}>
            <span>Phone *</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+971 50 000 1234"
              maxLength={30}
            />
            {errors.phone && <small>{errors.phone}</small>}
          </label>

          <label className="sell-app-field">
            <span>WhatsApp</span>
            <input
              type="tel"
              value={form.whatsapp}
              onChange={(e) => update("whatsapp", e.target.value)}
              placeholder="+971 50 000 1234"
              maxLength={30}
            />
          </label>

          <label className="sell-app-field sell-app-field--full">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="you@yourbusiness.com"
              maxLength={200}
            />
          </label>
        </div>
      </div>

      {/* Online presence — optional */}
      <div className="sell-app-section sell-app-section--optional">
        <h4>Online presence <span className="sell-app-optional-note">optional</span></h4>
        <div className="sell-app-grid">
          <label className="sell-app-field">
            <span>Instagram</span>
            <input
              type="text"
              value={form.instagram}
              onChange={(e) => update("instagram", e.target.value)}
              placeholder="@yourhandle"
              maxLength={80}
            />
          </label>
          <label className="sell-app-field">
            <span>Website</span>
            <input
              type="url"
              value={form.website}
              onChange={(e) => update("website", e.target.value)}
              placeholder="https://yourbusiness.com"
              maxLength={200}
            />
          </label>
        </div>
      </div>

      {/* Operations — optional */}
      <div className="sell-app-section sell-app-section--optional">
        <h4>Operations <span className="sell-app-optional-note">optional — helps us prepare your onboarding</span></h4>
        <div className="sell-app-grid">
          <label className="sell-app-field">
            <span>How many products are you planning to list?</span>
            <input
              type="number"
              min="1"
              max="9999"
              value={form.expectedProductCount}
              onChange={(e) => update("expectedProductCount", e.target.value)}
              placeholder="e.g. 20"
            />
          </label>
          <label className="sell-app-field">
            <span>Delivery method</span>
            <select value={form.deliveryMethod} onChange={(e) => update("deliveryMethod", e.target.value)}>
              {DELIVERY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="sell-app-field sell-app-field--full">
            <span>COD handling preference</span>
            <input
              type="text"
              value={form.codHandling}
              onChange={(e) => update("codHandling", e.target.value)}
              placeholder="e.g. Driver collects cash, or not applicable"
              maxLength={200}
            />
          </label>
        </div>
      </div>

      {/* Commercial terms — optional */}
      <div className="sell-app-section sell-app-section--optional">
        <h4>Commercial preferences <span className="sell-app-optional-note">optional — we will discuss in detail</span></h4>
        <div className="sell-app-grid">
          <label className="sell-app-field">
            <span>Preferred commission rate (%)</span>
            <input
              type="number"
              min="0"
              max="50"
              step="0.5"
              value={form.proposedCommissionRate}
              onChange={(e) => update("proposedCommissionRate", e.target.value)}
              placeholder="e.g. 12"
            />
          </label>
          <label className="sell-app-field">
            <span>Payout timing preference</span>
            <input
              type="text"
              value={form.payoutTerms}
              onChange={(e) => update("payoutTerms", e.target.value)}
              placeholder="e.g. Weekly, bi-weekly"
              maxLength={200}
            />
          </label>
        </div>
      </div>

      {/* Rep code — shown read-only if from referral */}
      {form.salesRepCode && (
        <div className="sell-app-ref-banner">
          <Users size={14} />
          <span>Referred by Tuti partner <strong>{form.salesRepCode}</strong> — your referral will be attributed.</span>
        </div>
      )}

      {/* Server error */}
      {serverError && (
        <div className="sell-app-error-banner">
          {serverError}
        </div>
      )}

      {/* Submit */}
      <div className="sell-app-footer">
        <button
          className="primary-action"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Submitting application…" : "Submit application"}
          {!submitting && <ArrowRight size={17} />}
        </button>
        <p className="sell-app-disclaimer">
          Submitting an application does not create a seller account.
          A Tuti team member will contact you to complete the agreement process before activation.
        </p>
      </div>
    </form>
  );
}

// ── Main landing page ────────────────────────────────────────────────
export function SellerLandingPage() {
  const [repCode, setRepCode] = useState(() => getStoredRepCode());
  const formRef  = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rep = params.get("rep");
    if (rep) {
      const clean = rep.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);
      storeRepCode(clean);
      setRepCode(clean);
    }

    // Fallback: if ?mode=register, redirect to seller app (internal / manual use only).
    // internal=1 is required so the seller app shows the register form.
    if (params.get("mode") === "register") {
      const fallbackParams = new URLSearchParams();
      fallbackParams.set("mode", "register");
      fallbackParams.set("internal", "1");
      if (repCode || rep) fallbackParams.set("rep", repCode || rep);
      window.location.href = `${getSellerAppUrl()}/?${fallbackParams.toString()}`;
    }
  }, []);

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="seller-landing-page">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="seller-landing-hero">
        <div>
          {repCode && (
            <span className="sell-app-rep-badge">
              <Users size={12} />
              Referred by Tuti partner
            </span>
          )}
          <span className="eyebrow">Sell on Tuti</span>
          <h1>Bring your perfume, cakes, sweets, or gift boxes to one premium marketplace.</h1>
          <p>
            Tuti is built for boutique sellers who already deliver their own products,
            but want one trusted website for discovery, orders, ratings, payments, and repeat customers.
          </p>
          <div className="seller-landing-actions">
            <button className="primary-action" onClick={scrollToForm} type="button">
              <Store size={18} />
              Apply to sell on Tuti
            </button>
            <a className="secondary-action" href="#seller-how-it-works">
              How it works
              <ArrowRight size={17} />
            </a>
          </div>
        </div>

        <aside className="seller-landing-card">
          <span className="seller-landing-card-icon"><WalletCards size={22} /></span>
          <h2>Payment designed for marketplace trust</h2>
          <p>Customer pays Tuti, seller delivers, payout releases after delivery and admin reserve checks.</p>
          <div className="seller-landing-flow">
            <span>Authorize</span>
            <span>Reserve</span>
            <span>Deliver</span>
            <span>Payout</span>
          </div>
        </aside>
      </section>

      {/* ── Seller type cards ─────────────────────────────────────── */}
      <section className="seller-type-grid">
        {SELLER_TYPES.map(({ icon: Icon, title, text }) => (
          <article className="seller-type-card" key={title}>
            <span><Icon size={20} /></span>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>

      {/* ── Benefits ─────────────────────────────────────────────── */}
      <section className="seller-benefit-grid">
        <article>
          <Users size={22} />
          <h2>Customers can grow without manual work</h2>
          <p>Buyers browse, checkout as guest or account, track orders, and review products.</p>
        </article>
        <article>
          <PackageCheck size={22} />
          <h2>Sellers manage their own catalog</h2>
          <p>Each seller gets Seller Central for products, orders, customers, payout rules, stock, and approval status.</p>
        </article>
        <article>
          <Truck size={22} />
          <h2>Own delivery stays simple</h2>
          <p>Every seller can deliver with their own team while Tuti records delivery date, customer details, and payout readiness.</p>
        </article>
        <article>
          <ShieldCheck size={22} />
          <h2>Admin controls risk</h2>
          <p>New sellers start pending review. Admin can approve products, monitor disputes, hold payout, and protect customers.</p>
        </article>
      </section>

      {/* ── How it works — updated for application-first flow ──────── */}
      <section className="seller-how-section" id="seller-how-it-works">
        <div>
          <span className="eyebrow">Seller journey</span>
          <h2>Controlled onboarding, clear for sellers</h2>
          <p>Every seller starts with an application, then agreement, then activation. No shortcuts — quality marketplace for buyers and sellers.</p>
        </div>
        <ol className="seller-step-list">
          {SELLER_STEPS.map((step) => (
            <li key={step.label}>
              <step.icon size={17} />
              <div>
                <strong>{step.label}</strong>
                <span>{step.text}</span>
              </div>
            </li>
          ))}
        </ol>
        <button className="primary-action" onClick={scrollToForm} type="button">
          Start seller application
          <ArrowRight size={17} />
        </button>
      </section>

      {/* ── Payment playbook ──────────────────────────────────────── */}
      <section className="seller-payment-playbook">
        <div>
          <span className="eyebrow">Payment playbook</span>
          <h2>Strong payment model</h2>
        </div>
        <div className="seller-payment-grid">
          <article>
            <BadgeDollarSign size={20} />
            <strong>Card orders</strong>
            <p>Authorize payment, capture after stock confirmation, hold vendor net until delivery/reserve checks pass.</p>
          </article>
          <article>
            <WalletCards size={20} />
            <strong>Cash on delivery</strong>
            <p>Mark COD pending, require seller/admin collection confirmation, then release seller payout ledger.</p>
          </article>
          <article>
            <ShieldCheck size={20} />
            <strong>Risk rules</strong>
            <p>New sellers, disputes, refund windows, and low fulfillment can automatically hold payout for admin review.</p>
          </article>
        </div>
      </section>

      {/* ── Application form section ──────────────────────────────── */}
      <section className="sell-app-section-wrapper" id="seller-apply" ref={formRef}>
        <div className="sell-app-header">
          <span className="eyebrow">Partner application</span>
          <h2>Apply to sell on Tuti</h2>
          <p>
            Fill in your business details. Our team reviews every application personally
            and reaches out within 1–2 business days to discuss terms and next steps.
          </p>

          <div className="sell-app-journey">
            {[
              { n: "1", label: "Apply",       sub: "3 min form" },
              { n: "2", label: "Review",       sub: "Team contacts you" },
              { n: "3", label: "Agreement",    sub: "Contract & signature" },
              { n: "4", label: "Activation",   sub: "Start selling" },
            ].map(({ n, label, sub }) => (
              <div key={n} className="sell-app-journey-step">
                <span className="sell-app-journey-num">{n}</span>
                <strong>{label}</strong>
                <span>{sub}</span>
              </div>
            ))}
          </div>
        </div>

        <SellerApplicationForm repCode={repCode} />
      </section>

    </main>
  );
}
