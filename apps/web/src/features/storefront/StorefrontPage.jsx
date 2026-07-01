import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Sparkles, Wand2 } from "lucide-react";
import homeCompleteGiftImage from "../../assets/home-ch4-complete.png";
import { ProductCardRouter } from "./components/ProductCardRouter.jsx";
import { ShopToolbar } from "./components/ShopToolbar.jsx";
import { ShopFilterDrawer } from "./components/ShopFilterDrawer.jsx";

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
    description:
      "Explore boutique perfumes, artisan cakes and desserts, curated gift sets, and thoughtful combinations from Tuti sellers across the UAE.",
  },
  perfume: {
    eyebrow: "Perfumes",
    description: "Discover oud, musk, amber, floral and fresh scents from independent fragrance houses.",
  },
  women: {
    eyebrow: "Perfumes",
    description: "Discover oud, musk, amber, floral and fresh scents from independent fragrance houses.",
  },
  men: {
    eyebrow: "Perfumes",
    description: "Discover oud, musk, amber, floral and fresh scents from independent fragrance houses.",
  },
  unisex: {
    eyebrow: "Perfumes",
    description: "Discover oud, musk, amber, floral and fresh scents from independent fragrance houses.",
  },
  cake: {
    eyebrow: "Cakes & Desserts",
    description: "Artisan cakes, desserts and sweets prepared for celebrations, milestones and thoughtful surprises.",
  },
  dessert: {
    eyebrow: "Cakes & Desserts",
    description: "Artisan cakes, desserts and sweets prepared for celebrations, milestones and thoughtful surprises.",
  },
  gift_box: {
    eyebrow: "Gift Sets",
    description: "Considered combinations, premium presentation and gifts designed to make the moment easier.",
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

function sortProducts(products, sort) {
  if (sort === "price-asc") return [...products].sort((a, b) => a.price - b.price);
  if (sort === "price-desc") return [...products].sort((a, b) => b.price - a.price);
  if (sort === "newest") return [...products].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return products;
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

function getEmptyState({ activeCategory, hasActiveFilters, hasAnyLiveProducts, hasFamilyFilter, hasOccasion, hasSearch, query }) {
  // hasAnyLiveProducts only means anything with no search/category/family/occasion
  // filter applied — filteredProducts (and so liveProducts) is pre-reduced by
  // App.jsx's own search/family matching, so this signal is only trustworthy
  // when nothing upstream has already narrowed the set. With any filter active,
  // a 0 count is a filter-empty result, not a marketplace-wide empty one.
  if (!hasActiveFilters && !hasAnyLiveProducts) {
    return {
      title: "No products in the marketplace yet",
      text: "Our boutique sellers are preparing their next drop. Check back soon, or build a personal gift instead.",
      primaryAction: "Build your box",
      secondaryAction: "Browse all products",
    };
  }

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
      title: "No gifts match these filters yet",
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
    title: "No gifts match these filters yet",
    text: "Try another category or come back soon to discover the latest from Tuti boutiques.",
    primaryAction: hasActiveFilters ? "Clear filters" : "Browse perfumes",
    secondaryAction: "Build your box",
  };
}

function ShopHeader({ totalCount, onFindScent }) {
  return (
    <section className="shop-header" aria-labelledby="shop-header-title">
      <div className="shop-header-inner">
        <div className="shop-header-copy">
          <span className="shop-header-badge">
            <Wand2 size={12} aria-hidden="true" />
            AI-assisted shopping
          </span>
          <span className="eyebrow">Shop Tuti</span>
          <h1 id="shop-header-title">Find the right gift for the moment.</h1>
          <p>Boutique perfumes, artisan cakes and desserts, and curated gift sets from sellers across the UAE.</p>
          <div className="shop-header-command" aria-label="AI shop command preview">
            <span className="shop-header-command-orb" aria-hidden="true">AI</span>
            <span>
              <strong>Search oud, pistachio cake, or a same-day gift box.</strong>
              <small>Liquid search, smart filters, and live boutique availability stay in sync below.</small>
            </span>
          </div>
        </div>
        <div className="shop-header-showcase" aria-label="Perfume cake and gift shop preview">
          <div className="shop-showcase-light" aria-hidden="true" />
          <div className="shop-showcase-ring" aria-hidden="true" />
          <div className="shop-showcase-products" aria-hidden="true">
            <span className="shop-showcase-gift">
              <i className="shop-showcase-gift-box" />
              <i className="shop-showcase-gift-lid" />
              <i className="shop-showcase-gift-ribbon-v" />
              <i className="shop-showcase-gift-ribbon-h" />
              <i className="shop-showcase-gift-seal">T</i>
            </span>
            <span className="shop-showcase-perfume">
              <i className="shop-showcase-perfume-cap" />
              <i className="shop-showcase-perfume-neck" />
              <i className="shop-showcase-perfume-bottle" />
              <i className="shop-showcase-perfume-label">OUD</i>
            </span>
            <span className="shop-showcase-cake">
              <i className="shop-showcase-cake-plate" />
              <i className="shop-showcase-cake-body" />
              <i className="shop-showcase-cake-cream" />
            </span>
          </div>
          <div className="shop-header-meta">
            <span className="shop-header-count">
              {totalCount} live {totalCount === 1 ? "product" : "products"}
            </span>
            <button className="shop-ai-button shop-ai-button--header" type="button" onClick={onFindScent}>
              <Wand2 size={16} aria-hidden="true" />
              Help me choose
            </button>
          </div>
        </div>
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
          Build your box <ArrowRight size={16} aria-hidden="true" />
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
  const [sort, setSort] = useState("featured");
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const sortedProducts = useMemo(() => sortProducts(categoryFiltered, sort), [categoryFiltered, sort]);

  const visualCategory = activeCategory === "dessert" ? "cake" : isPerfumeCategory(activeCategory) ? "perfume" : activeCategory;
  const pageCopy = CATEGORY_STORIES[activeCategory] || CATEGORY_STORIES[visualCategory] || CATEGORY_STORIES.all;
  const showFamilyFilters = activeCategory === "all" || isPerfumeCategory(activeCategory);
  const hasSearch = Boolean(query.trim());
  const hasOccasion = Boolean(activeOccasion);
  const hasFamilyFilter = showFamilyFilters && family && family !== "All";
  const hasCategoryFilter = activeCategory !== "all";
  const hasActiveFilters = hasSearch || hasOccasion || hasFamilyFilter || hasCategoryFilter;
  const hasAnyLiveProducts = liveProducts.length > 0;
  const resultsLabel = buildResultsLabel(activeCategory, sortedProducts.length, hasFamilyFilter);
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
    hasAnyLiveProducts,
    hasFamilyFilter,
    hasOccasion,
    hasSearch,
    query,
  });
  const viewProduct = onViewProduct || setSelectedReviewProductId;
  const shouldShowBuildInsert = sortedProducts.length > 6 && ["all", "perfume", "women", "men", "unisex", "gift_box"].includes(activeCategory);
  const gridMode = sortedProducts.length <= 1 ? "single" : sortedProducts.length === 2 ? "pair" : "grid";
  const drawerFilterCount = hasFamilyFilter ? 1 : 0;

  const collectionItems = useMemo(() => {
    const items = [];
    sortedProducts.forEach((product, index) => {
      items.push({ type: "product", key: product.id, product });
      if (shouldShowBuildInsert && index === 5) {
        items.push({ type: "build-box", key: "shop-build-box-insert" });
      }
    });
    return items;
  }, [sortedProducts, shouldShowBuildInsert]);

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
      <ShopHeader totalCount={liveProducts.length} onFindScent={() => navigateToPath("/fragrance-finder")} />

      <section className="shop-shell">
        <ShopToolbar
          query={query}
          setQuery={setQuery}
          sort={sort}
          setSort={setSort}
          categoryTabs={CATEGORY_TABS}
          activeCategory={normalizeCategory(activeCategory) === "perfume" || isPerfumeCategory(activeCategory) ? "perfume" : normalizeCategory(activeCategory)}
          onSelectCategory={selectCategory}
          showFamilyFilters={showFamilyFilters}
          orderedFamilies={orderedFamilies}
          family={family}
          setFamily={setFamily}
          familyTones={FAMILY_TONES}
          hasFamilyFilter={hasFamilyFilter}
          filterCount={drawerFilterCount}
          onOpenDrawer={() => setDrawerOpen(true)}
          resultsEyebrow={pageCopy.eyebrow}
          resultsCount={sortedProducts.length}
          resultsLabel={resultsLabel}
          resultsSubcopy={resultsSubcopy}
          activeFilterChips={activeFilterChips}
          hasActiveFilters={hasActiveFilters}
          onClearAll={clearAllFilters}
        />

        <ShopFilterDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          orderedFamilies={orderedFamilies}
          family={family}
          setFamily={setFamily}
          familyTones={FAMILY_TONES}
          hasFamilyFilter={hasFamilyFilter}
          onClearAll={clearAllFilters}
        />

        {sortedProducts.length ? (
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
            <Sparkles size={20} aria-hidden="true" />
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
