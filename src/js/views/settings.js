// Settings: appearance, language, editor defaults, clipboard engine, library, shortcuts, about.
import { App } from '../state.js';
import { icon } from '../ui/icons.js';
import { toast, toastError, confirmDialog, formatNumber } from '../ui/components.js';
import { applyEditorPrefs } from './editor.js';
import { setMonitorEnabled, setPrivateMode, getMonitorState } from '../core/clipboard.js';
import { exportLibrary as exportBackup, importBackup } from '../core/backup.js';
import { t } from '../../../shared/i18n.mjs';
import { LANGUAGES } from '../../../shared/validation.mjs';

const ACCENTS = [
  { id: 'violet', color: '#8b7cf8' },
  { id: 'blue', color: '#5aa2ff' },
  { id: 'teal', color: '#2dd4bf' },
  { id: 'rose', color: '#fb7185' },
  { id: 'amber', color: '#fbbf24' },
];

// Shortcut description keys + accelerator strings (accelerators stay LTR).
const SHORTCUTS = [
  ['sc.newText', 'Ctrl + N'],
  ['sc.save', 'Ctrl + S'],
  ['sc.search', 'Ctrl + F'],
  ['sc.replace', 'Ctrl + H'],
  ['sc.export', 'Ctrl + E'],
  ['ed.copyAllLabel', 'Ctrl + Shift + C'],
  ['sc.selMode', 'Ctrl + M'],
  ['sc.undo', 'Ctrl + Z / Ctrl + Shift + Z'],
  ['menu.theme', 'Ctrl + Alt + T'],
  ['sc.qcSave', 'Ctrl + Enter'],
  ['sc.deleteCard', 'Delete'],
  ['sc.esc', 'Esc'],
];

let els = null;

