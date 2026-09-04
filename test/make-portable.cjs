// Assembles the portable Windows distribution without electron-builder:
//   release/TextVault-<version>-Portable/TextVault.exe + resources/app
// Then zips it into release/TextVault-<version>-Portable.zip
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
// Production builds use the package.json version. The installer upgrade
// verification (test/make-release.cjs upgrade) builds two differently-labeled
// installers from this same source and overrides the label via this variable.
const VERSION = process.env.TEXTVAULT_RELEASE_VERSION
  || JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const RELEASE = path.join(ROOT, 'release');
const APP = path.join(RELEASE, `TextVault-${VERSION}-Portable`);
const APP_RESOURCES = path.join(APP, 'resources', 'app');

/* ---- collect production node_modules (docx + transitive deps) ---- */
function pkgRoot(name, from = ROOT) {
  let resolved;
  try {
    resolved = require.resolve(name, { paths: [from] });
  } catch {
    return null;
  }
  // core modules (e.g. string_decoder) resolve to bare specifiers — skip
  if (!path.isAbsolute(resolved)) return null;
  let dir = path.dirname(resolved);
  let prev = null;
  while (dir !== path.parse(dir).root && dir !== prev) {
    prev = dir;
    const pj = path.join(dir, 'package.json');
    if (fs.existsSync(pj)) {
      const m = JSON.parse(fs.readFileSync(pj, 'utf8'));
      if (m.name === name) return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

const copied = new Set();
function collect(name, from = ROOT) {
  if (copied.has(name)) return;
  copied.add(name);
  const root = pkgRoot(name, from);
  if (!root) {
    console.warn('  (skipping unresolvable/core dependency:', name + ')');
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const target = path.join(APP_RESOURCES, 'node_modules', name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(root, target, { recursive: true });
  for (const dep of Object.keys(manifest.dependencies || {})) collect(dep, root);
}

function build() {
  fs.rmSync(RELEASE, { recursive: true, force: true });
  fs.mkdirSync(APP_RESOURCES, { recursive: true });

  // 1. runtime = the exact electron dist the app was tested with
  fs.cpSync(path.join(ROOT, 'node_modules', 'electron', 'dist'), APP, { recursive: true });

  // 2. application code
  for (const dir of ['electron', 'src', 'shared']) {
    fs.cpSync(path.join(ROOT, dir), path.join(APP_RESOURCES, dir), { recursive: true });
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const slim = {
    name: manifest.name,
    productName: manifest.productName,
    version: VERSION,
    description: manifest.description,
    main: manifest.main,
    license: manifest.license,
  };
  fs.writeFileSync(path.join(APP_RESOURCES, 'package.json'), JSON.stringify(slim, null, 2));
  fs.copyFileSync(path.join(ROOT, 'README.md'), path.join(APP_RESOURCES, 'README.md'));

  // 3. production dependencies
  collect('docx');

  // 4. branded exe name
  fs.renameSync(path.join(APP, 'electron.exe'), path.join(APP, 'TextVault.exe'));

  console.log('assembled', APP);
}

function smoke() {
  const userData = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'tv-smoke-'));
  const env = { ...process.env, TEXTVAULT_SMOKE: '1' };
  console.log('smoke test: launching TextVault.exe ...');
  try {
    const out = execFileSync(path.join(APP, 'TextVault.exe'), ['--user-data-dir=' + userData], {
      env,
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const text = String(out);
    console.log(text.trim());
    if (!text.includes('SMOKE OK')) {
      console.error('SMOKE FAILED');
      process.exit(1);
    }
  } catch (err) {
    console.error('smoke run failed:', err.stdout && String(err.stdout), err.stderr && String(err.stderr), err.message);
    process.exit(1);
  }
}

function zip() {
  const zipPath = path.join(RELEASE, `TextVault-${VERSION}-Portable.zip`);
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath);
  // A freshly executed/scanned exe (Defender, indexer) can be transiently
  // locked — retry the compression instead of failing the release on a
  // timing race (same robustness layer as the E2E output cleanup).
  const attempts = 5;
  for (let attempt = 1; ; attempt++) {
    try {
      execFileSync('powershell', ['-NoProfile', '-Command',
        `Compress-Archive -Path "${APP}" -DestinationPath "${zipPath}" -CompressionLevel Optimal -Force`], { stdio: 'inherit' });
      break;
    } catch (err) {
      if (attempt >= attempts) throw err;
      console.log(`zip attempt ${attempt} failed (${err.status || err.message}) — retrying in 3s...`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
    }
  }
  const size = fs.statSync(zipPath).size;
  console.log('zip:', zipPath, (size / 1024 / 1024).toFixed(1), 'MB');
}

const step = process.argv[2] || 'all';
if (step === 'build' || step === 'all') build();
if (step === 'smoke' || step === 'all') smoke();
if (step === 'zip' || step === 'all') zip();
if (step === 'all') console.log('DONE');
