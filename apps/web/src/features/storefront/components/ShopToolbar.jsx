import { ArrowUpDown, Filter, Search, SlidersHorizontal, X } from "lucide-react";

export const SHOP_SORT_OPTIONS = [
  { id: "featured", label: "Featured" },
  { id: "newest", label: "Newest" },
  { id: "price-asc", label: "Price: Low to High" },
  { id: "price-desc", label: "Price: High to Low" },
];

export function ShopToolbar({
  query,
  setQuery,
  sort,
  setSort,
  categoryTabs,
  activeCategory,
  onSelectCategory,
  showFamilyFilters,
  orderedFamilies,
  family,
  setFamily,
  familyTones,
  hasFamilyFilter,
  filterCount,
  onOpenDrawer,
  resultsEyebrow,
  resultsCount,
  resultsLabel,
  resultsSubcopy,
  activeFilterChips,
  hasActiveFilters,
  onClearAll,
}) {
  return (
    <section className="shop-toolbar" aria-label="Search, filters and sorting">
      <div className="shop-toolbar-controls">
        <label className="shop-search-field">
          <Search size={18} aria-hidden="true" />
          <input
            id="catalog-search-input"
            type="search"
            placeholder="Search products, boutiques or occasions"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search products, boutiques or occasions"
          />
          {query ? (
            <button className="shop-search-clear" type="button" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={16} aria-hidden="true" />
            </button>
          ) : null}
        </label>

        <label className="shop-sort" htmlFor="shop-sort-select">
          <span>Sort</span>
          <span className="shop-sort-control">
            <ArrowUpDown size={14} aria-hidden="true" />
            <select id="shop-sort-select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products">
              {SHOP_SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </span>
        </label>

        {showFamilyFilters ? (
          <button className="shop-filter-toggle" type="button" onClick={onOpenDrawer} aria-haspopup="dialog">
            <SlidersHorizontal size={16} aria-hidden="true" />
            Filters
            {filterCount > 0 ? <span className="shop-filter-count">{filterCount}</span> : null}
          </button>
        ) : null}
      </div>

      <nav className="shop-category-nav" aria-label="Shop categories">
        {categoryTabs.map((tab) => {
          const pressed = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              className={pressed ? "shop-category-button active" : "shop-category-button"}
              type="button"
              aria-pressed={pressed}
              onClick={() => onSelectCategory(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {showFamilyFilters ? (
        <div className="shop-family-filter shop-family-filter--inline">
          <div className="shop-filter-heading">
            <span>Fragrance family</span>
            {hasFamilyFilter ? (
              <button className="shop-filter-reset" type="button" onClick={() => setFamily("All")}>
                Reset
              </button>
            ) : null}
          </div>
          <div className="shop-family-chips" aria-label="Perfume families">
            {orderedFamilies.map((item) => (
              <button
                key={item}
                className={family === item ? "shop-family-chip active" : "shop-family-chip"}
                type="button"
                onClick={() => setFamily(item)}
              >
                <span className="shop-family-dot" style={{ "--family-tone": familyTones[item] || familyTones.All }} aria-hidden="true" />
                {item === "All" ? (
                  <>
                    <Filter size={14} aria-hidden="true" />
                    {item}
                  </>
                ) : (
                  item
                )}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <section className="shop-results-bar" aria-live="polite">
        <div className="shop-results-copy">
          <span className="eyebrow">{resultsEyebrow}</span>
          <h2>
            {resultsCount} {resultsLabel}
          </h2>
          <p>{resultsSubcopy}</p>
        </div>
        <div className="shop-results-meta">
          {activeFilterChips.length ? (
            <div className="shop-active-filters">
              {activeFilterChips.map((chip) => (
                <span key={chip}>{chip}</span>
              ))}
            </div>
          ) : (
            <div className="shop-active-filters shop-active-filters--quiet">
              <span>Live catalogue</span>
            </div>
          )}
          {hasActiveFilters ? (
            <button className="ghost-action compact" type="button" onClick={onClearAll}>
              Clear all
            </button>
          ) : null}
        </div>
      </section>
    </section>
  );
}
