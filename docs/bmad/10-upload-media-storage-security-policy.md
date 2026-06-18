# Upload Media Storage Security Policy

Date: 2026-06-18  
Scope: Tuti / Perfume Marketplace production upload and media operations.

## Purpose And Scope

This policy defines production security expectations for uploaded and externally referenced media in the Tuti marketplace. It covers product images, brand/shop logos and banners, collection/merchandising images, proof-of-delivery images, and support attachments where applicable.

This is an operations and security policy. It documents the current implementation, required production expectations, and follow-up gaps. It does not change application source code, tests, package files, or deployment configuration.

Use this policy with:

- `docs/bmad/06-deployment-runbook-and-launch-checklist.md`
- `docs/bmad/08-backup-and-restore-runbook.md`
- `docs/bmad/09-cod-payment-reconciliation-sop.md`

## Current Implementation Snapshot

The current backend upload surface is narrow but not yet fully production-hardened.

| Area | Current behavior |
| --- | --- |
| Upload endpoint | `POST /api/upload` |
| Auth requirement | Requires authenticated user |
| Role requirement | `seller` or `admin` |
| Upload field | Single multipart field named `image` |
| Local static serving | `/uploads` is statically served from the backend upload directory |
| Storage provider | S3/R2-compatible storage is used when S3 env vars are present |
| Fallback storage | Local disk fallback is used when S3/R2 env vars are not present |
| Allowed MIME types | `image/jpeg`, `image/png`, `image/webp` |
| Size limit | 5 MB |
| S3/R2 ACL default | `public-read` |
| Filename strategy | Timestamp plus random suffix, preserving original extension |

Relevant current files:

- `backend/src/app.js`: mounts `/uploads` static serving and defines `POST /api/upload`.
- `backend/src/shared/storage.js`: configures local disk or S3/R2-compatible upload storage.
- `backend/src/config/env.js`: provides `UPLOAD_DIR` and production environment handling.

## Media Classes

| Media class | Current storage/reference | Public/private expectation | Notes |
| --- | --- | --- | --- |
| Product images | Product `imagePath` | Public after product is live/approved | Should not expose internal workflow state by URL naming or metadata. |
| Brand/shop logos | Seller brand `logoUrl`; shop avatar-style references | Public when brand/shop profile is public | Seller-entered URLs may point to external hosts. |
| Brand/shop banners | Seller brand `bannerUrl`; shop cover-style references | Public when brand/shop profile is public | Should be reviewed for brand safety and external tracking risk. |
| Collection/merchandising images | Collection `bannerUrl`, `mobileBannerUrl`, item image overrides | Public when collection/placement is published | Admin-owned content; should still meet upload and external URL rules. |
| Proof-of-delivery images | Order `driverAssignment.proofOfDeliveryUrl` | Sensitive/private by policy | Current implementation may use public URLs; this is a launch risk requiring follow-up. |
| Support attachments | Support ticket `attachments` free-form strings/objects | Private by policy unless explicitly public | No dedicated support attachment upload pipeline was confirmed. Treat as references until implemented. |

## Production Storage Policy

Production media should use S3/R2-compatible object storage or an equivalent durable object store.

Required production expectations:

- Do not rely on local disk upload storage for production.
- Configure a production bucket separate from staging, local, and smoke-test environments.
- Use an environment-specific key prefix such as `production/uploads/`.
- Restrict bucket write credentials to the backend upload service.
- Restrict delete permissions to approved operational workflows.
- Enable bucket versioning if supported.
- Configure lifecycle rules for temporary, quarantined, deleted, and orphaned objects.
- Include object storage in backup and restore planning.
- Do not store production media in the repository.

Local disk fallback:

- Acceptable for local development.
- Acceptable for explicit non-production demos.
- Not production-durable.
- Not a backup.
- Not safe for horizontally scaled production deployments.
- Can lose files on server restart, redeploy, container replacement, or disk cleanup.

Bucket access:

- Public product and brand images may be public if explicitly approved.
- Sensitive media should not use public-read ACLs.
- Proof-of-delivery and support attachments should use private objects plus signed access, proxy authorization, or another private delivery pattern.
- Bucket listing must be disabled.
- Storage credentials must live in the deployment secret manager, not in docs or repo files.

## Upload Authorization And Ownership

