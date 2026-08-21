// Text statistics helpers (shared renderer/export/tests).

/** Count of code points (emoji counted as 1, not 2). */
export function charCount(text = '') {
  return [...text].length;
}

/** Line count: '' -> 0, 'a' -> 1, 'a\nb' -> 2. Handles \r\n and \r. */
export function lineCount(text = '') {
  if (text === '') return 0;
  const normalized = text.replace(/\r\n?/g, '\n');
  return normalized.split('\n').length;
}

/** Word count, Unicode-whitespace aware. */
export function wordCount(text = '') {
  const m = text.match(/[\p{L}\p{N}\p{P}\p{S}]+/gu);
  return m ? m.length : 0;
}

/** UTF-8 byte size. */
export function byteLength(text = '') {
  return new TextEncoder().encode(text).length;
}

export function textStats(text = '') {
  return {
    chars: charCount(text),
    words: wordCount(text),
    lines: lineCount(text),
    bytes: byteLength(text),
  };
}
