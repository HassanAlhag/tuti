/**
 * Storage provider for image uploads.
 *
 * When AWS_S3_BUCKET is set the upload goes directly to S3 (or any
 * S3-compatible service such as Cloudflare R2 — set AWS_S3_ENDPOINT for R2).
 * Without it the file lands on the local filesystem; the server serves it
 * from /uploads just as before.
 *
 * Required env vars for S3 mode:
 *   AWS_S3_BUCKET       — bucket name
 *   AWS_REGION          — e.g. "us-east-1" (or "auto" for R2)
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_S3_ENDPOINT     — (optional) custom endpoint for R2 / MinIO / etc.
 *   AWS_S3_ACL          — (optional, default "public-read")
 *   AWS_S3_KEY_PREFIX   — (optional, default "uploads/")
 */

import path from "node:path";
import multer from "multer";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const FILE_FILTER = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(null, true);
  cb(new Error("Only JPEG, PNG, and WebP images are accepted."));
};
const LIMITS = { fileSize: 5 * 1024 * 1024 };

function uniqueFilename(originalname) {
  const ext = path.extname(originalname);
  return `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
}

async function buildS3Storage() {
  // Dynamic import so the module is only loaded when S3 is configured.
  const [{ S3Client }, { default: multerS3 }] = await Promise.all([
    import("@aws-sdk/client-s3"),
    import("multer-s3"),
  ]);

  const {
    AWS_S3_BUCKET,
    AWS_REGION,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_S3_ENDPOINT,
    AWS_S3_ACL     = "public-read",
    AWS_S3_KEY_PREFIX = "uploads/",
  } = process.env;

  const clientConfig = {
    region: AWS_REGION || "auto",
    credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
  };
  if (AWS_S3_ENDPOINT) clientConfig.endpoint = AWS_S3_ENDPOINT;

  const s3 = new S3Client(clientConfig);

  const storage = multerS3({
    s3,
    bucket: AWS_S3_BUCKET,
    acl: AWS_S3_ACL,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (_req, file, cb) => cb(null, `${AWS_S3_KEY_PREFIX}${uniqueFilename(file.originalname)}`),
  });

  return storage;
}

function buildLocalStorage(uploadsDir) {
  return multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => cb(null, uniqueFilename(file.originalname)),
  });
}

/**
 * Returns { upload, getPublicUrl }.
 *
 * upload       — configured multer middleware
 * getPublicUrl — (req) => string — builds the URL that clients use to load the file
 */
export async function createStorageProvider(uploadsDir) {
  const useS3 = Boolean(process.env.AWS_S3_BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

  if (useS3) {
    const storage = await buildS3Storage();
    const upload  = multer({ storage, limits: LIMITS, fileFilter: FILE_FILTER });

    function getPublicUrl(req) {
      // multer-s3 sets req.file.location to the full S3/R2 public URL.
      return req.file?.location || null;
    }

    return { upload, getPublicUrl, provider: "s3" };
  }

  const storage = buildLocalStorage(uploadsDir);
  const upload  = multer({ storage, limits: LIMITS, fileFilter: FILE_FILTER });

  function getPublicUrl(req) {
    return req.file ? `/uploads/${req.file.filename}` : null;
  }

  return { upload, getPublicUrl, provider: "local" };
}
