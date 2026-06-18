# Release Readiness Status

Date: 2026-06-18  
Scope: Tuti / Perfume Marketplace BMAD release readiness snapshot.

## Purpose

This document summarizes the current BMAD release status after Phase 1 critical launch hardening, Phase 2 production readiness cleanup, Phase 3 access-control follow-ups, and Phase 4 release operations readiness. It complements the deployment runbook in `docs/bmad/06-deployment-runbook-and-launch-checklist.md`; the runbook explains how to deploy, while this status document explains whether the release is ready to proceed.

## Status Legend

| Status | Meaning |
| --- | --- |
| Done | Implemented and covered by focused tests or documentation. |
| Ready for verification | Implemented locally and ready for release-owner, QA, or staging verification. |
| Open risk | Known launch risk that needs explicit acceptance, mitigation, or follow-up. |
| Deferred | Intentionally out of MVP scope or postponed to a later phase. |
| Blocked | Must be resolved before launch can proceed. |

## Executive Status

Current recommendation: Ready for verification, not final Go.

The launch-critical backend controls are materially stronger than the original system review baseline. COD checkout authority, production hard stops, public storefront filtering, delivery completion safety, auth refresh rotation, verified-purchase review enforcement, guest order access hardening, user mutation gate hardening, and key permission follow-ups now have focused coverage.

The release is not final-Go until all uncommitted BMAD changes are reviewed and committed, the critical smoke suite passes on the release candidate, the user-management mutation gate test passes, production environment hard stops are verified in staging, and launch waivers are explicitly accepted for deferred items such as card payments, full payment gateway support, optional Mongo smoke coverage, private proof-of-delivery media, and object-storage hardening.

## BMAD Phase Status

| Phase | Status | Summary |
| --- | --- | --- |
| Phase 1: Critical launch hardening | Done | Checkout authority, COD-only checkout, production hard stops, driver delivery safety, public storefront filtering, refresh token rotation, proof-of-delivery persistence, and critical smoke index were implemented. |
| Phase 2: Production readiness cleanup | Done | Logger/test setup, critical smoke npm script, opt-in Mongo smoke, API permission matrix, and deployment runbook were added. |
| Phase 3: Access-control follow-ups | Ready for verification | Driver route ownership, verified-purchase reviews, guest order token access/log redaction, SR target mutation fail-closed, and support/audit permission cleanup were implemented. Phase 3 changes are pending commit in the current worktree. |
| Phase 4: Release operations readiness | Ready for verification | Release readiness status, backup/restore runbook, COD/payment reconciliation SOP, upload/media storage security policy, and admin/user mutation gate hardening have been added. |

## Completed Controls By Domain

### Checkout/Payment

| Control | Status | Notes |
| --- | --- | --- |
| Server-authoritative order normalization and repricing | Done | Backend ignores client-supplied normal item product name, shop ID, price, subtotal, platform fee, vendor net, and shop IDs. |
| Quantity preserved from checkout intent | Done | Quantity remains honored while product/shop/price authority comes from backend product data. |
| Live product requirement | Done | Checkout requires live products for normal product purchases. |
| COD-only API behavior | Done | Omitted payment method defaults to COD; non-COD payment methods fail closed with `422`. |
| Card payment gateway | Deferred | Card checkout remains disabled until a real payment gateway lifecycle is designed and tested. |

### Production Safety

| Control | Status | Notes |
| --- | --- | --- |
| Production Mongo requirement | Done | `MONGO_URI` is required in production. |
| Real JWT secrets | Done | Production requires non-placeholder JWT secrets with minimum length. |
| Explicit real CORS origins | Done | Production rejects missing, default, localhost, and loopback CORS origins. |
| Seed-memory production block | Done | Seed-memory DB mode is blocked in production. |
| Seed/demo auth production block | Done | Seed/demo auth behavior is blocked in production. |

### Delivery/COD

