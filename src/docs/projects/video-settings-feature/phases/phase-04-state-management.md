# Phase 4: Frontend State Management - VideoSettings Integration

**Phase**: 4 of 6  
**Status**: Planning  
**Dependencies**: Phase 3 Complete (Domain models, mappers, API client)  
**Estimated Duration**: 1-1.5 hours

---

## 📋 Phase Objective

Integrate VideoSettings into the existing SettingsStore state management layer. The store already handles all settings groups (connection, player, file transfer, search, app) with actions, selectors, and history tracking. This phase extends the pattern to include video settings with NO structural changes to the store itself.

**Key Insight**: The SettingsStore operates on the `Settings` root interface, which now includes `videoSettings` after Phase 3. The store infrastructure automatically handles video settings through the existing load/save actions. This phase adds convenience selectors for accessing video settings state.

---

## 🎯 Success Criteria

**State Management**:
- [ ] SettingsState already includes Settings (which contains videoSettings after Phase 3)
- [ ] Existing `loadSettings()` action hydrates videoSettings from API
- [ ] Existing `saveSettings()` action persists videoSettings to backend
- [ ] Video settings participate in undo/redo history automatically

**Selectors**:
- [ ] `selectVideoSettings` selector returns VideoSettings from state
- [ ] `selectEnableVideo` selector returns enableVideo boolean
- [ ] Selectors properly handle null settings state
- [ ] Selectors are memoized for performance

**Testing**:
- [ ] Unit tests verify video settings selectors return correct values
- [ ] Integration tests verify video settings load/save through store
- [ ] History tests verify video settings changes tracked correctly
- [ ] Tests verify video settings survive undo/redo operations

---

## 📂 Files Involved

**No Files Modified** (state interface already includes Settings):
- `libs/application/src/lib/settings/settings-state.interface.ts` - Already uses Settings root interface

**Files to Create**:
- `libs/application/src/lib/settings/selectors/select-video-settings.ts` - New selector
- `libs/application/src/lib/settings/selectors/select-enable-video.ts` - New selector

**Files to Modify**:
- `libs/application/src/lib/settings/selectors/index.ts` - Export new selectors
- `libs/application/src/lib/settings/settings-store.spec.ts` - Add video settings tests

**Files to Review** (for context):
- `libs/application/src/lib/settings/settings-store.ts` - Store configuration
- `libs/application/src/lib/settings/actions/load-settings.ts` - How settings load
- `libs/application/src/lib/settings/actions/save-settings.ts` - How settings save

---

## 🏗️ Architecture Context

### Current SettingsStore Structure

```typescript
// settings-state.interface.ts
export interface SettingsState {
  settings: Settings | null; // Settings NOW includes videoSettings (Phase 3)
  history: Settings[];
  historyPosition: number;
  storedCurrent: Settings | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  lastUpdated: number | null;
}
```

**Key Insight**: `Settings` root interface includes `videoSettings: VideoSettings` after Phase 3. The store already operates on this interface, so video settings automatically participate in:
- State hydration from API
- State persistence to backend
- Undo/redo history tracking
- Auto-save behavior

### Existing Selector Pattern

Selectors follow this pattern:

```typescript
// Example: select-player-settings.ts
export function selectPlayerSettings(store: WritableStore<SettingsState>) {
  return {
    playerSettings: computed(() => store.settings()?.playerSettings ?? null),
  };
}
```

We'll replicate this for video settings.

---

## 📝 Task Breakdown

### Task 1: Create selectVideoSettings Selector

**File**: `libs/application/src/lib/settings/selectors/select-video-settings.ts`

**Purpose**: Provide computed signal for accessing VideoSettings from state

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

**Pattern Notes**:
- Returns computed signal (reactive)
- Handles null settings state gracefully (`?.videoSettings ?? null`)
- Follows existing selector naming: `select*Settings`
- JSDoc comment explains behavior

**Subtasks**:
1. Create file in `selectors/` folder
2. Import dependencies (computed, WritableStore, SettingsState)
3. Implement selector function
4. Add JSDoc comment

