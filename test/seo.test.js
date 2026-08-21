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
    // Task 11: previously relied on Twitter/X's undocumented fallback to
    // og:title/og:description when these are absent -- now set explicitly.
    ['twitter:title', 'twitter:description'].forEach((name) => {
      const val = extractMetaName(html, name);
      assert.ok(val && val.trim(), `${file} is missing or has an empty ${name}`);
    });
  });
});

test('og:image (when present) points at an image file that actually exists in the build output', () => {
  const html = readDist('index.html');
  const ogImage = extractMetaProperty(html, 'og:image');
  if (!ogImage) return; // only emitted once a site URL is configured -- see layout.js
  const localPath = ogImage.replace(/^https:\/\/mavennepal\.com\.np\//, '');
  assert.ok(fs.existsSync(path.join(DIST, localPath)), `og:image references ${ogImage}, but ${localPath} does not exist in dist/`);
});

// Task 20: prior tests only spot-checked specific images (favicon, og:image,
// hero preload). This is the blanket check -- every <img src="..."> on
// every built page (not just indexable ones, so admin/staff/hidden pages
// are covered too) must reference a file that actually exists in dist/.
test('every local <img src> referenced anywhere in the build output points at a file that actually exists', () => {
  const checked = [];
  function checkFile(relFile) {
    const html = fs.readFileSync(path.join(DIST, relFile), 'utf8');
    const srcs = Array.from(html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)).map((m) => m[1]);
    srcs.forEach((src) => {
      if (/^(https?:|data:)/i.test(src)) return; // external/inline, out of scope
      const localPath = src.replace(/^\//, '');
      checked.push(localPath);
      assert.ok(fs.existsSync(path.join(DIST, localPath)), `${relFile} references <img src="${src}">, but ${localPath} does not exist in dist/`);
    });
  }
  listTopLevelHtmlFiles().forEach(checkFile);
  ['admin/index.html', 'staff/index.html'].forEach(checkFile);
  assert.ok(checked.length > 10, 'sanity check: expected to find a substantial number of <img> references across the site');
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
  assert.ok(org.address.streetAddress && org.address.streetAddress.trim(), 'AccountingService.address.streetAddress must be non-empty');
  if (org.sameAs) {
    assert.ok(Array.isArray(org.sameAs) && org.sameAs.length > 0, 'sameAs, if present, must be a non-empty array of real profile URLs');
    org.sameAs.forEach((u) => assert.match(u, /^https?:\/\//, 'every sameAs entry must be a real absolute URL'));
  }
});

// Task 13: "one coherent organization/local-business entity with stable
// identifiers" -- every page's own AccountingService block must describe
// the exact same business, not per-page drift. Checking every indexable
// page (not just index.html) that a stable @id is present and byte-identical
// site-wide is what actually proves "one entity," not just "an entity."
test('every page\'s AccountingService block shares one identical, stable @id (one coherent entity, not per-page drift)', () => {
  const indexablePages = listTopLevelHtmlFiles().filter((f) => !HIDDEN_FILES.includes(f) && !SYSTEM_FILES.includes(f));
  const ids = new Set();
  indexablePages.forEach((file) => {
    const blocks = extractJsonLdBlocks(readDist(file)).map((b) => JSON.parse(b));
    const org = blocks.find((b) => b['@type'] === 'AccountingService');
    assert.ok(org, `${file} must carry the AccountingService structured data block`);
    assert.ok(org['@id'] && /^https:\/\/mavennepal\.com\.np\/#/.test(org['@id']), `${file}'s AccountingService @id must be a stable URI on the configured domain`);
    ids.add(org['@id']);
  });
  assert.equal(ids.size, 1, `all indexable pages must share the exact same @id -- found ${ids.size} distinct value(s): ${Array.from(ids).join(', ')}`);
});

// Task 15: breadcrumbNav() and breadcrumbJsonLd() (layout.js) are both built
// from the same items array by construction, but this proves it against
// real build output rather than just trusting the source -- the whole
// point of "structured data that matches visible content."
const BREADCRUMB_PAGES = [
  'outsourced-accounting.html', 'international-accounting.html', 'virtual-cfo.html',
  'nfrs-ifrs.html', 'packages.html', 'documents-needed.html', 'useful-links.html',
  'calculators.html', 'faq.html', 'team.html',
];
function extractVisibleBreadcrumbItems(html) {
  const navMatch = html.match(/<nav class="breadcrumb-nav"[^>]*>[\s\S]*?<\/nav>/);
  if (!navMatch) return null;
  const items = [];
  const liRe = /<li[^>]*>(?:<a href="([^"]*)">([^<]*)<\/a>|<span[^>]*>([^<]*)<\/span>)<\/li>/g;
  let m;
  while ((m = liRe.exec(navMatch[0]))) {
    items.push({ href: m[1] || null, label: m[2] || m[3] });
  }
  return items;
}

test('breadcrumbs only appear on pages genuinely nested under a hub, and the visible trail exactly matches the BreadcrumbList JSON-LD', () => {
  const indexablePages = listTopLevelHtmlFiles().filter((f) => !HIDDEN_FILES.includes(f) && !SYSTEM_FILES.includes(f));
  indexablePages.forEach((file) => {
    const html = readDist(file);
    const visible = extractVisibleBreadcrumbItems(html);
    const blocks = extractJsonLdBlocks(html).map((b) => JSON.parse(b));
    const bcBlock = blocks.find((b) => b['@type'] === 'BreadcrumbList');

    if (!BREADCRUMB_PAGES.includes(file)) {
      assert.equal(visible, null, `${file} is a top-level page and must not render a visible breadcrumb`);
      assert.ok(!bcBlock, `${file} is a top-level page and must not emit BreadcrumbList structured data`);
      return;
    }

    assert.ok(visible && visible.length >= 2, `${file} must render a visible breadcrumb with at least 2 items`);
    assert.ok(bcBlock, `${file} must emit BreadcrumbList structured data to match its visible breadcrumb`);
    assert.equal(visible[0].label, 'Home', `${file}'s breadcrumb must start with Home`);
    assert.equal(visible.length, bcBlock.itemListElement.length, `${file}: visible breadcrumb item count must match BreadcrumbList item count`);

    visible.forEach((item, i) => {
      const schemaItem = bcBlock.itemListElement[i];
      assert.equal(schemaItem.position, i + 1, `${file} breadcrumb item ${i + 1}: position must be sequential`);
      assert.equal(schemaItem.name, item.label, `${file} breadcrumb item ${i + 1}: visible label "${item.label}" must match schema name "${schemaItem.name}"`);
    });

    // The last visible item is the current page (not a link) -- its schema
    // counterpart's URL must be this exact page's own canonical URL.
    const lastSchemaItem = bcBlock.itemListElement[bcBlock.itemListElement.length - 1];
    const expectedPath = file === 'index.html' ? '' : '/' + file.replace(/\.html$/, '');
    assert.equal(lastSchemaItem.item, 'https://mavennepal.com.np' + (expectedPath || '/'), `${file}: the last breadcrumb item's schema URL must be this page's own canonical URL`);
  });
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

// Task 20: "meaningful," checked behaviorally -- never by asserting exact
// marketing copy (this task's own explicit instruction not to freeze
// sentences word-for-word). A title/description that's suspiciously short
// (a placeholder like "x" or "TBD") or that leaks a template artifact
// (an unresolved "undefined"/"null"/"[object Object]"/mustache brace from
// a broken CMS-override fallback) fails these checks regardless of what
// the actual wording says -- these are structural sanity checks, not
// content assertions.
test('titles and descriptions are meaningful (not placeholder-short) and never leak a template/fallback artifact', () => {
  const LEAK_PATTERNS = [/\bundefined\b/i, /\bnull\b/i, /\bNaN\b/, /\[object Object\]/, /\{\{/, /\}\}/, /<%/, /%>/];
  const indexablePages = listTopLevelHtmlFiles().filter((f) => !HIDDEN_FILES.includes(f) && !SYSTEM_FILES.includes(f));
  indexablePages.forEach((file) => {
    const html = readDist(file);
    const title = extractTitle(html);
    const description = extractMetaDescription(html);
    assert.ok(title.length >= 15, `${file}'s title ("${title}") looks too short to be meaningful (< 15 chars)`);
    assert.ok(description.length >= 40, `${file}'s description ("${description}") looks too short to be meaningful (< 40 chars)`);
    LEAK_PATTERNS.forEach((re) => {
      assert.ok(!re.test(title), `${file}'s title leaks a template/fallback artifact matching ${re}: "${title}"`);
      assert.ok(!re.test(description), `${file}'s description leaks a template/fallback artifact matching ${re}: "${description}"`);
    });
  });
});

// Task 20: the CMS SEO-override mechanism (content/site.yaml -> seo[file])
// currently has every field blank for every page, which means every title/
// description in the build right now is the build.js default, not an
// override -- exactly the "empty CMS SEO field" case this task asks to be
// verified as safe. This proves the fallback actually produces the real
// default text (not an empty string, not a literal "undefined") for every
// single page while overrides are unset, which is the current, real
// production configuration.
test('with every CMS SEO override currently blank, every page still renders its real default title/description, not an empty or leaked value', () => {
  const data = require(path.join(ROOT, 'data'));
  const seoOverrides = (data.brand && data.brand.seo) || {};
  const indexablePages = listTopLevelHtmlFiles().filter((f) => !HIDDEN_FILES.includes(f) && !SYSTEM_FILES.includes(f));
  indexablePages.forEach((file) => {
    const ov = seoOverrides[file] || {};
    assert.equal((ov.title || '').trim(), '', `test assumption broken: ${file} has a non-blank SEO title override configured -- update this test's expectations if that's now intentional`);
    assert.equal((ov.description || '').trim(), '', `test assumption broken: ${file} has a non-blank SEO description override configured -- update this test's expectations if that's now intentional`);
    const html = readDist(file);
    const title = extractTitle(html);
    const description = extractMetaDescription(html);
    assert.ok(title && title.trim() && title !== 'undefined' && title !== 'null', `${file}: blank SEO override must still fall back to a real title, got "${title}"`);
    assert.ok(description && description.trim() && description !== 'undefined' && description !== 'null', `${file}: blank SEO override must still fall back to a real description, got "${description}"`);
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

// Task 11: the homepage-only check above catches broken page-level links,
// but not a broken #fragment -- e.g. a page that links to
// "/services#registration" where the "registration" id no longer exists
// on the Services page. This is exactly the failure mode "preserve
// established public URLs and anchors" is meant to catch across the whole
// site, not just the homepage, so every indexable page is checked here.
test('every internal link on every indexable page (including #fragment anchors) resolves to a real page and, if present, a real element id', () => {
  const indexablePages = listTopLevelHtmlFiles().filter((f) => !HIDDEN_FILES.includes(f) && !SYSTEM_FILES.includes(f));
  const allBuiltFiles = listTopLevelHtmlFiles();
  const slugToFile = (slug) => (slug === '/' ? 'index.html' : slug.slice(1) + '.html');
  const fileToSlug = (file) => (file === 'index.html' ? '/' : '/' + file.replace(/\.html$/, ''));
  const allSlugs = new Set(allBuiltFiles.map(fileToSlug));

  const idCache = new Map();
  function idsForSlug(slug) {
    if (idCache.has(slug)) return idCache.get(slug);
    const file = slugToFile(slug);
    const ids = new Set();
    if (allBuiltFiles.includes(file)) {
      const re = /\bid="([^"]+)"/g;
      let m;
      while ((m = re.exec(readDist(file)))) ids.add(m[1]);
    }
    idCache.set(slug, ids);
    return ids;
  }

  indexablePages.forEach((file) => {
    const hrefs = extractHrefs(readDist(file));
    const ownSlug = fileToSlug(file);
    hrefs.forEach((href) => {
      if (/^(https?:|mailto:|tel:)/i.test(href)) return; // external, out of scope
      const [pathPart, fragment] = href.split('#');
      const targetSlug = pathPart || ownSlug; // "" pathPart means a same-page #fragment
      if (pathPart) {
        assert.ok(allSlugs.has(pathPart), `${file} links to "${href}" -> "${pathPart}", which does not correspond to any built page`);
      }
      if (fragment) {
        const ids = idsForSlug(targetSlug);
        assert.ok(ids.has(fragment), `${file} links to "${href}" -> #${fragment}, but no element with that id exists on ${slugToFile(targetSlug)}`);
      }
    });
  });
});

// Task 11: robots.txt Disallow blocks crawling, but a page discovered via
// an external link could still be indexed (without a snippet) without its
// own noindex meta tag -- both layers together are what actually keeps
// /admin/ and /staff/ out of search results.
test('/admin/ and /staff/ carry their own noindex meta tag, not just a robots.txt disallow', () => {
  ['admin/index.html', 'staff/index.html'].forEach((file) => {
    const html = readDist(file);
    const robots = extractRobotsMeta(html);
    assert.ok(robots && /noindex/.test(robots) && /nofollow/.test(robots), `${file} must carry its own noindex, nofollow meta tag`);
  });
});

test('favicon is referenced and the referenced file, plus the root favicon.ico fallback, both exist in the build output', () => {
  const html = readDist('index.html');
  const m = html.match(/<link rel="icon"[^>]*href="([^"]+)"/);
  assert.ok(m, 'index.html must have a <link rel="icon"> tag');
  const iconPath = m[1].replace(/^\//, '');
  assert.ok(fs.existsSync(path.join(DIST, iconPath)), `favicon link references ${m[1]}, but ${iconPath} does not exist in dist/`);
  // Browsers/crawlers also probe /favicon.ico at the root regardless of
  // the <link> tag (old bookmarks, some crawlers) -- both should exist.
  assert.ok(fs.existsSync(path.join(DIST, 'favicon.ico')), 'dist/favicon.ico must exist as the implicit root fallback icon');
});

// Task 18: measured (Playwright + CDP, throttled mobile) that the hero photo
// is the real LCP element on every page that has one, and that preloading
// it improved LCP 29-45% with zero added bytes (see docs/PERFORMANCE_AUDIT.md).
// This protects the fix from silently regressing, and confirms every
// referenced hero image actually exists in the build output.
test('every page with a hero photo (per build.js heroImage) gets a matching high-priority preload hint, and the referenced file exists', () => {
  const indexablePages = listTopLevelHtmlFiles().filter((f) => !HIDDEN_FILES.includes(f) && !SYSTEM_FILES.includes(f));
  const PAGES_WITH_HERO_PHOTO = new Set([
    'index.html', 'about.html', 'services.html', 'outsourced-accounting.html', 'global-outsourcing.html',
    'international-accounting.html', 'virtual-cfo.html', 'nfrs-ifrs.html', 'packages.html',
    'documents-needed.html', 'industries.html', 'useful-links.html', 'calculators.html', 'faq.html',
    'contact.html', 'team.html', 'privacy.html',
  ]);
  indexablePages.forEach((file) => {
    const html = readDist(file);
    const m = html.match(/<link rel="preload" as="image" href="([^"]+)" fetchpriority="high">/);
    if (PAGES_WITH_HERO_PHOTO.has(file)) {
      assert.ok(m, `${file} should have a hero-image preload hint`);
      const imgPath = m[1].replace(/^\//, '');
      assert.ok(fs.existsSync(path.join(DIST, imgPath)), `${file}'s preloaded image ${m[1]} does not exist in dist/`);
    } else {
      assert.ok(!m, `${file} has no photo hero and should not emit an image preload hint`);
    }
  });
});

// Task 19: googleSiteVerification is a CMS field (content/site.yaml ->
// brand.googleSiteVerification), never a hardcoded value in source --
// this protects that architecture. It's currently blank (no Search
// Console property has been verified via this method for this domain
// yet), so no tag should appear anywhere; if a real value is ever set,
// it should render as its own dedicated <meta> tag, not get silently
// dropped or duplicated.
test('no page hardcodes a google-site-verification value; the meta tag only appears when brand.googleSiteVerification is actually configured', () => {
  const data = require(path.join(ROOT, 'data'));
  const configuredToken = (data.brand.googleSiteVerification || '').trim();
  const indexablePages = listTopLevelHtmlFiles().filter((f) => !HIDDEN_FILES.includes(f) && !SYSTEM_FILES.includes(f));
  indexablePages.forEach((file) => {
    const html = readDist(file);
    const m = html.match(/<meta name="google-site-verification" content="([^"]*)">/);
    if (configuredToken) {
      assert.ok(m, `${file} should carry the configured google-site-verification tag`);
      assert.equal(m[1], configuredToken, `${file}'s verification content must match the configured brand.googleSiteVerification value exactly`);
    } else {
      assert.ok(!m, `${file} should not emit a google-site-verification tag while brand.googleSiteVerification is blank`);
    }
  });
});

// Task 16: these specific in-body (not header/footer nav) connections were
// found missing during this task's internal-linking audit and fixed --
// this protects each one from silently regressing. Scoped to <main> only,
// since the header/footer nav already links everywhere and would mask a
// real content-level gap.
function extractMainBodyHrefs(html) {
  const m = html.match(/<main id="main">([\s\S]*?)<\/main>/);
  if (!m) return [];
  return Array.from(m[1].matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)).map((mm) => mm[1]);
}
test('Task 16 internal-linking fixes: Services links to its own specialist pages; About links to Team; International Accounting links to Virtual CFO', () => {
  const servicesHrefs = extractMainBodyHrefs(readDist('services.html'));
  assert.ok(servicesHrefs.includes('/outsourced-accounting'), 'services.html body must link to /outsourced-accounting (its own specialist page)');
  assert.ok(servicesHrefs.includes('/nfrs-ifrs'), 'services.html body must link to /nfrs-ifrs (its own specialist page)');

  const aboutHrefs = extractMainBodyHrefs(readDist('about.html'));
  assert.ok(aboutHrefs.includes('/team'), 'about.html body must link to /team');

  const intlAccountingHrefs = extractMainBodyHrefs(readDist('international-accounting.html'));
  assert.ok(intlAccountingHrefs.includes('/virtual-cfo'), 'international-accounting.html body must link to /virtual-cfo');
});
