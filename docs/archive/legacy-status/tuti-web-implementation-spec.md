# Tuti Web — Implementation Specification
## Navigation · Discoverability · Story Images · Transparent Header

**Date:** 2026-06-07  
**Status:** Ready for implementation  
**Scope:** `apps/web/` only. No backend, auth, or dashboard changes.

---

## 1. Current Route Inventory

Derived from `apps/web/src/App.jsx`. No routes are renamed or removed.

| Route key | URL pattern | Page rendered |
|---|---|---|
| `home` | `/` | `HomePage` |
| `experience-preview` | `/experience-preview` | `ImmersivePreviewPage` |
| `shop` | `/shop` + `?c=` query | `ShopPage` |
| `product` | `/products/:id` | `ProductPage` |
| `cart` | `/cart` | `CartPage` |
| `collections` | `/collections` | `CollectionsPage` |
| `collection` | `/collections/:slug` | `CollectionPage` |
| `sell` | `/sell` | `SellerLandingPage` — this is Sell on Tuti |
| `shops` | `/shops` | `ShopsPage` — this is the Sellers directory |
| `about` | `/about` | `AboutPage` — this is Our Story |
| `seller-brand` | `/sellers/:slug` | `SellerBrandPage` |
| `fragrance-finder` | `/fragrance-finder` | `FragranceFinderPage` |
| `build-a-box` | `/build-a-box` | `BuildYourBoxPage` |
| `gifting` | `/gifting` | `GiftingPage` |
| `offers` | `/offers` | `OffersPage` |
| `journal` | `/journal` | `JournalPage` |
| `contact` | `/contact` | `CustomerServicePage` (contact mode) |
| `customer-service` | `/customer-service` | `CustomerServicePage` |
| `support` | `/support` | `SupportTicketsPage` |
| `account` | `/account` | `AccountPage` |
| `store-locator` | `/store-locator` | `StoreLocatorPage` |
| `legal` | `/legal` | `LegalPage` |

**External portals** (separate Vite apps, no route in web):

| Portal | App | Current launch mechanism |
|---|---|---|
| Seller | `apps/seller/` port 5174 | `VITE_SELLER_URL` env var, falls back to `/seller` |
| Driver | `apps/driver/` port 5176 | No current link in web app |
| SR | `apps/sr/` port 5177 | No current link in web app |
| Admin | `apps/admin/` port 5175 | No current link in web app |

**Route gaps that require a note but NOT a route change:**

- `Cakes & Desserts` — no dedicated route. Shop category `cake` exists in `SEARCH_CATEGORIES` in `ClientLayout.jsx` but not in `shopCategories` in `siteMap.js`. Implementation adds it to `shopCategories` and uses `navigate("shop", "cake")`.
- `Our Story` — currently rendered at `/about` via route key `about`. No path change required.
- `Sell on Tuti` — currently rendered at `/sell` via route key `sell`. No path change required.

---

## 2. Public Page Access Paths

Every public page must be reachable via at least one of the following: desktop nav, mobile drawer, footer, parent page, or in-page CTA.

| Page | Desktop nav | Mobile drawer | Footer | Parent page | In-page CTA |
|---|---|---|---|---|---|
| Home `/` | Logo click | Logo click | — | — | — |
| Perfumes `/shop?c=perfume` | ✓ Bar 2 | ✓ Shop group | ✓ Shop column | — | Homepage hero |
| Cakes & Desserts `/shop?c=cake` | ✓ Bar 2 | ✓ Shop group | ✓ Shop column | — | Homepage, Gifting |
| Gift Sets `/shop?c=gift_box` | ✓ Bar 2 | ✓ Shop group | ✓ Shop column | — | Homepage, Gifting |
| Build a Box `/build-a-box` | ✓ Bar 2 | ✓ Shop group | ✓ Discover column | — | Homepage Ch4 CTA |
| Sellers `/shops` | ✓ Bar 2 | ✓ Shop group | — | — | Sell on Tuti |
| Seller brand `/sellers/:slug` | — | — | — | ✓ Sellers directory | — |
| Collections `/collections` | — | ✓ Shop group | ✓ Shop column | — | Homepage |
| Collection `/collections/:slug` | — | — | — | ✓ Collections | — |
| Find a Scent `/fragrance-finder` | ✓ Bar 2 (finder) | ✓ Discover group | ✓ Discover column | — | Shop, Homepage |
| Offers `/offers` | — | ✓ Discover group | ✓ Shop column | — | Homepage |
| Gifting `/gifting` | — | ✓ Discover group | ✓ Discover column | — | Homepage |
| Journal `/journal` | — | ✓ Discover group | ✓ Discover column | — | Homepage |
| Our Story `/about` | — | ✓ Discover group | ✓ Discover column | — | — |
| Sell on Tuti `/sell` | — | ✓ Partners group | ✓ Partners column | Sellers directory | — |
| Support `/support` | — | ✓ Help group | ✓ Support column | — | Account |
| Contact `/contact` | — | — | ✓ Support column | Support | — |
| Account `/account` | ✓ Account chip | ✓ Help group | ✓ Support column | — | — |
| Cart `/cart` | ✓ Cart chip | ✓ Cart icon | — | — | Product detail |
| Checkout (within cart flow) | — | — | — | ✓ Cart | — |
| Legal `/legal` | — | ✓ Help group | ✓ Support column | — | — |
| Store Locator `/store-locator` | — | — | — | About/footer (future) | — |
| Seller portal `/seller` | — | ✓ Partners group | ✓ Partners column | — | Sell on Tuti |
| Driver portal `/driver` | — | ✓ Partners group | ✓ Partners column | — | — |
| SR portal `/sr` | — | ✓ Partners group | ✓ Partners column | — | — |
| Admin portal `/admin` | — | — | — | — | — |

