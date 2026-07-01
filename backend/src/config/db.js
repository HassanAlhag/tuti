import mongoose from "mongoose";
import { assertProductionSeedModeDisabled, env, getMongoHosts, isLocalMongoUri } from "./env.js";
import { seedMongoIfNeeded } from "../seed/mongo.seed.js";

let isConnected = false;

function warnIfRemoteMongoInDevelopment() {
  if (env.nodeEnv === "production") return;
  if (isLocalMongoUri(env.mongoUri)) return;
  const hosts = getMongoHosts(env.mongoUri).join(", ") || "unknown host";
  console.warn(
    `[db] WARNING: local development (NODE_ENV=${env.nodeEnv}) is connected to a REMOTE MongoDB host (${hosts}), not a local database. ` +
    `Changes made here affect that remote database. See .env.example for a local MongoDB URI, or scripts/preview-seed-mode.sh to preview against in-memory seed data instead.`
  );
}

export async function connectDB() {
  if (!env.mongoUri) {
    assertProductionSeedModeDisabled(env, "Seed-memory database mode");
    console.log("[db] No MONGO_URI set — running with in-memory seed data.");
    return;
  }
  if (isConnected) return;

  warnIfRemoteMongoInDevelopment();
  await mongoose.connect(env.mongoUri);
  isConnected = true;
  console.log("[db] Connected to MongoDB.");
  await seedMongoIfNeeded();

  mongoose.connection.on("disconnected", () => {
    isConnected = false;
    console.warn("[db] MongoDB disconnected.");
  });
}
