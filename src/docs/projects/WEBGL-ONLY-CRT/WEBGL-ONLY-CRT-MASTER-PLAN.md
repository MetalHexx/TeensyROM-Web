# WebGL-Only CRT Rendering - Master Plan

**Project Overview**: Remove CSS rendering mode entirely from the CRT effect system. Make WebGL the only supported rendering mode, eliminating the need for WebGL detection, renderMode switching logic, CSS-specific presets, and related complexity. This simplifies the codebase, reduces maintenance burden, and ensures consistent high-quality rendering across all platforms.

**Standards Documentation**:

- **Coding Standards**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)
- **Component Library**: [COMPONENT_LIBRARY.md](../../COMPONENT_LIBRARY.md)
- **Style Guide**: [STYLE_GUIDE.md](../../STYLE_GUIDE.md)

---

## 🎯 Project Objective

The current CRT system supports two rendering modes: CSS (lightweight fallback) and WebGL (high-fidelity GPU rendering). This dual-mode approach adds complexity with WebGL detection logic, renderMode switching, CSS-specific presets (SMALL_CSS, LARGE_CSS), and CSS rendering classes. Modern browsers have excellent WebGL support, making the CSS fallback unnecessary.

This project **removes CSS rendering mode entirely**, keeping only WebGL as the required rendering method. This eliminates:
- WebGL detector service and detection logic
- CSS rendering mode presets (SMALL_CSS, LARGE_CSS)
- `renderMode` property from `CrtSettings`
- CSS rendering implementation in `crt-effect-wrapper`
- Mode switching UI in settings panel
- Component initialization logic for WebGL detection

**User Value**: Simplified, consistent CRT effects with no rendering mode confusion. Users always get the highest quality WebGL rendering without artifacts or banding issues. Cleaner settings UI without mode switching controls.

**Technical Benefits**: Reduced code complexity, elimination of platform detection logic, simpler component initialization, smaller bundle size, and removal of maintenance burden for dual rendering paths.

---

## 📋 Implementation Phases

<details open>
<summary><h3>Phase 1: WebGL-Only Refactoring</h3></summary>

### Objective

Remove all CSS rendering mode logic, WebGL detection services, and CSS-specific presets from the codebase. Refactor domain models, UI components, infrastructure services, and feature components to support only WebGL rendering. Update tests comprehensively to verify correct behavior.

### Key Deliverables

- [ ] WebGL detector service and infrastructure removed
- [ ] CSS presets (SMALL_CSS, LARGE_CSS) removed from constants
- [ ] `renderMode` property removed from `CrtSettings` interface
- [ ] CSS rendering logic removed from `crt-effect-wrapper` component
- [ ] Mode switching UI removed from settings panel
- [ ] All three feature components updated (file-image, video-capture, video-dialog)
- [ ] WebGL detection logic removed from component initialization
- [ ] Only WebGL-required CSS retained (brightness filter is used by WebGL)
- [ ] All unit tests updated and passing
- [ ] Integration tests verify WebGL-only rendering
- [ ] E2E tests confirm components work without CSS fallback

### High-Level Tasks

1. **Domain & Infrastructure Cleanup**: Remove WebGL detector contract, service, providers, and CSS preset constants
2. **UI Components Refactoring**: Remove CSS rendering logic from crt-effect-wrapper and settings panel
3. **Feature Components Update**: Remove detection logic from file-image, video-capture, and video-dialog components
4. **Testing & Verification**: Comprehensive test updates and verification across all layers *(Skipped)*
5. **Final CSS Render Mode Cleanup**: Comprehensive code audit to remove all lingering CSS render mode references, fallbacks, and backwards compatibility hacks

### Testing Strategy

**Unit Tests**:
- [ ] Domain: Verify CRT_PRESET_KEYS only contains SMALL_WEBGL and LARGE_WEBGL
- [ ] Domain: Verify CrtSettings interface no longer has renderMode property
- [ ] UI: Verify crt-effect-wrapper only renders WebGL canvas
- [ ] UI: Verify settings panel has no mode switching controls
- [ ] Components: Verify no WebGL detection calls in initialization
- [ ] Components: Verify presets correctly applied without renderMode

**Integration Tests**:
- [ ] CRT effect wrapper renders WebGL canvas with settings
- [ ] Settings panel updates propagate to WebGL renderer
- [ ] Component initialization uses correct preset without detection
- [ ] Saved settings load correctly (ignore old renderMode if present)

**E2E Tests**:
- [ ] File-image displays with Small WebGL preset
- [ ] Video-capture displays with Small WebGL preset
- [ ] Video-dialog displays with Large WebGL preset
- [ ] Settings panel shows only Small/Large presets (no CSS variants)
- [ ] Custom presets work without renderMode property

