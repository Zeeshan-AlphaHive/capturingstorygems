
const path = require("path");
const fs = require("fs");
const os = require("os");
const { PDFDocument, rgb, StandardFonts, degrees } = require("pdf-lib");
const {
  resolveTrimInches,
  extractTrimCode,
  getExpectedPageSizePoints,
} = require("../../utils/luluPodConfig.js");
const axios = require("axios");
// fontkit is required by pdf-lib to embed TTF/OTF fonts
let fontkit = null;
try {
  fontkit = require('@pdf-lib/fontkit');
} catch (e) {
  console.warn('Optional dependency @pdf-lib/fontkit not installed; install it to embed custom fonts (npm i @pdf-lib/fontkit)');
}

// Ensure fontkit is required and registered on a PDFDocument instance.
function ensureFontkitRegistered(pdfDoc) {
  if (!fontkit) {
    try {
      fontkit = require('@pdf-lib/fontkit');
    } catch (e) {
      try {
        fontkit = require('fontkit');
      } catch (e2) {
        console.warn('fontkit not available. Install @pdf-lib/fontkit or fontkit to embed custom fonts.');
        fontkit = null;
      }
    }
  }
  if (fontkit && pdfDoc && typeof pdfDoc.registerFontkit === 'function') {
    try {
      pdfDoc.registerFontkit(fontkit);
    } catch (e) {
      console.warn('Failed to register fontkit on PDFDocument:', e?.message || e);
    }
  }
}
const QRCode = require("qrcode");
const cloudinary = require("../../configs/cloudinary.util.js");
const luluClient = require("../../utils/luluClient.js");
const Book = require("../../models/book.js");
const Story = require("../../models/story.js");

// ── pdf-lib helpers ──────────────────────────────────────────────
const PTS_PER_INCH = 72; // 1 inch = 72 PDF points

/** Wrap a string into lines that fit within maxWidth (in points). */
function wrapText(text, font, fontSize, maxWidth) {
  const words = text.replace(/\r/g, "").split(/[ \t]+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (!w) continue;
    const test = cur.length === 0 ? w : cur + " " + w;
    const tw = font.widthOfTextAtSize(test, fontSize);
    if (tw > maxWidth && cur.length > 0) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur.length > 0) lines.push(cur);
  return lines;
}

/** Fetch a remote image and embed it in a PDFDocument. Returns { image, width, height } or null. */
async function embedRemoteImage(pdfDoc, url) {
  try {
    const resp = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
    const buf = Buffer.from(resp.data);
    const ct = (resp.headers["content-type"] || "").toLowerCase();
    let image;
    if (ct.includes("png")) {
      image = await pdfDoc.embedPng(buf);
    } else {
      // default to JPEG for jpg/jpeg/webp/other
      image = await pdfDoc.embedJpg(buf);
    }
    return { image, width: image.width, height: image.height };
  } catch (e) {
    console.warn("Failed to embed image:", url, e.message);
    return null;
  }
}

/** Draw centered text on a page at a given y. Returns the y below the drawn text. */
function drawCentered(page, text, font, fontSize, y, color) {
  const tw = font.widthOfTextAtSize(text, fontSize);
  const pw = page.getWidth();
  page.drawText(text, { x: (pw - tw) / 2, y, size: fontSize, font, color: color || rgb(0.07, 0.07, 0.07) });
  return y - fontSize * 1.4;
}

/** Draw a page number centered at the bottom of a page. */
function drawPageNumber(page, num, font) {
  const text = String(num);
  const size = 12; // match CSS: .page-number { font-size: 12px }
  const tw = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (page.getWidth() - tw) / 2, y: 30, size, font, color: rgb(0.4, 0.4, 0.4) });
}

/**
 * Embed a font into a PDFDocument from a remote URL (env var). Falls back to a standard font on failure.
 * Accepts a PDFDocument instance, a URL string, and a fallback StandardFonts constant.
 */
async function embedFontFromUrl(pdfDoc, url, fallbackStandardFont) {
  if (!url) {
    try {
      return await pdfDoc.embedFont(fallbackStandardFont);
    } catch (e) {
      return await pdfDoc.embedFont(StandardFonts.Helvetica);
    }
  }
  try {
    const resp = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
    const buf = resp.data;
    try {
      // register fontkit for this PDFDocument if available
      if (fontkit && typeof pdfDoc.registerFontkit === 'function') {
        try { pdfDoc.registerFontkit(fontkit); } catch (re) { /* ignore */ }
      }
      return await pdfDoc.embedFont(buf, { features: { liga: false } });
    } catch (e) {
      console.warn("embedFontFromUrl: embedding remote font failed, falling back to standard font:", e?.message || e);
      return await pdfDoc.embedFont(fallbackStandardFont);
    }
  } catch (e) {
    console.warn("embedFontFromUrl: failed to download font from URL, falling back to standard font:", e?.message || e);
    return await pdfDoc.embedFont(fallbackStandardFont);
  }
}

// POST /user/book  -> create draft book
const createBook = async (req, res) => {
  try {
    const { id: userId } = req.decoded;
    const { title, format } = req.body || {};

    const book = await Book.create({
      userId,
      title: title || "My Keepsake Book",
      format: format || { size: "A4" },
      status: "draft",
      items: [],
    });

    return res.status(201).json({
      message: "Book draft created",
      response: { data: book },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal server error",
      response: null,
      error: err.message,
    });
  }
};


