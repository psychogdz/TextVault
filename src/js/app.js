// TextVault — application bootstrap.
// Wires views, sidebar, theme, shortcuts, menus, export flow and the
// quit-time save handshake into the shared App state.
import { App } from './state.js';
import { hydrateIcons, icon } from './ui/icons.js';
import { toast, toastError, showDropdown, confirmDialog, formatNumber } from './ui/components.js';
import { initDashboard, refresh as refreshDashboard, showSkeletons, clearSkeletons, focusSearch, setSelectionMode as dashboardSetSelectionMode, selectAll as dashboardSelectAll } from './views/dashboard.js';
import { initEditor, openEditor as openEditorView, closeEditor, saveNow, openFindbar, openReplacebar, handleEscape, isActive as editorActive } from './views/editor.js';
import { initTrash, refresh as refreshTrash } from './views/trash.js';
import { initSettings, render as renderSettings, applyTheme, openSettingsHelp } from './views/settings.js';

/* ---------------- view switching ---------------- */

const views = {
  dashboard: document.getElementById('view-dashboard'),
  editor: document.getElementById('view-editor'),
  trash: document.getElementById('view-trash'),
  settings: document.getElementById('view-settings'),
};

App.setView = (name) => {
  App.view = name;
  for (const [key, el] of Object.entries(views)) {
    el.classList.toggle('hidden', key !== name);
  }
  document.getElementById('app').dataset.view = name;
  refreshSidebar();
  if (name === 'dashboard') refreshDashboard();
  if (name === 'trash') refreshTrash();
  if (name === 'settings') renderSettings();
};

App.openEditor = (id) => openEditorView(id);

/* ---------------- export flow (shared) ---------------- */

App.showExportMenu = (entries, anchorEl) => {
  const single = entries.length === 1;
  const items = single
    ? [
        { headerLabel: 'Export this text' },
        { label: 'TXT — exact original text', icon: 'file-text', onClick: () => runExport('txt', 'single', entries, App.titleOf(entries[0])) },
        { label: 'Word document (.docx)', icon: 'edit', onClick: () => runExport('docx', 'single', entries, App.titleOf(entries[0])) },
        { label: 'PDF document', icon: 'files', onClick: () => runExport('pdf', 'single', entries, App.titleOf(entries[0])) },
      ]
    : [
        { headerLabel: `One combined file (${formatNumber(entries.length)} texts)` },
        { label: 'Combined TXT', icon: 'layers', onClick: () => runExport('txt', 'combined', entries) },
        { label: 'Combined Word (.docx)', icon: 'edit', onClick: () => runExport('docx', 'combined', entries) },
        { label: 'Combined PDF', icon: 'files', onClick: () => runExport('pdf', 'combined', entries) },
        { separator: true },
        { headerLabel: 'Separate file for each text' },
        { label: 'Separate TXT files…', icon: 'file-text', onClick: () => runExport('txt', 'separate', entries) },
        { label: 'Separate Word files…', icon: 'edit', onClick: () => runExport('docx', 'separate', entries) },
        { label: 'Separate PDF files…', icon: 'files', onClick: () => runExport('pdf', 'separate', entries) },
      ];

  showDropdown(anchorEl || null, items);
};

async function runExport(kind, mode, entries, defaultName) {
  // entries may contain clones; send plain serializable payloads
  const payload = entries.map((e) => ({
    id: e.id,
    title: App.titleOf(e),
    content: e.content,
    tags: e.tags || [],
    dir: e.dir,
    stats: e.stats || null,
    updatedAt: e.updatedAt,
  }));
  try {
    const res = await window.tv.export({ kind, mode, entries: payload, defaultName: defaultName ? defaultName + '.' + kind : null });
    if (!res.ok) {
      if (!res.canceled) toastError(`Export failed: ${res.error || 'unknown error'}`);
      return;
    }
    if (mode === 'separate') {
      toast(`Exported ${formatNumber(res.count)} files`);
    } else {
      toast(`Exported as ${kind.toUpperCase()}`);
    }
  } catch (err) {
    toastError('Export failed: ' + (err.message || 'unknown error'));
  }
}

/* ---------------- sidebar ---------------- */