Current upload authorization allows only `seller` and `admin` users to call `POST /api/upload`.

Production expectations:

- Sellers may upload media only for their own shop/products/brand profile.
- Admins may upload media for admin-owned merchandising and approved operational tasks.
- Drivers should only upload proof-of-delivery media for deliveries assigned to their linked driver profile.
- Customers/support users should not upload arbitrary files unless a support attachment workflow is explicitly designed.
- Uploaded media should be associated with an owner context: role, user ID, shop ID, driver ID, order ID, or admin action.
- Upload actions should be auditable enough to answer who uploaded what, when, for which business object.

Current ownership gap:

- `POST /api/upload` returns a URL but does not itself bind the object to a product, shop, order, ticket, or driver assignment.
- Business-object ownership is enforced later by the route that stores the returned URL, not by the upload route.
- This is acceptable only as a short-term pattern for public seller/admin images. Sensitive media needs stronger binding.

## Proof-Of-Delivery Upload Follow-Up

Proof-of-delivery media is sensitive because it may show a person, home, workplace, package, phone number, receipt, building entrance, or delivery location context.

Current mismatch:

- Backend upload route is seller/admin-only.
- The driver app attempts proof-of-delivery upload through the shared upload client.
- Driver delivery completion accepts a `proofOfDeliveryUrl` value.
- This requires an implementation follow-up before relying on proof-of-delivery photo upload in production.

Required future behavior:

- Provide a driver-authorized upload path or signed upload flow for proof-of-delivery media.
- Bind the upload to the assigned `driverId` and `orderId`.
- Reject proof uploads for unassigned drivers.
- Store proof-of-delivery media as private by default.
- Return time-limited signed URLs or serve through an authenticated backend proxy.
- Preserve proof evidence long enough for disputes, refunds, COD reconciliation, and legal/operations review.

Do not treat public product-image upload rules as sufficient for proof-of-delivery media.

## File Type And Size Policy

Current accepted MIME types:

- JPEG: `image/jpeg`
- PNG: `image/png`
- WebP: `image/webp`

Current size limit:

- 5 MB per upload.

Production requirements:

- Keep the 5 MB limit unless a specific media class requires a different approved limit.
- Validate both MIME type and file magic bytes.
- Reject polyglot files and files whose extension does not match content.
- Reject SVG for user uploads unless a dedicated sanitizer is implemented.
- Reject executable, archive, document, video, audio, and script content.
- Normalize file extensions based on verified content type.
- Store content type explicitly with the object.
- Do not trust original filename, extension, client MIME type, or browser preview.

Follow-up not currently implemented:

- Magic-byte validation.
- Server-side image decoding validation.
- Malware scanning.
- Image moderation.
- EXIF stripping.
- Image resizing/normalization.
- Quarantine workflow.

## Malware And Content Safety Expectations

Production upload safety should include a layered workflow.

Minimum launch expectation:

- Uploads are restricted to authenticated seller/admin users.
- MIME and size checks remain active.
- Uploaded content is reviewed through product approval, brand profile review, or admin merchandising review before public exposure where practical.
- Operators can remove malicious or inappropriate media quickly.

Recommended next implementation:

1. Upload file into a private quarantine prefix.
2. Validate magic bytes and decode image server-side.
3. Strip EXIF and metadata.
4. Resize/compress to approved dimensions and formats.
5. Run malware scanning or provider-integrated object scanning.
6. Run content safety/moderation checks where brand safety matters.
7. Promote clean derivatives into the public or private serving prefix.
8. Store scan result, media owner, and linked business object.

Do not publish unscanned sensitive media.

## Image Processing Assumptions

Current implementation stores the uploaded file as received.

Production expectations:

- Strip EXIF metadata, especially GPS, device, and timestamp metadata.
- Generate safe derivatives for public display instead of serving the original upload when possible.
- Resize large images to product/brand/display-specific dimensions.
- Preserve aspect ratio and avoid client-side-only validation.
- Use deterministic derivative naming that does not expose private business metadata.
- Keep originals private if they must be retained for evidence.
- Avoid serving images with user-controlled response headers.

Suggested derivative classes:

