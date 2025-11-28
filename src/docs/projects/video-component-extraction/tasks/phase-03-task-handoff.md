# Phase 3: Task Handoff - `lib-video-overlay-container` Component

## 📋 Task Identity

**Task ID**: `TASK-03-001-OVERLAY-CONTAINER`  
**Task Name**: Create `lib-video-overlay-container` Layout Component  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Medium (4 new files + 1 modified, complex CSS)

---

## 🎯 Objective

**What**: Create a layout container component with named content projection slots that manages overlay positioning, hover-to-reveal behavior, and optional fullscreen support.

**Why**: Extract the overlay layout logic from `VideoDialogComponent` into a reusable container that can compose any content with overlays. This enables consistent overlay behavior across different video contexts (dialog, inline player, future use cases).

### Success Criteria

- [ ] Named `ng-content` slots for: `video`, `topOverlay`, `bottomOverlay`, `sideControls`, `cornerControls`
- [ ] Hover-to-reveal behavior for all overlay slots (with CSS transitions)
- [ ] Optional fullscreen mode with proper overlay positioning
- [ ] `fullscreenChange` output event for consumer synchronization
- [ ] All overlays remain interactive when visible (pointer-events)
- [ ] Overlays stay visible while being interacted with (hover/focus-within)
- [ ] Unit tests for slot projection, hover behavior, fullscreen
- [ ] Component exported from `libs/ui/components` barrel
- [ ] Documentation added to `COMPONENT_LIBRARY.md`

---

## 📋 Context & Dependencies

### Prerequisites Completed

- ✅ Phase 1: `lib-video-stream` component (content for video slot)
- ✅ Phase 2: `lib-crt-effect-wrapper` component (can wrap video slot content)
- Report: [Phase 1 Report](../reports/phase-01-report.md), [Phase 2 Report](../reports/phase-02-report.md)

### Dependencies

- Angular 19 signals API (`input()`, `output()`, `signal()`, `viewChild()`)
- Angular `CommonModule` for `@if` control flow
- Fullscreen API (`requestFullscreen`, `exitFullscreen`, `fullscreenchange` event)

### Constraints

- **Pure Presentation Only**: No store dependencies, no service injections
- **Content Agnostic**: Slots must work with any projected content
- **CSS-Based Hover**: Hover behavior via CSS for performance, not JS mouse events
- **Fullscreen Optional**: Component works without fullscreen, fullscreen is enhancement

---

## 📂 File Scope

### Files to Create

| File Path | Purpose |
|-----------|---------|
| `libs/ui/components/src/lib/video-overlay-container/video-overlay-container.component.ts` | Component class with slot projections, fullscreen logic, inputs/outputs |
| `libs/ui/components/src/lib/video-overlay-container/video-overlay-container.component.html` | Template with named ng-content slots in proper layer structure |
| `libs/ui/components/src/lib/video-overlay-container/video-overlay-container.component.scss` | Overlay positioning, hover behavior, transitions, fullscreen fixes |
| `libs/ui/components/src/lib/video-overlay-container/video-overlay-container.component.spec.ts` | Unit tests for slot projection, visibility, fullscreen behavior |

### Files to Modify

| File Path | Change Description |
|-----------|-------------------|
| `libs/ui/components/src/index.ts` | Add export for `VideoOverlayContainerComponent` |

### Files to Review (Context Only)

| File Path | Relevance |
|-----------|-----------|
| `libs/features/player/.../video-dialog/video-dialog.component.html` | Current slot structure to replicate |
| `libs/features/player/.../video-dialog/video-dialog.component.scss` | Overlay positioning patterns to extract (lines 350-551) |
| `libs/ui/components/src/lib/crt-effect-wrapper/` | Pattern reference from Phase 2 |

---

## 🔧 Implementation Guidance

### Component Structure

**Class Name**: `VideoOverlayContainerComponent`  
**Selector**: `lib-video-overlay-container`

### Inputs (Signal-Based)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `showOverlaysOnHover` | `InputSignal<boolean>` | `true` | Enable hover-to-reveal for overlays |
| `overlayTransitionMs` | `InputSignal<number>` | `300` | Transition duration in milliseconds |

### Outputs (Signal-Based)

| Property | Type | Description |
|----------|------|-------------|
| `fullscreenChange` | `OutputEmitterRef<boolean>` | Emits when fullscreen state changes |

### Internal State

| Property | Type | Purpose |
|----------|------|---------|
| `containerRef` | `viewChild('container')` | Reference to container element for fullscreen API |
| `isFullscreen` | `WritableSignal<boolean>` | Tracks current fullscreen state |

### Methods

| Method | Purpose |
|--------|---------|
| `enterFullscreen()` | Request fullscreen on container element |
| `exitFullscreen()` | Exit fullscreen mode |
| `toggleFullscreen()` | Toggle between fullscreen states |

### Template Structure (Named Slots)

