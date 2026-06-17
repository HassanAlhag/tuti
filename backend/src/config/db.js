import mongoose from "mongoose";
import { assertProductionSeedModeDisabled, env } from "./env.js";
import { seedMongoIfNeeded } from "../seed/mongo.seed.js";

let isConnected = false;

export async function connectDB() {
  if (!env.mongoUri) {
    assertProductionSeedModeDisabled(env, "Seed-memory database mode");
    console.log("[db] No MONGO_URI set — running with in-memory seed data.");
    return;
  }
  if (isConnected) return;

  await mongoose.connect(env.mongoUri);
  isConnected = true;
  console.log("[db] Connected to MongoDB.");
  await seedMongoIfNeeded();

  mongoose.connection.on("disconnected", () => {
    isConnected = false;
    console.warn("[db] MongoDB disconnected.");
  });
}
