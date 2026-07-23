/**
 * S3-backed persistence for optimized media variants, with a local-disk
 * fallback for development/test only. Production always requires
 * AWS_REGION + AWS_S3_BUCKET -- see env.js's validateEnv() (startup
 * hard-stop) and assertProductionMediaStorageConfigured() (defense-in-depth
 * second gate, checked here directly).
 *
 * Credentials are resolved via the AWS SDK v3 default credential provider
 * chain whenever AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY aren't both set --
 * this is the preferred production model (an EC2/ECS/Elastic Beanstalk IAM
 * role, no static keys anywhere). Explicit static keys remain supported
 * for local/testing use and must be provided as a pair (see
 * env.js's isAwsCredentialPairValid).
 *
 * The bucket is expected to stay private: no ACL is ever set on PutObject.
 * Public access is via AWS_CLOUDFRONT_DOMAIN (production) or, when that's
 * not configured, a short-lived presigned GET URL (local/testing only --
 * see resolveVariantUrl).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { env, isAwsS3Configured, assertProductionMediaStorageConfigured } from "../config/env.js";
import { logger } from "./logger.js";

export function isS3Configured() {
  return isAwsS3Configured(env);
}

// Test-only seam: env.awsRegion/etc are resolved once into the frozen
// `env` singleton at module-import time, so tests can't flip
// isS3Configured()'s answer by mutating process.env mid-run. This lets a
// test force the "s3" (or "local") branch deterministically -- e.g. to
// exercise real S3 key namespacing/cleanup logic against a fake client
// without needing real AWS config in the environment.
let storageModeOverride = null;
export function __setStorageModeForTests(mode) {
  storageModeOverride = mode;
}
export function __resetStorageModeForTests() {
  storageModeOverride = null;
}

export function getStorageMode() {
  if (storageModeOverride) return storageModeOverride;
  if (isS3Configured()) return "s3";
  assertProductionMediaStorageConfigured(env);
  return "local";
}

export function buildVariantStorageKey({ ownerType, ownerId, assetId, variant }) {
  const base = ownerType === "shop" ? `shops/${ownerId}/media/${assetId}`
    : ownerType === "driver" ? `drivers/${ownerId}/media/${assetId}`
    : `admin/media/${assetId}`;
  return `${base}/${variant}.webp`;
}

let s3ClientPromise = null;

async function getClient() {
  if (!s3ClientPromise) {
    s3ClientPromise = import("@aws-sdk/client-s3").then(({ S3Client }) => {
      const config = { region: env.awsRegion };
      // Only pass explicit credentials when both are configured (local/
      // testing use case). Otherwise, leave `credentials` unset entirely
      // so the AWS SDK v3 default credential provider chain resolves them
      // -- environment variables it reads directly, a shared config/
      // credentials file, or (the preferred production model) an
      // EC2/ECS/Elastic Beanstalk IAM role. Never hardcode credentials.
      if (env.awsAccessKeyId && env.awsSecretAccessKey) {
        config.credentials = { accessKeyId: env.awsAccessKeyId, secretAccessKey: env.awsSecretAccessKey };
      }
      return new S3Client(config);
    });
  }
  return s3ClientPromise;
}

/** Test-only seam: swap the cached client for a fake/instrumented one. */
export function __setS3ClientForTests(client) {
  s3ClientPromise = Promise.resolve(client);
}
export function __resetS3ClientForTests() {
  s3ClientPromise = null;
}

export async function putVariant({ storageKey, buffer, metadata, uploadsDir }) {
  const mode = getStorageMode();

  if (mode === "s3") {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getClient();
    await client.send(new PutObjectCommand({
      Bucket: env.awsS3Bucket,
      Key: storageKey,
      Body: buffer,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: metadata,
      // No ACL set -- the bucket stays private (see module doc comment).
    }));
    return { storageProvider: "s3" };
  }

  const destPath = path.join(uploadsDir, storageKey);
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, buffer);
  return { storageProvider: "local" };
}

/**
 * Best-effort batch delete. Always returns { deleted, failed } instead of
 * throwing -- callers (cleanup-on-upload-failure, cleanup-on-DB-failure,
 * delete-unreferenced-asset) all need to proceed/log even on partial S3
 * failure rather than being blocked by it.
 */
export async function deleteVariants(storageKeys, { uploadsDir } = {}) {
  if (!storageKeys.length) return { deleted: [], failed: [] };
  const mode = getStorageMode();

  if (mode === "s3") {
    const { DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
    const client = await getClient();
    try {
      const result = await client.send(new DeleteObjectsCommand({
        Bucket: env.awsS3Bucket,
        Delete: { Objects: storageKeys.map((Key) => ({ Key })), Quiet: false },
      }));
      const deleted = (result.Deleted || []).map((d) => d.Key);
      const failed = (result.Errors || []).map((e) => ({ key: e.Key, message: e.Message }));
      if (failed.length) logger.error({ failed }, "[media] S3 partially failed to delete variants");
      return { deleted, failed };
    } catch (err) {
      logger.error({ err: err.message, storageKeys }, "[media] S3 batch delete request failed entirely");
      return { deleted: [], failed: storageKeys.map((key) => ({ key, message: err.message })) };
    }
  }

  const results = await Promise.allSettled(storageKeys.map((key) => fs.unlink(path.join(uploadsDir, key))));
  const deleted = [];
  const failed = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled" || result.reason?.code === "ENOENT") deleted.push(storageKeys[index]);
    else failed.push({ key: storageKeys[index], message: result.reason?.message });
  });
  if (failed.length) logger.error({ failed }, "[media] Local disk partially failed to delete variants");
  return { deleted, failed };
}

/**
 * Resolves a storage key to a URL usable by a browser. CloudFront is the
 * production path. Without it configured, falls back to a short-lived
 * presigned GET URL (the bucket is private, so a plain S3 URL would just
 * 403) -- explicitly a testing/local convenience, not a production
 * substitute for CloudFront.
 */
export async function resolveVariantUrl(storageKey) {
  if (!storageKey) return null;
  const mode = getStorageMode();
  if (mode === "local") return `/uploads/${storageKey}`;

  if (env.awsCloudFrontDomain) {
    return `https://${env.awsCloudFrontDomain.replace(/\/+$/, "")}/${storageKey}`;
  }

  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const client = await getClient();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: env.awsS3Bucket, Key: storageKey }), { expiresIn: 3600 });
}
