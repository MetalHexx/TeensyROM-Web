# Video Component Extraction & Composable Architecture

## 🎯 Project Objective

Extract shared video display functionality from `VideoCaptureComponent` and `VideoDialogComponent` into reusable, composable UI components following Single Responsibility Principle. The goal is to transform tightly-coupled video capture implementations into "dumb" presentation components that accept inputs and emit outputs without store dependencies.

**User Value**: Consistent video behavior everywhere in the application, CRT effects reusable for any content (not just video), and flexible overlay composition for different use cases.

**Technical Value**: Components are testable in isolation, reusable across features, and open for extension. New video-based features can compose these building blocks rather than duplicating code.

---

## 🧩 The Composability Problem

### Current State (Tightly Coupled)

The current implementation has two smart components that duplicate video handling logic:

```
VideoCaptureComponent (Player Feature)
├── Device enumeration logic
├── Stream acquisition via MediaDevices API  
├── Video element binding (srcObject, autoplay, muted)
├── Opens VideoDialogComponent as modal
└── Settings persistence via SettingsStore

VideoDialogComponent (Player Feature)
├── Video element binding (duplicate)
├── CRT effect CSS (8 parameters, 550+ lines SCSS)
├── Fullscreen management
├── Overlay positioning (toolbars, close button)
├── Settings persistence via SettingsStore
└── Player/Filter toolbar integration
```

**Problems**:
- Video element lifecycle logic duplicated
- CRT effects locked inside dialog - not reusable
- Overlay layout tightly coupled to specific toolbars
- Both components depend on SettingsStore (smart, not dumb)
- Testing requires mocking stores and services

### Target State (Composable)

After extraction, we have reusable presentation components:

```
libs/ui/components/
├── lib-video-stream              # Pure video display, accepts MediaStream
├── lib-crt-effect-wrapper        # CSS-only CRT effects, wraps any content
├── lib-content-overlay-container # Layout container with 9 named slots (content-agnostic)
└── lib-crt-settings-panel        # Settings UI, inputs/outputs pattern
```

These compose together in the smart components:

```
VideoDialogComponent (Smart - Orchestrator)
└── lib-content-overlay-container      ← Renamed from video-overlay-container (Phase 3 decision)
    ├── [content] lib-crt-effect-wrapper
    │   └── lib-video-stream [stream]="mediaStream"
    ├── [topOverlay] lib-filter-toolbar         ← Center top slot
    ├── [bottomOverlay] lib-player-toolbar      ← Center bottom slot
    ├── [topRightCorner] close button           ← Top-right corner slot
    ├── [leftControls] lib-crt-settings-panel   ← Left side panel slot
    └── [rightControls] CRT toggle, fullscreen  ← Right side buttons slot

VideoCaptureComponent (Smart - Device Manager)
└── lib-content-overlay-container
    ├── [content] lib-video-stream [stream]="mediaStream"
    ├── [topOverlay] device selector dropdown
    └── [rightControls] maximize button
```

---

## 🏗️ Composability Patterns

### Pattern 1: Input/Output Contracts (No Store Dependencies)

All new components follow the "dumb component" pattern:

```typescript
// ✅ Good - Dumb component accepts stream as input
@Component({ selector: 'lib-video-stream' })
export class VideoStreamComponent {
  stream = input<MediaStream | null>(null);  // Consumer provides stream
  streamReady = output<void>();               // Consumer handles events
}

// ❌ Bad - Smart component fetches from store
export class VideoStreamComponent {
  private settingsStore = inject(SettingsStore);
  deviceId = this.settingsStore.selectedVideoDevice(); // Tight coupling!
}
```

**Key Insight**: The smart components (VideoCapture, VideoDialog) own the store interactions. The new UI components just display what they're given.

### Pattern 2: Content Projection with 9 Named Slots

The overlay container uses Angular's `ng-content` with `select` for flexible composition. Phase 3 expanded to **9 slots** (from original 6) for maximum layout flexibility:

