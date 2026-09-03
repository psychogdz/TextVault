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

# 2. Roadmap Authority

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

Defines implementation order and phase boundaries.

### DEVELOPMENT.md

Defines the development workflow and coding practices.

### TESTING.md

Defines testing strategy and quality requirements.

### SECURITY.md

Defines security and privacy requirements.

### PROGRESS.md

Defines the current project state and completed work.

### MASTER_PROMPT.md

Defines the final agent operating instructions and references the rest of the documentation.

If a conflict exists between documents, the agent must not silently ignore it.

The agent must determine the safest interpretation according to the project documentation hierarchy and document important decisions.

---

# 3. Development Philosophy

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

# 4. Phase Execution Rules

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

## 4.1 Read first

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

when those documents exist.

---

## 4.2 Inspect before modifying

Before changing existing functionality:

* inspect the current implementation
* understand its dependencies
* understand its behavior
* identify existing tests
* identify existing data/storage implications

Do not replace working code simply because it is unfamiliar.

---

## 4.3 Implement only the current phase

The agent must implement only the phase currently assigned.

If a later feature is encountered during implementation:

* do not implement it
* document it if necessary
* continue with the current phase

Example:

If Phase 3 encounters functionality that belongs to Phase 7, do not implement Phase 7.

---

## 4.4 Avoid speculative architecture

Do not introduce abstractions, frameworks, libraries, services, or infrastructure without a concrete current or near-term requirement.

The architecture should be extensible but not unnecessarily over-engineered.

---

## 4.5 Preserve working functionality

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

## 4.6 Test after implementation

Every meaningful phase must include:

* automated tests where practical
* manual verification for desktop-specific behavior
* regression testing
* build verification when relevant

A phase cannot be marked complete while known critical failures remain.

---

## 4.7 Documentation update

At the end of every phase:

* update `PROGRESS.md`
* update affected architecture documentation
* update feature documentation when behavior changes
* update testing documentation when test strategy changes
* update security documentation when security behavior changes

Documentation must describe what actually exists, not what was intended.

---

## 4.8 Commit

Every completed phase must produce a clean Git commit.

Commit messages must be natural and professional.

Avoid:

```text
AI generated
Generated by Claude
Implemented from prompt
Agent completed phase
```

Prefer:

```text
feat: add persistent clipboard history
refactor: separate clipboard application services
feat: add clipboard search and filtering
fix: prevent duplicate clipboard captures
```

---

## 4.9 Stop boundary

After completing the current phase:

1. run tests
2. fix failures
3. update documentation
4. update `PROGRESS.md`
5. commit the phase
6. stop

Do not automatically continue to the next phase.

---

# 5. Phase 0 — Existing Project Audit

## Objective

Understand the existing TextVault implementation before making major architectural changes.

This phase is primarily investigative.

No large rewrite should occur during this phase.

---

## Scope

Inspect:

```text
electron/
src/
shared/
test/
package.json
README.md
installer.iss
start.bat
```

Also inspect:

* build configuration
* Electron configuration
* scripts
* dependencies
* storage implementation
* preload
* IPC
* renderer state
* clipboard handling
* shortcuts
* tray behavior
* settings
* import/export
* testing setup

---

## Existing Feature Audit

Create an inventory of existing functionality.

Each feature must be classified as:

```text
KEEP
REFACTOR
REWRITE
REPLACE
REMOVE
UNKNOWN
```

Evaluate existing:

* clipboard capture
* dashboard
* history
* favorites
* trash
* undo
* tags
* search
* filters
* editor
* text utilities
* export
* backup
* import
* themes
* language support
* RTL behavior
* shortcuts
* tray behavior
* autosave
* crash safety
* notifications
* responsive layout
* tests

---

## Storage Audit

Inspect the existing IndexedDB implementation.

Document:

* database name
* object stores
* fields
* indexes
* migrations
* serialization
* duplicate handling
* deletion behavior
* backup format
* import format

Do not replace storage unless there is a demonstrated reason.

---

## UI Audit

Inspect:

* application shell
* navigation
* history interface
* editor
* cards
* dialogs
* menus
* settings
* notifications
* themes
* typography
* RTL
* responsive behavior
* accessibility
* keyboard navigation

Identify major UX problems.

---

## Testing Audit

Determine:

* unit tests
* integration tests
* E2E tests
* missing critical coverage
* obsolete tests
* flaky tests
* test infrastructure weaknesses

---

## Deliverables

Update:

```text
docs/PROGRESS.md
```

with:

* existing architecture summary
* feature inventory
* KEEP/REFACTOR/REWRITE/REPLACE/REMOVE decisions
* storage findings
* UI findings
* testing findings
* risks
* recommended migration strategy

---

## Acceptance Criteria

Phase 0 is complete when:

* the repository is understood
* existing major functionality is inventoried
* storage is understood
* Electron boundaries are understood
* UI architecture is understood
* testing gaps are understood
* migration risks are documented

No major rewrite should have started.

---

## Suggested Commit

```text
docs: audit existing TextVault implementation
```

---

## Stop Boundary

STOP.

Do not begin Phase 1.

---

# 6. Phase 1 — Foundation and Architecture

## Objective

Introduce the target application architecture while preserving existing functionality.

---

## Scope

Establish:

```text
Renderer / UI
      ↓
Application / Use Cases
      ↓
Domain
      ↓
Infrastructure
```

Electron-specific functionality must remain outside the domain layer.

---

## Electron Security Boundary

Verify:

```text
contextIsolation: true
nodeIntegration: false
```

Preload must expose only a controlled API.

Do not expose:

* `ipcRenderer`
* `fs`
* `child_process`
* arbitrary Node APIs

directly to the renderer.

---

## IPC

Create explicit typed IPC operations.

Avoid unrestricted generic IPC.

Operations should represent actual application capabilities such as:

```text
clipboard:get-history
clipboard:delete
clipboard:clear
clipboard:search
settings:get
settings:update
app:minimize
app:quit
```

Exact naming may follow the existing project conventions.

---

## Shared Contracts

Create shared contracts for relevant:

* clipboard entries
* settings
* tags
* collections
* snippets
* queries
* pagination
* errors
* application events
* IPC messages

---

## Domain Layer

Domain models and business rules must not depend on:

* Electron
* React
* IndexedDB
* DOM APIs
* renderer implementation details

---

## Application Layer

Introduce use cases/services where justified.

Potential examples:

```text
CreateClipboardEntry
GetClipboardHistory
SearchClipboard
DeleteClipboardEntry
ClearClipboardHistory
ToggleFavorite
TogglePin
UpdateSettings
ExportLibrary
ImportLibrary
```

Only create services that provide real value.

---

## Repository Interfaces

Define storage-independent repository contracts.

Potential repositories:

```text
ClipboardRepository
SettingsRepository
TagRepository
CollectionRepository
SnippetRepository
```

Do not implement unused repositories just for theoretical completeness.

---

## Error Handling

Establish a consistent error model.

Errors must:

* be predictable
* be handled at appropriate boundaries
* avoid leaking sensitive information
* provide useful user-facing messages where appropriate
* be logged safely

---

## Acceptance Criteria

* Renderer cannot directly access Node APIs.
* Preload is a controlled security boundary.
* IPC is explicit.
* Shared contracts exist.
* Domain logic is UI-independent.
* Application logic is separated from storage.
* Existing critical functionality remains operational.
* Existing tests remain useful.

---

## Tests

Verify:

* application startup
* renderer startup
* preload API
* IPC
* basic storage
* existing critical workflows

---

## Documentation

Update:

```text
ARCHITECTURE.md
DEVELOPMENT.md
PROGRESS.md
```

where required.

---

## Suggested Commit

```text
refactor: establish application architecture boundaries
```

---

## Stop Boundary

STOP.

---

# 7. Phase 2 — Clipboard Engine and Persistent History

## Objective

Build the reliable core clipboard engine.

This is the foundation of TextVault Pro.

---

## Clipboard Flow

Implement the conceptual flow:

```text
System Clipboard
      ↓
Clipboard Monitor
      ↓
Content Extraction
      ↓
Normalization
      ↓
Privacy Checks
      ↓
Sensitive Content Detection
      ↓
Duplicate Policy
      ↓
Persistence
      ↓
Application Event
      ↓
UI Update
```

---

## Clipboard Monitoring

Requirements:

* background monitoring
* efficient polling or event strategy
* duplicate event prevention
* failure recovery
* configurable monitoring
* safe shutdown
* no excessive CPU usage

---

## Clipboard Model

The model should support future extensibility.

At minimum consider:

```text
id
content
contentType
createdAt
updatedAt
sourceApplication
sourceTitle
isFavorite
isPinned
isSensitive
metadata
```

Use the architecture specification as the final authority for the actual implementation.

---

## Persistence

Clipboard history must survive:

* window close
* tray operation
* application restart
* system restart

---

## Duplicate Handling

Identical clipboard content should not unnecessarily flood history.

Implement a predictable duplicate policy.

---

## History Management

Implement reliable:

* viewing
* deletion
* bulk deletion
* clearing
* favorite
* pin

Trash/restore behavior should remain compatible with the existing product where applicable.

---

## Acceptance Criteria

* Clipboard changes are captured reliably.
* History persists.
* Duplicate captures are controlled.
* Delete works.
* Bulk delete works.
* Clear history works.
* Favorite/pin state persists.
* Application remains stable during long-running clipboard monitoring.

---

## Tests

Test:

* clipboard capture
* duplicate handling
* persistence
* restart recovery
* deletion
* bulk deletion
* clear history
* malformed clipboard data
* clipboard access failures
* long-running monitoring

---

## Documentation

Update:

```text
PROGRESS.md
ARCHITECTURE.md
TESTING.md
SECURITY.md
```

where relevant.

---

## Suggested Commit

```text
feat: build persistent clipboard history engine
```

---

## Stop Boundary

STOP.

---

# 8. Phase 3 — Search, Filtering and History UX

## Objective

Make clipboard history useful even when thousands of entries exist.

---

## Search

Search should support:

* clipboard content
* titles
* tags
* useful metadata

Implement fuzzy matching where appropriate.

Search must remain responsive for realistic history sizes.

---

## Filters

Support useful filters such as:

```text
tag:python
is:fav
is:pinned
type:text
```

The syntax may evolve based on the final implementation.

---

## Sorting

Support useful ordering such as:

* newest
* oldest
* recently updated
* favorites
* pinned
* relevance

---

## History Interface

Improve:

* visual hierarchy
* content preview
* selected state
* keyboard navigation
* context menus
* bulk selection
* deletion
* favorite
* pin
* copy/paste actions

Follow `UI_PROMPT.md`.

---

## Detail View

Provide a useful way to inspect long clipboard content without making the main history interface difficult to scan.

---

## Acceptance Criteria

* Search is fast.
* Search results are understandable.
* Filters work correctly.
* Sorting works.
* Large history remains usable.
* Keyboard navigation works.
* Existing history workflows do not regress.

---

## Tests

Test:

* exact search
* partial search
* fuzzy search
* tag filters
* favorite filters
* pinned filters
* content-type filters
* sorting
* empty results
* large result sets

---

## Suggested Commit

```text
feat: add clipboard search and filtering
```

---

## Stop Boundary

STOP.

---

# 9. Phase 4 — Organization: Tags, Collections and Favorites

## Objective

Allow users to organize clipboard information instead of treating history as a flat list.

---

## Tags

Implement:

* create tag
* rename tag
* delete tag
* assign tag
* remove tag
* tag suggestions
* tag filtering

Tag operations must not corrupt clipboard entries.

---

## Collections

Implement:

* create collection
* rename collection
* delete collection
* add items
* remove items
* browse collection

Avoid unnecessary duplication of clipboard data.

---

## Favorites and Pins

Ensure favorites and pins have clearly different meanings.

Suggested distinction:

```text
Favorite = user considers the item important
Pin = user wants the item persistently prominent/quickly accessible
```

