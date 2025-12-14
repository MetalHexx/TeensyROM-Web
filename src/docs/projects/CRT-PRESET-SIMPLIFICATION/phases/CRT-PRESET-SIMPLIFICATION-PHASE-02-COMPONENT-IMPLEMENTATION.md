# Phase 2: Component Implementation

## 🎯 Objective

Update all three player components (file-image, video-capture, video-dialog) to use the new simplified preset structure. Implement intelligent WebGL capability detection for first-time users while preserving all existing user customizations. Remove component-specific CRT overrides to achieve clean architecture alignment with preset system.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Master Plan](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md) - Complete project overview
- [ ] [Phase 1 Completion](./CRT-PRESET-SIMPLIFICATION-PHASE-01-STRUCTURE-REFACTOR.md) - Preset structure foundation

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component testing patterns
- [ ] [Component Library](../../../COMPONENT_LIBRARY.md) - Reusable component catalog

---

## 📂 File Structure Overview

```
libs/infrastructure/src/lib/utils/
├── webgl-detector.ts                        ✨ New - WebGL capability detection utility
└── index.ts                                 📝 Modified - Export new utility

libs/features/player/src/lib/player-view/player-device-container/
├── file-image/
│   ├── file-image.component.ts              📝 Modified - Use SMALL preset, remove overrides
│   └── file-image.component.spec.ts         📝 Modified - Update tests for new behavior
├── video-capture/
│   ├── video-capture.component.ts           📝 Modified - Use SMALL preset with detection
│   └── video-capture.component.spec.ts      📝 Modified - Update tests
└── video-capture/video-dialog/
    ├── video-dialog.component.ts            📝 Modified - Use LARGE preset with detection
    └── video-dialog.component.spec.ts       📝 Modified - Update tests
```

---

<details open>
<parameter name="summary"><h3>Task 1: Create WebGL Detection Utility</h3></summary>

**Purpose**: Create a simple, reusable utility function in the infrastructure layer to detect WebGL support, allowing components to choose appropriate default presets for first-time users.

**Related Documentation:**

