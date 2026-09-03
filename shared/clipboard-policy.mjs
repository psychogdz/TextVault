// Clipboard domain policies (shared main/renderer/tests): duplicate handling
// and retention. Pure functions so the rules are centralized and unit-testable
// (ARCHITECTURE.md §20 — duplicate handling must NOT live in UI components).

import { buildPreview } from './snippets.mjs';

export const DUPLICATE_POLICIES = ['top', 'new'];
// 'top' — re-copying existing content moves the existing item to the top
//         (updates its timestamp; no new record). Default.
// 'new' — every copy creates a new history entry.

export const CLIPBOARD_CONTENT_LIMIT = 1024 * 1024; // 1 MB of text per capture

/** Preview + hash-free identity helper used by policies and UI. */
export function clipboardPreview(content, maxLen = 220) {
  return buildPreview(content, maxLen);
}

/**
 * Duplicate policy.
 * @param {Array<{id:string, content:string, isPinned?:boolean}>} items  current history (any order)
 * @param {string} content  incoming clipboard text
 * @param {string} policy   'top' | 'new'
 * @returns {{ action: 'create' } | { action: 'skip', existingId: string } }
 */
export function duplicateAction(items, content, policy = 'top') {
  if (policy === 'new') return { action: 'create' };
  const hit = items.find((it) => it.content === content);
  if (hit) return { action: 'skip', existingId: hit.id };
  return { action: 'create' };
}

/**
 * Retention: keep the newest `maxItems` items, protecting pinned and
 * favorite items from ordinary cleanup (PRODUCT_SPEC §18).
 * Bounds are enforced at the settings layer (sanitizeSettings clamps
 * maxItems to 10..50000); this function honors any non-negative cap.
 * @param {Array<{id:string, isPinned?:boolean, isFavorite?:boolean, updatedAt:number}>} items
 * @param {number} maxItems
 * @returns {{ keep: string[], remove: string[] }}
 */
export function applyRetention(items, maxItems) {
  const cap = Number.isFinite(maxItems) && maxItems >= 0 ? Math.floor(maxItems) : 1000;
  const protectedIds = new Set(
    items.filter((it) => it.isPinned || it.isFavorite).map((it) => it.id),
  );
  const removable = items
    .filter((it) => !protectedIds.has(it.id))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const keep = new Set(protectedIds);
  for (const it of removable.slice(0, cap)) keep.add(it.id);
  const remove = items.filter((it) => !keep.has(it.id)).map((it) => it.id);
  return { keep: [...keep], remove };
}

/**
 * Time-based retention: remove items older than `retentionDays`.
 * Pinned/favorite items are always protected (PRODUCT_SPEC §18).
 * days = 0 (or non-finite) means "keep forever" — no removals.
 * @returns {string[]} ids to remove
 */
export function applyTimeRetention(items, retentionDays, now = Date.now()) {
  const days = Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : 0;
  if (!days) return [];
  const cutoff = now - days * 86_400_000;
  return items
    .filter((it) => !it.isPinned && !it.isFavorite && (it.updatedAt || 0) < cutoff)
    .map((it) => it.id);
}

/** Build the canonical clipboard record (caller supplies id + timestamps). */
export function buildClipboardItem({ id, content, createdAt, updatedAt, isSensitive, sensitiveKinds, sourceApplication = null }) {
  return {
    id,
    contentType: 'text',
    content,
    preview: clipboardPreview(content),
    createdAt,
    updatedAt,
    sourceApplication,
    isFavorite: false,
    isPinned: false,
    isSensitive: !!isSensitive,
    sensitiveKinds: Array.isArray(sensitiveKinds) ? sensitiveKinds : [],
    metadata: {},
  };
}
