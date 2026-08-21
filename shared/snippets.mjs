// Snippet / preview helpers for search results and card previews (shared).

/** Collapse whitespace into a single-space preview of roughly maxLen chars. */
export function buildPreview(content = '', maxLen = 220) {
  const flat = String(content).replace(/\s+/g, ' ').trim();
  if (flat.length <= maxLen) return flat;
  return flat.slice(0, maxLen - 1).trimEnd() + '…';
}

function lower(s) { return s.toLowerCase(); }

/** Case-insensitive match indices of query in text, capped at limit. */
export function matchIndices(text = '', query = '', limit = 200) {
  if (!query) return [];
  const hay = lower(text);
  const needle = lower(query);
  const out = [];
  let i = hay.indexOf(needle);
  while (i !== -1 && out.length < limit) {
    out.push(i);
    i = hay.indexOf(needle, i + Math.max(needle.length, 1));
  }
  return out;
}

/**
 * Build a context snippet around the first match.
 * Returns { before, match, after } — caller escapes/renders (e.g. with <mark>).
 */
export function snippetAround(text = '', query = '', context = 70) {
  const idx = matchIndices(text, query, 1)[0];
  if (idx === undefined) return null;
  const start = Math.max(0, idx - context);
  const end = Math.min(text.length, idx + query.length + context);
  const ellipsisStart = start > 0 ? '…' : '';
  const ellipsisEnd = end < text.length ? '…' : '';
  return {
    before: ellipsisStart + text.slice(start, idx),
    match: text.slice(idx, idx + query.length),
    after: text.slice(idx + query.length, end) + ellipsisEnd,
  };
}

/** Escape a string for safe HTML interpolation. */
export function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
