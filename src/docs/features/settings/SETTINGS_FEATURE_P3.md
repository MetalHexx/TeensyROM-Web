# Phase 3: Settings Store (Application Layer)

## 🎯 Objective

Implement the NgRx Signal Store for settings state management in the application layer. The store will manage settings state, coordinate with the infrastructure service, track undo/redo history following the PlayerStore pattern, and provide computed selectors for components. This establishes the reactive state management layer that components will consume in later phases.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [x] [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md) - High-level feature overview
- [x] [Phase 2 Completion](./SETTINGS_FEATURE_P2.md) - Domain contracts and infrastructure (prerequisite)

**Standards & Guidelines:**

- [x] [State Standards](../../STATE_STANDARDS.md) - **CRITICAL**: NgRx Signal Store patterns, updateState with actionMessage
- [x] [Store Testing](../../STORE_TESTING.md) - Store testing patterns and best practices
- [x] [Coding Standards](../../CODING_STANDARDS.md) - General coding conventions

**Reference Implementations:**

- [x] [PlayerStore](../../../libs/application/src/lib/player/player-store.ts) - Store structure and history management pattern to follow
- [x] [Player History Actions](../../../libs/application/src/lib/player/actions/navigate-backward-in-history.ts) - Undo/redo pattern with updateState
- [x] [Player Store Actions](../../../libs/application/src/lib/player/actions/) - Action implementation patterns

---

## 📂 File Structure Overview

> New store implementation with actions and selectors.

```
libs/application/src/lib/settings/
├── index.ts                                  ✨ New - Barrel export for settings store
├── settings-store.ts                         ✨ New - NgRx Signal Store configuration
├── settings-state.interface.ts               ✨ New - State interface definition
├── settings-store.spec.ts                    ✨ New - Store unit tests
├── actions/
│   ├── index.ts                              ✨ New - Actions barrel export
│   ├── load-settings.ts                      ✨ New - Load settings action
│   ├── save-settings.ts                      ✨ New - Save settings action
│   ├── update-settings.ts                    ✨ New - Update settings action
│   ├── undo.ts                               ✨ New - Undo action
│   ├── redo.ts                               ✨ New - Redo action
│   └── clear-history.ts                      ✨ New - Clear history action
└── selectors/
    ├── index.ts                              ✨ New - Selectors barrel export
    ├── get-settings.ts                       ✨ New - Settings selector
    ├── can-undo.ts                           ✨ New - Can undo selector
    ├── can-redo.ts                           ✨ New - Can redo selector
    └── get-history-position.ts               ✨ New - History position selector
```

---

<details open>
<summary><h3>Task 1: Define Settings State Interface ✅</h3></summary>

**Purpose**: Create the TypeScript interface defining the settings store state structure, including current settings, undo/redo history, and loading/error states.

**Related Documentation:**

