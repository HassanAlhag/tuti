import { connectDB } from "./config/db.js";
import { env, validateEnv } from "./config/env.js";
import { createApp } from "./app.js";

async function start() {
  validateEnv();
  await connectDB();
  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[server] Tuti API running on http://localhost:${env.port} (${env.nodeEnv})`);
  });
  server.on("error", (error) => {
    if (error?.code === "EADDRINUSE") {
      console.error(`[server] Port ${env.port} is already in use. Run 'npm run kill' or set a different PORT.`);
      process.exit(1);
    }
    console.error("[server] Listen error:", error);
    process.exit(1);
  });
}

start().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
