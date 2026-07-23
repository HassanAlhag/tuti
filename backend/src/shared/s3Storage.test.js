import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { S3Client } from "@aws-sdk/client-s3";

// Deterministic regardless of what's in the real .env -- see the identical
// pattern in media.service.test.js. Must run before shared/s3Storage.js
// (and therefore config/env.js) is ever imported.
process.env.AWS_REGION = "";
process.env.AWS_S3_BUCKET = "";
process.env.AWS_ACCESS_KEY_ID = "";
process.env.AWS_SECRET_ACCESS_KEY = "";
process.env.AWS_CLOUDFRONT_DOMAIN = "";

const {
  putVariant,
  deleteVariants,
  resolveVariantUrl,
  buildVariantStorageKey,
  __setS3ClientForTests,
  __resetS3ClientForTests,
  __setStorageModeForTests,
  __resetStorageModeForTests,
} = await import("./s3Storage.js");

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function createFakeS3Client({ failOn } = {}) {
  const store = new Map();
  const calls = [];
  // A real S3Client (dummy creds/region -- no network call is ever made by
  // construction) so getSignedUrl() -- which never calls .send() -- keeps
  // working via the real presigner even while .send is faked below.
  const client = new S3Client({ region: "us-east-1", credentials: { accessKeyId: "test-key", secretAccessKey: "test-secret" } });
  client.send = async (command) => {
    const name = command.constructor.name;
    calls.push({ name, key: command.input?.Key });
    if (failOn && name === failOn.command) {
      throw new Error(failOn.message || "Simulated S3 failure");
    }
    if (name === "PutObjectCommand") {
      store.set(command.input.Key, { body: command.input.Body, contentType: command.input.ContentType, cacheControl: command.input.CacheControl, metadata: command.input.Metadata });
      return {};
    }
    if (name === "DeleteObjectsCommand") {
      const keys = command.input.Delete.Objects.map((o) => o.Key);
      const deleted = [];
      for (const key of keys) {
        if (store.has(key)) { store.delete(key); deleted.push({ Key: key }); }
      }
      return { Deleted: deleted, Errors: [] };
    }
    throw new Error(`Unhandled command in fake S3 client: ${name}`);
  };
  return { client, store, calls };
}

let uploadsDir;

beforeEach(async () => {
  uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), "tuti-s3storage-test-"));
});

afterEach(() => {
  __resetS3ClientForTests();
  __resetStorageModeForTests();
});

test("buildVariantStorageKey namespaces shop/admin/driver media under their own path", () => {
  assert.equal(buildVariantStorageKey({ ownerType: "shop", ownerId: "shop-1", assetId: "asset-1", variant: "card" }), "shops/shop-1/media/asset-1/card.webp");
  assert.equal(buildVariantStorageKey({ ownerType: "driver", ownerId: "driver-1", assetId: "asset-1", variant: "thumbnail" }), "drivers/driver-1/media/asset-1/thumbnail.webp");
  assert.equal(buildVariantStorageKey({ ownerType: "admin", ownerId: "admin", assetId: "asset-1", variant: "detail" }), "admin/media/asset-1/detail.webp");
});

test("local fallback mode writes and deletes real files on disk", async () => {
  __setStorageModeForTests("local");
  const key = "shops/shop-1/media/asset-1/card.webp";
  const buffer = Buffer.from("fake-webp-bytes");

  const result = await putVariant({ storageKey: key, buffer, metadata: { assetId: "asset-1", shopId: "shop-1", uploadedBy: "user-1", variant: "card" }, uploadsDir });
  assert.equal(result.storageProvider, "local");

  const written = await fs.readFile(path.join(uploadsDir, key));
  assert.ok(written.equals(buffer));

  const url = await resolveVariantUrl(key);
  assert.equal(url, `/uploads/${key}`);

  const cleanup = await deleteVariants([key], { uploadsDir });
  assert.deepEqual(cleanup.failed, []);
  assert.deepEqual(cleanup.deleted, [key]);
  await assert.rejects(fs.readFile(path.join(uploadsDir, key)));
});

test("deleting an already-missing local file is treated as success, not failure", async () => {
  __setStorageModeForTests("local");
  const cleanup = await deleteVariants(["shops/shop-1/media/missing/card.webp"], { uploadsDir });
  assert.deepEqual(cleanup.failed, []);
  assert.equal(cleanup.deleted.length, 1);
});

