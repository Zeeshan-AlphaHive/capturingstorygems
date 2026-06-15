/**
 * Normalize Quill HTML so blank lines, lists, and Enter key spacing render the same
 * in the editor and on the public invitation page.
 */

const LIST_TYPES = "bullet|ordered|checked|unchecked";

function ensureQuillListUi(html) {
  return html.replace(
    new RegExp(
      `<li([^>]*\\bdata-list\\s*=\\s*["'](?:${LIST_TYPES})["'][^>]*)>(?!\\s*<span[^>]*\\bql-ui\\b)`,
      "gi"
    ),
    '<li$1><span class="ql-ui" contenteditable="false"></span>'
  );
}

function convertLegacyUlToQuill(html) {
  return html.replace(/<ul\b([^>]*)>([\s\S]*?)<\/ul>/gi, (_match, _attrs, inner) => {
    const innerWithListType = inner.replace(
      /<li\b([^>]*)>/gi,
      (liMatch, liAttrs) => {
        const attrs = (liAttrs || "").trim();
        if (/\bdata-list\s*=/i.test(attrs)) return liMatch;
        return attrs
          ? `<li data-list="bullet" ${attrs}>`
          : `<li data-list="bullet">`;
      }
    );
    return `<ol>${ensureQuillListUi(innerWithListType)}</ol>`;
  });
}

