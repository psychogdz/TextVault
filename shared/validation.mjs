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
// v2: adds the `clipboard` object store (created in onupgradeneeded; entries
// records themselves are unchanged).
// v3: adds `snippets` + `collections` stores; migration adds `collections`
// membership (and `isPinned` for entries) to existing records.
export const SCHEMA_VERSION = 3;

export const THEMES = ['light', 'dark', 'system'];
export const ACCENTS = ['violet', 'blue', 'teal', 'rose', 'amber'];
export const SORTS = ['modified-desc', 'created-desc', 'created-asc', 'used-desc', 'title-asc', 'title-desc'];
export const DUPLICATE_POLICIES = ['top', 'new'];
export const CLOSE_BEHAVIORS = ['quit', 'tray', 'ask'];
export const LANGUAGES = ['en', 'fa'];

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
  // Clipboard engine (Phase 3; privacy extensions Phase 7)
  clipboard: Object.freeze({
    monitorEnabled: true,   // master switch for clipboard monitoring
    duplicatePolicy: 'top', // 'top' = move existing to top, 'new' = keep duplicates
    maxItems: 1000,         // retention cap; pinned/favorite items are protected
    retentionDays: 0,       // time-based retention; 0 = keep forever
    autoClearSensitive: false, // true = sensitive captures are NOT persisted
    quickShortcut: 'Control+Shift+V', // global shortcut for the quick window
  }),
  closeBehavior: 'ask',     // 'quit' | 'tray' | 'ask' (ask once, then remember)
  language: 'en',           // 'en' | 'fa' — UI language and direction
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
 * Validate a clipboard history record (`clipboard` object store).
 * Same spirit as validateEntryRecord; capture-time fields included.
 */
export function validateClipboardRecord(record) {
  if (!isObj(record)) return { ok: false, error: 'Record is not an object.' };
  if (typeof record.id !== 'string' || record.id.length === 0 || record.id.length > 128) {
    return { ok: false, error: 'Record id is missing or invalid.' };
  }
  if (typeof record.content !== 'string') return { ok: false, error: 'Record content must be text.' };
  if (record.content.length > LIMITS.ENTRY_CONTENT) {
    return { ok: false, error: 'Record content exceeds the size limit.' };
  }
  if (record.contentType !== undefined && typeof record.contentType !== 'string') {
    return { ok: false, error: 'Record contentType must be a string.' };
  }
  for (const b of ['isFavorite', 'isPinned', 'isSensitive']) {
    if (record[b] !== undefined && typeof record[b] !== 'boolean') {
      return { ok: false, error: `Record ${b} must be boolean.` };
    }
  }
  if (record.sensitiveKinds !== undefined) {
    if (!Array.isArray(record.sensitiveKinds) || record.sensitiveKinds.some((k) => typeof k !== 'string')) {
      return { ok: false, error: 'Record sensitiveKinds are invalid.' };
    }
  }
  for (const ts of ['createdAt', 'updatedAt']) {
    if (!Number.isFinite(record[ts])) return { ok: false, error: `Record ${ts} must be a number.` };
  }
  return { ok: true };
}

/**
 * Validate a snippet record (`snippets` object store).
 */
export function validateSnippetRecord(record) {
  if (!isObj(record)) return { ok: false, error: 'Record is not an object.' };
  if (typeof record.id !== 'string' || record.id.length === 0 || record.id.length > 128) {
    return { ok: false, error: 'Record id is missing or invalid.' };
  }
  if (typeof record.title !== 'string' || record.title.length > LIMITS.ENTRY_TITLE) {
    return { ok: false, error: 'Snippet title is invalid or too long.' };
  }
  if (typeof record.content !== 'string') return { ok: false, error: 'Snippet content must be text.' };
  if (record.content.length > LIMITS.ENTRY_CONTENT) {
    return { ok: false, error: 'Snippet content exceeds the size limit.' };
  }
  if (record.description !== undefined
      && (typeof record.description !== 'string' || record.description.length > LIMITS.ENTRY_DESCRIPTION)) {
    return { ok: false, error: 'Snippet description is invalid or too long.' };
  }
  if (record.tags !== undefined) {
    if (!Array.isArray(record.tags) || record.tags.length > LIMITS.ENTRY_TAGS
        || record.tags.some((t) => typeof t !== 'string' || t.length > LIMITS.TAG_LENGTH)) {
      return { ok: false, error: 'Snippet tags are invalid.' };
    }
  }
  if (!validCollectionsField(record)) return { ok: false, error: 'Snippet collections are invalid.' };
  if (record.isFavorite !== undefined && typeof record.isFavorite !== 'boolean') {
    return { ok: false, error: 'Snippet isFavorite must be boolean.' };
  }
  for (const ts of ['createdAt', 'updatedAt']) {
    if (!Number.isFinite(record[ts])) return { ok: false, error: `Record ${ts} must be a number.` };
  }
  return { ok: true };
}

