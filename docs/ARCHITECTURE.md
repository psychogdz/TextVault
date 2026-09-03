# TextVault Pro — Architecture Specification

**Project:** TextVault Pro
**Repository:** TextVault
**Platform Priority:** Windows-first
**Architecture Goal:** Local-first, privacy-first, maintainable, testable, cross-platform-ready
**Status:** Authoritative Architecture Specification

---

# 1. Purpose

This document defines the target technical architecture of TextVault Pro.

TextVault Pro is an Electron desktop application that combines:

* Persistent clipboard history
* Fast clipboard search
* Quick clipboard access
* Snippets
* Collections
* Tags
* Text utilities
* Privacy controls
* System tray/background operation
* Global shortcuts
* Command palette
* Desktop integration
* Local-first data storage

The architecture must support these capabilities without turning the application into an unnecessarily complicated system.

The goal is not to create an academic architecture.

The goal is to create a production-quality desktop application that is:

* Reliable
* Fast
* Secure
* Maintainable
* Testable
* Easy to extend
* Windows-first
* Ready for future macOS/Linux support

---

# 2. Architectural Authority

This document defines architectural rules.

When implementation decisions are unclear:

1. `PRODUCT_SPEC.md` defines what the product should do.
2. `FEATURES.md` defines feature priorities and scope.
3. `ARCHITECTURE.md` defines how the software should be structured.
4. `ROADMAP.md` defines implementation order.
5. `DEVELOPMENT.md` defines development workflow.
6. `TESTING.md` defines testing requirements.
7. `SECURITY.md` defines security requirements.
8. `PROGRESS.md` records implementation status.

If two documents appear to conflict, do not silently choose one.

Identify the conflict and resolve it according to the project's documented priorities.

---

# 3. Core Architectural Principles

The implementation MUST follow these principles.

## 3.1 Local-first

Core functionality must work completely offline.

The application must not require:

* An account
* A backend
* Cloud storage
* Internet connectivity
* Remote authentication

for normal clipboard functionality.

---

## 3.2 Privacy-first

Clipboard contents can contain extremely sensitive information.

Therefore:

* Clipboard contents must remain local by default.
* Clipboard data must not be sent to remote services.
* Clipboard contents must not be written to normal application logs.
* External integrations must be opt-in.
* Future AI/cloud features must be isolated from the core system.

---

## 3.3 UI independence

The UI must not own core business logic.

The renderer should display state and invoke application operations.

It should not independently implement:

* Clipboard monitoring
* Retention policies
* Duplicate rules
* Privacy policies
* Storage logic
* OS integration

---

## 3.4 Platform isolation

Windows-specific APIs must not spread throughout the application.

Platform-specific functionality must be accessed through defined adapters/services.

This is required for future macOS/Linux support.

---

## 3.5 Minimal complexity

Do not introduce:

* Unnecessary frameworks
* Heavy dependencies
* Unnecessary micro-architectures
* Multiple state-management systems
* Multiple persistence systems
* Multiple event buses

unless there is a demonstrated requirement.

Simple code is preferred when it satisfies the requirements.

---

## 3.6 Preserve working functionality

The existing TextVault codebase contains functionality that may already be stable.

Before rewriting existing code:

1. Inspect it.
2. Understand it.
3. Test it.
4. Determine its architectural quality.
5. Determine whether it can be reused.
6. Refactor only where necessary.

Do not rewrite working systems simply because a different implementation looks cleaner.

---

# 4. Target Architecture

The application should conceptually follow this dependency direction:

```text
┌──────────────────────────────┐
│         Renderer / UI        │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│   Application / Use Cases    │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│           Domain             │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│       Infrastructure         │
├──────────────────────────────┤
│ Storage                      │
│ Clipboard                    │
│ Search                       │
│ Desktop / OS                 │
│ Notifications                │
│ Configuration                │
└──────────────────────────────┘
```

Electron-specific functionality exists primarily in the desktop/infrastructure layer.

The domain must remain independent of Electron.

---

# 5. Electron Process Architecture

TextVault Pro uses three conceptual layers within Electron:

```text
Main Process
     │
     ▼
Preload / Secure Bridge
     │
     ▼
Renderer Process
```

Each layer has a clearly defined responsibility.

---

# 6. Main Process

The Main Process owns application-level and native desktop functionality.

Responsibilities include:

* Electron application lifecycle
* BrowserWindow management
* System tray
* Global shortcuts
* Native notifications
* Native dialogs
* OS integration
* Active application detection
* Native clipboard integration where required
* Startup behavior
* Single-instance handling
* Application shutdown
* Main-process IPC handlers

The Main Process must NOT become a giant file containing all application logic.

Native integration belongs in dedicated modules/services.

Bad architecture:

```text
electron/main.js
    ├── clipboard logic
    ├── storage logic
    ├── search logic
    ├── settings logic
    ├── tray logic
    ├── business rules
    └── UI logic
```

Preferred architecture:

```text
electron/
├── main/
│   ├── app/
│   ├── clipboard/
│   ├── desktop/
│   ├── ipc/
│   ├── platform/
│   ├── services/
│   └── main.ts
│
└── preload/
    └── preload.ts
```

Exact filenames may differ from this example.

The responsibility boundaries must remain.

---

# 7. Renderer Process

The Renderer is responsible for user-facing application behavior.

Responsibilities:

* Rendering UI
* User interaction
* Forms
* Search interface
* Clipboard history interface
* Snippet interface
* Collection interface
* Settings interface
* Command palette interface
* Dialogs
* Visual feedback
* Theme
* Localization
* Accessibility
* Temporary UI state

The Renderer must NOT directly access:

* Node.js
* Filesystem
* Native OS APIs
* unrestricted Electron APIs
* shell commands
* arbitrary IPC channels

---

# 8. Preload Security Boundary

The preload layer is the controlled bridge between Renderer and Main Process.

Electron security is a hard architectural boundary.

Required baseline:

```text
contextIsolation = true
nodeIntegration = false
```

The preload layer should expose a narrow API.

Example:

```text
window.textVault.clipboard.getHistory()
window.textVault.clipboard.deleteItem(id)

window.textVault.search.query(query)

window.textVault.settings.get()
window.textVault.settings.update(settings)

window.textVault.system.showWindow()
window.textVault.system.hideWindow()

window.textVault.snippets.create(data)
```

Avoid exposing:

