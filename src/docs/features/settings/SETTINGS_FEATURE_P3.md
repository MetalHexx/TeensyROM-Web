# Phase 3: Settings Application Layer - State Management with NgRx Signal Store

## 🎯 Objective

Implement the application layer for settings management using NgRx Signal Store with async/await patterns. This phase creates the reactive state management foundation that components will consume, including loading states, error handling, optimistic updates, and settings persistence coordination.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [SETTINGS_FEATURE_P1](./SETTINGS_FEATURE_P1.md) - Backend foundation providing settings API
- [ ] [SETTINGS_FEATURE_P2](./SETTINGS_FEATURE_P2.md) - Infrastructure service integration

**Standards & Guidelines:**

- [ ] [State Standards](../../STATE_STANDARDS.md) - NgRx Signal Store patterns with async/await - **CRITICAL**
- [ ] [Store Testing](../../STORE_TESTING.md) - Store unit testing methodology
- [ ] [Logging Standards](../../LOGGING_STANDARDS.md) - Operational logging for state operations

**Reference Implementations:**

- [ ] `libs/application/src/lib/storage/storage-store.ts` - StorageStore as reference pattern
- [ ] `libs/application/src/lib/storage/actions/` - Action implementation patterns
- [ ] `libs/application/src/lib/storage/selectors/` - Selector implementation patterns
- [ ] `libs/application/src/lib/storage/storage-helpers.ts` - Helper function patterns

---

## 📂 File Structure Overview

```
libs/application/src/lib/settings/
├── settings-store.ts                                             ✨ New - Main store with state and custom features
├── actions/
│   ├── index.ts                                                  ✨ New - withSettingsActions() custom feature
│   ├── load-settings.ts                                          ✨ New - Load settings from server
│   ├── save-settings.ts                                          ✨ New - Persist settings changes
│   ├── update-connection-settings.ts                             ✨ New - Update connection config
│   ├── update-player-settings.ts                                 ✨ New - Update player preferences
│   ├── update-search-settings.ts                                 ✨ New - Update search config
│   └── reset-to-defaults.ts                                      ✨ New - Reset all settings
├── selectors/
│   ├── index.ts                                                  ✨ New - withSettingsSelectors() custom feature
│   ├── get-connection-settings.ts                                ✨ New - Get connection config
│   ├── get-player-settings.ts                                    ✨ New - Get player preferences
│   ├── get-search-settings.ts                                    ✨ New - Get search config
│   ├── get-is-first-time-setup.ts                                ✨ New - Check first time setup flag
│   └── get-has-unsaved-changes.ts                                ✨ New - Detect pending changes
├── settings-helpers.ts                                           ✨ New - Helper functions for state mutations
├── settings-store.spec.ts                                        ✨ New - Store unit tests
└── index.ts                                                      ✨ New - Barrel export

libs/application/src/
└── index.ts                                                      📝 Modified - Export settings store
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>Task 1: Define Settings State Structure</h3></summary>

**Purpose**: Create the state interface and initial state following NgRx Signal Store patterns with proper typing for reactive updates.

**Related Documentation:**
- [State Standards - State Type Definitions](../../STATE_STANDARDS.md#state-type-definitions) - State structure patterns
- [StorageStore Reference](../../../libs/application/src/lib/storage/storage-store.ts) - State organization example

**Implementation Subtasks:**

- [ ] **Define `SettingsState` interface** in `settings-store.ts`:
  - `settings: TeensySettings | null` - Current loaded settings
  - `isDirty: boolean` - Has unsaved changes
  - `isLoading: boolean` - Loading operation in progress
  - `isLoaded: boolean` - Settings loaded at least once
  - `isSaving: boolean` - Save operation in progress
  - `error: string | null` - Error message from failed operation
  - `lastLoadTime: number | null` - Timestamp of last successful load
  - `lastSaveTime: number | null` - Timestamp of last successful save
- [ ] **Define `initialState` constant**: Set sensible defaults for all properties
  - `settings: null` - No settings loaded initially
  - `isDirty: false`, `isLoading: false`, `isLoaded: false`, `isSaving: false`
  - `error: null`, `lastLoadTime: null`, `lastSaveTime: null`
- [ ] **Create `SettingsStore` skeleton**: Use `signalStore()` with `withDevtools()`, `withState()`
  - Include placeholder custom features: `withSettingsSelectors()`, `withSettingsActions()`
  - Add `{ providedIn: 'root' }` for singleton behavior
  - Name devtools as `'settingsStore'`

**Testing Subtask:**

- [ ] **Verify State Structure**: Confirm state interface compiles and store initializes

**Key Implementation Notes:**

- State is **single-level** - no nested device contexts like PlayerStore (settings are global)
- Use `null` for uninitialized settings to distinguish from default values
- `isDirty` flag tracks when local changes differ from server (for save button state)
- Separate `isLoading` and `isSaving` for distinct UI feedback
- Follow [State Structure Organization](../../STATE_STANDARDS.md#state-structure-organization) patterns

**Critical Type Definition**:

```typescript
import { TeensySettings } from '@teensyrom-nx/domain';

