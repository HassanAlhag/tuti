import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Filter, Search, Sparkles, X } from "lucide-react";
import categoryCakesImage from "../../assets/category-cakes.jpg";
import categoryGiftSetsImage from "../../assets/category-gift-sets.jpg";
import categoryPerfumesImage from "../../assets/category-perfumes.jpg";
import homeCompleteGiftImage from "../../assets/home-ch4-complete.png";
import { ProductCardRouter } from "./components/ProductCardRouter.jsx";

const CATEGORY_TABS = [
  { id: "all", label: "All" },
  { id: "perfume", label: "Perfumes" },
  { id: "cake", label: "Cakes & Desserts" },
  { id: "gift_box", label: "Gift Sets" },
];

const FAMILY_ORDER = ["All", "Oud", "Floral", "Musk", "Amber", "Fresh"];

const FAMILY_TONES = {
  All: "#c79b3a",
  Oud: "#7b5336",
  Floral: "#b46c8d",
  Musk: "#8f7d5b",
  Amber: "#b77e2f",
  Fresh: "#5d8e88",
};

const CATEGORY_STORIES = {
  all: {
    eyebrow: "The Tuti shop",
    title: "Gifts worth remembering.",
    description:
      "Explore boutique perfumes, artisan cakes and desserts, curated gift sets, and thoughtful combinations from Tuti sellers across the UAE.",
    image: homeCompleteGiftImage,
    imageAlt: "A finished Tuti gift box with perfume, cake, and a personal message card.",
  },
  perfume: {
    eyebrow: "Perfumes",
    title: "Boutique fragrances",
    description:
      "Discover oud, musk, amber, floral and fresh scents from independent fragrance houses.",
    image: categoryPerfumesImage,
    imageAlt: "Editorial perfume bottles styled on a dark marble surface.",
  },
  women: {
    eyebrow: "Perfumes",
    title: "Boutique fragrances",
    description:
      "Discover oud, musk, amber, floral and fresh scents from independent fragrance houses.",
    image: categoryPerfumesImage,
    imageAlt: "Editorial perfume bottles styled on a dark marble surface.",
  },
  men: {
    eyebrow: "Perfumes",
    title: "Boutique fragrances",
    description:
      "Discover oud, musk, amber, floral and fresh scents from independent fragrance houses.",
    image: categoryPerfumesImage,
    imageAlt: "Editorial perfume bottles styled on a dark marble surface.",
  },
  unisex: {
    eyebrow: "Perfumes",
    title: "Boutique fragrances",
    description:
      "Discover oud, musk, amber, floral and fresh scents from independent fragrance houses.",
    image: categoryPerfumesImage,
    imageAlt: "Editorial perfume bottles styled on a dark marble surface.",
  },
  cake: {
    eyebrow: "Cakes & Desserts",
    title: "Made for the moment",
    description:
      "Artisan cakes, desserts and sweets prepared for celebrations, milestones and thoughtful surprises.",
    image: categoryCakesImage,
    imageAlt: "An artisan celebration cake and petits fours styled for gifting.",
  },
  dessert: {
    eyebrow: "Cakes & Desserts",
    title: "Made for the moment",
    description:
      "Artisan cakes, desserts and sweets prepared for celebrations, milestones and thoughtful surprises.",
    image: categoryCakesImage,
    imageAlt: "An artisan celebration cake and petits fours styled for gifting.",
  },
  gift_box: {
    eyebrow: "Gift Sets",
    title: "Curated and ready to give",
    description:
      "Considered combinations, premium presentation and gifts designed to make the moment easier.",
    image: categoryGiftSetsImage,
    imageAlt: "A luxury gift set with perfume and celebratory details.",
  },
};

function normalizeCategory(category) {
  if (!category) return "all";
  if (category === "dessert") return "cake";
  return category;
}

function isPerfumeCategory(category) {
  return category === "perfume" || category === "women" || category === "men" || category === "unisex";
}

function matchesCategory(product, category) {
  if (category === "all") return true;
  if (category === "perfume") return !product.category || product.category === "perfume";
  if (category === "cake") return product.category === "cake" || product.category === "dessert";
  if (category === "gift_box") return product.category === "gift_box" || product.category === "bundle";
  if (category === "women") return (!product.category || product.category === "perfume") && product.gender === "Women";
  if (category === "men") return (!product.category || product.category === "perfume") && product.gender === "Men";
  if (category === "unisex") return (!product.category || product.category === "perfume") && product.gender === "Unisex";
  return product.category === category;
}