</details>

---

## 🏗️ Architecture Overview

### Key Design Decisions

- **WebGL Required**: Application will require WebGL support - no fallback
- **Preset Simplification**: Only two presets remain: SMALL (compact displays) and LARGE (fullscreen)
- **Keep Brightness CSS**: The `brightness` CSS filter is used by WebGL renderer for color correction, must be retained
- **Remove Scanline CSS**: CSS scanline overlay is WebGL-only feature, CSS-specific scanline styles removed
- **Storage Migration**: Old settings with `renderMode` property will load gracefully (property ignored)
- **Type Safety**: Remove `CrtRenderMode` type and related enums

### Affected Files

**Domain Layer**:
- `libs/domain/src/lib/models/crt-settings.model.ts` - Remove renderMode property
- `libs/domain/src/lib/models/crt-preset-names.const.ts` - Remove CSS preset keys
- `libs/domain/src/lib/contracts/webgl-detector.contract.ts` - **DELETE FILE**
- `libs/domain/src/lib/contracts/index.ts` - Remove WebGL detector export

**Infrastructure Layer**:
- `libs/infrastructure/src/lib/webgl/webgl-detector.service.ts` - **DELETE FILE**
- `libs/infrastructure/src/lib/webgl/webgl-detector.ts` - **DELETE FILE** (detection utility)
- `libs/infrastructure/src/lib/webgl/providers.ts` - Remove WEBGL_DETECTOR_PROVIDERS
- `libs/infrastructure/src/index.ts` - Remove WebGL detector exports

