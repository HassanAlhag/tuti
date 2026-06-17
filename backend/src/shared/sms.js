import { logger } from "./logger.js";
import { env } from "../config/env.js";

// Lazily initialized Twilio client — only created if credentials are set
let clientPromise = null;

function lazyClient() {
  if (clientPromise) return clientPromise;
  if (!env.twilioSid || !env.twilioToken) return Promise.resolve(null);
  clientPromise = import("twilio").then(({ default: Twilio }) => new Twilio(env.twilioSid, env.twilioToken)).catch(() => null);
  return clientPromise;
}

async function send(to, body) {
  const client = await lazyClient();
  if (!client || !env.twilioFrom) {
    logger.info({ to, body }, "[sms:dev] Would send SMS");
    return;
  }
  try {
    await client.messages.create({ to, from: env.twilioFrom, body });
  } catch (err) {
    logger.error({ err, to }, "[sms] Failed to send");
  }
}

const STATUS_COPY = {
  Preparing: (id) => `Your Tuti order ${id} is being prepared by the seller.`,
  Shipped:   (id) => `Your Tuti order ${id} is on its way!`,
  Delivered: (id) => `Your Tuti order ${id} has been delivered. Enjoy!`,
  Refunded:  (id) => `Your Tuti order ${id} has been refunded.`,
};

export async function sendOrderStatusSms(phone, orderId, status) {
  if (!phone) return;
  const fn = STATUS_COPY[status];
  if (!fn) return;
  await send(phone, fn(orderId));
}

export async function sendOrderConfirmationSms(phone, orderId) {
  if (!phone) return;
  await send(phone, `Thank you for your Tuti order! Your order ID is ${orderId}. We'll keep you updated.`);
}
