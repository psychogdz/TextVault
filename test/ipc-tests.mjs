// IPC boundary + architecture tests (plain Node, no Electron runtime).
// Part 1 unit-tests the pure IPC validators.
// Part 2 statically enforces the architecture boundaries:
//   - preload exposes only the documented window.tv API and no Node modules
//   - preload channel literals stay in sync with ipc/channels.js
//   - ipcMain handlers live only in ipc/register.js and register every channel
//   - the composition root (main.js) registers no handlers itself
//   - secure webPreferences and navigation/window guards are present

import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireCjs = createRequire(pathToFileURL(path.join(ROOT, 'package.json')));
const src = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

const v = requireCjs('./electron/ipc/validate.js');
const channels = requireCjs('./electron/ipc/channels.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (err) { failed++; console.error('  ✗', name, '\n    ', err.message); }
}

/* ============================ validators ============================ */

console.log('\nipc validators: export payload');
test('accepts a valid single export payload', () => {
  const res = v.validateExportPayload({
    kind: 'txt', mode: 'single', entries: [{ title: 't', content: 'hello', tags: ['a'] }],
    defaultName: 't.txt',
  });
  assert.equal(res.ok, true);
});
test('accepts a valid combined/separate export payload', () => {
  for (const mode of ['combined', 'separate']) {
    const res = v.validateExportPayload({
      kind: 'pdf', mode, entries: [{ content: 'a' }, { content: 'b' }],
    });
    assert.equal(res.ok, true, mode);
  }
});
test('rejects unknown kind/mode', () => {
  assert.equal(v.validateExportPayload({ kind: 'exe', mode: 'single', entries: [{ content: 'x' }] }).ok, false);
  assert.equal(v.validateExportPayload({ kind: 'txt', mode: 'many', entries: [{ content: 'x' }] }).ok, false);
});
test('rejects missing/empty/oversized entries', () => {
  const base = { kind: 'txt', mode: 'single' };
  assert.equal(v.validateExportPayload({ ...base }).ok, false);
  assert.equal(v.validateExportPayload({ ...base, entries: [] }).ok, false);
  assert.equal(v.validateExportPayload({ ...base, entries: 'x' }).ok, false);
  assert.equal(v.validateExportPayload({
    ...base,
    entries: Array.from({ length: v.MAX_EXPORT_ENTRIES + 1 }, () => ({ content: 'x' })),
  }).ok, false);
});
test('rejects entries without string content', () => {
  for (const bad of [{}, { content: 5 }, null, 'x']) {
    assert.equal(v.validateExportPayload({ kind: 'txt', mode: 'single', entries: [bad] }).ok, false);
  }
});
test('rejects oversized per-entry content and long titles', () => {
  const big = 'x'.repeat(v.MAX_EXPORT_CONTENT + 1);
  assert.equal(v.validateExportPayload({ kind: 'txt', mode: 'single', entries: [{ content: big }] }).ok, false);
  const longTitle = 't'.repeat(v.MAX_EXPORT_TITLE + 1);
  assert.equal(v.validateExportPayload({ kind: 'txt', mode: 'single', entries: [{ content: 'a', title: longTitle }] }).ok, false);
});
test('rejects wrong tag types and non-finite timestamps', () => {
  assert.equal(v.validateExportPayload({ kind: 'txt', mode: 'single', entries: [{ content: 'a', tags: 'x' }] }).ok, false);
  assert.equal(v.validateExportPayload({ kind: 'txt', mode: 'single', entries: [{ content: 'a', updatedAt: 'now' }] }).ok, false);
});
test('rejects non-object payloads and bad defaultName', () => {
  assert.equal(v.validateExportPayload(null).ok, false);
  assert.equal(v.validateExportPayload('x').ok, false);
  assert.equal(v.validateExportPayload({ kind: 'txt', mode: 'single', entries: [{ content: 'a' }], defaultName: 'x'.repeat(300) }).ok, false);
});

