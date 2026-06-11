# Tuti Shop — Accepted Milestone

**Status:** ACCEPTED / FROZEN  
**Last QA:** 2026-06-08  
**Build:** PASS

---

## Summary

The Shop is implemented as `StorefrontPage` (exported as `ShopPage`). It opens with a full-bleed category hero, followed by category navigation tabs, text search, perfume-family filtering, an adaptive product grid with differentiated card types per product category, an editorial Build a Box insertion, and category-specific differentiated empty states.

---

## Routes

| Route | Component | Notes |
|---|---|---|
| `/shop` | `StorefrontPage` | All products; "Gifts worth remembering" hero |
| `/shop?c=perfume` | `StorefrontPage` | Perfumes; editorial perfume hero image |
| `/shop?c=cake` | `StorefrontPage` | Cakes & Desserts; warm cake hero image |
| `/shop?c=gift_box` | `StorefrontPage` | Gift Sets; gift sets hero image |
| `/shop?c=dessert` | `StorefrontPage` | Normalised to `cake` internally |
| `/shop?occasion=birthday` | `StorefrontPage` | Occasion-filtered perfumes |

`ShopPage.jsx` is a one-line re-export of `StorefrontPage`.

---

## Files

| File | Role |
|---|---|
| `apps/web/src/features/pages/ShopPage.jsx` | Re-export of `StorefrontPage` |
| `apps/web/src/features/storefront/StorefrontPage.jsx` | Full shop implementation |
| `apps/web/src/features/storefront/components/ProductCard.jsx` | Perfume product card |
| `apps/web/src/features/storefront/components/CakeCard.jsx` | Cake/dessert product card |
| `apps/web/src/features/storefront/components/GiftBoxCard.jsx` | Gift set/bundle product card |
| `apps/web/src/features/storefront/components/ProductCardRouter.jsx` | Routes each product to the correct card type by category |
| `apps/web/src/styles/storefront.css` | Grid, card, hero, and filter styles |

---

## Page Structure (top to bottom)

### 1. Category Hero (`CategoryHero`)

Full-bleed editorial image with an overlaid wash, eyebrow, h1, and description. The image and copy switch to match the active category:

| Category | Hero image | Eyebrow | Title |
|---|---|---|---|
| all | `home-ch4-complete.png` (completed gift box) | The Tuti shop | Gifts worth remembering. |
| perfume | `category-perfumes.jpg` | Perfumes | Boutique fragrances |
| cake / dessert | `category-cakes.jpg` | Cakes & Desserts | Made for the moment |
| gift_box | `category-gift-sets.jpg` | Gift Sets | Curated and ready to give |

### 2. Category Navigation Tabs

Four tabs: **All** · **Perfumes** · **Cakes & Desserts** · **Gift Sets**. Switching tabs updates the URL (`?c=` param) and re-filters the grid. Active tab is highlighted.

### 3. Search and Filters Bar

Inline search input (filters the loaded storefront product list client-side). When in the Perfumes category, a row of family filter chips appears: **All · Oud · Floral · Musk · Amber · Fresh** (coloured per family tone). Active filters appear as dismissible chips below the bar.

### 4. Results Count and Subcopy

Live count of visible products with contextual label ("fragrances", "cakes and desserts", "curated gift sets", "products"). A subcopy line adapts to describe the current filter state (search match, family filter, occasion filter, or default category description).

### 5. Adaptive Product Grid

`ProductCardRouter` dispatches each product to the correct card variant:
- `ProductCard` — perfumes (bottle art, family, notes, rating)
- `CakeCard` — cakes and desserts (occasion tags, flavors, servings)
- `GiftBoxCard` — gift sets and bundles (includes list, occasion tags)

### 6. Build a Box Editorial Insertion (`BuildBoxInsertion`)

Appears inline within the grid at a fixed position (not at the top or bottom). Copy: "Pair a scent with something sweet." CTA links to `/build-a-box`. Visible on all category views.

### 7. Differentiated Empty States

Each category has its own empty-state title, text, and CTA pair when no products match the current filter combination:

- **Search miss:** "No results for '[query]'" → clear search & filters
- **Family / occasion filter:** "No products match those filters" → clear filters
- **Gift Sets empty:** redirects to Build a Box
- **Cakes empty:** redirects to full catalogue
- **Perfumes empty:** redirects to full catalogue or gift sets
- **Generic:** "No products available yet"

---

## Filtering Logic

All filtering is client-side over the storefront data loaded at app boot.

| Filter | Mechanism |
|---|---|
| Category | `?c=` query param; `matchesCategory()` function; `cake` normalises `dessert` |
| Text search | Topbar search dispatches to ShopPage via `catalog-search-input` input event |
| Occasion | `?occasion=` query param |
| Family (perfume view only) | Local UI state; chip row shown only when active category is perfume-type |

---

## APIs Used

| Endpoint | Purpose |
|---|---|
| `GET /api/marketplace/storefront` | Products, shops, collections loaded at app boot |

---

## Known Limitations

- All filtering is client-side; no server-side filtering or pagination. Acceptable at current catalogue size.
- No explicit sort control beyond the default order.
- Search does not use a full-text index; basic string match on name, family, gender, shop name, notes, tags, and occasion tags.

---

## Build Status

`npm run build -w @tuti/web` — PASS (verified 2026-06-08)

## QA Status

- Category hero (all, perfume, cake, gift_box): PASS (confirmed via accepted QA screenshots)
- Category tabs: PASS
- Family filter chips (perfume view): PASS
- Product grid (perfume, cake, gift box card types): PASS
- Build a Box insertion: PASS
- Differentiated empty states: PASS
- Mobile layout: PASS (one-column grid, filter button opens panel)
