# TextVault

A modern, polished desktop application for saving, organizing, searching and exporting every piece of text you copy — with **first-class Persian + English mixed (bidirectional) text support**.

Stop scattering `text.txt` files over your desktop: open TextVault, paste, save. Later, search, view, edit, copy, star, tag and export to **TXT / Word (.docx) / PDF**.

![TextVault](test-output/dashboard.png)

---

## Highlights

| Area | What you get |
|---|---|
| **Quick capture** | Paste into the dashboard bar → `Ctrl+Enter` → saved. Or `+ New Text` for the full editor. |
| **Selection Mode** | Click the ☑ button, press `Ctrl+M`, or click a card's circle badge to enter a dedicated multi-select state: **clicking anywhere on a card toggles its selection** (accent ring + filled circle badge — the editor never opens), with a clear toolbar showing `N selected`, plus **Select All / Clear Selection / Cancel**. `Ctrl+A` selects all, `Esc` cancels, `Delete` deletes the selection (with confirmation) and the toast offers **Undo**. |
| **Card actions** | Hover a card for **⭐ Star** and **🗑 Trash** side-by-side at its top-right. Star toggles favorite only; Trash asks “Delete this text?” (Cancel / **Move to Trash**) and never opens the text — with an **Undo** toast right after. |
| **Card color labels** | Give any text a color (Red / Orange / Yellow / Green / Blue / Purple / Pink) from the 🎨 droplet button in the editor — the card shows a colored stripe on its left edge for quick visual grouping. |
| **Editor tags** | Type new tags, or click the **tag button** next to the tag field to pick from **all existing tags** (with usage counts) — one click adds the exact tag. |
| **Persian + English** | Per-paragraph automatic direction detection (`unicode-bidi: plaintext`), Auto/RTL/LTR override per text, correct display of numbers, URLs, code, symbols, emojis inside RTL text — in the editor, cards, previews, search results, and exported files. |
| **Search** | Instant title/tag search plus full-content search with highlighted snippets, across hundreds/thousands of texts. Supports `tag:python`, `is:fav`. |
| **Editor** | Undo/redo, cut/copy/paste, select-all, find & replace (with match count and case toggle), word-wrap and font toggles, live char/word/line/Ln,Col stats. |
| **Organize** | Tags with sidebar filtering, favorites (⭐ pinned to top), 6 sort orders, multi-select with bulk export/delete/favorite. |
| **Safety** | Debounced auto-save, crash-safe drafts (restored on next launch), Trash with restore/empty, duplicate detection ("this text already exists"), save-before-quit flush. |
| **Export** | Single text → TXT / Word / PDF from the editor or a 1-card selection. Multiple texts → **“One combined file”** or **“Separate file for each text”**, each in TXT / DOCX / PDF. TXT is byte-exact UTF-8; DOCX uses proper `w:bidi`/`w:rtl` paragraph properties; PDF is printed by Chromium with the embedded Vazirmatn font (perfect Arabic shaping & bidi, multi-page). |
| **Backup** | Export/Import the whole library (including Trash) as JSON — merge or replace, Unicode-safe. |
| **Design** | Dark/Light/System themes, 5 accent colors, Vazirmatn typography, virtualized card grid (thousands of entries, bounded DOM), skeleton loading, empty states, toasts, smooth transitions. |

---

## Running the app

### Recommended (no Node.js, no terminal) — the packaged app

The end user never needs Node.js, npm or a command prompt:

1. Extract `dist/TextVault-Portable-1.0.0.zip` (or just copy the `dist/TextVault` folder)
2. Double-click **`TextVault.exe`**

That's it — it's a normal desktop app with its own window and icon.

### On this machine, from the project folder

- **Everyday:** double-click **`TextVault.vbs`** — starts TextVault with **no console window at all**. The app runs as an independent process: closing/killing any launcher or terminal never terminates it. (Prefers the packaged `dist\TextVault\TextVault.exe` if present; otherwise runs the dev copy, installing dependencies silently on first run.)
- **Setup / development:** `start.bat` — same launch, but keeps a visible console (useful for first-time dependency installation and watching logs).

### From source (any machine with Node.js 18+)

