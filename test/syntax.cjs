// Syntax-check renderer ES modules (files use ESM syntax but .js extension).
// Copies each to a temp .mjs and runs node --check.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const files = [
  'src/js/app.js',
  'src/js/state.js',
  'src/js/core/db.js',
  'src/js/core/entry.js',
  'src/js/core/clipboard.js',
  'src/js/search/search.js',
  'src/js/ui/icons.js',
  'src/js/ui/components.js',
  'src/js/ui/virtual-grid.js',
  'src/js/views/dashboard.js',
  'src/js/views/editor.js',
  'src/js/views/trash.js',
  'src/js/views/settings.js',
  'src/js/views/clipboard.js',
];

let failed = 0;
const tmp = path.join(os.tmpdir(), 'tv-syntax-' + Date.now());
fs.mkdirSync(tmp, { recursive: true });
for (const f of files) {
  const target = path.join(tmp, path.basename(f).replace(/\.js$/, '.mjs'));
  fs.copyFileSync(f, target);
  try {
    execFileSync(process.execPath, ['--check', target], { stdio: 'pipe' });
    console.log('OK  ', f);
  } catch (err) {
    failed++;
    console.error('FAIL', f);
    console.error(String(err.stderr || err.message));
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
