// Release orchestrator: portable build -> smoke -> zip -> Inno Setup installer.
// Usage: node test/make-release.cjs [build|smoke|zip|installer|verify|upgrade|all]
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PKG_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
// Production builds use the package.json version. The upgrade verification
// builds two differently-labeled installers from this same source and
// overrides the label via TEXTVAULT_RELEASE_VERSION (test-only).
const VERSION = process.env.TEXTVAULT_RELEASE_VERSION || PKG_VERSION;
const RELEASE = path.join(ROOT, 'release');
const PORTABLE = (version) => path.join(RELEASE, `TextVault-${version}-Portable`);
const SETUP = (version) => path.join(RELEASE, `TextVault-${version}-Setup.exe`);
const INSTALL_DIR = path.join(os.tmpdir(), `tv-install-test-${Date.now()}`);
const START_MENU_LNK = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'TextVault.lnk');

const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function run(cmd, args, opts = {}) {
  console.log('>', cmd, args.join(' '));
  execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

/**
 * Locate an Inno Setup compiler without hardcoding one machine's layout:
 *   1. TEXTVAULT_ISCC — explicit override (CI-friendly)
 *   2. tools/innosetup/ISCC.exe — repo-local bundled compiler (gitignored)
 *   3. `where ISCC.exe` — PATH, which also covers Chocolatey shims
 *   4. the standard per-machine Inno Setup 6 install locations
 */
function findIscc() {
  const candidates = [];
  if (process.env.TEXTVAULT_ISCC) candidates.push(process.env.TEXTVAULT_ISCC);
  candidates.push(path.join(ROOT, 'tools', 'innosetup', 'ISCC.exe'));
  const where = spawnSync('where', ['ISCC.exe'], { encoding: 'utf8' });
  if (where.status === 0) {
    candidates.push(...where.stdout.split(/\r?\n/).filter((line) => line.trim()));
  }
  for (const dir of [
    'C:\\Program Files (x86)\\Inno Setup 6',
    'C:\\Program Files\\Inno Setup 6',
    'C:\\ProgramData\\Chocolatey\\bin',
  ]) {
    candidates.push(path.join(dir, 'ISCC.exe'));
  }
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return path.normalize(candidate);
  }
  return null;
}

function compileInstaller(version, iscc) {
  if (!fs.existsSync(PORTABLE(version))) {
    console.error(`Portable build missing for ${version} — run the build step first.`);
    process.exit(1);
  }
  run(iscc, [`/DMyAppVersion=${version}`, path.join(ROOT, 'installer.iss')], { cwd: ROOT });
  if (!fs.existsSync(SETUP(version))) {
    console.error('Installer was not produced.');
    process.exit(1);
  }
  console.log('installer:', SETUP(version), (fs.statSync(SETUP(version)).size / 1024 / 1024).toFixed(1), 'MB');
}

function installer() {
  const iscc = findIscc();
  if (!iscc) {
    console.error('Inno Setup compiler not found. Searched TEXTVAULT_ISCC, '
      + 'tools/innosetup/ISCC.exe, PATH (where ISCC.exe) and the standard '
      + 'Inno Setup 6 install locations. Install Inno Setup 6 or point '
      + 'TEXTVAULT_ISCC at ISCC.exe.');
    process.exit(1);
  }
  compileInstaller(VERSION, iscc);
}

function verify() {
  // 1. silent install into a temp dir (no admin: per-user)
  run(SETUP(VERSION), ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', `/DIR=${INSTALL_DIR}`]);
  const exe = path.join(INSTALL_DIR, 'TextVault.exe');
  if (!fs.existsSync(exe)) throw new Error('installed TextVault.exe not found');

  // 2. installed app boots (isolated userData) and stores data OUTSIDE the install dir
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-inst-user-'));
  const r = spawnSync(exe, ['--user-data-dir=' + userData], {
    env: { ...process.env, TEXTVAULT_SMOKE: '1', TEXTVAULT_USER_DATA: userData },
    encoding: 'utf8', timeout: 60000,
  });
  if (!String(r.stdout || '').includes('SMOKE OK')) throw new Error('installed app smoke failed: ' + r.stdout + r.stderr);
  const indexedDbInsideInstall = fs.existsSync(path.join(INSTALL_DIR, 'IndexedDB'));
  const dataInUserData = fs.existsSync(path.join(userData, 'IndexedDB'));
  console.log('installed app: SMOKE OK | data in userData:', dataInUserData, '| leaked into install dir:', indexedDbInsideInstall);
  if (indexedDbInsideInstall || !dataInUserData) throw new Error('data location check failed');

  // 2b. Start Menu shortcut exists (per-user install)
  const shortcutOk = fs.existsSync(START_MENU_LNK);
  console.log('Start Menu shortcut:', shortcutOk ? 'created' : 'MISSING', '(' + START_MENU_LNK + ')');
  if (!shortcutOk) throw new Error('Start Menu shortcut was not created');

  // 3. uninstall silently and confirm cleanup (standard Inno uninstaller)
  const unins = fs.readdirSync(INSTALL_DIR).find((f) => /^unins\d{3}\.exe$/i.test(f));
  if (!unins) throw new Error('uninstaller not found');
  run(path.join(INSTALL_DIR, unins), ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART']);
  const leftoverExe = fs.existsSync(exe);
  const leftoverShortcut = fs.existsSync(START_MENU_LNK);
  console.log('after uninstall: TextVault.exe still present =', leftoverExe, '| shortcut still present =', leftoverShortcut);
  if (leftoverExe || leftoverShortcut) throw new Error('uninstall did not clean up');

  fs.rmSync(userData, { recursive: true, force: true });
  console.log('VERIFY OK');
}

/* ------------------------------------------------------ upgrade verification */

/** Recursive relPath+size+sha256 manifest — proves a directory's bytes are untouched. */
function snapshotDir(root) {
  const lines = [];
  const walk = (dir, rel) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      const relPath = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(p, relPath);
      else {
        const buf = fs.readFileSync(p);
        lines.push(`${relPath} ${buf.length} ${crypto.createHash('sha256').update(buf).digest('hex')}`);
      }
    }
  };
  walk(root, '');
  return lines.sort().join('\n');
}

