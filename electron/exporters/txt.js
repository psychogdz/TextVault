'use strict';

// TXT export: single = exact content untouched; combined = separators + labels.
// CJS module — the shared i18n dictionaries are ESM, so they load through the
// same cached dynamic import() pattern as the docx/pdf exporters and the other
// main-process services (top-level require() of .mjs is unsupported in the
// Electron main process). `lang` localizes the generated document labels.

let i18nMod = null;
async function loadI18n() {
  if (!i18nMod) i18nMod = await import('../../shared/i18n.mjs');
  return i18nMod;
}

/** Build TXT export content. Single: exact content, untouched. Combined: entries with separators.
 *  `lang` localizes the generated document labels (title fallback, meta lines). */
async function buildTxt(entries, { combined = false, lang } = {}) {
  const { t, setLanguage } = await loadI18n();
  setLanguage(lang || 'en');
  if (!combined) return entries.length === 1 ? entries[0].content : entries.map((e) => e.content).join('\n');
  const SEP = '='.repeat(64);
  return entries
    .map((e) => {
      const title = e.title ? e.title : t('exp.untitled');
      const meta = [];
      if (e.tags && e.tags.length) meta.push(t('exp.tags', { tags: e.tags.join(', ') }));
      if (e.updatedAt) meta.push(t('exp.modified', { date: new Date(e.updatedAt).toISOString() }));
      const head = [SEP, title, ...(meta.length ? [meta.join(' | ')] : []), SEP].join('\n');
      return `${head}\n${e.content}`;
    })
    .join('\n\n');
}

module.exports = { buildTxt };
