'use strict';

const { app, BrowserWindow, Menu, ipcMain, dialog, shell, clipboard, protocol, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const TEST_DIR = process.env.TEXTVAULT_TEST_DIR || null;

// Test/verification hook: redirect userData (must run before app is ready).
if (process.env.TEXTVAULT_USER_DATA) {
  app.setPath('userData', process.env.TEXTVAULT_USER_DATA);
}

// If ELECTRON extra resources are used (packaged app), src lives in resources/app.asar —
// protocol.handle can read from asar transparently via fs streams.

let mainWindow = null;
let quitting = false;
let flushed = true;

/* ---------------------------------------------------------------- protocol */

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

function registerAppProtocol() {
  const sharedRoot = path.join(ROOT, 'shared');
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    // Renderer imports of ../../shared/*.mjs clamp to app://./shared/... —
    // those modules live at the project root, not under src/.
    let target;
    if (rel === 'shared' || rel.startsWith('shared/')) {
      target = path.normalize(path.join(sharedRoot, rel.slice('shared/'.length) || '.'));
      if (!target.startsWith(sharedRoot)) {
        return new Response('Forbidden', { status: 403 });
      }
    } else {
      target = path.normalize(path.join(SRC_DIR, rel));
      if (!target.startsWith(SRC_DIR)) {
        return new Response('Forbidden', { status: 403 });
      }
    }
    return net.fetch(pathToFileURL(target).toString()).then((response) => {
      // never serve app resources from cache — edits must apply on next launch
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store');
      return new Response(response.body, { status: response.status, headers });
    });
  });
}

