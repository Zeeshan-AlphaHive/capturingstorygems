const { sendMail } = require("../../utils/send-mail.js");
const EmailTemplate = require("../../models/emailTemplate.js");
const { formatHtmlForEmail } = require("../../utils/invitationHtml.js");

const DEFAULT_KEY = "lead-newsletter";

function isValidEmail(email) {
  const value = String(email || "").trim();
  // intentionally simple; avoids rejecting valid-but-rare addresses
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function interpolate(html, data) {
  let out = String(html || "");
  for (const [key, value] of Object.entries(data)) {
    const safeValue = String(value ?? "");
    out = out.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), safeValue);
  }
  return out;
}

// POST /user/newsletter/subscribe (public)
const subscribeNewsletter = async (req, res) => {
  try {
    const fullName = String(req.body?.fullName || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const key = String(req.body?.key || DEFAULT_KEY).trim() || DEFAULT_KEY;

    if (!fullName) {
      return res.status(400).json({
        message: "Full name is required",
        response: null,
        error: "Full name is required",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: "Valid email is required",
        response: null,
        error: "Valid email is required",
      });
    }

    const firstName = fullName.split(/\s+/).filter(Boolean)[0] || "";

    const templateDoc = await EmailTemplate.findOne({ key }).lean();
    const subject =
      String(templateDoc?.subject || "").trim() || "Your Story Starter Kit";
    const rawHtml =
      String(templateDoc?.html || "").trim() ||
      `<p>Hi {{firstName}},</p><p>Thanks for requesting the Story Starter Kit.</p>`;

    const html = interpolate(rawHtml, {
      fullName,
      firstName,
      email,
    });

    const formattedHtml = formatHtmlForEmail(html);
    const emailBody = `
<div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.5; color: #4b5563; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${formattedHtml}
</div>
    `.trim();

    await sendMail(emailBody, { subject, to_email: email });

    return res.status(200).json({
      message: "Subscribed successfully",
      response: { data: { email } },
      error: null,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      response: null,
      error: error.message,
    });
  }
};

module.exports = {
  subscribeNewsletter,
};