export function initSettings() {
  const view = document.getElementById('view-settings');
  view.innerHTML = `
    <div class="settings-wrap">
      <div class="settings-card">
        <h3 data-i18n="set.appearance">Appearance</h3>
        <div class="settings-sub" data-i18n="set.appearance.sub">Theme and accent color.</div>
        <div class="setting-row">
          <div><div class="sr-label" data-i18n="set.theme">Theme</div></div>
          <div class="theme-picker" id="set-theme">
            <button class="theme-btn" data-theme-opt="light">${icon('sun', 14)} <span data-i18n="set.theme.light">Light</span></button>
            <button class="theme-btn" data-theme-opt="dark">${icon('moon', 14)} <span data-i18n="set.theme.dark">Dark</span></button>
            <button class="theme-btn" data-theme-opt="system">${icon('monitor', 14)} <span data-i18n="set.theme.system">System</span></button>
          </div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label" data-i18n="set.accent">Accent color</div></div>
          <div class="accent-swatches" id="set-accent"></div>
        </div>
      </div>

      <div class="settings-card">
        <h3 data-i18n="set.language">Language</h3>
        <div class="settings-sub" data-i18n="set.language.sub">Interface language and direction.</div>
        <div class="setting-row">
          <div><div class="sr-label" data-i18n="set.language">Language</div></div>
          <div class="theme-picker" id="set-language">
            <button class="theme-btn" data-lang-opt="en">English</button>
            <button class="theme-btn" data-lang-opt="fa">فارسی</button>
          </div>
        </div>
      </div>

      <div class="settings-card">
        <h3 data-i18n="set.editor">Editor</h3>
        <div class="settings-sub" data-i18n="set.editor.sub">Defaults used when writing and viewing texts.</div>
        <div class="setting-row">
          <div><div class="sr-label" data-i18n="set.fontsize">Font size</div><div class="sr-desc" data-i18n="set.fontsize.d">Editor text size</div></div>
          <div class="range-wrap">
            <input type="range" id="set-fontsize" min="12" max="22" step="0.5">
            <span class="range-val" id="set-fontsize-val"></span>
          </div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label" data-i18n="set.fontFamily">Font family</div><div class="sr-desc" data-i18n="set.fontFamily.d">Sans for prose, mono for code</div></div>
          <div class="theme-picker">
            <button class="theme-btn" data-font-opt="sans"><span data-i18n="ed.sans">Sans</span></button>
            <button class="theme-btn" data-font-opt="mono"><span data-i18n="ed.mono">Mono</span></button>
          </div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label" data-i18n="set.wrap">Word wrap</div><div class="sr-desc" data-i18n="set.wrap.d">Wrap long lines instead of scrolling sideways</div></div>
          <div class="switch" id="set-wrap" role="switch"></div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label" data-i18n="set.autosave">Auto-save</div><div class="sr-desc" data-i18n="set.autosave.d">Save automatically while you type</div></div>
          <div class="switch" id="set-autosave" role="switch"></div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label" data-i18n="set.asDelay">Auto-save delay</div><div class="sr-desc" data-i18n="set.asDelay.d">How long to wait after you stop typing</div></div>
          <div class="range-wrap">
            <input type="range" id="set-asdelay" min="300" max="3000" step="100">
            <span class="range-val" id="set-asdelay-val"></span>
          </div>
        </div>
      </div>

      <div class="settings-card">
        <h3 data-i18n="set.clipboard">Clipboard</h3>
        <div class="settings-sub" data-i18n="set.clipboard.sub">History capture and privacy basics.</div>
        <div class="setting-row">
          <div><div class="sr-label" data-i18n="set.clip.monitor">Clipboard monitoring</div><div class="sr-desc" data-i18n="set.clip.monitor.d">Save a copy of everything you copy</div></div>
          <div class="switch" id="set-clip-monitor" role="switch"></div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label" data-i18n="set.clip.dup">Duplicate copies</div><div class="sr-desc" data-i18n="set.clip.dup.d">Re-copying an item moves it to the top</div></div>
          <div class="select-wrap">
            <select id="set-clip-dup" data-i18n-aria="set.clip.dup" aria-label="Duplicate copies">
              <option value="top" data-i18n="set.clip.dup.top">Move to top (recommended)</option>
              <option value="new" data-i18n="set.clip.dup.new">Keep duplicates</option>
            </select>
          </div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label" data-i18n="set.clip.max">History size</div><div class="sr-desc" data-i18n="set.clip.max.d">Pinned and favorite items are never removed</div></div>
          <div class="select-wrap">
            <select id="set-clip-max" data-i18n-aria="set.clip.max" aria-label="History size">
              <option value="100">100 ${t('items')}</option>
              <option value="500">500 ${t('items')}</option>
              <option value="1000">1,000 ${t('items')}</option>
              <option value="5000">5,000 ${t('items')}</option>
            </select>
          </div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label" data-i18n="set.clip.retention">Time retention</div><div class="sr-desc" data-i18n="set.clip.retention.d">Delete clipboard items older than this</div></div>
          <div class="select-wrap">
            <select id="set-clip-retention" data-i18n-aria="set.clip.retention" aria-label="Time retention">
              <option value="0" data-i18n="set.clip.retention.forever">Keep forever</option>
              <option value="7">${t('set.clip.retention.days', { n: 7 })}</option>
              <option value="30">${t('set.clip.retention.days', { n: 30 })}</option>
              <option value="90">${t('set.clip.retention.days', { n: 90 })}</option>
            </select>
          </div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label" data-i18n="set.clip.skipSens">Skip sensitive captures</div><div class="sr-desc" data-i18n="set.clip.skipSens.d">Never save clipboard content that looks like a password, key or token</div></div>
          <div class="switch" id="set-clip-skip-sens" role="switch"></div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label" data-i18n="set.clip.private">Private mode (this session)</div><div class="sr-desc" data-i18n="set.clip.private.d">Temporarily discard everything you copy — nothing is saved while on</div></div>
          <div class="switch" id="set-clip-private" role="switch"></div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label" data-i18n="set.clip.shortcut">Quick Clipboard shortcut</div><div class="sr-desc" data-i18n="set.clip.shortcut.d">Global shortcut to open quick clipboard</div></div>
          <div class="shortcut-set">
            <input class="prompt-input" id="set-clip-shortcut" style="width:180px" autocomplete="off" spellcheck="false">
            <button class="btn btn-ghost btn-sm" id="set-clip-shortcut-save" data-i18n="qc.save">Save</button>
          </div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label" data-i18n="set.close">Closing the window</div><div class="sr-desc" data-i18n="set.close.d">What happens when you close the main window</div></div>
          <div class="select-wrap">
            <select id="set-close-behavior" data-i18n-aria="set.close.aria" aria-label="Close behavior">
              <option value="ask" data-i18n="set.close.ask">Ask every time</option>
              <option value="tray" data-i18n="set.close.tray">Close to tray (keeps monitoring)</option>
              <option value="quit" data-i18n="set.close.quit">Quit TextVault</option>
            </select>
          </div>
        </div>
      </div>

      <div class="settings-card">
        <h3 data-i18n="set.library">Your Library</h3>
        <div class="settings-sub" data-i18n="set.library.sub">Local data, backup and restore.</div>
        <div class="settings-stats" id="set-stats"></div>
        <div class="setting-row" style="margin-top:10px">
          <div><div class="sr-label" data-i18n="set.dataLocation">Data location</div><div class="sr-desc" data-i18n="set.dataLocation.d">Stored locally in an IndexedDB database inside this folder</div></div>
        </div>
        <div class="setting-row">
          <div class="path-box" id="set-datapath">…</div>
          <button class="btn btn-ghost btn-sm" id="set-openpath">${icon('folder', 14)} <span data-i18n="set.openFolder">Open Folder</span></button>
        </div>
        <div class="setting-row">
          <div><div class="sr-label" data-i18n="set.backupTitle">Backup</div><div class="sr-desc" data-i18n="set.backupDesc">Export texts, clipboard history, snippets and collections as JSON</div></div>
          <button class="btn btn-accent btn-sm" id="set-backup">${icon('upload', 14)} <span data-i18n="set.exportLib">Export Library</span></button>
        </div>
        <div class="setting-row">
          <div><div class="sr-label" data-i18n="set.restoreTitle">Restore</div><div class="sr-desc" data-i18n="set.restoreDesc">Import a TextVault backup (merge or replace) — v1 and v2</div></div>
          <button class="btn btn-ghost btn-sm" id="set-import">${icon('download', 14)} <span data-i18n="set.importLib">Import Library</span></button>
        </div>
      </div>

      <div class="settings-card">
        <h3 data-i18n="set.shortcuts">Keyboard Shortcuts</h3>
        <div class="shortcut-grid">
          ${SHORTCUTS.map(([d, k]) => `<div class="sc-desc" data-i18n="${d}">${t(d)}</div><div class="sc-keys"><kbd>${k}</kbd></div>`).join('')}
        </div>
      </div>

      <div class="settings-card">
        <h3 data-i18n="set.about">About</h3>
        <div class="settings-sub" data-i18n="set.aboutSub">TextVault — a quiet home for every text you copy.</div>
        <div class="setting-row">
          <div class="sr-label" data-i18n="set.version">Version</div>
          <div class="sr-label" id="set-version">1.0.0</div>
        </div>
        <div class="setting-row">
          <div class="sr-label" data-i18n="set.languages">Persian + English</div>
          <div class="sr-desc" style="text-align:right"><span data-i18n="set.bidiSupport">Full bidirectional text support</span><br><span data-i18n="set.madeWith">Made with ❤️</span></div>
        </div>
      </div>
    </div>`;

  els = {
    themeBtns: view.querySelectorAll('[data-theme-opt]'),
    fontBtns: view.querySelectorAll('[data-font-opt]'),
    accentWrap: document.getElementById('set-accent'),
    fontSize: document.getElementById('set-fontsize'),
    fontSizeVal: document.getElementById('set-fontsize-val'),
    wrap: document.getElementById('set-wrap'),
    autoSave: document.getElementById('set-autosave'),
    asDelay: document.getElementById('set-asdelay'),
    asDelayVal: document.getElementById('set-asdelay-val'),
    clipMonitor: document.getElementById('set-clip-monitor'),
    clipDup: document.getElementById('set-clip-dup'),
    clipMax: document.getElementById('set-clip-max'),
    clipRetention: document.getElementById('set-clip-retention'),
    clipSkipSens: document.getElementById('set-clip-skip-sens'),
    clipPrivate: document.getElementById('set-clip-private'),
    clipShortcut: document.getElementById('set-clip-shortcut'),
    clipShortcutSave: document.getElementById('set-clip-shortcut-save'),
    closeBehavior: document.getElementById('set-close-behavior'),
    langBtns: view.querySelectorAll('[data-lang-opt]'),
    stats: document.getElementById('set-stats'),
    dataPath: document.getElementById('set-datapath'),
    version: document.getElementById('set-version'),
  };

  els.themeBtns.forEach((btn) => btn.addEventListener('click', () => {
    App.settings.theme = btn.dataset.themeOpt;
    App.persistSettings();
    applyTheme();
    render();
  }));
  els.fontBtns.forEach((btn) => btn.addEventListener('click', () => {
    App.settings.editorFont = btn.dataset.fontOpt;
    App.persistSettings();
    applyEditorPrefs();
    render();
  }));

  for (const a of ACCENTS) {
    const sw = document.createElement('button');
    sw.className = 'swatch';
    sw.style.background = a.color;
    sw.style.color = a.color;
    sw.title = t('accent.' + a.id);
    sw.dataset.accentId = a.id;
    sw.addEventListener('click', () => {
      App.settings.accent = a.id;
      App.persistSettings();
      applyTheme();
      render();
    });
    els.accentWrap.appendChild(sw);
  }

  els.fontSize.addEventListener('input', () => {
    App.settings.editorFontSize = Number(els.fontSize.value);
    App.persistSettings();
    els.fontSizeVal.textContent = App.settings.editorFontSize + 'px';
    applyEditorPrefs();
  });

  els.wrap.addEventListener('click', () => {
    App.settings.editorWrap = !App.settings.editorWrap;
    App.persistSettings();
    applyEditorPrefs();
    render();
  });
  els.autoSave.addEventListener('click', () => {
    App.settings.autoSave = !App.settings.autoSave;
    App.persistSettings();
    render();
  });
  els.asDelay.addEventListener('input', () => {
    App.settings.autoSaveDelay = Number(els.asDelay.value);
    App.persistSettings();
    els.asDelayVal.textContent = App.settings.autoSaveDelay + 'ms';
  });

  els.clipMonitor.addEventListener('click', async () => {
    App.settings.clipboard.monitorEnabled = !App.settings.clipboard.monitorEnabled;
    App.persistSettings();
    await setMonitorEnabled(App.settings.clipboard.monitorEnabled);
    render();
  });
  els.clipDup.addEventListener('change', () => {
    App.settings.clipboard.duplicatePolicy = els.clipDup.value;
    App.persistSettings();
  });
  els.clipMax.addEventListener('change', () => {
    App.settings.clipboard.maxItems = Number(els.clipMax.value);
    App.persistSettings();
  });
  els.clipRetention.addEventListener('change', () => {
    App.settings.clipboard.retentionDays = Number(els.clipRetention.value);
    App.persistSettings();
  });
  els.clipSkipSens.addEventListener('click', () => {
    App.settings.clipboard.autoClearSensitive = !App.settings.clipboard.autoClearSensitive;
    App.persistSettings();
    render();
  });
  els.clipPrivate.addEventListener('click', async () => {
    const next = !getMonitorState().private;
    await setPrivateMode(next);
    render();
  });
  els.closeBehavior.addEventListener('change', () => {
    App.settings.closeBehavior = els.closeBehavior.value;
    App.persistSettings();
  });

  els.langBtns.forEach((btn) => btn.addEventListener('click', () => {
    if (App.settings.language === btn.dataset.langOpt) return;
    App.settings.language = btn.dataset.langOpt;
    App.persistSettings();
    App.applyLanguage();
    render();
  }));

  els.clipShortcutSave.addEventListener('click', async () => {
    const accel = els.clipShortcut.value.trim();
    const res = await window.tv.setShortcut(accel);
    if (!res.ok) { toastError(res.error || t('err.invalidShortcut')); return; }
    if (!res.registered) {
      toastError(t('settings.shortcutInUse'));
      return;
    }
    App.settings.clipboard.quickShortcut = accel;
    App.persistSettings();
    toast(t('settings.shortcutSaved'));
  });

  document.getElementById('set-openpath').addEventListener('click', () => {
    if (App.appInfo?.userData) window.tv.openPath(App.appInfo.userData);
  });
  document.getElementById('set-backup').addEventListener('click', exportLibrary);
  document.getElementById('set-import').addEventListener('click', importLibrary);

  App.on('entries-changed', () => { if (App.view === 'settings') render(); });
}

