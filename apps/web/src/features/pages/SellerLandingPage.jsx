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
import { useSeoMeta } from "@tuti/shared/hooks/useSeoMeta.js";
import "./seller-landing.css";

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
  { icon: Sparkles, title: "Perfume boutiques", text: "Oud, musk, floral, amber, fresh scents, minis, and ready-made perfume Gift Boxes." },
  { icon: Cake, title: "Cake & dessert shops", text: "Celebration cakes, dessert boxes, cupcakes, cheesecakes, and same-day treats." },
  { icon: Gift, title: "Gift Box sellers", text: "Occasion-ready packages prepared and packed by your own boutique." },
  { icon: Users, title: "Corporate gifting boutiques", text: "Premium bulk gifting, branded notes, and boutique-led fulfilment for teams." },
];

const SELLER_STEPS = [
  { icon: FileText, label: "Apply and verify your boutique", text: "Tell us what you sell, where you operate, and how your team prepares orders." },
  { icon: Store, label: "Add products and delivery rules", text: "List your catalogue, stock, preparation timing, delivery method, and service areas." },
  { icon: WalletCards, label: "Receive COD-ready orders", text: "Customers can place COD orders at launch while online card payment remains unavailable." },
  { icon: Truck, label: "Prepare and hand over", text: "Your boutique prepares its own products, packaging, and customization details." },
  { icon: BadgeDollarSign, label: "Track sales and support", text: "Use Seller Central for order status, finance, balances, and support follow-up." },
];