- [Master Plan - WebGL Detection](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md#integration-points)
- [CRT Renderer isSupported()](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts) - Existing detection logic

**Implementation Subtasks:**

- [ ] **Create file** `libs/infrastructure/src/lib/utils/webgl-detector.ts`
- [ ] **Implement detectWebGLSupport() function** - Returns boolean, checks for WebGL context
- [ ] **Add SSR/browser environment check** - Return false if running server-side
- [ ] **Add JSDoc documentation** - Explain usage and return value
- [ ] **Export from infrastructure barrel** - Add to `libs/infrastructure/src/lib/utils/index.ts`
- [ ] **Verify tree-shaking** - Function should be pure with no side effects

**Testing Subtask:**

- [ ] **Write Tests**: Verify detection logic and edge cases (see Testing section below)

**Key Implementation Notes:**

- Use same logic as `CrtRenderer.isSupported()` - create temp canvas, attempt WebGL context
- Handle `document` undefined (SSR environment) - return `false`
- Catch exceptions during context creation - return `false`
- Function should be stateless and side-effect free for tree-shaking
- No caching needed - components call once during initialization

**Critical Implementation Pattern**:

```typescript
// Simple pure function, no service overhead
export function detectWebGLSupport(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return gl !== null;
  } catch {
    return false;
  }
}
```

**Testing Focus for Task 1:**

**Behaviors to Test:**

- [ ] **Returns true when WebGL is available** (browser with GPU support)
- [ ] **Returns false when WebGL is unavailable** (browser without GPU support)
- [ ] **Returns false in SSR environment** (document undefined)
- [ ] **Returns false when context creation throws exception**
- [ ] **Does not throw errors** (all exceptions handled internally)

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for utility function testing
- Mock `document.createElement` for different scenarios

</details>

---

<details open>
<parameter name="summary"><h3>Task 2: Update File-Image Component</h3></summary>

**Purpose**: Refactor file-image component to use SMALL preset with WebGL detection, removing all component-specific CRT overrides (brightness, curvature, scanline adjustments) for clean architecture.

**Related Documentation:**

- [File-Image Component](../../../../libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.ts)
- [Master Plan - Component Overrides](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md#key-design-decisions)

**Implementation Subtasks:**

- [ ] **Import detectWebGLSupport** from infrastructure utilities
- [ ] **Update crtConfig** from `CRT_CONFIGS.standard` to `CRT_CONFIGS.small`
- [ ] **Remove fileImageDefaultSettings** constant (was applying overrides)
- [ ] **Update initialization logic** - Check for saved settings first, then use WebGL detection
- [ ] **Remove forced screenCurvature override** in saved settings load (was forcing to 16px)
- [ ] **Update CRT_PRESET_KEYS imports** to use SMALL_WEBGL/SMALL_CSS
- [ ] **Simplify constructor effect** - Load saved or detect WebGL for default

**Testing Subtask:**

- [ ] **Write Tests**: Verify initialization behavior and preset selection (see Testing section below)

**Key Implementation Notes:**

- Initialization priority: Saved settings > WebGL detection > SMALL_WEBGL fallback
- Storage key remains `'file-image'` (backward compatibility)
- No special curvature handling - use preset values as-is
- WebGL detection only runs if no saved settings exist
- Component should be simpler after removing override logic

**Initialization Logic Pattern**:

```typescript
constructor() {
  effect(() => {
    const deviceId = this.deviceId();
    if (deviceId) {
      const savedSettings = this.crtStorage.load(deviceId, 'file-image');
      if (savedSettings) {
        this.crtSettings.set(savedSettings); // Use saved (no overrides)
      } else {
        // First-time user: detect WebGL capability
        const hasWebGL = detectWebGLSupport();
        const preset = hasWebGL 
          ? CRT_PRESETS[CRT_PRESET_KEYS.SMALL_WEBGL]
          : CRT_PRESETS[CRT_PRESET_KEYS.SMALL_CSS];
        this.crtSettings.set(preset);
      }
    }
  }, { allowSignalWrites: true });
}
```

**Testing Focus for Task 2:**

**Behaviors to Test:**

- [ ] **With saved settings: loads saved values** (ignores WebGL detection)
- [ ] **Without saved settings + WebGL available: uses SMALL_WEBGL preset**
- [ ] **Without saved settings + WebGL unavailable: uses SMALL_CSS preset**
- [ ] **No curvature override applied** to saved settings
- [ ] **crtConfig property is CRT_CONFIGS.small**
- [ ] **Storage key is 'file-image'** (unchanged)

**Testing Reference:**

- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) for component testing patterns
- Mock `crtStorage.load()` to test saved settings scenario
- Mock `detectWebGLSupport()` to test detection scenarios

</details>

---

<details open>
<parameter name="summary"><h3>Task 3: Update Video-Capture Component</h3></summary>

**Purpose**: Refactor video-capture component to use SMALL preset with WebGL detection, maintaining compact display styling while removing any component-specific overrides.

**Related Documentation:**

- [Video-Capture Component](../../../../libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts)

**Implementation Subtasks:**

- [x] **Import detectWebGLSupport** from infrastructure utilities - Used WEBGL_DETECTOR via DI
- [x] **Verify crtConfig** is already `CRT_CONFIGS.small` (no change needed) - Verified correct
- [x] **Update initialization logic** - Add WebGL detection for first-time users
- [x] **Update CRT_PRESET_KEYS imports** to use SMALL_WEBGL/SMALL_CSS
- [x] **Replace hardcoded preset** `CRT_PRESETS[CRT_PRESET_KEYS.IMAGE_WEBGL]` with detection logic
- [x] **Verify storage key** remains `'video-compact'` (backward compatibility) - Confirmed unchanged

**Testing Subtask:**

- [x] **Write Tests**: Verify initialization behavior and preset selection - 26 tests passing

**Key Implementation Notes:**

- Component already uses `CRT_CONFIGS.small` - no config change needed
- Currently defaults to `IMAGE_WEBGL` - replace with detection logic
- Storage key is `'video-compact'` - keep unchanged
- WebGL detection only for first-time users (no saved settings)
- Similar initialization pattern to file-image component

**Testing Focus for Task 3:**

**Behaviors to Test:**

- [x] **With saved settings: loads saved values** (ignores WebGL detection) - ✅ Verified
- [x] **Without saved settings + WebGL available: uses SMALL_WEBGL preset** - ✅ Verified
- [x] **Without saved settings + WebGL unavailable: uses SMALL_CSS preset** - ✅ Verified
- [x] **crtConfig property is CRT_CONFIGS.small** - ✅ Verified
- [x] **Storage key is 'video-compact'** (unchanged) - ✅ Verified
- [x] **Video device enumeration still works** (no regression) - ✅ Verified

**Testing Reference:**

- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) for component testing patterns
- Similar testing approach to file-image component

</details>

---

<details open>
<parameter name="summary"><h3>Task 4: Update Video-Dialog Component</h3></summary>

**Purpose**: Refactor video-dialog component to use LARGE preset with WebGL detection, replacing hardcoded settings with clean preset initialization.

**Related Documentation:**

- [Video-Dialog Component](../../../../libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts)

**Implementation Subtasks:**

