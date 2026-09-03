# TextVault Pro — Development Roadmap

## 1. Purpose

This document is the official implementation roadmap for transforming the existing TextVault Electron application into **TextVault Pro**: a professional, privacy-first, local-first clipboard and text productivity application.

The roadmap is designed to be executed incrementally by a software development agent.

The project must evolve from the existing application instead of being blindly rewritten from scratch.

The agent must inspect the current implementation, preserve valuable existing functionality, improve weak areas, and introduce the new architecture and features in controlled phases.

This document defines:

* implementation order
* phase boundaries
* feature scope
* technical objectives
* required tests
* documentation requirements
* acceptance criteria
* commit requirements
* stop conditions

---

# 2. Official Phase Model (Authoritative)

The official execution model for TextVault Pro is the **10-phase model** defined in `MASTER_PROMPT.md` and `PROGRESS.md`:

```text
Phase 0  — Repository Baseline
Phase 1  — Core Architecture
Phase 2  — Storage Layer
Phase 3  — Clipboard Engine
Phase 4  — Core Library
Phase 5  — Search & Organization
Phase 6  — UI/UX Polish
Phase 7  — Privacy & Security
Phase 8  — Import / Export / Backup
Phase 9  — Performance & Reliability
Phase 10 — Testing & Release
```

This roadmap previously described a 17-phase sequence. Per the project owner's
decision (2026-09-03), the 10-phase model above is the **only execution
authority**. The former 17 phases have been reconciled into the official model
below without losing requirements, using this mapping:

| Former roadmap phase                     | Official phase where the work now lives |
|------------------------------------------|-----------------------------------------|
| 0 — Existing Project Audit               | Phase 0 — Repository Baseline (**COMPLETE 2026-09-03**, see PROGRESS.md) |
| 1 — Foundation and Architecture          | Phase 1 — Core Architecture |
| 2 — Clipboard Engine and Persistent History | Phase 3 — Clipboard Engine (storage prerequisites in Phase 2) |
| 3 — Search, Filtering and History UX     | Phase 5 — Search & Organization |
| 4 — Organization: Tags, Collections, Favorites | Phase 4 — Core Library (filter integration verified in Phase 5) |
| 5 — Tray, Lifecycle and Application Behavior | Phase 1 (lifecycle architecture), Phase 3 (background monitoring + tray), Phase 6 (tray UX polish) |
| 6 — Quick Clipboard and Keyboard-First Workflow | Phase 6 — UI/UX Polish |
| 7 — Snippets and Reusable Text           | Phase 4 — Core Library |
| 8 — Smart Content Detection              | Phase 4 — Core Library (presentation in Phase 6) |
| 9 — Privacy and Security Controls        | Phase 7 — Privacy & Security |
| 10 — Text Utilities and Transformations  | Phase 4 — Core Library (presentation in Phase 6) |
| 11 — Import, Export and Backup           | Phase 8 — Import / Export / Backup |
| 12 — Settings and Configuration          | Phase 2 (settings storage/service) + Phase 6 (settings UI) |
| 13 — UI Polish, Themes, i18n and RTL     | Phase 6 — UI/UX Polish |
| 14 — Performance and Reliability         | Phase 9 — Performance & Reliability |
| 15 — Advanced Desktop Productivity       | Deferred (post-MVP) — see §16 |
| 16 — Release Hardening                   | Phase 10 — Testing & Release |
| 17 — Post-MVP Optional Features          | Deferred (post-MVP) — see §16 |

If any requirement appears to be lost in this mapping, the former phase text in
Git history (`git show 4945693:docs/ROADMAP.md`) is the recovery reference, and
the conflict must be documented rather than silently dropped.

---

# 3. Roadmap Authority

This roadmap must be used together with the following project documents:

```text
docs/
├── PRODUCT_SPEC.md
├── FEATURES.md
├── UI_PROMPT.md
├── ARCHITECTURE.md
├── ROADMAP.md
├── DEVELOPMENT.md
├── TESTING.md
├── SECURITY.md
├── PROGRESS.md
└── MASTER_PROMPT.md
```

Document responsibilities:

### PRODUCT_SPEC.md

Defines the product vision, principles, scope, users, major capabilities, and long-term direction.

### FEATURES.md

Defines feature priorities and feature-level requirements.

### UI_PROMPT.md

Defines the visual language, interaction design, responsive behavior, accessibility, RTL/LTR behavior, themes, and UI quality requirements.

### ARCHITECTURE.md

Defines the technical architecture, process boundaries, domain/application/infrastructure separation, IPC, storage, security boundaries, and platform strategy.

### ROADMAP.md

Defines implementation order and phase boundaries under the official 10-phase model.

### DEVELOPMENT.md

Defines the development workflow and coding practices.

