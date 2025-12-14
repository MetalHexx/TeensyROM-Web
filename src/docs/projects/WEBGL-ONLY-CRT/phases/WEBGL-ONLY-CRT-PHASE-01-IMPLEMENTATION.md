# Phase 1: WebGL-Only CRT Implementation

## 🎯 Objective

Remove all CSS rendering mode logic from the CRT effect system, making WebGL the only supported rendering mode. This eliminates WebGL detection services, CSS-specific presets, renderMode switching UI, and component detection logic, resulting in a simpler, more maintainable codebase with consistent high-quality rendering.

---

## 📚 Required Reading

**Feature Documentation:**
- [x] [Master Plan](../WEBGL-ONLY-CRT-MASTER-PLAN.md) - Complete project overview

**Standards & Guidelines:**
- [x] [Coding Standards](../../../CODING_STANDARDS.md)
- [x] [Testing Standards](../../../TESTING_STANDARDS.md)
- [x] [Component Library](../../../COMPONENT_LIBRARY.md)
- [x] [Style Guide](../../../STYLE_GUIDE.md)

---

## 📂 File Structure Overview

```
libs/domain/src/lib/
├── models/
│   ├── crt-settings.model.ts               📝 Remove renderMode property
│   └── crt-preset-names.const.ts           📝 Remove CSS preset keys
├── contracts/
│   ├── webgl-detector.contract.ts          🗑️ DELETE FILE
│   └── index.ts                            📝 Remove WebGL exports

libs/infrastructure/src/lib/webgl/
├── webgl-detector.service.ts               🗑️ DELETE FILE
├── webgl-detector.ts                       🗑️ DELETE FILE (detection utility)
├── providers.ts                            📝 Remove WEBGL_DETECTOR_PROVIDERS
└── index.ts                                📝 Remove WebGL detector exports

libs/ui/components/src/lib/
├── crt-effect-wrapper/
│   ├── crt-settings.defaults.ts            📝 Remove CSS presets
│   ├── crt-settings.interface.ts           📝 Remove CRT_RENDER_MODES
│   ├── crt-effect-wrapper.component.ts     📝 Simplify to WebGL only
│   └── crt-effect-wrapper.component.scss   📝 Remove CSS-mode classes
├── crt-settings-panel/
│   ├── crt-settings-panel.component.ts     📝 Remove mode switcher
│   ├── crt-settings-panel.component.html   📝 Remove mode toggle UI
│   └── crt-settings-panel.component.scss   📝 Remove mode styles

libs/features/player/src/lib/player-view/player-device-container/
├── file-image/
│   └── file-image.component.ts             📝 Remove detection logic
├── video-capture/
│   └── video-capture.component.ts          📝 Remove detection logic
└── video-capture/video-dialog/
    └── video-dialog.component.ts           📝 Remove detection logic

tests/ (All *.spec.ts files for above)      📝 Update 140+ tests
```

---

<details open>
<summary><h3>Task 1: Domain & Infrastructure Cleanup</h3></summary>

**Purpose**: Remove WebGL detector service, contract, and providers from domain/infrastructure layers. Remove CSS preset constants and renderMode property.

**Deliverables**:
- [ ] Delete `webgl-detector.contract.ts` from domain contracts
- [ ] Delete `webgl-detector.service.ts` from infrastructure
- [ ] Delete `webgl-detector.ts` utility function
- [ ] Remove WEBGL_DETECTOR_PROVIDERS from providers
- [ ] Update domain/infrastructure index exports
- [ ] Remove CSS preset keys (SMALL_CSS, LARGE_CSS) from constants
- [ ] Remove `renderMode` property from CrtSettings interface
- [ ] Remove `CrtRenderMode` type definition
- [ ] **Unit tests**: 30+ tests updated/verified

**Success Criteria**:
- [ ] No WebGL detector references remain in domain/infrastructure
- [ ] CRT_PRESET_KEYS only contains SMALL_WEBGL, LARGE_WEBGL
- [ ] CrtSettings interface has no renderMode property
- [ ] All domain/infrastructure unit tests passing
- [ ] No TypeScript compilation errors

</details>

---

<details open>
<summary><h3>Task 2: UI Components Refactoring</h3></summary>

**Purpose**: Remove CSS rendering logic from crt-effect-wrapper and mode switching from settings panel. Retain CSS filters used by WebGL (brightness, contrast, etc.).

**Deliverables**:
- [ ] Remove CSS presets (SMALL_CSS, LARGE_CSS) from defaults
- [ ] Remove CRT_RENDER_MODES enum from interface
- [ ] Update CRT_PRESET_LABELS to only show WebGL variants
- [ ] Simplify crt-effect-wrapper to WebGL-only rendering
- [ ] Remove mode switcher UI from settings panel
- [ ] Remove `.css-mode` and `.webgl-mode` CSS classes
- [ ] Keep brightness/contrast/saturation/hue CSS filters (used by WebGL)
- [ ] **Unit tests**: 50+ tests updated/verified

