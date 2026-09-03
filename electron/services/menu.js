'use strict';

// Application menu: native roles plus a few commands relayed to the renderer.

const { Menu } = require('electron');
const { EMITTED } = require('../ipc/channels');
const { sendToMain } = require('./window');

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const relay = (cmd) => () => sendToMain(EMITTED.MENU, cmd);
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: '&File',
      submenu: [
        { label: 'New Text', accelerator: 'CmdOrCtrl+N', click: relay('new') },
        { type: 'separator' },
        { label: 'Export Library…', click: relay('backup-export') },
        { label: 'Import Library…', click: relay('backup-import') },
        { type: 'separator' },
        { role: isMac ? 'close' : 'quit' },
      ],
    },
    {
      label: '&Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '&View',
      submenu: [
        { label: 'Toggle Theme', accelerator: 'CmdOrCtrl+Alt+T', click: relay('theme') },
        { type: 'separator' },
        { role: 'reload' }, { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: '&Help',
      submenu: [
        { label: 'Keyboard Shortcuts', click: relay('shortcuts') },
        { label: 'About TextVault', click: relay('about') },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { buildMenu };