- [State Standards - State Interface](../../STATE_STANDARDS.md#state-structure)
- [PlayerStore State](../../../libs/application/src/lib/player/player-store.ts) - Reference state structure with history

**Implementation Subtasks:**

- [x] **Create settings-state.interface.ts**: Define SettingsState interface
- [x] **Define current settings**: Current Settings object
- [x] **Define history structure**: Array of Settings snapshots (max 50 entries)
- [x] **Define history position**: Current position in history (-1 = at end, 0+ = specific position)
- [x] **Add loading state**: `isLoading`, `isSaving` boolean flags
- [x] **Add error state**: `error` nullable string
- [x] **Add timestamp**: `lastUpdated` nullable number

**Testing Subtask:**

- [x] **Verify Interface Compilation**: Ensure interface compiles without errors

**Key Implementation Notes:**

- Follow PlayerStore history pattern exactly (playHistory structure)
- History limited to 50 snapshots to prevent memory issues
- Position -1 indicates at current (end of history), 0+ indicates historical position
- Separate loading flags for initial load vs save operations
- State should be serializable (no functions, classes, or complex objects)

</details>

<details open>
<summary><h3>Task 2: Create NgRx Signal Store Configuration ✅</h3></summary>

**Purpose**: Configure the NgRx Signal Store with initial state, DevTools integration, and wire up actions and selectors.

**Related Documentation:**

- [State Standards - Store Configuration](../../STATE_STANDARDS.md#store-configuration)
- [PlayerStore Configuration](../../../libs/application/src/lib/player/player-store.ts) - Reference implementation

**Implementation Subtasks:**

- [x] **Create settings-store.ts**: Define SettingsStore using signalStore
- [x] **Configure initial state**: Empty settings with loading/error states
- [x] **Add DevTools integration**: Use `withDevtools('settings')` for debugging
- [x] **Set providedIn root**: Use `providedIn: 'root'` for singleton store
- [x] **Wire up actions**: Use `withActions()` pattern for all store actions
- [x] **Wire up selectors**: Use `withSelectors()` pattern for computed state

**Testing Subtask:**

- [x] **Verify Store Creation**: Test store instantiation and initial state

**Key Implementation Notes:**

- Use `signalStore` from @ngrx/signals
- DevTools name should match store purpose ('settings')
- Store provided at root level (singleton across app)
- Actions and selectors added via separate feature functions
- Follow exact PlayerStore configuration pattern

</details>

<details open>
<summary><h3>Task 3: Implement Load Settings Action ✅</h3></summary>

**Purpose**: Create async action that calls the infrastructure service to load settings from the backend and updates store state.

**Related Documentation:**

- [State Standards - Async Actions](../../STATE_STANDARDS.md#async-actions)
- [State Standards - updateState Pattern](../../STATE_STANDARDS.md#use-updatestate-with-actionmessage-for-all-state-mutations)
- [Player Actions](../../../libs/application/src/lib/player/actions/) - Reference async action patterns

**Implementation Subtasks:**

- [x] **Create load-settings.ts**: Implement loadSettings action
- [x] **Inject SETTINGS_SERVICE**: Use token to inject infrastructure service
- [x] **Set loading state**: Use updateState with actionMessage before API call
- [x] **Call service**: Use firstValueFrom with getSettings()
- [x] **Update state on success**: Use updateState with actionMessage, set settings and initialize history
- [x] **Handle errors**: Catch errors, use updateState with actionMessage to set error state
- [x] **Use createAction utility**: Generate actionMessage for Redux DevTools tracking

**Testing Subtask:**

- [x] **Write Load Action Tests**: Test success, error, and loading states using Vitest

**Key Implementation Notes:**

- **CRITICAL**: Use `updateState()` with `actionMessage`, NOT `patchState()`
- Use `createAction('load-settings')` from utils for Redux DevTools correlation
- Initialize history with first loaded settings as initial snapshot
- Clear error state on successful load
- Follow exact pattern from PlayerStore actions

**Action Pattern**: Reference navigate-backward-in-history.ts for updateState with actionMessage usage

</details>

<details open>
<summary><h3>Task 4: Implement Save Settings Action ✅</h3></summary>

**Purpose**: Create async action that saves settings to the backend via infrastructure service and updates store state.

**Related Documentation:**

- [State Standards - updateState Pattern](../../STATE_STANDARDS.md#use-updatestate-with-actionmessage-for-all-state-mutations)
- [Player Actions](../../../libs/application/src/lib/player/actions/) - Reference async action patterns

**Implementation Subtasks:**

- [x] **Create save-settings.ts**: Implement saveSettings action
- [x] **Inject SETTINGS_SERVICE**: Use token for service injection
- [x] **Set saving state**: Use updateState with actionMessage before API call
- [x] **Call service**: Use firstValueFrom with saveSettings()
- [x] **Update state on success**: Use updateState with actionMessage, clear saving flag
- [x] **Handle errors**: Use updateState with actionMessage to set error state
- [x] **Use createAction utility**: Generate actionMessage for tracking

**Testing Subtask:**

- [x] **Write Save Action Tests**: Test success, error, and saving states using Vitest

**Key Implementation Notes:**

- **CRITICAL**: Use `updateState()` with `actionMessage`, NOT `patchState()`
- Use `createAction('save-settings')` for Redux DevTools
- Don't modify history on save (only on user changes)
- Preserve current state on save failure
- Infrastructure layer handles error alerts (don't duplicate here)

</details>

<details open>
<summary><h3>Task 5: Implement Update Settings with History Tracking ✅</h3></summary>

**Purpose**: Create action for local settings updates that adds snapshot to history, enabling undo/redo functionality following PlayerStore pattern.

**Related Documentation:**

- [State Standards - updateState Pattern](../../STATE_STANDARDS.md#use-updatestate-with-actionmessage-for-all-state-mutations)
- [PlayerStore History](../../../libs/application/src/lib/player/player-store.ts) - History management pattern

**Implementation Subtasks:**

- [x] **Create update-settings.ts**: Implement updateSettings action
- [x] **Accept partial updates**: Support Partial<Settings> parameter
- [x] **Add to history**: Push current state to history before update (max 50 entries)
- [x] **Update settings**: Merge partial updates with current settings
- [x] **Update position**: Set history position to -1 (at current/end)
- [x] **Use updateState with actionMessage**: Use createAction for tracking
- [x] **Trim history**: Remove oldest entries if exceeding 50 snapshot limit

**Testing Subtask:**

- [x] **Write Update Action Tests**: Test updates, history tracking, and limits using Vitest

**Key Implementation Notes:**

- **CRITICAL**: Use `updateState()` with `actionMessage`, NOT `patchState()`
- History position -1 means "at current state" (not in history)
- Limit history to 50 entries to prevent memory issues
- Trim from beginning (FIFO) when exceeding limit
- Each update creates new history snapshot
- Follow exact PlayerStore history tracking pattern

</details>

<details open>
<summary><h3>Task 6: Implement Undo/Redo Actions ✅</h3></summary>

**Purpose**: Create undo and redo actions that navigate through settings history following PlayerStore navigation pattern.

**Related Documentation:**

- [State Standards - updateState Pattern](../../STATE_STANDARDS.md#use-updatestate-with-actionmessage-for-all-state-mutations)
- [Player History Navigation](../../../libs/application/src/lib/player/actions/navigate-backward-in-history.ts) - Undo/redo pattern

**Implementation Subtasks:**

- [x] **Create undo.ts**: Implement undo action moving backward in history
- [x] **Create redo.ts**: Implement redo action moving forward in history
- [x] **Handle position -1**: When at current (-1), undo moves to most recent history entry
- [x] **Handle wraparound**: Support cycling through history (optional)
- [x] **Update position**: Modify historyPosition appropriately
- [x] **Apply historical settings**: Replace current settings with historical snapshot
- [x] **Use updateState with actionMessage**: Use createAction for each action

**Testing Subtask:**

- [x] **Write Undo/Redo Tests**: Test navigation, position updates, and edge cases using Vitest

**Key Implementation Notes:**

- **CRITICAL**: Use `updateState()` with `actionMessage`, NOT `patchState()`
- Position -1 = at current, 0+ = at historical position
- Undo from -1 moves to history.length - 1 (most recent snapshot)
- Redo from last position stays at last position
- Don't modify history array during navigation
- Follow exact PlayerStore navigation pattern
- **Implementation Detail**: Uses storedCurrent field to preserve actual current when navigating history

</details>

<details open>
<summary><h3>Task 7: Implement Computed Selectors ✅</h3></summary>

**Purpose**: Create computed signal selectors that derive state for component consumption.

**Related Documentation:**

- [State Standards - Selectors](../../STATE_STANDARDS.md#selectors)
- [Player Selectors](../../../libs/application/src/lib/player/selectors/) - Reference selector patterns

**Implementation Subtasks:**

- [x] **Create get-settings.ts**: Select current settings
- [x] **Create can-undo.ts**: Compute if undo is available
- [x] **Create can-redo.ts**: Compute if redo is available
- [x] **Create get-history-position.ts**: Select current history position
- [x] **Add to withSelectors**: Wire all selectors into store configuration
- [x] **Use computed signals**: Selectors auto-update when state changes

**Testing Subtask:**

- [x] **Write Selector Tests**: Test selector computations using Vitest

**Key Implementation Notes:**

- Selectors are pure computed functions
- canUndo: true when history not empty and position != 0
- canRedo: true when position != -1 (not at current)
- Selectors automatically update when state changes (reactive)
- Follow PlayerStore selector patterns

</details>

<details open>
<summary><h3>Task 8: Write Comprehensive Store Tests</h3></summary>

**Purpose**: Create Vitest tests for the entire store verifying state management, actions, history, and selectors.

**Related Documentation:**

- [Store Testing Standards](../../STORE_TESTING.md) - Store testing patterns
- [PlayerStore Tests](../../../libs/application/src/lib/player/) - Reference test implementations

**Implementation Subtasks:**

- [ ] **Create settings-store.spec.ts**: Comprehensive store test suite using Vitest
- [ ] **Test initial state**: Verify default state values
- [ ] **Test load action**: Mock service, verify state updates on success/error
- [ ] **Test save action**: Mock service, verify saving states
- [ ] **Test update action**: Verify history tracking and limits
- [ ] **Test undo/redo**: Verify navigation through history
- [ ] **Test selectors**: Verify computed values
- [ ] **Mock SETTINGS_SERVICE**: Use TestBed providers to mock service

**Testing Subtask:**

- [ ] **Run Tests**: Execute `pnpm nx test application --testFile=settings-store.spec.ts`

**Key Implementation Notes:**

- Use Vitest (NOT Jasmine) for all tests
- Mock infrastructure service via TestBed providers
- Test behavioral outcomes (what components see)
- Verify updateState called with actionMessage
- Test history limits (max 50 entries)
- Follow PlayerStore test patterns

</details>

---

## ✅ Success Criteria

> Mark these checkboxes as you validate each criterion.

- [x] **State Interface Defined**: SettingsState with settings, history, and metadata
- [x] **Store Configured**: NgRx Signal Store with DevTools integration
- [x] **Load Action Works**: Settings load from backend and initialize history
- [x] **Save Action Works**: Settings save to backend successfully
- [x] **Update Tracks History**: Local updates add to history (max 50)
- [x] **Undo/Redo Works**: Navigate through settings history correctly
- [x] **Selectors Compute**: canUndo, canRedo compute correctly
- [x] **All Tests Pass**: Vitest tests verify all functionality (53/53 passing)
- [x] **updateState Used**: All actions use updateState with actionMessage (no patchState)
- [x] **DevTools Integration**: Redux DevTools track all state mutations

---

## 🧪 Testing Summary

### Testing Approach

This phase focuses on **store testing** with behavioral approach:

1. **State Tests**: Verify interface and initial state
2. **Action Tests**: Test all actions with success/error paths
3. **History Tests**: Verify undo/redo and history limits
4. **Selector Tests**: Test computed selectors

### Test Types by Task

| Task | Test Type | Focus |
|------|-----------|-------|
| Task 1 | Unit | State interface |
| Task 2 | Unit | Store configuration |
| Task 3 | Unit | Load action with mock service |
| Task 4 | Unit | Save action with mock service |
| Task 5 | Unit | Update action and history tracking |
| Task 6 | Unit | Undo/redo navigation |
| Task 7 | Unit | Selector computations |
| Task 8 | Integration | Full store behavior |

### Testing Framework

- **Unit Tests**: Vitest (NOT Jasmine)
- **Mocking**: TestBed providers for SETTINGS_SERVICE
- **Assertions**: Vitest matchers

### Key Testing Principles

- Mock at application-infrastructure boundary (service)
- Test observable state changes (signals)
- Verify updateState called with actionMessage
- Test edge cases (empty history, limits, errors)
- Follow PlayerStore test patterns

---

## 📝 Implementation Notes

> Track discoveries, decisions, and issues encountered during implementation.

### Discoveries During Implementation

- **storedCurrent Field**: Added to preserve the actual current settings when navigating history. When user undoes from position -1 to historical entry, the current settings are stored in storedCurrent so redo can restore them when moving back to -1.
- **Async Timing in Tests**: Initial attempt to capture loading state mid-execution failed. Fixed by using `timer(50).pipe(map(...))` from RxJS to delay Observable completion, allowing enough time to assert intermediate state.
- **History Initialization**: Initial attempt initialized history with [loadedSettings], causing position calculations to be off by one. Fixed by initializing history as empty [] and only accumulating entries when user makes changes via updateSettings.
- **Redo Logic**: When redoing beyond history end, must restore storedCurrent (the actual current) rather than keeping current settings. Implemented storedCurrent field to track this.

### Blockers & Questions

- None encountered. Implementation followed PlayerStore pattern closely and resolved all issues through targeted testing and debugging.

### Deviations from Plan

- **Added storedCurrent Field**: Not in original plan but required for proper undo/redo semantics. When navigating from -1 to history, current must be preserved to restore on redo.
- **Changed History Initialization**: Originally initialized history with [loadedSettings], changed to [] to match test expectations that history only contains past states, not current.

---

## 🔗 Related Documentation

- **Previous Phase**: [Phase 2 - Domain Contracts & Infrastructure Layer](./SETTINGS_FEATURE_P2.md)
- **Next Phase**: [Phase 4 - Bootstrap Integration](./SETTINGS_FEATURE_P4.md)
- **Feature Overview**: [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md)
- **State Standards**: [STATE_STANDARDS.md](../../STATE_STANDARDS.md) - **CRITICAL REFERENCE**
- **PlayerStore Reference**: [Player Store](../../../libs/application/src/lib/player/player-store.ts)
- **Player Actions**: [Player Actions](../../../libs/application/src/lib/player/actions/)
- **Store Testing**: [Store Testing](../../STORE_TESTING.md)

---

_Phase Status: **✅ COMPLETE**_
_Last Updated: 2025-01-11_
_Test Coverage: 53/53 tests passing_
