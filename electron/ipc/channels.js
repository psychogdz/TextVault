'use strict';

// Single source of truth for IPC channel names, shared by preload and main.
// Channels are static strings — never derived from renderer input.
// HANDLED  = renderer → main via ipcMain.handle (invoke) or ipcMain.on (fire-and-forget)
// EMITTED  = main → renderer via webContents.send

const HANDLED = Object.freeze({
  EXPORT: 'tv:export',
  BACKUP_EXPORT: 'tv:backup-export',
  BACKUP_IMPORT: 'tv:backup-import',
  CLIPBOARD_READ: 'tv:clipboard-read',
  CLIPBOARD_WRITE: 'tv:clipboard-write',
  APP_INFO: 'tv:app-info',
  OPEN_PATH: 'tv:open-path',
  FLUSHED: 'tv:flushed',
  MARK_DIRTY: 'tv:mark-dirty',
});

const EMITTED = Object.freeze({
  MENU: 'menu',
  FLUSH: 'tv:flush',
  FLUSHED_REPLY: 'tv:flushed-reply',
});

module.exports = { HANDLED, EMITTED };
