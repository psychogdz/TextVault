// Trash: recently-deleted texts with restore / delete forever / empty trash.
import { App } from '../state.js';
import { icon, emptyArt } from '../ui/icons.js';
import { toast, confirmDialog, timeAgo, formatNumber } from '../ui/components.js';
import { t, itemsKey } from '../../../shared/i18n.mjs';

const els = {};

export function initTrash() {
  els.view = document.getElementById('view-trash');
  els.list = document.getElementById('trash-list');
  els.empty = document.getElementById('trash-empty');
  els.emptyBtn = document.getElementById('btn-empty-trash');

  els.emptyBtn.addEventListener('click', async () => {
    const n = App.trashedEntries().length;
    if (!n) return;
    const ok = await confirmDialog({
      title: t('trash.empty.title'),
      message: t('trash.empty.body', { n, items: t('texts') }),
      confirmText: t('trash.deleteForever'),
      danger: true,
    });
    if (!ok) return;
    const count = await App.emptyTrash();
    toast(t('trash.deleted', { n: count, items: t('texts') }));
  });

  App.on('entries-changed', refresh);
}

export function refresh() {
  const items = App.trashedEntries().sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
  els.emptyBtn.classList.toggle('hidden', items.length === 0);

  if (!items.length) {
    els.list.innerHTML = '';
    els.empty.innerHTML = `
      <div class="empty-art">${emptyArt('trash')}</div>
      <h3>${t('trash.empty')}</h3>
      <p>${t('trash.empty.body')}</p>`;
    els.empty.classList.remove('hidden');
    return;
  }
  els.empty.classList.add('hidden');

  els.list.innerHTML = '';
  for (const entry of items) {
    const row = document.createElement('div');
    row.className = 'trash-row';
    row.innerHTML = `
      <div class="trash-main">
        <div class="trash-title"></div>
        <div class="trash-sub"></div>
      </div>
      <span class="trash-deleted">deleted ${timeAgo(entry.deletedAt)}</span>
      <div class="trash-actions">
        <button class="btn btn-ghost btn-sm" data-act="restore">${icon('restore', 14)} ${t('trash.restore')}</button>
        <button class="btn btn-ghost-danger btn-sm" data-act="purge">${icon('trash', 14)} ${t('trash.deleteForever')}</button>
      </div>`;
    row.querySelector('.trash-title').textContent = App.titleOf(entry);
    row.querySelector('.trash-sub').textContent =
      `${formatNumber(entry.stats?.chars ?? 0)} chars • ${formatNumber(entry.stats?.lines ?? 0)} lines • modified ${timeAgo(entry.updatedAt)}`;
    row.querySelector('[data-act="restore"]').addEventListener('click', async () => {
      await App.restoreEntry(entry.id);
      toast(t('trash.restoreOne'), {
        action: { label: 'Open', onClick: () => App.openEditor(entry.id) },
      });
    });
    row.querySelector('[data-act="purge"]').addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Delete forever?',
        message: 'This text will be permanently deleted. This cannot be undone.',
        confirmText: 'Delete Forever',
        danger: true,
      });
      if (!ok) return;
      await App.purgeEntry(entry.id);
      toast('Deleted permanently', { type: 'info' });
    });
    els.list.appendChild(row);
  }
}
