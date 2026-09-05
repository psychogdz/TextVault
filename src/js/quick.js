// Quick Clipboard page: keyboard-first search over the clipboard history.
// Shares the app:// origin and IndexedDB store with the main window — no
// duplicate data, no extra persistence. Copy is explicit (Enter/click);
// Escape hides the window.

import { db } from './core/db.js';
import { parseQuery, matchClipboardItem } from '../../shared/query.mjs';
import { detectContentType } from '../../shared/detect.mjs';
import { escapeHtml } from '../../shared/snippets.mjs';
import { t, setLanguage, getLanguage as getLang, languageDirection } from '../../shared/i18n.mjs';
import { hydrateIcons, icon } from './ui/icons.js';

const els = {};
let items = [];
let selected = 0;
let filtered = [];

async function boot() {
  els.input = document.getElementById('quick-input');
  els.results = document.getElementById('quick-results');
  hydrateIcons(document.body);

  // language + direction from the shared settings store
  let lang = 'en';
  try {
    const settings = await db.getSetting('settings', {});
    lang = settings && settings.language === 'fa' ? 'fa' : 'en';
  } catch { /* defaults */ }
  setLanguage(lang);
  document.documentElement.dir = languageDirection();
  document.documentElement.lang = lang;
  applyI18nDom();

  // Re-apply the persisted language when the launcher is re-shown.
  window.addEventListener('focus', async () => {
    try {
      const s2 = await db.getSetting('settings', {});
      const l2 = s2 && s2.language === 'fa' ? 'fa' : 'en';
      if (l2 !== getLanguageSafe()) {
        setLanguage(l2);
        document.documentElement.dir = languageDirection();
        document.documentElement.lang = l2;
        applyI18nDom();
      }
    } catch { /* settings unavailable */ }
  });

  const stored = await db.listClipboard().catch(() => []);
  items = stored.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  els.input.addEventListener('input', render);
  els.input.addEventListener('keydown', onKey);
  render();
  els.input.focus();
}

function getLanguageSafe() {
  return getLang();
}
void getLanguageSafe;

function applyI18nDom() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
}

function onKey(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    window.tv.quickHide();
    return;
  }
  if (e.key === 'ArrowDown') { e.preventDefault(); move(1); return; }
  if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); return; }
  if (e.key === 'Enter') {
    e.preventDefault();
    const it = filtered[selected];
    if (it) copyItem(it);
  }
}

function move(delta) {
  if (!filtered.length) return;
  selected = (selected + delta + filtered.length) % filtered.length;
  paintSelection();
}

async function copyItem(it) {
  await window.tv.clipboardWrite(it.content);
  window.tv.quickHide();
}

function render() {
  const q = parseQuery(els.input.value);
  const idToName = new Map(); // collections not needed in quick surface
  filtered = q.empty
    ? items.slice(0, 8)
    : items.filter((it) => matchClipboardItem(it, q, idToName, detectContentType)).slice(0, 8);
  selected = 0;
  els.results.innerHTML = '';
  if (!filtered.length) {
    els.results.innerHTML = `<div class="quick-empty">${escapeHtml(t('clip.noMatches'))}</div>`;
    return;
  }
  filtered.forEach((it, i) => {
    const row = document.createElement('div');
    row.className = 'quick-row' + (i === selected ? ' active' : '');
    row.dataset.id = it.id;
    const masked = it.isSensitive;
    row.innerHTML = `
      <div class="quick-preview"></div>
      <div class="quick-meta">
        ${it.isPinned ? icon('pin', 12) : ''}
        ${it.isFavorite ? icon('star-filled', 12) : ''}
        ${masked ? icon('alert', 12) : ''}
      </div>`;
    const p = row.querySelector('.quick-preview');
    if (masked) {
      p.innerHTML = `<span class="clip-masked">${escapeHtml(t('clip.masked'))}</span>`;
    } else {
      p.textContent = it.preview || it.content.slice(0, 160);
    }
    row.addEventListener('click', () => copyItem(it));
    row.addEventListener('mousemove', () => { if (selected !== i) { selected = i; paintSelection(); } });
    els.results.appendChild(row);
  });
}

function paintSelection() {
  [...els.results.children].forEach((el, i) => {
    el.classList.toggle('active', i === selected);
  });
  const active = els.results.children[selected];
  if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
}

boot();
