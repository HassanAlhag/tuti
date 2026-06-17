import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { buildEnv, validateEnv, assertProductionSeedModeDisabled } from "./env.js";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const strongJwtSecret = "prod-jwt-secret-1234567890abcdef";
const strongRefreshSecret = "prod-refresh-secret-1234567890abc";

function productionRawEnv(overrides = {}) {
  return {
    NODE_ENV: "production",
    PORT: "5055",
    MONGO_URI: "mongodb://mongo:27017/tuti",
    JWT_SECRET: strongJwtSecret,
    JWT_REFRESH_SECRET: strongRefreshSecret,
    CORS_ORIGINS: "https://tuti.example,https://seller.tuti.example",
    ...overrides,
  };
}

function validateRaw(rawEnv) {
  return validateEnv(buildEnv(rawEnv), rawEnv);
}

test("production safety: production requires MONGO_URI", () => {
  const rawEnv = productionRawEnv({ MONGO_URI: "" });

  assert.throws(
    () => validateRaw(rawEnv),
    /MONGO_URI is required in production/
  );
});

test("production safety: production rejects placeholder or weak JWT secrets", () => {
  assert.throws(
    () => validateRaw(productionRawEnv({ JWT_SECRET: "dev-jwt-secret-change-in-production" })),
    /JWT_SECRET must be a strong production secret/
  );

  assert.throws(
    () => validateRaw(productionRawEnv({ JWT_REFRESH_SECRET: "short-refresh-secret" })),
    /JWT_REFRESH_SECRET must be a strong production secret/
  );
});

test("production safety: production requires explicitly configured CORS origins", () => {
  const rawEnv = productionRawEnv();
  delete rawEnv.CORS_ORIGINS;

  assert.throws(
    () => validateRaw(rawEnv),
    /CORS_ORIGINS \(or CLIENT_ORIGINS\) is required in production/
  );
});

test("production safety: production rejects localhost and default development CORS origins", () => {
  assert.throws(
    () => validateRaw(productionRawEnv({ CORS_ORIGINS: "http://localhost:5173" })),
    /CORS_ORIGINS must not include localhost/
  );

  assert.throws(
    () => validateRaw(productionRawEnv({ CORS_ORIGINS: "http://127.0.0.1:5173" })),
    /CORS_ORIGINS must not include localhost/
  );

  assert.throws(
    () => validateRaw(productionRawEnv({ CORS_ORIGINS: "http://127.0.0.2:5173,http://[::1]:5173" })),
    /CORS_ORIGINS must not include localhost/
  );
});

test("production safety: valid production database, JWT, and CORS config passes", () => {
  assert.doesNotThrow(() => validateRaw(productionRawEnv()));
});

test("production safety: development seed and localhost behavior remains allowed", () => {
  const rawEnv = { NODE_ENV: "development" };
  const config = buildEnv(rawEnv);

  assert.ok(config.clientOrigins.includes("http://localhost:5173"));
  assert.doesNotThrow(() => validateEnv(config, rawEnv));
  assert.doesNotThrow(() => assertProductionSeedModeDisabled(config, "Seed-memory database mode"));
});

test("production safety: seed-memory database mode is guarded directly", () => {
  const config = buildEnv(productionRawEnv({ MONGO_URI: "" }));

  assert.throws(
    () => assertProductionSeedModeDisabled(config, "Seed-memory database mode"),
    /Seed-memory database mode is disabled in production/
  );
});

test("production safety: direct production connectDB call cannot enter seed-memory mode", async () => {
  const code = `
    import { connectDB } from "./backend/src/config/db.js";

    try {
      await connectDB();
      console.error("connectDB unexpectedly allowed seed-memory mode");
      process.exit(1);
    } catch (err) {
      if (err.status !== 500 || !/Seed-memory database mode is disabled in production/.test(err.message)) {
        console.error(err?.stack || err?.message || err);
        process.exit(1);
      }
    }
  `;

  await execFileAsync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: "production",
      MONGO_URI: "",
      JWT_SECRET: strongJwtSecret,
      JWT_REFRESH_SECRET: strongRefreshSecret,
      CORS_ORIGINS: "https://tuti.example",
    },
  });
});

test("production safety: direct production auth service call cannot auto-create a demo login", async () => {
  const code = `
    import { login } from "./backend/src/modules/auth/auth.service.js";

    try {
      await login({ email: "admin@example.com", password: "password123" });
      console.error("login unexpectedly allowed demo auth");
      process.exit(1);
    } catch (err) {
      if (err.status !== 500 || !/Seed\\/demo auth mode is disabled in production/.test(err.message)) {
        console.error(err?.stack || err?.message || err);
        process.exit(1);
      }
    }
  `;

  await execFileAsync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: "production",
      MONGO_URI: "",
      JWT_SECRET: strongJwtSecret,
      JWT_REFRESH_SECRET: strongRefreshSecret,
      CORS_ORIGINS: "https://tuti.example",
    },
  });
});
