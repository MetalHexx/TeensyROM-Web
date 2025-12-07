# Subagent Task Handoff

## 📋 Task Identity

**Task ID**: CRT-EFFECT-ENHANCEMENT-TASK-04-002B-IMAGE-CYCLING-FIX  
**Task Name**: Fix Image Cycling in WebGL CRT Mode  
**Assigned To**: UI Wizard (Clean Coder mode)  
**Agent Chatmode**: `.github/chatmodes/ui-wizard.chatmode.md`  
**Priority**: High (blocking production quality)  
**Estimated Size**: Small (2-3 files)  
**Estimated Time**: 1-2 hours

---

## 🎯 Objective

### What

Fix the image cycling issue where the WebGL CRT effect displays the first image correctly but fails to update when images cycle in the `CycleImageComponent`.

### Why

The WebGL post-processing pipeline (TASK-04-002A) works correctly for video content but has a timing issue with cycling images. The `imageChange` event fires before Angular has updated the DOM with the new `<img>` element, causing `refreshImage()` to either find the old element or no element at all.

**Current behavior**:
- ✅ First image displays with CRT effects applied
- ✅ CSS fallback mode cycles images correctly  
- ✅ Disabling CRT allows images to cycle
- ❌ WebGL mode shows only the first image (stuck)

### Success Criteria

- [ ] Images cycle correctly when CRT is enabled in WebGL mode
- [ ] Each new image displays with full CRT effects (scanlines, phosphor, vignette)
- [ ] No flickering, black frames, or visual glitches during transitions
- [ ] Performance remains smooth (no additional RAF overhead)
- [ ] CSS fallback mode still works unchanged
- [ ] Video mode still works correctly
- [ ] Unit tests pass (add/update tests for image cycling)

---

## 🔧 Root Cause Analysis

### The Problem

The `CycleImageComponent` uses `@if` control flow which **destroys and recreates** DOM elements on each cycle:

```html
<!-- cycle-image.component.html -->
@if (currentImage(); as image) {
  <img
    class="carousel-image current"
    [src]="image"
    [@fadeIn]="animationKey()"
  />
}
```

When `currentImage()` signal updates:
1. Angular destroys the old `<img>` element
2. The `imageChange` output event fires (from `emitImageChange()`)
3. `CrtEffectWrapperComponent.refreshImage()` is called
4. `requestAnimationFrame` callback runs, but Angular hasn't created the new `<img>` yet
5. `wrapper.querySelector('img.carousel-image.current')` finds nothing or stale element

### Timing Diagram

```
Time →
────────────────────────────────────────────────────────────────────
CycleImageComponent:
  1. currentIndex.set(nextIndex)    ─┐
  2. emitImageChange() fires        ─┤
                                     │
CrtEffectWrapper:                    │
  3. refreshImage() called          ─┤
  4. requestAnimationFrame()        ─┤
                                     │  ← Angular Change Detection hasn't run yet
Angular CD:                          │
  5. Detects signal change          ─┤
  6. Destroys old <img>              │
  7. Creates new <img>               │
  8. Renders to DOM                 ─┘
                                     
  9. RAF callback runs... but too late OR too early?
────────────────────────────────────────────────────────────────────
```

---

## 🔧 Proposed Solutions

### Option A: Use `afterNextRender` (Recommended)

Angular 17+ provides `afterNextRender` which fires after Angular completes rendering. This ensures the new `<img>` element exists in the DOM.

**Implementation in CrtEffectWrapperComponent**:
```typescript
import { afterNextRender, Injector } from '@angular/core';

refreshImage(): void {
  if (!this.renderer || this.webglContentType() !== 'image') return;

  // Schedule after Angular's next render completes
  afterNextRender(() => this.doRefreshImage(), { injector: this.injector });
}
```

**Pros**: 
- Guaranteed to run after DOM update
- Angular-native solution
- No timing hacks or retries

**Cons**:
- Requires injecting `Injector` if called outside constructor context

---

### Option B: MutationObserver on Content Container

Watch for DOM changes and trigger refresh when new `<img>` is added.

**Implementation**:
```typescript
private contentObserver: MutationObserver | null = null;

private setupContentObserver(): void {
  const wrapper = this.wrapperRef()?.nativeElement;
  if (!wrapper) return;

  this.contentObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        const addedImg = Array.from(mutation.addedNodes).find(
          (node) => node instanceof HTMLImageElement
        );
        if (addedImg) {
          this.handleNewImageElement(addedImg as HTMLImageElement);
        }
      }
    }
  });

  this.contentObserver.observe(wrapper, { childList: true, subtree: true });
}
```

**Pros**:
- Reactive to any DOM changes
- Works regardless of how images are changed

**Cons**:
- More complex
- Potential for duplicate triggers
- Must carefully handle cleanup

---

### Option C: Delay with Multiple RAF Frames

Use multiple `requestAnimationFrame` calls to ensure DOM has updated.

