# Phase 8: Undo/Redo with Keyboard Shortcuts

## 🎯 Objective

Implement undo/redo capability that allows users to revert and reapply settings changes through buttons and keyboard shortcuts (Ctrl+Z/Ctrl+Y). Each operation updates the form with historical settings snapshots from the store's history array, provides visual feedback about history position, and maintains the debounced auto-save workflow from Phase 7.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md) - High-level feature overview
- [ ] [Phase 7 Completion](./SETTINGS_FEATURE_P7.md) - Auto-save functionality (prerequisite)
- [ ] [Phase 3 - History Management](./SETTINGS_FEATURE_P3.md) - Store undo/redo implementation

**Standards & Guidelines:**

- [ ] [State Standards](../../STATE_STANDARDS.md) - Store patterns with `updateState()` and `actionMessage`
- [ ] [Coding Standards](../../CODING_STANDARDS.md) - Component patterns and keyboard handling
- [ ] [Testing Standards](../../TESTING_STANDARDS.md) - Testing approaches
- [ ] [Style Guide](../../STYLE_GUIDE.md) - Button and toolbar styling

**Reference Implementations:**

- [ ] [PlayerStore](../../../libs/application/src/lib/player/player-store.ts) - History management pattern to follow exactly

**Angular Documentation:**

- Angular HostListener - Keyboard event handling
- Angular Material Toolbar and Buttons

---

## 📂 File Structure Overview

> Modified settings view for undo/redo functionality.

```
libs/features/settings/src/lib/
├── settings-view/
│   ├── settings-view.component.ts            📝 Modified - Add undo/redo logic and keyboard handlers
│   ├── settings-view.component.html          📝 Modified - Add undo/redo toolbar
│   ├── settings-view.component.scss          📝 Modified - Style toolbar
│   └── settings-view.component.spec.ts       📝 Modified - Add undo/redo tests
```

---

<details open>
<summary><h3>Task 1: Add Undo/Redo Toolbar with Buttons</h3></summary>

**Purpose**: Create toolbar with Material icon buttons for undo and redo operations.

**Related Documentation:**

- [Style Guide](../../STYLE_GUIDE.md) - Toolbar and button styling conventions
- [Coding Standards](../../CODING_STANDARDS.md) - Component structure patterns
- Angular Material Toolbar - MatToolbar and MatIconButton components

**Implementation Subtasks:**

- [ ] Add toolbar container to settings header
- [ ] Create MatIconButton for undo with `undo` icon
- [ ] Create MatIconButton for redo with `redo` icon
- [ ] Bind disabled state to store's `canUndo()` and `canRedo()` signals
- [ ] Add tooltips showing keyboard shortcuts (e.g., "Undo (Ctrl+Z)")
- [ ] Add aria-labels for accessibility
- [ ] Position toolbar prominently but not intrusively

**Testing Subtask:**

- [ ] Write Toolbar UI Tests using Vitest (see Testing section below)

**Key Implementation Notes:**

- Use Material icon buttons for consistency with app design
- Tooltips must show keyboard shortcuts for discoverability
- Buttons automatically disabled when no undo/redo available (via store signals)
- Place toolbar in header area near save status indicator
- Proper ARIA attributes for screen reader support

**Testing Focus for Task 1:**

> Test **button rendering and state** - verify toolbar displays correctly.

**Behaviors to Test (Vitest):**

- [ ] Undo button renders with correct icon
- [ ] Redo button renders with correct icon
- [ ] Undo button disabled when canUndo() is false
- [ ] Redo button disabled when canRedo() is false
- [ ] Tooltips show correct keyboard shortcuts
- [ ] ARIA labels present for accessibility

</details>

<details open>
<summary><h3>Task 2: Implement Undo/Redo Click Handlers</h3></summary>

**Purpose**: Connect toolbar buttons to store's undo/redo actions that navigate history.

**Related Documentation:**

- [PlayerStore - History Actions](../../../libs/application/src/lib/player/player-store.ts) - Reference implementation for undo/redo
- [Phase 3 - History Management](./SETTINGS_FEATURE_P3.md) - Store history implementation details
- [State Standards](../../STATE_STANDARDS.md) - Action patterns

**Implementation Subtasks:**

- [ ] Create undo() method in component
- [ ] Call settingsStore.undoSettings() in undo() method
- [ ] Create redo() method in component
- [ ] Call settingsStore.redoSettings() in redo() method
- [ ] Connect methods to button click handlers
- [ ] Ensure auto-save doesn't trigger on undo/redo form updates

**Testing Subtask:**

- [ ] Write Click Handler Tests using Vitest (see Testing section below)

