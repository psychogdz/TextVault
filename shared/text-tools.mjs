// Local text transformation tools (shared renderer/tests).
// Contract (FEATURES.md §13 / roadmap Phase 4):
//  - pure functions, predictable results, Unicode/Persian-safe
//  - transformations NEVER touch stored data; the caller applies them to
//    editable text and the user explicitly saves (undo stays available)

export const TEXT_TOOLS = [
  'uppercase', 'lowercase', 'title-case', 'sentence-case',
  'trim-lines', 'normalize-whitespace', 'sort-lines', 'sort-lines-desc',
  'unique-lines', 'reverse-lines', 'json-pretty', 'json-minify',
  'base64-encode', 'base64-decode', 'url-encode', 'url-decode',
];

export function uppercase(text = '') { return String(text).toLocaleUpperCase(); }
export function lowercase(text = '') { return String(text).toLocaleLowerCase(); }

/** Title Case: capitalize the first letter of each word, keep the rest. */
export function titleCase(text = '') {
  return String(text).replace(/\p{L}[\p{L}\p{M}']*/gu, (w) => w[0].toLocaleUpperCase() + w.slice(1).toLocaleLowerCase());
}

/** Sentence case: capitalize the first letter after sentence ends. */
export function sentenceCase(text = '') {
  return String(text).replace(/(^\s*[\p{L}])|([.!?…]\s+[\p{L}])/gu, (m) => m.toLocaleUpperCase());
}

export function trimLines(text = '') {
  return String(text).split(/\r?\n/).map((l) => l.trim()).join('\n');
}

export function normalizeWhitespace(text = '') {
  return String(text).replace(/\s+/g, ' ').trim();
}

function lines(text) { return String(text).replace(/\r?\n/g, '\n').split('\n'); }

export function sortLines(text = '') {
  return lines(text).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).join('\n');
}

export function sortLinesDesc(text = '') {
  return lines(text).sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' })).join('\n');
}

/** Remove duplicate lines (case-insensitive, keeps the first occurrence). */
export function uniqueLines(text = '') {
  const seen = new Set();
  return lines(text).filter((l) => {
    const key = l.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join('\n');
}

export function reverseLines(text = '') {
  return lines(text).reverse().join('\n');
}

export function jsonPretty(text = '') {
  return JSON.stringify(JSON.parse(String(text)), null, 2);
}

export function jsonMinify(text = '') {
  return JSON.stringify(JSON.parse(String(text)));
}

export function base64Encode(text = '') {
  const bytes = new TextEncoder().encode(String(text));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function base64Decode(text = '') {
  const bin = atob(String(text).trim());
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function urlEncode(text = '') { return encodeURIComponent(String(text)); }
export function urlDecode(text = '') { return decodeURIComponent(String(text).replace(/\+/g, '%20')); }

const TOOL_FNS = {
  'uppercase': uppercase,
  'lowercase': lowercase,
  'title-case': titleCase,
  'sentence-case': sentenceCase,
  'trim-lines': trimLines,
  'normalize-whitespace': normalizeWhitespace,
  'sort-lines': sortLines,
  'sort-lines-desc': sortLinesDesc,
  'unique-lines': uniqueLines,
  'reverse-lines': reverseLines,
  'json-pretty': jsonPretty,
  'json-minify': jsonMinify,
  'base64-encode': base64Encode,
  'base64-decode': base64Decode,
  'url-encode': urlEncode,
  'url-decode': urlDecode,
};

/** Apply a tool by id. Throws Error with a safe message on invalid input. */
export function applyTextTool(toolId, text) {
  const fn = TOOL_FNS[toolId];
  if (!fn) throw new Error(`Unknown transformation: ${toolId}`);
  try {
    return { ok: true, result: fn(text) };
  } catch (err) {
    return { ok: false, error: toolErrorMessage(toolId, err) };
  }
}

function toolErrorMessage(toolId, err) {
  if (toolId === 'json-pretty' || toolId === 'json-minify') {
    return 'This text is not valid JSON.';
  }
  if (toolId === 'base64-decode') {
    return 'This text is not valid Base64 (or is not valid UTF-8).';
  }
  if (toolId === 'url-decode') {
    return 'This text is not valid URL encoding.';
  }
  return err && err.message ? err.message : 'Transformation failed.';
}
