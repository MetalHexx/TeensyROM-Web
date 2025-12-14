# CRT Preset Simplification - Master Plan

**Project Overview**: Simplify CRT effect preset system from six variants (Fullscreen/Dialog/Image × CSS/WebGL) to two size-based variants (Small/Large × CSS/WebGL). This refactoring eliminates redundant presets, establishes clear size-based defaults for different component contexts, and implements intelligent WebGL capability detection for first-time users while preserving all user customizations.

**Standards Documentation**:

- **Coding Standards**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)
- **Component Library**: [COMPONENT_LIBRARY.md](../../COMPONENT_LIBRARY.md)
- **Style Guide**: [STYLE_GUIDE.md](../../STYLE_GUIDE.md)

---

## 🎯 Project Objective

The current CRT preset system has six built-in presets (FULLSCREEN_CSS, FULLSCREEN_WEBGL, DIALOG_CSS, DIALOG_WEBGL, IMAGE_CSS, IMAGE_WEBGL) which create confusion and maintenance overhead. The distinction between "fullscreen", "dialog", and "image" contexts is unclear, and `CRT_CONFIGS` has drifted (standard and small configs are identical).

This project simplifies the system to two clear, size-based variants: **Small** (for compact displays like file-image thumbnails and video-capture compact view) and **Large** (for fullscreen contexts like video-dialog). Each variant will have CSS and WebGL sub-variants, with intelligent defaults based on platform capabilities for first-time users.

**User Value**: Users get clearer, more consistent CRT effects across different viewing contexts. The simplified preset system is easier to understand and customize. Platform-appropriate defaults (WebGL when available, CSS fallback) ensure optimal visual quality without user intervention. All existing user preferences are preserved during migration.

**Technical Benefits**: Reduced code complexity, clearer naming conventions, elimination of duplicate configurations, and a streamlined settings panel that adapts to component context (small vs large).

---

## 📋 Implementation Phases

<details open>
<summary><h3>Phase 1: Preset Structure Refactoring</h3></summary>

### Objective

Refactor domain layer preset constants and UI layer preset definitions to establish the new Small/Large structure. Update `CRT_CONFIGS` to match usage patterns. This phase focuses purely on structural changes without modifying component implementations.

### Key Deliverables

- [ ] Domain layer `CRT_PRESET_KEYS` updated to four keys (SMALL_CSS, SMALL_WEBGL, LARGE_CSS, LARGE_WEBGL)
- [ ] UI layer `CRT_PRESETS` object updated with new keys and values
- [ ] `CRT_PRESET_LABELS` updated for dropdown display
- [ ] `CRT_CONFIGS` simplified to small/large variants
- [ ] `DEFAULT_CRT_SETTINGS` points to LARGE_WEBGL
- [ ] All tests passing after refactoring

### High-Level Tasks

1. **Update Domain Preset Constants**: Modify `CRT_PRESET_KEYS` in domain layer to new structure
2. **Refactor UI Preset Definitions**: Update `CRT_PRESETS` object with Small/Large variants
3. **Update Preset Labels**: Modify `CRT_PRESET_LABELS` for UI display
4. **Simplify CRT Configs**: Reduce `CRT_CONFIGS` to match actual usage
5. **Update Default Setting**: Change `DEFAULT_CRT_SETTINGS` reference
6. **Run Tests**: Verify no regressions in existing tests

### Open Questions for Phase 1

- **Preset Value Inheritance**: Small presets will inherit IMAGE values (scanline ~0.3, vignette ~0.7), Large presets will inherit FULLSCREEN values (scanline ~0.6, vignette ~1.5, curvature ~115). Confirmed with user.
- **Config Naming**: `CRT_CONFIGS.small` will hide curvature (for compact displays), `CRT_CONFIGS.large` will show all controls. Confirmed with user.

</details>

---

<details open>
<summary><h3>Phase 2: Component Implementation</h3></summary>

