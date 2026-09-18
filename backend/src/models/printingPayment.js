const { Schema, model, Types } = require("mongoose");

const printingPaymentSchema = new Schema(
  {
    transactionId: { type: String, required: true, index: true },
    /** Stripe Checkout Session id (same as transactionId for cart checkouts) */
    checkoutSessionId: { type: String },
    paymentIntentId: { type: String, index: true },
    chargeId: { type: String },
    cartId: { type: Types.ObjectId, ref: "Cart", index: true },
    userId: { type: Types.ObjectId, ref: "User" },
    amount: { type: Number },
    /** Amount originally charged, in cents */
    amountCents: { type: Number },
    currency: { type: String },
    status: { type: String },
    metadata: { type: Schema.Types.Mixed },
    raw: { type: Schema.Types.Mixed },

    // Refund tracking (idempotent)
    refundStatus: {
      type: String,
      enum: ["none", "pending", "succeeded", "failed", "skipped"],
      default: "none",
    },
    refundId: { type: String },
    refundAmountCents: { type: Number },
    stripeFeeCents: { type: Number },
    refundReason: { type: String },
    refundIdempotencyKey: { type: String },
    refundAttempts: { type: Number, default: 0 },
    refundLastError: { type: String },
    refundedAt: { type: Date },
    refundEmailSentAt: { type: Date },
    dateCreated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

printingPaymentSchema.index({ cartId: 1, refundStatus: 1 });

module.exports = model("PrintingPayment", printingPaymentSchema);
