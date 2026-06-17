import pino from "pino";
import { createRequire } from "node:module";
import { env } from "../config/env.js";

const require = createRequire(import.meta.url);

function canResolvePrettyTransport() {
  try {
    require.resolve("pino-pretty");
    return true;
  } catch {
    return false;
  }
}

function shouldUsePrettyTransport(nodeEnv, canUsePrettyTransport) {
  if (nodeEnv !== "development") return false;
  try {
    return Boolean(canUsePrettyTransport());
  } catch {
    return false;
  }
}

export function buildLoggerOptions(
  config = env,
  rawEnv = process.env,
  canUsePrettyTransport = canResolvePrettyTransport,
) {
  const nodeEnv = config.nodeEnv || rawEnv.NODE_ENV || "development";
  const options = {
    level: rawEnv.LOG_LEVEL || (nodeEnv === "production" ? "info" : "debug"),
  };

  if (shouldUsePrettyTransport(nodeEnv, canUsePrettyTransport)) {
    options.transport = {
      target: "pino-pretty",
      options: { colorize: true, ignore: "pid,hostname" },
    };
  }

  return options;
}

export const logger = pino(buildLoggerOptions());
