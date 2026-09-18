require("dotenv").config();
const mongoose = require("mongoose");
const Cart = require("../src/models/cart");
const PrintingPayment = require("../src/models/printingPayment");
const User = require("../src/models/user");
const { notifyBookPrintCanceledRefund } = require("../src/utils/bookOrderEmails");

(async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  const id = "6aacdd631018f4485e180f8b";
  const cart = await Cart.findById(id);
  if (!cart) {
    console.log("cart not found");
    process.exit(1);
  }
  const user = await User.findById(cart.userId).select("email").lean();
  const payment = await PrintingPayment.findOne({ cartId: id }).sort({ createdAt: -1 });

  console.log("Will send refund email to account:", user?.email);
  console.log("Cart shipping email (not used):", cart.email);
  console.log("refundStatus", cart.refundStatus, "refundAmount", cart.refundAmount);

  await Cart.updateOne({ _id: id }, { $unset: { refundEmailSentAt: 1 } });
  cart.refundEmailSentAt = undefined;

  const fee =
    payment?.stripeFeeCents != null
      ? payment.stripeFeeCents / 100
      : Number(cart.total_price) - Number(cart.refundAmount);

  const sent = await notifyBookPrintCanceledRefund(cart, {
    luluStatus: "CANCELED",
    refundAmount: cart.refundAmount,
    originalAmount: cart.total_price,
    stripeFee: fee,
    currency: cart.currency,
    refundId: cart.refundId,
    printJobId: cart.luluPrintJobId,
  });
  console.log("Resend result", sent);
  if (sent) {
    await Cart.updateOne({ _id: id }, { $set: { refundEmailSentAt: new Date() } });
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
