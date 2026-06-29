import { ShieldCheck, ChevronRight, ArrowLeft } from "lucide-react";
import { brand } from "@tuti/shared/brand.js";
import { legalPages, legalContent } from "../siteMap.js";
import { PageHero } from "./sitemapPageShared.jsx";
import { RouteNotFound } from "../../layout/RouteState.jsx";
import { useSeoMeta } from "@tuti/shared/hooks/useSeoMeta.js";

function getLegalSlug() {
  const match = window.location.pathname.match(/^\/legal\/([^/]+)/);
  return match ? match[1] : null;
}

function headingId(heading) {
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function LegalIndex({ onNavigate }) {
  useSeoMeta({
    title: "Legal — Privacy, Terms & Policies",
    description: "Privacy policy, terms and conditions, cookie policy, refund policy, and shipping policy for Tuti Marketplace.",
    canonical: "https://tuti.ae/legal",
  });

  return (
    <>
      <PageHero
        kicker="Legal"
        title="Policies for customers, sellers, and payments"
        text={`Privacy, terms, cookies, refunds, and shipping policies for ${brand.name}.`}
      />
      <section className="legal-grid">
        {legalPages.map((page) => (
          <button
            key={page.slug}
            className="legal-index-card"
            onClick={() => onNavigate(page.path)}
            type="button"
          >
            <span className="sitemap-card-icon"><ShieldCheck size={19} /></span>
            <div>
              <h2>{page.title}</h2>
              <p>Effective policy for {brand.name} marketplace.</p>
            </div>
            <ChevronRight size={18} className="legal-index-chevron" aria-hidden="true" />
          </button>
        ))}
      </section>
    </>
  );
}

function LegalDetail({ slug, onNavigate }) {
  const content = legalContent[slug];

  useSeoMeta({
    title: content ? `${content.title} — Tuti` : "Legal Policy",
    description: content ? `${content.title} for Tuti Marketplace. Last updated ${content.updated}.` : undefined,
    canonical: `https://tuti.ae/legal/${slug}`,
  });

  if (!content) {
    return (
      <main className="page-shell">
        <RouteNotFound
          heading="Policy not found"
          message="This policy page doesn't exist, or the link may be out of date."
          onPrimary={() => onNavigate("/legal")}
          primaryLabel="Back to legal"
        />
      </main>
    );
  }

  return (
    <>
      <PageHero kicker="Legal" title={content.title} text={`Last updated: ${content.updated}`} />
      <article className="legal-article">
        <div className="legal-back-row">
          <button className="ghost-action compact" onClick={() => onNavigate("/legal")} type="button">
            <ArrowLeft size={15} /> All policies
          </button>
        </div>
        {content.sections.length > 1 ? (
          <nav className="legal-toc" aria-label="Policy sections">
            <span className="legal-toc-label">On this page</span>
            <ol>
              {content.sections.map((section) => (
                <li key={section.heading}>
                  <a href={`#${headingId(section.heading)}`}>{section.heading}</a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        {content.sections.map((section) => (
          <section key={section.heading} className="legal-section" id={headingId(section.heading)}>
            <h2 className="legal-section-heading">{section.heading}</h2>
            <p className="legal-section-body">{section.body}</p>
          </section>
        ))}
        <div className="legal-footer-note">
          <ShieldCheck size={15} aria-hidden="true" />
          <span>These policies are subject to change. The latest version is always available at tuti.ae/legal.</span>
        </div>
      </article>
    </>
  );
}

export function LegalPage({ onNavigate }) {
  const slug = getLegalSlug();

  return (
    <main className="page-shell">
      {slug
        ? <LegalDetail slug={slug} onNavigate={onNavigate} />
        : <LegalIndex onNavigate={onNavigate} />
      }
    </main>
  );
}
