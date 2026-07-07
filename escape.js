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
// esc()      — escape a single value.
// escArr()   — escape an array of values (returns a new array).
// ============================================================

function esc(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escArr(arr) {
  return (Array.isArray(arr) ? arr : []).map(esc);
}

module.exports = { esc, escArr };
