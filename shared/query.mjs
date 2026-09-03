// Unified query parsing + matching for clipboard items and snippets
// (shared renderer/tests). Operators:
//   tag:name        — item must have a tag containing "name"
//   is:fav          — favorites only (alias: is:favorite, fav:)
//   is:pinned       — pinned only (alias: pinned:)
//   type:x          — content-type filter (clipboard items; url, json, …)
//   collection:name — member of a collection whose name contains "name"
// Everything else is a free term matched against content/title/tags.
// Parsing is pure and unit-testable (DEVELOPMENT.md §17 — predictable search).

export const QUERY_TYPES = ['url', 'email', 'ip', 'path', 'json', 'code', 'markdown', 'command', 'text'];

export function parseQuery(raw = '') {
  const terms = [];
  const tags = [];
  const types = [];
  const collections = [];
  let favOnly = false;
  let pinnedOnly = false;
  for (const tok of String(raw).split(/\s+/).filter(Boolean)) {
    const lower = tok.toLowerCase();
    if (lower.startsWith('tag:')) {
      const t = tok.slice(4).trim();
      if (t) tags.push(t.toLowerCase());
    } else if (lower.startsWith('type:')) {
      const t = tok.slice(5).trim().toLowerCase();
      if (t) types.push(t);
    } else if (lower.startsWith('collection:')) {
      const c = tok.slice(11).trim().toLowerCase();
      if (c) collections.push(c);
    } else if (lower === 'is:fav' || lower === 'is:favorite' || lower === 'fav:') {
      favOnly = true;
    } else if (lower === 'is:pinned' || lower === 'pinned:') {
      pinnedOnly = true;
    } else {
      terms.push(tok.toLowerCase());
    }
  }
  return {
    terms, tags, types, collections, favOnly, pinnedOnly,
    empty: terms.length === 0 && tags.length === 0 && types.length === 0
      && collections.length === 0 && !favOnly && !pinnedOnly,
  };
}

function hasTag(item, tagLower) {
  return (item.tags || []).some((t) => t.toLowerCase().includes(tagLower));
}

function inCollection(item, nameLower, idToName) {
  return (item.collections || []).some((id) => {
    const name = idToName.get(id);
    return name && name.toLowerCase().includes(nameLower);
  });
}

/**
 * Match a clipboard item against a parsed query.
 * @param {object} item  clipboard record (content, tags, collections, isPinned, isFavorite, contentType)
 * @param {object} q     parseQuery result
 * @param {Map<string,string>} idToName  collection id → name (for collection: filters)
 * @param {string|null} forcedType  content type when already computed (else detected lazily via cb)
 */
export function matchClipboardItem(item, q, idToName = new Map(), detectType = null) {
  if (q.favOnly && !item.isFavorite) return false;
  if (q.pinnedOnly && !item.isPinned) return false;
  for (const t of q.tags) if (!hasTag(item, t)) return false;
  for (const c of q.collections) if (!inCollection(item, c, idToName)) return false;
  if (q.types.length) {
    const type = item.contentType && item.contentType !== 'text'
      ? item.contentType
      : (detectType ? detectType(item.content || '') : 'text');
    if (!q.types.includes(type)) return false;
  }
  for (const term of q.terms) {
    if (!(item.content || '').toLowerCase().includes(term)) return false;
  }
  return true;
}

/** Match a snippet (title + content + tags + collections). */
export function matchSnippet(snippet, q, idToName = new Map()) {
  if (q.favOnly && !snippet.isFavorite) return false;
  if (q.pinnedOnly) return false; // snippets have no pin state
  if (q.types.length) return false; // type filters don't apply to snippets
  for (const t of q.tags) if (!hasTag(snippet, t)) return false;
  for (const c of q.collections) if (!inCollection(snippet, c, idToName)) return false;
  for (const term of q.terms) {
    const inTitle = (snippet.title || '').toLowerCase().includes(term);
    const inContent = (snippet.content || '').toLowerCase().includes(term);
    if (!inTitle && !inContent) return false;
  }
  return true;
}
