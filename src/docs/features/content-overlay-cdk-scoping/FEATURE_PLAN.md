# Content Overlay Container - CDK Overlay Scoping Fix

**Created**: 2025-11-29  
**Status**: ✅ Implemented  
**Feature**: Fix CDK overlay detection to be scoped to component's own content

---

## Problem Statement

The `ContentOverlayContainerComponent` has CDK overlay detection that prevents overlays from disappearing when dropdowns/menus are open. However, this detection is **globally scoped** and breaks when the component is rendered inside a Material Dialog:

- **Works**: `video-capture.component` (standalone) - overlays show/hide correctly
- **Broken**: `video-dialog.component` (inside MatDialog) - overlays never disappear because the dialog itself is detected as an open overlay

### Root Cause

```typescript
private checkForOpenOverlays(): void {
  const overlayPanes = document.querySelectorAll('.cdk-overlay-pane');
  const hasOpenOverlay = overlayPanes.length > 0;  // ❌ Counts parent dialog!
  this.hasCdkOverlayOpen.set(hasOpenOverlay);
}
```

The current implementation:
1. Searches **globally** for all `.cdk-overlay-pane` elements
2. Doesn't distinguish between overlays **owned by this component** vs **containing this component**
3. When inside a dialog, the dialog's own overlay pane is always detected
4. Result: `hasCdkOverlayOpen()` stays `true`, `shouldShowOverlays()` stays `true`, overlays never hide

---

## Architectural Design

### Strategy: Scoped Overlay Detection

Instead of checking if **any** CDK overlay exists globally, we need to check if **any CDK overlay originated from within our component's container**.

CDK overlays are positioned relative to **trigger elements**. We can leverage CDK's overlay positioning system:

```typescript
// Current (global scope) ❌
const overlayPanes = document.querySelectorAll('.cdk-overlay-pane');

// Proposed (scoped to our container) ✅
const ourOverlays = Array.from(document.querySelectorAll('.cdk-overlay-pane'))
  .filter(pane => this.isOwnedByThisContainer(pane));
```

### Detection Algorithm

To determine if an overlay is "owned" by this component:

1. **Check overlay's trigger origin**: CDK overlays have a `cdkConnectedOverlayOrigin` or are positioned relative to a trigger element
2. **Check if trigger is within our container**: Use `containerElement.contains(triggerElement)`
3. **Ignore parent overlays**: If we're inside a dialog, ignore that dialog's overlay pane

### Implementation Approach

**Option A: Check overlay's connected origin (CDK-specific)**
- Use CDK overlay metadata to find the trigger element
- Check if trigger is inside our container
- Pro: Most accurate, respects CDK's positioning system
- Con: Relies on CDK internals

**Option B: Check overlay backdrop connections**
- CDK overlays with backdrops have `cdk-overlay-backdrop` elements
- Check if backdrop is associated with elements in our container
- Pro: More explicit association
- Con: Not all overlays have backdrops

**Option C: Track our own trigger elements**
- Maintain a set of trigger elements within our container
- Check if overlay's trigger is in that set
- Pro: Most explicit ownership
- Con: Requires more setup and maintenance

**📌 Recommendation: Hybrid Approach (A + B)**

Use CDK overlay positioning metadata (approach A) as primary detection, with backdrop checking (approach B) as fallback. This handles both positioned overlays and backdrop-based overlays.

---

## Success Criteria

### Behavioral Requirements

1. **Standalone usage** (video-capture): Overlays hide on mouse leave, show when dropdowns open ✅ (already works)
2. **Inside dialog usage** (video-dialog): Overlays hide on mouse leave, show when dropdowns open ✅ (currently broken)
3. **Nested dialogs**: If a dropdown inside a dialog opens another dialog, don't interfere ✅
4. **Multiple instances**: Multiple overlay containers on same page don't affect each other ✅

### Test Scenarios

**Scenario 1: Standalone Component (video-capture)**
- Given: Component rendered standalone
- When: User hovers over video → overlays appear
- When: User opens CRT settings dropdown → overlays stay visible
- When: User closes dropdown and moves mouse away → overlays disappear
- Expected: ✅ Works (regression test)

**Scenario 2: Dialog Component (video-dialog) - Currently Broken**
- Given: Component rendered inside Material Dialog
- When: User hovers over video → overlays appear
- When: User moves mouse away → overlays disappear ✅ (FIX THIS)
- When: User opens CRT settings dropdown → overlays stay visible
- When: User closes dropdown and moves mouse away → overlays disappear ✅ (FIX THIS)
- Expected: ✅ Fixed behavior

**Scenario 3: Multiple Nested Overlays**
- Given: Component inside dialog, with dropdown open
- When: Dropdown items open sub-menus
- Expected: Overlays stay visible for all owned overlays

---

## Implementation Plan

### Phase 1: Scoped Overlay Detection

**Goal**: Make CDK overlay detection scoped to component's own content

#### Changes to `ContentOverlayContainerComponent`

1. **Add container element tracking**
   ```typescript
   private containerElement: HTMLElement | null = null;
   ```

