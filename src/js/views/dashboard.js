// Dashboard: quick capture, search, sort/filter, virtual card grid, bulk actions.
import { App } from '../state.js';
import { VirtualGrid } from '../ui/virtual-grid.js';
import { icon, emptyArt } from '../ui/icons.js';
import { toast, toastError, confirmDialog, showDropdown, timeAgo, formatNumber } from '../ui/components.js';
import { parseQuery, quickFilter, searchEntry } from '../search/search.js';
import { escapeHtml } from '../../../shared/snippets.mjs';
import { t, itemsKey } from '../../../shared/i18n.mjs';

const els = {};
let grid = null;
let searchToken = 0;
let currentRows = []; // entries currently displayed (post filter/sort)
let searchProgressEl = null;

export function initDashboard() {
  els.view = document.getElementById('view-dashboard');
  els.gridViewport = document.getElementById('card-grid');
  els.gridInner = document.getElementById('grid-inner');
  els.empty = document.getElementById('dashboard-empty');
  els.searchInput = document.getElementById('search-input');
  els.searchClear = document.getElementById('search-clear');
  els.sortSelect = document.getElementById('sort-select');
  els.count = document.getElementById('entries-count');
  els.qcInput = document.getElementById('qc-input');
  els.qcSave = document.getElementById('qc-save');
  els.qcPaste = document.getElementById('qc-paste');
  els.bulkbar = document.getElementById('bulkbar');
  els.selToolbar = document.getElementById('selection-toolbar');
  els.selCount = document.getElementById('sel-count');
  els.selAll = document.getElementById('sel-all');
  els.selClear = document.getElementById('sel-clear');
  els.selCancel = document.getElementById('sel-cancel');
  els.btnSelectMode = document.getElementById('btn-select-mode');

  grid = new VirtualGrid(els.gridViewport, els.gridInner, {
    minCardWidth: 292,
    gap: 16,
    rowHeight: 148,
    renderItem: renderCard,
  });

  /* ---- search ---- */
  let debounce = null;
  els.searchInput.addEventListener('input', () => {
    els.searchClear.classList.toggle('hidden', !els.searchInput.value);
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      App.query = els.searchInput.value;
      refresh();
    }, 160);
  });
  els.searchClear.addEventListener('click', () => {
    els.searchInput.value = '';
    App.query = '';
    els.searchClear.classList.add('hidden');
    refresh();
  });

  /* ---- sort ---- */
  els.sortSelect.value = App.settings.sort;
  els.sortSelect.addEventListener('change', () => {
    App.settings.sort = els.sortSelect.value;
    App.persistSettings();
    refresh();
  });

  /* ---- quick capture ---- */
  els.qcSave.addEventListener('click', saveQuickCapture);
  els.qcInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      saveQuickCapture();
    }
  });
  els.qcInput.addEventListener('paste', () => {
    // auto-grow on paste
    setTimeout(autoGrowQc, 0);
  });
  els.qcInput.addEventListener('input', autoGrowQc);
  els.qcPaste.addEventListener('click', async () => {
    try {
      const text = await window.tv.clipboardRead();
      if (!text) { toast(t('qc.clipboardEmpty'), { type: 'info' }); return; }
      els.qcInput.value = text;
      autoGrowQc();
      els.qcInput.focus();
    } catch {
      toastError(t('qc.clipboardError'));
    }
  });

  /* ---- selection mode ---- */
  els.btnSelectMode.innerHTML = icon('check-square');
  els.btnSelectMode.title = t('select.mode');
  els.btnSelectMode.addEventListener('click', () => setSelectionMode(!App.selectionMode));
  els.selAll.addEventListener('click', selectAll);
  els.selClear.addEventListener('click', () => { App.selection.clear(); refresh(); });
  els.selCancel.addEventListener('click', () => setSelectionMode(false));

  /* ---- bulk actions ---- */
  els.bulkbar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-bulk]');
    if (!btn) return;
    handleBulk(btn.getAttribute('data-bulk'), btn);
  });

  App.on('entries-changed', refresh);
}

function autoGrowQc() {
  const ta = els.qcInput;
  ta.style.height = 'auto';
  ta.style.height = Math.min(120, ta.scrollHeight) + 'px';
}

async function saveQuickCapture() {
  const content = els.qcInput.value;
  if (!content.trim()) {
    toast(t('qc.empty'), { type: 'info' });
    return;
  }
  try {
    const entry = await App.createNew({ content });
    els.qcInput.value = '';
    autoGrowQc();
    toast(t('qc.saved'), {
      type: 'ok',
      duration: 3200,
      action: { label: t('qc.open'), onClick: () => App.openEditor(entry.id) },
    });
  } catch (err) {
    console.error(err);
    toastError(t('dash.saveFailed') + ': ' + (err.message || t('settings.unknownError')));
  }
}

