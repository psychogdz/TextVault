// UI primitives: toasts, modals/confirm dialogs, dropdown menus.
import { icon } from './icons.js';

/* ---------------- Toasts ---------------- */

export function toast(message, { type = 'ok', duration = 2600, action = null } = {}) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const iconName = type === 'ok' ? 'check' : type === 'error' ? 'alert' : 'info';
  el.innerHTML = `<span class="toast-icon">${icon(iconName, 16)}</span><span class="toast-msg"></span>`;
  el.querySelector('.toast-msg').textContent = message;
  if (action) {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      dismiss();
      action.onClick && action.onClick();
    });
    el.appendChild(btn);
  }
  root.appendChild(el);

  let timer = null;
  const dismiss = () => {
    clearTimeout(timer);
    if (!el.isConnected) return;
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 220);
  };
  timer = setTimeout(dismiss, duration);
  el.addEventListener('click', (e) => { if (e.target === el || e.target.classList.contains('toast-msg')) dismiss(); });
  return dismiss;
}

export const toastError = (msg, opts) => toast(msg, { ...opts, type: 'error', duration: 4200 });
export const toastInfo = (msg, opts) => toast(msg, { ...opts, type: 'info' });

/* ---------------- Modal / confirm ---------------- */

export function confirmDialog({
  title = 'Are you sure?',
  message = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
}) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal${danger ? ' danger' : ''}" role="dialog" aria-modal="true">
        <h3 class="modal-title"></h3>
        <div class="modal-body"></div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-act="cancel"></button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-accent'}" data-act="ok"></button>
        </div>
      </div>`;
    backdrop.querySelector('.modal-title').textContent = title;
    const body = backdrop.querySelector('.modal-body');
    // Allow limited inline HTML (<b>) for emphasis; message may contain user text.
    body.innerHTML = message;
    const okBtn = backdrop.querySelector('[data-act="ok"]');
    const cancelBtn = backdrop.querySelector('[data-act="cancel"]');
    okBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;

    const close = (result) => {
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(false); }
      if (e.key === 'Enter') { e.stopPropagation(); close(true); }
    };
    okBtn.addEventListener('click', () => close(true));
    cancelBtn.addEventListener('click', () => close(false));
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(false); });
    document.addEventListener('keydown', onKey, true);
    root.appendChild(backdrop);
    okBtn.focus();
  });
}

/* ---------------- Dropdown menus ---------------- */

/**
 * Build and show a dropdown anchored to a trigger button.
 * items: [{ label, icon, danger, onClick, separator, headerLabel }]
 */
export function showDropdown(anchorEl, items, { align = 'right' } = {}) {
  // Close any existing
  document.querySelectorAll('.dropdown:not(.hidden)').forEach((d) => d.remove());

  const dd = document.createElement('div');
  dd.className = 'dropdown';
  for (const item of items) {
    if (item.separator) {
      const sep = document.createElement('div');
      sep.className = 'dd-sep';
      dd.appendChild(sep);
      continue;
    }
    if (item.headerLabel) {
      const lab = document.createElement('div');
      lab.className = 'dd-label';
      lab.textContent = item.headerLabel;
      dd.appendChild(lab);
      continue;
    }
    const btn = document.createElement('button');
    btn.className = 'dd-item' + (item.danger ? ' danger' : '');
    const lead = item.swatch
      ? `<span class="dd-swatch${item.swatch === 'none' ? ' none' : ''}" style="${item.swatch === 'none' ? '' : `background: var(--card-${item.swatch})`}"></span>`
      : `<span class="dd-icon">${item.icon ? icon(item.icon, 15) : ''}</span>`;
    btn.innerHTML = `${lead}<span class="dd-text"></span>`;
    btn.querySelector('.dd-text').textContent = item.label;
    btn.addEventListener('click', () => { close(); item.onClick && item.onClick(); });
    dd.appendChild(btn);
  }

  if (anchorEl && anchorEl.isConnected) {
    const wrap = anchorEl.closest('.menu-wrap') || anchorEl.parentElement;
    if (align === 'left') dd.style.left = '0';
    // anchored to the bottom floating bar: open upward so it stays on screen
    if (anchorEl.closest('#bulkbar')) dd.classList.add('up');
    wrap.appendChild(dd);
  } else {
    // no anchor: float above the bulk action bar at the bottom center
    dd.style.position = 'fixed';
    dd.style.bottom = '86px';
    dd.style.left = '50%';
    dd.style.transform = 'translateX(-50%)';
    dd.style.right = 'auto';
    document.body.appendChild(dd);
  }
  dd.classList.remove('hidden');

  const close = () => {
    dd.remove();
    document.removeEventListener('mousedown', onDocMouseDown, true);
  };
  const onDocMouseDown = (e) => {
    if (!dd.contains(e.target) && e.target !== anchorEl && !(anchorEl && anchorEl.contains(e.target))) close();
  };
  document.addEventListener('mousedown', onDocMouseDown, true);
  return close;
}

/* ---------------- Formatting helpers ---------------- */

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function timeAgo(ts) {
  if (!ts) return '—';
  const diff = ts - Date.now();
  const min = 60_000, hour = 3_600_000, day = 86_400_000;
  if (Math.abs(diff) < min) return 'just now';
  if (Math.abs(diff) < hour) return rtf.format(Math.round(diff / min), 'minute');
  if (Math.abs(diff) < day) return rtf.format(Math.round(diff / hour), 'hour');
  if (Math.abs(diff) < 30 * day) return rtf.format(Math.round(diff / day), 'day');
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatNumber(n) {
  return Number(n || 0).toLocaleString('en-US');
}