export interface SettingsState {
  settings: TeensySettings | null;
  isDirty: boolean;
  isLoading: boolean;
  isLoaded: boolean;
  isSaving: boolean;
  error: string | null;
  lastLoadTime: number | null;
  lastSaveTime: number | null;
}

const initialState: SettingsState = {
  settings: null,
  isDirty: false,
  isLoading: false,
  isLoaded: false,
  isSaving: false,
  error: null,
  lastLoadTime: null,
  lastSaveTime: null,
};

export const SettingsStore = signalStore(
  { providedIn: 'root' },
  withDevtools('settingsStore'),
  withState(initialState),
  withSettingsSelectors(),
  withSettingsActions()
);
```

</details>

---

<details open>
<summary><h3>Task 2: Create Helper Functions for State Mutations</h3></summary>

**Purpose**: Implement reusable helper functions following [State Mutation Helpers](../../STATE_STANDARDS.md#state-mutation-helpers) pattern to reduce duplication in actions.

**Related Documentation:**
- [State Standards - Helper Utilities](../../STATE_STANDARDS.md#helper-utilities) - Helper function patterns
- [storage-helpers.ts](../../../libs/application/src/lib/storage/storage-helpers.ts) - Helper examples

**Implementation Subtasks:**

- [ ] **Create `settings-helpers.ts`** with helper functions:
  - `setLoadingSettings(store, actionMessage)` - Set `isLoading: true`, clear error
  - `setSettingsLoaded(store, settings, actionMessage)` - Set loaded state with settings and timestamp
  - `setSavingSettings(store, actionMessage)` - Set `isSaving: true`, keep settings visible
  - `setSettingsSaved(store, settings, actionMessage)` - Set saved state, clear dirty flag, update timestamp
  - `setSettingsError(store, errorMessage, actionMessage)` - Set error state, clear loading flags
  - `markSettingsDirty(store, actionMessage)` - Set `isDirty: true` for unsaved changes
  - `updateSettingsPartial(store, partial, actionMessage)` - Update settings with partial object
- [ ] **Define `WritableStore<SettingsState>` type helper**: For consistent typing across helpers
- [ ] **Add JSDoc documentation**: Explain each helper's purpose and parameters
- [ ] **Export all helpers**: For use in action functions

**Testing Subtask:**

- [ ] **Unit Test Helpers**: Test each helper function in isolation (optional - primarily tested via action tests)

**Key Implementation Notes:**

- **CRITICAL**: ALL helper functions MUST accept `actionMessage` as final parameter (see [State Standards](../../STATE_STANDARDS.md#use-updatestate-with-actionmessage-for-all-state-mutations))
- Use `updateState()` from `@angular-architects/ngrx-toolkit`, NOT `patchState()` from `@ngrx/signals`
- Helpers are pure functions - no side effects, just state mutations
- Keep helpers focused - one responsibility per function
- Use TypeScript for type safety on state updates

**Helper Function Pattern**:

```typescript
import { updateState } from '@angular-architects/ngrx-toolkit';
import { WritableStore } from './path-to-type-helper';
import { SettingsState } from './settings-store';
import { TeensySettings } from '@teensyrom-nx/domain';

