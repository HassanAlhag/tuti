# Backup And Restore Runbook

Date: 2026-06-18  
Scope: Tuti / Perfume Marketplace production backup and restore operations.

## Purpose And Scope

This runbook defines the minimum production backup and restore procedure for the Tuti marketplace. It covers MongoDB operational data, object storage/media assumptions, secrets/config boundaries, logs/audit export assumptions, restore approvals, restore verification, rollback after failed restore, and incident communication.

This document is an operations template. Exact infrastructure provider commands, backup retention, RPO, and RTO targets must be confirmed before broad customer launch.

## Current Assumptions

- MongoDB is the production system of record.
- Seed-memory mode must never be used in production.
- Production media should use S3/R2-compatible object storage, not local disk.
- COD orders, driver delivery state, support/disputes, seller balances, payouts, and audit events are business-critical records.
- Card payment is not live for MVP; do not claim payment gateway recovery requirements until gateway integration exists.
- Restores must preserve or reconcile orders created after the restore point.
- Restore activity should happen in a staging/restore environment first unless a production emergency is explicitly approved.

## RPO/RTO Placeholders

Exact business targets are not confirmed.

| Target | Placeholder | Owner to confirm |
| --- | --- | --- |
| MongoDB RPO | TBD, suggested starting target: 15 minutes or better for production. | Product owner + operations owner. |
| MongoDB RTO | TBD, suggested starting target: 2 hours or better for MVP launch. | Operations owner. |
| Object storage RPO | TBD, suggested starting target: 24 hours or provider versioning. | Operations owner. |
| Object storage RTO | TBD, suggested starting target: 4 hours for critical media. | Operations owner. |
| Audit/log retention | TBD, suggested minimum: 30-90 days for MVP operations. | Operations + compliance owner. |

Do not launch broadly until RPO/RTO owners have accepted the targets or recorded a waiver.

## Roles And Approvals

| Role | Responsibility |
| --- | --- |
| Incident commander | Owns go/no-go during restore event and coordinates communication. |
| Database operator | Executes MongoDB backup/restore commands or provider restore workflow. |
| Application owner | Validates app behavior after restore and decides whether traffic can resume. |
| Finance/COD owner | Validates orders, COD collections, seller balances, payouts, and settlement records. |
| Support owner | Validates support/dispute state and customer communication needs. |
| Media/storage owner | Validates object storage, uploaded media, and public URLs. |

Required approvals before production restore:

- Incident commander approval.
- Application owner approval.
- Database operator readiness confirmation.
- Finance/COD owner approval if order, payout, COD, or settlement data may be affected.
- Support owner approval if support/dispute data may be affected.

## Production Data Surfaces

### MongoDB

MongoDB contains core operational data, including:

- Users, roles, permissions, auth/session-related fields.
- Shops, products, public catalog, seller/admin workflow state.
- Orders, order items, status history, guest token hashes, customer responses.
- Driver assignments, proof-of-delivery references, COD collection and settlement fields.
- Seller transactions, payouts, commissions, sales rep records, referrals, targets.
- Support tickets, dispute/resolution data, notifications, audit events, reports data.

### Object Storage And Media

Production uploads should live in S3/R2-compatible object storage. Media can include:

- Product images.
- Seller/admin uploaded assets.
- Proof-of-delivery media if enabled by workflow.
- Public uploads under the configured prefix.

Local disk upload storage is not considered production-durable unless explicitly waived.

### Secrets And Config

Secrets and production environment variables are not application data backups. They should be managed by the hosting platform or secret manager.

Backup boundaries:

- Do not store secrets in Mongo dumps, repo docs, screenshots, or incident notes.
- Record which secret manager or deployment platform owns each secret.
- Rotate JWT, storage, email, and SMS credentials through the secret manager, not through database restore.

### Logs And Audit Exports

Logs and audit records support investigation but are not a substitute for data backup.

Assumptions:

- Application logs should be retained by the hosting/logging provider.
- Audit events in Mongo are part of Mongo backup.
- CSV audit exports are point-in-time operational artifacts and should be stored securely if used during incidents.
- Guest order token query values should be redacted from app request logs.

## Backup Policy Template

### MongoDB Backups

Minimum expectations:

- Automated scheduled backups are enabled for the production MongoDB cluster.
- Point-in-time restore is enabled if supported by the provider.
- Backup retention is documented and approved.
- Backup health is monitored.
- Restore permissions are limited to the database operator group.
- Restore drills are performed before broad launch and after major schema/data changes.