```html
<div #container class="overlay-container" 
     [class.fullscreen]="isFullscreen()"
     [class.hover-reveal]="showOverlaysOnHover()">
  
  <!-- Video layer (lowest z-index) -->
  <div class="video-layer">
    <ng-content select="[video]"></ng-content>
  </div>
  
  <!-- Overlay layer (above video) -->
  <div class="overlay-layer">
    <!-- Top overlay (filter toolbar position) -->
    <div class="top-overlay">
      <ng-content select="[topOverlay]"></ng-content>
    </div>
    
    <!-- Bottom overlay (player toolbar position) -->
    <div class="bottom-overlay">
      <ng-content select="[bottomOverlay]"></ng-content>
    </div>
    
    <!-- Side controls (left side - CRT settings) -->
    <div class="side-controls left">
      <ng-content select="[leftControls]"></ng-content>
    </div>
    
    <!-- Side controls (right side - action buttons) -->
    <div class="side-controls right">
      <ng-content select="[rightControls]"></ng-content>
    </div>
    
    <!-- Corner controls (close button) -->
    <div class="corner-controls">
      <ng-content select="[cornerControls]"></ng-content>
    </div>
  </div>
</div>
```

### CSS Positioning Strategy

**Normal Mode**:
- `.top-overlay`: `position: absolute; top: 16px; left: 50%; transform: translateX(-50%)`
- `.bottom-overlay`: `position: absolute; bottom: 0; left: 0; right: 0`
- `.side-controls.left`: `position: absolute; bottom: 120px; left: 16px`
- `.side-controls.right`: `position: absolute; bottom: 120px; right: 16px`
- `.corner-controls`: `position: absolute; top: 16px; right: 16px`

**Fullscreen Mode** (via `:fullscreen` or `.fullscreen` class):
- Change `position: absolute` to `position: fixed` for overlays
- Increase z-index to 9999 for visibility above fullscreen content

### Hover-to-Reveal Behavior

When `.hover-reveal` class is active:

```scss
.overlay-container.hover-reveal {
  // Hide overlays by default
  .overlay-layer > * {
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--transition-ms) ease-in-out,
                transform var(--transition-ms) ease-in-out;
  }
  
  // Show on container hover
  &:hover .overlay-layer > * {
    opacity: 1;
    pointer-events: all;
  }
  
  // Keep visible when overlay has focus (dropdowns, inputs)
  .overlay-layer > *:focus-within {
    opacity: 1;
    pointer-events: all;
  }
  
  // Keep visible when hovering the overlay itself
  .overlay-layer > *:hover {
    opacity: 1;
    pointer-events: all;
  }
}
```

**Slide Animations** (from current video-dialog):
- `.top-overlay`: slides from `translateY(-100%)` to `translateY(0)`
- `.bottom-overlay`: slides from `translateY(100%)` to `translateY(0)`
- `.side-controls.left`: slides from `translateX(-100%)` to `translateX(0)`
- `.side-controls.right`: slides from `translateX(100%)` to `translateX(0)`

### Fullscreen API Implementation

```typescript
private fullscreenHandler = () => {
  const isFs = !!document.fullscreenElement;
  this.isFullscreen.set(isFs);
  this.fullscreenChange.emit(isFs);
};

// In constructor with afterNextRender:
document.addEventListener('fullscreenchange', this.fullscreenHandler);

// In DestroyRef cleanup:
document.removeEventListener('fullscreenchange', this.fullscreenHandler);

enterFullscreen(): void {
  this.containerRef()?.nativeElement?.requestFullscreen?.();
}

exitFullscreen(): void {
  document.exitFullscreen?.();
}

toggleFullscreen(): void {
  this.isFullscreen() ? this.exitFullscreen() : this.enterFullscreen();
}
```

---

## 🧪 Testing Requirements

### Test File Location

`libs/ui/components/src/lib/video-overlay-container/video-overlay-container.component.spec.ts`

### Behaviors to Test

| Behavior | Description |
|----------|-------------|
| **Component Creation** | Should create with default inputs |
| **Video Slot Projection** | Content with `[video]` attribute should project into video layer |
| **Top Overlay Projection** | Content with `[topOverlay]` attribute should project into top overlay |
| **Bottom Overlay Projection** | Content with `[bottomOverlay]` attribute should project into bottom overlay |
| **Left Controls Projection** | Content with `[leftControls]` attribute should project into left side |
| **Right Controls Projection** | Content with `[rightControls]` attribute should project into right side |
| **Corner Controls Projection** | Content with `[cornerControls]` attribute should project into corner |
| **Hover Reveal Class** | Should have `hover-reveal` class when `showOverlaysOnHover` is true |
| **No Hover Class** | Should not have `hover-reveal` class when `showOverlaysOnHover` is false |
| **Overlay Hidden Default** | Overlays should have opacity 0 when hover-reveal enabled |
| **Toggle Fullscreen Method** | `toggleFullscreen()` should change fullscreen state |
| **Fullscreen Change Event** | Should emit `fullscreenChange` when fullscreen state changes |

### Testing Content Projection