export function setLoadingSettings(
  store: WritableStore<SettingsState>,
  actionMessage: string
): void {
  updateState(store, actionMessage, (state) => ({
    isLoading: true,
    error: null,
  }));
}

export function setSettingsLoaded(
  store: WritableStore<SettingsState>,
  settings: TeensySettings,
  actionMessage: string
): void {
  updateState(store, actionMessage, (state) => ({
    settings,
    isLoading: false,
    isLoaded: true,
    error: null,
    lastLoadTime: Date.now(),
    isDirty: false, // Fresh from server
  }));
}
```

</details>

---

<details open>
<summary><h3>Task 3: Implement Settings Selectors</h3></summary>

**Purpose**: Create computed signals that derive state for component consumption following [Selectors vs Actions Distinction](../../STATE_STANDARDS.md#selectors-vs-actions-distinction).

**Related Documentation:**
- [State Standards - Computed Signals](../../STATE_STANDARDS.md#computed-signals) - Selector patterns
- [storage selectors](../../../libs/application/src/lib/storage/selectors/) - Selector examples

**Implementation Subtasks:**

- [ ] **Create selector functions** (one file per selector):
  - `get-connection-settings.ts` - Extract connection settings or null
  - `get-player-settings.ts` - Extract player settings or null
  - `get-search-settings.ts` - Extract search settings or null
  - `get-file-transfer-settings.ts` - Extract file transfer settings or null
  - `get-app-settings.ts` - Extract app settings or null
  - `get-is-first-time-setup.ts` - Check `appSettings.firstTimeSetup` flag
  - `get-has-unsaved-changes.ts` - Return `isDirty` signal
  - `get-is-loading.ts` - Combine `isLoading` and `isSaving` for unified loading state
- [ ] **Implement `withSettingsSelectors()` custom feature** in `selectors/index.ts`:
  - Import all selector functions
  - Use `withMethods()` to expose computed signals
  - Cast store as `WritableStore<SettingsState>`
  - Return object spreading all selector functions
- [ ] **Export selectors barrel**: Add exports to `selectors/index.ts`

**Testing Subtask:**

- [ ] **Test Selectors**: Verify computed signals update correctly when state changes (tested via store tests)

**Key Implementation Notes:**

- Selectors return `computed()` signals - **read-only**, no state mutations
- Selectors should be **pure** - no side effects, just derivations
- Use `null` checks when accessing nested settings objects
- Follow [Derived State with Selectors](../../STATE_STANDARDS.md#derived-state-with-selectors) patterns
- Each selector file exports one function returning object with one computed property

**Selector Pattern Example**:

```typescript
import { computed } from '@angular/core';
import { WritableStore } from '../settings-helpers';
import { SettingsState } from '../settings-store';
import { ConnectionSettings } from '@teensyrom-nx/domain';

