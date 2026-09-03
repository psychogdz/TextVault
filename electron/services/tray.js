'use strict';

// System tray: background access to the clipboard engine while the main
// window is hidden. The menu is rebuilt whenever the monitor state changes.

const path = require('node:path');
const { Tray, Menu } = require('electron');

const ROOT = path.join(__dirname, '..', '..');
const ICON = path.join(ROOT, 'src', 'assets', 'icons', 'textvault.ico');

let tray = null;
let actions = null; // { showWindow, openSettings, togglePause, quit }

function tooltipFor(state) {
  if (!state.enabled) return 'TextVault — clipboard monitoring off';
  if (state.paused) return 'TextVault — clipboard monitoring paused';
  return 'TextVault — clipboard monitoring active';
}

function rebuild(state) {
  if (!tray) return;
  tray.setToolTip(tooltipFor(state));
  const pauseLabel = !state.enabled
    ? 'Clipboard Monitoring: Off'
    : state.paused ? 'Resume Clipboard Monitoring' : 'Pause Clipboard Monitoring';
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open TextVault', click: () => actions.showWindow() },
    { label: 'Settings', click: () => actions.openSettings() },
    { type: 'separator' },
    { label: pauseLabel, enabled: state.enabled, click: () => actions.togglePause() },
    { type: 'separator' },
    { label: 'Quit TextVault', click: () => actions.quit() },
  ]));
}

function createTray(getState, actionFns) {
  if (tray) return tray;
  actions = actionFns;
  tray = new Tray(ICON);
  rebuild(getState());
  return tray;
}

/** Called by the clipboard service whenever the state changes. */
function refreshTray(state) {
  rebuild(state);
}

module.exports = { createTray, refreshTray };
