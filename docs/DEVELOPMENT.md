# TextVault Pro — Development Guide

## 1. Purpose

This document defines the development standards, workflow, coding practices, repository conventions, implementation rules, and day-to-day engineering process for TextVault Pro.

It is intended for both human developers and software development agents working on the project.

The purpose of this document is to ensure that TextVault Pro remains:

* maintainable
* secure
* predictable
* testable
* performant
* consistent
* professionally structured
* easy to continue after interrupted development

This document must be used together with:

```text
docs/PRODUCT_SPEC.md
docs/FEATURES.md
docs/UI_PROMPT.md
docs/ARCHITECTURE.md
docs/ROADMAP.md
docs/TESTING.md
docs/SECURITY.md
docs/PROGRESS.md
```

---

# 2. Core Development Principles

Development must follow these principles.

## 2.1 Stability before expansion

Do not add new functionality on top of unstable foundations.

If a core system is unreliable, fix it before building dependent features.

---

## 2.2 Understand before changing

Before modifying an existing subsystem:

1. inspect the implementation
2. identify dependencies
3. identify existing behavior
4. inspect tests
5. understand persistence implications
6. determine whether the code should be kept, refactored, rewritten, replaced, or removed

Never perform blind rewrites.

---

## 2.3 Small logical changes

Prefer small, understandable changes over huge modifications.

A feature should normally be implemented through logically separated changes such as:

```text
domain
application
infrastructure
IPC
UI
tests
documentation
```

Do not create unnecessary commits for every tiny change, but do not combine unrelated features into one giant commit either.

---

## 2.4 Avoid unnecessary complexity

Use the simplest architecture that satisfies the requirements.

Do not introduce:

* unnecessary frameworks
* unnecessary services
* unnecessary abstraction layers
* unnecessary dependencies
* unnecessary state management
* unnecessary background workers
* unnecessary network infrastructure

Extensibility is valuable, but speculative engineering is not.

---

# 3. Repository Structure

The project should evolve toward a structure similar to:

```text
TextVault/
├── electron/
│   ├── main/
│   ├── preload/
│   └── infrastructure/
│
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── hooks/
│   ├── pages/
│   ├── services/
│   ├── styles/
│   ├── utils/
│   └── ...
│
├── shared/
│   ├── types/
│   ├── contracts/
│   └── constants/
│
├── test/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
│
├── docs/
│   ├── PRODUCT_SPEC.md
│   ├── FEATURES.md
│   ├── UI_PROMPT.md
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   ├── DEVELOPMENT.md
│   ├── TESTING.md
│   ├── SECURITY.md
│   ├── PROGRESS.md
│   └── MASTER_PROMPT.md
│
├── package.json
├── README.md
└── ...
```

The exact structure may differ from this target.

The existing repository should not be reorganized solely for cosmetic reasons.

Structural changes must provide real architectural or maintenance value.

---

# 4. Layer Responsibilities

The project should maintain a clear separation of concerns.

## UI / Renderer

Responsible for:

* rendering
* user interaction
* visual state
* keyboard interaction
* accessibility
* presentation formatting

The renderer must not directly implement:

* database logic
* filesystem operations
* unrestricted Electron APIs
* operating-system-specific functionality

---

## Application Layer

Responsible for:

* use cases
* workflows
* orchestration
* application-level validation
* coordinating domain and infrastructure

Examples:

```text
SearchClipboard
DeleteClipboardEntry
CreateSnippet
ExportLibrary
UpdateSettings
```

---

## Domain Layer

Responsible for:

* business rules
* domain models
* domain validation
* domain-level behavior

The domain must remain independent of:

* Electron
* React
* IndexedDB
* DOM
* operating-system APIs

---

## Infrastructure

Responsible for:

* IndexedDB
* filesystem
* Electron integration
* clipboard access
* tray
* global shortcuts
* OS-specific APIs
* persistence implementation

Infrastructure must not leak implementation details into the domain.

---

# 5. Naming Conventions

Use clear and predictable names.

Prefer descriptive names such as:

```text
ClipboardRepository
ClipboardService
SearchClipboard
SettingsRepository
QuickClipboardController
```

Avoid vague names such as:

```text
Helper
Manager
Stuff
Utils2
DataHandler
Thing
```

Generic utility modules are acceptable only when they contain genuinely related reusable functions.

---

# 6. TypeScript Standards

Use TypeScript types to make application contracts explicit.

Prefer:

```text
type
interface
enum or string unions
generics where useful
discriminated unions
```

Avoid excessive use of:

```text
any
unknown without validation
type assertions
non-null assertions
```

When `any` is genuinely necessary, document why.

---

# 7. Null and Error Handling

Do not assume values exist.

Handle:

* missing clipboard data
* deleted records
* unavailable files
* corrupted storage
* invalid settings
* failed IPC calls
* malformed imports
* unavailable system APIs

Errors must be handled at the correct boundary.

Do not silently swallow exceptions.

Bad:

```text
try {
    ...
} catch {
}
```

Prefer meaningful handling or safe logging.

---

# 8. IPC Development Rules

IPC is a security boundary.

Every IPC operation must:

1. have a clear purpose
2. have a known channel
3. validate incoming data
4. return predictable data
5. handle errors safely

Do not expose arbitrary function execution through IPC.

Avoid APIs such as:

```text
execute(channel, arbitraryPayload)
```

when a specific typed operation can be provided.

---

# 9. Preload Rules

The preload layer is a controlled bridge between Electron and the renderer.

Expose only the minimum API required.

Prefer:

```text
window.textVault.clipboard.search(...)
window.textVault.settings.get(...)
```

over exposing raw Electron APIs.

Do not expose:

```text
ipcRenderer
fs
shell
child_process
process
```

directly to the renderer.

---

# 10. State Management

Use the smallest state-management solution that satisfies the application.

Distinguish between:

```text
Server-like/application data
UI state
temporary interaction state
persistent settings
domain state
```

Avoid duplicating the same source of truth in multiple stores.

Do not introduce global state for data that can remain local to a component or feature.

---

# 11. React / Renderer Development

Components should have clear responsibilities.

Avoid giant components that contain:

* data fetching
* persistence
* business rules
* keyboard handling
* complex rendering
* unrelated UI logic

Break complex interfaces into reusable components where there is real value.

Examples:

```text
ClipboardList
ClipboardItem
ClipboardPreview
SearchBar
FilterBar
CommandPalette
QuickClipboard
TagSelector
CollectionSidebar
SettingsPanel
```

Do not split every few lines into a component.

---

# 12. Feature-Based Organization

When appropriate, related functionality should remain grouped.

For example:

```text
features/
├── clipboard/
├── search/
├── snippets/
├── tags/
├── collections/
├── settings/
├── privacy/
└── export/
```

Feature modules should avoid unnecessary cross-dependencies.

---

# 13. Database Development

IndexedDB remains the preferred local persistence approach unless the architecture later determines that another storage system is justified.

Before changing the database schema:

1. inspect the existing schema
2. identify existing users/data
3. define the new schema
4. create migration logic
5. test migration
6. test fresh installation
7. test upgrade from existing data

Never assume the database is empty.

---

# 14. Database Migration Rules

Every schema change must consider:

```text
Fresh installation
Existing installation
Upgrade
Downgrade/recovery where practical
Corrupted data
Missing fields
Unknown fields
```

Migrations must be deterministic.

Do not silently delete user data.

---

# 15. Clipboard Engine Development

Clipboard monitoring is one of the most important background systems.

It must:

* avoid excessive polling
* detect changes reliably
* handle duplicate events
* handle inaccessible clipboard states
* recover from errors
* respect pause state
* respect application exclusions
* respect private mode
* respect sensitive-content rules
* shut down cleanly

The clipboard engine must not block the UI thread with expensive work.

---

# 16. Clipboard Data Rules

Clipboard content is user data.

Do not log raw clipboard content.

Do not include clipboard content in:

* debug logs
* analytics
* error reports
* crash payloads
* telemetry

unless the user explicitly enables a future feature that requires it and the privacy model clearly permits it.

The core product must remain local-first.

---

# 17. Search Development

Search should be designed for realistic history sizes.

Do not repeatedly scan and transform the entire history unnecessarily on every keystroke.

Use appropriate:

* indexing
* caching
* debouncing
* incremental updates
* virtualization

where justified.

Search results must remain predictable.

---

# 18. Performance Development

Performance should be measured rather than guessed.

Pay particular attention to:

* startup time
* clipboard monitoring
* renderer rendering
* history scrolling
* search
* quick clipboard launch
* large text rendering
* import/export
* memory usage

Do not optimize blindly.

First identify the bottleneck.

Then make the smallest effective change.

---

# 19. Large Data Handling

The application should remain usable with thousands of clipboard entries.

Avoid:

```text
render every history item at once
load huge datasets unnecessarily
duplicate large clipboard strings in memory
perform expensive work on every keystroke
```

Use virtualization and incremental loading where appropriate.

---

# 20. Large Text Handling

Clipboard content can be unexpectedly large.

The application must handle:

* long text
* source code
* logs
* JSON
* minified data
* multilingual text

Avoid expensive formatting or processing unless explicitly requested.

---

# 21. UI Development Rules

All UI work must follow `UI_PROMPT.md`.

Do not introduce arbitrary visual patterns.

Maintain consistency in:

* spacing
* typography
* colors
* icons
* borders
* radii
* shadows
* interaction states
* animations

Prefer shared components and design tokens.

---

# 22. Iconography

Do not use emoji as professional application UI icons.

Use a consistent icon system.

Icons must:

* have consistent visual weight
* align correctly
* communicate meaning clearly
* work in light and dark themes
* remain accessible

---

# 23. Responsive Desktop Behavior

Although TextVault is a desktop application, the UI must adapt to different window sizes.

Test:

```text
Small window
Medium window
Large window
Maximized window
```

Do not allow:

* clipped content
* inaccessible controls
* overflowing dialogs
* broken sidebars
* unusable search areas

---

# 24. Keyboard-First Development

Keyboard interaction is a core product principle.

Whenever a major UI operation exists, consider whether it should have a keyboard path.

Important operations include:

```text
Search
Open quick clipboard
Select
Copy
Paste
Delete
Favorite
Pin
Open command palette
Navigate history
Close dialog
```

Focus must remain predictable.

---

# 25. Global Shortcut Rules

Global shortcuts must:

* be configurable
* handle registration failure
* handle conflicts
* clean up on shutdown
* avoid duplicate registrations
* work correctly after reload/restart

Do not assume a shortcut registration always succeeds.

---

# 26. Tray Development

Tray behavior must be tested independently from normal window behavior.

Verify:

* application hidden
* application shown
* application minimized
* tray menu
* quit
* reopening
* background monitoring

The tray must not accidentally terminate the clipboard engine when the window closes.

---

# 27. Settings Development

Settings must have:

* defaults
* validation
* persistence
* migration
* reset behavior

Settings should not be duplicated across unrelated modules.

Prefer one authoritative settings service/store.

---

# 28. Internationalization

All user-facing text should be translatable.

Avoid hardcoding large amounts of UI text directly into components.

Persian and English must be treated as first-class languages.

Do not assume:

```text
English text length
LTR layout
English number formatting
English-only keyboard behavior
```

---

# 29. RTL Development

RTL support must be structural, not implemented through scattered hacks.

Test:

* navigation
* dialogs
* dropdowns
* sidebars
* search
* text editor
* context menus
* keyboard navigation
* mixed Persian/English content

Use logical CSS properties where appropriate.

Prefer:

```text
margin-inline
padding-inline
inset-inline
text-align: start
```

over unnecessary left/right-specific rules.

---

# 30. Mixed Bidirectional Text

Clipboard content may contain:

```text
Persian
English
URLs
code
numbers
symbols
```

Use appropriate Unicode and CSS bidi behavior.