/* ================= selection mode ================= */

export function setSelectionMode(on) {
  App.selectionMode = !!on;
  App.selection.clear(); // entering starts fresh; leaving clears
  els.selToolbar.classList.toggle('hidden', !on);
  els.btnSelectMode.classList.toggle('active', on);
  els.gridViewport.classList.toggle('selection-mode', on);
  refresh();
}

export function selectAll() {
  App.selection.clear();
  for (const e of currentRows) App.selection.add(e.id);
  refresh();
}

function toggleCardSelection(id) {
  if (App.selection.has(id)) App.selection.delete(id);
  else App.selection.add(id);
  refreshBulkbar();
}

/* ================= filters & sorting ================= */

function sortedLive() {
  const sort = App.settings.sort;
  const arr = App.liveEntries();
  const byTitle = (a, b) => App.titleOf(a).localeCompare(App.titleOf(b), undefined, { sensitivity: 'base', numeric: true });
  const comparators = {
    'modified-desc': (a, b) => b.updatedAt - a.updatedAt,
    'created-desc': (a, b) => b.createdAt - a.createdAt,
    'created-asc': (a, b) => a.createdAt - b.createdAt,
    'used-desc': (a, b) => (b.openedAt || 0) - (a.openedAt || 0),
    'title-asc': (a, b) => byTitle(a, b),
    'title-desc': (a, b) => byTitle(b, a),
  };
  arr.sort(comparators[sort] || comparators['modified-desc']);
  // favorites float to the top within the chosen order, pins above favorites
  arr.sort((a, b) => Number(b.favorite) - Number(a.favorite));
  arr.sort((a, b) => Number(!!b.isPinned) - Number(!!a.isPinned));
  return arr;
}

function navFilter(entry) {
  const nav = App.nav;
  if (nav === 'favorites') return entry.favorite;
  if (nav === 'recent') return !!entry.openedAt;
  if (nav.startsWith('tag:')) {
    const tag = nav.slice(4).toLowerCase();
    return (entry.tags || []).some((t) => t.toLowerCase() === tag);
  }
  return true;
}

/* ================= refresh ================= */

export function refresh() {
  if (!grid) return;
  const token = ++searchToken;
  const q = parseQuery(App.query);

  // Instant pass: metadata filters only (title/tags/preview/fav/nav/sort)
  const pool = sortedLive().filter(navFilter);
  currentRows = q.empty ? pool : pool.filter((e) => quickFilter(e, q));
  paint(token);

  // Deep pass: full-content search over the whole pool, chunked to keep UI responsive
  if (!q.empty && q.terms.length) {
    showSearchProgress();
    const results = [];
    let i = 0;
    const step = () => {
      if (token !== searchToken) return; // superseded
      const t0 = performance.now();
      while (i < pool.length && performance.now() - t0 < 12) {
        const hit = searchEntry(pool[i], q);
        if (hit) results.push(hit);
        i++;
      }
      if (i < pool.length) {
        setTimeout(step, 0);
      } else {
        hideSearchProgress();
        results.sort((a, b) => (b.score - a.score) || (b.entry.updatedAt - a.entry.updatedAt));
        currentRows = results.map((r) => r.entry);
        currentSnippets = new Map(results.map((r) => [r.entry.id, r]));
        paint(token);
      }
    };
    step();
  } else {
    currentSnippets = null;
    hideSearchProgress();
  }
}

let currentSnippets = null;

function showSearchProgress() {
  let el = document.getElementById('search-progress');
  if (!el) {
    el = document.createElement('div');
    el.className = 'search-progress';
    el.id = 'search-progress';
    el.innerHTML = `<div class="spinner"></div><span>${t('search.progress')}</span>`;
    els.gridViewport.appendChild(el);
  }
  el.classList.remove('hidden');
}
function hideSearchProgress() {
  document.getElementById('search-progress')?.classList.add('hidden');
}

function paint(token) {
  if (token !== searchToken) return;

  // count label
  const total = App.liveEntries().length;
  if (App.query) {
    els.count.textContent = t('dash.ofTotal', { a: formatNumber(currentRows.length), b: formatNumber(total) });
  } else {
    els.count.textContent = `${formatNumber(total)} ${t(total === 1 ? 'text' : 'texts')}`;
  }

  // empty state
  if (currentRows.length === 0) {
    els.gridInner.style.height = '0px';
    grid.setData([]);
    showEmpty();
  } else {
    hideEmpty();
    grid.setData(currentRows);
  }
  refreshBulkbar();
}

