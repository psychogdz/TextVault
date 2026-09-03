# TextVault Pro — UI/UX Implementation Prompt

**Project:** TextVault Pro
**Repository:** TextVault
**Platform Priority:** Windows-first
**Design Direction:** Modern, minimal, premium, productivity-focused desktop application
**Primary Languages:** English + Persian
**UI Direction:** Keyboard-first, responsive within desktop window sizes, RTL/LTR aware
**Status:** Authoritative UI/UX Implementation Specification

---

# 1. Purpose

This document defines the UI/UX direction and implementation requirements for TextVault Pro.

TextVault Pro must look and feel like a serious, modern desktop productivity application rather than:

* A generic CRUD dashboard
* A web admin panel
* A basic Electron demo
* A form-heavy management system
* An AI-generated template assembled from unrelated components

The UI must communicate:

* Speed
* Simplicity
* Privacy
* Reliability
* Focus
* Professionalism

The interface should make clipboard management feel immediate and effortless.

---

# 2. UI Authority

The UI implementation must follow these documents:

```text
PRODUCT_SPEC.md
FEATURES.md
ARCHITECTURE.md
UI_PROMPT.md
ROADMAP.md
```

`PRODUCT_SPEC.md` defines product behavior.

`FEATURES.md` defines feature priorities.

`ARCHITECTURE.md` defines technical boundaries.

`UI_PROMPT.md` defines the visual language, interaction principles, layouts, and UX requirements.

Do not implement UI behavior that contradicts these documents.

---

# 3. Primary UX Goal

The most important user interaction is:

```text
Copy something
      ↓
TextVault captures it
      ↓
User opens quick access
      ↓
Search/select
      ↓
Use it
```

This interaction should feel almost instantaneous.

The user should not need to:

* Open multiple screens
* Navigate complicated menus
* Understand the internal data model
* Perform unnecessary confirmations
* Wait for unnecessary animations

The application should get out of the user's way.

---

# 4. Product Personality

The UI personality should be:

* Modern
* Calm
* Focused
* Fast
* Precise
* Minimal
* Premium
* Technical without being intimidating

Avoid making the application feel:

* Corporate
* Overly colorful
* Toy-like
* Game-like
* Excessively futuristic
* Over-animated
* Like a generic SaaS dashboard

---

# 5. Visual Design Philosophy

The interface should use visual hierarchy instead of excessive decoration.

Prioritize:

```text
Content
  ↓
Hierarchy
  ↓
Spacing
  ↓
Typography
  ↓
Interaction feedback
  ↓
Decoration
```

Decoration must never compete with the clipboard content.

The actual user data is the visual focus.

---

# 6. Design Language

Use a coherent design system.

The application should have:

* Consistent spacing
* Consistent border radius
* Consistent typography
* Consistent control heights
* Consistent icon sizing
* Consistent shadows
* Consistent focus states
* Consistent hover states
* Consistent disabled states
* Consistent destructive states

Do not style each page independently.

---

# 7. Design Tokens

Create centralized design tokens for:

## Colors

Define semantic colors rather than hard-coding colors throughout components.

Examples:

```text
background
surface
surface-elevated
surface-hover
border
border-subtle
text-primary
text-secondary
text-muted
accent
success
warning
danger
info
```

Both light and dark themes must use the same semantic token structure.

---

## Spacing

Use a consistent spacing scale.

For example:

```text
4
8
12
16
20
24
32
40
48
64
```

Do not randomly use dozens of unrelated spacing values.

---

## Radius

Use a small number of consistent radius values.

For example:

```text
small
medium
large
pill
```

Avoid excessive rounding.

The UI should feel modern without looking like every element is a floating pill.

---

## Typography

Typography must provide clear hierarchy.

Use:

```text
Display
Heading
Subheading
Body
Small
Caption
Mono
```

The existing project's typography should be evaluated and improved rather than replaced automatically.

Persian typography must remain readable and visually balanced with Latin text.

---

# 8. Theme System

The application should support:

```text
Light
Dark
System
```

Theme switching must be consistent across the entire application.

Do not create separate unrelated color systems for individual pages.

Components must consume semantic theme tokens.

---

# 9. Accent Colors

If accent customization exists, accent colors must remain controlled.

The accent color should primarily be used for:

* Primary actions
* Selection
* Focus
* Active navigation
* Important highlights

Do not turn the entire UI into an accent-colored interface.

---