| Media class | Suggested derivative behavior |
| --- | --- |
| Product image | Public optimized display image plus thumbnail. |
| Brand logo | Public square/circle-safe logo derivative. |
| Brand banner | Public desktop and mobile banner derivatives. |
| Collection image | Public responsive banner derivative. |
| Proof-of-delivery | Private evidence original; optional redacted/limited preview for authorized users. |
| Support attachment | Private original; preview only if type and permission allow. |

## Public And Private Media Rules

Public by default only when business-approved:

- Live product images.
- Published seller brand logos and banners.
- Published collection and merchandising images.
- Admin-approved public campaign imagery.

Private by default:

- Proof-of-delivery media.
- Support attachments.
- Dispute/refund evidence.
- Internal admin review media.
- Rejected, draft, pending, or unpublished seller media unless specifically exposed for review to authorized roles.

Access rules:

- Public media may be served by CDN/object storage when it does not contain sensitive personal, delivery, or dispute evidence.
- Private media must require authorization at access time.
- Private media URLs should expire.
- Private media should not be stored in public browser-accessible paths such as `/uploads`.
- Internal URLs should not be exposed through public marketplace APIs.

## URL Signing And Public URL Assumptions

Current behavior:

- Local uploads return `/uploads/<filename>`.
- S3/R2 uploads return the provider public location.
- S3/R2 default ACL is `public-read`.
- Product and brand pages may render stored URLs directly.

Production policy:

- Public catalog media may use stable public CDN URLs after approval.
- Sensitive media must use signed URLs, authenticated proxy routes, or another authorization-aware access model.
- Signed URLs should be short-lived and scoped to a specific object.
- Signed URLs should not be logged with secrets/tokens.
- Public URLs should not include PII, order IDs, phone numbers, customer names, addresses, or driver identifiers.
- CDN cache invalidation must be available for takedown incidents.

Open risk:

- Proof-of-delivery currently stores a URL string and may point to public media. Treat this as a follow-up before production proof-photo reliance.

## Manually Entered And External Media URLs

Several product, brand, collection, and merchandising fields can store URL-like strings. Some frontend code accepts `https://`, `/uploads/`, and `data:` style image references in specific display paths.

Risks:

- External URLs can track customer/admin IPs through third-party image hosts.
- External hosts can change image content after approval.
- External images can break without Tuti control.
- Data URLs can bloat payloads and may complicate content security policy.
- Manually entered URLs may bypass upload validation, scanning, resizing, and storage backup.

Policy:

- Prefer uploaded media stored in approved object storage over external URLs.
- Restrict externally hosted images to admin-approved merchandising or temporary migration use.
- Do not allow seller-entered external URLs to bypass product/brand approval.
- Do not use data URLs for production media.
- Record external media source and approval if used.
- Replace external URLs with stored copies when the media becomes part of launch-critical storefront content.

## Retention, Deletion, And Orphan Cleanup

Retention expectations:

- Public product/brand/collection media should be retained while the linked business object is active, plus an approved rollback window.
- Proof-of-delivery media should be retained through the dispute/refund/COD reconciliation window, then according to legal and operations retention policy.
- Support attachments should be retained according to support/legal retention policy.
- Rejected or draft media should be periodically reviewed and deleted if no longer needed.
- Quarantined or failed-scan media should be deleted after incident review unless required as evidence.

Deletion expectations:

- Delete or unpublish media when required by abuse, privacy, copyright, brand safety, or seller offboarding decisions.
- Do not delete media needed for active disputes, refunds, COD reconciliation, audit review, or legal hold.
- Deletion should be soft-deletable or reversible where provider versioning allows.
- Deletion actions should be auditable.

Orphan cleanup:

- Periodically identify objects not referenced by products, shops, collections, orders, support tickets, or audit records.
- Do not delete orphan candidates automatically in production until reviewed.
- Keep a quarantine/archive period before permanent deletion.
- Preserve evidence media even if it is not linked from a public page.

## Backup And Restore Relationship

The backup and restore runbook defines operational recovery expectations for MongoDB and object storage. This policy adds media-specific security constraints.

Required relationship:

- MongoDB backups preserve references such as `imagePath`, `logoUrl`, `bannerUrl`, `proofOfDeliveryUrl`, and support attachment references.
- Object storage backups/versioning preserve the actual media objects.
- A restored database without matching object storage can produce broken media links.
- Restored media without matching database references can create orphaned objects.
- Restore drills must verify both database references and media object availability.
- Sensitive media restored into non-production must remain access-controlled and should be anonymized or avoided unless necessary.