function refreshSidebar() {
  const live = App.liveEntries();
  const counts = {
    all: live.length,
    favorites: live.filter((e) => e.favorite).length,
    trash: App.trashedEntries().length,
  };
  document.querySelectorAll('[data-count]').forEach((el) => {
    const key = el.dataset.count;
    el.textContent = counts[key] ?? '';
    el.style.display = counts[key] ? '' : 'none';
  });

  document.querySelectorAll('#sidebar-nav .nav-item').forEach((btn) => {
    btn.classList.toggle('active', App.view === 'dashboard' && App.nav === btn.dataset.nav);
  });
  document.querySelector('.sidebar-footer .nav-item').classList.toggle('active', App.view === 'settings');

  // tag list
  const list = document.getElementById('tag-list');
  const tags = App.tagCounts();
  if (!tags.length) {
    list.innerHTML = '<div class="tags-empty">No tags yet — add tags while editing a text.</div>';
  } else {
    list.innerHTML = '';
    for (const [tag, count] of tags) {
      const item = document.createElement('button');
      item.className = 'tag-item' + (App.nav === 'tag:' + tag ? ' active' : '');
      item.innerHTML = `<span class="tag-dot"></span><span class="tag-name"></span><span class="nav-count">${count}</span>`;
      item.querySelector('.tag-name').textContent = tag;
      item.addEventListener('click', () => {
        App.nav = App.nav === 'tag:' + tag ? 'all' : 'tag:' + tag;
        App.setView('dashboard');
      });
      list.appendChild(item);
    }
  }
}

function wireSidebar() {
  document.querySelectorAll('#sidebar-nav .nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      App.nav = btn.dataset.nav;
      if (App.nav === 'trash') App.setView('trash');
      else App.setView('dashboard');
    });
  });
  document.querySelector('.sidebar-footer .nav-item').addEventListener('click', () => App.setView('settings'));
  document.getElementById('btn-new-text').addEventListener('click', () => App.openEditor(null));
  document.getElementById('theme-quick-toggle').addEventListener('click', toggleTheme);

  // nav icons
  hydrateIcons(document.querySelector('.sidebar'));
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  App.settings.theme = current === 'dark' ? 'light' : 'dark';
  App.persistSettings();
  applyTheme();
}

/* ---------------- keyboard shortcuts ---------------- */

function wireShortcuts() {
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;

    // Ctrl+S — save now (editor)
    if (mod && !e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (editorActive()) {
        saveNow().then(() => toast('Saved'));
      }
      return;
    }

    // Ctrl+F — search (dashboard) / find (editor)
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      if (App.view === 'editor') openFindbar();
      else { App.setView('dashboard'); focusSearch(); }
      return;
    }

    // Ctrl+H — replace (editor)
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      if (App.view === 'editor') openReplacebar();
      return;
    }

    // Ctrl+E — export
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      if (App.view === 'editor') {
        document.getElementById('btn-export').click();
      } else if (App.selection.size > 0) {
        App.showExportMenu([...App.selection].map((id) => App.get(id)).filter(Boolean), document.getElementById('sort-wrap'));
      } else {
        toast('Select one or more texts first (card checkboxes), or open a text.', { type: 'info' });
      }
      return;
    }

    // Ctrl+Shift+C — copy all
    if (mod && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      if (App.view === 'editor') document.getElementById('btn-copy-all').click();
      return;
    }

    // Delete — delete selected card(s) on dashboard
    if ((e.key === 'Delete') && App.view === 'dashboard' && App.selection.size > 0
        && !isTypingTarget(e.target)) {
      e.preventDefault();
      deleteSelection();
      return;
    }

    // Ctrl+M — toggle selection mode (dashboard)
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'm'
        && App.view === 'dashboard' && !isTypingTarget(e.target)) {
      e.preventDefault();
      dashboardSetSelectionMode(!App.selectionMode);
      return;
    }

    // Ctrl+A — select all (only meaningful in selection mode)
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'a'
        && App.view === 'dashboard' && App.selectionMode && !isTypingTarget(e.target)) {
      e.preventDefault();
      dashboardSelectAll();
      return;
    }

    // Esc — close overlays / leave selection mode / close editor
    if (e.key === 'Escape') {
      if (document.querySelector('.modal-backdrop')) return; // modal handles its own Esc
      if (App.view === 'editor') {
        if (handleEscape()) return; // findbar consumed it
        closeEditor();
      } else if (App.view === 'dashboard' && App.selectionMode && !isTypingTarget(e.target)) {
        dashboardSetSelectionMode(false);
      }
      return;
    }
  });
}

