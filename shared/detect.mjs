// Smart content-type detection (shared main/renderer/tests).
// Local-only, pure analysis. Detection NEVER executes, downloads, opens, or
// modifies content (SECURITY.md §31) — it only labels it so the UI can offer
// explicit user-initiated actions. Conservative: ambiguous content falls
// back to plain text.

import { detectBaseDir } from './bidi.mjs';

export const CONTENT_TYPES = [
  'url', 'email', 'ip', 'path', 'json', 'code', 'markdown', 'command', 'text',
];

const RE = {
  url: /^https?:\/\/\S+$/i,
  email: /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/,
  ip: /^(\d{1,3}\.){3}\d{1,3}$/,
  path: /^(?:[a-zA-Z]:\\[^"\r\n*?<>|]+|\/(?:[\w.@+-]+\/)*[\w.@+-]+)$/,
  command: /^\s*(?:npm|npx|git|docker|kubectl|pip|python3?|node|curl|wget|cargo|dotnet)\s+\S+/,
};

const CODE_HINTS = [
  /^\s*(?:function|class|const|let|var|import|export|def|public|private|package|#include)\b/m,
  /=>|\breturn\b\s|;\s*$/m,
];

const MD_HINTS = [
  /^#{1,6}\s+\S/m,               // headings
  /^\s*[-*+]\s+\S/m,             // lists
  /```|\[.+\]\(.+\)/,            // fenced code or links
];

/**
 * Detect the content type of a clipboard/library text.
 * Returns one of CONTENT_TYPES. Never throws.
 */
export function detectContentType(text = '') {
  const s = String(text);
  const trimmed = s.trim();
  if (!trimmed) return 'text';

  if (RE.url.test(trimmed)) return 'url';
  if (RE.email.test(trimmed)) return 'email';
  if (RE.ip.test(trimmed) && trimmed.split('.').every((n) => Number(n) <= 255)) return 'ip';
  if (RE.path.test(trimmed)) return 'path';

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try { JSON.parse(trimmed); return 'json'; } catch { /* not json */ }
  }
  if (MD_HINTS.some((re) => re.test(s)) && !CODE_HINTS.some((re) => re.test(s))) return 'markdown';
  if (RE.command.test(trimmed)) return 'command';
  if (CODE_HINTS.some((re) => re.test(s))) return 'code';
  return 'text';
}

/**
 * Explicit user-initiated actions available for a content type.
 * 'open-external' is offered for URLs only and executed by the main process
 * after strict http/https validation (never called automatically).
 */
export function actionsForType(type) {
  switch (type) {
    case 'url': return ['open-external', 'copy'];
    case 'email': return ['compose', 'copy'];
    case 'json': return ['json-pretty', 'json-minify', 'copy'];
    default: return ['copy'];
  }
}

/** Base writing direction for the content (bidi-aware presentation). */
export function contentDirection(text = '') {
  return detectBaseDir(text);
}
