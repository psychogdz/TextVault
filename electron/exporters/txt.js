'use strict';

/** Build TXT export content. Single: exact content, untouched. Combined: entries with separators. */
function buildTxt(entries, { combined = false } = {}) {
  if (!combined) return entries.length === 1 ? entries[0].content : entries.map((e) => e.content).join('\n');
  const SEP = '='.repeat(64);
  return entries
    .map((e) => {
      const title = e.title ? e.title : 'Untitled';
      const meta = [];
      if (e.tags && e.tags.length) meta.push(`Tags: ${e.tags.join(', ')}`);
      if (e.updatedAt) meta.push(`Modified: ${new Date(e.updatedAt).toISOString()}`);
      const head = [SEP, title, ...(meta.length ? [meta.join(' | ')] : []), SEP].join('\n');
      return `${head}\n${e.content}`;
    })
    .join('\n\n');
}

module.exports = { buildTxt };
