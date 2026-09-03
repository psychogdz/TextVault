# TextVault Pro — Testing Guide

## 1. Purpose

This document defines the official testing strategy, standards, workflows, test architecture, quality gates, and verification requirements for TextVault Pro.

TextVault Pro is a desktop application that interacts with:

* the operating system clipboard
* Electron processes
* global shortcuts
* the system tray
* local persistent storage
* the filesystem
* desktop windows
* multilingual text
* potentially sensitive user data

Therefore, testing must cover more than UI components.

The goal is to ensure that TextVault Pro is:

* correct
* reliable
* secure
* private
* performant
* accessible
* maintainable
* resilient to real-world desktop behavior

Testing is part of implementation, not something performed only before release.

---

# 2. Testing Principles

## 2.1 Test behavior, not implementation details

Tests should verify what the user or system expects.

Prefer:

```text
User copies text
→ TextVault captures it
→ entry appears in history
```

over tests that only verify internal function calls.

---

## 2.2 Critical workflows require multiple layers of testing

A critical feature should normally have appropriate coverage at several levels:

```text
Unit
  ↓
Integration
  ↓
E2E
  ↓
Manual Desktop QA
```

Not every small utility requires all four levels, but critical desktop functionality should not rely on a single test type.

---

## 2.3 Tests must be deterministic

Avoid tests that depend on:

* real external services
* unstable network connections
* real user data
* system state that cannot be controlled
* arbitrary timing delays

Prefer controlled fixtures, mocks, and deterministic test environments.

---

## 2.4 Tests must be meaningful

Do not increase test count simply to increase test count.

A test is valuable when it protects behavior that matters.

Avoid tests that merely duplicate implementation details.

---

# 3. Testing Pyramid

The project should follow an approximate testing pyramid:

```text
                 E2E
                /   \
          Integration
          /          \
        Unit        Component
```

Most tests should be fast unit/integration tests.

A smaller number of E2E tests should verify critical end-to-end workflows.

Manual testing remains important for OS-specific behavior.

---

# 4. Test Categories

TextVault Pro should use the following categories.

```text
Unit Tests
Component Tests
Integration Tests
IPC Tests
Electron Tests
E2E Tests
Regression Tests
Security Tests
Performance Tests
Accessibility Tests
Internationalization Tests
Manual Desktop Tests
Build Tests
Packaging Tests
Release Tests
```

---

# 5. Unit Testing

## Purpose

Unit tests verify isolated logic without requiring the full Electron application.

Good candidates include:

* domain rules
* parsers
* content detection
* text transformations
* search logic
* filter parsing
* validation
* settings validation
* duplicate detection
* retention calculations
* serialization
* import validation
* export formatting

---

## Unit Test Requirements

Unit tests should:

* be fast
* be deterministic
* have clear names
* test expected behavior
* include edge cases
* avoid unnecessary mocks

---

## Example Test Areas

### Duplicate Detection

Test:

```text
same content
different content
empty content
large content
Unicode content
Persian content
```

### Search

Test:

```text
exact match
partial match
case differences
fuzzy match
no result
Persian text
mixed RTL/LTR
special characters
```

### Filters

Test:

```text
tag:python
is:fav
is:pinned
type:text
combined filters
invalid filters
```

---

# 6. Component Testing

UI components should be tested when behavior is sufficiently complex to justify isolated testing.

Important candidates include:

```text
SearchBar
ClipboardItem
ClipboardList
FilterBar
TagSelector
CollectionSelector
CommandPalette
QuickClipboard
SettingsPanel
Modal
Toast
```

---

## Component Test Requirements

Test:

* rendering
* interaction
* keyboard behavior
* selected state
* disabled state
* error state
* loading state
* empty state
* accessibility behavior where practical

Do not test every CSS class unless it represents meaningful behavior.

---

# 7. Integration Testing

Integration tests verify multiple layers working together.

Examples:

```text
Application Service
        ↓
Repository
        ↓
IndexedDB
```

or:

```text
Renderer
   ↓
Preload
   ↓
IPC
   ↓
Application Service
```

