// Search: query parsing + scoring + snippet extraction.
// Title/tag matches are instant (in-memory metadata); content matches are
// computed against cached content. The dashboard driver scans in chunks so
// the UI stays responsive with 1000+ entries. Query parsing is shared with
// the clipboard/snippets views (shared/query.mjs) so operators behave
// identically everywhere.

import { matchIndices, snippetAround } from '../../shared/snippets.mjs';
import { parseQuery } from '../../../shared/query.mjs';

export { parseQuery };

function textHas(text, term) {
  return text.toLowerCase().includes(term);
}

function entryHasTag(entry, tagLower) {
  return (entry.tags || []).some((t) => t.toLowerCase().includes(tagLower));
}

/** Fast metadata-only filter (title + tags + fav + pinned). */
export function quickFilter(entry, q) {
  if (q.favOnly && !entry.favorite) return false;
  if (q.pinnedOnly && !entry.isPinned) return false;
  for (const t of q.tags) if (!entryHasTag(entry, t)) return false;
  for (const term of q.terms) {
    if (!textHas(entry.title || '', term) && !textHas(entry.preview || '', term) && !entryHasTag(entry, term)) return false;
  }
  return true;
}

/**
 * Full search over one entry (incl. content). Title/tags constraints apply,
 * but terms may match anywhere — content-only matches are valid results.
 * Returns { entry, score, snippet:{before,match,after}|null, field } or null.
 */
export function searchEntry(entry, q) {
  if (q.empty) return { entry, score: 0, snippet: null, field: null };
  if (q.favOnly && !entry.favorite) return null;
  for (const t of q.tags) if (!entryHasTag(entry, t)) return null;

  let best = null;
  const consider = (field, score, idxText) => {
    if (!best || score > best.score) {
      let snippet = null;
      for (const term of q.terms) {
        const s = snippetAround(idxText, term, 60);
        if (s) { snippet = s; break; }
      }
      best = { entry, score, snippet, field };
    }
  };

  for (const term of q.terms) {
    if (textHas(entry.title || '', term)) consider('title', 100, entry.title || '');
    for (const t of entry.tags || []) if (textHas(t, term)) consider('tags', 80, t);
    if (textHas(entry.content || '', term)) consider('content', 50, entry.content || '');
  }
  if (!best && q.tags.length && !q.terms.length) best = { entry, score: 60, snippet: null, field: 'tags' };
  return best;
}

export function countMatches(content = '', query = '', limit = 500) {
  return matchIndices(content, query, limit).length;
}