/* ---------------- theme helpers (shared with app.js) ---------------- */

export function applyTheme() {
  const theme = App.settings.theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : App.settings.theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = App.settings.accent;
  const quick = document.getElementById('theme-quick-toggle');
  if (quick) quick.innerHTML = icon(theme === 'dark' ? 'sun' : 'moon', 16);
}

/* ---------------- backup / import ---------------- */

async function exportLibrary() {
  try {
    const res = await exportBackup();
    if (!res.ok) {
      if (!res.canceled) toastError(t('settings.backupFailed') + ': ' + (res.error || t('settings.unknownError')));
      return;
    }
    toast(t('set.backedUpToast', { n: formatNumber(res.count), v: res.version }));
  } catch (err) {
    toastError(t('settings.backupFailed') + ': ' + (err.message || t('settings.unknownError')));
  }
}

async function importLibrary() {
  try {
    const res = await window.tv.backupImport({});
    if (!res.ok) {
      if (!res.canceled) toastError(t('settings.importFailed') + ': ' + (res.error || t('settings.noFile')));
      return;
    }
    const count = res.count;
    const mode = await chooseImportMode(count);
    if (!mode) return;
    // Staged import: the whole validated backup is applied through the
    // transactional storage layer (texts, clipboard, snippets, collections).
    const out = await importBackup(res, { mode });
    toast(t('set.importedToast', { n: formatNumber(out.imported) }) + (mode === 'replace' ? t('set.replacedSuffix') : ''));
  } catch (err) {
    toastError(t('settings.importFailed') + ': ' + (err.message || t('settings.unknownError')));
  }
}

