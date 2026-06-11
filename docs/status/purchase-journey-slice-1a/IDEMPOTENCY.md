# Slice 1A — Idempotency Implementation

## Client

1. `CartCheckoutPage` holds an idempotency key in a `useRef`. The key is `null` until the first submit.
2. On first submit, `crypto.randomUUID()` generates the key.
3. The key is reused on retry (same ref value, not regenerated).
4. After confirmed success, the ref is reset to `null` so the next checkout attempt gets a fresh key.
5. The key is sent as `Idempotency-Key: <uuid>` request header via `ordersApi.create(payload, idempotencyKey)`.
6. The Place Order button is disabled while `isPlacingOrder === true`, preventing double-click submission.

## API client

`ordersApi.create(p, idempotencyKey)` in `packages/shared/api/client.js` sends the key as a custom header when provided.

## Backend — validation

The route handler validates the header format with `/^[0-9a-f-]{8,128}$/i` (hex characters and hyphens, 8–128 chars). Invalid or missing keys result in `validatedKey = null` — the request proceeds as a normal non-idempotent create.

## Backend — seed mode

- `seedIdempotencyKeys: Map<key, orderId>` stores the association.
- On create: check map before proceeding. If key exists, look up the order and compare fingerprints.
- After create: register key → orderId in the map.
- `__resetSeedOrdersForTests()` clears both `seedOrders` and `seedIdempotencyKeys`.

## Backend — MongoDB mode

- `idempotencyKey` is stored as a field on the Order document.
- A sparse unique index (`{ unique: true, sparse: true }`) on `idempotencyKey` allows null values without conflict while enforcing uniqueness for set keys.
- On create: pre-check with `Order.findOne({ idempotencyKey })` before attempting creation. If found and fingerprint matches → return existing. If fingerprint differs → 409.
- If two concurrent requests race past the pre-check, the MongoDB unique index catches the duplicate: E11000 → catch block → look up existing → return.

## Fingerprint

A SHA-256 digest of `${customerEmail}|${sorted item productId:quantity pairs}`, truncated to 32 hex chars. Stored as `requestFingerprint` on the order. Used to detect materially different payloads on key collision.

## Response fields stripped

`idempotencyKey` and `requestFingerprint` are never returned in GET or POST responses (`stripInternalOrderFields`).

## Limitations

- The idempotency window is permanent (no expiry on keys). In a production system with large order volumes, old keys should be pruned after a business-defined window (e.g., 7 days).
- Fingerprint comparison covers email and items only; a change of delivery address with the same key would reuse the original order.
- No distributed lock: the MongoDB unique index is the only concurrency control. Two simultaneous creates can both pass the pre-check but only one succeeds at `Order.create`; the other gets E11000 and returns the winner. This is safe but the loser gets a slightly different response path.