function buildResultsLabel(category, count, hasFamilyFilter) {
  if (category === "cake") {
    return count === 1 ? "cake or dessert" : "cakes and desserts";
  }
  if (category === "gift_box") {
    return count === 1 ? "curated gift set" : "curated gift sets";
  }
  if (hasFamilyFilter || isPerfumeCategory(category)) {
    return count === 1 ? "fragrance" : "fragrances";
  }
  return count === 1 ? "product" : "products";
}

function buildResultsSubcopy({ activeCategory, family, hasFamilyFilter, hasOccasion, hasSearch, pageCopy, query }) {
  if (hasSearch && hasFamilyFilter) {
    return `Showing live results for "${query.trim()}" in ${family}.`;
  }
  if (hasSearch) {
    return `Showing live results that match "${query.trim()}".`;
  }
  if (hasFamilyFilter) {
    return `Showing live ${family.toLowerCase()} fragrances only.`;
  }
  if (hasOccasion) {
    return "Filtered to the selected gifting occasion.";
  }
  if (activeCategory === "all") {
    return "Explore the current live edit from boutique sellers across the UAE.";
  }
  return pageCopy.description;
}

function buildActiveFilterChips({ activeCategory, activeOccasion, family, hasFamilyFilter, query }) {
  const chips = [];
  if (activeCategory !== "all") {
    const label = CATEGORY_TABS.find((tab) => tab.id === activeCategory)?.label || "Perfumes";
    chips.push(label);
  }
  if (query.trim()) chips.push(`Search: ${query.trim()}`);
  if (activeOccasion) chips.push(`Occasion: ${activeOccasion}`);
  if (hasFamilyFilter) chips.push(`Family: ${family}`);
  return chips;
}

function getEmptyState({ activeCategory, hasActiveFilters, hasFamilyFilter, hasOccasion, hasSearch, query }) {
  if (hasSearch) {
    return {
      title: `No results for "${query.trim()}"`,
      text: "Try a shorter search, a broader category, or clear your filters to explore more products.",
      primaryAction: "Clear search & filters",
      secondaryAction: "Browse all products",
    };
  }

  if (hasFamilyFilter || hasOccasion) {
    return {
      title: "No products match those filters",
      text: "Try another fragrance family or clear the current filters to widen the selection.",
      primaryAction: "Clear filters",
      secondaryAction: "Browse all products",
    };
  }

  if (activeCategory === "gift_box") {
    return {
      title: "No gift sets available yet",
      text: "Explore all products or build a more personal gift with perfume, cake, and a message.",
      primaryAction: hasActiveFilters ? "Clear filters" : "Build your box",
      secondaryAction: "Browse all products",
    };
  }

  if (activeCategory === "cake") {
    return {
      title: "No cakes or desserts available yet",
      text: "Try another category or return to the full Tuti edit to discover perfumes and gift sets.",
      primaryAction: hasActiveFilters ? "Clear filters" : "Browse all products",
      secondaryAction: "Explore perfumes",
    };
  }

  if (isPerfumeCategory(activeCategory)) {
    return {
      title: "No fragrances available yet",
      text: "Try another family or explore the full Tuti shop to discover cakes, desserts, and gift sets too.",
      primaryAction: hasActiveFilters ? "Clear filters" : "Browse all products",
      secondaryAction: "Explore gift sets",
    };
  }

  return {
    title: "No products available yet",
    text: "Try another category or come back soon to discover the latest from Tuti boutiques.",
    primaryAction: hasActiveFilters ? "Clear filters" : "Browse perfumes",
    secondaryAction: "Build your box",
  };
}

function CategoryHero({ pageCopy, visualCategory }) {
  return (
    <section className={`shop-hero shop-hero--${visualCategory}`}>
      <img className="shop-hero-image" src={pageCopy.image} alt={pageCopy.imageAlt} />
      <div className="shop-hero-wash" />
      <div className="shop-hero-copy">
        <span className="eyebrow">{pageCopy.eyebrow}</span>
        <h1>{pageCopy.title}</h1>
        <p>{pageCopy.description}</p>
      </div>
    </section>
  );
}

function BuildBoxInsertion({ onNavigatePath }) {
  return (
    <article className="shop-build-insert">
      <div className="shop-build-insert-copy">
        <span className="eyebrow">Only at Tuti</span>
        <h3>Pair a scent with something sweet.</h3>
        <p>
          Choose a perfume, add a cake or dessert, and include your personal message in one considered gift.
        </p>
        <button className="secondary-action" type="button" onClick={() => onNavigatePath("/build-a-box")}>
          Build your box <ArrowRight size={16} />
        </button>
      </div>
      <button
        className="shop-build-insert-media"
        type="button"
        onClick={() => onNavigatePath("/build-a-box")}
        aria-label="Open Build a Box"
      >
        <img
          src={homeCompleteGiftImage}
          alt="A finished Tuti gift box with perfume, cake, and a message card."
          loading="lazy"
          decoding="async"
        />
      </button>
    </article>
  );
}

