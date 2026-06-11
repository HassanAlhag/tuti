/**
 * Tuti Showcase Seed
 *
 * Populates the running local dev server with enough homepage content to
 * evaluate the full design. Requires the backend to be running on PORT 5055.
 *
 * Usage:
 *   npm run seed:showcase          — populate placements
 *   npm run seed:showcase:reset    — (no-op in seed mode; placements reset on server restart)
 *
 * Safety:
 *   - Idempotent: duplicate placements are rejected silently (409 → skip)
 *   - Only calls the local dev API — no production data touched
 *   - Works only when backend is in seed mode (no MONGO_URI)
 */

const BASE = `http://localhost:${process.env.PORT || 5055}`;

// ── Seller profiles to publish and feature ─────────────────────────────────
const FEATURED_SELLERS = [
  {
    shopId: "shop-oud-lane",
    profile: {
      displayName: "Oud Lane",
      displayNameAr: "درب العود",
      shortTagline: "Luxury oud and amber from independent Dubai houses.",
      brandStory: "Oud Lane was founded in Al Quoz with a single belief: that oud should be worn, not collected. Every blend is small-batch, every bottle numbered. Sourced from Cambodian, Indian and Hindi oud forests.",
      fragranceIdentityTags: ["Oud", "Amber", "Luxury"],
      specialties: ["Oud blends", "Extrait strength", "Reserve collection"],
      trustBadges: ["Verified boutique", "UAE-made"],
      published: true,
    },
    placement: { priority: 100 },
  },
  {
    shopId: "shop-sweet-studio",
    profile: {
      displayName: "Sweet Studio",
      displayNameAr: "ستوديو سويت",
      shortTagline: "Artisan cakes, desserts and perfume gifts for every celebration.",
      brandStory: "Sweet Studio started in a home kitchen in Dubai. Now based in JLT, every cake is made fresh daily and every perfume pairing is chosen to complement the celebration. Specialising in bespoke gifting boxes.",
      fragranceIdentityTags: ["Gourmand", "Floral", "Gift pairing"],
      specialties: ["Celebration cakes", "Gift boxes", "Parfum pairings"],
      trustBadges: ["Verified boutique", "Gift specialist"],
      published: true,
    },
    placement: { priority: 90 },
  },
  {
    shopId: "shop-la-patisserie",
    profile: {
      displayName: "La Pâtisserie",
      displayNameAr: "لا باتيسيري",
      shortTagline: "French-inspired pastry and Arabic sweets crafted for gifting.",
      brandStory: "Founded by a classically trained pastry chef from Abu Dhabi, La Pâtisserie bridges French technique and Khaleeji flavour. Pistachio, rose water, cardamom and saffron — every piece tells a story.",
      fragranceIdentityTags: ["Arabic", "Floral", "Heritage"],
      specialties: ["French pastry", "Arabic sweets", "Ramadan boxes"],
      trustBadges: ["Verified boutique", "Artisan maker"],
      published: true,
    },
    placement: { priority: 80 },
  },
  {
    shopId: "shop-citrus-atelier",
    profile: {
      displayName: "Citrus Atelier",
      displayNameAr: "أتيليه الحمضيات",
      shortTagline: "Clean daily scents with citrus, tea, neroli and cedar.",
      brandStory: "Citrus Atelier was born on the Abu Dhabi Corniche. The philosophy is simple: a scent should be easy to wear and easy to love. No heaviness, no complexity — just clean, confident freshness.",
      fragranceIdentityTags: ["Fresh", "Clean", "Daily wear"],
      specialties: ["Office perfumes", "Travel sizes", "Unisex blends"],
      trustBadges: ["Verified boutique", "Abu Dhabi made"],
      published: true,
    },
    placement: { priority: 70 },
  },
];

// ── Products for Luxury Picks ───────────────────────────────────────────────
const LUXURY_PICKS = [
  { productId: "prf-001", shopId: "shop-oud-lane",     priority: 100, badgeLabel: "Luxury pick" },
  { productId: "prf-005", shopId: "shop-oud-lane",     priority: 90,  badgeLabel: "Luxury pick" },
  { productId: "gft-001", shopId: "shop-sweet-studio", priority: 80,  badgeLabel: "Luxury pick" },
  { productId: "gft-002", shopId: "shop-sweet-studio", priority: 70,  badgeLabel: "Luxury pick" },
];

