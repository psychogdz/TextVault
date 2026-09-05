// Editor: title, tags, direction control, bidi textarea, find & replace,
// autosave (debounced + crash-safe drafts), stats, text tools, pin,
// copy/export actions.
import { App } from '../state.js';
import { icon } from '../ui/icons.js';
import { toast, toastError, confirmDialog, showDropdown, formatNumber } from '../ui/components.js';
import { applyEdits, createEntry, CARD_COLORS } from '../core/entry.js';
import { applyTextTool, TEXT_TOOLS } from '../../../shared/text-tools.mjs';
import { t } from '../../../shared/i18n.mjs';
import { detectBaseDir } from '../../../shared/bidi.mjs';
import { escapeHtml } from '../../../shared/snippets.mjs';

const els = {};
let current = null;      // { entry, isNew, dirty, lastDupHash }
let saveTimer = null;
let draftTimer = null;
let findState = null;    // { indices, idx, query, caseSensitive }

export function initEditor() {
  els.view = document.getElementById('view-editor');
  els.back = document.getElementById('editor-back');
  els.title = document.getElementById('editor-title');
  els.saveState = document.getElementById('save-state');
  els.saveStateTxt = els.saveState.querySelector('.txt');
  els.textarea = document.getElementById('editor-textarea');
  els.area = els.textarea.parentElement;
  els.mirror = document.getElementById('editor-mirror');
  els.tagsWrap = document.getElementById('editor-tags');
  els.tagInput = document.getElementById('tag-input');
  els.tagSuggest = document.getElementById('tag-suggest');
  els.btnTagSuggest = document.getElementById('btn-tag-suggest');
  els.btnColor = document.getElementById('btn-color');
  els.dirSeg = document.getElementById('dir-seg');
  els.findbar = document.getElementById('findbar');
  els.findInput = document.getElementById('find-input');
  els.findCount = document.getElementById('find-count');
  els.replaceInput = document.getElementById('replace-input');
  els.findPrev = document.getElementById('find-prev');
  els.findNext = document.getElementById('find-next');
  els.findCase = document.getElementById('find-case');
  els.replaceOne = document.getElementById('replace-one');
  els.replaceAll = document.getElementById('replace-all');
  els.findbarClose = document.getElementById('findbar-close');
  els.btnFind = document.getElementById('btn-find-toggle');
  els.btnCopy = document.getElementById('btn-copy-all');
  els.btnFav = document.getElementById('btn-fav');
  els.btnExport = document.getElementById('btn-export');
  els.btnMore = document.getElementById('btn-more');
  els.dupBanner = document.getElementById('dup-banner');
  els.statChars = document.getElementById('stat-chars');
  els.statWords = document.getElementById('stat-words');
  els.statLines = document.getElementById('stat-lines');
  els.statPos = document.getElementById('stat-pos');
  els.statDir = document.getElementById('stat-dir');
  els.toggleWrap = document.getElementById('toggle-wrap');
  els.toggleFont = document.getElementById('toggle-font');

  // icons
  els.back.innerHTML = icon('arrow-left', 18);
  els.btnFind.innerHTML = icon('find', 17);
  els.btnCopy.innerHTML = icon('copy', 17);
  els.btnExport.innerHTML = icon('download', 17);
  els.btnMore.innerHTML = icon('more', 17);
  els.findPrev.innerHTML = icon('chevron-up', 14);
  els.findNext.innerHTML = icon('chevron-down', 14);
  els.findbarClose.innerHTML = icon('x', 16);

  /* ---- navigation ---- */
  els.back.addEventListener('click', () => closeEditor());

  /* ---- change tracking ---- */
  els.title.addEventListener('input', () => markDirty());
  els.textarea.addEventListener('input', () => {
    markDirty();
    updateStats();
    autoDirection();
    scheduleFindSync();
  });
  els.textarea.addEventListener('scroll', syncMirrorScroll);
  // Keep the highlight layer aligned when the editor box or fonts change.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (!els.area.classList.contains('find-active')) return;
      syncMirrorGeometry();
      renderFindMarks();
      if (findState) scrollCurrentIntoView();
    }).observe(els.textarea);
  }
  // Webfonts landing after boot change text metrics — re-align an active search.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      if (!els.area.classList.contains('find-active')) return;
      syncMirrorGeometry();
      renderFindMarks();
      if (findState) scrollCurrentIntoView();
    });
  }
  els.textarea.addEventListener('keyup', updateCaretPos);
  els.textarea.addEventListener('click', updateCaretPos);
  els.textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      document.execCommand('insertText', false, '\t');
    }
  });

  /* ---- tags ---- */
  els.tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(els.tagInput.value);
    } else if (e.key === 'Backspace' && !els.tagInput.value && current?.entry.tags.length) {
      current.entry.tags.pop();
      renderTags();
      markDirty();
    }
  });
  els.tagInput.addEventListener('blur', () => { if (els.tagInput.value.trim()) addTag(els.tagInput.value); });

  /* ---- existing-tags picker ---- */
  els.btnTagSuggest.innerHTML = icon('tag', 15);
  els.btnTagSuggest.addEventListener('click', () => {
    if (!els.tagSuggest.classList.contains('hidden')) { hideTagSuggest(); return; }
    renderTagSuggest();
    els.tagInput.focus();
  });
  els.tagInput.addEventListener('focus', () => renderTagSuggest());
  els.tagInput.addEventListener('click', () => renderTagSuggest());
  els.tagInput.addEventListener('input', () => renderTagSuggest());
  els.tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.tagSuggest.classList.contains('hidden')) {
      e.stopPropagation();
      hideTagSuggest();
    }
  });
  // mousedown (fires before the input's blur) so chip clicks register
  els.tagSuggest.addEventListener('mousedown', (e) => e.preventDefault());
  els.tagSuggest.addEventListener('click', (e) => {
    const chip = e.target.closest('.ts-chip');
    if (!chip) return;
    addTag(chip.dataset.tag);
    renderTagSuggest();
  });
  document.addEventListener('mousedown', (e) => {
    if (!els.tagSuggest.classList.contains('hidden')
        && !els.tagSuggest.contains(e.target)
        && !els.tagInput.contains(e.target)
        && !els.btnTagSuggest.contains(e.target)) {
      hideTagSuggest();
    }
  });

  /* ---- card color label ---- */
  const colorWrap = document.createElement('div');
  colorWrap.className = 'menu-wrap';
  els.btnColor.replaceWith(colorWrap);
  colorWrap.appendChild(els.btnColor);
  els.btnColor.addEventListener('click', () => {
    if (!current) return;
    const items = [
      { headerLabel: t('ed.cardColor') },
      { label: t('ed.colorNone'), swatch: 'none', onClick: () => setColor(null) },
      ...CARD_COLORS.map((c) => ({
        label: t('color.' + c),
        swatch: c,
        onClick: () => setColor(c),
      })),
    ];
    showDropdown(els.btnColor, items);
  });

  /* ---- direction segmented ---- */
  els.dirSeg.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!current) return;
      current.entry.dir = btn.dataset.dir;
      syncDirButtons();
      applyDirection();
      markDirty();
    });
  });

  /* ---- toolbar ---- */
  els.btnCopy.addEventListener('click', copyAll);
  els.btnFav.addEventListener('click', async () => {
    if (!current) return;
    await App.toggleFavorite(current.entry.id);
    syncFavButton();
    renderTags();
  });
  els.btnFind.addEventListener('click', () => toggleFindbar(true));
  els.findbarClose.addEventListener('click', () => toggleFindbar(false));
  els.btnExport.addEventListener('click', () => {
    if (!current) return;
    App.showExportMenu([current.entry], els.btnExport);
  });
  els.btnMore.addEventListener('click', () => {
    if (!current) return;
    const pinned = !!(App.get(current.entry.id)?.isPinned);
    showDropdown(els.btnMore, [
      { headerLabel: t('ed.headerText') },
      { label: t('ed.copyAllLabel'), icon: 'copy', onClick: copyAll },
      { label: t('ed.textTools'), icon: 'type', onClick: () => showTextTools(els.btnMore) },
      {
        label: pinned ? t('unpin') : t('pin'), icon: 'pin', onClick: togglePin,
      },
      {
        label: t('ed.deleteText'), icon: 'trash', danger: true, onClick: async () => {
          const ok = await confirmDialog({
            title: t('del.card.title'),
            message: t('del.card.body'),
            messageValues: [App.titleOf(current.entry)],
            confirmText: t('del.confirm'),
            danger: true,
          });
          if (!ok) return;
          discardDraft();
          await App.moveToTrash(current.entry.id);
          toast(t('del.movedOne'), { type: 'info' });
          closeEditor(true);
        },
      },
    ]);
  });

  /* ---- find & replace ---- */
  els.findInput.addEventListener('input', () => { runFind(); });
  els.findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? gotoMatch(-1) : gotoMatch(1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); gotoMatch(1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); gotoMatch(-1); }
    if (e.key === 'Escape') { e.stopPropagation(); toggleFindbar(false); }
  });
  els.replaceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); replaceCurrent(); }
    if (e.key === 'Escape') { e.stopPropagation(); toggleFindbar(false); }
  });
  els.findPrev.addEventListener('click', () => gotoMatch(-1));
  els.findNext.addEventListener('click', () => gotoMatch(1));
  els.findCase.addEventListener('click', () => {
    els.findCase.classList.toggle('active');
    runFind();
  });
  els.replaceOne.addEventListener('click', replaceCurrent);
  els.replaceAll.addEventListener('click', replaceAllMatches);

  /* ---- status bar toggles ---- */
  els.toggleWrap.addEventListener('click', () => {
    App.settings.editorWrap = !App.settings.editorWrap;
    App.persistSettings();
    applyEditorPrefs();
  });
  els.toggleFont.addEventListener('click', () => {
    App.settings.editorFont = App.settings.editorFont === 'sans' ? 'mono' : 'sans';
    App.persistSettings();
    applyEditorPrefs();
  });

  /* ---- crash safety: full draft on unload (title + content + tags + dir) ---- */
  window.addEventListener('beforeunload', () => {
    if (current) writeDraft(current.entry);
  });
}

