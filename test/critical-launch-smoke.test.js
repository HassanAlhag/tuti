import test from "node:test";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function runNodeTestGroup(label, files) {
  try {
    await execFileAsync(process.execPath, ["--test", ...files], {
      cwd: projectRoot,
      env: { ...process.env },
      maxBuffer: 1024 * 1024 * 8,
    });
  } catch (error) {
    const command = `node --test ${files.join(" ")}`;
    const stdout = String(error.stdout || "").trim();
    const stderr = String(error.stderr || "").trim();
    throw new Error([
      `${label} smoke group failed.`,
      `Command: ${command}`,
      `Exit code: ${error.code ?? "unknown"}`,
      "",
      "STDOUT:",
      stdout || "(empty)",
      "",
      "STDERR:",
      stderr || "(empty)",
    ].join("\n"));
  }
}

test("critical smoke: checkout authority and COD-only checkout", async () => {
  await runNodeTestGroup("Checkout authority and COD-only checkout", [
    "backend/src/modules/orders/orders.checkout-authority.test.js",
  ]);
});

test("critical smoke: production environment hard stops", async () => {
  await runNodeTestGroup("Production environment hard stops", [
    "backend/src/config/env.production-safety.test.js",
  ]);
});

test("critical smoke: driver delivery, proof-of-delivery, and COD settlement safety", async () => {
  await runNodeTestGroup("Driver delivery, proof-of-delivery, and COD settlement safety", [
    "backend/src/modules/drivers/drivers.service.test.js",
    "backend/src/modules/finance/codSettlement.test.js",
  ]);
});

test("critical smoke: public storefront filtering", async () => {
  await runNodeTestGroup("Public storefront filtering", [
    "backend/src/modules/marketplace/marketplace.service.test.js",
  ]);
});

test("critical smoke: refresh token rotation", async () => {
  await runNodeTestGroup("Refresh token rotation", [
    "packages/shared/api/client.test.js",
  ]);
});
