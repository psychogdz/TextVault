'use strict';

// Quick Clipboard launcher window (Phase 6): compact, frameless,
// always-on-top, global-shortcut toggle. The quick page shares the app://
// origin, so it reads the same IndexedDB directly (single canonical store).

const path = require('node:path');
const { BrowserWindow, globalShortcut } = require('electron');

const ROOT = path.join(__dirname, '..', '..');
const SRC_DIR = path.join(ROOT, 'src');

let quickWindow = null;
let registeredShortcut = null; // accelerator currently registered

function createQuickWindow() {
  if (quickWindow) return quickWindow;
  quickWindow = new BrowserWindow({
    width: 640,
    height: 480,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    backgroundColor: '#0d0f14',
    title: 'TextVault Quick Clipboard',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  quickWindow.loadURL('app://./quick.html');
  quickWindow.on('closed', () => { quickWindow = null; });
  // Hide instead of closing so the next toggle is instant.
  quickWindow.on('close', (event) => {
    if (quickWindow.isVisible()) {
      event.preventDefault();
      quickWindow.hide();
    }
  });
  return quickWindow;
}

function showQuickWindow() {
  const win = createQuickWindow();
  if (!win.isVisible()) {
    win.center();
    win.show();
    win.focus();
  } else {
    win.focus();
  }
}

function hideQuickWindow() {
  if (quickWindow && quickWindow.isVisible()) quickWindow.hide();
}

function toggleQuickWindow() {
  if (quickWindow && quickWindow.isVisible()) hideQuickWindow();
  else showQuickWindow();
}

function isQuickVisible() {
  return !!(quickWindow && quickWindow.isVisible());
}

function getQuickWindow() {
  return quickWindow;
}

/**
 * Register the user's global shortcut. Replaces any previous registration,
 * fails safely (returns false) on conflict/invalid accelerator, and is
 * cleaned up on shutdown.
 */
function registerQuickShortcut(accelerator) {
  unregisterQuickShortcut();
  if (!accelerator || typeof accelerator !== 'string') return false;
  try {
    if (!globalShortcut.register(accelerator, toggleQuickWindow)) return false;
    registeredShortcut = accelerator;
    return true;
  } catch {
    return false; // invalid accelerator — the app keeps running without it
  }
}

function unregisterQuickShortcut() {
  if (registeredShortcut) {
    try { globalShortcut.unregister(registeredShortcut); } catch { /* already gone */ }
    registeredShortcut = null;
  }
}

function getRegisteredShortcut() {
  return registeredShortcut;
}

function releaseOnQuit() {
  unregisterQuickShortcut();
  if (quickWindow) {
    try { quickWindow.destroy(); } catch { /* already gone */ }
    quickWindow = null;
  }
}

module.exports = {
  createQuickWindow,
  showQuickWindow,
  hideQuickWindow,
  toggleQuickWindow,
  isQuickVisible,
  getQuickWindow,
  registerQuickShortcut,
  unregisterQuickShortcut,
  getRegisteredShortcut,
  releaseOnQuit,
  QUICK_PAGE_DIR: SRC_DIR,
};
