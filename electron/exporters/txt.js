'use strict';

const { t, setLanguage } = require('../../shared/i18n.mjs');

/** Build TXT export content. Single: exact content, untouched. Combined: entries with separators.
 *  `lang` localizes the generated document labels (title fallback, meta lines). */
function buildTxt(entries, { combined = false, lang } = {}) {
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
