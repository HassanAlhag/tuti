# Seller / Boutique Fallback Image Brief

Status: draft, requested by Seller Discovery and Public Seller Profile enhancement
Owner: customer web team

## Why this brief exists

None of the seeded boutiques (`backend/src/seed/marketplace.seed.js`) currently have a
real `logoUrl` or `bannerUrl` -- both fields exist in the seller brand profile schema
but are empty for every seed record today. Until sellers upload real photography, the
homepage "Verified boutiques" rail, the `/shops` directory, and each `/sellers/:slug`
profile page fall back to category-based editorial photography chosen client-side
(see `apps/web/src/features/boutiques/boutiqueDirectory.js`).

Three of the five fallback categories below already have an asset in
`apps/web/src/assets/` (`category-perfumes.jpg`, `category-cakes.jpg`,
`category-gift-sets.jpg`) and are reused as-is. This brief requests the two that are
still missing (oud/perfume shelf, and a true neutral/mixed-category boutique shot) plus
refreshed briefs for the three that exist, in case the brand wants a boutique-specific
variant distinct from the category-shopping images already used elsewhere on the site.

## Shared rules for every image below

- Single boutique only. Never depict products from more than one boutique in the same
  frame, and never stage a perfume bottle and a cake/dessert together as if they ship
  in one box -- Tuti does not combine products from multiple boutiques into one
  physical box.
- No fabricated claims. Do not include awards, plaques, "est. 19XX" signage, medals,
  or same-day/24-hour delivery messaging in the shot -- none of that is backed by real
  seller data today.
- No visible branding, logos, or text that could be mistaken for a real, specific
  seller's identity. These are category fallbacks shared across many boutiques, not a
  hero shot for one seller.
- No admin/dashboard/POS screens, no seller portal UI, no barcodes/scanners.
- Photography or photo-real render only -- no illustration, no cartoon style -- to
  match the existing `category-*.jpg` assets already on the site.

---

## 1. Perfume boutique interior / preparation

- **Filename:** `boutique-fallback-perfume.jpg`
- **Purpose:** Fallback cover image for boutiques whose primary category is `perfume`
  (homepage rail, `/shops` directory, `/sellers/:slug` cover).
- **Aspect ratio:** 4:3
- **Dimensions:** 1600x1200px (min), export at 80% JPEG quality
- **Prompt:** "A small independent perfume boutique's preparation counter, warm
  editorial lighting, a few amber and clear glass perfume bottles being carefully
  wrapped in tissue paper by a pair of hands just entering frame, a wooden counter with
  soft bokeh shelving of fragrance bottles in the background, muted navy and warm gold
  color palette, shallow depth of field, no people's faces visible, premium and quiet,
  no text or logos anywhere in frame."
- **Negative prompt:** "no text, no logo, no brand name, no barcode, no price tag, no
  cake, no dessert, no gift wrap other than tissue paper, no multiple unrelated
  products, no cartoon, no illustration, no watermark, no visible face."
- **Business-rule warning:** Perfume only -- do not let a cake, dessert stand, or gift
  box appear in the same frame, even blurred in the background.

## 2. Dessert studio preparation

- **Filename:** `boutique-fallback-dessert.jpg`
- **Purpose:** Fallback cover image for boutiques whose primary category is `cake` or
  `dessert`.
- **Aspect ratio:** 4:3
- **Dimensions:** 1600x1200px (min), export at 80% JPEG quality
- **Prompt:** "A boutique pastry studio's prep counter, a celebration cake being
  finished with delicate piping by a pair of hands just entering frame, soft natural
  window light, marble or light wood counter, blurred shelving of dessert boxes in the
  background, warm cream and gold tones, shallow depth of field, no people's faces
  visible, premium and calm, no text or logos anywhere in frame."
- **Negative prompt:** "no text, no logo, no brand name, no barcode, no price tag, no
  perfume bottle, no fragrance packaging, no multiple unrelated products, no cartoon,
  no illustration, no watermark, no visible face."
- **Business-rule warning:** Dessert/cake only -- do not include a perfume bottle or
  gift box in the same frame; do not imply a perfume + cake bundle.

## 3. Oud / perfume shelf

