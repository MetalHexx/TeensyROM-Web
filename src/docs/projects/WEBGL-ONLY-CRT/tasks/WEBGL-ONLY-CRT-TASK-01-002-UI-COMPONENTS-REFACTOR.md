# Task Handoff: UI Components Refactoring

**Task ID**: WEBGL-ONLY-CRT-TASK-01-002-UI-COMPONENTS-REFACTOR  
**Task Name**: Remove CSS Rendering Mode from CRT Components  
**Assigned To**: Clean Coder  
**Priority**: High  
**Estimated Context Size**: Large (9-15 files)

---

## 🎯 Objective

**What**: Remove CSS rendering logic from `crt-effect-wrapper` component and mode switching controls from `crt-settings-panel`. Remove CSS presets from defaults while retaining CSS filters used by WebGL.

**Why**: CSS rendering mode is eliminated, so components should only support WebGL rendering. Mode switching UI is no longer needed.

**Success Criteria**:
- [ ] CSS presets removed from `CRT_PRESETS` constant
- [ ] `CRT_RENDER_MODES` enum removed
- [ ] `CRT_PRESET_LABELS` only shows WebGL variants
- [ ] crt-effect-wrapper has no CSS rendering fallback
- [ ] Settings panel has no mode switcher UI
- [ ] `.css-mode` and `.webgl-mode` classes removed
- [ ] Brightness/contrast/saturation CSS filters retained
- [ ] 50+ unit tests passing

---

## 📋 Context & Dependencies

**Prerequisites Completed**:
- WEBGL-ONLY-CRT-TASK-01-001-DOMAIN-INFRASTRUCTURE-CLEANUP

**Dependencies**:
- Domain layer no longer has renderMode or CSS preset keys
- CrtSettings interface updated

**Constraints**:
- Must keep CSS filters (brightness, contrast, saturation, hue) - used by WebGL
- Cannot break existing saved settings (graceful degradation)
- Must follow Angular 19 patterns

---

## 📂 File Scope

**Files to MODIFY**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - Remove CSS presets
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts` - Remove CRT_RENDER_MODES
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts` - Remove CSS rendering logic
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.html` - Simplify template
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss` - Remove CSS-mode classes
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Remove mode switcher
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html` - Remove mode toggle UI
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.scss` - Remove mode styles