```bash
npm install        # downloads Electron + docx (~1–2 minutes, once)
npm start          # launches TextVault
```

### Tests
```bash
npm test           # unit tests (bidi, stats, filenames, snippets, TXT/DOCX/PDF builders)
npm run test:e2e   # full app end-to-end (launches the real window, exports files, screenshots)
```

The e2e suite (70 checks) covers: creating/saving/editing/deleting, Selection Mode (whole-card toggle, select all/clear/cancel, no editor opening, star-only toggling), the card Trash button (confirm/cancel/restore), export through the selection action bar (dropdown opens upward, single TXT, multi combined DOCX, multi separate PDFs), **Undo for bulk delete**, **Ctrl+M**, **tag suggestions**, **card color labels**, **title ellipsis + plaintext bidi on cards**, searching (EN + FA + tags), sorting, favorites, autosave, restart persistence, 850-line texts, 256 entries with a virtualized grid, TXT byte-exactness, DOCX/PDF generation, multi-page PDFs, and backup/import round-trips. Screenshots land in `test-output/`.

---

## Where your data lives

Everything is stored **locally** in an IndexedDB database inside the app's user-data folder (no cloud, no network):

```
%APPDATA%\TextVault\
```

(Settings → *Your Library* → **Data location** shows the exact path and can open the folder.)

IndexedDB is Chromium's embedded, transactional database — it handles thousands of entries without loading them all into the UI (the card grid is virtualized; each record keeps only derived metadata like preview/stats in memory).

---

## Backup & restore

- **Export Library** (Settings, or File menu): writes `TextVault_Backup_<date>.json` containing every entry (including Trash) with full Unicode fidelity.
- **Import Library**: pick a backup, then choose **Merge** (keeps current texts, adds the backup, skips exact duplicates) or **Replace** (restores the backup as the whole library).

---

## How selecting & exporting works

