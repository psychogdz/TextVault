'use strict';

// Clipboard engine (main process): monitors the system clipboard, tags
// captures (sensitive-content flags, timestamps), and hands them to the
// renderer for policy + persistence. The renderer's IndexedDB remains the
// single canonical store; this module keeps only UNACKNOWLEDGED captures in
// memory so nothing is lost while the renderer is busy or reloading.
//
// Privacy: capture is local-only. Nothing is logged except non-sensitive
// metadata (sizes, counts, flags) — never the clipboard text itself.

const crypto = require('node:crypto');
const { clipboard } = require('electron');
const { sendToMain } = require('./window');
const { refreshTray } = require('./tray');
const { EMITTED } = require('../ipc/channels');

const POLL_MS = 600;
const MAX_PENDING = 200;

const state = {
  enabled: true,      // master switch (mirrors settings; renderer corrects on boot)
  paused: false,      // temporary pause
  lastText: null,     // last clipboard text seen by the monitor
  lastCaptureAt: 0,
  skipped: 0,         // captures skipped (oversized/invalid)
  pending: new Map(), // id -> item awaiting renderer persistence ack
  timer: null,
  sensitive: null,    // shared/sensitive.mjs (loaded async — ESM)
  policy: null,       // shared/clipboard-policy.mjs (loaded async — ESM)
};

async function loadSharedModules() {
  if (!state.sensitive) {
    state.sensitive = await import('../../shared/sensitive.mjs');
  }
  if (!state.policy) {
    state.policy = await import('../../shared/clipboard-policy.mjs');
  }
}

function getState() {
  return {
    enabled: state.enabled,
    paused: state.paused,
    lastCaptureAt: state.lastCaptureAt,
    skipped: state.skipped,
    pending: state.pending.size,
  };
}

function notifyState() {
  sendToMain(EMITTED.CLIPBOARD_STATE_CHANGED, getState());
  try {
    refreshTray(getState());
  } catch { /* tray unavailable (e.g., headless) — never break capture */ }
}

function setPaused(paused) {
  state.paused = !!paused;
  notifyState();
}

function setEnabled(enabled) {
  state.enabled = !!enabled;
  notifyState();
}

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/** One monitor tick: detect clipboard changes and emit a capture. */
function tick() {
  if (!state.enabled || state.paused) return;
  let text;
  try {
    text = clipboard.readText('clipboard');
  } catch {
    return; // clipboard temporarily unavailable — try again next tick
  }
  if (typeof text !== 'string' || text.length === 0) return;
  if (text === state.lastText) return;

  state.lastText = text;

  if (text.length > state.policy.CLIPBOARD_CONTENT_LIMIT) {
    state.skipped += 1; // oversized capture: skipped safely, never truncated
    notifyState();
    return;
  }

  const now = Date.now();
  const det = state.sensitive.detectSensitive(text);
  const item = state.policy.buildClipboardItem({
    id: crypto.randomUUID(),
    content: text,
    createdAt: now,
    updatedAt: now,
    isSensitive: det.sensitive,
    sensitiveKinds: det.kinds,
    sourceApplication: null, // not available without native modules (documented)
  });

  // Bound the pending queue: drop the oldest unacknowledged capture.
  if (state.pending.size >= MAX_PENDING) {
    const oldest = state.pending.keys().next().value;
    state.pending.delete(oldest);
    state.skipped += 1;
  }
  state.pending.set(item.id, item);
  state.lastCaptureAt = now;
  sendToMain(EMITTED.CLIPBOARD_CAPTURED, item);
  notifyState();
}

function startMonitor() {
  if (state.timer) return;
  loadSharedModules().then(() => {
    // Initialize lastText without capturing pre-existing clipboard content
    // at boot? No — capturing on boot is desired: the content a user had on
    // their clipboard when launching TextVault is exactly what they want saved.
    state.timer = setInterval(tick, POLL_MS);
    tick();
  });
}

function stopMonitor() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

/** Renderer acks captures after persisting them. */
function ackCaptured(ids) {
  for (const id of ids) state.pending.delete(id);
}

function getPending() {
  return [...state.pending.values()];
}

module.exports = {
  startMonitor,
  stopMonitor,
  getState,
  setPaused,
  setEnabled,
  ackCaptured,
  getPending,
  POLL_MS,
};
