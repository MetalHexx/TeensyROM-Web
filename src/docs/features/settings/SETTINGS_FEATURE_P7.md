# Phase 7: Auto-Save & Change Detection

## 🎯 Objective

Implement debounced auto-save that persists form changes to the backend after the user stops typing. Form value changes trigger store updates which save to the backend via the infrastructure service, with visual feedback during save operations. This phase eliminates "save button anxiety" by automatically persisting changes while providing clear status indicators.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md) - High-level feature overview
- [ ] [Phase 6 Completion](./SETTINGS_FEATURE_P6.md) - Reactive forms (prerequisite)
- [ ] [Phase 3 - Settings Store](./SETTINGS_FEATURE_P3.md) - Save action details

**Standards & Guidelines:**

- [ ] [Coding Standards](../../CODING_STANDARDS.md) - RxJS patterns and form handling
- [ ] [Testing Standards](../../TESTING_STANDARDS.md) - Testing approaches
- [ ] [Smart Component Testing](../../SMART_COMPONENT_TESTING.md) - Component testing patterns

**Angular/RxJS Documentation:**

- RxJS debounceTime operator - Debouncing patterns
- Angular Reactive Forms - valueChanges observable

---

## 📂 File Structure Overview

> Modified settings view for auto-save functionality.

```
libs/features/settings/src/lib/
├── settings-view/
│   ├── settings-view.component.ts            📝 Modified - Add auto-save logic
│   ├── settings-view.component.html          📝 Modified - Add save status indicator
│   ├── settings-view.component.scss          📝 Modified - Style save indicator
│   └── settings-view.component.spec.ts       📝 Modified - Add auto-save tests
```

---

<details open>
<summary><h3>Task 1: Subscribe to Form Value Changes</h3></summary>

**Purpose**: Set up a subscription to the form's `valueChanges` observable to detect when the user modifies any settings field.

**Related Documentation:**