```typescript
@Component({
  template: `
    <lib-video-overlay-container>
      <div video>Video Content</div>
      <div topOverlay>Top Overlay</div>
      <div bottomOverlay>Bottom Overlay</div>
      <div leftControls>Left Controls</div>
      <div rightControls>Right Controls</div>
      <div cornerControls>Corner Controls</div>
    </lib-video-overlay-container>
  `
})
class TestHostComponent {}

// Verify content appears in correct layers
expect(fixture.nativeElement.querySelector('.video-layer').textContent).toContain('Video Content');
expect(fixture.nativeElement.querySelector('.top-overlay').textContent).toContain('Top Overlay');
```

### Testing Fullscreen (Mock Required)

Fullscreen API is hard to test in JSDOM. Options:
1. Test method calls exist and are callable
2. Mock `document.fullscreenElement` for state testing
3. Test that event handler updates state correctly

---

## 📚 Reference Materials

### Project Documentation

- [Master Plan](../master-plan.md) - Architecture decisions and composition pattern
- [Phase 3 Plan](../phases/phase-03-overlay-container.md) - Detailed phase objectives
- [Phase 1 Report](../reports/phase-01-report.md) - `lib-video-stream` patterns
- [Phase 2 Report](../reports/phase-02-report.md) - `lib-crt-effect-wrapper` patterns

### Standards Documentation

- [CODING_STANDARDS.md](../../../CODING_STANDARDS.md) - Component patterns and naming
- [TESTING_STANDARDS.md](../../../TESTING_STANDARDS.md) - Behavioral testing approach
- [COMPONENT_LIBRARY.md](../../../COMPONENT_LIBRARY.md) - Documentation format

### Source Material (Extract From)

- `libs/features/player/.../video-dialog/video-dialog.component.html` - Current slot usage
- `libs/features/player/.../video-dialog/video-dialog.component.scss` lines 350-551 - Overlay CSS

---

## 📤 Output Specification

### Report Location

`docs/projects/video-component-extraction/reports/phase-03-report.md`

### Report Template

Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md) structure:

1. **Summary**: What was accomplished
2. **Files Created/Modified**: List with purposes
3. **Test Results**: Coverage and passing status
4. **Discoveries**: Any insights during implementation
5. **Technical Decisions**: Choices made and rationale
6. **Documentation Updates**: COMPONENT_LIBRARY.md changes
7. **Next Phase Readiness**: Confirmation ready for Phase 4/5

---

## ✅ Completion Checklist

Before marking complete:

- [ ] All 6 named slots project content correctly
- [ ] Hover-reveal behavior works (overlays appear on container hover)
- [ ] Overlays stay visible during interaction (hover/focus-within)
- [ ] Slide animations work for all overlay positions
- [ ] Fullscreen toggle methods work
- [ ] Fullscreen mode uses fixed positioning for overlays
- [ ] `fullscreenChange` event emits correctly
- [ ] Transition duration is configurable via input
- [ ] All behavioral tests pass
- [ ] Export added to `libs/ui/components/src/index.ts`
- [ ] Entry added to `COMPONENT_LIBRARY.md`
- [ ] No lint errors (`pnpm nx lint ui-components`)
- [ ] No TypeScript errors
- [ ] Report saved to output location

---

## 💡 Implementation Notes

### Why Named Slots

Named content projection allows consumers to place any content in designated positions:
- Video slot can contain `lib-video-stream`, `lib-crt-effect-wrapper`, or custom video elements
- Overlay slots can contain toolbars, buttons, panels, or any custom controls
- Container handles positioning/visibility, consumer handles content

### Composition Example

After this phase, the full composition is possible:

```html
<lib-video-overlay-container [showOverlaysOnHover]="true">
  <!-- Video with CRT effects -->
  <lib-crt-effect-wrapper video [settings]="crtSettings" [enabled]="crtEnabled">
    <lib-video-stream [stream]="mediaStream"></lib-video-stream>
  </lib-crt-effect-wrapper>
  
  <!-- Toolbars -->
  <lib-filter-toolbar topOverlay [deviceId]="deviceId"></lib-filter-toolbar>
  <lib-player-toolbar bottomOverlay [deviceId]="deviceId"></lib-player-toolbar>
  
  <!-- Controls -->
  <lib-crt-settings-panel leftControls [settings]="crtSettings"></lib-crt-settings-panel>
  <div rightControls>
    <lib-icon-button icon="tv" (click)="toggleCrt()"></lib-icon-button>
    <lib-icon-button icon="fullscreen" (click)="container.toggleFullscreen()"></lib-icon-button>
  </div>
  
  <!-- Close button -->
  <lib-icon-button cornerControls icon="close" (click)="close()"></lib-icon-button>
</lib-video-overlay-container>
```

### Focus-Within Pattern

The `:focus-within` CSS pseudo-class is critical for dropdown menus:
- When a dropdown menu inside an overlay is open, `:focus-within` keeps the overlay visible
- This prevents overlays from disappearing while interacting with nested controls

---

**Handoff Complete** - Worker subagent should read this document, execute the task, and save completion report to the specified output location.
