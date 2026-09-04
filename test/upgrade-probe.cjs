// Verification probe for the Windows installer upgrade flow (test-only; it is
// not part of the application). test/make-release.cjs spawns it as:
//
//   <installed TextVault.exe> test/upgrade-probe.cjs
//
// with TEXTVAULT_USER_DATA pointing at an isolated profile and TEXTVAULT_E2E=1
// so the real application boots with its ?e2e=1 test hook. The probe requires
// the INSTALLED app's main.js (TV_APP_MAIN), reads the persisted stores
// through the app's own state layer, prints a single UPGRADE-PROBE line, and
// exits. It never writes user data itself.
'use strict';
const { app, BrowserWindow } = require('electron');

const APP_MAIN = process.env.TV_APP_MAIN;
const MARKER = process.env.TV_UPGRADE_MARKER || 'TV-UPGRADE-MARKER';
if (!APP_MAIN) {
  console.error('UPGRADE-PROBE-FATAL TV_APP_MAIN is not set');
  process.exit(1);
}
require(APP_MAIN); // boots the real application (window, IPC, clipboard monitor)

app.whenReady().then(async () => {
  try {
    let win = null;
    for (let i = 0; i < 80 && !win; i++) {
      win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
      if (!win) await new Promise((r) => setTimeout(r, 100));
    }
    if (!win) throw new Error('app window did not appear');

    let ready = false;
    for (let i = 0; i < 100 && !ready; i++) {
      try {
        ready = await win.webContents.executeJavaScript('!!(window.__TV_TEST__ && window.__TV_TEST__.ready)');
      } catch { /* mid-navigation */ }
      if (!ready) await new Promise((r) => setTimeout(r, 150));
    }
    if (!ready) throw new Error('test hook never became ready');

    // give the clipboard monitor one poll cycle so a fresh capture lands
    await new Promise((r) => setTimeout(r, 2500));

    const data = await win.webContents.executeJavaScript(`(() => {
      const H = window.__TV_TEST__;
      return {
        entries: H.App.liveEntries().length,
        clips: H.clipboard.count(),
        hasMarker: H.clipboard.has(${JSON.stringify(MARKER)}),
        version: (H.App.appInfo && H.App.appInfo.version) || null,
      };
    })()`);
    console.log('UPGRADE-PROBE ' + JSON.stringify(data));
    app.exit(0);
  } catch (err) {
    console.error('UPGRADE-PROBE-FATAL', err && err.message);
    app.exit(1);
  }
});
