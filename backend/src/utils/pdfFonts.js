const fs = require("fs");
const path = require("path");
const axios = require("axios");

let fontkit = null;
try {
  fontkit = require("@pdf-lib/fontkit");
} catch {
  fontkit = null;
}

const FONTS_DIR = path.join(__dirname, "../../assets/fonts");

const DEFAULT_TTF_URLS = {
  serifRegular:
    "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSerif/NotoSerif-Regular.ttf",
  serifBold:
    "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSerif/NotoSerif-Bold.ttf",
  serifItalic:
    "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSerif/NotoSerif-Italic.ttf",
  sansRegular:
    "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf",
  sansBold:
    "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Bold.ttf",
};

const ENV_URL_KEYS = {
  serifRegular: "SERIF_FONT_REGULAR_URL",
  serifBold: "SERIF_FONT_BOLD_URL",
  serifItalic: "SERIF_FONT_ITALIC_URL",
  sansRegular: "SANS_FONT_REGULAR_URL",
  sansBold: "SANS_FONT_BOLD_URL",
};

/** Bundled / fallback TTF sources (Lulu requires fully embedded fonts — not WOFF or PDF standard fonts). */
const FONT_SOURCES = {
  serifRegular: { file: "NotoSerif-Regular.ttf", key: "serifRegular" },
  serifBold: { file: "NotoSerif-Bold.ttf", key: "serifBold" },
  serifItalic: { file: "NotoSerif-Italic.ttf", key: "serifItalic" },
  sansRegular: { file: "NotoSans-Regular.ttf", key: "sansRegular" },
  sansBold: { file: "NotoSans-Bold.ttf", key: "sansBold" },
};

function resolveFontUrl(key) {
  const envKey = ENV_URL_KEYS[key];
  const fromEnv = envKey ? process.env[envKey] : null;
  if (fromEnv && String(fromEnv).trim() && !/\.woff2?(\?|$)/i.test(fromEnv)) {
    return String(fromEnv).trim();
  }
  if (fromEnv && /\.woff2?(\?|$)/i.test(fromEnv)) {
    console.warn(
      `Ignoring ${envKey} (WOFF not valid for Lulu print PDFs). Using bundled TTF instead.`
    );
  }
  return DEFAULT_TTF_URLS[key];
}

function ensureFontkitRegistered(pdfDoc) {
  if (!fontkit) {
    try {
      fontkit = require("@pdf-lib/fontkit");
    } catch (e) {
      throw new Error(
        "Missing @pdf-lib/fontkit — required to embed print fonts. Run: npm install @pdf-lib/fontkit"
      );
    }
  }
  if (typeof pdfDoc.registerFontkit === "function") {
    pdfDoc.registerFontkit(fontkit);
  }
}

async function loadFontBuffer({ file, key }, label) {
  const localPath = path.join(FONTS_DIR, file);
  if (fs.existsSync(localPath)) {
    const buf = fs.readFileSync(localPath);
    if (buf.length > 1000) return buf;
  }

  const url = resolveFontUrl(key);
  if (!url) {
    throw new Error(`No TTF font URL configured for ${label}`);
  }

  try {
    const resp = await axios.get(url, { responseType: "arraybuffer", timeout: 30000 });
    const buf = Buffer.from(resp.data);
    if (buf.length < 1000) {
      throw new Error(`Font download too small (${buf.length} bytes)`);
    }
    try {
      fs.mkdirSync(FONTS_DIR, { recursive: true });
      fs.writeFileSync(localPath, buf);
    } catch {
      // cache is optional
    }
    return buf;
  } catch (err) {
    throw new Error(`Failed to load ${label} font: ${err?.message || err}`);
  }
}

async function embedFontBuffer(pdfDoc, buffer, label) {
  try {
    return await pdfDoc.embedFont(buffer, { subset: true });
  } catch (err) {
    throw new Error(`Failed to embed ${label} in PDF: ${err?.message || err}`);
  }
}

/** Embed all interior (serif) fonts — required for Lulu interior PDF. */
async function embedInteriorFonts(pdfDoc) {
  ensureFontkitRegistered(pdfDoc);

  const [regularBuf, boldBuf, italicBuf] = await Promise.all([
    loadFontBuffer(FONT_SOURCES.serifRegular, "Noto Serif Regular"),
    loadFontBuffer(FONT_SOURCES.serifBold, "Noto Serif Bold"),
    loadFontBuffer(FONT_SOURCES.serifItalic, "Noto Serif Italic"),
  ]);

  const [serifFont, serifBold, serifItalic] = await Promise.all([
    embedFontBuffer(pdfDoc, regularBuf, "Noto Serif Regular"),
    embedFontBuffer(pdfDoc, boldBuf, "Noto Serif Bold"),
    embedFontBuffer(pdfDoc, italicBuf, "Noto Serif Italic"),
  ]);

  return { serifFont, serifBold, serifItalic };
}

/** Embed cover (sans) fonts — also fully embedded for print validation. */
async function embedCoverFonts(pdfDoc) {
  ensureFontkitRegistered(pdfDoc);

  const [regularBuf, boldBuf] = await Promise.all([
    loadFontBuffer(FONT_SOURCES.sansRegular, "Noto Sans Regular"),
    loadFontBuffer(FONT_SOURCES.sansBold, "Noto Sans Bold"),
  ]);

  const [sansFont, sansBold] = await Promise.all([
    embedFontBuffer(pdfDoc, regularBuf, "Noto Sans Regular"),
    embedFontBuffer(pdfDoc, boldBuf, "Noto Sans Bold"),
  ]);

  return { sansFont, sansBold };
}

module.exports = {
  FONTS_DIR,
  FONT_SOURCES,
  ensureFontkitRegistered,
  embedInteriorFonts,
  embedCoverFonts,
};