**Testing**:
```typescript
it('should return video settings when state is loaded', () => {
  const store = mockSettingsStore({ settings: mockSettings });
  const { videoSettings } = selectVideoSettings(store);
  expect(videoSettings()).toEqual(mockSettings.videoSettings);
});

it('should return null when settings are not loaded', () => {
  const store = mockSettingsStore({ settings: null });
  const { videoSettings } = selectVideoSettings(store);
  expect(videoSettings()).toBeNull();
});
```

---

### Task 2: Create selectEnableVideo Selector

**File**: `libs/application/src/lib/settings/selectors/select-enable-video.ts`

**Purpose**: Provide granular access to the enableVideo boolean flag

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

**Pattern Notes**:
- Returns `false` as safe default (video disabled if not loaded)
- Double optional chaining handles null settings and null videoSettings
- Granular selector for specific property (component convenience)
- Follows convention: `select<PropertyName>`

**Subtasks**:
1. Create file in `selectors/` folder
2. Import dependencies
3. Implement selector function
4. Add JSDoc comment
5. Choose appropriate default value (false = video disabled by default)

**Testing**:
```typescript
it('should return enableVideo when settings are loaded', () => {
  const store = mockSettingsStore({ 
    settings: { ...mockSettings, videoSettings: { enableVideo: true } } 
  });
  const { enableVideo } = selectEnableVideo(store);
  expect(enableVideo()).toBe(true);
});

it('should return false when settings are not loaded', () => {
  const store = mockSettingsStore({ settings: null });
  const { enableVideo } = selectEnableVideo(store);
  expect(enableVideo()).toBe(false);
});

it('should return false when video settings are missing', () => {
  const store = mockSettingsStore({ 
    settings: { ...mockSettings, videoSettings: null } 
  });
  const { enableVideo } = selectEnableVideo(store);
  expect(enableVideo()).toBe(false);
});
```

---

### Task 3: Export New Selectors

**File**: `libs/application/src/lib/settings/selectors/index.ts`

**Purpose**: Add new selectors to barrel exports for public API

**Changes**:
```typescript
// Existing exports...
export * from './select-player-settings';
export * from './select-connection-settings';
// ADD THESE:
export * from './select-video-settings';
export * from './select-enable-video';
// Continue existing exports...
```

**Subtasks**:
1. Open selectors index.ts
2. Add export statements for new selectors
3. Maintain alphabetical order (or existing pattern)

---

### Task 4: Add Video Settings Tests to Store Spec

**File**: `libs/application/src/lib/settings/settings-store.spec.ts`

**Purpose**: Verify video settings integration with store actions and selectors

**Test Cases**:

#### Test Suite 1: Video Settings Selectors

```typescript
describe('Video Settings Selectors', () => {
  it('should select video settings from state', () => {
    const settingsStore = createMockSettingsStore({
      settings: mockSettingsWithVideo,
    });
    
    const { videoSettings } = selectVideoSettings(settingsStore);
    
    expect(videoSettings()).toBeDefined();
    expect(videoSettings()?.enableVideo).toBe(true);
  });

  it('should select enableVideo flag', () => {
    const settingsStore = createMockSettingsStore({
      settings: mockSettingsWithVideo,
    });
    
    const { enableVideo } = selectEnableVideo(settingsStore);
    
    expect(enableVideo()).toBe(true);
  });

  it('should return null for video settings when settings not loaded', () => {
    const settingsStore = createMockSettingsStore({ settings: null });
    
    const { videoSettings } = selectVideoSettings(settingsStore);
    
    expect(videoSettings()).toBeNull();
  });

  it('should return false for enableVideo when settings not loaded', () => {
    const settingsStore = createMockSettingsStore({ settings: null });
    
    const { enableVideo } = selectEnableVideo(settingsStore);
    
    expect(enableVideo()).toBe(false);
  });
});
```

#### Test Suite 2: Video Settings Load/Save Integration