function toolLabel(id) {
  // Translation keys mirror the tool ids (shared/text-tools.mjs TEXT_TOOLS).
  return t('tool.' + id);
}

/** Open the text-tools menu anchored to the editor toolbar. */
export function showTextTools(anchorEl) {
  if (!current) return;
  showDropdown(anchorEl, [
    { headerLabel: t('ed.toolHeader') },
    ...TEXT_TOOLS.map((id) => ({
      label: toolLabel(id),
      onClick: () => applyToolToEditor(id),
    })),
  ]);
}

/** Apply a transformation to the whole editor content (undoable, unsaved). */
function applyToolToEditor(toolId) {
  if (!current) return;
  const source = els.textarea.value;
  if (!source) { toast(t('ed.nothingToTransform'), { type: 'info' }); return; }
  const res = applyTextTool(toolId, source);
  if (!res.ok) { toastError(res.error); return; }
  if (res.result === source) { toast(t('ed.noChange'), { type: 'info' }); return; }
  els.textarea.focus();
  els.textarea.setSelectionRange(0, source.length);
  // insertText keeps the transformation on the native undo stack (Ctrl+Z)
  document.execCommand('insertText', false, res.result);
  markDirty();
  updateStats();
  autoDirection();
  toast(t('ed.transformed'));
}

