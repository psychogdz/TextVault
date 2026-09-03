'use strict';

// Custom app:// protocol: serves the renderer from src/ and shared/ with
// strict path containment (no traversal outside those roots), no caching so
// edits apply on the next launch.

const path = require('node:path');
const { protocol, net } = require('electron');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..', '..');
const SRC_DIR = path.join(ROOT, 'src');
const SHARED_ROOT = path.join(ROOT, 'shared');

function registerAppProtocol() {
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    // Renderer imports of ../../shared/*.mjs clamp to app://./shared/... —
    // those modules live at the project root, not under src/.
    let target;
    if (rel === 'shared' || rel.startsWith('shared/')) {
      target = path.normalize(path.join(SHARED_ROOT, rel.slice('shared/'.length) || '.'));
      if (!target.startsWith(SHARED_ROOT)) {
        return new Response('Forbidden', { status: 403 });
      }
    } else {
      target = path.normalize(path.join(SRC_DIR, rel));
      if (!target.startsWith(SRC_DIR)) {
        return new Response('Forbidden', { status: 403 });
      }
    }
    return net.fetch(pathToFileURL(target).toString()).then((response) => {
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store');
      return new Response(response.body, { status: response.status, headers });
    });
  });
}

module.exports = { registerAppProtocol };
