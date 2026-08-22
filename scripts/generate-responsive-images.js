// Generates smaller width variants of the site's large photo assets (page
// hero backgrounds and service card photos) so mobile/tablet visitors don't
// download the same full desktop-resolution JPEG as a 1920px-wide desktop
// screen. Runs after build.js (which copies images/ to dist/images/
// verbatim) as its own step -- kept separate rather than folded into
// build.js because build.js is a synchronous script end-to-end and sharp's
// resize pipeline is async; splitting them avoids restructuring the whole
// file for one feature.
//
// Only the two photo families actually referenced with srcset/image-set
// (see pageHero() and capabilityChapter() in ui.js) are processed --
// logo-icon.png (favicon source, fixed size) and og-image.png (social
// share meta image, must stay one fixed file per the Open Graph spec) are
// left untouched.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'images');
const OUT_DIR = path.join(ROOT, 'dist', 'images');

// Matches RESPONSIVE_WIDTHS in ui.js -- keep both in sync if this changes.
// Only two generated tiers; the original file (already copied verbatim by
// build.js) serves as the third, largest tier for wide desktop viewports,
// so there's no need to also generate a near-original-size third file.
const WIDTHS = [640, 960];
const JPEG_QUALITY = 78;

function isResponsivePhoto(file) {
  return /^card-[a-z-]+\.jpg$/.test(file) || /(^|-)hero-bg\.jpg$/.test(file);
}

async function run() {
  if (!fs.existsSync(SRC_DIR)) return;
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = fs.readdirSync(SRC_DIR).filter(isResponsivePhoto);
  let written = 0;
  let skipped = 0;

  for (const file of files) {
    const base = file.slice(0, -path.extname(file).length);
    const srcPath = path.join(SRC_DIR, file);
    const metadata = await sharp(srcPath).metadata();

    for (const width of WIDTHS) {
      if (!metadata.width || width >= metadata.width) { skipped += 1; continue; }
      const outPath = path.join(OUT_DIR, `${base}-${width}w.jpg`);
      await sharp(srcPath)
        .resize({ width, withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY })
        .toFile(outPath);
      written += 1;
    }
  }

  console.log(`Generated ${written} responsive image variant(s) in dist/images/ (${skipped} skipped: source narrower than target width)`);
}

run().catch((err) => {
  console.error('generate-responsive-images.js failed:', err);
  process.exit(1);
});
