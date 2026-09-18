const Stripe = require("stripe");
const { configurations } = require("../configs/config.js");
const PrintingPayment = require("../models/printingPayment.js");
const Cart = require("../models/cart.js");

let stripeClient;
function getStripe() {
  if (!configurations.stripeSecretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  if (!stripeClient) {
    stripeClient = Stripe(configurations.stripeSecretKey);
  }
  return stripeClient;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const RETRYABLE_TYPES = new Set([
  "StripeConnectionError",
  "StripeAPIError",
  "StripeRateLimitError",
]);

async function withRetry(fn, { attempts = 4, baseDelayMs = 500 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const type = err?.type || err?.rawType || err?.name;
      const status = err?.statusCode || err?.status;
      const retryable =
        RETRYABLE_TYPES.has(type) ||
        status === 429 ||
        (status >= 500 && status < 600);
      if (!retryable || i === attempts - 1) throw err;
      const delay = baseDelayMs * Math.pow(2, i);
      console.warn(
        `Stripe call failed (attempt ${i + 1}/${attempts}), retrying in ${delay}ms:`,
        err?.message || err
      );
      await sleep(delay);
    }
  }
  throw lastErr;
}

/**
 * Resolve PaymentIntent + Charge + Stripe fee for a cart checkout session.
 */
async function resolveChargeDetails(sessionIdOrPaymentIntentId) {
  const stripe = getStripe();
  let paymentIntentId = sessionIdOrPaymentIntentId;
  let checkoutSessionId = null;

  if (String(sessionIdOrPaymentIntentId || "").startsWith("cs_")) {
    checkoutSessionId = sessionIdOrPaymentIntentId;
    const session = await withRetry(() =>
      stripe.checkout.sessions.retrieve(sessionIdOrPaymentIntentId, {
        expand: ["payment_intent"],
      })
    );
    paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!paymentIntentId) {
      throw new Error("Checkout session has no payment_intent");
    }
  }

  const pi = await withRetry(() =>
    stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    })
  );

  const charge =
    typeof pi.latest_charge === "object" && pi.latest_charge
      ? pi.latest_charge
      : null;

  if (!charge) {
    throw new Error(`No charge found for payment intent ${paymentIntentId}`);
  }

  let feeCents = 0;
  const bt = charge.balance_transaction;
  if (bt && typeof bt === "object" && Number.isFinite(Number(bt.fee))) {
    feeCents = Number(bt.fee);
  } else if (typeof bt === "string") {
    const balanceTxn = await withRetry(() =>
      stripe.balanceTransactions.retrieve(bt)
    );
    feeCents = Number(balanceTxn.fee) || 0;
  }

  const amountCents = Number(charge.amount) || 0;
  // Refund everything except Stripe's processing fee; commission/markup stays in the refund.
  const refundCents = Math.max(0, amountCents - feeCents);

  return {
    checkoutSessionId,
    paymentIntentId: pi.id,
    chargeId: charge.id,
    amountCents,
    feeCents,
    refundCents,
    currency: (charge.currency || pi.currency || "usd").toLowerCase(),
    charge,
  };
}

/**
 * Idempotent print-order refund for Lulu REJECTED / CANCELED.
 * Deducts Stripe processing fee; returns print cost + commission/markup to the customer.
 */
