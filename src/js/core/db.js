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

import { validateEntryRecord, SCHEMA_VERSION } from '../../../shared/validation.mjs';
import { runMigrations } from '../../../shared/storage-migrations.mjs';

const DB_NAME = 'textvault';
const DB_VERSION = 1;
const SCHEMA_KEY = 'schema-version';

let dbPromise = null;

function assertValidEntry(entry) {
  const check = validateEntryRecord(entry);
  if (!check.ok) throw new Error(`Storage rejected an invalid record: ${check.error}`);
}

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
  const records = await listEntriesIn(db);
  const result = runMigrations(records, current, SCHEMA_VERSION);
  if (result.errors.length) {
    // Fail safe: keep the old data untouched, report loudly.
    throw new Error(`Storage migration failed: ${result.errors[0]}`);
  }
  await new Promise((resolve, reject) => {
    const t = db.transaction(['entries', 'settings'], 'readwrite');
    const entries = t.objectStore('entries');
    entries.clear();
    for (const rec of result.records) entries.put(rec);
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
    assertValidEntry(entry);
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('entries', 'readwrite');
      const req = t.objectStore('entries').put(entry);
      reqToPromise(req, t).then(resolve, reject);
    });
  },

  /** Put many entries atomically (one transaction; all or nothing). */
  async putEntries(entries) {
    for (const e of entries) assertValidEntry(e);
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
    for (const e of entries) assertValidEntry(e);
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('entries', 'readwrite');
      const store = t.objectStore('entries');
      store.clear();
      for (const e of entries) store.put(e);
      t.oncomplete = () => resolve(entries.length);
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
};