```text
window.electron.send(...)
window.electron.invoke(...)
```

as a generic unrestricted interface.

IPC operations must be explicit.

---

# 9. IPC Architecture

IPC communication must be:

* Explicit
* Typed
* Validated
* Minimal
* Documented
* Testable

Each IPC channel should represent a meaningful application operation.

Example:

```text
clipboard:get-history
clipboard:delete-item
clipboard:clear-history
clipboard:pause
clipboard:resume

search:query

settings:get
settings:update

system:show-window
system:hide-window
system:quit

snippet:create
snippet:update
snippet:delete
```

Do not expose arbitrary channel forwarding.

Do not allow the renderer to execute arbitrary main-process functions.

---

# 10. IPC Data Contracts

IPC request and response structures must be explicitly defined.

Example:

```text
SearchRequest
    query
    filters
    sort
    limit
    offset

SearchResponse
    items
    total
    queryTime
```

Input validation must happen at the IPC boundary.

Never trust renderer input simply because it originates from the application UI.

---

# 11. Shared Types

Shared contracts should live in the shared layer.

Potential structure:

```text
shared/
├── types/
├── contracts/
├── schemas/
└── constants/
```

Examples:

```text
ClipboardItem
ClipboardContentType
SearchQuery
SearchFilter
Snippet
Collection
Tag
AppSettings
PrivacyRule
RetentionPolicy
```

Shared types must not import Electron-specific modules.

---

# 12. Domain Layer

The Domain layer contains the application's core concepts and business rules.

It should be independent from:

* Electron
* React
* IndexedDB
* Filesystem
* Windows APIs
* UI components

Examples of domain entities:

```text
ClipboardItem
Snippet
Collection
Tag
Settings
RetentionPolicy
PrivacyRule
```

Examples of domain rules:

```text
Duplicate clipboard items follow configured duplicate policy.

Pinned items are protected from normal retention cleanup.

Excluded applications must not create clipboard history entries.

Paused monitoring must not capture clipboard changes.

Privacy rules are evaluated before persistence.

Retention policies must never unexpectedly delete protected data.
```

These rules should be independently testable.

---

# 13. Application Layer

The Application layer coordinates use cases.

Examples:

```text
CaptureClipboard
GetClipboardHistory
SearchClipboard
DeleteClipboardItem
ClearClipboardHistory
ToggleFavorite
TogglePin
ApplyRetentionPolicy

CreateSnippet
UpdateSnippet
DeleteSnippet

CreateCollection
UpdateCollection
DeleteCollection

ExportLibrary
ImportLibrary
CreateBackup

UpdateSettings
```

Application services may use infrastructure interfaces.

They must not depend on UI components.

---

# 14. Repository Interfaces

Persistence must be accessed through interfaces.

Example:

```text
ClipboardRepository
    getHistory()
    getById(id)
    create(item)
    update(id, data)
    delete(id)
    deleteMany(ids)
    clear()
```

Potential future repositories:

```text
SnippetRepository
CollectionRepository
TagRepository
SettingsRepository
```

The UI should never directly query IndexedDB.

---

# 15. Existing Storage Audit

The existing TextVault project uses IndexedDB.

Do NOT automatically replace it.

Before deciding whether IndexedDB should remain, inspect the current implementation.

Evaluate:

* Reliability
* Startup performance
* Query performance
* Large history behavior
* Data size
* Migration support
* Backup/import support
* Transaction safety
* Renderer/main-process architecture
* Error recovery
* Testability

The result of this audit should be documented before a major storage rewrite.

Possible outcomes:

```text
KEEP
```

if the current solution is sufficient.

```text
REFACTOR
```

if the storage technology is suitable but the implementation is poorly structured.

```text
REPLACE
```

only if there is a demonstrated technical reason.

---

# 16. Storage Independence

The rest of the application must not care which database technology is used.

For example:

```text
Application
     ↓
ClipboardRepository
     ↓
IndexedDBRepository
```

If the storage implementation changes later:

```text
Application
     ↓
ClipboardRepository
     ↓
NewStorageRepository
```

the application/domain layers should remain mostly unchanged.

---

# 17. Data Schema Versioning

Persistent data must be versioned.

Every schema-changing modification must have a migration strategy.

Requirements:

* Version numbers
* Deterministic migrations
* No silent data loss
* Migration error handling
* Backward compatibility where practical
* Tests for important migrations

Existing user data must be treated as valuable.

A new version of TextVault Pro must not casually destroy an existing user's clipboard library.

---

# 18. Clipboard Engine

The Clipboard Engine is one of the most important subsystems.

Responsibilities:

1. Detect clipboard changes.
2. Identify content type.
3. Identify source application when possible.
4. Apply exclusion rules.
5. Apply pause state.
6. Apply privacy rules.
7. Apply sensitive-content policy.
8. Apply duplicate policy.
9. Create clipboard record.
10. Persist the record.
11. Notify interested application components.

Conceptual flow:

```text
System Clipboard
       ↓
Clipboard Monitor
       ↓
Content Extraction
       ↓
Source Application
       ↓
Privacy Rules
       ↓
Sensitive Content Rules
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

# 19. Clipboard Monitoring Lifecycle

Clipboard monitoring must work independently of whether the main window is visible.

For example:

```text
Window visible
    ↓
Clipboard monitoring active

Window hidden
    ↓
Clipboard monitoring continues

Application paused
    ↓
Clipboard monitoring suspended

Application quit
    ↓
Clipboard monitoring stopped
```

The exact lifecycle behavior must respect user settings.

---

# 20. Duplicate Handling

Duplicate clipboard behavior must be configurable.

Potential policies:

```text
Allow duplicates
Ignore exact duplicates
Move duplicate to top
Update existing item timestamp
```

The chosen behavior must be centralized.

Do not implement duplicate handling separately in multiple UI components.

---

# 21. Clipboard Data Model

The architecture should not assume clipboard content will always be plain text.

Initial implementation may focus on:

```text
Plain Text
```

The model should remain extensible for:

```text
URL
Rich Text
HTML
Image
Code
Structured content
```

Conceptual model:

```text
ClipboardItem
    id
    contentType
    content
    preview
    createdAt
    updatedAt
    sourceApplication
    sourceWindow
    isFavorite
    isPinned
    tags
    metadata
