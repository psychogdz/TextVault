// IndexedDB storage layer — the app's local database.
// Database "textvault" with an "entries" object store (keyPath "id") and a
// "settings" key-value store. IndexedDB is Chromium's native embedded database
// (LevelDB-backed, transactional) and lives under the app's userData folder.
//
// Phase 2 (storage layer):
//  - every write is validated against the shared record contract
//  - multi-record operations (replace/bulk delete/merge) run in a SINGLE
//    transaction so a crash can never leave the library half-modified
//  - the schema version is persisted and migrations run on open
//    (see shared/storage-migrations.mjs)

import {
  validateEntryRecord, validateClipboardRecord, validateSnippetRecord,
  validateCollectionRecord, SCHEMA_VERSION,
} from '../../../shared/validation.mjs';
import { runMigrations } from '../../../shared/storage-migrations.mjs';

const DB_NAME = 'textvault';
const DB_VERSION = 3;
const SCHEMA_KEY = 'schema-version';

let dbPromise = null;

function reject(reason) { throw new Error(`Storage rejected an invalid record: ${reason}`); }
const asserters = {
  entries: (r) => { const c = validateEntryRecord(r); if (!c.ok) reject(c.error); },
  clipboard: (r) => { const c = validateClipboardRecord(r); if (!c.ok) reject(c.error); },
  snippets: (r) => { const c = validateSnippetRecord(r); if (!c.ok) reject(c.error); },
  collections: (r) => { const c = validateCollectionRecord(r); if (!c.ok) reject(c.error); },
};

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('entries')) {
        const store = db.createObjectStore('entries', { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('openedAt', 'openedAt');
        store.createIndex('deletedAt', 'deletedAt');
        store.createIndex('contentHash', 'contentHash');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
      if (!db.objectStoreNames.contains('clipboard')) {
        const cb = db.createObjectStore('clipboard', { keyPath: 'id' });
        cb.createIndex('createdAt', 'createdAt');
        cb.createIndex('updatedAt', 'updatedAt');
        cb.createIndex('contentHash', 'contentHash');
      }
      if (!db.objectStoreNames.contains('snippets')) {
        const sn = db.createObjectStore('snippets', { keyPath: 'id' });
        sn.createIndex('updatedAt', 'updatedAt');
        sn.createIndex('title', 'title');
      }
      if (!db.objectStoreNames.contains('collections')) {
        const co = db.createObjectStore('collections', { keyPath: 'id' });
        co.createIndex('name', 'name');
      }
    };
    req.onsuccess = async () => {
      const db = req.result;
      try {
        await ensureSchemaVersion(db);
        resolve(db);
      } catch (err) {
        reject(err);
      }
    };
    req.onerror = () => reject(req.error || new Error('Failed to open local database'));
  });
  return dbPromise;
}

/** Read the persisted schema version (absent = 1) and run pending migrations. */
async function ensureSchemaVersion(db) {
  const current = await new Promise((resolve, reject) => {
    const t = db.transaction('settings', 'readonly');
    const req = t.objectStore('settings').get(SCHEMA_KEY);
    req.onsuccess = () => resolve(Number.isFinite(req.result) ? req.result : 1);
    req.onerror = () => reject(req.error);
  });
  if (current === SCHEMA_VERSION) return;

  // Migrate record-level data through the pure runner. Future store-shape
  // migrations also bump DB_VERSION above and adjust onupgradeneeded.
  const getAllIn = (store) => new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readonly');
    const req = t.objectStore(store).getAll();
    reqToPromise(req, t).then(resolve, reject);
  });
  const migrated = {};
  for (const store of ['entries', 'clipboard']) {
    const result = runMigrations(await getAllIn(store), current, SCHEMA_VERSION);
    if (result.errors.length) {
      // Fail safe: keep the old data untouched, report loudly.
      throw new Error(`Storage migration failed: ${result.errors[0]}`);
    }
    migrated[store] = result.records;
  }
  await new Promise((resolve, reject) => {
    const t = db.transaction(['entries', 'clipboard', 'settings'], 'readwrite');
    for (const store of ['entries', 'clipboard']) {
      const os = t.objectStore(store);
      os.clear();
      for (const rec of migrated[store]) os.put(rec);
    }
    t.objectStore('settings').put(SCHEMA_VERSION, SCHEMA_KEY);
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}

function reqToPromise(request, transaction) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    // keep transaction alive via success handler; completion handled by caller
    void transaction;
  });
}

function listEntriesIn(db) {
  return new Promise((resolve, reject) => {
    const t = db.transaction('entries', 'readonly');
    const req = t.objectStore('entries').getAll();
    reqToPromise(req, t).then(resolve, reject);
  });
}