| Control | Status | Notes |
| --- | --- | --- |
| Driver delivery `safeShopId` fix | Done | Delivery completion no longer mutates and then fails on an undefined notification shop ID. |
| Duplicate completion safety | Done | Existing duplicate guards protect delivery stats, COD balances, settlement state, and earnings behavior. |
| Proof-of-delivery persistence | Done | `pickedUpAt` and `proofOfDeliveryUrl` are part of the persisted order driver assignment schema. |
| Driver route ownership | Done | Driver users can complete delivery only for their own `driverId`; admin route behavior remains allowed. |
| COD settlement workflow | Ready for verification | Covered by critical smoke, but still needs release-owner operational verification and reconciliation ownership. |

### Marketplace/Public Catalog

| Control | Status | Notes |
| --- | --- | --- |
| Public storefront product filtering | Done | Public storefront returns only `Live` products from approved/public shops. |
| Public shop filtering | Done | Public storefront returns only approved/public shops. |
| Public response sanitization | Done | Product/shop internal workflow, seller, admin, and finance fields are removed from public responses. |
| Search filtering | Done | Search excludes live products from non-approved shops. |
| Public merchandising references | Done | Reviews, promotions, collections, and rankings do not leak hidden product IDs. |

### Auth/Session

| Control | Status | Notes |
| --- | --- | --- |
| Refresh token rotation client fix | Done | Client stores rotated access and refresh tokens together and clears auth on malformed/failed refresh. |
| Cookie-session migration | Deferred | LocalStorage token risk remains a known future architecture item. |
| Logout token revocation proof | Open risk | Permission matrix still tracks logout/refresh revocation verification as a follow-up. |

### Reviews/Access Control

| Control | Status | Notes |
| --- | --- | --- |
| Verified-purchase reviews | Done | Client-supplied `verified` is ignored; backend verifies only matching delivered/customer-accepted orders owned by the authenticated customer. |
| Guest reviews | Done | Guest reviews remain allowed but are never verified. |
| Guest order access | Done | Guest order token access remains scoped to matching guest orders; tokens are hashed at rest and stripped from responses. |
| Guest token log redaction | Done | HTTP request logging redacts `token` query values. |
| SR targets | Done | Sales reps can read targets; `PUT /api/sr/targets` is fail-closed pending admin-owned target workflow. |
| Support audit permissions | Done | Support defaults no longer include `audit.read`; audit routes remain admin-only. |
| Admin/user mutation gates | Done | User reads remain `users.read`; user create/update/password reset routes are admin-role-only for MVP, so stale non-admin `users.manage` does not grant mutation. |

### Testing/Operations Docs

| Control | Status | Notes |
| --- | --- | --- |
| Critical smoke index | Done | `test/critical-launch-smoke.test.js` groups launch-critical suites. |
| Critical smoke npm script | Done | `npm run test:critical-smoke` is available. |
| Opt-in Mongo smoke | Done | `test/mongo-critical-smoke.test.js` skips safely unless `MONGO_SMOKE_URI` is set. |
| API permission matrix | Done | `docs/bmad/05-api-permission-matrix.md` documents route groups and follow-ups. |
| Deployment runbook | Done | `docs/bmad/06-deployment-runbook-and-launch-checklist.md` documents deploy, smoke, rollback, and incident checks. |
| Release readiness status | Done | `docs/bmad/07-release-readiness-status.md` summarizes phase status, risks, blockers, and go/no-go checks. |
| Backup/restore runbook | Done | `docs/bmad/08-backup-and-restore-runbook.md` documents Mongo, object storage, restore safety, rollback, and incident communication. |
| COD/payment reconciliation SOP | Done | `docs/bmad/09-cod-payment-reconciliation-sop.md` documents daily/weekly/monthly COD, ledger, dispute, refund, and payout reconciliation. |
| Upload/media storage security policy | Done | `docs/bmad/10-upload-media-storage-security-policy.md` documents media classes, storage policy, public/private rules, proof-of-delivery sensitivity, and media incident handling. |

## Ready For Verification Checklist

