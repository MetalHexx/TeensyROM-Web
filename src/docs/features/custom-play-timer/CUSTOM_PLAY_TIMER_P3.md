# Phase 3: UI Components & Toolbar Integration

## 🎯 Objective

Create UI components and integrate them into the player toolbar, providing users with intuitive controls for enabling custom timers and selecting durations. This phase delivers the visible, interactive part of the feature with a timer toggle button (using Material `timer` icon) and an inline duration dropdown that appears to the right of the button when enabled.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Custom Play Timer Feature Plan](./CUSTOM_PLAY_TIMER_PLAN.md) - High-level feature plan with user scenarios
- [ ] [Phase 1 Implementation](./CUSTOM_PLAY_TIMER_P1.md) - State management prerequisites
- [ ] [Phase 2 Implementation](./CUSTOM_PLAY_TIMER_P2.md) - Service layer prerequisites
- [ ] [Phase 3 Open Questions](./CUSTOM_PLAY_TIMER_PLAN.md#open-questions-for-phase-3) - Review decision resolutions

**Standards & Guidelines:**

- [ ] [Coding Standards](../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [Component Library](../../COMPONENT_LIBRARY.md) - Reusable UI component catalog
- [ ] [Style Guide](../../STYLE_GUIDE.md) - Global styles, utility classes, and theming

---

## 📂 File Structure Overview

```
libs/features/player/src/lib/player-device-container/player-toolbar/
├── player-toolbar-actions/
│   ├── player-toolbar-actions.component.ts       📝 Modified - Add timer button and dropdown
│   ├── player-toolbar-actions.component.html     📝 Modified - Integrate timer controls
│   ├── player-toolbar-actions.component.scss     📝 Modified - Style timer controls
│   └── player-toolbar-actions.component.spec.ts  📝 Modified - Add timer control tests
```

---

<details open>
<summary><h3>Task 1: Add Duration Options Constant</h3></summary>

**Purpose**: Define the predefined duration options (5s, 10s, 15s, 30s, 1m, 3m, 5m, 10m, 30m, 1h) as a constant for use in the dropdown component.

**Related Documentation:**

- [Coding Standards - Constants](../../CODING_STANDARDS.md)
- [Custom Play Timer Plan - Duration Options](./CUSTOM_PLAY_TIMER_PLAN.md#high-level-tasks)

**Implementation Subtasks:**

- [ ] **Create DURATION_OPTIONS constant** in `player-toolbar-actions.component.ts` with array of duration objects
- [ ] **Each duration object** has `label: string` (display text like "5s", "1m") and `valueMs: number` (milliseconds value)
- [ ] **Define all options**: 5s (5000ms), 10s (10000ms), 15s (15000ms), 30s (30000ms), 1m (60000ms), 3m (180000ms), 5m (300000ms), 10m (600000ms), 30m (1800000ms), 1h (3600000ms)
- [ ] **Mark constant as readonly**: Use `as const` or `readonly` modifier for immutability

**Testing Subtask:**

- [ ] **Write Tests**: Verify duration options are defined correctly (see Testing section below)

**Key Implementation Notes:**

- Duration values in milliseconds for consistency with state model (durationMs)
- Label format: seconds use "s" suffix, minutes use "m" suffix, hours use "h" suffix
- Array order: ascending by duration (shortest to longest)
- Type definition: `{ label: string; valueMs: number }[]`

**Critical Constant Structure**:

```typescript
const DURATION_OPTIONS = [
  { label: '5s', valueMs: 5000 },
  { label: '10s', valueMs: 10000 },
  { label: '15s', valueMs: 15000 },
  { label: '30s', valueMs: 30000 },
  { label: '1m', valueMs: 60000 },
  { label: '3m', valueMs: 180000 },
  { label: '5m', valueMs: 300000 },
  { label: '10m', valueMs: 600000 },
  { label: '30m', valueMs: 1800000 },
  { label: '1h', valueMs: 3600000 },
] as const;
```

**Testing Focus for Task 1:**

> Focus on **behavioral testing** - what observable outcomes occur?

**Behaviors to Test:**

- [ ] **Duration options contain all required values**: DURATION_OPTIONS array has 10 entries
- [ ] **Duration options are in ascending order**: Each valueMs is greater than the previous
- [ ] **Labels match expected format**: Seconds use "s", minutes use "m", hour uses "h"

**Testing Reference:**

- See [Testing Standards](../../TESTING_STANDARDS.md) for constant testing patterns

</details>

---

<details open>
<summary><h3>Task 2: Add Component State Properties</h3></summary>

**Purpose**: Add component properties to track custom timer enabled state, selected duration, and expose service methods for UI interaction.

**Related Documentation:**

- [Coding Standards - Component Properties](../../CODING_STANDARDS.md)
- [Angular 19 - Signal Inputs](https://angular.dev/guide/signals)

**Implementation Subtasks:**

- [ ] **Add deviceId input** using `input.required<string>()` (passed from parent component)
- [ ] **Inject PlayerContextService** using `inject(PlayerContextService)` (if not already injected)
- [ ] **Create customTimerConfig computed signal** using `computed(() => this.playerContext.getCustomTimerConfig(this.deviceId())())` to read timer config
- [ ] **Create isCustomTimerEnabled computed signal** derived from customTimerConfig (returns `config?.enabled ?? false`)
- [ ] **Create selectedDurationMs computed signal** derived from customTimerConfig (returns `config?.durationMs ?? 180000`)

**Testing Subtask:**

- [ ] **Write Tests**: Verify component properties react to state changes (see Testing section below)

**Key Implementation Notes:**

- deviceId input is required - parent component must provide it
- Computed signals automatically update when service signals change (reactive)
- Default to false/180000 when config is null (defensive programming)
- No need to manage subscriptions - computed signals handle cleanup automatically

**Testing Focus for Task 2:**

**Behaviors to Test:**

- [ ] **isCustomTimerEnabled reflects initial state**: Component initialization shows enabled=false
- [ ] **isCustomTimerEnabled updates reactively**: After enabling timer via service, computed signal updates to true
- [ ] **selectedDurationMs reflects current duration**: After changing duration via service, computed signal updates to new value
- [ ] **Computed signals default correctly**: When config is null, isCustomTimerEnabled is false and selectedDurationMs is 180000

**Testing Reference:**

- See [Testing Standards](../../TESTING_STANDARDS.md) for component property testing

</details>

---

<details open>
<summary><h3>Task 3: Implement Timer Toggle Button</h3></summary>

**Purpose**: Create the timer icon button that toggles custom timer enabled state, using Material `timer` icon with highlight-on-enable behavior matching the shuffle button pattern.

**Related Documentation:**

- [Component Library - Icon Button](../../COMPONENT_LIBRARY.md#lib-icon-button)
- [Style Guide - Button Styling](../../STYLE_GUIDE.md)

**Implementation Subtasks:**

- [ ] **Add onTimerToggle method** in component TypeScript that calls `playerContext.setCustomTimer(deviceId, !enabled, currentDuration)`
- [ ] **Read current enabled state** from `isCustomTimerEnabled()` signal
- [ ] **Read current duration** from `selectedDurationMs()` signal to preserve it when toggling
- [ ] **Add timer button to template** in player-toolbar-actions.component.html before shuffle button
- [ ] **Use lib-icon-button component** with `icon="timer"` (Material timer icon)
- [ ] **Bind click event** to `onTimerToggle()` method
- [ ] **Apply active class conditionally** using `[class.active]="isCustomTimerEnabled()"`
- [ ] **Add tooltip** with `matTooltip="Toggle Custom Play Timer"` for accessibility

**Testing Subtask:**

- [ ] **Write Tests**: Verify button toggles timer state correctly (see Testing section below)

**Key Implementation Notes:**

- Timer icon (stopwatch) clearly communicates countdown/auto-progression concept
- Active class highlights button when enabled (matches shuffle button styling)
- Preserve current duration when toggling - don't reset to default
- Button positioned to the left of shuffle button per design spec

**Testing Focus for Task 3:**

**Behaviors to Test:**

- [ ] **Button enables timer on first click**: Clicking button when disabled sets enabled to true
- [ ] **Button disables timer on second click**: Clicking button when enabled sets enabled to false
- [ ] **Button preserves duration when toggling**: Enabling, changing duration, disabling, then re-enabling preserves last duration
- [ ] **Button shows active state when enabled**: Active class is present when isCustomTimerEnabled is true
- [ ] **Button removes active state when disabled**: Active class is absent when isCustomTimerEnabled is false

**Testing Reference:**

- See [Testing Standards](../../TESTING_STANDARDS.md) for component interaction testing

</details>

---

<details open>
<summary><h3>Task 4: Implement Duration Dropdown</h3></summary>

**Purpose**: Create the inline duration dropdown that appears to the right of the timer button when enabled, allowing users to select predefined duration values.

**Related Documentation:**

- [Component Library - Form Controls](../../COMPONENT_LIBRARY.md)
- [Angular Material - Select](https://material.angular.io/components/select)

**Implementation Subtasks:**

- [ ] **Add onDurationChange method** in component TypeScript that calls `playerContext.setCustomTimer(deviceId, true, newDurationMs)`
- [ ] **Keep timer enabled when changing duration**: Always pass `enabled: true` to setCustomTimer
- [ ] **Add mat-form-field to template** immediately after timer button in horizontal layout
- [ ] **Add mat-select inside form field** bound to `selectedDurationMs()` signal
- [ ] **Add mat-option for each duration** using `*ngFor="let option of DURATION_OPTIONS"`
- [ ] **Bind option value** to `option.valueMs`
- [ ] **Display option label** as `option.label`
- [ ] **Bind selectionChange event** to `onDurationChange($event.value)`
- [ ] **Apply conditional visibility** using `@if (isCustomTimerEnabled())` control flow
- [ ] **Style as inline control**: Apply CSS to display inline with minimal height/padding

**Testing Subtask:**

- [ ] **Write Tests**: Verify dropdown selection updates duration (see Testing section below)

**Key Implementation Notes:**

- Dropdown only visible when custom timer is enabled (conditional rendering)
- Position inline to the right of timer button (horizontal flexbox layout)
- Selecting new duration keeps timer enabled and updates only durationMs
- Default selection is 3m (180000ms) when first enabling timer
- Use Angular Material Select for consistent styling and accessibility

**Testing Focus for Task 4:**

**Behaviors to Test:**

- [ ] **Dropdown hidden when timer disabled**: isCustomTimerEnabled is false, dropdown not rendered
- [ ] **Dropdown visible when timer enabled**: isCustomTimerEnabled is true, dropdown rendered
- [ ] **Dropdown shows current duration**: selectedDurationMs matches selected mat-option value
- [ ] **Selecting duration updates state**: Selecting 30s option updates duration to 30000ms
- [ ] **Dropdown maintains enabled state**: Changing duration keeps isCustomTimerEnabled as true
- [ ] **Dropdown shows default on first enable**: Enabling timer shows 3m (180000ms) selected

**Testing Reference:**

- See [Testing Standards](../../TESTING_STANDARDS.md) for dropdown testing patterns

</details>

---

<details open>
<summary><h3>Task 5: Apply Styling and Layout</h3></summary>

**Purpose**: Style the timer controls to match existing toolbar conventions, ensuring proper inline layout, responsive behavior, and visual consistency with shuffle/favorite buttons.

**Related Documentation:**

- [Style Guide - Toolbar Styles](../../STYLE_GUIDE.md)
- [Component Library - Layout Patterns](../../COMPONENT_LIBRARY.md)

**Implementation Subtasks:**

- [ ] **Add timer-controls-container class** wrapping timer button and dropdown in template
- [ ] **Apply flexbox horizontal layout**: Display flex, flex-direction row, align-items center
- [ ] **Add gap between button and dropdown**: Use gap or margin-right on button
- [ ] **Style dropdown for inline display**: Reduce mat-form-field height, remove underline, compact padding
- [ ] **Match button styling to shuffle button**: Use same icon size, padding, and active state colors
- [ ] **Apply responsive behavior**: Hide dropdown label on small screens if needed (keep dropdown compact)
- [ ] **Ensure proper spacing**: Maintain consistent spacing between timer controls and neighboring buttons

**Testing Subtask:**

- [ ] **Write Tests**: Visual regression testing (manual/screenshot comparison)

**Key Implementation Notes:**

- Timer button and dropdown form a cohesive control group (visually grouped)
- Active state uses same highlight color as shuffle button (theme primary color)
- Dropdown should be compact - minimal height, no floating label overhead
- Responsive: toolbar should not break on mobile (may need to reduce font sizes or hide labels)
- Use CSS variables from style guide for colors, spacing, and transitions

**Testing Focus for Task 5:**

**Behaviors to Test:**

- [ ] **Controls layout horizontally**: Button and dropdown appear side-by-side
- [ ] **Controls maintain toolbar height**: No vertical overflow or misalignment
- [ ] **Active state matches shuffle button**: Visual consistency with existing controls
- [ ] **Dropdown remains compact**: Minimal vertical space usage
- [ ] **Spacing is consistent**: Gap between timer controls and shuffle button matches other button gaps

**Testing Reference:**

- See [Style Guide](../../STYLE_GUIDE.md) for visual testing guidance

</details>

---

<details open>
<summary><h3>Task 6: Handle Edge Cases and State Initialization</h3></summary>

**Purpose**: Ensure timer controls handle edge cases gracefully, including initialization, cleanup, and invalid states.

**Related Documentation:**

- [Coding Standards - Error Handling](../../CODING_STANDARDS.md)
- [Testing Standards - Edge Case Testing](../../TESTING_STANDARDS.md)

**Implementation Subtasks:**

- [ ] **Verify deviceId input is provided**: Component requires deviceId from parent
- [ ] **Handle null customTimerConfig**: Computed signals default to safe values when config is null
- [ ] **Prevent invalid duration selection**: Dropdown options are predefined, no user input validation needed
- [ ] **Handle cleanup on component destroy**: Angular signals handle cleanup automatically, no manual subscriptions
- [ ] **Test with multiple devices**: Ensure each device has independent timer controls

**Testing Subtask:**

- [ ] **Write Tests**: Edge case testing for component behavior (see Testing section below)

**Key Implementation Notes:**

- No explicit cleanup needed - computed signals are managed by Angular
- Parent component (player-device-container) provides deviceId via input binding
- Each device player instance has its own timer controls (state is per-device)
- Invalid states are prevented by architecture: dropdown only shows predefined values, toggle only accepts boolean

**Testing Focus for Task 6:**

**Behaviors to Test:**

- [ ] **Component handles null config gracefully**: When player not initialized, controls show disabled state
- [ ] **Component handles multiple devices**: Two devices can have different timer configs simultaneously
- [ ] **Component cleanup doesn't error**: Destroying component doesn't cause console errors
- [ ] **Dropdown prevents invalid selections**: Only predefined duration options are selectable

**Testing Reference:**

- See [Testing Standards](../../TESTING_STANDARDS.md) for edge case testing patterns

</details>

---

## 🗂️ Files Modified or Created

**New Files:**

- None (Phase 3 only modifies existing toolbar component)

**Modified Files:**

- `libs/features/player/src/lib/player-device-container/player-toolbar/player-toolbar-actions/player-toolbar-actions.component.ts`
- `libs/features/player/src/lib/player-device-container/player-toolbar/player-toolbar-actions/player-toolbar-actions.component.html`
- `libs/features/player/src/lib/player-device-container/player-toolbar/player-toolbar-actions/player-toolbar-actions.component.scss`
- `libs/features/player/src/lib/player-device-container/player-toolbar/player-toolbar-actions/player-toolbar-actions.component.spec.ts`

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

> **IMPORTANT:** Tests are written **within each task above**, not here. This section is only a summary for quick reference.

### Where Tests Are Written

**Tests are embedded in each task above** with:

- **Testing Subtask**: Checkbox in the task's subtask list
- **Testing Focus**: "Behaviors to Test" section listing observable outcomes
- **Testing Reference**: Links to relevant testing documentation

**Complete each task's testing subtask before moving to the next task.**

### Test Execution Commands

**Running Tests:**

```bash
# Run player feature tests
npx nx test player

# Run tests in watch mode during development
npx nx test player --watch

# Run all tests
npx nx run-many --target=test --all
```

### Testing Approach

**Unit Testing**: Component behavior is tested in isolation with mocked PlayerContextService.

**Test Organization**:

- Task 1: Duration options constant validation (in player-toolbar-actions.component.spec.ts)
- Task 2: Component property reactivity tests (in player-toolbar-actions.component.spec.ts)
- Task 3: Timer button toggle behavior tests (in player-toolbar-actions.component.spec.ts)
- Task 4: Duration dropdown selection tests (in player-toolbar-actions.component.spec.ts)
- Task 5: Visual styling validation (manual/screenshot testing)
- Task 6: Edge case and cleanup tests (in player-toolbar-actions.component.spec.ts)

**Key Test Patterns**:

```typescript
// Example component test for Task 3
it('should enable custom timer when button clicked', () => {
  const compiled = fixture.nativeElement as HTMLElement;
  const timerButton = compiled.querySelector('.timer-button') as HTMLButtonElement;

  // Mock service method
  const setCustomTimerSpy = vi.spyOn(mockPlayerContext, 'setCustomTimer');

  // Act - click button
  timerButton.click();
  fixture.detectChanges();

  // Assert - verify service called
  expect(setCustomTimerSpy).toHaveBeenCalledWith('device-1', true, 180000);
});

// Example dropdown test for Task 4
it('should update duration when dropdown option selected', () => {
  const compiled = fixture.nativeElement as HTMLElement;
  
  // Enable timer first
  component.onTimerToggle();
  fixture.detectChanges();

  const dropdown = compiled.querySelector('mat-select') as HTMLSelectElement;
  const setCustomTimerSpy = vi.spyOn(mockPlayerContext, 'setCustomTimer');

  // Act - select 30s option
  // (Material Select testing requires specific test harness patterns)
  component.onDurationChange(30000);
  fixture.detectChanges();

  // Assert - verify service called with new duration
  expect(setCustomTimerSpy).toHaveBeenCalledWith('device-1', true, 30000);
});
```

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

> **Mark checkboxes as criteria are met**. All items must be checked before phase is complete.

**Functional Requirements:**

- [ ] All implementation tasks completed and checked off
- [ ] All subtasks within each task completed
- [ ] Code follows [Coding Standards](../../CODING_STANDARDS.md)
- [ ] UI components follow [Component Library](../../COMPONENT_LIBRARY.md) patterns
- [ ] Styling follows [Style Guide](../../STYLE_GUIDE.md) conventions

**Testing Requirements:**

- [ ] All testing subtasks completed within each task
- [ ] All behavioral test checkboxes verified
- [ ] Tests written alongside implementation (not deferred)
- [ ] All tests passing with no failures
- [ ] Test coverage includes toggle, dropdown selection, and edge cases

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes with no errors (`npm run lint`)
- [ ] Code formatting is consistent
- [ ] No console errors in browser when using timer controls

**UI/UX Requirements:**

- [ ] Timer button uses Material `timer` icon
- [ ] Timer button highlights when enabled (matches shuffle button style)
- [ ] Duration dropdown appears inline to the right when enabled
- [ ] Dropdown shows all 10 predefined duration options (5s to 1h)
- [ ] Default selection is 3m (180000ms) when first enabled
- [ ] Controls maintain consistent spacing with neighboring buttons
- [ ] UI is responsive and doesn't break on mobile screens

**Documentation:**

- [ ] JSDoc comments added for public methods (onTimerToggle, onDurationChange)
- [ ] DURATION_OPTIONS constant documented with explanation

**Ready for Testing:**

- [ ] All success criteria met
- [ ] No known bugs or issues
- [ ] Timer controls are functional and visually consistent
- [ ] Ready for E2E testing in Phase 4 (to be scheduled later)

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Design Decisions

- **Decision: Timer icon selected (Option B)**: Material `timer` icon (stopwatch) clearly represents countdown/auto-progression concept. More appropriate than `schedule` (calendar) or `access_time` (generic clock).

- **Decision: Inline dropdown to the right (Option A)**: Matches startup filter pattern in settings. Keeps controls grouped and visible, reducing clicks. Horizontal layout fits toolbar space well.

- **Decision: Default duration 3 minutes (Option A)**: Consistent with existing music timer default and initial state. Simple, predictable behavior for first-time users.

- **Decision: Use Angular Material Select**: Provides consistent styling, accessibility (ARIA), and keyboard navigation out-of-the-box. Reduces custom implementation complexity.

### Implementation Constraints

- **Constraint: Parent component provides deviceId**: player-toolbar-actions component requires deviceId input from player-device-container parent. Cannot function independently.

- **Constraint: No validation logic needed**: UI enforces valid inputs through predefined dropdown options and boolean toggle. Service/store layers trust UI inputs.

- **Constraint: Responsive design considerations**: Toolbar must remain functional on mobile. May need to adjust font sizes, hide labels, or reduce padding on small screens.

### Open Questions Resolved

**Phase 3 - Question 1: Dropdown Interaction Pattern**
- **Resolution**: Option A selected - Inline dropdown to the right
- **Rationale**: Consistent with existing patterns, keeps controls grouped, toolbar has space

**Phase 3 - Question 2: Timer Button Visual State**
- **Resolution**: Option A selected - Timer icon with highlight on enable
- **Rationale**: Matches shuffle button pattern, duration visible in dropdown (no redundancy)

**Phase 3 - Question 3: Dropdown Default Selection**
- **Resolution**: Option A selected - 3 minutes default
- **User provided**: Selected Option A over Option B (last used duration)
- **Rationale**: Simple, predictable, matches existing music timer default

### Future Enhancements

- **Custom duration text input**: Allow users to type arbitrary durations (e.g., "45s", "2m30s")
- **Duration presets**: Save/load favorite duration configurations
- **Timer button badge**: Show selected duration on button when enabled (optional visual enhancement)
- **Keyboard shortcuts**: Add hotkeys for enabling timer and cycling through durations

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

- **Discovery 1**: [Something learned during implementation that affects approach]
- **Discovery 2**: [Unexpected complexity or simplification found]

</details>

---

## 💡 Phase 3 Quick Reference

**What This Phase Delivers:**

- Timer toggle button with Material `timer` icon
- Inline duration dropdown with 10 predefined options (5s to 1h)
- Integration into player toolbar actions component
- Conditional dropdown visibility (only when enabled)
- Styling consistent with existing toolbar conventions
- Complete unit test coverage for component behavior

**Integration Points:**

- PlayerToolbarActionsComponent hosts timer controls
- PlayerContextService provides state and mutation methods
- Computed signals enable reactive UI updates
- Toolbar layout maintains consistent spacing and alignment

**Key UI Patterns:**

- Icon button with active state highlight (matches shuffle button)
- Inline dropdown for duration selection (horizontal layout)
- Conditional rendering with `@if` control flow
- Angular Material Select for dropdown (accessibility, keyboard nav)

**Key Testing Focus:**

- Button toggles timer enabled state correctly
- Dropdown selection updates duration via service
- Controls show/hide based on enabled state
- Visual consistency with existing toolbar buttons
- Edge cases: null config, multiple devices, cleanup

**Phase 4 Preview:**

Phase 4 (E2E Testing & Integration Validation) will be scheduled later. It will include Cypress tests for complete user workflows, timer expiration, auto-progression, and integration with shuffle mode.

**Implementation Tips:**

- Start with Task 1 (duration options constant) - foundation for dropdown
- Task 2 (component properties) - enables reactive UI
- Task 3 (toggle button) - first user interaction point
- Task 4 (dropdown) - duration selection UI
- Task 5 (styling) - visual polish and consistency
- Task 6 (edge cases) - robustness and cleanup