async function togglePin() {
  if (!current) return;
  const entry = App.get(current.entry.id);
  if (!entry) return;
  entry.isPinned = !entry.isPinned;
  await App.saveEntry(entry);
  toast(entry.isPinned ? t('ed.pinToast') : t('ed.unpinToast'));
}

/* ================= open / close ================= */

export async function openEditor(entryId) {
  // flush any pending edits in the currently-open entry before switching
  if (current && current.dirty) await saveNow();

  let entry;
  let isNew = false;
  if (entryId) {
    const existing = App.get(entryId);
    if (!existing) return;
    entry = JSON.parse(JSON.stringify(existing)); // deep clone for editing
    App.touchOpened(entryId).catch(() => {});
  } else {
    entry = await createEntry({});
    isNew = true;
  }

  current = { entry, isNew, dirty: false, lastDupHash: entry.contentHash };

  // crash-safe draft restore
  const draft = readDraft(entry.id);
  if (draft && draft.ts > entry.updatedAt && isNew === false &&
      (draft.content !== entry.content || draft.title !== (entry.title || '') || JSON.stringify(draft.tags || []) !== JSON.stringify(entry.tags || []) || draft.dir !== entry.dir)) {
    entry.content = draft.content ?? entry.content;
    entry.title = draft.title ?? entry.title;
    entry.tags = Array.isArray(draft.tags) ? draft.tags : entry.tags;
    entry.dir = draft.dir || entry.dir;
    current.dirty = true;
    setTimeout(() => toast(t('ed.restoredSession'), { type: 'info', duration: 3600 }), 400);
  }
  if (isNew && draft && draft.ts > 0 && draft.content) {
    // A brand-new text was being written before a crash — bring it back.
    entry.content = draft.content;
    entry.title = draft.title || '';
    current.dirty = true;
    setTimeout(() => toast(t('ed.recoveredNew'), { type: 'info', duration: 3600 }), 400);
  }

  // fill UI
  els.title.value = entry.title || '';
  els.textarea.value = entry.content;
  // the value setter moves the caret to the END of the content — put it back
  // at the start so a document opens at its top, not scrolled to the bottom
  els.textarea.setSelectionRange(0, 0);
  els.textarea.scrollTop = 0;
  renderTags();
  syncDirButtons();
  applyDirection();
  syncFavButton();
  syncColorButton();
  hideTagSuggest();
  updateStats();
  updateCaretPos();
  applyEditorPrefs();
  setSaveState('saved');
  hideDupBanner();
  toggleFindbar(false);

  App.setView('editor');
  setTimeout(() => els.textarea.focus(), 50);
}

