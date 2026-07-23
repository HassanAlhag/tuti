import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { optimizeImage, sniffImageFormat, MAX_UPLOAD_BYTES } from "./imageOptimizer.js";

async function makeJpeg(width, height, background = { r: 200, g: 90, b: 40 }) {
  return sharp({ create: { width, height, channels: 3, background } }).jpeg().toBuffer();
}

async function makePngWithAlpha(width, height) {
  return sharp({ create: { width, height, channels: 4, background: { r: 10, g: 20, b: 200, alpha: 0.4 } } }).png().toBuffer();
}

test("optimizeImage produces thumbnail/card/detail WebP variants with the correct fixed/max dimensions", async () => {
  const buffer = await makeJpeg(1800, 1200);
  const result = await optimizeImage(buffer);

  assert.equal(result.format, "image/jpeg");
  assert.equal(result.originalWidth, 1800);
  assert.equal(result.originalHeight, 1200);

  assert.equal(result.variants.thumbnail.width, 320);
  assert.equal(result.variants.thumbnail.height, 320);
  assert.equal(result.variants.card.width, 720);
  assert.equal(result.variants.card.height, 720);
  // "detail" uses fit:inside on a 1800x1200 (3:2) source capped at 1400x1400 -- width is the constraining side.
  assert.equal(result.variants.detail.width, 1400);
  assert.ok(result.variants.detail.height < 1400);

  for (const name of ["thumbnail", "card", "detail"]) {
    const meta = await sharp(result.variants[name].buffer).metadata();
    assert.equal(meta.format, "webp", `${name} variant must be encoded as WebP`);
    assert.equal(result.variants[name].sizeBytes, result.variants[name].buffer.length);
  }
});

test("optimizeImage does not enlarge the detail variant beyond the source's own size", async () => {
  const buffer = await makeJpeg(300, 200);
  const result = await optimizeImage(buffer);

  // Source is smaller than 1400x1400 -- detail must stay at the source's
  // own resolution, never upscaled.
  assert.equal(result.variants.detail.width, 300);
  assert.equal(result.variants.detail.height, 200);

  // thumbnail/card use fit:cover and are expected to upscale to fill their fixed box.
  assert.equal(result.variants.thumbnail.width, 320);
  assert.equal(result.variants.card.width, 720);
});

test("optimizeImage auto-rotates using EXIF orientation before resizing", async () => {
  const base = await sharp({ create: { width: 300, height: 150, channels: 3, background: { r: 250, g: 10, b: 10 } } }).jpeg().toBuffer();
  // Orientation 6 = rotate 90 CW for display -- stored pixels stay 300x150,
  // but the image should be *displayed* (and therefore optimized) at 150x300.
  const rotated = await sharp(base).withMetadata({ orientation: 6 }).jpeg().toBuffer();

  const result = await optimizeImage(rotated);
  assert.equal(result.originalWidth, 150);
  assert.equal(result.originalHeight, 300);
  // A portrait (150x300) source through fit:inside on a 1400x1400 box is
  // height-constrained -- confirms the resize pipeline actually rotated
  // before measuring/resizing, not just before encoding.
  assert.equal(result.variants.detail.height, 300);
  assert.equal(result.variants.detail.width, 150);
});

test("optimizeImage preserves transparency from a PNG source into the WebP variants", async () => {
  const buffer = await makePngWithAlpha(400, 400);
  const result = await optimizeImage(buffer);

  const cardMeta = await sharp(result.variants.card.buffer).metadata();
  assert.ok(cardMeta.hasAlpha, "card variant must keep the alpha channel");
});

test("optimizeImage strips EXIF/ICC metadata from the output variants", async () => {
  const base = await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 5, g: 5, b: 5 } } }).jpeg().toBuffer();
  const withExif = await sharp(base).withMetadata({ orientation: 1, exif: { IFD0: { Copyright: "Should not survive" } } }).jpeg().toBuffer();

  const result = await optimizeImage(withExif);
  const meta = await sharp(result.variants.card.buffer).metadata();
  assert.equal(meta.exif, undefined);
});

test("optimizeImage rejects a corrupted/truncated file even with valid magic bytes", async () => {
  const real = await makeJpeg(500, 500);
  const truncated = real.subarray(0, 20); // keeps SOI/APP markers, discards the rest

  await assert.rejects(
    optimizeImage(truncated),
    (error) => { assert.equal(error.status, 400); return true; }
  );
});

test("optimizeImage rejects GIF and SVG even when correctly labeled", async () => {
  const gif = Buffer.from("GIF89a", "ascii");
  await assert.rejects(
    optimizeImage(gif),
    (error) => { assert.equal(error.status, 400); assert.match(error.message, /GIF/); return true; }
  );

  const svg = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>', "utf8");
  await assert.rejects(
    optimizeImage(svg),
    (error) => { assert.equal(error.status, 400); assert.match(error.message, /SVG/); return true; }
  );
});

test("optimizeImage rejects plain text/unsupported content", async () => {
  await assert.rejects(
    optimizeImage(Buffer.from("this is definitely not an image file", "utf8")),
    (error) => { assert.equal(error.status, 400); return true; }
  );
});

test("optimizeImage rejects a buffer larger than the 8MB upload cap", async () => {
  const big = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0);
  // Give it real JPEG magic bytes so this specifically tests the size gate,
  // not the format sniff.
  big[0] = 0xff; big[1] = 0xd8; big[2] = 0xff;

  await assert.rejects(
    optimizeImage(big),
    (error) => { assert.equal(error.status, 413); return true; }
  );
});

test("sniffImageFormat identifies JPEG/PNG/WebP/GIF and falls back to unknown for everything else", async () => {
  assert.equal(sniffImageFormat(await makeJpeg(10, 10)), "image/jpeg");
  assert.equal(sniffImageFormat(await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } }).png().toBuffer()), "image/png");
  assert.equal(sniffImageFormat(await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } }).webp().toBuffer()), "image/webp");
  assert.equal(sniffImageFormat(Buffer.from("GIF89a")), "image/gif");
  assert.equal(sniffImageFormat(Buffer.from("not an image at all, just text")), "unknown");
});