Provider-managed backup is preferred. If using `mongodump`, store encrypted dumps in a restricted backup bucket and test `mongorestore` into an isolated environment.

### Object Storage Backups

Minimum expectations:

- Production bucket versioning is enabled if supported.
- Object lifecycle/retention rules are documented.
- Critical prefixes, such as `uploads/`, are included in backup or versioning policy.
- Cross-region replication is considered for broader launch.
- Public/private ACL expectations are documented.
- Restore permissions are limited to the media/storage owner group.

### Secrets/Config Backups

Minimum expectations:

- Production env vars are documented by name, not value.
- Secret values live only in the deployment platform or secret manager.
- Access to secret history/versioning is restricted.
- Secret restore means re-applying known-good secret versions, not copying values from docs.

### Logs/Audit Retention

Minimum expectations:

- Log retention target is documented.
- Audit route access remains admin-only.
- Incident exports are stored in a restricted incident folder/bucket.
- PII and tokens are handled according to incident policy.

## Restore Scenarios

| Scenario | Preferred action |
| --- | --- |
| Bad deploy, no data corruption | Roll back code only. Do not restore database. |
| Bad deploy with limited corrupt orders | Freeze checkout, export affected records, reconcile manually if possible. |
| Large Mongo corruption | Restore to isolated environment first, compare, then decide production restore path. |
| Accidental deletion | Restore affected collection/data into isolated environment and surgically reinsert if safe. |
| Object/media deletion | Restore affected object versions or copy from backup bucket. |
| Secret compromise | Rotate secrets; database restore is usually not the fix. |
| Audit/log investigation | Export logs/audit records; do not mutate production data for investigation. |

## Pre-Restore Safety Checks

Before any production restore:

- Confirm incident commander and approvers.
- Freeze affected write paths if corruption is active, for example checkout, payout release, COD settlement, or uploads.
- Capture current production state before restore:
  - Current deployment version/commit.
  - Current Mongo backup/export if possible.
  - Affected order IDs, user IDs, shop IDs, payout IDs, driver IDs, support ticket IDs.
  - Current object storage affected prefixes/keys.
  - Relevant logs and audit exports.
- Confirm restore point timestamp and backup integrity.
- Confirm expected data loss window from RPO.
- Confirm whether new orders or COD settlements occurred after the restore point.
- Confirm rollback path if restore fails.
- Notify internal stakeholders that restore work is starting.

## MongoDB Restore Procedure Template

Use provider-managed point-in-time restore when available. Exact commands depend on provider.

1. Identify the target restore point:
   - Timestamp:
   - Backup ID/snapshot ID:
   - Reason:
   - Expected data loss window:

2. Restore to an isolated database or cluster first:
   - Do not overwrite production directly.
   - Use a restore database name such as `tuti-restore-YYYYMMDD-HHMM`.
   - Restrict network access.

3. Verify restored data before promotion:
   - Count core collections.
   - Spot-check affected orders, shops, products, users, support tickets, payouts, seller transactions, driver records, and audit events.
   - Confirm indexes exist.
   - Confirm no seed/demo data was accidentally restored into production target.

4. Decide restore mode:
   - Surgical restore of specific records.
   - Full production cluster restore.
   - Code rollback plus manual reconciliation.

5. If full restore is approved:
   - Take production out of rotation or enable maintenance mode.
   - Take a final pre-restore production snapshot/export.
   - Execute provider restore or controlled `mongorestore`.
   - Restart backend if connection strings or cluster targets changed.
   - Keep checkout/payout/settlement disabled until verification completes.

6. Record restore details:
   - Who approved:
   - Who executed:
   - Start/end time:
   - Source backup:
   - Target database:
   - Data loss/reconciliation notes:

Example local-style commands for non-production drills only:

```bash
mongodump --uri "$SOURCE_MONGO_URI" --archive="backup.archive" --gzip
mongorestore --uri "$RESTORE_MONGO_URI" --archive="backup.archive" --gzip --drop
```

Do not run these commands against production unless the database operator has explicit written approval and a final pre-restore snapshot exists.

## Object Storage/Media Restore Procedure Template

1. Identify affected bucket, prefix, and object keys:
   - Bucket:
   - Prefix:
   - Object keys:
   - Deleted/corrupted at:

2. Confirm backup/versioning source:
   - Object version ID:
   - Replication bucket/path:
   - Backup snapshot:

3. Restore in a safe order:
   - Restore to a temporary prefix first when possible.
   - Verify MIME/type, size, and expected image/media rendering.
   - Copy back to production prefix only after approval.
   - Invalidate CDN cache if needed.

4. Verify app references:
   - Product images render.
   - Seller/admin uploads render.
   - Proof-of-delivery URLs remain accessible to authorized users only if private media is introduced later.
   - Public URLs do not expose unintended private files.

5. Record restore details:
   - Who approved:
   - Who executed:
   - Bucket/prefix:
   - Object keys restored:
   - CDN/cache actions:

## Post-Restore Verification Checklist

- `GET /api/health` returns `ok: true`.
- Health reports Mongo connected, not seed-memory.
- Critical smoke passes against the release candidate.
- Production hard stops remain active.
- Public storefront and search return only live/public catalog data.
- COD checkout either remains frozen intentionally or creates correctly priced COD orders after unfreeze.
- Card checkout remains rejected.
- Guest order access works only with valid matching guest token.
- Seller can see correct shop orders.
- Driver delivery state is correct for affected orders.
- COD collected/settled fields reconcile with finance owner records.
- Seller balances, seller transactions, payouts, and commission entries reconcile.
- Support tickets and dispute state match expected restore point.
- Audit route remains admin-only.
- Notifications are present or accepted as lost/recreated according to RPO.
- Object storage media renders for affected products/uploads.
- Logs and monitoring show no new startup/runtime exceptions.

## Rollback After Failed Restore

If restore fails or verification does not pass:

- Keep checkout, payout release, COD settlement, and uploads frozen.
- Do not continue repeated destructive restore attempts without a new approval checkpoint.
- Revert to the final pre-restore production snapshot/export if available and approved.
- If code was also changed, redeploy the last known-good artifact.
- Preserve all restore logs, command output, backup IDs, and affected records.
- Convene incident commander, database operator, finance/COD owner, and application owner for next decision.
- Communicate internal status before reopening customer-facing flows.

## Incident Communication Notes

Internal incident updates should include:

- What happened.
- When it started.
- Affected systems/data.
- Current customer-facing impact.
- Whether checkout, delivery, payout, support, or media upload flows are frozen.
- Restore point and estimated data loss window.
- Next update time.
- Owner for customer/seller/driver communication.

Customer/seller/driver communication should be approved by the incident commander and support owner. Do not promise recovery times until RTO is confirmed for the incident.

## Test And Verification Checklist

Before launch:

- Perform at least one Mongo restore drill into an isolated environment.
- Verify restored app can start against restored Mongo.
- Run `npm run test:critical-smoke` after restore drill.
- Run optional Mongo smoke against a disposable restored/test database, not production:

```bash
MONGO_SMOKE_URI="mongodb://127.0.0.1:27017/tuti-mongo-smoke" node --test test/mongo-critical-smoke.test.js
```

- Restore at least one sample media object to a temporary prefix and verify URL/rendering.
- Confirm backup access permissions are limited.
- Confirm restore approval flow with named owners.
- Confirm backup retention policy is visible to launch owner.
- Confirm database snapshots are encrypted or provider-managed with equivalent controls.

## Do Not Do This

- Do not overwrite production without explicit incident commander, application owner, and database operator approval.
- Do not restore directly over live data without first taking a final production snapshot/export.
- Do not restore from unverified backups.
- Do not use production Mongo for smoke tests.
- Do not run seed/demo setup against production.
- Do not restore production data into a developer laptop or unrestricted local environment.
- Do not copy secrets into backup archives, tickets, docs, screenshots, or chat.
- Do not delete post-restore reconciliation evidence.
- Do not re-enable checkout, payout release, COD settlement, or uploads until verification is complete.

## Open Decisions And Placeholders

| Item | Status |
| --- | --- |
| Final MongoDB RPO | TBD. |
| Final MongoDB RTO | TBD. |
| Backup retention duration | TBD. |
| Point-in-time restore provider and process | TBD. |
| Backup encryption owner | TBD. |
| Object storage versioning/replication policy | TBD. |
| CDN/cache invalidation owner | TBD. |
| Incident communication owner | TBD. |
| Customer/seller data-loss notification threshold | TBD. |
| Restore drill schedule | TBD. |

This runbook should be reviewed after the first restore drill and before every major launch milestone.
