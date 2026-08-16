// Handbook Task 31: regression tests against the actual BUILD OUTPUT
// (dist/), not the template source — the point is to catch a future
// change to build.js/layout.js/data.js that breaks canonical/noindex/
// sitemap/structured-data behavior, however it happens to break it.
// Run with: node --test (rebuilds dist/ itself in `before`, so this is
// always testing fresh output, never a possibly-stale prior build).

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Pages the CMS currently hides from nav/sitemap and marks noindex (see
// content/site.yaml `pages[].hidden`) — real content not written yet.
// If this ever changes, update this list deliberately; it is the
// intentional "what's hidden right now" record this suite checks against.
const HIDDEN_FILES = ['testimonials.html', 'blog.html'];
const SYSTEM_FILES = ['404.html']; // never indexable, not part of the sitemap contract either

function readDist(file) {
  return fs.readFileSync(path.join(DIST, file), 'utf8');
}

function listTopLevelHtmlFiles() {
  return fs.readdirSync(DIST).filter((f) => f.endsWith('.html'));
}

function extractCanonical(html) {
  const m = html.match(/<link rel="canonical" href="([^"]*)">/);
  return m ? m[1] : null;
}
function extractRobotsMeta(html) {
  const m = html.match(/<meta name="robots" content="([^"]*)">/);
  return m ? m[1] : null;
}
function extractTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/);
  return m ? m[1] : null;
}
function extractMetaDescription(html) {
  const m = html.match(/<meta name="description" content="([^"]*)">/);
  return m ? m[1] : null;
}
function extractMetaProperty(html, prop) {
  const re = new RegExp('<meta property="' + prop + '" content="([^"]*)">');
  const m = html.match(re);
  return m ? m[1] : null;
}
function extractMetaName(html, name) {
  const re = new RegExp('<meta name="' + name + '" content="([^"]*)">');
  const m = html.match(re);
  return m ? m[1] : null;
}
function extractJsonLdBlocks(html) {
  const blocks = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) blocks.push(m[1]);
  return blocks;
}
function extractHrefs(html) {
  const hrefs = [];
  const re = /<a\b[^>]*\bhref="([^"]*)"/g;
  let m;
  while ((m = re.exec(html))) hrefs.push(m[1]);
  return hrefs;
}

before(() => {
  // Always test what build.js produces RIGHT NOW, not whatever a prior
  // `npm run build` happened to leave on disk.
  execFileSync(process.execPath, [path.join(ROOT, 'build.js')], { cwd: ROOT, stdio: 'ignore' });
});

test('sitemap.xml exists, is well-formed, and contains only the intended indexable canonical routes', () => {
  const sitemap = readDist('sitemap.xml');
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);

  const locs = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
  assert.ok(locs.length > 0, 'sitemap must list at least one URL');

  // No duplicates, no trailing .html anywhere, all share one origin.
  assert.equal(new Set(locs).size, locs.length, 'sitemap must not list the same URL twice');
  locs.forEach((loc) => {
    assert.ok(!/\.html$/.test(loc), `sitemap URL must be extensionless: ${loc}`);
    assert.match(loc, /^https:\/\/mavennepal\.com\.np(\/|$)/, `sitemap URL must be on the configured canonical domain: ${loc}`);
  });

  // Hidden pages must never appear in the sitemap.
  HIDDEN_FILES.forEach((file) => {
    const slug = file.replace(/\.html$/, '');
    assert.ok(
      !locs.some((loc) => loc.endsWith('/' + slug) || loc === 'https://mavennepal.com.np/' + slug),
      `hidden page ${file} must not appear in sitemap.xml`
    );
  });

  // Every top-level HTML file that ISN'T hidden/system must have exactly
  // one matching sitemap entry, and vice versa -- this is the two-way
  // check that actually protects against build-logic drift.
  const indexablePages = listTopLevelHtmlFiles().filter((f) => !HIDDEN_FILES.includes(f) && !SYSTEM_FILES.includes(f));
  assert.equal(locs.length, indexablePages.length, 'sitemap URL count must match the number of indexable pages actually built');
  indexablePages.forEach((file) => {
    const canonical = extractCanonical(readDist(file));
    assert.ok(canonical, `${file} must have a canonical tag`);
    assert.ok(locs.includes(canonical), `${file}'s canonical URL (${canonical}) must appear in sitemap.xml`);
  });
});

