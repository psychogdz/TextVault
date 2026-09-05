// TextVault — application bootstrap.
// Wires views, sidebar, theme, shortcuts, menus, export flow and the
// quit-time save handshake into the shared App state.
import { App } from './state.js';
import { hydrateIcons, icon } from './ui/icons.js';
import { toast, toastError, showDropdown, confirmDialog, formatNumber } from './ui/components.js';
import { initDashboard, refresh as refreshDashboard, showSkeletons, clearSkeletons, focusSearch, clearSearchIfPresent, setSelectionMode as dashboardSetSelectionMode, selectAll as dashboardSelectAll } from './views/dashboard.js';
import { initEditor, openEditor as openEditorView, closeEditor, saveNow, openFindbar, openReplacebar, handleEscape, isActive as editorActive } from './views/editor.js';
import { initTrash, refresh as refreshTrash } from './views/trash.js';
import { initSettings, render as renderSettings, applyTheme, openSettingsHelp } from './views/settings.js';
import { initClipboardView, refresh as refreshClipboardView } from './views/clipboard.js';
import { initSnippetsView, refreshSnippets, refreshCollections, initCollectionsView } from './views/snippets.js';
import {
  initSnippets, initCollections, snippetList, collectionList,
  createSnippet, updateSnippet, deleteSnippet, createCollection, renameCollection,
  deleteCollection, setItemCollections, collectionMembers,
} from './core/snippets.js';
import { exportLibrary as exportBackup, importBackup } from './core/backup.js';
import {
  initClipboard, applyCapture, setMonitorState, setMonitorEnabled, clipboardCount,
  clipboardItems, getMonitorState, clearClipboardHistory,
  seedPerfItems, searchPerf, getLastPersistMs,
} from './core/clipboard.js';
import { initCommands, openCommandPalette } from './commands.js';
import { setLanguage as setI18nLanguage, languageDirection, t as translate, itemsKey } from '../../shared/i18n.mjs';

/* ---------------- view switching ---------------- */

const views = {
  dashboard: document.getElementById('view-dashboard'),
  clipboard: document.getElementById('view-clipboard'),
  snippets: document.getElementById('view-snippets'),
  collections: document.getElementById('view-collections'),
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
  if (name === 'clipboard') refreshClipboardView();
  if (name === 'snippets') refreshSnippets();
  if (name === 'collections') refreshCollections();
  if (name === 'trash') refreshTrash();
  if (name === 'settings') renderSettings();
};

App.openEditor = (id) => openEditorView(id);

/* ---------------- export flow (shared) ---------------- */

App.showExportMenu = (entries, anchorEl) => {
  const single = entries.length === 1;
  const items = single
    ? [
        { headerLabel: translate('exp.menu.single') },
        { label: translate('exp.menu.txtExact'), icon: 'file-text', onClick: () => runExport('txt', 'single', entries, App.titleOf(entries[0])) },
        { label: translate('exp.menu.docx'), icon: 'edit', onClick: () => runExport('docx', 'single', entries, App.titleOf(entries[0])) },
        { label: translate('exp.menu.pdf'), icon: 'files', onClick: () => runExport('pdf', 'single', entries, App.titleOf(entries[0])) },
      ]
    : [
        { headerLabel: translate('exp.menu.combined', { n: formatNumber(entries.length) }) },
        { label: translate('exp.menu.combinedTxt'), icon: 'layers', onClick: () => runExport('txt', 'combined', entries) },
        { label: translate('exp.menu.combinedDocx'), icon: 'edit', onClick: () => runExport('docx', 'combined', entries) },
        { label: translate('exp.menu.combinedPdf'), icon: 'files', onClick: () => runExport('pdf', 'combined', entries) },
        { separator: true },
        { headerLabel: translate('exp.menu.separateHeader') },
        { label: translate('exp.menu.separateTxt'), icon: 'file-text', onClick: () => runExport('txt', 'separate', entries) },
        { label: translate('exp.menu.separateDocx'), icon: 'edit', onClick: () => runExport('docx', 'separate', entries) },
        { label: translate('exp.menu.separatePdf'), icon: 'files', onClick: () => runExport('pdf', 'separate', entries) },
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
      toast(translate('exp.exportedFiles', { n: formatNumber(res.count) }));
    } else {
      toast(translate('exp.exportedAs', { fmt: kind.toUpperCase() }));
    }
  } catch (err) {
    toastError(translate('exp.exportFailed') + ': ' + (err.message || translate('settings.unknownError')));
  }
}

/* ---------------- sidebar ---------------- */