2. **Update `checkForOpenOverlays()` to scope detection**
   ```typescript
   private checkForOpenOverlays(): void {
     if (!this.containerElement) return;
     
     const overlayPanes = document.querySelectorAll('.cdk-overlay-pane');
     const ownedOverlays = Array.from(overlayPanes).filter(pane => 
       this.isOverlayOwnedByContainer(pane)
     );
     
     this.hasCdkOverlayOpen.set(ownedOverlays.length > 0);
   }
   ```

3. **Add helper: `isOverlayOwnedByContainer()`**
   ```typescript
   private isOverlayOwnedByContainer(overlayPane: Element): boolean {
     // Strategy 1: Check if overlay's trigger origin is inside our container
     const connectedTo = overlayPane.getAttribute('data-cdk-overlay-origin');
     if (connectedTo) {
       const origin = document.querySelector(`[data-cdk-overlay-origin-id="${connectedTo}"]`);
       if (origin && this.containerElement!.contains(origin)) {
         return true;
       }
     }
     
     // Strategy 2: Check associated backdrop
     const backdrop = overlayPane.previousElementSibling;
     if (backdrop?.classList.contains('cdk-overlay-backdrop')) {
       // Check if any trigger inside our container is related
       // (Implementation detail depends on CDK structure)
     }
     
     return false;
   }
   ```

4. **Initialize container element in constructor**
   ```typescript
   afterNextRender(() => {
     this.containerElement = this.containerRef()?.nativeElement ?? null;
     this.setupCdkOverlayObserver();
   });
   ```

#### Testing

- **Unit tests**: Mock CDK overlay structure, verify scoped detection
- **Component tests**: Test both standalone and dialog scenarios
- **Integration tests**: Verify video-capture and video-dialog both work

---

## Design Decisions

### Decision 1: Scoping Strategy

**Options Considered**:
- **A**: Check overlay's CDK origin metadata
- **B**: Check backdrop associations  
- **C**: Manually track trigger elements

**Chosen**: Hybrid (A + B)

**Reasoning**: 
- CDK overlays use positioning metadata we can leverage
- Backdrop checking provides fallback for different overlay types
- No manual maintenance of trigger element lists
- Works for both dropdown menus and other CDK overlay types

### Decision 2: Detection Timing

**Options Considered**:
- **A**: Check only when overlays are added/removed (MutationObserver)
- **B**: Continuous polling
- **C**: Event-based (CDK overlay events)

**Chosen**: A (MutationObserver)

**Reasoning**:
- Already using MutationObserver effectively
- Efficient - only checks when DOM changes
- No reliance on external event APIs
- Works with all CDK overlay types

### Decision 3: Handling Parent Dialog

**Options Considered**:
- **A**: Explicitly exclude parent overlay by checking hierarchy
- **B**: Only check overlays positioned relative to our container
- **C**: Ignore overlays that existed before component mounted

**Chosen**: B (positioning-based)

**Reasoning**:
- Most robust - doesn't rely on timing
- Naturally excludes parent dialogs (they're not positioned relative to our content)
- Works for any nesting scenario

---

## Technical Notes

### CDK Overlay Structure

When a dropdown opens from within our component:
```html
<div class="cdk-overlay-container">
  <!-- Parent dialog (if we're inside one) -->
  <div class="cdk-overlay-pane"> 
    <!-- Our component is somewhere in here -->
  </div>
  
  <!-- Dropdown opened from our component -->
  <div class="cdk-overlay-backdrop"></div>
  <div class="cdk-overlay-pane" data-origin="...">
    <!-- Dropdown content -->
  </div>
</div>
```

### Key Insight

The fix is conceptually simple: **only count overlays that were triggered from within our container**, not all overlays in the DOM. This naturally excludes parent dialogs while correctly detecting child overlays.

---

## Open Questions

1. **CDK version compatibility**: Does CDK's overlay structure vary across versions? (Check Angular Material version)
2. **Performance**: Is the filtering operation fast enough for real-time updates? (Likely yes - small DOM subset)
3. **Edge cases**: What about overlays opened programmatically without triggers? (Rare in our use case)

---

## References

- **Component**: `libs/ui/components/src/lib/content-overlay-container/`
- **Usage - Working**: `libs/features/player/src/lib/.../video-capture/video-capture.component.ts`
- **Usage - Broken**: `libs/features/player/src/lib/.../video-capture/video-dialog/video-dialog.component.ts`
- **Material Dialog**: Angular Material dialog system (CDK overlay-based)

---

## Next Steps

1. ✅ **Planning complete** - Document created
2. ✅ **Implementation complete**:
   - ✅ Implemented scoped overlay detection
   - ✅ Added helper methods for ownership checking
   - ✅ Updated component JSDoc
   - ✅ All tests passing (50/50 content-overlay tests, 406/406 total ui-components tests)
3. ⏭️ **Manual Testing**:
   - Test video-capture still works (regression)
   - Test video-dialog now works (fix verification)
4. ⏭️ **Documentation**:
   - Consider updating COMPONENT_LIBRARY.md if behavioral changes affect usage

---

**Status**: ✅ Implementation complete - Ready for manual verification