---

## Important Integration Areas

Test:

* clipboard persistence
* repository behavior
* settings persistence
* tag/collection relationships
* snippets
* import/export
* IPC
* migrations
* privacy rules
* retention cleanup

---

# 8. IPC Testing

IPC is a critical security and correctness boundary.

Test:

* valid requests
* invalid requests
* malformed payloads
* missing fields
* unauthorized operations
* error responses
* unexpected values
* serialization
* large payloads where relevant

---

## IPC Requirements

A test should verify that the renderer cannot invoke arbitrary functionality through an unrestricted IPC mechanism.

For every important IPC operation verify:

```text
Input
→ Validation
→ Handler
→ Application Service
→ Result/Error
```

---

# 9. Preload Testing

The preload layer should be tested to ensure that it exposes only the intended API.

Verify:

* expected APIs exist
* unexpected Node APIs are not exposed
* IPC channels are correct
* invalid inputs are rejected
* returned data has expected shape

---

# 10. Electron Main Process Testing

Test main-process behavior such as:

* application startup
* window creation
* window destruction
* tray initialization
* tray actions
* global shortcuts
* application shutdown
* background mode
* clipboard monitoring lifecycle

Where direct automated testing is difficult, combine integration tests with manual Windows QA.

---

# 11. Clipboard Testing

Clipboard functionality is a critical system.

Testing must cover:

```text
Capture
Persistence
Duplicate Handling
Privacy
Exclusions
Sensitive Detection
Pause
Resume
Deletion
Clear
Restart
Shutdown
```

---

## Clipboard Capture Tests

Verify that:

* text is captured
* repeated identical content does not create unwanted duplicates
* different content creates new entries
* empty/invalid clipboard states are handled
* Unicode works
* Persian works
* mixed content works
* large content does not crash the application

---

## Clipboard Failure Tests

Simulate or reproduce:

* clipboard unavailable
* clipboard temporarily locked
* malformed clipboard data
* rapid clipboard changes
* application restart during monitoring

The application should recover gracefully.

---

# 12. Clipboard Privacy Tests

Verify:

### Pause

When monitoring is paused:

```text
System Clipboard
      ↓
TextVault
      X
```

No new history entry should be created.

### Private Mode

When private mode is enabled:

```text
Clipboard
   ↓
Detection
   ↓
Do not persist
```

The exact behavior must follow `SECURITY.md`.

### Exclusions

If an application is excluded:

```text
Excluded Application
        ↓
Clipboard
        ↓
Not persisted
```

---

# 13. Sensitive Content Tests

Sensitive-content detection must be tested without using real secrets.

Use synthetic test values.

Test patterns such as:

* token-like strings
* password-like strings
* API-key-like strings
* private-key-like structures

Also test false positives.

The goal is safe handling, not perfect classification.

---

# 14. Persistence Testing

Verify that data survives:

```text
Window close
Tray hide
Application restart
System restart
```

Where practical, simulate interrupted writes.

---

# 15. Database Testing

Database tests should cover:

* create
* read
* update
* delete
* bulk delete
* search
* indexes
* migration
* corrupted data handling
* large datasets

---

# 16. Migration Testing

Whenever the schema changes, test:

```text
Fresh database
Old database
Upgrade
Existing records
Missing fields
Unknown fields
Malformed records
Large database
```

Migration tests must verify that existing user data remains usable.

---

# 17. Search Testing

Search is a core workflow and requires strong coverage.

Test:

### Content

```text
exact match
partial match
case variations
Unicode
Persian
English
mixed language
numbers
symbols
```

### Metadata

```text
title
tag
favorite
pin
type
```

### Query Syntax

Test:

```text
tag:python
is:fav
is:pinned
type:text
```

and combinations.

---

# 18. Search Performance Testing

Search must remain responsive as history grows.

Test approximately:

```text
1,000 entries
5,000 entries
10,000 entries
25,000 entries
```

where practical.

Measure:

* search latency
* rendering time
* memory usage
* UI responsiveness