The exact semantics must be consistent throughout the UI.

---

## Bulk Actions

Support:

* select multiple
* favorite
* un-favorite
* pin
* unpin
* tag
* move to collection
* delete

---

## Acceptance Criteria

* Organization works without data corruption.
* Tags persist.
* Collections persist.
* Favorites persist.
* Pins persist.
* Bulk operations are predictable.
* Search and filters understand organization metadata.

---

## Tests

Test:

* tag CRUD
* tag assignment
* collection CRUD
* collection membership
* favorite state
* pin state
* bulk operations
* deletion edge cases

---

## Suggested Commit

```text
feat: add clipboard organization with tags and collections
```

---

## Stop Boundary

STOP.

---

# 10. Phase 5 — Tray, Lifecycle and Application Behavior

## Objective

Make TextVault behave like a proper desktop utility.

---

## Window Lifecycle

Define and implement predictable behavior for:

* close
* minimize
* hide
* quit
* tray operation
* reopening
* application shutdown

---

## System Tray

Tray functionality should support:

* show application
* hide application
* quick access
* pause monitoring
* quit

Do not overload the tray menu.

---

## Background Mode

The application should be able to remain active without keeping the main window visible.

---

## Startup

Implement optional startup behavior.

Startup preference must be configurable.

---

## Notifications

Use notifications sparingly.

Clipboard monitoring should not generate noisy notifications for every capture.

---

## Acceptance Criteria

* Closing the window behaves predictably.
* Tray mode works.
* Application can run in background.
* Quit fully shuts down processes.
* Startup preference works.
* Clipboard monitoring survives normal window closure.

---

## Tests

Test:

* close
* minimize
* hide
* tray reopen
* quit
* startup setting
* background monitoring
* shutdown cleanup

Manual Windows verification is required.

---

## Suggested Commit

```text
feat: improve desktop lifecycle and tray behavior
```

---

## Stop Boundary

STOP.

---

# 11. Phase 6 — Quick Clipboard and Keyboard-First Workflow

## Objective

Make retrieving clipboard content extremely fast.

The application should minimize mouse dependency.

---

## Global Shortcut

Implement a configurable global shortcut for opening the quick clipboard interface.

---

## Quick Clipboard

The quick interface should support:

* search
* recent clipboard entries
* favorites
* pinned items
* keyboard navigation
* Enter to select
* Escape to close
* optional direct paste behavior

---

## Keyboard Navigation

Support:

* arrow navigation
* Enter
* Escape
* shortcuts
* focus management

Avoid keyboard traps.

---

## Command Palette

Introduce a command registry architecture.

Commands may include:

```text
Search Clipboard
Open Quick Clipboard
Create Snippet
Open Settings
Pause Clipboard Monitoring
Clear History
Export Library
Toggle Theme
Change Language
```

Commands must be registered centrally rather than hardcoded throughout the UI.

---

## Acceptance Criteria

* Quick clipboard opens using a global shortcut.
* Search is immediate.
* Keyboard navigation works.
* Selecting an item is fast.
* Escape closes the surface reliably.
* Command palette can discover supported commands.

---

## Tests

Test:

* global shortcut registration
* shortcut conflict handling
* quick clipboard open/close
* keyboard navigation
* search
* selection
* command discovery
* command execution

Windows manual testing is required.

---

## Suggested Commit

```text
feat: add keyboard-first clipboard workflow
```

---

## Stop Boundary

STOP.

---

# 12. Phase 7 — Snippets and Reusable Text

## Objective

Expand TextVault from clipboard history into a reusable text productivity tool.

---

## Snippets

Implement:

* create
* edit
* delete
* search
* copy
* favorite
* organize
* use from quick access

---

## Snippet Metadata

Support useful fields such as:

```text
title
content
description
tags
createdAt
updatedAt
favorite
```

---

## Variables

Variable support is an advanced feature.

Only introduce variables if the current architecture can support them cleanly.

Potential future syntax:

```text
{{name}}
{{email}}
{{date}}
```

Do not build a complex templating language prematurely.

---

## Acceptance Criteria