**Selection Mode** — click the ☑ button in the top bar (or a card's checkbox):

- An accent-tinted toolbar appears: *Selection Mode · N selected · Select All · Clear Selection · Cancel*
- Clicking **anywhere on a card** toggles it — selected cards get an accent border, tinted background and check badge
- Clicking a card **never opens the editor** while in this mode
- Star/Trash on cards keep working normally and never select a card
- `Ctrl+A` select all · `Esc` cancel · `Delete` move the selection to Trash (with confirmation)
- The floating action bar offers **Export / Favorite / Delete** for the selection; entering Selection Mode always starts fresh

**Export** — from the editor toolbar (`Ctrl+E`), a card selection, or the action bar:

- **1 text:** *TXT — exact original text* · *Word document (.docx)* · *PDF document*
- **2+ texts:** two clearly labelled groups —
  - *One combined file:* Combined TXT / Combined Word / Combined PDF
  - *Separate file for each text:* Separate TXT / Word / PDF files (you pick a folder; name collisions are auto-deduped `name-1`, `name-2`…)
- Sensible filenames come from each text's title (Windows-unsafe characters sanitized)

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| New text | `Ctrl + N` |
| Save now | `Ctrl + S` |
| Search (dashboard) / Find (editor) | `Ctrl + F` |
| Find & Replace | `Ctrl + H` |
| Export menu | `Ctrl + E` |
| Copy all text | `Ctrl + Shift + C` |
| Undo / Redo | `Ctrl + Z` / `Ctrl + Shift + Z` |
| Toggle theme | `Ctrl + Alt + T` |
| Quick-capture save | `Ctrl + Enter` |
| Toggle selection mode | `Ctrl + M` |
| Selection mode: select all | `Ctrl + A` |
| Delete selected cards | `Delete` |
| Leave selection mode / close panel | `Esc` |

---

## How Persian/English mixed text is handled

This is the core design constraint of TextVault, and it is solved at the engine level rather than with string manipulation:

1. **UI (editor, cards, previews, search snippets):** the whole interface runs on Chromium's Unicode implementation. Text blocks use `unicode-bidi: plaintext`, so **each paragraph's base direction is decided by its own first strong character** — a Persian paragraph lays out RTL, an English paragraph LTR, and mixed lines order correctly by the Unicode Bidirectional Algorithm. No forced document-wide direction, no reversed text.
2. **Direction override:** every text has an Auto/RTL/LTR setting (`Auto` re-resolves as you type based on the first strong character).
3. **Word export:** paragraphs detected RTL-dominant get `w:bidi` (paragraph) + `w:rtl` (run) properties and a complex-script font, so Word renders them right-to-left exactly as the app showed them; LTR paragraphs stay plain.
4. **PDF export:** the PDF is printed by Chromium itself (`printToPDF`) from a styled document with the same `unicode-bidi: plaintext` rules and the embedded **Vazirmatn** font — Arabic shaping and bidi are pixel-identical to the app.
5. **TXT / JSON backups:** content is stored and written as exact UTF-8 (verified byte-for-byte in tests).

Fonts: [Vazirmatn](https://github.com/rastikerdar/vazirmatn) (bundled, `src/assets/fonts/`) for beautiful Persian+Latin typography.

---

## Architecture

```
TextVault.vbs              everyday launcher (no console; prefers packaged exe)
start.bat                  setup/dev launcher (visible console)
dist/TextVault/            packaged portable app (TextVault.exe + resources)
electron/                  Main process (Node)
  main.js                  window, app:// protocol, menu, IPC (dialogs, clipboard),
                           PDF printing (hidden Chromium window), quit-flush handshake
  preload.js               contextBridge API (window.tv) — contextIsolation on, nodeIntegration off
  exporters/
    txt.js                 exact/combined TXT builder
    docx-builder.mjs       Word generation (docx lib, per-paragraph bidi detection)
    pdf-html.mjs           print-view HTML (plaintext bidi, embedded fonts, page breaks)

src/                       Renderer (ES modules, no framework, no build step)
  index.html               app shell (CSP: script/style/font from app: only)
  styles/                  theme tokens (dark/light/accents), base, components, views
  js/
    app.js                 bootstrap: views, sidebar, shortcuts, menus, export flow
    state.js               App singleton: entries cache, settings, persistence, pub/sub
    core/db.js             IndexedDB layer (entries + settings stores, indexes)
    core/entry.js          entry model: derived fields, hashing (SHA-256), validation
    search/search.js       query parser (tag:/is:fav), scoring, snippets
    ui/                    icons, toasts/modals/dropdowns, virtual card grid
    views/                 dashboard, editor, trash, settings

shared/                    pure modules used by BOTH processes (also unit-tested)
  bidi.mjs                 first-strong-character direction detection, RTL ranges
  stats.mjs                code-point-aware char/word/line/byte counts
  snippets.mjs             previews, match indices, highlighted snippets, HTML escaping
  filename.mjs             Windows-safe filename sanitization + dedupe

test/
  unit.mjs                 24 unit tests (incl. DOCX zip/XML inspection, PDF HTML checks)
  e2e.js                   37 end-to-end checks against the real running app
  fixtures.mjs             bilingual fixtures (mixed prompts, code, 850-line document)
```

**Security model:** renderer runs with `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; all file/dialog/clipboard operations go through typed IPC handlers; the CSP blocks all remote origins.

---

## Packaging & distribution

```bash
npm run package
```

builds a self-contained portable app into `dist\TextVault\` (double-click **`TextVault.exe`** — no install, no Node.js, no console) and zips it to `dist\TextVault-Portable-<version>.zip`. The build includes only the production dependency (`docx`), smoke-tests the packaged exe, and was verified to:

- start as a normal GUI process (independent of any launcher/terminal)
- store data in the user's `%APPDATA%\TextVault\` (Electron userData) — never inside the install folder

**Recommended distribution: the portable ZIP** — extract and run; nothing else required. A shortcut to `TextVault.exe` can be pinned to Start/Taskbar for a normal desktop-app experience. (An NSIS installer via `npx electron-builder --win nsis` also works in principle, but its bundled unpacker proved unreliable in this environment — the portable build needs no downloads and is the supported path here.)

Rebuild the ZIP any time with `npm run package`; `TextVault.vbs` automatically prefers the packaged exe when it exists.

---

## License

MIT — bundles [Vazirmatn](https://github.com/rastikerdar/vazirmatn) (OFL).