```html
<!-- lib-content-overlay-container template -->
<div class="content-layer">
  <ng-content select="[content]"></ng-content>
</div>
<div class="overlay-layer">
  <!-- Top row (slide in from top) -->
  <div class="top-left-corner"><ng-content select="[topLeftCorner]"></ng-content></div>
  <div class="top-overlay"><ng-content select="[topOverlay]"></ng-content></div>
  <div class="top-right-corner"><ng-content select="[topRightCorner]"></ng-content></div>
  <!-- Middle row (slide in from sides) -->
  <div class="left-controls"><ng-content select="[leftControls]"></ng-content></div>
  <div class="right-controls"><ng-content select="[rightControls]"></ng-content></div>
  <!-- Bottom row (slide in from bottom) -->
  <div class="bottom-left-controls"><ng-content select="[bottomLeftControls]"></ng-content></div>
  <div class="bottom-overlay"><ng-content select="[bottomOverlay]"></ng-content></div>
  <div class="bottom-right-controls"><ng-content select="[bottomRightControls]"></ng-content></div>
</div>
```

**Key Features** (from Phase 3):
- **Hover-to-reveal**: Overlays hidden by default, appear on container hover
- **Focus-within persistence**: Overlays stay visible during dropdown/menu interactions
- **8-direction slide animations**: Each slot slides in from its logical position
- **Fullscreen support**: `position: fixed` with z-index 9999 in fullscreen mode

**Usage Example**:
```html
<lib-content-overlay-container [showOverlaysOnHover]="true" [overlayTransitionMs]="300">
  <lib-video-stream content [stream]="mediaStream"></lib-video-stream>
  <lib-filter-toolbar topOverlay></lib-filter-toolbar>
  <lib-player-toolbar bottomOverlay></lib-player-toolbar>
  <lib-icon-button topRightCorner icon="close" (click)="close()"></lib-icon-button>
  <lib-crt-settings-panel leftControls [settings]="crtSettings" (settingsChange)="onSettingsChange($event)"></lib-crt-settings-panel>
</lib-content-overlay-container>
```

### Pattern 3: CSS-Only Effect Wrapper

CRT effects are pure CSS that can wrap any content:

```html
<!-- Wrap video -->
<lib-crt-effect-wrapper [settings]="crtSettings">
  <lib-video-stream [stream]="stream"></lib-video-stream>
</lib-crt-effect-wrapper>

<!-- Wrap an image (future use case) -->
<lib-crt-effect-wrapper [settings]="crtSettings">
  <img src="screenshot.png" />
</lib-crt-effect-wrapper>

<!-- Wrap terminal output (future use case) -->
<lib-crt-effect-wrapper [settings]="crtSettings">
  <pre class="terminal">{{ logOutput }}</pre>
</lib-crt-effect-wrapper>
```

### Pattern 4: Settings as Inputs (Open for External Persistence)

Settings UI uses input/output pattern to remain decoupled from where settings are stored:

```typescript
@Component({ selector: 'lib-crt-settings-panel' })
export class CrtSettingsPanelComponent {
  settings = input.required<CrtSettings>();      // Consumer provides current values
  settingsChange = output<CrtSettings>();        // Consumer handles persistence
}
```

This allows:
- VideoDialogComponent can manage settings as local component state
- Future: SettingsStore can persist CRT preferences per device
- Settings panel doesn't care where values come from or go

---

## 📋 Implementation Phases

<details>
<summary><h3>✅ Phase 1: Core Video Stream Component (COMPLETE)</h3></summary>

### Objective

Create the foundational `lib-video-stream` component that handles `MediaStream` display with proper video element lifecycle management.

### Key Deliverables

- [x] `lib-video-stream` component with `stream`, `objectFit`, `showLoadingState` inputs
- [x] `streamReady` and `streamError` outputs for lifecycle events
- [x] Loading state display when stream is null
- [x] Unit tests for all behaviors (11 tests)
- [x] Export from `libs/ui/components` barrel

### Completion Notes

- **Completed**: November 28, 2025
- **Report**: [Phase 1 Report](./reports/phase-01-report.md)
- **Tests**: 11 behavioral tests, all passing (268 total in ui-components)
- **Key Pattern**: Uses `effect()` for reactive stream binding with `DestroyRef` cleanup

### Phase Documents

- [Phase Plan](./phases/phase-01-video-stream-component.md)
- [Task Handoff](./tasks/phase-01-task-handoff.md)

