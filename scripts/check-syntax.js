const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'playwright-report', 'test-results']);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
}

walk(ROOT);
files.sort();
let failed = 0;
for (const file of files) {
  const rel = path.relative(ROOT, file);
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed += 1;
    process.stderr.write(`FAIL ${rel}\n${result.stderr || result.stdout || ''}\n`);
  }
}

if (failed) {
  console.error(`JavaScript syntax: ${failed} failed / ${files.length} checked`);
  process.exit(1);
}
console.log(`JavaScript syntax: ${files.length} passed / 0 failed`);
