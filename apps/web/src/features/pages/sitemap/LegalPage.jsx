import { ShieldCheck } from "lucide-react";
import { brand } from "@tuti/shared/brand.js";
import { legalPages } from "../siteMap.js";
import { PageHero } from "./sitemapPageShared.jsx";

export function LegalPage() {
  return (
    <main className="page-shell">
      <PageHero
        kicker="Legal"
        title="Policies for customers, sellers, and payments"
        text="Privacy, terms, cookies, refunds, and shipping policies are separated for compliance and marketplace trust."
      />
      <section className="legal-grid">
        {legalPages.map((page) => (
          <article className="sitemap-card" key={page.path}>
            <span className="sitemap-card-icon"><ShieldCheck size={19} /></span>
            <h2>{page.title}</h2>
            <p>Policy content area for {brand.name}, ready for legal copy and version history.</p>
          </article>
        ))}
      </section>
    </main>
  );
}