**UI Components Layer**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - Remove CSS presets
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts` - Remove CRT_RENDER_MODES enum
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts` - Simplify to WebGL only
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss` - Remove CSS-mode classes
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Remove mode switcher
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html` - Remove mode toggle UI
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.scss` - Remove mode-specific styles

**Feature Components**:
- `libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.ts`
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts`
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts`

**Tests** (all *.spec.ts files for above components)

### Critical CSS Analysis

**✅ KEEP - Used by WebGL**:
- `filter: brightness()` - Used in `.crt-content` for color correction
- `filter: contrast()` - Used in `.crt-content` for color correction
- `filter: saturate()` - Used in `.crt-content` for color correction
- `filter: hue-rotate()` - Used in `.crt-content` for color correction

**❌ REMOVE - CSS Mode Only**:
- `.css-mode` class and styles in settings panel
- CSS scanline rendering fallback (if any separate from WebGL overlay)
- Mode switching button styles and logic

### Migration Strategy

**Backward Compatible**: Saved settings with old `renderMode: 'css' | 'webgl'` property will load correctly. The property is simply ignored. No data migration needed.

**Preset Names**: Keep SMALL_WEBGL and LARGE_WEBGL as keys initially, can simplify to SMALL/LARGE in future cleanup (out of scope).

**No Breaking Changes**: Users continue using saved settings. WebGL is now always used regardless of old renderMode value.

---

## ✅ Success Criteria

- [ ] WebGL detector service completely removed from codebase
- [ ] CSS rendering mode presets removed (only SMALL_WEBGL, LARGE_WEBGL remain)
- [ ] `renderMode` property removed from `CrtSettings` interface
- [ ] CSS rendering logic removed from crt-effect-wrapper
- [ ] Mode switching removed from settings panel UI
- [ ] All three components simplified (no detection logic)
- [ ] Brightness CSS filter retained (used by WebGL)
- [ ] All unit tests passing (200+ test cases)
- [ ] All integration tests passing
- [ ] E2E tests confirm WebGL-only rendering works
- [ ] No console errors or warnings in browser
- [ ] Documentation updated to reflect WebGL-only approach

---

## 🎭 User Scenarios

### Existing Users

<details open>
<summary><strong>Scenario 1: User with Saved CSS Mode Settings</strong></summary>

```gherkin
Given user has previously saved CRT settings with renderMode: 'css'
When component initializes
Then saved settings load correctly (renderMode ignored)
And WebGL rendering is used
And user's other customizations (scanlines, brightness, etc.) are applied
And user sees no difference in visual appearance
```

</details>

<details open>
<summary><strong>Scenario 2: User with Saved WebGL Settings</strong></summary>

```gherkin
Given user has previously saved CRT settings with renderMode: 'webgl'
When component initializes
Then saved settings load correctly
And WebGL rendering continues working as before
And no behavior change for user
```

</details>

### New Users

<details open>
<summary><strong>Scenario 3: First Launch</strong></summary>

```gherkin
Given user is launching application for first time
When any CRT component initializes
Then component uses SMALL_WEBGL or LARGE_WEBGL preset
And WebGL rendering starts immediately
And no WebGL detection delay
```

</details>

### Settings Management

<details open>
<summary><strong>Scenario 4: Opening Settings Panel</strong></summary>

```gherkin
Given user opens CRT settings panel
When panel renders
Then only "Small (WebGL)" and "Large (WebGL)" presets shown
And no render mode toggle/switcher visible
And all other controls work as before
```

</details>

### Edge Cases

<details open>
<summary><strong>Scenario 5: Browser Without WebGL</strong></summary>

```gherkin
Given user's browser does not support WebGL (very rare)
When component initializes
Then WebGL renderer initialization fails gracefully
And user sees fallback message or blank display
And application does not crash
Note: This is acceptable as WebGL is now required
```

</details>

---

## 📚 Related Documentation

- **CRT Effect System**: [COMPONENT_LIBRARY_CRT.md](../../COMPONENT_LIBRARY_CRT.md) - Will need updates
- **WebGL Renderer**: `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts` - Core renderer
- **CRT Storage**: `libs/domain/src/lib/services/crt-storage.contract.ts` - Settings persistence (unchanged)

---

## 📝 Notes

### Why Remove CSS Mode?

1. **Modern Browser Support**: WebGL is supported in 98%+ of modern browsers (Can I Use: WebGL - 97.8% global support)
2. **Maintenance Burden**: Dual rendering paths require twice the testing and bug fixes
3. **Quality Inconsistency**: CSS mode has banding artifacts at non-100% zoom levels
4. **Code Complexity**: Detection logic, mode switching, and conditional rendering add complexity
5. **User Confusion**: "CSS vs WebGL" choice is technical detail users shouldn't manage

### Risks & Mitigations

**Risk**: Users on very old browsers without WebGL cannot use CRT effects  
**Mitigation**: Acceptable trade-off. WebGL has been widely supported since 2011. Users on such old browsers likely have other compatibility issues.

**Risk**: Breaking saved settings from users who explicitly chose CSS mode  
**Mitigation**: Settings load gracefully with renderMode ignored. Visual output may differ slightly but quality improves (no banding).

**Risk**: Removing detection utility could break other features  
**Mitigation**: Comprehensive search confirms WebGL detector only used for CRT system. No other dependencies.

### Future Cleanup Opportunities

- **Preset Naming**: Could simplify SMALL_WEBGL → SMALL, LARGE_WEBGL → LARGE (remove _WEBGL suffix since it's redundant)
- **Type Simplification**: Remove CrtRenderMode type entirely from domain models
- **Bundle Size**: Removing detection service and CSS rendering reduces bundle by ~2-3KB

---

## 🚀 Execution Summary

**Total Phases**: 1 (Single Large Phase)  
**Total Tasks**: 4 (Focused with extensive testing)  
**Estimated Complexity**: Medium-High  
**Dependencies**: None (self-contained refactoring)

### Task Breakdown

1. **WEBGL-ONLY-CRT-TASK-01-001-DOMAIN-INFRASTRUCTURE-CLEANUP** (Medium)
   - Remove WebGL detector service, contract, and providers
   - Remove CSS preset constants
   - Remove renderMode from CrtSettings
   - Update domain exports
   - **Testing**: 30+ unit tests

2. **WEBGL-ONLY-CRT-TASK-01-002-UI-COMPONENTS-REFACTOR** (Large)
   - Remove CSS rendering logic from crt-effect-wrapper
   - Remove mode switcher from settings panel
   - Remove CSS-mode specific styles
   - Keep brightness CSS filter
   - **Testing**: 50+ unit tests

3. **WEBGL-ONLY-CRT-TASK-01-003-FEATURE-COMPONENTS-UPDATE** (Medium)
   - Update file-image component (remove detection)
   - Update video-capture component (remove detection)
   - Update video-dialog component (remove detection)
   - Simplify initialization logic
   - **Testing**: 40+ unit tests

4. **WEBGL-ONLY-CRT-TASK-01-004-INTEGRATION-E2E-VERIFICATION** (Medium)
   - Integration tests for all components
   - E2E tests for CRT rendering workflows
   - Documentation updates
   - Final verification
   - **Testing**: 20+ integration tests, 10+ E2E tests

**First Task**: WEBGL-ONLY-CRT-TASK-01-001-DOMAIN-INFRASTRUCTURE-CLEANUP  
**Critical Path**: Tasks 1 → 2 → 3 → 4 (sequential dependencies)

---

## 📊 Test Coverage Goals

- **Unit Tests**: 140+ test cases across all layers
- **Integration Tests**: 20+ tests for component interactions
- **E2E Tests**: 10+ tests for user workflows
- **Target Coverage**: 95%+ for affected files
- **No Regressions**: All existing tests must pass or be updated appropriately