# 10. Main Application Shell

The primary application layout should be designed around clipboard productivity.

Conceptually:

```text
┌──────────────────────────────────────────────────────┐
│ Window / Header                                      │
├──────────────┬───────────────────────────────────────┤
│              │                                       │
│ Navigation   │ Main Content                          │
│              │                                       │
│ History      │                                       │
│ Favorites    │                                       │
│ Pins         │                                       │
│ Collections  │                                       │
│ Snippets     │                                       │
│              │                                       │
│ Settings     │                                       │
│              │                                       │
└──────────────┴───────────────────────────────────────┘
```

The exact layout may differ after implementation testing.

The important requirement is strong information hierarchy.

---

# 11. Navigation

Navigation should remain compact.

Primary destinations may include:

```text
Clipboard
Favorites
Pinned
Collections
Snippets
```

Secondary destinations:

```text
Settings
Help / About
```

Do not create a navigation item for every small action.

Actions should use:

* Command palette
* Context menus
* Toolbar actions
* Keyboard shortcuts

where appropriate.

---

# 12. Sidebar Behavior

The sidebar should support a compact mode if practical.

The user should be able to focus on content without losing access to navigation.

Do not consume excessive horizontal space.

The clipboard content area should receive the majority of the window.

---

# 13. Header

The primary header should contain only high-value actions.

Possible elements:

```text
Page title
Search
Quick actions
Command palette access
Settings
```

Avoid filling the header with buttons simply because space is available.

---

# 14. Search

Search is one of the most important UI elements.

It should be:

* Immediately discoverable
* Fast
* Keyboard accessible
* Visually prominent
* Easy to clear
* Supportive of filters

Potential behavior:

```text
Typing
   ↓
Search
   ↓
Results
   ↓
Keyboard navigation
   ↓
Enter → Open / Use
```

Search should not feel like a secondary filter.

It is a core interaction.

---

# 15. Search Experience

The search UI should support:

* Text search
* Filters
* Tags
* Favorites
* Pins
* Collections
* Date filtering
* Content type where available
* Search operators where supported

Filters should not consume excessive space.

Use compact controls, popovers, or filter panels when appropriate.

---

# 16. Clipboard History

Clipboard history is the primary screen.

The layout should prioritize:

* Content preview
* Time
* Source application
* Favorite/pin status
* Tags
* Useful actions

Avoid displaying unnecessary metadata.

The user should understand an item at a glance.

---

# 17. Clipboard Cards / Rows

The existing project uses a card-based interface.

Do not automatically remove this pattern.

Evaluate whether the existing card design can evolve into a more efficient clipboard-focused component.

A clipboard item may contain:

```text
Preview
Metadata
Tags
Favorite
Pin
Copy/use action
More actions
```

The content itself must remain the strongest visual element.

---

# 18. Content Preview

Clipboard previews should be optimized for scanning.

Plain text:

* Show readable line breaks
* Avoid excessive truncation
* Preserve important formatting
* Handle long text gracefully

Code:

* Use monospace typography where appropriate
* Preserve indentation
* Avoid destroying readability

URLs:

* Make them visually identifiable
* Show useful metadata when available

Sensitive content:

* Respect privacy settings
* Do not expose more content than necessary in previews

---

# 19. Long Clipboard Content

Long content must never destroy the layout.

Use:

* Line clamping
* Expand/collapse
* Dedicated detail view
* Scrollable preview

depending on the context.

Do not allow one massive clipboard entry to push the entire interface out of control.

---

# 20. Clipboard Detail View

Selecting an item should allow the user to inspect it comfortably.

The detail view may include:

```text
Full content
Metadata
Source application
Created time
Tags
Collection
Favorite
Pin
Actions
```

Primary actions should remain obvious.

---

# 21. Quick Clipboard UI

Quick Clipboard is one of the most important surfaces.

It should feel different from the full application.

Design goals:

* Compact
* Fast
* Keyboard-first
* Search-first
* Low visual noise
* Easy to dismiss

Conceptual layout:

```text
┌───────────────────────────────────────┐
│ Search clipboard...                   │
├───────────────────────────────────────┤
│ Recent item                           │
│ Recent item                           │
│ Recent item                           │
│ Recent item                           │
├───────────────────────────────────────┤
│ ↑ ↓ Navigate     Enter Use     Esc    │
└───────────────────────────────────────┘
```

The exact design may differ.

---