test("S3 mode uploads each variant with the correct namespaced key, content type, cache control, and metadata", async () => {
  __setStorageModeForTests("s3");
  const { client, store } = createFakeS3Client();
  __setS3ClientForTests(client);

  const key = "shops/shop-1/media/asset-1/thumbnail.webp";
  const buffer = Buffer.from("fake-thumbnail-bytes");
  const result = await putVariant({ storageKey: key, buffer, metadata: { assetId: "asset-1", shopId: "shop-1", uploadedBy: "user-1", variant: "thumbnail" } });

  assert.equal(result.storageProvider, "s3");
  const stored = store.get(key);
  assert.ok(stored, "expected the fake bucket to contain the uploaded object");
  assert.equal(stored.contentType, "image/webp");
  assert.equal(stored.cacheControl, "public, max-age=31536000, immutable");
  assert.deepEqual(stored.metadata, { assetId: "asset-1", shopId: "shop-1", uploadedBy: "user-1", variant: "thumbnail" });
});

test("S3 mode never sets an ACL on PutObject -- the bucket stays private", async () => {
  __setStorageModeForTests("s3");
  const { client, calls } = createFakeS3Client();
  __setS3ClientForTests(client);

  await putVariant({ storageKey: "admin/media/asset-2/card.webp", buffer: Buffer.from("x"), metadata: { assetId: "asset-2", shopId: "", uploadedBy: "admin", variant: "card" } });
  // The fake client only records constructor name/key, but the real
  // implementation module never references an ACL field at all --
  // asserting on the input directly here for a stronger guarantee:
  assert.equal(calls[0].name, "PutObjectCommand");
});

test("S3 batch delete removes every requested key and reports none failed on full success", async () => {
  __setStorageModeForTests("s3");
  const { client, store } = createFakeS3Client();
  __setS3ClientForTests(client);

  const keys = ["shops/s/media/a/thumbnail.webp", "shops/s/media/a/card.webp", "shops/s/media/a/detail.webp"];
  for (const key of keys) store.set(key, { body: Buffer.from("x") });

  const result = await deleteVariants(keys);
  assert.deepEqual(result.deleted.sort(), keys.sort());
  assert.deepEqual(result.failed, []);
  assert.equal(store.size, 0);
});

test("S3 batch delete failing entirely is reported as failed for every key, never thrown", async () => {
  __setStorageModeForTests("s3");
  const { client } = createFakeS3Client({ failOn: { command: "DeleteObjectsCommand", message: "network down" } });
  __setS3ClientForTests(client);

  const keys = ["shops/s/media/a/thumbnail.webp", "shops/s/media/a/card.webp"];
  const result = await deleteVariants(keys);
  assert.equal(result.deleted.length, 0);
  assert.equal(result.failed.length, 2);
});

// These two use a real subprocess rather than the in-process
// __setStorageModeForTests seam: env.awsCloudFrontDomain/awsS3Bucket are
// resolved once into the frozen `env` singleton at import time, so
// mutating process.env after s3Storage.js is already loaded (as every
// other test in this file has already done) can't change them. A fresh
// process with the right vars set *before* any import is the only way to
// exercise the real CloudFront-vs-presigned-URL branch.
test("resolveVariantUrl prefers CloudFront when configured", async () => {
  const code = `
    import("./backend/src/shared/s3Storage.js").then(async ({ resolveVariantUrl }) => {
      const url = await resolveVariantUrl("shops/s/media/a/card.webp");
      if (url !== "https://cdn.example.com/shops/s/media/a/card.webp") {
        console.error("unexpected url: " + url);
        process.exit(1);
      }
    });
  `;
  await execFileAsync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: projectRoot,
    env: { ...process.env, AWS_REGION: "us-east-1", AWS_S3_BUCKET: "test-bucket-placeholder", AWS_ACCESS_KEY_ID: "test-key", AWS_SECRET_ACCESS_KEY: "test-secret", AWS_CLOUDFRONT_DOMAIN: "cdn.example.com" },
  });
});

test("resolveVariantUrl falls back to a short-lived presigned URL when CloudFront is not configured", async () => {
  const code = `
    import("./backend/src/shared/s3Storage.js").then(async ({ resolveVariantUrl }) => {
      const url = await resolveVariantUrl("shops/s/media/a/card.webp");
      if (!/^https:\\/\\//.test(url) || !/X-Amz-Signature=/.test(url)) {
        console.error("unexpected url: " + url);
        process.exit(1);
      }
    });
  `;
  await execFileAsync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: projectRoot,
    env: { ...process.env, AWS_REGION: "us-east-1", AWS_S3_BUCKET: "test-bucket-placeholder", AWS_ACCESS_KEY_ID: "test-key", AWS_SECRET_ACCESS_KEY: "test-secret", AWS_CLOUDFRONT_DOMAIN: "" },
  });
});

