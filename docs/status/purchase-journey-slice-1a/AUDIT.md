# Slice 1A Audit — Purchase Journey

Audited: 2026-06-08

---

## 1. Current order creation flow

`POST /api/orders` → `optionalAuth` (guest or authenticated) → Zod schema validation → Build Your Box validation → `resolveOrderStockLines` → stock deduction → `Order.create` (Mongo) or seedOrders.set (seed) → `notifyOrderCreated`.

Order object returned directly in `{ data: order }` response body.

## 2. Orders stored in MongoDB and seed/in-memory mode

**MongoDB mode:** `Order.create` persists to MongoDB Atlas. Indexed on `orderId` (unique), `customerId`, `shopIds`, `status`.

**Seed mode:** In-memory `seedOrders` Map (keyed on `orderId`) plus `seedRepository.getState().orders` array. Orders survive for the process lifetime but reset on server restart or `__resetSeedOrdersForTests()`.

## 3. Current customer ownership checks

`getOrder(orderId, user)`:
- `admin` / `support` → unrestricted
- `seller` → must own one of the order's `shopIds`
- `customer` → `order.customerId === user.sub`
- No other roles allowed

**Gap before this slice:** The GET route required full authentication (`authenticate` middleware). Guests could create orders but not retrieve them.

## 4. Current guest checkout behavior

Guest checkout is genuinely supported:
- `POST /api/orders` uses `optionalAuth`; if no token, `userId` is null
- `order.customerId` is set to `null`
- `order.checkoutMode` is `"guest"`
- The UI shows a guest checkout option

**Gap before this slice:** `GET /api/orders/:orderId` required authentication, so guests could not retrieve their own orders. No persistent confirmation route existed.

## 5. Current order ID field used publicly

`orderId` (format: `ORD-XXXXXXXX`, generated with `randomUUID().slice(0, 8).toUpperCase()`). Already unique-indexed in MongoDB. Used publicly in all existing confirmation, notification, and account views. The MongoDB `_id` is not exposed to customers.

## 6. Current confirmation implementation

After `POST /api/orders` succeeds, `CartCheckoutPage.jsx` sets `orderResult` in component state and renders an inline confirmation panel on the `/cart` page. This panel clears on navigation, refresh, or tab close. No persistent route existed.

## 7. Current stock deduction implementation

`orderStock.js` provides:
- `resolveOrderStockLines(items)` — resolves Build Your Box items to their nested perfume+treat product IDs; never includes the synthetic "build-box" ID
- `deductSeedStock(products, stockLines)` — preflight check then in-place mutation; throws 409 on insufficient stock
- `deductMongoStockWithRollback(ProductModel, stockLines)` — preflight check, then sequential `updateOne` with `stock: { $gte: quantity }` filter; rolls back on failure

## 8. How Build a Box resolves its two stock products

`resolveOrderStockLines` checks `item.configuration?.type === "build_your_box"`. If true, it adds `selectedPerfume.productId` and `selectedTreat.productId` (aggregated by product ID) to the stock lines map. The synthetic `"build-box"` product ID is never added. This behavior was already implemented for both seed and MongoDB mode before this slice.

The documentation in `system-status.md` ("MongoDB nested stock deduction not implemented") was inaccurate — the implementation was already present in `deductMongoStockWithRollback` via `resolveOrderStockLines`. This slice confirms and tests that existing behavior.

## 9. Current submit-button behavior

The "Place COD order" button is disabled while `isPlacingOrder` is true (frontend-only). No idempotency key was sent before this slice. No duplicate-submit protection at the backend level existed.

## 10. Current server error exposure

Service throws errors with status codes and messages like:
- `"Product not found for stock deduction: prf-xxx."` (404) — **exposed internal ID**
- `"Insufficient stock for Perfume Name."` (409) — exposed product name
- MongoDB E11000 duplicate key errors — would surface as 500 without mapping

The error handler in `app.js` returns `err.message` for status < 500 and `"Unexpected server error."` for 500+. So stock errors with 404/409 were passing through raw.

## 11. Current account order-history links

`AccountPage.jsx` renders an inline order list; clicking a row sets `selectedOrderId` in state and shows a detail panel. No link to `/orders/:orderId` existed. The account page uses `?order=` query param for deep-linking to a specific order within the list, but only within the same page session.

## 12. Transaction support assumptions

The system uses `MONGO_URI` pointing to MongoDB Atlas (a replica set/Atlas cluster). MongoDB transactions require a replica set or sharded cluster. Atlas clusters support transactions. However, the current `deductMongoStockWithRollback` does NOT use MongoDB sessions/transactions — it uses sequential conditional updates with manual rollback.

No MongoDB transaction session was implemented before this slice. The atomicity claim is: conditional updates protect against overselling; rollback is best-effort (may leave orphaned stock deductions if the process crashes between a deduction and the subsequent failure).
