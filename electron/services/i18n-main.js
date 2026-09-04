'use strict';

// Synchronous i18n bridge for the main process.
// The shared dictionaries are ESM (shared/i18n.mjs) while the main process is
// CJS, so this module eagerly loads them at startup and exposes a sync t().
// Language changes arrive from the renderer (tv:set-language) and are applied
// here so menus, native dialogs, tray, and export documents follow the
// active UI language.

let mod = null;
let lang = 'en';

async function init() {
  mod = await import('../../shared/i18n.mjs');
  mod.setLanguage(lang);
}

function setLang(next) {
  lang = next === 'fa' ? 'fa' : 'en';
  if (mod) mod.setLanguage(lang);
}

function getLang() {
  return lang;
}

/** Sync translate — returns the key itself if called before init(). */
function t(key, vars) {
  if (!mod) return key;
  return mod.t(key, vars);
}

module.exports = { init, setLang, getLang, t };
