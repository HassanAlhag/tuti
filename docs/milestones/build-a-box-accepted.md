# Tuti Build a Box — Accepted Milestone

**Status:** ACCEPTED / FROZEN  
**Last QA:** 2026-06-08  
**Build:** PASS

---

## Summary

Build a Box (`BuildYourBoxPage`) is a full editorial-and-builder experience: editorial introduction, same-boutique quality rationale, optional occasion selector, a two-column workspace (selection steps + live gift preview), step-by-step perfume and cake/dessert selection, message/packaging configuration, and a sticky gift summary that becomes an add-to-cart button once a valid pair is selected.

---

## Routes

| Route | Component | Notes |
|---|---|---|
| `/build-a-box` | `BuildYourBoxPage` | Live builder |

---

## Files

| File | Role |
|---|---|
| `apps/web/src/features/pages/BuildYourBoxPage.jsx` | Full builder implementation |
| `apps/web/src/store/cartStore.js` | Cart state; `separateLine: true` for configured items |
| `backend/src/modules/orders/buildYourBox.validation.js` | Backend configuration validation |
| `backend/src/modules/orders/buildYourBox.validation.test.js` | 14 validation tests |
| `backend/src/modules/orders/orderStock.js` | Nested stock deduction (perfume + treat lines) |

---

## Page Structure (top to bottom)

### 1. Editorial Introduction (`build-box-intro`)

Full-width section with copy ("One perfume. One sweet. One unforgettable gift.") and hero image (`home-ch4-complete.png`, the completed gift from the immersive story). Two CTAs: "Start with a perfume" (smooth-scrolls to Step 1) and "View cart". If no complete pairing exists in the catalogue, a data-note callout informs the customer and redirects to gift sets.

### 2. Same-Boutique Quality Rationale (`SameBoutiqueStrip`)

Explains why both items must come from one boutique: "Your perfume and sweet are prepared by one Tuti seller, packaged together and handed over as one coordinated gift." Three benefit chips: One quality standard · One package · One delivery.

### 3. Optional Occasion Selector (`OccasionSelector`)

Six occasion chips: Birthday, Eid, Wedding, Anniversary, Thank You, Just Because. Selecting an occasion makes a pre-written message suggestion available in Step 3. Selection is optional and can be cleared. Does not affect product filtering.

### 4. Builder Workspace (two columns)

**Left column — selection steps (`.build-box-main`):**

#### Step 1 — Choose a perfume

Grid of perfume choice cards (`ProductChoiceCard`). Each card shows the bottle art, boutique name, fragrance summary (top notes), family/size/lead-time meta, price, and a pairability hint ("2 sweets available" or "No sweets currently"). Perfumes with matching same-boutique sweets are sorted to the top.

Selecting a perfume automatically clears the treat selection if it was from a different boutique.

#### Step 2 — Add a cake or dessert

Grid filtered strictly to same-boutique cakes and desserts. Each card shows the treat visual (image or CSS cake/dessert art), boutique name, flavor line, size/servings/lead-time/allergen meta, price. "Message-friendly" helper badge shown when applicable.

When no perfume is selected: locked empty state prompts the user to start with Step 1. When a perfume is selected but no same-boutique sweets exist: empty state with "Change perfume" action.

#### Step 3 — Finishing touches (message and packaging)

Two sub-cards:
- **Message card:** textarea (240 char limit) for the recipient message. When an occasion is selected, a `MessageSuggestion` component shows the pre-written suggestion and a "Use suggestion" button (replaces existing text with a confirmation prompt).
- **Preparation card:** allergy/preparation note input (for the boutique, not the recipient). Packaging radio group: "Tuti presentation" (default) or "Gift wrapped".

#### Closing reassurance section

Three short items: Cash on delivery · Prepared with care · Ready-made option (links to gift sets).

**Right sidebar — Live preview + summary (`build-box-sidebar`):**

#### Live Gift Preview (`GiftPreview`)

