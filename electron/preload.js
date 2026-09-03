'use strict';

// Preload — the controlled renderer↔main bridge (contextBridge).
// Exposes ONLY the explicit window.tv API below; no generic invoke/send,
// no Node APIs.
//
// Channel names are inlined as literals because sandboxed preload scripts can
// only require a fixed module allowlist (no local files). Consistency with the
// main-process registry (ipc/channels.js) is enforced by test/ipc-tests.mjs.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tv', {
  // Exports
  export: (payload) => ipcRenderer.invoke('tv:export', payload),
  backupExport: (payload) => ipcRenderer.invoke('tv:backup-export', payload),
  backupImport: (opts) => ipcRenderer.invoke('tv:backup-import', opts || {}),

  // Clipboard
  clipboardRead: () => ipcRenderer.invoke('tv:clipboard-read'),
  clipboardWrite: (text) => ipcRenderer.invoke('tv:clipboard-write', text),

  // App info / shell
  appInfo: () => ipcRenderer.invoke('tv:app-info'),
  openPath: (p) => ipcRenderer.invoke('tv:open-path', p),

  // Save-flush handshake (quit-time auto-save)
  onFlush: (callback) => {
    ipcRenderer.on('tv:flush', () => callback());
    ipcRenderer.on('tv:flushed-reply', () => callback());
  },
  notifyFlushed: () => ipcRenderer.invoke('tv:flushed'),
  markDirty: () => ipcRenderer.invoke('tv:mark-dirty'),

  // Menu commands
  onMenu: (callback) => ipcRenderer.on('menu', (_ev, cmd) => callback(cmd)),

  // Clipboard engine (Phase 3)
  clipboardState: () => ipcRenderer.invoke('tv:clipboard-state'),
  clipboardSetPaused: (paused) => ipcRenderer.invoke('tv:clipboard-set-paused', paused),
  clipboardSetEnabled: (enabled) => ipcRenderer.invoke('tv:clipboard-set-enabled', enabled),
  clipboardGetPending: () => ipcRenderer.invoke('tv:clipboard-get-pending'),
  clipboardAck: (ids) => ipcRenderer.invoke('tv:clipboard-ack', ids),
  onClipboardCaptured: (callback) => ipcRenderer.on('clipboard:captured', (_ev, item) => callback(item)),
  onClipboardStateChanged: (callback) => ipcRenderer.on('clipboard:state-changed', (_ev, st) => callback(st)),

  // Close disposition (Phase 3): renderer answers a close request
  onCloseRequest: (callback) => ipcRenderer.on('tv:close-request', () => callback()),
  closeResolve: (action) => ipcRenderer.invoke('tv:close-resolve', action),

  // Explicit user-initiated external URL opening (Phase 4)
  openExternal: (url) => ipcRenderer.invoke('tv:open-external', url),

  // Quick Clipboard + i18n (Phase 6)
  quickHide: () => ipcRenderer.invoke('tv:quick-hide'),
  setShortcut: (accel) => ipcRenderer.invoke('tv:set-shortcut', accel),
  setLanguage: (lang) => ipcRenderer.invoke('tv:set-language', lang),
});
