const { Schema, model, Types } = require("mongoose");

const bookItemSchema = new Schema(
  {
    storyId: {
      type: Types.ObjectId,
      ref: "Story",
      required: true,
    },
    order: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const bookSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      default: "My Keepsake Book",
    },

    // v1 simple format
    format: {
      size: { type: String, default: "A4" }, // A4 | Letter | 6x9 later
    },
// In models/book.js
coverPdfUrl: { type: String },
    status: {
      type: String,
      enum: ["draft", "pdf_generated", "ordered"],
      default: "draft",
    },

    pdfUrl: { type: String, default: null },
    pdfGeneratedAt: { type: Date, default: null },
    pdfPublicId: { type: String, default: null },
    /** POD package id used when the interior PDF was last generated */
    pod_package_id: { type: String, default: null },
    /** Trim code (e.g. 0600X0900) extracted from pod_package_id at generation time */
    pdf_trim_code: { type: String, default: null },

    /** Last used title-page / cover options (persisted for regenerate UX) */
    authorName: { type: String, default: null },
    coverImageUrl: { type: String, default: null },
    audioUrl: { type: String, default: null },
    audioFileName: { type: String, default: null },

    items: [bookItemSchema],
  },
  { timestamps: true }
);

module.exports = model("Book", bookSchema);