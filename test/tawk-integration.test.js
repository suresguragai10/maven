const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('Tawk live-chat loader uses the supplied property/widget ID from the external client bundle', () => {
  const client = read('client.js');
  assert.match(client, /https:\/\/embed\.tawk\.to\/6aaececb3c4ce434465d8a67\/1k2tdfjf3/);
  assert.match(client, /maven-tawk-widget/);
  assert.match(client, /window\.Tawk_API/);
});

test('public CSP allows current Tawk widget resources without weakening inline-script policy', () => {
  const build = read('build.js');
  const publicCspStart = build.indexOf('const csp = [');
  const publicCspEnd = build.indexOf("].join('; ');", publicCspStart);
  const csp = build.slice(publicCspStart, publicCspEnd);

  assert.match(csp, /script-src[^\n]*https:\/\/\*\.tawk\.to[^\n]*https:\/\/cdn\.jsdelivr\.net/);
  assert.match(csp, /connect-src[^\n]*https:\/\/\*\.tawk\.to[^\n]*wss:\/\/\*\.tawk\.to/);
  assert.match(csp, /frame-src[^\n]*https:\/\/\*\.tawk\.to/);
  assert.match(csp, /form-action[^\n]*https:\/\/\*\.tawk\.to/);
  assert.doesNotMatch(csp.match(/script-src[^\n]*/)[0], /unsafe-inline/);
});

test('site copy discloses Tawk and avoids a duplicate floating WhatsApp launcher', () => {
  const layout = read('layout.js');
  const content = read('content/site.yaml');
  const styles = read('styles.css');

  assert.doesNotMatch(layout, /class="whatsapp-float"/);
  assert.match(layout, /Tawk\.to live chat/);
  assert.match(content, /provided through Tawk\.to/);
  assert.match(content, /Cookies and live-chat storage/);
  assert.match(styles, /--chat-launcher-reserve/);
});
