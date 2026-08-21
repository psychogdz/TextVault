// IndexedDB storage layer — the app's local database.
// Database "textvault" with an "entries" object store (keyPath "id") and a
// "settings" key-value store. IndexedDB is Chromium's native embedded database
// (LevelDB-backed, transactional) and lives under the app's userData folder.

const DB_NAME = 'textvault';
const DB_VERSION = 1;

let dbPromise = null;

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
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open local database'));
  });
  return dbPromise;
}

function reqToPromise(request, transaction) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    // keep transaction alive via success handler; completion handled by caller
    void transaction;
  });
}

export const db = {
  async listEntries() {
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('entries', 'readonly');
      const req = t.objectStore('entries').getAll();
      reqToPromise(req, t).then(resolve, reject);
    });
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
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('entries', 'readwrite');
      const req = t.objectStore('entries').put(entry);
      reqToPromise(req, t).then(resolve, reject);
    });
  },

  async putEntries(entries) {
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction('entries', 'readwrite');
      const store = t.objectStore('entries');
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
