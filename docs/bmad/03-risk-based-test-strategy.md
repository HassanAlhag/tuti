# Risk-Based Test Strategy

Source: `docs/bmad-system-review.md`  
Status: planning draft  
Date: 2026-06-12

## Test strategy goal

The QA strategy prioritizes marketplace trust over broad surface coverage. The first launch test suite must prove that Tuti cannot create unsafe orders, unsafe payment states, unsafe production sessions, unsafe public catalog exposure, broken delivery completion, broken refresh sessions, or unreconciled finance movement.

## Risk method

Use a probability x impact model:

- Probability: 1 low, 2 medium, 3 high.
- Impact: 1 low, 2 medium, 3 high.
- Risk score: probability x impact.
- P1: score 9 or launch-blocking regardless of score.
- P2: score 6 to 8.
- P3: score 3 to 5.
- P4: score 1 to 2.

P1 risks must have automated coverage or explicit manual launch signoff. P2 risks should have automated service/API coverage before launch unless the launch cohort is tightly controlled.

## Priority risk matrix

| Risk | Probability | Impact | Score | Priority | Required evidence |
| --- | ---: | ---: | ---: | --- | --- |
| Checkout tampering | 3 | 3 | 9 | P1 | API/service tests proving server repricing and rejection |
| Production seed safety | 3 | 3 | 9 | P1 | Env validation tests and deployment smoke check |
| Card payment state | 3 | 3 | 9 | P1 | API/UI tests proving card checkout is rejected/hidden |
| Driver delivery completion | 3 | 3 | 9 | P1 | API/service tests for delivery completion success and side effects |
| Public catalog exposure | 3 | 3 | 9 | P1 | API tests proving only live/approved public data returns |
| Refresh token rotation | 2 | 3 | 6 | P2 | API/client tests proving rotated refresh token is stored and stale token rejected |
| Finance reconciliation | 2 | 3 | 6 | P2 | Integration tests and reconciliation report cases |
| Proof-of-delivery persistence | 2 | 2 | 4 | P3 | API/model persistence tests |
| Reviews trust | 2 | 2 | 4 | P3 | API tests preventing self-verified reviews |
| Upload storage safety | 2 | 2 | 4 | P3 | Config and upload validation tests |

## Test layers

### Unit and service tests

Purpose: validate isolated domain rules quickly.

Targets:

- Checkout intent normalization.
- Pricing calculation.
- Build Your Box validation.
- Payment method rules.
- Order workflow transitions.
- Product workflow transitions.
- Delivery state transitions.
- Seller ledger transaction creation.
- Payout eligibility.
- Refresh token rotation logic.
- Env validation.

### API integration tests

Purpose: validate route, auth, validation, persistence, and response behavior.

Targets:

- `/api/orders`
- `/api/marketplace/storefront`
- `/api/marketplace/search`
- `/api/auth/login`
- `/api/auth/refresh`
- `/api/driver` and `/api/drivers`
- `/api/marketplace/admin/...`
- `/api/support`
- `/api/admin/reports`

API tests should run against both seed mode where useful and Mongo mode for launch-critical persistence.

### End-to-end tests

Purpose: prove the critical user journeys work across frontend and backend.

Initial Playwright suite:

- Guest COD checkout for standard product.
- Account COD checkout for standard product.
- Build Your Box COD checkout.
- Seller moves order to Ready for Delivery.
- Driver pickup and delivery completion.
- Admin COD settlement.
- Customer accepts delivered order.
- Customer disputes delivered order and support sees the dispute.

### Security and negative tests

Purpose: prove that unsafe behavior is rejected.

Targets:

- Price tampering.
- Shop ID tampering.
- Draft/rejected product checkout.
- Out-of-stock checkout.
- Unauthorized order access.
- Seller accessing another shop order.
- Driver completing another driver's delivery.
- Optional-auth review verification abuse.
- Production env missing required vars.
- Stale refresh token reuse.

### Reconciliation tests

Purpose: prove financial state can be explained.

Targets:

- Delivered non-COD order path remains disabled or controlled until gateway support.
- COD delivered order does not credit seller until admin settlement.
- COD settlement creates exactly one seller ledger credit.
- Customer dispute freezes balance.
- Resolution release or refund creates correct ledger entries.
- Payout debit reduces available balance and links to payout record.
- Re-running settlement/payout commands does not duplicate money movement.

## P1 test plan

### Checkout tampering

Required tests:

- Client sends lower price than product record; order subtotal uses product record price.
- Client sends higher price than product record; order subtotal uses product record price.
- Client sends different shop ID; order shop IDs use Product records.
- Client sends product name mismatch; order item snapshot uses Product record name.
- Client sends draft/rejected/pending product; API rejects order.
- Client sends out-of-stock quantity; API rejects order and does not create order.
- Client sends Build Your Box cross-shop pair; API rejects order.
- Client sends Build Your Box tampered total; API recalculates or rejects.
- Duplicate idempotency key with changed canonical intent returns conflict.

