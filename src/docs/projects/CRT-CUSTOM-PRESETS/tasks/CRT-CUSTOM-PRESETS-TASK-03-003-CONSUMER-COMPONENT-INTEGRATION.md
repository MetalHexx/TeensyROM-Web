# CRT-CUSTOM-PRESETS-TASK-03-003-CONSUMER-COMPONENT-INTEGRATION

## 📋 Task Metadata

**Task ID**: CRT-CUSTOM-PRESETS-TASK-03-003-CONSUMER-COMPONENT-INTEGRATION  
**Task Name**: Update Consumer Components to Handle Custom Presets  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: Medium  
**Estimated Context Size**: Medium (6-8 files)

---

## 🎯 Objective

**What**: Update all components that consume the CRT settings panel to handle custom preset selection by adding logic to distinguish between built-in and custom presets, loading custom presets from storage when selected, and applying their settings correctly.

**Why**: Components that use CRT settings (VideoCaptureComponent, VideoDialogComponent, FileImageComponent) currently only handle built-in presets. This task extends them to work with custom presets, completing the feature integration across the application.

**Success Criteria**:
- [ ] All consumer components inject CrtStorageService via `CRT_STORAGE` token
- [ ] `onCrtPresetSelected()` method updated to accept `AnyPresetName` type
- [ ] Built-in preset selection continues to work as before
- [ ] Custom preset selection loads settings from storage correctly
- [ ] Custom preset settings applied to CRT effect wrapper correctly
- [ ] Custom preset settings persisted to device storage correctly
- [ ] Type guards used to distinguish built-in vs custom presets
- [ ] Missing custom preset handled gracefully with logging
- [ ] All tests pass with behavioral coverage for both preset types
- [ ] No TypeScript or linting errors

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- CRT-CUSTOM-PRESETS-TASK-03-002: Save, rename, delete workflows implemented
- CRT-CUSTOM-PRESETS-TASK-01-005: Type system with `AnyPresetName` and type guards
- CRT-CUSTOM-PRESETS-TASK-01-004: CrtStorageService with `loadCustomPresets()` method

**Dependencies**:
- `@teensyrom-nx/domain` - `CRT_STORAGE`, `AnyPresetName`, `isBuiltInPreset()`, `isCustomPresetName()`
- Existing CRT settings panel integration in consumer components
- CRT effect wrapper for applying settings

**Constraints**:
- Must maintain backward compatibility with built-in preset selection
- Must not break existing CRT settings persistence
- Must handle custom preset not found gracefully (user may have deleted it)
- Type changes must not affect other parts of the application

---

## 📂 File Scope

**Files to Modify**:
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts`
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts`
- `libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.ts`
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.spec.ts`
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.spec.ts`
- `libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.spec.ts`

**Files to Review** (for context):
- `docs/projects/CRT-CUSTOM-PRESETS/reports/CRT-CUSTOM-PRESETS-TASK-01-005-REPORT.md` - Type system implementation
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Settings panel integration
- `libs/domain/src/lib/contracts/crt-storage.contract.ts` - Storage methods

---

## 🛠️ Implementation Guidance

### Part 1: Inject CRT Storage Service

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md) - Dependency injection patterns

**Key Requirements**:

For each consumer component:

1. **Import Storage Token and Type Guards**:
   ```typescript
   import { CRT_STORAGE, isBuiltInPreset, AnyPresetName } from '@teensyrom-nx/domain';
   ```

2. **Inject CRT Storage Service**:
   - Use `inject(CRT_STORAGE)` in component
   - Store in private field: `private crtStorage = inject(CRT_STORAGE);`

3. **No Constructor Changes**:
   - All components use `inject()` function (Angular 19 pattern)
   - No need to modify constructor parameters

**Example Injection**:
```typescript
import { inject } from '@angular/core';
import { CRT_STORAGE, isBuiltInPreset, AnyPresetName } from '@teensyrom-nx/domain';

export class VideoCaptureComponent {
  private crtStorage = inject(CRT_STORAGE);
  
  // ... rest of component
}
```

---

### Part 2: Update Preset Selection Logic

**Key Requirements**:

For each consumer component, update `onCrtPresetSelected()` method:

1. **Update Method Signature**:
   - Change parameter type from `CrtPresetName` to `AnyPresetName`
   - Method: `onCrtPresetSelected(presetName: AnyPresetName): void`

