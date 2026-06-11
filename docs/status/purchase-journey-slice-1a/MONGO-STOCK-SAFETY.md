# Slice 1A — MongoDB Stock Safety

## Existing implementation (confirmed, not changed)

`orderStock.js` provides:

**`resolveOrderStockLines(items)`**
- Normal products: adds `{ productId, quantity }` to a Map
- Build Your Box items: adds `selectedPerfume.productId` and `selectedTreat.productId` — never the synthetic `"build-box"` id
- Duplicates: quantities are aggregated via Map accumulation

**`deductMongoStockWithRollback(ProductModel, stockLines)`**
1. Preflight: `Product.find({ id: { $in: productIds } })` — throws 404 if any product is missing; throws 409 if stock < required
2. Sequential `updateOne({ id, stock: { $gte: quantity } }, { $inc: { stock: -qty, orders: +qty } })` per stock line
3. If any update fails (matchedCount !== 1), roll back all applied lines (reverse order) and rethrow

**`rollbackMongoStock(ProductModel, appliedStockLines)`**
- Reverses the `$inc` on each applied line in reverse order

## Atomicity posture

The implementation is NOT fully atomic. It uses sequential conditional updates, not a MongoDB multi-document transaction. The risk:
- If the Node.js process crashes between a successful stock deduction and the `Order.create` call, stock may be permanently decremented without a corresponding order.
- The manual rollback in the catch block addresses most failure modes but not process crash.

**Why no transaction was added in this slice:**
The Atlas cluster supports transactions. However, adding a session/transaction wrapper to `deductMongoStockWithRollback` would require passing the session through `Product.find`, `Product.updateOne`, and `Order.create`, touching the function signatures. This is a safe improvement for a future slice.

**Protection in place:**
- The `$gte: quantity` filter prevents overselling from concurrent requests
- Rollback prevents partial deductions from failed creates
- Idempotency key prevents a second deduction on duplicate submissions

## Customer-safe error mapping

`toCustomerSafeError(err)` in `orders.service.js` maps:
- 404 not-found (product missing) → `"One of your selected items is no longer available."` (status 422)
- 409 insufficient stock → `"One of your selected items has just sold out. Please review your cart."` (status 409)
- 409 pairing error → `"This gift pairing is no longer available. Please rebuild your box."` (status 409)
- 400 Build Your Box invalid → `"Your Build Your Box configuration is invalid. Please rebuild your gift."` (status 400)

Internal product IDs are never exposed in customer-facing error messages.

## Seed mode parity

`deductSeedStock` performs an atomic preflight-then-mutate within a single synchronous call. No rollback needed since it's fully synchronous. Tests confirm parity with MongoDB mode for the common cases.
