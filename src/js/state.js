// Central application state: entry cache, settings, persistence, pub/sub.
import { db } from './core/db.js';
import { createEntry, applyEdits, displayTitle, reviveEntry, deriveTitle } from './core/entry.js';
import { detectBaseDir } from '../../shared/bidi.mjs';

const listeners = new Map();

export const App = {
  entries: new Map(),          // id -> entry (full records, incl. deleted)
  ready: false,
  appInfo: null,

  settings: {
    theme: 'dark',             // 'light' | 'dark' | 'system'
    accent: 'violet',
    sort: 'modified-desc',
    editorFontSize: 14.5,
    editorFont: 'sans',        // 'sans' | 'mono'
    editorWrap: true,
    autoSave: true,
    autoSaveDelay: 800,
  },

  // navigation
  view: 'dashboard',           // dashboard | editor | trash | settings
  nav: 'all',                  // all | favorites | recent | trash | tag:<name>
  query: '',
  selection: new Set(),
  selectionMode: false,

  /* ------------------------- pub/sub ------------------------- */
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event).delete(fn);
  },
  emit(event, data) {
    const set = listeners.get(event);
    if (set) for (const fn of set) fn(data);
  },

  /* ------------------------- lifecycle ------------------------- */
  async init() {
    const [entries, storedSettings, appInfo] = await Promise.all([
      db.listEntries().catch((err) => {
        console.error('Failed to load library:', err);
        return [];
      }),
      db.getSetting('settings', {}),
      window.tv.appInfo().catch(() => null),
    ]);
    for (const e of entries) this.entries.set(e.id, e);
    Object.assign(this.settings, storedSettings || {});
    this.appInfo = appInfo;
    this.ready = true;
    this.emit('loaded');
  },

  async persistSettings() {
    try {
      await db.setSetting('settings', this.settings);
    } catch (err) {
      console.error('Failed to persist settings:', err);
    }
  },

  /* ------------------------- entry ops ------------------------- */
  liveEntries() {
    return [...this.entries.values()].filter((e) => !e.deletedAt);
  },
  trashedEntries() {
    return [...this.entries.values()].filter((e) => e.deletedAt);
  },

  get(id) { return this.entries.get(id); },

  async createNew({ title = '', content = '', tags = [], dir = 'auto' } = {}) {
    const entry = await createEntry({ title, content, tags, dir });
    this.entries.set(entry.id, entry);
    await this.saveEntry(entry, { touch: false });
    this.emit('entries-changed');
    return entry;
  },

  async saveEntry(entry, { touch = true } = {}) {
    // Persist as-is (derived fields must be current — editor keeps them fresh).
    await db.putEntry(entry);
    if (touch) this.emit('entries-changed');
  },

  async update(id, patch) {
    const entry = this.entries.get(id);
    if (!entry) return null;
    await applyEdits(entry, patch);
    await db.putEntry(entry);
    this.emit('entries-changed');
    return entry;
  },

  async toggleFavorite(id) {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.favorite = !entry.favorite;
    entry.updatedAt = Date.now();
    await db.putEntry(entry);
    this.emit('entries-changed');
    return entry.favorite;
  },

  async touchOpened(id) {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.openedAt = Date.now();
    await db.putEntry(entry);
  },

  async moveToTrash(id) {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.deletedAt = Date.now();
    await db.putEntry(entry);
    this.selection.delete(id);
    this.emit('entries-changed');
  },

  async restoreEntry(id) {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.deletedAt = null;
    entry.updatedAt = Date.now();
    await db.putEntry(entry);
    this.emit('entries-changed');
  },

  async purgeEntry(id) {
    await db.deleteEntry(id);
    this.entries.delete(id);
    this.selection.delete(id);
    this.emit('entries-changed');
  },

  async emptyTrash() {
    const ids = this.trashedEntries().map((e) => e.id);
    for (const id of ids) {
      await db.deleteEntry(id);
      this.entries.delete(id);
    }
    this.emit('entries-changed');
    return ids.length;
  },

  /** Find another live entry with identical content (duplicate detection). */
  findDuplicate(excludeId, contentHash) {
    for (const e of this.liveEntries()) {
      if (e.id !== excludeId && e.contentHash === contentHash) return e;
    }
    return null;
  },

  /** All tags in use with counts. */
  tagCounts() {
    const counts = new Map();
    for (const e of this.liveEntries()) {
      for (const t of e.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  },

  titleOf(entry) { return displayTitle(entry); },
  autoDir(entry) { return detectBaseDir(entry.content || ''); },

  /* ------------------------- backup ------------------------- */
  async exportLibrary() {
    const entries = [...this.entries.values()];
    const res = await window.tv.backupExport({ entries });
    return res;
  },

  async importLibrary(rawEntries, { mode }) {
    // mode: 'merge' (keep both, new ids on conflict) | 'replace' (wipe current)
    let revived = [];
    for (const raw of rawEntries) {
      const e = await reviveEntry(raw);
      if (e) revived.push(e);
    }
    if (!revived.length) return { imported: 0 };

    if (mode === 'replace') {
      for (const id of [...this.entries.keys()]) await db.deleteEntry(id);
      this.entries.clear();
      for (const e of revived) this.entries.set(e.id, e);
      await db.putEntries(revived);
    } else {
      const byHash = new Map([...this.entries.values()].map((e) => [e.contentHash + '|' + (e.deletedAt ? 'd' : 'l'), e]));
      const existingIds = new Set(this.entries.keys());
      for (let e of revived) {
        if (existingIds.has(e.id)) {
          e = await reviveEntry(e, { newId: true });
        }
        // skip exact duplicates (same hash & same live/deleted state) during merge
        const key = e.contentHash + '|' + (e.deletedAt ? 'd' : 'l');
        if (byHash.has(key)) continue;
        byHash.set(key, e);
        this.entries.set(e.id, e);
        await db.putEntry(e);
      }
    }
    this.emit('entries-changed');
    return { imported: revived.length };
  },
};

/** Derive a title from content (used by quick capture & untitled saves). */
export { deriveTitle };
