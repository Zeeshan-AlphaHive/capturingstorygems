const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const CLOUDINARY_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_JPEG_QUALITY = 82;
const PRINT_DPI = 220;

let sharp;
try {
  sharp = require("sharp");
} catch (e) {
  console.warn("Optional dependency sharp not installed; PDF images will not be compressed (npm i sharp)");
}

/** Convert PDF points to max pixel dimension at print DPI. */
function pointsToMaxPixels(points, dpi = PRINT_DPI) {
  if (!points || points <= 0) return undefined;
  return Math.ceil((points / 72) * dpi);
}

/** Build embed options from the display size (in PDF points) on the page. */
function embedOptsForSize(widthPt, heightPt, dpi = PRINT_DPI) {
  return {
    maxWidthPx: pointsToMaxPixels(widthPt, dpi),
    maxHeightPx: pointsToMaxPixels(heightPt, dpi),
  };
}

/**
 * Resize and re-encode an image buffer for PDF embedding.
 * Keeps PNG when alpha is required; otherwise uses JPEG for smaller size.
 */
async function optimizeImageForPdf(buf, options = {}) {
  if (!buf || !Buffer.isBuffer(buf) || buf.length === 0) return buf;
  if (!sharp) return buf;

  const maxWidthPx = options.maxWidthPx;
  const maxHeightPx = options.maxHeightPx;
  let quality = options.quality ?? DEFAULT_JPEG_QUALITY;

  const run = async (q) => {
    let pipeline = sharp(buf, { failOn: "none" }).rotate();
    const meta = await pipeline.metadata();

    if (maxWidthPx || maxHeightPx) {
      pipeline = sharp(buf, { failOn: "none" })
        .rotate()
        .resize({
          width: maxWidthPx || undefined,
          height: maxHeightPx || undefined,
          fit: "inside",
          withoutEnlargement: true,
        });
    }

    if (meta.hasAlpha) {
      return pipeline.png({ compressionLevel: 9, palette: meta.width <= 512 }).toBuffer();
    }

    return pipeline.jpeg({ quality: q, mozjpeg: true }).toBuffer();
  };

  try {
    let result = await run(quality);
    const perImageCap = 1.5 * 1024 * 1024;
    while (result.length > perImageCap && quality > 55) {
      quality -= 8;
      result = await run(quality);
    }
    return result;
  } catch (e) {
    console.warn("Image optimization failed, using original buffer:", e?.message || e);
    return buf;
  }
}

async function tryCompressPdfWithGhostscript(inputPath) {
  const outputPath = `${inputPath.replace(/\.pdf$/i, "")}-compressed.pdf`;
  const gsBinaries =
    process.platform === "win32"
      ? ["gswin64c", "gswin32c", "gs"]
      : ["gs"];

  for (const gs of gsBinaries) {
    try {
      await execFileAsync(gs, [
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        "-dPDFSETTINGS=/printer",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        `-sOutputFile=${outputPath}`,
        inputPath,
      ]);

      if (!fs.existsSync(outputPath)) continue;

      const compressedSize = fs.statSync(outputPath).size;
      const originalSize = fs.statSync(inputPath).size;
      if (compressedSize < originalSize) {
        return outputPath;
      }

      fs.unlinkSync(outputPath);
    } catch {
      // try next binary
    }
  }

  return null;
}

/**
 * Ensure a PDF file is under Cloudinary's size limit.
 * Returns the path to upload (may be a new compressed file).
 */
async function ensurePdfUnderCloudinaryLimit(filePath, maxBytes = CLOUDINARY_MAX_BYTES) {
  if (!fs.existsSync(filePath)) return filePath;

  let size = fs.statSync(filePath).size;
  if (size <= maxBytes) return filePath;

  console.log(
    `PDF ${path.basename(filePath)} is ${(size / 1024 / 1024).toFixed(2)}MB; attempting Ghostscript compression...`
  );

  const compressedPath = await tryCompressPdfWithGhostscript(filePath);
  if (compressedPath && fs.existsSync(compressedPath)) {
    const compressedSize = fs.statSync(compressedPath).size;
    console.log(
      `Ghostscript compressed PDF to ${(compressedSize / 1024 / 1024).toFixed(2)}MB`
    );
    if (compressedSize <= maxBytes) return compressedPath;
    if (compressedSize < size) return compressedPath;
  }

  return filePath;
}

module.exports = {
  CLOUDINARY_MAX_BYTES,
  PRINT_DPI,
  pointsToMaxPixels,
  embedOptsForSize,
  optimizeImageForPdf,
  ensurePdfUnderCloudinaryLimit,
};