### TESTING.md

Defines testing strategy and quality requirements.

### SECURITY.md

Defines security and privacy requirements.

### PROGRESS.md

Defines the current project state and completed work.

### MASTER_PROMPT.md

Defines the final agent operating instructions and the official phase model.

If a conflict exists between documents, the agent must not silently ignore it.

The agent must determine the safest interpretation according to the project documentation hierarchy and document important decisions.

---

# 4. Development Philosophy

TextVault Pro must be developed as a real desktop product rather than as a collection of isolated features.

The development priorities are:

1. Correctness
2. Stability
3. Privacy
4. Security
5. Maintainability
6. Performance
7. UX quality
8. Feature completeness

A visually impressive feature that is unreliable must not be considered complete.

A technically sophisticated implementation that creates unnecessary complexity must not be preferred over a simpler reliable implementation.

---

# 5. Phase Execution Rules

Every phase follows this exact lifecycle:

```text
READ
 ↓
INSPECT
 ↓
PLAN
 ↓
IMPLEMENT
 ↓
TEST
 ↓
FIX
 ↓
DOCUMENT
 ↓
COMMIT
 ↓
STOP
```

The agent must follow these rules.

## 5.1 Read first

Before implementing a phase, read:

* `PRODUCT_SPEC.md`
* `FEATURES.md`
* `ARCHITECTURE.md`
* `UI_PROMPT.md`
* `ROADMAP.md`
* `PROGRESS.md`

Also read the relevant sections of:

* `DEVELOPMENT.md`
* `TESTING.md`
* `SECURITY.md`

---

## 5.2 Inspect before modifying

Before changing existing functionality:

* inspect the current implementation
* understand its dependencies
* understand its behavior
* identify existing tests
* identify existing data/storage implications

Do not replace working code simply because it is unfamiliar.

---

## 5.3 Implement only the current phase

The agent must implement only the phase currently assigned.

If a later feature is encountered during implementation:

* do not implement it
* document it if necessary
* continue with the current phase

---

## 5.4 Avoid speculative architecture

Do not introduce abstractions, frameworks, libraries, services, or infrastructure without a concrete current or near-term requirement.

The architecture should be extensible but not unnecessarily over-engineered.

---

## 5.5 Preserve working functionality

Existing features must be classified before removal.

Use:

```text
KEEP
REFACTOR
REWRITE
REPLACE
REMOVE
```

Do not remove functionality solely to simplify development.

---

## 5.6 Test after implementation

Every meaningful phase must include:

* automated tests where practical
* manual verification for desktop-specific behavior
* regression testing
* build verification when relevant

A phase cannot be marked complete while known critical failures remain.

---

## 5.7 Documentation update

At the end of every phase:

* update `PROGRESS.md`
* update affected architecture documentation
* update feature documentation when behavior changes
* update testing documentation when test strategy changes
* update security documentation when security behavior changes

Documentation must describe what actually exists, not what was intended.

---

## 5.8 Commit

Every completed phase must produce a clean Git commit.

Commit messages must be natural and professional. Avoid messages such as
"AI generated" or "wip". Prefer the conventional forms shown in each phase
below (`feat: …`, `refactor: …`, `fix: …`).

---

## 5.9 Stop boundary

After completing the current phase:

