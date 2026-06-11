import { BookOpen } from "lucide-react";
import { journalSections } from "../siteMap.js";
import { PageHero, FeatureGrid } from "./sitemapPageShared.jsx";

export function JournalPage() {
  return (
    <main className="page-shell">
      <PageHero
        kicker="Journal"
        title="Perfume tips, note guides, oud stories, and gift guides"
        text="A content hub for education, SEO, brand news, and richer perfume discovery."
      />
      <FeatureGrid items={journalSections} icon={BookOpen} onNavigate={() => {}} />
    </main>
  );
}