Animated preview card with four states:
- **Waiting** — both slots empty
- **Perfume selected** — perfume slot filled; sweet slot shows "Add a cake or dessert"
- **Gift taking shape** — both selected; message slot shows "Your message is waiting"
- **Ready to present** — complete pair + message/packaging set; message card shown with occasion label and packaging note

Shows boutique name and running price total.

#### Gift Summary Card

Line items: Perfume · Sweet · Boutique · Occasion (if set) · Message status · Packaging · Preparation lead time (if applicable). Running price breakdown: Perfume + Sweet = Total gift.

When the pair is valid: "Add gift to cart — AED X" primary action button. After adding: success confirmation with "View cart" and "Build another gift" options.

When not yet ready: instruction copy + scroll-to-step action button.

---

## Cart Item Contract

One configured cart item is added with `separateLine: true`:

```json
{
  "id": "build-box",
  "productName": "Build Your Box",
  "category": "bundle",
  "shopId": "<selected shared shop>",
  "price": "<perfume + treat>",
  "quantity": 1,
  "bundledProductIds": ["<perfumeId>", "<treatId>"],
  "allergens": ["<from treat>"],
  "leadTimeDays": "<max of perfume and treat>",
  "metadata": {
    "itemMessage": "<card message>",
    "allergyNote": "<allergy note>",
    "giftWrap": true|false
  },
  "configuration": {
    "type": "build_your_box",
    "version": 1,
    "selectedPerfume": { "productId": "...", "name": "...", "category": "perfume", "price": ..., ... },
    "selectedTreat":   { "productId": "...", "name": "...", "category": "cake|dessert", "price": ..., ... },
    "giftWrap": true|false,
    "cardMessage": "...",
    "allergyNote": "...",
    "totalPrice": <number>
  }
}
```

---

## Business Rules

- Perfume and treat must come from the same shop (enforced client-side and backend-side).
- Box price = selected perfume price + selected treat price.
- Backend validates the full configuration before accepting the order.
- Seed/in-memory stock deduction deducts two lines: selected perfume and selected treat. `"build-box"` product ID is never deducted as stock.
- **MongoDB nested stock deduction is not yet implemented** — deferred to Phase 1 backend work.

---

## Backend Validation (`buildYourBox.validation.js`)

- `productId` must be `"build-box"`
- `category` must be `"bundle"`, `quantity` must be `1`
- `configuration.version` must be `1`
- `selectedPerfume.productId` and `selectedTreat.productId` are required and must exist
- Selected perfume must be category `"perfume"` and status `"Live"`
- Selected treat must be category `"cake"` or `"dessert"` and status `"Live"`
- Both must belong to the same shop
- `shopId` on the order item must match the selected shop
- Item price must equal `selectedPerfume.price + selectedTreat.price`
- `configuration.totalPrice` must equal item price

---

## APIs Used

| Endpoint | Purpose |
|---|---|
| `GET /api/marketplace/storefront` | Products and shops loaded at app boot |
| `POST /api/orders` | Order creation |

---

## Known Limitations

- Same-shop rule is strict; cross-boutique Build a Box is deferred until split-order fulfillment exists.
- MongoDB nested stock deduction is not yet implemented.
- No dedicated `/orders/:id` confirmation route; order result lives in CartCheckoutPage state and clears on navigation or refresh.

---

## Build Status

`npm run build -w @tuti/web` — PASS (verified 2026-06-08)  
`node --test backend/src/modules/orders/buildYourBox.validation.test.js` — 14 tests PASS

## QA Status

Verified during accepted QA passes (recorded as one-off Playwright browser sessions; no committed repeatable test suite exists):

- Perfume selection with pairability hints: PASS
- Same-boutique treat selection: PASS
- No-treats empty state with Change perfume action: PASS
- Occasion selector and message suggestion: PASS
- Message (240 char), allergy note, packaging options: PASS
- Live preview state transitions (Waiting → Perfume → Paired → Complete): PASS
- Gift summary with lead time: PASS
- Add to cart as configured single line item: PASS
- Mini cart display (perfume + treat line items): PASS
- Checkout summary: PASS
- Account order detail: PASS
- Backend validation errors 400/409: PASS