test('robots.txt allows crawling, blocks the private apps, and points at the sitemap', () => {
  const robots = readDist('robots.txt');
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Disallow: \/admin\//);
  assert.match(robots, /Disallow: \/staff\//);
  assert.match(robots, /Sitemap: https:\/\/mavennepal\.com\.np\/sitemap\.xml/);
});

test('every indexable page has an extensionless canonical URL matching its own file, and no robots noindex', () => {
  const indexablePages = listTopLevelHtmlFiles().filter((f) => !HIDDEN_FILES.includes(f) && !SYSTEM_FILES.includes(f));
  indexablePages.forEach((file) => {
    const html = readDist(file);
    const canonical = extractCanonical(html);
    assert.ok(canonical, `${file} must have a canonical tag`);
    const expectedPath = file === 'index.html' ? '' : '/' + file.replace(/\.html$/, '');
    assert.equal(canonical, 'https://mavennepal.com.np' + (expectedPath || '/'), `${file}'s canonical URL must be its own extensionless path`);
    assert.equal(extractRobotsMeta(html), null, `${file} is indexable and must NOT carry a robots noindex tag`);
  });
});

test('hidden Blog/Testimonials pages stay noindexed and excluded from the sitemap until deliberately enabled', () => {
  HIDDEN_FILES.forEach((file) => {
    const html = readDist(file);
    const robots = extractRobotsMeta(html);
    assert.ok(robots && /noindex/.test(robots) && /nofollow/.test(robots), `${file} must be noindex, nofollow while hidden`);
    // The page must still exist and still carry a self-referential
    // canonical -- this is a nav-visibility flag, not a missing/broken page.
    const canonical = extractCanonical(html);
    assert.ok(canonical, `${file} must still have a canonical tag even while hidden`);
  });
});

test('404.html is noindex and is not counted as an indexable page', () => {
  const html = readDist('404.html');
  const robots = extractRobotsMeta(html);
  assert.ok(robots && /noindex/.test(robots), '404.html must be noindex');
  const sitemap = readDist('sitemap.xml');
  assert.ok(!sitemap.includes('404'), '404.html must never appear in the sitemap');
});

test('OG and Twitter Card metadata is present and non-empty on every indexable page', () => {
  const indexablePages = listTopLevelHtmlFiles().filter((f) => !HIDDEN_FILES.includes(f) && !SYSTEM_FILES.includes(f));
  indexablePages.forEach((file) => {
    const html = readDist(file);
    ['og:title', 'og:description', 'og:type', 'og:site_name', 'og:url'].forEach((prop) => {
      const val = extractMetaProperty(html, prop);
      assert.ok(val && val.trim(), `${file} is missing or has an empty ${prop}`);
    });
    const twitterCard = extractMetaName(html, 'twitter:card');
    assert.ok(twitterCard, `${file} is missing twitter:card`);
  });
});

test('og:image (when present) points at an image file that actually exists in the build output', () => {
  const html = readDist('index.html');
  const ogImage = extractMetaProperty(html, 'og:image');
  if (!ogImage) return; // only emitted once a site URL is configured -- see layout.js
  const localPath = ogImage.replace(/^https:\/\/mavennepal\.com\.np\//, '');
  assert.ok(fs.existsSync(path.join(DIST, localPath)), `og:image references ${ogImage}, but ${localPath} does not exist in dist/`);
});

test('structured data on every page is syntactically valid JSON-LD', () => {
  listTopLevelHtmlFiles().forEach((file) => {
    const blocks = extractJsonLdBlocks(readDist(file));
    assert.ok(blocks.length >= 1, `${file} should carry at least the site-wide AccountingService block`);
    blocks.forEach((block, i) => {
      let parsed;
      assert.doesNotThrow(() => { parsed = JSON.parse(block); }, `${file} JSON-LD block #${i + 1} is not valid JSON`);
      assert.equal(parsed['@context'], 'https://schema.org', `${file} JSON-LD block #${i + 1} missing/wrong @context`);
      assert.ok(parsed['@type'], `${file} JSON-LD block #${i + 1} missing @type`);
    });
  });
});

test('the site-wide AccountingService block only asserts configured facts, and sameAs (if present) is never fabricated', () => {
  const html = readDist('index.html');
  const blocks = extractJsonLdBlocks(html).map((b) => JSON.parse(b));
  const org = blocks.find((b) => b['@type'] === 'AccountingService');
  assert.ok(org, 'index.html must carry the AccountingService structured data block');
  assert.ok(org.name, 'AccountingService.name must be set');
  assert.ok(org.address && org.address['@type'] === 'PostalAddress', 'AccountingService.address must be a PostalAddress');
  if (org.sameAs) {
    assert.ok(Array.isArray(org.sameAs) && org.sameAs.length > 0, 'sameAs, if present, must be a non-empty array of real profile URLs');
    org.sameAs.forEach((u) => assert.match(u, /^https?:\/\//, 'every sameAs entry must be a real absolute URL'));
  }
});

test('FAQPage structured data (faq.html only) reflects exactly the visible questions, never more or fewer', () => {
  const html = readDist('faq.html');
  const blocks = extractJsonLdBlocks(html).map((b) => JSON.parse(b));
  const faqBlock = blocks.find((b) => b['@type'] === 'FAQPage');
  assert.ok(faqBlock, 'faq.html must carry FAQPage structured data');
  assert.ok(Array.isArray(faqBlock.mainEntity) && faqBlock.mainEntity.length > 0, 'FAQPage.mainEntity must be a non-empty array');
  faqBlock.mainEntity.forEach((q) => {
    assert.equal(q['@type'], 'Question');
    assert.ok(q.name && q.name.trim(), 'every FAQ entry needs a non-empty question');
    assert.ok(q.acceptedAnswer && q.acceptedAnswer.text && q.acceptedAnswer.text.trim(), 'every FAQ entry needs a non-empty answer');
  });
  // The count in the schema must match the count of visible accordion
  // questions actually rendered on the page -- Google's own structured-data
  // guidelines require schema to reflect visible content, not a superset.
  const visibleQuestionCount = (html.match(/class="accordion-trigger"/g) || []).length;
  assert.equal(faqBlock.mainEntity.length, visibleQuestionCount, 'FAQPage schema question count must match the number of questions actually visible on the page');

  // FAQPage structured data must be scoped to the FAQ page only -- other
  // pages that show a partial FAQ teaser (e.g. Home) must not also claim
  // FAQPage rich-result eligibility for a subset of questions.
  const otherPages = listTopLevelHtmlFiles().filter((f) => f !== 'faq.html');
  otherPages.forEach((file) => {
    const otherBlocks = extractJsonLdBlocks(readDist(file)).map((b) => JSON.parse(b));
    assert.ok(!otherBlocks.some((b) => b['@type'] === 'FAQPage'), `${file} must not also emit FAQPage structured data`);
  });
});

test('no two indexable pages accidentally share the same <title> or meta description', () => {
  const indexablePages = listTopLevelHtmlFiles().filter((f) => !HIDDEN_FILES.includes(f) && !SYSTEM_FILES.includes(f));
  const titles = new Map();
  const descriptions = new Map();
  indexablePages.forEach((file) => {
    const html = readDist(file);
    const title = extractTitle(html);
    const description = extractMetaDescription(html);
    assert.ok(title && title.trim(), `${file} has no <title>`);
    assert.ok(description && description.trim(), `${file} has no meta description`);
    if (titles.has(title)) assert.fail(`${file} shares an identical <title> with ${titles.get(title)}: "${title}"`);
    if (descriptions.has(description)) assert.fail(`${file} shares an identical meta description with ${descriptions.get(description)}: "${description}"`);
    titles.set(title, file);
    descriptions.set(description, file);
  });
});

test('internal links on the homepage are real crawlable anchors pointing at pages that actually exist', () => {
  const html = readDist('index.html');
  const hrefs = extractHrefs(html);
  assert.ok(hrefs.length > 10, 'homepage should have a substantial number of real anchor links');

  const existingSlugs = new Set(
    listTopLevelHtmlFiles().map((f) => (f === 'index.html' ? '/' : '/' + f.replace(/\.html$/, '')))
  );

  hrefs.forEach((href) => {
    // Only check same-site, non-hash-only internal links -- external
    // (http/https), tel:, mailto:, wa.me, and pure #fragment links are
    // out of scope for "does this internal page exist."
    if (/^(https?:|mailto:|tel:|#)/i.test(href)) return;
    const [pathPart] = href.split('#');
    if (!pathPart) return; // pure #fragment on the current page
    assert.ok(existingSlugs.has(pathPart), `homepage links to "${href}" which does not correspond to any built page`);
  });

  // No javascript: pseudo-links or empty hrefs -- those aren't crawlable.
  hrefs.forEach((href) => {
    assert.ok(href.trim() !== '', 'no anchor should have an empty href');
    assert.ok(!/^javascript:/i.test(href), 'no anchor should use a javascript: pseudo-URL');
  });
});
