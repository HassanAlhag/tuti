# Seller Shop Ownership Hardening

## Summary

Seller-scoped backend routes must not trust a `shopId` supplied by the client or carried in a JWT claim by itself. Phase 0 hardening makes shop ownership database-backed: a seller request is allowed only when the authenticated seller user owns the shop recorded in the Shop document.

## Fixed Model

- Seller registration ignores client-supplied `shopId`.
- Seller registration creates the seller User and Shop in one MongoDB transaction.
- Shop `ownerId` is the authority for ownership.
- Seller JWT `shopId` is treated as unverified routing context until `requireOwnedShop` confirms it.
- `requireOwnedShop` attaches `req.ownedShop` and `req.ownedShopId`; seller routes should pass `req.ownedShopId` downstream.
- Ownership and shop approval status are separate. Pending or suspended sellers may still need dashboard access, while public publishing and operations gates remain route/service specific.
- Admin routes may query or select a shop explicitly and are not rewritten to `req.ownedShopId`.

## Transaction Requirement

Production examples use MongoDB Atlas-style `mongodb+srv` deployments; Atlas replica sets support transactions. Local standalone MongoDB commonly does not support transactions.

Seller registration must fail safely if transaction support is unavailable. Do not add a non-transactional fallback for production seller registration because it can leave orphaned seller users or shops.

## Partial Unique Index

`User.shopId` has a partial unique index scoped to seller users only:

- Applies only to `role: "seller"` with string `shopId`.
- Ignores null or missing `shopId`.
- Does not block multiple drivers sharing a parent shop ID.
- May fail to build if duplicate seller `shopId` values already exist.

## Deployment Rollout

1. Run the read-only ownership audit against the target database.
2. Manually reconcile duplicate seller `shopId`, missing shop, missing owner, non-seller owner, and mismatched owner records.
3. Deploy or allow the partial unique index to build.
4. Verify the index exists.
5. Deploy route-level ownership enforcement.
6. Test seller login and own-shop dashboard/product/order access.

Do not auto-delete, reassign, or seed production ownership data as part of this rollout.

## Read-Only Audit

Run:

```sh
npm run audit:seller-shop-ownership
```

The audit requires `MONGO_URI` and exits:

- `0` when no issues are found.
- `1` when ownership integrity issues are found.
- `2` when the audit cannot run, such as missing Mongo configuration.

The script is read-only and connects directly without running seed helpers.

## Manual Reconciliation

For any issue reported by the audit:

- Confirm the correct seller account with business/admin records.
- Confirm the intended Shop document.
- Update only after approval from an operator with production data authority.
- Re-run the audit after every correction.
- Keep a record of before/after values and approver.

## Seed/Demo Ownership

Seed-memory mode uses a stable demo seller user ID for the demo seller login. The seeded `shop-oud-lane` Shop records that ID as `ownerId`, so demo seller routes exercise the same ownership middleware as normal seller routes.

## Rollback Notes

If enforcement blocks legitimate sellers after deployment:

- Do not disable ownership checks globally without incident approval.
- Run the audit and inspect the blocked seller’s User `_id`, User `shopId`, Shop `id`, and Shop `ownerId`.
- Correct stale ownership data when confirmed.
- If a code rollback is required, keep the partial unique index unless it is the confirmed cause of the incident.
