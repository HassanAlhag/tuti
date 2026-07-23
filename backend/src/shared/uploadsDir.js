/**
 * Single source of truth for the local-disk uploads directory (dev/test
 * fallback only -- see s3Storage.js). Both app.js (static file serving,
 * directory creation) and media.service.js (variant deletion) need this
 * same path; centralizing it here avoids two independently-computed
 * copies drifting apart.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";

const backendDir = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

export const uploadsDir = env.uploadDir
  ? path.resolve(env.uploadDir)
  : path.join(backendDir, "uploads");