---

# 19. History Testing

Verify:

* history loads
* newest entries appear correctly
* sorting works
* filters work
* selection works
* bulk selection works
* deletion works
* restore works where supported
* favorite works
* pin works
* pagination/virtualization works where applicable

---

# 20. Organization Testing

Test:

### Tags

```text
create
rename
delete
assign
remove
search
filter
```

### Collections

```text
create
rename
delete
add
remove
browse
```

### Favorites / Pins

Verify:

* persistence
* filtering
* quick access
* bulk operations

---

# 21. Snippet Testing

Test:

* create
* edit
* delete
* search
* copy
* favorite
* tags
* persistence
* invalid content
* large content

If variables are implemented, also test:

* variable parsing
* missing variables
* malformed variables
* Unicode variables
* rendering
* replacement behavior

---

# 22. Smart Content Detection Testing

Test detection for:

```text
URL
Email
Phone
IP address
File path
JSON
Code
Command
Markdown
Plain text
```

Test both:

```text
Valid
Invalid
Ambiguous
```

Detection must not accidentally execute content.

---

# 23. Text Utility Testing

Every transformation should test:

* normal input
* empty input
* whitespace
* Unicode
* Persian
* mixed language
* large input
* malformed input where applicable

For JSON tools:

```text
valid JSON
invalid JSON
nested JSON
arrays
Unicode JSON
large JSON
```

---

# 24. Import / Export Testing

Import/export is a high-risk data feature.

Test:

```text
Export
↓
Import
↓
Compare
```

The resulting data should preserve the expected information.

---

## Import Tests

Test:

* valid file
* empty file
* malformed file
* unsupported version
* missing fields
* extra fields
* duplicate records
* large file
* merge
* replace

---

## Safety Requirement

A malformed import must never unexpectedly destroy the user's existing library.

---

# 25. Backup Testing

Verify:

* complete backup creation
* backup validation
* restore
* Unicode
* Persian
* metadata
* tags
* collections
* snippets
* large libraries

Perform round-trip testing:

```text
Library
 ↓
Backup
 ↓
Fresh Environment
 ↓
Restore
 ↓
Compare
```

---

# 26. Settings Testing

Test:

* defaults
* save
* load
* reset
* invalid values
* persistence
* migration

Settings-dependent features should be tested against both:

```text
Enabled
Disabled
```

states.

---

# 27. Tray Testing

Manual and automated testing should verify:

* tray appears
* show
* hide
* restore
* pause monitoring
* quit
* application remains active when expected
* quit actually terminates the application

Test after:

* normal startup
* restart
* settings changes
* shortcut changes

---

# 28. Global Shortcut Testing

Verify:

* registration
* successful activation
* configurable shortcut
* invalid shortcut
* conflicting shortcut
* duplicate registration
* cleanup on shutdown
* re-registration after restart

Windows manual verification is required.

---

# 29. Quick Clipboard Testing

Test:

```text
Open
Search
Navigate
Select
Copy
Paste
Close
```

Keyboard test:

```text
Shortcut
↓
Quick Clipboard
↓
Arrow keys
↓
Enter
↓
Selection
```

Verify that Escape closes the surface without leaving focus in a broken state.

---

# 30. Command Palette Testing

Test:

* open
* search commands
* keyboard navigation
* execute command
* cancel
* unavailable command
* command errors

Commands should come from the central command registry.

---

# 31. Window Lifecycle Testing

Test:

```text
Launch
Minimize
Hide
Close
Restore
Tray
Quit
Restart
```

Verify that closing the window does not unexpectedly stop required background services.

---

# 32. Crash Recovery Testing

Where practical, simulate:

* interrupted writes
* unexpected process termination
* malformed local data
* incomplete imports
* shutdown during persistence

Verify that the next startup can recover safely.

---

# 33. Regression Testing

Every bug fix should include a regression test when practical.

Example:

```text
Bug:
Duplicate clipboard entries created after rapid clipboard changes.

Fix:
Improve duplicate detection.

Regression test:
Rapidly submit identical clipboard content and verify one logical history entry.
```