async function refundPrintPaymentForCart(cart, { reason, luluStatus, printJobId } = {}) {
  const cartId = cart?._id;
  if (!cartId) {
    return { ok: false, skipped: true, message: "Missing cart" };
  }

  if (!cart.paymentPaid) {
    return { ok: true, skipped: true, message: "Cart was not paid — nothing to refund" };
  }

  if (cart.refundStatus === "succeeded" && cart.refundId) {
    return {
      ok: true,
      skipped: true,
      alreadyRefunded: true,
      refundId: cart.refundId,
      refundAmountCents: Math.round(Number(cart.refundAmount || 0) * 100),
      message: "Already refunded",
    };
  }

  let payment = await PrintingPayment.findOne({ cartId }).sort({ createdAt: -1 });
  if (payment?.refundStatus === "succeeded" && payment.refundId) {
    await Cart.updateOne(
      { _id: cartId },
      {
        $set: {
          refundStatus: "succeeded",
          refundId: payment.refundId,
          refundAmount: (payment.refundAmountCents || 0) / 100,
          refundedAt: payment.refundedAt || new Date(),
        },
      }
    );
    return {
      ok: true,
      skipped: true,
      alreadyRefunded: true,
      refundId: payment.refundId,
      refundAmountCents: payment.refundAmountCents,
      message: "Already refunded (payment record)",
    };
  }

  const sessionId =
    cart.paymentTransactionId ||
    payment?.checkoutSessionId ||
    payment?.transactionId;

  if (!sessionId && !cart.paymentIntentId && !payment?.paymentIntentId) {
    return {
      ok: false,
      skipped: false,
      message: "No Stripe session/payment intent found for refund",
    };
  }

  const idempotencyKey =
    payment?.refundIdempotencyKey ||
    `print-refund-${cartId}`;

  // Claim refund slot (optimistic lock)
  if (payment) {
    const claimed = await PrintingPayment.findOneAndUpdate(
      {
        _id: payment._id,
        refundStatus: { $nin: ["succeeded", "pending"] },
      },
      {
        $set: {
          refundStatus: "pending",
          refundReason: reason || luluStatus || "print_canceled",
          refundIdempotencyKey: idempotencyKey,
        },
        $inc: { refundAttempts: 1 },
      },
      { new: true }
    );
    if (!claimed && payment.refundStatus === "succeeded") {
      return {
        ok: true,
        skipped: true,
        alreadyRefunded: true,
        refundId: payment.refundId,
        message: "Already refunded",
      };
    }
    if (!claimed && payment.refundStatus === "pending") {
      // Another worker may be in progress — still try with same idempotency key
      console.warn(`Refund already pending for cart ${cartId}; continuing with idempotency key`);
    }
    payment = claimed || payment;
  }

  await Cart.updateOne(
    { _id: cartId },
    { $set: { refundStatus: "pending" } }
  );

  try {
    const details = await resolveChargeDetails(
      sessionId || cart.paymentIntentId || payment?.paymentIntentId
    );

    if (details.refundCents <= 0) {
      await PrintingPayment.updateOne(
        { cartId },
        {
          $set: {
            refundStatus: "skipped",
            stripeFeeCents: details.feeCents,
            refundAmountCents: 0,
            paymentIntentId: details.paymentIntentId,
            chargeId: details.chargeId,
            refundLastError: "Refundable amount is zero after Stripe fee",
          },
        }
      );
      await Cart.updateOne(
        { _id: cartId },
        { $set: { refundStatus: "skipped" } }
      );
      return {
        ok: false,
        skipped: true,
        message: "Nothing left to refund after Stripe fee",
        feeCents: details.feeCents,
      };
    }

    const stripe = getStripe();
    const refund = await withRetry(() =>
      stripe.refunds.create(
        {
          charge: details.chargeId,
          amount: details.refundCents,
          reason: "requested_by_customer",
          metadata: {
            cartId: String(cartId),
            luluStatus: String(luluStatus || ""),
            printJobId: String(printJobId || ""),
            appReason: String(reason || "lulu_print_canceled"),
            stripeFeeCents: String(details.feeCents),
            originalAmountCents: String(details.amountCents),
          },
        },
        { idempotencyKey }
      )
    );

    const refundedAt = new Date();
    await PrintingPayment.findOneAndUpdate(
      { cartId },
      {
        $set: {
          refundStatus: "succeeded",
          refundId: refund.id,
          refundAmountCents: details.refundCents,
          stripeFeeCents: details.feeCents,
          paymentIntentId: details.paymentIntentId,
          chargeId: details.chargeId,
          checkoutSessionId: details.checkoutSessionId || sessionId,
          refundIdempotencyKey: idempotencyKey,
          refundReason: reason || luluStatus || "print_canceled",
          refundedAt,
          refundLastError: null,
          amountCents: details.amountCents,
        },
      },
      { sort: { createdAt: -1 } }
    );

    await Cart.updateOne(
      { _id: cartId },
      {
        $set: {
          refundStatus: "succeeded",
          refundId: refund.id,
          refundAmount: details.refundCents / 100,
          refundedAt,
          paymentIntentId: details.paymentIntentId,
        },
      }
    );

    return {
      ok: true,
      skipped: false,
      refundId: refund.id,
      refundAmountCents: details.refundCents,
      feeCents: details.feeCents,
      amountCents: details.amountCents,
      currency: details.currency,
      paymentIntentId: details.paymentIntentId,
    };
  } catch (err) {
    const message = err?.message || String(err);
    console.error(`Refund failed for cart ${cartId}:`, message);

    // If Stripe says already refunded, treat as success
    if (
      err?.code === "charge_already_refunded" ||
      /already been refunded/i.test(message)
    ) {
      await PrintingPayment.updateOne(
        { cartId },
        {
          $set: {
            refundStatus: "succeeded",
            refundLastError: message,
            refundedAt: new Date(),
          },
        }
      );
      await Cart.updateOne(
        { _id: cartId },
        { $set: { refundStatus: "succeeded", refundedAt: new Date() } }
      );
      return { ok: true, skipped: true, alreadyRefunded: true, message };
    }

    await PrintingPayment.updateOne(
      { cartId },
      {
        $set: {
          refundStatus: "failed",
          refundLastError: message,
        },
        $inc: { refundAttempts: 0 },
      }
    );
    await Cart.updateOne(
      { _id: cartId },
      { $set: { refundStatus: "failed" } }
    );

    return { ok: false, skipped: false, message };
  }
}

module.exports = {
  getStripe,
  withRetry,
  resolveChargeDetails,
  refundPrintPaymentForCart,
};