# 22. Quick Clipboard Interaction

Keyboard interaction should be first-class.

Expected behaviors:

```text
Arrow Up/Down → Navigate
Enter → Select/use
Escape → Close
Typing → Search
Ctrl/Cmd-based shortcuts → configurable actions
```

Mouse interaction should also work.

Do not force users to use a mouse.

---

# 23. Command Palette

The command palette should feel like a native productivity feature.

It should provide:

* Searchable commands
* Categories
* Keyboard navigation
* Shortcut hints
* Clear descriptions
* Recent commands where useful

Example commands:

```text
Open Clipboard
Search Clipboard
Open Favorites
Open Pinned
Create Snippet
Pause Clipboard Monitoring
Resume Clipboard Monitoring
Export Library
Open Settings
Toggle Theme
```

The command palette must not become a dumping ground for every internal operation.

Only meaningful user actions should be exposed.

---

# 24. Context Menus

Context menus should provide relevant actions.

For a clipboard item:

```text
Copy
Open
Favorite
Pin
Add Tag
Move to Collection
Edit
Delete
```

Avoid enormous context menus.

Use separators or grouping when necessary.

Destructive actions should be visually distinguishable.

---

# 25. Selection Mode

Multi-selection should remain efficient.

Selection mode should clearly show:

* Selected items
* Selection count
* Available bulk actions

Example:

```text
3 selected

Favorite
Pin
Tag
Export
Delete
Cancel
```

Do not hide important bulk actions behind multiple menus.

---

# 26. Bulk Actions

Bulk operations must clearly communicate scope.

Before destructive bulk operations:

* Show item count
* Use clear wording
* Provide undo where practical

Example:

```text
Delete 24 items?
```

is better than:

```text
Are you sure?
```

---

# 27. Undo

Undo is an important safety feature.

When a destructive operation supports undo:

```text
Items deleted
[Undo]
```

The notification should be visible long enough to act.

Undo should not require navigating to another screen.

---

# 28. Toasts and Notifications

Toasts should be:

* Short
* Useful
* Non-blocking
* Readable
* Consistent

Good:

```text
Copied to clipboard
Item deleted
Backup exported
Settings saved
```

Avoid:

* Huge notification boxes
* Long technical messages
* Notifications for every tiny UI interaction

---

# 29. Empty States

Every major empty state should be intentional.

Examples:

```text
No clipboard history yet.

Copy something and TextVault will save it here.
```

or:

```text
No favorites yet.

Favorite important clipboard items to find them quickly.
```

Empty states should explain:

1. What is empty.
2. Why it matters.
3. What the user can do next.

Avoid generic:

```text
No data found.
```

---

# 30. Loading States

Loading states should prevent visual jumps.

Use:

* Skeletons
* Subtle progress indicators
* Immediate optimistic feedback where safe

Do not show a full-screen spinner for small operations.

The interface should feel responsive even when work happens in the background.

---

# 31. Error States

Errors must be human-readable.

Bad:

```text
IPC_ERROR_500
```

Better:

```text
Could not load clipboard history.
Please try again.
```

Technical details may be available through diagnostics.

Never expose raw stack traces to normal users.

---

# 32. Destructive Actions

Destructive actions must be visually clear.

Examples:

```text
Delete
Clear history
Empty trash
Reset settings
Replace library
```

Use confirmation when the action is:

* Difficult to undo
* Broad in scope
* Potentially destructive

Do not ask for confirmation for every tiny action.

---

# 33. Favorites and Pins

Favorites and pins should be visually distinguishable.

They should not rely solely on color.

Use:

* Icon state
* Tooltip
* Accessible label
* Subtle visual emphasis

Pinned items may receive stronger hierarchy than ordinary items.

---

# 34. Tags

Tags should be compact and readable.

Avoid huge colorful tag pills.

Tags should support:

* Adding
* Removing
* Searching
* Suggestions
* Filtering

Persian and English tag text must both remain readable.

---

# 35. Collections

Collections should have a clear hierarchy.

Potential structure:

```text
Collections
├── Work
├── Development
├── Personal
└── Research
```

The UI should make moving items between collections easy.

Do not force unnecessary nested structures.

---

# 36. Snippets

Snippets should feel like reusable tools, not ordinary notes.

The UI should emphasize:

```text
Title
Shortcut / trigger
Preview
Tags
Collection
Quick use action
```

The primary action should be using the snippet.

