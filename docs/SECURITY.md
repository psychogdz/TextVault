# TextVault Pro — Security & Privacy Guide

## 1. Purpose

This document defines the security and privacy requirements for TextVault Pro.

TextVault Pro is a local-first desktop application that may handle highly sensitive user content through:

* clipboard history
* snippets
* notes
* imported files
* exported files
* backups
* local databases
* application settings
* operating system integrations

Security is therefore a core product requirement.

The application must follow a:

```text
Local-First
Privacy-First
Least-Privilege
Secure-by-Default
```

security model.

---

# 2. Security Principles

TextVault Pro must follow these principles:

```text
Least Privilege
Defense in Depth
Secure by Default
Local by Default
Explicit User Actions
Minimal Data Exposure
Fail Safely
No Unnecessary Network Access
No Silent Data Transmission
```

Security-sensitive functionality must not depend on the assumption that the renderer is trusted.

---

# 3. Privacy Model

TextVault Pro should operate locally by default.

Clipboard content must remain on the user's machine unless the user explicitly enables a feature that requires external communication.

The application must not silently upload:

* clipboard history
* snippets
* notes
* passwords
* tokens
* API keys
* private keys
* imported documents
* backups

to external services.

---

# 4. No Telemetry by Default

The default application must not collect telemetry containing user content.

The following must never be collected without explicit consent:

```text
Clipboard content
Clipboard history
Snippet content
Note content
Search queries
Imported files
Backup contents
File contents
Passwords
Tokens
API keys
```

If telemetry is introduced in the future, it must be:

* opt-in
* documented
* privacy-preserving
* independently configurable
* disabled by default unless the product requirements explicitly change

---

# 5. Electron Security

Electron security is a critical boundary.

The application should use:

```text
contextIsolation: true
nodeIntegration: false
sandbox: true
```

where compatible with the application's architecture.

Any deviation requires explicit justification.

---

# 6. Renderer Security

The renderer must be treated as an untrusted environment.

The renderer must not receive unrestricted access to:

* Node.js
* filesystem APIs
* child processes
* operating-system commands
* arbitrary Electron internals

The renderer should interact with privileged functionality only through the controlled preload API.

---

# 7. Preload Security

The preload script must expose only the minimum API required by the renderer.

Prefer:

```text
window.textVault.clipboard.capture()
window.textVault.history.list()
window.textVault.settings.get()
```

over exposing generic primitives such as:

```text
window.node
window.fs
window.electron
window.ipc
```

Never expose unrestricted IPC or filesystem access.

---

# 8. IPC Security

Every IPC endpoint must be explicitly defined.

For each IPC request:

```text
Renderer
   ↓
Preload API
   ↓
IPC Channel
   ↓
Input Validation
   ↓
Application Service
   ↓
Result
```

IPC handlers must validate:

* type
* structure
* required fields
* string length
* allowed values
* file paths
* identifiers
* operation type

Never trust renderer-provided input.

---

# 9. IPC Allowlist

IPC channels should use an explicit allowlist.

Example:

```text
history:list
history:get
history:delete
history:clear
clipboard:pause
clipboard:resume
settings:get
settings:update
backup:create
backup:restore
```

Avoid dynamic IPC channels generated directly from renderer input.

---

# 10. IPC Error Handling

IPC errors must not expose sensitive internal information.

Avoid returning:

```text
absolute filesystem paths
database internals
stack traces
environment variables
tokens
internal implementation details
```

Development logs may contain additional diagnostics, but production responses must remain safe.

---

# 11. Filesystem Security

All filesystem operations must validate paths.

Never blindly trust:

```text
user-provided paths
import paths
export paths
backup paths
file names
```

Prevent:

```text
path traversal
unexpected directory access
arbitrary file overwrite
arbitrary file deletion
```

---

# 12. Path Traversal Protection

Reject suspicious paths such as:

```text
..\..\secret.txt
../../secret.txt
C:\Windows\System32\...
```

where such paths are outside the intended operation scope.

Normalize and validate paths before performing filesystem operations.

---

# 13. Import Security

Imported files must be treated as untrusted input.

Never execute imported content.

For example:

```text
Imported Command
Imported Script
Imported HTML
Imported JavaScript
Imported Markdown
```

