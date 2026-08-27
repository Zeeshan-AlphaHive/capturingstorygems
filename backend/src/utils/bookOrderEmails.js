const User = require("../models/user.js");
const { sendMail } = require("./send-mail.js");
const {
  bookCartAddedEmail,
  bookPaymentSuccessEmail,
  bookSentToLuluEmail,
  bookPrintStatusEmail,
} = require("../data/emails.js");

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
    return;
  }
  try {
    await sendMail(html, { subject, to_email });
  } catch (err) {
    console.error(`Failed to send email "${subject}" to ${to_email}:`, err?.message || err);
  }
}

async function notifyBookAddedToCart(cart) {
  const to = await resolveRecipientEmail(cart, cart?.userId);
  const html = await bookCartAddedEmail({
    bookTitle: cart?.title,
    quantity: cart?.quantity,
    totalPrice: cart?.total_price,
    currency: cart?.currency,
  });
  await safeSend("Your book was added to cart", to, html);
}

async function notifyBookPaymentSuccess(cart, { amount, currency, transactionId } = {}) {
  const to = await resolveRecipientEmail(cart, cart?.userId);
  const html = await bookPaymentSuccessEmail({
    bookTitle: cart?.title,
    amount: amount ?? cart?.total_price,
    currency: currency || cart?.currency,
    transactionId,
  });
  await safeSend("Book payment successful", to, html);
}

async function notifyBookSentToLulu(cart, { printJobId } = {}) {
  const to = await resolveRecipientEmail(cart, cart?.userId);
  const html = await bookSentToLuluEmail({
    bookTitle: cart?.title,
    quantity: cart?.quantity,
    printJobId,
  });
  await safeSend("Your book was sent to print", to, html);
}

async function notifyBookPrintStatus(cart, { status, printJobId } = {}) {
  const to = await resolveRecipientEmail(cart, cart?.userId);
  const html = await bookPrintStatusEmail({
    bookTitle: cart?.title,
    status,
    printJobId,
  });
  await safeSend(`Print status update: ${status || "updated"}`, to, html);
}

module.exports = {
  notifyBookAddedToCart,
  notifyBookPaymentSuccess,
  notifyBookSentToLulu,
  notifyBookPrintStatus,
};