Editing should remain accessible but secondary.

---

# 37. Text Utilities

Text transformation tools should use a clean workflow.

Conceptual layout:

```text
Input
   ↓
Transformation
   ↓
Preview
   ↓
Copy / Replace / Save
```

Potential actions:

```text
Uppercase
Lowercase
Trim whitespace
Remove duplicate lines
Sort lines
Encode
Decode
Format
Escape
Unescape
```

Only expose transformations that are actually implemented.

---

# 38. Settings UI

Settings should not look like an admin dashboard.

Use grouped sections.

Example:

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

Each setting should explain its purpose.

Avoid overly technical wording unless the setting is genuinely technical.

---

# 39. Settings Controls

Use appropriate controls:

```text
Toggle → Boolean
Select → Small fixed set
Slider → Continuous numeric setting
Input → Text
Shortcut recorder → Keyboard shortcut
Color picker → Accent/theme
```

Do not use dropdowns for two-option settings.

Do not use sliders where exact values matter.

---

# 40. Privacy Settings

Privacy settings deserve special visual treatment.

The user should easily understand:

* Whether clipboard monitoring is active
* Whether sensitive content detection is enabled
* Which applications are excluded
* How long history is retained

Avoid hiding important privacy behavior deep inside advanced settings.

---

# 41. Pause State

When clipboard monitoring is paused, the UI must make this obvious.

Possible indicators:

```text
Paused
Clipboard monitoring is paused
Resume
```

Do not rely only on a small icon.

The user must be able to understand the current state quickly.

---

# 42. System Tray UX

The tray experience should be minimal.

The tray menu should prioritize:

```text
Open
Quick Clipboard
Pause/Resume
Settings
Quit
```

Do not reproduce the entire application navigation inside the tray menu.

---

# 43. Keyboard-First Design

Keyboard support is a core product requirement.

Important interactions should have keyboard paths.

Examples:

```text
Open application
Open quick clipboard
Search
Navigate results
Select
Copy/use
Favorite
Pin
Delete
Undo
Open command palette
```

Visible shortcuts should be discoverable through:

* Tooltips
* Command palette
* Settings
* Context menus

---

# 44. Focus Management

Keyboard focus must always be understandable.

Requirements:

* Visible focus state
* Logical tab order
* No unexpected focus jumps
* Modal focus trapping
* Escape closes temporary surfaces when appropriate

Focus should never disappear because of custom styling.

---

# 45. Accessibility

Accessibility is part of UI quality.

Requirements include:

* Keyboard navigation
* Visible focus
* Sufficient contrast
* Semantic controls
* Accessible labels
* Tooltips where icons are ambiguous
* Screen-reader-friendly names where practical
* Reduced-motion support where practical

Do not use color as the only indicator of state.

---

# 46. Iconography

Icons should be:

* Consistent
* Simple
* Recognizable
* Professional
* Visually balanced

Avoid mixing multiple unrelated icon styles.

Do not use emoji as UI icons.

Use a consistent icon library or existing project icon system.

Icons should support the label rather than replace important text everywhere.

---

# 47. Persian / English Support

The UI must support both:

```text
English LTR
Persian RTL
```

This is not limited to translating strings.

The layout must correctly handle:

* Direction
* Alignment
* Icons
* Menus
* Forms
* Search
* Dates
* Numbers
* Mixed-language content
* Code
* URLs

---

# 48. Bidirectional Text

Clipboard content may contain:

```text
Persian
English
Numbers
URLs
Code
Mixed Persian/English
```

The interface must preserve readability.

Existing bidi handling should be evaluated and retained/improved where appropriate.

Avoid forcing the entire application into RTL when only the content requires RTL handling.

---

# 49. Typography for Persian

Persian text must use an appropriate readable font.

Requirements:

* Good Persian glyphs
* Good Latin compatibility
* Clear numbers
* Comfortable line height
* Proper weight hierarchy

Do not choose a font solely because it looks good in English.

---

# 50. Responsive Desktop Layout

The application is desktop-first but must remain usable across:

* Small laptop windows
* Standard desktop
* Large monitors
* Resized application windows

Do not design only for a fixed 1920×1080 layout.

At smaller widths:

* Reduce unnecessary spacing
* Collapse secondary controls
* Allow sidebar compaction
* Preserve content visibility

---

# 51. Window Size

The application should remember a sensible window size and position where appropriate.

It must also handle:

* Small screens
* Window resizing
* Maximized state
* Multi-monitor setups where practical

Do not assume a single display.

---

# 52. Animation

Animation should communicate state.

Use subtle animations for:

* Opening panels
* Closing dialogs
* Selection
* Hover feedback
* Toast appearance
* View transitions

Avoid:

* Constant motion
* Excessive parallax
* Slow transitions
* Decorative animations
* Animations that delay interaction

The application should feel fast.

---

# 53. Motion Duration

Animations should generally be short.

Use approximately:

```text
Fast → 100–150ms
Normal → 150–250ms
Slow → 250–350ms
```

These are guidelines, not rigid requirements.

Important interactions should never feel delayed by animation.

---

# 54. Reduced Motion

If the operating system or application provides reduced-motion preferences, respect them where practical.

Users should still receive clear state feedback without animation.

---

# 55. Hover States

Hover states should provide subtle feedback.

Avoid making every element dramatically change color or size on hover.

Hover is supplementary.

Focus and active states are more important for keyboard users.

---

# 56. Dark Theme

Dark mode should not simply be:

```text
background = #000000
```

Use a layered surface system.

Example conceptual hierarchy:

```text
Background
Surface
Elevated Surface
Hover Surface
Modal Surface
```

Avoid extreme contrast between every layer.

The UI should remain comfortable for long sessions.

---

# 57. Light Theme

Light mode should remain comfortable and professional.

Avoid:

* Excessively bright backgrounds
* Excessive borders
* High-saturation accents
* Too many shadows

Use spacing and hierarchy instead.

---

# 58. Component System

Create reusable components for recurring patterns.

Examples:

```text
Button
IconButton
Input
SearchInput
Select
Checkbox
Switch
Dialog
Popover
Dropdown
Tooltip
Toast
Badge
Tag
Card
ListItem
EmptyState
Skeleton
CommandPalette
```

Do not duplicate identical UI patterns across features.

---

# 59. Component Variants

Components should support meaningful variants.

For example:

```text
Button:
- primary
- secondary
- ghost
- danger

Input:
- default
- search
- error

Card:
- default
- selected
- pinned
```

Do not create dozens of arbitrary variants.

---

# 60. Component Consistency

A button that means the same thing must look and behave the same across the application.

Examples:

```text
Primary action
Secondary action
Destructive action
Cancel
Confirm
```

Do not reinvent button styling on every screen.

---

# 61. Modals and Dialogs

Dialogs should be used for:

* Important confirmations
* Editing complex data
* Settings that require focused attention

Avoid using dialogs for routine actions.

Dialogs should:

* Trap focus
* Have clear titles
* Have clear actions
* Support Escape where appropriate
* Avoid unnecessary complexity

---

# 62. Popovers

Use popovers for lightweight contextual controls such as:

* Filters
* Tag selection
* Collection selection
* Sort options

Do not turn every small interaction into a modal dialog.

---

# 63. Tooltips

Tooltips are appropriate for:

* Icon-only controls
* Unfamiliar actions
* Keyboard shortcuts

Avoid tooltips for controls whose meaning should already be obvious.

Tooltips must not contain essential information that is otherwise inaccessible.

---

# 64. Notifications vs Toasts

Use in-app toasts for application feedback.

Use native desktop notifications only when there is a meaningful reason.

Do not notify the user about routine clipboard captures.

Clipboard capture should happen silently.

---

# 65. Clipboard Capture Feedback

The application should not produce intrusive feedback every time something is copied.

The default experience should be:

```text
Copy → silently captured
```

The user can inspect history when needed.

---

# 66. Visual Density

TextVault Pro is a productivity application.

The UI should support moderate information density.

Avoid:

```text
Huge headings
Huge empty spaces
Oversized cards
Excessive padding
```

At the same time, do not make the interface cramped.

The goal is:

```text
Dense enough for productivity
Spacious enough for clarity
```

---

# 67. Desktop-Native Feel

Although built with Electron, the application should not feel like a website placed inside a window.

Use:

* Keyboard shortcuts
* Context menus
* Tray integration
* Quick launcher
* Native window behavior
* Desktop notifications where appropriate
* Fast transitions
* Persistent local state

The overall interaction model should feel like a desktop productivity tool.

---

# 68. No Generic Dashboard Pattern

Avoid a typical SaaS dashboard containing:

```text
Large hero
Statistics cards
Charts
Marketing copy
Huge navigation
```