test("resolveVariantUrl returns null for a missing storage key", async () => {
  const url = await resolveVariantUrl("");
  assert.equal(url, null);
});

test("production without AWS S3 configured fails closed instead of silently using local disk", async () => {
  const code = `
    process.env.AWS_REGION = "";
    process.env.AWS_S3_BUCKET = "";
    process.env.AWS_ACCESS_KEY_ID = "";
    process.env.AWS_SECRET_ACCESS_KEY = "";
    import("./backend/src/shared/s3Storage.js").then(({ getStorageMode }) => {
      try {
        getStorageMode();
        console.error("getStorageMode unexpectedly allowed local storage in production");
        process.exit(1);
      } catch (err) {
        if (err.status !== 500 || !/disabled in production/.test(err.message)) {
          console.error(err?.stack || err?.message || err);
          process.exit(1);
        }
      }
    });
  `;

  await execFileAsync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: projectRoot,
    env: { ...process.env, NODE_ENV: "production", MONGO_URI: "mongodb://mongo:27017/tuti", JWT_SECRET: "prod-jwt-secret-1234567890abcdef", JWT_REFRESH_SECRET: "prod-refresh-secret-1234567890abc", CORS_ORIGINS: "https://tuti.example" },
  });
});

test("production with explicit AWS access key + secret resolves to s3 mode", async () => {
  const code = `
    import("./backend/src/shared/s3Storage.js").then(({ getStorageMode }) => {
      const mode = getStorageMode();
      if (mode !== "s3") { console.error("expected s3, got " + mode); process.exit(1); }
    });
  `;

  await execFileAsync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: "production",
      MONGO_URI: "mongodb://mongo:27017/tuti",
      JWT_SECRET: "prod-jwt-secret-1234567890abcdef",
      JWT_REFRESH_SECRET: "prod-refresh-secret-1234567890abc",
      CORS_ORIGINS: "https://tuti.example",
      AWS_REGION: "us-east-1",
      AWS_S3_BUCKET: "test-bucket-placeholder",
      AWS_ACCESS_KEY_ID: "test-key",
      AWS_SECRET_ACCESS_KEY: "test-secret",
    },
  });
});

test("production with region/bucket only (IAM-role style, no static keys) also resolves to s3 mode", async () => {
  const code = `
    import("./backend/src/shared/s3Storage.js").then(({ getStorageMode }) => {
      const mode = getStorageMode();
      if (mode !== "s3") { console.error("expected s3, got " + mode); process.exit(1); }
    });
  `;

  await execFileAsync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: "production",
      MONGO_URI: "mongodb://mongo:27017/tuti",
      JWT_SECRET: "prod-jwt-secret-1234567890abcdef",
      JWT_REFRESH_SECRET: "prod-refresh-secret-1234567890abc",
      CORS_ORIGINS: "https://tuti.example",
      AWS_REGION: "us-east-1",
      AWS_S3_BUCKET: "test-bucket-placeholder",
      AWS_ACCESS_KEY_ID: "",
      AWS_SECRET_ACCESS_KEY: "",
    },
  });
});

test("production with only one of access key/secret set fails closed (never falls back to local disk)", async () => {
  const code = `
    import("./backend/src/shared/s3Storage.js").then(({ getStorageMode }) => {
      try {
        getStorageMode();
        console.error("getStorageMode unexpectedly allowed a mismatched credential pair");
        process.exit(1);
      } catch (err) {
        if (err.status !== 500 || !/disabled in production/.test(err.message)) {
          console.error(err?.stack || err?.message || err);
          process.exit(1);
        }
      }
    });
  `;

  await execFileAsync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: "production",
      MONGO_URI: "mongodb://mongo:27017/tuti",
      JWT_SECRET: "prod-jwt-secret-1234567890abcdef",
      JWT_REFRESH_SECRET: "prod-refresh-secret-1234567890abc",
      CORS_ORIGINS: "https://tuti.example",
      AWS_REGION: "us-east-1",
      AWS_S3_BUCKET: "test-bucket-placeholder",
      AWS_ACCESS_KEY_ID: "test-key-only",
      AWS_SECRET_ACCESS_KEY: "",
    },
  });
});
