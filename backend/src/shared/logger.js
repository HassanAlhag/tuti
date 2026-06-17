import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: process.env.LOG_LEVEL || (env.nodeEnv === "production" ? "info" : "debug"),
  ...(env.nodeEnv !== "production" && {
    transport: { target: "pino-pretty", options: { colorize: true, ignore: "pid,hostname" } },
  }),
});
