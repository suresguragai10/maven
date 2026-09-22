const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const pages = fs.readFileSync(path.join(ROOT, 'pages6.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const yaml = fs.readFileSync(path.join(ROOT, 'content', 'site.yaml'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');

test('Team page is positioned as a Kathmandu-based multidisciplinary finance team', () => {
  assert.match(yaml, /title: Finance Experience, Close to the Work/);
  assert.match(yaml, /experience\s+across audit, banking, risk, reporting, and business advisory/);
  assert.match(build, /Our Team \| Accounting, Tax & Finance Professionals \| Maven Consultancy/);
  assert.match(build, /Kathmandu-based team with experience across accounting, tax, audit, banking, risk, compliance, reporting and business advisory/);
});

test('Team hero explains the operating model rather than only listing people', () => {
  assert.match(pages, /How the team works/);
  assert.match(pages, /Hands-on delivery/);
  assert.match(pages, /Relevant review/);
  assert.match(pages, /Direct communication/);
  assert.match(pages, /Confidential handling/);
  assert.match(pages, /Meet the Team/);
});

test('Team page preserves every supplied profile and keeps long bios accessible', () => {
  assert.match(pages, /data\.teamMembers/);
  assert.match(pages, /splitTeamBio/);
  assert.match(pages, /Read full profile/);
  assert.match(pages, /member\.bio/);
  assert.match(pages, /member\.photo/);
  assert.match(pages, /team-profile-initials/);
});

test('Team page distinguishes founders from wider advisory and client delivery roles using published roles', () => {
  assert.match(pages, /\/founder\/i\.test\(member\.role/);
  assert.match(pages, /Founders/);
  assert.match(pages, /Advisory & Client Delivery/);
  assert.match(pages, /Specialist perspective and hands-on finance support/);
});

test('Team page is explicit about Kathmandu base and remote collaboration boundaries', () => {
  assert.match(pages, /Kathmandu Operating Base/);
  assert.match(pages, /Remote Collaboration/);
  assert.match(pages, /does not present those locations as separate overseas offices/);
  assert.match(pages, /global-outsourcing\.html/);
  assert.doesNotMatch(pages, /24\/7|global offices|guaranteed/i);
});

test('Team page makes working standards and professional process visible', () => {
  assert.match(pages, /Working Standards/);
  assert.match(pages, /Scope before activity/);
  assert.match(pages, /Review where it matters/);
  assert.match(pages, /Explain exceptions early/);
  assert.match(pages, /Keep access disciplined/);
  assert.match(pages, /about\.html/);
});

test('Team hero uses responsive image tiers aligned with the build preload strategy', () => {
  assert.match(css, /team-hero-bg-640w\.jpg/);
  assert.match(css, /team-hero-bg-960w\.jpg/);
  assert.match(css, /@media \(min-width:1280px\)[\s\S]*?\.team-premium-hero/);
  assert.match(build, /file: 'team\.html'[\s\S]*?heroImage: '\/images\/team-hero-bg\.jpg'/);
});

test('Team page has dedicated mobile composition and reduced-motion handling', () => {
  assert.match(css, /@media \(max-width:720px\)[\s\S]*?\.team-profile-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /\.team-reach-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /\.team-[^\n{]+\{[^}]*width:\s*100vw/);
});
