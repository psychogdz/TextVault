// Central command registry + command palette (Phase 6).
// Commands are registered once and reused by the palette (and available to
// menus/shortcuts) — the same action is never implemented twice
// (ARCHITECTURE.md §30).

import { App } from './state.js';
import { setPaused, setMonitorEnabled, setPrivateMode, getMonitorState } from './core/clipboard.js';
import { t, setLanguage, languageDirection } from '../../shared/i18n.mjs';
import { icon } from './ui/icons.js';
import { toast } from './ui/components.js';

const registry = new Map();

export function registerCommand({ id, label, icon: iconName, shortcut, category, run, available }) {
  registry.set(id, { id, label, icon: iconName, shortcut, category, run, available });
}

export function listCommands() {
  return [...registry.values()].filter((c) => (c.available ? c.available() : true));
}

export function initCommands({ toggleTheme }) {
  const nav = (id, labelKey, iconName, view) => registerCommand({
    id, label: () => t(labelKey), icon: iconName, category: 'go',
    run: () => App.setView(view),
  });
  nav('go.clipboard', 'nav.clipboard', 'clipboard', 'clipboard');
  nav('go.texts', 'nav.all', 'layers', 'dashboard');
  nav('go.snippets', 'nav.snippets', 'file-text', 'snippets');
  nav('go.collections', 'nav.collections', 'folder', 'collections');
  nav('go.trash', 'nav.trash', 'trash', 'trash');
  nav('go.settings', 'nav.settings', 'settings', 'settings');

  registerCommand({
    id: 'text.new', label: () => t('new.text'), icon: 'plus', shortcut: 'Ctrl+N', category: 'action',
    run: () => App.openEditor(null),
  });
  registerCommand({
    id: 'view.theme', label: () => t('set.theme'), icon: 'moon', shortcut: 'Ctrl+Alt+T', category: 'action',
    run: () => toggleTheme(),
  });
  registerCommand({
    id: 'clip.pause', label: () => (getMonitorState().paused ? t('clip.resume') : t('clip.pause')),
    icon: 'clock', category: 'privacy',
    available: () => getMonitorState().enabled,
    run: async () => {
      const st = getMonitorState();
      await setPaused(!st.paused);
      toast(st.paused ? t('clip.monitoring.active') : t('clip.monitoring.paused'), { type: 'info' });
    },
  });
  registerCommand({
    id: 'clip.enable', label: () => t('set.clip.monitor'), icon: 'clipboard', category: 'privacy',
    run: async () => {
      const st = getMonitorState();
      await setMonitorEnabled(!st.enabled);
      toast(t(st.enabled ? 'clip.monitoring.off' : 'clip.monitoring.active'), { type: 'info' });
    },
  });
  registerCommand({
    id: 'clip.private', label: () => (getMonitorState().private ? 'Private mode: off' : 'Private mode: on'),
    icon: 'info', category: 'privacy',
    run: async () => {
      const st = getMonitorState();
      await setPrivateMode(!st.private);
      toast(!st.private ? 'Private mode on — copies are not saved' : 'Private mode off', { type: 'info' });
    },
  });
  registerCommand({
    id: 'lang.toggle', label: () => t('set.language'), icon: 'direction', category: 'action',
    run: () => {
      App.settings.language = App.settings.language === 'fa' ? 'en' : 'fa';
      App.persistSettings();
      App.applyLanguage();
    },
  });
}

/* ----------------------------- palette UI ----------------------------- */

let paletteState = null; // { q, matches, selected }

export function openCommandPalette() {
  if (paletteState) return;
  const root = document.getElementById('modal-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop palette-backdrop';
  backdrop.innerHTML = `
    <div class="palette" role="dialog" aria-modal="true">
      <div class="palette-inputwrap">
        <span class="search-icon">${icon('command', 15)}</span>
        <input id="palette-input" placeholder="${t('palette.placeholder')}" autocomplete="off" spellcheck="false">
      </div>
      <div class="palette-list" id="palette-list"></div>
    </div>`;
  const input = backdrop.querySelector('#palette-input');
  const list = backdrop.querySelector('#palette-list');
  paletteState = { q: '', matches: [], selected: 0, backdrop, input, list };

  const close = () => {
    document.removeEventListener('keydown', onDocKey, true);
    backdrop.remove();
    paletteState = null;
  };
  const runSelected = () => {
    const cmd = paletteState.matches[paletteState.selected];
    close();
    if (cmd) {
      Promise.resolve(cmd.run()).catch((err) => {
        console.error('Command failed:', err && err.message);
        toast('Command failed', { type: 'error' });
      });
    }
  };
  const onDocKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); runSelected(); }
  };
  const move = (delta) => {
    if (!paletteState.matches.length) return;
    paletteState.selected = (paletteState.selected + delta + paletteState.matches.length) % paletteState.matches.length;
    paint();
  };
  const paint = () => {
    const { matches, selected } = paletteState;
    list.innerHTML = '';
    matches.forEach((cmd, i) => {
      const row = document.createElement('button');
      row.className = 'palette-row' + (i === selected ? ' active' : '');
      row.innerHTML = `<span class="palette-icon">${icon(cmd.icon || 'command', 15)}</span><span class="palette-label"></span>${cmd.shortcut ? `<kbd class="kbd">${cmd.shortcut}</kbd>` : ''}`;
      row.querySelector('.palette-label').textContent = typeof cmd.label === 'function' ? cmd.label() : cmd.label;
      row.addEventListener('click', () => { paletteState.selected = i; runSelected(); });
      row.addEventListener('mousemove', () => { if (paletteState.selected !== i) { paletteState.selected = i; paint(); } });
      list.appendChild(row);
    });
    if (!matches.length) {
      list.innerHTML = `<div class="palette-empty">${t('clip.noMatches')}</div>`;
    }
    const active = list.children[paletteState.selected];
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
  };
  const recompute = () => {
    paletteState.q = input.value.trim().toLowerCase();
    paletteState.matches = listCommands().filter((c) => {
      const label = (typeof c.label === 'function' ? c.label() : c.label).toLowerCase();
      return !paletteState.q || label.includes(paletteState.q) || c.id.includes(paletteState.q);
    }).slice(0, 12);
    paletteState.selected = 0;
    paint();
  };

  input.addEventListener('input', recompute);
  document.addEventListener('keydown', onDocKey, true);
  root.appendChild(backdrop);
  recompute();
  input.focus();
}