function showEmpty() {
  const q = App.query;
  els.empty.innerHTML = `
    <div class="empty-art">${emptyArt(q ? 'search' : 'inbox')}</div>
    <h3>${q ? t('empty.results') : (App.nav === 'favorites' ? t('empty.favorites') : t('empty.vault'))}</h3>
    <p>${q
      ? t('empty.results.body')
      : (App.nav === 'favorites'
        ? t('empty.favorites.body')
        : t('empty.vault.body'))}</p>
    <div class="empty-actions">
      ${q ? `<button class="btn btn-ghost" data-empty="clear">${t('empty.clearSearch')}</button>` : ''}
      <button class="btn btn-accent" data-empty="new">${icon('plus', 15)} ${t('new.text')}</button>
    </div>`;
  els.empty.classList.remove('hidden');
  els.empty.querySelectorAll('[data-empty]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const act = btn.getAttribute('data-empty');
      if (act === 'clear') {
        els.searchInput.value = '';
        App.query = '';
        els.searchClear.classList.add('hidden');
        refresh();
      } else if (act === 'new') {
        App.openEditor(null);
      }
    });
  });
}
function hideEmpty() { els.empty.classList.add('hidden'); }

/* ================= cards ================= */

function renderCard(el, entry) {
  const title = App.titleOf(entry);
  const snippet = currentSnippets?.get(entry.id);
  const previewHtml = snippet?.snippet
    ? `${escapeHtml(snippet.snippet.before)}<mark>${escapeHtml(snippet.snippet.match)}</mark>${escapeHtml(snippet.snippet.after)}`
    : escapeHtml(entry.preview || '');
  const selected = App.selection.has(entry.id);

  el.className = 'card' + (selected ? ' selected' : '');
  el.dataset.id = entry.id;
  // Cards are divs styled as cards (buttons would nest invalid interactive
  // children) — give them the button semantics so keyboard/SR users can open,
  // favorite or trash entries. el.onclick/onkeydown property assignments are
  // recycle-safe by design (see the card click comment below).
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', title || t('exp.untitled'));
  // set AND clear: recycled elements must never keep the previous card's color
  if (entry.color) el.dataset.color = entry.color;
  else el.removeAttribute('data-color');
  el.innerHTML = `
    <button class="card-check" title="${t('aria.selectCard')}" aria-label="${t('aria.selectCard')}" aria-pressed="${selected}"></button>
    <div class="card-actions">
      <button class="card-star ${entry.favorite ? 'fav-on' : ''}" title="${entry.favorite ? t('unfavorite') : t('favorite')}" aria-label="${entry.favorite ? t('unfavorite') : t('favorite')}">${icon(entry.favorite ? 'star-filled' : 'star', 15)}</button>
      <button class="card-trash" title="${t('dash.moveToTrash')}" aria-label="${t('dash.moveToTrash')}">${icon('trash', 15)}</button>
    </div>
    <div class="card-top">
      <div class="card-title"><span class="t"></span></div>
      ${entry.isPinned ? `<span class="card-pin" title="${t('pin')}">${icon('pin', 13)}</span>` : ''}
    </div>
    <div class="card-preview"></div>
    <div class="card-meta">
      <span class="m-date">${timeAgo(entry.updatedAt)}</span>
      <span class="meta-dot"></span>
      <span>${formatNumber(entry.stats?.chars ?? 0)} ${t('chars')}</span>
      <span class="meta-dot"></span>
      <span>${formatNumber(entry.stats?.lines ?? 0)} ${t('lines')}</span>
      <span class="card-tags"></span>
    </div>`;
  el.querySelector('.card-title .t').textContent = title;
  el.querySelector('.card-preview').innerHTML = previewHtml;

  const tagsWrap = el.querySelector('.card-tags');
  const tags = entry.tags || [];
  tags.slice(0, 3).forEach((t) => {
    const chip = document.createElement('span');
    chip.className = 'card-tag';
    chip.textContent = t;
    tagsWrap.appendChild(chip);
  });
  if (tags.length > 3) {
    const more = document.createElement('span');
    more.className = 'card-tag';
    more.textContent = `+${tags.length - 3}`;
    tagsWrap.appendChild(more);
  }

  // star toggle — favorite only, never selects/opens the card
  el.querySelector('.card-star').addEventListener('click', (e) => {
    e.stopPropagation();
    App.toggleFavorite(entry.id);
  });
  // trash — confirmation, never selects/opens the card
  el.querySelector('.card-trash').addEventListener('click', async (e) => {
    e.stopPropagation();
    const ok = await confirmDialog({
      title: t('del.card.title'),
      message: t('del.card.body'),
      messageValues: [title],
      confirmText: t('dash.moveToTrash'),
      cancelText: t('cancel'),
      danger: true,
    });
    if (!ok) return;
    await App.moveToTrash(entry.id);
    toast(t('del.movedOne'), {
      type: 'info',
      duration: 4000,
      action: { label: t('clip.undo'), onClick: () => App.restoreEntry(entry.id).then(() => toast(t('clip.restored'))) },
    });
  });
  // legacy checkbox: enters selection mode and toggles this card
  el.querySelector('.card-check').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!App.selectionMode) setSelectionMode(true);
    toggleCardSelection(entry.id);
    el.classList.toggle('selected', App.selection.has(entry.id));
    e.currentTarget.setAttribute('aria-pressed', App.selection.has(entry.id));
    els.selCount.textContent = `${App.selection.size} ${t('selected')}`;
  });
  // card click: select in selection mode, open otherwise.
  // Uses onclick (not addEventListener) because the virtual grid recycles
  // card elements — a fresh property assignment can never stack listeners.
  el.onclick = () => {
    if (App.selectionMode) {
      toggleCardSelection(entry.id);
      el.classList.toggle('selected', App.selection.has(entry.id));
      el.setAttribute('aria-pressed', App.selection.has(entry.id));
      els.selCount.textContent = `${App.selection.size} ${t('selected')}`;
    } else {
      App.openEditor(entry.id);
    }
  };
  // keyboard activation mirrors the click (Enter/Space on a role=button)
  el.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
  };
}

