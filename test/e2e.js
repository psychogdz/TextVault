// End-to-end test: boots the REAL app (electron/main.js — protocol, IPC,
// exporters) with a throwaway profile, drives it through the full workflow
// and verifies exports on disk.
'use strict';

const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'test-output');

// ---- synchronous boot: env + userData + real app must be set up BEFORE the
// event loop spins (app becomes ready on the first await) ----
process.env.TEXTVAULT_TEST_DIR = OUT;
process.env.TEXTVAULT_E2E = '1';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const { app, BrowserWindow } = require('electron');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'tv-e2e-')));
// Boots the real application: registers the app:// scheme, IPC handlers, window.
require(path.join(ROOT, 'electron/main.js'));

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) process.exitCode = 1;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeoutMs, intervalMs = 150) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return true;
    await sleep(intervalMs);
  }
  return await fn();
}

async function main() {
  await app.whenReady();
  // wait for the app's main window
  let win = null;
  for (let i = 0; i < 60 && !win; i++) {
    const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
    if (wins.length) win = wins[0];
    else await sleep(100);
  }
  check('app window created', !!win);
  if (!win) return finish();

  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) console.log('    [page console]', message);
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('    RENDERER CRASHED:', details.reason);
    process.exitCode = 1;
    finish();
  });

  const waitHook = async () => {
    for (let i = 0; i < 100; i++) {
      try {
        const ready = await win.webContents.executeJavaScript('!!(window.__TV_TEST__ && window.__TV_TEST__.ready)');
        if (ready) return true;
      } catch { /* mid-navigation */ }
      await sleep(100);
    }
    return false;
  };
  check('app boots without errors', await waitHook());
  const js = (code) => win.webContents.executeJavaScript(code, true);
  const { ALL_FIXTURES } = await import(pathToFileURL(path.join(ROOT, 'test/fixtures.mjs')).href);

  /* ---------- seed fixtures through the real state layer ---------- */
  const seedResult = await js(`(async () => {
    const { App } = window.__TV_TEST__;
    const out = [];
    for (const f of ${JSON.stringify(ALL_FIXTURES.map(({ title, content, tags }) => ({ title, content, tags })))}) {
      const e = await App.createNew(f);
      out.push({ id: e.id, chars: e.stats.chars, lines: e.stats.lines, title: e.title });
    }
    return out;
  })()`);
  check('created 6 fixture texts', seedResult.length === 6, JSON.stringify(seedResult.map((s) => s.lines)));

  const longEntry = seedResult.find((s) => s.lines >= 852);
  check('850+ line text counted correctly', longEntry && longEntry.lines === 852, `lines=${longEntry && longEntry.lines}`);

  /* ---------- hundreds of entries (virtual grid perf) ---------- */
  const bulkCount = await js(`(async () => {
    const { App } = window.__TV_TEST__;
    const t0 = performance.now();
    for (let i = 0; i < 250; i++) {
      await App.createNew({ title: 'Bulk item ' + i, content: 'bulk content item ' + i + ' متن شماره ' + i, tags: i % 5 === 0 ? ['Bulk'] : [] });
    }
    return { count: App.liveEntries().length, ms: Math.round(performance.now() - t0) };
  })()`);
  check('250 more entries created (256 total)', bulkCount.count === 256, `${bulkCount.ms}ms`);

  const domCount = await js(`document.querySelectorAll('#grid-inner .card').length`);
  check('virtual grid renders a bounded DOM', domCount > 0 && domCount < 60, `${domCount} cards in DOM for 256 entries`);

  /* ---------- search ---------- */
  await js(`window.__TV_TEST__.dashboard.search('retrofit')`);
  await sleep(1200);
  const searchCards = await js(`window.__TV_TEST__.dashboard.cards()`);
  check('content search finds retrofit entry', searchCards.length === 1, `${searchCards.length} results`);
  const hasMark = await js(`!!document.querySelector('#grid-inner .card mark')`);
  check('search highlight (mark) rendered', hasMark);

  await js(`window.__TV_TEST__.dashboard.search('سلام')`);
  await sleep(1200);
  const faCards = await js(`window.__TV_TEST__.dashboard.cards()`);
  check('Persian search works', faCards.length >= 2, `${faCards.length} results`);

  await js(`window.__TV_TEST__.dashboard.search('tag:python')`);
  await sleep(500);
  const tagCards = await js(`window.__TV_TEST__.dashboard.cards()`);
  check('tag: filter works', tagCards.length === 1, `${tagCards.length} results`);

  await js(`window.__TV_TEST__.dashboard.search('')`);
  await sleep(400);

  /* ---------- sort ---------- */
  await js(`window.__TV_TEST__.dashboard.setSort('title-asc')`);
  await sleep(300);
  // read the VISUALLY top-left card — DOM order of recycled virtual cards is arbitrary
  const firstTitle = await js(`(() => {
    const cards = [...document.querySelectorAll('#grid-inner .card')];
    let best = null, bt = 1e9, bl = 1e9;
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      if (r.top < bt - 2 || (Math.abs(r.top - bt) <= 2 && r.left < bl)) { bt = r.top; bl = r.left; best = c; }
    }
    return best?.querySelector('.card-title .t')?.textContent;
  })()`);
  check('alphabetical sort applied', firstTitle && firstTitle.startsWith('AI Agent Prompt'), firstTitle);
  await js(`window.__TV_TEST__.dashboard.setSort('modified-desc')`);
  await sleep(300);

  // mixed card titles render with the same plaintext bidi isolation as the editor
  const titleBidi = await js(`getComputedStyle(document.querySelector('#grid-inner .card .card-title .t')).unicodeBidi`);
  check('mixed card titles use plaintext bidi (match editor)', titleBidi === 'plaintext', titleBidi);

  /* ---------- favorites ---------- */
  const mixedId = seedResult[0].id;
  await js(`window.__TV_TEST__.App.toggleFavorite('${mixedId}')`);
  await sleep(200);
  const favCount = await js(`document.querySelector('[data-count="favorites"]').textContent`);
  check('favorite toggled + counted', favCount === '1', favCount);

  /* ---------- selection mode ---------- */
  await js(`window.__TV_TEST__.dashboard.setSelectionMode(true)`);
  await sleep(250);
  check('selection mode: toolbar + grid state',
    await js(`window.__TV_TEST__.dashboard.toolbarVisible()`)
    && await js(`window.__TV_TEST__.dashboard.gridClass('selection-mode')`)
    && await js(`window.__TV_TEST__.dashboard.bulkbarVisible()`));

  // clicking a card selects it (and must NOT open the editor)
  await js(`window.__TV_TEST__.dashboard.clickCard('${mixedId}')`);
  await sleep(150);
  check('card click selects in selection mode',
    await js(`window.__TV_TEST__.dashboard.cardSelected('${mixedId}')`)
    && await js(`window.__TV_TEST__.dashboard.selectedCount()`) === 1
    && await js(`window.__TV_TEST__.dashboard.selCountText()`) === '1 selected');
  check('card click in selection mode does not open editor',
    !(await js(`document.getElementById('view-editor') && !document.getElementById('view-editor').classList.contains('hidden')`)));

  // clicking again unselects
  await js(`window.__TV_TEST__.dashboard.clickCard('${mixedId}')`);
  await sleep(120);
  check('card click unselects', await js(`window.__TV_TEST__.dashboard.selectedCount()`) === 0);

  // star in selection mode toggles favorite (off, since this card is the favorite), not selection
  await js(`document.querySelector('#grid-inner .card .card-actions .card-star')?.click()`);
  await sleep(200);
  const favAfterStar = await js(`window.__TV_TEST__.App.liveEntries().filter(e => e.favorite).length`);
  check('star in selection mode toggles favorite only',
    favAfterStar === 0 && await js(`window.__TV_TEST__.dashboard.selectedCount()`) === 0, `favs=${favAfterStar}`);

  // select all / clear
  await js(`window.__TV_TEST__.dashboard.selectAll()`);
  await sleep(200);
  const allCount = await js(`window.__TV_TEST__.dashboard.selectedCount()`);
  check('select all selects every text', allCount === 256, `${allCount} selected`);
  await js(`document.getElementById('sel-clear').click()`);
  await sleep(150);
  check('clear selection empties the selection', await js(`window.__TV_TEST__.dashboard.selectedCount()`) === 0);

  // cancel leaves selection mode
  await js(`document.getElementById('sel-cancel').click()`);
  await sleep(150);
  check('cancel exits selection mode',
    !await js(`window.__TV_TEST__.dashboard.selectionMode()`)
    && !await js(`window.__TV_TEST__.dashboard.toolbarVisible()`));

  // normal mode still opens the editor on card click
  await js(`window.__TV_TEST__.dashboard.clickCard('${mixedId}')`);
  await sleep(350);
  check('normal card click opens the editor',
    await js(`!document.getElementById('view-editor').classList.contains('hidden')`));
  await js(`window.__TV_TEST__.App.setView('dashboard')`);
  await sleep(150);

  /* ---------- card trash button ---------- */
  // use a card that is actually rendered in the viewport (cards() = visible ids)
  const trashVictim = await js(`window.__TV_TEST__.dashboard.cards()[2]`);
  const beforeTrash = await js(`window.__TV_TEST__.App.liveEntries().length`);
  await js(`window.__TV_TEST__.dashboard.clickTrash('${trashVictim}')`);
  await sleep(200);
  check('trash button opens confirmation', await js(`window.__TV_TEST__.dashboard.modalVisible()`));
  await js(`window.__TV_TEST__.dashboard.modalCancel()`);
  await sleep(200);
  check('cancel keeps the text', await js(`window.__TV_TEST__.App.liveEntries().length`) === beforeTrash);
  await js(`window.__TV_TEST__.dashboard.clickTrash('${trashVictim}')`);
  await sleep(200);
  await js(`window.__TV_TEST__.dashboard.modalConfirm()`);
  await sleep(300);
  const afterTrash = await js(`window.__TV_TEST__.App.liveEntries().length`);
  check('confirm moves the text to Trash', afterTrash === beforeTrash - 1, `${beforeTrash} → ${afterTrash}`);
  await js(`window.__TV_TEST__.App.restoreEntry('${trashVictim}')`);
  await sleep(200);
  check('restore works from card-deleted text', await js(`window.__TV_TEST__.App.liveEntries().length`) === beforeTrash);

  /* ---------- export through the bulk bar (fixed path) ---------- */
  // single selection → TXT
  await js(`window.__TV_TEST__.dashboard.setSelectionMode(true)`);
  await sleep(200);
  await js(`window.__TV_TEST__.dashboard.clickCard('${mixedId}')`);
  await sleep(150);
  await js(`window.__TV_TEST__.dashboard.bulkExportClick()`);
  await sleep(200);
  const ddSingle = await js(`window.__TV_TEST__.dashboard.dropdownItems()`);
  check('single export menu offers TXT/DOCX/PDF',
    ddSingle.includes('TXT — exact original text') && ddSingle.includes('Word document (.docx)') && ddSingle.includes('PDF document'),
    ddSingle.join(' | '));
  check('bulkbar export dropdown opens upward (fully visible)',
    await js(`!!document.querySelector('.dropdown.up')`)
    && await js(`(() => { const d = document.querySelector('.dropdown.up'); return d.getBoundingClientRect().top >= 0; })()`));
  await js(`window.__TV_TEST__.dashboard.dropdownClick('TXT — exact original text')`);
  await sleep(800);
  check('single selection TXT export writes file',
    fs.existsSync(path.join(OUT, 'AI Agent Prompt — پرامپت هوش مصنوعی.txt')));

  // multiple selection → combined DOCX + separate PDFs (pick a card other than mixedId —
  // the earlier restore/edited entries reshuffle the top of the list)
  const secondId = await js(`window.__TV_TEST__.dashboard.cards().find(id => id !== '${mixedId}')`);
  check('second card found and distinct', !!secondId && secondId !== mixedId, secondId);
  await js(`window.__TV_TEST__.dashboard.clickCard('${secondId}')`);
  await sleep(150);
  await js(`window.__TV_TEST__.dashboard.bulkExportClick()`);
  await sleep(200);
  const ddMulti = await js(`window.__TV_TEST__.dashboard.dropdownItems()`);
  check('multi export menu offers combined + separate',
    ddMulti.includes('Combined Word (.docx)') && ddMulti.includes('Separate PDF files…'),
    ddMulti.join(' | '));
  await js(`window.__TV_TEST__.dashboard.dropdownClick('Combined Word (.docx)')`);
  await sleep(1500);
  check('multi combined DOCX export writes file',
    fs.existsSync(path.join(OUT, 'TextVault_Export_2_texts.docx')));
  await js(`window.__TV_TEST__.dashboard.bulkExportClick()`);
  await sleep(200);
  await js(`window.__TV_TEST__.dashboard.dropdownClick('Separate PDF files…')`);
  await sleep(6000);
  const pdfSep = fs.readdirSync(OUT).filter((f) => f.endsWith('.pdf') && !f.startsWith('Mixed_Prompt') && !f.startsWith('TextVault_Export'));
  check('multi separate PDF export writes per-text files', pdfSep.length >= 2, pdfSep.join(', '));

  // Delete key on selection opens confirmation and deletes
  await js(`window.__TV_TEST__.dashboard.setSelectionMode(true); window.__TV_TEST__.dashboard.clickCard('${secondId}')`);
  await sleep(150);
  await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))`);
  await sleep(250);
  check('Delete shortcut opens confirmation', await js(`window.__TV_TEST__.dashboard.modalVisible()`));
  await js(`window.__TV_TEST__.dashboard.modalConfirm()`);
  await sleep(400);
  check('Delete shortcut moves selection to Trash', await js(`window.__TV_TEST__.App.trashedEntries().length`) === 1);

  // undo the delete from the toast
  await js(`document.querySelector('.toast .toast-action')?.click()`);
  await sleep(400);
  check('Undo restores deleted texts',
    await js(`window.__TV_TEST__.App.trashedEntries().length`) === 0
    && await js(`window.__TV_TEST__.App.liveEntries().length`) === 256);
  await js(`window.__TV_TEST__.dashboard.setSelectionMode(false)`);
  await sleep(150);

  // Ctrl+M toggles selection mode
  await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', ctrlKey: true, bubbles: true }))`);
  await sleep(150);
  check('Ctrl+M enters selection mode', await js(`window.__TV_TEST__.dashboard.selectionMode()`));
  await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', ctrlKey: true, bubbles: true }))`);
  await sleep(150);
  check('Ctrl+M exits selection mode', !(await js(`window.__TV_TEST__.dashboard.selectionMode()`)));

  /* ---------- editor: open / direction / long text / autosave ---------- */
  await js(`window.__TV_TEST__.editor.open('${mixedId}')`);
  await sleep(400);
  check('editor opens', await js(`window.__TV_TEST__.editor.visible()`));
  const editorVal = await js(`window.__TV_TEST__.editor.get()`);
  check('editor shows mixed content', editorVal.includes('این یک prompt') && editorVal.includes('https://docs.example.com'));

  // tag suggestions: open via the dedicated button (deterministic), click adds exactly that tag
  await js(`document.getElementById('btn-tag-suggest').click()`);
  await sleep(300);
  check('tag suggestions list existing tags',
    await js(`!document.getElementById('tag-suggest').classList.contains('hidden')`)
    && (await js(`document.querySelectorAll('#tag-suggest .ts-chip').length`)) > 0);
  await js(`[...document.querySelectorAll('#tag-suggest .ts-chip')].find(c => c.dataset.tag === 'Notes')?.click()`);
  await sleep(250);
  check('clicking a suggested tag adds it',
    await js(`[...document.querySelectorAll('#editor-tags .chip .chip-text')].some(t => t.textContent === 'Notes')`));
  // wait for the autosave to flush the new tag
  await waitFor(async () => (await js(`window.__TV_TEST__.App.get('${mixedId}').tags.includes('Notes')`)) === true, 4000);
  check('added tag persisted by autosave', await js(`window.__TV_TEST__.App.get('${mixedId}').tags.includes('Notes')`));

  // card color label: pick Blue from the palette
  await js(`document.getElementById('btn-color').click()`);
  await sleep(250);
  const colorItems = await js(`window.__TV_TEST__.dashboard.dropdownItems()`);
  check('color menu lists all colors', ['No color', 'Red', 'Blue', 'Pink'].every((c) => colorItems.includes(c)), colorItems.join(' | '));
  await js(`window.__TV_TEST__.dashboard.dropdownClick('Blue')`);
  await waitFor(async () => (await js(`window.__TV_TEST__.App.get('${mixedId}').color`)) === 'blue', 4000);
  check('card color saved on the entry', await js(`window.__TV_TEST__.App.get('${mixedId}').color`) === 'blue');

  const dirAttr = await js(`document.getElementById('editor-textarea').getAttribute('dir')`);
  check('auto direction resolves RTL for Persian-leading text', dirAttr === 'rtl', `dir=${dirAttr}`);
  const bidiCss = await js(`getComputedStyle(document.getElementById('editor-textarea')).unicodeBidi`);
  check('textarea uses unicode-bidi: plaintext', bidiCss === 'plaintext', bidiCss);

  // long text opens and stays intact
  const longId = longEntry.id;
  await js(`window.__TV_TEST__.editor.open('${longId}')`);
  await sleep(400);
  const longVal = await js(`window.__TV_TEST__.editor.get()`);
  check('850-line text loads intact in editor', longVal.split('\n').length === 852 && longVal.startsWith('— START'));

  // edit + autosave
  const appended = longVal + '\nAPPENDED LINE — خط اضافه‌شده';
  await js(`window.__TV_TEST__.editor.set(${JSON.stringify(appended)})`);
  await sleep(250);
  const stateSaving = await js(`window.__TV_TEST__.editor.saveState()`);
  await waitFor(async () => (await js(`window.__TV_TEST__.editor.saveState()`)) === 'Saved', 4000);
  const stateSaved = await js(`window.__TV_TEST__.editor.saveState()`);
  const persisted = await js(`window.__TV_TEST__.App.get('${longId}').content`);
  check('autosave fires (state transitions)', stateSaving === 'Unsaved' && stateSaved === 'Saved', `${stateSaving} → ${stateSaved}`);
  check('autosave persisted appended line', persisted.includes('APPENDED LINE — خط اضافه‌شده'));

  // find & replace ('را' occurs 4× as a substring, incl. inside 'برای')
  await js(`window.__TV_TEST__.editor.open('${mixedId}')`);
  await sleep(300);
  const findCount = await js(`window.__TV_TEST__.editor.find('را')`);
  check('find counts Persian matches', findCount === '1/4', findCount);

  /* ---------- restart persistence ---------- */
  await win.webContents.reload();
  await waitHook();
  const afterReload = await js(`window.__TV_TEST__.App.liveEntries().length`);
  check('library survives app restart', afterReload === 256, `${afterReload} entries after reload`);
  const longAfter = await js(`window.__TV_TEST__.App.get('${longId}').content.includes('APPENDED LINE')`);
  check('edited content survives restart', longAfter);

  /* ---------- trash ---------- */
  const trashFlow = await js(`(async () => {
    const { App } = window.__TV_TEST__;
    const victim = (await App.createNew({ title: 'Trash me', content: 'bye' })).id;
    await App.moveToTrash(victim);
    const inTrash = App.trashedEntries().length;
    await App.restoreEntry(victim);
    const restored = App.get(victim).deletedAt === null;
    await App.moveToTrash(victim);
    await App.purgeEntry(victim);
    const purged = !App.get(victim);
    return { inTrash, restored, purged };
  })()`);
  check('trash → restore → purge flow', trashFlow.inTrash === 1 && trashFlow.restored && trashFlow.purged);

  /* ---------- exports ---------- */
  const mixedEntry = await js(`window.__TV_TEST__.App.get('${mixedId}')`);
  const longEntryFull = await js(`window.__TV_TEST__.App.get('${longId}')`);
  const exportEntries = [mixedEntry, longEntryFull].map((e) => ({
    id: e.id, title: e.title || 'Untitled', content: e.content, tags: e.tags, dir: e.dir, stats: e.stats, updatedAt: e.updatedAt,
  }));

  const exp = (kind, mode, entries, name) =>
    win.webContents.executeJavaScript(`window.tv.export(${JSON.stringify({ kind, mode, entries, defaultName: name })})`, true);

  // TXT single — must be byte-exact
  const r1 = await exp('txt', 'single', [exportEntries[0]], 'Mixed_Prompt_Export.txt');
  check('TXT export (single) ok', r1.ok && fs.existsSync(r1.path), r1.error || r1.path);
  if (r1.ok) {
    const txtBytes = fs.readFileSync(r1.path);
    check('TXT export byte-exact UTF-8 round-trip', txtBytes.equals(Buffer.from(exportEntries[0].content, 'utf8')));
  }

  // DOCX single
  const r2 = await exp('docx', 'single', [exportEntries[0]], 'Mixed_Prompt_Export.docx');
  check('DOCX export ok', r2.ok && fs.existsSync(r2.path), r2.error || r2.path);
  if (r2.ok) {
    const docxHead = fs.readFileSync(r2.path).subarray(0, 2).toString();
    check('DOCX is a valid zip', docxHead === 'PK', docxHead);
  }

  // PDF single
  const r3 = await exp('pdf', 'single', [exportEntries[0]], 'Mixed_Prompt_Export.pdf');
  check('PDF export ok', r3.ok && fs.existsSync(r3.path), r3.error || r3.path);
  if (r3.ok) {
    const pdfHead = fs.readFileSync(r3.path).subarray(0, 5).toString();
    const pdfSize = fs.statSync(r3.path).size;
    check('PDF has valid header + substantial size', pdfHead === '%PDF-' && pdfSize > 20000, `${pdfHead} ${pdfSize}B`);
  }

  // PDF combined multi-entry (850-line doc → many pages)
  const r4 = await exp('pdf', 'combined', exportEntries, null);
  check('PDF combined export ok', r4.ok && fs.existsSync(r4.path), r4.error || r4.path);
  if (r4.ok) {
    const pdf4 = fs.readFileSync(r4.path);
    const pages = (pdf4.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    check('combined PDF has multiple pages', pages >= 8, `${pages} pages (850-line doc included)`);
  }

  // DOCX combined
  const r5 = await exp('docx', 'combined', exportEntries, null);
  check('DOCX combined export ok', r5.ok && fs.existsSync(r5.path), r5.error || r5.path);

  // separate files
  const r6 = await exp('txt', 'separate', exportEntries, null);
  const sepFiles = fs.readdirSync(OUT).filter((f) => f.endsWith('.txt'));
  check('separate TXT files written', r6.ok && sepFiles.length >= 3, sepFiles.join(', '));

  /* ---------- backup / import round-trip ---------- */
  let backupEntries = null; // kept for the replace-import regression at the end
  const backup = await win.webContents.executeJavaScript(
    `window.tv.backupExport({ entries: [...window.__TV_TEST__.App.entries.values()] })`, true);
  check('backup export ok', backup.ok, backup.error || backup.path);
  if (backup.ok) {
    const backupData = JSON.parse(fs.readFileSync(backup.path, 'utf8'));
    check('backup format valid + unicode intact', backupData.format === 'textvault-backup'
      && JSON.stringify(backupData).includes('این یک prompt'));

    const importRes = await win.webContents.executeJavaScript(
      `window.tv.backupImport({ pathOverride: ${JSON.stringify(backup.path)} })`, true);
    check('backup import read ok', importRes.ok && importRes.count === 256, `${importRes.count} entries in backup`);
    if (importRes.ok) {
      backupEntries = importRes.entries;
      await js(`(async () => window.__TV_TEST__.App.importLibrary(${JSON.stringify(importRes.entries)}, { mode: 'merge' }))()`);
      const afterMerge = await js(`window.__TV_TEST__.App.liveEntries().length`);
      check('merge import skips exact duplicates', afterMerge === 256, `${afterMerge} after merge`);
    }
  }

  /* ---------- screenshots for visual bidi verification ---------- */
  await js(`window.__TV_TEST__.App.setView('dashboard'); window.__TV_TEST__.dashboard.search('')`);
  await sleep(700);
  check('card shows its color stripe', await js(`!!document.querySelector('#grid-inner .card[data-color="blue"]')`));

  // long titles ellipsize and never run under the star/trash buttons
  const longTitleId = await js(`(async () => (await window.__TV_TEST__.App.createNew({ title: ${JSON.stringify('A very very long English title that must be truncated '.repeat(3) + 'و ادامه‌ی فارسی عنوان طولانی')}, content: 'long title test' })).id)()`);
  await sleep(500);
  const ellInfo = await js(`(() => {
    const card = document.querySelector('#grid-inner .card[data-id="${longTitleId}"]');
    const t = card?.querySelector('.card-title .t');
    const a = card?.querySelector('.card-actions');
    if (!card || !t || !a) return null;
    return {
      clipped: t.scrollWidth > t.clientWidth,
      insideCard: t.getBoundingClientRect().right <= card.getBoundingClientRect().right,
      gap: Math.round(a.getBoundingClientRect().left - t.getBoundingClientRect().right),
    };
  })()`);
  check('long card title ellipsizes before the buttons',
    !!ellInfo && ellInfo.clipped === true && ellInfo.insideCard === true && ellInfo.gap > 0, JSON.stringify(ellInfo));

  await shot(win, 'dashboard.png');

  await js(`window.__TV_TEST__.editor.open('${mixedId}')`);
  await sleep(500);
  await shot(win, 'editor-mixed.png');

  await js(`window.__TV_TEST__.editor.open('${longId}')`);
  await sleep(500);
  await shot(win, 'editor-long.png');

  // render the PDF print view and screenshot it (same engine that prints the PDF)
  const { buildPdfHtml } = await import(pathToFileURL(path.join(ROOT, 'electron/exporters/pdf-html.mjs')).href);
  const fonts = {
    regular: fs.readFileSync(path.join(ROOT, 'src/assets/fonts/Vazirmatn-Regular.woff2')).toString('base64'),
    bold: fs.readFileSync(path.join(ROOT, 'src/assets/fonts/Vazirmatn-Bold.woff2')).toString('base64'),
  };
  const pdfHtml = buildPdfHtml([exportEntries[0]], { fonts });
  const printWin = new BrowserWindow({ width: 900, height: 1100, show: false });
  await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(pdfHtml));
  await printWin.webContents.executeJavaScript('document.fonts.ready.then(() => true)', true);
  printWin.showInactive(); // capturePage needs a painted (not hidden) window
  await sleep(400);
  await shot(printWin, 'pdf-preview.png');
  printWin.destroy();

  /* ---------- v1.0.0 regression: card color isolation ---------- */
  // return to the dashboard first: the grid last laid out while hidden (editor view)
  await js(`window.__TV_TEST__.App.setView('dashboard')`);
  await sleep(600);
  // Invariant: the set of striped cards must EXACTLY equal the set of rendered
  // entries whose data has a color — recycled DOM cards must never leak a color.
  const colorInvariant = () => js(`(() => {
    const dom = [...document.querySelectorAll('#grid-inner .card[data-color]')].map(c => c.dataset.id + ':' + c.dataset.color).sort();
    const rendered = new Set([...document.querySelectorAll('#grid-inner .card')].map(c => c.dataset.id));
    const expected = window.__TV_TEST__.App.liveEntries().filter(e => e.color && rendered.has(e.id)).map(e => e.id + ':' + e.color).sort();
    return { ok: JSON.stringify(dom) === JSON.stringify(expected), dom, expected };
  })()`);

  const colorIds = await js(`(async () => {
    const { App } = window.__TV_TEST__;
    const a = await App.createNew({ title: 'Color A', content: 'a' });
    await App.update(a.id, { color: 'red' });
    const b = await App.createNew({ title: 'NoColor B', content: 'b' });
    const c = await App.createNew({ title: 'NoColor C', content: 'c' });
    return { a: a.id, b: b.id, c: c.id };
  })()`);
  await sleep(500);
  let inv = await colorInvariant();
  check('visible stripes exactly match colored card data', inv.ok, JSON.stringify(inv));
  const detail = await js(`(() => {
    const read = (id) => {
      const el = document.querySelector('#grid-inner .card[data-id="' + id + '"]');
      return el ? (el.dataset.color ?? null) : 'not-rendered';
    };
    const { App } = window.__TV_TEST__;
    return {
      a: read('${colorIds.a}'), b: read('${colorIds.b}'), c: read('${colorIds.c}'),
      aExists: !!App.get('${colorIds.a}'),
      sortedTop: App.liveEntries().sort((x, y) => y.updatedAt - x.updatedAt).slice(0, 5).map(e => e.title),
      renderedTop: [...document.querySelectorAll('#grid-inner .card')].slice(0, 5).map(el => el.querySelector('.card-title .t')?.textContent),
    };
  })()`);
  check('one colored card stripes; uncolored neighbors stay plain', detail.a === 'red' && !detail.b && !detail.c,
    JSON.stringify(detail) + ' | grid: ' + JSON.stringify(await js(`window.__TV_TEST__.dashboard.debug()`)));

  // change colors: A cleared, C set — recycled cards must reflect exactly this
  await js(`(async () => {
    const { App } = window.__TV_TEST__;
    await App.update('${colorIds.a}', { color: null });
    await App.update('${colorIds.c}', { color: 'blue' });
  })()`);
  await sleep(500);
  inv = await colorInvariant();
  check('color changes keep stripes exactly in sync with data', inv.ok, JSON.stringify(inv));
  const aCleared = await js(`!document.querySelector('#grid-inner .card[data-id="${colorIds.a}"][data-color]')`);
  check('cleared color disappears from its card', aCleared);

  // navigate away and back, then restart — visual state must still match data
  await js(`window.__TV_TEST__.App.setView('settings')`);
  await sleep(200);
  await js(`window.__TV_TEST__.App.setView('dashboard')`);
  await sleep(400);
  await win.webContents.reload();
  await waitHook();
  await sleep(700);
  inv = await colorInvariant();
  check('colors stay exactly data-driven after navigation + restart', inv.ok, JSON.stringify(inv));

  /* ---------- v1.0.0 regression: maximize/resize layout ---------- */
  const layoutAssertions = () => js(`(() => {
    const vp = document.getElementById('card-grid');
    const cards = [...document.querySelectorAll('#grid-inner .card')];
    if (!cards.length) return { error: 'no cards' };
    const vpr = vp.getBoundingClientRect();
    const rects = cards.map(c => c.getBoundingClientRect());
    const widths = new Set(rects.map(r => Math.round(r.width)));
    let outside = 0, overlap = 0;
    rects.forEach(r => { if (r.right > vpr.right + 1 || r.left < vpr.left - 1) outside++; });
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      if (x > 4 && y > 4) overlap++;
    }
    return { cards: cards.length, widths: [...widths], outside, overlap, viewportW: vp.clientWidth };
  })()`);
  const layoutNormal = await layoutAssertions();

  // real maximize (the reported scenario) — wait for the window state so slow
  // window-manager animations under load can't swallow the next transition
  const waitForWnd = async (fn, ms = 5000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(150); }
    return fn();
  };
  win.maximize();
  await waitForWnd(() => win.isMaximized());
  await sleep(400);
  const layoutMax = await layoutAssertions();
  check('maximized layout: no overlap, none outside, uniform widths',
    !layoutMax.error && layoutMax.overlap === 0 && layoutMax.outside === 0 && layoutMax.widths.length === 1,
    JSON.stringify(layoutMax));
  check('maximize re-flows using the wider viewport',
    layoutMax.viewportW > layoutNormal.viewportW, `${layoutNormal.viewportW} → ${layoutMax.viewportW}`);

  // restore — unmaximize, then enforce the exact restored size (some window
  // managers lose the pre-maximize bounds under load; the layout assertions
  // care about the grid re-flowing on shrink, which setBounds exercises identically)
  win.unmaximize();
  await waitForWnd(() => !win.isMaximized());
  win.setBounds({ x: 80, y: 40, width: 1440, height: 920 });
  await waitForWnd(() => Math.abs(win.getBounds().width - 1440) < 40);
  await sleep(400);
  const layoutRestored = await layoutAssertions();
  check('restored layout returns to normal metrics',
    !layoutRestored.error && layoutRestored.overlap === 0 && layoutRestored.outside === 0
    && layoutRestored.widths.length === 1 && layoutRestored.viewportW === layoutNormal.viewportW,
    JSON.stringify(layoutRestored));

  // small manual resize (kept within screen bounds)
  win.setBounds({ x: 40, y: 20, width: 1080, height: 720 });
  await waitForWnd(() => Math.abs(win.getBounds().width - 1080) < 40);
  await sleep(400);
  const layoutSmall = await layoutAssertions();
  check('small-window layout is intact',
    !layoutSmall.error && layoutSmall.overlap === 0 && layoutSmall.outside === 0
    && layoutSmall.widths.length === 1 && layoutSmall.viewportW < layoutNormal.viewportW,
    JSON.stringify(layoutSmall));

  win.setBounds({ x: 80, y: 40, width: 1440, height: 920 });
  await sleep(500);

  /* ---------- replace import (atomic replace path) ---------- */
  // Re-import the full backup in replace mode as the final state mutation:
  // the library must end up with EXACTLY the backup's entries — exercising
  // the single-transaction replace (no half-replaced state, no leftovers).
  if (backupEntries) {
    const replaceRes = await js(`(async () => {
      const { App } = window.__TV_TEST__;
      const out = await App.importLibrary(${JSON.stringify(backupEntries)}, { mode: 'replace' });
      return { imported: out.imported, live: App.liveEntries().length, total: App.entries.size };
    })()`);
    const backupLive = backupEntries.filter((e) => !e.deletedAt).length;
    check('replace import restores the backup exactly',
      replaceRes.total === backupEntries.length && replaceRes.live === backupLive,
      `live=${replaceRes.live}/${backupLive} total=${replaceRes.total}/${backupEntries.length}`);
    check('replace import preserves unicode content',
      await js(`!!window.__TV_TEST__.App.liveEntries().find((e) => e.content.includes('این یک prompt'))`));
  } else {
    check('replace import restores the backup exactly', false, 'backup import was unavailable');
  }

  finish();
}

async function shot(win, name) {
  try {
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, name), img.toPNG());
    console.log('  📸', name);
  } catch (err) {
    console.log('  📸 failed:', name, err.message);
  }
}

function finish() {
  const ok = results.filter((r) => r.ok).length;
  console.log(`\nE2E: ${ok}/${results.length} passed\n`);
  const { app } = require('electron');
  app.exit(process.exitCode ? 1 : 0);
}

main().catch((err) => {
  console.error('E2E fatal:', err);
  process.exitCode = 1;
  finish();
});