**Key Implementation Notes:**

- Store actions handle history navigation (follow PlayerStore pattern exactly)
- Store actions use `updateState()` with `actionMessage` per STATE_STANDARDS.md
- Component simply calls store actions - no history logic in component
- Must prevent auto-save from triggering when form updates from undo/redo
- Use flag or similar mechanism to distinguish user edits from programmatic updates

**Testing Focus for Task 2:**

> Test **action dispatch** - verify buttons call correct store actions.

**Behaviors to Test (Vitest):**

- [ ] Undo button click calls settingsStore.undoSettings()
- [ ] Redo button click calls settingsStore.redoSettings()
- [ ] Store actions update form with historical values
- [ ] Auto-save does NOT trigger on undo/redo
- [ ] Form updates reflect historical settings

</details>

<details open>
<summary><h3>Task 3: Synchronize Form with History State</h3></summary>

**Purpose**: Update form controls when undo/redo operations change current settings in store.

**Related Documentation:**

- [State Standards](../../STATE_STANDARDS.md) - Reactive state patterns
- [Coding Standards](../../CODING_STANDARDS.md) - Effect patterns
- [Phase 3](./SETTINGS_FEATURE_P3.md) - Store history implementation

**Implementation Subtasks:**

- [ ] Create effect() to watch settingsStore.settings() signal
- [ ] Update form with patchValue() when settings change
- [ ] Set flag to prevent auto-save during programmatic updates
- [ ] Use `{ emitEvent: false }` option to prevent valueChanges emission
- [ ] Clear flag after form update completes
- [ ] Test synchronization with undo/redo operations

**Testing Subtask:**

- [ ] Write Form Sync Tests using Vitest (see Testing section below)

**Key Implementation Notes:**

- Effect watches settings signal for any changes (including undo/redo)
- Use `patchValue({ emitEvent: false })` to prevent auto-save trigger
- Consider using a "programmatic update" flag for clarity
- Form must accurately reflect current settings after each undo/redo
- No auto-save should occur during synchronization

**Testing Focus for Task 3:**

> Test **form synchronization** - verify form updates on history navigation.

**Behaviors to Test (Vitest):**

- [ ] Form updates when settings change from undo
- [ ] Form updates when settings change from redo
- [ ] Auto-save does NOT trigger during sync
- [ ] Form values match settings after undo/redo
- [ ] Effect properly tracks settings changes

</details>

<details open>
<summary><h3>Task 4: Implement Keyboard Shortcuts (Ctrl+Z, Ctrl+Y)</h3></summary>

**Purpose**: Add keyboard event handlers for undo (Ctrl+Z) and redo (Ctrl+Y/Ctrl+Shift+Z).

**Related Documentation:**

- [Coding Standards](../../CODING_STANDARDS.md) - HostListener patterns
- Angular HostListener - Keyboard event handling

**Implementation Subtasks:**

- [ ] Add @HostListener for keydown.control.z
- [ ] Call undo() method on Ctrl+Z
- [ ] Add @HostListener for keydown.control.y
- [ ] Call redo() method on Ctrl+Y
- [ ] Consider Ctrl+Shift+Z as alternative redo shortcut
- [ ] Prevent default browser behavior for these shortcuts
- [ ] Test shortcuts don't interfere with form inputs

**Testing Subtask:**

- [ ] Write Keyboard Shortcut Tests using Vitest (see Testing section below)

**Key Implementation Notes:**

- Use Angular @HostListener decorator for keyboard events
- Call preventDefault() to prevent browser default behavior
- Shortcuts should work app-wide when settings view active
- Consider supporting both Ctrl+Y and Ctrl+Shift+Z for redo (platform conventions)
- Ensure shortcuts don't interfere with typing in form fields

**Testing Focus for Task 4:**

> Test **keyboard event handling** - verify shortcuts trigger correct actions.

**Behaviors to Test (Vitest):**

- [ ] Ctrl+Z triggers undo() method
- [ ] Ctrl+Y triggers redo() method
- [ ] Shortcuts call store actions correctly
- [ ] Default browser behavior prevented
- [ ] Shortcuts work when component active
- [ ] Shortcuts don't interfere with form input

</details>

<details open>
<summary><h3>Task 5: Add History Position Indicator</h3></summary>

**Purpose**: Display current position in history (e.g., "3 of 10 changes") for user awareness.

**Related Documentation:**

- [Style Guide](../../STYLE_GUIDE.md) - Status indicator styling
- [PlayerStore](../../../libs/application/src/lib/player/player-store.ts) - History state patterns

**Implementation Subtasks:**