/** Snapshot once the directory has stopped changing (child processes may lag). */
function stableSnapshot(root) {
  let prev = snapshotDir(root);
  for (let i = 0; i < 10; i++) {
    sleepSync(1000);
    const next = snapshotDir(root);
    if (next === prev) return next;
    prev = next;
  }
  return prev;
}

function installedAppVersion(installDir) {
  return JSON.parse(fs.readFileSync(path.join(installDir, 'resources', 'app', 'package.json'), 'utf8')).version;
}

function bootSmoke(installDir, userDataDir, label) {
  const exe = path.join(installDir, 'TextVault.exe');
  const r = spawnSync(exe, ['--user-data-dir=' + userDataDir], {
    env: { ...process.env, TEXTVAULT_SMOKE: '1', TEXTVAULT_USER_DATA: userDataDir },
    encoding: 'utf8', timeout: 90000,
  });
  const out = String(r.stdout || '') + String(r.stderr || '');
  if (!out.includes('SMOKE OK')) throw new Error(`${label}: smoke boot failed: ${out}`);
  console.log(`${label}: installed app SMOKE OK`);
}

/**
 * Boot the installed app's code with its ?e2e=1 test hook (TEXTVAULT_E2E=1)
 * against the isolated profile and read the persisted stores through the
 * app's own state layer. The probe requires the INSTALLED app's main.js (so
 * the app:// protocol serves the installed resources), hosted on the repo's
 * bare Electron runtime — a packaged TextVault.exe always boots its own app
 * and cannot run an external script, and the repo dist is the exact runtime
 * build the installer was produced from.
 */
function probeData(installDir, userDataDir, marker, label) {
  const probeHost = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
  const r = spawnSync(probeHost, [path.join(__dirname, 'upgrade-probe.cjs')], {
    env: {
      ...process.env,
      TEXTVAULT_E2E: '1',
      TEXTVAULT_USER_DATA: userDataDir,
      TV_UPGRADE_MARKER: marker,
      TV_APP_MAIN: path.join(installDir, 'resources', 'app', 'electron', 'main.js'),
    },
    encoding: 'utf8', timeout: 120000,
  });
  const out = String(r.stdout || '') + String(r.stderr || '');
  const line = out.split(/\r?\n/).find((l) => l.startsWith('UPGRADE-PROBE '));
  if (!line) throw new Error(`${label}: data probe produced no result:\n${out.slice(0, 2000)}`);
  const data = JSON.parse(line.slice('UPGRADE-PROBE '.length));
  console.log(`${label}: data probe`, JSON.stringify(data));
  return data;
}

function setClipboardText(text) {
  spawnSync('powershell', ['-NoProfile', '-Command', `Set-Clipboard -Value "${text}"`], { encoding: 'utf8' });
}

/**
 * Real upgrade-over-existing-install verification: two installers built from
 * this source through the normal pipeline (they differ only in the version
 * label). Install A -> boot + capture a clipboard marker into the isolated
 * profile -> probe -> install B over A (same AppId/dir) -> the profile must be
 * byte-identical (nothing erased) -> boot B, marker still readable, version is
 * B, shortcuts intact -> uninstall removes the app but keeps user data.
 */
