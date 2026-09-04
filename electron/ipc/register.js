'use strict';

// IPC boundary: every renderer→main channel is registered here, validated,
// and answered with a predictable { ok, ... } contract. No other module may
// register ipcMain handlers. Inputs are untrusted; see ipc/validate.js.

const path = require('node:path');
const { ipcMain, app, shell, clipboard } = require('electron');
const fsp = require('node:fs/promises');

const { HANDLED, EMITTED } = require('./channels');
const v = require('./validate');
const { getMainWindow, markFlushed, markDirty, setQuitting, resolveCloseDisposition } = require('../services/window');
const clipboardService = require('../services/clipboard-service');
const quickWindow = require('../services/quick-window');

// Hooks provided by the composition root (avoids a main.js require cycle).
const hooks = { setMainLanguage: null };
const {
  TEST_DIR,
  extFilters,
  pickSavePath,
  pickOpenPath,
  writeFileAtomic,
  withExt,
  describeError,
} = require('../services/file-dialogs');
const i18nMain = require('../services/i18n-main');
const {
  ensureAsyncExporters,
  buildExportBytes,
  buildSingleExportBytes,
  isExporterKind,
} = require('../services/export-service');

function invalid(error) {
  return { ok: false, error };
}

/** Map validator error keys to the active UI language. */
function localized(res) {
  if (res && res.error) return { ...res, error: i18nMain.t(res.error) };
  return res;
}

/* ---------------------------------------------------------------- exports */

async function handleExport(_ev, payload) {
  try {
    const check = v.validateExportPayload(payload);
    if (!check.ok) return localized(check);
    const { kind, mode, entries, defaultName } = payload;
    await ensureAsyncExporters();
    const win = getMainWindow();

    // Destination names come from user content — sanitize via the shared,
    // unit-tested filename module (Windows-safe).
    const { sanitizeFilename, uniqueFilename } = await import('../../shared/filename.mjs');

    if (mode === 'separate') {
      // One file per text, into a directory.
      let dir;
      if (TEST_DIR) {
        dir = TEST_DIR;
      } else {
        const { dialog } = require('electron');
        const dirRes = await dialog.showOpenDialog(win, {
          title: 'Choose a folder for the exported files',
          properties: ['openDirectory', 'createDirectory', 'dontAddToRecent'],
        });
        if (dirRes.canceled || !dirRes.filePaths[0]) return { ok: false, canceled: true };
        dir = dirRes.filePaths[0];
      }
      const used = new Set();
      let n = 0;
      for (const entry of entries) {
        const base = sanitizeFilename(entry.title || 'text', 'text');
        const target = path.join(dir, uniqueFilename(base, kind, used));
        const bytes = await buildSingleExportBytes(kind, entry, i18nMain.getLang());
        writeFileAtomic(target, bytes);
        n++;
      }
      return { ok: true, path: dir, count: n };
    }

    // mode 'single' or 'combined' → exactly one output file.
    const combined = entries.length > 1;
    const bytes = await buildExportBytes(kind, entries, { combined, lang: i18nMain.getLang() });
    const sanitizedDefault = defaultName ? path.basename(defaultName) : null;
    const name = sanitizedDefault
      || (combined
        ? `TextVault_Export_${entries.length}_texts`
        : `${sanitizeFilename(entries[0] && entries[0].title ? entries[0].title : 'text', 'text')}${entries.length > 1 ? `_and_${entries.length - 1}_more` : ''}`);
    const target = await pickSavePath(win, name, kind.toUpperCase(), extFilters()[kind]);
    if (!target) return { ok: false, canceled: true };
    const finalPath = withExt(target, kind);
    writeFileAtomic(finalPath, bytes);
    return { ok: true, path: finalPath, count: entries.length };
  } catch (err) {
    return invalid(describeError(err));
  }
}

/* ------------------------------------------------------------ backup/rest */

let backupFormat = null;
async function loadBackupFormat() {
  if (!backupFormat) {
    backupFormat = await import('../../shared/backup-format.mjs');
  }
  return backupFormat;
}

async function handleBackupExport(_ev, payload) {
  try {
    const fmt = await loadBackupFormat();
    const check = fmt.validateBackupExportPayload(payload);
    if (!check.ok) return localized(check);
    const outPayload = fmt.buildBackupPayload({
      entries: payload.entries || [],
      clipboard: payload.clipboard || [],
      snippets: payload.snippets || [],
      collections: payload.collections || [],
    });
    const json = JSON.stringify(outPayload, null, 2);
    const stamp = new Date().toISOString().slice(0, 10);
    const target = await pickSavePath(
      getMainWindow(), `TextVault_Backup_${stamp}.json`, 'JSON', extFilters().json);
    if (!target) return { ok: false, canceled: true };
    const finalPath = withExt(target, 'json');
    writeFileAtomic(finalPath, json, 'utf8');
    const count = outPayload.entries.length + outPayload.clipboard.length + outPayload.snippets.length;
    return { ok: true, path: finalPath, count, version: outPayload.version };
  } catch (err) {
    return invalid(describeError(err));
  }
}