must remain data.

The application must never interpret clipboard or imported text as executable code merely because it resembles code.

---

# 14. Backup Security

Backups may contain the user's entire local library.

Therefore:

* backups must remain local by default
* backup contents must not be logged
* backup paths must be validated
* restore operations must validate structure
* malformed backups must not overwrite existing data

If encryption is introduced, encryption requirements must be documented separately.

---

# 15. Restore Safety

Restore operations must be transactional where practical.

Preferred behavior:

```text
Validate Backup
      ↓
Create Temporary State
      ↓
Restore
      ↓
Validate Restored Data
      ↓
Commit
```

Do not destroy the existing library before validating the backup.

---

# 16. Database Security

The local database must be treated as sensitive user data.

Do not log:

* full clipboard content
* note content
* snippet content
* sensitive metadata

Database errors should expose only the information necessary for debugging.

---

# 17. Data at Rest

TextVault stores user content locally.

The project should document exactly:

```text
Database Location
Configuration Location
Backup Location
Export Location
Log Location
Temporary File Location
```

No sensitive data should be stored in temporary locations longer than necessary.

If encryption at rest is implemented, key management must be documented separately.

---

# 18. Clipboard Privacy

Clipboard monitoring is one of the highest-risk features.

The application must support mechanisms such as:

```text
Pause Monitoring
Private Mode
Application Exclusions
Sensitive Content Detection
History Retention
Clear History
```

The exact behavior must remain consistent with `PRODUCT_SPEC.md` and `FEATURES.md`.

---

# 19. Pause Monitoring

When monitoring is paused:

```text
OS Clipboard
      ↓
TextVault
      X
```

No new clipboard entry should be persisted.

The pause state must be respected by all clipboard capture paths.

---

# 20. Application Exclusions

Users should be able to exclude selected applications where supported.

When an excluded application owns the clipboard:

```text
Excluded Application
        ↓
Clipboard
        ↓
TextVault
        X
```

The content must not be persisted.

Exclusion matching must fail safely.

---

# 21. Sensitive Content

Sensitive-content detection should help reduce accidental storage of secrets.

Potential categories include:

```text
Passwords
API Keys
Access Tokens
Private Keys
Authentication Tokens
Credential-like Content
```

Detection is not a replacement for explicit privacy controls.

False positives must be handled carefully.

---

# 22. Sensitive Content Logging

Sensitive clipboard content must never appear in logs.

Never log:

```text
clipboard text
passwords
tokens
API keys
private keys
authentication headers
```

When debugging, log metadata instead.

Example:

```text
Clipboard event detected
Content type: text
Length: 128
Sensitive match: true
Persisted: false
```

Do not log the actual content.

---

# 23. Search Privacy

Search queries may themselves contain sensitive information.

Do not automatically transmit search queries externally.

Avoid persistent logging of search queries unless explicitly required by a future feature.

---

# 24. Logging Policy

Production logs must contain only information necessary for:

* diagnostics
* crash investigation
* application health
* security auditing where appropriate

Avoid excessive logging.

Never use:

```text
console.log(clipboardContent)
console.log(userText)
console.log(password)
```

in production code.

---

# 25. Development vs Production

Development diagnostics must not accidentally remain enabled in production.

Before release verify:

```text
Debug Logging
Verbose IPC Logging
Sensitive Data Logging
Developer Tools
Test Flags
Mock Services
```

are disabled or appropriately protected.

---

# 26. External URLs

External URLs must only be opened as a result of an explicit user action.

Do not automatically navigate to arbitrary URLs contained in clipboard content.

For example:

```text
Clipboard:
https://example.com
```

must remain text unless the user explicitly chooses an action such as:

```text
Open URL
```

---

# 27. Command Execution

TextVault must never execute clipboard content automatically.

The following must remain data:

```text
PowerShell
CMD
Bash
Python
JavaScript
Shell Scripts
SQL
```

If a future feature intentionally executes commands, it requires a separate security design and explicit user confirmation.

---

# 28. Shell and Child Processes

Avoid:

```text
exec(userInput)
spawn(userInput)
shell(userInput)
```

or equivalent behavior.

User-controlled strings must never become executable commands without strict validation and an explicitly designed security boundary.

---

# 29. HTML and Rich Text