### Objective

Update all three components (file-image, video-capture, video-dialog) to use new preset structure with intelligent WebGL detection for first-time users. Remove component-specific CRT overrides and establish clean initialization patterns.

### Key Deliverables

- [ ] `file-image` component uses SMALL preset with WebGL detection
- [ ] `video-capture` component uses SMALL preset with WebGL detection
- [ ] `video-dialog` component uses LARGE preset with WebGL detection
- [ ] WebGL detection utility function created in infrastructure layer
- [ ] All component-specific CRT overrides removed
- [ ] Storage keys remain unchanged (backward compatibility)
- [ ] Component tests updated and passing

### High-Level Tasks

1. **Create WebGL Detection Utility**: Add `detectWebGLSupport()` function to infrastructure
2. **Update File-Image Component**: Remove special overrides, use SMALL preset with detection
3. **Update Video-Capture Component**: Use SMALL preset with detection
4. **Update Video-Dialog Component**: Use LARGE preset with detection
5. **Update Component Tests**: Verify initialization and preset selection logic
6. **Integration Testing**: Verify all components work correctly with new presets

### Open Questions for Phase 2

- **Detection Timing**: WebGL detection should happen during component initialization, before loading saved settings. If saved settings exist (including renderMode), they override detection results.
- **Fallback Behavior**: The `crt-effect-wrapper` already handles runtime WebGL fallback, so components just need to choose the right initial preset.

</details>

---

<details open>
<summary><h3>Phase 3: Default Value Tuning</h3></summary>

### Objective

User will manually test and tune default values for Small and Large presets in each component context, then provide final values to hardcode as production defaults. This ensures presets are optimized for real-world usage patterns.

### Key Deliverables

- [ ] User provides tuned values for SMALL_CSS preset
- [ ] User provides tuned values for SMALL_WEBGL preset
- [ ] User provides tuned values for LARGE_CSS preset
- [ ] User provides tuned values for LARGE_WEBGL preset
- [ ] Preset values updated in `crt-settings.defaults.ts`
- [ ] Documentation updated with new preset recommendations
- [ ] Final testing across all components with production values

### High-Level Tasks

1. **User Testing Phase**: User tests each component and adjusts CRT settings via UI
2. **Value Collection**: User provides final settings for each preset
3. **Update Preset Definitions**: Hardcode user-provided values into preset objects
4. **Documentation Update**: Update component library docs with new preset guidance
5. **Final Verification**: Test all components with production default values

### Open Questions for Phase 3

- **Testing Scope**: User should test each component in typical usage scenarios (file browsing, compact video capture, fullscreen video dialog)
- **Value Format**: User will provide complete `CrtSettings` objects for each preset

</details>

---

## 🏗️ Architecture Overview

### Key Design Decisions

- **Size-Based Naming**: "Small" and "Large" clearly communicate the intended usage context (compact views vs fullscreen), eliminating confusion about "dialog" vs "fullscreen" vs "image"
- **WebGL Detection**: Use existing `CrtRenderer.isSupported()` wrapped in infrastructure utility, components call during initialization for first-time users only
- **Backward Compatibility**: Storage keys remain unchanged (`file-image`, `video-compact`, `video-dialog`) to preserve existing user preferences
- **Config Simplification**: `CRT_CONFIGS.small` hides curvature slider (not relevant for compact displays), `CRT_CONFIGS.large` shows all controls
- **Remove Component Overrides**: File-image's special handling (locked curvature, brightness overrides) removed in favor of clean preset usage

### Integration Points

- **Domain Layer** (`libs/domain/src/lib/models/crt-preset-names.const.ts`): Defines `CRT_PRESET_KEYS` constants as single source of truth
- **UI Layer** (`libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`): Implements `CRT_PRESETS` and `CRT_CONFIGS` objects
- **Infrastructure Layer** (`libs/infrastructure`): New WebGL detection utility consumed by components
- **Feature Components** (`libs/features/player`): file-image, video-capture, video-dialog components updated to use new presets
- **CRT Storage** (`libs/domain/src/lib/services/crt-storage.contract.ts`): Existing storage service, no changes needed