function refreshSidebar() {
  const live = App.liveEntries();
  const counts = {
    all: live.length,
    favorites: live.filter((e) => e.favorite).length,
    clipboard: clipboardCount(),
    snippets: snippetList().length,
    collections: collectionList().length,
    trash: App.trashedEntries().length,
  };
  document.querySelectorAll('[data-count]').forEach((el) => {
    const key = el.dataset.count;
    el.textContent = counts[key] ?? '';
    el.style.display = counts[key] ? '' : 'none';
  });

  document.querySelectorAll('#sidebar-nav .nav-item').forEach((btn) => {
    const viewForNav = { clipboard: 'clipboard', snippets: 'snippets', collections: 'collections', trash: 'trash' };
    const target = viewForNav[btn.dataset.nav];
    const active = target
      ? App.view === target
      : App.view === 'dashboard' && App.nav === btn.dataset.nav;
    btn.classList.toggle('active', active);
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
        // Explicit navigation to a tag is a fresh destination: an active search
        // belonged to the previous context and must not filter this one.
        clearSearchIfPresent();
        App.nav = 'tag:' + tag;
        App.setView('dashboard');
      });
      list.appendChild(item);
    }
  }
}

function wireSidebar() {
  // Dashboard library destinations: explicit navigation here starts a fresh
  // context, so a leftover search query must not invisibly filter it.
  const DASHBOARD_DESTS = ['all', 'favorites', 'recent'];
  document.querySelectorAll('#sidebar-nav .nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      App.nav = btn.dataset.nav;
      if (DASHBOARD_DESTS.includes(App.nav)) clearSearchIfPresent();
      if (App.nav === 'trash') App.setView('trash');
      else if (App.nav === 'clipboard') App.setView('clipboard');
      else if (App.nav === 'snippets') App.setView('snippets');
      else if (App.nav === 'collections') App.setView('collections');
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

/* ---------------- language / direction ---------------- */

/** Apply the UI language: direction, translated chrome, main-process sync. */
App.applyLanguage = () => {
  const lang = App.settings.language === 'fa' ? 'fa' : 'en';
  setI18nLanguage(lang);
  document.documentElement.dir = languageDirection();
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = translate(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.placeholder = translate(el.dataset.i18nPh);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = translate(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', translate(el.dataset.i18nAria));
  });
  window.tv.setLanguage(lang).catch(() => {});
  // re-render the active view so dynamic strings follow the language
  if (App.ready) App.setView(App.view);
};

/* ---------------- keyboard shortcuts ---------------- */

function wireShortcuts() {
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;

    // Ctrl+S — save now (editor)
    if (mod && !e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (editorActive()) {
        saveNow().then(() => toast(translate('ed.saveState.saved')));
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
        toast(translate('dash.selectFirst'), { type: 'info' });
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

    // Ctrl+K — command palette
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCommandPalette();
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
    title: translate('del.many.title', { n: ids.length, items: translate(itemsKey(ids.length)) }),
    message: translate('del.many.body'),
    confirmText: translate('del.confirm'),
    danger: true,
  });
  if (!ok) return;
  for (const id of ids) await App.moveToTrash(id);
  App.selection.clear();
  toast(translate('del.moved', { n: ids.length }), {
    type: 'info',
    duration: 6000,
    action: {
      label: translate('clip.undo'),
      onClick: async () => {
        for (const id of ids) await App.restoreEntry(id);
        toast(translate('clip.restored'));
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
      case 'settings': App.setView('settings'); break;
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

  // Clipboard engine: live captures + monitor state.
  window.tv.onClipboardCaptured((item) => { applyCapture(item); });
  window.tv.onClipboardStateChanged((st) => { setMonitorState(st); });

  // Close disposition: the user decides what closing the window means.
  window.tv.onCloseRequest(async () => {
    const behavior = App.settings.closeBehavior || 'ask';
    if (behavior === 'tray') { window.tv.closeResolve('tray'); return; }
    if (behavior === 'quit') { window.tv.closeResolve('quit'); return; }
    const choice = await askCloseBehavior();
    if (!choice) { window.tv.closeResolve('cancel'); return; }
    if (choice.remember) {
      App.settings.closeBehavior = choice.action;
      App.persistSettings();
    }
    window.tv.closeResolve(choice.action);
  });
}

/** First-close dialog: minimize to tray or quit? (shown when closeBehavior === 'ask') */
function askCloseBehavior() {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h3 class="modal-title">${translate('close.title')}</h3>
        <div class="modal-body">${translate('close.body')}<br><br>
          <label class="remember-row"><input type="checkbox" id="close-remember"> ${translate('close.remember')}</label></div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-act="cancel">${translate('cancel')}</button>
          <button class="btn btn-ghost-danger" data-act="quit">${translate('close.quit')}</button>
          <button class="btn btn-accent" data-act="tray">${translate('close.toTray')}</button>
        </div>
      </div>`;
    const close = (v) => {
      backdrop.remove();
      document.removeEventListener('keydown', onKey, true);
      const remember = backdrop.querySelector('#close-remember')?.checked;
      resolve(v ? { action: v, remember } : null);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    backdrop.querySelectorAll('[data-act]').forEach((b) =>
      b.addEventListener('click', () => close(b.dataset.act)));
    document.addEventListener('keydown', onKey, true);
    root.appendChild(backdrop);
  });
}

/* ---------------- boot ---------------- */

async function boot() {
  hydrateIcons(document.body);
  applyTheme();

  initDashboard();
  initClipboardView();
  initSnippetsView();
  initCollectionsView();
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
    toastError(translate('db.openFailed') + ': ' + (err.message || err));
  }

  clearSkeletons();
  refreshSidebar();
  refreshDashboard();
  App.on('entries-changed', refreshSidebar);

  // Clipboard engine: load persisted history, drain pending captures, and
  // sync the monitor's master switch with the user's saved settings.
  await initClipboard();
  await initSnippets();
  await initCollections();
  window.tv.clipboardSetEnabled(App.settings.clipboard?.monitorEnabled !== false)
    .catch(() => {});
  App.on('clipboard-changed', refreshSidebar);
  App.on('library-changed', refreshSidebar);

  // i18n + global shortcut (Phase 6)
  initCommands({ toggleTheme });
  App.applyLanguage();
  window.tv.setShortcut(App.settings.clipboard?.quickShortcut).catch(() => {});

  // programmatic test hook (only when launched with ?e2e=1 by the test runner)
  if (new URLSearchParams(location.search).get('e2e') === '1') {
    window.__TV_TEST__ = {
      App,
      ready: true,
      openEditor: (id) => App.openEditor(id),
      clipboard: {
        count: () => clipboardCount(),
        clearAll: () => clearClipboardHistory(),
        seedPerf: (n) => seedPerfItems(n),
        searchPerf: (q, runs) => searchPerf(q, runs),
        lastPersistMs: () => getLastPersistMs(),
        memoryMB: () => Math.round((performance.memory?.usedJSHeapSize || 0) / 1048576 * 10) / 10,
        items: () => clipboardItems().map((i) => ({
          id: i.id, content: i.content, pinned: i.isPinned, fav: i.isFavorite,
          sensitive: i.isSensitive, updatedAt: i.updatedAt,
        })),
        top: () => clipboardItems()[0]?.content ?? null,
        has: (needle) => clipboardItems().some((i) => i.content.includes(needle)),
        monitorState: () => getMonitorState(),
        pinnedCount: () => clipboardItems().filter((i) => i.isPinned).length,
        viewVisible: () => !document.getElementById('view-clipboard').classList.contains('hidden'),
      },
      snippets: {
        count: () => snippetList().length,
        create: (payload) => createSnippet(payload),
        update: (id, patch) => updateSnippet(id, patch),
        remove: (id) => deleteSnippet(id),
        byTitle: (t) => snippetList().find((s) => s.title === t) || null,
        viewVisible: () => !document.getElementById('view-snippets').classList.contains('hidden'),
      },
      backup: {
        exportAll: () => exportBackup(),
        importAll: (res, mode) => importBackup(res, { mode }),
      },
      collections: {
        count: () => collectionList().length,
        create: (name) => createCollection(name),
        rename: (id, name) => renameCollection(id, name),
        remove: (id) => deleteCollection(id),
        byName: (n) => collectionList().find((c) => c.name === n) || null,
        members: (id) => {
          const m = collectionMembers(id);
          return { clip: m.clip.length, snips: m.snips.length };
        },
        assign: (store, record, ids) => setItemCollections(store, record, ids),
        viewVisible: () => !document.getElementById('view-collections').classList.contains('hidden'),
      },
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
        debug: () => ({
          countLabel: document.getElementById('entries-count').textContent,
          cardsInDom: document.querySelectorAll('#grid-inner .card').length,
          live: window.__TV_TEST__.App.liveEntries().length,
          query: window.__TV_TEST__.App.query,
          nav: window.__TV_TEST__.App.nav,
        }),
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
    toast(translate('toast.welcome'), { type: 'info', duration: 5000 });
  }

  // page-boot time (navigation start → interactive), used by perf checks
  window.__TV_BOOT_MS__ = Math.round(performance.now());
}

boot();
