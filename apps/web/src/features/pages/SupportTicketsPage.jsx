import { Gift, HelpCircle, PackageCheck, RefreshCw, Truck } from "lucide-react";
import { useAuthStore } from "@tuti/shared/store/authStore.js";
import "./support.css";

const QUICK_ACTIONS = [
  {
    Icon: PackageCheck,
    label: "Track an order",
    desc: "Sign in to see boutique preparation status and delivery updates in real time.",
    action: (nav) => nav("/account"),
  },
  {
    Icon: Truck,
    label: "Delivery help",
    desc: "Timelines include boutique preparation time. Orders from multiple boutiques may arrive separately.",
    action: null,
  },
  {
    Icon: RefreshCw,
    label: "Refunds & cancellations",
    desc: "Eligibility depends on product type and preparation status. View our refund policy for details.",
    action: (nav) => nav("/legal/refund-policy"),
  },
  {
    Icon: Gift,
    label: "Build a Gift help",
    desc: "Questions about customization, gift messages, or boutique preparation for your gift build.",
    action: (nav) => nav("/build-gift"),
  },
  {
    Icon: HelpCircle,
    label: "Contact Tuti",
    desc: "Reach our team for general account help, boutique enquiries, and other questions.",
    action: (nav) => nav("/contact"),
  },
];

const FAQ_SECTIONS = [
  {
    heading: "Orders",
    items: [
      { q: "Where can I track my order?", a: "Sign in and go to Account → Orders. Each order shows its preparation and delivery status." },
      { q: "Can I change my order after placing it?", a: "Contact us as soon as possible. Orders can only be amended before the boutique begins preparation." },
      { q: "Can I cancel my order?", a: "Yes, before the boutique starts preparing. Once preparation begins — especially for food and customized gifts — cancellation may not be possible." },
    ],
  },
  {
    heading: "Delivery",
    items: [
      { q: "Why is delivery taking longer than expected?", a: "Delivery time includes boutique preparation time. Food and customized orders may need 1–2 extra days." },
      { q: "My order has items from two boutiques — will they arrive together?", a: "No. Each boutique prepares and dispatches its own items. You may receive them at different times." },
      { q: "What happens if delivery fails?", a: "The driver will contact you to reschedule. Three failed attempts may result in order cancellation." },
    ],
  },
  {
    heading: "Payments",
    items: [
      { q: "Is cash on delivery available?", a: "Yes. COD is available on all orders. You pay the driver when your order arrives." },
      { q: "Can I pay by card?", a: "Card payment is available where indicated at checkout. VAT is shown before you confirm your order." },
      { q: "How long do refunds take?", a: "Approved card refunds are processed within 5–10 business days. COD credits are settled by the seller or applied to your account." },
    ],
  },
  {
    heading: "Build a Gift",
    items: [
      { q: "What is Build a Gift?", a: "Build a Gift is Tuti's guided customization flow. You choose the occasion, items, wrap, and personal message — all prepared by one boutique." },
      { q: "Can a gift include items from different boutiques?", a: "No. Each Build a Gift is prepared entirely by one boutique. You can add items from other boutiques to your cart separately." },
      { q: "Can I edit my gift message after placing the order?", a: "Gift messages cannot be amended after the order is confirmed. Please review carefully before checkout." },
    ],
  },
  {
    heading: "Gift Boxes",
    items: [
      { q: "What are Gift Boxes?", a: "Gift Boxes are ready-made boutique packages — curated, wrapped, and prepared by the boutique without customization." },
      { q: "How are Gift Boxes different from Build a Gift?", a: "Gift Boxes are pre-made standard products. Build a Gift lets you customize the occasion, items, wrap, and message." },
    ],
  },
  {
    heading: "Refunds",
    items: [
      { q: "Which items are non-returnable?", a: "Opened perfumes, perishable food items (unless damaged or incorrect), and Build a Gift orders once preparation has started." },
      { q: "How do I request a refund?", a: "Open a support request from Account → Support, or use the dispute flow from your order detail. Attach photos where relevant." },
    ],
  },
];

export function SupportTicketsPage({ onNavigate }) {
  const { isAuthenticated } = useAuthStore();
  const authenticated = isAuthenticated();

  return (
    <main className="tuti-support">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="tuti-support__hero">
        <div className="tuti-support__hero-inner">
          <span className="tuti-support__hero-kicker">Support centre</span>
          <h1 className="tuti-support__hero-title">How can we help?</h1>
          <p className="tuti-support__hero-sub">
            Get help with orders, delivery, Build a Gift, refunds, and boutique preparation.
          </p>
        </div>
      </div>

      <div className="tuti-support__body">

        {/* ── Quick actions ─────────────────────────────────────────── */}
        <div className="tuti-support__quick-actions">
          {QUICK_ACTIONS.map(({ Icon, label, desc, action }) => (
            <button
              key={label}
              className="tuti-support__quick-action"
              type="button"
              onClick={() => action && onNavigate && action(onNavigate)}
              style={!action ? { cursor: "default" } : undefined}
            >
              <div className="tuti-support__quick-action-icon">
                <Icon size={17} aria-hidden="true" />
              </div>
              <span className="tuti-support__quick-action-label">{label}</span>
              <span className="tuti-support__quick-action-desc">{desc}</span>
            </button>
          ))}
        </div>

        {/* ── FAQ ───────────────────────────────────────────────────── */}
        <div className="tuti-support__faq">
          {FAQ_SECTIONS.map(({ heading, items }) => (
            <div className="tuti-support__faq-section" key={heading}>
              <h2 className="tuti-support__faq-heading">{heading}</h2>
              <div className="tuti-support__faq-items">
                {items.map(({ q, a }) => (
                  <div className="tuti-support__faq-item" key={q}>
                    <p className="tuti-support__faq-q">{q}</p>
                    <p className="tuti-support__faq-a">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Auth CTA ──────────────────────────────────────────────── */}
        {authenticated ? (
          <div className="tuti-support__account-cta">
            <div className="tuti-support__account-cta-text">
              <strong>Need help with a specific order?</strong>
              <p>
                Start from your order details — it connects your request to the right boutique, delivery, and payment record.
                For general account help, go to Account → Support.
              </p>
            </div>
            <div className="tuti-support__account-cta-actions">
              <button className="secondary-action compact" type="button" onClick={() => onNavigate?.("/account")}>
                <PackageCheck size={15} aria-hidden="true" /> My orders
              </button>
              <button className="ghost-action compact" type="button" onClick={() => onNavigate?.("/account?tab=support")}>
                My requests
              </button>
            </div>
          </div>
        ) : (
          <div className="tuti-support__signin">
            <div className="tuti-support__signin-text">
              <h3>Sign in for personal support</h3>
              <p>Track your support requests and manage order issues from your account.</p>
              <div className="tuti-support__signin-actions">
                <button
                  className="primary-action compact"
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("tuti:open-auth", { detail: { mode: "login" } }))}
                >
                  Sign in
                </button>
                <button className="ghost-action compact" type="button" onClick={() => onNavigate?.("/contact")}>
                  Contact us
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
