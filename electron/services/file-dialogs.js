'use strict';

// Native save/open dialogs and safe file writing (main process only).
// In test mode (TEXTVAULT_TEST_DIR) dialogs are bypassed so exports land in a
// known directory and the E2E suite can verify them on disk.

const path = require('node:path');
const fs = require('node:fs');
const { dialog } = require('electron');

const TEST_DIR = process.env.TEXTVAULT_TEST_DIR || null;

const EXT_FILTERS = {
  txt: [{ name: 'Text File', extensions: ['txt'] }],
  docx: [{ name: 'Word Document', extensions: ['docx'] }],
  pdf: [{ name: 'PDF Document', extensions: ['pdf'] }],
  json: [{ name: 'TextVault Backup', extensions: ['json'] }],
};

/** Pick a destination through a save dialog (skipped in test mode). */
async function pickSavePath(mainWindow, defaultName, extLabel, filters, multi = false) {
  if (TEST_DIR) return path.join(TEST_DIR, defaultName);
  const opts = {
    title: `Export as ${extLabel}`,
    defaultPath: defaultName,
    filters,
    properties: ['createDirectory', 'dontAddToRecent'],
  };
  if (multi) {
    const res = await dialog.showOpenDialog(mainWindow, { ...opts, properties: ['openDirectory', 'createDirectory', 'dontAddToRecent'] });
    return res.canceled ? null : res.filePaths[0];
  }
  const res = await dialog.showSaveDialog(mainWindow, opts);
  return res.canceled ? null : res.filePath;
}

/** Pick an existing file through an open dialog (skipped in test mode). */
async function pickOpenPath(mainWindow, { title, filters }) {
  if (TEST_DIR) return null;
  const res = await dialog.showOpenDialog(mainWindow, {
    title,
    filters,
    properties: ['openFile', 'dontAddToRecent'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  return res.filePaths[0];
}

/** Atomic write: temp file + rename so a crash never leaves a partial file. */
function writeFileAtomic(filePath, contents, encoding) {
  const tmp = filePath + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, contents, encoding);
  fs.renameSync(tmp, filePath);
}

function withExt(p, ext) {
  return p.toLowerCase().endsWith('.' + ext) ? p : `${p}.${ext}`;
}

function describeError(err) {
  return err && err.message ? err.message : String(err);
}

module.exports = {
  TEST_DIR,
  EXT_FILTERS,
  pickSavePath,
  pickOpenPath,
  writeFileAtomic,
  withExt,
  describeError,
};