**Implementation**:
```typescript
refreshImage(): void {
  if (!this.renderer || this.webglContentType() !== 'image') return;

  // Double-RAF to ensure Angular has rendered
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      this.doRefreshImage();
    });
  });
}
```

**Pros**:
- Simple change
- Often works in practice

**Cons**:
- Timing hack, not guaranteed
- May cause visible delay or flicker
- Fragile to browser/Angular version changes

---

## 📌 Recommended Approach: Option A

Use `afterNextRender` as it's the Angular-native solution designed for exactly this use case. It provides a guarantee that the callback runs after Angular has finished rendering, ensuring the new `<img>` element exists.

---

## 📁 File Scope

### Files to Modify

```
📝 libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts
   - Import `afterNextRender` and `Injector`
   - Inject `Injector` in constructor
   - Update `refreshImage()` to use `afterNextRender`
   - Add error handling if image still not found

📝 libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.spec.ts
   - Add tests for image cycling scenario
   - Test refreshImage() finds new image after render
```

### Files to Review (Context)

```
📖 libs/ui/components/src/lib/cycle-image/cycle-image.component.ts
   - Understand imageChange event timing
   - Verify no changes needed here

📖 libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.html
   - Verify event binding is correct (already looks good)
```

---

## 📋 Implementation Tasks

### Task 1: Update refreshImage to Use afterNextRender

**Subtasks**:
- [ ] Import `afterNextRender` and `Injector` from `@angular/core`
- [ ] Inject `Injector` in the component constructor
- [ ] Replace `requestAnimationFrame` with `afterNextRender` in `refreshImage()`
- [ ] Add retry logic (up to 3 attempts) if image not found on first render
- [ ] Remove console.log debug statements (or convert to proper logging)

**Implementation Notes**:
- `afterNextRender` must be called from an injection context OR pass an injector
- Consider adding a timeout/retry in case the image element takes multiple render cycles
- Ensure cleanup of any pending callbacks on destroy

### Task 2: Update doRefreshImage Error Handling

**Subtasks**:
- [ ] Add validation that found image is the new image (not cached old one)
- [ ] Log warning if image not found after all retries
- [ ] Consider emitting an error event or falling back gracefully

### Task 3: Add Unit Tests

**Subtasks**:
- [ ] Test that `refreshImage()` eventually renders the new image
- [ ] Test that rapid cycling (multiple quick changes) handles correctly
- [ ] Test that destroy during refresh doesn't cause errors

---

## 🧪 Testing Strategy

### Manual Testing

1. **Navigate to player with image content** (not video)
2. **Enable CRT effects** (toggle ON)
3. **Wait for image cycle** (default 8 seconds)
4. **Verify**: New image should display with CRT effects
5. **Repeat**: Watch 2-3 cycles to confirm consistency
6. **Stress test**: Rapidly toggle CRT on/off during cycles

### Unit Tests to Add

```typescript
describe('refreshImage cycling', () => {
  it('should update texture when image element changes', async () => {
    // Setup: renderer with initial image
    // Action: call refreshImage() after DOM change simulation
    // Assert: renderer.setImageElement called with new element
  });

  it('should handle rapid cycling without errors', async () => {
    // Setup: multiple quick refreshImage() calls
    // Assert: no errors, latest image rendered
  });

  it('should not error if destroyed during refresh', async () => {
    // Setup: call refreshImage()
    // Action: destroy component before afterNextRender fires
    // Assert: no errors thrown
  });
});
```

---

## 🔗 Dependencies & Integration

### Prerequisites
- TASK-04-002A (Post-Processing Pipeline): ✅ Complete - Foundation in place

### Blocking
- This task blocks production use of CRT effects with image content (file-image component)

### Not Blocking
- TASK-04-003+ (Bloom, Barrel, Chromatic) - These can proceed in parallel as they add shader effects, not change image handling

---

## 📚 Reference Materials

### Angular Documentation
- [afterNextRender API](https://angular.dev/api/core/afterNextRender)
- [Render Phase callbacks](https://angular.dev/guide/components/lifecycle#afterrender-and-afternextrender)

### Related Task Report
- [TASK-04-002A Report](../reports/CRT-EFFECT-ENHANCEMENT-TASK-04-002A-REPORT.md) - Documents the issue in "Known Issues" section

### Codebase References
- `CrtEffectWrapperComponent.refreshImage()` - Current implementation
- `CycleImageComponent.emitImageChange()` - Event source
- `file-image.component.html` - Usage of both components together

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/CRT-EFFECT-ENHANCEMENT/reports/CRT-EFFECT-ENHANCEMENT-TASK-04-002B-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report when complete.

---

## ✅ Definition of Done

- [ ] Images cycle correctly in WebGL CRT mode
- [ ] No console errors during cycling
- [ ] No visual glitches (flickering, black frames)
- [ ] Unit tests added and passing
- [ ] Manual testing confirms fix works
- [ ] Debug console.log statements removed or converted to proper logging
- [ ] CSS fallback mode still works
- [ ] Video mode still works
- [ ] Report filed at specified location
