// Release orchestrator: portable build -> smoke -> zip -> Inno Setup installer.
// Usage: node test/make-release.cjs [build|smoke|zip|installer|verify|all]
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const RELEASE = path.join(ROOT, 'release');
const PORTABLE = path.join(RELEASE, `TextVault-${VERSION}-Portable`);
const SETUP = path.join(RELEASE, `TextVault-${VERSION}-Setup.exe`);
const ISCC = path.join(ROOT, 'tools', 'innosetup', 'ISCC.exe');
const INSTALL_DIR = path.join(os.tmpdir(), `tv-install-test-${Date.now()}`);

function run(cmd, args, opts = {}) {
  console.log('>', cmd, args.join(' '));
  execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

function installer() {
  if (!fs.existsSync(ISCC)) {
    console.error('Inno Setup compiler not found at', ISCC);
    process.exit(1);
  }
  if (!fs.existsSync(PORTABLE)) {
    console.error('Portable build missing — run the build step first.');
    process.exit(1);
  }
  run(ISCC, [`/DMyAppVersion=${VERSION}`, path.join(ROOT, 'installer.iss')], { cwd: ROOT });
  if (!fs.existsSync(SETUP)) {
    console.error('Installer was not produced.');
    process.exit(1);
  }
  console.log('installer:', SETUP, (fs.statSync(SETUP).size / 1024 / 1024).toFixed(1), 'MB');
}

function verify() {
  // 1. silent install into a temp dir (no admin: per-user)
  run(SETUP, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', `/DIR=${INSTALL_DIR}`]);
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
  const startMenu = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'TextVault.lnk');
  const shortcutOk = fs.existsSync(startMenu);
  console.log('Start Menu shortcut:', shortcutOk ? 'created' : 'MISSING', '(' + startMenu + ')');
  if (!shortcutOk) throw new Error('Start Menu shortcut was not created');

  // 3. uninstall silently and confirm cleanup (standard Inno uninstaller)
  const unins = fs.readdirSync(INSTALL_DIR).find((f) => /^unins\d{3}\.exe$/i.test(f));
  if (!unins) throw new Error('uninstaller not found');
  run(path.join(INSTALL_DIR, unins), ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART']);
  const leftoverExe = fs.existsSync(exe);
  const leftoverShortcut = fs.existsSync(startMenu);
  console.log('after uninstall: TextVault.exe still present =', leftoverExe, '| shortcut still present =', leftoverShortcut);
  if (leftoverExe || leftoverShortcut) throw new Error('uninstall did not clean up');

  fs.rmSync(userData, { recursive: true, force: true });
  console.log('VERIFY OK');
}

const step = process.argv[2] || 'all';
if (step === 'installer' || step === 'all') installer();
if (step === 'verify' || step === 'all') verify();
if (step === 'all') console.log('RELEASE DONE');
