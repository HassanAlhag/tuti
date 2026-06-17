import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";

const { buildLoggerOptions, logger } = await import("./logger.js");

test("logger setup: test environment does not configure pino-pretty", () => {
  const options = buildLoggerOptions(
    { nodeEnv: "test" },
    { NODE_ENV: "test" },
    () => true,
  );

  assert.equal(options.level, "debug");
  assert.equal(options.transport, undefined);
});

test("logger setup: production keeps structured logging without pretty transport", () => {
  const options = buildLoggerOptions(
    { nodeEnv: "production" },
    { NODE_ENV: "production" },
    () => true,
  );

  assert.equal(options.level, "info");
  assert.equal(options.transport, undefined);
});

test("logger setup: development uses pino-pretty when resolvable", () => {
  const options = buildLoggerOptions(
    { nodeEnv: "development" },
    { NODE_ENV: "development" },
    () => true,
  );

  assert.equal(options.level, "debug");
  assert.deepEqual(options.transport, {
    target: "pino-pretty",
    options: { colorize: true, ignore: "pid,hostname" },
  });
});

test("logger setup: development falls back to plain pino when pino-pretty is unavailable", () => {
  const options = buildLoggerOptions(
    { nodeEnv: "development" },
    { NODE_ENV: "development" },
    () => false,
  );

  assert.equal(options.level, "debug");
  assert.equal(options.transport, undefined);
});

test("logger setup: development falls back to plain pino when transport resolution throws", () => {
  const options = buildLoggerOptions(
    { nodeEnv: "development" },
    { NODE_ENV: "development" },
    () => {
      throw new Error("Cannot resolve pino-pretty");
    },
  );

  assert.equal(options.level, "debug");
  assert.equal(options.transport, undefined);
});

test("logger setup: LOG_LEVEL override is preserved", () => {
  const options = buildLoggerOptions(
    { nodeEnv: "production" },
    { NODE_ENV: "production", LOG_LEVEL: "warn" },
    () => true,
  );

  assert.equal(options.level, "warn");
  assert.equal(options.transport, undefined);
});

test("logger setup: shared logger imports safely in test mode", () => {
  assert.equal(typeof logger.info, "function");
  assert.equal(typeof logger.error, "function");
});