Clipboard HTML must be treated as untrusted content.

Prevent:

```text
XSS
script execution
unsafe HTML injection
malicious event handlers
```

If HTML is rendered, sanitize it before rendering.

Plain text should remain the default representation where possible.

---

# 30. Markdown Security

Markdown rendering must not allow unsafe execution.

Be careful with:

```text
raw HTML
javascript: URLs
embedded content
external resources
dangerous links
```

Sanitize or restrict rendering according to the application's needs.

---

# 31. Content Detection Security

Smart content detection must be pure analysis.

Detection must never:

```text
execute
download
open
install
modify
```

detected content automatically.

For example, detecting a URL must not automatically request that URL.

---

# 32. Global Shortcut Security

Global shortcuts should:

* use a controlled registration mechanism
* avoid arbitrary shortcut injection
* clean up correctly
* unregister on shutdown
* handle conflicts safely

Shortcut configuration must be validated.

---

# 33. Window Security

Windows displaying sensitive content should use appropriate Electron security settings.

Avoid unnecessary:

```text
nodeIntegration
remote access
unsafe webviews
untrusted navigation
```

External content should not be loaded into privileged application windows unless explicitly required and securely isolated.

---

# 34. Webview Security

Avoid `<webview>` unless there is a strong product requirement.

If webviews are required:

* isolate them
* restrict navigation
* disable unnecessary privileges
* validate URLs
* treat loaded content as untrusted

---

# 35. Dependency Security

Dependencies are part of the attack surface.

Before release:

```text
Review dependencies
↓
Check known vulnerabilities
↓
Remove unnecessary packages
↓
Run tests
↓
Verify production build
```

Do not add a dependency when a small internal implementation is safer and reasonable.

---

# 36. Dependency Change Policy

Dependency changes should be intentional.

When adding a dependency:

Document:

```text
Package
Purpose
Why it is required
Security considerations
License
```

Avoid unnecessary dependency growth.

---

# 37. Secrets Management

No secrets may be committed to the repository.

Never commit:

```text
API keys
passwords
tokens
private keys
credentials
.env files containing secrets
```

Use environment variables or secure local configuration where a development secret is genuinely required.

---

# 38. Repository Secret Scanning

Before release, inspect the repository for accidental secrets.

Check:

```text
source files
configuration
documentation
test fixtures
logs
build artifacts
```

Synthetic test credentials are allowed.

Real credentials are not.

---

# 39. Test Data Security

Tests must use synthetic values.

Examples:

```text
TEST_API_KEY_123456789
TEST_PASSWORD_EXAMPLE
TEST_TOKEN_ABCDEF
```

Never place real credentials into:

```text
fixtures
snapshots
logs
screenshots
test databases
```

---

# 40. Crash Reports

If crash reporting is introduced, it must not automatically include:

```text
clipboard content
notes
snippets
search queries
database contents
file contents
secrets
```

Crash diagnostics should be minimized and privacy-reviewed.

---

# 41. Network Security

The application should function without network access for core local functionality.

Test:

```text
Internet available
Internet unavailable
DNS unavailable
Firewall blocking outbound traffic
```

Core clipboard/history functionality must remain usable offline.

---

# 42. Unexpected Network Activity

During security verification, inspect application network behavior.

Unexpected transmission of clipboard content is a release-blocking issue.

Required threshold:

```text
Clipboard content transmitted without explicit user action:
0
```

---

# 43. Secure Defaults

The default installation should favor privacy.

Defaults should avoid:

```text
Automatic cloud sync
Automatic uploads
Automatic telemetry
Automatic external requests
Automatic command execution
Automatic URL navigation
```

---

# 44. User Consent

When a feature requires a privacy-impacting action, the user must understand what is happening.

Examples:

```text
Cloud Sync
Telemetry
External AI Processing
Remote Backup
External Search
```

Such features require explicit product-level consent and documentation.

---

# 45. Data Deletion

When users delete content:

```text
History Entry
Snippet
Note
Collection
Tag
Backup
```

the application should follow the documented deletion semantics.

Do not claim secure deletion from storage media unless the implementation actually provides it.

---

# 46. Retention

If retention policies exist, they must be deterministic.

For example:

```text
Keep last 7 days
Keep last 30 days
Keep last 90 days
Unlimited
```

Retention cleanup must not delete data outside the configured policy.

---

# 47. Privacy Mode

Private mode must be predictable.

When enabled:

```text
Clipboard
   ↓
Capture
   ↓
Privacy Rules
   ↓
Do not persist
```

The UI should clearly communicate the current state.

---

# 48. Security Boundaries

The following boundaries must be treated as security-sensitive:

```text
Renderer → Preload
Preload → IPC
IPC → Main Process
Main Process → Filesystem
Main Process → OS APIs
Application → External URLs
Application → Network
Import → Application Data
Backup → Restore
Clipboard → Persistence
```

Each boundary requires validation appropriate to its risk.

---

# 49. Threat Model

The project should consider at least these threat scenarios:

### Malicious Clipboard Content

```text
Attacker-controlled text
        ↓
Clipboard
        ↓
TextVault
```

The content must remain inert.

### Malicious Import

```text
Untrusted File
      ↓
Import
      ↓
Validation
```

Malformed content must not execute or corrupt existing data.

### Renderer Compromise

Assume renderer JavaScript could be compromised.

The attacker must not automatically gain:

```text
filesystem access
process execution
arbitrary IPC
system control
```

### Malicious External Content

External URLs and remote content must not automatically become privileged application content.

---

# 50. Security Testing Requirements

Security tests must cover:

```text
IPC validation
Preload exposure
Renderer isolation
Path traversal
Import validation
Backup validation
HTML sanitization
URL handling
Command execution prevention
Clipboard privacy
Sensitive logging
Network behavior
Secret detection
Dependency vulnerabilities
```

---

# 51. Security Thresholds

Release-blocking thresholds:

```text
Critical vulnerabilities:              0
High unresolved vulnerabilities:       0
Arbitrary command execution paths:     0
Unrestricted IPC endpoints:            0
Unexpected clipboard network transfer: 0
Known secret leakage:                  0
Critical path traversal vulnerabilities: 0
Critical XSS vulnerabilities:          0
Critical data corruption paths:        0
```

Any exception must be explicitly documented and approved before release.

---

# 52. Security Regression Tests

Every security bug should produce a permanent regression test where practical.

Example:

```text
Bug:
Renderer could invoke an unintended privileged IPC operation.

Fix:
Restrict IPC channel allowlist.

Regression:
Attempt unauthorized IPC operation and verify rejection.
```

Security regressions must never be removed merely because the original bug is no longer visible.

---

# 53. Security Review Checklist

Before release:

```text
[ ] contextIsolation verified
[ ] nodeIntegration disabled where required
[ ] sandbox evaluated/enabled where compatible
[ ] preload API reviewed
[ ] IPC allowlist reviewed
[ ] IPC input validation verified
[ ] filesystem paths validated
[ ] import validation verified
[ ] backup validation verified
[ ] restore safety verified
[ ] sensitive data logging checked
[ ] external URL handling reviewed
[ ] command execution paths reviewed
[ ] HTML/Markdown sanitization reviewed
[ ] dependency vulnerabilities checked
[ ] repository secrets scanned
[ ] network behavior reviewed
[ ] clipboard privacy verified
[ ] private mode verified
[ ] application exclusions verified
[ ] security regression tests pass
```

---

# 54. AI Agent Security Rules

AI coding agents must treat security requirements as hard constraints.

An agent must not:

* disable security protections merely to make a feature work
* enable Node integration unnecessarily
* expose unrestricted IPC
* log sensitive content
* execute clipboard content
* introduce unnecessary network communication
* commit credentials
* weaken validation to bypass tests

If a security restriction blocks implementation, the agent must stop and evaluate the architecture instead of silently weakening the restriction.

---

# 55. Security Review During Each Phase

Every development phase must consider security implications.

The agent should ask:

```text
What new data is handled?
What new trust boundary exists?
What new privileged API is introduced?
Can user input reach a privileged operation?
Can sensitive data be logged?
Can data leave the machine?
Can malformed input corrupt user data?
```

Security review is required even when the phase is primarily UI-related if the UI introduces new data or IPC behavior.

---

# 56. Security Incident Workflow

If a serious security issue is discovered:

```text
Stop
↓
Reproduce
↓
Assess impact
↓
Contain
↓
Fix
↓
Add regression test
↓
Review related code
↓
Run security tests
↓
Document
```

Do not continue unrelated feature development while a critical security issue remains unresolved.

---

# 57. Security Documentation Rule

Whenever a security-sensitive architecture decision changes, update this document.

Examples:

```text
Electron security settings
IPC architecture
Storage architecture
Encryption
Network features
Telemetry
Cloud synchronization
Authentication
External integrations
```

Documentation must match the actual implementation.

---

# 58. Final Security Principle

TextVault Pro may contain some of the most sensitive information a user handles during normal computer usage.

Therefore:

```text
Clipboard data = Sensitive by Default

Local data = Private by Default

Renderer = Untrusted by Default

External Content = Untrusted by Default

Network = Unnecessary by Default

User Action = Required for Sensitive Operations
```

The application should never trade user privacy for implementation convenience.

Security is not a feature added at the end.

It is a property of the entire architecture.

A secure TextVault Pro should make the safe behavior the easiest behavior.

The final security goal is:

```text
No unnecessary data leaves the device
+
No privileged API is unnecessarily exposed
+
No untrusted content is executed
+
No sensitive content is unnecessarily logged
+
No user data is silently destroyed
+
No critical security issue reaches release
```
# 59. Concrete Data-Storage Contract

This section defines the mandatory storage contract for TextVault Pro.

The implementation must follow this contract unless a documented architectural decision explicitly changes it.

---

## 59.1 Storage Architecture

TextVault Pro is a local-first desktop application.

The canonical architecture is:

```text
Application
    │
    ├── Domain / Services
    │
    ├── Repository Layer
    │
    └── Local Storage
          │
          ├── Primary Database
          ├── Application Settings
          ├── Backups
          ├── Temporary Files
          └── Logs
```

The UI must not directly access storage.

The renderer must access persistent data through the approved application/API layers.

---

## 59.2 Source of Truth

There must be one canonical source of truth for each persistent data category.

| Data                      | Canonical Source               |
| ------------------------- | ------------------------------ |
| Clipboard history         | Local database                 |
| Snippets                  | Local database                 |
| Notes                     | Local database                 |
| Tags                      | Local database                 |
| Collections               | Local database                 |
| Favorites                 | Local database                 |
| Pins                      | Local database                 |
| Application settings      | Local settings store           |
| Backup files              | User-selected backup location  |
| Export files              | User-selected export location  |
| Temporary processing data | Temporary directory            |
| Application logs          | Local application log location |

Caches must never become an independent source of truth.

---

## 59.3 Storage Location Contract

The application must use an operating-system-appropriate application-data directory.

Do not hard-code paths such as:

```text
C:\TextVault
C:\Program Files\TextVault
C:\Users\<user>\Desktop\TextVault
```

The application must resolve storage paths using Electron/Node platform-appropriate application data APIs.

The implementation must document the resolved locations for:

```text
Database
Settings
Backups
Logs
Temporary Files
Exports
```

---

## 59.4 Windows Storage Requirement

Windows is the primary target platform.

Persistent application data should normally reside under the user's appropriate application-data location rather than inside the installation directory.

The installation directory must not be treated as writable application storage.

This prevents problems involving:

* permissions
* updates
* uninstall/reinstall
* portable vs installed builds
* administrator privileges

---

## 59.5 Database Contract

The primary database is the canonical persistent store for structured application data.

The database must contain, where implemented:

```text
Clipboard Entries
Snippets
Notes
Tags
Collections
Relationships
Favorites
Pins
Metadata
Schema Version
```

The database must not contain:

```text
raw application secrets
development credentials
API keys belonging to developers
temporary debug data
unrelated operating-system data
```

unless explicitly required by the product specification.

---

## 59.6 Clipboard Entry Contract

Each persisted clipboard entry must have a stable identifier.

A clipboard entry should contain only the fields required by the product.

Minimum conceptual fields:

```text
id
content
contentType
createdAt
updatedAt
sourceApplication
isFavorite
isPinned
metadata
```

The exact schema may differ, but the following rules are mandatory:

```text
id = stable and unique
content = exact user content
createdAt = immutable creation timestamp
updatedAt = updated only when appropriate
```