export function getConnectionSettings(store: WritableStore<SettingsState>) {
  return {
    connectionSettings: computed((): ConnectionSettings | null => {
      const settings = store.settings();
      return settings?.connection ?? null;
    }),
  };
}
```

</details>

---

<details open>
<summary><h3>Task 4: Implement Settings Actions with TDD</h3></summary>

**Purpose**: Create async actions for loading, saving, and updating settings following [Action Behaviors](../../STATE_STANDARDS.md#ngrx-signal-store-method-patterns) with TDD approach.

**Related Documentation:**
- [State Standards - Actions Pattern](../../STATE_STANDARDS.md#selectors-vs-actions-distinction) - Action implementation
- [storage actions](../../../libs/application/src/lib/storage/actions/) - Action examples
- [Action Message Tracking](../../STATE_STANDARDS.md#action-message-tracking) - Redux DevTools correlation

**Implementation Focus**: State-changing async operations with proper error handling, logging, and Redux DevTools tracking.

**Behaviors Being Built**:

- Load settings from server and update store state
- Save settings to server with optimistic/pessimistic update strategies
- Update individual settings sections without full reload
- Reset settings to defaults
- Handle errors gracefully without corrupting state
- Track operations in Redux DevTools with action messages

#### Step 4A: Write Failing Tests

- [ ] **Create `settings-store.spec.ts`**: Set up test infrastructure with Vitest
- [ ] **Test: loadSettings() Success**: Verify settings loaded from service and state updated
- [ ] **Test: loadSettings() Error**: Verify errors handled, state not corrupted
- [ ] **Test: saveSettings() Success**: Verify settings saved and state updated with new timestamps
- [ ] **Test: saveSettings() Error**: Verify errors handled, isDirty flag preserved
- [ ] **Test: updateConnectionSettings()**: Verify partial update marks dirty and updates settings
- [ ] **Test: updatePlayerSettings()**: Verify partial update for player section
- [ ] **Test: resetToDefaults()**: Verify reset loads defaults and saves to server
- [ ] **Test: Action Message Tracking**: Verify all state mutations use same actionMessage (Redux DevTools)
- [ ] Verify tests fail (red phase)

#### Step 4B: Implement Actions to Pass Tests

- [ ] **Create action function files** (one per action):
  - `load-settings.ts` - Load settings from service
  - `save-settings.ts` - Persist current settings to service
  - `update-connection-settings.ts` - Update connection section
  - `update-player-settings.ts` - Update player section
  - `update-search-settings.ts` - Update search section
  - `update-file-transfer-settings.ts` - Update file transfer section
  - `reset-to-defaults.ts` - Reset all settings to defaults
- [ ] **Implement each action following pattern**:
  - Create action message: `const actionMessage = createAction('action-name')`
  - Use helper functions with actionMessage for all state mutations
  - Add logging: `LogType.Start`, `LogType.NetworkRequest`, `LogType.Success`, `LogType.Finish`
  - Use `firstValueFrom()` to convert service Observables to Promises
  - Handle errors with `try/catch` and error helper
  - Return `Promise<void>` for all actions
- [ ] **Implement `withSettingsActions()` custom feature** in `actions/index.ts`:
  - Import all action functions
  - Inject `ISettingsService` with `inject(SETTINGS_SERVICE)`
  - Use `withMethods()` to expose async methods
  - Cast store as `WritableStore<SettingsState>`
  - Return object spreading all action functions
- [ ] **Export actions barrel**: Add exports to `actions/index.ts`
- [ ] Verify tests pass (green phase)

**Testing Subtask:**

- [ ] **Run Store Tests**: Execute `npx nx test application` and verify all pass
- [ ] **Coverage Check**: Ensure >90% coverage on store actions and state logic

**Key Implementation Notes:**

- **CRITICAL**: All actions MUST create `actionMessage` at start and pass to ALL helper functions
- Actions are **async/await** - return `Promise<void>`, not Observables
- Use `updateState()` with `actionMessage` for Redux DevTools correlation
- Actions coordinate infrastructure service calls with state updates
- Follow [Method Implementation Patterns](../../STATE_STANDARDS.md#method-implementation-patterns)
- One action = one file for maintainability

**Action Pattern Example**:

```typescript
import { updateState } from '@angular-architects/ngrx-toolkit';
import { WritableStore } from '../settings-helpers';
import { SettingsState } from '../settings-store';
import { ISettingsService } from '@teensyrom-nx/domain';
import { firstValueFrom } from 'rxjs';
import { createAction, LogType, logInfo, logError } from '@teensyrom-nx/utils';
import { setLoadingSettings, setSettingsLoaded, setSettingsError } from '../settings-helpers';