TextVault is not a business analytics application.

The primary screen should focus on the user's clipboard data.

---

# 69. No Decorative UI Overload

Do not add visual elements simply to make the interface appear "fancy".

Every visual element should serve at least one purpose:

* Navigation
* Hierarchy
* Feedback
* Interaction
* Discoverability
* Accessibility

---

# 70. No Emoji-Based UI

Do not use emojis as primary interface icons.

Use a consistent professional icon system.

Emoji may exist inside user-generated clipboard content, but not as a substitute for application icons.

---

# 71. Microcopy

UI text should be:

* Short
* Clear
* Human
* Action-oriented

Prefer:

```text
Clear history
```

over:

```text
Execute complete historical clipboard data deletion
```

Prefer:

```text
Pause monitoring
```

over:

```text
Temporarily disable clipboard monitoring subsystem
```

---

# 72. Confirmation Language

Confirmation dialogs should state the consequence.

Bad:

```text
Are you sure?
```

Better:

```text
Clear clipboard history?

This will remove 248 items.
```

For irreversible actions:

```text
This action cannot be undone.
```

Only use this when genuinely true.

---

# 73. Search Empty Results

When search returns nothing, explain the situation.

Example:

```text
No matches

Try a different search or remove some filters.
```

If filters are active, make them visible and easy to clear.

---

# 74. Error Recovery UX

Whenever possible, errors should provide an action.

Examples:

```text
Could not load history.
[Retry]
```

```text
Import failed.
[Try Again]
```

Do not leave users at dead ends.

---

# 75. Privacy UX

Privacy-related controls must be understandable without reading documentation.

The user should be able to answer:

```text
Is monitoring active?
What applications are excluded?
Are sensitive items filtered?
How long is history kept?
```

from the Settings UI.

---

# 76. Security UX

Security-sensitive operations should avoid unnecessary exposure.

Examples:

* Do not display full sensitive content in notifications.
* Do not show clipboard contents in diagnostic dialogs.
* Do not expose secrets in tooltips.
* Do not copy sensitive content unexpectedly.

---

# 77. Performance UX

The interface must provide immediate feedback.

For operations that take time:

```text
Starting...
Importing...
Exporting...
Rebuilding index...
```

But avoid progress UI for operations that complete nearly instantly.

Do not block the entire application for background work.

---

# 78. Virtualized Content

Large clipboard histories should use virtualization where necessary.

The UI should not render thousands of full clipboard cards simultaneously.

The user should still experience smooth:

* Scrolling
* Search
* Selection
* Bulk operations

---

# 79. Mobile Design

Mobile UI is not a primary target.

Do not design TextVault as a mobile web application.

The application is a desktop product.

Responsive behavior refers primarily to different desktop window sizes.

---

# 80. Design Reuse

Before creating a new component:

1. Search the existing component library.
2. Reuse an existing pattern if possible.
3. Extend it if appropriate.
4. Create a new component only when necessary.

Do not create duplicate components with slightly different styling.

---

# 81. Existing UI Audit

Before redesigning the application:

1. Inspect all existing screens.
2. Inspect existing components.
3. Identify reusable components.
4. Identify inconsistent patterns.
5. Identify broken responsive behavior.
6. Identify accessibility problems.
7. Identify poor information hierarchy.
8. Identify unnecessary UI.
9. Identify missing states.
10. Decide what should be kept, refactored, replaced, or removed.

The existing UI must be evaluated before being discarded.

---

# 82. UI Migration Strategy

Do not redesign the entire application blindly in one pass.

Prefer:

```text
Audit
  ↓
Design system
  ↓
Core shell
  ↓
Primary clipboard experience
  ↓
Quick Clipboard
  ↓
Search
  ↓
Organization
  ↓
Snippets
  ↓
Settings
  ↓
Polish
```

Keep the application usable during migration whenever practical.

---

# 83. Visual QA

Every major UI implementation must be visually reviewed.

Check:

* Alignment
* Spacing
* Typography
* Overflow
* Long text
* Persian text
* English text
* Mixed bidi text
* Dark theme
* Light theme
* Hover
* Focus
* Disabled
* Selected
* Error
* Empty
* Loading
* Small window
* Large window

---

# 84. UI Testing

Important UI behavior must have automated tests where practical.

Test:

* Search
* Selection
* Keyboard navigation
* Dialog behavior
* Settings
* Theme switching
* RTL/LTR
* Clipboard history
* Bulk actions
* Undo
* Quick Clipboard
* Command palette
* Tray-related flows where possible

Visual polish alone does not qualify as completion.

---

# 85. Responsive QA

Test at multiple window sizes.

At minimum, evaluate:

```text
1024 × 700
1280 × 800
1440 × 900
1920 × 1080
2560 × 1440
```

These are test targets, not fixed design dimensions.

The application must remain usable when resized between them.

---

# 86. RTL QA

Test:

```text
English only
Persian only
English + Persian
Persian + English
URLs
Numbers
Code
Mixed content
```

Do not assume RTL works simply because the document direction is changed.

---

# 87. Accessibility QA

Check:

* Keyboard-only navigation
* Focus visibility
* Tab order
* Escape behavior
* Screen-reader labels where practical
* Contrast
* Disabled states
* Error states

---

# 88. Design Implementation Rules for AI Agents

When an AI coding agent implements UI changes, it MUST:

1. Read this entire document before major UI work.
2. Read `PRODUCT_SPEC.md`.
3. Read `FEATURES.md`.
4. Read `ARCHITECTURE.md`.
5. Inspect existing UI before rewriting it.
6. Reuse existing components when technically appropriate.
7. Avoid unnecessary dependencies.
8. Avoid generic dashboard templates.
9. Avoid emoji icons.
10. Avoid excessive animations.
11. Avoid excessive gradients.
12. Avoid excessive rounded cards.
13. Keep clipboard content visually dominant.
14. Support light/dark/system themes.
15. Support Persian and English.
16. Test RTL/LTR behavior.
17. Test keyboard navigation.
18. Test responsive desktop window sizes.
19. Implement loading, empty, error, and disabled states.
20. Preserve accessibility.
21. Do not hard-code duplicated design values across components.
22. Use centralized design tokens.
23. Do not modify application architecture merely for visual convenience.
24. Do not introduce UI libraries without justification.
25. Do not redesign unrelated features while implementing a specific task.
26. Do not remove working functionality without documented reason.
27. Run relevant tests after implementation.
28. Visually inspect the result before considering the task complete.

---

# 89. UI Quality Bar

A UI implementation is not complete when:

```text
The page renders.
```

It is complete when:

```text
The page renders
        +
The hierarchy is clear
        +
The interaction is intuitive
        +
The layout survives resizing
        +
The UI works in light/dark
        +
The UI works in Persian/English
        +
Keyboard interaction works
        +
Focus states work
        +
Loading/empty/error states work
        +
Accessibility is acceptable
        +
No unnecessary visual noise exists
```

---

# 90. Visual Quality Checklist

Before marking UI work complete, verify:

## Layout

* [ ] No accidental overflow
* [ ] No clipped content
* [ ] Consistent spacing
* [ ] Correct alignment
* [ ] Good information hierarchy

## Typography

* [ ] Readable body text
* [ ] Clear heading hierarchy
* [ ] Correct Persian rendering
* [ ] Correct monospace rendering for code

## Interaction

* [ ] Hover states
* [ ] Focus states
* [ ] Active states
* [ ] Disabled states
* [ ] Keyboard navigation
* [ ] Escape behavior

## States

* [ ] Loading
* [ ] Empty
* [ ] Error
* [ ] Success
* [ ] Selected
* [ ] Disabled

## Themes

* [ ] Light
* [ ] Dark
* [ ] System

## Languages

* [ ] English
* [ ] Persian
* [ ] Mixed content
* [ ] RTL/LTR

## Desktop

* [ ] Small window
* [ ] Standard window
* [ ] Large monitor
* [ ] Resizing
* [ ] Maximized state

---

# 91. Final Design Direction

TextVault Pro should feel like a focused desktop utility that a power user can leave running all day.

It should communicate:

```text
Fast
Private
Reliable
Focused
Modern
Professional
```

The interface should disappear into the user's workflow rather than constantly demanding attention.

The ideal reaction from a new user should be:

> "I immediately understand what this does, and I can start using it."

---

# 92. Final UI Principle

Do not optimize for visual complexity.

Optimize for:

```text
Clarity
Speed
Hierarchy
Consistency
Accessibility
Keyboard efficiency
Privacy
```

A professional UI is not one with the most effects.

A professional UI is one where the user rarely has to stop and think about how to accomplish a simple task.

TextVault Pro should make clipboard management feel effortless.