function upgrade() {
  const iscc = findIscc();
  if (!iscc) {
    console.error('Inno Setup compiler not found (see installer step message).');
    process.exit(1);
  }
  const VA = '1.0.0-upgrade-a';
  const VB = '1.0.0-upgrade-b';
  const marker = `TV-UPGRADE-MARKER ${Date.now()}`;
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-upgrade-work-'));
  const installDir = path.join(os.tmpdir(), `tv-upgrade-install-${Date.now()}`);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-upgrade-user-'));
  try {
    // build A, compile A, stash its setup (the next build wipes release/)
    run(process.execPath, [path.join(__dirname, 'make-portable.cjs'), 'build'],
      { env: { ...process.env, TEXTVAULT_RELEASE_VERSION: VA } });
    compileInstaller(VA, iscc);
    const setupA = path.join(workspace, 'setup-a.exe');
    fs.copyFileSync(SETUP(VA), setupA);
    // build B
    run(process.execPath, [path.join(__dirname, 'make-portable.cjs'), 'build'],
      { env: { ...process.env, TEXTVAULT_RELEASE_VERSION: VB } });
    compileInstaller(VB, iscc);

    /* ---- install VERSION A ---- */
    run(setupA, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', `/DIR=${installDir}`]);
    const exe = path.join(installDir, 'TextVault.exe');
    if (!fs.existsSync(exe)) throw new Error('A: installed TextVault.exe not found');
    if (installedAppVersion(installDir) !== VA) {
      throw new Error(`A: installed version is ${installedAppVersion(installDir)}, expected ${VA}`);
    }
    console.log(`A: installed ${VA} ->`, installDir);

    /* ---- boot A and create known test data: the clipboard monitor captures
       the marker into the app's real IndexedDB (isolated profile) ---- */
    setClipboardText(marker);
    bootSmoke(installDir, userData, 'A');
    sleepSync(1500);
    const probeA = probeData(installDir, userData, marker, 'A');
    if (!probeA.hasMarker || probeA.clips < 1) {
      throw new Error(`A: marker capture missing from persisted data: ${JSON.stringify(probeA)}`);
    }

    /* ---- snapshot the isolated profile (the user data the upgrade must keep) ---- */
    const before = stableSnapshot(userData);
    if (!before.includes('IndexedDB/')) throw new Error('A: no IndexedDB storage found in the profile');

    /* ---- install VERSION B over A ---- */
    run(SETUP(VB), ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', `/DIR=${installDir}`]);
    if (installedAppVersion(installDir) !== VB) {
      throw new Error(`B: installed version is ${installedAppVersion(installDir)}, expected ${VB}`);
    }
    console.log(`B: installed ${VB} over ${VA}`);

    /* ---- user data must be byte-identical after the upgrade ---- */
    const after = stableSnapshot(userData);
    if (before !== after) {
      const bLines = before.split('\n');
      const aLines = after.split('\n');
      const diff = [
        ...bLines.filter((l) => !aLines.includes(l)),
        ...aLines.filter((l) => !bLines.includes(l)),
      ];
      throw new Error('B: user data changed during upgrade:\n' + diff.slice(0, 10).join('\n'));
    }
    console.log(`B: user data byte-identical after upgrade (${before.split('\n').length} files)`);

    /* ---- boot B: same profile readable, marker survives, shortcuts intact ---- */
    setClipboardText(marker); // same content: dedupe keeps the history count stable
    const probeB = probeData(installDir, userData, marker, 'B');
    if (!probeB.hasMarker) throw new Error('B: captured marker lost after upgrade');
    if (probeB.clips < probeA.clips) {
      throw new Error(`B: clipboard history shrank across upgrade: ${probeA.clips} -> ${probeB.clips}`);
    }
    if (!fs.existsSync(START_MENU_LNK)) throw new Error('B: Start Menu shortcut missing after upgrade');

    /* ---- uninstall B: app files go, user data stays (documented policy) ---- */
    const unins = fs.readdirSync(installDir).find((f) => /^unins\d{3}\.exe$/i.test(f));
    if (!unins) throw new Error('B: uninstaller not found');
    run(path.join(installDir, unins), ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART']);
    sleepSync(1500);
    if (fs.existsSync(exe)) throw new Error('B: TextVault.exe survived uninstall');
    if (fs.existsSync(START_MENU_LNK)) throw new Error('B: Start Menu shortcut survived uninstall');
    if (!fs.existsSync(userData)) throw new Error('B: user data was deleted by uninstall');
    console.log('after uninstall: install files removed, shortcuts removed, user data kept (', userData, ')');
    console.log('UPGRADE OK');
  } finally {
    fs.rmSync(userData, { recursive: true, force: true });
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

const step = process.argv[2] || 'all';
if (step === 'installer' || step === 'all') installer();
if (step === 'verify' || step === 'all') verify();
if (step === 'upgrade') upgrade();
if (step === 'all') console.log('RELEASE DONE');
