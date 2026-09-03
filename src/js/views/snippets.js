// Snippets + Collections views. Domain logic lives in core/snippets.js;
// this module renders and forwards user actions only. Reuses the existing
// component vocabulary (rows, chips, dropdowns, modals, empty states).

import { App } from '../state.js';
import {
  snippetList, getSnippet, createSnippet, updateSnippet, deleteSnippet,
  copySnippet, toggleSnippetFavorite,
  collectionList, collectionMembers, createCollection,
  renameCollection, deleteCollection, setItemCollections,
} from '../core/snippets.js';
import { icon, emptyArt } from '../ui/icons.js';
import { toast, confirmDialog, timeAgo, formatNumber } from '../ui/components.js';
import { detectContentType } from '../../../shared/detect.mjs';
import { parseQuery, matchSnippet } from '../../../shared/query.mjs';

const els = {};
let snippetQuery = '';

export function initSnippetsView() {
  els.view = document.getElementById('view-snippets');
  els.search = document.getElementById('snippet-search-input');
  els.list = document.getElementById('snippet-list');
  els.empty = document.getElementById('snippets-empty');
  els.btnNew = document.getElementById('btn-new-snippet');

  els.btnNew.addEventListener('click', () => openSnippetEditor(null));
  els.search.addEventListener('input', () => { snippetQuery = els.search.value; refreshSnippets(); });
  App.on('library-changed', () => {
    if (App.view === 'snippets') refreshSnippets();
    if (App.view === 'collections') refreshCollections();
  });
}

export function refreshSnippets() {
  if (!els.list) return;
  const q = parseQuery(snippetQuery);
  const idToName = new Map(collectionList().map((c) => [c.id, c.name]));
  const rows = snippetList().filter((s) => matchSnippet(s, q, idToName));

  document.getElementById('snippet-count').textContent = formatNumber(rows.length);
  els.list.innerHTML = '';
  if (!rows.length) {
    els.list.style.display = 'none';
    els.empty.innerHTML = `
      <div class="empty-art">${emptyArt(q ? 'search' : 'clipboard')}</div>
      <h3>${q ? 'No matches' : 'No snippets yet'}</h3>
      <p>${q ? 'Try a different search.' : 'Snippets are reusable texts you save on purpose — commands, templates, replies.'}</p>`;
    els.empty.classList.remove('hidden');
    return;
  }
  els.empty.classList.add('hidden');
  els.list.style.display = '';
  for (const s of rows) els.list.appendChild(renderSnippetRow(s));
}

