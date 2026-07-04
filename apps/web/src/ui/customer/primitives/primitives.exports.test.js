import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("customer primitive index exposes the expected foundation components", () => {
  const source = readFileSync(join(__dirname, "index.js"), "utf8");
  const expectedExports = [
    "TutiBadge",
    "TutiButton",
    "TutiCard",
    "TutiCarousel",
    "TutiEmptyState",
    "TutiMediaStage",
    "TutiSection",
  ];

  for (const exportName of expectedExports) {
    assert.match(source, new RegExp(`export \\{ ${exportName} \\}`), `missing ${exportName} export`);
  }
});
