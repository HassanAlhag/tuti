import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

function createTransport() {
  if (env.emailHost && env.emailUser) {
    return nodemailer.createTransport({
      host: env.emailHost,
      port: env.emailPort,
      secure: env.emailPort === 465,
      auth: { user: env.emailUser, pass: env.emailPass },
    });
  }
  // Dev: log to console instead of sending
  return null;
}

const transport = createTransport();

async function send({ to, subject, html, text }) {
  if (!transport) {
    logger.info({ to, subject }, "[email:dev] Would send email");
    return;
  }
  try {
    await transport.sendMail({
      from: env.emailFrom,
      to,
      subject,
      html,
      text,
    });
  } catch (err) {
    // Fire-and-forget — never crash the request handler over email
    logger.error({ err, to, subject }, "[email] Failed to send");
  }
}

export async function sendPasswordReset(toEmail, rawToken, resetUrl) {
  const link = resetUrl || `${env.clientOrigin}/reset-password?token=${rawToken}`;
  if (!transport) {
    logger.info({ toEmail, link }, "[email:dev] Password reset link");
    return;
  }
  await send({
    to: toEmail,
    subject: "Reset your Tuti password",
    text: `Use this link to reset your password (valid 1 hour):\n${link}`,
    html: `
      <p>Hello,</p>
      <p>We received a request to reset your Tuti password.</p>
      <p><a href="${link}" style="background:#0f6f61;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Reset password</a></p>
      <p>This link expires in 1 hour. If you didn't request a reset, ignore this email.</p>
    `,
  });
}

export async function sendOrderConfirmation(order, toEmail) {
  const itemCount = order.items?.length || 0;
  const total = order.total ?? order.totalAmount ?? 0;
  await send({
    to: toEmail,
    subject: `Your Tuti order ${order.id || order._id} is confirmed`,
    text: `Thank you for your order!\nOrder ID: ${order.id || order._id}\nItems: ${itemCount}\nTotal: AED ${Number(total).toFixed(2)}\nPayment: Cash on delivery`,
    html: `
      <p>Hi there,</p>
      <p>Thank you for your order at <strong>Tuti</strong>.</p>
      <table style="border-collapse:collapse;width:100%;max-width:480px">
        <tr><td style="padding:6px 0;color:#666">Order ID</td><td style="padding:6px 0;font-weight:bold">${order.id || order._id}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Items</td><td style="padding:6px 0">${itemCount}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Total</td><td style="padding:6px 0">AED ${Number(total).toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Payment</td><td style="padding:6px 0">Cash on delivery</td></tr>
      </table>
      <p>We'll notify you when your order is shipped.</p>
    `,
  });
}

export async function sendSellerApproved(toEmail, shopName) {
  await send({
    to: toEmail,
    subject: `Your Tuti seller account is approved — ${shopName}`,
    text: `Congratulations! Your seller account "${shopName}" has been approved. You can now log in and start listing products.`,
    html: `
      <p>Congratulations!</p>
      <p>Your seller account <strong>${shopName}</strong> has been approved on Tuti.</p>
      <p>Log in to your seller portal to start listing products and receiving orders.</p>
    `,
  });
}

export async function sendSellerRejected(toEmail, shopName, reason) {
  await send({
    to: toEmail,
    subject: `Update on your Tuti seller application — ${shopName}`,
    text: `Your seller application for "${shopName}" was not approved at this time.\n\nReason: ${reason || "Please contact support for more information."}\n\nYou may re-apply after addressing any outstanding issues.`,
    html: `
      <p>Hi there,</p>
      <p>Thank you for applying to sell on Tuti. After reviewing your application for <strong>${shopName}</strong>, we are unable to approve it at this time.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
      <p>Please contact our support team if you have questions or would like to re-apply.</p>
    `,
  });
}
