// Backup format contract (shared main/renderer/tests).
//
// v1: { format:'textvault-backup', version:1, app, exportedAt, entries }
// v2: adds clipboard/snippets/collections arrays (each optional so partial
//     exports stay valid). The validator is pure and unit-testable; import
//     NEVER trusts the file — it validates first, then the renderer stages
//     records through the normal validated storage layer (SECURITY.md §59.18).

const BOUNDS = {
  entries: { max: 100_000, content: 10 * 1024 * 1024 },
  clipboard: { max: 50_000, content: 10 * 1024 * 1024 },
  snippets: { max: 10_000, content: 5 * 1024 * 1024 },
  collections: { max: 1_000 },
};

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

/**
 * Validate a parsed backup file.
 * Returns { ok, version, data?, error? } where data holds the four arrays
 * (absent arrays normalize to []).
 */
export function validateBackupFile(data) {
  if (!isObj(data)) return { ok: false, error: 'err.notBackup' };
  if (data.format !== 'textvault-backup') {
    return { ok: false, error: 'err.notBackup' };
  }
  if (typeof data.version !== 'number' || ![1, 2].includes(data.version)) {
    return { ok: false, error: 'err.unsupportedVersion' };
  }
  if (!Array.isArray(data.entries)) {
    return { ok: false, error: 'err.backupMissingEntries' };
  }
  const out = { entries: data.entries, clipboard: [], snippets: [], collections: [] };
  if (data.version >= 2) {
    out.clipboard = Array.isArray(data.clipboard) ? data.clipboard : [];
    out.snippets = Array.isArray(data.snippets) ? data.snippets : [];
    out.collections = Array.isArray(data.collections) ? data.collections : [];
  }
  for (const kind of ['entries', 'clipboard', 'snippets', 'collections']) {
    const { max, content } = BOUNDS[kind];
    if (out[kind].length > max) {
      return { ok: false, error: 'err.backupTooMany' };
    }
    if (content) {
      for (const rec of out[kind]) {
        if (!isObj(rec) || typeof rec.content !== 'string') {
          return { ok: false, error: kind === 'collections' ? 'err.backupCollectionsInvalid' : 'err.backupEntriesInvalid' };
        }
        if (rec.content.length > content) {
          return { ok: false, error: 'err.backupOversized' };
        }
      }
    } else {
      for (const rec of out[kind]) {
        if (!isObj(rec) || typeof rec.name !== 'string') {
          return { ok: false, error: 'err.backupCollectionsInvalid' };
        }
      }
    }
  }
  return { ok: true, version: data.version, data: out };
}

/** Validate an export request payload (bounds only; deep checks in storage). */
export function validateBackupExportPayload(payload) {
  if (!isObj(payload)) return { ok: false, error: 'err.invalidBackupReq' };
  const arrays = {
    entries: payload.entries, clipboard: payload.clipboard,
    snippets: payload.snippets, collections: payload.collections,
  };
  for (const kind of Object.keys(arrays)) {
    const arr = arrays[kind];
    if (arr === undefined) continue;
    if (!Array.isArray(arr)) return { ok: false, error: 'err.invalidBackupReq' };
    const { max, content } = BOUNDS[kind];
    if (arr.length > max) return { ok: false, error: 'err.libTooLargeExport' };
    if (content) {
      for (const rec of arr) {
        if (!isObj(rec) || typeof rec.content !== 'string' || rec.content.length > content) {
          return { ok: false, error: 'err.recordTooLarge' };
        }
      }
    }
  }
  if (!Array.isArray(payload.entries)) return { ok: false, error: 'err.invalidBackupReq' };
  return { ok: true };
}

/** Build the versioned backup envelope. */
export function buildBackupPayload({ entries, clipboard = [], snippets = [], collections = [] }) {
  return {
    format: 'textvault-backup',
    version: 2,
    app: 'TextVault',
    exportedAt: new Date().toISOString(),
    entries,
    clipboard,
    snippets,
    collections,
  };
}