- Confirm all Phase 1 through Phase 4 changes are included in the intended release branch or commit.
- Confirm no unrelated local files, generated artifacts, or tool-cache files are included in the release.
- Run `npm run test:critical-smoke` from the repository root.
- Run `node --test backend/src/modules/users/users.routes.test.js` from the repository root.
- Run optional Mongo smoke against a disposable Mongo database if available.
- Verify `NODE_ENV=production` hard stops in a staging-like environment.
- Verify production CORS accepts only real HTTPS portal origins.
- Verify COD checkout creates correctly priced orders and rejects card payment.
- Verify public storefront/search expose only live products from approved/public shops.
- Verify driver pickup/delivery and COD collection against an assigned order.
- Verify guest order confirmation works with a valid token and fails without one.
- Verify support users cannot access admin audit routes.
- Verify sales reps cannot mutate targets through `/api/sr/targets`.
- Verify non-admin users cannot mutate users even if they carry stale `users.manage`.
- Verify release-owner access to logs, monitoring, rollback artifact, and database backup/restore procedure.
- Verify backup/restore owner, COD reconciliation owner, and media incident owner have reviewed the Phase 4 runbooks/policies.

## Open Risks

| Risk | Status | Recommended handling |
| --- | --- | --- |
| Mongo-backed coverage is opt-in | Open risk | Run `MONGO_SMOKE_URI` smoke in CI/staging or record a launch waiver. |
| Existing persisted support users may still carry stale `audit.read` | Open risk | Harmless for audit access because audit routes are admin-role-gated; optionally clean persisted permission arrays during user maintenance. |
| Existing persisted non-admin users may still carry stale `users.manage` | Open risk | Harmless for user mutation because mutation routes are admin-role-gated; optionally clean persisted permission arrays during user maintenance. |
| Guest order links use URL query tokens | Open risk | Token values are redacted from app request logs, but URL sharing/browser history/proxy logs remain an inherent risk until a different confirmation-link design exists. |
| LocalStorage token storage | Open risk | Accept for MVP with XSS controls, or prioritize httpOnly refresh-cookie migration. |
| Full logout/refresh-token revocation proof | Open risk | Add focused tests or implementation story before broader launch. |
| Email/SMS provider readiness | Open risk | Configure providers or accept communication waiver before launch. |
| Backup/restore drill and targets | Open risk | Run at least one restore drill, confirm RPO/RTO, and get owner signoff. The backup/restore runbook exists, but targets and rehearsal remain open. |
| COD reconciliation operations | Open risk | SOP exists, but daily practice, evidence storage, cutoff time, and finance/operations owner signoff must be verified before release. |
| Media storage/privacy hardening | Open risk | Policy exists, but private proof-of-delivery media, driver upload route mismatch, malware scanning, EXIF stripping, image processing, and object-storage hard-stop decisions remain open. |

## Deferred Items

| Item | Reason |
| --- | --- |
| Card payment gateway | MVP is COD-first until authorization/capture/refund lifecycle is integrated. |
| Automated bank payouts | MVP uses admin-controlled payout and settlement operations. |
| Token storage migration to httpOnly cookies | Requires CSRF/session architecture work across apps. |
| Guest order token expiry/revocation | Requires data model and customer communication design. |
| Admin-owned SR target workflow | Current MVP disables sales rep mutation; future admin/manager route should include audit history. |
| Private proof-of-delivery media workflow | Current proof-of-delivery URL storage needs a private upload/access design and driver-authorized upload route. |
| Support attachment upload workflow | Support attachments are currently free-form references; a dedicated private upload workflow is deferred unless required for launch. |
| Full media scanning and processing | Malware scanning, magic-byte validation, EXIF stripping, resizing, quarantine, and moderation need implementation beyond the current policy. |
| Full production object-storage hardening | Launch should use production object storage; local disk remains non-production only unless waived. Object-storage hard-stop and public/private ACL model need owner signoff. |
| Backup RPO/RTO finalization | Runbook exists, but exact RPO/RTO targets and restore drill cadence need business/operations approval. |
| Full infrastructure/CI quality gates | Current smoke suites exist, but final CI deployment gates remain a follow-up. |

## Blockers

| Blocker | Status |
| --- | --- |
| Uncommitted BMAD changes | Blocked until all accepted BMAD Phase 1 through Phase 4 changes are reviewed and committed. Do not deploy from an unreviewed dirty worktree. |
| Production hard-stop verification | Blocked until staging or production-like environment proves Mongo, JWT, CORS, and seed/demo hard stops. |
| Critical smoke result on release candidate | Blocked until `npm run test:critical-smoke` passes on the exact release candidate. |
| User mutation gate verification | Blocked until `node --test backend/src/modules/users/users.routes.test.js` passes on the exact release candidate. |
| COD/payment launch decision | Blocked if any release messaging or UI claims card payment support. MVP must remain COD-only. |