export async function closeEditor(skipSave = false) {
  if (!current) { App.setView('dashboard'); return; }
  if (!skipSave) await saveNow();
  clearDraft(current.entry.id);
  current = null;
  App.setView('dashboard');
  // focus restoration: the editor textarea is being hidden, so keyboard/SR
  // focus would otherwise fall to <body> — land it on the library view.
  const dash = document.getElementById('view-dashboard');
  if (dash) dash.focus({ preventScroll: true });
}

/* ================= saving ================= */

function markDirty() {
  if (!current) return;
  current.dirty = true;
  setSaveState('unsaved');
  window.tv.markDirty();
  clearTimeout(saveTimer);
  if (App.settings.autoSave) {
    saveTimer = setTimeout(() => saveNow(), App.settings.autoSaveDelay);
  }
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => writeDraft(current.entry), 250);
}

export async function saveNow() {
  clearTimeout(saveTimer);
  if (!current || !current.dirty) return;
  const { entry, isNew } = current;

  // persist clone into the real store
  let target = isNew ? null : App.get(entry.id);
  if (!target) {
    target = entry;
    App.entries.set(entry.id, entry);
  }
  await applyEdits(target, {
    title: els.title.value,
    content: els.textarea.value,
    tags: entry.tags,
    dir: entry.dir,
    color: entry.color,
  });
  current.isNew = false;
  current.dirty = false;

  try {
    await App.saveEntry(target);
    clearDraft(entry.id);
    setSaveState('saved');
    window.tv.notifyFlushed();
    checkDuplicate(target);
  } catch (err) {
    console.error(err);
    setSaveState('error');
    toastError(t('ed.autosaveFailed') + ' ' + (err.message || ''));
  }
}

function setSaveState(state) {
  els.saveState.className = 'editor-save-state' + (state === 'saving' ? ' saving' : state === 'unsaved' ? ' unsaved' : '');
  els.saveStateTxt.textContent = state === 'saving' ? t('ed.saveState.saving') : state === 'unsaved' ? t('ed.saveState.unsaved') : state === 'error' ? t('ed.saveState.error') : t('ed.saveState.saved');
}

/* ---- drafts (crash safety) ---- */