---

## 3. Access Path Confirmation

Confirmed resolution for each item in the brief:

| Item | Route key | URL | Navigate call |
|---|---|---|---|
| Perfumes | `shop` | `/shop?c=perfume` | `navigate("shop", "perfume")` |
| Cakes & Desserts | `shop` | `/shop?c=cake` | `navigate("shop", "cake")` ¹ |
| Gift Sets | `shop` | `/shop?c=gift_box` | `navigate("shop", "gift_box")` |
| Build a Box | `build-a-box` | `/build-a-box` | `navigate("build-a-box")` |
| Sellers | `shops` | `/shops` | `navigate("shops")` |
| Collections | `collections` | `/collections` | `navigate("collections")` |
| Find a Scent | `fragrance-finder` | `/fragrance-finder` | `navigate("fragrance-finder")` |
| Offers | `offers` | `/offers` | `navigate("offers")` |
| Gifting | `gifting` | `/gifting` | `navigate("gifting")` |
| Journal | `journal` | `/journal` | `navigate("journal")` |
| Our Story | `about` | `/about` | `navigate("about")` |
| Sell on Tuti | `sell` | `/sell` | `navigate("sell")` |
| Support | `support` | `/support` | `navigate("support")` |
| Legal | `legal` | `/legal` | `navigate("legal")` |
| Account | `account` | `/account` | `navigate("account")` |
| Cart | `cart` | `/cart` | `navigate("cart")` |
| Checkout | within cart | — | flow from cart |
| Seller portal | external | env `VITE_SELLER_URL` | `window.location.href` |
| Driver portal | external | env `VITE_DRIVER_URL` | `window.location.href` |
| SR portal | external | env `VITE_SR_URL` | `window.location.href` |
| Admin portal | external | env `VITE_ADMIN_URL` | `window.location.href` ² |

¹ Requires adding `cake` to `shopCategories` in `siteMap.js` and handling in `productMatchesShopCategory`. Search already has this category (`SEARCH_CATEGORIES` value `"cake"`).

² Admin is not linked from the public site. Seller Central, Driver Portal and Team Login in the footer and drawer link to these portals from the public navigation as partner access points, not as admin-discovery links.

---

## 4. Desktop Header Specification

### Current state (from `ClientLayout.jsx` `CATEGORY_RAIL`)

```
Bar 1: [Logo]  [Search bar]  [Account chip]  [Notification bell]  [Cart chip]
Bar 2: Perfumes | Gift Sets | Build a Box | Sellers | Journal | Find a Scent ✦
```

**Problems:**
- Cakes & Desserts is absent from Bar 2
- Journal belongs in the Discover group, not primary navigation
- Bar 2 has no mobile equivalent — `cl-nav` hides at ≤900px with no replacement

### Target state

```
Bar 1: [Logo]  [Search bar]  [Account chip]  [Notification bell]  [Cart chip]
Bar 2: Perfumes | Cakes & Desserts | Gift Sets | Build a Box | Sellers | Find a Scent ✦
```

### Changes required in `ClientLayout.jsx`

Replace `CATEGORY_RAIL` constant:

```js
const CATEGORY_RAIL = [
  { id: "shop", category: "perfume",  label: "Perfumes" },
  { id: "shop", category: "cake",     label: "Cakes & Desserts" },
  { id: "shop", category: "gift_box", label: "Gift Sets" },
  { id: "build-a-box",                label: "Build a Box" },
  { id: "shops",                      label: "Sellers" },
  { id: "fragrance-finder",           label: "Find a Scent ✦", finder: true },
];
```

No other changes to Bar 1. Bar 1 already has: logo, search, account chip, notification bell, cart chip.

### Active state logic

The existing active state logic in `ClientLayout.jsx` reads:
```js
const active = category
  ? route === id && shopCategory === category
  : route === id;
```

This already handles category matching correctly. Adding `cake` works without logic changes, provided `shopCategory` is set to `"cake"` when navigating.

---

## 5. Mobile Header / Drawer Specification

### Current state

No mobile drawer exists. The `cl-bar2` nav collapses but is still rendered. Below 900px:
- `cl-nav` is `display: none` (legacy class, already hidden)
- `cl-bar2` remains visible but has no hamburger trigger
- No drawer component exists anywhere in the layout

### Target mobile header (≤820px)

```
[Logo mark]                         [Search icon]  [Cart badge]  [☰ Hamburger]
```

The logo mark only (the `cl-logo-mark` square). Logo name hidden at small breakpoint (already done at ≤520px: `.cl-logo-name { display: none }`). Search collapses to an icon that expands inline. Cart shows badge. Hamburger opens the drawer.

### Drawer structure

Full-height slide-in panel from the left. Closes on overlay tap or × button.

