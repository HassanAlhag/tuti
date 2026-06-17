# Deployment Runbook And Launch Checklist

Date: 2026-06-17  
Scope: Tuti / Perfume Marketplace MVP deployment readiness.

## Purpose And Scope

This runbook gives operators and developers a practical checklist for deploying the current Tuti marketplace safely. It focuses on the COD-first MVP, production environment safety, launch smoke tests, deployment validation, rollback, and incident response.

This document does not replace a full infrastructure design, PCI/payment integration plan, backup policy, or incident management program. It is the minimum operational checklist for the current backend and multi-app frontend.

## Launch Assumptions

- The MVP is COD-first. Card checkout and payment gateway flows are not ready.
- The API must reject card checkout until a real payment gateway authorization/capture/refund lifecycle is integrated.
- MongoDB is the required production datastore.
- Seed-memory and demo behavior are local/test/demo conveniences only and must not run in production.
- Public storefront data must be server-filtered to live products and public/approved shops.
- Seller settlement and payouts are admin-controlled operational workflows, not automated bank disbursements.
- Uploads should use production object storage for launch. Local disk upload storage is acceptable only for local development or explicit non-production demos.
- Email/SMS providers should be configured for launch, or a launch waiver must be signed off with customer communication risk accepted.
- Existing frontend apps are deployed as role-specific portals: customer web, seller, admin, driver, and sales rep.

## Required Production Environment Variables

### Core Runtime

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | Yes | Must be `production` in production. |
| `PORT` | Yes | Defaults to `5055` if omitted, but production should configure it explicitly. |
| `MONGO_URI` | Yes | Required hard stop in production. Must point to production MongoDB, not seed/demo. |
| `JWT_SECRET` | Yes | Must be real, non-placeholder, and at least 32 characters. |
| `JWT_REFRESH_SECRET` | Yes | Must be real, non-placeholder, and at least 32 characters. |
| `JWT_EXPIRES_IN` | Recommended | Defaults to `15m`. Keep short-lived for production. |
| `JWT_REFRESH_EXPIRES_IN` | Recommended | Defaults to `7d`. Match refresh-token risk policy. |
| `CORS_ORIGINS` or `CLIENT_ORIGINS` | Yes | Comma-separated real HTTPS origins for all production portals. |
| `CLIENT_ORIGIN` | Recommended | Primary customer origin used by email links and compatibility paths. |
| `LOG_LEVEL` | Recommended | Use `info` or stricter in production unless debugging an incident. |
| `SENTRY_DSN` | Recommended | Enables backend exception reporting. |

### Public Portal Origins

Configure all real production origins in `CORS_ORIGINS` or `CLIENT_ORIGINS`, for example:

```text
CORS_ORIGINS=https://tuti.example,https://seller.tuti.example,https://admin.tuti.example,https://driver.tuti.example,https://sr.tuti.example
CLIENT_ORIGIN=https://tuti.example
```

Do not include localhost, loopback, `0.0.0.0`, or default Vite development origins.

### Media Storage

| Variable | Required | Notes |
| --- | --- | --- |
| `AWS_S3_BUCKET` | Recommended for production | Enables S3/R2-compatible upload storage. |
| `AWS_REGION` | Required when S3/R2 is used | Use provider region or `auto` for compatible providers that require it. |
| `AWS_ACCESS_KEY_ID` | Required when S3/R2 is used | Storage credential. |
| `AWS_SECRET_ACCESS_KEY` | Required when S3/R2 is used | Storage credential. |
| `AWS_S3_ENDPOINT` | Optional | Required for R2/MinIO/custom S3-compatible endpoints. |
| `AWS_S3_ACL` | Optional | Defaults to `public-read`. Review before private proof-of-delivery media. |
| `AWS_S3_KEY_PREFIX` | Optional | Defaults to `uploads/`; production should use an environment-specific prefix. |
| `UPLOAD_DIR` | Non-production only | Local disk upload directory. Do not rely on local disk for production launch. |

### Email And SMS

| Variable | Required | Notes |
| --- | --- | --- |
| `EMAIL_HOST` | Recommended for launch | SMTP host. Without it, email is logged instead of sent. |
| `EMAIL_PORT` | Recommended for launch | Defaults to `587`. |
| `EMAIL_USER` | Recommended for launch | SMTP user. |
| `EMAIL_PASS` | Recommended for launch | SMTP password/secret. |
| `EMAIL_FROM` | Recommended for launch | Defaults to `Tuti <noreply@tuti.ae>`. |
| `TWILIO_ACCOUNT_SID` | Optional/Recommended | Required for SMS/WhatsApp provider use. |
| `TWILIO_AUTH_TOKEN` | Optional/Recommended | Required for SMS/WhatsApp provider use. |
| `TWILIO_FROM_NUMBER` | Optional/Recommended | Required for outbound SMS/WhatsApp. |