```typescript
describe('Video Settings Load/Save', () => {
  it('should load video settings from API', async () => {
    const mockSettings: Settings = {
      ...createMockSettings(),
      videoSettings: { enableVideo: true },
    };
    
    mockSettingsService.getSettings.mockResolvedValue(mockSettings);
    
    await settingsStore.loadSettings();
    
    expect(settingsStore.settings()).toBeDefined();
    expect(settingsStore.settings()!.videoSettings.enableVideo).toBe(true);
  });

  it('should save video settings to API', async () => {
    const settingsWithVideo: Settings = {
      ...createMockSettings(),
      videoSettings: { enableVideo: false },
    };
    
    mockSettingsService.saveSettings.mockResolvedValue(settingsWithVideo);
    
    await settingsStore.saveSettings(settingsWithVideo);
    
    expect(mockSettingsService.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        videoSettings: { enableVideo: false },
      })
    );
  });
});
```

#### Test Suite 3: Video Settings History Tracking

```typescript
describe('Video Settings History', () => {
  it('should track video settings changes in history', async () => {
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
    
    expect(settingsStore.history().length).toBe(1);
    expect(settingsStore.canUndo()).toBe(true);
  });

  it('should restore video settings when undoing', async () => {
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
    
    settingsStore.undo();
    
    expect(settingsStore.settings()!.videoSettings.enableVideo).toBe(false);
  });
});
```

**Subtasks**:
1. Add mock data for video settings
2. Add selector tests (4 tests)
3. Add load/save integration tests (2 tests)
4. Add history tracking tests (2 tests)
5. Ensure all tests pass

---

## 🧪 Testing Strategy

### Unit Testing

**Selector Tests**:
- Test selectors return correct values from state
- Test selectors handle null state gracefully
- Test computed signals react to state changes
- Test default values are appropriate

**Store Integration Tests**:
- Test loadSettings includes video settings in response
- Test saveSettings sends video settings in request
- Test video settings participate in history tracking
- Test undo/redo operations preserve video settings

**Behavioral Expectations**:
- Selectors return reactive computed signals
- Video settings automatically included in all store operations
- No special handling needed (follows Settings pattern)
- History tracks video settings changes like any other settings group

### Integration Testing Philosophy

**Key Principle**: Test video settings integration, not store infrastructure

✅ **DO Test**:
- Video settings load from API via existing action
- Video settings save to backend via existing action
- Selectors return video settings from state
- History includes video settings changes

❌ **DON'T Test**:
- Store infrastructure itself (already tested)
- Action implementation details
- RxJS/Signal mechanics

---

## 🔗 Integration Points

### Existing Store Actions

**No modifications needed** - these actions already handle video settings:

#### loadSettings Action
```typescript
// libs/application/src/lib/settings/actions/load-settings.ts
// Already loads Settings (which includes videoSettings)
export function loadSettings(store: WritableStore<SettingsState>) {
  return {
    loadSettings: async (): Promise<void> => {
      const settings = await firstValueFrom(settingsService.getSettings());
      // settings.videoSettings automatically included
      updateState(store, actionMessage, { settings, isLoading: false });
    },
  };
}
```

#### saveSettings Action
```typescript
// libs/application/src/lib/settings/actions/save-settings.ts
// Already saves Settings (which includes videoSettings)
export function saveSettings(store: WritableStore<SettingsState>) {
  return {
    saveSettings: async (settings: Settings): Promise<void> => {
      // settings.videoSettings automatically sent to backend
      await firstValueFrom(settingsService.saveSettings(settings));
      updateState(store, actionMessage, { settings, isSaving: false });
    },
  };
}
```

### Settings Service

**No modifications needed** - service already handles Settings root interface:

```typescript
// libs/infrastructure/src/lib/settings/settings.service.ts
getSettings(): Observable<Settings> {
  return this.api.getSettings().pipe(
    map((response) => mapSettingsDtoToDomain(response))
    // Mapper includes videoSettings transformation (Phase 3)
  );
}

saveSettings(settings: Settings): Observable<Settings> {
  const request = mapSettingsDomainToDto(settings);
  // Mapper includes videoSettings transformation (Phase 3)
  return this.api.saveSettings(request).pipe(
    map((response) => mapSettingsDtoToDomain(response))
  );
}
```