```

Only fields actually required by the product should be implemented.

Do not add speculative database fields without a purpose.

---

# 22. Search Architecture

Search must be implemented as an application capability, not as UI-only filtering.

Search should support the requirements defined in `FEATURES.md`.

Potential capabilities:

* Content search
* Tags
* Favorites
* Pins
* Collections
* Content type
* Date
* Source application
* Search operators
* Fuzzy search

The search system must be optimized for realistic clipboard history sizes.

---

# 23. Search Performance

Do not repeatedly scan the entire dataset on every keystroke when the history becomes large.

Use appropriate techniques such as:

* Debouncing
* Indexing
* Caching
* Pagination
* Incremental search
* Virtualized rendering

Only introduce a dedicated search engine if it is justified.

A lightweight implementation is preferred until real performance requirements prove otherwise.

---

# 24. Search Index

If an index is introduced:

```text
Primary Storage
      ↓
Search Index
      ↓
Search Service
```

The search index must be rebuildable from primary storage.

The search index must never be the only copy of user data.

If the index becomes corrupted:

```text
Primary Data
      ↓
Rebuild Index
```

must be possible.

---

# 25. System Tray Architecture

System tray behavior belongs to the desktop integration layer.

The tray should provide access to relevant actions such as:

```text
Open TextVault
Quick Clipboard
Pause / Resume
Settings
Quit
```

Tray behavior must remain functional even when the main window is hidden.

---

# 26. Window Lifecycle

The application must distinguish between:

```text
Minimize
Hide
Close
Quit
```

User-configurable behavior may include:

```text
Close → Quit
Close → Hide to Tray
Close → Minimize to Tray
```

The implementation must prevent accidental termination of clipboard monitoring.

Lifecycle behavior must have automated tests where practical.

---

# 27. Startup Behavior

Startup behavior should be configurable.

Possible options:

```text
Start with Windows
Start minimized
Start hidden
Start normally
```

Windows-specific implementation belongs behind a platform abstraction.

---

# 28. Global Shortcut Architecture

Global shortcuts belong to the desktop integration layer.

Potential shortcuts:

```text
Open quick clipboard
Open TextVault
Open command palette
Pause/resume clipboard monitoring
```

Shortcut registration must:

* Detect conflicts
* Fail gracefully
* Avoid crashing the application
* Be cleaned up on shutdown
* Respect user configuration

---

# 29. Quick Clipboard

Quick Clipboard is a dedicated interaction surface.

Its primary goals are:

* Speed
* Keyboard-first interaction
* Minimal visual distraction
* Search
* Recent clipboard access
* Favorite access
* Pinned access
* Fast selection

The user should not need to navigate through the main dashboard to paste/select a recent item.

---

# 30. Command Registry

The application should use a centralized command model.

Conceptually:

```text
Command
    id
    label
    description
    shortcut
    category
    availability
    execute()
```

Commands may be reused by:

* Command palette
* Keyboard shortcuts
* Menus
* Context menus

This prevents the same action from being implemented multiple times.

---

# 31. Snippet Architecture

Snippets are reusable user-defined text.

They should be modeled independently from clipboard history.

Example:

```text
Snippet
    id
    title
    content
    description
    tags
    collection
    createdAt
    updatedAt
```

Future variable support may include:

```text
{{date}}
{{time}}
{{clipboard}}
```

but variables are not required for the initial implementation unless specified by the roadmap.

---

# 32. Collections and Tags

Collections and tags should be separate concepts.

Tags:

```text
Cross-cutting labels
```

Collections:

```text
Logical groups of related content
```

Do not force every item to belong to a collection.

The data model should support:

* Multiple tags
* Optional collection
* Favorites
* Pins

---

# 33. Privacy Architecture

Privacy rules must be centralized.

Potential privacy controls:

```text
Pause clipboard monitoring
Excluded applications
Sensitive content filtering
Retention policy
Manual history clearing
Private mode
Source metadata controls
```

The evaluation should occur before data is persisted whenever possible.

Example:

```text
Clipboard Change
       ↓
Is Monitoring Paused?
       ├── Yes → Ignore
       └── No
            ↓
Is Source Excluded?
       ├── Yes → Ignore
       └── No
            ↓
Sensitive Content Policy
       ↓
Duplicate Policy
       ↓
Persist
```

---

# 34. Application Exclusions

Users should be able to exclude applications from clipboard monitoring.

Examples may include:

* Password managers
* Banking applications
* Security tools

The architecture must treat exclusions as rules evaluated by the clipboard engine.

The UI should not implement exclusion logic.

---

# 35. Sensitive Content Detection

Sensitive-content detection is a privacy aid, not a guarantee.

Potential detection targets:

* Password-like content
* API keys
* Authentication tokens
* One-time codes
* Private keys
* Payment-card-like numbers

Detection must be:

* Configurable
* Testable
* Conservative
* Privacy-conscious

Do not claim that detection can identify every secret.

False positives and false negatives are expected.

---

# 36. Logging Architecture

Production logs must never contain clipboard contents by default.

Never log:

* Clipboard text
* Passwords
* Tokens
* API keys
* Private keys
* Authentication codes

Logs may contain:

```text
Timestamp
Component
Operation
Error type
Stack trace
Non-sensitive metadata
```

Debug logging must remain privacy-conscious.

---

# 37. Settings Architecture

Settings should have one authoritative representation.

Suggested groups:

```text
General
Clipboard
Privacy
Shortcuts
Appearance
Language
Storage
Notifications
Advanced
```

Settings must be:

* Validated
* Versionable
* Persisted safely
* Loaded consistently
* Available through a defined service

Avoid scattering settings across unrelated files.

---

# 38. Configuration Defaults

Every configurable setting must have a safe default.

If configuration data is:

* Missing
* Corrupted
* Invalid
* From an older version

the application should recover safely.

Do not crash because a single optional setting is malformed.

---

# 39. Import / Export Architecture

Import/export must be handled by dedicated services.

Conceptual services:

```text
ImportService
ExportService
BackupService
```

Import process:

```text
Input
  ↓
Format Detection
  ↓
Validation
  ↓
Normalization
  ↓
Conflict Handling
  ↓
Persistence
```

Do not write partially validated imported data directly into storage.

---

# 40. Backup Architecture

Backups should be:

* Versioned
* Portable
* Self-describing
* Validatable
* Restorable

Backups should contain the information required to restore the user's library.

They should not depend on internal implementation details unnecessarily.

---

# 41. Event Architecture

Subsystem communication may use typed application events.

Examples:

```text
clipboard:item-added
clipboard:item-updated
clipboard:item-deleted
clipboard:history-cleared

