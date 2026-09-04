// PDF print-view builder — pure module (testable in plain Node).
// The HTML is loaded in a hidden Chromium window and printed with printToPDF,
// which gives us full Unicode bidi + Arabic shaping — the same engine that
// renders the app UI. Each paragraph uses `unicode-bidi: plaintext` so its
// base direction is auto-detected per paragraph (correct mixed Persian/English).
import { escapeHtml } from '../../shared/snippets.mjs';
import { t, setLanguage } from '../../shared/i18n.mjs';

export function buildPdfHtml(entries, { fonts, lang } = {}) {
  setLanguage(lang || 'en');
  const sections = entries.map((entry, i) => {
    const title = escapeHtml(entry.title || t('exp.untitled'));
    const metaBits = [];
    if (entry.tags && entry.tags.length) metaBits.push(escapeHtml(entry.tags.join(' · ')));
    if (entry.stats && entry.stats.chars != null) metaBits.push(`${Number(entry.stats.chars).toLocaleString('en-US')} characters`);
    if (entry.updatedAt) metaBits.push(new Date(entry.updatedAt).toLocaleString('en-US'));
    const meta = metaBits.length ? `<div class="meta">${metaBits.join(' &nbsp;•&nbsp; ')}</div>` : '';
    const normalized = String(entry.content || '').replace(/\r\n?/g, '\n');
    const paragraphs = normalized.split('\n')
      .map((line) => `<p>${line.length ? escapeHtml(line) : '&#160;'}</p>`)
      .join('\n');
    return `
  <section class="entry${i > 0 ? ' page-break' : ''}">
    <h1 class="title">${title}</h1>
    ${meta}
    <div class="content">${paragraphs}
    </div>
  </section>`;
  }).join('\n');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${t('exp.docTitle')}</title>
  <style>
  @page {
    size: A4;
    margin: 18mm 14mm 16mm 14mm;
  }
  @font-face {
    font-family: 'Vazirmatn';
    src: url(data:font/woff2;base64,${fonts.regular}) format('woff2');
    font-weight: 400;
  }
  @font-face {
    font-family: 'Vazirmatn';
    src: url(data:font/woff2;base64,${fonts.bold}) format('woff2');
    font-weight: 700;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Vazirmatn', 'Segoe UI', Tahoma, sans-serif;
    font-size: 11pt;
    line-height: 1.75;
    color: #1c2030;
  }
  .entry { padding-top: 4pt; }
  .entry.page-break { break-before: page; }
  .title {
    font-size: 19pt;
    font-weight: 700;
    margin: 0 0 4pt;
    color: #141824;
    unicode-bidi: plaintext;
  }
  .meta {
    font-size: 8.5pt;
    color: #737a8c;
    border-bottom: 0.75pt solid #d8dbe6;
    padding-bottom: 8pt;
    margin-bottom: 12pt;
    unicode-bidi: plaintext;
  }
  .content p {
    margin: 0 0 1pt;
    white-space: pre-wrap;
    unicode-bidi: plaintext;
    text-align: start;
  }
  footer {
    position: fixed;
    bottom: -12mm; /* into the bottom page margin */
    left: 0; right: 0;
    text-align: center;
    font-size: 8pt;
    color: #9aa0b4;
  }
</style>
</head>
<body>
${sections}
<footer>${t('exp.exportedFrom')}</footer>
</body>
</html>`;
}
