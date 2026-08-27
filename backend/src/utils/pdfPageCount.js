const axios = require("axios");
const { PDFDocument } = require("pdf-lib");

/** Count pages in a remote PDF URL. Returns 0 on failure. */
async function getPdfPageCount(url) {
  if (!url || typeof url !== "string") return 0;

  try {
    const resp = await axios.get(url, { responseType: "arraybuffer", timeout: 60000 });
    const ab = resp.data;
    const buffer = Buffer.isBuffer(ab) ? ab : Buffer.from(ab);

    try {
      const doc = await PDFDocument.load(buffer);
      const count = doc.getPages().length;
      if (Number.isFinite(count) && count > 0) return count;
    } catch (e) {
      console.warn("pdf-lib failed to read pages:", e?.message || e);
    }

    try {
      const pdfParse = require("pdf-parse");
      const parsed = await pdfParse(buffer);
      const count = Number(parsed?.numpages || parsed?.numPages || 0);
      if (Number.isFinite(count) && count > 0) return count;
    } catch (e) {
      console.warn("pdf-parse failed to read pages:", e?.message || e);
    }

    console.warn("Page count detection returned 0 for URL:", url);
    return 0;
  } catch (err) {
    console.error("PDF page count error:", err?.message || err);
    return 0;
  }
}

module.exports = { getPdfPageCount };