settings:changed

system:pause-changed

window:shown
window:hidden
```

Events must remain explicit.

Do not create a giant global event bus that becomes impossible to reason about.

Use direct service calls when direct communication is simpler.

---

# 42. State Management

Application state must be separated into:

## Persistent State

Examples:

```text
Clipboard history
Favorites
Pins
Tags
Collections
Snippets
Settings
```

## UI State

Examples:

```text
Selected item
Current tab
Search input
Open dialog
Temporary filters
Selection mode
```

Do not persist temporary UI state without a clear reason.

---

# 43. UI State Synchronization

The UI should react to application state changes.

For example:

```text
Clipboard Engine
       ↓
Application Service
       ↓
State Update / Event
       ↓
Renderer
       ↓
History UI
```

The UI should not repeatedly poll the database unnecessarily.

---

# 44. Error Handling

Errors should be categorized.

Examples:

```text
ValidationError
StorageError
ClipboardError
SearchError
PlatformError
ImportError
ExportError
ConfigurationError
IPCError
```

Errors must be handled at the correct layer.

User-facing messages should be understandable.

Internal errors should contain diagnostic information without leaking sensitive content.

---

# 45. Long-Running Operations

Operations that may take noticeable time must not freeze the renderer.

Potential examples:

* Large import
* Large export
* Backup
* Retention cleanup
* Search index rebuild
* Large history migration

Use:

* Background processing
* Workers
* Main-process execution
* Incremental processing

only when justified.

Do not add workers everywhere prematurely.

---

# 46. Performance Architecture

TextVault Pro should remain responsive with large clipboard histories.

At minimum, performance should be considered for:

```text
1,000 items
5,000 items
10,000 items
```

where practical.

The application should avoid:

* Rendering thousands of DOM nodes
* Repeated full-history searches
* Unnecessary serialization
* Large synchronous operations on the UI thread
* Repeated database initialization
* Excessive state updates

Virtualized rendering should be used for large lists/grids.

---

# 47. Memory Management

Clipboard histories can grow continuously.

The architecture must prevent unbounded memory growth.

Do not keep the entire database permanently duplicated in multiple in-memory structures unless there is a clear reason.

Caches must have a purpose and reasonable invalidation behavior.

---

# 48. Platform Adapter Architecture

Platform-specific behavior should use adapters.

Conceptually:

```text
PlatformService
      │
      ├── WindowsPlatformService
      ├── MacOSPlatformService
      └── LinuxPlatformService
```

Possible interfaces:

```text
ClipboardProvider
ShortcutService
StartupService
NotificationService
WindowService
ActiveApplicationService
PlatformService
```

Only Windows implementations are required initially.

---

# 49. Windows-First Strategy

Windows is the primary platform.

Windows-specific requirements may include:

* Startup integration
* System tray
* Global shortcuts
* Notifications
* Active application detection
* Clipboard integration
* Installer
* Portable application
* Application data directories

Windows APIs must remain isolated from domain logic.

---

# 50. Cross-Platform Strategy

Cross-platform support is an architectural goal, not necessarily an initial release requirement.

The core application should remain platform-neutral.

Adding macOS/Linux later should primarily require:

```text
New platform adapters
```

rather than rewriting:

```text
Domain
Application
Search
Data models
Core UI
```

---

# 51. Security Architecture

Electron security is mandatory.

Baseline requirements:

```text
contextIsolation: true
nodeIntegration: false
```

Additional requirements:

* Explicit IPC channels
* Input validation
* No arbitrary shell execution
* No unrestricted filesystem access from renderer
* Safe external link handling
* Controlled navigation
* No arbitrary preload exposure
* No unnecessary remote content
* No unsafe code evaluation

Security-specific details belong in `SECURITY.md`.

---

# 52. External Services Boundary

The core application must not depend on external services.

Future features such as:

```text
Cloud Sync
AI
Remote Backup
Account Systems
```

must exist as optional adapters.

They must not contaminate the core local architecture.

---

# 53. Cloud Sync Boundary

Future cloud synchronization should conceptually look like:

```text
Local Storage
      ↕
Sync Engine
      ↕
Remote Provider
```

Local storage remains the primary source for offline operation.

Cloud synchronization must not be required for normal use.

---

# 54. AI Boundary

AI is explicitly outside the core architecture.

Future AI functionality must be isolated.

Examples:

```text
AIService
    summarize()
    classify()
    transform()
```

No clipboard data should be sent to an external AI provider automatically.

Any future AI operation involving clipboard content must require clear user intent.

---

# 55. Dependency Rules

The following dependency rules are mandatory.

## Allowed

```text
UI → Application
Application → Domain
Application → Infrastructure Interfaces
Infrastructure → External APIs
Infrastructure → Electron
```

## Not Allowed

```text
Domain → Electron
Domain → React
Domain → IndexedDB
Domain → Windows APIs