console.log('\nbackup format contract (shared/backup-format.mjs):');
const bf = requireCjs('./shared/backup-format.mjs');
test('buildBackupPayload emits a versioned v2 envelope', () => {
  const p = bf.buildBackupPayload({
    entries: [{ content: 'a' }],
    clipboard: [{ id: 'c1', content: 'b' }],
    snippets: [],
    collections: [{ id: 'k', name: 'Work' }],
  });
  assert.equal(p.format, 'textvault-backup');
  assert.equal(p.version, 2);
  assert.equal(typeof p.exportedAt, 'string');
  assert.equal(p.collections[0].name, 'Work');
});
test('validateBackupFile accepts v1 and v2 backups (absent arrays normalize to [])', () => {
  const v1 = bf.validateBackupFile({ format: 'textvault-backup', version: 1, entries: [{ content: 'a' }] });
  assert.equal(v1.ok, true);
  assert.deepEqual(v1.data.clipboard, []);
  const v2 = bf.validateBackupFile({
    format: 'textvault-backup', version: 2, entries: [{ content: 'a' }],
    clipboard: [{ id: 'c', content: 'b', createdAt: 1, updatedAt: 2 }],
    snippets: [], collections: [{ id: 'k', name: 'Work', createdAt: 1 }],
  });
  assert.equal(v2.ok, true);
  assert.equal(v2.data.clipboard.length, 1);
});
test('validateBackupFile rejects malformed/unsupported files', () => {
  assert.equal(bf.validateBackupFile(null).ok, false);
  assert.equal(bf.validateBackupFile('x').ok, false);
  assert.equal(bf.validateBackupFile({ format: 'other', version: 1, entries: [] }).ok, false);
  assert.equal(bf.validateBackupFile({ format: 'textvault-backup', version: 9, entries: [] }).ok, false);
  assert.equal(bf.validateBackupFile({ format: 'textvault-backup', version: 2 }).ok, false);
  assert.equal(bf.validateBackupFile({
    format: 'textvault-backup', version: 2, entries: [{ content: 5 }],
  }).ok, false);
  assert.equal(bf.validateBackupFile({
    format: 'textvault-backup', version: 2, entries: [],
    clipboard: [{ content: 'x'.repeat(10 * 1024 * 1024 + 1) }],
  }).ok, false);
  assert.equal(bf.validateBackupFile({
    format: 'textvault-backup', version: 2, entries: [], collections: [{ id: 'k' }],
  }).ok, false);
});
test('validateBackupExportPayload enforces bounds on all four arrays', () => {
  assert.equal(bf.validateBackupExportPayload({ entries: [{ content: 'a' }] }).ok, true);
  assert.equal(bf.validateBackupExportPayload(null).ok, false);
  assert.equal(bf.validateBackupExportPayload({ entries: 'x' }).ok, false);
  assert.equal(bf.validateBackupExportPayload({ entries: [{ content: null }] }).ok, false);
  assert.equal(bf.validateBackupExportPayload({
    entries: [{ content: 'x'.repeat(10 * 1024 * 1024 + 1) }],
  }).ok, false);
  assert.equal(bf.validateBackupExportPayload({
    entries: [], snippets: 'nope',
  }).ok, false);
});

console.log('\nipc validators: backup import opts');
test('allows no override and empty options', () => {
  assert.equal(v.validateBackupImportOpts(undefined).ok, true);
  assert.equal(v.validateBackupImportOpts(null).ok, true);
  assert.equal(v.validateBackupImportOpts({}).ok, true);
});
test('allows pathOverride only inside the test dir', () => {
  const testDir = path.join(ROOT, 'test-output');
  const inside = v.validateBackupImportOpts({ pathOverride: path.join(testDir, 'b.json') }, { testDir });
  assert.equal(inside.ok, true);
  const outside = v.validateBackupImportOpts({ pathOverride: 'C:\\Windows\\system32\\x.json' }, { testDir });
  assert.equal(outside.ok, false);
});
test('rejects pathOverride without a test dir (production is dialog-only)', () => {
  assert.equal(v.validateBackupImportOpts({ pathOverride: path.join(ROOT, 'x.json') }).ok, false);
});
test('rejects non-object import options', () => {
  assert.equal(v.validateBackupImportOpts('x').ok, false);
});