/* ================= bulk bar ================= */

function refreshBulkbar() {
  const n = App.selection.size;
  const show = n > 0 || App.selectionMode;
  els.bulkbar.classList.toggle('hidden', !show);
  els.selCount.textContent = `${n} ${t('selected')}`;
  if (!show) return;
  els.bulkbar.innerHTML = `
    <span class="bulk-count">${n} ${t('selected')}</span>
    <button class="btn btn-ghost btn-sm" data-bulk="export" ${n ? '' : 'disabled'}>${icon('download', 14)} ${t('dash.exportBulk')}</button>
    <button class="btn btn-ghost btn-sm" data-bulk="fav" ${n ? '' : 'disabled'}>${icon('star', 14)} ${t('favorite')}</button>
    <button class="btn btn-ghost-danger btn-sm" data-bulk="delete" ${n ? '' : 'disabled'}>${icon('trash', 14)} ${t('delete')}</button>
    <button class="icon-btn icon-btn-sm" data-bulk="clear" title="${t('select.clear')}">${icon('x', 14)}</button>`;
}

async function handleBulk(act, anchorBtn) {
  if (act === 'clear') {
    App.selection.clear();
    refresh();
    return;
  }
  const ids = [...App.selection];
  if (!ids.length) return;
  if (act === 'fav') {
    for (const id of ids) {
      const e = App.get(id);
      if (e && !e.favorite) await App.toggleFavorite(id);
    }
    toast(t('dash.addedFavs', { n: ids.length }));
    return;
  }
  if (act === 'delete') {
    const ok = await confirmDialog({
      title: t('del.many.title', { n: ids.length, items: t(itemsKey(ids.length)) }),
      message: t('del.many.body'),
      confirmText: t('del.confirm'),
      danger: true,
    });
    if (!ok) return;
    for (const id of ids) await App.moveToTrash(id);
    App.selection.clear();
    refresh();
    toast(t('del.moved', { n: ids.length }), {
      type: 'info',
      duration: 6000,
      action: {
        label: t('clip.undo'),
        onClick: async () => {
          for (const id of ids) await App.restoreEntry(id);
          toast(t('clip.restored'));
        },
      },
    });
    return;
  }
  if (act === 'export') {
    const entries = ids.map((id) => App.get(id)).filter(Boolean);
    App.showExportMenu(entries, anchorBtn);
  }
}

/** Exposed so other views can reuse card click → editor */
export function focusSearch() {
  els.searchInput.focus();
  els.searchInput.select();
}

export function clearSearchIfPresent() {
  if (els.searchInput.value) {
    els.searchInput.value = '';
    App.query = '';
    els.searchClear.classList.add('hidden');
    refresh();
  }
}

/** Show skeleton cards while the DB loads. */
export function showSkeletons() {
  els.gridInner.style.height = `${5 * 164}px`;
  for (let i = 0; i < 8; i++) {
    const el = document.createElement('div');
    el.className = 'card skeleton';
    el.innerHTML = `<div class="sk" style="width:55%;height:16px;margin-bottom:10px"></div>
      <div class="sk" style="width:92%;height:12px;margin-bottom:6px"></div>
      <div class="sk" style="width:70%;height:12px;margin-bottom:14px"></div>
      <div class="sk" style="width:40%;height:10px"></div>`;
    const col = i % 3, row = Math.floor(i / 3);
    el.style.width = '292px'; el.style.height = '148px';
    el.style.transform = `translate(${col * 308}px, ${row * 164}px)`;
    els.gridInner.appendChild(el);
  }
}

export function clearSkeletons() {
  els.gridInner.innerHTML = '';
  els.gridInner.style.height = '0px';
}
