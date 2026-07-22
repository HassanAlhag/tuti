import { useMemo, useState } from "react";
import { BadgeCheck, Package, Search, ShieldCheck } from "lucide-react";
import { TutiButton, TutiEmptyState } from "../../ui/customer/primitives/index.js";
import { BoutiqueCard } from "../boutiques/BoutiqueCard.jsx";
import { getShopCategories, useEnrichedBoutiques } from "../boutiques/boutiqueDirectory.js";
import "../boutiques/boutiques.css";

const CATEGORY_FILTERS = [
  { key: "all", label: "All" },
  { key: "perfume", label: "Perfumes" },
  { key: "cake", label: "Cakes & Desserts" },
  { key: "gift_box", label: "Gift Boxes" },
];

function matchesCategory(boutique, categoryKey) {
  if (categoryKey === "all") return true;
  const categories = getShopCategories(boutique).map((c) => (c === "dessert" ? "cake" : c));
  return categories.includes(categoryKey);
}

function sortBoutiques(list, sortKey) {
  if (sortKey === "rating") {
    return [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }
  if (sortKey === "newest") {
    return [...list].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }
  return list;
}

export function ShopsPage({ shops = [], goToSellerBrand, goToShop }) {
  const { boutiques } = useEnrichedBoutiques(shops);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [location, setLocation] = useState("all");
  const [sortKey, setSortKey] = useState("recommended");

  const availableLocations = useMemo(
    () => [...new Set(boutiques.map((b) => b.location).filter(Boolean))].sort(),
    [boutiques]
  );

  const availableCategoryFilters = useMemo(() => {
    const present = new Set();
    boutiques.forEach((b) => getShopCategories(b).forEach((c) => present.add(c === "dessert" ? "cake" : c)));
    return CATEGORY_FILTERS.filter((filter) => filter.key === "all" || present.has(filter.key));
  }, [boutiques]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = boutiques.filter((boutique) => {
      const matchesQuery = !q
        || boutique.title.toLowerCase().includes(q)
        || (boutique.location || "").toLowerCase().includes(q);
      const matchesLoc = location === "all" || boutique.location === location;
      return matchesQuery && matchesLoc && matchesCategory(boutique, category);
    });
    return sortBoutiques(matched, sortKey);
  }, [boutiques, query, category, location, sortKey]);

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setLocation("all");
  }

  return (
    <>
      <section className="boutique-directory-header">
        <div className="boutique-directory-header__inner">
          <span className="eyebrow">Verified boutiques</span>
          <h1>Discover boutiques worth gifting from.</h1>
          <p>
            Explore perfume houses, dessert studios, Gift Box specialists, and occasion-gifting boutiques across Tuti.
          </p>
          <div className="boutique-directory-header-chips">
            <span className="boutique-directory-header-chip"><ShieldCheck size={13} aria-hidden="true" /> Verified sellers</span>
            <span className="boutique-directory-header-chip"><Package size={13} aria-hidden="true" /> Boutique-owned preparation</span>
            <span className="boutique-directory-header-chip"><BadgeCheck size={13} aria-hidden="true" /> COD at launch</span>
          </div>
        </div>
      </section>

      <main className="page-shell boutique-directory-page">
      <div className="boutique-directory-controls">
        <div className="boutique-directory-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search boutiques"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search boutiques"
          />
        </div>

        <div className="boutique-directory-filters" role="group" aria-label="Filter by category">
          {availableCategoryFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`boutique-directory-filter${category === filter.key ? " is-active" : ""}`}
              onClick={() => setCategory(filter.key)}
              aria-pressed={category === filter.key}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {availableLocations.length > 1 ? (
          <div className="boutique-directory-sort">
            <label htmlFor="boutique-location">Location</label>
            <select id="boutique-location" value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="all">All locations</option>
              {availableLocations.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="boutique-directory-sort">
          <label htmlFor="boutique-sort">Sort</label>
          <select id="boutique-sort" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
            <option value="recommended">Recommended</option>
            <option value="rating">Rating</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      <p className="boutique-directory-count">
        {filtered.length} boutique{filtered.length === 1 ? "" : "s"}
      </p>

      {filtered.length ? (
        <div className="boutique-grid boutique-directory-grid">
          {filtered.map((boutique) => (
            <BoutiqueCard
              key={boutique.id || boutique.name}
              boutique={boutique}
              onVisit={(identifier) => (identifier ? goToSellerBrand?.(identifier) : goToShop?.("all"))}
            />
          ))}
        </div>
      ) : (
        <TutiEmptyState
          title="No boutiques match these filters."
          description="Try a different search term, category, or location."
          action={<TutiButton variant="ghost" size="sm" onClick={clearFilters}>Clear filters</TutiButton>}
        />
      )}
      </main>
    </>
  );
}