UI → direct filesystem
UI → direct Node.js
UI → direct database implementation
```

These boundaries should be enforced as much as practical.

---

# 56. Folder Structure

The exact final folder structure may evolve.

A reasonable target is:

```text
TextVault/
│
├── electron/
│   ├── main/
│   │   ├── app/
│   │   ├── clipboard/
│   │   ├── desktop/
│   │   ├── ipc/
│   │   ├── platform/
│   │   └── services/
│   │
│   └── preload/
│
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── hooks/
│   ├── pages/
│   ├── services/
│   ├── state/
│   ├── styles/
│   └── utils/
│
├── shared/
│   ├── types/
│   ├── contracts/
│   ├── schemas/
│   └── constants/
│
├── test/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/
│
└── ...
```

This structure is a target, not an instruction to blindly move every file immediately.

---

# 57. Migration Strategy

Architecture migration must be incremental.

Recommended sequence:

```text
1. Audit existing code
2. Identify stable functionality
3. Identify architectural problems
4. Define interfaces
5. Extract services
6. Isolate Electron APIs
7. Improve IPC
8. Refactor storage access
9. Isolate platform integrations
10. Improve testing
11. Remove obsolete code
```

Do not perform a giant rewrite unless there is a compelling reason.

---

# 58. Existing Feature Audit

Every major existing subsystem should receive one of these classifications:

```text
KEEP
```

Existing implementation is good enough.

```text
REFACTOR
```

Existing behavior is valuable but structure should improve.

```text
REWRITE
```

The concept is correct but implementation is fundamentally unsuitable.

```text
REPLACE
```

A different technical solution is required.

```text
REMOVE
```

The feature is no longer part of the product.

The decision must be based on evidence, not preference.

---

# 59. Testing Architecture

Architecture must support independent testing.

## Unit tests

Test:

* Domain rules
* Duplicate policies
* Retention policies
* Privacy rules
* Search logic
* Settings validation
* Sensitive-content detection
* Data transformations

## Integration tests

Test:

* Storage
* Migrations
* Clipboard engine
* IPC
* Import/export
* Platform adapters

## E2E tests

Test real user behavior:

* Clipboard capture
* Search
* Favorite
* Pin
* Delete
* Restore
* Clear history
* Quick clipboard
* Global shortcuts
* Tray behavior
* Settings
* Import/export
* Restart persistence
* Large histories

---

# 60. Testability Rules

Core business logic should be testable without launching the entire Electron application whenever practical.

Avoid designs where testing a simple business rule requires:

```text
Electron
+
BrowserWindow
+
Renderer
+
OS
+
Database
```

If a pure function or isolated service can perform the work, prefer that design.

---

# 61. Packaging Architecture

The application must support:

```text
Development
Production
Windows Installer
Windows Portable Build
```

Packaging configuration must be version-controlled.

Packaging must not accidentally reset or delete user data.

---

# 62. Data Location

User data must use appropriate application data locations.

The exact path should be determined by the existing implementation and Electron/platform conventions.

Do not hard-code developer-specific paths.

Never store production user data inside the repository.

---

# 63. Application Lifecycle

The lifecycle should be explicit:

```text
Application Start
      ↓
Initialize Configuration
      ↓
Initialize Storage
      ↓
Run Migrations
      ↓
Initialize Clipboard Engine
      ↓
Initialize Desktop Integration
      ↓
Create Window / Tray
      ↓
Ready
```

Shutdown:

```text
Shutdown Requested
      ↓
Stop New Operations
      ↓
Flush Pending Writes
      ↓
Stop Clipboard Monitoring
      ↓
Release Shortcuts
      ↓
Destroy Tray / Windows
      ↓
Quit
```

The exact sequence may vary according to Electron behavior, but pending user data must not be lost.

---

# 64. Crash Safety

Important operations should fail safely.

Potential protections:

* Transactional storage writes
* Safe migrations
* Pending-write handling
* Draft recovery where required
* Backup before risky destructive operations
* Atomic file writes where filesystem persistence is used

A crash must not easily corrupt the entire clipboard library.

---

# 65. Observability

The application should make failures diagnosable without violating privacy.

Useful diagnostic information:

```text
Application version
OS version
Component
Operation
Error category
Timestamp
Stack trace
```

Never require clipboard contents for ordinary diagnostics.

---

# 66. Architecture Anti-Patterns

The following should be avoided.

## Giant Main Process

One huge Electron main file containing everything.

## God Service

One service responsible for storage, clipboard, search, settings, and UI.

## Generic IPC

One unrestricted IPC function forwarding arbitrary commands.

## UI Business Logic

Important business rules implemented directly in components.

## Direct Database Access

UI components directly querying IndexedDB.

## Global Mutable State

Everything stored in one giant mutable object.

## Premature Abstraction

Interfaces and factories created without a real need.

## Premature Microservices

Remote APIs introduced for functionality that should remain local.

## Overengineering

Complex architecture added without a demonstrated requirement.

---

# 67. Architecture Decision Process

When an architectural decision is required, follow this order:

1. Check `PRODUCT_SPEC.md`.
2. Check `FEATURES.md`.
3. Check this architecture document.
4. Inspect existing implementation.
5. Prefer reuse if technically sound.
6. Prefer the simplest valid solution.
7. Consider privacy.
8. Consider performance.
9. Consider testability.
10. Consider future platform support.
11. Document significant decisions.

Do not make major architectural changes silently.

---

# 68. Architecture Decision Records

For major decisions, document:

```text
Decision
Reason
Alternatives considered
Trade-offs
Impact
```

Examples of decisions that may deserve documentation:

* Replacing IndexedDB
* Introducing a dedicated search index
* Moving clipboard capture between processes
* Introducing a new state-management library
* Adding a native Windows dependency
* Introducing cloud synchronization
* Introducing AI infrastructure

Small implementation details do not require formal records.

---

# 69. Performance Validation

Do not claim that an architecture is performant without testing.

Important scenarios include:

```text
1,000 clipboard items
5,000 clipboard items
10,000 clipboard items
Large individual clipboard entries
Rapid clipboard changes
Rapid searches
Bulk deletion
Large imports
Application restart
```

Performance regressions should be investigated before release.

---

# 70. Reliability Requirements

The architecture should prioritize:

1. Data integrity
2. Clipboard capture reliability
3. Application stability
4. Privacy
5. Search responsiveness
6. UI responsiveness
7. Feature richness

A visually impressive feature is not worth compromising clipboard reliability.

---

# 71. Architecture and UX

Architecture decisions must support the product's UX goals.

The user should experience:

* Immediate response
* Reliable capture
* Fast search
* Minimal waiting
* Predictable behavior
* Clear errors
* Safe data handling
* Consistent shortcuts
* Consistent commands

Internal complexity must not become visible as unnecessary UI friction.

---

# 72. Implementation Rules for Agents

When an AI coding agent works on TextVault Pro, it MUST follow these rules:

1. Read the relevant documentation before modifying architecture.
2. Inspect existing implementation before replacing it.
3. Do not perform unrelated refactors.
4. Do not rewrite the entire project without explicit authorization.
5. Do not introduce dependencies without justification.
6. Do not bypass Electron security boundaries.
7. Do not expose unrestricted IPC.
8. Do not put business logic into UI components unnecessarily.
9. Do not put Electron-specific code into domain modules.
10. Preserve existing working functionality unless the specification explicitly changes it.
11. Add or update tests when changing important behavior.
12. Run relevant tests after architectural changes.
13. Update documentation when architecture materially changes.
14. Keep the project buildable after each meaningful step.
15. Do not silently change the storage format.
16. Do not delete user data during development or migration.
17. Do not add cloud or AI functionality unless the current roadmap explicitly requires it.
18. Stop at the requested phase boundary.

---

# 73. Definition of Done

An architectural change is not complete merely because the code compiles.

A meaningful architectural change is complete when:

* The intended boundary is clear.
* Existing behavior is preserved or intentionally changed.
* Relevant tests pass.
* New behavior is covered appropriately.
* No unnecessary dependency was introduced.
* Security requirements remain satisfied.
* Performance is acceptable.
* Documentation is updated when necessary.
* No unrelated files were changed unnecessarily.

---

# 74. Final Architecture Goal

The final TextVault Pro architecture should make the following possible:

```text
Replace storage
        ↓