---

## 📚 Reference Documentation

**Essential Reading**:
- [State Standards](../../../STATE_STANDARDS.md) - NgRx Signal Store patterns
- [Store Testing](../../../STORE_TESTING.md) - Store testing patterns
- [Testing Standards](../../../TESTING_STANDARDS.md) - General testing approach

**Related Files**:
- `libs/application/src/lib/settings/selectors/select-player-settings.ts` - Selector pattern reference
- `libs/application/src/lib/settings/settings-store.spec.ts` - Existing test patterns
- `libs/application/src/lib/settings/actions/load-settings.ts` - How settings load
- `libs/application/src/lib/settings/actions/save-settings.ts` - How settings save

**Related Phases**:
- Phase 3: Domain models and mappers (prerequisite)
- Phase 5: UI components will consume these selectors
- Phase 6: Player integration will use selectEnableVideo

---

## 💡 Key Design Insights

### Why No State Interface Changes?

The SettingsState interface uses `Settings` root interface:
```typescript
export interface SettingsState {
  settings: Settings | null; // Settings includes videoSettings (Phase 3)
}
```

After Phase 3, `Settings` includes `videoSettings: VideoSettings`. The store infrastructure automatically handles this—no structural changes needed.

### Why Only Selector Creation?

**Store actions already handle Settings holistically**:
- `loadSettings()` fetches entire Settings object (includes videoSettings)
- `saveSettings(settings)` saves entire Settings object (includes videoSettings)
- History tracks Settings snapshots (includes videoSettings)

**Selectors provide convenient access**:
- `selectVideoSettings()` - Extract video settings from state
- `selectEnableVideo()` - Granular access to specific flag

### Why selectEnableVideo Defaults to False?

**Safe default principle**: If settings haven't loaded, video capture should be disabled by default. This prevents:
- Unnecessary camera access on app startup
- UI flickering (video component appearing then disappearing)
- Permission prompts before user explicitly enables video

### Selector Granularity Decision

**Two selectors chosen**:
1. `selectVideoSettings` - Full video settings group (future-proof for additional properties)
2. `selectEnableVideo` - Specific boolean (component convenience, most common use case)

**Alternative considered**: Only `selectVideoSettings` with components accessing `.enableVideo`
- **Rejected**: Components would need to handle null chaining everywhere
- **Chosen approach**: Granular selector handles null gracefully, components get clean boolean

---

## 🎯 Phase Completion Checklist

- [ ] `select-video-settings.ts` created with computed signal
- [ ] `select-enable-video.ts` created with safe default
- [ ] Selectors exported from `selectors/index.ts`
- [ ] Video settings selector tests added to store spec (4 tests)
- [ ] Video settings load/save integration tests added (2 tests)
- [ ] Video settings history tracking tests added (2 tests)
- [ ] All tests pass successfully
- [ ] TypeScript compilation succeeds
- [ ] Code follows STATE_STANDARDS.md patterns
- [ ] JSDoc comments present on all selectors

---

## 📤 Deliverables

1. **New Selector Files** (2 files):
   - `select-video-settings.ts` - VideoSettings group selector
   - `select-enable-video.ts` - enableVideo boolean selector

2. **Updated Barrel Export**:
   - `selectors/index.ts` - Export new selectors

3. **Enhanced Test Suite**:
   - Video settings selector tests (4 tests)
   - Load/save integration tests (2 tests)
   - History tracking tests (2 tests)

4. **Completion Report**:
   - Document selector implementations
   - Include test results (8 new tests passing)
   - Verify store integration works end-to-end

---

**Phase Status**: Ready for Task Breakdown  
**Next Phase**: Phase 5 - UI Components (Settings View)  
**Estimated Complexity**: Low-Medium (follows established patterns)
