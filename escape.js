// ============================================================
// escape.js — one shared HTML-escaping helper for CMS content.
//
// Why: text typed into the admin panel (service names, package
// items, FAQs, taglines, etc.) is inserted into the page HTML.
// If that text contains &, <, >, or quotes, it can break the
// page or inject unintended markup. Passing CMS-sourced *text*
// through esc() makes those characters display literally and
// safely. Structural HTML/SVG that the code itself builds
// (icons, buttons) is NOT escaped — only human-entered content.
//
// esc() — escape a single value.
// ============================================================

function esc(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================
// safeUrl() — CMS fields that become href/src attributes (social links,
// useful-links URLs, team photo paths) are admin-entered text, not code, but
// they still land directly in an attribute. A value like "javascript:..."
// would execute on click; this allows only the schemes those fields
// legitimately need (http/https/mailto/tel) plus scheme-less values
// (relative paths, protocol-relative "//", bare "#fragment"). Anything else
// is neutralized to "#" rather than rendered as-is.
// ============================================================
function safeUrl(url) {
  const s = (url == null ? '' : String(url)).trim();
  if (!s) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^(https?:|mailto:|tel:)/i.test(s)) return '#';
  return s;
}

// ============================================================
// internalHref() — Cloudflare Workers' static-asset serving redirects any
// *.html request to its extensionless equivalent by default (e.g.
// /calculators.html -> 307 -> /calculators). That means every internal link
// built as "foo.html" costs a redirect round-trip. This converts an internal
// *.html path (optionally with a #fragment) to the extensionless absolute
// path Cloudflare actually serves, so links go straight there. Anything that
// isn't an internal *.html path (mailto:, tel:, http(s)://, wa.me, a bare
// #fragment) is returned unchanged.
// ============================================================
function internalHref(href) {
  if (!href || /^(https?:|mailto:|tel:|#)/i.test(href)) return href;
  const [path, hash] = href.split('#');
  if (!path.endsWith('.html')) return href;
  const base = path === 'index.html' ? '' : path.slice(0, -'.html'.length);
  return '/' + base + (hash ? '#' + hash : '');
}

module.exports = { esc, safeUrl, internalHref };
