import { useState } from "react";
import { BookOpen, Clock } from "lucide-react";
import { journalArticles, journalCategories } from "../siteMap.js";
import { PageHero } from "./sitemapPageShared.jsx";
import { useSeoMeta } from "@tuti/shared/hooks/useSeoMeta.js";

function ArticleCard({ article }) {
  return (
    <article className="journal-article-card">
      <div className="journal-article-category">{journalCategories.find((c) => c.id === article.category)?.label || "Guide"}</div>
      <h2 className="journal-article-title">{article.title}</h2>
      <p className="journal-article-summary">{article.summary}</p>
      <div className="journal-article-meta">
        <span className="journal-article-date">
          {new Date(article.date).toLocaleDateString("en-AE", { year: "numeric", month: "long", day: "numeric" })}
        </span>
        <span className="journal-article-read">
          <Clock size={12} aria-hidden="true" />
          {article.readMins} min read
        </span>
      </div>
    </article>
  );
}

export function JournalPage() {
  const [activeCategory, setActiveCategory] = useState("all");

  useSeoMeta({
    title: "Journal — Perfume Tips, Fragrance Guides & Gift Ideas",
    description: "Discover perfume tips, fragrance note guides, oud stories, and gift inspiration from the Tuti Journal.",
    canonical: "https://tuti.ae/journal",
  });

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
          <ArticleCard key={article.slug} article={article} />
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