- [ ] **Import detectWebGLSupport** from infrastructure utilities
- [ ] **Update crtConfig** from `CRT_CONFIGS.full` to `CRT_CONFIGS.large`
- [ ] **Replace hardcoded crtSettings signal** with initialization logic
- [ ] **Update CRT_PRESET_KEYS imports** to use LARGE_WEBGL/LARGE_CSS
- [ ] **Implement WebGL detection in constructor** for first-time users
- [ ] **Verify storage key** remains `'video-dialog'` (backward compatibility)
- [ ] **Remove DEFAULT_CRT_SETTINGS usage** (use LARGE preset instead)

**Testing Subtask:**

- [ ] **Write Tests**: Verify initialization behavior and preset selection

**Key Implementation Notes:**

- Component currently has hardcoded crtSettings with inline values - replace with preset
- Update config from `CRT_CONFIGS.full` to `CRT_CONFIGS.large` (renamed in Phase 1)
- Storage key is `'video-dialog'` - keep unchanged
- Dialog receives stream and device info via MAT_DIALOG_DATA - initialization in constructor
- WebGL detection pattern same as other components

**Current Hardcoded Values (to remove)**:
```typescript
crtSettings = signal<CrtSettings>({
  scanlineIntensity: 0.50,
  scanlineSize: 2.5,
  vignetteStrength: 1.30,
  // ... many more hardcoded values
});
```

**Testing Focus for Task 4:**

**Behaviors to Test:**

- [ ] **With saved settings: loads saved values** (ignores WebGL detection)
- [ ] **Without saved settings + WebGL available: uses LARGE_WEBGL preset**
- [ ] **Without saved settings + WebGL unavailable: uses LARGE_CSS preset**
- [ ] **crtConfig property is CRT_CONFIGS.large**
- [ ] **Storage key is 'video-dialog'** (unchanged)
- [ ] **Dialog initialization with MAT_DIALOG_DATA works** (no regression)

**Testing Reference:**

- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) for dialog testing patterns
- Mock MatDialogRef and MAT_DIALOG_DATA in tests

</details>

---

<details open>
<parameter name="summary"><h3>Task 5: Update Component Tests</h3></summary>

**Purpose**: Update all component test files to reflect new preset structure, WebGL detection behavior, and removed overrides.

**Related Documentation:**

- [Testing Standards](../../../TESTING_STANDARDS.md)
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)

**Implementation Subtasks:**

- [ ] **Update file-image.component.spec.ts** - Test new initialization logic
- [ ] **Update video-capture.component.spec.ts** - Test preset selection with detection
- [ ] **Update video-dialog.component.spec.ts** - Test dialog initialization with LARGE preset
- [ ] **Mock detectWebGLSupport** in tests - Test both true/false scenarios
- [ ] **Update preset key expectations** - Old keys to new keys (IMAGE_WEBGL → SMALL_WEBGL, etc.)
- [ ] **Remove override-related tests** - No more forced curvature or brightness tests
- [ ] **Add detection bypass tests** - Verify saved settings skip detection

**Testing Subtask:**

- [ ] **Run all tests**: Verify complete test suite passes

**Key Implementation Notes:**

- Each component test should cover: saved settings scenario, WebGL available scenario, WebGL unavailable scenario
- Mock `crtStorage.load()` to return null (first-time user) or mock settings (existing user)
- Mock `detectWebGLSupport()` to control which preset branch executes
- Verify correct preset keys are used in expectations
- Test storage key hasn't changed (backward compatibility check)

**Testing Focus for Task 5:**

**Test Coverage Requirements:**

- [ ] **File-image tests cover all initialization paths** (saved, WebGL true, WebGL false)
- [ ] **Video-capture tests cover all initialization paths**
- [ ] **Video-dialog tests cover all initialization paths**
- [ ] **Config property tests verify small/large assignment**
- [ ] **Storage key tests verify backward compatibility**
- [ ] **No tests for removed overrides remain** (curvature locking, brightness forcing)

**Testing Reference:**

- See existing component test files for test structure patterns
- Use `TestBed.configureTestingModule` with necessary mocks
- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) for mocking strategies

</details>

---

<details open>
<parameter name="summary"><h3>Task 6: Integration Testing</h3></summary>

**Purpose**: Verify all three components work correctly together with new preset system through manual and automated integration testing.

**Related Documentation:**

- [E2E Testing Guide](../../../../apps/teensyrom-ui-e2e/E2E_TESTS.md)

**Implementation Subtasks:**

- [ ] **Manual test file-image** - Verify Small preset loads and displays correctly
- [ ] **Manual test video-capture** - Verify Small preset with video stream
- [ ] **Manual test video-dialog** - Verify Large preset in fullscreen dialog
- [ ] **Test preset switching** - Verify settings panel dropdown shows new preset names
- [ ] **Test custom preset creation** - Verify save/load custom presets still works
- [ ] **Test storage migration** - Verify existing saved settings continue working
- [ ] **Check WebGL detection** - Test on browsers with/without WebGL support