function renderSnippetRow(s) {
  const row = document.createElement('div');
  row.className = 'clip-row snippet-row';
  row.dataset.id = s.id;
  row.innerHTML = `
    <div class="clip-flags">
      ${s.isFavorite ? `<span class="clip-flag fav" title="Favorite">${icon('star-filled', 13)}</span>` : ''}
      ${(s.collections || []).length ? `<span class="clip-flag" title="In ${s.collections.length} collection(s)">${icon('layers', 13)}</span>` : ''}
    </div>
    <div class="snippet-title"></div>
    <div class="clip-preview"></div>
    <div class="clip-meta">
      <span>${timeAgo(s.updatedAt)}</span>
      <span class="meta-dot"></span>
      <span class="snippet-tags"></span>
    </div>
    <div class="clip-actions">
      <button class="icon-btn icon-btn-sm" data-act="copy" title="Copy snippet">${icon('copy', 14)}</button>
      <button class="icon-btn icon-btn-sm ${s.isFavorite ? 'fav-on' : ''}" data-act="fav" title="${s.isFavorite ? 'Remove from favorites' : 'Favorite'}">${icon(s.isFavorite ? 'star-filled' : 'star', 14)}</button>
      <button class="icon-btn icon-btn-sm" data-act="edit" title="Edit">${icon('edit', 14)}</button>
      <button class="icon-btn icon-btn-sm" data-act="coll" title="Collections">${icon('layers', 14)}</button>
      <button class="icon-btn icon-btn-sm" data-act="del" title="Delete">${icon('trash', 14)}</button>
    </div>`;
  row.querySelector('.snippet-title').textContent = s.title || 'Untitled snippet';
  row.querySelector('.clip-preview').textContent = s.content.length > 200 ? s.content.slice(0, 200) + '…' : s.content;
  const tagsEl = row.querySelector('.snippet-tags');
  (s.tags || []).slice(0, 4).forEach((t) => {
    const chip = document.createElement('span');
    chip.className = 'card-tag';
    chip.textContent = t;
    tagsEl.appendChild(chip);
  });

  row.querySelector('[data-act="copy"]').addEventListener('click', async (e) => {
    e.stopPropagation();
    await copySnippet(s.id);
    toast('Snippet copied to clipboard');
  });
  row.querySelector('[data-act="fav"]').addEventListener('click', (e) => { e.stopPropagation(); toggleSnippetFavorite(s.id); });
  row.querySelector('[data-act="edit"]').addEventListener('click', (e) => { e.stopPropagation(); openSnippetEditor(s.id); });
  row.querySelector('[data-act="coll"]').addEventListener('click', (e) => { e.stopPropagation(); openCollectionPicker('snippets', s); });
  row.querySelector('[data-act="del"]').addEventListener('click', async (e) => {
    e.stopPropagation();
    const ok = await confirmDialog({
      title: 'Delete this snippet?',
      message: '“<b></b>” will be permanently removed. This cannot be undone.',
      messageValues: [s.title || 'Untitled snippet'],
      confirmText: 'Delete Snippet',
      danger: true,
    });
    if (!ok) return;
    await deleteSnippet(s.id);
    toast('Snippet deleted', { type: 'info' });
  });

  return row;
}

/* --------------------------- snippet editor --------------------------- */