const CATEGORIES = [
  { value: "perfume",  label: "Perfume / oud / fragrance" },
  { value: "cake",     label: "Cakes & celebration" },
  { value: "dessert",  label: "Desserts & sweets" },
  { value: "gift_box", label: "Gift Boxes and boutique packages" },
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
  const sellerAppUrl = getSellerAppUrl();

  useSeoMeta({
    title: "Sell on Tuti — List Your Perfumes, Cakes & Gift Boxes",
    description: "Join Tuti Marketplace as a seller. List perfumes, cakes, and gift boxes and reach customers across the UAE with cash on delivery.",
    canonical: "https://tuti.ae/sell",
  });

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
    <main className="tuti-seller">
      <section className="tuti-seller__hero">
        <div className="tuti-seller__hero-copy">
          {repCode && (
            <span className="sell-app-rep-badge">
              <Users size={12} />
              Referred by Tuti partner
            </span>
          )}
          <span className="tuti-seller__eyebrow">Sell on Tuti</span>
          <h1>Sell on Tuti</h1>
          <p>
            Reach customers looking for premium perfumes, cakes, desserts, Gift Boxes,
            and customized Build a Gift orders prepared by one boutique.
          </p>
          <div className="tuti-seller__hero-actions">
            <button className="tuti-seller__primary" onClick={scrollToForm} type="button">
              <Store size={18} />
              Apply as a boutique
            </button>
            <a className="tuti-seller__secondary" href={sellerAppUrl}>
              Seller sign in
              <ArrowRight size={17} />
            </a>
          </div>
          <div className="tuti-seller__trust-chips" aria-label="Marketplace rules">
            <span>Boutique-led preparation</span>
            <span>COD at launch</span>
            <span>Perfumes, desserts & Gift Boxes</span>
            <span>Build a Gift ready</span>
          </div>
        </div>

        <aside className="tuti-seller__hero-card">
          <div className="tuti-seller__hero-card-head">
            <span><PackageCheck size={20} /></span>
            <strong>Boutique package promise</strong>
          </div>
          <p>
            Each boutique prepares its own products and packaging. Tuti checkout can
            include multiple boutiques, but packages are prepared separately.
          </p>
          <div className="tuti-seller__package-flow">
            <span>List</span>
            <span>Accept</span>
            <span>Prepare</span>
            <span>Handover</span>
          </div>
        </aside>
      </section>

      <section className="tuti-seller__fit">
        <div className="tuti-seller__section-head">
          <span className="tuti-seller__eyebrow">Category fit</span>
          <h2>Built for boutiques that prepare their own craft.</h2>
          <p>Join if your team can list, prepare, package, and hand over its own products reliably.</p>
        </div>
        <div className="tuti-seller__fit-grid">
          {SELLER_TYPES.map(({ icon: Icon, title, text }) => (
            <article className="tuti-seller__card" key={title}>
              <span><Icon size={20} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="tuti-seller__steps" id="seller-how-it-works">
        <div className="tuti-seller__section-head">
          <span className="tuti-seller__eyebrow">How it works</span>
          <h2>From application to repeat orders.</h2>
          <p>Onboarding is reviewed, practical, and designed for customer trust.</p>
        </div>
        <ol className="tuti-seller__step-list">
          {SELLER_STEPS.map((step, index) => (
            <li key={step.label}>
              <span className="tuti-seller__step-number">{index + 1}</span>
              <step.icon size={18} />
              <div>
                <strong>{step.label}</strong>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="tuti-seller__build-gift">
        <div>
          <span className="tuti-seller__eyebrow">Build a Gift for sellers</span>
          <h2>Customize gifts only within what your boutique can prepare.</h2>
          <p>
            Eligible boutiques can receive Build a Gift orders. Each Build a Gift is
            prepared by one boutique, and customization details are attached to the order.
          </p>
        </div>
        <div className="tuti-seller__rule-list">
          <span><CheckCircle2 size={16} /> One boutique prepares the customized gift</span>
          <span><CheckCircle2 size={16} /> Message, wrapping, and add-ons stay attached to the order</span>
          <span><CheckCircle2 size={16} /> Offer only categories your team can prepare itself</span>
        </div>
      </section>

      <section className="tuti-seller__cod">
        <div className="tuti-seller__section-head">
          <span className="tuti-seller__eyebrow">Payments at launch</span>
          <h2>COD-ready, with no online card payment claims.</h2>
          <p>Customers pay the driver on delivery. Seller balances are tracked through the marketplace.</p>
        </div>
        <div className="tuti-seller__cod-grid">
          <article>
            <BadgeDollarSign size={20} />
            <strong>Cash on Delivery</strong>
            <p>COD is available at launch. Customers pay cash to the driver on delivery.</p>
          </article>
          <article>
            <WalletCards size={20} />
            <strong>Tracked balances</strong>
            <p>Seller balances and settlement readiness are tracked through the marketplace.</p>
          </article>
          <article>
            <ShieldCheck size={20} />
            <strong>Card payments later</strong>
            <p>Online card payments are not available yet and should not be promised to customers.</p>
          </article>
        </div>
      </section>

      <section className="tuti-seller__tools">
        <div className="tuti-seller__section-head">
          <span className="tuti-seller__eyebrow">Seller tools</span>
          <h2>Operate your boutique from Seller Central.</h2>
        </div>
        <div className="tuti-seller__tools-grid">
          {[
            ["Product management", "Create products, manage categories, pricing, stock, and approval status."],
            ["Order management", "Review incoming orders, preparation details, and delivery readiness."],
            ["Support and disputes", "Follow up on customer issues and refund/cancellation questions."],
            ["Finance and balances", "Track COD-related balances, payout readiness, and settlement status."],
            ["Reporting", "See sales and order signals available in the seller workspace."],
          ].map(([title, text]) => (
            <article className="tuti-seller__tool-card" key={title}>
              <strong>{title}</strong>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="tuti-seller__faq">
        <div className="tuti-seller__section-head">
          <span className="tuti-seller__eyebrow">FAQ</span>
          <h2>What boutiques ask before joining.</h2>
        </div>
        <div className="tuti-seller__faq-grid">
          {[
            ["What can I sell?", "Perfumes, cakes, desserts, Gift Boxes, and approved boutique gift products."],
            ["Can I offer Build a Gift?", "Yes, if your boutique can prepare the selected products and customization details itself."],
            ["Who prepares the package?", "The boutique receiving the order prepares its own package. Tuti does not combine products from different boutiques into one physical box."],
            ["How does COD work?", "Customers pay the driver on delivery. Tuti tracks order and balance status through the marketplace."],
            ["Can I sell in multiple categories?", "Yes, if your boutique can reliably prepare and fulfil each category it lists."],
            ["How do refunds and cancellations work?", "Support and admin review order issues, disputes, and payout holds according to marketplace rules."],
          ].map(([question, answer]) => (
            <article key={question}>
              <strong>{question}</strong>
              <p>{answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sell-app-section-wrapper tuti-seller__apply" id="seller-apply" ref={formRef}>
        <div className="sell-app-header">
          <span className="tuti-seller__eyebrow">Partner application</span>
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

      <section className="tuti-seller__cta">
        <div>
          <span className="tuti-seller__eyebrow">Ready to join?</span>
          <h2>Bring your boutique to Tuti customers.</h2>
        </div>
        <div className="tuti-seller__hero-actions">
          <button className="tuti-seller__primary" onClick={scrollToForm} type="button">
            Apply as a boutique
            <ArrowRight size={17} />
          </button>
          <a className="tuti-seller__secondary" href={sellerAppUrl}>Seller sign in</a>
        </div>
      </section>
    </main>
  );
}
