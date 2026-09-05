'use strict';

// System tray: background access to the clipboard engine while the main
// window is hidden. The menu is rebuilt whenever the monitor state or the
// UI language changes.

const path = require('node:path');
const { Tray, Menu } = require('electron');

const ROOT = path.join(__dirname, '..', '..');
const ICON = path.join(ROOT, 'src', 'assets', 'icons', 'textvault.ico');

let tray = null;
let actions = null; // { showWindow, openSettings, togglePause, quit }
let getLabels = null; // () => translated labels

function tooltipFor(state, labels) {
  if (!state.enabled) return labels.off;
  if (state.paused) return labels.paused;
  return labels.active;
}

function rebuild(state) {
  if (!tray) return;
  if (!getLabels) return;
  // Labels may be produced asynchronously (i18n is an ESM module in the CJS
  // main process) — resolve before touching native APIs, fail safe on error.
  Promise.resolve(getLabels()).then((labels) => {
    if (!tray || !labels) return;
    tray.setToolTip(tooltipFor(state, labels));
    const pauseLabel = !state.enabled
      ? labels.off
      : state.paused ? labels.resume : labels.pause;
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: labels.open, click: () => actions.showWindow() },
      { label: labels.settings, click: () => actions.openSettings() },
      { type: 'separator' },
      { label: pauseLabel, enabled: state.enabled, click: () => actions.togglePause() },
      { type: 'separator' },
      { label: labels.quit, click: () => actions.quit() },
    ]));
  }).catch(() => { /* tray refresh is best-effort */ });
}

function createTray(getState, actionFns, labelsFn) {
  if (tray) return tray;
  actions = actionFns;
  getLabels = labelsFn;
  tray = new Tray(ICON);
  // Double-clicking the tray icon must behave like the menu's Open entry:
  // restore/show/focus the main window (works on Windows, macOS and Linux).
  tray.on('double-click', () => actions.showWindow());
  rebuild(getState());
  return tray;
}

/** Called by the clipboard service or language changes. */
function refreshTray(state) {
  rebuild(state);
}

/** The live Tray instance (or null before createTray) — used by the E2E suite. */
function getTray() {
  return tray;
}

module.exports = { createTray, refreshTray, getTray };