**Testing Subtask:**

- [ ] **Document findings**: Note any issues or unexpected behavior

**Key Implementation Notes:**

- Focus on real-world usage scenarios
- Verify visual quality of CRT effects hasn't degraded
- Test preset transitions (Small → Large when opening dialog)
- Verify settings persistence across page reloads
- Check browser DevTools for any console errors

**Testing Focus for Task 6:**

**Integration Scenarios:**

- [ ] **First-time user sees appropriate defaults** (WebGL or CSS based on browser)
- [ ] **Existing user sees saved settings** (no changes from migration)
- [ ] **Preset switching works smoothly** in settings panel
- [ ] **Video device selection still works** (no regression from changes)
- [ ] **Fullscreen toggle still works** in video-dialog
- [ ] **CRT effect quality is maintained** (no visual regressions)

**Testing Reference:**

- Manual testing checklist for each component
- Visual regression testing if tools available
- Cross-browser testing (Chrome, Firefox, Edge, Safari)

</details>

---

## 🗂️ Files Modified or Created

**New Files:**

- `libs/infrastructure/src/lib/utils/webgl-detector.ts` - WebGL capability detection utility

**Modified Files:**

- `libs/infrastructure/src/lib/utils/index.ts` - Export new utility
- `libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.ts` - Use SMALL preset, remove overrides
- `libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.spec.ts` - Update tests
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts` - Use SMALL preset with detection
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.spec.ts` - Update tests
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts` - Use LARGE preset with detection
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.spec.ts` - Update tests

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

> **IMPORTANT:** Tests are written **within each task above**, not here. This section is only a summary for quick reference.

### Test Execution Commands

**Running Tests:**

```powershell
# Run infrastructure tests
pnpm nx test infrastructure

# Run player feature tests
pnpm nx test player

# Run tests in watch mode
pnpm nx test player --watch

# Run all tests
pnpm nx run-many --target=test --all
```

### Expected Test Coverage

**Infrastructure Layer:**
- WebGL detection utility returns correct values for different environments
- Function handles SSR, exceptions, and missing WebGL gracefully

**Component Layer:**
- Each component initializes with correct preset based on WebGL availability
- Saved settings always override WebGL detection
- Config properties use correct small/large variants
- Storage keys remain unchanged for backward compatibility

**Integration Layer:**
- Components work together correctly with new preset system
- Settings panel shows new preset names in dropdown
- Preset switching updates components correctly
- Custom preset save/load continues working

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

**Functional Requirements:**

- [ ] All implementation tasks completed and checked off
- [ ] All subtasks within each task completed
- [ ] Code follows [Coding Standards](../../../CODING_STANDARDS.md)
- [ ] WebGL detection utility created and exported

**Component Requirements:**

- [ ] File-image component uses SMALL preset
- [ ] Video-capture component uses SMALL preset
- [ ] Video-dialog component uses LARGE preset
- [ ] All component-specific CRT overrides removed
- [ ] Components properly detect WebGL for first-time users
- [ ] Saved settings always override detection

**Testing Requirements:**

- [ ] All testing subtasks completed within each task
- [ ] All behavioral test checkboxes verified
- [ ] Tests written alongside implementation (not deferred)
- [ ] All tests passing with no failures
- [ ] Test coverage maintained or improved

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes with no errors (`pnpm nx lint`)
- [ ] Code formatting is consistent
- [ ] No console errors when running application
- [ ] Visual quality of CRT effects maintained

**Integration:**

- [ ] All three components work correctly with new presets
- [ ] Settings panel dropdown shows new preset names
- [ ] Custom preset creation/deletion still works
- [ ] Storage persistence works across page reloads

**Ready for Next Phase:**

- [ ] All success criteria met
- [ ] No known bugs or issues
- [ ] Ready for Phase 3 (User Tuning)

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Design Decisions

- **WebGL Detection Utility**: Simple pure function in infrastructure, no service overhead, tree-shakable
- **Storage Key Stability**: Keeping existing keys avoids migration logic and preserves user settings
- **Initialization Priority**: Saved settings > WebGL detection > preset fallback ensures user preferences respected
- **Override Removal**: File-image's special handling removed for architectural cleanliness

### Implementation Constraints

- **Backward Compatibility Required**: Existing user settings must continue working without data migration
- **No Storage Schema Changes**: Storage format unchanged, only preset key references updated
- **Visual Quality Maintained**: CRT effect quality should not degrade from refactoring

### Phase Transition Notes

- **Ready for Tuning**: After this phase, user can manually adjust settings in each component
- **Phase 3 Input**: User will provide final tuned values for each preset after real-world testing
- **Production Values**: Phase 3 replaces placeholder inherited values with battle-tested defaults

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

</details>