console.log('\nipc validators: open-path allowlist');
test('allows the exact allowed dir and its children', () => {
  const dir = path.join(ROOT, 'userdata');
  assert.equal(v.isPathAllowed(dir, [dir]), true);
  assert.equal(v.isPathAllowed(path.join(dir, 'IndexedDB'), [dir]), true);
});
test('rejects siblings, parents, traversal and junk', () => {
  const dir = path.join(ROOT, 'userdata');
  assert.equal(v.isPathAllowed(ROOT, [dir]), false);
  assert.equal(v.isPathAllowed(path.join(dir, '..', 'other'), [dir]), false);
  assert.equal(v.isPathAllowed('C:\\Windows', [dir]), false);
  assert.equal(v.isPathAllowed('', [dir]), false);
  assert.equal(v.isPathAllowed(null, [dir]), false);
  assert.equal(v.isPathAllowed(123, [dir]), false);
});

console.log('\nipc validators: clipboard write + empty payloads');
test('clipboard write accepts strings and nullish, rejects the rest', () => {
  assert.deepEqual(v.validateClipboardWrite('hello'), { ok: true, value: 'hello' });
  assert.equal(v.validateClipboardWrite(undefined).value, '');
  assert.equal(v.validateClipboardWrite(null).value, '');
  assert.equal(v.validateClipboardWrite(5).ok, false);
  assert.equal(v.validateClipboardWrite('x'.repeat(v.MAX_CLIPBOARD_WRITE + 1)).ok, false);
});
test('no-payload channels accept only empty payloads', () => {
  assert.equal(v.validateNoPayload(undefined), true);
  assert.equal(v.validateNoPayload(null), true);
  assert.equal(v.validateNoPayload({}), false);
});

/* ======================== architecture checks ======================== */