**Success Criteria**:
- [ ] CRT_PRESETS only contains SMALL_WEBGL, LARGE_WEBGL
- [ ] crt-effect-wrapper has no CSS rendering fallback logic
- [ ] Settings panel has no mode switching controls
- [ ] CSS filters for color correction retained
- [ ] All UI component unit tests passing
- [ ] No rendering mode conditionals in templates

</details>

---

<details open>
<summary><h3>Task 3: Feature Components Update</h3></summary>

**Purpose**: Remove WebGL detection logic from file-image, video-capture, and video-dialog components. Simplify initialization to directly use WebGL presets.

**Deliverables**:
- [ ] Remove WEBGL_DETECTOR injection from all three components
- [ ] Remove detection logic from component constructors/effects
- [ ] Update file-image to use SMALL_WEBGL directly
- [ ] Update video-capture to use SMALL_WEBGL directly
- [ ] Update video-dialog to use LARGE_WEBGL directly
- [ ] Remove detection-related imports
- [ ] **Unit tests**: 40+ component tests updated/verified

**Success Criteria**:
- [ ] No WEBGL_DETECTOR references in any component
- [ ] No detection conditionals in initialization logic
- [ ] Components directly load WebGL presets or saved settings
- [ ] All component unit tests passing
- [ ] Saved settings load correctly (renderMode ignored if present)

</details>

---

<details open>
<summary><h3>Task 4: Integration & E2E Verification</h3></summary>

**Purpose**: Comprehensive testing of WebGL-only rendering across all components. Verify integration, E2E workflows, and documentation updates.

**Deliverables**:
- [ ] Integration tests: Component initialization with WebGL presets
- [ ] Integration tests: Settings panel preset selection
- [ ] Integration tests: Saved settings backward compatibility
- [ ] E2E tests: File-image displays with Small preset
- [ ] E2E tests: Video-capture displays with Small preset
- [ ] E2E tests: Video-dialog displays with Large preset
- [ ] E2E tests: Settings panel shows only WebGL presets
- [ ] Update COMPONENT_LIBRARY_CRT.md (remove CSS mode docs)
- [ ] Update COMPONENT_LIBRARY.md if needed
- [ ] **Testing**: 20+ integration tests, 10+ E2E tests

**Success Criteria**:
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] No console errors or warnings in browser
- [ ] Documentation reflects WebGL-only approach
- [ ] Manual smoke testing confirms all workflows work
- [ ] Performance benchmarks show no regressions

</details>

---

## 🧪 Testing Strategy

### Unit Testing (140+ tests)

**Domain Layer** (10 tests):
- Verify CRT_PRESET_KEYS contains only SMALL_WEBGL, LARGE_WEBGL
- Verify CrtSettings interface structure (no renderMode)
- Verify preset value integrity

**Infrastructure Layer** (5 tests):
- Verify WebGL detector completely removed
- Verify no broken import paths

**UI Components** (85 tests):
- crt-effect-wrapper: WebGL rendering only (20 tests)
- crt-settings-panel: No mode switcher (25 tests)
- Preset defaults and labels correct (15 tests)
- CRT config structure valid (10 tests)
- CSS filter application correct (15 tests)

**Feature Components** (40 tests):
- file-image initialization (13 tests)
- video-capture initialization (13 tests)
- video-dialog initialization (14 tests)

### Integration Testing (20+ tests)

- Component initialization with correct presets
- Settings panel updates propagate to renderer
- Saved settings load gracefully (ignore renderMode)
- Preset selection updates component state
- Custom presets work without renderMode

### E2E Testing (10+ tests)

- File-image renders with Small WebGL preset
- Video-capture renders with Small WebGL preset
- Video-dialog renders with Large WebGL preset
- Settings panel shows only 2 presets
- Custom preset creation works
- Settings persist across page reloads

---

## ✅ Success Criteria

- [ ] All 4 tasks completed
- [ ] 140+ unit tests passing
- [ ] 20+ integration tests passing
- [ ] 10+ E2E tests passing
- [ ] No TypeScript compilation errors
- [ ] No console errors/warnings in browser
- [ ] Documentation updated
- [ ] Manual verification of all components successful
- [ ] Code review completed

---

## 🚀 Execution Notes

**Sequential Dependencies**: Tasks must be completed in order (1 → 2 → 3 → 4)

**Testing Approach**: Each task includes comprehensive testing before moving to next task

**Rollback Plan**: Git commits after each task to enable easy rollback if needed

---

## 📝 Discoveries During Implementation

_Document any unexpected findings, decisions made, or deviations from the plan here as work progresses._

---

## 📊 Final Metrics

_To be filled after completion:_

- **Files Deleted**: _[count]_
- **Files Modified**: _[count]_
- **Lines of Code Removed**: _[estimate]_
- **Tests Updated**: _[count]_
- **Total Test Coverage**: _[percentage]%_
