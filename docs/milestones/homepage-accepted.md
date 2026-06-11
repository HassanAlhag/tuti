# Tuti Homepage — Accepted Milestone

**Status:** ACCEPTED / FROZEN  
**Last QA:** 2026-06-08  
**Build:** PASS

---

## Summary

The homepage is a two-act layout: a full-viewport immersive scroll story followed by the content commerce layer.

---

## Routes

| Route | Component | Notes |
|---|---|---|
| `/` | `HomePage` | Live. Renders the immersive story + full commerce layer. |

The `/experience-preview` route has been removed. The immersive story is now integrated directly in `HomePage`.

---

## Files

| File | Role |
|---|---|
| `apps/web/src/features/pages/HomePage.jsx` | Main homepage component |
| `apps/web/src/features/immersive/ImmersiveStory.jsx` | Four-chapter scroll-driven story |
| `apps/web/src/features/immersive/useImmersiveStory.js` | IntersectionObserver scroll logic |
| `apps/web/src/features/immersive/immersive.css` | Sticky stage, sentinel, chapter styles |
| `apps/web/src/features/homepage/AdaptiveBoutique.jsx` | Featured boutique rail (API-backed) |
| `apps/web/src/features/homepage/AdaptiveProductEdit.jsx` | Luxury picks + new arrivals rails (API-backed) |
| `apps/web/src/features/homepage/homepage.css` | Homepage-specific layout tokens |
| `apps/web/src/features/layout/ClientLayout.jsx` | Immersive header blend logic (`cl-topbar--immersive`) |
| `apps/web/src/data/homeStoryChapters.js` | Story chapter copy and image references |
| `apps/web/src/assets/home-ch1-scent.png` | Story chapter 1 image (accepted) |
| `apps/web/src/assets/home-ch2-sweet.png` | Story chapter 2 image (accepted) |
| `apps/web/src/assets/home-ch3-personalise.png` | Story chapter 3 image (accepted) |
| `apps/web/src/assets/home-ch4-complete.png` | Story chapter 4 image (accepted) |
| `tools/archive/generate-story-images.mjs` | Archived image-generation script (not in package scripts; not a repeatable workflow) |

---

## Homepage Sections (top to bottom)

### Act 1 — The Gift Journey (four-scene immersive opening)

`ImmersiveStory` renders four full-viewport scenes driven by scroll position on desktop and stacked full-bleed chapters on mobile. Each scene uses a professional luxury editorial photograph of a forest-green gift box being assembled.

- **Scene 1 — Choose a scent:** Box with perfume only; empty compartments signal what's coming. CTA: "Start Building."
- **Scene 2 — Add something sweet:** Same box with a small celebration cake added to the centre compartment.
- **Scene 3 — Personalise it:** Ivory message card added to the right compartment; ribbon beginning to drape.
- **Scene 4 — Gift it beautifully:** Completed gift with ribbon bow; the final image is also used as the Build a Box hero image.

**Desktop implementation:** `.is-outer` container is `4 × 100svh` tall. `.is-stage` is `position: sticky` at the top. Four `.is-sentinel` elements (IntersectionObserver via `useImmersiveStory.js`) trigger chapter transitions. Bottom progress bar and right-side chapter navigation dots are visible.

**Mobile implementation:** Four stacked `.is-mobile-ch` panels, each `90svh` tall with copy pinned bottom-left. No sticky scroll required.

**Header blend:** When the homepage is active, `ClientLayout` applies `cl-topbar--immersive` (transparent) to the header. Once the immersive story has scrolled past, it switches to `cl-topbar--solid` (opaque dark). This logic is route-scoped to `route === "home"` only.

---

### Act 2 — Editorial Transition

Short section: eyebrow "Discover Tuti", h2 "Thoughtful gifting, made personal.", followed by the Arabic translation. Bridges the dark immersive story into the cream commerce content below.

---

### Act 3 — Category Worlds (`CategoryShowcase`)

Four category entry-point cards arranged in a responsive grid with background images:

- **Perfumes** (feature card) — "Boutique fragrances" → routes to `/shop?c=perfume`
- **Cakes & Desserts** — "Made for the moment" → routes to `/shop?c=cake`
- **Gift Sets** — "Curated together" → routes to `/shop?c=gift_box`
- **Build a Box** (feature card) — "Make it personal" → routes to `/build-a-box`

Three discovery links appear alongside the cards: Browse collections, Find a scent, Read the journal.

---

### Act 4 — Featured Boutique (`AdaptiveBoutique`)

API-backed section using `GET /api/marketplace/featured-sellers`. Shows featured boutique(s) selected by the admin. Displays seller name, tagline, and a product sampling from that boutique with "View boutique" CTAs. Adapts layout based on the number of featured placements. Shows a graceful editorial empty state when no placements exist.

---

### Act 5 — Tuti Luxury Picks (`AdaptiveProductEdit`, placement: `luxury_picks`)

"Selected by Tuti" editorial product rail from `GET /api/marketplace/featured-products?placement=luxury_picks`. Admin-curated pick of high-quality products. Adapts to count; shows editorial empty state when no placements exist.

---

### Act 6 — Build Something Personal (`BuildBoxFeature`)

Full-width editorial section: "Build a gift they will remember." Two CTAs: "Start building" → `/build-a-box` and "Explore gift sets" → `/shop?c=gift_box`. Accompanied by the completed gift image (home-ch4-complete.png). Three benefit chips: One boutique · One delivery · One memorable gift.

---

### Act 7 — New at Tuti (`AdaptiveProductEdit`, placement: `new_arrivals`)

"Just landed" product rail from `GET /api/marketplace/featured-products?placement=new_arrivals`. Fresh products recently added to the platform. Same adaptive behaviour as Luxury Picks.

---

### Act 8 — Trust and Footer (`TrustClosing`)

Three trust pillars with icons: "Every seller is reviewed", "Made for gifting", "UAE-first delivery". `ClientFooter` follows with a four-column sitemap layout.

---

## APIs Used

| Endpoint | Purpose |
|---|---|
| `GET /api/marketplace/storefront` | Products, shops, collections, rankings |
| `GET /api/marketplace/featured-sellers` | Featured boutique placements |
| `GET /api/marketplace/featured-products` | Luxury picks and new arrivals placements |
| `POST /api/marketplace/events` | Page-view and placement impression/click tracking |

---

## Tracking Preserved

- Page-view event on homepage mount via `marketplaceTracking.js`
- Placement impressions for featured sellers and products
- Click-through events for featured placements

---

## Known Limitations

- Featured boutique and product placements require seeded or admin-created placements to display; graceful empty states exist.
- Story images are large PNGs (~2.5MB each); not optimised to WebP yet.
- No lazy loading for story images below the fold on desktop.

---

## Build Status

`npm run build -w @tuti/web` — PASS (verified 2026-06-08)

## QA Status

- Desktop: PASS (4-chapter sticky scroll, transparent header blend, commerce content)
- Mobile: PASS (stacked chapters, drawer navigation, responsive commerce sections)
- Immersive header blend: PASS (`cl-topbar--immersive` and `cl-topbar--solid` transitions)