Regression tests should remain permanently.

---

# 34. End-to-End Testing

E2E tests should represent real user workflows.

Critical E2E workflows include:

### Basic Clipboard

```text
Launch
→ Copy text
→ Open TextVault
→ Verify history
```

### Search

```text
Capture content
→ Search
→ Verify result
→ Open
```

### Organization

```text
Capture
→ Favorite
→ Pin
→ Tag
→ Filter
```

### Deletion

```text
Select
→ Delete
→ Verify removal
→ Restore if supported
```

### Quick Clipboard

```text
Global shortcut
→ Search
→ Select
→ Use clipboard
```

### Settings

```text
Open settings
→ Change option
→ Restart
→ Verify persistence
```

---

# 35. E2E Test Design

E2E tests should avoid unnecessary dependence on internal implementation.

Prefer user-level interactions:

```text
click
type
press key
copy
search
select
```

rather than directly manipulating internal application state.

---

# 36. E2E Test Stability

Avoid arbitrary sleeps such as:

```text
wait 5000ms
```

unless technically unavoidable.

Prefer:

```text
wait for element
wait for state
wait for event
wait for expected condition
```

This reduces flaky tests.

---

# 37. Accessibility Testing

Test:

* keyboard-only navigation
* focus visibility
* accessible names
* semantic controls
* dialogs
* menus
* forms
* error messages
* contrast
* reduced motion

Important workflows must be usable without a mouse.

---

# 38. Internationalization Testing

Test both:

```text
English
Persian
```

Every important UI surface must remain functional after language switching.

Verify:

* labels
* buttons
* menus
* settings
* errors
* empty states
* notifications
* dialogs

---

# 39. RTL Testing

Test:

```text
LTR
RTL
mixed content
```

Verify:

* sidebar
* navigation
* search
* filters
* cards
* dialogs
* menus
* settings
* editor
* keyboard navigation

---

# 40. Bidirectional Text Test Data

Maintain fixtures containing combinations such as:

```text
سلام دنیا
Hello World
سلام Hello
Hello سلام
سلام https://example.com
کد Python در متن فارسی
123 + فارسی
JSON + فارسی
URL + فارسی
```

Verify that visual order is correct while stored content remains unchanged.

---

# 41. Theme Testing

Test:

```text
Light
Dark
System
```

Verify:

* readability
* contrast
* icons
* inputs
* dialogs
* selection
* hover
* focus
* disabled state
* notifications

---

# 42. Responsive UI Testing

Test at multiple desktop window sizes.

At minimum:

```text
Small
Medium
Large
Maximized
```

Check:

* overflow
* clipped controls
* sidebar
* search
* dialogs
* long text
* empty states
* history list/grid

---

# 43. Reduced Motion Testing

When reduced motion is enabled:

* excessive animation should be disabled or reduced
* functionality must remain identical
* transitions must not block interaction

---

# 44. Performance Testing

Performance tests should cover:

## Startup

Measure application startup under:

```text
Fresh library
Medium library
Large library
```

## History

Measure:

```text
scrolling
rendering
search
filtering
selection
```

## Clipboard

Measure:

```text
capture latency
duplicate handling
background CPU
memory usage
```

## Quick Clipboard

Measure:

```text
shortcut → interface visible
```

The target should be perceived as immediate by normal users.

---

# 45. Stress Testing

Stress test:

* rapid clipboard changes
* large history
* large clipboard content
* repeated search
* repeated open/close
* repeated startup/shutdown
* bulk operations
* large imports
* large exports

Look for:

* crashes
* memory leaks
* UI freezes
* corrupted data
* duplicate events
* orphaned processes

---

# 46. Long-Running Tests

Clipboard managers are long-running applications.

Run extended sessions where practical.

Verify:

* monitoring remains active
* memory remains stable
* CPU remains reasonable
* events remain responsive
* no gradual degradation occurs

A test session may run for hours when investigating long-running reliability.

---

# 47. Memory Leak Testing