</details>

---

<details>
<summary><h3>✅ Phase 2: CRT Effect Wrapper (COMPLETE)</h3></summary>

### Objective

Extract CRT visual effects into a reusable CSS wrapper that can enhance any content with retro CRT aesthetics.

### Key Deliverables

- [x] `lib-crt-effect-wrapper` component with `settings` and `enabled` inputs
- [x] All 8 CRT effects as CSS custom properties (scanlines, vignette, curvature, filters)
- [x] Smooth enable/disable transitions (300ms)
- [x] Unit tests verifying CSS property application (21 tests)
- [x] Export from `libs/ui/components` barrel
- [x] `CRT_PRESETS` with 4 preset configurations (full, filtersOnly, scanlines, none)

### Completion Notes

- **Completed**: November 28, 2025
- **Report**: [Phase 2 Report](./reports/phase-02-report.md)
- **Tests**: 21 behavioral tests, all passing (289 total in ui-components)
- **Key Pattern**: Preset system allows `CRT_PRESETS.full`, `.filtersOnly`, `.scanlines`, `.none` for common use cases
- **Bonus**: Angular `.px` binding syntax for cleaner CSS variable bindings

### Phase Documents

- [Phase Plan](./phases/phase-02-crt-effect-wrapper.md)
- [Task Handoff](./tasks/phase-02-task-handoff.md)

</details>

---

<details>
<summary><h3>✅ Phase 3: Content Overlay Container (COMPLETE)</h3></summary>

### Objective

Create the layout container with named content slots for composing any content with overlay controls.

### Key Deliverables

- [x] `lib-content-overlay-container` with **9 named `ng-content` slots** (expanded from 6)
- [x] Slots: `content`, `topLeftCorner`, `topOverlay`, `topRightCorner`, `leftControls`, `rightControls`, `bottomLeftControls`, `bottomOverlay`, `bottomRightControls`
- [x] Fullscreen mode support with proper overlay positioning (fixed positioning, z-index 9999)
- [x] Auto-hide behavior for overlays with slide animations (8 directions)
- [x] Unit tests for slot projection, hover behavior, fullscreen (36 tests)
- [x] Export from `libs/ui/components` barrel

### Completion Notes

- **Completed**: November 28, 2025
- **Report**: [Phase 3 Report](./reports/phase-03-report.md)
- **Tests**: 36 behavioral tests, all passing (325 total in ui-components)
- **Key Decision**: Renamed to `lib-content-overlay-container` for content-agnostic reuse
- **Key Decision**: Expanded to 9 slots based on video dialog analysis (8 overlay regions + content)
- **Key Pattern**: `:focus-within` keeps overlays visible during dropdown interactions

### Phase Documents

- [Phase Plan](./phases/phase-03-overlay-container.md)
- [Task Handoff](./tasks/phase-03-task-handoff.md)

</details>

---

<details open>
<summary><h3>🔜 Phase 4: CRT Settings Panel (NEXT)</h3></summary>

### Objective

Extract the CRT settings controls into a reusable panel component that can be projected into the `leftControls` slot of `lib-content-overlay-container`.

### Key Deliverables

- [ ] `lib-crt-settings-panel` with `settings` input and `settingsChange` output
- [ ] Slider controls for all 8 CRT parameters (matching existing video-dialog ranges)
- [ ] Reset to defaults functionality (using `DEFAULT_CRT_SETTINGS` from Phase 2)
- [ ] Preset selector dropdown (using `CRT_PRESETS` from Phase 2)
- [ ] Compact vertical design suitable for `leftControls` side slot
- [ ] Unit tests for input/output behavior
- [ ] Export from `libs/ui/components` barrel

### Integration with Phase 3

The settings panel will be composed in `leftControls` slot:
```html
<lib-content-overlay-container>
  <!-- content and other slots -->
  <lib-crt-settings-panel leftControls
    [settings]="crtSettings()"
    (settingsChange)="onCrtSettingsChange($event)">
  </lib-crt-settings-panel>
</lib-content-overlay-container>
```

This leverages the **hover-to-reveal** and **focus-within persistence** from Phase 3, ensuring the settings panel:
- Slides in from the left when user hovers
- Stays visible while interacting with sliders (focus-within)
- Slides out when user moves away and sliders lose focus

