# Phase 3: Settings Store (Application Layer)

## 🎯 Objective

Implement the NgRx Signal Store for settings management in the application layer. This store provides reactive state management for settings with actions for loading, saving, updating, and managing undo/redo history. The store depends on the domain service contract (via injection token) and exposes computed signals for UI consumption. This phase establishes the core state management foundation that will be used by UI components (Phase 5-8) and bootstrap services (Phase 4).

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md) - High-level feature overview
- [ ] [Phase 2 Completion](./SETTINGS_FEATURE_P2.md) - Domain contracts and infrastructure (prerequisite)

**Standards & Guidelines:**

- [ ] [State Standards](../../STATE_STANDARDS.md) - NgRx Signal Store patterns and architecture
- [ ] [Coding Standards](../../CODING_STANDARDS.md) - General coding patterns
- [ ] [Store Testing Guide](../../STORE_TESTING.md) - Store testing patterns
- [ ] [Testing Standards](../../TESTING_STANDARDS.md) - Behavioral testing approach

---

## 📂 File Structure Overview

> New store files in application layer.

```
libs/application/src/lib/settings/
├── index.ts                                  ✨ New - Barrel export for settings store
├── settings.store.ts                         ✨ New - Settings store definition
├── settings.state.ts                         ✨ New - State interface definition
├── actions/
│   ├── index.ts                              ✨ New - Barrel export for actions
│   ├── load-settings.action.ts               ✨ New - Load settings from backend
│   ├── save-settings.action.ts               ✨ New - Save settings to backend
│   ├── update-player-settings.action.ts      ✨ New - Update player section
│   ├── update-file-transfer-settings.action.ts ✨ New - Update file transfer section
│   ├── update-search-settings.action.ts      ✨ New - Update search section
│   ├── update-app-settings.action.ts         ✨ New - Update app section
│   ├── undo.action.ts                        ✨ New - Undo to previous snapshot
│   ├── redo.action.ts                        ✨ New - Redo to next snapshot
│   ├── reset-to-defaults.action.ts           ✨ New - Reset all settings
│   └── clear-history.action.ts               ✨ New - Clear undo/redo history
├── selectors/
│   ├── index.ts                              ✨ New - Barrel export for selectors
│   ├── get-settings.selector.ts              ✨ New - Get current settings
│   ├── get-player-settings.selector.ts       ✨ New - Get player section
│   ├── get-file-transfer-settings.selector.ts ✨ New - Get file transfer section
│   ├── get-search-settings.selector.ts       ✨ New - Get search section
│   ├── get-app-settings.selector.ts          ✨ New - Get app section
│   ├── get-has-unsaved-changes.selector.ts   ✨ New - Check for unsaved changes
│   ├── get-can-undo.selector.ts              ✨ New - Check if undo available
│   ├── get-can-redo.selector.ts              ✨ New - Check if redo available
│   └── get-loading-state.selector.ts         ✨ New - Get loading/error state
└── helpers/
    ├── settings-defaults.ts                  ✨ New - Default settings values
    └── history-manager.ts                    ✨ New - Undo/redo history logic
```

---

<details open>
<summary><h3>Task 1: Define Store State Interface</h3></summary>

**Purpose**: Create the TypeScript interface that defines the shape of the settings store state. This includes current settings, loading/error states, and undo/redo history tracking.

**Related Documentation:**