function stripBreakingInlineStyles(html) {
  return html.replace(/\sstyle="([^"]*)"/gi, (match, styles) => {
    let cleaned = styles
      .replace(/\bword-break\s*:\s*[^;"]+;?/gi, "")
      .replace(/\boverflow-wrap\s*:\s*[^;"]+;?/gi, "")
      .replace(/\bword-wrap\s*:\s*[^;"]+;?/gi, "")
      .replace(/\bwhite-space\s*:\s*nowrap\b/gi, "white-space:normal")
      .replace(/\bhyphens\s*:\s*[^;"]+;?/gi, "")
      .replace(/\b(?:min-)?width\s*:\s*[^;"]+;?/gi, "")
      .replace(/\bmax-width\s*:\s*[^;"]+;?/gi, "")
      .replace(/;;+/g, ";")
      .replace(/^;|;$/g, "")
      .trim();
    if (!cleaned) return "";
    return ` style="${cleaned}"`;
  });
}

/** Non-breaking spaces prevent line wrap and cause horizontal overflow/clipping */
function normalizeWrappingSpaces(html) {
  return html
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/\u00a0/g, " ");
}

function removeSoftHyphens(html) {
  return html.replace(/&shy;|&#173;/gi, "").replace(/\u00ad/g, "");
}

function repairLegacyOl(html) {
  return html.replace(/<ol\b([^>]*)>([\s\S]*?)<\/ol>/gi, (match, attrs, inner) => {
    if (/\bdata-list\s*=/i.test(inner)) {
      return `<ol${attrs}>${ensureQuillListUi(inner)}</ol>`;
    }
    const innerWithListType = inner.replace(
      /<li\b([^>]*)>/gi,
      (liMatch, liAttrs) => {
        const a = (liAttrs || "").trim();
        if (/\bdata-list\s*=/i.test(a)) return liMatch;
        return a ? `<li data-list="ordered" ${a}>` : `<li data-list="ordered">`;
      }
    );
    return `<ol${attrs}>${ensureQuillListUi(innerWithListType)}</ol>`;
  });
}

function normalizeInvitationHtml(html) {
  if (!html || typeof html !== "string") return "";

  let out = html;

  out = removeSoftHyphens(out);
  out = normalizeWrappingSpaces(out);
  out = stripBreakingInlineStyles(out);
  out = convertLegacyUlToQuill(out);
  out = repairLegacyOl(out);
  out = ensureQuillListUi(out);

  out = out.replace(/<p>\s*<\/p>/gi, "<p><br></p>");

  out = out.replace(
    /<p>(?!\s*(?:&nbsp;|&#160;|\u00a0))[\t \r\n\f\v]*<\/p>/gi,
    "<p><br></p>"
  );

  out = out.replace(/<p>\s*<br[^>]*\/?>\s*<\/p>/gi, "<p><br></p>");

  return out;
}

function formatHtmlForEmail(html) {
  if (!html || typeof html !== "string") return "";

  // 1. Remove the Quill UI elements
  let out = html.replace(/<span class="ql-ui"[^>]*>.*?<\/span>/gi, "");

  // 2. Convert Quill's list format to standard HTML list tags (<ul> and <ol>)
  out = out.replace(/<(ol|ul)\b[^>]*>([\s\S]*?)<\/\1>/gi, (match, tag, inner) => {
    if (!/data-list=/i.test(inner)) {
      const standardListStyle = tag === "ul" ? "disc" : "decimal";
      return `<${tag} style="margin: 0 0 10px 0; padding-left: 24px; list-style-type: ${standardListStyle};">${inner}</${tag}>`;
    }

    const liRegex = /<li\b([^>]*)>([\s\S]*?)<\/li>/gi;
    let liMatch;
    let result = "";
    let activeListType = null; // 'bullet' or 'ordered'

    while ((liMatch = liRegex.exec(inner)) !== null) {
      const attrs = liMatch[1] || "";
      const content = liMatch[2] || "";

      const isBullet = /\bdata-list=["']bullet["']/i.test(attrs);
      const isOrdered = /\bdata-list=["']ordered["']/i.test(attrs);
      const listType = isBullet ? "bullet" : (isOrdered ? "ordered" : "bullet");

      const indentMatch = attrs.match(/\bclass=["'][^"']*\bql-indent-(\d+)\b[^"']*["']/i);
      const indentLevel = indentMatch ? parseInt(indentMatch[1], 10) : 0;

      if (activeListType !== listType) {
        if (activeListType === "bullet") result += "</ul>";
        if (activeListType === "ordered") result += "</ol>";

        if (listType === "bullet") {
          result += `<ul style="margin: 0 0 10px 0; padding-left: 24px; list-style-type: disc;">`;
        } else {
          result += `<ol style="margin: 0 0 10px 0; padding-left: 24px; list-style-type: decimal;">`;
        }
        activeListType = listType;
      }

      const paddingLeft = indentLevel > 0 ? ` padding-left: ${indentLevel * 20}px;` : "";
      const listStyle = listType === "bullet"
        ? (indentLevel % 3 === 0 ? "disc" : (indentLevel % 3 === 1 ? "circle" : "square"))
        : "decimal";

      result += `<li style="margin: 0 0 5px 0; padding: 0;${paddingLeft} list-style-type: ${listStyle};">${content}</li>`;
    }

    if (activeListType === "bullet") result += "</ul>";
    if (activeListType === "ordered") result += "</ol>";

    return result;
  });

  // 3. Convert alignment classes to inline style properties
  out = out.replace(/class=["'][^"']*\bql-align-center\b[^"']*["']/gi, 'style="text-align: center;"');
  out = out.replace(/class=["'][^"']*\bql-align-right\b[^"']*["']/gi, 'style="text-align: right;"');
  out = out.replace(/class=["'][^"']*\bql-align-justify\b[^"']*["']/gi, 'style="text-align: justify;"');
  out = out.replace(/class=["'][^"']*\bql-align-left\b[^"']*["']/gi, 'style="text-align: left;"');

  const defaultFont = "font-family: 'Inter', system-ui, -apple-system, sans-serif;";

  // 4. Inline style base tags
  out = out.replace(/<p\b([^>]*)>/gi, (match, attrs) => {
    let style = `margin: 0; padding: 0; font-size: 14px; line-height: 1.5; color: #4b5563; ${defaultFont}`;
    return mergeStylesInTag(match, attrs, style);
  });

  out = out.replace(/<h1\b([^>]*)>/gi, (match, attrs) => {
    let style = `margin: 0 0 12px 0; padding: 0; font-size: 26px; line-height: 1.25; font-weight: bold; color: #1e293b; ${defaultFont}`;
    return mergeStylesInTag(match, attrs, style);
  });

  out = out.replace(/<h2\b([^>]*)>/gi, (match, attrs) => {
    let style = `margin: 0 0 10px 0; padding: 0; font-size: 20px; line-height: 1.3; font-weight: bold; color: #1e293b; ${defaultFont}`;
    return mergeStylesInTag(match, attrs, style);
  });

  out = out.replace(/<h3\b([^>]*)>/gi, (match, attrs) => {
    let style = `margin: 0 0 8px 0; padding: 0; font-size: 16px; line-height: 1.35; font-weight: bold; color: #1e293b; ${defaultFont}`;
    return mergeStylesInTag(match, attrs, style);
  });

  out = out.replace(/<a\b([^>]*)>/gi, (match, attrs) => {
    let style = "color: #457B9D; text-decoration: underline;";
    let tag = mergeStylesInTag(match, attrs, style);
    if (!/\btarget\s*=/i.test(tag)) {
      tag = tag.replace(/<a\b/i, '<a target="_blank"');
    }
    if (!/\brel\s*=/i.test(tag)) {
      tag = tag.replace(/<a\b/i, '<a rel="noopener noreferrer"');
    }
    return tag;
  });

  return out;
}

function mergeStylesInTag(tagHtml, attrs, defaultStyle) {
  const styleMatch = attrs.match(/\bstyle=["']([^"']*)["']/i);
  if (styleMatch) {
    const existingStyle = styleMatch[1].trim();
    const separator = existingStyle && !existingStyle.endsWith(";") ? ";" : "";
    const newStyle = `${defaultStyle} ${existingStyle}${separator}`;
    return tagHtml.replace(/\bstyle=["'][^"']*["']/i, `style="${newStyle}"`);
  } else {
    return tagHtml.slice(0, -1) + ` style="${defaultStyle}">`;
  }
}

module.exports = { normalizeInvitationHtml, formatHtmlForEmail };