Clipboard content must not be silently transformed before persistence.

If normalized/search-specific data is stored, the original content must remain recoverable.

---

## 59.7 Text Encoding

All persisted text must use Unicode-safe encoding.

The application must correctly preserve:

```text
English
Persian
Arabic
Unicode symbols
Emoji
Mixed RTL/LTR
Numbers
URLs
Code
JSON
Markdown
```

Example:

```text
سلام Hello
https://example.com
const value = "سلام"
```

must survive:

```text
Capture
→ Save
→ Restart
→ Search
→ Export
→ Import
```

without unintended corruption.

---

## 59.8 Timestamps

Persisted timestamps must use an unambiguous representation.

Prefer:

```text
ISO 8601 / UTC
```

or an equivalent unambiguous representation.

Do not store timestamps in locale-dependent formats such as:

```text
03/04/2026
04/03/2026
```

unless the format is explicitly documented.

Display formatting may use the user's locale, but the stored value must remain unambiguous.

---

## 59.9 Identifiers

Persistent records must use stable identifiers.

IDs must not depend on:

* array indexes
* UI position
* rendered order
* timestamps alone
* mutable text content

Deleting and recreating an item should produce a new identity.

---

## 59.10 Content Integrity

The storage layer must preserve exact user content.

For example:

```text
Leading whitespace
Trailing whitespace
Newlines
Tabs
Unicode
RTL markers
Code formatting
```

must not be removed or normalized unless the user explicitly requests a transformation.

Search indexes may normalize content for search purposes, but the canonical stored content must remain unchanged.

---

## 59.11 Size Limits

The application must define explicit maximum sizes for persisted content.

At minimum, limits should exist for:

```text
Clipboard entry content
Snippet content
Note content
Import files
Backup files
Metadata fields
Tag names
Collection names
```

The exact limits should be documented in the implementation.

When a limit is exceeded:

```text
Reject safely
+
Show understandable error
+
Do not partially persist data
```

Do not silently truncate user content.

---

## 59.12 Atomic Writes

Critical persistent operations should be atomic where practical.

For operations such as:

```text
Settings update
Backup creation
Database migration
Restore
Bulk modification
```

the application should avoid leaving partially written state.

Preferred model:

```text
Prepare
 ↓
Validate
 ↓
Write
 ↓
Verify
 ↓
Commit
```

If the operation fails:

```text
Rollback
or
Preserve previous valid state
```

---

## 59.13 Transaction Requirements

Operations that modify multiple related records should use transactions where supported.

Examples:

```text
Delete collection
→ update relationships
→ remove collection
```

```text
Import
→ validate records
→ insert records
→ update metadata
```

```text
Restore
→ validate backup
→ replace/merge data
```

A failure must not leave the database in a partially modified state.

---

## 59.14 Database Migration Contract

Every schema change must have a migration strategy.

A migration must be:

```text
Versioned
Deterministic
Testable
Recoverable where practical
```

The application must know the current schema version.

Startup should detect:

```text
Current Database Version
        ↓
Application Expected Version
        ↓
Migration Required?
```

If migration fails, the application must fail safely rather than silently destroying data.

---

## 59.15 Migration Safety

Before destructive migrations:

```text
Validate
↓
Backup where appropriate
↓
Migrate
↓
Verify
```

A migration must never silently discard user data merely because a field is no longer used.

If data cannot be migrated automatically, the application should preserve it or clearly report the limitation.

---

## 59.16 Backup Contract

Backups are independent recovery artifacts.

A backup should contain all data required to reconstruct the user's library according to the supported backup format.

At minimum, where applicable:

```text
Clipboard History
Snippets
Notes
Tags
Collections
Relationships
Favorites
Pins
Required Metadata
Schema/Format Version
```

A backup must not depend on temporary files.

---

## 59.17 Backup Format Versioning

Every backup format must contain a version identifier.

Example:

```json
{
  "formatVersion": 1
}
```

Future versions must be distinguishable.

The application must reject or safely handle unsupported backup versions.

---

## 59.18 Backup Validation

Before restore:

```text
Read
↓
Parse
↓
Validate Format
↓
Validate Version
↓
Validate Records
↓
Validate Relationships
↓
Restore
```

