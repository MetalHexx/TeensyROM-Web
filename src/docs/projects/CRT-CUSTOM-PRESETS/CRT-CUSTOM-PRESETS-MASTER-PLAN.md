# CRT Custom Presets Feature - Master Plan

**Project Overview**: Enable users to save, manage, and apply custom CRT effect presets that persist across sessions. Users can save their current CRT settings as named presets, switch between built-in and custom presets, rename custom presets, and delete presets they no longer need. This feature extends the existing CRT preset system with user-defined configurations while maintaining the clean architecture and storage patterns already established.

**Standards Documentation**:

- **Coding Standards**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)
- **Component Library**: [COMPONENT_LIBRARY.md](../../COMPONENT_LIBRARY.md)
- **CRT Component Documentation**: [COMPONENT_LIBRARY_CRT.md](../../COMPONENT_LIBRARY_CRT.md)
- **Style Guide**: [STYLE_GUIDE.md](../../STYLE_GUIDE.md)

---

## 🎯 Project Objective

The CRT Custom Presets feature empowers users to save their personalized CRT effect configurations as reusable presets alongside the existing built-in presets (fullscreen-webgl, dialog-css, etc.). Users discover value in different CRT settings for different content types or visual preferences—some prefer subtle scanlines for image viewing, others want authentic phosphor patterns for video, and many want to preserve their per-device color calibration tweaks.

**User Value**: Users invest time fine-tuning CRT settings to match their hardware, content, or aesthetic preferences. Custom presets eliminate repetitive slider adjustments by storing and recalling these configurations instantly. The familiar preset dropdown now shows both built-in and user-created presets, with intuitive actions for saving current settings, renaming presets, and removing unused presets.

**Technical Value**: This feature extends the existing `CrtStorageService` architecture rather than introducing parallel systems. Custom presets are globally accessible (unlike device-specific CRT settings), use namespace prefixing to avoid conflicts with built-in presets, and follow established patterns for localStorage persistence and error handling.

---

## 📋 Implementation Phases

<details open>
<summary><h3>Phase 1: Storage Infrastructure</h3></summary>

### Objective

Extend the existing CRT storage layer to support CRUD operations for custom presets stored globally in localStorage. This phase establishes the persistence foundation without UI changes.

### Key Deliverables

- [ ] Extended domain contracts defining custom preset operations
- [ ] Updated `CrtStorageService` with custom preset methods
- [ ] Preset name validation and namespace prefixing logic
- [ ] Type definitions for custom vs built-in preset distinction
- [ ] Unit tests for storage operations and error handling

### High-Level Tasks

1. **Update Domain Contracts**: Add `ICrtStorage` methods for custom presets (save, load, delete, list)
2. **Extend CrtStorageService**: Implement custom preset persistence with namespace prefixing (`custom-*`)
3. **Add Validation Logic**: Create preset name validation (uniqueness, reserved names, character limits)
4. **Update Type Definitions**: Extend preset name types to distinguish built-in vs custom
5. **Write Unit Tests**: Test storage CRUD operations, validation, error handling

### Open Questions for Phase 1

- **Preset Storage Key**: Use single localStorage key with JSON array (`teensyrom_crt_custom_presets`) or individual keys per preset? **Decision: Single key with array for atomic updates and simpler enumeration**
- **Maximum Custom Presets**: Should we enforce a limit (e.g., 20 presets) to avoid localStorage bloat? **Decision: Start with 50 preset limit, inform user when approaching limit**

</details>

---

<details open>
<summary><h3>Phase 2: UI Dialog Components</h3></summary>

### Objective

Create reusable dialog components for preset name entry and deletion confirmation, following the established component architecture and using `lib-scaling-compact-card` for consistent presentation.

### Key Deliverables

- [ ] Preset name dialog component with validation feedback
- [ ] Confirmation dialog component for preset deletion
- [ ] Real-time validation display and character counter
- [ ] Keyboard navigation (Enter to confirm, Escape to cancel)
- [ ] Unit tests for dialog behaviors and validation states

### High-Level Tasks

1. **Create Preset Name Dialog**: Build component with input field, validation, Save/Cancel buttons
2. **Create Confirmation Dialog**: Build component with preset name display, destructive action warning
3. **Add Validation UI**: Implement real-time feedback for name conflicts and character limits
4. **Implement Keyboard Shortcuts**: Handle Enter/Escape keys for quick interaction
5. **Write Component Tests**: Test validation states, user interactions, keyboard navigation

