// Clipboard domain layer (renderer): receives captures from the main-process
// monitor, applies the centralized duplicate + retention policies, and
// persists to the validated `clipboard` store. UI components never talk to
// storage directly (ARCHITECTURE.md §66 — no direct database access from UI).

import { db } from './db.js';
import { App } from '../state.js';
import { duplicateAction, applyRetention, applyTimeRetention, buildClipboardItem } from '../../../shared/clipboard-policy.mjs';
import { validateClipboardRecord } from '../../../shared/validation.mjs';
import { parseQuery, matchClipboardItem } from '../../../shared/query.mjs';
import { detectContentType } from '../../../shared/detect.mjs';
import { collectionList } from './snippets.js';

const items = new Map();      // id -> clipboard item
let ackQueue = [];
let ackTimer = null;
let monitorState = { enabled: true, paused: false, private: false, lastCaptureAt: 0, skipped: 0, pending: 0 };
let lastPersistMs = null;     // capture→persistence duration (perf metric)

function emitChanged() { App.emit('clipboard-changed'); }
function emitState() { App.emit('clipboard-state', monitorState); }

export function clipboardItems() {
  return [...items.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function clipboardCount() { return items.size; }

export function getClipboardItem(id) { return items.get(id); }

export function getMonitorState() { return monitorState; }

/** Duration of the most recent capture→persistence write (ms), or null. */
export function getLastPersistMs() { return lastPersistMs; }

export function setMonitorState(st) {
  monitorState = { ...monitorState, ...st };
  emitState();
}

function ack(id) {
  ackQueue.push(id);
  clearTimeout(ackTimer);
  ackTimer = setTimeout(async () => {
    const batch = ackQueue;
    ackQueue = [];
    try { await window.tv.clipboardAck(batch); } catch { /* retried on next boot */ }
  }, 150);
}

/**
 * Handle one incoming capture from the monitor.
 * Privacy pipeline (SECURITY.md §47/§59): sensitive-skip → duplicate
 * policy → persist → size + time retention.
 */
export async function applyCapture(item) {
  try {
    const cbSettings = App.settings.clipboard || {};

    // Sensitive auto-skip: when enabled, flagged captures are deliberately
    // NOT persisted (user-configured; acked so the monitor drops them).
    if (cbSettings.autoClearSensitive && item.isSensitive) {
      ack(item.id);
      return;
    }

    const policy = cbSettings.duplicatePolicy || 'top';
    const action = duplicateAction([...items.values()], item.content, policy);
    const now = Date.now();

    if (action.action === 'skip') {
      // Move-to-top: bump the existing item's timestamp (last-used semantics).
      const existing = items.get(action.existingId);
      if (existing) {
        existing.updatedAt = now;
        await db.putClipboardItem(existing);
      }
      ack(item.id);
      emitChanged();
      return;
    }

    items.set(item.id, item);
    const t0 = performance.now();
    await db.putClipboardItem(item);
    lastPersistMs = performance.now() - t0;
    ack(item.id);

    // Retention: newest maxItems win and time-based sweep runs here;
    // pinned/favorite are protected in both policies.
    const maxItems = cbSettings.maxItems ?? 1000;
    const remove = new Set(applyRetention([...items.values()], maxItems).remove);
    for (const id of applyTimeRetention([...items.values()], cbSettings.retentionDays ?? 0, now)) {
      remove.add(id);
    }
    if (remove.size) {
      const ids = [...remove];
      await db.deleteClipboardMany(ids);
      for (const id of ids) items.delete(id);
    }
    emitChanged();
  } catch (err) {
    // Do not ack on failure: the capture stays in the main-process queue and
    // is retried on next boot (no silent loss).
    console.error('Clipboard capture failed to persist:', err && err.message);
  }
}

/** Load persisted history + drain the monitor's pending-capture queue. */
export async function initClipboard() {
  const stored = await db.listClipboard().catch((err) => {
    console.error('Failed to load clipboard history:', err && err.message);
    return [];
  });
  for (const it of stored) items.set(it.id, it);

  // Captures that arrived while the renderer was busy/reloading.
  try {
    const pending = await window.tv.clipboardGetPending();
    for (const item of pending) await applyCapture(item);
  } catch { /* monitor may not be ready; pending persists */ }

  emitChanged();
}

/** Repair an imported clipboard record; returns null if hopeless. */
export function reviveClipboardItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.content !== 'string') return null;
  const now = Date.now();
  const item = buildClipboardItem({
    id: (typeof raw.id === 'string' && raw.id) || undefined,
    content: raw.content,
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : now,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : now,
    isSensitive: !!raw.isSensitive,
    sensitiveKinds: Array.isArray(raw.sensitiveKinds) ? raw.sensitiveKinds : [],
    sourceApplication: typeof raw.sourceApplication === 'string' ? raw.sourceApplication : null,
  });
  item.contentType = typeof raw.contentType === 'string' ? raw.contentType : 'text';
  item.isFavorite = !!raw.isFavorite;
  item.isPinned = !!raw.isPinned;
  item.collections = Array.isArray(raw.collections)
    ? raw.collections.filter((c) => typeof c === 'string') : [];
  item.preview = typeof raw.preview === 'string' ? raw.preview : item.preview;
  return validateClipboardRecord(item).ok ? item : null;
}