Never directly merge unvalidated backup data into the live database.

---

## 59.19 Export Contract

Exports are user-created files and are not the canonical database.

Export operations must:

* use an explicit user-selected destination
* avoid overwriting unrelated files without confirmation
* preserve supported data
* report errors
* never delete the source library

Export failure must never destroy the original data.

---

## 59.20 Temporary Storage

Temporary files may be used for:

* import processing
* export generation
* backup generation
* migration staging
* atomic file replacement

Temporary files must:

```text
Use OS temporary storage
Have predictable ownership
Contain only required data
Be deleted when no longer needed
Not become permanent application storage
```

---

## 59.21 Temporary Data Cleanup

After a successful operation:

```text
Temporary File
      ↓
No Longer Needed
      ↓
Delete
```

If cleanup fails, the application should attempt cleanup again later where practical.

Temporary files must not be treated as user-visible backups.

---

## 59.22 Cache Contract

Caches are disposable.

A cache must never be required to recover canonical user data.

The application must remain functionally correct if all caches are deleted.

Therefore:

```text
Delete Cache
↓
Restart
↓
Application Rebuilds Cache
↓
User Data Remains Intact
```

---

## 59.23 Search Index Contract

If a dedicated search index is used:

```text
Canonical Database
        ↓
Search Index
```

The database remains authoritative.

If the search index becomes corrupted:

```text
Delete Index
↓
Rebuild
↓
Search Works Again
```

Search-index corruption must never imply loss of the underlying user content.

---

## 59.24 Settings Contract

Settings must be stored separately from the primary content database unless the architecture explicitly determines otherwise.

Settings should contain:

```text
UI Preferences
Theme
Language
RTL Preference
Clipboard Monitoring State
Retention Configuration
Shortcut Configuration
Privacy Preferences
```

Settings must not contain full clipboard history.

Sensitive values must not be stored unless explicitly required.

---

## 59.25 Sensitive Settings

If a future feature requires storing a secret, token, or credential:

```text
Do not store plaintext by default.
```

Use an appropriate OS-provided secure credential mechanism where available.

The architecture must explicitly document:

```text
What is stored
Why it is stored
Where it is stored
How it is protected
How it is deleted
```

---

## 59.26 Logs Contract

Logs are diagnostic data.

Logs must never be the canonical source of user data.

Production logs must not contain:

```text
Clipboard Content
Note Content
Snippet Content
Passwords
API Keys
Tokens
Private Keys
Full Backup Contents
Full Import Contents
```

Safe metadata may include:

```text
Operation
Duration
Record Count
Success/Failure
Error Category
```

---

## 59.27 Crash Data

Crash diagnostics must follow the same privacy rules.

Crash reports must not automatically include full:

```text
Clipboard History
Notes
Snippets
Search Queries
Database Contents
```

unless the user explicitly provides them for debugging.

---

## 59.28 Storage Permissions

The application should request only the filesystem permissions required for its operation.

Normal application data should not require administrator privileges.

The application must not require:

```text
Administrator
SYSTEM
Full filesystem access
```

for normal clipboard/history functionality.

---

## 59.29 Installation vs User Data

Application binaries and user data must remain logically separate.

Conceptually:

```text
Installation
    ↓
Application Code

User Data
    ↓
Application Data Directory
```

Updating or reinstalling the application must not intentionally delete user data.

---

## 59.30 Uninstall Contract

The uninstall behavior must be explicitly defined.

The application must not silently delete user data merely because the application binary is being removed.

If the installer offers removal of user data, the behavior must be:

```text
Explicit
Visible
Confirmable
Documented
```

---

## 59.31 Data Deletion Contract

Deletion operations must have predictable semantics.

For:

```text
Delete Entry
Delete Multiple Entries
Clear History
Delete Snippet
Delete Note
Delete Collection
Delete Backup
```

the application must clearly define whether the data is:

```text
Removed from active database
Moved to trash
Soft-deleted
Permanently deleted
```

Do not claim secure media deletion unless technically implemented.

---

## 59.32 Bulk Deletion Safety

Bulk deletion must:

* require an intentional user action
* show the affected scope where appropriate
* avoid accidental deletion
* execute safely
* preserve database integrity

Where undo is supported, it should be transactional.

---

