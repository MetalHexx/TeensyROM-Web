# Task Handoff: TASK-04-001-VIDEO-SETTINGS-SELECTORS

## 📋 Task Identity

**Task ID**: TASK-04-001-VIDEO-SETTINGS-SELECTORS  
**Task Name**: Create VideoSettings Selectors and Store Tests  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High (Enables Phase 5 UI components)  
**Estimated Context Size**: Small (2 new files + test updates)

---

## 🎯 Objective

**What**: Create convenience selectors for accessing video settings from the SettingsStore and add comprehensive tests verifying video settings integration.

**Why**: The SettingsStore already handles video settings automatically (via the Settings root interface from Phase 3), but components need convenient, type-safe selectors to access video settings state. This task adds those selectors and verifies the store correctly loads, saves, and tracks video settings.

**Success Criteria**:

- [ ] `selectVideoSettings` selector created (returns VideoSettings | null)
- [ ] `selectEnableVideo` selector created (returns boolean, defaults to false)
- [ ] Selectors exported from barrel
- [ ] Selectors handle null state gracefully
- [ ] 8+ unit tests added to store spec covering selectors, load/save, history
- [ ] All tests pass
- [ ] TypeScript compilation succeeds

---

## 📋 Context & Dependencies

**Prerequisites Completed**:

- ✅ Phase 3: VideoSettings domain interface exists
- ✅ Phase 3: Settings root interface includes videoSettings property
- ✅ Phase 3: Mappers handle videoSettings transformation
- ✅ SettingsStore already loads/saves Settings (which includes videoSettings)

**Dependencies**:

- `libs/application/src/lib/settings` - SettingsStore and state management
- `libs/domain` - VideoSettings interface
- `@teensyrom-nx/utils` - WritableStore type

**Constraints**:

- Follow existing selector pattern exactly (see select-player-settings.ts)
- Use computed signals (not observables)
- Handle null state gracefully with safe defaults
- selectEnableVideo should default to `false` (video disabled by default)

---

## 📂 File Scope

**Files to Create**:

- `libs/application/src/lib/settings/selectors/select-video-settings.ts` - VideoSettings group selector
- `libs/application/src/lib/settings/selectors/select-enable-video.ts` - enableVideo boolean selector

**Files to Modify**:

- `libs/application/src/lib/settings/selectors/index.ts` - Export new selectors
- `libs/application/src/lib/settings/settings-store.spec.ts` - Add video settings tests

**Files to Review** (for context):

- `libs/application/src/lib/settings/selectors/select-player-settings.ts` - Pattern reference
- `libs/application/src/lib/settings/settings-store.ts` - Store structure
- `libs/application/src/lib/settings/settings-state.interface.ts` - State shape

---

## 🛠️ Implementation Guidance

**Standards to Follow**:

- [State Standards](../../../STATE_STANDARDS.md) - NgRx Signal Store patterns
- [Store Testing](../../../STORE_TESTING.md) - Store testing best practices
- [Testing Standards](../../../TESTING_STANDARDS.md) - General testing approach
- [Phase 4 Detailed Plan](../phases/phase-04-state-management.md) - Complete task breakdown

---

## 📝 Task 1: Create selectVideoSettings Selector

### File: `libs/application/src/lib/settings/selectors/select-video-settings.ts`

**Purpose**: Provide reactive access to VideoSettings from store state

**Pattern Reference**: `libs/application/src/lib/settings/selectors/select-player-settings.ts`

**Implementation**:

```typescript
import { computed } from '@angular/core';
import { WritableStore } from '@teensyrom-nx/utils';
import { SettingsState } from '../settings-state.interface';

/**
 * Selector for video settings
 * Returns null if settings haven't loaded yet
 */
export function selectVideoSettings(store: WritableStore<SettingsState>) {
  return {
    videoSettings: computed(() => store.settings()?.videoSettings ?? null),
  };
}
```

**Key Points**:
- Returns object with `videoSettings` computed signal
- Optional chaining handles null settings state (`?.videoSettings`)
- Null coalescing provides safe default (`?? null`)
- JSDoc explains null return case

**Testing Checklist**:
- [ ] Selector returns VideoSettings when state loaded
- [ ] Selector returns null when state not loaded
- [ ] Computed signal is reactive (updates when state changes)

---

