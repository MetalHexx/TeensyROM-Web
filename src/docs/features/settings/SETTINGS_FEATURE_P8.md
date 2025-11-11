# Phase 8: Undo/Redo with Keyboard Shortcuts

## 🎯 Objective

Implement undo/redo capability that allows users to revert and reapply settings changes through buttons and keyboard shortcuts. Each undo/redo operation updates the form with historical settings snapshots, provides visual feedback about history position, and maintains the debounced auto-save workflow. This phase gives users confidence to experiment with settings knowing they can easily revert mistakes.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md) - High-level feature overview
- [ ] [Phase 7 Completion](./SETTINGS_FEATURE_P7.md) - Auto-save functionality (prerequisite)
- [ ] [Phase 3 - Undo/Redo Actions](./SETTINGS_FEATURE_P3.md#task-7-implement-undoredo-actions) - Store undo/redo implementation

**Standards & Guidelines:**

- [ ] [Coding Standards](../../CODING_STANDARDS.md) - Component patterns and keyboard handling
- [ ] [Testing Standards](../../TESTING_STANDARDS.md) - Testing approaches
- [ ] [Smart Component Testing](../../SMART_COMPONENT_TESTING.md) - Component testing patterns
- [ ] [Style Guide](../../STYLE_GUIDE.md) - Button and toolbar styling

---

## 📂 File Structure Overview

> Modified settings view for undo/redo functionality.

```
libs/features/settings/src/lib/
├── settings-view/
│   ├── settings-view.component.ts            📝 Modified - Add undo/redo logic and keyboard handlers
│   ├── settings-view.component.html          📝 Modified - Add undo/redo toolbar
│   ├── settings-view.component.scss          📝 Modified - Style toolbar
│   └── settings-view.component.spec.ts       📝 Modified - Add undo/redo tests
```

---

<details open>
<summary><h3>Task 1: Add Undo/Redo Toolbar</h3></summary>

**Purpose**: Create a toolbar with Material icon buttons for undo and redo operations, positioned prominently in the settings view header.

**Related Documentation:**

- [Component Library](../../COMPONENT_LIBRARY.md) - Toolbar patterns
- [Style Guide](../../STYLE_GUIDE.md) - Button styling
- Angular Material Toolbar - MatToolbar and MatButton

**Implementation Subtasks:**

- [ ] **Add toolbar container**: Create toolbar in settings header
- [ ] **Add undo button**: MatIconButton with `undo` icon
- [ ] **Add redo button**: MatIconButton with `redo` icon
- [ ] **Add tooltips**: Descriptive tooltips showing keyboard shortcuts
- [ ] **Bind disabled state**: Connect to store's `canUndo` and `canRedo` signals
- [ ] **Position toolbar**: Place prominently but not intrusively

**Testing Subtask:**

- [ ] **Write Toolbar Tests**: Test buttons render and disable correctly (see Testing section)

**Key Implementation Notes:**

- Use Material icon buttons for clean appearance
- Tooltips should show keyboard shortcuts (e.g., "Undo (Ctrl+Z)")
- Buttons disabled when undo/redo not available
- Consider placing in header next to save status indicator
- Use accessibility attributes for screen readers

**Toolbar Template** (structure only):

```html
<div class="settings-header">
  <div class="header-content">
    <h1>Application Settings</h1>
    <p>Configure TeensyROM behavior and preferences</p>
  </div>
  
  <div class="header-actions">
    <button mat-icon-button 
            [disabled]="!store.canUndo()"
            (click)="undo()"
            matTooltip="Undo (Ctrl+Z)"
            aria-label="Undo last change">
      <mat-icon>undo</mat-icon>
    </button>
    
    <button mat-icon-button 
            [disabled]="!store.canRedo()"
            (click)="redo()"
            matTooltip="Redo (Ctrl+Y)"
            aria-label="Redo last undone change">
      <mat-icon>redo</mat-icon>
    </button>
    
    <!-- Save status indicator from Phase 7 -->
  </div>
</div>
```

**Testing Focus for Task 1:**

> Focus on **toolbar rendering** - ensure buttons display and disable correctly.

**Behaviors to Test:**

- [ ] Undo button renders with undo icon
- [ ] Redo button renders with redo icon
- [ ] Undo button disabled when `canUndo` is false
- [ ] Redo button disabled when `canRedo` is false
- [ ] Tooltips display with keyboard shortcuts
- [ ] Buttons enabled when history available

</details>

<details open>
<summary><h3>Task 2: Wire Undo/Redo Button Actions</h3></summary>

**Purpose**: Connect button click events to store's undo and redo methods, triggering history navigation.

**Related Documentation:**

- [Phase 3 - Undo/Redo Actions](./SETTINGS_FEATURE_P3.md#task-7-implement-undoredo-actions) - Store action details
- [Store Testing Guide](../../STORE_TESTING.md) - Testing store interactions

**Implementation Subtasks:**

- [ ] **Implement undo method**: Call `store.undo()` on button click
- [ ] **Implement redo method**: Call `store.redo()` on button click
- [ ] **Verify store updates**: Confirm store state changes after undo/redo
- [ ] **Add logging**: Log undo/redo operations for debugging

**Testing Subtask:**

- [ ] **Write Button Action Tests**: Test button clicks trigger store methods (see Testing section)

**Key Implementation Notes:**

- Button click handlers are simple method calls
- Store handles all undo/redo logic internally
- Form will update via effect (Task 3)
- Consider haptic feedback on mobile (future enhancement)
- Log operations for debugging and analytics

**Action Methods** (structure only):

```typescript
export class SettingsViewComponent {
  private readonly store = inject(SettingsStore);
  
  undo(): void {
    console.log('Undo triggered');
    this.store.undo();
  }
  
  redo(): void {
    console.log('Redo triggered');
    this.store.redo();
  }
}
```

**Testing Focus for Task 2:**

> Focus on **action invocation** - ensure store methods are called.

**Behaviors to Test:**

- [ ] Clicking undo button calls `store.undo()`
- [ ] Clicking redo button calls `store.redo()`
- [ ] Methods called exactly once per click
- [ ] Logging occurs for each operation
- [ ] No errors thrown during execution

</details>

<details open>
<summary><h3>Task 3: Update Form on Undo/Redo</h3></summary>

**Purpose**: React to store state changes after undo/redo operations by updating the form with historical settings values.

**Related Documentation:**

- [Coding Standards - Effects](../../CODING_STANDARDS.md#effects) - Angular effect patterns
- [Phase 3 - Store State](./SETTINGS_FEATURE_P3.md#task-1-define-store-state-interface) - State properties

**Implementation Subtasks:**

- [ ] **Create effect**: Watch store settings signal
- [ ] **Detect undo/redo**: Identify when settings change due to history navigation
- [ ] **Patch form values**: Update form with historical settings
- [ ] **Suppress valueChanges**: Prevent form update from triggering save
- [ ] **Maintain focus**: Preserve user's form field focus after update

**Testing Subtask:**

- [ ] **Write Form Update Tests**: Test form updates after undo/redo (see Testing section)

**Key Implementation Notes:**

- Use Angular effect to watch store settings changes
- Patch form with `{ emitEvent: false }` to suppress valueChanges
- This prevents undo/redo from triggering auto-save
- Form update should be seamless (no flicker)
- Consider preserving cursor position in text fields
- Effect should run after undo/redo but not during normal saves

**Form Update Effect** (structure only):

```typescript
private readonly updateFormEffect = effect(() => {
  const settings = this.store.settings();
  const historyIndex = this.store.historyIndex();
  
  // Only update if undo/redo occurred (history index changed)
  // Not during normal saves (history index stays same)
  this.form.patchValue(settings, { emitEvent: false });
});
```

**Testing Focus for Task 3:**

> Focus on **form synchronization** - ensure form updates match history.

**Behaviors to Test:**

- [ ] Form updates when undo is triggered
- [ ] Form updates when redo is triggered
- [ ] Form values match historical settings
- [ ] Form update doesn't trigger valueChanges
- [ ] Form update doesn't trigger auto-save
- [ ] All form fields update correctly

</details>

<details open>
<summary><h3>Task 4: Implement Keyboard Shortcuts</h3></summary>

**Purpose**: Add keyboard event handlers for Ctrl+Z (undo) and Ctrl+Y / Ctrl+Shift+Z (redo) to provide power-user efficiency.

**Related Documentation:**

- [Coding Standards - Keyboard Handlers](../../CODING_STANDARDS.md#keyboard-handling) - Event handler patterns
- Angular HostListener - Keyboard event handling

**Implementation Subtasks:**

- [ ] **Add HostListener for Ctrl+Z**: Trigger undo on keyboard shortcut
- [ ] **Add HostListener for Ctrl+Y**: Trigger redo on keyboard shortcut
- [ ] **Add HostListener for Ctrl+Shift+Z**: Alternative redo shortcut
- [ ] **Prevent default behavior**: Stop browser's native undo/redo
- [ ] **Check if action available**: Only execute if undo/redo possible
- [ ] **Add Mac support**: Handle Cmd key instead of Ctrl on Mac

**Testing Subtask:**

- [ ] **Write Keyboard Tests**: Test shortcuts trigger actions (see Testing section)

**Key Implementation Notes:**

- Use `@HostListener` decorator for keyboard events
- Prevent default to stop browser native behavior
- Check platform for Mac-specific shortcuts (Cmd vs Ctrl)
- Only execute if undo/redo is available (check store signals)
- Consider adding keyboard shortcut indicator in UI
- Test keyboard shortcuts work when form fields focused

**Keyboard Handler Pattern** (structure only):

```typescript
@HostListener('window:keydown.control.z', ['$event'])
@HostListener('window:keydown.meta.z', ['$event']) // Mac
handleUndo(event: KeyboardEvent): void {
  if (this.store.canUndo()) {
    event.preventDefault();
    this.undo();
  }
}

@HostListener('window:keydown.control.y', ['$event'])
@HostListener('window:keydown.meta.y', ['$event']) // Mac
@HostListener('window:keydown.control.shift.z', ['$event'])
@HostListener('window:keydown.meta.shift.z', ['$event']) // Mac
handleRedo(event: KeyboardEvent): void {
  if (this.store.canRedo()) {
    event.preventDefault();
    this.redo();
  }
}
```

**Testing Focus for Task 4:**

> Focus on **keyboard interaction** - ensure shortcuts work correctly.

**Behaviors to Test:**

- [ ] Ctrl+Z triggers undo when available
- [ ] Ctrl+Z does nothing when undo not available
- [ ] Ctrl+Y triggers redo when available
- [ ] Ctrl+Shift+Z triggers redo (alternative)
- [ ] Shortcuts work when form fields focused
- [ ] Default browser behavior prevented
- [ ] Mac Command key works (if testable)

</details>

<details open>
<summary><h3>Task 5: Add History Position Indicator</h3></summary>

**Purpose**: Display a visual indicator showing the user's current position in the undo/redo history stack, providing context about available operations.

**Related Documentation:**

- [Style Guide](../../STYLE_GUIDE.md) - Status indicator patterns
- [Component Library](../../COMPONENT_LIBRARY.md) - Indicator components

**Implementation Subtasks:**

- [ ] **Add indicator component**: Display current position in history
- [ ] **Show position text**: Format as "Change 3 of 10" or similar
- [ ] **Bind to store signals**: Connect to history and historyIndex
- [ ] **Position indicator**: Place near undo/redo buttons
- [ ] **Handle empty history**: Show appropriate message when no history
- [ ] **Style indicator**: Make readable but unobtrusive

**Testing Subtask:**

- [ ] **Write Indicator Tests**: Test indicator displays correct position (see Testing section)

**Key Implementation Notes:**

- Calculate position from `historyIndex` and `history.length`
- Consider showing "No changes" when history is empty
- Update immediately when undo/redo occurs
- Format should be clear and concise
- Consider showing timestamp of current position (enhancement)
- Indicator helps users understand undo/redo state

**Indicator Template** (structure only):

```html
<div class="history-indicator">
  @if (store.history().length > 0) {
    <span class="history-position">
      Change {{ store.historyIndex() + 1 }} of {{ store.history().length }}
    </span>
  } @else {
    <span class="no-history">No changes</span>
  }
</div>
```

**Testing Focus for Task 5:**

> Focus on **position display** - ensure indicator shows correct information.

**Behaviors to Test:**

- [ ] Indicator shows correct position after undo
- [ ] Indicator shows correct position after redo
- [ ] Indicator updates when new changes made
- [ ] "No changes" displays when history empty
- [ ] Position calculation is correct (1-indexed for users)
- [ ] Indicator updates immediately on state changes

</details>

<details open>
<summary><h3>Task 6: Style Undo/Redo Toolbar and Indicator</h3></summary>

**Purpose**: Apply SCSS styling to make the undo/redo toolbar and history indicator visually integrated with the settings view.

**Related Documentation:**

- [Style Guide](../../STYLE_GUIDE.md) - Toolbar and button styling
- [Coding Standards - SCSS](../../CODING_STANDARDS.md#scss-conventions) - SCSS patterns

**Implementation Subtasks:**

- [ ] **Style toolbar container**: Layout and spacing for header actions
- [ ] **Style buttons**: Consistent button appearance
- [ ] **Style disabled state**: Visual feedback for disabled buttons
- [ ] **Style history indicator**: Readable text with appropriate sizing
- [ ] **Add hover states**: Interactive feedback on buttons
- [ ] **Ensure responsive**: Works on mobile viewports

**Testing Subtask:**

- [ ] **Manual Visual Testing**: Verify toolbar and indicator appearance

**Key Implementation Notes:**

- Toolbar should integrate with settings header seamlessly
- Disabled buttons should be visually distinct
- Hover states provide interactive feedback
- Consider button size for touch targets on mobile
- History indicator should not distract from main content
- Use theme colors for consistency

**Toolbar Styles** (pattern only):

```scss
.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-lg);
  
  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    
    button[mat-icon-button] {
      &[disabled] {
        opacity: 0.38;
      }
    }
  }
}

.history-indicator {
  font-size: 0.875rem;
  color: var(--text-secondary);
  padding: 0 var(--spacing-sm);
  
  .no-history {
    font-style: italic;
  }
}
```

**Testing Focus for Task 6:**

> Focus on **visual integration** - ensure toolbar fits design system.

**Visual Testing Checklist:**

- [ ] Toolbar integrated with header layout
- [ ] Buttons sized appropriately
- [ ] Disabled state visually clear
- [ ] Hover states work smoothly
- [ ] History indicator readable
- [ ] Works on mobile viewports
- [ ] Colors match theme

</details>

<details open>
<summary><h3>Task 7: Add Undo/Redo Integration Tests</h3></summary>

**Purpose**: Create comprehensive tests that verify the complete undo/redo workflow including form updates, keyboard shortcuts, and history management.

**Related Documentation:**

- [Testing Standards - Integration Testing](../../TESTING_STANDARDS.md#integration-testing) - Integration patterns
- [Store Testing Guide](../../STORE_TESTING.md) - Store integration testing

**Implementation Subtasks:**

- [ ] **Test button undo/redo**: Verify button clicks work end-to-end
- [ ] **Test keyboard undo/redo**: Verify shortcuts work end-to-end
- [ ] **Test form updates**: Verify form synchronizes with history
- [ ] **Test history boundaries**: Verify behavior at stack limits
- [ ] **Test undo after changes**: Verify new changes clear redo stack
- [ ] **Test position indicator**: Verify indicator updates correctly

**Testing Subtask:**

- [ ] **Write Integration Tests**: Test complete undo/redo workflows (see Testing section)

**Key Implementation Notes:**

- Test both button and keyboard triggers
- Verify form values match history at each step
- Test boundary conditions (no undo/redo available)
- Test that new changes after undo clear redo stack
- Use fakeAsync for timing-dependent tests
- Mock store or use real store with test data

**Integration Test Pattern** (structure only):

```typescript
describe('Settings Undo/Redo', () => {
  it('should undo and redo changes correctly', () => {
    const component = fixture.componentInstance;
    const store = TestBed.inject(SettingsStore);
    
    // Make change
    component.form.patchValue({ player: { repeatMode: 'Single' } });
    fixture.detectChanges();
    
    // Undo
    component.undo();
    fixture.detectChanges();
    expect(component.form.value.player.repeatMode).toBe('Off');
    
    // Redo
    component.redo();
    fixture.detectChanges();
    expect(component.form.value.player.repeatMode).toBe('Single');
  });
  
  it('should handle keyboard shortcuts', () => {
    // Simulate Ctrl+Z
    const event = new KeyboardEvent('keydown', { 
      key: 'z', 
      ctrlKey: true 
    });
    component.handleUndo(event);
    // Verify undo occurred
  });
});
```

**Testing Focus for Task 7:**

> Focus on **complete workflows** - ensure undo/redo works end-to-end.

**Behaviors to Test:**

- [ ] Button clicks trigger undo/redo
- [ ] Keyboard shortcuts trigger undo/redo
- [ ] Form updates after undo/redo
- [ ] History position indicator updates
- [ ] Undo at beginning does nothing
- [ ] Redo at end does nothing
- [ ] New change after undo clears redo
- [ ] Multiple undo/redo operations work correctly

</details>

---

## ✅ Success Criteria

> Mark these checkboxes as you validate each criterion.

- [ ] **Toolbar Added**: Undo/redo buttons display in header
- [ ] **Buttons Work**: Clicking buttons triggers undo/redo
- [ ] **Form Updates**: Form synchronizes with history after undo/redo
- [ ] **Keyboard Shortcuts**: Ctrl+Z and Ctrl+Y trigger operations
- [ ] **Position Indicator**: History position displays correctly
- [ ] **Styling Complete**: Toolbar and indicator visually integrated
- [ ] **Disabled States**: Buttons disabled at history boundaries
- [ ] **All Tests Pass**: Unit and integration tests pass
- [ ] **User Experience Smooth**: Operations feel instant and responsive

---

## 🧪 Testing Summary

### Testing Approach

This phase focuses on **undo/redo functionality and keyboard interaction**:

1. **Toolbar Tests**: Verify buttons render and disable correctly
2. **Action Tests**: Verify button clicks trigger store methods
3. **Form Update Tests**: Verify form synchronizes with history
4. **Keyboard Tests**: Verify shortcuts trigger operations
5. **Indicator Tests**: Verify position display updates
6. **Integration Tests**: Verify complete undo/redo workflows

### Test Types by Task

| Task | Test Type | Focus |
|------|-----------|-------|
| Task 1 | Unit | Toolbar rendering |
| Task 2 | Unit | Action invocation |
| Task 3 | Unit | Form synchronization |
| Task 4 | Unit | Keyboard shortcuts |
| Task 5 | Unit | Position indicator |
| Task 6 | Manual | Visual appearance |
| Task 7 | Integration | Complete workflows |

### Testing Standards Reference

- Follow [Testing Standards](../../TESTING_STANDARDS.md) for behavioral testing
- Use [Smart Component Testing](../../SMART_COMPONENT_TESTING.md) for component patterns
- Test keyboard events with KeyboardEvent mocks
- Verify accessibility attributes

---

## 📝 Implementation Notes

> Track discoveries, decisions, and issues encountered during implementation.

### Discoveries During Implementation

- [Add notes here as you implement]

### Blockers & Questions

- [Document any blockers or questions here]

### Deviations from Plan

- [Note any changes from the original plan and why]

---

## 🔗 Related Documentation

- **Previous Phase**: [Phase 7 - Auto-Save & Change Detection](./SETTINGS_FEATURE_P7.md)
- **Next Phase**: [Phase 9 - E2E Testing & Polish](./SETTINGS_FEATURE_P9.md)
- **Feature Overview**: [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md)
- **Undo/Redo Store**: [Phase 3 - Undo/Redo Actions](./SETTINGS_FEATURE_P3.md#task-7-implement-undoredo-actions)
- **Angular HostListener**: Angular keyboard event handling

---

_Phase Status: Ready for Implementation_
_Last Updated: 2025-01-11_
_Estimated Effort: 3-4 hours_