without rewriting UI

Add macOS support
        ↓
without rewriting domain logic

Add Linux support
        ↓
without rewriting clipboard business rules

Add cloud sync
        ↓
without making cloud mandatory

Add AI features
        ↓
without coupling AI to core functionality

Change UI framework
        ↓
without rewriting the domain

Improve search
        ↓
without rewriting clipboard capture
```

This is the architectural direction.

The application should remain a cohesive desktop product, not a collection of disconnected systems.

---

# 75. Non-Negotiable Rules

The following rules are considered non-negotiable:

1. Local-first core functionality.
2. Privacy-first clipboard handling.
3. No clipboard content in normal logs.
4. Strict Electron security boundaries.
5. No unrestricted renderer access to Node.js.
6. No unrestricted IPC.
7. Domain logic independent from Electron.
8. Storage accessed through defined abstractions.
9. Platform-specific code isolated.
10. Existing user data treated as valuable.
11. No unnecessary full-project rewrites.
12. No unnecessary dependencies.
13. No premature cloud infrastructure.
14. No premature AI infrastructure.
15. Important business logic must be testable.
16. Performance must be validated against realistic history sizes.
17. Architecture must remain understandable to a future maintainer.

---

# 76. Final Principle

TextVault Pro should be architected as a serious desktop application, but not as an unnecessarily complicated enterprise system.

The correct architecture is the simplest architecture that provides:

* Reliability
* Security
* Privacy
* Performance
* Testability
* Maintainability
* Extensibility

When simplicity and unnecessary abstraction conflict, choose simplicity.

When short-term convenience and long-term data safety conflict, choose data safety.

When a rewrite and a safe incremental refactor provide the same result, choose the incremental refactor.

The architecture exists to serve the product.

The product does not exist to demonstrate the architecture.

---

# 77. As-Built Implementation Notes (Phase 1, 2026-09-03)

This section records how the architecture is actually implemented so the
document never drifts from the code. Update it whenever the boundaries change.

## 77.1 Main-process module map

`electron/main.js` is a thin composition root. All responsibilities live in
dedicated modules:

```text
electron/
├── main.js                    composition root: env/userData hook, privileged
│                              scheme registration, single-instance lock,
│                              whenReady wiring, lifecycle
├── preload.js                 contextBridge → window.tv (see 77.3)
├── ipc/
│   ├── channels.js            single registry of IPC channel names
│   ├── validate.js            pure input validators (unit-tested in Node)
│   └── register.js            the ONLY module that registers ipcMain handlers
├── services/
│   ├── app-protocol.js        app:// scheme (src/ + shared/, path-contained)
│   ├── window.js              main window, webPreferences, flush handshake,
│                              will-navigate guard, window-open denial
│   ├── menu.js                application menu (commands relayed to renderer)
│   ├── export-service.js      TXT/DOCX/PDF rendering, hidden print window
│   ├── file-dialogs.js        native dialogs, atomic writes, TEST_DIR hook
│   ├── clipboard-service.js   clipboard monitor: change detection, capture
│   │                          tagging, pending-capture queue (Phase 3)
│   └── tray.js                system tray menu (Phase 3)
└── exporters/                 pure format builders (txt, docx, pdf-html)
```

## 77.2 IPC channel table

Channel names are defined once in `electron/ipc/channels.js`
(`HANDLED` = renderer→main, `EMITTED` = main→renderer). `test/ipc-tests.mjs`
enforces registry/preload/handler consistency. Every handler validates its
payload at the boundary (`ipc/validate.js`) and answers with a predictable
`{ ok, ... }` object; validation errors are generic strings safe for display.

| Channel | Direction | Validation summary |
|---|---|---|
| `tv:export` | R→M | kind ∈ {txt,docx,pdf}; mode ∈ {single,combined,separate}; entries 1–5000 × string content ≤5 MB; total ≤64 MB; bounded defaultName |
| `tv:backup-export` | R→M | entries ≤100k × string content ≤10 MB; total ≤64 MB |
| `tv:backup-import` | R→M | `pathOverride` accepted ONLY when `TEXTVAULT_TEST_DIR` is set AND the resolved path stays inside it; production is dialog-only |
| `tv:clipboard-read` | R→M | no payload |
| `tv:clipboard-write` | R→M | string or nullish; ≤5 MB |
| `tv:app-info` | R→M | no payload |
| `tv:open-path` | R→M | path allowlist: only the app's own userData directory may be opened |
| `tv:flushed`, `tv:mark-dirty` | R→M | no payload (flush handshake) |
| `tv:clipboard-state` | R→M | no payload |
| `tv:clipboard-set-paused` | R→M | boolean required |
| `tv:clipboard-set-enabled` | R→M | boolean required |
| `tv:clipboard-get-pending` | R→M | no payload |
| `tv:clipboard-ack` | R→M | array of id strings, ≤500 |
| `tv:close-resolve` | R→M | one of 'quit' \| 'tray' \| 'cancel' |
| `menu` | M→R | static command strings from the menu module |
| `tv:flush`, `tv:flushed-reply` | M→R | flush handshake |
| `clipboard:captured` | M→R | validated clipboard item (see 77.6) |
| `clipboard:state-changed` | M→R | monitor state snapshot (booleans/numbers) |
| `tv:close-request` | M→R | no payload; renderer must answer via `tv:close-resolve` |

## 77.3 Preload surface

`window.tv` exposes exactly: `export, backupExport, backupImport,
clipboardRead, clipboardWrite, appInfo, openPath, onFlush, notifyFlushed,
markDirty, onMenu`. No generic invoke/send, no Node APIs. Channel names are
inlined in preload (sandboxed preloads cannot require local files); the
registry/preload sync is enforced by tests, not by convention.

## 77.4 Security-relevant decisions

1. **Single instance** (`app.requestSingleInstanceLock`): a second launch
   focuses the existing window. Reason: two processes writing the same
   IndexedDB store is a data-integrity hazard. Alternatives considered:
   none that preserve a single local database safely.
2. **`tv:open-path` allowlist**: the only legitimate renderer use is
   Settings → "Open Folder" for the userData path. The handler accepts only
   that directory (validator unit-tested).
3. **Backup import path override**: removed in production; retained solely as
   a test-mode capability (`TEXTVAULT_TEST_DIR` + containment check) because
   the E2E suite must read exports from disk without native dialogs.
4. **Navigation guard**: `will-navigate` blocks any non-`app://` navigation;
   `window.open` is denied outright.