* Snippets are persistent.
* Snippets are searchable.
* Snippets can be copied quickly.
* Snippets integrate with quick access.
* Existing clipboard behavior remains unaffected.

---

## Tests

Test:

* CRUD
* search
* copy
* favorite
* tags
* persistence
* invalid snippet data

---

## Suggested Commit

```text
feat: add reusable text snippets
```

---

## Stop Boundary

STOP.

---

# 13. Phase 8 — Smart Content Detection

## Objective

Recognize common clipboard content types and provide useful context without requiring cloud services or AI.

---

## Content Types

Detect common patterns such as:

```text
URL
Email
Phone number
IP address
File path
JSON
Code
Command
Markdown
Plain text
```

Detection must remain local.

---

## Actions

Depending on content type, provide useful actions.

Examples:

```text
URL → Open
Email → Compose
JSON → Format
Code → Format / Transform
Path → Open or reveal
```

Do not execute potentially dangerous content automatically.

---

## Acceptance Criteria

* Detection is accurate enough for common cases.
* False positives are controlled.
* Detection is fast.
* No network service is required.
* Actions are explicit and user initiated.

---

## Tests

Test:

* valid URLs
* invalid URLs
* emails
* phone numbers
* JSON
* code
* paths
* plain text
* ambiguous content

---

## Suggested Commit

```text
feat: add smart clipboard content detection
```

---

## Stop Boundary

STOP.

---

# 14. Phase 9 — Privacy and Security Controls

## Objective

Make privacy a first-class product feature.

TextVault Pro is local-first and must not silently send clipboard data to external services.

---

## Clipboard Monitoring Controls

Implement:

* pause monitoring
* resume monitoring
* configurable monitoring state

---

## Application Exclusions

Support excluding configured applications from clipboard capture.

Examples may include:

* password managers
* secure applications
* banking applications

The system must make exclusions understandable and configurable.

---

## Sensitive Content

Detect potentially sensitive clipboard content where practical.

Potential categories:

* passwords
* authentication tokens
* API keys
* private keys
* secret-like values

Detection must not claim perfect security.

Users must have control over the behavior.

---

## Retention

Allow users to configure history retention.

Potential options:

```text
Forever
30 days
14 days
7 days
1 day
Custom
```

Use only options supported by the implementation.

---

## Private Mode

Introduce a temporary private mode where clipboard content is not persisted.

---

## Secure Logging

Never log:

* clipboard content
* passwords
* tokens
* secrets
* private user data

Logs should contain diagnostic metadata only.

---

## Acceptance Criteria

* Clipboard monitoring can be paused.
* Exclusions work.
* Sensitive content handling is predictable.
* Retention works.
* Private mode works if included in the phase implementation.
* Sensitive clipboard data is not exposed through logs.
* No unexpected network transmission exists.

---

## Tests

Test:

* pause/resume
* exclusions
* sensitive patterns
* retention cleanup
* private mode
* logging
* network behavior

---

## Security Verification

Review:

* Electron security
* preload API
* IPC validation
* filesystem access
* storage access
* import/export
* logs
* external links
* dangerous content handling

---

## Suggested Commit

```text
feat: add privacy controls and sensitive clipboard handling
```

---

## Stop Boundary

STOP.

---

# 15. Phase 10 — Text Utilities and Transformations

## Objective

Add practical local text manipulation tools.

---

## Utilities

Potential tools:

* uppercase
* lowercase
* title case
* sentence case
* trim whitespace
* normalize whitespace
* remove duplicate lines
* sort lines
* reverse lines
* JSON formatting
* JSON minification
* URL encoding
* URL decoding
* Base64 encoding
* Base64 decoding
* escape/unescape
* line statistics
* word statistics
* character statistics

Only include utilities that provide real value.

---

## Design

Text transformations should:

* never unexpectedly destroy source data
* support copy result
* support replace where explicitly selected
* provide clear feedback
* remain local

---

## Acceptance Criteria

* Transformations work correctly.
* Source content is not silently destroyed.
* Errors are understandable.
* Large text remains usable.
* Utilities integrate naturally with clipboard workflows.

