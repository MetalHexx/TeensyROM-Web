# Phase 1: Task Handoff - `lib-video-stream` Component

## 📋 Task Identity

**Task ID**: `TASK-01-001-VIDEO-STREAM`  
**Task Name**: Create `lib-video-stream` Presentation Component  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High (Foundation for all other phases)  
**Estimated Context Size**: Small (4 new files + 1 modified)

---

## 🎯 Objective

**What**: Create a pure presentation component that displays a `MediaStream` in a video element with loading state management.

**Why**: This foundational component encapsulates video element lifecycle management (autoplay, muted, srcObject binding) and provides a clean interface for displaying video streams without any store dependencies.

### Success Criteria

- [ ] Component created as standalone Angular 19 component with signal inputs/outputs
- [ ] Accepts `MediaStream | null` as input and displays video when provided
- [ ] Shows loading indicator when `showLoadingState` is true and stream is null
- [ ] Emits `streamReady` when video begins playing
- [ ] Emits `streamError` when video element encounters an error
- [ ] All unit tests pass with behavioral coverage
- [ ] Component exported from `libs/ui/components` barrel
- [ ] Documentation added to `COMPONENT_LIBRARY.md`

---

## 📋 Context & Dependencies

### Prerequisites Completed

- None (this is the first task in the extraction project)

### Dependencies

- Angular 19 signals API (`input()`, `output()`, `signal()`, `computed()`)
- Angular `CommonModule` for `@if` control flow
- Existing UI patterns in `libs/ui/components` for structure reference

### Constraints

- **Pure Presentation Only**: No store dependencies, no service injections
- **Loose Coupling**: Accept stream as input - caller is responsible for acquisition
- **No CRT Effects**: This component only handles raw video display; CRT effects are Phase 3
- **Accessibility**: Video element must have appropriate ARIA attributes

---

## 📂 File Scope

### Files to Create

| File Path | Purpose |
|-----------|---------|
| `libs/ui/components/src/lib/video-stream/video-stream.component.ts` | Component class with signal inputs/outputs and video element management |
| `libs/ui/components/src/lib/video-stream/video-stream.component.html` | Template with video element and loading state |
| `libs/ui/components/src/lib/video-stream/video-stream.component.scss` | Styling for video container and loading state |
| `libs/ui/components/src/lib/video-stream/video-stream.component.spec.ts` | Unit tests for component behaviors |

### Files to Modify

| File Path | Change Description |
|-----------|-------------------|
| `libs/ui/components/src/index.ts` | Add export for new component |

### Files to Review (Context Only)

| File Path | Relevance |
|-----------|-----------|
| `libs/ui/components/src/lib/scaling-container/scaling-container.component.ts` | Signal input/output patterns |
| `libs/ui/components/src/lib/cycle-image/cycle-image.component.spec.ts` | Testing patterns with `componentRef.setInput()` |
| `libs/features/player/src/lib/video-capture/video-dialog/video-dialog.component.ts` | Current video element handling to extract from |
| `libs/features/player/src/lib/video-capture/video-dialog/video-dialog.component.html` | Current video element markup for reference |

---

## 🔧 Implementation Guidance

### Component Structure

**Class Name**: `VideoStreamComponent`  
**Selector**: `lib-video-stream`

### Inputs (Signal-Based)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `stream` | `InputSignal<MediaStream \| null>` | `null` | The MediaStream to display |
| `objectFit` | `InputSignal<'contain' \| 'cover' \| 'fill'>` | `'contain'` | CSS object-fit for video element |
| `showLoadingState` | `InputSignal<boolean>` | `true` | Whether to show loading indicator when no stream |

### Outputs (Signal-Based)

| Property | Type | Description |
|----------|------|-------------|
| `streamReady` | `OutputEmitterRef<void>` | Emits when video element starts playing |
| `streamError` | `OutputEmitterRef<ErrorEvent>` | Emits when video element encounters an error |

### Internal State

| Property | Type | Purpose |
|----------|------|---------|
| `videoElementRef` | `viewChild('videoElement')` | Reference to the native video element |
| `isPlaying` | `WritableSignal<boolean>` | Tracks if video is actively playing |

### Template Structure

- Container `div` with class `video-stream-container`
- Native `video` element with:
  - `#videoElement` template reference
  - `autoplay` and `muted` attributes (required for autoplay policy)
  - `playsinline` attribute for mobile
  - `[style.object-fit]` bound to input
- Conditional loading indicator when `showLoadingState()` and no stream

### Video Element Lifecycle

