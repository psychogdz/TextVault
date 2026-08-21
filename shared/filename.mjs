// Filename sanitization for exports (Windows-safe, shared).

export function sanitizeFilename(name = '', fallback = 'text', maxLen = 80) {
  let s = String(name)
    .replace(/[\u0000-\u001f\u007f]/g, '') // control chars
    .replace(/[\\/:*?"<>|]/g, '-')         // Windows-forbidden
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');               // no trailing dots/spaces (Windows)
  if (s.length > maxLen) s = s.slice(0, maxLen).trim().replace(/[. ]+$/g, '');
  if (!s) s = fallback;
  return s;
}

/** Unique-ify a filename inside a Set of already-used lowercase names: name.pdf, name-2.pdf ... */
export function uniqueFilename(base, ext, usedSet) {
  const key = (b, i) => `${b}${i > 0 ? `-${i}` : ''}.${ext}`.toLowerCase();
  let i = 0;
  while (usedSet.has(key(base, i))) i++;
  const result = key(base, i);
  usedSet.add(result);
  return `${base}${i > 0 ? `-${i}` : ''}.${ext}`;
}