function draftKey(id) { return 'tv-draft-' + id; }
function readDraft(id) {
  try { return JSON.parse(localStorage.getItem(draftKey(id)) || 'null'); } catch { return null; }
}
function writeDraft(entry) {
  if (!current) return;
  try {
    localStorage.setItem(draftKey(entry.id), JSON.stringify({
      ts: Date.now(),
      title: els.title.value,
      content: els.textarea.value,
      tags: entry.tags,
      dir: entry.dir,
    }));
  } catch { /* storage full — ignore */ }
}
function clearDraft(id) { try { localStorage.removeItem(draftKey(id)); } catch { /* noop */ } }
function discardDraft() { if (current) clearDraft(current.entry.id); }

/* ---- duplicate detection ---- */

function checkDuplicate(target) {
  const dup = App.findDuplicate(target.id, target.contentHash);
  if (dup && target.contentHash !== current.lastDupHash) {
    showDupBanner(dup);
    current.lastDupHash = target.contentHash;
  } else if (!dup) {
    hideDupBanner();
  }
}

function showDupBanner(dup) {
  els.dupBanner.innerHTML = `
    ${icon('alert', 15)}
    <span>${t('ed.dupBanner')}</span>
    <button class="btn btn-ghost btn-sm" data-act="open">${t('ed.dupOpen')}</button>
    <button class="icon-btn icon-btn-sm db-close" data-act="close">${icon('x', 13)}</button>`;
  els.dupBanner.querySelector('b').textContent = App.titleOf(dup);
  els.dupBanner.querySelector('[data-act="open"]').addEventListener('click', () => {
    hideDupBanner();
    openEditor(dup.id);
  });
  els.dupBanner.querySelector('[data-act="close"]').addEventListener('click', hideDupBanner);
  els.dupBanner.classList.remove('hidden');
}
function hideDupBanner() { els.dupBanner.classList.add('hidden'); }

/* ================= tags ================= */

function addTag(raw) {
  if (!current) return;
  const tag = String(raw).trim().replace(/,+$/, '').replace(/\s+/g, ' ');
  if (!tag) return;
  if (!current.entry.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
    current.entry.tags.push(tag);
    renderTags();
    markDirty();
  }
  els.tagInput.value = '';
}

/* ---- existing-tags picker ---- */

function hideTagSuggest() {
  els.tagSuggest.classList.add('hidden');
  els.tagSuggest.innerHTML = '';
}

function renderTagSuggest() {
  if (!current) return;
  const typed = els.tagInput.value.trim().toLowerCase();
  const have = new Set(current.entry.tags.map((t) => t.toLowerCase()));
  const candidates = App.tagCounts()
    .filter(([tag]) => !have.has(tag.toLowerCase()))
    .filter(([tag]) => !typed || tag.toLowerCase().includes(typed))
    .slice(0, 40);
  els.tagSuggest.innerHTML = '';
  if (!candidates.length) {
    els.tagSuggest.innerHTML = `<span class="ts-empty">${t('ed.noOtherTags')}</span>`;
  } else {
    for (const [tag, count] of candidates) {
      const chip = document.createElement('button');
      chip.className = 'ts-chip';
      chip.dataset.tag = tag;
      chip.innerHTML = `<span></span><span class="ts-count"></span>`;
      chip.firstChild.textContent = tag;
      chip.querySelector('.ts-count').textContent = String(count);
      chip.title = t('ed.tagAddTip', { tag });
      els.tagSuggest.appendChild(chip);
    }
  }
  els.tagSuggest.classList.remove('hidden');
}

/* ---- card color ---- */

function setColor(color) {
  if (!current) return;
  current.entry.color = color || null;
  syncColorButton();
  markDirty();
}

function syncColorButton() {
  if (!current) return;
  const c = current.entry.color;
  els.btnColor.innerHTML = icon('droplet', 17) + (c ? '<span class="color-dot"></span>' : '');
  els.btnColor.classList.toggle('color-on', !!c);
  els.btnColor.style.setProperty('--card-accent', c ? `var(--card-${c})` : '');
  els.btnColor.title = c ? t('ed.colorFor', { color: t('color.' + c) }) : t('ed.color');
}

function renderTags() {
  if (!current) return;
  els.tagsWrap.innerHTML = '';
  for (const tag of current.entry.tags) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.innerHTML = `<span class="chip-text"></span><button class="chip-x" title="${t('ed.removeTag')}">${icon('x', 11)}</button>`;
    chip.querySelector('.chip-text').textContent = tag;
    chip.querySelector('.chip-x').addEventListener('click', () => {
      current.entry.tags = current.entry.tags.filter((t) => t !== tag);
      renderTags();
      markDirty();
    });
    els.tagsWrap.appendChild(chip);
  }
}

