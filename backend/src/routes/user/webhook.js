const express = require("express");
const router = express.Router();
const Cart = require("../../models/cart");
const PrintingPayment = require("../../models/printingPayment");
const {
  notifyBookPrintStatus,
  notifyBookPrintCanceledRefund,
} = require("../../utils/bookOrderEmails.js");
const { refundPrintPaymentForCart } = require("../../utils/stripePrintRefund.js");

const REFUND_STATUSES = new Set(["REJECTED", "CANCELED", "CANCELLED"]);

// Endpoint: POST /api/webhooks/lulu
router.post("/lulu", async (req, res) => {
  try {
    console.log("🔔 WEBHOOK RECEIVED!");
    console.log("Headers:", req.headers);
    console.log("Body:", JSON.stringify(req.body, null, 2));

    const event = req.body || {};
    const payload = event.data || event.payload || event;

    const printJobId = payload.id || payload.print_job_id || event.print_job_id;
    const newStatus =
      (payload.status && (payload.status.name || payload.status)) ||
      (event.status && event.status.name) ||
      null;
    const externalId =
      payload.external_id ||
      payload.externalId ||
      event.external_id ||
      event.externalId ||
      null;

    console.log("Parsed webhook:", { externalId, printJobId, newStatus });

    // Acknowledge immediately so Lulu does not retry the delivery.
    res.status(200).send("Webhook received");

    setImmediate(() => {
      handleLuluWebhook({ externalId, printJobId, newStatus }).catch((err) => {
        console.error("Lulu webhook async handler error:", err);
      });
    });
  } catch (error) {
    console.error("❌ Webhook Error:", error);
    if (!res.headersSent) {
      res.status(500).send("Server Error");
    }
  }
});

/**
 * Send refund email at most once (unless force=true).
 * Only marks refundEmailSentAt after the mail transport accepts the message.
 */
async function sendRefundEmailOnce(cart, emailPayload, { force = false } = {}) {
  if (!cart?._id) return false;
  if (!force && cart.refundEmailSentAt) {
    console.log(`Refund email already sent for cart ${cart._id}`);
    return true;
  }

  const sent = await notifyBookPrintCanceledRefund(cart, emailPayload);
  if (!sent) {
    console.error(`Refund email NOT delivered for cart ${cart._id}`);
    return false;
  }

  const sentAt = new Date();
  await Cart.updateOne({ _id: cart._id }, { $set: { refundEmailSentAt: sentAt } });
  await PrintingPayment.updateOne(
    { cartId: cart._id },
    { $set: { refundEmailSentAt: sentAt } }
  );
  console.log(`Refund email marked sent for cart ${cart._id}`);
  return true;
}

async function handleLuluWebhook({ externalId, printJobId, newStatus }) {
  if (!externalId) {
    console.log("No external_id found in webhook payload; skipping cart update.");
    return;
  }

  const statusUpper = String(newStatus || "").toUpperCase();
  const update = {};
  if (newStatus) update.status = String(newStatus).toLowerCase();
  if (printJobId) update.luluPrintJobId = String(printJobId);

  const updated = await Cart.findByIdAndUpdate(
    externalId,
    { $set: update },
    { new: true }
  );

  if (!updated) {
    console.log(`⚠️ No Cart found with id ${externalId}`);
    return;
  }

  console.log(`✅ Cart ${externalId} updated with status=${update.status}`);

  // REJECTED / CANCELED → refund + refund email ONLY (never the generic status email)
  if (REFUND_STATUSES.has(statusUpper)) {
    console.log(
      `Processing Stripe refund for cart ${externalId} (Lulu status=${statusUpper})`
    );
    const refundResult = await refundPrintPaymentForCart(updated, {
      reason: `lulu_${statusUpper.toLowerCase()}`,
      luluStatus: statusUpper,
      printJobId: printJobId || updated.luluPrintJobId,
    });

    console.log("Refund result:", refundResult);

    const freshCart = await Cart.findById(externalId);

    if (refundResult.ok && (refundResult.refundId || refundResult.alreadyRefunded)) {
      const emailPayload = {
        luluStatus: statusUpper,
        refundAmount:
          refundResult.refundAmountCents != null
            ? refundResult.refundAmountCents / 100
            : freshCart?.refundAmount ?? updated.refundAmount,
        originalAmount:
          refundResult.amountCents != null
            ? refundResult.amountCents / 100
            : freshCart?.total_price ?? updated.total_price,
        stripeFee:
          refundResult.feeCents != null ? refundResult.feeCents / 100 : null,
        currency: refundResult.currency || freshCart?.currency || updated.currency,
        refundId:
          refundResult.refundId || freshCart?.refundId || updated.refundId,
        printJobId: printJobId || updated.luluPrintJobId,
      };

      try {
        await sendRefundEmailOnce(freshCart || updated, emailPayload);
      } catch (e) {
        console.error("Refund email failed:", e);
      }
      return;
    }

    if (!refundResult.ok) {
      // Do not use the generic "Print Status Update" template for cancel/reject.
      try {
        await notifyBookPrintCanceledRefund(freshCart || updated, {
          luluStatus: statusUpper,
          refundAmount: null,
          originalAmount: freshCart?.total_price ?? updated.total_price,
          stripeFee: null,
          currency: freshCart?.currency || updated.currency,
          refundId: null,
          printJobId: printJobId || updated.luluPrintJobId,
        });
      } catch (e) {
        console.error("Cancel/reject notice email failed:", e);
      }
      return;
    }

    // Unpaid / nothing to refund — still use cancel template, not generic status
    try {
      await notifyBookPrintCanceledRefund(freshCart || updated, {
        luluStatus: statusUpper,
        refundAmount: 0,
        originalAmount: freshCart?.total_price ?? updated.total_price,
        stripeFee: null,
        currency: freshCart?.currency || updated.currency,
        refundId: null,
        printJobId: printJobId || updated.luluPrintJobId,
      });
    } catch (e) {
      console.error("Cancel notice email failed:", e);
    }
    return;
  }

  // All other Lulu statuses → generic status email
  await notifyBookPrintStatus(updated, {
    status: newStatus,
    printJobId: printJobId || updated.luluPrintJobId,
  }).catch(() => {});
}

module.exports = router;
module.exports.sendRefundEmailOnce = sendRefundEmailOnce;
module.exports.handleLuluWebhook = handleLuluWebhook;