- [Coding Standards - RxJS Subscriptions](../../CODING_STANDARDS.md#rxjs-patterns) - Subscription management
- Angular Reactive Forms - valueChanges documentation

**Implementation Subtasks:**

- [ ] **Subscribe to valueChanges**: Add subscription in component initialization
- [ ] **Use takeUntilDestroyed**: Automatically unsubscribe on component destroy
- [ ] **Filter valid changes**: Only process when form is valid
- [ ] **Map to domain model**: Convert FormGroup value to Settings model
- [ ] **Log changes**: Add debug logging for development

**Testing Subtask:**

- [ ] **Write Subscription Tests**: Test valueChanges triggers correctly (see Testing section)

**Key Implementation Notes:**

- Use `takeUntilDestroyed()` for automatic cleanup (modern Angular pattern)
- Only save when form is valid (prevents invalid data submission)
- Map form value to Settings domain model structure
- Consider initial form population edge case (don't save on init)
- Use `distinctUntilChanged()` to avoid duplicate saves

**Subscription Pattern** (structure only):

```typescript
export class SettingsViewComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  
  ngOnInit() {
    this.form.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef),
      filter(() => this.form.valid),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      // debounce will be added in Task 2
    ).subscribe(values => {
      console.log('Form changed:', values);
      // Save logic will be added in Task 3
    });
  }
}
```

**Testing Focus for Task 1:**

> Focus on **change detection** - ensure form changes are captured.

**Behaviors to Test:**

- [ ] valueChanges emits when form is modified
- [ ] Subscription filters out invalid form states
- [ ] distinctUntilChanged prevents duplicate emissions
- [ ] Subscription cleans up on component destroy
- [ ] Initial form population doesn't trigger change

</details>

<details open>
<summary><h3>Task 2: Add Debouncing to Prevent Excessive Saves</h3></summary>

**Purpose**: Apply debouncing to batch rapid form changes into a single save operation after the user stops typing (500ms idle time).

**Related Documentation:**

- [Coding Standards - RxJS Operators](../../CODING_STANDARDS.md#rxjs-operators) - Operator usage
- RxJS debounceTime - Debouncing documentation

**Implementation Subtasks:**

- [ ] **Add debounceTime operator**: Apply 500ms debounce to valueChanges stream
- [ ] **Configure debounce time**: Make configurable via constant for easy tuning
- [ ] **Test debounce behavior**: Verify rapid changes result in single save
- [ ] **Consider leading/trailing**: Use trailing debounce (save after idle)

**Testing Subtask:**

- [ ] **Write Debounce Tests**: Test debouncing prevents excessive saves (see Testing section)

**Key Implementation Notes:**

- 500ms is a good balance between responsiveness and batching
- Trailing debounce (default) waits until user stops typing
- Leading debounce would save immediately then suppress subsequent
- Make debounce time configurable for easy adjustment
- Test with fakeAsync and tick() for timing control

**Debounce Pattern** (structure only):

```typescript
const AUTO_SAVE_DEBOUNCE_MS = 500;

this.form.valueChanges.pipe(
  takeUntilDestroyed(this.destroyRef),
  filter(() => this.form.valid),
  distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
  debounceTime(AUTO_SAVE_DEBOUNCE_MS),
).subscribe(values => {
  // Save logic
});
```

**Testing Focus for Task 2:**

> Focus on **debouncing behavior** - ensure batching works correctly.

**Behaviors to Test:**

- [ ] Rapid changes result in single save after 500ms
- [ ] No save occurs if changes within 500ms window
- [ ] Save triggers after user stops typing for 500ms
- [ ] Multiple fields changing batch into one save
- [ ] Debounce time is configurable

</details>

<details open>
<summary><h3>Task 3: Trigger Store Save Action</h3></summary>

**Purpose**: Call the settings store's save action when debounced form changes occur, persisting changes to the backend.

**Related Documentation:**

- [Phase 3 - Save Action](./SETTINGS_FEATURE_P3.md#task-5-implement-save-settings-action) - Save action details
- [Store Testing Guide](../../STORE_TESTING.md) - Testing store interactions

**Implementation Subtasks:**

- [ ] **Map form value to Settings**: Convert FormGroup value to domain model
- [ ] **Call store updateSettings**: Update store with new settings
- [ ] **Call store saveSettings**: Trigger backend save
- [ ] **Handle save errors**: Log errors, preserve form state
- [ ] **Record save attempt**: For debugging and monitoring

**Testing Subtask:**

- [ ] **Write Save Trigger Tests**: Test store save is called (see Testing section)

**Key Implementation Notes:**

- Update store with section-specific update actions first
- Then call save action to persist to backend
- Don't reset form on save (preserve user's working state)
- Errors should not clear form or lose user changes
- Consider optimistic UI (assume save succeeds)

**Save Trigger Pattern** (structure only):

```typescript
.subscribe(values => {
  const settings: Settings = this.mapFormValueToSettings(values);
  
  // Update store state
  this.store.updatePlayerSettings(settings.player);
  this.store.updateFileTransferSettings(settings.fileTransfer);
  this.store.updateSearchSettings(settings.search);
  this.store.updateAppSettings(settings.app);
  
  // Persist to backend
  this.store.saveSettings();
});
```

**Testing Focus for Task 3:**

> Focus on **save invocation** - ensure store actions are called correctly.

**Behaviors to Test:**

- [ ] Form values map to Settings model correctly
- [ ] Store update actions called with correct data
- [ ] Store save action called after updates
- [ ] Form state preserved after save
- [ ] Errors logged but don't disrupt form
- [ ] Save attempt recorded for debugging

</details>

<details open>
<summary><h3>Task 4: Add Save Status Indicator</h3></summary>

**Purpose**: Display visual feedback showing save status (Saving, Saved, Error) so users know their changes are being persisted.

**Related Documentation:**

- [Style Guide](../../STYLE_GUIDE.md) - Status indicator patterns
- [Component Library](../../COMPONENT_LIBRARY.md) - Reusable indicator components

**Implementation Subtasks:**

- [ ] **Add status indicator component**: Create or reuse status display
- [ ] **Show "Saving..." state**: Display during save operation
- [ ] **Show "Saved" state**: Display with checkmark on success
- [ ] **Show error state**: Display with error icon and message on failure
- [ ] **Auto-hide "Saved"**: Hide after 2-3 seconds
- [ ] **Position indicator**: Place prominently but not intrusively
- [ ] **Bind to store signals**: Connect to `isLoading` and `error` signals

**Testing Subtask:**

- [ ] **Write Status Indicator Tests**: Test indicator updates correctly (see Testing section)

**Key Implementation Notes:**

- Bind to store's `isLoading()` signal for "Saving" state
- Show "Saved" when `!isLoading() && !error()`
- Show error when `error()` is not null
- Use Material icons: `sync` (saving), `check_circle` (saved), `error` (error)
- Consider toast notifications for errors (optional)
- Auto-hide "Saved" to avoid clutter

**Status Indicator Template** (structure only):

```html
<div class="save-status-indicator">
  @if (store.isLoading()) {
    <mat-icon>sync</mat-icon>
    <span>Saving...</span>
  } @else if (store.error()) {
    <mat-icon color="warn">error</mat-icon>
    <span>{{ store.error() }}</span>
  } @else {
    <mat-icon color="primary">check_circle</mat-icon>
    <span>Saved</span>
  }
</div>
```

**Testing Focus for Task 4:**

> Focus on **status display** - ensure indicator shows correct state.

**Behaviors to Test:**

- [ ] "Saving..." displays when isLoading is true
- [ ] "Saved" displays when save completes successfully
- [ ] Error message displays when save fails
- [ ] Icons change based on state
- [ ] "Saved" auto-hides after timeout (if implemented)
- [ ] Indicator binds to store signals correctly

</details>

<details open>
<summary><h3>Task 5: Style Save Status Indicator</h3></summary>

**Purpose**: Apply SCSS styling to make the save status indicator visually clear and aesthetically pleasing.

**Related Documentation:**

- [Style Guide](../../STYLE_GUIDE.md) - Typography and color system
- [Coding Standards - SCSS](../../CODING_STANDARDS.md#scss-conventions) - SCSS patterns

**Implementation Subtasks:**

- [ ] **Position indicator**: Fixed position or in header area
- [ ] **Size and spacing**: Appropriate sizing for visibility
- [ ] **Color coding**: Green for saved, red for error, neutral for saving
- [ ] **Icon styling**: Consistent icon sizes and alignment
- [ ] **Animation**: Subtle fade-in/out or pulse for "Saving"
- [ ] **Responsive design**: Works on mobile viewports

**Testing Subtask:**

- [ ] **Manual Visual Testing**: Verify indicator appearance and positioning

**Key Implementation Notes:**

- Consider fixed position in corner for always-visible status
- Or place in settings header for contextual placement
- Use theme colors for consistency
- Subtle animations enhance UX (avoid distracting)
- Ensure readable text and icon contrast
- Test at different viewport sizes

**Indicator Styles** (pattern only):

```scss
.save-status-indicator {
  position: fixed;
  top: var(--spacing-md);
  right: var(--spacing-md);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--surface-color);
  border-radius: var(--border-radius);
  box-shadow: var(--elevation-2);
  
  mat-icon {
    font-size: 20px;
    width: 20px;
    height: 20px;
    
    &[color="primary"] {
      color: var(--success-color);
    }
    
    &[color="warn"] {
      color: var(--error-color);
    }
  }
  
  span {
    font-size: 0.875rem;
    font-weight: 500;
  }
}
```

**Testing Focus for Task 5:**

> Focus on **visual presentation** - ensure indicator is clear and attractive.

**Visual Testing Checklist:**

- [ ] Indicator positioned appropriately
- [ ] Colors match theme and convey meaning
- [ ] Icons sized consistently
- [ ] Text is readable
- [ ] Animations are subtle and smooth
- [ ] Works on mobile devices
- [ ] Doesn't obscure important content

</details>

<details open>
<summary><h3>Task 6: Handle Save Errors Gracefully</h3></summary>

**Purpose**: Implement robust error handling that preserves user changes and provides clear recovery options when saves fail.

**Related Documentation:**

- [Coding Standards - Error Handling](../../CODING_STANDARDS.md#error-handling) - Error patterns
- [Service Standards - Error Handling](../../SERVICE_STANDARDS.md#error-handling) - Service error patterns

**Implementation Subtasks:**

- [ ] **Preserve form state**: Never clear form on save error
- [ ] **Display error message**: Show user-friendly error in status indicator
- [ ] **Log error details**: Console log for debugging
- [ ] **Add retry option**: Allow manual retry (button or auto-retry)
- [ ] **Handle network errors**: Specific message for connectivity issues
- [ ] **Handle validation errors**: Specific message for backend validation failures

**Testing Subtask:**

- [ ] **Write Error Handling Tests**: Test error scenarios (see Testing section)

**Key Implementation Notes:**

- Form state is source of truth - never lose user data
- Distinguish between network errors and validation errors
- Consider auto-retry for network errors (with exponential backoff)
- Allow manual retry via button click
- Error messages should be user-friendly and actionable
- Consider toast notifications for errors (more visible)

**Error Handling Pattern** (structure only):

```typescript
// In save subscription error handler
error: (err) => {
  console.error('Settings save failed:', err);
  
  if (err.status === 0) {
    // Network error
    this.showError('Unable to connect. Check your network and try again.');
  } else if (err.status === 400) {
    // Validation error
    this.showError('Invalid settings. Please check your inputs.');
  } else {
    // General error
    this.showError('Failed to save settings. Please try again.');
  }
  
  // Form state preserved automatically
}
```

**Testing Focus for Task 6:**

> Focus on **error resilience** - ensure errors don't lose user data.

**Behaviors to Test:**

- [ ] Form state preserved when save fails
- [ ] Error message displays appropriately
- [ ] Network errors show connectivity message
- [ ] Validation errors show validation message
- [ ] Retry option allows manual save attempt
- [ ] Errors logged for debugging
- [ ] User can continue editing after error

</details>

<details open>
<summary><h3>Task 7: Add Auto-Save Integration Tests</h3></summary>

**Purpose**: Create comprehensive tests that verify the complete auto-save workflow from form change through backend persistence.

**Related Documentation:**

- [Testing Standards - Integration Testing](../../TESTING_STANDARDS.md#integration-testing) - Integration test patterns
- [Store Testing Guide](../../STORE_TESTING.md) - Store integration testing

**Implementation Subtasks:**

- [ ] **Test debounced save**: Verify rapid changes batch correctly
- [ ] **Test successful save**: Verify form→store→backend flow
- [ ] **Test save error**: Verify error handling preserves state
- [ ] **Test status indicator**: Verify indicator updates correctly
- [ ] **Test form validity**: Verify invalid forms don't save
- [ ] **Test subscription cleanup**: Verify no memory leaks

**Testing Subtask:**

- [ ] **Write Integration Tests**: Test complete auto-save flow (see Testing section)

**Key Implementation Notes:**

- Use fakeAsync and tick() for timing control
- Mock store or backend service for isolated testing
- Test happy path and error scenarios
- Verify no duplicate saves occur
- Test subscription cleanup on destroy
- Consider E2E tests for full workflow (Phase 9)

**Integration Test Pattern** (structure only):

```typescript
describe('Settings Auto-Save', () => {
  it('should debounce rapid changes into single save', fakeAsync(() => {
    const component = TestBed.createComponent(SettingsViewComponent).componentInstance;
    const store = TestBed.inject(SettingsStore);
    spyOn(store, 'saveSettings');
    
    // Make multiple rapid changes
    component.form.patchValue({ player: { repeatMode: 'Single' } });
    tick(200);
    component.form.patchValue({ player: { repeatMode: 'All' } });
    tick(200);
    component.form.patchValue({ player: { sidTimerSeconds: 240 } });
    
    // Should not save yet
    expect(store.saveSettings).not.toHaveBeenCalled();
    
    // After debounce time, should save once
    tick(500);
    expect(store.saveSettings).toHaveBeenCalledTimes(1);
  }));
});
```

**Testing Focus for Task 7:**

> Focus on **auto-save workflow** - ensure complete flow works correctly.

**Behaviors to Test:**

- [ ] Rapid form changes result in single debounced save
- [ ] Valid form changes trigger save
- [ ] Invalid form changes don't trigger save
- [ ] Save success updates status indicator
- [ ] Save errors preserve form state
- [ ] Status indicator shows correct states
- [ ] Subscription cleans up on destroy
- [ ] No memory leaks from subscriptions

</details>

---

## ✅ Success Criteria

> Mark these checkboxes as you validate each criterion.

- [ ] **Form Changes Detected**: valueChanges subscription captures modifications
- [ ] **Debouncing Works**: Rapid changes batch into single save after 500ms
- [ ] **Store Save Triggered**: Form changes call store save action
- [ ] **Status Indicator Works**: Shows Saving/Saved/Error states correctly
- [ ] **Styling Complete**: Indicator is visually clear and attractive
- [ ] **Error Handling Works**: Errors preserve form state and show messages
- [ ] **All Tests Pass**: Unit and integration tests pass
- [ ] **No Memory Leaks**: Subscriptions clean up properly
- [ ] **User Experience Smooth**: No perceived lag, clear feedback

---

## 🧪 Testing Summary

### Testing Approach

This phase focuses on **auto-save functionality and user feedback**:

1. **Subscription Tests**: Verify form valueChanges captured correctly
2. **Debounce Tests**: Verify batching behavior works
3. **Save Trigger Tests**: Verify store save called correctly
4. **Status Indicator Tests**: Verify indicator displays correct state
5. **Error Handling Tests**: Verify errors handled gracefully
6. **Integration Tests**: Verify complete auto-save workflow

### Test Types by Task

| Task | Test Type | Focus |
|------|-----------|-------|
| Task 1 | Unit | valueChanges subscription |
| Task 2 | Unit | Debouncing behavior |
| Task 3 | Unit | Save action invocation |
| Task 4 | Unit | Status indicator display |
| Task 5 | Manual | Visual appearance |
| Task 6 | Unit | Error handling |
| Task 7 | Integration | Complete auto-save flow |

### Testing Standards Reference

- Follow [Testing Standards](../../TESTING_STANDARDS.md) for behavioral testing
- Use [Smart Component Testing](../../SMART_COMPONENT_TESTING.md) for component patterns
- Use fakeAsync/tick for timing-dependent tests
- Mock store for component tests

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

- **Previous Phase**: [Phase 6 - Reactive Forms & Section Components](./SETTINGS_FEATURE_P6.md)
- **Next Phase**: [Phase 8 - Undo/Redo with Keyboard Shortcuts](./SETTINGS_FEATURE_P8.md)
- **Feature Overview**: [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md)
- **Save Action**: [Phase 3 - Save Settings Action](./SETTINGS_FEATURE_P3.md#task-5-implement-save-settings-action)
- **RxJS Documentation**: RxJS debounceTime and operators

---

_Phase Status: Ready for Implementation_
_Last Updated: 2025-01-11_
_Estimated Effort: 3-4 hours_
