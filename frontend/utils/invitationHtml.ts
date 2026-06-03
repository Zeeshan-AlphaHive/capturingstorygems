/**
 * Normalize Quill HTML so blank lines, lists, and Enter key spacing render the same
 * in the editor and on the public invitation page.
 */

const LIST_TYPES = "bullet|ordered|checked|unchecked";

function ensureQuillListUi(html: string): string {
  return html.replace(
    new RegExp(
      `<li([^>]*\\bdata-list\\s*=\\s*["'](?:${LIST_TYPES})["'][^>]*)>(?!\\s*<span[^>]*\\bql-ui\\b)`,
      "gi"
    ),
    '<li$1><span class="ql-ui" contenteditable="false"></span>'
  );
}

function convertLegacyUlToQuill(html: string): string {
  return html.replace(/<ul\b([^>]*)>([\s\S]*?)<\/ul>/gi, (_match, _attrs, inner) => {
    const innerWithListType = inner.replace(
      /<li\b([^>]*)>/gi,
      (liMatch: string, liAttrs: string) => {
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

function stripBreakingInlineStyles(html: string): string {
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
function normalizeWrappingSpaces(html: string): string {
  return html
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/\u00a0/g, " ");
}

function removeSoftHyphens(html: string): string {
  return html.replace(/&shy;|&#173;/gi, "").replace(/\u00ad/g, "");
}

function repairLegacyOl(html: string): string {
  return html.replace(/<ol\b([^>]*)>([\s\S]*?)<\/ol>/gi, (match, attrs, inner) => {
    if (/\bdata-list\s*=/i.test(inner)) {
      return `<ol${attrs}>${ensureQuillListUi(inner)}</ol>`;
    }
    const innerWithListType = inner.replace(
      /<li\b([^>]*)>/gi,
      (liMatch: string, liAttrs: string) => {
        const a = (liAttrs || "").trim();
        if (/\bdata-list\s*=/i.test(a)) return liMatch;
        return a ? `<li data-list="ordered" ${a}>` : `<li data-list="ordered">`;
      }
    );
    return `<ol${attrs}>${ensureQuillListUi(innerWithListType)}</ol>`;
  });
}

export function normalizeInvitationHtml(html: string): string {
  if (!html) return "";

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
