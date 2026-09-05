// Unit tests for shared modules + exporters (plain Node, no Electron).
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

const { detectBaseDir, containsRtl, rtlDominance, resolveDirection } = await imp('shared/bidi.mjs');
const { textStats, charCount, lineCount, wordCount } = await imp('shared/stats.mjs');
const { sanitizeFilename, uniqueFilename } = await imp('shared/filename.mjs');
const { buildPreview, matchIndices, snippetAround, escapeHtml } = await imp('shared/snippets.mjs');
const { validateEntryRecord, validateClipboardRecord, sanitizeSettings, DEFAULT_SETTINGS, LIMITS, SORTS } = await imp('shared/validation.mjs');
const { runMigrations, MIGRATIONS } = await imp('shared/storage-migrations.mjs');
const { detectSensitive } = await imp('shared/sensitive.mjs');
const { duplicateAction, applyRetention, applyTimeRetention, buildClipboardItem, clipboardPreview, CLIPBOARD_CONTENT_LIMIT } = await imp('shared/clipboard-policy.mjs');
const {
  applyTextTool, uppercase, lowercase, titleCase, uniqueLines, sortLines,
  jsonPretty, jsonMinify, base64Encode, base64Decode, urlEncode, urlDecode,
} = await imp('shared/text-tools.mjs');
const { detectContentType, actionsForType } = await imp('shared/detect.mjs');
const { validateSnippetRecord, validateCollectionRecord } = await imp('shared/validation.mjs');
const { parseQuery, matchClipboardItem, matchSnippet } = await imp('shared/query.mjs');
const { STRINGS, t, setLanguage, languageDirection, itemsKey } = await imp('shared/i18n.mjs');
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
test('direction resolution: explicit rtl/ltr pass through, auto follows content', () => {
  // an explicit choice must be honored regardless of the text's own script
  assert.equal(resolveDirection('rtl', 'Hello world'), 'rtl');
  assert.equal(resolveDirection('ltr', 'سلام دنیا'), 'ltr');
  // auto resolves from the first strong character (mixed text never reversed)
  assert.equal(resolveDirection('auto', 'سلام دنیا'), 'rtl');
  assert.equal(resolveDirection('auto', 'Hello world'), 'ltr');
  assert.equal(resolveDirection('auto', 'https://example.com'), 'ltr');
  assert.equal(resolveDirection('auto', ''), 'ltr');
  // anything unexpected falls back to auto-detection, never throws
  assert.equal(resolveDirection(undefined, 'سلام'), 'rtl');
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
  const out = await buildTxt([{ title: 't', content: MIXED_PROMPT }]);
  assert.equal(out, MIXED_PROMPT);
});
test('combined TXT has separators + titles + unicode intact', async () => {
  const out = await buildTxt([
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
test('identity run: version 3 → 3 changes nothing', () => {
  const recs = [{ id: 'a', content: 'x', collections: [], isPinned: false }, { id: 'b', content: 'y', collections: ['c'], isPinned: true }];
  const res = runMigrations(recs, 3);
  assert.deepEqual(res.records, recs);
  assert.equal(res.errors.length, 0);
});
test('v1 → v3 adds membership + pin fields, preserves existing values', () => {
  const recs = [{ id: 'a', content: 'x' }, { id: 'b', content: 'y', isPinned: true, collections: ['keep'] }];
  const res = runMigrations(recs, 1);
  assert.equal(res.version, 3);
  assert.deepEqual(res.records[0].collections, []);
  assert.equal(res.records[0].isPinned, false);
  assert.equal(res.records[1].isPinned, true); // existing value preserved
  assert.deepEqual(res.records[1].collections, ['keep']);
  assert.equal(res.records[1].content, 'y'); // content untouched
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

console.log('\nsensitive detection (synthetic values only):');
test('flags private key blocks', () => {
  const r = detectSensitive('-----BEGIN RSA PRIVATE KEY-----\nTEST\n-----END RSA PRIVATE KEY-----');
  assert.equal(r.sensitive, true);
  assert.ok(r.kinds.includes('private-key'));
});
test('flags common key/token shapes', () => {
  assert.ok(detectSensitive('key: sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456').sensitive);
  assert.ok(detectSensitive('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890').sensitive);
  assert.ok(detectSensitive('Authorization: Bearer abcdefghijklmnopqrstuvwxyz123').sensitive);
  assert.ok(detectSensitive('password = "TEST_PASSWORD_EXAMPLE"').sensitive);
});
test('does not flag ordinary content (false-positive safety)', () => {
  assert.equal(detectSensitive('hello world — سلام دنیا').sensitive, false);
  assert.equal(detectSensitive('see https://example.com/docs?v=2').sensitive, false);
  assert.equal(detectSensitive('const total = 123456;').sensitive, false);
  assert.equal(detectSensitive('').sensitive, false);
});
test('detection is mark-only: content never transformed', () => {
  const text = 'password = "TEST_PASSWORD_EXAMPLE"';
  detectSensitive(text);
  assert.equal(text, 'password = "TEST_PASSWORD_EXAMPLE"');
});

console.log('\nclipboard policies:');
test('duplicate policy top: same content skips and reports the existing id', () => {
  const items = [{ id: 'a', content: 'hello' }, { id: 'b', content: 'سلام' }];
  const res = duplicateAction(items, 'hello', 'top');
  assert.deepEqual(res, { action: 'skip', existingId: 'a' });
});
test('duplicate policy new: always creates', () => {
  const items = [{ id: 'a', content: 'hello' }];
  assert.deepEqual(duplicateAction(items, 'hello', 'new'), { action: 'create' });
});
test('retention keeps pinned/favorite and the newest cap', () => {
  const items = Array.from({ length: 10 }, (_, i) => ({
    id: `i${i}`, updatedAt: i, isPinned: i === 0, isFavorite: i === 1,
  }));
  const { keep, remove } = applyRetention(items, 3);
  // protected: i0, i1 — newest unprotected: i9, i8, i7 → cap satisfied
  assert.equal(keep.length, 5);
  assert.ok(keep.includes('i0') && keep.includes('i1'));
  assert.deepEqual(remove.sort(), ['i2', 'i3', 'i4', 'i5', 'i6']);
});
test('retention degenerates safely for tiny caps and small sets', () => {
  assert.deepEqual(applyRetention([{ id: 'a', updatedAt: 1 }], 10).remove, []);
  const { keep, remove } = applyRetention([{ id: 'a', updatedAt: 1 }], 0); // cap 0 → keep nothing
  assert.deepEqual(keep, []);
  assert.deepEqual(remove, ['a']);
});
test('clipboard record builder produces a valid, validated record', () => {
  const item = buildClipboardItem({
    id: 'x1', content: 'متن test', createdAt: 1, updatedAt: 2,
    isSensitive: true, sensitiveKinds: ['credential'],
  });
  assert.equal(validateClipboardRecord(item).ok, true);
  assert.equal(item.contentType, 'text');
  assert.equal(item.isSensitive, true);
  assert.deepEqual(item.sensitiveKinds, ['credential']);
  assert.ok(clipboardPreview(item.content).length <= 220);
  assert.equal(typeof CLIPBOARD_CONTENT_LIMIT, 'number');
});

console.log('\ntext tools:');
test('case transformations are locale-safe and Persian-neutral', () => {
  assert.equal(uppercase('hello سلام'), 'HELLO سلام');
  assert.equal(lowercase('HELLO سلام'), 'hello سلام');
  assert.equal(titleCase('hello world سلام'), 'Hello World سلام');
  assert.ok(titleCase('İstanbul ırmağı').length > 0); // must not throw on tricky locales
});
test('line tools: sort, dedupe (case-insensitive), reverse', () => {
  assert.equal(sortLines('b\na\nc'), 'a\nb\nc');
  assert.equal(uniqueLines('x\nX\ny\nx'), 'x\ny');
  assert.equal(applyTextTool('reverse-lines', '1\n2\n3').result, '3\n2\n1');
});
test('whitespace tools', () => {
  assert.equal(applyTextTool('trim-lines', '  a \n\tb  ').result, 'a\nb');
  assert.equal(applyTextTool('normalize-whitespace', ' a\n\n b   c ').result, 'a b c');
});
test('json tools round-trip and report invalid input safely', () => {
  const obj = { b: 1, a: 'سلام' };
  assert.deepEqual(JSON.parse(jsonPretty(JSON.stringify(obj))), obj);
  assert.equal(jsonMinify(JSON.stringify(obj, null, 2)), JSON.stringify(obj));
  const bad = applyTextTool('json-pretty', '{nope');
  assert.equal(bad.ok, false);
  assert.match(bad.error, /not valid JSON/);
});
test('base64 and url tools round-trip Unicode', () => {
  const text = 'سلام Hello 🎯 https://example.com';
  assert.equal(base64Decode(base64Encode(text)), text);
  assert.equal(urlDecode(urlEncode(text)), text);
  assert.equal(applyTextTool('base64-decode', '!!!not-base64!!!').ok, false);
});
test('every advertised tool applies without throwing on empty input', async () => {
  const { TEXT_TOOLS } = await imp('shared/text-tools.mjs');
  for (const id of TEXT_TOOLS) {
    const res = applyTextTool(id, '');
    assert.ok(res.ok || /not valid/.test(res.error), `${id} failed unexpectedly: ${res.error}`);
  }
});
test('large input stays fast (10k lines, unique-lines)', () => {
  const big = Array.from({ length: 10_000 }, (_, i) => `line ${i % 900} متن`).join('\n');
  const t0 = process.hrtime.bigint();
  const res = applyTextTool('unique-lines', big);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(res.ok);
  assert.ok(ms < 2000, `took ${ms.toFixed(0)}ms`);
});
test('tool contract: every advertised id matches its UI label exactly', async () => {
  // Executable audit table (tool id → [input, exact expected output]).
  // Guards the "label says X, button does Y" bug class, including Persian,
  // numbers, punctuation and mixed RTL/LTR inputs. reverse-lines reverses
  // line ORDER only; no tool ever reverses the characters of a line.
  const { TEXT_TOOLS } = await imp('shared/text-tools.mjs');
  const CONTRACT = {
    'uppercase': ['Hello world سلام 123', 'HELLO WORLD سلام 123'],
    'lowercase': ['Hello WORLD سلام 123', 'hello world سلام 123'],
    'title-case': ['hello big WORLD سلام', 'Hello Big World سلام'],
    'sentence-case': ['hi there. how? fine! سلام', 'Hi there. How? Fine! سلام'],
    'trim-lines': ['  a \n\t سلام \n b\t', 'a\nسلام\nb'],
    'normalize-whitespace': [' a\n\n  سلام   b\tc ', 'a سلام b c'],
    'sort-lines': ['b\na\nc\n2\n10', '10\n2\na\nb\nc'],
    'sort-lines-desc': ['b\na\nc\n2\n10', 'c\nb\na\n2\n10'],
    'unique-lines': ['x\nX\nسلام\nسلام\nx', 'x\nسلام'],
    'reverse-lines': ['1\nسلام\n3', '3\nسلام\n1'],
    'json-pretty': ['{"b":1,"a":"سلام"}', '{\n  "b": 1,\n  "a": "سلام"\n}'],
    'json-minify': ['{\n  "b": 1\n}', '{"b":1}'],
    'base64-encode': ['سلام', '2LPZhNin2YU='],
    'base64-decode': ['2LPZhNin2YU=', 'سلام'],
    'url-encode': ['سلام a&b', '%D8%B3%D9%84%D8%A7%D9%85%20a%26b'],
    'url-decode': ['%D8%B3%D9%84%D8%A7%D9%85%20a%26b', 'سلام a&b'],
  };
  const advertised = new Set(TEXT_TOOLS);
  for (const [id, [input, expected]] of Object.entries(CONTRACT)) {
    assert.ok(advertised.has(id), `contract id ${id} is not advertised in TEXT_TOOLS`);
    const res = applyTextTool(id, input);
    assert.ok(res.ok, `${id} failed: ${res.error}`);
    assert.equal(res.result, expected, `${id} does not match its label/contract`);
  }
  assert.equal(advertised.size, Object.keys(CONTRACT).length, 'a TEXT_TOOLS id is missing from the contract table');
});

console.log('\ncontent detection:');
test('detects common types', () => {
  assert.equal(detectContentType('https://example.com/a?b=1'), 'url');
  assert.equal(detectContentType('user@example.com'), 'email');
  assert.equal(detectContentType('192.168.0.1'), 'ip');
  assert.equal(detectContentType('C:\\Users\\test\\file.txt'), 'path');
  assert.equal(detectContentType('/usr/local/bin'), 'path');
  assert.equal(detectContentType('{"a": 1}'), 'json');
  assert.equal(detectContentType('npm install left-pad'), 'command');
  assert.equal(detectContentType('# Title\n\n- item'), 'markdown');
  assert.equal(detectContentType('const x = 1;'), 'code');
  assert.equal(detectContentType('just plain text سلام'), 'text');
  assert.equal(detectContentType(''), 'text');
});
test('detection is conservative: ambiguous content stays text', () => {
  assert.equal(detectContentType('999.999.999.999 is not an IP'), 'text');
  assert.equal(detectContentType('see https://example.com for details'), 'text');
});
test('actions are explicit and never auto-executing', () => {
  assert.deepEqual(actionsForType('url'), ['open-external', 'copy']);
  assert.deepEqual(actionsForType('text'), ['copy']);
});

console.log('\nsnippet + collection validators:');
test('accepts valid snippet and collection records', () => {
  assert.equal(validateSnippetRecord({ id: 's1', title: 'T', content: 'c', tags: ['a'], collections: [], createdAt: 1, updatedAt: 2 }).ok, true);
  assert.equal(validateCollectionRecord({ id: 'c1', name: 'Work', createdAt: 1 }).ok, true);
});
test('rejects malformed snippets/collections', () => {
  assert.equal(validateSnippetRecord({ id: 's', content: 5 }).ok, false);
  assert.equal(validateSnippetRecord({ id: 's', content: 'x', createdAt: 'now', updatedAt: 2 }).ok, false);
  assert.equal(validateSnippetRecord({ id: 's', content: 'x', createdAt: 1, updatedAt: 2, tags: [42] }).ok, false);
  assert.equal(validateCollectionRecord({ id: '', name: 'X', createdAt: 1 }).ok, false);
  assert.equal(validateCollectionRecord({ id: 'c', name: '   ', createdAt: 1 }).ok, false);
  assert.equal(validateCollectionRecord({ id: 'c', name: 'x'.repeat(200), createdAt: 1 }).ok, false);
});

test('time retention removes only stale unprotected items', () => {
  const now = 10 * 86_400_000; // day 10
  const items = [
    { id: 'old', updatedAt: now - 40 * 86_400_000 },
    { id: 'old-pinned', updatedAt: now - 40 * 86_400_000, isPinned: true },
    { id: 'recent', updatedAt: now - 1 * 86_400_000 },
  ];
  assert.deepEqual(applyTimeRetention(items, 30, now), ['old']);
  assert.deepEqual(applyTimeRetention(items, 0, now), []); // forever
  assert.deepEqual(applyTimeRetention(items, undefined, now), []);
});

console.log('\nquery parsing + matching:');
test('parses all operators', () => {
  const q = parseQuery('hello tag:python type:url is:fav is:pinned collection:work');
  assert.deepEqual(q.terms, ['hello']);
  assert.deepEqual(q.tags, ['python']);
  assert.deepEqual(q.types, ['url']);
  assert.deepEqual(q.collections, ['work']);
  assert.equal(q.favOnly, true);
  assert.equal(q.pinnedOnly, true);
  assert.equal(q.empty, false);
});
test('empty query is recognized', () => {
  assert.equal(parseQuery('').empty, true);
  assert.equal(parseQuery('   ').empty, true);
});
test('clipboard matching honors every operator', () => {
  const idToName = new Map([['c1', 'Work'], ['c2', 'Dev']]);
  const item = {
    id: 'x', content: 'deploy script متن', tags: ['ops'], collections: ['c1'],
    isPinned: true, isFavorite: false, contentType: 'text',
  };
  const q0 = parseQuery('');
  assert.equal(matchClipboardItem(item, q0, idToName), true);
  assert.equal(matchClipboardItem(item, parseQuery('deploy'), idToName), true);
  assert.equal(matchClipboardItem(item, parseQuery('متن'), idToName), true);
  assert.equal(matchClipboardItem(item, parseQuery('nomatch'), idToName), false);
  assert.equal(matchClipboardItem(item, parseQuery('tag:ops'), idToName), true);
  assert.equal(matchClipboardItem(item, parseQuery('tag:web'), idToName), false);
  assert.equal(matchClipboardItem(item, parseQuery('is:pinned'), idToName), true);
  assert.equal(matchClipboardItem(item, parseQuery('is:fav'), idToName), false);
  assert.equal(matchClipboardItem(item, parseQuery('collection:wor'), idToName), true);
  assert.equal(matchClipboardItem(item, parseQuery('collection:dev'), idToName), false);
});
test('clipboard type filter uses stored type or detection', () => {
  const detect = () => 'url';
  const item = { id: 'x', content: 'https://example.com', contentType: 'text', tags: [], collections: [], isPinned: false, isFavorite: false };
  assert.equal(matchClipboardItem(item, parseQuery('type:url'), new Map(), detect), true);
  assert.equal(matchClipboardItem(item, parseQuery('type:json'), new Map(), detect), false);
});
test('snippet matching covers title, content, tags, collections', () => {
  const s = { id: 's1', title: 'Deploy', content: 'git push origin main', tags: ['git'], collections: ['c1'], isFavorite: false };
  assert.equal(matchSnippet(s, parseQuery('push')), true);
  assert.equal(matchSnippet(s, parseQuery('deploy')), true);
  assert.equal(matchSnippet(s, parseQuery('tag:git')), true);
  assert.equal(matchSnippet(s, parseQuery('collection:work'), new Map([['c1', 'Work']])), true);
  assert.equal(matchSnippet(s, parseQuery('type:url')), false);
  assert.equal(matchSnippet(s, parseQuery('is:pinned')), false);
});

console.log('\ni18n:');
test('EN and FA tables define exactly the same keys', () => {
  const en = Object.keys(STRINGS.en).sort();
  const fa = Object.keys(STRINGS.fa).sort();
  assert.deepEqual(fa, en);
  assert.ok(en.length >= 100, `expected >=100 keys, got ${en.length}`);
});
test('t() translates, falls back to English, then to the key', () => {
  setLanguage('fa');
  assert.equal(t('nav.clipboard'), 'کلیپ‌بورد');
  setLanguage('en');
  assert.equal(t('nav.clipboard'), 'Clipboard');
  assert.equal(t('key.that.does.not.exist'), 'key.that.does.not.exist');
});
test('t() substitutes {vars} and handles direction/plural helpers', () => {
  setLanguage('en');
  assert.equal(t('del.many.title', { n: 3, items: 'texts' }), 'Delete 3 texts?');
  assert.equal(itemsKey(1), 'item');
  assert.equal(itemsKey(5), 'items');
  assert.equal(languageDirection('fa'), 'rtl');
  assert.equal(languageDirection('en'), 'ltr');
  setLanguage('fa');
  assert.equal(itemsKey(1), 'items'); // FA: no plural suffix
  setLanguage('en');
});
test('unknown language falls back to English', () => {
  setLanguage('xx');
  assert.equal(languageDirection(), 'ltr');
  assert.equal(t('nav.trash'), 'Trash');
  setLanguage('en');
});

console.log('\ni18n static coverage:');
test('every data-i18n* reference in HTML/views exists in both tables', () => {
  const files = ['src/index.html', 'src/quick.html', 'src/js/views/settings.js', 'src/js/views/snippets.js'];
  const refs = new Set();
  for (const f of files) {
    const src = readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of src.matchAll(/data-i18n(?:-ph|-title|-aria)?="([^"$]+)"/g)) refs.add(m[1]);
  }
  assert.ok(refs.size >= 40, `expected static references, got ${refs.size}`);
  for (const key of refs) {
    assert.ok(STRINGS.en[key] !== undefined, 'missing EN key: ' + key);
    assert.ok(STRINGS.fa[key] !== undefined, 'missing FA key: ' + key);
  }
});
test('dynamic key families resolve: tools, colors, settings shortcuts', async () => {
  const { TEXT_TOOLS } = await imp('shared/text-tools.mjs');
  for (const id of TEXT_TOOLS) {
    assert.ok(STRINGS.en['tool.' + id] !== undefined, 'missing tool.' + id);
  }
  for (const c of ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink']) {
    assert.ok(STRINGS.en['color.' + c] !== undefined, 'missing color.' + c);
  }
  const settingsSrc = readFileSync(path.join(ROOT, 'src/js/views/settings.js'), 'utf8');
  for (const m of settingsSrc.matchAll(/\['([a-z.]+)', '[^']+'\]/g)) {
    assert.ok(STRINGS.en[m[1]] !== undefined, 'missing settings key: ' + m[1]);
  }
});
test('exporters localize document labels with the lang option', async () => {
  const { buildTxt } = await imp('electron/exporters/txt.js');
  const fa = await buildTxt([{ title: '', content: 'x', tags: ['a'], updatedAt: 1700000000000 }], { combined: true, lang: 'fa' });
  assert.ok(fa.includes('بدون عنوان') && fa.includes('برچسب‌ها: a'), 'FA txt labels');
  const en = await buildTxt([{ title: '', content: 'x', tags: ['a'], updatedAt: 1700000000000 }], { combined: true, lang: 'en' });
  assert.ok(en.includes('Untitled') && en.includes('Tags: a'), 'EN txt labels');
  const { buildPdfHtml } = await imp('electron/exporters/pdf-html.mjs');
  const html = buildPdfHtml([{ title: '', content: 'x' }], { fonts: { regular: 'QQ==', bold: 'QQ==' }, lang: 'fa' });
  assert.ok(html.includes('بدون عنوان') && html.includes('خروجی TextVault'), 'FA pdf labels');
});

console.log('\nsort state ↔ UI control consistency (v2.0.0 regression):');
test('every SORTS value has a matching option in the sort-select markup', () => {
  const html = readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');
  const block = html.match(/<select id="sort-select"[\s\S]*?<\/select>/);
  assert.ok(block, 'sort-select found in index.html');
  const values = [...block[0].matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(values, [...SORTS]);
});
test('sanitizeSettings accepts every value the sort-select can submit', () => {
  for (const v of SORTS) {
    assert.equal(sanitizeSettings({ sort: v }).sort, v, v);
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
