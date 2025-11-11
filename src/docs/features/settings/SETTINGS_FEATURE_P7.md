# Phase 7: Auto-Save & Change Detection

## 🎯 Objective

Implement debounced auto-save functionality that persists form changes automatically while providing clear feedback through the loading-text component. This phase creates a seamless save experience with proper error handling via infrastructure layer alerts and coordinated state management between forms and the store.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md) - High-level feature overview
- [ ] [Phase 6 Completion](./SETTINGS_FEATURE_P6.md) - Forms architecture (prerequisite)

**Standards & Guidelines:**

- [ ] [State Standards](../../STATE_STANDARDS.md) - Store patterns with `updateState()` and `actionMessage`
- [ ] [Coding Standards](../../CODING_STANDARDS.md) - RxJS patterns and effects
- [ ] [Testing Standards](../../TESTING_STANDARDS.md) - Testing approaches

**E2E Testing Reference:**

- [ ] **IMPORTANT**: [E2E Testing Guide](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - Read deeply through this document and ALL linked documentation for interceptor, fixture, and generator patterns

**Reference Implementations:**

- [ ] [PlayerService](../../../libs/infrastructure/src/lib/player/player.service.ts) - Alert-based error handling pattern
- [ ] [Loading Text Component](../../../libs/ui/components/src/lib/loading-text/loading-text.component.ts) - Save status indicator

**Angular Documentation:**

- RxJS debounceTime and distinctUntilChanged operators
- Angular effect() for reactive updates

---

## 📂 File Structure Overview

> Auto-save infrastructure and status indicators.

```
libs/features/settings/src/lib/
├── settings-view/
│   ├── settings-view.component.ts            📝 Modified - Add auto-save logic
│   ├── settings-view.component.html          📝 Modified - Add loading-text component
│   ├── settings-view.component.scss          📝 Modified - Status indicator styles
│   └── settings-view.component.spec.ts       📝 Modified - Add auto-save tests
libs/application/src/lib/settings/
└── settings-store.ts                         📝 Modified - Add save state tracking
```

---

<details open>
<summary><h3>Task 1: Add Auto-Save Logic to Settings View</h3></summary>

**Purpose**: Implement debounced form change detection that triggers automatic saves to the settings store.

**Related Documentation:**

- [State Standards](../../STATE_STANDARDS.md) - `updateState()` with `actionMessage` pattern
- [Coding Standards](../../CODING_STANDARDS.md) - RxJS patterns
- [PlayerService](../../../libs/infrastructure/src/lib/player/player.service.ts) - Service error handling pattern

**Implementation Subtasks:**

- [ ] Subscribe to form.valueChanges observable
- [ ] Apply debounceTime(500) to prevent excessive saves
- [ ] Apply distinctUntilChanged() to ignore duplicate values
- [ ] Call settingsStore.saveSettings() on form changes
- [ ] Use takeUntilDestroyed() for automatic cleanup
- [ ] Handle form validity before save (skip if invalid)
- [ ] Map form values to Settings domain model

**Testing Subtask:**

- [ ] Write Auto-Save Tests using Vitest (see Testing section below)

**Key Implementation Notes:**

- 500ms debounce provides good balance (user typing vs. responsiveness)
- Only save if form is valid (prevents invalid data submission)
- Use `takeUntilDestroyed()` for automatic subscription cleanup
- Infrastructure layer (SettingsService) handles error alerts per PlayerService pattern
- Form values must be mapped to domain Settings model before save

**Testing Focus for Task 1:**

> Test **debounced save behavior** - verify auto-save triggers correctly.

**Behaviors to Test (Vitest):**

- [ ] Form changes trigger saveSettings() after 500ms debounce
- [ ] Multiple rapid changes only trigger one save (debounce working)
- [ ] Invalid forms do not trigger save
- [ ] Save called with correct Settings domain model
- [ ] Subscription cleaned up on component destroy

</details>

<details open>
<summary><h3>Task 2: Add Save State Tracking to Settings Store</h3></summary>

**Purpose**: Track save operation status (saving, success, error) in store state for UI feedback.

**Related Documentation:**

- [State Standards](../../STATE_STANDARDS.md) - `updateState()` with `actionMessage` for Redux DevTools
- [PlayerStore](../../../libs/application/src/lib/player/player-store.ts) - Store state patterns

**Implementation Subtasks:**

- [ ] Add `isSaving` boolean to store state
- [ ] Add `lastSaveTime` Date | null to store state
- [ ] Update saveSettings() action to set `isSaving: true` before API call
- [ ] Use `updateState()` with `actionMessage` for all state changes
- [ ] Set `isSaving: false` and `lastSaveTime` on success
- [ ] Set `isSaving: false` on error
- [ ] Add computed signal for save status display

**Testing Subtask:**

- [ ] Write Store Save State Tests using Vitest (see Testing section below)

**Key Implementation Notes:**

- All state updates must use `updateState()` with `createAction()` message
- Follow STATE_STANDARDS.md patterns exactly (no patchState)
- isSaving enables loading indicator in UI
- lastSaveTime provides "Last saved at..." feedback
- Error handling via infrastructure layer alerts (SettingsService)

**Testing Focus for Task 2:**

> Test **save state transitions** - verify store tracks save status correctly.

**Behaviors to Test (Vitest):**

- [ ] isSaving set to true when saveSettings() called
- [ ] isSaving set to false on save success
- [ ] lastSaveTime updated on success
- [ ] isSaving set to false on save error
- [ ] All updates use `updateState()` with `actionMessage`
- [ ] Computed signals reflect current save state

</details>

<details open>
<summary><h3>Task 3: Integrate Loading-Text Component for Save Status</h3></summary>

**Purpose**: Display save operation status using the existing loading-text component.

**Related Documentation:**

- [Loading Text Component](../../../libs/ui/components/src/lib/loading-text/loading-text.component.ts) - Component API and usage
- [Coding Standards](../../CODING_STANDARDS.md) - Component integration patterns

**Implementation Subtasks:**

- [ ] Import LoadingTextComponent into settings-view
- [ ] Add loading-text element to template
- [ ] Bind `isLoading` input to `settingsStore.isSaving()` signal
- [ ] Set appropriate loading message: "Saving settings..."
- [ ] Position loading indicator appropriately (e.g., near save status area)
- [ ] Apply consistent styling per Style Guide

**Testing Subtask:**

- [ ] Write Loading Indicator Tests using Vitest (see Testing section below)

**Key Implementation Notes:**

- Loading-text component shows animated indicator during saves
- Component automatically handles show/hide based on isLoading signal
- Position near form or in header area for visibility
- Use existing component - no custom spinner needed

**Testing Focus for Task 3:**

> Test **loading indicator integration** - verify visual feedback works correctly.

**Behaviors to Test (Vitest):**

- [ ] Loading-text component present in template
- [ ] Component shown when settingsStore.isSaving() is true
- [ ] Component hidden when settingsStore.isSaving() is false
- [ ] Correct loading message displayed

</details>

<details open>
<summary><h3>Task 4: Add Last Saved Timestamp Display</h3></summary>

**Purpose**: Display "Last saved at [time]" feedback to user using lastSaveTime from store.

**Related Documentation:**

- [Coding Standards](../../CODING_STANDARDS.md) - Template patterns
- Angular DatePipe - Date formatting

**Implementation Subtasks:**

- [ ] Add timestamp display element to template
- [ ] Bind to `settingsStore.lastSaveTime()` signal
- [ ] Use Angular DatePipe for friendly formatting (e.g., "medium" or custom format)
- [ ] Handle null case (no save yet): "Not saved" or hide element
- [ ] Apply subtle styling (secondary text color)

**Testing Subtask:**

- [ ] Write Timestamp Display Tests using Vitest (see Testing section below)

**Key Implementation Notes:**

- Provides user confidence that changes are persisted
- Use DatePipe for consistent formatting
- Consider relative time for recent saves (e.g., "a few seconds ago")
- Subtle UI element - don't distract from main content

**Testing Focus for Task 4:**

> Test **timestamp display** - verify last save time shown correctly.

**Behaviors to Test (Vitest):**

- [ ] Timestamp displayed when lastSaveTime has value
- [ ] Timestamp formatted correctly using DatePipe
- [ ] Null lastSaveTime handled appropriately
- [ ] Display updates when lastSaveTime changes

</details>

<details open>
<summary><h3>Task 5: Handle Save Errors with Infrastructure Layer Alerts</h3></summary>

**Purpose**: Ensure save errors trigger alert notifications via SettingsService following PlayerService pattern.

**Related Documentation:**

- [PlayerService](../../../libs/infrastructure/src/lib/player/player.service.ts) - Error handling with alerts pattern
- [Service Standards](../../SERVICE_STANDARDS.md) - Error handling patterns

**Implementation Subtasks:**

- [ ] Verify SettingsService (Phase 2) dispatches error alerts on save failure
- [ ] Ensure store saveSettings() action propagates errors correctly
- [ ] No direct error handling in component (infrastructure layer handles it)
- [ ] Verify error alerts appear in UI when save fails
- [ ] Test error scenarios thoroughly

**Testing Subtask:**

- [ ] Write Error Handling Tests using Vitest (see Testing section below)

**Key Implementation Notes:**

- Error handling happens in infrastructure layer (SettingsService)
- Component does NOT need to handle errors directly
- Alerts provide user-friendly error messages
- Store isSaving flag resets on error for UI feedback
- Follow exact pattern from PlayerService implementation

**Testing Focus for Task 5:**

> Test **error handling** - verify errors trigger alerts and reset state.

**Behaviors to Test (Vitest):**

- [ ] Save errors reset isSaving to false
- [ ] Alert service receives error notification (via infrastructure)
- [ ] Error alerts displayed in UI
- [ ] Form remains editable after error
- [ ] User can retry save after error

</details>

<details open>
<summary><h3>Task 6: Create E2E Tests for Auto-Save</h3></summary>

**Purpose**: Create comprehensive Cypress E2E tests for auto-save functionality with proper mocking infrastructure.

**Related Documentation:**

- **IMPORTANT**: [E2E Testing Guide](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - Read deeply through this document and ALL linked documentation
- [Settings Backend Endpoints](https://github.com/MetalHexx/TeensyROM-Web/tree/main/src/apps/api/src/TeensyRom.Api/Endpoints/Settings) - Endpoints to mock

**Implementation Subtasks:**

- [ ] Create settings.cy.ts E2E test file
- [ ] Create settings interceptors file (API response mocking)
- [ ] Create settings data generators (test fixtures)
- [ ] Create settings constants file (selectors, routes, etc.)
- [ ] Write auto-save test scenarios
- [ ] Test debounce behavior with cy.clock() and cy.tick()
- [ ] Test loading indicator appears during save
- [ ] Test success and error scenarios
- [ ] Verify alerts on save errors

**Testing Subtask:**

- [ ] Complete E2E Auto-Save Test Suite (see Testing section below)

**Key Implementation Notes:**

- **CRITICAL**: Follow E2E_TESTS.md patterns for interceptors, fixtures, and generators
- Study existing *.cy.ts files for pattern reference
- Use cy.clock() to control debounce timing
- Mock Settings GET and PUT endpoints
- Test both successful and failed saves
- Verify alert notifications on errors (infrastructure layer)

**Testing Focus for Task 6:**

> Test **end-to-end auto-save flow** - verify complete user experience.

**Behaviors to Test (Cypress):**

- [ ] Form changes trigger save after 500ms debounce
- [ ] Loading indicator shown during save
- [ ] Timestamp updated after successful save
- [ ] Multiple rapid changes debounced correctly
- [ ] Invalid form prevents save
- [ ] Save errors display alert notifications
- [ ] User can continue editing after save

</details>

---

## ✅ Success Criteria

> All criteria must be met before proceeding to Phase 8.

**Auto-Save Functionality:**

- [ ] Form changes trigger debounced save (500ms)
- [ ] Only valid forms trigger save operations
- [ ] Debounce prevents excessive API calls
- [ ] Subscription cleanup on component destroy

**Store State Management:**

- [ ] Store tracks isSaving and lastSaveTime
- [ ] All state updates use `updateState()` with `actionMessage`
- [ ] Save state accessible via computed signals
- [ ] State updates follow STATE_STANDARDS.md patterns

**User Feedback:**

- [ ] Loading-text component shows during save
- [ ] Last saved timestamp displayed
- [ ] Error alerts appear on save failure (via infrastructure)
- [ ] Visual feedback clear and unobtrusive

**Error Handling:**

- [ ] Save errors trigger infrastructure layer alerts
- [ ] isSaving flag resets on error
- [ ] Form remains editable after error
- [ ] Error messages user-friendly

**Testing:**

- [ ] All auto-save logic has Vitest unit tests
- [ ] E2E tests cover auto-save scenarios with proper mocking
- [ ] Debounce behavior tested
- [ ] Error scenarios tested
- [ ] No test failures introduced

---

## �� Testing Summary

> Comprehensive testing of auto-save functionality.

**Test Distribution:**

- **Unit Tests**: 25 tests (auto-save logic, store state, component integration)
- **E2E Tests**: 15 tests (auto-save flow, debounce, errors, alerts)
- **Total**: **40 tests**

**Testing Tools:**

- **Framework**: Vitest for unit/integration tests, Cypress for E2E
- **Patterns**: Follow [E2E Testing Guide](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) for E2E structure
- **Mocking**: Use interceptors and fixtures per E2E standards

**Key Testing Patterns:**

1. **Auto-Save Logic Testing** (Vitest):
   - Test debounced observable behavior
   - Verify save only triggered for valid forms
   - Test subscription cleanup

2. **Store State Testing** (Vitest):
   - Test isSaving flag transitions
   - Verify lastSaveTime updates
   - Test `updateState()` with `actionMessage` usage

3. **Component Integration Testing** (Vitest):
   - Test loading-text component integration
   - Test timestamp display
   - Verify component state bindings

4. **E2E Testing** (Cypress):
   - Test complete auto-save flow
   - Test debounce with cy.clock()
   - Test error scenarios and alerts
   - Verify user can continue after errors

**Coverage Goals:**

- **Unit Tests**: 100% of auto-save logic and state management
- **E2E Tests**: All user-facing auto-save behaviors
- **Behavioral Focus**: Test observable outcomes, not implementation

---

## 🎯 Estimated Effort

**Total Phase Time**: 3-4 hours

**Task Breakdown:**

- Task 1 (Auto-Save Logic): 45 minutes
- Task 2 (Store State): 30 minutes
- Task 3 (Loading-Text Integration): 20 minutes
- Task 4 (Timestamp Display): 20 minutes
- Task 5 (Error Handling): 30 minutes
- Task 6 (E2E Tests): 60 minutes

**Milestone**: Auto-save complete with full user feedback, ready for undo/redo (Phase 8).
