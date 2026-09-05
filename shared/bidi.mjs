// Shared bidirectional-text helpers (used by renderer + exporters + tests).
// RTL ranges: Arabic, Syriac, Thaana, NKo, Samaritan, Mandaic + Arabic supplements/presentation forms + Hebrew.
const RTL_RANGES = [
  [0x0590, 0x05ff], // Hebrew
  [0x0600, 0x06ff], // Arabic
  [0x0700, 0x074f], // Syriac
  [0x0750, 0x077f], // Arabic Supplement
  [0x0780, 0x07bf], // Thaana
  [0x07c0, 0x07ff], // NKo
  [0x0800, 0x083f], // Samaritan
  [0x0840, 0x085f], // Mandaic
  [0x08a0, 0x08ff], // Arabic Extended-A
  [0xfb1d, 0xfdff], // Hebrew presentation forms / Arabic presentation forms-A
  [0xfe70, 0xfeff], // Arabic presentation forms-B
];

const LTR_RANGES = [
  [0x0041, 0x005a], [0x0061, 0x007a], // basic Latin
  [0x00c0, 0x024f], // Latin extended
  [0x0370, 0x03ff], [0x0400, 0x04ff], // Greek, Cyrillic
  [0x1e00, 0x1fff],
];

function charClass(code, rtlRanges, ltrRanges) {
  for (const [lo, hi] of rtlRanges) if (code >= lo && code <= hi) return 'rtl';
  for (const [lo, hi] of ltrRanges) if (code >= lo && code <= hi) return 'ltr';
  return 'neutral';
}

/** Returns 'rtl' or 'ltr' based on the first strong-directional character (UAX #9 rule P2 style). */
export function detectBaseDir(text = '') {
  for (const ch of text) {
    const cls = charClass(ch.codePointAt(0), RTL_RANGES, LTR_RANGES);
    if (cls !== 'neutral') return cls;
  }
  return 'ltr';
}

/** Ratio of strong RTL letters among all strong letters; ~0.5 means thoroughly mixed. */
export function rtlDominance(text = '') {
  let rtl = 0, ltr = 0;
  for (const ch of text) {
    const cls = charClass(ch.codePointAt(0), RTL_RANGES, LTR_RANGES);
    if (cls === 'rtl') rtl++;
    else if (cls === 'ltr') ltr++;
  }
  const total = rtl + ltr;
  return total === 0 ? 0 : rtl / total;
}

/** True when the text contains any strong RTL characters (Persian/Arabic/Hebrew). */
export function containsRtl(text = '') {
  for (const ch of text) {
    if (charClass(ch.codePointAt(0), RTL_RANGES, LTR_RANGES) === 'rtl') return true;
  }
  return false;
}

/**
 * Effective text direction for the editor: 'auto' resolves from the content's
 * first strong character; an explicit 'rtl'/'ltr' choice passes through.
 * Presentation-only — the stored text is never modified by direction.
 */
export function resolveDirection(mode, text = '') {
  if (mode === 'rtl' || mode === 'ltr') return mode;
  return detectBaseDir(text);
}