### Open Questions for Phase 2

- **Dialog Animation**: Should dialogs fade in/scale in, or appear instantly? **Decision: Use scaling-compact-card default animation for consistency**
- **Validation Debounce**: Should name validation run on every keystroke or debounced? **Decision: Immediate validation for instant feedback**

</details>

---

<details open>
<summary><h3>Phase 3: Settings Panel Integration</h3></summary>

### Objective

Integrate custom preset management into the existing CRT settings panel, extending the preset dropdown with save/delete actions and wiring up the dialog components.

### Key Deliverables

- [ ] Updated preset dropdown with built-in/custom sections
- [ ] "Save Current as Preset" menu action
- [ ] Delete preset action (with confirmation)
- [ ] Rename preset action (reuses name dialog)
- [ ] Custom preset persistence on save
- [ ] Integration tests for complete preset workflows

### High-Level Tasks

1. **Extend Preset Dropdown**: Add section divider and custom preset items to dropdown menu
2. **Add Save Action**: Implement "Save Current as Preset" button that opens name dialog
3. **Add Delete Action**: Add delete button to custom preset items with confirmation dialog
4. **Add Rename Action**: Implement rename action using name dialog with prefilled value
5. **Wire Up Persistence**: Connect dialog actions to CrtStorageService operations
6. **Update Preset Selection**: Handle custom preset application and tracking
7. **Write Integration Tests**: Test complete save/apply/delete/rename workflows

### Open Questions for Phase 3

- **Delete UI Pattern**: Context menu on right-click, or visible delete icon on hover? **Decision: Icon button visible on hover for mobile-friendly interaction**
- **Preset Ordering**: Should custom presets appear alphabetically or by creation date? **Decision: Alphabetical for predictable location**

</details>

---

<details open>
<summary><h3>Phase 3A: Bug Fixes & Dialog Integration Debugging</h3></summary>

### Objective

Debug and fix the "Save Current as Preset" functionality that is currently non-functional in the UI. While unit tests pass in isolation, the actual user interaction fails to open the preset name dialog when clicking the save action in the dropdown menu. This phase focuses on identifying root causes and applying targeted fixes.

### Key Deliverables

- [ ] Root cause analysis of save action failure
- [ ] Console logging for production debugging
- [ ] Fixed event handling and signal reactivity
- [ ] Fixed dialog visibility and z-index issues
- [ ] Fixed validation function binding
- [ ] Comprehensive regression tests
- [ ] Debug reports documenting findings and fixes

### High-Level Tasks

1. **Debug Save Action Click Handler**: Verify event propagation from dropdown menu to component
2. **Debug Dialog Rendering**: Verify dialog component renders and is visible
3. **Debug Validation Function**: Verify validation function binding and execution
4. **Debug Confirmation Flow**: Verify event emission from dialog to parent
5. **Apply Fixes & Add Logging**: Implement fixes and add production debugging support

### Known Issues

- **Issue**: Clicking "Save Current as Preset" does nothing
- **Symptom**: Dialog does not appear when save action is clicked
- **Hypothesis**: Event propagation issue, signal binding issue, or z-index problem
- **Impact**: Users cannot create custom presets (critical feature blocker)

</details>

---

<details open>
<summary><h3>Phase 4: Refactor to Reusable Named Item Dialog</h3></summary>

### Objective

Transform the `PresetNameDialogComponent` into a truly reusable `NamedItemDialogComponent` that can validate and manage names for any domain entity (presets, playlists, devices, etc.).

### Key Deliverables

- [ ] Component renamed to `NamedItemDialogComponent` with generic interface
- [ ] CRT-specific assumptions removed (domain-agnostic design)
- [ ] New inputs added: `title` (required), `subtitle`, `confirmLabel`
- [ ] Input `reservedNames` renamed to `existingNames` for clarity
- [ ] Validation type renamed to `NameValidationFn` (backward-compatible alias maintained)
- [ ] Validation examples created for preset, playlist, and device names
- [ ] Component Library entry documenting reusable patterns
- [ ] All CRT feature code updated to use renamed component

### High-Level Tasks

