import { HelpCircle, Mail } from "lucide-react";
import { supportSections } from "../siteMap.js";
import { PageHero, FeatureGrid } from "./sitemapPageShared.jsx";

export function CustomerServicePage({ mode = "support", onNavigate }) {
  const title = mode === "contact" ? "Contact Tuti support" : "Customer service";
  return (
    <main className="page-shell">
      <PageHero
        kicker={mode === "contact" ? "Contact" : "Support"}
        title={title}
        text="Support tickets handle general help and account guidance. For refund, delivery, or order outcome issues, open a dispute from your order details."
      />
      <FeatureGrid items={supportSections} icon={HelpCircle} onNavigate={onNavigate || (() => {})} />
      <section className="contact-panel">
        <div>
          <span className="eyebrow">Contact us</span>
          <h2>support@tuti.example</h2>
          <p>Customer care can handle general help, account questions, order follow-up, and product guidance. Formal refund and delivery disputes stay in the dispute flow.</p>
        </div>
        <button className="primary-action" type="button" onClick={() => onNavigate?.("/support")}>
          <Mail size={18} />
          Open support tickets
        </button>
      </section>
    </main>
  );
}
