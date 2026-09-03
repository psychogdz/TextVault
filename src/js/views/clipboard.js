// Clipboard history view: status, search, rows with copy/pin/favorite/delete.
// Domain logic lives in core/clipboard.js; this module only renders and
// forwards user actions (ARCHITECTURE.md §7 — renderer responsibilities).

import { App } from '../state.js';
import {
  clipboardItems, clipboardCount, getMonitorState, setPaused,
  copyClipboardItem, toggleClipboardPin, toggleClipboardFavorite,
  deleteClipboardItem, restoreClipboardItem, clearClipboardHistory,
} from '../core/clipboard.js';
import { icon, emptyArt } from '../ui/icons.js';
import { toast, confirmDialog, timeAgo, formatNumber } from '../ui/components.js';
import { escapeHtml } from '../../../shared/snippets.mjs';
import { detectContentType } from '../../../shared/detect.mjs';
import { parseQuery, matchClipboardItem } from '../../../shared/query.mjs';
import { t, itemsKey } from '../../../shared/i18n.mjs';
import { collectionList } from '../core/snippets.js';

const els = {};
let query = '';
let listToken = 0;

export function initClipboardView() {
  els.view = document.getElementById('view-clipboard');
  els.status = document.getElementById('clip-status');
  els.statusText = document.querySelector('#clip-status .clip-status-text');
  els.pauseBtn = document.getElementById('clip-pause');
  els.clearBtn = document.getElementById('clip-clear');
  els.list = document.getElementById('clip-list');
  els.empty = document.getElementById('clipboard-empty');
  els.search = document.getElementById('clip-search-input');

  els.pauseBtn.addEventListener('click', async () => {
    const st = getMonitorState();
    const next = !(st.paused || !st.enabled);
    if (!st.enabled) {
      toast(t('set.clip.monitor') + ' — ' + t('nav.settings'), { type: 'info' });
      return;
    }
    await setPaused(!st.paused);
    toast(st.paused ? t('clip.monitoring.active') : t('clip.monitoring.paused'), { type: 'info' });
    void next;
  });

  els.clearBtn.addEventListener('click', async () => {
    const n = clipboardCount();
    if (!n) return;
    const ok = await confirmDialog({
      title: t('clip.clear.title'),
      message: t('clip.clear.body', { n: formatNumber(n), items: itemsKey(n) }),
      confirmText: t('clip.clear'),
      danger: true,
    });
    if (!ok) return;
    await clearClipboardHistory();
    toast(t('clip.cleared'));
  });

  els.search.addEventListener('input', () => {
    query = els.search.value;
    refresh();
  });

  App.on('clipboard-changed', () => { if (App.view === 'clipboard') refresh(); });
  App.on('clipboard-state', () => { if (App.view === 'clipboard') refreshStatus(); });
}

function refreshStatus() {
  const st = getMonitorState();
  els.status.dataset.state = !st.enabled ? 'off' : st.paused ? 'paused' : 'active';
  els.statusText.textContent = !st.enabled
    ? t('clip.monitoring.off')
    : st.paused ? t('clip.monitoring.paused') : t('clip.monitoring.active');
  els.pauseBtn.textContent = st.paused ? t('clip.resume') : t('clip.pause');
}


function collectionNameMap() {
  return new Map(collectionList().map((c) => [c.id, c.name]));
}

export function refresh() {
  if (!els.list) return;
  refreshStatus();
  const token = ++listToken;
  const q = parseQuery(query);
  const idToName = collectionNameMap();

  const pinned = [];
  const rest = [];
  for (const it of clipboardItems()) {
    if (!matchClipboardItem(it, q, idToName, detectContentType)) continue;
    (it.isPinned ? pinned : rest).push(it);
  }
  const rows = [...pinned, ...rest];

  els.list.innerHTML = '';
  if (!rows.length) {
    els.list.style.display = 'none';
    const q = query.trim();
    els.empty.innerHTML = `
      <div class="empty-art">${emptyArt(q ? 'search' : 'clipboard')}</div>
      <h3>${q ? t('clip.noMatches') : t('clip.empty')}</h3>
      <p>${q
        ? t('clip.tryDifferent')
        : t('clip.empty.body')}</p>`;
    els.empty.classList.remove('hidden');
    return;
  }
  els.empty.classList.add('hidden');
  els.list.style.display = '';

  for (const it of rows) {
    els.list.appendChild(renderRow(it));
  }
  void token;
}