**Tests to UPDATE**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.spec.ts` - Remove CSS preset tests
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.spec.ts` - Remove CSS rendering tests
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts` - Remove mode switcher tests

---

## 🛠️ Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md)
- [Testing Standards](../../../TESTING_STANDARDS.md)
- [Component Library](../../../COMPONENT_LIBRARY.md)

### Part 1: Update Preset Defaults (`crt-settings.defaults.ts`)

1. **Remove CSS Presets**:
   - Delete `[CRT_PRESET_KEYS.SMALL_CSS]: { ... }` from CRT_PRESETS
   - Delete `[CRT_PRESET_KEYS.LARGE_CSS]: { ... }` from CRT_PRESETS
   - Keep `SMALL_WEBGL` and `LARGE_WEBGL` presets unchanged
   
2. **Update Preset Labels**:
   - Remove `[CRT_PRESET_KEYS.SMALL_CSS]: 'Small (CSS)'` from CRT_PRESET_LABELS
   - Remove `[CRT_PRESET_KEYS.LARGE_CSS]: 'Large (CSS)'` from CRT_PRESET_LABELS
   - Keep WebGL labels
   
3. **Update Default Settings**:
   - Verify `DEFAULT_CRT_SETTINGS` still points to `LARGE_WEBGL`

### Part 2: Remove Render Modes Enum (`crt-settings.interface.ts`)

1. **Remove CRT_RENDER_MODES**:
   - Delete the `CRT_RENDER_MODES` constant/enum
   - Remove any references to it in JSDoc comments
   - Remove export if it exists

### Part 3: Simplify CRT Effect Wrapper (`crt-effect-wrapper.component.ts`)

1. **Remove CSS Rendering Logic**:
   - Component should always initialize WebGL renderer
   - Remove any conditionals based on `settings.renderMode`
   - Remove fallback to CSS rendering
   
2. **Keep WebGL Renderer**:
   - Existing `CrtRenderer` (WebGL canvas) should be the only rendering path
   - CSS filters for color correction remain (brightness, contrast, saturation, hue)
   
3. **Simplify Template** (`crt-effect-wrapper.component.html`):
   - Remove any `@if` blocks checking renderMode
   - Always show WebGL canvas
   - Keep CSS filter application on content wrapper

### Part 4: Update Styles (`crt-effect-wrapper.component.scss`)

1. **Keep These CSS Properties** (used by WebGL):
   ```scss
   filter: contrast(var(--crt-contrast, 1))
     brightness(calc(var(--crt-brightness, 1) * var(--crt-brightness, 1) * var(--crt-brightness, 1)))
     saturate(var(--crt-saturation, 1))
     hue-rotate(var(--crt-hue, 0deg));
   ```
   
2. **Remove These** (CSS-mode specific):
   - Any `.css-mode` class definitions
   - Any CSS-only rendering styles that aren't used by WebGL

### Part 5: Remove Mode Switcher (`crt-settings-panel.component.ts`)

1. **Remove Mode Toggle**:
   - Remove any render mode dropdown/toggle button
   - Remove mode switching methods
   - Remove mode state signals
   
2. **Keep Preset Selector**:
   - Preset dropdown should now only show "Small (WebGL)" and "Large (WebGL)"
   - No mode-specific logic needed

### Part 6: Update Settings Panel UI (`crt-settings-panel.component.html`)

1. **Remove Mode Controls**:
   - Delete render mode toggle button section
   - Delete any mode-related labels/icons
   
2. **Keep All Other Controls**:
   - Preset selector (now simpler with only 2 options)
   - Scanline controls
   - Color filter controls
   - All other sliders

### Part 7: Clean Up Settings Panel Styles (`crt-settings-panel.component.scss`)

1. **Remove These Classes**:
   - `.css-mode` and associated hover states
   - `.webgl-mode` and associated hover states
   - `.mode-option` (if only used for mode dropdown)
   - Any mode-switching button styles

---

## 🧪 Testing Requirements

**Unit Tests** (50+ tests):

**Preset Defaults Tests** (~15 tests):
- [ ] Verify CRT_PRESETS only contains SMALL_WEBGL and LARGE_WEBGL
- [ ] Verify both presets have all required CrtSettings properties
- [ ] Verify CRT_PRESET_LABELS matches available presets
- [ ] Verify DEFAULT_CRT_SETTINGS points to valid preset

**CRT Effect Wrapper Tests** (~20 tests):
- [ ] Component initializes WebGL renderer
- [ ] CSS filters applied to content wrapper
- [ ] Settings changes update WebGL renderer
- [ ] No renderMode conditionals in component
- [ ] Saved settings without renderMode load correctly

**Settings Panel Tests** (~15 tests):
- [ ] Preset dropdown shows only 2 options
- [ ] No mode switcher UI present
- [ ] Preset selection updates settings
- [ ] Custom preset creation works
- [ ] All slider controls functional

**Test Strategy**:
```bash
# Baseline before changes
pnpm nx test ui-components --watch=false

# Run tests as you make changes
pnpm nx test ui-components --watch

# Final verification
pnpm nx test ui-components --watch=false
pnpm nx lint ui-components
```

**Known Test Files**:
- `crt-settings.defaults.spec.ts` - Remove ~20 CSS preset tests
- `crt-effect-wrapper.component.spec.ts` - Remove ~10 CSS rendering tests
- `crt-settings-panel.component.spec.ts` - Remove ~10 mode switcher tests

---

## ⚠️ Important Notes

### CSS Filters Are NOT CSS Rendering Mode

The following CSS properties are **USED BY WEBGL** for post-processing and MUST be retained:

```scss
.crt-content {
  filter: contrast(var(--crt-contrast, 1))
    brightness(calc(var(--crt-brightness, 1) * var(--crt-brightness, 1) * var(--crt-brightness, 1)))
    saturate(var(--crt-saturation, 1))
    hue-rotate(var(--crt-hue, 0deg));
}
```

These are NOT part of "CSS rendering mode". They're color correction filters applied to the WebGL canvas output.

### Scanlines and Vignette

These effects are rendered by the WebGL shader, not CSS. Any CSS scanline fallback can be removed.

### Backward Compatibility

Old saved settings may have:
```json
{
  "renderMode": "css",  // Will be ignored
  "scanlineIntensity": 0.5,
  // ... other settings still work
}
```

Component should load settings and ignore renderMode if present.

---

## 📤 Output

**Report Location**: `docs/projects/WEBGL-ONLY-CRT/reports/WEBGL-ONLY-CRT-TASK-01-002-REPORT.md`

**Report Template**: [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

---

## ✅ Definition of Done

- [ ] CSS presets removed from constants
- [ ] CRT_RENDER_MODES enum removed
- [ ] crt-effect-wrapper simplified to WebGL only
- [ ] Settings panel mode switcher removed
- [ ] CSS-mode classes removed from styles
- [ ] CSS filters for color correction retained
- [ ] 50+ unit tests passing
- [ ] No TypeScript compilation errors
- [ ] No console errors in dev mode
- [ ] Completion report written