Inspect for leaks involving:

* event listeners
* timers
* subscriptions
* IPC handlers
* React effects
* clipboard monitoring
* tray resources
* windows
* cached data

Repeatedly opening and closing UI surfaces should not continuously increase memory without reason.

---

# 48. Security Testing

Security testing must include:

### Electron

Verify:

```text
contextIsolation
nodeIntegration
preload exposure
IPC validation
```

### Filesystem

Verify:

* path validation
* safe file operations
* import handling
* export paths

### External URLs

Verify:

* explicit user action
* safe URL handling
* no arbitrary command execution

### Clipboard

Verify:

* no sensitive logging
* exclusions
* private mode
* retention
* sensitive handling

---

# 49. Dependency Security Testing

When dependencies change:

* inspect dependency tree
* check for known vulnerabilities
* verify compatibility
* run tests
* verify build

Do not blindly update every dependency during unrelated work.

---

# 50. Network Verification

The core product should not unexpectedly transmit clipboard data.

During testing verify that:

* normal clipboard operation requires no cloud service
* clipboard content is not sent externally
* local workflows work offline

If a future feature introduces networking, it must have dedicated privacy and security tests.

---

# 51. Build Testing

Every meaningful release candidate must verify:

```text
Development build
Production build
```

Check:

* application starts
* renderer loads
* assets load
* storage works
* IPC works
* clipboard works
* packaging works

---

# 52. Packaging Testing

For Windows packaging test:

```text
Fresh install
Launch
Use clipboard
Restart
Upgrade
Uninstall
```

Where applicable, also test:

```text
Portable build
```

---

# 53. Upgrade Testing

Test upgrading from an older supported version.

Verify:

* database migration
* settings migration
* existing history
* tags
* collections
* snippets
* application startup
* tray
* shortcuts

Never assume a fresh installation is enough.

---

# 54. Data Integrity Testing

For operations that modify user data:

```text
Create
Update
Delete
Import
Export
Restore
Migration
```

verify:

* no unexpected loss
* no duplicated records
* relationships remain valid
* timestamps remain valid
* metadata remains valid

---

# 55. Test Environment Isolation

Tests must not accidentally modify the user's real TextVault data.

Use isolated:

* test databases
* temporary directories
* test configuration
* synthetic clipboard state
* test fixtures

Never run destructive tests against the real user library.

---

# 56. Test Data Privacy

Never use:

* real passwords
* real API keys
* real authentication tokens
* real private keys
* real personal clipboard data

Use synthetic fixtures.

Example:

```text
TEST_API_KEY_123456789
TEST_PASSWORD_EXAMPLE
TEST_TOKEN_ABCDEF
```

---

# 57. Test Naming

Test names should explain behavior.

Good:

```text
does not persist clipboard content while monitoring is paused
restores clipboard history after application restart
filters history by favorite state
rejects malformed backup files
```

Bad:

```text
test1
works
clipboard test
should pass
```

---

# 58. Test Organization

Keep tests logically organized.

Suggested structure:

```text
test/
├── unit/
│   ├── clipboard/
│   ├── search/
│   ├── snippets/
│   ├── text/
│   └── settings/
│
├── integration/
│   ├── storage/
│   ├── ipc/
│   ├── clipboard/
│   └── import-export/
│
├── e2e/
│   ├── clipboard/
│   ├── search/
│   ├── organization/
│   ├── quick-clipboard/
│   └── settings/
│
└── fixtures/
```

The exact structure may follow the actual test framework and repository organization.

---

# 59. Test Commands

The commands in this section must always reflect the actual `package.json`.

At the current stage, the following commands are executable:

### Start the application

```powershell
npm start
```

### Run the unit test suite

```powershell
npm test
```

Equivalent command:

```powershell
node test/unit.mjs
```

### Run E2E tests

```powershell
npm run test:e2e
```

Equivalent command:

```powershell
npx electron test/e2e.js
```

### Build/package the application

```powershell
npm run package
```

### Create a release

```powershell
npm run release
```

---

