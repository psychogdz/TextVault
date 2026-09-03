// Snippets + collections domain layer (renderer).
// Snippets are intentionally saved reusable text — modeled independently
// from clipboard history (ARCHITECTURE.md §31). Collections are logical
// groups; membership ids live on the member records, so renaming a
// collection never touches members and deleting one cleans up in a single
// transaction (no dangling references).

import { db } from './db.js';
import { App } from '../state.js';
import { clipboardItems } from './clipboard.js';
import { normalizeTags } from './entry.js';

const snippets = new Map();      // id -> snippet
const collections = new Map();   // id -> collection

function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) ||
    'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function emit() { App.emit('library-changed'); }

/* ------------------------------ snippets ------------------------------ */

export function snippetList() {
  return [...snippets.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getSnippet(id) { return snippets.get(id); }

export async function createSnippet({ title = '', content = '', description = '', tags = [], collectionIds = [] } = {}) {
  const now = Date.now();
  const snippet = {
    id: uid(),
    title: String(title).trim(),
    content: String(content),
    description: String(description || ''),
    tags: normalizeTags(tags),
    collections: [...collectionIds],
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
  };
  snippets.set(snippet.id, snippet);
  await db.putSnippet(snippet);
  emit();
  return snippet;
}

export async function updateSnippet(id, patch) {
  const snippet = snippets.get(id);
  if (!snippet) return null;
  if (patch.title !== undefined) snippet.title = String(patch.title).trim();
  if (patch.content !== undefined) snippet.content = String(patch.content);
  if (patch.description !== undefined) snippet.description = String(patch.description);
  if (patch.tags !== undefined) snippet.tags = normalizeTags(patch.tags);
  if (patch.collections !== undefined) snippet.collections = [...patch.collections];
  snippet.updatedAt = Date.now();
  await db.putSnippet(snippet);
  emit();
  return snippet;
}

export async function toggleSnippetFavorite(id) {
  const snippet = snippets.get(id);
  if (!snippet) return;
  snippet.isFavorite = !snippet.isFavorite;
  snippet.updatedAt = Date.now();
  await db.putSnippet(snippet);
  emit();
}

export async function deleteSnippet(id) {
  await db.deleteSnippet(id);
  snippets.delete(id);
  emit();
}

export async function copySnippet(id) {
  const snippet = snippets.get(id);
  if (!snippet) return false;
  await window.tv.clipboardWrite(snippet.content);
  return true;
}

export async function initSnippets() {
  const stored = await db.listSnippets().catch((err) => {
    console.error('Failed to load snippets:', err && err.message);
    return [];
  });
  for (const s of stored) snippets.set(s.id, s);
  emit();
}

/** Repair an imported snippet record; returns null if hopeless. */
export function reviveSnippet(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.content !== 'string') return null;
  const now = Date.now();
  const snippet = {
    id: (typeof raw.id === 'string' && raw.id) || uid(),
    title: typeof raw.title === 'string' ? raw.title : '',
    content: raw.content,
    description: typeof raw.description === 'string' ? raw.description : '',
    tags: Array.isArray(raw.tags) ? normalizeTags(raw.tags) : [],
    collections: Array.isArray(raw.collections)
      ? raw.collections.filter((c) => typeof c === 'string') : [],
    isFavorite: !!raw.isFavorite,
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : now,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : now,
  };
  return snippet;
}

/** Re-read stores into caches (used after a backup restore). */
export async function reloadSnippetsCache() {
  const stored = await db.listSnippets().catch(() => []);
  snippets.clear();
  for (const s of stored) snippets.set(s.id, s);
  emit();
  return snippets.size;
}

export async function reloadCollectionsCache() {
  const stored = await db.listCollections().catch(() => []);
  collections.clear();
  for (const c of stored) collections.set(c.id, c);
  emit();
  return collections.size;
}

/* ----------------------------- collections ---------------------------- */

export function collectionList() {
  return [...collections.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getCollection(id) { return collections.get(id); }

/** Members of a collection across the library (clipboard + snippets). */
export function collectionMembers(id) {
  const clip = clipboardItems().filter((it) => (it.collections || []).includes(id));
  const snips = snippetList().filter((s) => (s.collections || []).includes(id));
  return { clip, snips };
}

export async function createCollection(name, description = '') {
  const collection = {
    id: uid(),
    name: String(name).trim(),
    description: String(description || ''),
    createdAt: Date.now(),
  };
  collections.set(collection.id, collection);
  await db.putCollection(collection);
  emit();
  return collection;
}

export async function renameCollection(id, name) {
  const collection = collections.get(id);
  if (!collection) return null;
  collection.name = String(name).trim() || collection.name;
  await db.putCollection(collection);
  emit();
  return collection;
}

/**
 * Delete a collection. Members keep their content; the collection id is
 * stripped from every member inside one storage transaction.
 */
export async function deleteCollection(id) {
  const memberRefs = [];
  for (const it of clipboardItems()) {
    if ((it.collections || []).includes(id)) memberRefs.push({ store: 'clipboard', record: it });
  }
  for (const s of snippetList()) {
    if ((s.collections || []).includes(id)) memberRefs.push({ store: 'snippets', record: s });
  }
  await db.deleteCollection(id, memberRefs);
  collections.delete(id);
  for (const ref of memberRefs) {
    ref.record.collections = (ref.record.collections || []).filter((c) => c !== id);
  }
  emit();
}

/** Set a single item's membership to exactly these collections. */
export async function setItemCollections(store, record, collectionIds) {
  record.collections = [...collectionIds];
  if (store === 'clipboard') await db.putClipboardItem(record);
  else if (store === 'snippets') await db.putSnippet(record);
  emit();
}

export async function initCollections() {
  const stored = await db.listCollections().catch((err) => {
    console.error('Failed to load collections:', err && err.message);
    return [];
  });
  for (const c of stored) collections.set(c.id, c);
  emit();
}