// ── Products for New Arrivals ───────────────────────────────────────────────
const NEW_ARRIVALS = [
  { productId: "prf-006", shopId: "shop-citrus-atelier", priority: 100, badgeLabel: "New arrival" },
  { productId: "prf-003", shopId: "shop-citrus-atelier", priority: 90,  badgeLabel: "New arrival" },
  { productId: "cke-002", shopId: "shop-sweet-studio",   priority: 80,  badgeLabel: "New arrival" },
  { productId: "gft-003", shopId: "shop-la-patisserie",  priority: 70,  badgeLabel: "New arrival" },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
async function request(path, method = "GET", body = null, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

function log(symbol, message) {
  process.stdout.write(`${symbol}  ${message}\n`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  log("🌱", "Tuti Showcase Seed — starting");
  log("📡", `Backend: ${BASE}`);

  // 1. Login as admin
  const loginRes = await request("/api/auth/login", "POST", {
    email: "admin@tuti.dev",
    password: "password123",
  });
  if (!loginRes.body?.data?.accessToken) {
    log("✗", `Login failed: ${JSON.stringify(loginRes.body)}`);
    process.exit(1);
  }
  const token = loginRes.body.data.accessToken;
  log("✓", "Logged in as admin");

  // 2. Publish brand profiles and create featured seller placements
  log("─", "");
  log("🏪", "Setting up featured sellers...");

  for (const entry of FEATURED_SELLERS) {
    // 2a. Publish brand profile via new admin route
    const profileRes = await request(
      `/api/marketplace/admin/shops/${entry.shopId}/brand-profile`,
      "PATCH",
      entry.profile,
      token
    );
    if (profileRes.status !== 200) {
      log("⚠", `  Brand profile for ${entry.shopId}: HTTP ${profileRes.status} — ${JSON.stringify(profileRes.body?.error || profileRes.body)}`);
    } else {
      const profile = profileRes.body?.data;
      log("✓", `  ${entry.shopId} — brand profile published (id: ${profile?.id || "seed"})`);

      // 2b. Get the brand profile ID (in seed mode it equals shopId)
      const brandProfileId = profile?.id || entry.shopId;

      // 2c. Create featured seller placement
      const placementRes = await request(
        "/api/admin/merchandising/featured-sellers",
        "POST",
        {
          shopId: entry.shopId,
          brandProfileId,
          placementKey: "homepage_featured_sellers",
          ...entry.placement,
        },
        token
      );
      if (placementRes.status === 200 || placementRes.status === 201) {
        log("✓", `  ${entry.shopId} — featured seller placement created`);
      } else if (placementRes.status === 409) {
        log("·", `  ${entry.shopId} — placement already exists (skip)`);
      } else {
        log("⚠", `  ${entry.shopId} — placement HTTP ${placementRes.status}: ${JSON.stringify(placementRes.body?.error || placementRes.body)}`);
      }
    }
  }

  // 3. Create Luxury Picks placements
  log("─", "");
  log("✨", "Setting up Luxury Picks...");

  for (const pick of LUXURY_PICKS) {
    const res = await request(
      "/api/admin/merchandising/featured-products",
      "POST",
      { ...pick, placementKey: "luxury_picks" },
      token
    );
    if (res.status === 200 || res.status === 201) {
      log("✓", `  ${pick.productId} → luxury_picks`);
    } else if (res.status === 409) {
      log("·", `  ${pick.productId} → luxury_picks already exists (skip)`);
    } else {
      log("⚠", `  ${pick.productId} → luxury_picks HTTP ${res.status}: ${JSON.stringify(res.body?.error || res.body)}`);
    }
  }

  // 4. Create New Arrivals placements
  log("─", "");
  log("🆕", "Setting up New Arrivals...");

  for (const arrival of NEW_ARRIVALS) {
    const res = await request(
      "/api/admin/merchandising/featured-products",
      "POST",
      { ...arrival, placementKey: "new_arrivals" },
      token
    );
    if (res.status === 200 || res.status === 201) {
      log("✓", `  ${arrival.productId} → new_arrivals`);
    } else if (res.status === 409) {
      log("·", `  ${arrival.productId} → new_arrivals already exists (skip)`);
    } else {
      log("⚠", `  ${arrival.productId} → new_arrivals HTTP ${res.status}: ${JSON.stringify(res.body?.error || res.body)}`);
    }
  }

  // 5. Verify
  log("─", "");
  log("🔍", "Verifying placements...");

  const sellersRes = await request("/api/public/merchandising/featured-sellers?placementKey=homepage_featured_sellers");
  const sellers = sellersRes.body?.data || [];
  log("✓", `  Featured sellers visible: ${sellers.length}`);
  sellers.forEach((s) => log("  ·", s.seller?.displayName || s.shopId));

  const luxuryRes = await request("/api/public/merchandising/featured-products?placementKey=luxury_picks");
  const luxury = luxuryRes.body?.data || [];
  log("✓", `  Luxury Picks visible: ${luxury.length}`);

  const newRes = await request("/api/public/merchandising/featured-products?placementKey=new_arrivals");
  const newArr = newRes.body?.data || [];
  log("✓", `  New Arrivals visible: ${newArr.length}`);

  log("─", "");
  log("✅", "Showcase seed complete.");
  log("ℹ", "Note: Placements reset on server restart (in-memory seed mode).");
  log("ℹ", "Re-run this script after each server restart: npm run seed:showcase");
}

run().catch((err) => {
  process.stderr.write(`\nSeed error: ${err.message}\n`);
  process.exit(1);
});