```
[× Close]

SHOP
  Perfumes          → navigate("shop", "perfume")
  Cakes & Desserts  → navigate("shop", "cake")
  Gift Sets         → navigate("shop", "gift_box")
  Build a Box       → navigate("build-a-box")
  Sellers           → navigate("shops")
  Collections       → navigate("collections")

DISCOVER
  Find a Scent      → navigate("fragrance-finder")
  Offers            → navigate("offers")
  Gifting           → navigate("gifting")
  Journal           → navigate("journal")
  Our Story         → navigate("about")

HELP
  Support           → navigate("support")
  Account           → navigate("account")
  Orders            → navigate("account")  [scrolls to orders section]
  Legal             → navigate("legal")

PARTNERS
  Sell on Tuti      → navigate("sell")
  Seller Central    → window.location.href = VITE_SELLER_URL
  Driver Portal     → window.location.href = VITE_DRIVER_URL
  Team Login        → window.location.href = VITE_SR_URL (or admin)

─────────────────────
[Sign In]   [Cart (n)]
```

### Drawer behavior

- `position: fixed; inset: 0 auto 0 0; width: min(20rem, 85vw)`
- Overlay: `position: fixed; inset: 0; background: rgba(0,0,0,0.4)`
- Open: translate from `translateX(-100%)` to `translateX(0)`, 280ms ease
- Close: reverse, or ESC key, or overlay click
- Focus trap when open; restores focus on close
- Each link closes the drawer before navigating

### Implementation files

| File | Change |
|---|---|
| `ClientLayout.jsx` | Add `showDrawer` state, hamburger button in mobile header, `MobileDrawer` JSX (inline or extracted component) |
| `client.css` | Add `cl-drawer`, `cl-drawer-overlay`, `cl-drawer-group`, `cl-drawer-link`, `cl-drawer-section-label`, `cl-hamburger` classes |

The drawer can be written inline in `ClientLayout.jsx` as a conditional render. It does not need to be extracted to a separate file unless the implementer prefers it.

---

## 6. Footer Specification

### Current state (from `siteMap.js` `footerColumns`)

```
Shop column:    All Perfumes · Women · Men · Unisex · Gift Sets · Best Sellers + (Sell on Tuti · Our Shops injected inline)
Brand column:   About Us · Craftsmanship · Journal · Store Locator
Support column: Contact Us · FAQs · Shipping & Delivery · Returns & Exchange · Track Order
Legal column:   (legalPages)
```

**Problems:**
- No Cakes & Desserts, Build a Box, Find a Scent, Gifting, Offers, Collections, Our Story in navigation
- No Account or Orders in footer
- No Partner links (Seller Central, Driver Portal, Team Login)
- "Brand" column should be "Discover"
- Footer `navPath` function in `ClientFooter.jsx` only handles a subset of paths

### Target state

Four columns. All navigation uses `onNavigate` or `window.location.href` for externals.

#### Shop column
| Label | Navigate call |
|---|---|
| Perfumes | `navigate("shop", "perfume")` |
| Cakes & Desserts | `navigate("shop", "cake")` |
| Gift Sets | `navigate("shop", "gift_box")` |
| Collections | `navigate("collections")` |
| Offers | `navigate("offers")` |

#### Discover column
| Label | Navigate call |
|---|---|
| Build a Box | `navigate("build-a-box")` |
| Find a Scent | `navigate("fragrance-finder")` |
| Gifting | `navigate("gifting")` |
| Journal | `navigate("journal")` |
| Our Story | `navigate("about")` |

#### Partners column
| Label | Navigate call |
|---|---|
| Sell on Tuti | `navigate("sell")` |
| Seller Central | `window.location.href = import.meta.env.VITE_SELLER_URL \|\| "/seller"` |
| Driver Portal | `window.location.href = import.meta.env.VITE_DRIVER_URL \|\| "/driver"` |
| Team Login | `window.location.href = import.meta.env.VITE_SR_URL \|\| "/sr"` |

#### Support column
| Label | Navigate call |
|---|---|
| Help Centre | `navigate("support")` |
| Contact | `navigate("contact")` |
| Account | `navigate("account")` |
| Orders | `navigate("account")` |
| Legal | `navigate("legal")` |

### Implementation files

| File | Change |
|---|---|
| `siteMap.js` | Replace `footerColumns` array entirely with the four target columns listed above |
| `ClientFooter.jsx` | Replace `navPath` helper with inline `onNavigate` and `window.location.href` calls; keep brand block and bottom bar unchanged |

The footer brand block and `© year` bottom bar remain unchanged.

---

## 7. Cakes & Desserts — Shop Category Gap

`siteMap.js` `shopCategories` does not include a `cake` entry. `productMatchesShopCategory` does not handle `"cake"`. Without this, `navigate("shop", "cake")` will show all products.

### Required addition to `siteMap.js`

Add to `shopCategories` array after the `all` entry:

```js
{
  id: "cake",
  slug: "cake",
  path: "/shop/cake",
  label: "Cakes & Desserts",
  title: "Cakes & desserts",
  description: "Artisan cakes, layered desserts, and sweet pairings for gifting.",
},
```

Add to `productMatchesShopCategory` switch:

```js
case "cake":
  return product.category === "cake" || product.category === "dessert" ||
         (product.tags || []).some(t => /cake|dessert|sweet/i.test(t));
```

Also add to `getShopCategoryById`'s pool (automatic — it searches the array).