## 📝 Task 2: Create selectEnableVideo Selector

### File: `libs/application/src/lib/settings/selectors/select-enable-video.ts`

**Purpose**: Provide granular access to enableVideo boolean flag

**Implementation**:

```typescript
import { computed } from '@angular/core';
import { WritableStore } from '@teensyrom-nx/utils';
import { SettingsState } from '../settings-state.interface';

/**
 * Selector for enableVideo flag
 * Returns false if settings or video settings haven't loaded yet
 */
export function selectEnableVideo(store: WritableStore<SettingsState>) {
  return {
    enableVideo: computed(() => store.settings()?.videoSettings?.enableVideo ?? false),
  };
}
```

**Key Points**:
- Returns object with `enableVideo` computed signal
- Double optional chaining handles null settings AND null videoSettings
- Defaults to `false` (safe default - video disabled until explicitly enabled)
- Granular selector for component convenience

**Design Decision**: Why default to `false`?
- Safe default: Video capture disabled before settings load
- Prevents unnecessary camera access on startup
- Avoids UI flickering (video appearing then disappearing)
- Components get clean boolean (no null handling needed)

**Testing Checklist**:
- [ ] Selector returns true when enableVideo is true
- [ ] Selector returns false when enableVideo is false
- [ ] Selector returns false when settings not loaded
- [ ] Selector returns false when videoSettings is null

---

## 📝 Task 3: Export New Selectors

### File: `libs/application/src/lib/settings/selectors/index.ts`

**Purpose**: Add new selectors to barrel exports

**Changes**: Add these export statements (maintain alphabetical order or existing pattern):

```typescript
// Existing exports...
export * from './select-connection-settings';
export * from './select-enable-video';  // ADD THIS
export * from './select-player-settings';
export * from './select-video-settings';  // ADD THIS
// ... other exports
```

**Pattern Notes**:
- Alphabetical order by selector name
- One export per line
- Follows existing selector export pattern

**Testing Checklist**:
- [ ] Selectors can be imported from `@teensyrom-nx/application`
- [ ] No circular dependency warnings
- [ ] TypeScript compilation succeeds

---

## 📝 Task 4: Add Video Settings Tests to Store Spec

### File: `libs/application/src/lib/settings/settings-store.spec.ts`

**Purpose**: Verify video settings integration with store

**Test Structure**: Add these test suites to existing store spec

### Test Suite 1: Video Settings Selectors (4 tests)

```typescript
describe('Video Settings Selectors', () => {
  it('should select video settings from state', () => {
    // Arrange
    const mockSettings: Settings = {
      ...createMockSettings(),
      videoSettings: { enableVideo: true },
    };
    const settingsStore = createMockSettingsStore({ settings: mockSettings });
    
    // Act
    const { videoSettings } = selectVideoSettings(settingsStore);
    
    // Assert
    expect(videoSettings()).toBeDefined();
    expect(videoSettings()?.enableVideo).toBe(true);
  });

  it('should return null for video settings when settings not loaded', () => {
    // Arrange
    const settingsStore = createMockSettingsStore({ settings: null });
    
    // Act
    const { videoSettings } = selectVideoSettings(settingsStore);
    
    // Assert
    expect(videoSettings()).toBeNull();
  });

  it('should select enableVideo flag when true', () => {
    // Arrange
    const mockSettings: Settings = {
      ...createMockSettings(),
      videoSettings: { enableVideo: true },
    };
    const settingsStore = createMockSettingsStore({ settings: mockSettings });
    
    // Act
    const { enableVideo } = selectEnableVideo(settingsStore);
    
    // Assert
    expect(enableVideo()).toBe(true);
  });

  it('should return false for enableVideo when settings not loaded', () => {
    // Arrange
    const settingsStore = createMockSettingsStore({ settings: null });
    
    // Act
    const { enableVideo } = selectEnableVideo(settingsStore);
    
    // Assert
    expect(enableVideo()).toBe(false);
  });
});
```

### Test Suite 2: Video Settings Load/Save Integration (2 tests)