/* ================= direction ================= */

function syncDirButtons() {
  els.dirSeg.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', current && b.dataset.dir === current.entry.dir);
  });
}

function syncFavButton() {
  if (!current) return;
  const fav = !!(App.get(current.entry.id)?.favorite);
  els.btnFav.classList.toggle('fav-on', fav);
  els.btnFav.innerHTML = icon(fav ? 'star-filled' : 'star', 17);
}

function applyDirection() {
  if (!current) return;
  let effective = current.entry.dir;
  if (effective === 'auto') effective = detectBaseDir(els.textarea.value || current.entry.content);
  els.textarea.dir = effective;
  els.title.dir = 'auto';
  els.statDir.textContent = current.entry.dir === 'auto' ? `${t('ed.dirAuto')} (${effective.toUpperCase()})` : effective.toUpperCase();
}

function autoDirection() {
  // in Auto mode keep the textarea base direction in sync with first strong char
  if (current && current.entry.dir === 'auto') applyDirection();
}

/* ================= preferences ================= */

export function applyEditorPrefs() {
  els.textarea.style.fontSize = App.settings.editorFontSize + 'px';
  els.textarea.classList.toggle('mono', App.settings.editorFont === 'mono');
  els.textarea.classList.toggle('nowrap', !App.settings.editorWrap);
  els.toggleWrap.textContent = App.settings.editorWrap ? t('ed.wrapOn') : t('ed.wrapOff');
  els.toggleFont.textContent = App.settings.editorFont === 'mono' ? t('ed.mono') : t('ed.sans');
  // Typography changed under an active search → re-align the highlight layer.
  if (els.area.classList.contains('find-active')) {
    syncMirrorGeometry();
    renderFindMarks();
    if (findState) scrollCurrentIntoView();
  }
}

/* ================= stats ================= */

function updateStats() {
  const value = els.textarea.value;
  const chars = [...value].length;
  const words = (value.match(/[\p{L}\p{N}\p{P}\p{S}]+/gu) || []).length;
  const lines = value === '' ? 0 : value.replace(/\r\n?/g, '\n').split('\n').length;
  els.statChars.textContent = `${formatNumber(chars)} ${t('chars')}`;
  els.statWords.textContent = `${formatNumber(words)} ${t('ed.words')}`;
  els.statLines.textContent = `${formatNumber(lines)} ${t('lines')}`;
}

function updateCaretPos() {
  const pos = els.textarea.selectionStart;
  const upto = els.textarea.value.slice(0, pos);
  const lines = upto.split('\n');
  els.statPos.textContent = `${t('ed.ln', { n: lines.length })}, ${t('ed.col', { n: lines[lines.length - 1].length + 1 })}`;
}

/* ================= copy ================= */

async function copyAll() {
  if (!current) return;
  const text = els.textarea.value;
  if (!text) { toast(t('ed.nothingToCopy'), { type: 'info' }); return; }
  try {
    await window.tv.clipboardWrite(text);
    toast(t('clip.copied'));
  } catch {
    toastError(t('ed.copyFailed'));
  }
}

/* ================= find & replace ================= */
//
// Architecture: the textarea keeps the real content — search never mutates
// it, marks the document dirty, or touches undo history. While a search is
// active, an overlay layer (.editor-mirror) paints the same text with
// translucent <mark> highlights ABOVE the textarea; the overlay's own glyphs
// are transparent (CSS), so only highlight backgrounds draw and the real
// text/caret stay fully visible underneath. The current match is additionally
// selected via setSelectionRange — a real selection that replace operates on
// and that survives closing the findbar — and the view scrolls to it using
// the overlay's geometry.

const MIRROR_TEXT_STYLES = [
  'fontFamily', 'fontKerning', 'fontSize', 'fontStyle', 'fontWeight',
  'letterSpacing', 'wordSpacing', 'lineHeight', 'textIndent', 'textTransform',
  'tabSize', 'textAlign', 'direction', 'unicodeBidi',
  'whiteSpace', 'overflowWrap', 'wordBreak', 'boxSizing',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
];

