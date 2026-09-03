'use strict';

// Main window lifecycle: creation, secure webPreferences, quit-time save
// flush handshake, smoke-test hook, and main→renderer event helpers.

const path = require('node:path');
const { BrowserWindow, app } = require('electron');
const { EMITTED } = require('../ipc/channels');

const ROOT = path.join(__dirname, '..', '..');
const SRC_DIR = path.join(ROOT, 'src');

let mainWindow = null;
let quitting = false;
let flushed = true;

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

  // Give the renderer a chance to flush pending auto-saves before closing.
  mainWindow.on('close', (event) => {
    if (quitting || flushed || mainWindow.isDestroyed()) return;
    event.preventDefault();
    mainWindow.webContents.send(EMITTED.FLUSH);
    const started = Date.now();
    const poll = setInterval(() => {
      if (flushed || Date.now() - started > 4000) {
        clearInterval(poll);
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
      }
    }, 120);
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
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
};