**Key Behavior**: When `stream` input changes:
1. Get native video element via `viewChild`
2. Set `video.srcObject = stream` 
3. Call `video.play()` (returns Promise)
4. Handle `playing` event → emit `streamReady`
5. Handle `error` event → emit `streamError`

Use `effect()` to react to stream changes, similar to existing patterns in the codebase.

### Styling Approach

- Container takes full width/height of parent (`width: 100%; height: 100%`)
- Video element fills container
- Loading state centered with existing `loading-text` patterns if desired
- No CRT effects - save those for Phase 3

---

## 🧪 Testing Requirements

### Test File Location

`libs/ui/components/src/lib/video-stream/video-stream.component.spec.ts`

### Behaviors to Test

| Behavior | Description |
|----------|-------------|
| **Component Creation** | Should create successfully with default inputs |
| **Null Stream Display** | Should show loading state when stream is null and `showLoadingState` is true |
| **Loading Hidden** | Should hide loading indicator when `showLoadingState` is false |
| **Video Element Binding** | Video element should receive stream via srcObject |
| **Object Fit Binding** | Video element should apply objectFit style |
| **Stream Ready Emission** | Should emit `streamReady` when video plays |
| **Stream Error Emission** | Should emit `streamError` when video errors |

### Testing Patterns

Follow existing test patterns in `libs/ui/components`:
- Use `TestBed.configureTestingModule({ imports: [Component, NoopAnimationsModule] })`
- Use `componentRef.setInput()` for signal inputs
- Use `fixture.detectChanges()` to trigger change detection
- Create mock `MediaStream` for testing (can be simple object stub)

### Mocking MediaStream

```typescript
// Create minimal mock for testing
const mockStream = {
  getTracks: () => [],
  active: true
} as unknown as MediaStream;
```

---

## 📚 Reference Materials

### Project Documentation

- [Master Plan](../master-plan.md) - Project overview and phase structure
- [Phase 1 Plan](../phases/phase-01-video-stream-component.md) - Detailed phase objectives

### Standards Documentation

- [CODING_STANDARDS.md](../../../CODING_STANDARDS.md) - Component patterns and naming
- [TESTING_STANDARDS.md](../../../TESTING_STANDARDS.md) - Behavioral testing approach
- [COMPONENT_LIBRARY.md](../../../COMPONENT_LIBRARY.md) - Documentation format (update after completion)

### Similar Implementations

- `libs/ui/components/src/lib/scaling-container/` - Signal input/output patterns
- `libs/ui/components/src/lib/cycle-image/` - Effect-based reactive updates
- `libs/ui/components/src/lib/thumbnail-image/` - Image element handling

---

## 📤 Output Specification

### Report Location

`docs/projects/video-component-extraction/reports/phase-01-report.md`

### Report Template

Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md) structure:

1. **Summary**: What was accomplished
2. **Files Created/Modified**: List with purposes
3. **Test Results**: Coverage and passing status
4. **Discoveries**: Any insights during implementation
5. **Technical Decisions**: Choices made and rationale
6. **Documentation Updates**: COMPONENT_LIBRARY.md changes
7. **Next Phase Readiness**: Confirmation ready for Phase 2

---

## ✅ Completion Checklist

Before marking complete:

- [ ] Component class created with all inputs/outputs
- [ ] Template renders video element correctly
- [ ] Styles provide proper container sizing
- [ ] All 7 behavioral tests pass
- [ ] Export added to `libs/ui/components/src/index.ts`
- [ ] Entry added to `COMPONENT_LIBRARY.md`
- [ ] No lint errors (`pnpm nx lint ui-components`)
- [ ] No TypeScript errors
- [ ] Report saved to output location

---

## 💡 Implementation Notes

### Why This Component First

This is the foundation layer - every other video component (CRT effects, overlays, dialogs) will compose this component. Getting the MediaStream lifecycle management correct here means all higher-level components don't need to worry about video element specifics.

### Key Insight from Existing Code

The current `VideoDialogComponent` handles video element binding via:
```html
<video #videoElement autoplay muted playsinline></video>
```
```typescript
@ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
// In effect:
this.videoElement.nativeElement.srcObject = stream;
```

Extract this pattern into the new component, but use modern signal-based viewChild.

### Accessibility Considerations

- Video elements should have `aria-label` describing purpose
- Consider adding `role="img"` since this is display-only (no controls)
- Loading state should have appropriate ARIA live region

---

**Handoff Complete** - Worker subagent should read this document, execute the task, and save completion report to the specified output location.
