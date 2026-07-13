import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CreditCard, ShieldCheck, Sparkles, Truck, Wand2 } from "lucide-react";
import homeCompleteGiftImage from "../../assets/home-ch4-complete.png";
import { TutiButton, TutiCard, TutiEmptyState } from "../../ui/customer/primitives/index.js";
import { TutiProductGrid, TutiTrustStrip } from "../../ui/customer/commerce/index.js";
import { ShopToolbar } from "./components/ShopToolbar.jsx";
import { ShopFilterDrawer } from "./components/ShopFilterDrawer.jsx";

const CATEGORY_TABS = [
  { id: "all", label: "All" },
  { id: "perfume", label: "Perfumes" },
  { id: "cake", label: "Cakes & Desserts" },
  { id: "gift_box", label: "Gift Boxes" },
];

const FAMILY_ORDER = ["All", "Oud", "Floral", "Musk", "Amber", "Fresh"];

const FAMILY_TONES = {
  All: "#B88A2E",
  Oud: "#7b5336",
  Floral: "#b46c8d",
  Musk: "#8f7d5b",
  Amber: "#b77e2f",
  Fresh: "#5d8e88",
};

const SHOP_TRUST_ITEMS = [
  {
    id: "verified",
    title: "Verified boutiques",
    text: "Shop from approved sellers with live catalogue controls.",
    icon: <ShieldCheck size={18} />,
  },
  {
    id: "delivery",
    title: "UAE delivery windows",
    text: "Choose gifts prepared for same-day and scheduled moments.",
    icon: <Truck size={18} />,
  },
  {
    id: "cod",
    title: "COD-ready checkout",
    text: "Pay on delivery while online payments are being integrated.",
    icon: <CreditCard size={18} />,
  },
];

const CATEGORY_STORIES = {
  all: {
    eyebrow: "The Tuti shop",
    description:
      "Explore boutique perfumes, artisan cakes and desserts, curated gift boxes, and thoughtful combinations from Tuti sellers across the UAE.",
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
    eyebrow: "Gift Boxes",
    description: "Browse ready-made graduation gifts, occasion boxes, curated packages, and boutique Gift Boxes.",
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
    return count === 1 ? "gift box" : "gift boxes";
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
      primaryAction: "Build a gift",
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
      title: "No gift boxes available yet",
      text: "Explore all products or build a personalised gift through Build a Gift.",
      primaryAction: hasActiveFilters ? "Clear filters" : "Build a gift",
      secondaryAction: "Browse all products",
    };
  }

  if (activeCategory === "cake") {
    return {
      title: "No cakes or desserts available yet",
      text: "Try another category or return to the full Tuti edit to discover perfumes and gift boxes.",
      primaryAction: hasActiveFilters ? "Clear filters" : "Browse all products",
      secondaryAction: "Explore perfumes",
    };
  }

  if (isPerfumeCategory(activeCategory)) {
    return {
      title: "No fragrances available yet",
      text: "Try another family or explore the full Tuti shop to discover cakes, desserts, and gift boxes too.",
      primaryAction: hasActiveFilters ? "Clear filters" : "Browse all products",
      secondaryAction: "Explore gift boxes",
    };
  }

  return {
    title: "No gifts match these filters yet",
    text: "Try another category or come back soon to discover the latest from Tuti boutiques.",
    primaryAction: hasActiveFilters ? "Clear filters" : "Browse perfumes",
    secondaryAction: "Build a gift",
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
          <p>Boutique perfumes, artisan cakes and desserts, and curated gift boxes from sellers across the UAE.</p>
          <div className="shop-header-actions">
            <TutiButton as="a" href="#shop-results" size="lg">
              Browse gifts
            </TutiButton>
            <TutiButton variant="soft" size="lg" icon={<Wand2 size={16} />} onClick={onFindScent}>
              Find a scent
            </TutiButton>
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
    <TutiCard as="article" variant="section" padding="none" className="shop-build-insert">
      <div className="shop-build-insert-copy">
        <span className="eyebrow">Only at Tuti</span>
        <h3>Build a personalised gift from one boutique.</h3>
        <p>
          Select your products from one boutique, add a personal message, and create one complete gift item.
        </p>
        <TutiButton variant="secondary" onClick={() => onNavigatePath("/build-a-box")} icon={<ArrowRight size={16} />} iconPosition="right">
          Build a gift
        </TutiButton>
      </div>
      <button
        className="shop-build-insert-media"
        type="button"
        onClick={() => onNavigatePath("/build-a-box")}
        aria-label="Open Build a Gift"
      >
        <img
          src={homeCompleteGiftImage}
          alt="A finished Tuti gift box with perfume, cake, and a message card."
          loading="lazy"
          decoding="async"
        />
      </button>
    </TutiCard>
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
  const drawerFilterCount = hasFamilyFilter ? 1 : 0;

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
    if (emptyState.primaryAction === "Build a gift") {
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
    if (emptyState.secondaryAction === "Build a gift") {
      navigateToPath("/build-a-box");
      return;
    }
    if (emptyState.secondaryAction === "Explore perfumes") {
      selectCategory("perfume");
      return;
    }
    if (emptyState.secondaryAction === "Explore gift boxes") {
      selectCategory("gift_box");
      return;
    }
    clearAllFilters();
  }

  return (
    <main className="shop-page">
      <ShopHeader totalCount={liveProducts.length} onFindScent={() => navigateToPath("/fragrance-finder")} />

      <section className="shop-shell">
        <TutiTrustStrip items={SHOP_TRUST_ITEMS} variant="compact" className="shop-trust-strip" />

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
            <section id="shop-results" className="shop-results-section" aria-label={`${pageCopy.eyebrow} product collection`}>
              <TutiProductGrid
                products={sortedProducts}
                getShop={getShop}
                variant="catalog"
                className="shop-product-grid"
                onAddToCart={onAddToCart}
                onViewProduct={(productId) => viewProduct?.(productId)}
              />
            </section>

            {["all", "perfume", "women", "men", "unisex", "gift_box"].includes(activeCategory) ? (
              <BuildBoxInsertion onNavigatePath={navigateToPath} />
            ) : null}

            <section className="shop-results-end" aria-label="End of results">
              <p>You’ve reached the end of this edit.</p>
              <div className="shop-results-end-actions">
                {hasActiveFilters ? (
                  <TutiButton variant="secondary" size="sm" onClick={clearAllFilters}>
                    Clear filters
                  </TutiButton>
                ) : activeCategory !== "all" ? (
                  <TutiButton variant="secondary" size="sm" onClick={() => selectCategory("all")}>
                    Browse all products
                  </TutiButton>
                ) : null}
                <TutiButton variant="ghost" size="sm" onClick={() => navigateToPath("/build-a-box")}>
                  Build a gift
                </TutiButton>
              </div>
            </section>
          </>
        ) : (
          <TutiEmptyState
            className="shop-empty-state"
            role="status"
            aria-live="polite"
            icon={<Sparkles size={20} />}
            title={emptyState.title}
            description={emptyState.text}
            action={(
              <div className="shop-empty-actions">
                <TutiButton variant="secondary" onClick={handleEmptyPrimaryAction}>
                  {emptyState.primaryAction}
                </TutiButton>
                <TutiButton variant="ghost" onClick={handleEmptySecondaryAction}>
                  {emptyState.secondaryAction}
                </TutiButton>
              </div>
            )}
          />
        )}
      </section>
    </main>
  );
}
