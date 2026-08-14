// Minimal static file server for dist/, used only by the Playwright
// harness (playwright.config.js webServer). No new dependency: this is
// deliberately hand-rolled with Node's built-in http/fs instead of
// pulling in `serve`/`http-server`, since the only thing needed is
// "serve a folder of already-built files over HTTP" — Playwright itself
// starts and stops this process automatically per test run.
//
// Mimics the production-relevant pieces of Cloudflare's static-asset
// routing (see wrangler.jsonc / dist/_headers) closely enough for UI
// tests: extensionless clean URLs (/faq -> faq.html), a 404 fallback,
// and directory index resolution (/staff/ -> staff/index.html). It does
// NOT reproduce dist/_headers' CSP/security headers -- this harness
// tests UI behavior, not header delivery, and Cloudflare's own _headers
// handling isn't something a local Node server can faithfully emulate
// without re-parsing that file (kept out of scope; revisit if a future
// task specifically needs to test response headers).

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', 'dist');
const PORT = process.env.UI_TEST_PORT || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  let candidate = path.normalize(path.join(ROOT, decoded));
  if (!candidate.startsWith(ROOT)) return null; // path traversal guard

  const tryPaths = [];
  if (decoded.endsWith('/')) {
    tryPaths.push(path.join(candidate, 'index.html'));
  } else {
    tryPaths.push(candidate);
    tryPaths.push(candidate + '.html');
    tryPaths.push(path.join(candidate, 'index.html'));
  }
  for (const p of tryPaths) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}

const server = http.createServer((req, res) => {
  const file = resolveFile(req.url);
  if (!file) {
    const notFound = path.join(ROOT, '404.html');
    if (fs.existsSync(notFound)) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(notFound).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
    return;
  }
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`UI test server listening on http://localhost:${PORT} (serving ${ROOT})`);
});