- **Filename:** `boutique-fallback-oud.jpg`
- **Purpose:** Secondary perfume-category fallback for oud/attar-specialist boutiques,
  used when the site wants a shelf/retail view distinct from the preparation-counter
  shot in #1 (e.g. directory grid variety).
- **Aspect ratio:** 4:3
- **Dimensions:** 1600x1200px (min), export at 80% JPEG quality
- **Prompt:** "A close, editorial shot of an oud and attar perfume shelf in a small
  independent boutique, dark wood shelving, a row of ornate glass oud bottles with soft
  warm spotlighting, shallow depth of field, moody navy and gold color grade, no people
  in frame, premium and quiet, no text or logos anywhere in frame."
- **Negative prompt:** "no text, no logo, no brand name, no barcode, no price tag, no
  cake, no dessert, no gift box, no cartoon, no illustration, no watermark, no visible
  face, no mannequins."
- **Business-rule warning:** Perfume/oud only -- keep this visually distinct enough
  from #1 that the two don't read as the same stock photo reused twice for different
  boutiques on the same directory page.

## 4. Gift Box wrapping table

- **Filename:** `boutique-fallback-giftbox.jpg`
- **Purpose:** Fallback cover image for boutiques whose primary category is
  `gift_box`. Represents a ready-made Gift Box being wrapped by one boutique, never a
  "build your box" multi-boutique assembly scene.
- **Aspect ratio:** 4:3
- **Dimensions:** 1600x1200px (min), export at 80% JPEG quality
- **Prompt:** "A boutique gift-wrapping table, a single ready-made premium gift box
  being tied with ribbon by a pair of hands just entering frame, curated tissue paper
  and ribbon spools nearby, warm gold and cream palette, soft editorial lighting,
  shallow depth of field, no people's faces visible, premium and calm, no text or logos
  anywhere in frame."
- **Negative prompt:** "no text, no logo, no brand name, no barcode, no price tag, no
  perfume bottle placed inside or beside the box implying a bundle, no cake next to the
  box, no multiple different product types staged together, no cartoon, no
  illustration, no watermark, no visible face."
- **Business-rule warning:** This must read as one boutique's ready-made Gift Box, not
  a "Build a Gift" assembly moment and not a cross-boutique bundle. Do not caption or
  imply "Gift Set" or "Build Your Box" in any accompanying copy -- those terms are not
  used customer-facing.

## 5. Neutral boutique fulfilment image

- **Filename:** `boutique-fallback-neutral.jpg`
- **Purpose:** Fallback cover image for boutiques with a `mixed` category (approved to
  sell across more than one category) or with no category data at all. Used instead of
  forcing a category-specific photo onto a boutique that doesn't clearly belong to one
  category.
- **Aspect ratio:** 4:3
- **Dimensions:** 1600x1200px (min), export at 80% JPEG quality
- **Prompt:** "A generic boutique fulfilment / packing counter, a single closed kraft
  shipping box with premium ribbon on a clean counter, soft neutral studio lighting,
  navy and warm gold color accents, no specific product visible inside or beside the
  box, shallow depth of field, no people's faces visible, premium and quiet, no text or
  logos anywhere in frame."
- **Negative prompt:** "no text, no logo, no brand name, no barcode, no visible product
  category (no perfume bottle, no cake, no dessert), no multiple product types staged
  together, no cartoon, no illustration, no watermark, no visible face."
- **Business-rule warning:** Must stay category-agnostic -- if the image reads as
  perfume- or dessert-specific, it stops being a valid neutral fallback and a
  mixed-category boutique using it would visually misrepresent what it sells.

## Current interim behavior (until these assets exist)

`apps/web/src/features/boutiques/boutiqueDirectory.js` already reuses the existing
`category-perfumes.jpg` / `category-cakes.jpg` / `category-gift-sets.jpg` assets for
categories 1, 2, and 4 above. For category 5 (mixed/no-category boutiques -- currently
"Sweet Studio" and "Rose Vault" in the seed data), no fallback photo is substituted;
the card instead renders a tinted gradient background with the boutique's initials, so
no boutique is ever shown with a mismatched or duplicated category photo.