## Required Pre-Release Commands

Run the launch-critical smoke suite:

```bash
npm run test:critical-smoke
```

Run the admin/user mutation gate suite:

```bash
node --test backend/src/modules/users/users.routes.test.js
```

Run optional Mongo-backed smoke coverage against a disposable Mongo database:

```bash
MONGO_SMOKE_URI="mongodb://127.0.0.1:27017/tuti-mongo-smoke" node --test test/mongo-critical-smoke.test.js
```

Do not point `MONGO_SMOKE_URI` at production.

## Final Release Verification Before Deploy

Complete these checks before deploying any release candidate:

- Confirm `git status --short` contains only intended BMAD/release files, then commit them in reviewed commits.
- Confirm the release candidate is built from the reviewed commit, not from uncommitted local changes.
- Run:

```bash
npm run test:critical-smoke
node --test backend/src/modules/users/users.routes.test.js
MONGO_SMOKE_URI="mongodb://127.0.0.1:27017/tuti-mongo-smoke" node --test test/mongo-critical-smoke.test.js
```

- If optional Mongo smoke is not run, record the waiver and reason.
- Verify staging production hard stops: Mongo required, real JWT secrets required, real CORS origins required, localhost CORS rejected, seed/demo mode blocked.
- Verify COD-only checkout behavior and release messaging.
- Verify public storefront/search filtering.
- Verify delivery/COD settlement safety and proof-of-delivery persistence.
- Verify admin/user mutation gates: only admin role can create/update/reset users.
- Verify backup/restore runbook owner, COD reconciliation owner, media incident owner, and rollback owner.
- Verify object storage configuration or signed local-storage waiver.
- Verify email/SMS provider configuration or communication waiver.

## Current Commit/Worktree Note

As of 2026-06-18, BMAD Phase 3 and Phase 4 changes are pending commit in the current worktree. Before release, review all accepted BMAD files, commit them in reviewed commits, and verify the release candidate from a clean worktree.

Observed pending areas include:

- Guest order access and request log redaction.
- SR target mutation fail-closed.
- Support/audit permission cleanup.
- Admin/user mutation gate hardening.
- Related route and role tests.
- Updated API permission matrix.
- Release readiness, backup/restore, COD reconciliation, and upload/media security documentation.

Do not deploy until all uncommitted BMAD changes are reviewed, intentionally staged, committed, and verified.

## Final Go/No-Go Checklist

| Check | Status before launch |
| --- | --- |
| Release commit is clean and reviewed | Blocked until all BMAD Phase 1 through Phase 4 changes are committed. |
| `npm run test:critical-smoke` passes | Required Go condition. |
| `node --test backend/src/modules/users/users.routes.test.js` passes | Required Go condition. |
| Optional Mongo smoke passes or waiver accepted | Required Go condition or signed waiver. |
| Production hard stops verified | Required Go condition. |
| COD-only behavior verified | Required Go condition. |
| Card checkout disabled | Required Go condition. |
| Public catalog filtering verified | Required Go condition. |
| Delivery/COD settlement smoke verified | Required Go condition. |
| Access-control follow-ups verified | Required Go condition. |
| Admin/user mutation gates verified | Required Go condition. |
| Backup/restore owner and drill status confirmed | Required Go condition or signed waiver. |
| COD reconciliation SOP owner and daily practice confirmed | Required Go condition or signed waiver. |
| Upload/media storage policy owner and object-storage stance confirmed | Required Go condition or signed waiver. |
| Rollback owner and artifact confirmed | Required Go condition. |
| Monitoring/log access confirmed | Required Go condition. |
| Email/SMS/storage waivers or configs confirmed | Required Go condition. |

Final recommendation: No-Go until blockers are cleared; then proceed to staging verification. Move to Go only after the exact release candidate passes smoke tests, production hard stops, and operational launch checks.
