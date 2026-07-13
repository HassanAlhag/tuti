import { useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Lock, Scale, ShieldCheck, Truck } from "lucide-react";
import { brand } from "@tuti/shared/brand.js";
import { legalContent, legalPages } from "../siteMap.js";
import { RouteNotFound } from "../../layout/RouteState.jsx";
import { useSeoMeta } from "@tuti/shared/hooks/useSeoMeta.js";
import "../support.css";

const PAGE_ICONS = {
  "privacy-policy":  Lock,
  "terms-conditions": Scale,
  "refund-policy":   ShieldCheck,
  "shipping-policy": Truck,
  "build-gift-terms": ShieldCheck,
  "cookie-policy":   ShieldCheck,
};

function getLegalSlug() {
  const match = window.location.pathname.match(/^\/legal\/([^/]+)/);
  return match ? match[1] : null;
}

function headingId(heading) {
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const TRUST_ITEMS = [
  { Icon: ShieldCheck, label: "UAE-based marketplace" },
  { Icon: Lock,        label: "Your data is protected" },
  { Icon: Scale,       label: "UAE law governs all transactions" },
];

function LegalIndex({ onNavigate }) {
  useSeoMeta({
    title: "Legal — Policies & Terms",
    description: `Privacy policy, terms, refund policy, delivery, and Build a Gift terms for ${brand.name} Marketplace.`,
    canonical: "https://tuti.ae/legal",
  });

  return (
    <main className="tuti-legal">
      <div className="tuti-legal__hero">
        <div className="tuti-legal__hero-inner">
          <span className="tuti-legal__hero-kicker">Legal</span>
          <h1 className="tuti-legal__hero-title">Policies &amp; Terms</h1>
          <p className="tuti-legal__hero-sub">
            Marketplace rules, privacy, refunds, delivery, and Build a Gift terms for {brand.name}.
          </p>
        </div>
      </div>

      <div className="tuti-legal__body">
        <div className="tuti-legal__trust">
          {TRUST_ITEMS.map(({ Icon, label }) => (
            <div className="tuti-legal__trust-item" key={label}>
              <Icon size={14} aria-hidden="true" />
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="tuti-legal__index">
          {legalPages.map((page) => {
            const Icon = PAGE_ICONS[page.slug] || ShieldCheck;
            return (
              <button
                key={page.slug}
                className="tuti-legal__index-card"
                onClick={() => onNavigate(page.path)}
                type="button"
              >
                <div className="tuti-legal__index-card-icon">
                  <Icon size={17} aria-hidden="true" />
                </div>
                <div className="tuti-legal__index-card-text">
                  <p className="tuti-legal__index-card-title">{page.title}</p>
                  {page.desc ? <p className="tuti-legal__index-card-desc">{page.desc}</p> : null}
                </div>
                <ChevronRight size={16} className="tuti-legal__index-card-chevron" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function LegalDetail({ slug, onNavigate }) {
  const content = legalContent[slug];
  const [collapsed, setCollapsed] = useState(new Set());

  function toggleSection(i) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

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
    <main className="tuti-legal">
      <div className="tuti-legal__hero">
        <div className="tuti-legal__hero-inner">
          <span className="tuti-legal__hero-kicker">Legal</span>
          <h1 className="tuti-legal__hero-title">{content.title}</h1>
          <p className="tuti-legal__hero-sub">Last updated: {content.updated}</p>
        </div>
      </div>

      <div className="tuti-legal__body">
        <div className="tuti-legal__article">
          <div className="tuti-legal__back">
            <button className="ghost-action compact" onClick={() => onNavigate("/legal")} type="button">
              <ArrowLeft size={15} aria-hidden="true" /> All policies
            </button>
          </div>

          {content.sections.length > 2 ? (
            <nav className="tuti-legal__toc" aria-label="Policy sections">
              <span className="tuti-legal__toc-label">On this page</span>
              <ol>
                {content.sections.map((section) => (
                  <li key={section.heading}>
                    <a href={`#${headingId(section.heading)}`}>{section.heading}</a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}

          {content.sections.map((section, i) => {
            const isOpen = !collapsed.has(i);
            return (
              <section
                key={section.heading}
                className="tuti-legal__section"
                id={headingId(section.heading)}
              >
                <button
                  className="tuti-legal__section-toggle"
                  type="button"
                  onClick={() => toggleSection(i)}
                  aria-expanded={isOpen ? "true" : "false"}
                >
                  <h2 className="tuti-legal__section-heading">{section.heading}</h2>
                  <ChevronDown
                    size={15}
                    aria-hidden="true"
                    className={`tuti-legal__section-chevron${isOpen ? " tuti-legal__section-chevron--open" : ""}`}
                  />
                </button>
                {isOpen ? <p className="tuti-legal__section-body">{section.body}</p> : null}
              </section>
            );
          })}

          <div className="tuti-legal__footer-note">
            <ShieldCheck size={14} aria-hidden="true" />
            <span>These policies are subject to change. The latest version is always available at tuti.ae/legal.</span>
          </div>
        </div>
      </div>
    </main>
  );
}

export function LegalPage({ onNavigate }) {
  const slug = getLegalSlug();
  return slug
    ? <LegalDetail slug={slug} onNavigate={onNavigate} />
    : <LegalIndex onNavigate={onNavigate} />;
}