function renderRow(item) {
  const row = document.createElement('div');
  row.className = 'clip-row';
  row.dataset.id = item.id;
  if (item.isSensitive) row.dataset.sensitive = '1';

  const masked = item.isSensitive && !row.dataset.revealed;
  const preview = masked
    ? `<span class="clip-masked">${escapeHtml(t('clip.masked'))}</span>`
    : escapeHtml(item.preview || '');
  const type = item.contentType && item.contentType !== 'text'
    ? item.contentType : detectContentType(item.content || '');

  row.innerHTML = `
    <div class="clip-flags">
      ${item.isPinned ? `<span class="clip-flag" title="Pinned">${icon('pin', 13)}</span>` : ''}
      ${item.isFavorite ? `<span class="clip-flag fav" title="Favorite">${icon('star-filled', 13)}</span>` : ''}
      ${item.isSensitive ? `<span class="clip-flag sens" title="Looks like a password, key or token">${icon('alert', 13)}</span>` : ''}
    </div>
    <div class="clip-preview"></div>
    <div class="clip-meta">
      <span>${timeAgo(item.updatedAt)}</span>
      <span class="meta-dot"></span>
      <span>${formatNumber(item.content.length)} chars</span>
      ${type !== 'text' ? `<span class="meta-dot"></span><span class="clip-type">${type}</span>` : ''}
    </div>
    <div class="clip-actions">
      ${type === 'url' ? `<button class="icon-btn icon-btn-sm" data-act="open" title="${t('open.url')}">${icon('external', 14)}</button>` : ''}
      <button class="icon-btn icon-btn-sm" data-act="copy" title="Copy">${icon('copy', 14)}</button>
      <button class="icon-btn icon-btn-sm ${item.isPinned ? 'active' : ''}" data-act="pin" title="${item.isPinned ? t('unpin') : t('pin')}">${icon('pin', 14)}</button>
      <button class="icon-btn icon-btn-sm ${item.isFavorite ? 'fav-on' : ''}" data-act="fav" title="${item.isFavorite ? t('unfavorite') : t('favorite')}">${icon(item.isFavorite ? 'star-filled' : 'star', 14)}</button>
      <button class="icon-btn icon-btn-sm" data-act="coll" title="Collections">${icon('layers', 14)}</button>
      <button class="icon-btn icon-btn-sm" data-act="del" title="${t('delete')}">${icon('trash', 14)}</button>
    </div>`;

  const openBtn = row.querySelector('[data-act="open"]');
  if (openBtn) {
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.tv.openExternal(item.content.trim()).then((r) => {
        if (!r.ok) toastError(r.error || 'Could not open the URL.');
      });
    });
  }

  const previewEl = row.querySelector('.clip-preview');
  previewEl.innerHTML = preview;
  if (item.isSensitive) {
    previewEl.addEventListener('click', () => {
      if (previewEl.dataset.revealed) return;
      previewEl.dataset.revealed = '1';
      previewEl.textContent = item.content.length > 500
        ? item.content.slice(0, 500) + '…'
        : item.content;
    });
  }

  row.querySelector('[data-act="copy"]').addEventListener('click', async (e) => {
    e.stopPropagation();
    await copyClipboardItem(item.id);
    toast(t('clip.copied'));
  });
  row.querySelector('[data-act="pin"]').addEventListener('click', async (e) => {
    e.stopPropagation();
    await toggleClipboardPin(item.id);
  });
  row.querySelector('[data-act="fav"]').addEventListener('click', async (e) => {
    e.stopPropagation();
    await toggleClipboardFavorite(item.id);
  });
  row.querySelector('[data-act="coll"]').addEventListener('click', async (e) => {
    e.stopPropagation();
    const { openCollectionPickerFor } = await import('./snippets.js');
    openCollectionPickerFor('clipboard', item);
  });
  row.querySelector('[data-act="del"]').addEventListener('click', async (e) => {
    e.stopPropagation();
    await deleteClipboardItem(item.id);
    toast(t('clip.removed'), {
      type: 'info',
      duration: 4000,
      action: { label: t('clip.undo'), onClick: () => restoreClipboardItem(item).then(() => toast(t('clip.restored'))) },
    });
  });

  return row;
}
