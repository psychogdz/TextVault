// Entry model: creation, derived fields (stats/preview/hash), validation.
import { textStats } from '../../../shared/stats.mjs';
import { buildPreview } from '../../../shared/snippets.mjs';

export function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) ||
    'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Derive display title from content when the user left the title empty. */
export function deriveTitle(content = '') {
  const firstLine = String(content).split(/\r?\n/).find((l) => l.trim().length > 0) || '';
  const flat = firstLine.replace(/\s+/g, ' ').trim();
  if (!flat) return '';
  return flat.length > 64 ? flat.slice(0, 63).trimEnd() + '…' : flat;
}

export const CARD_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];

export function normalizeColor(color) {
  return CARD_COLORS.includes(color) ? color : null;
}

export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const out = [];
  for (let t of tags) {
    t = String(t).trim().replace(/\s+/g, ' ');
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.slice(0, 24);
}

/** Build derived fields from content (stats, preview, hash). */
export async function deriveFields(entry) {
  entry.stats = textStats(entry.content);
  entry.preview = buildPreview(entry.content, 220);
  entry.contentHash = await sha256Hex(entry.content);
  return entry;
}

export async function createEntry({ title = '', content = '', tags = [], dir = 'auto', description = '', color = null } = {}) {
  const now = Date.now();
  const entry = {
    id: uid(),
    title: String(title).trim(),
    content: String(content),
    tags: normalizeTags(tags),
    description: String(description || ''),
    dir: ['auto', 'rtl', 'ltr'].includes(dir) ? dir : 'auto',
    color: normalizeColor(color),
    favorite: false,
    createdAt: now,
    updatedAt: now,
    openedAt: null,
    deletedAt: null,
    contentHash: '',
    preview: '',
    stats: null,
  };
  return deriveFields(entry);
}

/** Apply user edits to an entry, recomputing derived fields + updatedAt. */
export async function applyEdits(entry, { title, content, tags, dir, description, color }, { touch = true } = {}) {
  if (title !== undefined) entry.title = String(title).trim();
  if (content !== undefined) entry.content = String(content);
  if (tags !== undefined) entry.tags = normalizeTags(tags);
  if (dir !== undefined && ['auto', 'rtl', 'ltr'].includes(dir)) entry.dir = dir;
  if (description !== undefined) entry.description = String(description);
  if (color !== undefined) entry.color = normalizeColor(color);
  await deriveFields(entry);
  if (touch) entry.updatedAt = Date.now();
  return entry;
}

/** Final title used for lists/exports: explicit title or derived from content. */
export function displayTitle(entry) {
  return entry.title || deriveTitle(entry.content) || 'Untitled';
}

/** Validate + repair an entry coming from an imported backup. Returns null if hopeless. */
export async function reviveEntry(raw, { newId = false } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const content = typeof raw.content === 'string' ? raw.content : null;
  if (content === null) return null;
  const entry = {
    id: newId || typeof raw.id !== 'string' || !raw.id ? uid() : raw.id,
    title: typeof raw.title === 'string' ? raw.title : '',
    content,
    tags: normalizeTags(Array.isArray(raw.tags) ? raw.tags : []),
    description: typeof raw.description === 'string' ? raw.description : '',
    dir: ['auto', 'rtl', 'ltr'].includes(raw.dir) ? raw.dir : 'auto',
    color: normalizeColor(raw.color),
    favorite: !!raw.favorite,
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now(),
    openedAt: Number.isFinite(raw.openedAt) ? raw.openedAt : null,
    deletedAt: Number.isFinite(raw.deletedAt) ? raw.deletedAt : null,
  };
  return deriveFields(entry);
}
