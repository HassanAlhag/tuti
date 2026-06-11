import mongoose from "mongoose";

const supportTicketMessageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    body: { type: String, required: true },
    by: { type: String, default: "system" },
    role: { type: String, default: "system" },
    userId: { type: String, default: null },
    attachments: [{ type: mongoose.Schema.Types.Mixed }],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const supportTicketNoteSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    note: { type: String, required: true },
    by: { type: String, default: "system" },
    role: { type: String, default: "system" },
    userId: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const supportTicketSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    ticketNumber: { type: String, required: true, unique: true },
    requesterUserId: { type: String, required: true, index: true },
    requesterName: { type: String, default: "" },
    requesterEmail: { type: String, default: "" },
    requesterRole: {
      type: String,
      enum: ["customer", "seller", "driver", "admin", "support"],
      required: true,
    },
    shopId: { type: String, default: null, index: true },
    driverId: { type: String, default: null, index: true },
    orderId: { type: String, default: null, index: true },
    category: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    status: {
      type: String,
      enum: [
        "Open",
        "In Progress",
        "Waiting for Customer",
        "Waiting for Seller",
        "Waiting for Driver",
        "Resolved",
        "Closed",
      ],
      default: "Open",
    },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    messages: { type: [supportTicketMessageSchema], default: [] },
    internalNotes: { type: [supportTicketNoteSchema], default: [] },
    assignedToUserId: { type: String, default: null, index: true },
    assignedToUserName: { type: String, default: "" },
    assignedToUserEmail: { type: String, default: "" },
    assignedToRole: { type: String, default: null },
    attachments: [{ type: mongoose.Schema.Types.Mixed }],
    convertedOrderId: { type: String, default: null },
    convertedDisputeRef: { type: String, default: null },
    convertedIssueType: { type: String, default: null },
    convertedNote: { type: String, default: null },
    convertedAt: { type: Date, default: null },
    convertedBy: { type: String, default: null },
    convertedByRole: { type: String, default: null },
    lastMessageAt: { type: Date, default: null },
    lastStatusAt: { type: Date, default: null },
  },
  { timestamps: true }
);

supportTicketSchema.index({ ticketNumber: 1 }, { unique: true });
supportTicketSchema.index({ requesterUserId: 1, createdAt: -1 });
supportTicketSchema.index({ shopId: 1, createdAt: -1 });
supportTicketSchema.index({ driverId: 1, createdAt: -1 });
supportTicketSchema.index({ orderId: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, priority: 1, updatedAt: -1 });

export const SupportTicket = mongoose.model("SupportTicket", supportTicketSchema);
