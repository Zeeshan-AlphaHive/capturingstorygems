const EmailTemplate = require("../../models/emailTemplate.js");
const { normalizeInvitationHtml } = require("../../utils/invitationHtml.js");

const DEFAULT_KEY = "lead-newsletter";

const getEmailTemplate = async (req, res) => {
  try {
    const key = String(req.query.key || DEFAULT_KEY).trim() || DEFAULT_KEY;

    const doc = await EmailTemplate.findOne({ key }).lean();

    return res.status(200).json({
      message: "Email template fetched successfully",
      response: {
        data: {
          key,
          subject: doc?.subject || "",
          html: normalizeInvitationHtml(doc?.html || ""),
          updatedAt: doc?.updatedAt || null,
        },
      },
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

const upsertEmailTemplate = async (req, res) => {
  try {
    const key = String(req.body?.key || DEFAULT_KEY).trim() || DEFAULT_KEY;
    const subject = String(req.body?.subject || "");
    const html = normalizeInvitationHtml(String(req.body?.html || ""));

    const doc = await EmailTemplate.findOneAndUpdate(
      { key },
      { $set: { subject, html } },
      { new: true, upsert: true }
    ).lean();

    return res.status(200).json({
      message: "Email template saved successfully",
      response: {
        data: {
          key: doc.key,
          subject: doc.subject || "",
          html: normalizeInvitationHtml(doc.html || ""),
          updatedAt: doc.updatedAt || null,
        },
      },
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
  getEmailTemplate,
  upsertEmailTemplate,
};