export function loadSettings(
  store: WritableStore<SettingsState>,
  settingsService: ISettingsService
) {
  return {
    loadSettings: async (): Promise<void> => {
      const actionMessage = createAction('load-settings');
      
      logInfo(LogType.Start, 'Loading settings from server');
      setLoadingSettings(store, actionMessage);

      try {
        logInfo(LogType.NetworkRequest, 'Fetching settings from API');
        const settings = await firstValueFrom(settingsService.getSettings());
        
        logInfo(LogType.Success, 'Settings loaded successfully');
        setSettingsLoaded(store, settings, actionMessage);
        logInfo(LogType.Finish, 'Load settings completed');
      } catch (error) {
        logError('Failed to load settings:', error);
        setSettingsError(
          store,
          (error as any)?.message || 'Failed to load settings',
          actionMessage
        );
      }
    },
  };
}
```

**Behaviors to Test:**

- [ ] Settings load successfully and populate store
- [ ] Save operation persists changes and updates timestamps
- [ ] Partial updates mark settings as dirty
- [ ] Errors don't corrupt existing valid state
- [ ] Loading flags clear appropriately on success/error
- [ ] Action messages correlate multiple state mutations in Redux DevTools
- [ ] Logging occurs at all operation lifecycle points

</details>

---

<details open>
<summary><h3>Task 5: Store Integration Testing</h3></summary>

**Purpose**: Create comprehensive integration tests that validate the full store behavior including state transitions, error handling, and coordination with infrastructure service.

**Related Documentation:**
- [Store Testing](../../STORE_TESTING.md) - Store testing methodology
- [storage-store.spec.ts](../../../libs/application/src/lib/storage/storage-store.spec.ts) - Test examples

**Implementation Subtasks:**

- [ ] **Set up test infrastructure**:
  - Mock `ISettingsService` with `vi.fn()` for all methods
  - Configure TestBed with mocked service provider
  - Create test helper functions for common assertions
- [ ] **Test: Initial State**: Verify store initializes with correct defaults
- [ ] **Test: Load Settings Workflow**: Mock successful load, verify state transitions
- [ ] **Test: Save Settings Workflow**: Mock successful save, verify timestamps and dirty flag
- [ ] **Test: Partial Update Workflow**: Update one section, verify others unchanged, dirty flag set
- [ ] **Test: Error Recovery**: Trigger error, verify state consistency, retry succeeds
- [ ] **Test: Concurrent Operations**: Start load, start save, verify proper coordination
- [ ] **Test: Reset to Defaults**: Verify reset clears dirty flag and persists
- [ ] **Test: Selector Reactivity**: Verify computed signals update when state changes
- [ ] **Test: Action Message Correlation**: Verify related mutations show same action ID in DevTools

**Testing Subtask:**

- [ ] **Run All Tests**: Execute test suite and verify 100% pass rate
- [ ] **Coverage Report**: Verify >95% coverage on store, actions, selectors, helpers

**Key Implementation Notes:**

- Mock service returns realistic `TeensySettings` objects
- Use Vitest's `vi.fn()` for service mocking
- Test state transitions, not implementation details
- Verify error handling doesn't leave store in inconsistent state
- Follow [Store Testing](../../STORE_TESTING.md) patterns for comprehensive coverage

**Behaviors to Test:**

- [ ] Store starts with clean initial state
- [ ] Load populates settings and sets loaded flag
- [ ] Save persists changes and clears dirty flag
- [ ] Partial updates only modify specified section
- [ ] Errors set error message without corrupting settings
- [ ] Multiple operations coordinate correctly (don't race)
- [ ] Selectors derive correct values from state
- [ ] Action messages enable Redux DevTools correlation

</details>

---

## ✅ Success Criteria

> **Mark checkboxes as criteria are met**. All items must be checked before phase is complete.

**Functional Requirements:**

- [ ] All implementation tasks completed and checked off
- [ ] All subtasks within each task completed
- [ ] Code follows [State Standards](../../STATE_STANDARDS.md) patterns
- [ ] State structure defined with proper TypeScript interfaces
- [ ] Helper functions reduce duplication in actions
- [ ] Selectors provide reactive computed signals for components
- [ ] Actions handle all settings operations (load, save, update, reset)

**Testing Requirements:**

- [ ] All testing subtasks completed within each task
- [ ] TDD approach: tests written before implementation
- [ ] Unit tests cover all actions, selectors, and helpers
- [ ] Integration tests validate full store behavior
- [ ] All tests passing with no failures
- [ ] Test coverage >95% for store implementation

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes with no errors (`pnpm nx lint application`)
- [ ] Store properly registered as singleton in Angular DI
- [ ] Redux DevTools integration working correctly
- [ ] Action messages correlate state mutations for debugging

**Documentation:**

- [ ] Inline code comments added for complex state logic
- [ ] JSDoc documentation complete for public store methods
- [ ] Helper functions documented with purpose and parameters

**Ready for Next Phase:**

- [ ] All success criteria met
- [ ] No known bugs or issues
- [ ] Store tested and stable for UI component consumption (Phase 4)
- [ ] Application layer ready for feature integration

---

## 📝 Notes & Considerations

### Design Decisions

- **Global State**: Settings are application-level, not device-specific (unlike PlayerStore)
- **Dirty Tracking**: `isDirty` flag enables save button state and unsaved changes warning
- **Separate Loading Flags**: `isLoading` vs `isSaving` for distinct UI feedback
- **Async/Await Pattern**: Follows [State Standards](../../STATE_STANDARDS.md) for deterministic execution
- **Action Message Pattern**: Enables Redux DevTools correlation of related state mutations

### Implementation Constraints

- **Signal Store**: Uses NgRx Signal Store with custom features (not traditional NgRx actions/reducers)
- **RxJS Integration**: Service returns Observables, converted to Promises with `firstValueFrom()`
- **No Caching**: Settings loaded fresh each time - no stale data concerns
- **Single Settings Instance**: No multi-user or multi-device settings isolation needed

### Future Enhancements

- **Optimistic Updates**: Apply changes locally before server confirms
- **Undo/Redo**: Track settings history for undo functionality
- **Settings Comparison**: Show diff between current and saved settings
- **Auto-Save**: Debounced auto-save after changes with dirty flag
- **Settings Presets**: Save/load named settings configurations

### External References

- [NgRx Signal Store](https://ngrx.io/guide/signals/signal-store) - Signal Store documentation
- [@angular-architects/ngrx-toolkit](https://www.npmjs.com/package/@angular-architects/ngrx-toolkit) - updateState function
- [Redux DevTools Extension](https://github.com/reduxjs/redux-devtools) - DevTools integration

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

- State mutation patterns that work well or need adjustment
- Redux DevTools correlation effectiveness
- Error handling edge cases
- Testing challenges or insights

---

## 💡 Agent Implementation Guide

> **Instructions for AI agents implementing this phase**

### Prerequisites

- Phase 2 (Infrastructure) must be complete with working SettingsService
- Understand NgRx Signal Store with custom features pattern
- Familiarize with async/await patterns from [State Standards](../../STATE_STANDARDS.md)
- Review StorageStore reference implementation

### Key Patterns to Follow

1. **State Structure**:
   - Single-level state (no nested device contexts)
   - Loading/saving flags for UI feedback
   - Dirty flag for unsaved changes tracking
   - Timestamps for cache awareness

2. **Helper Functions**:
   - Accept `actionMessage` as final parameter (CRITICAL)
   - Use `updateState()`, not `patchState()`
   - Pure functions with no side effects
   - One responsibility per helper

3. **Selectors**:
   - Return `computed()` signals
   - Read-only, no state mutations
   - Null-safe when accessing nested objects
   - One selector per file

4. **Actions**:
   - Create `actionMessage` at start
   - Pass `actionMessage` to ALL helpers
   - Use async/await with `firstValueFrom()`
   - Add comprehensive logging
   - Handle errors gracefully
   - One action per file

5. **Custom Features**:
   - `withSettingsSelectors()` - computed signals
   - `withSettingsActions()` - async methods
   - Use `withMethods()` for both
   - Cast store as `WritableStore<SettingsState>`

### TDD Workflow

1. Write failing test for action behavior
2. Implement action with helper functions
3. Run test - verify it passes
4. Refactor if needed
5. Repeat for next action

### Common Pitfalls to Avoid

- Don't use `patchState()` - use `updateState()` with actionMessage
- Don't skip action message - breaks Redux DevTools correlation
- Don't add logic to selectors - keep them pure derivations
- Don't forget error handling - actions must not throw unhandled
- Don't skip logging - operational visibility is critical
- Don't test implementation details - test behaviors

### Testing Strategy

- Unit tests: Test each action in isolation with mocked service
- Integration tests: Test full store with realistic workflows
- Coverage: >95% on store, actions, selectors, helpers
- Verify: Action messages correlate state mutations in DevTools

---

_Last Updated: 2025-11-10_
_Phase Author: Coding Agent_
_Status: Ready for Implementation_