### Migration Strategy

**No Breaking Changes**: Existing saved settings remain valid. Users with saved preferences continue using their customizations. First-time users get new simplified presets with intelligent defaults.

**Preset Name Migration**: Old preset names (default-fullscreen-webgl, etc.) may exist in saved custom presets. These remain functional but new presets use simplified naming.

---

## 🧪 Testing Strategy

### Unit Tests

- [ ] Domain layer: Preset constant values are correct
- [ ] UI layer: Preset objects have all required properties
- [ ] UI layer: CRT_CONFIGS have expected structure
- [ ] Infrastructure: WebGL detection function returns boolean
- [ ] Components: Initialization chooses correct preset based on WebGL support
- [ ] Components: Saved settings override default preset selection

### Integration Tests

- [ ] Component initialization flow with no saved settings (uses WebGL detection)
- [ ] Component initialization flow with saved settings (ignores detection, uses saved)
- [ ] Settings panel shows correct presets in dropdown
- [ ] Preset selection updates component settings
- [ ] Storage save/load operations preserve user preferences

### E2E Tests

- [ ] File-image component displays with Small preset defaults
- [ ] Video-capture component displays with Small preset defaults
- [ ] Video-dialog component displays with Large preset defaults
- [ ] Settings panel allows switching between presets
- [ ] Custom preset creation and saving works correctly
- [ ] Settings persist across page reloads

---

## ✅ Success Criteria

- [ ] Six old presets reduced to four new presets (SMALL_CSS, SMALL_WEBGL, LARGE_CSS, LARGE_WEBGL)
- [ ] All three components use simplified preset structure
- [ ] WebGL detection works for first-time users
- [ ] Saved user preferences preserved and continue working
- [ ] No component-specific CRT overrides remain (clean architecture)
- [ ] Settings panel dropdown shows clear "Small" and "Large" preset names
- [ ] CRT_CONFIGS simplified to small/large variants matching usage
- [ ] All unit, integration, and E2E tests passing
- [ ] Documentation updated with new preset guidance
- [ ] User-tuned default values applied in Phase 3

---

## 🎭 User Scenarios

### First-Time User Experience

<details open>
<summary><strong>Scenario 1: First Launch - WebGL Available</strong></summary>

```gherkin
Given user has never used the application before
And user's browser supports WebGL
When file-image component initializes
Then component loads SMALL_WEBGL preset by default
And CRT effects render using WebGL (no banding artifacts)
```

</details>

<details open>
<summary><strong>Scenario 2: First Launch - WebGL Unavailable</strong></summary>

```gherkin
Given user has never used the application before
And user's browser does NOT support WebGL
When video-capture component initializes
Then component loads SMALL_CSS preset by default
And CRT effects render using CSS (with potential banding at zoom levels)
```

</details>

---

### Existing User Experience

<details open>
<summary><strong>Scenario 3: User with Saved Settings</strong></summary>

```gherkin
Given user has previously customized CRT settings
And user's settings are saved in localStorage
When any component initializes
Then component loads saved settings (ignoring WebGL detection)
And user's custom values are applied
And renderMode from saved settings is respected
```

</details>

<details open>
<summary><strong>Scenario 4: Preset Selection After Migration</strong></summary>

```gherkin
Given user opens CRT settings panel
When user clicks preset dropdown
Then dropdown shows "Small (CSS)", "Small (WebGL)", "Large (CSS)", "Large (WebGL)"
And user can select any preset
And selected preset values update immediately
```

</details>

---

### Settings Management

<details open>
<summary><strong>Scenario 5: Custom Preset Creation</strong></summary>