## Required Combined Test Command

The project should provide a single command for the complete automated test suite:

```powershell
npm run test:all
```

The corresponding `package.json` script should be:

```json
{
  "scripts": {
    "test:all": "npm test && npm run test:e2e"
  }
}
```

This script must be added before `npm run test:all` is used by CI or documented as an available repository command.

---

## Commands That Must Not Be Faked

The following commands must **not** be documented as available until their corresponding tooling and `package.json` scripts actually exist:

```text
npm run test:integration
npm run test:coverage
npm run lint
npm run typecheck
npm run build
```

If these capabilities are introduced later, the scripts must be added to `package.json` and this document must be updated.

---

## Recommended Future Script Contract

When the test infrastructure is expanded, the preferred script interface is:

```json
{
  "scripts": {
    "start": "electron .",
    "test": "node test/unit.mjs",
    "test:e2e": "electron test/e2e.js",
    "test:all": "npm test && npm run test:e2e",
    "test:coverage": "<actual coverage command>",
    "test:integration": "<actual integration test command>",
    "lint": "<actual lint command>",
    "typecheck": "<actual typecheck command>",
    "build": "<actual production build command>",
    "package": "node test/make-portable.cjs all",
    "release": "node test/make-portable.cjs all && node test/make-release.cjs all"
  }
}
```

Placeholder commands such as `<actual coverage command>` must be replaced with real executable commands before being used.

---

# 60. Automated Test Thresholds

The following thresholds are the minimum quality gates for the project.

## Unit Tests

Required:

```text
Passed:       100%
Failed:       0
Unexpected:   0
```

A phase cannot be marked complete when a relevant unit test fails.

---

## Integration Tests

Required:

```text
Passed:       100%
Failed:       0
Critical:     0 failures
```

Integration tests may not be silently skipped to obtain a passing result.

---

## E2E Tests

Critical E2E workflows must satisfy:

```text
Passed:       100%
Failed:       0
Flaky:        0 critical tests
```

A non-critical flaky test may be temporarily quarantined only when documented under the Flaky Test Policy.

---

## Full Automated Suite

The combined command:

```powershell
npm run test:all
```

must return exit code:

```text
0
```

before a phase or release candidate can be considered automated-test clean.

---

# 61. Coverage Thresholds

Coverage tooling must be added before these thresholds can be enforced automatically.

Once coverage tooling exists, the minimum targets are:

```text
Lines:       ≥ 80%
Functions:   ≥ 80%
Branches:    ≥ 70%
Statements:  ≥ 80%
```

Critical privacy/security/data-integrity modules should target:

```text
Lines:       ≥ 90%
Branches:    ≥ 85%
```

Critical modules include, where present:

```text
clipboard capture
privacy filtering
sensitive-content handling
IPC validation
persistence
migration
import validation
backup/restore
security-sensitive utilities
```

Coverage percentage alone is not sufficient to declare quality.

---

# 62. Performance Thresholds

Performance tests should use a repeatable reference environment.

Unless a stricter product-specific target is defined, use these initial thresholds.

## Application Startup

Time from application launch until the main UI is usable:

```text
Target:       ≤ 2.0 seconds p95
Warning:      > 2.0 seconds
Failure:      > 4.0 seconds p95
```

---

## Clipboard Capture

Time from clipboard change detection to successful local persistence:

```text
Target:       ≤ 100 ms p95
Warning:      > 250 ms
Failure:      > 500 ms
```

---

## Search

For a history containing approximately 10,000 entries:

```text
Target:       ≤ 100 ms p95
Warning:      > 200 ms
Failure:      > 500 ms
```

Search must remain responsive during normal typing.

---

## Quick Clipboard

Time from global shortcut activation until the Quick Clipboard UI is usable:

```text
Target:       ≤ 300 ms p95
Warning:      > 500 ms
Failure:      > 1,000 ms
```

---

## UI Responsiveness

Normal user actions should not produce avoidable long blocking operations.

Target:

```text
No critical interaction blocked for > 100 ms
```