async function handleBackupImport(_ev, opts) {
  try {
    const fmt = await loadBackupFormat();
    const check = v.validateBackupImportOpts(opts, { testDir: TEST_DIR });
    if (!check.ok) return localized(check);
    let filePath = check.filePath;
    if (!filePath) {
      filePath = await pickOpenPath(getMainWindow(), {
        title: i18nMain.t('dlg.importTitle'),
        filters: extFilters().json,
      });
      if (!filePath) return { ok: false, canceled: true };
    }
    const raw = await fsp.readFile(filePath, 'utf8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return { ok: false, error: i18nMain.t('err.notJson') };
    }
    const validated = fmt.validateBackupFile(data);
    if (!validated.ok) {
      return { ok: false, error: i18nMain.t(validated.error) };
    }
    const { data: out, version } = validated;
    const count = out.entries.length + out.clipboard.length + out.snippets.length;
    return {
      ok: true, version, ...out, count, exportedAt: data.exportedAt,
    };
  } catch (err) {
    return invalid(describeError(err));
  }
}

/* --------------------------------------------------------------- misc ipc */

function registerIpcHandlers(bridgeHooks = {}) {
  Object.assign(hooks, bridgeHooks);
  ipcMain.handle(HANDLED.EXPORT, handleExport);
  ipcMain.handle(HANDLED.BACKUP_EXPORT, handleBackupExport);
  ipcMain.handle(HANDLED.BACKUP_IMPORT, handleBackupImport);

  ipcMain.handle(HANDLED.CLIPBOARD_READ, () => clipboard.readText());
  ipcMain.handle(HANDLED.CLIPBOARD_WRITE, (_ev, text) => {
    const check = v.validateClipboardWrite(text);
    if (!check.ok) return localized(check);
    clipboard.writeText(check.value);
    return true;
  });

  ipcMain.handle(HANDLED.APP_INFO, () => ({
    version: app.getVersion(),
    userData: app.getPath('userData'),
    platform: process.platform,
  }));

  // Allowlist: the renderer may only open the app's own data directory.
  ipcMain.handle(HANDLED.OPEN_PATH, (_ev, p) => {
    if (!v.isPathAllowed(p, [app.getPath('userData')])) return false;
    shell.openPath(p);
    return true;
  });

  ipcMain.handle(HANDLED.FLUSHED, () => { markFlushed(); });
  ipcMain.on(HANDLED.FLUSHED, () => { markFlushed(); });
  ipcMain.handle(HANDLED.MARK_DIRTY, () => { markDirty(); });

  /* ------------------- clipboard engine (Phase 3) ------------------- */

  ipcMain.handle(HANDLED.CLIPBOARD_STATE, () => clipboardService.getState());
  ipcMain.handle(HANDLED.CLIPBOARD_SET_PAUSED, (_ev, paused) => {
    if (typeof paused !== 'boolean') return { ok: false, error: i18nMain.t('err.invalidClipboard') };
    clipboardService.setPaused(paused);
    return { ok: true, state: clipboardService.getState() };
  });
  ipcMain.handle(HANDLED.CLIPBOARD_SET_ENABLED, (_ev, enabled) => {
    if (typeof enabled !== 'boolean') return { ok: false, error: i18nMain.t('err.invalidClipboard') };
    clipboardService.setEnabled(enabled);
    return { ok: true, state: clipboardService.getState() };
  });
  ipcMain.handle(HANDLED.CLIPBOARD_SET_PRIVATE, (_ev, privateMode) => {
    if (typeof privateMode !== 'boolean') return { ok: false, error: i18nMain.t('err.invalidClipboard') };
    clipboardService.setPrivate(privateMode);
    return { ok: true, state: clipboardService.getState() };
  });
  ipcMain.handle(HANDLED.CLIPBOARD_GET_PENDING, () => clipboardService.getPending());
  ipcMain.handle(HANDLED.CLIPBOARD_ACK, (_ev, ids) => {
    if (!Array.isArray(ids) || ids.length > 500 || ids.some((x) => typeof x !== 'string')) {
      return { ok: false, error: i18nMain.t('err.invalidClipboard') };
    }
    clipboardService.ackCaptured(ids);
    return { ok: true };
  });

  /* ------------------- close disposition (Phase 3) ------------------- */

  ipcMain.handle(HANDLED.CLOSE_RESOLVE, (_ev, action) => {
    if (!['quit', 'tray', 'cancel'].includes(action)) {
      return { ok: false, error: i18nMain.t('err.invalidClose') };
    }
    resolveCloseDisposition(action);
    return { ok: true };
  });

  /* ------------- explicit external URL opening (Phase 4) ------------- */

  ipcMain.handle(HANDLED.OPEN_EXTERNAL, (_ev, url) => {
    const check = v.validateExternalUrl(url);
    if (!check.ok) return localized(check);
    shell.openExternal(check.value);
    return { ok: true };
  });

  /* ------------- quick clipboard + language (Phase 6) ------------- */

  ipcMain.handle(HANDLED.QUICK_HIDE, () => {
    quickWindow.hideQuickWindow();
    return { ok: true };
  });

  ipcMain.handle(HANDLED.SET_SHORTCUT, async (_ev, accelerator) => {
    // Validate the accelerator shape against the shared contract first.
    const { isValidShortcutString } = await import('../../shared/validation.mjs');
    if (!isValidShortcutString(accelerator)) {
      return { ok: false, error: i18nMain.t('err.invalidShortcut') };
    }
    const registered = quickWindow.registerQuickShortcut(accelerator);
    return { ok: true, registered, accelerator: registered ? accelerator : null };
  });

  ipcMain.handle(HANDLED.SET_LANGUAGE, (_ev, lang) => {
    if (!['en', 'fa'].includes(lang)) return { ok: false, error: 'Invalid language.' };
    if (typeof hooks.setMainLanguage === 'function') hooks.setMainLanguage(lang);
    return { ok: true, language: lang };
  });
}

function lifecycle() {
  app.on('before-quit', () => { setQuitting(true); });
}

module.exports = { registerIpcHandlers, lifecycle, invalid };
