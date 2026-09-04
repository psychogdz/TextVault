'use strict';

// Application menu: native roles plus a few commands relayed to the renderer.

const { Menu } = require('electron');
const { EMITTED } = require('../ipc/channels');
const { sendToMain } = require('./window');
const i18nMain = require('./i18n-main');

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const t = i18nMain.t;
  const relay = (cmd) => () => sendToMain(EMITTED.MENU, cmd);
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: t('menu.file'),
      submenu: [
        { label: t('new.text'), accelerator: 'CmdOrCtrl+N', click: relay('new') },
        { type: 'separator' },
        { label: t('menu.exportLib'), click: relay('backup-export') },
        { label: t('menu.importLib'), click: relay('backup-import') },
        { type: 'separator' },
        { role: isMac ? 'close' : 'quit' },
      ],
    },
    {
      label: t('menu.edit'),
      submenu: [
        { role: 'undo', label: t('menu.undo') }, { role: 'redo', label: t('menu.redo') }, { type: 'separator' },
        { role: 'cut', label: t('menu.cut') }, { role: 'copy', label: t('menu.copy') }, { role: 'paste', label: t('menu.paste') },
        { role: 'selectAll', label: t('select.all') },
      ],
    },
    {
      label: t('menu.view'),
      submenu: [
        { label: t('menu.theme'), accelerator: 'CmdOrCtrl+Alt+T', click: relay('theme') },
        { type: 'separator' },
        { role: 'reload' }, { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: t('menu.help'),
      submenu: [
        { label: t('set.shortcuts'), click: relay('shortcuts') },
        { label: t('menu.about'), click: relay('about') },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { buildMenu };
