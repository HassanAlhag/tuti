import { useState } from "react";
import { ArrowLeft, BookOpen, Clock } from "lucide-react";
import { journalArticles, journalCategories } from "../siteMap.js";
import { PageHero } from "./sitemapPageShared.jsx";
import { RouteNotFound } from "../../layout/RouteState.jsx";
import { useSeoMeta } from "@tuti/shared/hooks/useSeoMeta.js";

function getJournalSlug() {
  const match = window.location.pathname.match(/^\/journal\/([^/]+)/);
  return match ? match[1] : null;
}

function categoryLabel(categoryId) {
  return journalCategories.find((c) => c.id === categoryId)?.label || "Guide";
}

function formatArticleDate(value) {
  return new Date(value).toLocaleDateString("en-AE", { year: "numeric", month: "long", day: "numeric" });
}

function ArticleCard({ article, onNavigate }) {
  return (
    <button className="journal-article-card" onClick={() => onNavigate(article.path)} type="button">
      <span className="journal-article-thumb" data-tone={article.category} aria-hidden="true">
        <BookOpen size={20} />
      </span>
      <div className="journal-article-category">{categoryLabel(article.category)}</div>
      <h2 className="journal-article-title">{article.title}</h2>
      <p className="journal-article-summary">{article.summary}</p>
      <div className="journal-article-meta">
        <span className="journal-article-date">{formatArticleDate(article.date)}</span>
        <span className="journal-article-read">
          <Clock size={12} aria-hidden="true" />
          {article.readMins} min read
        </span>
      </div>
    </button>
  );
}

function JournalArticleDetail({ article, onNavigate }) {
  useSeoMeta({
    title: article ? `${article.title} — Tuti Journal` : "Article not found",
    description: article?.summary,
    canonical: article ? `https://tuti.ae${article.path}` : undefined,
  });

  if (!article) {
    return (
      <RouteNotFound
        heading="Article not found"
        message="This journal article doesn't exist, or the link may be out of date."
        onPrimary={() => onNavigate("/journal")}
        primaryLabel="Back to Journal"
      />
    );
  }

  const related = journalArticles.filter((a) => a.slug !== article.slug).slice(0, 3);

  return (
    <>
      <PageHero
        kicker={categoryLabel(article.category)}
        title={article.title}
        text={`${formatArticleDate(article.date)} · ${article.readMins} min read`}
      />
      <article className="journal-detail">
        <button className="ghost-action compact" onClick={() => onNavigate("/journal")} type="button">
          <ArrowLeft size={15} /> All articles
        </button>
        <p className="journal-detail-lead">{article.summary}</p>
      </article>

      {related.length > 0 ? (
        <section className="journal-related" aria-label="More from the Journal">
          <h2 className="journal-related-title">More from the Journal</h2>
          <div className="journal-articles-grid">
            {related.map((a) => (
              <ArticleCard key={a.slug} article={a} onNavigate={onNavigate} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

export function JournalPage({ onNavigate }) {
  const [activeCategory, setActiveCategory] = useState("all");
  const slug = getJournalSlug();

  useSeoMeta({
    title: "Journal — Perfume Tips, Fragrance Guides & Gift Ideas",
    description: "Discover perfume tips, fragrance note guides, oud stories, and gift inspiration from the Tuti Journal.",
    canonical: "https://tuti.ae/journal",
  });

  if (slug) {
    const article = journalArticles.find((a) => a.slug === slug);
    return (
      <main className="page-shell">
        <JournalArticleDetail article={article} onNavigate={onNavigate} />
      </main>
    );
  }

  const filtered = activeCategory === "all"
    ? journalArticles
    : journalArticles.filter((a) => a.category === activeCategory);

  return (
    <main className="page-shell">
      <PageHero
        kicker="Journal"
        title="Perfume tips, note guides, oud stories, and gift guides"
        text="Education, inspiration, and discovery — written for perfume lovers and gift givers."
      />

      <nav className="journal-category-nav" aria-label="Journal categories">
        {journalCategories.map((cat) => (
          <button
            key={cat.id}
            className={activeCategory === cat.id ? "journal-cat-btn active" : "journal-cat-btn"}
            onClick={() => setActiveCategory(cat.id)}
            type="button"
            aria-pressed={activeCategory === cat.id}
          >
            {cat.label}
          </button>
        ))}
      </nav>

      <section className="journal-articles-grid" aria-label="Journal articles">
        {filtered.map((article) => (
          <ArticleCard key={article.slug} article={article} onNavigate={onNavigate} />
        ))}
      </section>

      {filtered.length === 0 && (
        <div className="journal-empty">
          <BookOpen size={32} aria-hidden="true" />
          <p>No articles in this category yet. Check back soon.</p>
        </div>
      )}
    </main>
  );
}