function chooseImportMode(count) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h3 class="modal-title">${t('set.importCount', { n: formatNumber(count) })}</h3>
        <div class="modal-body">${t('set.importBody')}<br><br>
          <b>${t('set.importMergeBtn')}</b> — ${t('set.importMerge')}<br>
          <b>${t('set.importReplaceBtn')}</b> — ${t('set.importReplace')}</div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-act="cancel">${t('cancel')}</button>
          <button class="btn btn-ghost-danger" data-act="replace">${t('set.importReplaceBtn')}</button>
          <button class="btn btn-accent" data-act="merge">${t('set.importMergeBtn')}</button>
        </div>
      </div>`;
    const close = (v) => { backdrop.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    backdrop.querySelectorAll('[data-act]').forEach((b) =>
      b.addEventListener('click', () => close(b.dataset.act === 'merge' ? 'merge' : b.dataset.act === 'replace' ? 'replace' : null)));
    document.addEventListener('keydown', onKey, true);
    root.appendChild(backdrop);
  });
}

/* ---------------- render ---------------- */

export function render() {
  if (!els) return;

  els.themeBtns.forEach((b) => b.classList.toggle('active', App.settings.theme === b.dataset.themeOpt));
  els.fontBtns.forEach((b) => b.classList.toggle('active', App.settings.editorFont === b.dataset.fontOpt));
  els.accentWrap.querySelectorAll('.swatch').forEach((s) =>
    s.classList.toggle('active', s.dataset.accentId === App.settings.accent));

  els.fontSize.value = App.settings.editorFontSize;
  els.fontSizeVal.textContent = App.settings.editorFontSize + 'px';
  els.wrap.classList.toggle('on', App.settings.editorWrap);
  els.autoSave.classList.toggle('on', App.settings.autoSave);
  els.asDelay.value = App.settings.autoSaveDelay;
  els.asDelayVal.textContent = App.settings.autoSaveDelay + 'ms';
  els.clipMonitor.classList.toggle('on', App.settings.clipboard?.monitorEnabled !== false);
  els.clipDup.value = App.settings.clipboard?.duplicatePolicy || 'top';
  els.clipMax.value = String(App.settings.clipboard?.maxItems || 1000);
  els.clipRetention.value = String(App.settings.clipboard?.retentionDays ?? 0);
  els.clipSkipSens.classList.toggle('on', !!App.settings.clipboard?.autoClearSensitive);
  els.clipPrivate.classList.toggle('on', !!getMonitorState().private);
  els.clipShortcut.value = App.settings.clipboard?.quickShortcut || 'Control+Shift+V';
  els.closeBehavior.value = App.settings.closeBehavior || 'ask';
  els.langBtns.forEach((b) => b.classList.toggle('active', App.settings.language === b.dataset.langOpt));

  const live = App.liveEntries();
  const trashed = App.trashedEntries();
  const totalChars = live.reduce((acc, e) => acc + (e.stats?.chars ?? 0), 0);
  els.stats.innerHTML = `
    <div class="stat-tile"><div class="st-num">${formatNumber(live.length)}</div><div class="st-label">${t('texts')}</div></div>
    <div class="stat-tile"><div class="st-num">${formatNumber(live.filter((e) => e.favorite).length)}</div><div class="st-label">${t('stat.favorites')}</div></div>
    <div class="stat-tile"><div class="st-num">${formatNumber(App.tagCounts().length)}</div><div class="st-label">${t('stat.tags')}</div></div>
    <div class="stat-tile"><div class="st-num">${formatNumber(totalChars)}</div><div class="st-label">${t('stat.characters')}</div></div>
    <div class="stat-tile"><div class="st-num">${formatNumber(trashed.length)}</div><div class="st-label">${t('stat.inTrash')}</div></div>`;

  if (App.appInfo) {
    els.dataPath.textContent = App.appInfo.userData;
    els.version.textContent = 'v' + App.appInfo.version;
  }
}

export function openSettingsHelp(kind) {
  // menu "about"/"shortcuts" -> jump to settings and scroll to card
  App.setView('settings');
  setTimeout(() => {
    const cards = document.querySelectorAll('#view-settings .settings-card');
    // 0 Appearance · 1 Editor · 2 Clipboard · 3 Library · 4 Shortcuts · 5 About
    const target = kind === 'shortcuts' ? cards[4] : cards[5];
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 60);
}