---

## 8. Story Image Generation Prompts

### Visual brief (shared across all four)

All four images must be indistinguishable in their setting, lighting, angle, and props. Only the contents of the box change.

**Consistent elements:**
- Dark forest-green premium gift box, matte exterior, clean sharp edges, lid removable
- Amber glass perfume bottle, cylindrical, gold-cap, no label visible
- Small luxury cake: single-serve, pale cream or ivory frosting, minimal decoration (a small edible flower or gold leaf only)
- Surface: cream linen cloth left side, dark honed marble right side
- Camera angle: three-quarter overhead, ~40° from vertical, slight leftward tilt
- Lighting: single warm source from upper right, soft fill from left, warm cinematic tone (3200K)
- Negative space: lower-left third of frame is unoccupied — clear for text overlay
- Objects positioned centre-right
- No visible text, logos, labels, or brand marks anywhere
- Render style: photographic realism, editorial quality, shallow depth of field

---

### Scene 1 — Choose a scent

**Chapter:** `01 — Scent`  
**Filename:** `story-ch1.jpg`

```
Product photography. A dark forest-green premium gift box, lid open and resting 
against the back of the box, sits centre-right on a surface that is half cream 
linen (left) and half dark honed marble (right). Inside the open box, an amber 
glass perfume bottle with a gold cap rests on a bed of ivory tissue paper. 
The box is the only object. Nothing else is present in the frame.

Camera: three-quarter overhead angle, approximately 40 degrees from vertical, 
tilted slightly left. Single warm light source from upper right. Soft fill from 
left. Shallow depth of field. Warm cinematic tone at 3200K.

Lower-left third of the frame is empty — this area has no objects, no fabric 
texture, only the very edge of the dark marble blending to near-black. 
No text, no logos, no labels anywhere in the scene. 
```

---

### Scene 2 — Add something sweet

**Chapter:** `02 — Sweet`  
**Filename:** `story-ch2.jpg`

```
Product photography. Identical composition to scene 1: the same dark 
forest-green premium gift box, lid open, centre-right, on the same half cream 
linen / half dark honed marble surface. The amber glass perfume bottle remains 
inside the box on ivory tissue paper. 

A small single-serve luxury cake has now been placed beside the perfume bottle 
inside the box — pale cream frosting, one small edible flower or a touch of 
gold leaf, sitting in a shallow paper cup. Both objects fit neatly inside the box. 
The box lid is still open, resting against the back.

Same camera angle, same lighting, same depth of field as scene 1. Lower-left 
third of the frame remains empty. No text, no logos, no labels.
```

---

### Scene 3 — Personalise it

**Chapter:** `03 — Personalise`  
**Filename:** `story-ch3.jpg`

```
Product photography. Identical composition to scenes 1 and 2: same green box, 
same surface, same camera angle, same lighting. The amber perfume bottle and 
small luxury cake remain inside the box on ivory tissue paper.

A small premium message card has been placed across the front of the items, 
leaning slightly forward. The card is thick ivory stock, blank on the visible 
face — no writing visible. A length of satin ribbon, ivory or deep green, 
is loosely draped across the box interior, not yet tied.

Lower-left third of frame remains empty. No text, no logos, no labels.
```

---

### Scene 4 — Gift it beautifully

**Chapter:** `04 — Gift`  
**Filename:** `story-ch4.jpg`

```
Product photography. Identical composition to scenes 1, 2 and 3: same green box, 
same surface, same camera angle, same warm lighting.

The box lid is now closed. A wide satin ribbon — deep forest green or ivory — 
is tied in a full bow centred on the top of the lid. The perfume bottle, cake, 
and message card are no longer visible — they are inside the closed, 
gift-ready box. The closed box sits on the same cream linen and dark marble 
surface, perfectly composed and ready to present.

Lower-left third of frame remains empty. No text, no logos, no labels.
This is the most composed and complete image of the four.
```

---

### Image delivery notes

- Format: JPG, minimum 2400 × 1600px, sRGB, 85% quality
- Store at: `apps/web/src/assets/story-ch1.jpg` through `story-ch4.jpg`
- The `alt` text for each is in `homeStoryChapters.js` and should be updated to match the actual scene
- These replace: `category-perfumes.jpg`, `category-cakes.jpg`, `perfume-hero.png`, `category-gift-sets.jpg` as story images only — those originals remain in `/assets/` for any other pages that use them

---

## 9. Implementation Prompts

---

### Prompt A — Navigation, Mobile Drawer, Footer and Route Discoverability

