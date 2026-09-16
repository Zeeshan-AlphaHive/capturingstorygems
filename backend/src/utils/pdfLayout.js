/**
 * Print-ready interior PDF layout for Capturing Story Gems.
 *
 * Crown Quarto (7.44 × 9.68 in) uses the client's exact print spec.
 * Other Lulu trim sizes use proportionally scaled margins & typography
 * so the book stays balanced on smaller/larger pages.
 *
 * Text alignment: left / ragged right on all trims.
 */

const PTS_PER_INCH = 72;

/** Client reference — Crown Quarto */
const REFERENCE = {
  trimCode: "0744X0968",
  widthIn: 7.44,
  heightIn: 9.68,
  label: "Crown Quarto",
  margins: {
    inside: 0.8,
    outside: 0.7,
    top: 0.675,
    bottom: 0.725,
  },
  type: {
    bodySize: 12,
    bodyLeading: 15.75,
    storyTitleSize: 23,
    captionSize: 9.25,
    paragraphSpacing: 8,
    pageNumberSize: 9,
  },
};

const roundMargin = (v) => Math.round(v * 1000) / 1000;
const roundPt = (v) => Math.round(v * 4) / 4; // quarter-point steps

/**
 * Scale reference margins & type for a trim size (geometric mean of W/H vs reference).
 */
function computeProfileForTrim(trimCode, widthIn, heightIn, label) {
  const scale = Math.sqrt(
    (widthIn / REFERENCE.widthIn) * (heightIn / REFERENCE.heightIn)
  );

  const m = REFERENCE.margins;
  const t = REFERENCE.type;

  return {
    trimCode: trimCode || null,
    widthIn,
    heightIn,
    label: label || `${widthIn} × ${heightIn} in`,
    scale: roundMargin(scale),
    margins: {
      inside: roundMargin(Math.max(0.55, m.inside * scale)),
      outside: roundMargin(Math.max(0.5, m.outside * scale)),
      top: roundMargin(Math.max(0.55, m.top * scale)),
      bottom: roundMargin(Math.max(0.6, m.bottom * scale)),
    },
    type: {
      bodySize: roundPt(Math.min(12, Math.max(10.5, t.bodySize * scale))),
      bodyLeading: roundPt(Math.min(16, Math.max(13.5, t.bodyLeading * scale))),
      storyTitleSize: roundPt(Math.min(24, Math.max(20, t.storyTitleSize * scale))),
      captionSize: roundPt(Math.min(9.5, Math.max(8.5, t.captionSize * scale))),
      paragraphSpacing: roundPt(Math.min(9, Math.max(6, t.paragraphSpacing * scale))),
      pageNumberSize: roundPt(Math.min(9, Math.max(8, t.pageNumberSize * scale))),
    },
  };
}

/** Precomputed profiles for supported Lulu trims (matches luluPodConfig / frontend). */
const TRIM_LAYOUT_PROFILES = {
  "0744X0968": {
    ...REFERENCE,
    scale: 1,
  },
  "0600X0900": computeProfileForTrim(
    "0600X0900",
    6.0,
    9.0,
    "US Trade"
  ),
  "0614X0921": computeProfileForTrim(
    "0614X0921",
    6.14,
    9.21,
    "Royal"
  ),
  "0700X1000": computeProfileForTrim(
    "0700X1000",
    7.0,
    10.0,
    "Executive"
  ),
};

/**
 * Resolve layout profile for a trim code or raw width/height.
 */
function getLayoutProfile({ trimCode, widthIn, heightIn, label } = {}) {
  const code = trimCode ? String(trimCode).toUpperCase() : null;
  if (code && TRIM_LAYOUT_PROFILES[code]) {
    return { ...TRIM_LAYOUT_PROFILES[code] };
  }
  if (widthIn > 0 && heightIn > 0) {
    return computeProfileForTrim(code, widthIn, heightIn, label);
  }
  return { ...TRIM_LAYOUT_PROFILES["0744X0968"] };
}

/**
 * Build page geometry for a POD package (trim + optional Lulu FC bleed).
 * Odd pages = recto: inside margin on the left.
 * Even pages = verso: inside margin on the right.
 */