function openSnippetEditor(id) {
  const existing = id ? getSnippet(id) : null;
  const root = document.getElementById('modal-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal modal-wide" role="dialog" aria-modal="true">
      <h3 class="modal-title">${existing ? 'Edit Snippet' : 'New Snippet'}</h3>
      <div class="modal-body snippet-form">
        <input id="sn-title" placeholder="Title" autocomplete="off" spellcheck="false">
        <textarea id="sn-content" rows="8" placeholder="Snippet content…" spellcheck="false"></textarea>
        <input id="sn-desc" placeholder="Description (optional)" autocomplete="off" spellcheck="false">
        <input id="sn-tags" placeholder="Tags, comma separated" autocomplete="off" spellcheck="false">
        <div class="sn-coll-label">Collections</div>
        <div class="sn-coll-list" id="sn-collections"></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-act="cancel">Cancel</button>
        <button class="btn btn-accent" data-act="save">${existing ? 'Save' : 'Create Snippet'}</button>
      </div>
    </div>`;
  const title = backdrop.querySelector('#sn-title');
  const content = backdrop.querySelector('#sn-content');
  const desc = backdrop.querySelector('#sn-desc');
  const tags = backdrop.querySelector('#sn-tags');
  if (existing) {
    title.value = existing.title;
    content.value = existing.content;
    desc.value = existing.description || '';
    tags.value = (existing.tags || []).join(', ');
  }

  // collection checkboxes
  const collWrap = backdrop.querySelector('#sn-collections');
  const selected = new Set(existing ? existing.collections || [] : []);
  for (const c of collectionList()) {
    const label = document.createElement('label');
    label.className = 'sn-coll-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = selected.has(c.id);
    cb.addEventListener('change', () => {
      if (cb.checked) selected.add(c.id); else selected.delete(c.id);
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(c.name));
    collWrap.appendChild(label);
  }
  if (!collectionList().length) {
    collWrap.innerHTML = '<span class="ts-empty">No collections yet — create one in the Collections view.</span>';
  }

  const close = (save) => {
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    if (!save) return;
    const payload = {
      title: title.value,
      content: content.value,
      description: desc.value,
      tags: tags.value.split(',').map((t) => t.trim()).filter(Boolean),
      collections: [...selected],
    };
    if (existing) updateSnippet(existing.id, payload).then(() => toast('Snippet saved'));
    else if (payload.content.trim() || payload.title.trim()) {
      createSnippet(payload).then(() => toast('Snippet created'));
    } else toast('Nothing to save', { type: 'info' });
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(false); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) close(true);
  };
  backdrop.querySelector('[data-act="cancel"]').addEventListener('click', () => close(false));
  backdrop.querySelector('[data-act="save"]').addEventListener('click', () => close(true));
  document.addEventListener('keydown', onKey, true);
  root.appendChild(backdrop);
  title.focus();
}

/* ------------------------- collection picker -------------------------- */

/** Public entry point (used by other views, e.g. clipboard rows). */
export function openCollectionPickerFor(store, record) {
  return openCollectionPicker(store, record);
}

function openCollectionPicker(store, record) {
  const root = document.getElementById('modal-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const selected = new Set(record.collections || []);
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h3 class="modal-title">Collections</h3>
      <div class="modal-body"><div class="sn-coll-list"></div></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-act="cancel">Cancel</button>
        <button class="btn btn-accent" data-act="save">Save</button>
      </div>
    </div>`;
  const listEl = backdrop.querySelector('.sn-coll-list');
  for (const c of collectionList()) {
    const label = document.createElement('label');
    label.className = 'sn-coll-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = selected.has(c.id);
    cb.addEventListener('change', () => {
      if (cb.checked) selected.add(c.id); else selected.delete(c.id);
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(c.name));
    listEl.appendChild(label);
  }
  if (!collectionList().length) {
    listEl.innerHTML = '<span class="ts-empty">No collections yet — create one in the Collections view.</span>';
  }
  const close = (save) => {
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    if (save) setItemCollections(store, record, [...selected]).then(() => toast('Collections updated'));
  };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(false); } };
  backdrop.querySelector('[data-act="cancel"]').addEventListener('click', () => close(false));
  backdrop.querySelector('[data-act="save"]').addEventListener('click', () => close(true));
  document.addEventListener('keydown', onKey, true);
  root.appendChild(backdrop);
}

/* --------------------------- collections view -------------------------- */

export function initCollectionsView() {
  els.collList = document.getElementById('collection-list');
  els.collEmpty = document.getElementById('collections-empty');
  document.getElementById('btn-new-collection').addEventListener('click', async () => {
    const name = await promptText('New collection', 'Collection name');
    if (!name || !name.trim()) return;
    await createCollection(name);
    toast('Collection created');
  });
}

export function refreshCollections() {
  if (!els.collList) return;
  const list = collectionList();
  els.collList.innerHTML = '';
  if (!list.length) {
    els.collList.style.display = 'none';
    els.collEmpty.innerHTML = `
      <div class="empty-art">${emptyArt('inbox')}</div>
      <h3>No collections yet</h3>
      <p>Group related clipboard items and snippets — Development, Work, Email…</p>`;
    els.collEmpty.classList.remove('hidden');
    return;
  }
  els.collEmpty.classList.add('hidden');
  els.collList.style.display = '';
  for (const c of list) els.collList.appendChild(renderCollectionRow(c));
}