Acceptance evidence:

- Service tests for pricing/normalization.
- API tests for order creation.
- One E2E checkout smoke using returned authoritative totals.

### Production seed safety

Required tests:

- Production env with no `MONGO_URI` fails validation.
- Production env with development JWT secrets fails validation.
- Production env with no explicit CORS origin fails validation.
- Production env cannot auto-create admin/seller/customer demo login.
- Production health endpoint never reports seed-memory in a successful boot.

Acceptance evidence:

- Env validation unit tests.
- Deployment smoke script or CI check for production-like config.

### Card payment state

Required tests:

- API rejects `paymentMethod: card` while gateway disabled.
- API does not create `Authorization` payment status for card without provider result.
- Customer UI cannot submit card checkout when gateway disabled.
- Existing constants/copy do not imply card is available in production unless feature flag enabled.

Acceptance evidence:

- API test.
- Frontend component/E2E smoke, or manual UAT with screenshot until frontend tests exist.

### Driver delivery completion

Required tests:

- Assigned driver can mark pickup.
- Assigned driver can mark delivery once.
- Delivery completion returns success and does not throw after mutation.
- Duplicate delivery completion is rejected or returns idempotent success without duplicate ledger/driver counts.
- Delivery completion persists deliveredAt, proofOfDeliveryUrl, COD amount, note, and status history.
- Seller delivery path and general driver path create consistent side effects.
- Delivered order creates exactly expected seller earning/commission/notification behavior.

Acceptance evidence:

- Service tests around driver delivery.
- Mongo integration test for schema persistence.
- E2E smoke through driver portal after implementation.

### Public catalog exposure

Required tests:

- Storefront does not return Draft products.
- Storefront does not return Needs approval products.
- Storefront does not return Rejected products.
- Storefront does not return suspended/hidden seller shop data.
- Search returns only live products.
- Public seller products returns only live products for published seller profile.
- Public review payload excludes internal fields.

Acceptance evidence:

- API tests with seeded products across statuses.

## P2 test plan

### Refresh token rotation

Required tests:

- Login returns access and refresh tokens.
- Refresh returns new access and refresh tokens.
- Client stores the new refresh token.
- Old refresh token fails after rotation.
- Expired/invalid refresh clears auth state.
- Logout revokes refresh token where supported.

Acceptance evidence:

- Auth service tests.
- Shared API client tests or integration harness.
- Manual portal idle/refresh UAT until browser automation exists.

### Finance reconciliation

Required tests:

- COD order delivered with collected cash increases driver COD balance.
- COD settlement creates seller COD credit once.
- Settlement candidate excludes unsettled, disputed, already settled, non-COD, or non-delivered orders.
- Dispute freezes or holds balance.
- Resolution release/refund creates correct ledger entries.
- Payout creation debits available balance only when eligible.
- Reconciliation report explains order total, platform fee, vendor net, ledger entries, payout state, and outstanding COD.

Acceptance evidence:

- Finance service tests.
- Mongo integration tests.
- Admin report snapshot tests where feasible.

## E2E launch smoke suite

Minimum smoke scenarios:

1. Customer places COD standard order as guest.
2. Customer places COD Build Your Box order as guest.
3. Account customer places COD order and sees it in account.
4. Seller sees order and progresses to Ready for Delivery.
5. Driver picks up and completes delivery with COD amount.
6. Admin settles COD and sees seller balance transaction.
7. Customer accepts delivered order.
8. Customer disputes delivered order and support resolves it.
9. Public storefront hides non-live products.
10. Production-like env validation fails closed when required vars are missing.

## CI plan

Phase 1:

- Add root `npm test`.
- Add backend `npm test`.
- Run backend node tests.
- Add API/service tests for P1 risks.

Phase 2:

- Add Mongo integration test job.
- Add Playwright smoke job for critical flows.
- Store traces/screenshots on failure.

Phase 3:

- Add lint/typecheck/static checks.
- Add dependency vulnerability scan.
- Add secret scan.
- Add Docker/backend runtime smoke.
- Add visual regression for key premium pages.

## Manual UAT remains required

Manual UAT should continue until full automation exists for:

- Premium gifting presentation and copy.
- Seller handling of gift messages/allergy notes.
- Driver proof-of-delivery usability.
- Admin settlement clarity.
- Support/dispute operator clarity.
- Mobile checkout usability.

Manual UAT evidence should include tester, date, environment, role, scenario, result, screenshots when visual, and linked defect/story when failed.

## Exit criteria for MVP test readiness

- All P1 automated tests pass in CI.
- P2 finance/auth tests pass or have documented launch waiver.
- Critical E2E smoke suite passes on a production-like environment.
- No known checkout tampering path remains open.
- No production seed/demo path remains open.
- No card payment state can be created without gateway authorization.
- No public API exposes draft/rejected products.
- Delivery completion is proven to succeed and persist required fields.
- Finance reconciliation report can explain sample COD order lifecycle.