- [ ] Add computed signal for history position text
- [ ] Calculate current position from store's `historyIndex()`
- [ ] Calculate total history from store's `history()` array length
- [ ] Add indicator element to template near undo/redo buttons
- [ ] Style indicator subtly (secondary text color)
- [ ] Handle edge cases (empty history, single item)

**Testing Subtask:**

- [ ] Write Position Indicator Tests using Vitest (see Testing section below)

**Key Implementation Notes:**

- Store exposes historyIndex and history array (from Phase 3)
- Position = historyIndex + 1 (zero-based to one-based)
- Total = history array length
- Display format: "3 of 10" or "Change 3/10"
- Hide or show placeholder when history empty
- Update indicator reactively as history changes

**Testing Focus for Task 5:**

> Test **position display** - verify indicator shows correct history position.

**Behaviors to Test (Vitest):**

- [ ] Indicator displays current position correctly
- [ ] Indicator updates on undo/redo
- [ ] Position format user-friendly
- [ ] Handles empty history gracefully
- [ ] Handles single-item history
- [ ] Reactively updates with store changes

</details>

---

## ✅ Success Criteria

> All criteria must be met before proceeding to Phase 9.

**Undo/Redo Functionality:**

- [ ] Undo button navigates to previous settings
- [ ] Redo button navigates to next settings
- [ ] Buttons disabled when unavailable (canUndo/canRedo)
- [ ] Form updates correctly on undo/redo
- [ ] Auto-save does not trigger on undo/redo

**Keyboard Shortcuts:**

- [ ] Ctrl+Z triggers undo
- [ ] Ctrl+Y triggers redo
- [ ] Shortcuts work app-wide when settings active
- [ ] Default browser behavior prevented
- [ ] Shortcuts don't interfere with form inputs

**User Feedback:**

- [ ] Toolbar visible and accessible
- [ ] Tooltips show keyboard shortcuts
- [ ] History position indicator displays correctly
- [ ] Visual feedback clear and intuitive
- [ ] ARIA labels for accessibility

**State Management:**

- [ ] Store actions use `updateState()` with `actionMessage`
- [ ] History management follows PlayerStore pattern
- [ ] Form synchronization prevents auto-save loops
- [ ] State updates comply with STATE_STANDARDS.md

**Testing:**

- [ ] All undo/redo logic has Vitest unit tests
- [ ] Keyboard shortcuts tested
- [ ] Form synchronization tested
- [ ] Component integration tested
- [ ] No test failures introduced

---

## 🧪 Testing Summary

> Comprehensive testing of undo/redo functionality.

**Test Distribution:**

- **Unit Tests**: 30 tests (toolbar, handlers, sync, keyboard, indicator)
- **Integration Tests**: 10 tests (full undo/redo flow with store)
- **Total**: **40 tests**

**Testing Tools:**

- **Framework**: Vitest for all unit and integration tests
- **Component Testing**: Angular Testing Library patterns per [Smart Component Testing](../../SMART_COMPONENT_TESTING.md)
- **Keyboard Testing**: Simulate keyboard events in tests

**Key Testing Patterns:**

1. **Toolbar Testing** (Vitest):
   - Test button rendering and disabled states
   - Verify tooltips and ARIA labels
   - Test button click handlers

2. **Store Action Testing** (Vitest):
   - Test undo/redo actions called correctly
   - Verify form updates after history navigation
   - Test auto-save prevention during undo/redo

3. **Keyboard Shortcut Testing** (Vitest):
   - Simulate Ctrl+Z and Ctrl+Y events
   - Verify correct actions triggered
   - Test preventDefault() called

4. **Form Synchronization Testing** (Vitest):
   - Test form updates on settings changes
   - Verify no auto-save during sync
   - Test effect behavior with history changes

5. **Integration Testing** (Vitest):
   - Test complete undo/redo workflow
   - Verify history position updates
   - Test multiple undo/redo operations

**Coverage Goals:**

- **Unit Tests**: 100% of undo/redo logic
- **Integration Tests**: All user-facing undo/redo workflows
- **Behavioral Focus**: Test observable outcomes, not implementation

---

## 🎯 Estimated Effort

**Total Phase Time**: 3-4 hours

**Task Breakdown:**

- Task 1 (Toolbar): 30 minutes
- Task 2 (Click Handlers): 30 minutes
- Task 3 (Form Sync): 45 minutes
- Task 4 (Keyboard Shortcuts): 45 minutes
- Task 5 (Position Indicator): 30 minutes
- Testing: 60 minutes

**Milestone**: Undo/redo complete with keyboard shortcuts, ready for E2E testing and polish (Phase 9).