```gherkin
Given user has adjusted CRT settings to their preference
When user saves settings as custom preset
Then preset is saved with "custom-" prefix
And preset appears in dropdown menu
And preset can be selected in any component
```

</details>

<details open>
<summary><strong>Scenario 6: Switching Between Components</strong></summary>

```gherkin
Given user is viewing file-image with Small preset
When user opens video in fullscreen dialog
Then video-dialog loads Large preset (or saved settings for dialog context)
And CRT intensity is appropriately stronger for fullscreen viewing
```

</details>

---

### Edge Cases

<details open>
<summary><strong>Scenario 7: WebGL Context Loss</strong></summary>

```gherkin
Given component is using WebGL rendering
When WebGL context is lost (driver crash, tab backgrounded, etc.)
Then crt-effect-wrapper automatically falls back to CSS rendering
And user sees effects continue without interruption
And no user intervention required
```

</details>

<details open>
<summary><strong>Scenario 8: Storage Migration</strong></summary>

```gherkin
Given user has settings saved under old preset names
When component loads saved settings
Then settings values are applied correctly
And user can continue using their customizations
And user can switch to new simplified preset names
```

</details>

---

## 📚 Related Documentation

- **CRT Effect System**: [COMPONENT_LIBRARY_CRT.md](../../COMPONENT_LIBRARY_CRT.md) - Complete CRT system documentation
- **Component Library**: [COMPONENT_LIBRARY.md](../../COMPONENT_LIBRARY.md) - Reusable component catalog
- **WebGL Renderer**: `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts` - WebGL implementation
- **CRT Storage**: `libs/domain/src/lib/services/crt-storage.contract.ts` - Settings persistence

---

## 📝 Notes

### Design Considerations

- **Preset Value Inheritance**: Small presets inherit from current IMAGE presets (subtle effects), Large presets inherit from current FULLSCREEN presets (strong effects including curvature)
- **WebGL Detection Utility**: Simple pure function in infrastructure layer, no service overhead, can be tree-shaken if unused
- **Storage Key Stability**: Keeping existing keys (`file-image`, `video-compact`, `video-dialog`) avoids breaking user settings and eliminates need for migration logic
- **Config Drift Resolution**: `CRT_CONFIGS.standard` and `CRT_CONFIGS.small` were identical (both hide curvature), now collapsed into single `small` config

### Future Enhancement Ideas

- **Preset Import/Export**: Allow users to share custom presets via JSON export/import
- **Per-Component Preset Defaults**: User could set different default presets for each component context
- **Advanced WebGL Features**: Bloom, chromatic aberration, barrel distortion could be exposed in Large preset when WebGL is available
- **Preset Preview**: Show visual preview of preset in settings panel before applying

### Summary of Open Questions

**Phase 1:**
- Preset value inheritance confirmed (Small ← IMAGE, Large ← FULLSCREEN)
- Config naming confirmed (small hides curvature, large shows all)

**Phase 2:**
- WebGL detection timing confirmed (during init, before loading saved settings)
- Saved settings always override detection results

**Phase 3:**
- User will provide tuned values after real-world testing
- Values will be hardcoded as production defaults

---

## 🚀 Execution Summary

**Total Phases**: 3  
**Estimated Complexity**: Medium  
**Dependencies**: None (self-contained refactoring)

**Phase 1** (Preset Structure Refactoring):
- Updates domain and UI layers
- No component changes
- Pure structural refactoring
- **Estimated**: 6-8 tasks

**Phase 2** (Component Implementation):
- Updates all three components
- Creates WebGL detection utility
- Removes component overrides
- **Estimated**: 7-9 tasks

**Phase 3** (Default Value Tuning):
- User-driven testing phase
- Quick value updates
- Final verification
- **Estimated**: 3-5 tasks

**First Task**: CRT-PRESET-SIMPLIFICATION-TASK-01-001-DOMAIN-PRESET-KEYS  
**Critical Path**: Phase 1 → Phase 2 → Phase 3 (sequential)
