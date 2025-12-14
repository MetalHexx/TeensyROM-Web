# Task Handoff: WEBGL-ONLY-CRT-TASK-01-006-TOOLTIP-MOUSE-FIX

## 📋 Task Identity

**Task ID**: WEBGL-ONLY-CRT-TASK-01-006-TOOLTIP-MOUSE-FIX  
**Task Name**: Fix Tooltip Mouse Event Triggering Overlay Hide in Video Dialog  
**Assigned To**: UI Test Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Test Wizard.chatmode.md`  
**Priority**: High (Regression Bug)  
**Estimated Context Size**: Small (2-3 files)

---

## 🎯 Objective

**What**: Fix incorrect mouse event detection where hovering over Material tooltip causes the CRT settings panel and all overlays to hide in the video-dialog component.

**Why**: This is a regression that degrades user experience. When users hover over the preset button in the CRT settings panel, a tooltip appears. If they move their mouse over the tooltip, the system incorrectly treats this as "mouse left the container," causing all overlays (including the panel itself) to hide unexpectedly. The tooltip is part of the user's interaction context and should not trigger overlay hide behavior.

**Success Criteria**:
- [ ] Hovering over Material tooltips within the CRT settings panel does NOT trigger overlay hide
- [ ] Tooltip remains visible when mouse is over it
- [ ] CRT settings panel and other overlays remain visible when tooltip is active
- [ ] Mouse event detection correctly identifies tooltips as part of the container's interactive surface
- [ ] No regressions in existing overlay hide behavior (overlays still hide on genuine mouse leave events)
- [ ] All existing unit tests pass
- [ ] New behavioral tests verify tooltip interaction works correctly

---

## 🔍 Context & Dependencies

**Prerequisites Completed**:
- WEBGL-ONLY-CRT-TASK-01-002-UI-COMPONENTS-REFACTOR: CRT settings panel refactored
- Video dialog component using overlay-based architecture

**Root Cause Analysis**:

The issue stems from the interaction between:

1. **ContentOverlayContainerComponent** - Uses `mouseenter`/`mouseleave` events to control overlay visibility
2. **CrtSettingsPanelOverlayComponent** - Renders CRT panel in a CDK overlay outside the DOM hierarchy
3. **Material Tooltips** - Rendered in CDK overlay panes that are positioned absolutely in the `.cdk-overlay-container`

When a user hovers over a button with `matTooltip`, the tooltip appears in a `.cdk-overlay-pane` element. The CDK overlay detection in `ContentOverlayContainerComponent.isOverlayOwnedByContainer()` currently uses spatial proximity checks for tooltips (50px tolerance). However, when the mouse moves from the button to the tooltip itself, the browser fires a `mouseleave` event on the container because the tooltip is technically outside the container's DOM tree.

**Current Detection Strategy** (from `content-overlay-container.component.ts` lines 219-230):
```typescript
// Strategy 1: Tooltips - tight spatial check (50px tolerance)
const isTooltip = overlayPane.classList.contains('mat-mdc-tooltip-panel');
if (isTooltip) {
  const isNearContainer = 
    Math.abs(overlayRect.left - containerRect.left) < 50 &&
    Math.abs(overlayRect.top - containerRect.top) < 50;
  return isNearContainer;
}
```

This detection sets `hasCdkOverlayOpen` signal to `true` when a tooltip is detected, which should keep overlays visible. However, the `mouseleave` event on the container still fires and sets `isMouseOver` to `false`, causing overlays to hide because `shouldShowOverlays()` depends on both signals.

**The Fix**: We need to prevent the `mouseleave` event from setting `isMouseOver` to `false` when the user is simply moving from the container to a tooltip that belongs to the container.

---

## 📂 File Scope

**Files to Review** (for context):
- `libs/ui/components/src/lib/content-overlay-container/content-overlay-container.component.ts` - Mouse event handling and CDK overlay detection
- `libs/ui/components/src/lib/content-overlay-container/content-overlay-container.component.html` - Event binding structure
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html` - Tooltips on preset/close buttons (lines 15, 99)

