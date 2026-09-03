// Schema migrations for the persistent stores (shared renderer/tests).
//
// Contract (SECURITY.md §59.14/59.15):
//  - migrations are versioned, deterministic, and forward-only
//  - MIGRATIONS[v] transforms records from schema version v-1 to v
//  - a migration must never silently discard user data; if a record cannot be
//    migrated it is returned unchanged and flagged, never dropped
//  - the runner is a pure function so it is unit-testable without IndexedDB

import { SCHEMA_VERSION } from './validation.mjs';

/**
 * Map of target version → migration function (applied to `entries` records).
 * Version 2: the clipboard store is created separately in onupgradeneeded;
 * entry records themselves are unchanged, so this step is an explicit no-op
 * that only records the version bump. Future record-shape changes go here.
 */
export const MIGRATIONS = {
  2: (record) => record,
};

/**
 * Pure migration runner.
 * @param {Array<object>} records  records of the store being migrated
 * @param {number} fromVersion     schema version of the records
 * @param {number} toVersion       target schema version (defaults to SCHEMA_VERSION)
 * @returns {{ records: Array<object>, migrated: number, skipped: number, errors: string[] }}
 *   `skipped` counts records that a migration left unchanged; nothing is
 *   ever dropped here.
 */
export function runMigrations(records, fromVersion, toVersion = SCHEMA_VERSION) {
  if (!Array.isArray(records)) {
    return { records: [], migrated: 0, skipped: 0, errors: ['records is not an array'] };
  }
  let current = Number.isFinite(fromVersion) ? fromVersion : 1;
  let out = [...records];
  const errors = [];
  let migrated = 0;
  let skipped = 0;

  while (current < toVersion) {
    const step = MIGRATIONS[current + 1];
    if (typeof step !== 'function') {
      errors.push(`missing migration to version ${current + 1}`);
      break;
    }
    try {
      const next = out.map((rec) => {
        const res = step(rec);
        if (res === rec) { skipped++; return rec; }
        migrated++;
        return res;
      });
      out = next;
      current += 1;
    } catch (err) {
      errors.push(`migration to version ${current + 1} failed: ${err && err.message ? err.message : err}`);
      break; // fail safe: keep the records as they are, never discard
    }
  }

  return { records: out, migrated, skipped, errors, version: current };
}