function buildInteriorLayout({
  widthIn,
  heightIn,
  needsBleed = false,
  trimCode,
  label,
} = {}) {
  const profile = getLayoutProfile({ trimCode, widthIn, heightIn, label });
  const marginsIn = profile.margins;
  const type = profile.type;

  const bleedIn = needsBleed ? 0.125 : 0;
  const pageW = (needsBleed ? widthIn + 0.125 : widthIn) * PTS_PER_INCH;
  const pageH = (needsBleed ? heightIn + 0.25 : heightIn) * PTS_PER_INCH;

  const inside = marginsIn.inside * PTS_PER_INCH;
  const outside = (marginsIn.outside + bleedIn) * PTS_PER_INCH;
  const top = (marginsIn.top + bleedIn) * PTS_PER_INCH;
  const bottom = (marginsIn.bottom + bleedIn) * PTS_PER_INCH;

  const contentW = pageW - inside - outside;
  const contentH = pageH - top - bottom;

  const getMargins = (pageNum) => {
    const odd = Number(pageNum) % 2 === 1;
    return {
      left: odd ? inside : outside,
      right: odd ? outside : inside,
      top,
      bottom,
      contentW,
      contentH,
    };
  };

  return {
    pageW,
    pageH,
    inside,
    outside,
    top,
    bottom,
    contentW,
    contentH,
    bleedIn,
    getMargins,
    type: { ...type },
    profile: {
      trimCode: profile.trimCode,
      label: profile.label,
      scale: profile.scale,
      marginsIn: { ...marginsIn },
    },
  };
}

/** Human-readable layout summary (logs / API). */
function describeLayout(layout) {
  const toIn = (pt) => (pt / PTS_PER_INCH).toFixed(3);
  return {
    trimCode: layout.profile?.trimCode,
    trimLabel: layout.profile?.label,
    scaleFromReference: layout.profile?.scale,
    finishedPageIn: {
      width: Number(toIn(layout.pageW - (layout.bleedIn > 0 ? 0.125 * PTS_PER_INCH : 0))),
      height: Number(toIn(layout.pageH - (layout.bleedIn > 0 ? 0.25 * PTS_PER_INCH : 0))),
    },
    pdfPageIn: {
      width: Number(toIn(layout.pageW)),
      height: Number(toIn(layout.pageH)),
    },
    marginsIn: {
      inside: Number(toIn(layout.inside)),
      outside: Number((layout.outside / PTS_PER_INCH - layout.bleedIn).toFixed(3)),
      top: Number((layout.top / PTS_PER_INCH - layout.bleedIn).toFixed(3)),
      bottom: Number((layout.bottom / PTS_PER_INCH - layout.bleedIn).toFixed(3)),
    },
    type: layout.type,
    alignment: "left/ragged-right",
  };
}

/** Verify active layout matches the profile for this trim. */
function verifyLayoutAgainstSpec(layout) {
  const report = describeLayout(layout);
  const expected = getLayoutProfile({
    trimCode: layout.profile?.trimCode,
    widthIn: report.finishedPageIn.width,
    heightIn: report.finishedPageIn.height,
    label: layout.profile?.label,
  });

  const issues = [];
  const near = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;

  for (const key of ["inside", "outside", "top", "bottom"]) {
    if (!near(report.marginsIn[key], expected.margins[key])) {
      issues.push(
        `${key} margin ${report.marginsIn[key]}" ≠ expected ${expected.margins[key]}"`
      );
    }
  }
  for (const key of Object.keys(expected.type)) {
    if (layout.type[key] !== expected.type[key]) {
      issues.push(`Type ${key}: ${layout.type[key]} ≠ expected ${expected.type[key]}`);
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    report: { ...report, expectedProfile: expected.label },
  };
}

module.exports = {
  PTS_PER_INCH,
  REFERENCE,
  TRIM_LAYOUT_PROFILES,
  getLayoutProfile,
  buildInteriorLayout,
  describeLayout,
  verifyLayoutAgainstSpec,
};