/* ----------------------------------------------------------------- window */

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 620,
    show: false,
    backgroundColor: '#0d0f14',
    title: 'TextVault',
    autoHideMenuBar: false,
    icon: path.join(SRC_DIR, 'assets', 'icons', 'textvault.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Portable-package smoke test: launch, wait for the renderer to signal
  // readiness, then exit 0 (or non-zero if the page errors out).
  if (process.env.TEXTVAULT_SMOKE) {
    let failed = false;
    mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
      console.error(`SMOKE did-fail-load ${code} ${desc} ${url}`);
      failed = true;
      app.exit(1);
    });
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
      console.error('SMOKE renderer gone:', details.reason);
      app.exit(1);
    });
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const ok = await mainWindow.webContents.executeJavaScript(
            '!!(window.__TV_TEST__ || document.querySelector(\'#app\'))', true);
          console.log(ok ? 'SMOKE OK' : 'SMOKE no-app');
          app.exit(failed || !ok ? 1 : 0);
        } catch (err) {
          console.error('SMOKE eval failed:', err.message);
          app.exit(1);
        }
      }, 2500);
    });
  }

  mainWindow.loadURL(process.env.TEXTVAULT_E2E
    ? 'app://./index.html?e2e=1'
    : 'app://./index.html');

  mainWindow.on('closed', () => { mainWindow = null; });

  // Give the renderer a chance to flush pending auto-saves before closing.
  mainWindow.on('close', (event) => {
    if (quitting || flushed || mainWindow.isDestroyed()) return;
    event.preventDefault();
    mainWindow.webContents.send('tv:flush');
    const started = Date.now();
    const poll = setInterval(() => {
      if (flushed || Date.now() - started > 4000) {
        clearInterval(poll);
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
      }
    }, 120);
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

/* ------------------------------------------------------------------- menu */

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: '&File',
      submenu: [
        { label: 'New Text', accelerator: 'CmdOrCtrl+N', click: () => send('menu', 'new') },
        { type: 'separator' },
        { label: 'Export Library…', click: () => send('menu', 'backup-export') },
        { label: 'Import Library…', click: () => send('menu', 'backup-import') },
        { type: 'separator' },
        { role: isMac ? 'close' : 'quit' },
      ],
    },
    {
      label: '&Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '&View',
      submenu: [
        { label: 'Toggle Theme', accelerator: 'CmdOrCtrl+Alt+T', click: () => send('menu', 'theme') },
        { type: 'separator' },
        { role: 'reload' }, { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: '&Help',
      submenu: [
        { label: 'Keyboard Shortcuts', click: () => send('menu', 'shortcuts') },
        { label: 'About TextVault', click: () => send('menu', 'about') },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ---------------------------------------------------------------- exports */

const exporters = {
  txt: require('./exporters/txt.js'),
  docx: null, // loaded async (ESM)
  pdf: null,
};
const pdfHtmlModule = { build: null };

async function ensureAsyncExporters() {
  if (!exporters.docx) {
    const mod = await import('./exporters/docx-builder.mjs');
    exporters.docx = mod;
  }
  if (!pdfHtmlModule.build) {
    const mod = await import('./exporters/pdf-html.mjs');
    pdfHtmlModule.build = mod.buildPdfHtml;
  }
}

async function readClipboardText() {
  return clipboard.readText();
}

function writeTextFileSafe(filePath, contents, encoding) {
  const tmp = filePath + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, contents, encoding);
  fs.renameSync(tmp, filePath);
}

/** Pick a destination through a save dialog (skipped in test mode). */
async function pickSavePath(defaultName, extLabel, filters, multi = false) {
  if (TEST_DIR) return path.join(TEST_DIR, defaultName);
  const opts = {
    title: `Export as ${extLabel}`,
    defaultPath: defaultName,
    filters,
    properties: ['createDirectory', 'dontAddToRecent'],
  };
  if (multi) {
    const res = await dialog.showOpenDialog(mainWindow, { ...opts, properties: ['openDirectory', 'createDirectory', 'dontAddToRecent'] });
    return res.canceled ? null : res.filePaths[0];
  }
  const res = await dialog.showSaveDialog(mainWindow, opts);
  return res.canceled ? null : res.filePath;
}

const EXT_FILTERS = {
  txt: [{ name: 'Text File', extensions: ['txt'] }],
  docx: [{ name: 'Word Document', extensions: ['docx'] }],
  pdf: [{ name: 'PDF Document', extensions: ['pdf'] }],
  json: [{ name: 'TextVault Backup', extensions: ['json'] }],
};

let fontCache = null;
async function loadFontsBase64() {
  if (fontCache) return fontCache;
  const dir = path.join(SRC_DIR, 'assets', 'fonts');
  const read = (f) => fsp.readFile(path.join(dir, f)).then((b) => b.toString('base64'));
  const [regular, bold] = await Promise.all([read('Vazirmatn-Regular.woff2'), read('Vazirmatn-Bold.woff2')]);
  fontCache = { regular, bold };
  return fontCache;
}

async function generatePdf(entries) {
  const fonts = await loadFontsBase64();
  const html = pdfHtmlModule.build(entries, { fonts });
  const tmpPath = path.join(os.tmpdir(), `textvault-print-${Date.now()}.html`);
  await fsp.writeFile(tmpPath, html, 'utf8');
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } });
  try {
    await win.loadFile(tmpPath);
    // Give embedded fonts a moment to be ready before rasterizing.
    await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)', true);
    const buffer = await win.webContents.printToPDF({
      // Page size + margins come from the print HTML's @page rule
      // (passing a margins object is broken on this Electron build).
      preferCSSPageSize: true,
      printBackground: true,
    });
    return buffer;
  } finally {
    win.destroy();
    fsp.unlink(tmpPath).catch(() => {});
  }
}