1. **Rename and Refactor Component**: Rename files, class, selector, and generalize interface
2. **Update Template and Styles**: Remove CRT-specific text and styling
3. **Update CRT Feature**: Modify all imports and usage to new component name
4. **Document Component**: Add comprehensive entry to Component Library
5. **Create Validation Examples**: Provide reference validators for common use cases

### Benefits for Future Features

- **Playlist Management**: Reuse dialog for playlist creation/rename
- **Device Configuration**: Reuse dialog for device naming
- **Theme Customization**: Reuse dialog for custom theme names
- **Consistent UX**: Same validation patterns across all name-entry scenarios

</details>

---

## 🏗️ Architecture Overview

### Storage Architecture

**Existing System:**
- `CrtStorageService` handles device+context scoped CRT settings
- Storage key pattern: `teensyrom_crt_{deviceId}_{context}`
- Operations: save, load, hasSavedSettings, clear

**Extension for Custom Presets:**
- Add global preset storage (not device-scoped)
- Storage key: `teensyrom_crt_custom_presets` (single key, JSON array)
- Operations: saveCustomPreset, loadCustomPresets, deleteCustomPreset, renameCustomPreset
- Namespace prefix: `custom-` prepended to all custom preset names
- Validation: Check against reserved names (built-in presets), uniqueness, character limits

### Type System Extension

**Current Types:**
```typescript
type CrtPresetName = 'fullscreen-webgl' | 'fullscreen-css' | 'dialog-webgl' | ...
const CRT_PRESETS: Record<CrtPresetName, CrtSettings>
```

**Extended Types:**
```typescript
type BuiltInPresetName = 'default-fullscreen-webgl' | 'default-fullscreen-css' | ...
type CustomPresetName = `custom-${string}`
type AnyPresetName = BuiltInPresetName | CustomPresetName

interface CustomPreset {
  name: CustomPresetName;
  settings: CrtSettings;
  createdAt: string; // ISO timestamp for ordering/metadata
}
```

### UI Component Structure

```
CrtSettingsPanelComponent (existing)
├── Preset Dropdown (extended)
│   ├── Built-in Presets Section
│   │   ├── Default Full Screen (WebGL)
│   │   ├── Default Full Screen (CSS)
│   │   └── ...
│   ├── <divider>
│   ├── Custom Presets Section
│   │   ├── My Gaming Preset [rename] [delete]
│   │   ├── Vintage TV Look [rename] [delete]
│   │   └── ...
│   ├── <divider>
│   └── 💾 Save Current as Preset
│
├── PresetNameDialog (new)
│   └── ScalingCompactCard
│       ├── Input Field (with validation)
│       ├── Character Counter (15/50)
│       ├── Validation Message
│       └── Buttons (Save/Cancel)
│
└── ConfirmationDialog (new)
    └── ScalingCompactCard
        ├── Warning Icon
        ├── Confirmation Message
        └── Buttons (Delete/Cancel)
```

### Data Flow

**Save Custom Preset:**
1. User clicks "Save Current as Preset"
2. PresetNameDialog opens with validation
3. User enters name, sees real-time validation
4. On confirm: `CrtStorageService.saveCustomPreset('custom-{name}', currentSettings)`
5. Settings panel refreshes preset list
6. New preset appears in Custom Presets section

**Apply Custom Preset:**
1. User clicks custom preset in dropdown
2. Settings panel emits `presetSelected` with custom preset name
3. Parent loads settings from `CrtStorageService.loadCustomPresets()`
4. Settings applied to CRT effect wrapper

**Delete Custom Preset:**
1. User clicks delete icon on custom preset
2. ConfirmationDialog opens with preset name
3. On confirm: `CrtStorageService.deleteCustomPreset('custom-{name}')`
4. Settings panel refreshes preset list
5. Preset removed from dropdown

---

## 🧪 Testing Strategy

### Unit Tests

**Storage Layer (`CrtStorageService`):**
- Custom preset CRUD operations
- Namespace prefixing applied correctly
- Validation logic (reserved names, uniqueness, character limits)
- localStorage error handling
- Maximum preset limit enforcement

**Dialog Components:**
- Preset name dialog validation states
- Real-time validation feedback display
- Keyboard navigation (Enter/Escape)
- Confirmation dialog button behaviors
- Dialog open/close animations

### Integration Tests

**Settings Panel Integration:**
- Complete save workflow (open dialog → enter name → save → appears in dropdown)
- Apply custom preset updates CRT settings correctly
- Delete custom preset removes from list
- Rename custom preset updates name in storage
- Built-in presets remain unaffected by custom operations

