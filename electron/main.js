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

app.whenReady().then(() => {
  registerAppProtocol();
  buildMenu();
  createWindow();
  registerIpcHandlers();
  lifecycle();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
