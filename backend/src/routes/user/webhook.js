const express = require('express');
const router = express.Router();
const Cart = require('../../models/cart');
const { notifyBookPrintStatus } = require('../../utils/bookOrderEmails.js');

// Endpoint: POST /api/webhooks/lulu
router.post('/lulu', async (req, res) => {
    try {
        console.log("🔔 WEBHOOK RECEIVED!");
        console.log("Headers:", req.headers);
        console.log("Body:", JSON.stringify(req.body, null, 2));

        const event = req.body || {};
        console.log("Processing event:", event);

        // Normalize common webhook shapes: payload may be under `data` or `payload`.
        const payload = event.data || event.payload || event;

        const printJobId = payload.id || payload.print_job_id || event.print_job_id;
        const newStatus = (payload.status && (payload.status.name || payload.status)) || (event.status && event.status.name) || null;
        const externalId = payload.external_id || payload.externalId || event.external_id || event.externalId || null;

        console.log("Parsed webhook:", { externalId, printJobId, newStatus });

        // If we have an external_id that maps to our Cart._id, update the Cart status
        if (externalId) {
            try {
                const update = {};
                if (newStatus) update.status = String(newStatus).toLowerCase();
                if (printJobId) update.luluPrintJobId = String(printJobId);

                const updated = await Cart.findByIdAndUpdate(externalId, { $set: update }, { new: true });
                if (updated) {
                    console.log(`✅ Cart ${externalId} updated with status=${update.status}`);

                    // Email the customer about the print status change
                    notifyBookPrintStatus(updated, {
                        status: newStatus,
                        printJobId: printJobId || updated.luluPrintJobId,
                    }).catch(() => {});
                } else {
                    console.log(`⚠️ No Cart found with id ${externalId}`);
                }
            } catch (dbErr) {
                console.error("Database update error for webhook:", dbErr);
            }
        } else {
            console.log("No external_id found in webhook payload; skipping cart update.");
        }

        // ALWAYS respond with 200 OK immediately so provider doesn't retry
        console.log("✅ Responding with 200 OK to Lulu");
        console.log("printJobId:", printJobId, "newStatus:", newStatus, "externalId:", externalId);
        res.status(200).send('Webhook received');

    } catch (error) {
        console.error("❌ Webhook Error:", error);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
