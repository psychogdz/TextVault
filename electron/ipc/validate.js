'use strict';

// Pure IPC input validators — no Electron imports, unit-testable in Node.
// Every renderer-supplied payload is untrusted; validate shape and bounds
// before any privileged work. Error strings are generic on purpose: they may
// be shown to the user and must not leak internals.

const path = require('node:path');

const EXPORT_KINDS = ['txt', 'docx', 'pdf'];
const EXPORT_MODES = ['single', 'combined', 'separate'];

// Content size limits (documented in ARCHITECTURE.md / SECURITY.md §59.11).
const MAX_EXPORT_ENTRIES = 5000;
const MAX_EXPORT_CONTENT = 5 * 1024 * 1024;   // per-entry content bytes
const MAX_EXPORT_TITLE = 300;
const MAX_BACKUP_ENTRIES = 100000;
const MAX_BACKUP_CONTENT = 10 * 1024 * 1024;  // per-entry content bytes
const MAX_BACKUP_TOTAL = 64 * 1024 * 1024;    // whole backup payload
const MAX_CLIPBOARD_WRITE = 5 * 1024 * 1024;
const MAX_DEFAULT_NAME = 200;

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function validString(v, max) {
  return typeof v === 'string' && v.length <= max;
}

/** Validate a tv:export payload. Returns { ok, error? } (payload used as-is when ok). */
function validateExportPayload(payload) {
  if (!isPlainObject(payload)) return { ok: false, error: 'err.invalidExport' };
  const { kind, mode, entries, defaultName } = payload;
  if (!EXPORT_KINDS.includes(kind)) return { ok: false, error: 'err.invalidExport' };
  if (!EXPORT_MODES.includes(mode)) return { ok: false, error: 'err.invalidExport' };
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > MAX_EXPORT_ENTRIES) {
    return { ok: false, error: 'err.invalidExport' };
  }
  let total = 0;
  for (const e of entries) {
    if (!isPlainObject(e)) return { ok: false, error: 'err.invalidExport' };
    if (typeof e.content !== 'string') return { ok: false, error: 'err.invalidExport' };
    total += e.content.length;
    if (e.content.length > MAX_EXPORT_CONTENT) return { ok: false, error: 'err.textTooLargeExport' };
    if (e.title !== undefined && typeof e.title !== 'string') return { ok: false, error: 'err.invalidExport' };
    if (typeof e.title === 'string' && e.title.length > MAX_EXPORT_TITLE) {
      return { ok: false, error: 'err.titleTooLong' };
    }
    if (e.tags !== undefined) {
      if (!Array.isArray(e.tags) || e.tags.some((t) => typeof t !== 'string')) {
        return { ok: false, error: 'err.invalidExport' };
      }
    }
    if (e.updatedAt !== undefined && !Number.isFinite(e.updatedAt)) {
      return { ok: false, error: 'err.invalidExport' };
    }
    if (e.stats !== undefined && !isPlainObject(e.stats)) {
      return { ok: false, error: 'err.invalidExport' };
    }
  }
  if (total > MAX_BACKUP_TOTAL) return { ok: false, error: 'err.exportTooLarge' };
  if (defaultName !== undefined && defaultName !== null
      && (typeof defaultName !== 'string' || defaultName.length > MAX_DEFAULT_NAME)) {
    return { ok: false, error: 'err.invalidExport' };
  }
  return { ok: true };
}

/**
 * Validate tv:backup-import options. `pathOverride` (a renderer-supplied file
 * path) is only accepted in test mode (TEXTVAULT_TEST_DIR) and only when the
 * resolved path stays inside the test directory. Production always uses the
 * native open dialog. Returns { ok, filePath? , error? }.
 */
function validateBackupImportOpts(opts, { testDir = null } = {}) {
  if (opts === undefined || opts === null) return { ok: true, filePath: null };
  if (!isPlainObject(opts)) return { ok: false, error: 'err.invalidImport' };
  const override = opts.pathOverride;
  if (override === undefined || override === null) return { ok: true, filePath: null };
  if (typeof override !== 'string' || !testDir) {
    return { ok: false, error: 'err.invalidImport' };
  }
  const resolved = path.resolve(override);
  const root = path.resolve(testDir);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return { ok: false, error: 'err.invalidImport' };
  }
  return { ok: true, filePath: resolved };
}

/**
 * tv:open-path allowlist: the renderer may only open paths that resolve
 * inside one of `allowedDirs` (currently: the app's own userData directory).
 */
function isPathAllowed(p, allowedDirs) {
  if (typeof p !== 'string' || p.length === 0 || p.length > 1024) return false;
  const resolved = path.resolve(p);
  for (const dir of allowedDirs) {
    const root = path.resolve(dir);
    if (resolved === root || resolved.startsWith(root + path.sep)) return true;
  }
  return false;
}

/** Validate tv:clipboard-write. Returns { ok, value, error? }. */
function validateClipboardWrite(text) {
  if (text === undefined || text === null) return { ok: true, value: '' };
  if (typeof text !== 'string') return { ok: false, error: 'err.invalidClipboard' };
  if (text.length > MAX_CLIPBOARD_WRITE) return { ok: false, error: 'err.clipboardTooLarge' };
  return { ok: true, value: text };
}

/** Channels that carry no payload must receive none. */
function validateNoPayload(payload) {
  return payload === undefined || payload === null;
}

/**
 * Only http(s) URLs may be opened externally, only on an explicit user
 * action (SECURITY.md §26). Everything else (file:, javascript:, custom
 * schemes, whitespace tricks) is rejected.
 */
function validateExternalUrl(url) {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2048) {
    return { ok: false, error: 'err.invalidUrl' };
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: 'err.invalidUrl' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'err.httpsOnly' };
  }
  return { ok: true, value: parsed.href };
}

module.exports = {
  EXPORT_KINDS,
  EXPORT_MODES,
  MAX_EXPORT_ENTRIES,
  MAX_EXPORT_CONTENT,
  MAX_EXPORT_TITLE,
  MAX_BACKUP_ENTRIES,
  MAX_BACKUP_CONTENT,
  MAX_BACKUP_TOTAL,
  MAX_CLIPBOARD_WRITE,
  MAX_DEFAULT_NAME,
  isPlainObject,
  validateExportPayload,
  validateBackupImportOpts,
  isPathAllowed,
  validateClipboardWrite,
  validateNoPayload,
  validateExternalUrl,
};
