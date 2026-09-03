// Storage validation + limits + schema versioning (shared renderer/tests).
// The storage layer validates every record before it is written and every
// settings object before it is applied, so invalid data can never corrupt
// valid data (SECURITY.md §59 data-storage contract).

export const LIMITS = Object.freeze({
  ENTRY_CONTENT: 5 * 1024 * 1024,      // per-entry text content, characters
  ENTRY_TITLE: 300,                    // title characters
  ENTRY_DESCRIPTION: 2000,             // description characters
  ENTRY_TAGS: 24,                      // tags per entry
  TAG_LENGTH: 64,                      // characters per tag
  SETTINGS_JSON: 256 * 1024,           // serialized settings budget
});

// Current persistent schema version. Bump when a migration is added to
// MIGRATIONS (shared/storage-migrations.mjs) and keep both in sync.
export const SCHEMA_VERSION = 1;

export const THEMES = ['light', 'dark', 'system'];
export const ACCENTS = ['violet', 'blue', 'teal', 'rose', 'amber'];
export const SORTS = ['modified-desc', 'created-desc', 'created-asc', 'used-desc', 'title-asc', 'title-desc'];

/** Authoritative settings defaults (single source for state.js + sanitize). */
export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'dark',
  accent: 'violet',
  sort: 'modified-desc',
  editorFontSize: 14.5,
  editorFont: 'sans',
  editorWrap: true,
  autoSave: true,
  autoSaveDelay: 800,
});

function isObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Validate an entry record as stored in the `entries` object store.
 * Shape + limits only (derived fields are recomputed by the domain layer on
 * import; here we guard what persistence accepts).
 * Returns { ok, error? }.
 */
export function validateEntryRecord(record) {
  if (!isObj(record)) return { ok: false, error: 'Record is not an object.' };
  if (typeof record.id !== 'string' || record.id.length === 0 || record.id.length > 128) {
    return { ok: false, error: 'Record id is missing or invalid.' };
  }
  if (typeof record.content !== 'string') return { ok: false, error: 'Record content must be text.' };
  if (record.content.length > LIMITS.ENTRY_CONTENT) {
    return { ok: false, error: 'Record content exceeds the size limit.' };
  }
  if (record.title !== undefined && (typeof record.title !== 'string' || record.title.length > LIMITS.ENTRY_TITLE)) {
    return { ok: false, error: 'Record title is invalid or too long.' };
  }
  if (record.tags !== undefined) {
    if (!Array.isArray(record.tags) || record.tags.length > LIMITS.ENTRY_TAGS
        || record.tags.some((t) => typeof t !== 'string' || t.length > LIMITS.TAG_LENGTH)) {
      return { ok: false, error: 'Record tags are invalid.' };
    }
  }
  if (record.description !== undefined
      && (typeof record.description !== 'string' || record.description.length > LIMITS.ENTRY_DESCRIPTION)) {
    return { ok: false, error: 'Record description is invalid or too long.' };
  }
  for (const ts of ['createdAt', 'updatedAt', 'openedAt', 'deletedAt']) {
    if (record[ts] !== undefined && record[ts] !== null && !Number.isFinite(record[ts])) {
      return { ok: false, error: `Record ${ts} must be a number.` };
    }
  }
  return { ok: true };
}

/**
 * Sanitize a settings object loaded from storage: keep known keys, repair
 * invalid values to defaults, clamp numeric ranges, drop unknown keys.
 * A corrupted settings record must never break boot (ARCHITECTURE.md §38).
 */
export function sanitizeSettings(raw) {
  const src = isObj(raw) ? raw : {};
  const out = { ...DEFAULT_SETTINGS };
  if (THEMES.includes(src.theme)) out.theme = src.theme;
  if (ACCENTS.includes(src.accent)) out.accent = src.accent;
  if (SORTS.includes(src.sort)) out.sort = src.sort;
  if (['sans', 'mono'].includes(src.editorFont)) out.editorFont = src.editorFont;
  if (typeof src.editorWrap === 'boolean') out.editorWrap = src.editorWrap;
  if (typeof src.autoSave === 'boolean') out.autoSave = src.autoSave;
  if (Number.isFinite(src.editorFontSize)) {
    out.editorFontSize = Math.min(22, Math.max(12, Number(src.editorFontSize)));
  }
  if (Number.isFinite(src.autoSaveDelay)) {
    out.autoSaveDelay = Math.min(3000, Math.max(300, Math.round(Number(src.autoSaveDelay))));
  }
  return out;
}