---

## Tests

Each transformation must have:

* normal cases
* empty input
* Unicode input
* Persian input where relevant
* malformed input where relevant
* large input tests

---

## Suggested Commit

```text
feat: add local text transformation tools
```

---

## Stop Boundary

STOP.

---

# 16. Phase 11 — Import, Export and Backup

## Objective

Give users complete control over their local data.

---

## Export

Support exporting:

* clipboard history
* snippets
* tags
* collections
* metadata where appropriate

Potential formats:

```text
JSON
TXT
CSV
```

Other formats may be supported where already present and stable.

---

## Backup

Create a complete local backup format.

The backup must be:

* documented
* versioned
* deterministic enough for testing
* validated before import

---

## Import

Support:

```text
Merge
Replace
```

Import must validate data before modifying the existing library.

---

## Safety

Never partially destroy an existing library because of malformed import data.

Use transactional or staged import behavior where practical.

---

## Acceptance Criteria

* Export works.
* Backup works.
* Import works.
* Invalid files are rejected safely.
* Merge works.
* Replace works.
* Data remains consistent.

---

## Tests

Test:

* export
* import
* round-trip
* malformed files
* missing fields
* incompatible versions
* duplicate data
* merge
* replace
* large backups

---

## Suggested Commit

```text
feat: add library import export and backup
```

---

## Stop Boundary

STOP.

---

# 17. Phase 12 — Settings and Configuration

## Objective

Centralize application configuration.

---

## Settings Categories

Potential settings:

### General

* startup
* close behavior
* default view
* language

### Clipboard

* monitoring
* retention
* duplicate policy
* exclusions
* sensitive content behavior

### Appearance

* theme
* accent
* typography
* density

### Shortcuts

* global shortcut
* quick clipboard
* command palette

### Privacy

* private mode
* sensitive handling
* data retention

---

## Requirements

Settings must:

* persist
* validate values
* have safe defaults
* be easy to reset
* not corrupt the application when malformed

---

## Acceptance Criteria

* Settings persist.
* Invalid settings are handled safely.
* UI reflects settings immediately where appropriate.
* Defaults are sensible.
* Configuration is centralized.

---

## Tests

Test:

* load
* save
* reset
* invalid values
* persistence
* migration
* settings-dependent behavior

---

## Suggested Commit

```text
feat: add centralized application settings
```

---

## Stop Boundary

STOP.

---

# 18. Phase 13 — UI Polish, Themes, i18n and RTL

## Objective

Bring the entire application to the visual and interaction quality defined by `UI_PROMPT.md`.

---

## Design System

Centralize:

* spacing
* typography
* radii
* shadows
* colors
* borders
* component states
* motion
* z-index layers

Avoid arbitrary values scattered across components.

---

## Themes

Support:

```text
Light
Dark
System
```

Themes must remain readable and consistent.

---

## Accent Colors

Support a controlled set of accent colors.

Accent changes must not destroy accessibility or contrast.

---

## English / Persian

Support:

```text
English
Persian
```

The application must support:

```text
LTR
RTL
```

correctly.

---

## Bidirectional Text

Mixed content must remain readable.

Examples:

```text
Persian + English
Persian + URLs
Persian + code
English + numbers
Persian + numbers
```

Use appropriate bidi handling instead of fragile string hacks.

---

## Typography

Persian text must use a suitable Persian-capable font.

Avoid excessive font switching.

---

## Responsive Desktop UI

Support reasonable window sizes.

The UI must remain usable when:

* window is narrow
* window is maximized
* content is long
* sidebar is collapsed
* quick surfaces are compact

---

## Accessibility

Support:

* keyboard navigation
* focus visibility
* accessible names
* semantic controls
* contrast
* reduced motion
* screen-reader-friendly labels where practical

---

## Motion

Animations must:

* be subtle
* communicate state
* avoid slowing interaction
* respect reduced-motion settings

---

## Acceptance Criteria