function isTypingTarget(target) {
  return target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

async function deleteSelection() {
  const ids = [...App.selection];
  const ok = await confirmDialog({
    title: `Delete ${ids.length} ${ids.length === 1 ? 'text' : 'texts'}?`,
    message: 'They will be moved to the Trash. You can restore them later.',
    confirmText: 'Delete',
    danger: true,
  });
  if (!ok) return;
  for (const id of ids) await App.moveToTrash(id);
  App.selection.clear();
  toast(`Moved ${ids.length} to Trash`, {
    type: 'info',
    duration: 6000,
    action: {
      label: 'Undo',
      onClick: async () => {
        for (const id of ids) await App.restoreEntry(id);
        toast('Restored');
      },
    },
  });
}

/* ---------------- menu + flush handshake ---------------- */

function wireElectronBridge() {
  window.tv.onMenu((cmd) => {
    switch (cmd) {
      case 'new': App.openEditor(null); break;
      case 'theme': toggleTheme(); break;
      case 'shortcuts': openSettingsHelp('shortcuts'); break;
      case 'about': openSettingsHelp('about'); break;
      case 'backup-export': App.setView('settings'); setTimeout(() => document.getElementById('set-backup')?.click(), 80); break;
      case 'backup-import': App.setView('settings'); setTimeout(() => document.getElementById('set-import')?.click(), 80); break;
      default: break;
    }
  });

  window.tv.onFlush(async () => {
    try {
      if (editorActive()) await saveNow();
    } finally {
      window.tv.notifyFlushed();
    }
  });
}

/* ---------------- boot ---------------- */

async function boot() {
  hydrateIcons(document.body);
  applyTheme();

  initDashboard();
  initEditor();
  initTrash();
  initSettings();
  wireSidebar();
  wireShortcuts();
  wireElectronBridge();

  // system theme changes (when following "system")
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (App.settings.theme === 'system') applyTheme();
  });

  // version label
  window.tv.appInfo().then((info) => {
    document.getElementById('brand-version').textContent = 'v' + info.version;
  }).catch(() => {});

  showSkeletons();

  try {
    await App.init();
  } catch (err) {
    console.error(err);
    toastError('Failed to open the local database: ' + (err.message || err));
  }

  clearSkeletons();
  refreshSidebar();
  refreshDashboard();
  App.on('entries-changed', refreshSidebar);

  // programmatic test hook (only when launched with ?e2e=1 by the test runner)
  if (new URLSearchParams(location.search).get('e2e') === '1') {
    window.__TV_TEST__ = {
      App,
      ready: true,
      openEditor: (id) => App.openEditor(id),
      dashboard: {
        search: (q) => { const i = document.getElementById('search-input'); i.value = q; i.dispatchEvent(new Event('input', { bubbles: true })); },
        cards: () => [...document.querySelectorAll('#grid-inner .card')].map((c) => c.dataset.id),
        setSort: (v) => { const s = document.getElementById('sort-select'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); },
        setSelectionMode: (on) => dashboardSetSelectionMode(on),
        selectAll: () => dashboardSelectAll(),
        selectionMode: () => window.__TV_TEST__.App.selectionMode,
        selectedCount: () => window.__TV_TEST__.App.selection.size,
        selCountText: () => document.getElementById('sel-count').textContent,
        toolbarVisible: () => !document.getElementById('selection-toolbar').classList.contains('hidden'),
        gridClass: (cls) => document.getElementById('card-grid').classList.contains(cls),
        clickCard: (id) => { document.querySelector(`#grid-inner .card[data-id="${id}"]`)?.click(); },
        clickTrash: (id) => { document.querySelector(`#grid-inner .card[data-id="${id}"] .card-trash`)?.click(); },
        modalVisible: () => !!document.querySelector('.modal-backdrop'),
        modalConfirm: () => { document.querySelector('.modal-backdrop [data-act="ok"]')?.click(); },
        modalCancel: () => { document.querySelector('.modal-backdrop [data-act="cancel"]')?.click(); },
        bulkbarVisible: () => !document.getElementById('bulkbar').classList.contains('hidden'),
        bulkExportClick: () => document.querySelector('#bulkbar [data-bulk="export"]')?.click(),
        dropdownItems: () => [...document.querySelectorAll('.dropdown .dd-item .dd-text')].map((t) => t.textContent),
        dropdownClick: (label) => { [...document.querySelectorAll('.dropdown .dd-item')].find((b) => b.querySelector('.dd-text').textContent === label)?.click(); },
        cardSelected: (id) => document.querySelector(`#grid-inner .card[data-id="${id}"]`)?.classList.contains('selected'),
      },
      editor: {
        open: (id) => App.openEditor(id),
        set: (text) => { const t = document.getElementById('editor-textarea'); t.value = text; t.dispatchEvent(new Event('input', { bubbles: true })); },
        get: () => document.getElementById('editor-textarea')?.value ?? null,
        title: (v) => { const t = document.getElementById('editor-title'); if (v !== undefined) { t.value = v; t.dispatchEvent(new Event('input', { bubbles: true })); } return t.value; },
        saveState: () => document.getElementById('save-state').querySelector('.txt').textContent,
        visible: () => !document.getElementById('view-editor').classList.contains('hidden'),
        find: (q) => { const f = document.getElementById('find-input'); f.value = q; f.dispatchEvent(new Event('input', { bubbles: true })); return document.getElementById('find-count').textContent; },
      },
    };
  }

  // welcome for a fresh vault
  if (App.liveEntries().length === 0 && App.trashedEntries().length === 0) {
    toast('Welcome to TextVault — paste a text above to save it.', { type: 'info', duration: 5000 });
  }
}

boot();