Do not manipulate user text simply to make the UI look correct.

The stored clipboard content must remain unchanged.

---

# 31. Accessibility

Every interactive feature should consider:

* keyboard access
* focus state
* semantic HTML
* accessible labels
* contrast
* reduced motion
* screen reader behavior where practical

Do not rely solely on color to communicate state.

---

# 32. Dependency Management

Before installing a new package, evaluate:

* necessity
* security
* maintenance
* license
* compatibility
* bundle impact
* performance
* long-term value

After installing:

* update lockfile
* verify build
* verify tests
* inspect bundle impact when relevant

Remove unused dependencies.

---

# 33. Network Policy

The core application is local-first.

Do not introduce network communication unless explicitly required by an approved feature.

Any future network feature must document:

* what data leaves the device
* why it is necessary
* what consent is required
* how it is secured
* what happens when offline

---

# 34. Logging

Logs must be useful but privacy-safe.

Never log:

* clipboard contents
* passwords
* tokens
* secrets
* private keys
* full sensitive documents

Prefer:

```text
operation name
status
duration
error type
safe metadata
```

Example:

```text
Clipboard persistence failed: storage transaction error
```

rather than including the clipboard content.

---

# 35. Debugging Workflow

When a bug is reported:

1. reproduce it
2. identify the smallest reproducible case
3. inspect the relevant subsystem
4. identify root cause
5. implement the smallest appropriate fix
6. add a regression test
7. run affected tests
8. run broader regression tests
9. document important behavior changes

Do not hide symptoms with arbitrary delays or retries unless they are technically justified.

---

# 36. Avoiding Race Conditions

Pay particular attention to concurrent operations involving:

* clipboard changes
* autosave
* deletion
* import
* export
* settings updates
* application shutdown

Example:

If the user closes the application while a clipboard entry is being persisted, the system should not leave the library in an inconsistent state.

---

# 37. Autosave and Draft Safety

If an editor supports autosave:

* debounce writes
* avoid writing on every keystroke
* handle interrupted writes
* recover drafts safely
* avoid overwriting newer content with stale state

---

# 38. Import Safety

Import operations must be defensive.

Before modifying existing data:

1. read file
2. validate structure
3. validate version
4. validate records
5. detect conflicts
6. determine merge/replace behavior
7. perform the operation safely

Malformed imports must not destroy existing user data.

---

# 39. Export Safety

Exports should:

* preserve expected content
* handle Unicode
* handle Persian correctly
* avoid data truncation
* report failures
* avoid blocking the UI unnecessarily

---

# 40. External Links

Any user-controlled or detected URL must be handled carefully.

Do not automatically execute arbitrary clipboard content.

Opening an external resource should be an explicit user action.

---

# 41. Security Review During Development

Security must be reviewed whenever changing:

* Electron configuration
* preload
* IPC
* filesystem
* shell commands
* external URLs
* import/export
* clipboard monitoring
* dependencies
* network communication

Refer to `SECURITY.md` for detailed security requirements.

---

# 42. Testing During Development

Testing is part of implementation, not a final step.

When implementing a feature:

```text
Write or update test
Implement
Run test
Fix
Run regression suite
```

Do not postpone all testing until release.

---

# 43. Test Data

Use deterministic fixtures.

Fixtures should cover:

* plain English
* Persian
* mixed RTL/LTR
* URLs
* code
* JSON
* large text
* duplicate clipboard entries
* sensitive-looking values
* empty values
* malformed data

Never use real secrets in test data.

---

# 44. Development Environment

The project should document the supported development environment.

At minimum document:

* supported Node.js version
* package manager
* Windows requirements
* development commands
* test commands
* build commands

Do not assume contributors know the project's environment.

---

# 45. Local Development Workflow

Typical workflow:

```text
1. Pull latest changes
2. Inspect PROGRESS.md
3. Inspect current branch/status
4. Read relevant documentation
5. Create/continue task
6. Implement
7. Test
8. Review changes
9. Update documentation
10. Commit
```

---