export const db = {
  async listEntries() {
    const d = await openDb();
    return listEntriesIn(d);
  },

  async getEntry(id) {
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('entries', 'readonly');
      const req = t.objectStore('entries').get(id);
      reqToPromise(req, t).then(resolve, reject);
    });
  },

  async putEntry(entry) {
    asserters.entries(entry);
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('entries', 'readwrite');
      const req = t.objectStore('entries').put(entry);
      reqToPromise(req, t).then(resolve, reject);
    });
  },

  /** Put many entries atomically (one transaction; all or nothing). */
  async putEntries(entries) {
    for (const e of entries) asserters.entries(e);
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('entries', 'readwrite');
      const store = t.objectStore('entries');
      for (const e of entries) store.put(e);
      t.oncomplete = () => resolve(entries.length);
      t.onerror = () => reject(t.error);
    });
  },

  /**
   * Atomically replace the whole store with `entries` (one transaction:
   * clear + put together). Used by import "replace" mode so an interrupted
   * operation can never leave the library half-destroyed.
   */
  async replaceEntries(entries) {
    return db.replaceStore('entries', entries);
  },

  /**
   * Generic atomic store replacement (clear + put in ONE transaction) for
   * any validated store — used by backup restore (SECURITY.md §59.12/59.13).
   */
  async replaceStore(store, records) {
    for (const r of records) asserters[store](r);
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction(store, 'readwrite');
      const os = t.objectStore(store);
      os.clear();
      for (const r of records) os.put(r);
      t.oncomplete = () => resolve(records.length);
      t.onerror = () => reject(t.error);
    });
  },

  async deleteEntry(id) {
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('entries', 'readwrite');
      const req = t.objectStore('entries').delete(id);
      reqToPromise(req, t).then(resolve, reject);
    });
  },

  /** Delete many ids atomically (one transaction). */
  async deleteMany(ids) {
    if (!ids.length) return 0;
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('entries', 'readwrite');
      const store = t.objectStore('entries');
      for (const id of ids) store.delete(id);
      t.oncomplete = () => resolve(ids.length);
      t.onerror = () => reject(t.error);
    });
  },

  async getSetting(key, fallback = null) {
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('settings', 'readonly');
      const req = t.objectStore('settings').get(key);
      req.onsuccess = () => resolve(req.result === undefined ? fallback : req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async setSetting(key, value) {
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('settings', 'readwrite');
      const req = t.objectStore('settings').put(value, key);
      reqToPromise(req, t).then(resolve, reject);
    });
  },

  /* --------------------- clipboard history store --------------------- */

  async listClipboard() {
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('clipboard', 'readonly');
      const req = t.objectStore('clipboard').getAll();
      reqToPromise(req, t).then(resolve, reject);
    });
  },

  async putClipboardItem(item) {
    asserters.clipboard(item);
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('clipboard', 'readwrite');
      const req = t.objectStore('clipboard').put(item);
      reqToPromise(req, t).then(resolve, reject);
    });
  },

  async putClipboardItems(items) {
    for (const it of items) asserters.clipboard(it);
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('clipboard', 'readwrite');
      const store = t.objectStore('clipboard');
      for (const it of items) store.put(it);
      t.oncomplete = () => resolve(items.length);
      t.onerror = () => reject(t.error);
    });
  },

  async deleteClipboardItem(id) {
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('clipboard', 'readwrite');
      const req = t.objectStore('clipboard').delete(id);
      reqToPromise(req, t).then(resolve, reject);
    });
  },

  async deleteClipboardMany(ids) {
    if (!ids.length) return 0;
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('clipboard', 'readwrite');
      const store = t.objectStore('clipboard');
      for (const id of ids) store.delete(id);
      t.oncomplete = () => resolve(ids.length);
      t.onerror = () => reject(t.error);
    });
  },

  /** Clear the entire clipboard history atomically. */
  async clearClipboard() {
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('clipboard', 'readwrite');
      const req = t.objectStore('clipboard').clear();
      reqToPromise(req, t).then(resolve, reject);
    });
  },

  /* --------------------------- snippets store --------------------------- */

  async listSnippets() {
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('snippets', 'readonly');
      const req = t.objectStore('snippets').getAll();
      reqToPromise(req, t).then(resolve, reject);
    });
  },

  async putSnippet(snippet) {
    asserters.snippets(snippet);
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('snippets', 'readwrite');
      const req = t.objectStore('snippets').put(snippet);
      reqToPromise(req, t).then(resolve, reject);
    });
  },

  async deleteSnippet(id) {
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('snippets', 'readwrite');
      const req = t.objectStore('snippets').delete(id);
      reqToPromise(req, t).then(resolve, reject);
    });
  },

  /* -------------------------- collections store ------------------------- */

  async listCollections() {
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('collections', 'readonly');
      const req = t.objectStore('collections').getAll();
      reqToPromise(req, t).then(resolve, reject);
    });
  },

  async putCollection(collection) {
    asserters.collections(collection);
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('collections', 'readwrite');
      const req = t.objectStore('collections').put(collection);
      reqToPromise(req, t).then(resolve, reject);
    });
  },

  /**
   * Delete a collection and strip its id from every member record in ONE
   * transaction — membership can never dangle. `memberRefs` is supplied by
   * the caller (domain layer) as [{ store, record }, ...].
   */
  async deleteCollection(id, memberRefs) {
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const stores = [...new Set(['collections', ...memberRefs.map((r) => r.store)])];
      const t = d.transaction(stores, 'readwrite');
      t.objectStore('collections').delete(id);
      for (const ref of memberRefs) {
        const rec = { ...ref.record };
        rec.collections = (rec.collections || []).filter((c) => c !== id);
        t.objectStore(ref.store).put(rec);
      }
      t.oncomplete = () => resolve(true);
      t.onerror = () => reject(t.error);
    });
  },
};
