'use strict';

// Export orchestration: renders entries to TXT / DOCX / PDF bytes.
// Destination selection and writing live with the IPC handlers; this module
// owns the format builders, the hidden print window for PDF, and fonts.

const path = require('node:path');
const fsp = require('node:fs/promises');
const os = require('node:os');
const { BrowserWindow } = require('electron');

const ROOT = path.join(__dirname, '..', '..');
const SRC_DIR = path.join(ROOT, 'src');

const exporters = {
  txt: require('../exporters/txt.js'),
  docx: null, // loaded async (ESM)
  pdf: null,
};
const pdfHtmlModule = { build: null };

async function ensureAsyncExporters() {
  if (!exporters.docx) {
    const mod = await import('../exporters/docx-builder.mjs');
    exporters.docx = mod;
  }
  if (!pdfHtmlModule.build) {
    const mod = await import('../exporters/pdf-html.mjs');
    pdfHtmlModule.build = mod.buildPdfHtml;
  }
}

let fontCache = null;
async function loadFontsBase64() {
  if (fontCache) return fontCache;
  const dir = path.join(SRC_DIR, 'assets', 'fonts');
  const read = (f) => fsp.readFile(path.join(dir, f)).then((b) => b.toString('base64'));
  const [regular, bold] = await Promise.all([read('Vazirmatn-Regular.woff2'), read('Vazirmatn-Bold.woff2')]);
  fontCache = { regular, bold };
  return fontCache;
}

/** Render one or more entries to a PDF buffer via a hidden print window. */
async function generatePdf(entries, lang) {
  const fonts = await loadFontsBase64();
  const html = pdfHtmlModule.build(entries, { fonts, lang });
  const tmpPath = path.join(os.tmpdir(), `textvault-print-${Date.now()}.html`);
  await fsp.writeFile(tmpPath, html, 'utf8');
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } });
  try {
    await win.loadFile(tmpPath);
    // Give embedded fonts a moment to be ready before rasterizing.
    await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)', true);
    const buffer = await win.webContents.printToPDF({
      // Page size + margins come from the print HTML's @page rule
      // (passing a margins object is broken on this Electron build).
      preferCSSPageSize: true,
      printBackground: true,
    });
    return buffer;
  } finally {
    win.destroy();
    fsp.unlink(tmpPath).catch(() => {});
  }
}

/**
 * Build the export bytes for a kind/mode.
 * mode 'separate' is handled by the caller (one build per entry).
 */
async function buildExportBytes(kind, entries, { combined = false, lang } = {}) {
  await ensureAsyncExporters();
  if (kind === 'txt') return Buffer.from(await exporters.txt.buildTxt(entries, { combined, lang }), 'utf8');
  if (kind === 'docx') return exporters.docx.buildDocxBuffer(entries, { combined, lang });
  return generatePdf(entries, lang);
}

/** Build bytes for a single entry in 'separate' mode. */
async function buildSingleExportBytes(kind, entry, lang) {
  await ensureAsyncExporters();
  if (kind === 'txt') return Buffer.from(entry.content, 'utf8');
  if (kind === 'docx') return exporters.docx.buildDocxBuffer([entry], { combined: false, lang });
  return generatePdf([entry], lang);
}

function isExporterKind(kind) {
  return ['txt', 'docx', 'pdf'].includes(kind);
}

module.exports = {
  ensureAsyncExporters,
  loadFontsBase64,
  generatePdf,
  buildExportBytes,
  buildSingleExportBytes,
  isExporterKind,
};