5. **Atomic writes**: every file the main process writes for the user
   (exports, backups) goes through temp-file + rename.
6. **Filename sanitization**: export filenames use the shared, unit-tested
   `sanitizeFilename`/`uniqueFilename` (the former main-process duplicate was
   removed).

## 77.5 Storage note

User data remains in the renderer-side IndexedDB database (`textvault`).
**Decision (Phase 2, 2026-09-03): KEEP** the renderer-side IndexedDB storage —
audit outcome per §15 of this document:* Reliability/transactions: IndexedDB is transactional and LevelDB-backed;
  the E2E suite proves restart persistence.
* Performance: virtualized rendering keeps the DOM bounded; full-content
  search is chunked. No measured bottleneck justifies a rewrite.
* Testability: existing suites already cover persistence end-to-end.
* No demonstrated technical reason to REPLACE; the gaps were structural and
  are now addressed in place (see below).

Storage hardening added in Phase 2:

1. **Record validation** — every write to the `entries` store passes
   `shared/validation.mjs → validateEntryRecord` (shape, id, size limits:
   5 MB content, 300-char titles, 24 tags × 64 chars). Invalid records are
   rejected loudly, never persisted partially.
2. **Schema versioning** — the version is persisted under the
   `schema-version` settings key; `shared/storage-migrations.mjs` holds
   forward-only, deterministic migrations and a pure, unit-tested runner
   that fails safe (a failing migration preserves records and reports).
3. **Transactional multi-record operations** — `replaceEntries` (import
   replace: clear + put in ONE transaction), `putEntries` (import merge),
   and `deleteMany` (empty trash) are atomic. The previously non-transactional
   replace-import data-integrity risk (PROGRESS.md §10.1 F) is resolved.
4. **Settings hardening** — stored settings are sanitized through
   `sanitizeSettings` (defaults repaired, ranges clamped, unknown keys
   dropped); a corrupted settings record can never break boot.
5. **Failure surfacing** — a failure to load the library on boot is now a
   visible error (toast) instead of a silently emptied vault.

## 77.6 Clipboard Engine (Phase 3, as-built)

```text
System clipboard ( polled every 600 ms, change detection via last text )
      ↓  main: clipboard-service.js
Capture (skip: empty / unchanged / oversized > 1 MB → skipped counter)
      ↓  tag: timestamps, sensitive-content flags (shared/sensitive.mjs)
clipboard:captured event  →  Renderer
      ↓  renderer: core/clipboard.js — THE ONLY policy layer
Duplicate policy ('top' = move-to-top | 'new')  [shared/clipboard-policy.mjs]
      ↓
Persistence → validated `clipboard` store (schema v2)
      ↓
Retention (maxItems; pinned/favorite protected)  [pure, unit-tested]
      ↓
Ack → main drops the capture from its pending queue
```

Decisions and properties:

1. **Storage ownership**: the renderer's IndexedDB is the single canonical
   store for clipboard history. The main process keeps only *unacknowledged*
   captures in a bounded queue (≤200) so nothing is lost while the renderer
   is busy or reloading; unacked captures drain on next boot.
2. **Policy centralization**: duplicate and retention policies are pure
   functions in `shared/clipboard-policy.mjs` used only by
   `core/clipboard.js` — never by UI components.
3. **Sensitive content is mark-only**: captures are flagged
   (`isSensitive`, `sensitiveKinds`) and masked in the UI until revealed;
   content is never blocked, altered, or deleted by detection.
4. **Oversized captures** (>1 MB) are skipped, counted, and surfaced in the
   monitor state — never silently truncated (SECURITY.md §59.11).
5. **Background operation**: closing the main window resolves a close
   disposition ('quit' | 'tray' | 'cancel', user-configurable with
   ask-once-and-remember default). 'tray' hides the window; the renderer —
   and therefore monitoring — keeps running. If the renderer cannot answer
   a close request within 3 s, the app quits (v1.0.0 fallback).
6. **System tray**: Open, Settings, Pause/Resume, Quit; the menu reflects
   monitor state. Source-application detection is NOT implemented (no native
   modules) — the exclusion rule infrastructure exists and applies when a
   source is known (currently never); documented limitation.
7. **Pause semantics**: while paused, the monitor does not read the
   clipboard at all; content copied during a pause is captured only after
   resume (it was never persisted *during* the pause — verified by E2E).
8. **Schema v2**: the `clipboard` object store (indexes: createdAt,
   updatedAt, contentHash) was added in `onupgradeneeded`; entry records
   themselves are unchanged (MIGRATIONS[2] is an explicit no-op).

## 77.7 Core Library (Phase 4, as-built)

1. **Schema v3**: adds `snippets` and `collections` object stores; the
   migration adds `collections` membership (and `isPinned` for text entries)
   to existing records — existing values are preserved, nothing is dropped.
2. **Collections model**: a collection is `{ id, name, description,
   createdAt }`; membership ids live ON member records (`collections: []` on
   clipboard items, snippets — and entries structurally). Renaming a
   collection never touches members; deleting one strips membership from all
   members inside a single storage transaction (no dangling references).
   Collections currently apply to clipboard items and snippets; text entries
   keep tags/colors (documented boundary).
3. **Pins**: distinct from favorites — Favorite = important, Pin = persistently
   prominent. Pinned dashboard cards sort above favorites; clipboard rows and
   the editor More menu expose pin toggles.
4. **Text tools**: pure functions in `shared/text-tools.mjs` (16
   transformations). The editor applies them to the WHOLE text via
   `insertText` so the transformation stays on the native undo stack and is
   never persisted until the user saves — source content is always
   recoverable. Invalid input (JSON/Base64/URL) fails with a safe message.
