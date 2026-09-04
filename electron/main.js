'use strict';

// TextVault — main process composition root.
// Responsibilities live in focused modules:
//   services/app-protocol.js  app:// scheme (src/ + shared/, path-contained)
//   services/window.js        main window lifecycle + quit-time save flush
//   services/menu.js          application menu
//   services/export-service.js TXT/DOCX/PDF rendering
//   services/file-dialogs.js  native dialogs + atomic file writes
//   ipc/channels.js           channel name registry (shared with preload)
//   ipc/validate.js           pure IPC input validators
//   ipc/register.js           the only place ipcMain handlers are registered

const { app, BrowserWindow, protocol } = require('electron');

const { registerAppProtocol } = require('./services/app-protocol');
const { createWindow, focusMainWindow } = require('./services/window');
const { buildMenu } = require('./services/menu');
const { registerIpcHandlers, lifecycle } = require('./ipc/register');
const clipboardService = require('./services/clipboard-service');
const { createTray, refreshTray } = require('./services/tray');
const quickWindow = require('./services/quick-window');
const i18nMain = require('./services/i18n-main');

// Current UI language for main-process surfaces (tray). The renderer syncs
// this via tv:set-language; defaults to English until it boots.
function trayLabels() {
  return {
    open: t('tray.open'),
    settings: t('tray.settings'),
    pause: t('tray.pause'),
    resume: t('tray.resume'),
    off: t('tray.off'),
    quit: t('tray.quit'),
    active: t('clip.monitoring.active'),
    paused: t('clip.monitoring.paused'),
  };
}

function setMainLanguage(lang) {
  i18nMain.setLang(lang);
  buildMenu(); // native menu follows the active UI language
  refreshTray(clipboardService.getState());
}

function currentLanguage() {
  return i18nMain.getLang();
}

// Test/verification hook: redirect userData (must run before app is ready).
if (process.env.TEXTVAULT_USER_DATA) {
  app.setPath('userData', process.env.TEXTVAULT_USER_DATA);
}

// If ELECTRON extra resources are used (packaged app), src lives in resources/app.asar —
// protocol.handle can read from asar transparently via fs streams.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

// Single instance: a second launch focuses the existing window instead of
// creating a second process that would race on the same local database.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => focusMainWindow());
}

app.whenReady().then(async () => {
  await i18nMain.init(); // load dictionaries before any user-facing main-process string
  registerAppProtocol();
  buildMenu();
  createWindow();
  registerIpcHandlers({ setMainLanguage });
  lifecycle();

  // Clipboard engine: start monitoring immediately (the renderer corrects
  // enabled/paused from persisted settings once it boots), then tray.
  clipboardService.startMonitor();
  createTray(clipboardService.getState, {
    showWindow: () => focusMainWindow(),
    openSettings: () => {
      focusMainWindow();
      const { sendToMain } = require('./services/window');
      const { EMITTED: E } = require('./ipc/channels');
      sendToMain(E.MENU, 'settings');
    },
    togglePause: () => clipboardService.setPaused(!clipboardService.getState().paused),
    quit: () => app.quit(),
  }, trayLabels);

  // Quick Clipboard: register the default global shortcut immediately so it
  // works even before the renderer syncs the user's configured accelerator.
  quickWindow.registerQuickShortcut('Control+Shift+V');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
  clipboardService.stopMonitor();
  quickWindow.releaseOnQuit();
});