- [State Standards - State Interface Patterns](../../STATE_STANDARDS.md#state-interface-patterns) - State structure conventions
- [Settings Feature Plan - Phase 3](./SETTINGS_FEATURE_PLAN.md#phase-3-settings-store-application-layer) - State requirements

**Implementation Subtasks:**

- [ ] **Create settings.state.ts**: New file in `libs/application/src/lib/settings/`
- [ ] **Define SettingsState interface**: Root state interface for the store
- [ ] **Add settings property**: Current `Settings` object
- [ ] **Add originalSettings property**: Last saved settings for dirty checking
- [ ] **Add isLoading property**: Boolean for loading state
- [ ] **Add error property**: Optional error message string
- [ ] **Add history property**: Array of `Settings` snapshots for undo
- [ ] **Add historyIndex property**: Current position in history array
- [ ] **Add JSDoc comments**: Document state properties and their purpose

**Testing Subtask:**

- [ ] **Write State Type Tests**: Verify state interface structure (see Testing section)

**Key Implementation Notes:**

- State should be serializable (no functions, no complex objects)
- History array stores snapshots, not individual changes (simpler than command pattern)
- `historyIndex` points to current position in history (-1 if no history)
- `originalSettings` tracks last-saved state to detect unsaved changes
- Error property stores user-friendly error messages (not exception objects)

**State Interface Pattern** (structure only):

```typescript
export interface SettingsState {
  settings: Settings;
  originalSettings: Settings;
  isLoading: boolean;
  error: string | null;
  history: Settings[];
  historyIndex: number;
}
```

**Testing Focus for Task 1:**

> Focus on **state structure** - ensure state interface is well-defined.

**Behaviors to Test:**

- [ ] State interface is exportable and usable
- [ ] All properties have correct types
- [ ] State can be instantiated with valid values
- [ ] State compiles without TypeScript errors

</details>

<details open>
<summary><h3>Task 2: Create Default Settings and Initial State</h3></summary>

**Purpose**: Define default settings values and initial state factory function. Defaults ensure the application has sensible configuration before any user customization.

**Related Documentation:**

- [State Standards - Initial State](../../STATE_STANDARDS.md#initial-state) - Initial state patterns
- [Settings Feature Plan - Default Values](./SETTINGS_FEATURE_PLAN.md#phase-3-settings-store-application-layer) - Default value specifications

**Implementation Subtasks:**

- [ ] **Create helpers/settings-defaults.ts**: New file for default values
- [ ] **Define DEFAULT_SETTINGS constant**: Complete `Settings` object with defaults
- [ ] **Define DEFAULT_STATE constant**: Initial `SettingsState` with defaults
- [ ] **Document default values**: Add JSDoc explaining default choices
- [ ] **Export constants**: Make available to store and tests

**Testing Subtask:**

- [ ] **Write Default Value Tests**: Verify defaults are valid and reasonable (see Testing section)

**Key Implementation Notes:**

- Default values should match backend defaults for consistency
- Player defaults: `repeatMode: 'Off'`, `sidTimerSeconds: 180`, `sidAutoAdvance: false`, `launchOnStartup: false`
- File transfer defaults: `watchFoldersEnabled: false`, `watchFolders: []`, `autoLaunchTransferred: false`
- Search defaults: Balanced weights, common stop words, metadata enabled, hidden files disabled
- App defaults: `setupCompleted: false`
- Initial state has no history, not loading, no error

**Default Settings Pattern** (reference only):

```typescript
export const DEFAULT_SETTINGS: Settings = {
  player: {
    repeatMode: 'Off',
    sidTimerSeconds: 180,
    sidAutoAdvance: false,
    launchOnStartup: false
  },
  // ... other sections with defaults
};

export const DEFAULT_STATE: SettingsState = {
  settings: DEFAULT_SETTINGS,
  originalSettings: DEFAULT_SETTINGS,
  isLoading: false,
  error: null,
  history: [],
  historyIndex: -1
};
```

**Testing Focus for Task 2:**

> Focus on **default values** - ensure defaults are valid and sensible.

**Behaviors to Test:**

- [ ] DEFAULT_SETTINGS is a valid Settings object
- [ ] All required properties have default values
- [ ] Default values match expected types
- [ ] DEFAULT_STATE is a valid SettingsState
- [ ] Initial state has empty history and no loading/error

</details>

<details open>
<summary><h3>Task 3: Implement History Management Helpers</h3></summary>

**Purpose**: Create pure functions for managing undo/redo history snapshots. These helpers encapsulate the logic for adding snapshots, navigating history, and managing history size limits.

**Related Documentation:**

- [State Standards - Helper Functions](../../STATE_STANDARDS.md#helper-functions) - Helper function patterns
- [Coding Standards - Pure Functions](../../CODING_STANDARDS.md#pure-functions) - Pure function conventions

**Implementation Subtasks:**

- [ ] **Create helpers/history-manager.ts**: New file for history logic
- [ ] **Define MAX_HISTORY_SIZE constant**: Limit history to 50 snapshots
- [ ] **Implement addToHistory function**: Adds new snapshot, manages size limit
- [ ] **Implement canUndo function**: Checks if undo is available
- [ ] **Implement canRedo function**: Checks if redo is available
- [ ] **Implement getUndoSettings function**: Gets settings at previous history index
- [ ] **Implement getRedoSettings function**: Gets settings at next history index
- [ ] **Add helper tests**: Test all history functions (see Testing section)

**Testing Subtask:**

- [ ] **Write History Helper Tests**: Test history navigation and limits (see Testing section)

**Key Implementation Notes:**

- History functions are pure (no state mutation, return new values)
- Adding to history when in middle of history discards future snapshots (standard undo/redo behavior)
- History size limit prevents unbounded memory growth
- History array stores deep copies to prevent accidental mutations
- Index -1 means no history, 0 means at oldest entry

**History Helper Pattern** (reference only):

```typescript
export const MAX_HISTORY_SIZE = 50;

export function addToHistory(
  history: Settings[],
  currentIndex: number,
  newSnapshot: Settings
): { history: Settings[]; index: number } {
  // Truncate future if in middle of history
  const truncated = history.slice(0, currentIndex + 1);
  // Add new snapshot
  const updated = [...truncated, newSnapshot];
  // Enforce size limit (keep newest)
  const limited = updated.slice(-MAX_HISTORY_SIZE);
  return {
    history: limited,
    index: limited.length - 1
  };
}
```

**Testing Focus for Task 3:**

> Focus on **history logic** - ensure undo/redo works correctly.

**Behaviors to Test:**

- [ ] `addToHistory` adds snapshot to end of history
- [ ] `addToHistory` truncates future snapshots when in middle
- [ ] `addToHistory` enforces max history size
- [ ] `canUndo` returns true when history index > 0
- [ ] `canUndo` returns false when history is empty or at start
- [ ] `canRedo` returns true when history index < history length - 1
- [ ] `canRedo` returns false when at end of history
- [ ] `getUndoSettings` returns previous snapshot
- [ ] `getRedoSettings` returns next snapshot
- [ ] History functions don't mutate input arrays

</details>

<details open>
<summary><h3>Task 4: Implement Load Settings Action</h3></summary>

**Purpose**: Create the action that loads settings from the backend via the domain service. This action handles loading state, success, and error scenarios.

**Related Documentation:**

- [State Standards - Action Patterns](../../STATE_STANDARDS.md#action-patterns) - Action implementation patterns
- [Store Testing Guide](../../STORE_TESTING.md) - Action testing patterns

**Implementation Subtasks:**

- [ ] **Create actions/load-settings.action.ts**: New action file
- [ ] **Define withLoadSettings feature**: Use `signalStoreFeature` pattern
- [ ] **Inject SETTINGS_SERVICE_TOKEN**: Use domain service contract
- [ ] **Implement loadSettings method**: Async action that calls service
- [ ] **Set loading state**: Set `isLoading: true` when starting
- [ ] **Update state on success**: Set settings, originalSettings, clear error, clear history
- [ ] **Update state on error**: Set error message, clear loading
- [ ] **Add action tests**: Test loading behavior (see Testing section)

**Testing Subtask:**

- [ ] **Write Load Action Tests**: Test loading, success, and error scenarios (see Testing section)

**Key Implementation Notes:**

- Use `rxMethod` for async actions (Signal Store pattern)
- Loading clears any existing error state
- Success updates both `settings` and `originalSettings` (no unsaved changes after load)
- Success clears history (fresh start after load)
- Error preserves existing settings (don't lose state on load failure)
- Use `tapResponse` for handling success/error

**Action Pattern** (structure only):

```typescript
export function withLoadSettings() {
  return signalStoreFeature(
    withMethods((store, settingsService = inject(SETTINGS_SERVICE_TOKEN)) => ({
      loadSettings: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() => settingsService.getSettings().pipe(
            tapResponse({
              next: (settings) => patchState(store, {
                settings,
                originalSettings: settings,
                isLoading: false,
                history: [],
                historyIndex: -1
              }),
              error: (error: Error) => patchState(store, {
                isLoading: false,
                error: error.message
              })
            })
          ))
        )
      )
    }))
  );
}
```

**Testing Focus for Task 4:**

> Focus on **loading behavior** - ensure action handles all scenarios correctly.

**Behaviors to Test:**

- [ ] Loading sets `isLoading: true` immediately
- [ ] Loading clears existing error state
- [ ] Success updates settings and originalSettings
- [ ] Success clears loading state
- [ ] Success clears history
- [ ] Error sets error message
- [ ] Error clears loading state
- [ ] Error preserves existing settings
- [ ] Service method called exactly once per invocation

</details>

<details open>
<summary><h3>Task 5: Implement Save Settings Action</h3></summary>

**Purpose**: Create the action that saves current settings to the backend via the domain service. This action handles save state, success, and error scenarios, and updates originalSettings on success.

**Related Documentation:**

- [State Standards - Action Patterns](../../STATE_STANDARDS.md#action-patterns) - Action implementation patterns
- [Store Testing Guide](../../STORE_TESTING.md) - Action testing patterns

**Implementation Subtasks:**

- [ ] **Create actions/save-settings.action.ts**: New action file
- [ ] **Define withSaveSettings feature**: Use `signalStoreFeature` pattern
- [ ] **Inject SETTINGS_SERVICE_TOKEN**: Use domain service contract
- [ ] **Implement saveSettings method**: Async action that calls service
- [ ] **Set loading state**: Set `isLoading: true` when starting
- [ ] **Update state on success**: Update originalSettings, clear error, clear loading
- [ ] **Update state on error**: Set error message, clear loading
- [ ] **Add action tests**: Test saving behavior (see Testing section)

**Testing Subtask:**

- [ ] **Write Save Action Tests**: Test saving, success, and error scenarios (see Testing section)

**Key Implementation Notes:**

- Saving does not modify current settings (only originalSettings on success)
- Success clears the "unsaved changes" state by syncing originalSettings
- Success does not clear history (user may want to undo after save)
- Error preserves all state (retry is possible)
- Consider debouncing if auto-save is enabled (Phase 7)

**Testing Focus for Task 5:**

> Focus on **saving behavior** - ensure action persists settings correctly.

**Behaviors to Test:**

- [ ] Saving sets `isLoading: true` immediately
- [ ] Saving clears existing error state
- [ ] Success updates originalSettings to match current settings
- [ ] Success clears loading state
- [ ] Success preserves history
- [ ] Error sets error message
- [ ] Error clears loading state
- [ ] Error preserves all settings (current and original)
- [ ] Service method called with current settings

</details>

<details open>
<summary><h3>Task 6: Implement Update Section Actions</h3></summary>

**Purpose**: Create actions for updating individual settings sections (Player, FileTransfer, Search, App). These actions record history snapshots and update the corresponding section of settings.

**Related Documentation:**

- [State Standards - Action Patterns](../../STATE_STANDARDS.md#action-patterns) - Action implementation patterns
- [Settings Feature Plan - Phase 3](./SETTINGS_FEATURE_PLAN.md#phase-3-settings-store-application-layer) - Update action requirements

**Implementation Subtasks:**

- [ ] **Create actions/update-player-settings.action.ts**: Update player section
- [ ] **Create actions/update-file-transfer-settings.action.ts**: Update file transfer section
- [ ] **Create actions/update-search-settings.action.ts**: Update search section
- [ ] **Create actions/update-app-settings.action.ts**: Update app section
- [ ] **Record history snapshot**: Before updating, add current settings to history
- [ ] **Update section**: Patch the corresponding section with new values
- [ ] **Implement partial updates**: Support updating subset of section properties
- [ ] **Add action tests**: Test update behavior for each section (see Testing section)

**Testing Subtask:**

- [ ] **Write Update Action Tests**: Test section updates and history recording (see Testing section)

**Key Implementation Notes:**

- Each update records current settings in history before modification
- Use `addToHistory` helper to manage history array
- Support partial updates (only specified properties change)
- Updates are synchronous (no backend call until save action)
- All update actions follow same pattern (consider DRY with generic function)

**Update Action Pattern** (structure only):

```typescript
export function withUpdatePlayerSettings() {
  return signalStoreFeature(
    withMethods((store) => ({
      updatePlayerSettings: (updates: Partial<PlayerSettings>) => {
        const currentSettings = store.settings();
        const { history, index } = addToHistory(
          store.history(),
          store.historyIndex(),
          currentSettings
        );
        
        patchState(store, {
          settings: {
            ...currentSettings,
            player: { ...currentSettings.player, ...updates }
          },
          history,
          historyIndex: index
        });
      }
    }))
  );
}
```

**Testing Focus for Task 6:**

> Focus on **update behavior** - ensure section updates record history correctly.

**Behaviors to Test:**

- [ ] Update action modifies only the specified section
- [ ] Update action records current settings in history before change
- [ ] Update action supports partial updates
- [ ] Update action preserves other sections unchanged
- [ ] History index increments after update
- [ ] Multiple updates create multiple history entries
- [ ] Updates don't modify originalSettings (only current settings)

</details>

<details open>
<summary><h3>Task 7: Implement Undo/Redo Actions</h3></summary>

**Purpose**: Create actions for navigating through settings history using undo and redo operations. These actions restore previous or future settings snapshots.

**Related Documentation:**

- [State Standards - Action Patterns](../../STATE_STANDARDS.md#action-patterns) - Action implementation patterns
- [Settings Feature Plan - Phase 8](./SETTINGS_FEATURE_PLAN.md#phase-8-undoredo-with-keyboard-shortcuts) - Undo/redo requirements

**Implementation Subtasks:**

- [ ] **Create actions/undo.action.ts**: Undo to previous snapshot
- [ ] **Create actions/redo.action.ts**: Redo to next snapshot
- [ ] **Implement undo method**: Use `getUndoSettings` and `canUndo` helpers
- [ ] **Implement redo method**: Use `getRedoSettings` and `canRedo` helpers
- [ ] **Guard against invalid operations**: No-op if undo/redo not available
- [ ] **Update history index**: Decrement for undo, increment for redo
- [ ] **Add action tests**: Test undo/redo navigation (see Testing section)

**Testing Subtask:**

- [ ] **Write Undo/Redo Action Tests**: Test history navigation (see Testing section)

**Key Implementation Notes:**

- Undo/redo only changes history index and current settings
- Does not modify history array (navigation only)
- Guard checks prevent index out of bounds
- Undo/redo don't affect originalSettings (unsaved changes remain)
- Undo/redo don't affect loading or error state

**Undo/Redo Pattern** (structure only):

```typescript
export function withUndoRedo() {
  return signalStoreFeature(
    withMethods((store) => ({
      undo: () => {
        if (!canUndo(store.historyIndex())) return;
        
        const newIndex = store.historyIndex() - 1;
        const settings = getUndoSettings(store.history(), newIndex);
        
        patchState(store, {
          settings,
          historyIndex: newIndex
        });
      },
      
      redo: () => {
        if (!canRedo(store.historyIndex(), store.history().length)) return;
        
        const newIndex = store.historyIndex() + 1;
        const settings = getRedoSettings(store.history(), newIndex);
        
        patchState(store, {
          settings,
          historyIndex: newIndex
        });
      }
    }))
  );
}
```

**Testing Focus for Task 7:**

> Focus on **navigation behavior** - ensure undo/redo moves through history correctly.

**Behaviors to Test:**

- [ ] Undo decrements history index
- [ ] Undo restores previous settings snapshot
- [ ] Undo does nothing when at start of history
- [ ] Redo increments history index
- [ ] Redo restores next settings snapshot
- [ ] Redo does nothing when at end of history
- [ ] Undo followed by redo returns to same state
- [ ] Multiple undo operations navigate backward correctly
- [ ] Undo/redo don't modify originalSettings

</details>

<details open>
<summary><h3>Task 8: Implement Reset and Clear History Actions</h3></summary>

**Purpose**: Create actions for resetting settings to defaults and clearing undo/redo history. These utility actions support user workflows and history management.

**Related Documentation:**

- [State Standards - Action Patterns](../../STATE_STANDARDS.md#action-patterns) - Action implementation patterns
- [Settings Feature Plan - Phase 9](./SETTINGS_FEATURE_PLAN.md#phase-9-e2e-testing--polish) - Reset to defaults requirement

**Implementation Subtasks:**

- [ ] **Create actions/reset-to-defaults.action.ts**: Reset all settings to defaults
- [ ] **Create actions/clear-history.action.ts**: Clear undo/redo history
- [ ] **Implement resetToDefaults method**: Restore DEFAULT_SETTINGS, record in history
- [ ] **Implement clearHistory method**: Empty history array, reset index
- [ ] **Add confirmation guard**: Consider requiring confirmation for reset (UI decision)
- [ ] **Add action tests**: Test reset and clear behavior (see Testing section)

**Testing Subtask:**

- [ ] **Write Reset/Clear Action Tests**: Test reset and history clearing (see Testing section)

**Key Implementation Notes:**

- Reset records current settings in history before resetting (allows undo)
- Reset sets both settings and originalSettings to defaults (clears unsaved changes)
- Clear history is typically used after save (not user-facing action)
- Reset to defaults is a potentially destructive action (UI should confirm)

**Reset/Clear Pattern** (structure only):

```typescript
export function withResetAndClear() {
  return signalStoreFeature(
    withMethods((store) => ({
      resetToDefaults: () => {
        const currentSettings = store.settings();
        const { history, index } = addToHistory(
          store.history(),
          store.historyIndex(),
          currentSettings
        );
        
        patchState(store, {
          settings: DEFAULT_SETTINGS,
          history,
          historyIndex: index
        });
      },
      
      clearHistory: () => {
        patchState(store, {
          history: [],
          historyIndex: -1
        });
      }
    }))
  );
}
```

**Testing Focus for Task 8:**

> Focus on **reset behavior** - ensure defaults restore and history clears correctly.

**Behaviors to Test:**

- [ ] Reset restores DEFAULT_SETTINGS
- [ ] Reset records current settings in history before resetting
- [ ] Reset allows undo to previous settings
- [ ] Clear history empties history array
- [ ] Clear history sets index to -1
- [ ] Clear history disables undo/redo

</details>

<details open>
<summary><h3>Task 9: Implement Computed Selectors</h3></summary>

**Purpose**: Create computed signals that derive useful values from store state, such as individual sections, dirty state, and undo/redo availability. Selectors provide reactive access to state for UI components.

**Related Documentation:**

- [State Standards - Selector Patterns](../../STATE_STANDARDS.md#selector-patterns) - Selector implementation patterns
- [Store Testing Guide](../../STORE_TESTING.md) - Selector testing patterns

**Implementation Subtasks:**

- [ ] **Create selectors/get-settings.selector.ts**: Get complete current settings
- [ ] **Create selectors/get-player-settings.selector.ts**: Get player section
- [ ] **Create selectors/get-file-transfer-settings.selector.ts**: Get file transfer section
- [ ] **Create selectors/get-search-settings.selector.ts**: Get search section
- [ ] **Create selectors/get-app-settings.selector.ts**: Get app section
- [ ] **Create selectors/get-has-unsaved-changes.selector.ts**: Compare settings with originalSettings
- [ ] **Create selectors/get-can-undo.selector.ts**: Use canUndo helper
- [ ] **Create selectors/get-can-redo.selector.ts**: Use canRedo helper
- [ ] **Create selectors/get-loading-state.selector.ts**: Get loading and error state
- [ ] **Add selector tests**: Test computed values (see Testing section)

**Testing Subtask:**

- [ ] **Write Selector Tests**: Test selector computations (see Testing section)

**Key Implementation Notes:**

- Selectors use `computed` for reactive derived values
- Section selectors extract specific settings sections
- Dirty check uses deep equality comparison (settings !== originalSettings)
- Undo/redo availability selectors use history helper functions
- Loading state selector combines isLoading and error properties

**Selector Pattern** (structure only):

```typescript
export function withSettingsSelectors() {
  return signalStoreFeature(
    withComputed((store) => ({
      playerSettings: computed(() => store.settings().player),
      fileTransferSettings: computed(() => store.settings().fileTransfer),
      searchSettings: computed(() => store.settings().search),
      appSettings: computed(() => store.settings().app),
      
      hasUnsavedChanges: computed(() => {
        const current = store.settings();
        const original = store.originalSettings();
        return JSON.stringify(current) !== JSON.stringify(original);
      }),
      
      canUndo: computed(() => canUndo(store.historyIndex())),
      canRedo: computed(() => canRedo(store.historyIndex(), store.history().length))
    }))
  );
}
```

**Testing Focus for Task 9:**

> Focus on **selector computations** - ensure derived values are correct.

**Behaviors to Test:**

- [ ] Section selectors return correct sections
- [ ] `hasUnsavedChanges` returns false when settings match originalSettings
- [ ] `hasUnsavedChanges` returns true when settings differ from originalSettings
- [ ] `canUndo` returns correct value based on history state
- [ ] `canRedo` returns correct value based on history state
- [ ] Selectors recompute when dependencies change
- [ ] Selectors don't recompute when unrelated state changes

</details>

<details open>
<summary><h3>Task 10: Assemble Complete Settings Store</h3></summary>

**Purpose**: Combine all store features (state, actions, selectors) into the final settings store definition. This creates the complete store that will be provided to the application.

**Related Documentation:**

- [State Standards - Store Composition](../../STATE_STANDARDS.md#store-composition) - Store assembly patterns
- [Settings Feature Plan - Phase 3](./SETTINGS_FEATURE_PLAN.md#phase-3-settings-store-application-layer) - Complete store requirements

**Implementation Subtasks:**

- [ ] **Create settings.store.ts**: Main store file
- [ ] **Define SettingsStore type**: Type for the complete store instance
- [ ] **Use signalStore builder**: Compose all features
- [ ] **Include withState**: Add initial state
- [ ] **Include all action features**: Load, save, update sections, undo/redo, reset/clear
- [ ] **Include selector feature**: Add computed selectors
- [ ] **Export store**: Make available for bootstrap and components
- [ ] **Add store integration tests**: Test complete store behavior (see Testing section)

**Testing Subtask:**

- [ ] **Write Store Integration Tests**: Test complete store workflows (see Testing section)

**Key Implementation Notes:**

- Store is composed using `signalStore()` builder function
- Features are applied in order (order matters for dependencies)
- Store should be provided at application root (via bootstrap config)
- Store type can be inferred or explicitly defined for type safety
- Store instance is singleton (providedIn: 'root')

**Store Assembly Pattern** (structure only):

```typescript
export const SettingsStore = signalStore(
  { providedIn: 'root' },
  withState(DEFAULT_STATE),
  withLoadSettings(),
  withSaveSettings(),
  withUpdatePlayerSettings(),
  withUpdateFileTransferSettings(),
  withUpdateSearchSettings(),
  withUpdateAppSettings(),
  withUndoRedo(),
  withResetAndClear(),
  withSettingsSelectors()
);

export type SettingsStore = InstanceType<typeof SettingsStore>;
```

**Testing Focus for Task 10:**

> Focus on **store integration** - ensure all features work together correctly.

**Behaviors to Test:**

- [ ] Store instantiates with default state
- [ ] All actions are available on store instance
- [ ] All selectors are available on store instance
- [ ] Load action populates store state
- [ ] Update actions record history
- [ ] Undo/redo navigate history correctly
- [ ] Save action syncs originalSettings
- [ ] Dirty check works across load/update/save workflow
- [ ] Complete user workflow (load → update → save → undo) works end-to-end

</details>

---

## ✅ Success Criteria

> Mark these checkboxes as you validate each criterion.

- [ ] **State Interface Defined**: SettingsState interface complete with all properties
- [ ] **Defaults Created**: DEFAULT_SETTINGS and DEFAULT_STATE constants defined
- [ ] **History Helpers Implemented**: All history management functions working
- [ ] **Load Action Complete**: Loading settings from backend works
- [ ] **Save Action Complete**: Saving settings to backend works
- [ ] **Update Actions Complete**: All four section update actions working
- [ ] **Undo/Redo Implemented**: History navigation working correctly
- [ ] **Reset/Clear Implemented**: Reset to defaults and clear history working
- [ ] **Selectors Implemented**: All computed selectors providing correct values
- [ ] **Store Assembled**: Complete store with all features integrated
- [ ] **All Tests Pass**: Unit and integration tests pass
- [ ] **TypeScript Compiles**: No compilation errors in application layer

---

## 🧪 Testing Summary

### Testing Approach

This phase focuses on **behavioral testing of store state management**:

1. **State Tests**: Validate state interface structure
2. **Helper Tests**: Test history management pure functions
3. **Action Tests**: Test each action's behavior with mocked service
4. **Selector Tests**: Test computed value derivations
5. **Integration Tests**: Test complete store workflows

### Test Types by Task

| Task | Test Type | Focus |
|------|-----------|-------|
| Task 1 | Type Checking | State structure validation |
| Task 2 | Unit | Default value validation |
| Task 3 | Unit | History helper logic |
| Task 4-8 | Unit | Action behavior with mocked service |
| Task 9 | Unit | Selector computations |
| Task 10 | Integration | Complete store workflows |

### Testing Standards Reference

- Follow [Store Testing Guide](../../STORE_TESTING.md) for store-specific patterns
- Use [Testing Standards](../../TESTING_STANDARDS.md) for behavioral testing approach
- Mock domain service at injection token boundary
- Test observable behaviors, not implementation details

---

## 📝 Implementation Notes

> Track discoveries, decisions, and issues encountered during implementation.

### Discoveries During Implementation

- [Add notes here as you implement]

### Blockers & Questions

- [Document any blockers or questions here]

### Deviations from Plan

- [Note any changes from the original plan and why]

---

## 🔗 Related Documentation

- **Previous Phase**: [Phase 2 - Domain Contracts & Infrastructure Layer](./SETTINGS_FEATURE_P2.md)
- **Next Phase**: [Phase 4 - Bootstrap Integration](./SETTINGS_FEATURE_P4.md)
- **Feature Overview**: [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md)
- **State Patterns**: [State Standards](../../STATE_STANDARDS.md)
- **Store Testing**: [Store Testing Guide](../../STORE_TESTING.md)
- **Testing Approach**: [Testing Standards](../../TESTING_STANDARDS.md)

---

_Phase Status: Ready for Implementation_
_Last Updated: 2025-01-11_
_Estimated Effort: 6-8 hours_
