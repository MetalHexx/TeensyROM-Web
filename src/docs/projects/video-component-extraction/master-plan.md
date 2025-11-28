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
├── lib-video-stream        # Pure video display, accepts MediaStream
├── lib-crt-effect-wrapper  # CSS-only CRT effects, wraps any content
├── lib-video-overlay-container  # Layout container with named slots
└── lib-crt-settings-panel  # Settings UI, inputs/outputs pattern
```

These compose together in the smart components:

```
VideoDialogComponent (Smart - Orchestrator)
└── lib-video-overlay-container
    ├── [video] lib-crt-effect-wrapper
    │   └── lib-video-stream [stream]="mediaStream"
    ├── [topOverlay] lib-filter-toolbar
    ├── [bottomOverlay] lib-player-toolbar  
    ├── [cornerControls] close button
    └── [sideControls] CRT toggle, fullscreen

VideoCaptureComponent (Smart - Device Manager)
└── lib-video-overlay-container
    ├── [video] lib-video-stream [stream]="mediaStream"
    ├── [topOverlay] device selector dropdown
    └── [sideControls] maximize button
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

### Pattern 2: Content Projection with Named Slots

The overlay container uses Angular's `ng-content` with `select` for flexible composition:

```html
<!-- lib-video-overlay-container template -->
<div class="video-layer">
  <ng-content select="[video]"></ng-content>
</div>
<div class="overlay-layer">
  <div class="top-overlay"><ng-content select="[topOverlay]"></ng-content></div>
  <div class="bottom-overlay"><ng-content select="[bottomOverlay]"></ng-content></div>
  <div class="side-controls"><ng-content select="[sideControls]"></ng-content></div>
  <div class="corner-controls"><ng-content select="[cornerControls]"></ng-content></div>
</div>
```

**Usage**:
```html
<lib-video-overlay-container [fullscreen]="isFullscreen">
  <lib-video-stream video [stream]="mediaStream"></lib-video-stream>
  <lib-filter-toolbar topOverlay></lib-filter-toolbar>
  <lib-player-toolbar bottomOverlay></lib-player-toolbar>
  <button cornerControls (click)="close()">×</button>
</lib-video-overlay-container>
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

<details open>
<summary><h3>🔄 Phase 2: CRT Effect Wrapper (IN PROGRESS)</h3></summary>

### Objective

Extract CRT visual effects into a reusable CSS wrapper that can enhance any content with retro CRT aesthetics.

### Key Deliverables

- [ ] `lib-crt-effect-wrapper` component with `settings` and `enabled` inputs
- [ ] All 8 CRT effects as CSS custom properties (scanlines, vignette, curvature, brightness, saturation, contrast, blur, flicker)
- [ ] Smooth enable/disable transitions
- [ ] Unit tests verifying CSS property application
- [ ] Export from `libs/ui/components` barrel

### Phase Documents

- [Phase Plan](./phases/phase-02-crt-effect-wrapper.md)
- [Task Handoff](./tasks/phase-02-task-handoff.md)

</details>

---

<details>
<summary><h3>Phase 3: Video Overlay Container</h3></summary>

### Objective

Create the layout container with named content slots for composing video with overlay controls.

### Key Deliverables

- [ ] `lib-video-overlay-container` with named `ng-content` slots
- [ ] Slots: `video`, `topOverlay`, `bottomOverlay`, `sideControls`, `cornerControls`
- [ ] Fullscreen mode support with proper overlay positioning
- [ ] Auto-hide behavior for overlays (show on hover/activity)
- [ ] Unit tests for slot projection and fullscreen state
- [ ] Export from `libs/ui/components` barrel

### Phase Documents

- [Phase Plan](./phases/phase-03-overlay-container.md)

</details>

---

<details>
<summary><h3>Phase 4: CRT Settings Panel</h3></summary>

### Objective

Extract the CRT settings controls into a reusable panel component.

### Key Deliverables

- [ ] `lib-crt-settings-panel` with `settings` input and `settingsChange` output
- [ ] Slider controls for all 8 CRT parameters
- [ ] Reset to defaults functionality
- [ ] Compact design suitable for side panels
- [ ] Unit tests for input/output behavior
- [ ] Export from `libs/ui/components` barrel

### Phase Documents

- [Phase Plan](./phases/phase-04-crt-settings-panel.md)

</details>

---

<details>
<summary><h3>Phase 5: Refactor VideoDialogComponent</h3></summary>

### Objective

Refactor the existing VideoDialogComponent to compose the new UI components, validating the architecture works for the complex case.

### Key Deliverables

- [ ] VideoDialogComponent uses `lib-video-overlay-container`
- [ ] VideoDialogComponent uses `lib-crt-effect-wrapper` around `lib-video-stream`
- [ ] VideoDialogComponent uses `lib-crt-settings-panel` for settings
- [ ] All existing functionality preserved (fullscreen, close, toolbars)
- [ ] Component SCSS reduced significantly (effects moved to wrapper)
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

- [ ] VideoCaptureComponent uses `lib-video-overlay-container`
- [ ] VideoCaptureComponent uses `lib-video-stream`
- [ ] Device selector and maximize controls in overlay slots
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
|----------|--------|-----------|
| **Component Location** | `libs/ui/components` | Pure presentation layer, reusable across features |
| **Stream Input** | Accept `MediaStream` directly | Loose coupling - caller owns device enumeration |
| **CRT Implementation** | CSS-only wrapper | Reusable for any content, not just video |
| **Overlay Layout** | Named `ng-content` slots | Maximum composition flexibility |
| **Fullscreen** | Managed by overlay container | Centralized, proper z-index handling |
| **Settings Persistence** | Deferred (input/output pattern) | Open for future per-device persistence |

---

## 🧪 Testing Strategy

### Unit Tests (Per Component)

- [ ] `lib-video-stream`: Stream binding, loading state, lifecycle events
- [ ] `lib-crt-effect-wrapper`: CSS property application, enabled toggle
- [ ] `lib-video-overlay-container`: Slot projection, fullscreen state
- [ ] `lib-crt-settings-panel`: Input/output binding, reset functionality

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

- [ ] All 4 new UI components are pure presentation (no store dependencies)
- [ ] VideoDialogComponent successfully composes new components
- [ ] VideoCaptureComponent successfully composes new components  
- [ ] All existing functionality preserved (no regressions)
- [ ] CRT settings can be provided externally (open to future persistence)
- [ ] COMPONENT_LIBRARY.md updated with new components
- [ ] All unit and integration tests pass
- [ ] VideoDialogComponent SCSS reduced by ~400 lines

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

**Phase 2 Ready**: [Task Handoff](./tasks/phase-02-task-handoff.md) is ready for execution.

**Document Version**: 1.1  
**Created**: 2025-11-28  
**Updated**: 2025-11-28 (Phase 1 complete)
