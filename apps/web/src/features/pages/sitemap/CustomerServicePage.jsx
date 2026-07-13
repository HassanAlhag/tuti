import { Gift, HelpCircle, Mail, MessageSquare, Package, Users } from "lucide-react";
import "../support.css";

const CONTACT_CARDS = [
  {
    Icon: HelpCircle,
    title: "Customer support",
    desc: "Help with orders, delivery questions, refunds, and account issues.",
    cta: "Open support",
    action: (onNavigate) => onNavigate("/support"),
  },
  {
    Icon: Package,
    title: "Order help",
    desc: "Need help with an order outcome? Start from your order details — it connects your request to the right boutique and delivery record.",
    cta: "View orders",
    action: (onNavigate) => onNavigate("/account"),
  },
  {
    Icon: Gift,
    title: "Build a Gift help",
    desc: "Questions about customization, gift messages, or boutique preparation for your gift build.",
    cta: "Build a Gift",
    action: (onNavigate) => onNavigate("/build-gift"),
  },
  {
    Icon: Users,
    title: "Corporate gifting",
    desc: "Bulk orders, branded packaging, or recurring gifts for corporate clients. Contact us directly.",
    cta: "Get in touch",
    action: (onNavigate) => onNavigate("/support"),
  },
  {
    Icon: Mail,
    title: "Boutique enquiries",
    desc: "Seller application, boutique listings, or partnership discussions.",
    cta: "Seller portal",
    action: () => {},
    isSellerLink: true,
  },
  {
    Icon: MessageSquare,
    title: "Feedback",
    desc: "Share feedback about your experience with Tuti. We read every message.",
    cta: "Send feedback",
    action: (onNavigate) => onNavigate("/support"),
  },
];

export function CustomerServicePage({ mode = "support", onNavigate }) {
  const isContact = mode === "contact";

  return (
    <main className="tuti-contact">
      <div className="tuti-contact__hero">
        <div className="tuti-contact__hero-inner">
          <span className="tuti-contact__hero-kicker">{isContact ? "Contact" : "Help Centre"}</span>
          <h1 className="tuti-contact__hero-title">
            {isContact ? "Contact Tuti" : "How can we help?"}
          </h1>
          <p className="tuti-contact__hero-sub">
            {isContact
              ? "Reach our team for order help, boutique enquiries, and general questions."
              : "Find answers, contact support, or open a ticket from your account."}
          </p>
        </div>
      </div>

      <div className="tuti-contact__body">
        <div className="tuti-contact__cards">
          {CONTACT_CARDS.map(({ Icon, title, desc, cta, action, isSellerLink }) => (
            <div className="tuti-contact__card" key={title}>
              <div className="tuti-contact__card-icon">
                <Icon size={18} aria-hidden="true" />
              </div>
              <h2 className="tuti-contact__card-title">{title}</h2>
              <p className="tuti-contact__card-desc">{desc}</p>
              <div className="tuti-contact__card-cta">
                {isSellerLink ? (
                  <span className="muted-label" style={{ fontSize: "0.73rem" }}>
                    seller@tuti.ae
                  </span>
                ) : (
                  <button
                    className="ghost-action compact"
                    type="button"
                    onClick={() => action(onNavigate)}
                  >
                    {cta}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="tuti-contact__note">
          <p className="tuti-contact__note-heading">How Tuti support works</p>
          <p className="tuti-contact__note-body">
            Each boutique on Tuti prepares its own orders and gifts. Need help with an order outcome? Start from your order details — it connects your request to the right boutique, delivery, and payment record. For general account questions, use Account → Support. Our team responds within 24 hours on business days.
          </p>
        </div>
      </div>
    </main>
  );
}