### Phase Documents

- [Phase Plan](./phases/phase-04-crt-settings-panel.md)
- [Task Handoff](./tasks/phase-04-task-handoff.md) *(to be created)*

</details>

---

<details>
<summary><h3>Phase 5: Refactor VideoDialogComponent</h3></summary>

### Objective

Refactor the existing VideoDialogComponent to compose the new UI components, validating the architecture works for the complex case.

### Key Deliverables

- [ ] VideoDialogComponent uses `lib-content-overlay-container` (renamed from video-overlay-container)
- [ ] VideoDialogComponent uses `lib-crt-effect-wrapper` around `lib-video-stream`
- [ ] VideoDialogComponent uses `lib-crt-settings-panel` in `leftControls` slot
- [ ] Map existing overlays to 9-slot architecture:
  - `content` → `lib-crt-effect-wrapper` wrapping `lib-video-stream`
  - `topOverlay` → `lib-filter-toolbar`
  - `bottomOverlay` → `lib-player-toolbar`
  - `topRightCorner` → close button
  - `leftControls` → `lib-crt-settings-panel` (conditional on CRT enabled)
  - `rightControls` → CRT toggle, fullscreen buttons
- [ ] All existing functionality preserved (fullscreen, close, toolbars)
- [ ] Component SCSS reduced significantly (effects moved to wrapper)
- [ ] Fullscreen delegated to `lib-content-overlay-container`
- [ ] All existing tests pass

### Phase Documents

- [Phase Plan](./phases/phase-05-refactor-video-dialog.md)

</details>

---

<details>
<summary><h3>Phase 6: Refactor VideoCaptureComponent</h3></summary>

### Objective

Refactor VideoCaptureComponent to use shared components, validating reusability.

### Key Deliverables

- [ ] VideoCaptureComponent uses `lib-content-overlay-container` (content-agnostic name)
- [ ] VideoCaptureComponent uses `lib-video-stream`
- [ ] Map overlay slots:
  - `content` → `lib-video-stream`
  - `topOverlay` → device selector dropdown
  - `rightControls` → maximize button
- [ ] All existing functionality preserved
- [ ] All existing tests pass

### Phase Documents

- [Phase Plan](./phases/phase-06-refactor-video-capture.md)

</details>

---

<details>
<summary><h3>Phase 7: Cleanup & Documentation</h3></summary>

### Objective

Remove deprecated code, update documentation, and ensure production readiness.

### Key Deliverables

- [ ] Remove duplicated CSS from VideoDialogComponent
- [ ] Remove any deprecated helper functions
- [ ] Update COMPONENT_LIBRARY.md with new components
- [ ] Update STYLE_GUIDE.md with CRT effect utilities
- [ ] Add TECHNICAL_DEBT.md entries if needed
- [ ] Final test suite verification

### Phase Documents

- [Phase Plan](./phases/phase-07-cleanup.md)

</details>

---

## 🔀 Execution Order

Phases can be partially parallelized:

```
Phase 1 (VideoStream) ─────────────────────────────────────────┐
    ↓                                                          │
Phase 2 (CRT Wrapper) ──┬── Phase 3 (Overlay Container)        │  
    ↓                   │   [can run in parallel]              │
Phase 4 (Settings) ─────┘                                      │
    ↓                                                          │
Phase 5 (Refactor Dialog) ← validates all components work     │
    ↓                                                          │
Phase 6 (Refactor Capture) ← validates reusability             │
    ↓                                                          │
Phase 7 (Cleanup) ← production readiness ──────────────────────┘
```

---

## 🏗️ Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|----------|
| **Component Location** | `libs/ui/components` | Pure presentation layer, reusable across features |
| **Stream Input** | Accept `MediaStream` directly | Loose coupling - caller owns device enumeration |
| **CRT Implementation** | CSS-only wrapper | Reusable for any content, not just video |
| **Overlay Container Name** | `lib-content-overlay-container` | Content-agnostic - usable for video, images, documents (Phase 3 decision) |
| **Overlay Slots** | 9 named slots | Maximum composition flexibility - 8 overlay positions + content (Phase 3 decision) |
| **Overlay Behavior** | Hover-reveal with focus-within | Overlays stay visible during interaction with controls inside them (Phase 3 decision) |
| **Fullscreen** | Managed by overlay container | Centralized, proper z-index handling with fixed positioning |
| **Settings Persistence** | Deferred (input/output pattern) | Open for future per-device persistence |