### End-to-End Tests (Cypress)

**User Workflows:**
- Create custom preset from adjusted settings
- Apply custom preset in different component contexts
- Delete custom preset and verify removal
- Rename custom preset and verify update
- Maximum preset limit warning behavior

---

## 📊 Success Criteria

**Functional Criteria:**

- [ ] Users can save current CRT settings as named custom presets
- [ ] Custom presets appear in preset dropdown alongside built-in presets
- [ ] Custom presets persist across browser sessions
- [ ] Users can apply custom presets with single click
- [ ] Users can rename custom presets without re-creating
- [ ] Users can delete custom presets with confirmation
- [ ] Built-in presets remain immutable and conflict-free
- [ ] Preset name validation provides clear, immediate feedback

**Technical Criteria:**

- [ ] All storage operations handle localStorage errors gracefully
- [ ] Custom preset names use `custom-` namespace prefix consistently
- [ ] Maximum 50 custom presets enforced with user notification
- [ ] No architectural conflicts with existing device-scoped CRT storage
- [ ] Type safety maintained between built-in and custom preset types
- [ ] Unit test coverage ≥80% for new storage methods
- [ ] Integration tests cover complete preset workflows
- [ ] Component tests verify dialog validation and keyboard navigation

**UX Criteria:**

- [ ] Preset dropdown sections clearly distinguish built-in vs custom
- [ ] Save action discoverable within 2 seconds of viewing panel
- [ ] Validation feedback appears within 100ms of name input
- [ ] Confirmation dialog prevents accidental deletion
- [ ] Rename action preserves settings while updating name
- [ ] Alphabetical sorting makes custom presets predictable
- [ ] Error messages are specific and actionable

---

## 🚧 Open Questions Summary

### Architecture Decisions (Resolved)

- **Storage Pattern**: Single localStorage key with JSON array ✅
- **Namespace Strategy**: `custom-` prefix for all custom presets ✅
- **Maximum Presets**: 50 preset limit with user notification ✅
- **Preset Ordering**: Alphabetical sorting for predictability ✅

### UI/UX Decisions (Resolved)

- **Name Entry Pattern**: Modal dialog with scaling-compact-card ✅
- **Delete UI**: Icon button visible on hover ✅
- **Validation Timing**: Immediate (no debounce) ✅
- **Dialog Animation**: Use scaling-compact-card defaults ✅

### Future Considerations

- **Preset Import/Export**: Could add JSON export/import for sharing presets between browsers
- **Preset Categories**: Could add user-defined categories (Gaming, Movies, Photos)
- **Preset Thumbnails**: Could capture screenshot of CRT effect for visual preview
- **Cloud Sync**: Could sync custom presets across devices via backend API

---

## 📚 Related Documentation

- [CRT Effect Wrapper Component](../../COMPONENT_LIBRARY_CRT.md#crteffectwrappercomponent)
- [CRT Settings Panel Component](../../COMPONENT_LIBRARY_CRT.md#crtsettingspanelcomponent)
- [CRT Settings Defaults](../../../libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts)
- [CRT Storage Service](../../../libs/infrastructure/src/lib/crt/crt-storage.service.ts)
- [Scaling Compact Card Component](../../COMPONENT_LIBRARY.md#scaling-compact-card)
- [Icon Button Component](../../COMPONENT_LIBRARY.md#icon-button)

---

## 📋 Phase Tracking

| Phase | Status | Files Changed | Completion |
|-------|--------|---------------|------------|
| **Phase 1: Storage Infrastructure** | In Progress | ~8 files | 20% (Task 1/5 complete) |
| **Phase 2: UI Dialog Components** | In Progress | ~12 files | 33% (Task 1/3 complete) |
| **Phase 3: Settings Panel Integration** | Not Started | ~6 files | 0% |
| **Phase 4: Reusable Dialog Refactor** | Not Started | ~25 files | 0% |

**Total Estimated Files**: ~51 files (8 domain/infrastructure + 12 UI components + 6 integration + 25 refactoring)

**Estimated Timeline**: 4-7 implementation sessions

**Note**: Phase 4 is optional but highly recommended. It transforms the preset-specific dialog into a reusable component that benefits future features (playlists, device naming, theme customization). Can be executed after Phase 3 or deferred to a separate project.