> You are implementing navigation discoverability updates for the Tuti public
> web storefront at `apps/web/`. Do not modify any other app, backend, auth,
> cart, or checkout logic. Do not use GSAP. Do not modify the immersive engine.
>
> ---
>
> **Context**
>
> The app uses a custom SPA router (no React Router). Navigation is handled by
> calling `onNavigate(routeKey, category)` which is wired in `App.jsx`. For
> external portals, use `window.location.href = import.meta.env.VITE_X_URL || "/x"`.
>
> The current header has two rows:
> - Bar 1: logo, search, account chip, notification bell, cart chip
> - Bar 2 (`cl-bar2`): a horizontal category rail that hides below 900px — but
>   there is NO mobile hamburger or drawer replacing it. This is the primary gap.
>
> The current footer (`ClientFooter.jsx`) uses `footerColumns` from `siteMap.js`,
> which has four columns: Shop (perfumes only), Brand (about/journal), Support,
> Legal. This does not match the target footer spec.
>
> ---
>
> **Task 1 — Update CATEGORY_RAIL in `ClientLayout.jsx`**
>
> Replace the `CATEGORY_RAIL` constant with:
>
> ```js
> const CATEGORY_RAIL = [
>   { id: "shop", category: "perfume",  label: "Perfumes" },
>   { id: "shop", category: "cake",     label: "Cakes & Desserts" },
>   { id: "shop", category: "gift_box", label: "Gift Sets" },
>   { id: "build-a-box",                label: "Build a Box" },
>   { id: "shops",                      label: "Sellers" },
>   { id: "fragrance-finder",           label: "Find a Scent ✦", finder: true },
> ];
> ```
>
> The existing active-state logic and CSS classes remain unchanged.
>
> ---
>
> **Task 2 — Add cake category to `siteMap.js`**
>
> In the `shopCategories` array in `apps/web/src/features/pages/siteMap.js`,
> add the following entry after the `id: "all"` entry:
>
> ```js
> {
>   id: "cake",
>   slug: "cake",
>   path: "/shop/cake",
>   label: "Cakes & Desserts",
>   title: "Cakes & desserts",
>   description: "Artisan cakes, layered desserts, and sweet pairings for gifting.",
> },
> ```
>
> In the `productMatchesShopCategory` function, add to the switch statement:
>
> ```js
> case "cake":
>   return product.category === "cake" ||
>          product.category === "dessert" ||
>          (product.tags || []).some((t) => /cake|dessert|sweet/i.test(t));
> ```
>
> ---
>
> **Task 3 — Replace `footerColumns` in `siteMap.js`**
>
> Replace the entire `footerColumns` export with the following. Do not change
> any other export in `siteMap.js`.
>
> ```js
> export const footerColumns = [
>   {
>     title: "Shop",
>     links: [
>       { label: "Perfumes",          nav: ["shop", "perfume"] },
>       { label: "Cakes & Desserts",  nav: ["shop", "cake"] },
>       { label: "Gift Sets",         nav: ["shop", "gift_box"] },
>       { label: "Collections",       nav: ["collections"] },
>       { label: "Offers",            nav: ["offers"] },
>     ],
>   },
>   {
>     title: "Discover",
>     links: [
>       { label: "Build a Box",  nav: ["build-a-box"] },
>       { label: "Find a Scent", nav: ["fragrance-finder"] },
>       { label: "Gifting",      nav: ["gifting"] },
>       { label: "Journal",      nav: ["journal"] },
>       { label: "Our Story",    nav: ["about"] },
>     ],
>   },
>   {
>     title: "Partners",
>     links: [
>       { label: "Sell on Tuti",   nav: ["sell"] },
>       { label: "Seller Central", href: "VITE_SELLER_URL" },
>       { label: "Driver Portal",  href: "VITE_DRIVER_URL" },
>       { label: "Team Login",     href: "VITE_SR_URL" },
>     ],
>   },
>   {
>     title: "Support",
>     links: [
>       { label: "Help Centre", nav: ["support"] },
>       { label: "Contact",     nav: ["contact"] },
>       { label: "Account",     nav: ["account"] },
>       { label: "Orders",      nav: ["account"] },
>       { label: "Legal",       nav: ["legal"] },
>     ],
>   },
> ];
> ```
>
> Note the schema change: each link now has `nav` (array of args to `onNavigate`)
> or `href` (env var key name for external portals). This requires updating
> `ClientFooter.jsx` in Task 4.
>
> ---
>
> **Task 4 — Rewrite `ClientFooter.jsx`**
>
> Rewrite `ClientFooter.jsx` to:
>
> 1. Consume the new `footerColumns` schema (nav / href fields)
> 2. For `nav` links: call `onNavigate(...link.nav)`
> 3. For `href` links: call `window.location.href = import.meta.env[link.href] || "/" + link.href.replace("VITE_", "").replace("_URL", "").toLowerCase()`
> 4. Preserve the brand block (mark, name, tagline, origin small text) exactly
> 5. Preserve the bottom bar (`© year` and "UAE · Luxury gifting marketplace")
> 6. Keep all existing CSS class names (`cl-footer`, `cl-footer-inner`, `cl-footer-brand`, `cl-footer-nav`, `cl-footer-links`, `cl-footer-link`, `cl-footer-bottom`, etc.)
>
> Remove the `navPath` helper — it is no longer needed.
>
> ---
>
> **Task 5 — Add mobile hamburger and drawer to `ClientLayout.jsx`**
>
> **5a. Add state and refs:**
>
> ```js
> const [showDrawer, setShowDrawer] = useState(false);
> const drawerRef = useRef(null);
> ```
>
> **5b. Close on outside click / Escape:**
>
> ```js
> useEffect(() => {
>   if (!showDrawer) return undefined;
>   function onKey(e) { if (e.key === "Escape") setShowDrawer(false); }
>   document.addEventListener("keydown", onKey);
>   return () => document.removeEventListener("keydown", onKey);
> }, [showDrawer]);
> ```
>
> **5c. Add hamburger button to Bar 1 right side (mobile only):**
>
> Inside `.cl-bar1-right`, after the cart chip, add:
>
> ```jsx
> <button
>   className="cl-hamburger"
>   type="button"
>   aria-label="Open navigation menu"
>   aria-expanded={showDrawer}
>   onClick={() => setShowDrawer(true)}
> >
>   <span />
>   <span />
>   <span />
> </button>
> ```
>
> **5d. Drawer markup** — render at the end of `<div className="cl-shell">` before the closing tag:
>
> ```jsx
> {showDrawer && (
>   <>
>     <div
>       className="cl-drawer-overlay"
>       aria-hidden="true"
>       onClick={() => setShowDrawer(false)}
>     />
>     <nav
>       className="cl-drawer"
>       ref={drawerRef}
>       aria-label="Site navigation"
>     >
>       <button
>         className="cl-drawer-close"
>         type="button"
>         aria-label="Close navigation menu"
>         onClick={() => setShowDrawer(false)}
>       >
>         ✕
>       </button>
>
>       {[
>         {
>           group: "Shop",
>           items: [
>             { label: "Perfumes",         action: () => navigate("shop", "perfume") },
>             { label: "Cakes & Desserts", action: () => navigate("shop", "cake") },
>             { label: "Gift Sets",        action: () => navigate("shop", "gift_box") },
>             { label: "Build a Box",      action: () => navigate("build-a-box") },
>             { label: "Sellers",          action: () => navigate("shops") },
>             { label: "Collections",      action: () => navigate("collections") },
>           ],
>         },
>         {
>           group: "Discover",
>           items: [
>             { label: "Find a Scent",  action: () => navigate("fragrance-finder") },
>             { label: "Offers",        action: () => navigate("offers") },
>             { label: "Gifting",       action: () => navigate("gifting") },
>             { label: "Journal",       action: () => navigate("journal") },
>             { label: "Our Story",     action: () => navigate("about") },
>           ],
>         },
>         {
>           group: "Help",
>           items: [
>             { label: "Support",  action: () => navigate("support") },
>             { label: "Account",  action: () => navigate("account") },
>             { label: "Orders",   action: () => navigate("account") },
>             { label: "Legal",    action: () => navigate("legal") },
>           ],
>         },
>         {
>           group: "Partners",
>           items: [
>             { label: "Sell on Tuti",   action: () => navigate("sell") },
>             { label: "Seller Central", action: () => { window.location.href = import.meta.env.VITE_SELLER_URL || "/seller"; } },
>             { label: "Driver Portal",  action: () => { window.location.href = import.meta.env.VITE_DRIVER_URL || "/driver"; } },
>             { label: "Team Login",     action: () => { window.location.href = import.meta.env.VITE_SR_URL || "/sr"; } },
>           ],
>         },
>       ].map(({ group, items }) => (
>         <div key={group} className="cl-drawer-group">
>           <p className="cl-drawer-group-label">{group}</p>
>           {items.map(({ label, action }) => (
>             <button
>               key={label}
>               type="button"
>               className="cl-drawer-link"
>               onClick={() => { action(); setShowDrawer(false); }}
>             >
>               {label}
>             </button>
>           ))}
>         </div>
>       ))}
>
>       <div className="cl-drawer-foot">
>         {isAuth ? (
>           <button
>             className="cl-drawer-link cl-drawer-link--account"
>             type="button"
>             onClick={() => { navigate("account"); setShowDrawer(false); }}
>           >
>             {accountName}
>           </button>
>         ) : (
>           <button
>             className="cl-drawer-link cl-drawer-link--signin"
>             type="button"
>             onClick={() => { setShowAuth(true); setShowDrawer(false); }}
>           >
>             Sign In
>           </button>
>         )}
>         <button
>           className="cl-drawer-cart"
>           type="button"
>           onClick={() => { navigate("cart"); setShowDrawer(false); }}
>         >
>           Cart {cartCount > 0 ? `(${cartCount})` : ""}
>         </button>
>       </div>
>     </nav>
>   </>
> )}
> ```
>
> ---
>
> **Task 6 — Add drawer and hamburger CSS to `client.css`**
>
> Append the following to the end of `apps/web/src/styles/client.css`:
>
> ```css
> /* ══ MOBILE HAMBURGER ══════════════════════════════════════════════ */
> .cl-hamburger {
>   display: none;
>   flex-direction: column;
>   justify-content: center;
>   gap: 5px;
>   width: 2.5rem;
>   height: 2.5rem;
>   background: rgba(255,255,255,0.08);
>   border: 1px solid rgba(255,255,255,0.1);
>   border-radius: var(--radius);
>   cursor: pointer;
>   padding: 0;
>   align-items: center;
>   flex-shrink: 0;
> }
> .cl-hamburger span {
>   display: block;
>   width: 18px;
>   height: 2px;
>   background: rgba(255,255,255,0.85);
>   border-radius: 2px;
>   transition: opacity var(--t-fast);
> }
>
> @media (max-width: 820px) {
>   .cl-hamburger { display: flex; }
>   .cl-bar2      { display: none; }
> }
>
> /* ══ MOBILE DRAWER ════════════════════════════════════════════════ */
> .cl-drawer-overlay {
>   position: fixed;
>   inset: 0;
>   background: rgba(0, 0, 0, 0.45);
>   z-index: calc(var(--z-topbar) + 1);
>   backdrop-filter: blur(2px);
>   -webkit-backdrop-filter: blur(2px);
> }
>
> .cl-drawer {
>   position: fixed;
>   inset: 0 auto 0 0;
>   width: min(20rem, 88vw);
>   background: #0a1f1c;
>   border-right: 1px solid rgba(255,255,255,0.08);
>   z-index: calc(var(--z-topbar) + 2);
>   overflow-y: auto;
>   overscroll-behavior: contain;
>   display: flex;
>   flex-direction: column;
>   padding: var(--sp-5) var(--sp-4) var(--sp-6);
>   gap: var(--sp-5);
>   animation: cl-drawer-in 280ms cubic-bezier(0.22, 1, 0.36, 1) both;
> }
>
> @keyframes cl-drawer-in {
>   from { transform: translateX(-100%); }
>   to   { transform: translateX(0); }
> }
>
> .cl-drawer-close {
>   align-self: flex-end;
>   background: none;
>   border: none;
>   color: rgba(255,255,255,0.5);
>   font-size: 1.25rem;
>   cursor: pointer;
>   padding: var(--sp-1);
>   line-height: 1;
>   transition: color var(--t-fast);
>   margin-bottom: var(--sp-2);
> }
> .cl-drawer-close:hover { color: #fff; }
>
> .cl-drawer-group {
>   display: flex;
>   flex-direction: column;
>   gap: var(--sp-1);
> }
>
> .cl-drawer-group-label {
>   margin: 0 0 var(--sp-2);
>   font-size: 0.65rem;
>   font-weight: 700;
>   letter-spacing: 0.1em;
>   text-transform: uppercase;
>   color: rgba(255,255,255,0.28);
> }
>
> .cl-drawer-link {
>   display: block;
>   width: 100%;
>   text-align: left;
>   background: none;
>   border: none;
>   border-radius: var(--radius);
>   padding: var(--sp-2) var(--sp-3);
>   font-size: var(--text-sm);
>   font-weight: var(--fw-medium);
>   color: rgba(255,255,255,0.72);
>   cursor: pointer;
>   transition: background var(--t-fast), color var(--t-fast);
>   min-height: 44px;
>   display: flex;
>   align-items: center;
> }
> .cl-drawer-link:hover {
>   background: rgba(255,255,255,0.07);
>   color: #fff;
> }
>
> .cl-drawer-foot {
>   margin-top: auto;
>   padding-top: var(--sp-5);
>   border-top: 1px solid rgba(255,255,255,0.08);
>   display: flex;
>   gap: var(--sp-3);
>   align-items: center;
>   flex-wrap: wrap;
> }
>
> .cl-drawer-link--signin {
>   background: var(--brand);
>   color: #fff;
>   border-radius: 999px;
>   padding: var(--sp-2) var(--sp-4);
>   font-weight: var(--fw-semibold);
>   width: auto;
>   flex-shrink: 0;
> }
> .cl-drawer-link--signin:hover { background: var(--brand-dark); color: #fff; }
>
> .cl-drawer-cart {
>   background: rgba(255,255,255,0.08);
>   border: 1px solid rgba(255,255,255,0.1);
>   border-radius: 999px;
>   padding: var(--sp-2) var(--sp-4);
>   color: #fff;
>   font-size: var(--text-sm);
>   font-weight: var(--fw-semibold);
>   cursor: pointer;
>   transition: background var(--t-fast);
>   min-height: 44px;
>   white-space: nowrap;
> }
> .cl-drawer-cart:hover { background: rgba(255,255,255,0.14); }
> ```
>
> ---
>
> **Task 7 — Validate**
>
> Run `npm run build -w @tuti/web`. Fix any import or prop errors.
>
> Then verify manually:
> - Desktop: Cakes & Desserts appears in Bar 2, Journal is gone from Bar 2
> - Desktop: Find a Scent remains styled as the finder pill
> - Mobile at 390px: Bar 2 is hidden, hamburger is visible
> - Mobile: drawer opens and closes correctly, all links navigate
> - Footer: four columns with correct labels and navigation
> - No horizontal overflow at 390px
> - Console: no errors
>
> Do not modify: `useImmersiveStory.js`, `ImmersiveStory.jsx`, `immersive.css`,
> `homeStoryChapters.js`, `ImmersivePreviewPage.jsx`, `App.jsx`, any backend
> file, or any file outside `apps/web/`.