export function StorefrontPage({
  families,
  family,
  filteredProducts,
  getShop,
  onViewProduct,
  query,
  setFamily,
  setQuery,
  setSelectedReviewProductId,
  onAddToCart,
  onCategoryChange,
  initialCategory = "all",
  initialOccasion = "",
}) {
  const [activeCategory, setActiveCategory] = useState(normalizeCategory(initialCategory));
  const [activeOccasion, setActiveOccasion] = useState(initialOccasion);

  useEffect(() => {
    const nextCategory = normalizeCategory(initialCategory) || "all";
    setActiveCategory(nextCategory);
    setActiveOccasion(initialOccasion || "");
    if (!(nextCategory === "all" || isPerfumeCategory(nextCategory)) && family !== "All") {
      setFamily("All");
    }
  }, [family, initialCategory, initialOccasion, setFamily]);

  const orderedFamilies = useMemo(() => {
    const available = families.filter(Boolean);
    return [
      ...FAMILY_ORDER.filter((item) => available.includes(item)),
      ...available.filter((item) => !FAMILY_ORDER.includes(item)),
    ];
  }, [families]);

  const liveProducts = useMemo(
    () => filteredProducts.filter((product) => product.status === "Live"),
    [filteredProducts]
  );

  const categoryFiltered = useMemo(
    () => liveProducts.filter((product) => {
      if (!matchesCategory(product, activeCategory)) return false;
      if (activeOccasion && !(product.occasionTags || []).includes(activeOccasion)) return false;
      return true;
    }),
    [activeCategory, activeOccasion, liveProducts]
  );

  const visualCategory = activeCategory === "dessert" ? "cake" : isPerfumeCategory(activeCategory) ? "perfume" : activeCategory;
  const pageCopy = CATEGORY_STORIES[activeCategory] || CATEGORY_STORIES[visualCategory] || CATEGORY_STORIES.all;
  const showFamilyFilters = activeCategory === "all" || isPerfumeCategory(activeCategory);
  const hasSearch = Boolean(query.trim());
  const hasOccasion = Boolean(activeOccasion);
  const hasFamilyFilter = showFamilyFilters && family && family !== "All";
  const hasCategoryFilter = activeCategory !== "all";
  const hasActiveFilters = hasSearch || hasOccasion || hasFamilyFilter || hasCategoryFilter;
  const resultsLabel = buildResultsLabel(activeCategory, categoryFiltered.length, hasFamilyFilter);
  const resultsSubcopy = buildResultsSubcopy({
    activeCategory,
    family,
    hasFamilyFilter,
    hasOccasion,
    hasSearch,
    pageCopy,
    query,
  });
  const activeFilterChips = buildActiveFilterChips({
    activeCategory,
    activeOccasion,
    family,
    hasFamilyFilter,
    query,
  });
  const emptyState = getEmptyState({
    activeCategory,
    hasActiveFilters,
    hasFamilyFilter,
    hasOccasion,
    hasSearch,
    query,
  });
  const viewProduct = onViewProduct || setSelectedReviewProductId;
  const shouldShowBuildInsert = categoryFiltered.length > 6 && ["all", "perfume", "women", "men", "unisex", "gift_box"].includes(activeCategory);
  const gridMode = categoryFiltered.length <= 1 ? "single" : categoryFiltered.length === 2 ? "pair" : "grid";

  const collectionItems = useMemo(() => {
    const items = [];
    categoryFiltered.forEach((product, index) => {
      items.push({ type: "product", key: product.id, product });
      if (shouldShowBuildInsert && index === 5) {
        items.push({ type: "build-box", key: "shop-build-box-insert" });
      }
    });
    return items;
  }, [categoryFiltered, shouldShowBuildInsert]);

  function navigateToPath(path) {
    window.history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectCategory(category) {
    const next = normalizeCategory(category);
    if (!(next === "all" || isPerfumeCategory(next)) && family !== "All") {
      setFamily("All");
    }
    if (onCategoryChange) {
      onCategoryChange(next);
      return;
    }
    setActiveCategory(next);
  }

  function clearAllFilters() {
    selectCategory("all");
    setFamily("All");
    setQuery("");
    setActiveOccasion("");
  }

  function handleEmptyPrimaryAction() {
    if (emptyState.primaryAction === "Build your box") {
      navigateToPath("/build-a-box");
      return;
    }
    if (emptyState.primaryAction === "Explore perfumes") {
      selectCategory("perfume");
      return;
    }
    if (emptyState.primaryAction === "Browse perfumes") {
      selectCategory("perfume");
      return;
    }
    clearAllFilters();
  }

  function handleEmptySecondaryAction() {
    if (emptyState.secondaryAction === "Build your box") {
      navigateToPath("/build-a-box");
      return;
    }
    if (emptyState.secondaryAction === "Explore perfumes") {
      selectCategory("perfume");
      return;
    }
    if (emptyState.secondaryAction === "Explore gift sets") {
      selectCategory("gift_box");
      return;
    }
    clearAllFilters();
  }

  return (
    <main className="shop-page">
      <CategoryHero pageCopy={pageCopy} visualCategory={visualCategory} />

      <section className="shop-shell">
        <nav className="shop-category-nav" aria-label="Shop categories">
          {CATEGORY_TABS.map((tab) => {
            const pressed = normalizeCategory(activeCategory) === tab.id || (isPerfumeCategory(activeCategory) && tab.id === "perfume");
            return (
              <button
                key={tab.id}
                className={pressed ? "shop-category-button active" : "shop-category-button"}
                type="button"
                aria-pressed={pressed}
                onClick={() => selectCategory(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <section className="shop-filter-shell" aria-label="Search and filters">
          <div className="shop-search-panel">
            <label className="shop-search-field">
              <Search size={18} />
              <input
                id="catalog-search-input"
                type="search"
                placeholder="Search products, boutiques or occasions"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search products, boutiques or occasions"
              />
              {query ? (
                <button
                  className="shop-search-clear"
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              ) : null}
            </label>

            {showFamilyFilters ? (
              <div className="shop-family-filter">
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
                      <span
                        className="shop-family-dot"
                        style={{ "--family-tone": FAMILY_TONES[item] || FAMILY_TONES.All }}
                        aria-hidden="true"
                      />
                      {item === "All" ? (
                        <>
                          <Filter size={14} />
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
          </div>

          <section className="shop-results-bar" aria-live="polite">
            <div className="shop-results-copy">
              <span className="eyebrow">{pageCopy.eyebrow}</span>
              <h2>
                {categoryFiltered.length} {resultsLabel}
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
                <button className="ghost-action compact" type="button" onClick={clearAllFilters}>
                  Clear all
                </button>
              ) : null}
            </div>
          </section>
        </section>

        {categoryFiltered.length ? (
          <>
            <section className={`product-grid shop-product-grid shop-product-grid--${gridMode}`} aria-label={`${pageCopy.eyebrow} product collection`}>
              {collectionItems.map((item) => {
                if (item.type === "build-box") {
                  return (
                    <div key={item.key} className="shop-grid-feature">
                      <BuildBoxInsertion onNavigatePath={navigateToPath} />
                    </div>
                  );
                }
                return (
                  <ProductCardRouter
                    key={item.key}
                    product={item.product}
                    shop={getShop(item.product.shopId)}
                    onAddToCart={onAddToCart}
                    onRateProduct={() => viewProduct?.(item.product.id)}
                    onViewProduct={() => viewProduct?.(item.product.id)}
                  />
                );
              })}
            </section>

            <section className="shop-results-end" aria-label="End of results">
              <p>You’ve reached the end of this edit.</p>
              <div className="shop-results-end-actions">
                {hasActiveFilters ? (
                  <button className="secondary-action compact" type="button" onClick={clearAllFilters}>
                    Clear filters
                  </button>
                ) : activeCategory !== "all" ? (
                  <button className="secondary-action compact" type="button" onClick={() => selectCategory("all")}>
                    Browse all products
                  </button>
                ) : null}
                <button className="ghost-action compact" type="button" onClick={() => navigateToPath("/build-a-box")}>
                  Build your box
                </button>
              </div>
            </section>
          </>
        ) : (
          <section className="shop-empty-state" role="status" aria-live="polite">
            <Sparkles size={20} />
            <h2>{emptyState.title}</h2>
            <p>{emptyState.text}</p>
            <div className="shop-empty-actions">
              <button className="secondary-action" type="button" onClick={handleEmptyPrimaryAction}>
                {emptyState.primaryAction}
              </button>
              <button className="ghost-action" type="button" onClick={handleEmptySecondaryAction}>
                {emptyState.secondaryAction}
              </button>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
