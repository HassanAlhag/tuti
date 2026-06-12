import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

const auditEventSchema = new mongoose.Schema({
  id:         { type: String, default: () => `audit-${randomUUID()}`, unique: true, index: true },
  action:     { type: String, required: true, index: true },
  actorId:    { type: String, default: null, index: true },
  actorName:  { type: String, default: null },
  actorRole:  { type: String, default: null },
  entityType: { type: String, default: null, index: true },
  entityId:   { type: String, default: null, index: true },
  summary:    { type: String, required: true },
  meta:       { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt:  { type: Date, default: Date.now, index: true },
}, {
  collection: "auditevents",
  versionKey: false,
  timestamps: false,
});

export const AuditEvent = mongoose.model("AuditEvent", auditEventSchema);
