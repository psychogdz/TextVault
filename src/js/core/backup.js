// Backup / restore orchestration (Phase 8).
// Export gathers the whole library (texts + clipboard + snippets +
// collections) into the versioned v2 envelope. Import VALIDATES first
// (shared/backup-format.mjs + record-level revive), then applies merge or
// replace through the normal transactional storage layer — malformed input
// can never partially destroy the library (SECURITY.md §59.33).

import { App } from '../state.js';
import { db } from './db.js';
import { reviveEntry } from './entry.js';
import { clipboardItems, reviveClipboardItem, reloadClipboardCache } from './clipboard.js';
import {
  snippetList, collectionList, reviveSnippet,
  reloadSnippetsCache, reloadCollectionsCache,
} from './snippets.js';

/** Gather the entire library and hand it to the main process for export. */
export async function exportLibrary() {
  const payload = {
    entries: [...App.entries.values()],
    clipboard: clipboardItems(),
    snippets: snippetList(),
    collections: collectionList().map((c) => ({ ...c })),
  };
  return window.tv.backupExport(payload);
}

/**
 * Apply a validated backup (as returned by tv:backup-import) to the library.
 * mode 'merge' — keep current data, add the backup (dedup by content hash /
 * id; existing collections win on id conflicts).
 * mode 'replace' — every store is atomically replaced.
 */
export async function importBackup(backup, { mode }) {
  const revived = {
    entries: [], clipboard: [], snippets: [], collections: [],
  };
  for (const raw of backup.entries || []) {
    const e = await reviveEntry(raw);
    if (e) revived.entries.push(e);
  }
  for (const raw of backup.clipboard || []) {
    const c = reviveClipboardItem(raw);
    if (c) revived.clipboard.push(c);
  }
  for (const raw of backup.snippets || []) {
    const s = reviveSnippet(raw);
    if (s) revived.snippets.push(s);
  }
  for (const raw of backup.collections || []) {
    if (raw && typeof raw === 'object' && typeof raw.name === 'string' && raw.name.trim()) {
      revived.collections.push({
        id: typeof raw.id === 'string' && raw.id ? raw.id : undefined,
        name: raw.name.trim(),
        description: typeof raw.description === 'string' ? raw.description : '',
        createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
      });
    }
  }

  // Ensure imported collections all have stable ids before members reference them.
  const uid = () => (crypto.randomUUID && crypto.randomUUID()) ||
    'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  for (const c of revived.collections) {
    if (!c.id) c.id = uid();
  }

  let imported = 0;

  // ---- entries (existing paths handle merge/replace transactionally) ----
  if (revived.entries.length) {
    const res = await App.importLibrary(revived.entries, { mode });
    imported += res.imported || 0;
  } else if (mode === 'replace') {
    await db.replaceStore('entries', []);
  }

  // ---- clipboard ----
  if (mode === 'replace') {
    await db.replaceStore('clipboard', revived.clipboard);
    await reloadClipboardCache();
    imported += revived.clipboard.length;
  } else if (revived.clipboard.length) {
    const existingContents = new Set(clipboardItems().map((c) => c.content));
    const pending = [];
    for (const c of revived.clipboard) {
      if (existingContents.has(c.content)) continue; // exact duplicate skip
      existingContents.add(c.content);
      pending.push(c);
    }
    if (pending.length) {
      await db.putClipboardItems(pending);
      await reloadClipboardCache();
      imported += pending.length;
    }
  }

  // ---- collections (before snippets so member ids resolve) ----
  if (mode === 'replace') {
    await db.replaceStore('collections', revived.collections);
    await reloadCollectionsCache();
  } else if (revived.collections.length) {
    const existingIds = new Set(collectionList().map((c) => c.id));
    for (const c of revived.collections) {
      if (existingIds.has(c.id)) continue; // existing wins on id conflict
      await db.putCollection(c);
      imported += 1;
    }
    await reloadCollectionsCache();
  }

  // ---- snippets ----
  if (mode === 'replace') {
    await db.replaceStore('snippets', revived.snippets);
    await reloadSnippetsCache();
    imported += revived.snippets.length;
  } else if (revived.snippets.length) {
    const existingIds = new Set(snippetList().map((s) => s.id));
    const existingContents = new Set(snippetList().map((s) => s.content));
    for (const s of revived.snippets) {
      if (existingIds.has(s.id) || existingContents.has(s.content)) continue;
      await db.putSnippet(s);
      existingIds.add(s.id);
      imported += 1;
    }
    await reloadSnippetsCache();
  }

  App.emit('entries-changed');
  return { imported, version: backup.version };
}