console.log('\narchitecture: preload boundary');
const preloadSrc = src('electron/preload.js');
const TV_METHODS = [
  'export', 'backupExport', 'backupImport', 'clipboardRead', 'clipboardWrite',
  'appInfo', 'openPath', 'onFlush', 'notifyFlushed', 'markDirty', 'onMenu',
  'clipboardState', 'clipboardSetPaused', 'clipboardSetEnabled',
  'clipboardGetPending', 'clipboardAck', 'onClipboardCaptured',
  'onClipboardStateChanged', 'onCloseRequest', 'closeResolve', 'openExternal',
  'quickHide', 'setShortcut', 'setLanguage', 'clipboardSetPrivate',
];
test('preload exposes exactly the documented window.tv methods', () => {
  for (const m of TV_METHODS) {
    assert.ok(preloadSrc.includes(`${m}:`), `missing tv.${m}`);
  }
  assert.ok(preloadSrc.includes("contextBridge.exposeInMainWorld('tv'"));
});
test('preload requires no Node/electron-internal modules', () => {
  const requires = [...preloadSrc.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
  assert.deepEqual(requires.sort(), ['electron']);
});
test('preload uses no generic renderer escape hatches', () => {
  assert.ok(!preloadSrc.includes('ipcRenderer.send('), 'no raw ipcRenderer.send');
  assert.ok(!preloadSrc.includes('window.ipc'), 'no window.ipc');
  assert.ok(!preloadSrc.includes('webFrame'), 'no webFrame');
});

console.log('\narchitecture: channel registry consistency');
test('registry names are static, namespaced strings', () => {
  for (const c of Object.values(channels.HANDLED)) assert.match(c, /^tv:[a-z-]+$/);
  for (const c of Object.values(channels.EMITTED)) assert.match(c, /^[a-z:-]+$/);
});
test('every channel-like literal in preload exists in the registry', () => {
  const registry = new Set([...Object.values(channels.HANDLED), ...Object.values(channels.EMITTED)]);
  const literals = [...preloadSrc.matchAll(/'([a-z]+:[a-z-]+|menu)'/g)].map((m) => m[1]);
  assert.ok(literals.length >= 9, `expected channel literals in preload, got ${literals.length}`);
  for (const lit of literals) {
    assert.ok(registry.has(lit), `preload channel '${lit}' missing from ipc/channels.js`);
  }
});
test('no ipcMain handler literals outside the registry', () => {
  const registry = new Set([...Object.values(channels.HANDLED), ...Object.values(channels.EMITTED)]);
  const files = [
    'electron/main.js', 'electron/preload.js',
    'electron/ipc/channels.js', 'electron/ipc/validate.js', 'electron/ipc/register.js',
    'electron/services/app-protocol.js', 'electron/services/window.js',
    'electron/services/menu.js', 'electron/services/export-service.js',
    'electron/services/file-dialogs.js',
  ];
  for (const f of files) {
    const code = src(f);
    const literals = [...code.matchAll(/ipcMain\.(?:handle|on)\(\s*'([^']+)'/g)].map((m) => m[1]);
    for (const lit of literals) {
      assert.ok(registry.has(lit), `${f}: handler '${lit}' not in registry`);
    }
  }
});
test('register.js registers every HANDLED channel', () => {
  const reg = src('electron/ipc/register.js');
  for (const name of Object.keys(channels.HANDLED)) {
    const count = [...reg.matchAll(new RegExp(`HANDLED\\.${name}\\b`, 'g'))].length;
    assert.ok(count >= 1, `HANDLED.${name} is never registered`);
  }
});
test('ipcMain handlers exist only in ipc/register.js', () => {
  const others = [
    'electron/main.js',
    'electron/services/app-protocol.js', 'electron/services/window.js',
    'electron/services/menu.js', 'electron/services/export-service.js',
    'electron/services/file-dialogs.js', 'electron/services/clipboard-service.js',
    'electron/services/tray.js',
  ];
  for (const f of others) {
    assert.ok(!src(f).includes('ipcMain.'), `${f} must not register IPC handlers`);
  }
});

console.log('\narchitecture: composition root + window security');
test('secure webPreferences are present', () => {
  const w = src('electron/services/window.js');
  assert.ok(w.includes('contextIsolation: true'));
  assert.ok(w.includes('nodeIntegration: false'));
  assert.ok(w.includes('sandbox: true'));
});
test('window.open is denied and navigation is guarded', () => {
  const w = src('electron/services/window.js');
  assert.ok(w.includes("setWindowOpenHandler(() => ({ action: 'deny' }))"));
  assert.ok(w.includes('will-navigate'));
});
test('open-path handler is allowlisted to userData', () => {
  const r = src('electron/ipc/register.js');
  assert.match(r, /isPathAllowed\(p,\s*\[app\.getPath\('userData'\)\]\)/);
});
test('backup import accepts pathOverride only via the test-dir validator', () => {
  const r = src('electron/ipc/register.js');
  assert.match(r, /validateBackupImportOpts\(opts,\s*\{\s*testDir:\s*TEST_DIR\s*\}\)/);
});

console.log('\narchitecture: tray double-click restore (v2.0.0 regression)');
test('tray binds the double-click event to the window-show action', () => {
  const t = src('electron/services/tray.js');
  assert.match(t, /tray\.on\('double-click'/, 'tray must listen for double-click');
  assert.match(t, /double-click'[^]*?actions\.showWindow\(\)/, 'double-click must route to showWindow');
});
test('tray showWindow is wired to the main-window restore/focus path', () => {
  const m = src('electron/main.js');
  assert.match(m, /createTray\([\s\S]*?showWindow:\s*\(\)\s*=>\s*focusMainWindow\(\)/);
});

console.log('\narchitecture: production startup never executes test/temp scripts');
test('package entry points stay on the production runtime', () => {
  const pkg = JSON.parse(src('package.json'));
  assert.equal(pkg.main, 'electron/main.js', 'npm start must boot electron/main.js');
  assert.equal(pkg.scripts.start, 'electron .');
});
test('main process never spawns/forks scripts or generates temp harness files', () => {
  const walk = (dir) => readdirSync(dir, { recursive: true })
    .filter((f) => f.endsWith('.js')).map((f) => path.join(dir, f));
  for (const file of [...walk('electron')]) {
    const code = src(path.relative(ROOT, file));
    assert.ok(!/mkdtemp|spawn\(|fork\(/.test(code), `${file} must not create/spawn scripts`);
    assert.ok(!/\brequire\(\s*[^'" )]/.test(code), `${file} must not dynamically require paths`);
    assert.ok(!/AppData|%TEMP%|tv-focus|tv-e2e/.test(code), `${file} must not reference temp harness dirs`);
  }
});
test('test-mode switches are limited to the documented hooks', () => {
  // The ONLY test-mode entry points: the e2e env var selects the ?e2e=1 URL,
  // and the renderer creates the test hook solely under that query param.
  const w = src('electron/services/window.js');
  assert.ok(w.includes("loadURL(process.env.TEXTVAULT_E2E"), 'e2e env var may only select the e2e URL');
  const app = src('src/js/app.js');
  assert.ok(app.includes("get('e2e') === '1'"), 'renderer test hook must be guarded by the e2e query param');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