1. run tests
2. fix failures
3. update documentation
4. update `PROGRESS.md`
5. commit the phase
6. stop (or continue only under an explicit autonomous-execution authorization
   that requires evaluating the next phase's entry gate first)

Do not skip phase boundaries.

---

# 6. Official Phase 0 — Repository Baseline

**Status: COMPLETE and VERIFIED (2026-09-03).** Evidence, findings, and gate
records live in `docs/PROGRESS.md` §10. The former "Existing Project Audit"
requirements (feature inventory with KEEP/REFACTOR/REWRITE/REPLACE/REMOVE
classification, storage audit input, UI audit input, testing audit) were
satisfied there. Do not repeat this phase.

---

# 7. Official Phase 1 — Core Architecture

## Objective

Establish or correct the core Electron and application architecture while preserving all existing functionality.

## Scope

* Renderer / UI → Application / Domain → Infrastructure dependency direction
* Electron-specific functionality isolated outside domain logic
* Decompose the single-file main process into focused modules
  (protocol, window, menu, IPC, exporters) with `electron/main.js` as a thin
  composition root
* Central, explicit IPC channel definitions shared by preload and main
* Input validation at the IPC boundary for every channel
* Controlled preload API (`window.tv`) — no generic invoke/send exposure
* Application lifecycle architecture: startup sequence, single-instance
  handling, quit/shutdown sequencing, window lifecycle events, navigation
  guard
* Shared contracts for cross-process data (channel names, payload shapes)
* No unrelated refactors; keep the project buildable at each step

## Electron Security Boundary (verify)

```text
contextIsolation: true
nodeIntegration:  false
sandbox:          true
```

Preload must expose only a controlled API. Do not expose `ipcRenderer`, `fs`,
`child_process`, or arbitrary Node APIs directly to the renderer.

## IPC

Explicit validated IPC operations; no unrestricted generic IPC. Every handler
must validate type, structure, required fields, string bounds, and allowed
values before doing privileged work. Renderer-requested filesystem paths must
be allow-listed or dialog-mediated (fix the `tv:open-path` and
`tv:backup-import pathOverride` findings recorded in PROGRESS.md §10.1 D).

## Acceptance Criteria

* Renderer cannot directly access Node APIs.
* Preload is a controlled security boundary with a defined API surface.
* IPC channels are explicit, centralized, and validated at the boundary.
* Main process is decomposed into focused modules without behavior change.
* Application lifecycle has explicit startup/shutdown sequencing and
  single-instance handling.
* Existing critical functionality remains operational (all prior tests pass).
* New architecture/IPC tests pass.
* Application launches successfully.

## Tests

* IPC validator unit tests (valid/invalid/malformed/oversized inputs)
* Architecture boundary tests (preload exposure, channel allowlist)
* Full existing regression suite (syntax, unit, e2e, smoke)

## Documentation

Update `ARCHITECTURE.md` (module map, IPC table, decisions),
`DEVELOPMENT.md`, `TESTING.md` (test commands if changed), `PROGRESS.md`.

## Suggested Commit

```text
refactor(core): establish secure application architecture
```

## Stop Boundary

STOP.

---

# 8. Official Phase 2 — Storage Layer

## Objective

Establish reliable, validated, versioned persistent local storage without replacing IndexedDB unless evidence demands it.

## Scope

* Complete the storage audit begun in Phase 0 and record the KEEP/REFACTOR
  decision for the renderer-side IndexedDB implementation
* Data models and schemas for all supported entities (text entries, settings;
  clipboard/snippet/collection schemas land with their phases)
* Schema versioning + deterministic migration runner (database version record,
  forward-only migrations, failure-safe behavior)
* Record-level validation on write and on read (repair/reject invalid records
  safely)
* Explicit content size limits with safe rejection (no silent truncation)
* Atomic multi-record operations: library import/replace and bulk deletes must
  run inside single IndexedDB transactions (fix the non-transactional replace
  recorded in PROGRESS.md §10.1 F)
* Settings storage as a validated, versioned service with safe defaults
* Storage failures surfaced safely; corrupted-state recovery behavior defined

## Requirements

```text
Fresh installation, existing installation, upgrade, corrupted data,
missing fields, unknown fields — all handled predictably.
No silent data loss. No destructive migration without validation.
Renderer cannot bypass the storage layer.
```

## Acceptance Criteria

* Canonical data source defined; schema documented
* Stable IDs, Unicode-safe persistence, defined timestamp representation
* Migration strategy implemented and tested
* Invalid data cannot corrupt existing state
* Multi-record operations are transactional
* Size limits enforced with understandable errors
* Storage errors handled safely; sensitive content never logged

## Tests

* Migration logic unit tests (pure transform functions)
* Validator unit tests (records, settings, limits)
* E2E restart-persistence regression (existing) extended where needed
* Failure-scenario tests where practical

## Suggested Commit

```text
feat(storage): implement validated persistent storage layer
```

## Stop Boundary

STOP.

---

# 9. Official Phase 3 — Clipboard Engine

## Objective

Build the reliable core clipboard engine: the foundation of TextVault Pro.

## Clipboard Flow

```text
System Clipboard
      ↓
Clipboard Monitor (main process, polling with change detection)
      ↓
Content Extraction / Normalization
      ↓
Privacy Checks (paused? private mode? exclusions?)
      ↓
Sensitive Content Detection (where implemented)
      ↓
Duplicate Policy
      ↓
Persistence (validated, size-limited)
      ↓
Application Event → UI Update
```

## Scope

* Main-process clipboard monitoring (efficient polling; no native deps),
  independent of window visibility
* Text capture with content-type field (plain text now; extensible model)
* Configurable duplicate policy (move-to-top/update timestamp), centralized
* Persistent clipboard history in a dedicated store (schema migration)
* Pause/resume monitoring with obvious UI state; pause respected by ALL
  capture paths
* Background operation: closing the window must not stop monitoring —
  close-to-tray behavior and system tray menu (open, pause/resume, quit) are
  Phase 3 deliverables because background monitoring requires them
* Configurable close behavior (quit vs. minimize/hide to tray)
* Retention hooks (max history size) — full retention UI in later phases
* Sensitive-content handling foundation (detection is a privacy aid, not a
  guarantee; conservative patterns; never destroys data)
* Application exclusions: architecture + rule evaluation implemented; source
  application detection is NOT available without native modules — document
  this limitation and apply exclusions when source is known (currently never)
* Startup behavior hooks (start minimized/hidden where practical)
* Notifications used sparingly; no notification per capture

## Acceptance Criteria

* Clipboard changes are captured reliably, including while the window is hidden
* History persists across window close, app restart, and system restart
* Duplicate captures are controlled by the configured policy
* Delete, bulk delete, clear history work with safeguards
* Favorite/pin state persists
* Paused monitoring never persists new entries (privacy regression test)
* Clipboard content is never executed, never logged, never transmitted
* Application remains stable during long-running monitoring
* Quit fully shuts down monitoring and releases resources

## Tests

* Capture, duplicate handling, persistence, restart recovery
* Deletion, bulk deletion, clear history
* Malformed clipboard data, clipboard access failures
* Pause/resume privacy regression
* Rapid clipboard changes (stress)
* Manual Windows QA: tray, close behavior, background monitoring

## Suggested Commit

```text
feat(clipboard): add persistent clipboard history engine
```

## Stop Boundary

STOP.

---

# 10. Official Phase 4 — Core Library

## Objective

Expand from clipboard history into the reusable content-management experience.

## Scope

### Snippets (from former Phase 7)

* Create, edit, delete, search, copy, favorite, organize snippets
* Metadata: title, content, description, tags, createdAt, updatedAt, favorite
* Persisted, searchable, integrated with quick access
* Variables ({{name}} etc.) remain OUT of scope until explicitly scheduled

### Organization (from former Phase 4)

* Tags: create/rename/delete/assign/remove/suggest/filter — operations must
  not corrupt entries
* Collections: create/rename/delete/add/remove/browse; no data duplication
* Favorites and pins with clearly distinct semantics:
  Favorite = user considers the item important;
  Pin = user wants the item persistently prominent/quickly accessible
* Bulk operations: select multiple, favorite/un-favorite, pin/unpin, tag,
  move to collection, delete

### Smart Content Detection (from former Phase 8)

* Local-only detection of URL / email / phone / IP / file path / JSON / code /
  command / markdown / plain text
* Detection influences presentation and available actions; must never
  execute, download, open, or modify content automatically
* False positives controlled; ambiguous content handled safely

### Text Utilities (from former Phase 10)

* Local transformations: uppercase, lowercase, title case, trim/normalize
  whitespace, sort lines, remove duplicate lines, JSON format/minify,
  Base64 encode/decode, URL encode/decode — only tools that provide value
* Never silently destroy source content; copy/replace only by explicit action
* Each transformation tested for normal/empty/Unicode/Persian/large/malformed
  input

## Acceptance Criteria

* Snippets, collections, tags, favorites, pins persist and are searchable
* Bulk operations are predictable; deletion edge cases handled
* Organization works without data corruption
* Search and filters understand organization metadata
* Detection is accurate enough, fast, local, and user-initiated for actions
* Transformations are correct and source-preserving

## Tests

* Snippet CRUD/search/copy/favorite/persistence/invalid data
* Tag CRUD + assignment; collection CRUD + membership
* Favorite/pin state + bulk operations + deletion edge cases
* Detection: valid/invalid/ambiguous per type; no execution
* Utilities: per-transformation input matrix

## Suggested Commit

```text
feat(library): add snippets, collections, pins and text utilities
```

## Stop Boundary

STOP.

---

# 11. Official Phase 5 — Search & Organization

## Objective

Make all content instantly findable even with thousands of entries.

## Scope (from former Phase 3)

* Unified search across clipboard content, titles, tags, collections, snippets,
  useful metadata
* Fuzzy/tolerant matching where appropriate, performant at scale
* Filters: `tag:…`, `is:fav`, `is:pinned`, `type:text`, content type, date,
  collection — syntax may evolve per implementation
* Sorting: newest, oldest, recently updated, favorites, pinned, relevance
* History interface: visual hierarchy, previews, selected state, keyboard
  navigation, context menus, bulk selection, delete/favorite/pin/copy actions
  (per `UI_PROMPT.md`)
* Detail view for long content that keeps the main list scannable
* Empty results, large result sets, long text handled gracefully
* Persian/English/mixed content search verified; punctuation and numbers
* Avoid unnecessary renderer-side data loading; chunked/incremental search
  retained

## Acceptance Criteria

* Search is fast (~10,000-entry search measured; target ≤100 ms p95 per
  TESTING.md — record actual measurements, do not claim without evidence)
* Search results are understandable; filters and sorting work correctly
* Large history remains usable; keyboard navigation works
* Existing history workflows do not regress

## Tests

* Exact, partial, case-variant, fuzzy search; no-result and large-result sets
* Tag/favorite/pinned/type filters; combined filters; invalid filters
* Sorting orders; empty results
* Persian, English, mixed RTL/LTR search fixtures (existing fixture set)

## Suggested Commit

```text
feat(search): add unified clipboard search and filtering
```

## Stop Boundary

STOP.

---

# 12. Official Phase 6 — UI/UX Polish and Desktop Experience

## Objective

Bring the entire application to the quality defined by `UI_PROMPT.md` and
deliver the keyboard-first desktop surfaces.

## Scope

### Design system & polish (from former Phase 13)

* Centralized design tokens (spacing, typography, radii, colors, shadows,
  motion, z-index); audit consistency across all views
* Light/Dark/System themes; controlled accent colors that preserve contrast
* Loading, empty, error, disabled, selected states everywhere
* Responsive desktop behavior (small laptop → large monitor); no clipped
  content or inaccessible controls
* Accessibility: keyboard navigation, visible focus, accessible names,
  semantic controls, contrast, reduced motion
* Persian typography quality; no emoji as UI icons; professional icon set

### Internationalization & RTL (from former Phase 13)

* Centralized translations for English and Persian; no hard-coded UI strings
  in components
* LTR/RTL layout correctness (logical CSS properties), mixed bidi content,
  dates, numbers

### Quick Clipboard (from former Phase 6)

* Configurable global shortcut opens a compact, search-first launcher window
* Search, recent/favorite/pinned priority, keyboard navigation, Enter to use,
  Escape to close, optional paste behavior
* Usable without the main window; fast (target ≤300 ms shortcut→usable, per
  TESTING.md — measure in Phase 9, do not claim without evidence)

### Command Palette (from former Phase 6)

* Central command registry (id, label, shortcut, category, execute)
* Searchable, keyboard-accessible palette exposing meaningful commands only
* Commands reused by menus/shortcuts where appropriate

### Settings UI (from former Phase 12)

* Grouped sections (General, Clipboard, Privacy, Shortcuts, Appearance,
  Language, Storage, Notifications, Advanced) driven by the settings service
* Validated values, safe defaults, reset behavior, immediate effect where
  appropriate

### Tray UX (from former Phase 5 UX portion)

* Minimal tray menu (Open, Quick Clipboard, Pause/Resume, Settings, Quit)
* Tray behavior verified when window is hidden

## Acceptance Criteria

* Light/Dark/System work; English/Persian work; RTL/LTR work; mixed bidi text
  is readable
* Keyboard navigation works; focus is visible; no keyboard traps
* Quick clipboard opens via global shortcut; Escape closes reliably
* Command palette discovers and executes registered commands
* Settings persist, validate, and reset safely
* UI remains coherent across supported window sizes; no critical UX blocker

## Tests

* Theme switching, language switching, RTL, mixed Persian/English
* Keyboard navigation and focus; reduced motion
* Quick clipboard open/close/search/navigate/select; global shortcut
  registration and conflict handling
* Command discovery and execution; settings load/save/reset/invalid values
* Manual visual QA at multiple window sizes (per `UI_PROMPT.md` §85)

## Suggested Commit

```text
feat(ui): polish interface, add quick clipboard and command palette
```

## Stop Boundary

STOP.

---

# 13. Official Phase 7 — Privacy & Security

## Objective

Make privacy a first-class product feature and perform the dedicated security hardening pass.

## Scope (from former Phase 9 + continuous requirements)

* Clipboard monitoring controls: pause/resume, configurable state, obvious
  paused indication
* Application exclusions: understandable, configurable, fail-safe matching
* Sensitive-content handling: password/token/API-key/private-key-like
  detection, conservative, user-controlled, never claims perfection
* Retention: maximum history size, time-based retention options actually
  supported by the implementation, deterministic cleanup that never deletes
  protected (pinned) data unexpectedly
* Private mode: temporary mode where clipboard content is not persisted;
  clearly communicated state
* Secure logging: never log clipboard content, passwords, tokens, secrets,
  private user data — metadata only
* Security review: Electron settings, preload API, IPC allowlist + validation,
  filesystem paths, import/export, external links, command-execution paths,
  HTML/Markdown handling, network behavior (no unexpected transmission),
  repository secret scan, dependency vulnerabilities
* Update `SECURITY.md` to reflect the implemented behavior

## Acceptance Criteria

* Clipboard monitoring can be paused; paused state never persists entries
* Exclusions work and fail safely
* Sensitive-content behavior is predictable; detection data never leaves device
* Retention works deterministically; private mode works where included
* Sensitive clipboard data never appears in logs
* No unexpected network transmission exists
* Release-blocking security thresholds (SECURITY.md §51) pass

## Tests

* Pause/resume, exclusions, sensitive patterns (synthetic values only),
  retention cleanup, private mode, logging scan, network behavior
* Security regression tests for every fixed issue

## Suggested Commit

```text
feat(security): add privacy controls and sensitive clipboard handling
```

## Stop Boundary

STOP.

---

# 14. Official Phase 8 — Import / Export / Backup

## Objective

Give users complete control over their local data.

## Scope (from former Phase 11)

* Export clipboard history, snippets, tags, collections, metadata — formats:
  JSON (backup), TXT/CSV where supported and stable
* Complete local backup format: documented, versioned, deterministic,
  validated before import; contains everything needed to restore the library
* Import: merge and replace modes; full validation before modifying existing
  data; staged/transactional behavior so malformed input can never partially
  destroy the library
* Restore safety: validate → stage → restore → verify → commit; failure
  preserves previous valid state
* Temporary files use OS temp storage and are cleaned up
* No network transfer of user data at any point

## Acceptance Criteria

* Export, backup, import work correctly; round-trip preserves data
* Invalid/unsupported/malformed files are rejected safely
* Merge and replace both work; data remains consistent
* Interrupted operations do not corrupt the library

## Tests

* Export, import, round-trip comparison; malformed/empty/oversized files
* Missing fields, extra fields, unsupported versions, duplicate records
* Merge, replace, large backups; failure/interruption scenarios

## Suggested Commit

```text
feat(data): add library import export and backup
```

## Stop Boundary

STOP.

---

# 15. Official Phase 9 — Performance & Reliability

## Objective

Make TextVault Pro reliable for long-term daily use; measure, do not guess.

## Scope (from former Phase 14)

* Performance baseline with realistic data volumes (1k / 5k / 10k / 25k where
  practical): startup, clipboard capture→persistence, search, quick clipboard
  launch, memory behavior
* Optimize based on identified bottlenecks only: polling cost, queries,
  rendering, virtualization, event subscriptions, retained content
* Memory: listener/timer leaks, subscriptions, renderer+main growth over time
* Reliability: repeated startup/shutdown, unexpected window close, corrupted
  local data, interrupted writes, large clipboard content, malformed imports,
  long-running background mode
* Crash safety: atomic/staged writes, validation, safe recovery, no
  destructive partial operations
* Compare measurements against `TESTING.md` thresholds; record actual values,
  warnings, and failures in `PROGRESS.md`

## Required Targets (from TESTING.md)

```text
Startup:                       ≤ 2.0 s p95 target;  > 4.0 s p95 fail
Clipboard capture→persistence: ≤ 100 ms p95 target; > 250 ms warn; > 500 ms fail
Search (~10,000 entries):      ≤ 100 ms p95 target; > 200 ms warn; > 500 ms fail
Quick Clipboard:               ≤ 300 ms p95 target; > 500 ms warn; > 1000 ms fail
```

## Acceptance Criteria

* Application remains responsive under realistic history size
* No obvious memory leaks; monitoring stable for long periods
* Startup and quick access remain fast
* Data remains safe during normal failures
* Measurements recorded; regressions investigated before release

## Tests

* Performance tests, memory checks, stress tests, long-running monitoring
  (≥2 hours where the environment permits; otherwise record NOT_RUN with
  reason), repeated restart tests, large data tests, recovery tests

## Suggested Commit

```text
perf: improve application performance and reliability
```

## Stop Boundary

STOP.

---

# 16. Official Phase 10 — Testing & Release

## Objective

Perform final quality validation and prepare a release candidate.

## Scope (from former Phase 16)

* Run the complete test suite (unit, integration where present, E2E, syntax,
  architecture/security tests); verify exit codes; review failures
* Verify security, data-integrity, performance, accessibility, i18n status
* Packaging: portable build + installer; verify installer boots with isolated
  userData, data stays outside the install dir, Start Menu shortcut, silent
  uninstall cleanup (existing `make-release.cjs verify` flow)
* Data safety: existing user data remains accessible, migrations work,
  backup/restore works, uninstall does not destroy user data
* Review documentation, package configuration, release configuration
* Git review: clean tree, no secrets, no accidental files
* Update `PROGRESS.md`; evaluate the release gate

## Acceptance Criteria

* No known critical or high-severity issue remains
* The application is usable as a coherent product
* All release checklist items in `TESTING.md` §74 and `PROGRESS.md` §36 pass
  or are explicitly documented as environment-blocked with reasons

## Suggested Commit

```text
chore: harden TextVault Pro for release
```

## Stop Boundary

STOP.

---

# 17. Deferred (Post-MVP)

These features must not block the core release and must not be implemented
during the official phases unless explicitly scheduled:

## Advanced Desktop Productivity (former Phase 15)

* Sequential paste, advanced clipboard actions, richer command palette,
  advanced filtering, keyboard-driven organization, configurable quick
  actions, more powerful snippet workflows, context-aware actions

## Cloud Sync (former Phase 17a)

* Encrypted sync, multi-device history, conflict resolution, account
  management — must never become mandatory

## AI (former Phase 17b)

* Semantic search, smart categorization, rewriting, summarization — must
  remain optional; clipboard content must never be sent externally without
  explicit consent

## Cross-Platform (former Phase 17c)

* macOS/Linux via platform adapters; must not contaminate the domain layer

---

# 18. Cross-Phase Testing Requirements

Every phase must consider four categories of testing.

## Unit Tests

For: business rules, parsers, transformations, utilities, repositories,
services.

## Integration Tests

For: storage, application services, IPC, Electron integration, settings,
clipboard engine.

## E2E Tests

For critical user workflows such as:

```text
Launch
Capture clipboard
View history
Search
Favorite
Pin
Tag
Delete
Restore
Quick clipboard
Settings
Import
Export
```

---

# 19. Manual Desktop QA

Manual testing is required for platform behavior that automated tests cannot
fully guarantee. Especially:

* global shortcuts
* system tray
* startup
* clipboard integration
* window lifecycle
* packaging
* Windows behavior

---

# 20. Regression Rule

A new phase must not intentionally break completed functionality from previous phases.

If a regression is introduced:

1. identify the root cause
2. fix it
3. add a regression test when practical
4. rerun affected tests
5. update `PROGRESS.md`

Do not mark a phase complete while a known regression remains.

---

# 21. Database Migration Rule

Whenever a phase changes persistent data structures:

1. identify the old schema
2. define the new schema
3. create a migration path
4. test migration
5. test rollback/recovery where practical
6. test existing user data
7. update backup/import compatibility

Never assume a fresh database.

Development must account for users upgrading from previous versions.

---

# 22. Dependency Rule

Before adding a dependency:

Evaluate:

* necessity
* maintenance status
* bundle size
* security
* license
* Electron compatibility
* performance
* long-term value

Do not add a library for functionality that can be implemented safely and simply with the existing stack.

Do not replace major frameworks unless there is a compelling documented reason.

---

# 23. UI Implementation Rule

All UI implementation must follow:

```text
PRODUCT_SPEC.md
FEATURES.md
UI_PROMPT.md
ARCHITECTURE.md
```

The UI must not become a generic web dashboard.

TextVault Pro should feel like a focused desktop utility.

Prioritize:

* fast interaction
* keyboard workflow
* information density
* clarity
* strong hierarchy
* minimal visual noise
* excellent empty/loading/error states
* responsive desktop behavior
* professional typography
* consistent icons
* English/Persian support

---

# 24. Security Rule

Security and privacy are continuous requirements, not a single phase.

Every new feature must answer:

1. Does it expose clipboard data?
2. Does it introduce a new IPC surface?
3. Does it access the filesystem?
4. Does it introduce network communication?
5. Does it store sensitive information?
6. Does it execute user-controlled content?
7. Does it introduce a new dependency?
8. Does it require additional permissions?

If yes, review the relevant security implications before implementation.

---

# 25. Performance Rule

Performance must be considered continuously.

Avoid:

* unnecessary re-renders
* repeated full-history scans
* excessive polling
* unbounded memory retention
* unnecessary serialization
* synchronous expensive operations on the UI thread
* large IPC payloads when avoidable

Use:

* virtualization
* indexing
* pagination where useful
* incremental updates
* debouncing
* efficient event handling
* background work where appropriate

Only optimize based on real bottlenecks or realistic requirements.

---

# 26. Documentation Rule

Documentation must reflect reality.

Never leave documentation claiming that a feature is complete when it is not.

At the end of every phase update:

```text
docs/PROGRESS.md
```

with:

```text
Current Phase
Status
Implemented
Changed
Tests
Known Issues
Architecture Changes
Next Phase
```

The next phase must remain marked as pending until it actually begins.

---

# 27. Git Commit Rule

Each phase should normally produce one logical commit.

If a phase requires multiple commits for a legitimate reason, keep them clean and logically grouped.

Avoid:

```text
wip
test
fix stuff
changes
final final
```

Prefer professional messages:

```text
feat: add persistent clipboard history
refactor: isolate clipboard application services
feat: add quick clipboard launcher
fix: prevent duplicate clipboard captures
perf: optimize history rendering
```

---

# 28. Phase Dependency Map

The official dependency chain is strictly linear:

```text
Phase 0 — Repository Baseline   (COMPLETE 2026-09-03)
        ↓
Phase 1 — Core Architecture
        ↓
Phase 2 — Storage Layer
        ↓
Phase 3 — Clipboard Engine
        ↓
Phase 4 — Core Library
        ↓
Phase 5 — Search & Organization
        ↓
Phase 6 — UI/UX Polish
        ↓
Phase 7 — Privacy & Security
        ↓
Phase 8 — Import / Export / Backup
        ↓
Phase 9 — Performance & Reliability
        ↓
Phase 10 — Testing & Release
        ↓
Deferred — Post-MVP (cloud sync, AI, advanced productivity, cross-platform)
```

Phases must not be reordered without a documented reason approved by the owner.

---

# 29. Definition of Done

A phase is DONE only when all applicable conditions are satisfied.

### Implementation

* [ ] Required functionality implemented
* [ ] Existing functionality preserved where appropriate
* [ ] Architecture respected
* [ ] Security requirements respected
* [ ] UI requirements respected

### Testing

* [ ] Relevant unit tests pass
* [ ] Relevant integration tests pass
* [ ] Relevant E2E tests pass
* [ ] Manual testing completed where required
* [ ] Regression testing completed

### Quality

* [ ] No known critical issue
* [ ] No obvious console errors
* [ ] No obvious memory/resource leak
* [ ] No broken core workflow
* [ ] No unnecessary dead code introduced

### Documentation

* [ ] `PROGRESS.md` updated
* [ ] Relevant documentation updated
* [ ] Architecture changes documented
* [ ] Known limitations documented

### Git

* [ ] Changes reviewed
* [ ] Working tree understood
* [ ] Logical commit created
* [ ] Commit message is professional

### Boundary

* [ ] Current phase complete
* [ ] Next phase NOT implemented
* [ ] Agent stopped (unless autonomous continuation is authorized and the next
      entry gate is evaluated first)

---

# 30. Progress Tracking Format

`PROGRESS.md` maintains the concise implementation state (see its §34 and
§43 formats). Do not mark a phase complete before its acceptance criteria are
satisfied.

---

# 31. Agent Resume Rule

If an agent session ends unexpectedly, the next agent must:

1. read `PROGRESS.md`
2. inspect Git status
3. inspect the latest commits
4. read the current phase requirements
5. inspect unfinished work
6. determine whether the previous phase was actually completed
7. continue only from the documented state

Do not restart completed phases unnecessarily.

Do not assume undocumented work is complete.

---

# 32. Agent Interruption Rule

If the agent encounters:

* an architectural conflict
* destructive migration risk
* unclear product behavior
* security concern
* major dependency issue
* unexpected existing implementation behavior

it should pause the affected work, investigate, and document the issue rather than making a dangerous assumption.

Minor implementation decisions may be made independently when they clearly follow existing documentation and conventions.

---

# 33. Scope Control

The following must NOT become accidental scope creep:

```text
Cloud accounts
Mandatory synchronization
Social features
Chat
Advertising
Analytics-heavy infrastructure
Remote clipboard services
Mandatory AI
Unnecessary backend infrastructure
Complex plugin marketplaces
Large authentication systems
```

The core product should remain:

```text
Fast
Local
Private
Keyboard-first
Reliable
Professional
Extensible
```

---

# 34. Final Product Quality Bar

At the end of the roadmap, TextVault Pro should feel like a mature desktop application.

A user should be able to:

1. Install the application.
2. Launch it.
3. Continue working normally.
4. Copy text as usual.
5. Trust TextVault to retain useful clipboard history locally.
6. Search history immediately.
7. Find old content quickly.
8. Organize important content.
9. Open a quick clipboard interface with a shortcut.
10. Reuse snippets.
11. Transform text locally.
12. Control privacy behavior.
13. Export and back up data.
14. Use the application in English or Persian.
15. Use RTL and mixed-language content naturally.
16. Run it quietly in the background.
17. Configure shortcuts and behavior.
18. Continue using it for long periods without performance degradation.

The product should not feel like:

* a prototype
* a demo
* an AI-generated CRUD application
* a generic SaaS dashboard
* an over-engineered enterprise system

It should feel like a focused, polished desktop productivity tool.

---

# 35. Final Development Principle

The goal is not to implement the largest number of features.

The goal is to build the **best coherent version of TextVault** that can realistically be maintained and trusted.

The correct development sequence is:

```text
Understand the existing product.
        ↓
Build a stable foundation.
        ↓
Make clipboard history reliable.
        ↓
Make retrieval extremely fast.
        ↓
Make organization useful.
        ↓
Make desktop interaction effortless.
        ↓
Make privacy explicit.
        ↓
Add productivity features.
        ↓
Polish the experience.
        ↓
Optimize reliability and performance.
        ↓
Harden the release.
```

Every phase must make the product better without making it unnecessarily complicated.

**Do not optimize for feature count. Optimize for product quality.**