**Files to Modify**:
- `libs/ui/components/src/lib/content-overlay-container/content-overlay-container.component.ts` - Update `onMouseLeave()` method

**Files to Modify (Tests)**:
- `libs/ui/components/src/lib/content-overlay-container/content-overlay-container.component.spec.ts` - Add tooltip interaction tests

---

## 🔧 Implementation Guidance

### Standards to Follow
- [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript conventions
- [Testing Standards](../../../TESTING_STANDARDS.md) - Behavioral testing approach
- [Component Library](../../../COMPONENT_LIBRARY.md) - UI component patterns

### Key Requirements

#### 1. Fix Mouse Leave Behavior

**Update `onMouseLeave()` method** in `ContentOverlayContainerComponent`:

**Current behavior** (problematic):
```typescript
onMouseLeave(): void {
  this.isMouseOver.set(false);
  this.clearInactivityTimer();
}
```

**Required behavior**:
- Check if any owned CDK overlays are currently open **before** setting `isMouseOver` to `false`
- If tooltips or dropdowns belonging to this container are open, **defer** the mouse leave action
- The overlay detection logic already runs via `MutationObserver`, so `hasCdkOverlayOpen()` signal should reflect tooltip presence
- Only set `isMouseOver` to `false` if `hasCdkOverlayOpen()` is `false`

**Approach**:
```typescript
onMouseLeave(): void {
  // Don't hide overlays if user moved to a tooltip/dropdown owned by this container
  if (!this.hasCdkOverlayOpen()) {
    this.isMouseOver.set(false);
  }
  this.clearInactivityTimer();
}
```

**Alternative Consideration**: You may also want to re-check overlay status when a tooltip closes to ensure `isMouseOver` gets set to `false` at the right time. The existing `MutationObserver` in `setupCdkOverlayObserver()` should handle this automatically by calling `checkForOpenOverlays()` when overlays are removed.

#### 2. Verify Existing Detection Logic

**Review `isOverlayOwnedByContainer()` method** (lines 189-231):
- Tooltip detection uses 50px spatial tolerance - verify this is sufficient for video-dialog layout
- Ensure tooltips positioned at various button locations (top-right close, top-left preset) are correctly detected
- The CRT settings panel is excluded from detection (intentionally) - confirm tooltips within it ARE detected

**Testing hint**: Use browser DevTools to inspect tooltip positioning and container bounds during interaction.

#### 3. Edge Case Handling

**Consider these scenarios**:
- User hovers preset button → tooltip appears → user moves to tooltip → tooltip should stay
- User moves from tooltip back to button → should work seamlessly
- User moves from tooltip directly out of container → overlays should hide (genuine leave)
- Multiple tooltips (preset button, close button) - ensure detection works for both

**Timing considerations**:
- `MutationObserver` runs asynchronously - ensure `hasCdkOverlayOpen()` updates before `onMouseLeave()` fires
- Material tooltip has show/hide delays (default 0ms show, 0ms hide) - might affect detection timing

---

## 🧪 Testing Requirements

### Test Coverage Required

**Unit Tests** (in `content-overlay-container.component.spec.ts`):

- [ ] **Tooltip interaction prevents overlay hide**: When tooltip is visible and mouse leaves container, overlays remain visible
- [ ] **Mouse leave after tooltip closes**: When tooltip closes and mouse is outside container, overlays hide
- [ ] **Tooltip opens on hover**: Hovering a button with tooltip shows the tooltip and keeps overlays visible
- [ ] **Multiple tooltips**: Sequential tooltip interactions work correctly without flicker
- [ ] **Genuine mouse leave**: Moving mouse outside container (no tooltip) hides overlays as expected

### Behavioral Expectations

**What users should observe**:
- Preset button tooltip appears on hover, stays visible when mouse moves to tooltip
- Close button tooltip works the same way
- No visual flicker or premature hiding when moving between button and tooltip
- Overlays hide smoothly when user genuinely moves mouse away from entire interactive area

**Error conditions to handle**:
- Tooltip appears but overlay detection fails to recognize it (should not hide overlays)
- Tooltip closes while mouse is over it (overlays should hide if mouse is not over container)

---

## 📚 Reference Materials

### Related Documentation
- [Master Plan](../WEBGL-ONLY-CRT-MASTER-PLAN.md#phase-1) - Project context
- [Phase 1 Plan](../phases/WEBGL-ONLY-CRT-PHASE-01-IMPLEMENTATION.md) - Current phase objectives
- [Component Library: ContentOverlayContainer](../../../COMPONENT_LIBRARY.md#content-overlay-container) - Component usage patterns

### Related Code Patterns
- **CDK Overlay Detection**: Existing logic in `isOverlayOwnedByContainer()` method
- **Mouse Event Handling**: Pattern in `onMouseEnter()` and `onMouseActivity()` methods
- **Signal-Based State**: Usage of `isMouseOver`, `hasCdkOverlayOpen`, and `shouldShowOverlays` computed signal

### Related Tasks
- WEBGL-ONLY-CRT-TASK-01-002-UI-COMPONENTS-REFACTOR: Created overlay-based architecture
- WEBGL-ONLY-CRT-TASK-01-003-FEATURE-COMPONENTS-UPDATE: Updated video-dialog to use overlay pattern

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/WEBGL-ONLY-CRT/reports/WEBGL-ONLY-CRT-TASK-01-006-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report

---

## 💡 Implementation Notes

### Why This Fix Works

The key insight is that `hasCdkOverlayOpen()` signal already tracks tooltip presence through the `MutationObserver`. When a tooltip appears, the observer detects it and calls `checkForOpenOverlays()`, which sets `hasCdkOverlayOpen.set(true)`. 

By checking this signal in `onMouseLeave()`, we prevent premature hiding when the user is simply navigating from button to tooltip. The tooltip is part of the interactive context, so the overlays should remain visible.

When the tooltip eventually closes (user moves away entirely), the `MutationObserver` detects its removal and sets `hasCdkOverlayOpen.set(false)`. At that point, if `isMouseOver` is also `false`, the overlays will hide correctly via the `shouldShowOverlays()` computed signal.

### Alternative Approaches Considered

**1. Expand spatial tolerance for tooltips**
- ❌ Not reliable - tooltip positioning varies by button location and viewport size
- ❌ Could cause false positives detecting unrelated tooltips

**2. Use `relatedTarget` in mouse event**
- ❌ `relatedTarget` for tooltips points to body, not the tooltip element
- ❌ CDK overlays render outside DOM hierarchy, making traversal unreliable

**3. Debounce the `mouseleave` event**
- ❌ Adds latency to legitimate hide actions
- ❌ Doesn't solve root cause (would just delay the wrong behavior)

**4. Check overlay state in `onMouseLeave()` (CHOSEN)**
- ✅ Uses existing detection infrastructure
- ✅ No additional complexity or timing issues
- ✅ Handles all transient overlay types (tooltips, dropdowns)
- ✅ Works with existing `shouldShowOverlays()` computed signal logic

---

## 🚀 Handoff Complete

Worker subagent: Please read this handoff document, diagnose and fix the tooltip mouse event issue, write comprehensive tests, and save your completion report to the specified OUTPUT_DOC location.

**Debug Strategy**:
1. Run the app and reproduce the issue in video-dialog
2. Use browser DevTools to inspect tooltip element structure and positioning
3. Add console logging to `onMouseLeave()` and `checkForOpenOverlays()` to observe state changes
4. Verify `hasCdkOverlayOpen()` updates correctly when tooltip appears/disappears
5. Test the fix across different button positions (preset vs close button)
6. Write tests to prevent regression

**Good luck!** 🐛🔧
