'use strict';

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
});
