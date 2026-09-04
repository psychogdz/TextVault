// DOCX builder — pure module (testable in plain Node).
// Mixed Persian/English handling:
//  - Each paragraph is split from the content on newlines and rendered as its own Word paragraph.
//  - For RTL-dominant paragraphs we set `bidirectional: true` (paragraph base direction RTL, w:bidi)
//    and `rightToLeft: true` on the run (w:rtl, complex-script rendering). Latin fragments inside
//    are still ordered LTR by Word's own bidi implementation.
//  - LTR-dominant paragraphs render with defaults; Persian words inside stay correctly ordered.
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak,
} from 'docx';
import { detectBaseDir, containsRtl } from '../../shared/bidi.mjs';
import { t, setLanguage } from '../../shared/i18n.mjs';

const FONT = { ascii: 'Calibri', hAnsi: 'Calibri', cs: 'Tahoma' };

function metaLine(entry) {
  const parts = [];
  if (entry.tags && entry.tags.length) parts.push(t('exp.tags', { tags: entry.tags.join(', ') }));
  if (entry.stats && entry.stats.chars != null) parts.push(t('exp.characters', { n: entry.stats.chars.toLocaleString('en-US') }));
  if (entry.updatedAt) parts.push(t('exp.modifiedShort', { date: new Date(entry.updatedAt).toLocaleString('en-US') }));
  return parts.join('  •  ');
}

function contentParagraphs(content = '') {
  const normalized = String(content).replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  return lines.map((line) => {
    const rtl = containsRtl(line) && detectBaseDir(line) === 'rtl';
    return new Paragraph({
      bidirectional: rtl,
      spacing: { after: 60, line: 276 },
      children: [
        new TextRun({
          text: line.length ? line : ' ',
          rightToLeft: rtl,
          font: FONT,
          size: 22, // 11pt
        }),
      ],
    });
  });
}

function titleParagraph(title, rtl) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    bidirectional: rtl,
    spacing: { before: 0, after: 120 },
    children: [
      new TextRun({
        text: title || t('exp.untitled'),
        bold: true,
        rightToLeft: rtl,
        font: FONT,
        size: 40, // 20pt
        color: '1F2430',
      }),
    ],
  });
}

export function buildDocx(entries, { combined = false, lang } = {}) {
  setLanguage(lang || 'en');
  const children = [];
  entries.forEach((entry, i) => {
    const title = entry.title || t('exp.untitled');
    const titleRtl = containsRtl(title) && detectBaseDir(title) === 'rtl';
    if (i > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(titleParagraph(title, titleRtl));
    const meta = metaLine(entry);
    if (meta) {
      children.push(new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: meta, font: FONT, size: 17, color: '8A8F9E', italics: true })],
      }));
    }
    children.push(...contentParagraphs(entry.content));
  });

  return new Document({
    creator: 'TextVault',
    title: entries.length === 1 ? (entries[0].title || t('exp.untitled')) : t('exp.docTitle'),
    description: t('exp.exportedFrom'),
    styles: {
      default: {
        document: { run: { font: FONT, size: 22 } },
      },
    },
    sections: [{
      properties: {
        page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } }, // 2cm
      },
      children,
    }],
  });
}

export async function buildDocxBuffer(entries, opts) {
  const doc = buildDocx(entries, opts);
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}