* Light/Dark/System work.
* English/Persian work.
* RTL/LTR work.
* Mixed bidi text is readable.
* Keyboard navigation works.
* Focus is visible.
* UI remains coherent across supported window sizes.
* No emoji are used as substitute UI icons where professional icons are expected.

---

## Tests

Test:

* theme switching
* language switching
* RTL
* mixed Persian/English
* keyboard navigation
* focus
* reduced motion
* responsive layouts

Perform manual visual QA.

---

## Suggested Commit

```text
feat: polish UI themes and bilingual experience
```

---

## Stop Boundary

STOP.

---

# 19. Phase 14 — Performance and Reliability

## Objective

Make TextVault Pro reliable for long-term daily use.

---

## Performance Targets

The application should remain responsive with realistic data volumes.

Test with:

```text
1,000 entries
5,000 entries
10,000 entries
25,000 entries
```

where technically practical.

---

## Optimize

Review:

* clipboard polling
* database queries
* search
* rendering
* virtualization
* event subscriptions
* memory usage
* startup
* quick clipboard launch
* large text handling

---

## Memory

Investigate:

* event listener leaks
* timers
* subscriptions
* renderer memory
* main-process memory
* database connections
* retained clipboard content

---

## Reliability

Test:

* repeated startup/shutdown
* unexpected window close
* corrupted local data
* interrupted writes
* large clipboard content
* malformed imports
* long-running background mode

---

## Crash Safety

Ensure writes do not easily corrupt the local library.

Where practical:

* use atomic/staged writes
* validate data
* recover safely
* avoid destructive partial operations

---

## Acceptance Criteria

* Application remains responsive under realistic history size.
* No obvious memory leaks.
* Clipboard monitoring remains stable for long periods.
* Search remains usable.
* Startup and quick access remain fast.
* Data remains safe during normal failures.

---

## Tests

Perform:

* performance tests
* memory checks
* stress tests
* long-running monitoring
* repeated restart tests
* large data tests
* recovery tests

---

## Suggested Commit

```text
perf: improve application performance and reliability
```

---

## Stop Boundary

STOP.

---

# 20. Phase 15 — Advanced Desktop Productivity

## Objective

Add advanced features only after the core product is stable.

Potential capabilities include:

* sequential paste
* advanced clipboard actions
* richer command palette
* advanced history filtering
* keyboard-driven organization
* configurable quick actions
* more powerful snippet workflows
* improved context-aware actions
* advanced desktop integration

Every feature must justify its complexity.

---

## Rules

Do not introduce advanced features that:

* compromise privacy
* require cloud services unnecessarily
* make the application difficult to understand
* create significant background resource usage
* duplicate existing workflows

---

## Acceptance Criteria

Advanced features must:

* integrate with existing architecture
* use existing command/event systems where appropriate
* remain keyboard accessible
* have tests
* have documentation
* not degrade core workflows

---

## Suggested Commit

```text
feat: add advanced desktop productivity features
```

---

## Stop Boundary

STOP.

---

# 21. Phase 16 — Release Hardening

## Objective

Prepare TextVault Pro for a professional release.

---

## Application Verification

Verify:

* startup
* shutdown
* tray
* clipboard monitoring
* history
* search
* organization
* quick clipboard
* snippets
* privacy
* settings
* import/export
* themes
* language
* RTL
* shortcuts
* performance

---

## Packaging

Verify Windows packaging.

Check:

* installer
* portable build if supported
* application metadata
* icons
* versioning
* data directory
* first launch
* upgrade behavior
* uninstall behavior

---

## Data Safety

Verify:

* existing user data remains accessible
* migrations work
* backup/restore works
* uninstall does not unexpectedly destroy user data unless explicitly intended
* corrupted data is handled safely

---

## Security Review

Perform a final review of:

* Electron configuration
* preload
* IPC
* external URLs
* filesystem operations
* import/export
* local storage
* logs
* sensitive clipboard handling
* dependencies

---

## Test Matrix

Run:

```text
Unit tests
Integration tests
E2E tests
Build tests
Packaging tests
Manual Windows QA
Performance tests
Security review
RTL/LTR QA
Accessibility QA
```

