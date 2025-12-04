# Task Handoff: NAV-RAIL-TASK-01-002-HOVER-LOGIC

## 📋 Task Identity

**Task ID**: NAV-RAIL-TASK-01-002-HOVER-LOGIC
**Task Name**: Implement Hover Detection with Delay
**Assigned To**: UI Wizard
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Small (2-3 files)

---

## 🎯 Objective

**What**: Add mouseenter/mouseleave handlers with debounced timers to create the delayed expand/collapse behavior, preventing accidental triggers when mouse quickly passes over the rail.

**Why**: The delayed hover is a key UX feature that differentiates this from a simple hover interaction. It prevents frustrating accidental triggers while maintaining responsive feel.

**Success Criteria**:
- [ ] Mouse enter starts expand timer (doesn't expand immediately)
- [ ] Mouse leave before delay cancels expansion
- [ ] Mouse leave after expansion starts collapse timer
- [ ] Quick mouse pass-through doesn't trigger any state change
- [ ] Timers properly cleaned up on component destroy
- [ ] All timer-related tests pass using fakeAsync

---

## 📦 Context & Dependencies

**Prerequisites Completed**:
- NAV-RAIL-TASK-01-001-COMPONENT-STRUCTURE: Component structure with signals created

**Dependencies**:
- Angular `DestroyRef` for cleanup
- Component signals from Task 1 (`isExpanded`, `isHovering`)

**Constraints**:
- Delay must be configurable via `hoverDelayMs` input
- Both expand and collapse should use the same delay
- Must handle rapid hover/leave sequences gracefully

---

## 📂 File Scope

**Files to Modify**:
- `libs/ui/components/src/lib/nav-rail/nav-rail.component.ts` - Add hover logic
- `libs/ui/components/src/lib/nav-rail/nav-rail.component.html` - Add event bindings (if not using host)
- `libs/ui/components/src/lib/nav-rail/nav-rail.component.spec.ts` - Add timer tests

**Files to Review** (for patterns):
- `libs/ui/components/src/lib/content-overlay-container/content-overlay-container.component.ts` - Hover pattern reference (lines 246-290)

---

## 📝 Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md)
- [Testing Standards](../../../TESTING_STANDARDS.md) - fakeAsync patterns

**Key Requirements**:

1. **Private Timer Variables**:
   - `private expandTimer: ReturnType<typeof setTimeout> | null = null`
   - `private collapseTimer: ReturnType<typeof setTimeout> | null = null`

2. **Host Bindings** (in component decorator):
   ```typescript
   host: {
     '(mouseenter)': 'onMouseEnter()',
     '(mouseleave)': 'onMouseLeave()',
   }
   ```

3. **onMouseEnter() Method**:
   - Set `isHovering` to true
   - Clear any pending collapse timer
   - If not already expanded, start expand timer
   - When timer completes, set `isExpanded` to true

4. **onMouseLeave() Method**:
   - Set `isHovering` to false
   - Clear any pending expand timer
   - If currently expanded, start collapse timer
   - When timer completes, set `isExpanded` to false

5. **Timer Helpers**:
   - `clearExpandTimer()` - Clears expand timer if exists
   - `clearCollapseTimer()` - Clears collapse timer if exists
   - `startExpandTimer()` - Sets expand timer with delay
   - `startCollapseTimer()` - Sets collapse timer with delay

6. **Cleanup** (using DestroyRef):
   ```typescript
   private destroyRef = inject(DestroyRef);
   
   constructor() {
     this.destroyRef.onDestroy(() => {
       this.clearExpandTimer();
       this.clearCollapseTimer();
     });
   }
   ```

**Reference Pattern** from ContentOverlayContainerComponent:
- Check `onMouseEnter()` and `onMouseLeave()` methods
- Check `resetInactivityTimer()` and `clearInactivityTimer()` patterns

**Anti-Patterns to Avoid**:
- Don't use RxJS for this - simple setTimeout is cleaner for synchronous interaction
- Don't forget to clear timers on destroy (memory leak)
- Don't expand/collapse immediately without delay check

---

## 🧪 Testing Requirements

**Test Coverage Required**:
- [ ] Hovering for less than delay does NOT expand
- [ ] Hovering for longer than delay DOES expand
- [ ] Leaving for less than delay does NOT collapse (if expanded)
- [ ] Leaving for longer than delay DOES collapse
- [ ] Quick hover-leave cancels expansion
- [ ] Quick leave-hover cancels collapse
- [ ] Timers cleaned up on destroy

**Testing Approach**:

Use `fakeAsync` and `tick()` for timer testing:

```typescript
it('should not expand before delay completes', fakeAsync(() => {
  component.onMouseEnter();
  tick(100); // Less than 150ms delay
  expect(component.isExpanded()).toBe(false);
  
  component.onMouseLeave(); // Cancel before completion
  tick(100);
  expect(component.isExpanded()).toBe(false);
}));

it('should expand after delay completes', fakeAsync(() => {
  component.onMouseEnter();
  tick(150); // At or after delay
  expect(component.isExpanded()).toBe(true);
}));
```

---

## 📚 Reference Materials

**Related Documentation**:
- [Phase 1 Plan - Task 2](../phases/NAV-RAIL-PHASE-01-CORE-COMPONENT.md#task-2)
- [ContentOverlayContainerComponent](../../../libs/ui/components/src/lib/content-overlay-container/content-overlay-container.component.ts)

**Related Tasks**:
- NAV-RAIL-TASK-01-001-COMPONENT-STRUCTURE: Created the signals we'll update

---

## 📤 Output

**Output Report Location**: `docs/projects/NAV-RAIL/reports/NAV-RAIL-TASK-01-002-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)
