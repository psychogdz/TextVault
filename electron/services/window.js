'use strict';

// Main window lifecycle: creation, secure webPreferences, quit-time save
// flush handshake, close disposition (quit vs hide-to-tray), smoke-test hook,
// and main→renderer event helpers.

const path = require('node:path');
const { BrowserWindow, app } = require('electron');
const { EMITTED } = require('../ipc/channels');

const ROOT = path.join(__dirname, '..', '..');
const SRC_DIR = path.join(ROOT, 'src');

let mainWindow = null;
let quitting = false;
let flushed = true;
let closeResolver = null; // pending close-disposition callback

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 620,
    show: false,
    backgroundColor: '#0d0f14',
    title: 'TextVault',
    autoHideMenuBar: false,
    icon: path.join(SRC_DIR, 'assets', 'icons', 'textvault.ico'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Never navigate the window away from the app protocol (defense in depth
  // against injected links); new windows are denied entirely.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('app://')) event.preventDefault();
  });

  // Portable-package smoke test: launch, wait for the renderer to signal
  // readiness, then exit 0 (or non-zero if the page errors out).
  if (process.env.TEXTVAULT_SMOKE) {
    let failed = false;
    mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
      console.error(`SMOKE did-fail-load ${code} ${desc} ${url}`);
      failed = true;
      app.exit(1);
    });
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
      console.error('SMOKE renderer gone:', details.reason);
      app.exit(1);
    });
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const ok = await mainWindow.webContents.executeJavaScript(
            '!!(window.__TV_TEST__ || document.querySelector(\'#app\'))', true);
          console.log(ok ? 'SMOKE OK' : 'SMOKE no-app');
          app.exit(failed || !ok ? 1 : 0);
        } catch (err) {
          console.error('SMOKE eval failed:', err.message);
          app.exit(1);
        }
      }, 2500);
    });
  }

  mainWindow.loadURL(process.env.TEXTVAULT_E2E
    ? 'app://./index.html?e2e=1'
    : 'app://./index.html');

  mainWindow.on('closed', () => { mainWindow = null; });

  // Give the renderer a chance to flush pending auto-saves, then let it
  // decide the close disposition (quit / hide to tray) per user settings —
  // closing the window must never silently stop clipboard monitoring.
  mainWindow.on('close', (event) => {
    if (quitting || mainWindow.isDestroyed()) return;
    if (!flushed) {
      event.preventDefault();
      mainWindow.webContents.send(EMITTED.FLUSH);
      const started = Date.now();
      const poll = setInterval(() => {
        if (flushed || Date.now() - started > 4000) {
          clearInterval(poll);
          requestCloseDisposition();
        }
      }, 120);
      return;
    }
    event.preventDefault();
    requestCloseDisposition();
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

/**
 * Ask the renderer how to dispose of a window close. The renderer resolves
 * via tv:close-resolve ('quit' | 'tray' | 'cancel'). If the renderer cannot
 * answer within 3s (crashed/reloading), fall back to quit — the v1.0.0
 * behavior — rather than hanging.
 */
function requestCloseDisposition() {
  if (quitting || !mainWindow || mainWindow.isDestroyed()) return;
  if (closeResolver) return; // already pending
  const timer = setTimeout(() => {
    closeResolver = null;
    if (!mainWindow || mainWindow.isDestroyed()) return;
    quitting = true;
    app.quit();
  }, 3000);
  closeResolver = (action) => {
    clearTimeout(timer);
    closeResolver = null;
    if (action === 'quit') {
      quitting = true;
      app.quit();
    } else if (action === 'tray') {
      mainWindow.hide();
    } // 'cancel' → keep the window open
  };
  sendToMain(EMITTED.CLOSE_REQUEST);
}

/** Resolve a pending close request (called from the IPC layer). */
function resolveCloseDisposition(action) {
  if (closeResolver && ['quit', 'tray', 'cancel'].includes(action)) {
    closeResolver(action);
  }
}

/** Send an event to the main window if it exists. */
function sendToMain(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function getMainWindow() {
  return mainWindow;
}

function isQuitting() {
  return quitting;
}

function setQuitting(v) {
  quitting = v;
}

function isFlushed() {
  return flushed;
}

function markFlushed() {
  flushed = true;
}

function markDirty() {
  flushed = false;
}

/** Focus/show the main window (used for single-instance second launches). */
function focusMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
}

module.exports = {
  createWindow,
  sendToMain,
  getMainWindow,
  isQuitting,
  setQuitting,
  isFlushed,
  markFlushed,
  markDirty,
  focusMainWindow,
  requestCloseDisposition,
  resolveCloseDisposition,
};
