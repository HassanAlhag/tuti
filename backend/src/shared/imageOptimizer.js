/**
 * Sharp-based image validation and optimization for the product media
 * pipeline. Replaces the old hand-rolled JPEG/PNG/WebP dimension parser
 * (shared/imageDimensions.js, deleted) -- Sharp gives real decode-based
 * validation, EXIF-aware auto-rotation, safe resizing, and WebP encoding
 * for free, and handles malformed input far more robustly than a
 * from-scratch parser ever could.
 *
 * A tiny magic-byte gate still runs before any buffer reaches Sharp --
 * this is a deliberate defense-in-depth step, not a duplicate of Sharp's
 * own format detection. It exists specifically to hard-block SVG (XML,
 * potential XXE/script vectors via librsvg) and GIF before they're ever
 * handed to the image library, regardless of what the client's declared
 * Content-Type says.
 */

import sharp from "sharp";

export const ALLOWED_INPUT_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB, per the AWS media requirement
export const MAX_INPUT_DIMENSION = 8000; // reject unreasonably large source photos
export const RECOMMENDED_MIN_WIDTH = 1200;
export const RECOMMENDED_MIN_HEIGHT = 1200;

// { fit: "cover" } always fills the target box (upscaling small sources is
// acceptable/expected for these two fixed tiles). Only "detail" uses
// withoutEnlargement -- the one place the spec explicitly forbids upscaling.
const VARIANT_SPECS = {
  thumbnail: { width: 320, height: 320, fit: "cover", quality: 78 },
  card: { width: 720, height: 720, fit: "cover", quality: 82 },
  detail: { width: 1400, height: 1400, fit: "inside", withoutEnlargement: true, quality: 86 },
};

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * Minimal magic-byte sniff -- just enough to allow-list JPEG/PNG/WebP and
 * explicitly identify (and reject) GIF/SVG before Sharp ever sees the
 * buffer. Not a dimension parser; Sharp owns all real decoding now.
 */
export function sniffImageFormat(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return "unknown";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buffer.length >= 6 && (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a")) return "image/gif";

  // SVG has no fixed magic bytes -- it's XML text, optionally preceded by a
  // BOM or an <?xml ...?> prolog. Best-effort textual sniff over the first
  // slice of the buffer is sufficient to hard-block it; anything that
  // doesn't match one of the known binary signatures above and doesn't
  // look like SVG falls through to "unknown" and is rejected anyway.
  const head = buffer.subarray(0, 300).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<?xml") || head.startsWith("<svg")) {
    if (head.includes("<svg") || head.startsWith("<svg")) return "image/svg+xml";
  }

  return "unknown";
}

const FORMAT_LABELS = {
  "image/gif": "GIF images are not accepted in this phase.",
  "image/svg+xml": "SVG images are not accepted.",
  unknown: "Only JPEG, PNG, and WebP images are accepted.",
};

/**
 * Validates and optimizes an uploaded image buffer into thumbnail/card/
 * detail WebP variants. Throws a customer-safe HTTP error for any
 * unsupported, oversized, or corrupted input -- never persists anything
 * itself (that's shared/s3Storage.js's job, orchestrated by
 * shared/mediaStorage.js).
 *
 * Returns { format, originalWidth, originalHeight, variants } where
 * variants is { thumbnail, card, detail }, each { buffer, width, height,
 * sizeBytes }.
 */
export async function optimizeImage(buffer) {
  if (!buffer || !buffer.length) throw createHttpError(400, "No image provided.");
  if (buffer.length > MAX_UPLOAD_BYTES) throw createHttpError(413, "File too large. Maximum size is 8 MB.");

  const sniffed = sniffImageFormat(buffer);
  if (!ALLOWED_INPUT_MIME_TYPES.has(sniffed)) {
    throw createHttpError(400, FORMAT_LABELS[sniffed] || FORMAT_LABELS.unknown);
  }

  let metadata;
  try {
    // Sharp's default limitInputPixels (~268M px, ~16384x16384) guards
    // against decompression-bomb inputs during decode.
    metadata = await sharp(buffer).metadata();
  } catch {
    throw createHttpError(400, "The uploaded file is corrupted or not a supported image.");
  }

  if (!metadata.width || !metadata.height) {
    throw createHttpError(400, "Could not read the image's dimensions.");
  }
  // Real decoded format must also be one of the three allowed types --
  // catches a renamed/mislabeled file whose magic bytes happened to match
  // but whose actual codec doesn't (e.g. a TIFF renamed to .jpg).
  const decodedMime = `image/${metadata.format}`;
  if (!ALLOWED_INPUT_MIME_TYPES.has(decodedMime)) {
    throw createHttpError(400, "Only JPEG, PNG, and WebP images are accepted.");
  }
  if (metadata.width > MAX_INPUT_DIMENSION || metadata.height > MAX_INPUT_DIMENSION) {
    throw createHttpError(422, `Image dimensions are too large (max ${MAX_INPUT_DIMENSION}px per side).`);
  }

  // metadata.width/height are the raw stored pixel dimensions, ignoring
  // EXIF orientation. A 5-8 orientation (90°/270° rotation) means the
  // image will visually swap width/height once auto-rotated below --
  // "original width/height" should reflect what the photo actually looks
  // like, not the pre-rotation storage layout.
  const swapped = metadata.orientation >= 5 && metadata.orientation <= 8;
  const originalWidth = swapped ? metadata.height : metadata.width;
  const originalHeight = swapped ? metadata.width : metadata.height;

  const variants = {};
  for (const [name, spec] of Object.entries(VARIANT_SPECS)) {
    // .rotate() with no args auto-orients from EXIF before resizing, then
    // the WebP encode below strips metadata by default (no .withMetadata()
    // call) -- EXIF/GPS/ICC never survive into the stored variant.
    const pipeline = sharp(buffer).rotate().resize({
      width: spec.width,
      height: spec.height,
      fit: spec.fit,
      withoutEnlargement: Boolean(spec.withoutEnlargement),
      position: "centre",
    }).webp({ quality: spec.quality });

    let out;
    try {
      out = await pipeline.toBuffer({ resolveWithObject: true });
    } catch {
      throw createHttpError(400, "The uploaded file is corrupted or not a supported image.");
    }

    variants[name] = { buffer: out.data, width: out.info.width, height: out.info.height, sizeBytes: out.info.size };
  }

  return { format: decodedMime, originalWidth, originalHeight, variants };
}