Do not restore production media into a broad-access development bucket.

## Monitoring And Logging

Monitor:

- Upload success/failure rate.
- Storage provider errors.
- File size limit rejections.
- MIME/type rejections.
- Unexpected upload role/user patterns.
- Sudden spikes in uploads by seller/admin account.
- Object storage permission or ACL drift.
- CDN/cache errors and high 404 rates for media.
- Public catalog pages rendering external or broken images.
- Proof-of-delivery URL missing or inaccessible for delivered orders where proof is required.

Log safely:

- Log uploader user ID, role, linked business context, object key, storage provider, size, and content type.
- Do not log signed URL secrets.
- Do not log raw image content.
- Do not log private proof/support media URLs in public logs.
- Redact credentials and query tokens.

## Media Incident Handling

Treat media incidents as production incidents when they involve malicious files, private evidence exposure, brand abuse, copyright violations, illegal content, or broken launch-critical storefront assets.

Immediate actions:

- Disable upload endpoint or revoke storage write credentials if active abuse is occurring.
- Remove or unpublish affected media from public pages.
- Revoke public ACL or signed URLs for sensitive exposure.
- Invalidate CDN cache if needed.
- Preserve evidence: uploader, object key, timestamps, linked business object, logs, audit events, and screenshots.
- Identify whether media was local disk, object storage, external URL, or data URL.
- Check whether affected objects were included in backup or replicated storage.

Follow-up actions:

- Notify support/business owner for customer or seller impact.
- Notify finance/COD owner if proof-of-delivery evidence is affected.
- Rotate storage credentials if compromise is suspected.
- Review adjacent uploads by the same user/account.
- Add affected object keys to blocklist or takedown list if needed.
- Document root cause and control gaps.

## Operational Verification Checklist

Pre-launch:

- [ ] Production object storage bucket configured.
- [ ] Local disk upload storage explicitly blocked or waived for production.
- [ ] Bucket is separate from staging/local/smoke environments.
- [ ] Bucket listing disabled.
- [ ] Write credentials restricted to backend upload service.
- [ ] Public-read usage reviewed and approved only for public media.
- [ ] Private media approach selected for proof-of-delivery and support attachments.
- [ ] Upload size and MIME limits verified.
- [ ] Product image upload works for seller/admin flow.
- [ ] Brand/shop media publication rules reviewed.
- [ ] Collection/merchandising media rules reviewed.
- [ ] Proof-of-delivery upload route mismatch has an implementation owner.
- [ ] External URL policy accepted or enforcement story created.
- [ ] Object storage backup/versioning verified.
- [ ] CDN/cache invalidation process known.
- [ ] Media incident owner assigned.

Post-deploy:

- [ ] Upload returns expected URL from production object storage.
- [ ] `/uploads` local serving is not relied on for production durability.
- [ ] Public product images render from approved storage.
- [ ] Public brand and collection media render from approved storage.
- [ ] Sensitive proof/support media is not exposed through public catalog APIs.
- [ ] Upload failures are visible in logs/monitoring.
- [ ] Storage provider errors alert the operations owner.
- [ ] Broken public media links can be identified and remediated.

## Open Decisions And Placeholders

| Decision | Placeholder |
| --- | --- |
| Is object storage mandatory hard stop for production launch? | TBD; recommended yes. |
| Public media CDN domain | TBD. |
| Private media delivery model | TBD: signed URLs, backend proxy, or private CDN. |
| Proof-of-delivery upload route design | TBD implementation story required. |
| Support attachment upload design | TBD implementation story if support file uploads are needed. |
| Malware scanning provider | TBD. |
| Image processing library/service | TBD. |
| EXIF stripping requirement and owner | TBD. |
| Magic-byte validation implementation owner | TBD. |
| Maximum dimensions per media class | TBD. |
| External URL allowance for seller media | TBD; recommended disallow for seller-submitted launch media. |
| Data URL allowance | TBD; recommended disallow in production media fields. |
| Sensitive media retention period | TBD with business/legal owner. |
| Public media orphan cleanup cadence | TBD. |
| Quarantine retention period | TBD. |
| CDN cache invalidation owner | TBD. |
| Media incident severity matrix | TBD. |

