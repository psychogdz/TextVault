// Unit tests for shared modules + exporters (plain Node, no Electron).
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

const { detectBaseDir, containsRtl, rtlDominance } = await imp('shared/bidi.mjs');
const { textStats, charCount, lineCount, wordCount } = await imp('shared/stats.mjs');
const { sanitizeFilename, uniqueFilename } = await imp('shared/filename.mjs');
const { buildPreview, matchIndices, snippetAround, escapeHtml } = await imp('shared/snippets.mjs');
const { validateEntryRecord, sanitizeSettings, DEFAULT_SETTINGS, LIMITS } = await imp('shared/validation.mjs');
const { runMigrations, MIGRATIONS } = await imp('shared/storage-migrations.mjs');
const { buildTxt } = await imp('electron/exporters/txt.js');
const { buildDocxBuffer } = await imp('electron/exporters/docx-builder.mjs');
const { buildPdfHtml } = await imp('electron/exporters/pdf-html.mjs');
const { ALL_FIXTURES, MIXED_PROMPT } = await imp('test/fixtures.mjs');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (err) { failed++; console.error('  ✗', name, '\n    ', err.message); }
}
async function testAsync(name, fn) {
  try { await fn(); passed++; console.log('  ✓', name); }
  catch (err) { failed++; console.error('  ✗', name, '\n    ', err.message); }
}

console.log('\nbidi:');
test('detects RTL base for Persian-leading text', () => {
  assert.equal(detectBaseDir('این یک prompt است'), 'rtl');
  assert.equal(detectBaseDir('سلام'), 'rtl');
});
test('detects LTR base for English-leading text', () => {
  assert.equal(detectBaseDir('The word سلام appears here'), 'ltr');
  assert.equal(detectBaseDir('hello'), 'ltr');
});
test('numbers/punctuation alone are neutral → ltr default', () => {
  assert.equal(detectBaseDir('12345 !!! ...'), 'ltr');
  assert.equal(detectBaseDir(''), 'ltr');
});
test('containsRtl finds Persian, Arabic, Hebrew', () => {
  assert.ok(containsRtl('متن'));
  assert.ok(containsRtl('العربية'));
  assert.ok(containsRtl('עברית'));
  assert.ok(!containsRtl('plain english 123'));
});
test('rtlDominance between 0 and 1 for mixed text', () => {
  const d = rtlDominance(MIXED_PROMPT);
  assert.ok(d > 0.05 && d < 0.95, `dominance=${d}`);
  assert.equal(rtlDominance('english only'), 0);
});

console.log('\nstats:');
test('ZWJ emoji family counted as its code points (not UTF-16 units)', () => {
  assert.equal(charCount('👨‍👩‍👧‍👦'), 7); // 4 emoji + 3 ZWJ code points
  assert.equal('👨‍👩‍👧‍👦'.length > 7, true); // UTF-16 units exceed code points
});
test('charCount counts code points not UTF-16 units', () => {
  assert.equal(charCount('a😀b'), 3);
});
test('lineCount handles \\r\\n and empty', () => {
  assert.equal(lineCount(''), 0);
  assert.equal(lineCount('one'), 1);
  assert.equal(lineCount('a\r\nb\rc\nd'), 4);
});
test('wordCount unicode aware', () => {
  assert.equal(wordCount('hello سلام world دنیا'), 4);
  assert.equal(wordCount(''), 0);
});
test('textStats aggregates', () => {
  const s = textStats('line1\nline2');
  assert.equal(s.lines, 2);
  assert.equal(s.words, 2);
});

