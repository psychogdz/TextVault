// Virtualized card grid: renders only the visible window of cards.
// Cards have a fixed row height (measured once), laid out in a responsive
// column count — so 1 or 5000 entries cost the same DOM.

export class VirtualGrid {
  /**
   * @param {HTMLElement} viewport  scroll container (.virtual-grid)
   * @param {HTMLElement} inner     absolutely-positioned sizer (.grid-inner)
   * @param {object} opts
   *   minCardWidth, gap, rowHeight (fallback), renderItem(cardEl, item, index),
   *   metrics() — optional callback re-read at every layout so the grid picks
   *   up presentation-driven metrics (e.g. the active UI mode's density
   *   custom properties) without recreating the grid.
   */
  constructor(viewport, inner, opts) {
    this.viewport = viewport;
    this.inner = inner;
    this.minCardWidth = opts.minCardWidth || 300;
    this.gap = opts.gap ?? 16;
    this.rowHeight = opts.rowHeight || 150;
    this.metrics = opts.metrics || null;
    this.renderItem = opts.renderItem;
    this.items = [];
    this.pool = [];      // recycled card elements
    this.live = new Map(); // index -> element
    this.columns = 1;
    this.cardWidth = 300;

    this._onScroll = () => this._render();
    viewport.addEventListener('scroll', this._onScroll, { passive: true });
    this._ro = new ResizeObserver(() => this._layout());
    this._ro.observe(viewport);
  }

  setData(items) {
    this.items = items;
    this._layout();
  }

  destroy() {
    this.viewport.removeEventListener('scroll', this._onScroll);
    this._ro.disconnect();
    this.inner.innerHTML = '';
    this.pool = [];
    this.live.clear();
  }

  refresh() {
    this._layout();
  }

  _layout() {
    // presentation-driven metrics (UI mode density) — read fresh each layout
    if (this.metrics) {
      const m = this.metrics();
      if (m.minCardWidth > 0) this.minCardWidth = m.minCardWidth;
      if (m.gap >= 0) this.gap = m.gap;
      if (m.rowHeight > 0) this.rowHeight = m.rowHeight;
    }
    const w = this.viewport.clientWidth - 2; // scrollbar allowance
    this.columns = Math.max(1, Math.floor((w + this.gap) / (this.minCardWidth + this.gap)));
    this.cardWidth = Math.floor((w - this.gap * (this.columns - 1)) / this.columns);
    const rows = Math.ceil(this.items.length / this.columns);
    this.inner.style.height = `${rows * (this.rowHeight + this.gap)}px`;
    this._render(true);
  }

  _render(rebind = false) {
    const st = this.viewport.scrollTop;
    const vh = this.viewport.clientHeight;
    const rowH = this.rowHeight + this.gap;
    const firstRow = Math.max(0, Math.floor(st / rowH) - 2);
    const lastRow = Math.min(Math.ceil(this.items.length / this.columns), Math.ceil((st + vh) / rowH) + 2);

    const need = new Set();
    for (let row = firstRow; row < lastRow; row++) {
      for (let col = 0; col < this.columns; col++) {
        const idx = row * this.columns + col;
        if (idx < this.items.length) need.add(idx);
      }
    }

    // Remove elements no longer needed -> pool
    for (const [idx, el] of this.live) {
      if (!need.has(idx)) {
        this.live.delete(idx);
        el.remove();
        this.pool.push(el);
      }
    }

    // Create/update needed elements
    for (const idx of need) {
      if (this.live.has(idx)) {
        // Always reposition live elements: column count, card width and row
        // mapping change on window resize/maximize, and recycled elements
        // would otherwise keep their previous transform (broken layout).
        const el = this.live.get(idx);
        this._position(el, idx);
        if (rebind) this.renderItem(el, this.items[idx], idx);
        continue;
      }
      const el = this.pool.pop() || this._makeCard();
      this.live.set(idx, el);
      this.inner.appendChild(el);
      this._position(el, idx);
      this.renderItem(el, this.items[idx], idx);
    }
  }

  _makeCard() {
    const el = document.createElement('div');
    el.className = 'card';
    return el;
  }

  _position(el, idx) {
    const row = Math.floor(idx / this.columns);
    const col = idx % this.columns;
    el.style.width = `${this.cardWidth}px`;
    el.style.height = `${this.rowHeight}px`;
    el.style.transform = `translate(${col * (this.cardWidth + this.gap)}px, ${row * (this.rowHeight + this.gap)}px)`;
  }

  /** Bring a card's entry into view by item index. */
  scrollToIndex(idx) {
    const row = Math.floor(idx / this.columns);
    this.viewport.scrollTop = Math.max(0, row * (this.rowHeight + this.gap) - 40);
  }
}