---

### Prompt B — Final Story Image Replacement, Transparent Preview Header and QA

> You are implementing two small changes to the Tuti immersive preview at
> `apps/web/src/features/immersive/` and `apps/web/src/features/layout/ClientLayout.jsx`.
>
> Do not touch routing, auth, cart, checkout, or any portal app.
> Do not modify `useImmersiveStory.js`.
> Do not add GSAP.
>
> ---
>
> **Context**
>
> The immersive story at `/experience-preview` currently uses four temporary
> placeholder images imported from `apps/web/src/assets/`:
>
> - Ch1: `category-perfumes.jpg`
> - Ch2: `category-cakes.jpg`
> - Ch3: `perfume-hero.png`
> - Ch4: `category-gift-sets.jpg`
>
> Four replacement images have been placed at:
>
> - `apps/web/src/assets/story-ch1.jpg`
> - `apps/web/src/assets/story-ch2.jpg`
> - `apps/web/src/assets/story-ch3.jpg`
> - `apps/web/src/assets/story-ch4.jpg`
>
> The header on `/experience-preview` currently shows its standard dark background
> (`rgba(12,25,22,0.96)`). For this route only, the header should be fully
> transparent so the immersive stage image shows edge-to-edge from behind the
> header glass. The existing body-class mechanism (`immersive-preview-active`) is
> already in place — it just needs to do more.
>
> ---
>
> **Task 1 — Replace story images in `homeStoryChapters.js`**
>
> Open `apps/web/src/data/homeStoryChapters.js`.
>
> Replace the four image imports at the top:
>
> ```js
> import storyImage1 from "../assets/story-ch1.jpg";
> import storyImage2 from "../assets/story-ch2.jpg";
> import storyImage3 from "../assets/story-ch3.jpg";
> import storyImage4 from "../assets/story-ch4.jpg";
> ```
>
> Update the `image` field in each chapter:
>
> ```js
> // chapter "choose-a-scent"  → image: storyImage1
> // chapter "add-something-sweet" → image: storyImage2
> // chapter "personalise-it"  → image: storyImage3
> // chapter "gift-it-beautifully" → image: storyImage4
> ```
>
> Update the `alt` text:
>
> ```js
> // Ch1 alt: "An open dark-green gift box with an amber perfume bottle on ivory tissue paper."
> // Ch2 alt: "The same gift box with a perfume bottle and a small luxury cake inside."
> // Ch3 alt: "The same gift box with a message card and ribbon added to the arrangement."
> // Ch4 alt: "A closed dark-green gift box with a satin bow, ready to present as a gift."
> ```
>
> The old import names (`perfumeCategoryImage`, `cakeCategoryImage`, etc.) may
> remain in the file only if they are used elsewhere. If they are used only by
> `homeStoryChapters`, remove them. Do not touch any other file that imports
> these assets.
>
> ---
>
> **Task 2 — Make header fully transparent on `/experience-preview`**
>
> The `ImmersivePreviewPage` already adds `immersive-preview-active` to
> `document.body` on mount. The current CSS rule in `immersive.css` only
> removes the border:
>
> ```css
> .immersive-preview-active .cl-topbar {
>   border-bottom-color: transparent;
> }
> ```
>
> Replace that rule with:
>
> ```css
> .immersive-preview-active .cl-topbar {
>   background: transparent;
>   border-bottom-color: transparent;
>   backdrop-filter: none;
>   -webkit-backdrop-filter: none;
> }
> ```
>
> Also set `.is-stage` `top: 0` and `height: 100svh` (removing the 7.5rem
> header offset) so the immersive stage fills the full viewport including behind
> the now-transparent header:
>
> ```css
> /* Only applied when immersive-preview-active is on body */
> .immersive-preview-active .is-stage {
>   top: 0;
>   height: 100svh;
> }
> ```
>
> The gradient overlay inside the stage already covers the image top edge with
> a very light darken (`rgba(6,14,12,0.12)` at top), which ensures header text
> remains readable against any image. If the image is very bright in the top
> region, increase the top gradient stop to `rgba(6,14,12,0.3)`.
>
> Test with all four chapters to confirm header text is legible.
>
> ---
>
> **Task 3 — QA checklist**
>
> Run `npm run build -w @tuti/web` and confirm no errors.
>
> Then verify at localhost:5173:
>
> Desktop (1440 × 900):
> - [ ] Header is transparent on `/experience-preview`, solid on all other routes
> - [ ] Stage image fills from top of viewport (behind header) to bottom
> - [ ] Ch1 shows the open box with perfume only
> - [ ] Ch2 shows the open box with perfume and cake
> - [ ] Ch3 shows the open box with perfume, cake, and message card
> - [ ] Ch4 shows the closed box with bow
> - [ ] All four chapters activate via IntersectionObserver
> - [ ] Progress bar updates correctly
> - [ ] Build Your Gift CTA appears in Ch4 and navigates to /build-a-box
> - [ ] Alt text for all four images is correct
> - [ ] Homepage shows no immersive story elements
> - [ ] Console: no errors
>
> Mobile (390 × 844):
> - [ ] Header is transparent on `/experience-preview`
> - [ ] Each chapter is full-bleed, 90svh tall
> - [ ] Ch4 shows Build Your Gift button, minimum 44px tap target
> - [ ] No horizontal overflow
>
> Do not modify: `useImmersiveStory.js`, `App.jsx`, any routing logic, auth,
> or any file outside `apps/web/`.

---

## 10. Separate Task Log

The following items are documented as follow-up tasks, not part of Prompt A or B:

| Task | Reason deferred |
|---|---|
| Scroll-aware transparent header (solid when user scrolls below story) | Requires scroll listener wired to layout; architecture decision needed |
| Homepage immersive integration | Explicitly out of scope for this phase |
| Our Story as a dedicated `/our-story` route | Route addition is simple; deferred until homepage integration is approved |
| Sell on Tuti as `/sell-on-tuti` route | Same — current `/sell` works for discovery |
| Production photography delivery to S3 | Pending S3 media issue resolution; local assets suffice for now |
| Arabic copy and RTL pass | Deferred until navigation is stable |
| Driver, SR, Admin portal env vars | Need to be added to `apps/web/.env` once portal URLs are confirmed |