/** Re-read the whole store into the cache (used after a backup restore). */
export async function reloadClipboardCache() {
  const stored = await db.listClipboard().catch(() => []);
  items.clear();
  for (const it of stored) items.set(it.id, it);
  emitChanged();
  return items.size;
}

export async function copyClipboardItem(id) {
  const it = items.get(id);
  if (!it) return false;
  await window.tv.clipboardWrite(it.content);
  return true;
}

export async function toggleClipboardPin(id) {
  const it = items.get(id);
  if (!it) return;
  it.isPinned = !it.isPinned;
  await db.putClipboardItem(it);
  emitChanged();
}

export async function toggleClipboardFavorite(id) {
  const it = items.get(id);
  if (!it) return;
  it.isFavorite = !it.isFavorite;
  await db.putClipboardItem(it);
  emitChanged();
}

export async function deleteClipboardItem(id) {
  await db.deleteClipboardItem(id);
  items.delete(id);
  emitChanged();
}

/** Restore a previously deleted record exactly as it was (undo path). */
export async function restoreClipboardItem(item) {
  await db.putClipboardItem(item);
  items.set(item.id, item);
  emitChanged();
}

export async function clearClipboardHistory() {
  await db.clearClipboard();
  items.clear();
  emitChanged();
}

export async function setPaused(paused) {
  const res = await window.tv.clipboardSetPaused(paused);
  if (res && res.state) setMonitorState(res.state);
  return res;
}

export async function setMonitorEnabled(enabled) {
  const res = await window.tv.clipboardSetEnabled(enabled);
  if (res && res.state) setMonitorState(res.state);
  return res;
}

/** Private mode (session-only): captures are discarded while active. */
export async function setPrivateMode(privateMode) {
  const res = await window.tv.clipboardSetPrivate(privateMode);
  if (res && res.state) setMonitorState(res.state);
  return res;
}

/* ------------------ test/performance helpers (e2e only) ------------------ */

/** Bulk-seed synthetic items in one transaction (E2E perf measurement). */
export async function seedPerfItems(n = 10000) {
  const now = Date.now();
  const batch = [];
  for (let i = 0; i < n; i++) {
    batch.push(buildClipboardItem({
      id: 'perf-' + i,
      content: 'perf item ' + i + ' — متن شماره ' + i + ' https://example.com/' + i,
      createdAt: now - i,
      updatedAt: now - i,
      isPinned: i % 500 === 0,
      isFavorite: i % 750 === 0,
    }));
    batch[batch.length - 1].contentType = 'text';
  }
  await db.putClipboardItems(batch);
  for (const it of batch) items.set(it.id, it);
  emitChanged();
  return items.size;
}

/** Measure a full parsed-query scan over the cache (E2E perf measurement). */
export function searchPerf(query, runs = 20) {
  const q = parseQuery(query);
  const idToName = new Map(collectionList().map((c) => [c.id, c.name]));
  const samples = [];
  let hits = 0;
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    hits = 0;
    for (const it of items.values()) {
      if (matchClipboardItem(it, q, idToName, detectContentType)) hits++;
    }
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))];
  return { p95, max: samples[samples.length - 1], avg: samples.reduce((a, b) => a + b, 0) / samples.length, hits, total: items.size };
}