---

## 🧪 Testing Strategy

### Unit Tests (Per Component)

- [x] `lib-video-stream`: Stream binding, loading state, lifecycle events (11 tests)
- [x] `lib-crt-effect-wrapper`: CSS property application, enabled toggle (21 tests)
- [x] `lib-content-overlay-container`: Slot projection, hover behavior, fullscreen state (36 tests)
- [ ] `lib-crt-settings-panel`: Input/output binding, reset functionality, preset selection

### Integration Tests (Refactored Components)

- [ ] VideoDialogComponent correctly composes all new components
- [ ] VideoCaptureComponent correctly composes stream and overlay
- [ ] CRT effects apply correctly through the composition chain

### Regression Tests

- [ ] All existing VideoDialog tests pass after refactor
- [ ] All existing VideoCapture tests pass after refactor
- [ ] No visual regressions in CRT effects

---

## ✅ Success Criteria

- [x] All 4 new UI components are pure presentation (no store dependencies)
  - [x] `lib-video-stream` - \u2705 Complete (Phase 1)
  - [x] `lib-crt-effect-wrapper` - \u2705 Complete (Phase 2)
  - [x] `lib-content-overlay-container` - \u2705 Complete (Phase 3)
  - [ ] `lib-crt-settings-panel` - Next (Phase 4)
- [ ] VideoDialogComponent successfully composes new components (Phase 5)
- [ ] VideoCaptureComponent successfully composes new components (Phase 6)
- [ ] All existing functionality preserved (no regressions)
- [ ] CRT settings can be provided externally (open to future persistence)
- [x] COMPONENT_LIBRARY.md updated with new components (ongoing per phase)
- [ ] All unit and integration tests pass
- [ ] VideoDialogComponent SCSS reduced by ~400 lines (Phase 5)

### Completed Metrics

| Phase | Tests Added | Total Tests |
|-------|-------------|-------------|
| Phase 1 | 11 | 268 |
| Phase 2 | 21 | 289 |
| Phase 3 | 36 | 325 |

---

## 📚 Related Documentation

- **Video Capture Planning**: [VIDEO_CAPTURE_PLANNING.md](../../features/video-capture/VIDEO_CAPTURE_PLANNING.md) - Original feature context
- **Component Library**: [COMPONENT_LIBRARY.md](../../COMPONENT_LIBRARY.md) - UI component patterns
- **Style Guide**: [STYLE_GUIDE.md](../../STYLE_GUIDE.md) - Styling conventions
- **Coding Standards**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md) - Angular patterns
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md) - Behavioral testing

---

## 📝 Notes

**Phase 1 Complete**: `lib-video-stream` delivered with 11 tests. See [Phase 1 Report](./reports/phase-01-report.md).

**Phase 2 Complete**: `lib-crt-effect-wrapper` delivered with 21 tests and 4 presets. See [Phase 2 Report](./reports/phase-02-report.md).

**Phase 3 Complete**: `lib-content-overlay-container` delivered with 36 tests and 9 named slots. See [Phase 3 Report](./reports/phase-03-report.md).

### Key Decisions from Phase 3

1. **Expanded to 9 slots** (from original 6): Analysis of video dialog UI revealed 8 distinct overlay regions plus content, enabling maximum composition flexibility.

2. **Renamed to `lib-content-overlay-container`**: Generic naming enables reuse for any content type (video, images, documents), not just video.

3. **Focus-within persistence**: Overlays stay visible when interacting with dropdowns or form controls inside them - critical for CRT settings sliders in Phase 4.

4. **8-direction slide animations**: Each slot has contextual slide-in direction (top-left slides diagonally, bottom-center slides up, etc.).

**Phase 4 Ready**: CRT Settings Panel is next. Task handoff to be created.

**Document Version**: 1.3  
**Created**: 2025-11-28  
**Updated**: 2025-11-28 (Phase 3 complete)