2. **Add Preset Type Branching**:
   - Use `isBuiltInPreset(presetName)` type guard to branch logic
   - **Built-in Branch**: Load settings from `CRT_PRESETS` constant (existing logic)
   - **Custom Branch**: Load preset from storage, extract settings

3. **Handle Missing Custom Preset**:
   - If custom preset not found in storage, log warning
   - Return early without changing settings
   - Consider: user may have deleted preset in another component instance

4. **Apply Settings**:
   - Set `crtSettings` signal with loaded settings (same for both types)
   - Persist to device storage via `crtStorage.save()` (existing logic)
   - Emit events or trigger re-renders as needed (existing patterns)

**Example Implementation Pattern**:
```typescript
onCrtPresetSelected(presetName: AnyPresetName): void {
  let settings: CrtSettings;
  
  // Branch on preset type
  if (isBuiltInPreset(presetName)) {
    // Existing logic: load from CRT_PRESETS constant
    settings = CRT_PRESETS[presetName];
  } else {
    // New logic: load custom preset from storage
    const customPresets = this.crtStorage.loadCustomPresets();
    const preset = customPresets.find(p => p.name === presetName);
    
    if (!preset) {
      console.warn(`[ComponentName] Custom preset not found: ${presetName}`);
      return; // Early return, don't change settings
    }
    
    settings = preset.settings;
  }
  
  // Apply settings (existing logic)
  this.crtSettings.set(settings);
  this.crtStorage.save(this.deviceId(), this.context, settings);
  
  // Any additional logic (component-specific)
}
```

---

### Part 3: Component-Specific Updates

#### VideoCaptureComponent

**Location**: `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts`

**Current Context**:
- Manages CRT settings for video capture view
- Has `crtSettings` signal
- Persists to device storage with context `'video-capture'`

**Changes Needed**:
- Inject `CRT_STORAGE`
- Update `onCrtPresetSelected()` signature to `AnyPresetName`
- Add branching logic for custom presets
- Test both built-in and custom preset selection

---

#### VideoDialogComponent

**Location**: `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts`

**Current Context**:
- Dialog view for video playback with CRT settings
- Has `crtSettings` signal
- Persists to device storage with context `'video-dialog'`

**Changes Needed**:
- Inject `CRT_STORAGE`
- Update `onCrtPresetSelected()` signature to `AnyPresetName`
- Add branching logic for custom presets
- Test both built-in and custom preset selection

---

#### FileImageComponent

**Location**: `libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.ts`

**Current Context**:
- Image viewer with CRT effect overlay
- Has `crtSettings` signal
- Persists to device storage with context `'file-image'`

**Changes Needed**:
- Inject `CRT_STORAGE`
- Update `onCrtPresetSelected()` signature to `AnyPresetName`
- Add branching logic for custom presets
- Test both built-in and custom preset selection

---

### Part 4: Type System Integration

**Key Requirements**:

1. **Import Type Definitions**:
   - `AnyPresetName` - Union type of built-in and custom preset names
   - `BuiltInPresetName` - For type narrowing after guard check
   - `CustomPresetName` - For custom preset handling
   - `isBuiltInPreset()` - Type guard function
   - `isCustomPresetName()` - Type guard function (optional, for additional checks)

2. **Type Guard Usage**:
   - `isBuiltInPreset(name)` narrows type to `BuiltInPresetName`
   - Enables TypeScript to validate `CRT_PRESETS[name]` access
   - Else branch infers `CustomPresetName` type

3. **Type Safety Benefits**:
   - Compile-time check that all preset types handled
   - TypeScript ensures correct preset constant usage
   - Prevents accessing wrong preset maps

**Example Type Narrowing**:
```typescript
function handlePreset(presetName: AnyPresetName): void {
  if (isBuiltInPreset(presetName)) {
    // TypeScript knows presetName is BuiltInPresetName here
    const settings = CRT_PRESETS[presetName]; // ✅ Type-safe access
  } else {
    // TypeScript knows presetName is CustomPresetName here
    const customPresets = this.crtStorage.loadCustomPresets();
    const preset = customPresets.find(p => p.name === presetName);
  }
}
```

---

## 🧪 Testing Requirements

**Test Coverage Required**:

### Dependency Injection Tests (Per Component)

- [ ] CrtStorageService injected correctly via `CRT_STORAGE` token
- [ ] Storage service available in component instance

### Built-in Preset Selection Tests (Per Component)