---

## Acceptance Criteria

No known critical or high-severity issue may remain.

The application must be usable as a coherent product rather than as a collection of completed features.

---

## Suggested Commit

```text
chore: harden TextVault Pro for release
```

---

## Stop Boundary

STOP.

---

# 22. Phase 17 — Post-MVP Optional Features

These features must not block the core release.

They are intentionally postponed until the foundation is stable.

---

## Cloud Sync

Potential future capabilities:

* encrypted sync
* multi-device history
* conflict resolution
* account management
* selective synchronization

Cloud sync must never become mandatory.

---

## AI

Potential future capabilities:

* semantic clipboard search
* smart categorization
* text rewriting
* summarization
* context-aware actions

AI must remain optional.

Clipboard content must not be sent to external AI services without explicit user consent.

---

## Cross-Platform

Potential targets:

```text
macOS
Linux
```

Platform-specific functionality must use adapters rather than contaminating the domain layer.

---

## Rule

Do not implement these features during the core roadmap unless the assigned phase explicitly includes them.

---

# 23. Cross-Phase Testing Requirements

Every phase must consider four categories of testing.

## Unit Tests

For:

* business rules
* parsers
* transformations
* utilities
* repositories
* services

---

## Integration Tests

For:

* storage
* application services
* IPC
* Electron integration
* settings
* clipboard engine

---

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

## Manual Desktop QA

Manual testing is required for platform behavior that automated tests cannot fully guarantee.

Especially:

* global shortcuts
* system tray
* startup
* clipboard integration
* window lifecycle
* packaging
* Windows behavior

---

# 24. Regression Rule

A new phase must not intentionally break completed functionality from previous phases.

If a regression is introduced:

1. identify the root cause
2. fix it
3. add a regression test when practical
4. rerun affected tests
5. update `PROGRESS.md`

Do not mark a phase complete while a known regression remains.

---

# 25. Database Migration Rule

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

# 26. Dependency Rule

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

# 27. UI Implementation Rule

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

# 28. Security Rule

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

# 29. Performance Rule

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

# 30. Documentation Rule

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

# 31. Git Commit Rule

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

# 32. Phase Dependency Map

The intended dependency chain is:

```text
Phase 0
Audit
  │
  ▼
Phase 1
Architecture Foundation
  │
  ▼
Phase 2
Clipboard Engine
  │
  ▼
Phase 3
Search & History UX
  │
  ▼
Phase 4
Organization
  │
  ▼
Phase 5
Desktop Lifecycle
  │
  ▼
Phase 6
Quick Clipboard & Keyboard
  │
  ▼
Phase 7
Snippets
  │
  ▼
Phase 8
Smart Detection
  │
  ▼
Phase 9
Privacy & Security
  │
  ▼
Phase 10
Text Utilities
  │
  ▼
Phase 11
Import / Export / Backup
  │
  ▼
Phase 12
Settings
  │
  ▼
Phase 13
UI / i18n / RTL / Accessibility
  │
  ▼
Phase 14
Performance & Reliability
  │
  ▼
Phase 15
Advanced Productivity
  │
  ▼
Phase 16
Release Hardening
  │
  ▼
Phase 17
Optional Future Features
```

Some phases may require small prerequisite adjustments, but the agent must not reorder major phases without documenting the reason.

---

# 33. Definition of Done

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
* [ ] Agent stopped

---

# 34. Progress Tracking Format

`PROGRESS.md` should maintain a concise implementation state.

Recommended structure:

```text
Current Phase:
Phase X — Name

Status:
In Progress / Complete / Blocked

Completed:
- ...

Changed:
- ...

Tests:
- ...

Known Issues:
- ...

Architecture Changes:
- ...

Next Phase:
Phase X+1 — Name

Last Completed Commit:
<commit>
```

Do not mark a phase complete before its acceptance criteria are satisfied.

---

# 35. Agent Resume Rule

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

# 36. Agent Interruption Rule

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

# 37. Scope Control

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

# 38. Final Product Quality Bar

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

# 39. Final Development Principle

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
