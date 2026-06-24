const { Schema, model, Types } = require("mongoose");

const termsAcceptanceSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    acceptedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = model("TermsAcceptance", termsAcceptanceSchema);