- [ ] Selecting built-in preset loads settings from `CRT_PRESETS`
- [ ] Built-in preset settings applied to `crtSettings` signal
- [ ] Built-in preset settings persisted to device storage
- [ ] CRT effect wrapper receives built-in preset settings
- [ ] Built-in preset selection works as before (regression test)

### Custom Preset Selection Tests (Per Component)

- [ ] Selecting custom preset loads from storage via `loadCustomPresets()`
- [ ] Custom preset found by name in loaded presets array
- [ ] Custom preset settings applied to `crtSettings` signal
- [ ] Custom preset settings persisted to device storage
- [ ] CRT effect wrapper receives custom preset settings
- [ ] Storage called with correct device ID and context

### Error Handling Tests (Per Component)

- [ ] Missing custom preset logs warning
- [ ] Missing custom preset doesn't change current settings
- [ ] Missing custom preset doesn't crash component
- [ ] Empty custom presets array handled correctly
- [ ] Storage load errors handled gracefully

### Type Guard Tests

- [ ] `isBuiltInPreset()` returns true for built-in preset names
- [ ] `isBuiltInPreset()` returns false for custom preset names
- [ ] Type narrowing works correctly in both branches

**Behavioral Expectations**:
- Built-in preset selection unchanged from current behavior
- Custom preset selection loads and applies settings correctly
- Missing presets handled gracefully without UI errors
- Settings persist correctly for both preset types

**Testing Reference**:
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)
- [Testing Standards](../../../TESTING_STANDARDS.md)

---

## 🔗 Related Documentation

**Planning Documents**:
- [Master Plan](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md#phase-3-settings-panel-integration)
- [Phase 3 Plan](../phases/CRT-CUSTOM-PRESETS-PHASE-03-SETTINGS-PANEL-INTEGRATION.md#task-8-update-consumer-components)

**Implementation Reports**:
- [Task 03-002 Report](../reports/CRT-CUSTOM-PRESETS-TASK-03-002-REPORT.md) - Workflows and dialogs
- [Task 01-005 Report](../reports/CRT-CUSTOM-PRESETS-TASK-01-005-REPORT.md) - Type system
- [Task 01-004 Report](../reports/CRT-CUSTOM-PRESETS-TASK-01-004-REPORT.md) - Storage service

**Standards**:
- [Coding Standards](../../../CODING_STANDARDS.md)
- [Testing Standards](../../../TESTING_STANDARDS.md)
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/CRT-CUSTOM-PRESETS/reports/CRT-CUSTOM-PRESETS-TASK-03-003-REPORT.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete

---

## 💡 Implementation Notes

### Anti-Patterns to Avoid

- ❌ Don't import CrtStorageService class directly - use `CRT_STORAGE` token
- ❌ Don't cache custom presets in component - load fresh each time
- ❌ Don't throw errors for missing custom presets - log warning and return
- ❌ Don't change built-in preset behavior - only add custom preset support
- ❌ Don't forget to update test mocks for CRT_STORAGE injection

### Key Integration Points

- Type guards from Phase 1 (Task 01-005) enable type-safe branching
- Storage service from Phase 1 (Task 01-004) provides `loadCustomPresets()`
- CRT settings persistence remains unchanged (same storage context and device ID)
- CRT effect wrapper receives settings the same way (no changes needed)

### Performance Considerations

- `loadCustomPresets()` called on each custom preset selection (not cached)
- This ensures latest preset data (handles delete/rename in other components)
- Cost: small localStorage read (~1ms), negligible for user interaction
- Alternative: subscribe to preset changes (future enhancement if needed)

### User Experience Considerations

- Missing custom preset logs warning but doesn't show error to user
- This handles race condition where preset deleted in another component
- Consider: future toast notification "Preset no longer available"
- Settings remain unchanged if preset not found (safe fallback)

### Testing Strategy

- Test each component independently (unit tests)
- Mock `CRT_STORAGE` to control custom preset data
- Test both built-in and custom preset selection paths
- Test missing preset scenario with empty array or preset not found
- Verify type guards work correctly with test data

### Related Components Not Modified

These components don't need updates because they don't use CRT settings panel:
- `PlayerDeviceContainerComponent` - Orchestrates child components
- `DirectoryTrailComponent` - Directory navigation only
- Other player components that don't use CRT effects

### Future Enhancements

- Real-time preset synchronization across components (via shared state or events)
- Preset change notifications (toast when preset deleted/renamed elsewhere)
- Preset caching strategy to reduce storage reads
- Preset preview before applying (show settings diff)