```typescript
describe('Video Settings Load/Save Integration', () => {
  it('should load video settings from API', async () => {
    // Arrange
    const mockSettings: Settings = {
      ...createMockSettings(),
      videoSettings: { enableVideo: true },
    };
    mockSettingsService.getSettings.mockResolvedValue(mockSettings);
    
    // Act
    await settingsStore.loadSettings();
    
    // Assert
    expect(settingsStore.settings()).toBeDefined();
    expect(settingsStore.settings()!.videoSettings.enableVideo).toBe(true);
  });

  it('should save video settings to API', async () => {
    // Arrange
    const settingsWithVideo: Settings = {
      ...createMockSettings(),
      videoSettings: { enableVideo: false },
    };
    mockSettingsService.saveSettings.mockResolvedValue(settingsWithVideo);
    
    // Act
    await settingsStore.saveSettings(settingsWithVideo);
    
    // Assert
    expect(mockSettingsService.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        videoSettings: { enableVideo: false },
      })
    );
  });
});
```

### Test Suite 3: Video Settings History Tracking (2 tests)

```typescript
describe('Video Settings History Tracking', () => {
  it('should track video settings changes in history', async () => {
    // Arrange
    const initialSettings: Settings = {
      ...createMockSettings(),
      videoSettings: { enableVideo: false },
    };
    const updatedSettings: Settings = {
      ...initialSettings,
      videoSettings: { enableVideo: true },
    };
    
    mockSettingsService.getSettings.mockResolvedValue(initialSettings);
    await settingsStore.loadSettings();
    
    mockSettingsService.saveSettings.mockResolvedValue(updatedSettings);
    
    // Act
    await settingsStore.saveSettings(updatedSettings);
    
    // Assert
    expect(settingsStore.history().length).toBe(1);
    expect(settingsStore.canUndo()).toBe(true);
  });

  it('should restore video settings when undoing', async () => {
    // Arrange
    const initialSettings: Settings = {
      ...createMockSettings(),
      videoSettings: { enableVideo: false },
    };
    const updatedSettings: Settings = {
      ...initialSettings,
      videoSettings: { enableVideo: true },
    };
    
    mockSettingsService.getSettings.mockResolvedValue(initialSettings);
    await settingsStore.loadSettings();
    
    mockSettingsService.saveSettings.mockResolvedValue(updatedSettings);
    await settingsStore.saveSettings(updatedSettings);
    
    // Act
    settingsStore.undo();
    
    // Assert
    expect(settingsStore.settings()!.videoSettings.enableVideo).toBe(false);
  });
});
```

**Testing Notes**:

- **Mock Data**: Use existing `createMockSettings()` helper, add `videoSettings: { enableVideo: true/false }`
- **Behavioral Focus**: Test observable behavior (state changes, API calls), not implementation
- **Async Handling**: Use `async/await` for store actions that return Promises
- **Assertions**: Verify state updates, service calls, and history tracking

**Pattern Reference**: Look at existing test suites in settings-store.spec.ts for:
- Mock setup patterns
- TestBed configuration
- Service mocking approach
- Assertion style

---

## 🧪 Testing Requirements

**Test Coverage Required**:

- [ ] Selector Tests (4 tests):
  - selectVideoSettings returns VideoSettings when loaded
  - selectVideoSettings returns null when not loaded
  - selectEnableVideo returns correct boolean
  - selectEnableVideo defaults to false when not loaded

- [ ] Integration Tests (2 tests):
  - loadSettings includes video settings
  - saveSettings persists video settings

- [ ] History Tests (2 tests):
  - Video settings changes tracked in history
  - Undo restores previous video settings

**Total**: 8 new tests (minimum)

**Behavioral Expectations**:

- Selectors return reactive computed signals
- Video settings automatically load/save via existing store actions
- History tracking includes video settings changes
- Undo/redo operations preserve video settings
- No special handling needed (Settings pattern handles it)

**Testing Strategy**:

- **Unit Tests**: Test selectors in isolation with mock store
- **Integration Tests**: Test video settings flow through real store actions
- **Behavioral Testing**: Focus on observable outcomes, not implementation details

---

## 📚 Reference Materials

**Related Documentation**:

- [Master Plan](../master-plan.md) - Overall feature overview
- [Phase 4 Detailed Plan](../phases/phase-04-state-management.md) - Complete task breakdown
- [State Standards](../../../STATE_STANDARDS.md) - NgRx Signal Store patterns
- [Store Testing](../../../STORE_TESTING.md) - Store testing best practices
- [Testing Standards](../../../TESTING_STANDARDS.md) - General testing approach