function findActive() {
  return !els.findbar.classList.contains('hidden') && !!els.findInput.value;
}

function setFindActive(on) {
  const active = els.area.classList.toggle('find-active', on);
  if (active) syncMirrorGeometry();
  else { els.mirror.innerHTML = ''; renderedIndices = null; }
}

/** Copy the textarea's text metrics onto the mirror so both wrap identically.
 *  The textarea owns the scrollbars, so the mirror absorbs the vertical
 *  scrollbar's width into the padding of the side it occupies (left in RTL). */
function syncMirrorGeometry() {
  const cs = getComputedStyle(els.textarea);
  for (const prop of MIRROR_TEXT_STYLES) els.mirror.style[prop] = cs[prop];
  els.mirror.style.paddingLeft = cs.paddingLeft;
  els.mirror.style.paddingRight = cs.paddingRight;
  const sbV = els.textarea.offsetWidth - els.textarea.clientWidth;
  if (sbV > 0) {
    const padSide = cs.direction === 'rtl' ? 'paddingLeft' : 'paddingRight';
    els.mirror.style[padSide] = `${parseFloat(cs[padSide]) + sbV}px`;
  }
  syncMirrorScroll();
}

function syncMirrorScroll() {
  if (!els.area.classList.contains('find-active')) return;
  els.mirror.scrollTop = els.textarea.scrollTop;
  els.mirror.scrollLeft = els.textarea.scrollLeft;
}

/** The mirror reflects exactly this indices array (navigation only moves the
 *  active mark, so the class is shifted instead of rebuilding the layer). */
let renderedIndices = null;

/** Re-render the highlight layer. Text is always escaped; matches become
 *  <mark>, the active one <mark class="cur">. */
function renderFindMarks() {
  if (!findActive()) { els.mirror.innerHTML = ''; renderedIndices = null; return; }
  const value = els.textarea.value;
  const len = Math.max(els.findInput.value.length, 1);
  const indices = findState ? findState.indices : [];
  let html = '';
  let pos = 0;
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    if (start > pos) html += escapeHtml(value.slice(pos, start));
    html += `<mark${i === findState.idx ? ' class="cur"' : ''}>${escapeHtml(value.slice(start, start + len))}</mark>`;
    pos = start + len;
  }
  if (pos < value.length) html += escapeHtml(value.slice(pos));
  els.mirror.innerHTML = html + '\n';
  renderedIndices = findState ? findState.indices : null;
  syncMirrorScroll();
}

/** Switch the active mark after a navigation without a full re-render. */
function syncCurrentMark() {
  if (!findState || renderedIndices !== findState.indices) { renderFindMarks(); return; }
  const prev = els.mirror.querySelector('mark.cur');
  if (prev) prev.classList.remove('cur');
  const cur = els.mirror.querySelectorAll('mark')[findState.idx];
  if (cur) cur.classList.add('cur');
}

/** Editor text changed while a search is live: recompute quietly — no
 *  selection change, no scrolling — so typing is never disturbed. */
let findSyncTimer = null;
function scheduleFindSync() {
  if (!findState || els.findbar.classList.contains('hidden')) return;
  clearTimeout(findSyncTimer);
  findSyncTimer = setTimeout(() => {
    findSyncTimer = null;
    if (!findState) return;
    findState.indices = findMatches();
    if (findState.idx >= findState.indices.length) findState.idx = Math.max(0, findState.indices.length - 1);
    syncMirrorGeometry();
    renderFindMarks();
    updateFindCount();
  }, 120);
}

function toggleFindbar(show) {
  els.findbar.classList.toggle('hidden', !show);
  if (show) {
    els.findInput.focus();
    els.findInput.select();
    if (els.findInput.value) runFind(true);
    else { setFindActive(false); updateFindCount(); }
  } else {
    if (findSyncTimer) { clearTimeout(findSyncTimer); findSyncTimer = null; }
    findState = null;
    setFindActive(false);
    updateFindCount();
    // Focus returns to the editor at the caret — the current location stays.
    els.textarea.focus();
  }
}