# 46. Before Starting a Phase

An agent must verify:

```text
Git status
Current branch
Current phase
Previous completed phase
Existing tests
Relevant documentation
Known issues
```

Do not begin a phase if the previous phase is clearly incomplete unless the task explicitly asks to repair it.

---

# 47. During a Phase

The agent should keep changes focused.

If unrelated problems are discovered:

### Critical problem

Fix if required for the current feature or application stability.

### Minor unrelated problem

Document it and leave it for the appropriate phase.

### Future feature

Do not implement it.

This prevents scope creep.

---

# 48. Before Committing

Review:

```text
git status
git diff
git diff --stat
```

Check for:

* accidental files
* generated artifacts
* secrets
* debug code
* console spam
* temporary files
* unrelated changes

Run the relevant test suite.

---

# 49. Commit Standards

Commit messages should describe the actual change.

Recommended prefixes:

```text
feat:
fix:
refactor:
perf:
test:
docs:
chore:
build:
```

Examples:

```text
feat: add clipboard search
fix: prevent duplicate history entries
refactor: isolate storage repository
test: cover clipboard persistence
docs: update development workflow
perf: optimize history rendering
```

---

# 50. Pull Request / Review Quality

Before considering a change complete, ask:

### Correctness

Does it work?

### Regression

Did existing behavior remain intact?

### Security

Did the change introduce a new risk?

### Performance

Does it scale reasonably?

### UX

Does it follow the product design?

### Accessibility

Can keyboard users use it?

### i18n

Does it work in English and Persian?

### Maintainability

Can another developer understand it?

---

# 51. Generated Files

Do not commit generated artifacts unless they are intentionally part of the repository.

Avoid accidentally committing:

```text
node_modules/
dist/
build/
coverage/
temporary files
debug logs
local databases
user data
```

Follow the repository's `.gitignore`.

---

# 52. Secrets

Never commit:

* API keys
* passwords
* access tokens
* private keys
* credentials
* personal data

If a secret is accidentally committed:

1. remove it from the repository
2. rotate/revoke the secret
3. clean history when necessary
4. document the incident appropriately

Do not merely delete the visible file and assume the secret is safe.

---

# 53. Documentation Maintenance

Documentation is part of the product engineering process.

Update documentation when:

* architecture changes
* features change
* commands change
* configuration changes
* security behavior changes
* testing changes
* data schema changes

Do not allow documentation drift.

---

# 54. PROGRESS.md Rules

After every completed phase update:

```text
Current Phase
Status
Implemented
Changed
Tests
Known Issues
Architecture Changes
Next Phase
Commit
```

The file should remain concise and factual.

---

# 55. README Rules

The README should describe the actual usable project.

It should eventually include:

* product overview
* features
* screenshots
* requirements
* installation
* development
* testing
* build
* privacy
* supported platforms
* project structure where useful

Do not advertise unfinished functionality as production-ready.

---

# 56. Feature Flags

If a feature is experimental or incomplete, consider using an appropriate feature flag rather than exposing unstable behavior to normal users.

Do not leave permanent dead feature flags without a reason.

---

# 57. Temporary Code

Temporary code must have a clear purpose.

Avoid leaving:

```text
TODO
FIXME
temporary bypass
debug mode
mock implementation
hardcoded test value
```

without documentation.

Before release, review all temporary code.

---

# 58. AI Agent Development Rules

When an AI coding agent is used, it must behave like a professional engineer.

The agent must:

* inspect before changing
* read project documentation
* respect architecture
* avoid guessing
* avoid unnecessary rewrites
* test its changes
* review its diff
* update documentation
* commit cleanly
* stop at the assigned boundary

The agent must not:

* invent requirements
* silently change product scope
* remove working features without justification
* install unnecessary dependencies
* rewrite the whole application without approval
* claim tests passed when they were not run
* claim a feature works without verification
* continue into the next roadmap phase

---

# 59. AI Agent Phase Prompt Pattern

When assigning a phase to an AI agent, use the following structure:

```text
Read:
- docs/PRODUCT_SPEC.md
- docs/FEATURES.md
- docs/ARCHITECTURE.md
- docs/UI_PROMPT.md
- docs/ROADMAP.md
- docs/PROGRESS.md
- relevant DEVELOPMENT/TESTING/SECURITY sections

Then:

1. Inspect the current implementation.
2. Confirm the current roadmap phase.
3. Implement only the requested phase.
4. Preserve existing functionality unless the phase explicitly changes it.
5. Follow the documented architecture.
6. Write/update appropriate tests.
7. Run the relevant tests.
8. Fix failures and regressions.
9. Update documentation.
10. Update docs/PROGRESS.md.
11. Review git diff.
12. Create a clean commit.
13. Stop before the next phase.
```

The exact phase-specific requirements should come from `ROADMAP.md`.

---

# 60. Handling Existing Bugs

Not every discovered bug must be fixed immediately.

Classify bugs as:

```text
Blocker
Critical
High
Medium
Low
```

Fix immediately when the bug:

* blocks the current phase
* corrupts user data
* creates a security issue
* breaks a core workflow
* prevents testing

Otherwise document it for the appropriate phase.

---

# 61. Refactoring Rules

Refactor when:

* duplication creates real maintenance cost
* architecture is violated
* security is compromised
* performance is poor
* code blocks required functionality
* testing is unnecessarily difficult

Do not refactor merely for aesthetic preference.

Avoid combining large unrelated refactors with feature implementation unless required.

---

# 62. Code Review Checklist

Before declaring a meaningful implementation complete:

```text
[ ] Requirement is implemented
[ ] Architecture is respected
[ ] Existing functionality is preserved
[ ] Error handling exists
[ ] Edge cases considered
[ ] Tests exist
[ ] Tests pass
[ ] No debug code remains
[ ] No secrets exist
[ ] No unnecessary dependencies added
[ ] UI follows UI_PROMPT.md
[ ] Accessibility considered
[ ] English/Persian behavior considered
[ ] Security implications reviewed
[ ] Performance implications considered
[ ] Documentation updated
[ ] PROGRESS.md updated
[ ] Git diff reviewed
```

---

# 63. Release Preparation Workflow

Before a release:

```text
Feature verification
↓
Regression testing
↓
Security review
↓
Performance testing
↓
UI QA
↓
RTL/LTR QA
↓
Accessibility QA
↓
Build
↓
Installer/portable verification
↓
Fresh installation test
↓
Upgrade test
↓
Backup/restore test
↓
Final documentation review
```

---

# 64. Development Anti-Patterns

Avoid:

## Giant Rewrite

Replacing the entire application without understanding the existing code.

## God Components

One UI component containing the entire application.

## God Services

One service responsible for unrelated business logic.

## Generic IPC

A single unrestricted IPC channel handling everything.

## Any Everywhere

Using `any` to bypass type problems.

## Silent Catch

Ignoring exceptions.

## Magic Strings

Duplicating event/channel names throughout the application.

## Direct Storage from UI

Renderer components directly manipulating IndexedDB.

## Clipboard Logging

Logging raw clipboard content.

## Unnecessary Network

Sending local data to remote services without explicit product requirements.

## Premature Optimization

Optimizing without evidence.

## Premature Abstraction

Creating abstractions before there is a real need.

---

# 65. Definition of Development Quality

Good code is not necessarily the code with the most abstractions.

Good code is:

* understandable
* testable
* secure
* maintainable
* appropriately modular
* efficient
* predictable

Prefer boring reliable code over clever fragile code.

---

# 66. Final Engineering Principle

TextVault Pro should be developed as a long-lived desktop product.

Every change should answer:

```text
Does this improve the product?
Does this preserve user data?
Does this preserve security?
Does this fit the architecture?
Can it be tested?
Can another developer maintain it?
```

If the answer is unclear, investigate before implementing.

The development goal is not maximum code volume.

The goal is a product that is:

```text
Reliable
Private
Fast
Secure
Maintainable
Professional
```

and enjoyable to use every day.