function renderCollectionRow(c) {
  const { clip, snips } = collectionMembers(c.id);
  const row = document.createElement('div');
  row.className = 'collection-block';
  row.dataset.id = c.id;
  row.innerHTML = `
    <div class="collection-head">
      <span class="collection-icon">${icon('layers', 16)}</span>
      <span class="collection-name"></span>
      <span class="clip-meta">${formatNumber(clip.length + snips.length)} items</span>
      <span class="spacer"></span>
      <button class="icon-btn icon-btn-sm" data-act="rename" title="Rename">${icon('edit', 14)}</button>
      <button class="icon-btn icon-btn-sm" data-act="del" title="Delete collection">${icon('trash', 14)}</button>
    </div>
    <div class="collection-members"></div>`;
  row.querySelector('.collection-name').textContent = c.name;

  row.querySelector('[data-act="rename"]').addEventListener('click', async () => {
    const name = await promptText('Rename collection', 'Collection name', c.name);
    if (name && name.trim()) { await renameCollection(c.id, name); toast('Collection renamed'); }
  });
  row.querySelector('[data-act="del"]').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Delete this collection?',
      message: 'Members stay in your library; only the group is removed.',
      confirmText: 'Delete Collection',
      danger: true,
    });
    if (!ok) return;
    await deleteCollection(c.id);
    toast('Collection deleted', { type: 'info' });
  });

  const members = row.querySelector('.collection-members');
  for (const it of clip.slice(0, 20)) {
    members.appendChild(memberRow('clipboard', it, it.preview || it.content, detectContentType(it.content) === 'url' ? it.content : null));
  }
  for (const s of snips.slice(0, 20)) {
    members.appendChild(memberRow('snippets', s, s.title || s.content, null));
  }
  if (!clip.length && !snips.length) {
    members.innerHTML = '<div class="ts-empty">No members yet — use the layers button on clipboard items or snippets.</div>';
  }
  return row;
}

function memberRow(store, record, previewText, url) {
  const row = document.createElement('div');
  row.className = 'clip-row member-row';
  row.innerHTML = `
    <div class="clip-preview"></div>
    <div class="clip-actions">
      ${url ? `<button class="icon-btn icon-btn-sm" data-act="open" title="Open URL">${icon('arrow-left', 14)}</button>` : ''}
      <button class="icon-btn icon-btn-sm" data-act="copy" title="Copy">${icon('copy', 14)}</button>
      <button class="icon-btn icon-btn-sm" data-act="remove" title="Remove from collection">${icon('x', 14)}</button>
    </div>`;
  row.querySelector('.clip-preview').textContent = previewText.slice(0, 160);
  const openBtn = row.querySelector('[data-act="open"]');
  if (openBtn) {
    openBtn.innerHTML = icon('external', 14);
    openBtn.title = 'Open URL';
    openBtn.addEventListener('click', () => window.tv.openExternal(url).then((r) => {
      if (!r.ok) toastError(r.error || 'Could not open the URL.');
    }));
  }
  row.querySelector('[data-act="copy"]').addEventListener('click', async () => {
    await window.tv.clipboardWrite(record.content);
    toast('Copied to clipboard');
  });
  row.querySelector('[data-act="remove"]').addEventListener('click', async () => {
    await setItemCollections(store, record, (record.collections || []).filter((x) => x !== row.closest('.collection-block').dataset.id));
    toast('Removed from collection', { type: 'info' });
  });
  return row;
}

/* ------------------------------ prompt ------------------------------ */

function promptText(title, placeholder, value = '') {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h3 class="modal-title"></h3>
        <div class="modal-body"><input class="prompt-input" placeholder=""></div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-act="cancel">Cancel</button>
          <button class="btn btn-accent" data-act="ok">Save</button>
        </div>
      </div>`;
    backdrop.querySelector('.modal-title').textContent = title;
    const input = backdrop.querySelector('.prompt-input');
    input.placeholder = placeholder;
    input.value = value;
    const close = (v) => {
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      resolve(v);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(null); }
      if (e.key === 'Enter') close(input.value);
    };
    backdrop.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
    backdrop.querySelector('[data-act="ok"]').addEventListener('click', () => close(input.value));
    document.addEventListener('keydown', onKey, true);
    root.appendChild(backdrop);
    input.focus();
    input.select();
  });
}
