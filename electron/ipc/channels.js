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
  // Clipboard engine (Phase 3)
  CLIPBOARD_STATE: 'tv:clipboard-state',
  CLIPBOARD_SET_PAUSED: 'tv:clipboard-set-paused',
  CLIPBOARD_SET_ENABLED: 'tv:clipboard-set-enabled',
  CLIPBOARD_ACK: 'tv:clipboard-ack',
  CLIPBOARD_GET_PENDING: 'tv:clipboard-get-pending',
  // Window close behavior (Phase 3): renderer decides quit vs hide-to-tray
  CLOSE_RESOLVE: 'tv:close-resolve',
});

const EMITTED = Object.freeze({
  MENU: 'menu',
  FLUSH: 'tv:flush',
  FLUSHED_REPLY: 'tv:flushed-reply',
  // Clipboard engine (Phase 3)
  CLIPBOARD_CAPTURED: 'clipboard:captured',
  CLIPBOARD_STATE_CHANGED: 'clipboard:state-changed',
  // Window close behavior (Phase 3)
  CLOSE_REQUEST: 'tv:close-request',
});

module.exports = { HANDLED, EMITTED };