## 59.33 Import/Restore Isolation

Untrusted imported data should be validated before entering the canonical database.

Preferred architecture:

```text
Untrusted Input
      ↓
Temporary Representation
      ↓
Schema Validation
      ↓
Business Validation
      ↓
Integrity Validation
      ↓
Canonical Database
```

Never partially import malformed data unless the product specification explicitly supports partial import.

---

## 59.34 Storage Recovery

If the database becomes unavailable or corrupted:

```text
Detect
↓
Do Not Overwrite Blindly
↓
Preserve Existing Files
↓
Attempt Safe Recovery
↓
Use Backup if Required
↓
Report Clearly
```

The application must not repeatedly overwrite a potentially recoverable database during startup.

---

## 59.35 Storage Failure Behavior

Storage failures must fail safely.

Examples:

```text
Disk Full
Permission Denied
Database Locked
Corrupted Database
Invalid Backup
Interrupted Write
Unavailable Temporary Directory
```

The application should:

```text
Detect
+
Report
+
Preserve Existing Valid Data
+
Avoid Silent Data Loss
```

---

## 59.36 Offline Requirement

Core storage functionality must work without Internet access.

The following must remain functional offline:

```text
Clipboard Capture
History
Search
Tags
Collections
Snippets
Settings
Import
Export
Backup
Restore
```

unless a future product requirement explicitly changes this.

---

## 59.37 Network Boundary

Persistent local content must not automatically cross the network boundary.

The default architecture is:

```text
User Data
   ↓
Local Storage
```

not:

```text
User Data
   ↓
Internet
   ↓
Remote Service
```

Any future feature that sends data externally requires explicit security and privacy review.

---

## 59.38 Storage Contract Tests

Automated tests must verify:

```text
Create
Read
Update
Delete
Restart Persistence
Unicode Persistence
Persian Persistence
Large Content
Transaction Rollback
Migration
Backup
Restore
Import
Export
Corruption Handling
Disk/Storage Failure Handling
```

---

## 59.39 Required Storage Invariants

The following invariants must always hold:

```text
1. Canonical user data has one authoritative source.

2. Cache corruption cannot cause data loss.

3. Search-index corruption cannot cause data loss.

4. Failed writes cannot silently replace valid data with invalid data.

5. Failed migrations cannot silently destroy the database.

6. Invalid imports cannot destroy existing data.

7. Invalid restores cannot destroy existing data.

8. User content is preserved exactly unless transformation is explicitly requested.

9. Application updates do not silently delete user data.

10. Core functionality does not require network access.

11. Sensitive content is not written to logs.

12. Renderer code cannot directly access privileged storage APIs.
```

---

# 60. Storage Quality Gates

A storage implementation is not considered complete until:

```text
[ ] Canonical storage defined
[ ] Storage locations documented
[ ] Database schema documented
[ ] IDs are stable
[ ] Unicode preservation verified
[ ] Timestamp format defined
[ ] Content size limits defined
[ ] Atomic writes implemented where required
[ ] Transactions implemented where required
[ ] Migration strategy implemented
[ ] Backup format versioned
[ ] Backup validation implemented
[ ] Restore safety verified
[ ] Import validation verified
[ ] Temporary files cleaned
[ ] Cache is disposable
[ ] Search index is rebuildable
[ ] Logs contain no sensitive content
[ ] Storage works offline
[ ] Corruption behavior tested
[ ] Data deletion semantics documented
[ ] Uninstall behavior documented
[ ] Storage regression tests pass
```

---

# 61. Final Data-Storage Principle

TextVault Pro stores information that users may consider extremely valuable or sensitive.

Therefore the storage system must be designed around this assumption:

```text
User Data
    ↓
Must survive normal application failures
    ↓
Must remain local by default
    ↓
Must not be silently transformed
    ↓
Must not be silently transmitted
    ↓
Must not be silently destroyed
```

The storage contract is successful when a user can:

```text
Capture
→ Store
→ Search
→ Organize
→ Restart
→ Upgrade
→ Backup
→ Restore
```

and trust that their data remains intact.

Data integrity is a security property.

Privacy is a storage property.

Reliability is a storage requirement.

The storage layer must therefore be treated as critical infrastructure, not merely as an implementation detail.


