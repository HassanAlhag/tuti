# Customer UI — Fresh Starting Point

This is a fresh starting point. The Phase 11 / 11B / Phase 12 temporary
visual-cleanup reports have been removed. This note replaces them.

**Workflow:** no commits or pushes happen unless explicitly approved.

**Customer UI direction:** soft premium SaaS / bento layout / warm cream
+ forest green base / subtle glass surfaces — not generic ecommerce, not
heavy glass, not oversized empty sections.

**Data issue:** the customer app needs a real Mongo-backed catalogue and
real product images before a final visual pass — seed/demo data and
placeholder imagery are still standing in for both in places.

**Bilingual decision:** keep all `*Ar` data fields (backend, models,
seed data — untouched). Render Arabic only when a locale is explicitly
selected as `"ar"`; customer English pages render English only via
`getLocalizedField()` (`packages/shared/utils/locale.js`). No language
switcher or RTL layout yet — that's future work, not done here.

**Next focus:** get a visibly better result on the pages that matter
first, then come back for foundation/data cleanup — not the other way
around.