**Pattern References**:

- `libs/application/src/lib/settings/selectors/select-player-settings.ts` - Selector pattern
- `libs/application/src/lib/settings/selectors/select-connection-settings.ts` - Another example
- `libs/application/src/lib/settings/settings-store.spec.ts` - Existing test patterns
- `libs/application/src/lib/settings/actions/load-settings.ts` - How settings load
- `libs/application/src/lib/settings/actions/save-settings.ts` - How settings save

**Related Tasks**:

- TASK-03-002: Created VideoSettings domain interface (completed)
- TASK-03-002: Updated mappers to handle videoSettings (completed)
- Phase 5: UI components will consume these selectors (next)

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/video-settings-feature/reports/TASK-04-001-report.md`

**Report Template**: Follow structure from TASK-03-001 and TASK-03-002 reports

**Return Value**: Return file path when complete: `docs/projects/video-settings-feature/reports/TASK-04-001-report.md`

**Report Should Include**:

- **Files Created** section:
  - `select-video-settings.ts` with code snippet
  - `select-enable-video.ts` with code snippet

- **Files Modified** section:
  - `selectors/index.ts` showing exports
  - `settings-store.spec.ts` showing test suites added

- **Testing Results**:
  - Test count (8+ tests)
  - All tests passing
  - Coverage metrics if available

- **Verification**:
  - TypeScript compilation succeeded
  - Selectors work correctly
  - Store integration verified

- **Success Criteria Checklist** (all items checked)

---

## 🎯 Expected Outcomes

After completing this task:

1. **Selectors Created**:
   - `selectVideoSettings()` provides VideoSettings | null
   - `selectEnableVideo()` provides boolean with safe default

2. **Barrel Exports Updated**:
   - New selectors exported from `selectors/index.ts`
   - Can be imported from `@teensyrom-nx/application`

3. **Store Integration Verified**:
   - Video settings load from API via loadSettings action
   - Video settings save to backend via saveSettings action
   - History tracking includes video settings

4. **Comprehensive Test Coverage**:
   - 8+ tests covering selectors, load/save, history
   - All tests passing
   - Behavioral testing approach followed

5. **Ready for Phase 5**:
   - UI components can inject SettingsStore
   - Components can use selectVideoSettings/selectEnableVideo
   - State management infrastructure complete

---

## 💡 Implementation Notes

### Why No Store Structure Changes?

The `SettingsState` interface uses `Settings` root interface:

```typescript
export interface SettingsState {
  settings: Settings | null; // Settings includes videoSettings (Phase 3)
}
```

After Phase 3, `Settings` includes `videoSettings: VideoSettings`. Store infrastructure automatically handles this—**no structural changes needed**.

### Existing Actions Handle Video Settings

**loadSettings() action**:
```typescript
// Loads Settings (includes videoSettings automatically)
const settings = await firstValueFrom(settingsService.getSettings());
// settings.videoSettings already present from API
```

**saveSettings() action**:
```typescript
// Saves Settings (includes videoSettings automatically)
await firstValueFrom(settingsService.saveSettings(settings));
// settings.videoSettings sent to backend
```

**No modifications needed** - video settings participate automatically.

### Selector Pattern Consistency

All settings group selectors follow this pattern:

```typescript
export function select<Group>Settings(store: WritableStore<SettingsState>) {
  return {
    <group>Settings: computed(() => store.settings()?.<group>Settings ?? null),
  };
}
```

VideoSettings selectors follow this exact pattern for consistency.

### Safe Default Philosophy

`selectEnableVideo()` defaults to `false` because:

- **Safe default**: Video disabled before settings load
- **No camera access**: Prevents unwanted camera permission prompts
- **No UI flicker**: Video component doesn't appear then disappear
- **Component convenience**: Components get clean boolean, no null checks

### Testing Philosophy

**Behavioral testing approach**:

✅ **DO Test**:
- What selectors return (observable behavior)
- Video settings load/save through store
- History tracking includes video settings

❌ **DON'T Test**:
- Store infrastructure internals
- Signal mechanics
- Implementation details

---

**Task Status**: Ready for Execution (depends on Phase 3 completion)  
**Estimated Time**: 30-45 minutes  
**Complexity**: Low (pattern replication + testing)