## Production Hard-Stop Expectations

The backend must fail closed in production:

- `MONGO_URI` is required.
- `JWT_SECRET` and `JWT_REFRESH_SECRET` are required, real, non-placeholder, and at least 32 characters.
- Explicit real CORS origins are required.
- Localhost, loopback, `0.0.0.0`, `.localhost`, and default Vite dev CORS origins are rejected.
- Seed-memory DB mode is blocked in production.
- Seed/demo auth and auto-created demo login behavior are blocked in production.

Expected failure mode: deployment should fail startup or health checks before accepting traffic if any production hard-stop requirement is missing.

## Pre-Deploy Checklist

- Confirm the target commit contains the accepted BMAD critical launch fixes.
- Confirm no unrelated local files or tool bundles are included in the release commit.
- Confirm `package-lock.json` matches approved dependency changes only.
- Confirm production env vars are set in the deployment platform, not only local `.env` files.
- Confirm `NODE_ENV=production`.
- Confirm `MONGO_URI` points to the intended production database.
- Confirm JWT secrets are rotated from development defaults and stored in secret management.
- Confirm `CORS_ORIGINS` lists only real HTTPS production portal origins.
- Confirm no localhost/loopback origins are present in production CORS.
- Confirm object storage credentials are configured or a local-upload waiver is approved.
- Confirm email/SMS providers are configured or a communications waiver is approved.
- Confirm database backup/restore access exists before launch.
- Confirm admin user provisioning plan is ready.
- Confirm COD-only payment messaging is reflected in customer/support/admin launch comms.
- Confirm support, disputes, COD settlement, and payout operating owners are assigned.
- Run local critical smoke tests before deploy.

## Smoke Test Commands

Run the launch-critical smoke suite:

```bash
npm run test:critical-smoke
```

Run optional Mongo-backed smoke coverage when a disposable Mongo database is available:

```bash
MONGO_SMOKE_URI="mongodb://127.0.0.1:27017/tuti-mongo-smoke" node --test test/mongo-critical-smoke.test.js
```

Notes:

- The Mongo smoke test is opt-in and skips safely when `MONGO_SMOKE_URI` is not set.
- Do not point `MONGO_SMOKE_URI` at production.
- Prefer a disposable database or isolated test database with clear cleanup permissions.

## Deployment Steps

1. Freeze the release branch or commit.
2. Verify the commit contains only intended application, test, and documentation changes.
3. Run:

```bash
npm run test:critical-smoke
```

4. If a test Mongo instance exists, run:

```bash
MONGO_SMOKE_URI="mongodb://127.0.0.1:27017/tuti-mongo-smoke" node --test test/mongo-critical-smoke.test.js
```

5. Build all frontend apps:

```bash
npm run build
```

6. Configure production environment variables in the hosting platform.
7. Deploy backend with `NODE_ENV=production`.
8. Deploy frontend apps with production API URLs/origins.
9. Run database migration/seed actions only if explicitly approved for this release. Do not run seed/demo setup against production.
10. Start the backend and confirm it connects to MongoDB.
11. Promote traffic gradually if the platform supports it.

## Post-Deploy Checks

- `GET /api/health` returns `ok: true`.
- Health reports database as connected, not seed-memory.
- Production logs do not show development JWT fallback warnings.
- CORS accepts only approved production portal origins.
- Public storefront loads and contains only live/public catalog data.
- Search returns public products only.
- COD checkout creates a COD order and rejects card checkout.
- Guest order confirmation works with its token flow.
- Seller can see the new order for the correct shop.
- Driver pickup and delivery completion work for an assigned order.
- COD delivery moves payment status to COD collected.
- Admin COD settlement candidates show eligible COD-collected orders.
- Admin/support can access support tickets and disputes.
- Seller finance views show expected balances/transactions.
- Notifications are created for key order/delivery events.
- Email/SMS provider behavior is confirmed if launch communication depends on it.
- Sentry or equivalent monitoring receives no new startup exceptions.

## Rollback Notes