ipcMain.handle('tv:export', async (_ev, payload) => {
  try {
    await ensureAsyncExporters();
    const { kind, mode, entries, defaultName } = payload;
    if (!['txt', 'docx', 'pdf'].includes(kind) || !Array.isArray(entries) || entries.length === 0) {
      return { ok: false, error: 'Invalid export request.' };
    }

    const sanitizedDefault = defaultName ? path.basename(defaultName) : null;

    if (mode === 'separate') {
      // One file per text, into a directory.
      let dir;
      if (TEST_DIR) {
        dir = TEST_DIR;
      } else {
        const dirRes = await dialog.showOpenDialog(mainWindow, {
          title: 'Choose a folder for the exported files',
          properties: ['openDirectory', 'createDirectory', 'dontAddToRecent'],
        });
        if (dirRes.canceled || !dirRes.filePaths[0]) return { ok: false, canceled: true };
        dir = dirRes.filePaths[0];
      }
      const { uniqueFilename } = await import('../shared/filename.mjs');
      const used = new Set();
      let n = 0;
      for (const entry of entries) {
        const base = uniqueFilename(sanitizeTitle(entry.title), kind, used);
        const target = path.join(dir, base);
        let bytes;
        if (kind === 'txt') bytes = Buffer.from(entry.content, 'utf8');
        else if (kind === 'docx') bytes = await exporters.docx.buildDocxBuffer([entry], { combined: false });
        else bytes = await generatePdf([entry]);
        writeTextFileSafe(target, bytes);
        n++;
      }
      return { ok: true, path: dir, count: n };
    }

    // mode 'single' or 'combined' → exactly one output file.
    const combined = entries.length > 1;
    let bytes, name;
    if (kind === 'txt') {
      bytes = Buffer.from(exporters.txt.buildTxt(entries, { combined }), 'utf8');
    } else if (kind === 'docx') {
      bytes = await exporters.docx.buildDocxBuffer(entries, { combined });
    } else {
      bytes = await generatePdf(entries);
    }
    name = sanitizedDefault
      || (combined ? `TextVault_Export_${entries.length}_texts.${kind}` : `${sanitize(entries)}.${kind}`);
    const target = await pickSavePath(name, kind.toUpperCase(), EXT_FILTERS[kind]);
    if (!target) return { ok: false, canceled: true };
    writeTextFileSafe(withExt(target, kind), bytes);
    return { ok: true, path: withExt(target, kind), count: entries.length };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
});

function sanitize(entries) {
  const first = entries[0];
  const base = sanitizeTitle(first && first.title ? first.title : 'text');
  return entries.length > 1 ? `${base}_and_${entries.length - 1}_more` : base;
}

function sanitizeTitle(title) {
  // synced with shared/filename.mjs sanitizeFilename
  let s = String(title || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
  if (s.length > 80) s = s.slice(0, 80).trim().replace(/[. ]+$/g, '');
  return s || 'text';
}

function withExt(p, ext) {
  return p.toLowerCase().endsWith('.' + ext) ? p : `${p}.${ext}`;
}

function describeError(err) {
  return err && err.message ? err.message : String(err);
}

/* ----------------------------------------------------------- backup/rest */

function backupPayloadValid(data) {
  return data && typeof data === 'object' && data.format === 'textvault-backup'
    && typeof data.version === 'number' && Array.isArray(data.entries);
}

ipcMain.handle('tv:backup-export', async (_ev, { entries }) => {
  try {
    const stamp = new Date().toISOString().slice(0, 10);
    const payload = {
      format: 'textvault-backup',
      version: 1,
      app: 'TextVault',
      exportedAt: new Date().toISOString(),
      entries,
    };
    const json = JSON.stringify(payload, null, 2);
    const target = await pickSavePath(`TextVault_Backup_${stamp}.json`, 'JSON', EXT_FILTERS.json);
    if (!target) return { ok: false, canceled: true };
    writeTextFileSafe(withExt(target, 'json'), json, 'utf8');
    return { ok: true, path: withExt(target, 'json'), count: entries.length };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
});

ipcMain.handle('tv:backup-import', async (_ev, { pathOverride } = {}) => {
  try {
    let filePath = pathOverride;
    if (!filePath) {
      if (TEST_DIR) return { ok: false, canceled: true };
      const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Import TextVault backup',
        filters: EXT_FILTERS.json,
        properties: ['openFile', 'dontAddToRecent'],
      });
      if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
      filePath = res.filePaths[0];
    }
    const raw = await fsp.readFile(filePath, 'utf8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return { ok: false, error: 'The selected file is not valid JSON — it may be corrupted.' };
    }
    if (!backupPayloadValid(data)) {
      return { ok: false, error: 'This file is not a TextVault backup (unexpected format).' };
    }
    return { ok: true, entries: data.entries, count: data.entries.length, exportedAt: data.exportedAt };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
});

/* --------------------------------------------------------------- misc ipc */

ipcMain.handle('tv:clipboard-read', () => clipboard.readText());
ipcMain.handle('tv:clipboard-write', (_ev, text) => { clipboard.writeText(String(text ?? '')); return true; });
ipcMain.handle('tv:app-info', () => ({
  version: app.getVersion(),
  userData: app.getPath('userData'),
  platform: process.platform,
}));
ipcMain.handle('tv:open-path', (_ev, p) => { if (typeof p === 'string' && p) shell.openPath(p); });
ipcMain.handle('tv:flushed', () => { flushed = true; });
ipcMain.on('tv:flushed', () => { flushed = true; });
ipcMain.handle('tv:mark-dirty', () => { flushed = false; });

app.on('before-quit', () => { quitting = true; });

/* ------------------------------------------------------------ app launch */

app.whenReady().then(() => {
  registerAppProtocol();
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
