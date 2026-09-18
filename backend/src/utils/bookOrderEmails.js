const User = require("../models/user.js");
const { sendMail } = require("./send-mail.js");
const emails = require("../data/emails.js");

async function resolveRecipientEmail(cartLike, userId) {
  // Always use the signed-in account email, not book-builder / shipping contact email.
  const id = userId || cartLike?.userId;
  if (!id) return null;
  const u = await User.findById(id).select("email").lean();
  return u?.email || null;
}

async function safeSend(subject, to_email, html) {
  if (!to_email) {
    console.warn("Skipping email — no recipient:", subject);
    return false;
  }
  if (!html || typeof html !== "string") {
    console.error(`Skipping email "${subject}" — missing HTML body`);
    return false;
  }
  try {
    console.log(`Sending email → to=${to_email} subject="${subject}"`);
    await sendMail(html, { subject, to_email });
    return true;
  } catch (err) {
    console.error(`Failed to send email "${subject}" to ${to_email}:`, err?.message || err);
    return false;
  }
}

async function notifyBookAddedToCart(cart) {
  const to = await resolveRecipientEmail(cart, cart?.userId);
  const html = await emails.bookCartAddedEmail({
    bookTitle: cart?.title,
    quantity: cart?.quantity,
    totalPrice: cart?.total_price,
    currency: cart?.currency,
  });
  await safeSend("Your book was added to cart", to, html);
}

async function notifyBookPaymentSuccess(cart, { amount, currency, transactionId } = {}) {
  const to = await resolveRecipientEmail(cart, cart?.userId);
  const html = await emails.bookPaymentSuccessEmail({
    bookTitle: cart?.title,
    amount: amount ?? cart?.total_price,
    currency: currency || cart?.currency,
    transactionId,
  });
  await safeSend("Book payment successful", to, html);
}

async function notifyBookSentToLulu(cart, { printJobId } = {}) {
  const to = await resolveRecipientEmail(cart, cart?.userId);
  const html = await emails.bookSentToLuluEmail({
    bookTitle: cart?.title,
    quantity: cart?.quantity,
    printJobId,
  });
  await safeSend("Your book was sent to print", to, html);
}

async function notifyBookPrintStatus(cart, { status, printJobId } = {}) {
  const to = await resolveRecipientEmail(cart, cart?.userId);
  const html = await emails.bookPrintStatusEmail({
    bookTitle: cart?.title,
    status,
    printJobId,
  });
  await safeSend(`Print status update: ${status || "updated"}`, to, html);
}

/**
 * Refund notice for Lulu REJECTED / CANCELED.
 * Returns true only when the email was actually accepted by the mail transport.
 */
async function notifyBookPrintCanceledRefund(
  cart,
  {
    luluStatus,
    refundAmount,
    originalAmount,
    stripeFee,
    currency,
    refundId,
    printJobId,
  } = {}
) {
  if (typeof emails.bookPrintCanceledRefundEmail !== "function") {
    throw new Error(
      "bookPrintCanceledRefundEmail is not available — restart the server after deploying emails.js"
    );
  }

  const to = await resolveRecipientEmail(cart, cart?.userId);
  const statusUpper = String(luluStatus || "").toUpperCase();
  const refundLabel =
    refundAmount != null && Number.isFinite(Number(refundAmount))
      ? ` (${(currency || cart?.currency || "USD").toUpperCase()} ${Number(refundAmount).toFixed(2)})`
      : "";
  const subject =
    statusUpper === "REJECTED"
      ? `Print order rejected — refund issued${refundLabel}`
      : `Print order canceled — refund issued${refundLabel}`;

  const html = await emails.bookPrintCanceledRefundEmail({
    bookTitle: cart?.title,
    luluStatus,
    refundAmount,
    originalAmount,
    stripeFee,
    currency: currency || cart?.currency,
    refundId,
    printJobId,
  });

  if (!html.includes("Refund details")) {
    throw new Error("Refund email template rendered without refund details");
  }

  return safeSend(subject, to, html);
}

module.exports = {
  notifyBookAddedToCart,
  notifyBookPaymentSuccess,
  notifyBookSentToLulu,
  notifyBookPrintStatus,
  notifyBookPrintCanceledRefund,
  resolveRecipientEmail,
};