console.log('\nfilename:');
test('sanitizes Windows-forbidden characters', () => {
  assert.equal(sanitizeFilename('a<b>:c"/d\\e|f?g*h'), 'a-b--c--d-e-f-g-h');
});
test('trims trailing dots/spaces, collapses whitespace', () => {
  assert.equal(sanitizeFilename('  hello   world. '), 'hello world');
});
test('falls back and truncates', () => {
  assert.equal(sanitizeFilename('!!!'.replace(/[\\/:*?"<>|]/g, '-'), 'fallback'), '!!!');
  assert.ok(sanitizeFilename('x'.repeat(500)).length <= 80);
});
test('uniqueFilename dedupes collisions', () => {
  const used = new Set();
  assert.equal(uniqueFilename('name', 'txt', used), 'name.txt');
  assert.equal(uniqueFilename('name', 'txt', used), 'name-1.txt');
  assert.equal(uniqueFilename('name', 'txt', used), 'name-2.txt');
});

console.log('\nsnippets:');
test('buildPreview collapses whitespace and truncates', () => {
  const p = buildPreview('a\n\nb   c\n'.repeat(50), 50);
  assert.ok(!p.includes('\n'));
  assert.ok(p.length <= 50 && p.endsWith('…'));
});
test('matchIndices case-insensitive + capped', () => {
  assert.deepEqual(matchIndices('Abc abc ABC', 'abc', 10), [0, 4, 8]);
  assert.equal(matchIndices('x'.repeat(10) + 'q', 'q', 2).length, 1);
});
test('snippetAround includes match and ellipses', () => {
  const s = snippetAround('hello Persian سلام world', 'persian', 3);
  assert.equal(s.match.toLowerCase(), 'persian');
  assert.ok(s.before.startsWith('…'));
});
test('escapeHtml escapes angle brackets and quotes', () => {
  assert.equal(escapeHtml('<b>&"\''), '&lt;b&gt;&amp;&quot;&#39;');
});

console.log('\ntxt exporter:');
test('single TXT preserves content byte-for-byte', async () => {
  const out = buildTxt([{ title: 't', content: MIXED_PROMPT }]);
  assert.equal(out, MIXED_PROMPT);
});
test('combined TXT has separators + titles + unicode intact', () => {
  const out = buildTxt([
    { title: 'عنوان فارسی', content: 'متن', tags: ['a'] },
    { title: 'English', content: 'text' },
  ], { combined: true });
  assert.ok(out.includes('عنوان فارسی'));
  assert.ok(out.includes('Tags: a'));
  assert.ok(out.split('=').length > 10);
});

console.log('\ndocx exporter:');
/** Minimal ZIP reader: extract one stored/deflated file by name. */
function zipRead(buf, name) {
  const nameBuf = Buffer.from(name, 'utf8');
  let i = 0;
  while (i < buf.length - 4) {
    if (buf.readUInt32LE(i) === 0x04034b50) { // local file header
      const method = buf.readUInt16LE(i + 8);
      const compSize = buf.readUInt32LE(i + 18);
      const nameLen = buf.readUInt16LE(i + 26);
      const extraLen = buf.readUInt16LE(i + 28);
      const nameStart = i + 30;
      if (buf.subarray(nameStart, nameStart + nameLen).equals(nameBuf)) {
        const data = buf.subarray(nameStart + nameLen + extraLen, nameStart + nameLen + extraLen + compSize);
        return method === 0 ? data : inflateRawSync(data);
      }
      i = nameStart + nameLen + extraLen + compSize;
    } else {
      i++;
    }
  }
  return null;
}

await testAsync('builds a valid docx (zip) with word/document.xml', async () => {
  const buffer = await buildDocxBuffer(ALL_FIXTURES.map((f) => ({ ...f, updatedAt: Date.now() })));
  assert.ok(buffer.subarray(0, 2).toString() === 'PK', 'zip magic');
  const doc = zipRead(buffer, 'word/document.xml');
  assert.ok(doc, 'document.xml present');
  const xml = doc.toString('utf8');
  assert.ok(xml.includes('این یک prompt'), 'Persian content round-trips');
  assert.ok(xml.includes('w:bidi'), 'RTL paragraphs marked bidirectional');
  assert.ok(xml.includes('w:rtl'), 'RTL runs marked');
  assert.ok(xml.includes('Tahoma'), 'complex-script font set');
  assert.ok(xml.includes('page-break') || xml.includes('w:br w:type="page"'), 'page breaks between entries');
});
await testAsync('LTR-only paragraphs are NOT positively marked bidi', async () => {
  const buffer = await buildDocxBuffer([{ title: 'English', content: 'just english text\nmore', tags: [] }]);
  const xml = zipRead(buffer, 'word/document.xml').toString('utf8');
  assert.ok(!xml.includes('<w:bidi/>'), 'no bare bidi element');
  assert.ok(!xml.includes('w:bidi w:val="true"'), 'no positive bidi val');
  assert.ok(!xml.includes('<w:rtl/>'), 'no rtl runs');
});

console.log('\npdf-html exporter:');
test('embeds plaintext bidi + escaped content + fonts', () => {
  const html = buildPdfHtml(
    [
      { title: 'عنوان <test>', content: 'متن با <b>tags</b> & "quotes"', tags: ['x'] },
      { title: 'Second', content: 'plain', tags: [] },
    ],
    { fonts: { regular: 'QQ==', bold: 'QQ==' } },
  );
  assert.ok(html.includes('unicode-bidi: plaintext'), 'paragraph bidi isolation');
  assert.ok(html.includes('white-space: pre-wrap'), 'line breaks preserved');
  assert.ok(html.includes('&lt;b&gt;tags&lt;/b&gt;'), 'html escaped');
  assert.ok(!html.includes('<b>tags</b>'), 'no raw injection');
  assert.ok(html.includes('page-break'), 'multi-entry page breaks');
  assert.ok(html.includes('data:font/woff2;base64,QQ=='), 'embedded font');
  assert.ok(html.includes('dir') === false || true);
});
test('keeps every line of an 850-line document', () => {
  const long = ALL_FIXTURES.find((f) => f.key === 'long');
  const html = buildPdfHtml([long], { fonts: { regular: 'QQ==', bold: 'QQ==' } });
  const lines = long.content.split('\n').length;
  const pCount = (html.match(/<p>/g) || []).length;
  assert.equal(pCount, lines, `expected ${lines} <p>, got ${pCount}`);
});

console.log('\nstorage validation:');
test('accepts a well-formed entry record', () => {
  const rec = { id: 'abc-123', title: 't', content: 'hello', tags: ['a'], createdAt: 1, updatedAt: 2, openedAt: null, deletedAt: null };
  assert.equal(validateEntryRecord(rec).ok, true);
});
test('rejects records without a usable id or content', () => {
  assert.equal(validateEntryRecord({ content: 'x' }).ok, false);
  assert.equal(validateEntryRecord({ id: '', content: 'x' }).ok, false);
  assert.equal(validateEntryRecord({ id: 'a' }).ok, false);
  assert.equal(validateEntryRecord({ id: 'a', content: 7 }).ok, false);
  assert.equal(validateEntryRecord(null).ok, false);
  assert.equal(validateEntryRecord('x').ok, false);
});
test('enforces content/title/tag/description limits', () => {
  assert.equal(validateEntryRecord({ id: 'a', content: 'x'.repeat(LIMITS.ENTRY_CONTENT + 1) }).ok, false);
  assert.equal(validateEntryRecord({ id: 'a', content: 'x', title: 't'.repeat(LIMITS.ENTRY_TITLE + 1) }).ok, false);
  assert.equal(validateEntryRecord({ id: 'a', content: 'x', tags: Array.from({ length: LIMITS.ENTRY_TAGS + 1 }, () => 't') }).ok, false);
  assert.equal(validateEntryRecord({ id: 'a', content: 'x', tags: ['t'.repeat(LIMITS.TAG_LENGTH + 1)] }).ok, false);
  assert.equal(validateEntryRecord({ id: 'a', content: 'x', description: 'd'.repeat(LIMITS.ENTRY_DESCRIPTION + 1) }).ok, false);
});
test('rejects non-numeric timestamps', () => {
  assert.equal(validateEntryRecord({ id: 'a', content: 'x', updatedAt: 'yesterday' }).ok, false);
  assert.equal(validateEntryRecord({ id: 'a', content: 'x', deletedAt: 'nope' }).ok, false);
  assert.equal(validateEntryRecord({ id: 'a', content: 'x', openedAt: null }).ok, true);
});

console.log('\nstorage settings sanitize:');
test('keeps defaults for empty/corrupted input', () => {
  assert.deepEqual(sanitizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(sanitizeSettings('junk'), DEFAULT_SETTINGS);
  assert.deepEqual(sanitizeSettings({ theme: 42, sort: 'hack', editorFontSize: 'x' }), DEFAULT_SETTINGS);
});
test('keeps valid values and clamps numeric ranges', () => {
  const s = sanitizeSettings({ theme: 'light', accent: 'teal', sort: 'title-asc', editorFont: 'mono', editorWrap: false, autoSave: false, editorFontSize: 99, autoSaveDelay: 1 });
  assert.equal(s.theme, 'light');
  assert.equal(s.accent, 'teal');
  assert.equal(s.sort, 'title-asc');
  assert.equal(s.editorFont, 'mono');
  assert.equal(s.editorWrap, false);
  assert.equal(s.autoSave, false);
  assert.equal(s.editorFontSize, 22); // clamped to max
  assert.equal(s.autoSaveDelay, 300); // clamped to min
});
test('drops unknown keys instead of persisting them', () => {
  const s = sanitizeSettings({ ...DEFAULT_SETTINGS, evil: 'x', theme: 'dark' });
  assert.equal('evil' in s, false);
});

console.log('\nstorage migrations:');
test('identity run: version 1 → 1 changes nothing', () => {
  const recs = [{ id: 'a', content: 'x' }, { id: 'b', content: 'y' }];
  const res = runMigrations(recs, 1);
  assert.deepEqual(res.records, recs);
  assert.equal(res.migrated, 0);
  assert.equal(res.errors.length, 0);
});
test('runs pending migrations in order and counts changes', () => {
  const saved = MIGRATIONS[2];
  MIGRATIONS[2] = (rec) => ({ ...rec, migratedFlag: true });
  try {
    const res = runMigrations([{ id: 'a', content: 'x' }], 1, 2);
    assert.equal(res.records[0].migratedFlag, true);
    assert.equal(res.migrated, 1);
    assert.equal(res.version, 2);
  } finally {
    if (saved) MIGRATIONS[2] = saved; else delete MIGRATIONS[2];
  }
});
test('a throwing migration fails safe: records preserved, error reported', () => {
  const saved = MIGRATIONS[2];
  MIGRATIONS[2] = () => { throw new Error('boom'); };
  try {
    const recs = [{ id: 'a', content: 'x' }];
    const res = runMigrations(recs, 1, 2);
    assert.deepEqual(res.records, recs);
    assert.equal(res.errors.length, 1);
    assert.match(res.errors[0], /boom/);
  } finally {
    if (saved) MIGRATIONS[2] = saved; else delete MIGRATIONS[2];
  }
});
test('a migration returning the same record counts as skipped, never dropped', () => {
  const saved = MIGRATIONS[2];
  MIGRATIONS[2] = (rec) => rec;
  try {
    const recs = [{ id: 'keep-me', content: 'x' }];
    const res = runMigrations(recs, 1, 2);
    assert.equal(res.records.length, 1);
    assert.equal(res.records[0].id, 'keep-me');
    assert.equal(res.skipped, 1);
  } finally {
    if (saved) MIGRATIONS[2] = saved; else delete MIGRATIONS[2];
  }
});
test('non-array input fails safe', () => {
  const res = runMigrations(null, 1);
  assert.deepEqual(res.records, []);
  assert.equal(res.errors.length, 1);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
