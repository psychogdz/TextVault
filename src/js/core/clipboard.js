// Clipboard domain layer (renderer): receives captures from the main-process
// monitor, applies the centralized duplicate + retention policies, and
// persists to the validated `clipboard` store. UI components never talk to
// storage directly (ARCHITECTURE.md §66 — no direct database access from UI).

import { db } from './db.js';
import { App } from '../state.js';
import { duplicateAction, applyRetention } from '../../../shared/clipboard-policy.mjs';

const items = new Map();      // id -> clipboard item
let ackQueue = [];
let ackTimer = null;
let monitorState = { enabled: true, paused: false, lastCaptureAt: 0, skipped: 0, pending: 0 };

function emitChanged() { App.emit('clipboard-changed'); }
function emitState() { App.emit('clipboard-state', monitorState); }

export function clipboardItems() {
  return [...items.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function clipboardCount() { return items.size; }

export function getClipboardItem(id) { return items.get(id); }

export function getMonitorState() { return monitorState; }

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
 * Applies the configured duplicate policy, persists, then runs retention.
 */
export async function applyCapture(item) {
  try {
    const policy = App.settings.clipboard?.duplicatePolicy || 'top';
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
    await db.putClipboardItem(item);
    ack(item.id);

    // Retention: newest maxItems win; pinned/favorite are protected.
    const maxItems = App.settings.clipboard?.maxItems ?? 1000;
    const { remove } = applyRetention([...items.values()], maxItems);
    if (remove.length) {
      await db.deleteClipboardMany(remove);
      for (const id of remove) items.delete(id);
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