5. **Content detection**: `shared/detect.mjs` labels content conservatively
   (url/email/ip/path/json/code/markdown/command/text). Clipboard rows show a
   type badge; URLs get an explicit "Open URL" action executed by
   `tv:open-external` — validated to http(s) only, user-initiated, never
   automatic (SECURITY.md §26/§31).

## 77.8 Search & Organization (Phase 5, as-built)

1. **One parser everywhere**: `shared/query.mjs` parses and matches queries
   for all surfaces (dashboard texts, clipboard history, snippets).
   Operators: `tag:…`, `is:fav`, `is:pinned`, `type:…` (clipboard), and
   `collection:…` (matched against collection names). Free terms search
   content (clipboard), title+content (snippets), and title+preview+tags
   (texts). The dashboard additionally scores deep content matches
   (existing chunked scan retained).
2. **No separate index**: at measured scale a parsed scan is fast enough —
   **measured 2026-09-03 (E2E, real run): 10,005 clipboard entries, full
   term scan p95 = 14.9 ms, operator-filter scan p95 = 0.6 ms** (target
   ≤100 ms per TESTING.md §62). A dedicated search index would be premature
   complexity; revisit only with evidence (ARCHITECTURE.md §23/§24).
3. **Filters compose**: operators combine (`type:url is:pinned`), and the
   clipboard/snippet list views pin favorites above the rest while keeping
   pinned items topmost.
4. **Collection filtering** resolves ids to names at query time; renaming a
   collection therefore never invalidates search behavior.

## 77.9 UI/UX Polish and Desktop Experience (Phase 6, as-built)

1. **Quick Clipboard (P0)**: a frameless, always-on-top launcher window
   (`quick.html` + `src/js/quick.js`) toggled by a global shortcut
   (default `Control+Shift+V`, configurable and validated against the
   Electron accelerator shape). It shares the app:// origin and therefore
   the SAME IndexedDB — no duplicated store. Search uses the shared query
   parser; Enter/click copies; Escape hides; registration fails safely
   (no crash) on conflicts and is released on quit.
2. **Command palette (P1)**: central registry (`src/js/commands.js`) with
   id/label/icon/shortcut/category/run/available; Ctrl+K opens a searchable,
   keyboard-driven palette. Views and shortcuts reuse the same commands.
3. **i18n + RTL (P1)**: `shared/i18n.mjs` holds EN/FA tables (key parity is
   unit-tested); `App.applyLanguage()` applies document direction, the
   translated chrome (`data-i18n` attributes), main-process tray labels, and
   re-renders the active view. RTL layout uses flex/grid auto-flipping plus
   targeted `[dir="rtl"]` physical-property overrides; keyboard hints are
   bidi-isolated. Settings gains a Language section.
4. **i18n coverage status (honest scope note)**: the static chrome
   (navigation, toolbar, quick capture, all view headers/empty states) and
   the clipboard/trash views' dynamic strings are fully translated; editor
   internals, export dialogs, and some dashboard tooltips remain English at
   this point. Completing the sweep is tracked as remaining polish, not
   claimed as done.

## 77.10 IPC additions in Phase 6

| Channel | Direction | Validation summary |
|---|---|---|
| `tv:quick-hide` | R→M | no payload |
| `tv:set-shortcut` | R→M | accelerator shape validated (shared contract), registration may fail safely |
| `tv:set-language` | R→M | one of 'en' \| 'fa' |

## 77.11 Import / Export / Backup (Phase 8, as-built)

1. **Backup format v2** (`shared/backup-format.mjs`): envelope
   `{ format:'textvault-backup', version:2, app, exportedAt, entries,
   clipboard, snippets, collections }` with per-store count/size bounds.
   v1 backups (entries only) remain importable — version detection is
   explicit and unsupported versions are rejected with a safe message.
2. **Single validation contract**: the pure shared module validates export
   payloads and parsed backup files; the main process delegates to it and
   never trusts renderer data. Unit tests cover malformed/oversized/
   unsupported inputs.
3. **Staged restore**: import runs record-level revive/repair first, then
   applies merge or replace through the transactional storage layer
   (`db.replaceStore` = clear + put in ONE transaction per store). A crash
   mid-restore cannot leave a store half-modified; malformed input cannot
   partially destroy the library.
4. **Merge semantics**: exact-duplicate skip per store (content equality for
   clipboard/snippets, hash for texts); collection id conflicts resolve in
   favor of existing data; members always reference existing ids.

## 77.12 Performance & Reliability (Phase 9, as-built)

Measured 2026-09-03 on the development machine (Windows, Electron 33,
real E2E run — values in `test-output/perf-measurements.json` and
`PROGRESS.md` §19; not estimates):

| Metric | Measured | Target (TESTING.md §62) | Result |
|---|---|---|---|
| Process boot → renderer loaded (SMOKE) | 568 ms | ≤ 2.0 s p95 | PASS |
| Page boot (nav start → interactive) | 239 ms | ≤ 2.0 s p95 | PASS |
| Capture → persistence (write) | 0.6–1.5 ms | ≤ 100 ms p95 | PASS |
| Capture end-to-end (incl. 300 ms poll) | ~305 ms | (poll-aware; detection latency documented) | INFO |
| Search, full term scan @ 10,005 entries | p95 12.9 ms | ≤ 100 ms p95 | PASS |
| Quick Clipboard launch | cold 14 ms / warm 15 ms | ≤ 300 ms p95 | PASS |
| Renderer heap @ 10k items | 6.8 → 9.3 MB | bounded | PASS |
| Main RSS @ 10k items | 135 → 135 MB | bounded | PASS |
| Rapid-write stress (30 @ 120 ms) | 12 captures, no crash/flood | bounded | PASS |

1. **Polling tradeoff (documented)**: without native clipboard hooks,
   changes made within one poll interval (300 ms) collapse to the latest
   content. The stress test asserts the bounded subset, not 1:1 capture.
2. **No index**: the measured full-scan search meets the target with wide
   margin; a search index remains unjustified (§77.8).
3. **Long-running ≥2h soak**: NOT RUN in this environment (session-bound
   execution). The release gate item stays open for Phase 10 with an
   explicit environment-blocked note; the 10k-item load + stress tests are
   the interim reliability evidence.