Rollback should be rehearsed before launch.

- Keep the previous deploy artifact or image available.
- Know whether the deployment platform supports instant rollback or requires redeploy.
- Avoid destructive database changes in MVP deploys.
- If rollback is code-only and no schema/data migration ran, redeploy the previous backend and frontend artifacts.
- If new orders were created after deploy, do not restore the database blindly. Preserve order, COD, support, and ledger data.
- If order/finance data is corrupted, freeze checkout first, export affected records, and reconcile manually before restoring.
- If CORS/env config breaks portal access, prefer env correction and restart over code rollback.
- If production starts in an invalid mode, take the backend out of rotation immediately and verify hard-stop configuration.

## Incident Notes

### Checkout Incident

- Disable or block checkout at the edge/app if orders are priced incorrectly.
- Preserve request logs, order IDs, idempotency keys, and product snapshots.
- Check whether stock was deducted and whether duplicate orders were created.
- Reconcile affected orders before notifying customers or sellers.

### COD/Settlement Incident

- Pause admin COD settlements if collected cash, driver balances, or seller credits do not reconcile.
- Export affected orders, driver balances, and seller transactions.
- Confirm no duplicate delivery completion or duplicate settlement entries occurred.
- Resume settlement only after reconciliation.

### Public Catalog Exposure Incident

- Remove affected product/shop data from public view.
- Verify `/api/marketplace/storefront`, `/api/marketplace/search`, and public seller/product endpoints.
- Check whether non-live, pending, rejected, suspended, or internal fields were exposed.

### Auth/Session Incident

- Rotate JWT secrets only with a planned forced logout.
- Revoke or clear refresh tokens when token compromise is suspected.
- Review admin/support/seller/driver access logs.

### Upload/Media Incident

- Disable upload endpoint or storage write credentials if malicious media or private media exposure is suspected.
- Remove affected objects from storage/CDN.
- Review seller/admin upload audit trail if available.

## Go/No-Go Launch Checklist

| Check | Go condition |
| --- | --- |
| Production env | `NODE_ENV=production`, real Mongo, real JWT secrets, real CORS origins. |
| Hard stops | Missing Mongo/secrets/CORS fail before traffic. |
| Seed/demo | Seed-memory and demo auth impossible in production. |
| Payment | COD-only behavior confirmed; card checkout rejected. |
| Critical smoke | `npm run test:critical-smoke` passes. |
| Mongo smoke | Optional Mongo smoke passes against disposable Mongo, or waiver recorded. |
| Build | `npm run build` passes for all apps. |
| Public catalog | Public APIs return only live/public catalog data. |
| Checkout | Server-side pricing/stock/order authority confirmed. |
| Delivery | Pickup, proof-of-delivery, COD collection, and duplicate guards confirmed. |
| Finance | COD settlement and payout owners understand manual/admin workflow. |
| Support | Support/dispute workflow owner assigned and tested. |
| Monitoring | Logs and error monitoring are visible to launch owner. |
| Rollback | Rollback owner, artifact, and database preservation plan are known. |
| Communications | Email/SMS configured or waiver accepted. |

Launch should be `No-Go` if any production hard stop fails, card checkout can create authorization state, public APIs expose non-public catalog data, COD orders price incorrectly, or rollback ownership is unclear.

## Known Waivers And Follow-Ups

| Item | Status | Launch impact |
| --- | --- | --- |
| Card payment gateway | Not ready | Launch COD-only. Do not claim card payment support. |
| Mongo smoke in local environments | Opt-in | Requires `MONGO_SMOKE_URI`; skip is acceptable locally, but CI/staging should add a disposable Mongo service. |
| Production object storage | Recommended hardening | Local disk upload storage should not be used for production launch unless explicitly waived. |
| Email/SMS provider | Recommended for launch | Without providers, password reset/order comms may log instead of send. |
| Backup/restore runbook | Follow-up needed | Must be finalized before broader customer launch. |
| Payment/COD reconciliation SOP | Follow-up needed | COD launch needs manual reconciliation ownership and escalation path. |
| Permission matrix follow-ups | Open | See `docs/bmad/05-api-permission-matrix.md`. |
| Verified-purchase reviews | Open | Review route remains optional-auth; launch risk should be accepted or fixed. |
| Cookie-based refresh sessions | Future hardening | Current tokens remain client stored; XSS mitigation remains important. |
| Background job/outbox | Future hardening | Email/notification side effects are not fully retryable yet. |