Operations involving large datasets must use appropriate asynchronous processing, virtualization, pagination, or incremental rendering where necessary.

---

# 63. Memory and Stability Thresholds

Absolute Electron memory usage varies by Windows version, hardware, Electron version, and workload.

Therefore, use both an absolute observation and a baseline regression rule.

## Idle Memory

After startup and stabilization:

```text
Record baseline memory usage.
```

A release should not introduce:

```text
> 25% sustained memory increase
```

over the established baseline for the same environment and dataset without documented justification.

---

## Long-Running Stability

For a representative long-running test:

```text
Duration:       ≥ 2 hours
Crashes:        0
Data corruption: 0
Critical hangs:  0
```

After the application reaches a stable workload, memory should not show continuous unbounded growth.

---

## Clipboard Stress

During rapid clipboard changes:

```text
Crashes:             0
Data corruption:     0
Unexpected loss:     0
Unbounded duplicates: 0
```

---

# 64. Data Integrity Thresholds

For destructive or transformative operations:

```text
Unexpected data loss:       0
Corrupted records:          0
Invalid relationships:      0
Silent migration loss:      0
Backup restore failures:    0
```

Round-trip operations should preserve all required user data.

Example:

```text
Export
→ Import
→ Compare
```

must produce no unexplained loss of required fields.

---

# 65. Security Thresholds

Release-blocking security conditions:

```text
Critical vulnerabilities:   0
High vulnerabilities:       0 unresolved
Critical IPC violations:    0
Unexpected network transfer
of clipboard content:       0
Known secret leakage:       0
Arbitrary command execution: 0
```

A known high-severity issue may only be accepted if explicitly reviewed, documented, and approved as a release exception.

---

# 66. Accessibility Thresholds

For critical workflows:

```text
Keyboard-only completion:   Required
Visible focus:              Required
Critical controls named:    Required
Blocking accessibility bug: 0
```

The following workflows must be usable without a mouse:

```text
Search
History navigation
Copy
Delete
Quick Clipboard
Command Palette
Settings navigation
Dialogs
```

---

# 67. Internationalization Thresholds

Required before release:

```text
English:                    Pass
Persian:                    Pass
RTL layout:                 Pass
Mixed bidi content:         Pass
Critical text overflow:     0
Broken localization keys:   0
```

No critical workflow may become unusable when switching language or direction.

---

# 68. Quality Gates

A phase must not be marked complete when:

```text
Unit test failures > 0
Critical integration failures > 0
Critical E2E failures > 0
Critical security issues > 0
Unexpected data loss > 0
Critical regression > 0
Release-blocking accessibility issue > 0
```

For performance-sensitive phases:

```text
Performance failure > 0
```

must also block completion unless a documented exception is approved.

---

# 69. Phase Testing Rule

Every roadmap phase must define and execute tests appropriate to its scope.

For example:

```text
Clipboard Phase
→ clipboard tests
→ persistence tests
→ restart tests

Search Phase
→ search tests
→ filter tests
→ performance tests

UI Phase
→ component tests
→ accessibility tests
→ RTL tests
→ visual/manual QA
```

---

# 70. Bug Verification Workflow

When a bug is reported:

```text
Reproduce
↓
Write regression test
↓
Fix
↓
Run regression test
↓
Run affected suite
↓
Run broader suite
```

Do not close a bug solely because the visible symptom disappeared.

Verify the underlying behavior.

---

# 71. Flaky Test Policy

A flaky test must not simply be disabled.

When a test is flaky:

1. reproduce the flakiness
2. identify the source
3. remove timing dependence
4. improve synchronization
5. fix the test
6. rerun it repeatedly

If temporary quarantine is absolutely necessary, document:

```text
test name
reason
known failure mode
owner/next action
date introduced
```

No critical test may remain indefinitely quarantined.

---

# 72. Manual QA Checklist

Before important milestones manually verify:

```text
[ ] Launch
[ ] Clipboard capture
[ ] History
[ ] Search
[ ] Filters
[ ] Favorite
[ ] Pin
[ ] Tags
[ ] Collections
[ ] Delete
[ ] Restore
[ ] Quick clipboard
[ ] Global shortcut
[ ] Tray
[ ] Settings
[ ] Import
[ ] Export
[ ] Backup
[ ] Light theme
[ ] Dark theme
[ ] English
[ ] Persian
[ ] RTL
[ ] Mixed bidi content
[ ] Keyboard navigation
[ ] Large text
[ ] Large history
[ ] Restart
[ ] Quit
```

---

# 73. Release Test Matrix

Before a release candidate:

```text
                Windows
────────────────────────────────
Fresh Install          ✓
Existing Upgrade       ✓
Clipboard              ✓
History                ✓
Search                 ✓
Organization           ✓
Quick Clipboard        ✓
Tray                   ✓
Shortcuts              ✓
Privacy                ✓
Settings               ✓
Import/Export          ✓
Themes                 ✓
English                ✓
Persian                ✓
RTL                     ✓
Accessibility           ✓
Performance             ✓
Security                ✓
Backup/Restore          ✓
Uninstall               ✓
```

---

# 74. Final Release Gate

A release candidate should satisfy:

```text
[ ] Unit tests pass
[ ] Integration tests pass
[ ] E2E tests pass
[ ] Combined automated suite exits with code 0
[ ] Coverage thresholds met when coverage tooling exists
[ ] No critical regression
[ ] Security review completed
[ ] Performance thresholds met
[ ] Windows manual QA completed
[ ] Packaging verified
[ ] Fresh installation verified
[ ] Upgrade verified
[ ] Backup/restore verified
[ ] English verified
[ ] Persian verified
[ ] RTL verified
[ ] Accessibility verified
[ ] Documentation updated
```

---

# 75. Testing Documentation Rule

Whenever testing infrastructure changes, update this document.

Whenever a new important test suite is introduced, document:

* purpose
* location
* command
* scope
* limitations
* thresholds

Documentation must match the actual project.

---

# 76. AI Agent Testing Rules

An AI coding agent must never claim that tests passed unless it actually ran them.

The agent must report honestly:

```text
Tests run:
<commands>

Result:
<result>

Known failures:
<failures>

Environment limitations:
<limitations>
```

If a test cannot be executed because of an environment limitation, state that explicitly.

Do not replace a required test with a claim that the code "should work."

---

# 77. AI Agent Phase Completion

Before marking a phase complete, the agent must verify:

```text
[ ] Current phase requirements implemented
[ ] Relevant tests added/updated
[ ] Relevant tests executed
[ ] Failures investigated
[ ] Regressions checked
[ ] Security implications checked
[ ] Performance implications checked
[ ] Documentation updated
[ ] PROGRESS.md updated
[ ] Git diff reviewed
[ ] No accidental files
[ ] No secrets
[ ] Commit created
[ ] Next phase not started
```

---

# 78. Testing Strategy for the Final Product

The final product should have layered confidence:

```text
                 RELEASE
                    │
          ┌─────────┴─────────┐
          │                   │
     Automated QA          Manual QA
          │                   │
    ┌─────┴─────┐       ┌─────┴─────┐
    │           │       │           │
   E2E     Integration  Windows   UX/RTL
    │           │       │           │
    └─────┬─────┘       └─────┬─────┘
          │                   │
             Unit / Components
```

No single testing layer is sufficient by itself.

---

# 79. Final Testing Principle

Testing TextVault Pro is not about proving that every line of code executes.

It is about proving that the application can be trusted with a user's daily clipboard workflow.

The most important question is:

> Can a user run TextVault all day, copy sensitive and multilingual content, search thousands of entries, organize information, restart the application, and trust that the application remains fast, private, stable, and predictable?

Every testing decision should contribute to answering that question with confidence.

The testing goal is therefore:

```text
Correctness
+
Reliability
+
Security
+
Privacy
+
Performance
+
Accessibility
+
Real Desktop Behavior
```

A feature is not complete because it was implemented.

It is complete when its important behavior has been verified.