const getMyBooks = async (req, res) => {
  try {
    const { id: userId } = req.decoded;
    const books = await Book.find({ userId })
      .select("title status format items pdfUrl coverPdfUrl pod_package_id pdf_trim_code createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean();

    // add itemsCount for convenience
    const formatted = (books || []).map((b) => ({
      ...b,
      itemsCount: b.items?.length || 0,
    }));

    return res.status(200).json({
      message: "Books fetched successfully",
      response: { data: formatted },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal server error",
      response: null,
      error: err.message,
    });
  }
};

// GET /user/book/:bookId  -> get book with stories
const getBook = async (req, res) => {
  try {
    const { id: userId } = req.decoded;
    const { bookId } = req.params;

    const book = await Book.findOne({ _id: bookId, userId })
      .populate("items.storyId", "story_title genre read_time enhanced_story heroImageUrl")
      .lean();

    if (!book) {
      return res.status(404).json({
        message: "Book not found",
        response: null,
        error: "Book not found",
      });
    }

    // sort items by order
    book.items = (book.items || []).sort((a, b) => a.order - b.order);

    return res.status(200).json({
      message: "Book fetched successfully",
      response: { data: book },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal server error",
      response: null,
      error: err.message,
    });
  }
};

// POST /user/book/:bookId/items  body: { storyId }
const addStoryToBook = async (req, res) => {
  try {
    const { id: userId } = req.decoded;
    const { bookId } = req.params;
    const { storyId } = req.body || {};

    if (!storyId) return res.status(400).json({ message: "storyId is required", error: "storyId is required" });

    const book = await Book.findOne({ _id: bookId, userId });
    if (!book) return res.status(404).json({ message: "Book not found", error: "Book not found" });

    const story = await Story.findOne({ _id: storyId, userId }).select("_id");
    if (!story) return res.status(404).json({ message: "Story not found", error: "Story not found" });

    const alreadyExists = book.items.some((it) => it.storyId.toString() === storyId.toString());
    if (alreadyExists) return res.status(409).json({ message: "Story already added", error: "Duplicate story" });

    const nextOrder = book.items.length ? Math.max(...book.items.map((i) => i.order)) + 1 : 1;
    book.items.push({ storyId, order: nextOrder });
    await book.save();

    return res.status(200).json({ message: "Story added to book", error: null });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};



// DELETE /user/book/:bookId/items/:storyId
const removeStoryFromBook = async (req, res) => {
  try {
    const { id: userId } = req.decoded;
    const { bookId, storyId } = req.params;

    const book = await Book.findOne({ _id: bookId, userId });
    if (!book) return res.status(404).json({ message: "Book not found", error: "Book not found" });

    const before = book.items.length;
    book.items = book.items.filter((it) => it.storyId.toString() !== storyId.toString());

    if (book.items.length === before) return res.status(404).json({ message: "Story not found in book", error: "Story not found" });

    // re-order sequentially
    book.items = book.items.sort((a, b) => a.order - b.order).map((it, idx) => ({ storyId: it.storyId, order: idx + 1 }));
    await book.save();

    return res.status(200).json({ message: "Story removed from book", error: null });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};



// PUT /user/book/:bookId/reorder  body: { storyIds: ["...","..."] }
const reorderBookItems = async (req, res) => {
  try {
    const { id: userId } = req.decoded;
    const { bookId } = req.params;
    const { storyIds } = req.body || {};

    if (!Array.isArray(storyIds) || storyIds.length === 0) return res.status(400).json({ message: "storyIds array required", error: "Missing IDs" });

    const book = await Book.findOne({ _id: bookId, userId });
    if (!book) return res.status(404).json({ message: "Book not found", error: "Book not found" });

    const existingIds = book.items.map((it) => it.storyId.toString()).sort();
    const incomingIds = storyIds.map(String).sort();

    if (existingIds.join(",") !== incomingIds.join(",")) {
      return res.status(400).json({ message: "storyIds must match book contents", error: "Invalid reorder" });
    }

    book.items = storyIds.map((sid, idx) => ({ storyId: sid, order: idx + 1 }));
    await book.save();

    return res.status(200).json({ message: "Book reordered", error: null });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};

// DELETE /user/book/:bookId  -> delete a user's book
const deleteBook = async (req, res) => {
  try {
    const { id: userId } = req.decoded;
    const { bookId } = req.params;

    const book = await Book.findOne({ _id: bookId, userId });
    if (!book) return res.status(404).json({ message: "Book not found", error: "Book not found" });

    await Book.deleteOne({ _id: bookId, userId });

    return res.status(200).json({ message: "Book deleted", error: null });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};


// =================================================================
//  GENERATE PDF FUNCTION (Interior + Cover) — uses pdf-lib (no browser)
// =================================================================
const generateBookPdf = async (req, res) => {
  try {
    const { id: userId } = req.decoded;
    const { bookId, podId } = req.params;
    const podFromBody = (req.body && (req.body.pod_package_id || req.body.podPackageId || req.body.podId)) || undefined;
    const reqCoverImage = (req.body && req.body.cover_image) || undefined;
    const reqAuthorName = (req.body && req.body.author_name) || undefined;
    const reqAudioFile = (req.body && req.body.audio_file) || undefined;
    const book = await Book.findOne({ _id: bookId, userId }).populate(
      "items.storyId",
      "story_title genre read_time enhanced_story heroImageUrl heroImageAlignment"
    );

    if (!book) return res.status(404).json({ message: "Book not found", error: "Book not found" });

    const podPackage =
      podFromBody ||
      req.body?.pod_package_id ||
      req.body?.podPackageId ||
      req.body?.podId ||
      book.pod_package_id ||
      undefined;

    if (!podPackage || typeof podPackage !== "string") {
      return res.status(400).json({
        message:
          "pod_package_id is required to generate a print-ready PDF. Select book size and binding in the builder, then generate again.",
        error: "Missing pod_package_id",
      });
    }

    const trimResolved = resolveTrimInches(podPackage);
    if (!trimResolved) {
      return res.status(400).json({
        message: `Unrecognized trim size in pod_package_id "${podPackage}".`,
        error: "Invalid pod_package_id",
      });
    }

    const sortedItems = (book.items || [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((it) => it.storyId)
      .filter(Boolean);

    // Ensure uploads directory exists
    // const booksDir = path.join(process.cwd(), "uploads", "books");
    // if (!fs.existsSync(booksDir)) fs.mkdirSync(booksDir, { recursive: true });
    const booksDir = path.join(os.tmpdir(), "capturingstorygems-books");
    if (!fs.existsSync(booksDir)) fs.mkdirSync(booksDir, { recursive: true });

    // ── Interior page constants (in PDF points, 72pt = 1in) ──
    // Compute page size from selected POD package / trim size when available.
    // Pod package ids typically start with a trim code like "0744X0968" (7.44 x 9.68 inches).
    // let trimWidthIn = 6.25; // default width (inches)
    // let trimHeightIn = 9.25; // default height (inches)

    // const podPackage = req.body.pod_package_id;

    // if (podPackage && typeof podPackage === 'string') {
    //   const m = podPackage.match(/(\d{4}X\d{4})/);
    //   const sizeCode = m ? m[1] : podPackage;
    //   const SIZE_MAP = {
    //     '0600X0900': [6.00, 9.00],
    //     '0700X1000': [7.00, 10.00],
    //     '0744X0968': [7.44, 9.68],
    //     '0614X0921': [6.14, 9.21],
    //   };
    //   if (SIZE_MAP[sizeCode]) {
    //     [trimWidthIn, trimHeightIn] = SIZE_MAP[sizeCode];
    //   } else {
    //     // fallback: parse common "WxH" numeric formats like "7.44x9.68"
    //     const parts = String(sizeCode).split(/[xX]/).map((p) => parseFloat(p));
    //     if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    //       trimWidthIn = parts[0];
    //       trimHeightIn = parts[1];
    //     }
    //   }
    // }

    // const PAGE_W = trimWidthIn * PTS_PER_INCH;
    // const PAGE_H = trimHeightIn * PTS_PER_INCH;
    // // const PAGE_W = trimWidthIn * PTS_PER_INCH;
    // // const PAGE_H = trimHeightIn * PTS_PER_INCH;
    // const MARGIN = 0.75 * PTS_PER_INCH;
    // const CONTENT_W = PAGE_W - MARGIN * 2;
    // const CONTENT_H = PAGE_H - MARGIN * 2;


    // ── Interior page constants (in PDF points, 72pt = 1in) ──
    const PTS_PER_INCH = 72;
    let trimWidthIn = trimResolved.widthIn;
    let trimHeightIn = trimResolved.heightIn;

    // =========================================================
    // 🚀 LULU BLEED FIX
    // =========================================================
    // Full Color (FC) packages expect the PDF to include "Bleed" dimensions.
    // Lulu requires adding 0.125" to the Top, Bottom, and Outside edges.
    const needsBleed = podPackage.includes("FC");
    // Width increases by 0.125". Height increases by 0.25" (top + bottom).
    const finalWidthIn = needsBleed ? trimWidthIn + 0.125 : trimWidthIn;
    const finalHeightIn = needsBleed ? trimHeightIn + 0.25 : trimHeightIn;

    const PAGE_W = finalWidthIn * PTS_PER_INCH;
    const PAGE_H = finalHeightIn * PTS_PER_INCH;
    console.log('Final PDF page size (points):', PAGE_W, 'x', PAGE_H);

    // We increase the margin slightly if bleed is added. 
    // This ensures your text stays in the exact same physical spot on the printed page.
    const baseMarginIn = 0.75;
    const finalMarginIn = needsBleed ? baseMarginIn + 0.125 : baseMarginIn;
    const MARGIN = finalMarginIn * PTS_PER_INCH;

    const CONTENT_W = PAGE_W - MARGIN * 2;
    const CONTENT_H = PAGE_H - MARGIN * 2;
    // =========================================================
    // Styles mapped from CSS snippet (pixels -> PDF points roughly 1:1)
    const BODY_SIZE = 10; // .story-body { font-size: 14px }
    const BODY_LEADING = Math.round(BODY_SIZE * 1.5);  // 1.5 line-height
    const H1_SIZE = 32; // .title-page { font-size: 32px }
    const H2_SIZE = 22; // h2 { font-size: 22px }
    const TOC_TITLE_SIZE = 18; // .toc-title { font-size: 24px }
    const TOC_ENTRY_SIZE = 12; // .toc-list { font-size: 14px }
    const SUBTITLE_SIZE = 12;

    // Try to fetch font files (TTF/OTF preferred). Falls back to StandardFonts when unavailable.
    const fetchFontBuffer = async (url) => {
      if (!url || typeof url !== 'string') return null;
      try {
        const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
        return Buffer.from(resp.data);
      } catch (e) {
        console.warn('Failed to download font:', url, e?.message || e);
        return null;
      }
    };

    const [serifBuf, serifBoldBuf, sansBuf, sansBoldBuf] = await Promise.all([
      fetchFontBuffer(process.env.SERIF_FONT_REGULAR_URL),
      fetchFontBuffer(process.env.SERIF_FONT_BOLD_URL),
      fetchFontBuffer(process.env.SANS_FONT_REGULAR_URL),
      fetchFontBuffer(process.env.SANS_FONT_BOLD_URL),
    ]);

    // ── Create the interior PDF document ──
    const interiorPdf = await PDFDocument.create();
    // attempt to register fontkit before embedding custom font buffers
    ensureFontkitRegistered(interiorPdf);
    let serifFont;
    let serifBold;
    try {
      serifFont = serifBuf ? await interiorPdf.embedFont(serifBuf, { features: { liga: false } }) : await interiorPdf.embedFont(StandardFonts.TimesRoman);
    } catch (e) {
      console.warn('Failed to embed serif regular font, falling back to StandardFonts.TimesRoman:', e?.message || e);
      serifFont = await interiorPdf.embedFont(StandardFonts.TimesRoman);
    }
    try {
      serifBold = serifBoldBuf ? await interiorPdf.embedFont(serifBoldBuf, { features: { liga: false } }) : await interiorPdf.embedFont(StandardFonts.TimesRomanBold);
    } catch (e) {
      console.warn('Failed to embed serif bold font, falling back to StandardFonts.TimesRomanBold:', e?.message || e);
      serifBold = await interiorPdf.embedFont(StandardFonts.TimesRomanBold);
    }
    const bodyColor = rgb(0.07, 0.07, 0.07);
    const grayColor = rgb(0.4, 0.4, 0.4);

    // ── Helper: draw wrapped body text, adding pages as needed. Returns { pageNum, y } ──
    const drawBodyText = (rawText, startY, pageNum, existingPage) => {
      const lines = wrapText(rawText, serifFont, BODY_SIZE, CONTENT_W);
      let y = startY;
      let page = existingPage;
      for (const line of lines) {
        if (y - BODY_LEADING < MARGIN + 20) {
          // need a new page
          drawPageNumber(page, pageNum, serifFont);
          pageNum++;
          page = interiorPdf.addPage([PAGE_W, PAGE_H]);
          y = PAGE_H - MARGIN;
        }
        page.drawText(line, { x: MARGIN, y, size: BODY_SIZE, font: serifFont, color: bodyColor });
        y -= BODY_LEADING;
      }
      return { page, y, pageNum };
    };

    // ── TITLE PAGE (page 1) ──
    let pageNum = 1;
    const titlePage = interiorPdf.addPage([PAGE_W, PAGE_H]);
    const titleY = PAGE_H / 2 + H1_SIZE;

    // Draw title with wrapping and adaptive sizing to avoid overflow.
    // Order: optional image at top -> title -> author (or fallback).
    const rawTitle2 = String(book.title || "My Keepsake Book");
    let titleSize = H1_SIZE;
    const minTitleSize = 18;
    const maxLines = 3;
    let titleLines = wrapText(rawTitle2, serifBold, titleSize, CONTENT_W * 0.9);
    while (titleLines.length > maxLines && titleSize > minTitleSize) {
      titleSize -= 2;
      titleLines = wrapText(rawTitle2, serifBold, titleSize, CONTENT_W * 0.9);
    }

    const lineHeight = Math.round(titleSize * 1.15);
    const totalTitleHeight = titleLines.length * lineHeight;

    // Try to draw image first (top of page). If present, place image near top and then draw title below it.
    let currentY = PAGE_H - MARGIN; // starting y from top inside margin
    const rawAuthor = reqAuthorName || book.authorName || "";
    if (reqCoverImage && typeof reqCoverImage === 'string' && reqCoverImage.trim().length > 0) {
      try {
        const emb = await embedRemoteImage(interiorPdf, reqCoverImage);
        if (emb && emb.image) {
          const maxW = CONTENT_W * 0.9;
          const maxH = PAGE_H * 0.28;
          let drawW = emb.width;
          let drawH = emb.height;
          const scale = Math.min(maxW / drawW, maxH / drawH, 1);
          drawW = drawW * scale;
          drawH = drawH * scale;
          const x = (PAGE_W - drawW) / 2;
          const y = currentY - drawH; // place image below top margin (y is image bottom)
          titlePage.drawImage(emb.image, { x, y, width: drawW, height: drawH });
          // Compute a safe baseline for the first title line so the title does not overlap the image.
          // pdf-lib interprets the `y` passed to drawText as the bottom of the text box, so
          // ensure the top of the first line (y + titleSize) sits at least `gap` points below image bottom.
          const gapAfterImage = 24; // vertical gap between image bottom and title top
          currentY = y - gapAfterImage - titleSize; // baseline for first title line
        }
      } catch (e) {
        console.warn('Failed to embed title image:', e?.message || e);
        // fallback: center title vertically
        currentY = (PAGE_H / 2) + Math.floor(totalTitleHeight / 2);
      }
    } else {
      // no image: center title vertically around titleY
      currentY = titleY + Math.floor(totalTitleHeight / 2);
    }

    // Draw title lines starting from currentY downwards
    for (let i = 0; i < titleLines.length; i++) {
      const y = currentY - i * lineHeight;
      drawCentered(titlePage, titleLines[i], serifBold, titleSize, y, bodyColor);
    }

    // position author below title
    const afterTitleY = currentY - titleLines.length * lineHeight - 12;
    const authorText = rawAuthor && String(rawAuthor).trim() !== "" ? (String(rawAuthor).trim().toLowerCase().startsWith('by ') ? String(rawAuthor).trim() : `By ${String(rawAuthor).trim()}`) : "Generated by Capturing Story Gems";
    drawCentered(titlePage, authorText, serifFont, SUBTITLE_SIZE, afterTitleY - SUBTITLE_SIZE, grayColor);
    drawPageNumber(titlePage, pageNum, serifFont);
    pageNum++;

    // ── Pre-compute story chunks for TOC page numbers ──
    const storyChunks = [];
    for (const s of sortedItems) {
      const text = String(s.enhanced_story || "").replace(/\r/g, "");
      // Split by paragraphs first, then wrap each paragraph
      const paragraphs = text.split(/\n{2,}/);
      const allLines = [];
      for (const para of paragraphs) {
        const trimmed = para.replace(/\n/g, " ").trim();
        if (!trimmed) continue;
        const wrapped = wrapText(trimmed, serifFont, BODY_SIZE, CONTENT_W);
        allLines.push(...wrapped, ""); // empty string = paragraph break
      }
      storyChunks.push({ story: s, lines: allLines });
    }

    // Estimate how many content lines fit on one page
    const LINES_PER_PAGE = Math.floor((CONTENT_H - 30) / BODY_LEADING); // ~33
    // First page of a story has title + optional image so fewer lines
    const FIRST_PAGE_HEADER = H2_SIZE * 1.6 + 8; // title space
    const FIRST_PAGE_LINES = Math.floor((CONTENT_H - FIRST_PAGE_HEADER - 30) / BODY_LEADING);

    // Count pages each story occupies
    const storyPageCounts = storyChunks.map((sc) => {
      const totalLines = sc.lines.length;
      if (totalLines <= FIRST_PAGE_LINES) return 1;
      return 1 + Math.ceil((totalLines - FIRST_PAGE_LINES) / LINES_PER_PAGE);
    });

    // TOC entries
    const TOC_LINES_PER_PAGE = 28;
    const tocEntryCount = storyChunks.length;
    const tocPageCount = Math.max(1, Math.ceil(tocEntryCount / TOC_LINES_PER_PAGE));
    // Reserve an extra blank page after the TOC
    const contentStartPage = pageNum + tocPageCount + 1;

    const tocData = [];
    let runningPage = contentStartPage;
    for (let i = 0; i < storyChunks.length; i++) {
      tocData.push({ title: storyChunks[i].story.story_title || "Untitled", startPage: runningPage });
      runningPage += storyPageCounts[i];
    }

    // include the extra blank TOC separator page in the total
    const totalPagesWithoutBlanks = 1 + tocPageCount + 1 + storyPageCounts.reduce((a, b) => a + b, 0);

    // ── TOC PAGES ──
    for (let tp = 0; tp < tocPageCount; tp++) {
      const tocPage = interiorPdf.addPage([PAGE_W, PAGE_H]);
      let ty = PAGE_H - MARGIN;
      // Title
      tocPage.drawText("Table of Contents", { x: MARGIN, y: ty, size: TOC_TITLE_SIZE, font: serifBold, color: bodyColor });
      ty -= TOC_TITLE_SIZE * 2;

      const sliceStart = tp * TOC_LINES_PER_PAGE;
      const sliceEnd = Math.min(sliceStart + TOC_LINES_PER_PAGE, tocData.length);
      for (let i = sliceStart; i < sliceEnd; i++) {
        const entry = tocData[i];
        const titleText = entry.title;
        const pageText = String(entry.startPage);
        tocPage.drawText(titleText, { x: MARGIN, y: ty, size: TOC_ENTRY_SIZE, font: serifFont, color: bodyColor });
        const ptw = serifFont.widthOfTextAtSize(pageText, TOC_ENTRY_SIZE);
        tocPage.drawText(pageText, { x: PAGE_W - MARGIN - ptw, y: ty, size: TOC_ENTRY_SIZE, font: serifFont, color: bodyColor });
        // dotted leader
        const dotWidth = serifFont.widthOfTextAtSize(".", TOC_ENTRY_SIZE);
        const titleWidth = serifFont.widthOfTextAtSize(titleText, TOC_ENTRY_SIZE);
        let dotX = MARGIN + titleWidth + 4;
        while (dotX + dotWidth < PAGE_W - MARGIN - ptw - 4) {
          tocPage.drawText(".", { x: dotX, y: ty, size: TOC_ENTRY_SIZE, font: serifFont, color: grayColor });
          dotX += dotWidth + 2;
        }
        ty -= TOC_ENTRY_SIZE * 1.8;
      }
      drawPageNumber(tocPage, pageNum, serifFont);
      pageNum++;
    }

    // add an extra blank page after the TOC (acts as a visual separator)
    const blankAfterToc = interiorPdf.addPage([PAGE_W, PAGE_H]);
    // (no content) just draw the page number
    drawPageNumber(blankAfterToc, pageNum, serifFont);
    pageNum++;

    // ── STORY PAGES ──
    for (const sc of storyChunks) {
      const s = sc.story;
      let page = interiorPdf.addPage([PAGE_W, PAGE_H]);
      let y = PAGE_H - MARGIN;

      // Story title
      const titleLines = wrapText(s.story_title || "Untitled", serifBold, H2_SIZE, CONTENT_W);
      for (const tl of titleLines) {
        page.drawText(tl, { x: MARGIN, y, size: H2_SIZE, font: serifBold, color: bodyColor });
        y -= H2_SIZE * 1.4;
      }
      y -= 6; // small gap after title

      // Hero image handling with alignment (left, center, right)
      let imgData = null;
      let imgW = 0;
      let imgH = 0;
      let imgX = MARGIN;
      let imgY = 0;
      let imgBottomY = 0; // y position where image ends (for text wrapping)
      const alignment = s.heroImageAlignment || "center";
      const IMG_TEXT_GAP = 12; // gap between image and wrapped text

      if (s.heroImageUrl) {
        try {
          imgData = await embedRemoteImage(interiorPdf, s.heroImageUrl);
          if (imgData) {
            // For left/right alignment, image takes ~40% of content width
            // For center, image stretches to full width
            if (alignment === "center") {
              // Stretch image to full content width
              imgW = CONTENT_W;
              imgH = (imgData.height / imgData.width) * imgW;
              // Cap height if too tall
              const maxImgH = 4 * PTS_PER_INCH;
              if (imgH > maxImgH) {
                imgH = maxImgH;
              }
              imgX = MARGIN;
            } else {
              // Left or right: use ~40% width, preserve aspect ratio
              const maxImgW = CONTENT_W * 0.4;
              const maxImgH = 4 * PTS_PER_INCH;
              const scale = Math.min(maxImgW / imgData.width, maxImgH / imgData.height, 1);
              imgW = imgData.width * scale;
              imgH = imgData.height * scale;

              if (alignment === "left") {
                imgX = MARGIN;
              } else {
                imgX = PAGE_W - MARGIN - imgW;
              }
            }

            imgY = y - imgH; // pdf-lib y is bottom of image
            imgBottomY = imgY; // where the image bottom is
            page.drawImage(imgData.image, { x: imgX, y: imgY, width: imgW, height: imgH });
          }
        } catch (imgErr) {
          console.warn("Failed to embed hero image for story:", s.story_title, imgErr.message);
          imgData = null;
        }
      }

      // Body text with wrapping around image for left/right alignment
      if (imgData && (alignment === "left" || alignment === "right")) {
        // Text wraps beside the image until we pass the image bottom
        const textWidthBesideImg = CONTENT_W - imgW - IMG_TEXT_GAP;
        const textXBesideImg = alignment === "left" ? (MARGIN + imgW + IMG_TEXT_GAP) : MARGIN;
        const textXFull = MARGIN;

        // Track the page where the image exists - only wrap text beside image on that page
        const imagePageRef = page;

        // Process text word by word, switching width when we pass the image
        const storyText = String(s.enhanced_story || "").replace(/\r/g, "");
        const paragraphs = storyText.split(/\n{2,}/);

        for (const para of paragraphs) {
          const trimmed = para.replace(/\n/g, " ").trim();
          if (!trimmed) continue;

          const words = trimmed.split(/\s+/);
          let currentLine = "";
          // Only wrap beside image if we're still on the image page AND above the image bottom
          let isBesideImage = (page === imagePageRef) && (y > imgBottomY);
          let currentWidth = isBesideImage ? textWidthBesideImg : CONTENT_W;
          let currentX = isBesideImage ? textXBesideImg : textXFull;

          for (const word of words) {
            const testLine = currentLine.length === 0 ? word : currentLine + " " + word;
            const testWidth = serifFont.widthOfTextAtSize(testLine, BODY_SIZE);

            if (testWidth > currentWidth && currentLine.length > 0) {
              // Output current line
              if (y - BODY_LEADING < MARGIN + 20) {
                drawPageNumber(page, pageNum, serifFont);
                pageNum++;
                page = interiorPdf.addPage([PAGE_W, PAGE_H]);
                y = PAGE_H - MARGIN;
                // New page has no image - always use full width
                isBesideImage = false;
                currentWidth = CONTENT_W;
                currentX = textXFull;
              }
              page.drawText(currentLine, { x: currentX, y, size: BODY_SIZE, font: serifFont, color: bodyColor });
              y -= BODY_LEADING;

              // Check if we've passed the image after this line (only matters on image page)
              isBesideImage = (page === imagePageRef) && (y > imgBottomY);
              currentWidth = isBesideImage ? textWidthBesideImg : CONTENT_W;
              currentX = isBesideImage ? textXBesideImg : textXFull;

              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }

          // Output remaining text in paragraph
          if (currentLine.length > 0) {
            if (y - BODY_LEADING < MARGIN + 20) {
              drawPageNumber(page, pageNum, serifFont);
              pageNum++;
              page = interiorPdf.addPage([PAGE_W, PAGE_H]);
              y = PAGE_H - MARGIN;
              // New page has no image - always use full width
              isBesideImage = false;
              currentWidth = CONTENT_W;
              currentX = textXFull;
            }
            page.drawText(currentLine, { x: currentX, y, size: BODY_SIZE, font: serifFont, color: bodyColor });
            y -= BODY_LEADING;

            // Update position tracking after paragraph (only matters on image page)
            isBesideImage = (page === imagePageRef) && (y > imgBottomY);
            currentWidth = isBesideImage ? textWidthBesideImg : CONTENT_W;
            currentX = isBesideImage ? textXBesideImg : textXFull;
          }

          // Paragraph break
          y -= BODY_LEADING * 0.6;
        }
      } else {
        // Center alignment or no image - text flows below image
        if (imgData) {
          y = imgBottomY - BODY_LEADING; // Start text below the centered image
        }

        // Body text (line by line, adding pages as needed)
        for (const line of sc.lines) {
          if (line === "") {
            // paragraph break
            y -= BODY_LEADING * 0.6;
            continue;
          }
          if (y - BODY_LEADING < MARGIN + 20) {
            drawPageNumber(page, pageNum, serifFont);
            pageNum++;
            page = interiorPdf.addPage([PAGE_W, PAGE_H]);
            y = PAGE_H - MARGIN;
          }
          page.drawText(line, { x: MARGIN, y, size: BODY_SIZE, font: serifFont, color: bodyColor });
          y -= BODY_LEADING;
        }
      }
      drawPageNumber(page, pageNum, serifFont);
      pageNum++;
    }

    // ── AUDIO QR CODE PAGE (optional) ──
    let audioUrl = undefined;
    if (reqAudioFile && typeof reqAudioFile === 'string' && reqAudioFile.trim().length > 0) {
      try {
        // Upload audio to Cloudinary (resource_type "video" handles audio too)
        const audioUploadRes = await cloudinary.uploader.upload(reqAudioFile, {
          resource_type: "video",
          folder: "book_audio",
          public_id: `audio-${book._id}-${Date.now()}`,
        });
        audioUrl = audioUploadRes.secure_url;
        console.log('Audio uploaded to Cloudinary:', audioUrl);

        // Generate QR code as PNG buffer
        const qrPngBuffer = await QRCode.toBuffer(audioUrl, {
          type: 'png',
          width: 300,
          margin: 2,
          color: { dark: '#1a1a1a', light: '#ffffff' },
        });

        // Embed QR code in PDF
        const qrImage = await interiorPdf.embedPng(qrPngBuffer);
        const qrPage = interiorPdf.addPage([PAGE_W, PAGE_H]);

        // Draw heading
        const qrHeading = "Scan to Listen";
        const qrHeadingSize = 24;
        const qrHeadingW = serifBold.widthOfTextAtSize(qrHeading, qrHeadingSize);
        qrPage.drawText(qrHeading, {
          x: (PAGE_W - qrHeadingW) / 2,
          y: PAGE_H - MARGIN - qrHeadingSize,
          size: qrHeadingSize,
          font: serifBold,
          color: bodyColor,
        });

        // Draw subtitle
        const qrSubtitle = "Scan this QR code with your phone to hear the audio";
        const qrSubSize = 11;
        const qrSubW = serifFont.widthOfTextAtSize(qrSubtitle, qrSubSize);
        qrPage.drawText(qrSubtitle, {
          x: (PAGE_W - qrSubW) / 2,
          y: PAGE_H - MARGIN - qrHeadingSize - 28,
          size: qrSubSize,
          font: serifFont,
          color: grayColor,
        });

        // Draw QR code centered
        const qrDrawSize = Math.min(250, CONTENT_W * 0.5);
        const qrX = (PAGE_W - qrDrawSize) / 2;
        const qrY = (PAGE_H - qrDrawSize) / 2 - 10;
        qrPage.drawImage(qrImage, { x: qrX, y: qrY, width: qrDrawSize, height: qrDrawSize });

        drawPageNumber(qrPage, pageNum, serifFont);
        pageNum++;
      } catch (audioErr) {
        console.warn('Failed to process audio file for QR code:', audioErr?.message || audioErr);
        // Continue without QR — don't fail the entire PDF generation
      }
    }

    // ── Ensure an even number of interior pages ──
    // If odd, append a blank page so printed books have correct spreads.
    try {
      const currentPageCount = interiorPdf.getPageCount();
      if (currentPageCount % 2 === 1) {
        const blankPage = interiorPdf.addPage([PAGE_W, PAGE_H]);
        // draw page number on the blank page to keep numbering consistent
        drawPageNumber(blankPage, pageNum, serifFont);
        pageNum++;
      }
    } catch (e) {
      console.warn('Failed to ensure even page count:', e?.message || e);
    }

    // ── Serialize interior PDF to file ──
    const interiorBytes = await interiorPdf.save();
    const interiorPath = path.join(booksDir, `interior-${book._id}.pdf`);
    fs.writeFileSync(interiorPath, interiorBytes);

    // =================================================
    //  COVER PDF (single-page spread) — pdf-lib
    // =================================================
    let coverWidthIn = 12.325;
    let coverHeightIn = 9.25;
    const reqCoverWidth = (req.body && req.body.cover_width) || undefined;
    const reqCoverHeight = (req.body && req.body.cover_height) || undefined;
    const interiorPageCount = totalPagesWithoutBlanks;

    if (reqCoverWidth && reqCoverHeight) {
      coverWidthIn = parseFloat(reqCoverWidth) || coverWidthIn;
      coverHeightIn = parseFloat(reqCoverHeight) || coverHeightIn;
      console.log(`Using custom cover dimensions: ${coverWidthIn}in x ${coverHeightIn}in`);
    } else {
      console.log(`Fetching cover dimensions from Lulu for interior_page_count: ${interiorPageCount}`);
      try {
        const dims = await luluClient.getCoverDimensions({
          pod_package_id: podPackage,
          interior_page_count: interiorPageCount,
          unit: "inch",
        });
        if (dims && dims.width && dims.height) {
          const rw = parseFloat(dims.width); const rh = parseFloat(dims.height);
          if (rw > 0) coverWidthIn = rw;
          if (rh > 0) coverHeightIn = rh;
        }
      } catch (e) {
        console.warn('Failed to fetch cover dimensions, using defaults', e.message);
      }
    }

    console.log(`Cover dimensions: ${coverWidthIn}in x ${coverHeightIn}in`);

    // Upload cover image to Cloudinary if provided
    let coverImageUrl = undefined;
    if (typeof reqCoverImage === 'string' && reqCoverImage.trim().length > 0) {
      try {
        const uploadRes = await cloudinary.uploader.upload(reqCoverImage, { folder: "book_covers" });
        coverImageUrl = uploadRes.secure_url;
      } catch (e) {
        console.warn('Cover image upload failed, continuing without image', e.message);
      }
    }

    const coverPdf = await PDFDocument.create();
    // attempt to register fontkit before embedding custom font buffers
    ensureFontkitRegistered(coverPdf);
    let sansFont;
    let sansBold;
    try {
      sansFont = sansBuf ? await coverPdf.embedFont(sansBuf, { features: { liga: false } }) : await embedFontFromUrl(coverPdf, process.env.SANS_FONT_REGULAR_URL, StandardFonts.Helvetica);
    } catch (e) {
      console.warn('Failed to embed sans regular font, falling back to StandardFonts.Helvetica:', e?.message || e);
      sansFont = await coverPdf.embedFont(StandardFonts.Helvetica);
    }
    try {
      sansBold = sansBoldBuf ? await coverPdf.embedFont(sansBoldBuf, { features: { liga: false } }) : await embedFontFromUrl(coverPdf, process.env.SANS_FONT_BOLD_URL, StandardFonts.HelveticaBold);
    } catch (e) {
      console.warn('Failed to embed sans bold font, falling back to StandardFonts.HelveticaBold:', e?.message || e);
      sansBold = await coverPdf.embedFont(StandardFonts.HelveticaBold);
    }
    const cwPt = coverWidthIn * PTS_PER_INCH;
    const chPt = coverHeightIn * PTS_PER_INCH;
    const spineW = 0.5 * PTS_PER_INCH; // 36pt
    const panelW = (cwPt - spineW) / 2;
    const coverPage = coverPdf.addPage([cwPt, chPt]);

    // Back panel background (#1a1a1a)
    coverPage.drawRectangle({ x: 0, y: 0, width: panelW, height: chPt, color: rgb(0.1, 0.1, 0.1) });
    // Spine background
    coverPage.drawRectangle({ x: panelW, y: 0, width: spineW, height: chPt, color: rgb(0.1, 0.1, 0.1) });
    // Front panel background (#2c3e50)
    coverPage.drawRectangle({ x: panelW + spineW, y: 0, width: panelW, height: chPt, color: rgb(0.173, 0.243, 0.314) });

    // Back panel text
    const backText = "Printed with love by Capturing Story Gems";
    const backLines = wrapText(backText, sansFont, 11, panelW - 72);
    let by = chPt / 2 + (backLines.length * 14) / 2;
    for (const bl of backLines) {
      const bw = sansFont.widthOfTextAtSize(bl, 11);
      coverPage.drawText(bl, { x: (panelW - bw) / 2, y: by, size: 11, font: sansFont, color: rgb(1, 1, 1) });
      by -= 14;
    }

    // Spine text (rotated)
    const spineText = book.title || "My Book";
    const spineFontSize = 9;
    const spineTw = sansFont.widthOfTextAtSize(spineText, spineFontSize);
    coverPage.drawText(spineText, {
      x: panelW + spineW / 2 + spineFontSize / 3,
      y: (chPt - spineTw) / 2,
      size: spineFontSize,
      font: sansFont,
      color: rgb(1, 1, 1),
      rotate: degrees(90),
    });

    // Front panel
    const frontCenterX = panelW + spineW + panelW / 2;
    const frontLeft = panelW + spineW + 36;
    const frontRight = cwPt - 36;
    const frontContentW = frontRight - frontLeft;
    let fy = chPt * 0.65;

    // Cover image on front (if available)
    // Place a centered hero image and reserve vertical space for title/author below it
    if (coverImageUrl) {
      try {
        const imgData = await embedRemoteImage(coverPdf, coverImageUrl);
        if (imgData) {
          const maxW = frontContentW;
          const HERO_MAX_HEIGHT = chPt * 0.28; // ~28% of cover height
          const scale = Math.min(maxW / imgData.width, HERO_MAX_HEIGHT / imgData.height, 1);
          const iw = imgData.width * scale;
          const ih = imgData.height * scale;
          // center image horizontally and place near top of front panel
          const imageTopY = chPt * 0.85;
          const imageY = imageTopY - ih;
          coverPage.drawImage(imgData.image, { x: frontCenterX - iw / 2, y: imageY, width: iw, height: ih });
          // set content flow y below the image with comfortable spacing
          fy = imageY - 24; // 24pt gap between image and title
        }
      } catch (e) {
        console.warn('Cover image embed failed', e?.message || e);
      }
    }

    // Title on front — draw title lines centered below the image, then author with spacing
    let coverTitleSize = 36;
    const rawTitle = (book.title || "My Book").toUpperCase();
    let ctLines = wrapText(rawTitle, sansBold, coverTitleSize, frontContentW);
    while (ctLines.length > 3 && coverTitleSize > 18) {
      coverTitleSize -= 2;
      ctLines = wrapText(rawTitle, sansBold, coverTitleSize, frontContentW);
    }
    // draw title lines stacked, centered
    for (const ctl of ctLines) {
      const ctw = sansBold.widthOfTextAtSize(ctl, coverTitleSize);
      coverPage.drawText(ctl, { x: frontCenterX - ctw / 2, y: fy - coverTitleSize, size: coverTitleSize, font: sansBold, color: rgb(1, 1, 1) });
      fy -= coverTitleSize * 1.2;
    }

    // small gap before author
    fy -= 8;
    const authorText2 = reqAuthorName || book.authorName || "A Keepsake Collection";
    const authorSize = 14;
    const aw = sansFont.widthOfTextAtSize(authorText2, authorSize);
    coverPage.drawText(authorText2, { x: frontCenterX - aw / 2, y: fy - authorSize, size: authorSize, font: sansFont, color: rgb(0.88, 0.88, 0.88) });
    fy -= authorSize * 1.2;

    // Serialize cover PDF to file
    const coverBytes = await coverPdf.save();
    const coverPath = path.join(booksDir, `cover-${book._id}.pdf`);
    fs.writeFileSync(coverPath, coverBytes);

    // =================================================
    //  UPLOAD BOTH TO CLOUDINARY
    // =================================================
    // Upload Interior
    const interiorUpload = await cloudinary.uploader.upload(interiorPath, {
      resource_type: "image", folder: "books", public_id: `interior-${book._id}`, format: "pdf"
    });

    // Upload Cover
    const coverUpload = await cloudinary.uploader.upload(coverPath, {
      resource_type: "raw", folder: "covers", public_id: `cover-${book._id}`, format: "pdf"
    });

    // Cleanup local files
    try {
      if (fs.existsSync(interiorPath)) fs.unlinkSync(interiorPath);
      if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
    } catch (e) { console.warn("Cleanup error", e); }

    // Save to DB
    book.pdfUrl = interiorUpload.secure_url;
    book.coverPdfUrl = coverUpload.secure_url; // Make sure Model has this field!
    book.pod_package_id = podPackage;
    book.pdf_trim_code = trimResolved.trimCode;
    book.status = "pdf_generated";
    book.pdfGeneratedAt = new Date();
    await book.save();

    const pageSize = getExpectedPageSizePoints(podPackage);

    return res.status(200).json({
      message: "Generated Interior and Cover PDFs successfully",
      response: {
        data: {
          pdfUrl: book.pdfUrl,
          coverPdfUrl: book.coverPdfUrl,
          pod_package_id: book.pod_package_id,
          pdf_trim_code: book.pdf_trim_code,
          page_size_inches: pageSize
            ? { width: pageSize.widthIn, height: pageSize.heightIn }
            : undefined,
        }
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error generating PDFs", error: err.message });
  }
};

// POST /user/book/:bookId/send-to-lulu
const sendToLulu = async (req, res) => {
  try {
    const { id: userId } = req.decoded;
    const { bookId } = req.params;
    const {
      contact_email,
      external_id,
      quantity,
      shipping_level,
      pod_package_id,
      production_delay,
      shipping_address,
    } = req.body || {};
    const book = await Book.findOne({ _id: bookId, userId }).lean();
    if (!book) return res.status(404).json({ message: "Book not found", error: "Book not found" });

    // Check for BOTH PDFs
    if (!book.pdfUrl || !book.coverPdfUrl) {
      return res.status(400).json({ message: "Generate PDFs first (Interior & Cover)", error: "PDFs missing" });
    }

    if (!contact_email || !pod_package_id || !shipping_level || !shipping_address) {
      return res.status(400).json({ message: "Missing fields", error: "Invalid payload" });
    }
    const orderData = {
      contact_email,
      external_id: external_id || `book-${book._id}`,
      line_items: [
        {
          external_id: `item-${book._id}`,
          printable_normalization: {
            cover: { source_url: book.coverPdfUrl },    // Use the generated cover URL
            interior: { source_url: book.pdfUrl },      // Use the generated interior URL
            pod_package_id,
          },
          quantity: Number(quantity) > 0 ? Number(quantity) : 1,
          title: book.title || "My Book",
        },
      ],
      production_delay: typeof production_delay === "number" ? production_delay : undefined,
      shipping_address,
      shipping_level,
    };

    const luluResp = await luluClient.createPrintJob(orderData);

    return res.status(200).json({ message: "Print job created", response: { data: luluResp }, error: null });
  } catch (err) {
    console.error("Lulu print job error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};  // POST /user/book/:bookId/validate-interior -> validate interior PDF with Lulu
const validateInteriorPdf = async (req, res) => {
  try {
    const { id: userId } = req.decoded;
    const { bookId } = req.params;
    const { source_url } = req.body || {};
    const podPackageId = req.body.pod_package_id;

    const book = await Book.findOne({ _id: bookId, userId }).lean();
    if (!book) return res.status(404).json({ message: "Book not found", error: "Book not found" });

    // prefer explicit source_url, fallback to stored pdfUrl
    const urlToValidate = source_url || book.pdfUrl;
    if (!urlToValidate) {
      return res.status(400).json({ message: "No interior PDF URL provided or generated", error: "Missing source_url" });
    }

    const resp = await luluClient.validateInterior(urlToValidate);
    return res.status(200).json({ message: "Validation started", response: { data: resp }, error: null });
  } catch (err) {
    console.error("Validate interior error:", err);
    // pass through error response if axios returned one
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};

// GET /user/book/:bookId/validate-interior/:validationId -> fetch validation result
const getInteriorValidationStatus = async (req, res) => {
  try {
    const { id: userId } = req.decoded;
    const { bookId, validationId } = req.params;
    console.log(`Fetching interior validation status for bookId: ${bookId}, validationId: ${validationId}`);
    const book = await Book.findOne({ _id: bookId, userId }).lean();
    if (!book) return res.status(404).json({ message: "Book not found", error: "Book not found" });

    if (!validationId) return res.status(400).json({ message: "validationId required", error: "Missing validationId" });

    const resp = await luluClient.getInteriorValidationStatus(validationId);
    console.log("Interior validation status response:", resp);
    return res.status(200).json({ message: "Validation status fetched", response: { data: resp }, error: null });
  } catch (err) {
    console.error("Get validation status error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};

// POST /user/book/:bookId/validate-cover -> validate cover PDF with Lulu
const validateCoverPdf = async (req, res) => {
  try {
    const { id: userId } = req.decoded;
    const { bookId } = req.params;
    const { source_url, pod_package_id, interior_page_count } = req.body || {};

    const book = await Book.findOne({ _id: bookId, userId }).lean();
    if (!book) return res.status(404).json({ message: "Book not found", error: "Book not found" });

    const urlToValidate = source_url || book.coverPdfUrl;
    const podId = pod_package_id || (book.pod_package_id || undefined);
    const pages = interior_page_count || req.body.page_count || req.body.pageCount || undefined;

    if (!urlToValidate) {
      return res.status(400).json({ message: "No cover PDF URL provided or generated", error: "Missing source_url" });
    }

    if (!podId || !pages) {
      // allow pod_package_id/page count to be provided in request body
      return res.status(400).json({ message: "pod_package_id and interior_page_count are required", error: "Missing fields" });
    }
    console.log(`Validating cover with pod_package_id: ${podId} and interior_page_count: ${pages}`);
    console.log(`Cover URL to validate: ${urlToValidate}`);
    const resp = await luluClient.validateCover({ source_url: urlToValidate, pod_package_id: podId, interior_page_count: Number(pages) });
    console.log("Cover validation response:", resp);
    return res.status(200).json({ message: "Cover validation started", response: { data: resp }, error: null });
  } catch (err) {
    console.error("Validate cover error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};

// GET /user/book/:bookId/validate-cover/:validationId -> fetch cover validation result
const getCoverValidationStatus = async (req, res) => {
  try {
    const { id: userId } = req.decoded;
    const { bookId, validationId } = req.params;

    const book = await Book.findOne({ _id: bookId, userId }).lean();
    if (!book) return res.status(404).json({ message: "Book not found", error: "Book not found" });

    if (!validationId) return res.status(400).json({ message: "validationId required", error: "Missing validationId" });
    console.log(`Fetching cover validation status for validationId: ${validationId}`);
    const resp = await luluClient.getCoverValidationStatus(validationId);
    console.log("Cover validation status response:", resp);
    return res.status(200).json({ message: "Cover validation status fetched", response: { data: resp }, error: null });
  } catch (err) {
    console.error("Get cover validation status error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};


// PUT /user/book/:bookId  -> update book title
const updateBookTitle = async (req, res) => {
  try {
    const { id: userId } = req.decoded;
    const { bookId } = req.params;
    const { title } = req.body || {};

    if (typeof title !== "string" || title.trim().length === 0) return res.status(400).json({ message: "Title required", error: "Missing title" });

    const book = await Book.findOne({ _id: bookId, userId });
    if (!book) return res.status(404).json({ message: "Book not found", error: "Book not found" });

    book.title = title.trim();
    await book.save();

    return res.status(200).json({ message: "Book title updated", response: { data: book }, error: null });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};



// POST /user/book/:bookId/cost-estimate -> get price estimate from Lulu
const calculatePrintCost = async (req, res) => {
  try {
    const { id: userId } = req.decoded;
    const { bookId } = req.params;

    // Ensure book exists (ownership check)
    const book = await Book.findOne({ _id: bookId, userId }).lean();
    if (!book) {
      return res.status(404).json({
        message: "Book not found",
        response: null,
        error: "Book not found",
      });
    }

    const {
      shipping_address,
      shipping_option,
      line_items,
      page_count,
      pod_package_id,
      quantity,
    } = req.body || {};

    // Build payload: accept either full line_items or single-item fields
    let items = Array.isArray(line_items) && line_items.length > 0
      ? line_items
      : undefined;

    if (!items) {
      const pc = Number(page_count);
      const qty = Number(quantity);
      if (!pc || !pod_package_id || !qty) {
        return res.status(400).json({
          message: "Provide either line_items[] or single item fields: page_count, pod_package_id, quantity",
          response: null,
          error: "Invalid payload",
        });
      }
      items = [
        {
          page_count: pc,
          pod_package_id,
          quantity: qty,
        },
      ];
    }

    if (!shipping_address || !shipping_option) {
      return res.status(400).json({
        message: "shipping_address and shipping_option are required",
        response: null,
        error: "Invalid payload",
      });
    }

    const payload = {
      line_items: items,
      shipping_address,
      shipping_option,
    };

    const cost = await luluClient.calculatePrintCost(payload);
    console.log("Cost estimate response from Lulu:", cost);

    return res.status(200).json({
      message: "Cost estimate fetched",
      response: { data: cost },
      error: null,
    });
  } catch (err) {
    console.error("Lulu cost estimate error:", err);
    return res.status(500).json({
      message: "Internal server error",
      response: null,
      error: err.message,
    });
  }
};

module.exports = {
  createBook,
  getMyBooks,
  getBook,
  addStoryToBook,
  removeStoryFromBook,
  reorderBookItems,
  deleteBook,
  generateBookPdf,
  sendToLulu,
  validateInteriorPdf,
  getInteriorValidationStatus,
  validateCoverPdf,
  getCoverValidationStatus,
  updateBookTitle,
  calculatePrintCost,
};