/**
 * Validate a collection record (`collections` object store).
 */
export function validateCollectionRecord(record) {
  if (!isObj(record)) return { ok: false, error: 'Record is not an object.' };
  if (typeof record.id !== 'string' || record.id.length === 0 || record.id.length > 128) {
    return { ok: false, error: 'Record id is missing or invalid.' };
  }
  if (typeof record.name !== 'string' || record.name.trim().length === 0 || record.name.length > LIMITS.TAG_LENGTH * 2) {
    return { ok: false, error: 'Collection name is invalid or too long.' };
  }
  if (record.description !== undefined
      && (typeof record.description !== 'string' || record.description.length > LIMITS.ENTRY_DESCRIPTION)) {
    return { ok: false, error: 'Collection description is invalid or too long.' };
  }
  if (!Number.isFinite(record.createdAt)) return { ok: false, error: 'Record createdAt must be a number.' };
  return { ok: true };
}

/** `collections` membership must be an array of id strings. */
function validCollectionsField(record) {
  if (record.collections === undefined) return true;
  return Array.isArray(record.collections)
    && record.collections.length <= 100
    && record.collections.every((c) => typeof c === 'string' && c.length <= 128);
}

/** Allowlist of record kinds that may carry collection membership. */
export const COLLECTION_MEMBER_KINDS = ['clipboard', 'entry', 'snippet'];

/**
 * Sanitize a settings object loaded from storage: keep known keys, repair
 * invalid values to defaults, clamp numeric ranges, drop unknown keys.
 * A corrupted settings record must never break boot (ARCHITECTURE.md §38).
 */
export function sanitizeSettings(raw) {
  const src = isObj(raw) ? raw : {};
  const out = { ...DEFAULT_SETTINGS, clipboard: { ...DEFAULT_SETTINGS.clipboard } };
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
  if (CLOSE_BEHAVIORS.includes(src.closeBehavior)) out.closeBehavior = src.closeBehavior;
  if (LANGUAGES.includes(src.language)) out.language = src.language;
  const cb = isObj(src.clipboard) ? src.clipboard : {};
  if (typeof cb.monitorEnabled === 'boolean') out.clipboard.monitorEnabled = cb.monitorEnabled;
  if (DUPLICATE_POLICIES.includes(cb.duplicatePolicy)) out.clipboard.duplicatePolicy = cb.duplicatePolicy;
  if (Number.isFinite(cb.maxItems)) {
    out.clipboard.maxItems = Math.min(50000, Math.max(10, Math.round(Number(cb.maxItems))));
  }
  if (typeof cb.autoClearSensitive === 'boolean') out.clipboard.autoClearSensitive = cb.autoClearSensitive;
  if (Number.isFinite(cb.retentionDays)) {
    out.clipboard.retentionDays = Math.min(365, Math.max(0, Math.round(Number(cb.retentionDays))));
  }
  if (isValidShortcutString(cb.quickShortcut)) out.clipboard.quickShortcut = cb.quickShortcut;
  return out;
}

/** Electron accelerator shape: Modifier+Modifier+Key (validated loosely). */
export function isValidShortcutString(s) {
  if (typeof s !== 'string' || s.length === 0 || s.length > 64) return false;
  const parts = s.split('+');
  if (parts.length < 2 || parts.length > 4) return false;
  const modifiers = ['Control', 'Ctrl', 'Command', 'Cmd', 'Shift', 'Alt', 'Option', 'AltGr', 'Super'];
  const key = parts[parts.length - 1];
  if (!/^[A-Z0-9]$|^[A-Z]{3,9}$/.test(key)) return false;
  return parts.slice(0, -1).every((m) => modifiers.includes(m));
}