export function openFindbar() { toggleFindbar(true); }
export function openReplacebar() { toggleFindbar(true); setTimeout(() => els.replaceInput.focus(), 30); }

function findMatches() {
  const needle = els.findInput.value;
  if (!needle) return [];
  const caseSensitive = els.findCase.classList.contains('active');
  const hay = caseSensitive ? els.textarea.value : els.textarea.value.toLowerCase();
  const nd = caseSensitive ? needle : needle.toLowerCase();
  const indices = [];
  let i = hay.indexOf(nd);
  while (i !== -1 && indices.length < 5000) {
    indices.push(i);
    i = hay.indexOf(nd, i + Math.max(nd.length, 1));
  }
  return indices;
}

function runFind(keepCurrent = false) {
  if (els.findbar.classList.contains('hidden')) return; // never activate from a hidden bar
  if (!els.findInput.value) {
    findState = null;
    setFindActive(false);
    updateFindCount();
    return;
  }
  const indices = findMatches();
  const prevIdx = keepCurrent && findState ? findState.idx : 0;
  findState = { indices, idx: indices.length ? Math.min(prevIdx, indices.length - 1) : 0 };
  setFindActive(true);
  if (indices.length) highlightCurrent(true);
  else { renderFindMarks(); updateFindCount(); }
}

function updateFindCount() {
  const query = els.findInput.value;
  const total = findState ? findState.indices.length : 0;
  const at = findState && total ? findState.idx + 1 : 0;
  els.findCount.textContent = t('ed.findCount', { a: formatNumber(at), b: formatNumber(total) });
  els.findCount.classList.toggle('none', !!query && !total);
}

/** Select the current match as a real selection and bring it into view.
 *  Focus is NOT stolen from the find input. */
function highlightCurrent(scroll = true) {
  if (!findState || !findState.indices.length) return;
  const start = findState.indices[findState.idx];
  const len = els.findInput.value.length;
  els.textarea.setSelectionRange(start, start + len);
  syncCurrentMark();
  updateFindCount();
  if (scroll) scrollCurrentIntoView();
}

/** Scroll the editor so the active match is visible (centered when far). */
function scrollCurrentIntoView() {
  const mark = els.mirror.querySelector('mark.cur');
  if (!mark) return;
  const ta = els.textarea;
  const top = mark.offsetTop;
  const bottom = top + mark.offsetHeight;
  if (top < ta.scrollTop + 8 || bottom > ta.scrollTop + ta.clientHeight - 8) {
    ta.scrollTop = Math.max(0, top - ta.clientHeight / 2 + mark.offsetHeight / 2);
    syncMirrorScroll();
  }
}

function gotoMatch(delta) {
  if (!findState) { runFind(); if (!findState) return; }
  const n = findState.indices.length;
  if (!n) return; // zero matches — modulo would corrupt idx with NaN
  findState.idx = (findState.idx + delta + n) % n;
  highlightCurrent();
}

function replaceCurrent() {
  if (!findState) { runFind(); if (!findState) return; }
  const replacement = els.replaceInput.value;
  const start = findState.indices[findState.idx];
  const len = els.findInput.value.length;
  els.textarea.focus();
  els.textarea.setSelectionRange(start, start + len);
  document.execCommand('insertText', false, replacement); // stays on the native undo stack
  markDirty();
  updateStats();
  autoDirection();
  runFind();
  if (findState) highlightCurrent();
}

function replaceAllMatches() {
  if (!findState) { runFind(); if (!findState) return; }
  const replacement = els.replaceInput.value;
  // Replace from the end so earlier indices stay valid.
  const indices = [...findState.indices].reverse();
  els.textarea.focus();
  for (const start of indices) {
    const len = els.findInput.value.length;
    els.textarea.setSelectionRange(start, start + len);
    document.execCommand('insertText', false, replacement);
  }
  markDirty();
  updateStats();
  autoDirection();
  const count = indices.length;
  runFind();
  toast(t('ed.replacedCount', { n: formatNumber(count), matches: t(count === 1 ? 'match' : 'matches') }));
}

export function isActive() { return current !== null; }
export function handleEscape() {
  if (!els.findbar.classList.contains('hidden')) { toggleFindbar(false); return true; }
  return false;
}
