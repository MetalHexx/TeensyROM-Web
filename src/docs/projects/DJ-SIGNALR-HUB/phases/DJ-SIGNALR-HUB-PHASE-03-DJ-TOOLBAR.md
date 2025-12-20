# Phase 3: UI Integration (DJ Toolbar)

## 🎯 Objective

Create a DJ toolbar component with 3 voice control checkboxes positioned above the existing player-toolbar. The toolbar will integrate with the DjService (Phase 2) to mute/unmute SID voices and automatically reset voice states when a new file loads, providing an intuitive interface for DJs to control individual SID chip voices during playback.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [DJ SignalR Hub Master Plan](../DJ-SIGNALR-HUB-MASTER-PLAN.md) - Complete feature overview
- [ ] [Phase 1: Core Hub](./DJ-SIGNALR-HUB-PHASE-01-CORE-HUB.md) - Backend SignalR hub context
- [ ] [Phase 2: DjService](./DJ-SIGNALR-HUB-PHASE-02-DJ-SERVICE.md) - Infrastructure service this UI calls

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - Component patterns, naming conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Behavioral testing approach
- [ ] [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component testing patterns
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - Utility classes, card styling, checkboxes
- [ ] [Component Library](../../../COMPONENT_LIBRARY.md) - Reusable UI components

---

## 📂 File Structure Overview

```
libs/features/player/src/lib/player-view/player-device-container/
├── player-device-container.component.html   📝 Modified - Add DJ toolbar above player-toolbar
├── player-device-container.component.ts     📝 Modified - Import DJ toolbar component
├── dj-toolbar/
│   ├── dj-toolbar.component.ts              ✨ New - DJ toolbar with voice checkboxes
│   ├── dj-toolbar.component.html            ✨ New - Checkbox layout template
│   ├── dj-toolbar.component.scss            ✨ New - Toolbar styling
│   └── dj-toolbar.component.spec.ts         ✨ New - Component tests
```

---

## 📋 Implementation Guidelines

> **IMPORTANT - Code Reference Policy:**
>
> - Focus on **WHAT** to implement, not **HOW** to implement it
> - Use **class names**, **method names**, **property names**
> - Small code snippets (2-5 lines) are OK for critical structures only
> - **NO large code blocks** - link to standards docs or existing implementations instead
> - Prefer describing behavior over showing implementation

> **IMPORTANT - Testing Policy:**
>
> - **Favor behavioral testing** - test observable behaviors, not implementation details
> - Include tests **within each task** as work progresses, not at the end
> - See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) for component testing patterns
> - Test through public APIs (inputs, outputs, template interactions)

> **IMPORTANT - Progress Tracking:**
>
> - **Mark checkboxes ✅ as you complete each subtask**
> - Update progress throughout implementation, not just at the end

---

<details open>
<summary><h3>Task 1: Create DJ Toolbar Component</h3></summary>

**Purpose**: Create the DJ toolbar component with 3 voice checkboxes (Voice 1, 2, 3) that toggle voice mute states and automatically reset when files change.

**Related Documentation:**

- [Component Library](../../../COMPONENT_LIBRARY.md#lib-scaling-compact-card) - ScalingCompactCard wrapper usage
- [player-toolbar.component.ts](../../../../../../libs/features/player/src/lib/player-view/player-device-container/player-toolbar/player-toolbar.component.ts) - Similar toolbar pattern to follow
- [Style Guide - Checkboxes](../../../STYLE_GUIDE.md#form-controls) - Checkbox styling patterns

**Implementation Subtasks:**

- [ ] **Create component file**: Generate `dj-toolbar.component.ts` as standalone Angular component
- [ ] **Add required inputs**: Create `deviceId` input (required signal input)
- [ ] **Inject dependencies**: Inject `DJ_SERVICE` domain contract, `PLAYER_CONTEXT` service
- [ ] **Create voice state signals**: Define 3 writable signals for voice checkbox states (voice1Enabled, voice2Enabled, voice3Enabled)
- [ ] **Add checkbox change handlers**: Implement 3 methods (`toggleVoice1()`, `toggleVoice2()`, `toggleVoice3()`) that call `djService.muteVoices()`
- [ ] **Add file change detection**: Create effect that watches `playerContext.getCurrentFile()` signal and resets checkbox states without calling DJ service
- [ ] **Add loading state**: Track DJ service call in-progress state to disable checkboxes during API calls
- [ ] **Write template**: Create HTML with ScalingCompactCard wrapper, 3 labeled checkboxes bound to voice signals
- [ ] **Add styling**: Create SCSS with glassy card styling, checkbox layout (horizontal row), spacing, hover states
- [ ] **Export component**: Add to parent component imports

**Testing Subtask:**

- [ ] **Write Tests**: Test component behaviors (see Testing section below)

**Key Implementation Notes:**

**Checkbox State Management:**
- Initial state: All 3 voices enabled (checked) when component mounts
- User unchecks box → call `djService.muteVoices()` with voice disabled → update local signal
- User checks box → call `djService.muteVoices()` with voice enabled → update local signal
- File changes → reset all 3 signals to enabled (checked) **without** calling DJ service

**File Change Detection Pattern:**
```typescript
// Effect watches current file signal and resets voice states
effect(() => {
  const deviceId = this.deviceId(); // Track dependency
  const currentFile = this.playerContext.getCurrentFile(deviceId)();
  
  // When file changes, reset all voices to enabled
  // Use untracked() to avoid calling DJ service during reset
  if (currentFile) {
    untracked(() => {
      this.voice1Enabled.set(true);
      this.voice2Enabled.set(true);
      this.voice3Enabled.set(true);
    });
  }
});
```

**Checkbox Toggle Pattern:**
```typescript
async toggleVoice1(): Promise<void> {
  const newState = !this.voice1Enabled(); // Toggle local state
  this.isLoading.set(true);
  
  try {
    await firstValueFrom(this.djService.muteVoices(
      this.deviceId(),
      newState ? VoiceState.Enabled : VoiceState.Disabled,
      this.voice2Enabled() ? VoiceState.Enabled : VoiceState.Disabled,
      this.voice3Enabled() ? VoiceState.Enabled : VoiceState.Disabled
    ));
    this.voice1Enabled.set(newState); // Update only on success
  } catch (error) {
    // Error already shown by DjService via ALERT_SERVICE
  } finally {
    this.isLoading.set(false);
  }
}
```

**Template Structure:**
- Wrap in `<lib-sliding-container>` with `from-top` animation (same as player-toolbar)
- Inner `<lib-scaling-compact-card>` with `glassy-card` class
- 3 checkboxes in horizontal layout with labels ("Voice 1", "Voice 2", "Voice 3")
- Disable all checkboxes when `isLoading()` is true
- Use semantic `<label>` elements wrapping `<input type="checkbox">`

**Testing Focus for Task 1:**

> Focus on **behavioral testing** - what observable outcomes occur?

**Behaviors to Test:**

- [ ] **Component renders correctly**: Template displays 3 checkboxes with labels, all initially checked
- [ ] **Checkbox toggles update local state**: Clicking checkbox changes signal value
- [ ] **Checkbox toggles call DJ service**: Toggling checkbox invokes `djService.muteVoices()` with correct voice states
- [ ] **Service calls disable checkboxes**: Checkboxes disabled while service call in progress
- [ ] **File change resets checkboxes**: When current file changes, all checkboxes reset to checked (enabled)
- [ ] **File change does not call service**: Reset on file change does not invoke `djService.muteVoices()`
- [ ] **Error handling**: Service errors do not crash component (handled by alert service)

**Testing Reference:**

- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) for component testing patterns
- Mock DJ_SERVICE and PLAYER_CONTEXT providers
- Use Testing Library's `userEvent` for checkbox interactions
- Use signal mocks for `getCurrentFile()` to simulate file changes

</details>

---

<details open>
<summary><h3>Task 2: Integrate DJ Toolbar into Player Container</h3></summary>

**Purpose**: Add the DJ toolbar component to the player-device-container above the existing player-toolbar, ensuring proper animation and layout.

**Related Documentation:**

- [player-device-container.component.html](../../../../../../libs/features/player/src/lib/player-view/player-device-container/player-device-container.component.html) - Parent container structure
- [player-device-container.component.ts](../../../../../../libs/features/player/src/lib/player-view/player-device-container/player-device-container.component.ts) - Parent component TypeScript

**Implementation Subtasks:**

- [ ] **Import component**: Add `DjToolbarComponent` to `player-device-container.component.ts` imports array
- [ ] **Add to template**: Insert `<lib-dj-toolbar>` in template above `<lib-player-toolbar>`
- [ ] **Pass deviceId input**: Bind `[deviceId]="deviceId()"` to DJ toolbar
- [ ] **Add conditional rendering**: Wrap DJ toolbar in `@if (isPlayerLoaded())` directive (same as player-toolbar)
- [ ] **Add CSS container**: Wrap toolbar in div with class `dj-toolbar-container` for spacing/layout control
- [ ] **Update SCSS**: Add styles for `dj-toolbar-container` to control margin/padding between toolbars

**Testing Subtask:**

- [ ] **Write Tests**: Test integration behaviors (see Testing section below)

**Key Implementation Notes:**

**Template Placement:**
```html
@if (isPlayerLoaded()) {
  <!-- DJ Toolbar (above player toolbar) -->
  <div class="dj-toolbar-container">
    <lib-dj-toolbar [deviceId]="deviceId()"></lib-dj-toolbar>
  </div>
  
  <!-- Existing Player Toolbar -->
  <div class="player-toolbar">
    <lib-player-toolbar [deviceId]="deviceId()"></lib-player-toolbar>
  </div>
}
```

**SCSS Spacing:**
- Add margin between DJ toolbar and player toolbar (e.g., `margin-bottom: 8px`)
- Ensure consistent width with player-toolbar
- Maintain glassy card visual hierarchy

**Conditional Rendering:**
- DJ toolbar only visible when `isPlayerLoaded()` is true (file loaded in player)
- Hides when no file loaded or device disconnected
- Matches player-toolbar visibility behavior

**Testing Focus for Task 2:**

**Behaviors to Test:**

- [ ] **DJ toolbar renders above player toolbar**: Component appears in correct position in DOM
- [ ] **DJ toolbar receives deviceId**: Component receives correct deviceId input
- [ ] **DJ toolbar shows when player loaded**: Toolbar visible when `isPlayerLoaded()` returns true
- [ ] **DJ toolbar hides when no file**: Toolbar hidden when `isPlayerLoaded()` returns false
- [ ] **Layout spacing correct**: Visual spacing between DJ toolbar and player toolbar matches design

**Testing Reference:**

- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) for container testing
- Mock `isPlayerLoaded` signal to test conditional rendering
- Use Testing Library queries to verify DOM structure

</details>

---

<details open>
<summary><h3>Task 3: Add E2E Tests for DJ Toolbar</h3></summary>

**Purpose**: Create end-to-end Cypress tests verifying DJ toolbar functionality in realistic user scenarios with backend integration.

**Related Documentation:**

- [E2E Tests Guide](../../../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - Cypress test patterns
- Existing player E2E tests for patterns to follow

**Implementation Subtasks:**

- [ ] **Create test file**: Add `dj-toolbar.cy.ts` in `apps/teensyrom-ui-e2e/src/e2e/`
- [ ] **Add test data setup**: Mock device connection, file launch for test context
- [ ] **Test checkbox interactions**: Verify checkbox clicks trigger backend calls
- [ ] **Test file launch reset**: Verify launching new file resets checkboxes
- [ ] **Test error handling**: Verify service errors display alerts without crashing UI
- [ ] **Test loading states**: Verify checkboxes disabled during API calls
- [ ] **Test multi-voice scenarios**: Toggle multiple voices, verify combined states sent to backend

**Testing Subtask:**

- [ ] **Write Tests**: Comprehensive E2E test scenarios (see Testing section below)

**Key Implementation Notes:**

**Test Setup Pattern:**
- Mock SignalR hub connection and responses
- Use Cypress intercepts for `/api/djHub` endpoint
- Set up device fixture with connected state and loaded file

**Critical Test Scenarios:**
1. User loads SID file → DJ toolbar appears with 3 checked checkboxes
2. User unchecks Voice 1 → backend receives mute command with Voice1=Disabled
3. User launches new file → checkboxes reset to all checked without backend call
4. Backend errors → alert displayed, checkboxes remain in previous state
5. Multiple voice toggles → backend receives combined voice states correctly

**Testing Focus for Task 3:**

**E2E Scenarios to Test:**

- [ ] **DJ toolbar appears on file load**: Toolbar visible after launching SID music file
- [ ] **Checkbox interactions work**: User can check/uncheck voice checkboxes
- [ ] **Backend receives mute commands**: Toggling checkboxes sends correct voice states to hub
- [ ] **File change resets checkboxes**: Launching new file resets all checkboxes to checked
- [ ] **Error alerts display**: Service errors show alert messages
- [ ] **Loading states block interactions**: Checkboxes disabled during API calls
- [ ] **Multi-voice scenarios**: Toggling multiple voices sends correct combined states

**Testing Reference:**

- See [E2E Tests Guide](../../../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) for Cypress patterns
- Use `cy.intercept()` for SignalR hub endpoint mocking
- Use `data-testid` attributes for stable selectors

</details>

---

## 🗂️ Files Modified or Created

**New Files:**

- `libs/features/player/src/lib/player-view/player-device-container/dj-toolbar/dj-toolbar.component.ts`
- `libs/features/player/src/lib/player-view/player-device-container/dj-toolbar/dj-toolbar.component.html`
- `libs/features/player/src/lib/player-view/player-device-container/dj-toolbar/dj-toolbar.component.scss`
- `libs/features/player/src/lib/player-view/player-device-container/dj-toolbar/dj-toolbar.component.spec.ts`
- `apps/teensyrom-ui-e2e/src/e2e/dj-toolbar.cy.ts`

**Modified Files:**

- `libs/features/player/src/lib/player-view/player-device-container/player-device-container.component.html` (add DJ toolbar)
- `libs/features/player/src/lib/player-view/player-device-container/player-device-container.component.ts` (import DJ toolbar)
- `libs/features/player/src/lib/player-view/player-device-container/player-device-container.component.scss` (toolbar spacing)

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

> **IMPORTANT:** Tests are written **within each task above**, not here. This section is only a summary for quick reference.

> **Core Testing Philosophy:**
>
> - **Favor behavioral testing** - test what users observe, not how it's implemented
> - **Test as you go** - tests are integrated into each task's subtasks, not deferred to the end
> - **Test through public APIs** - components tested through template interactions and outputs
> - **Mock at boundaries** - mock DJ_SERVICE and PLAYER_CONTEXT, not internal component logic

> **Reference Documentation:**
>
> - **All tasks**: [Testing Standards](../../../TESTING_STANDARDS.md) - Core behavioral testing approach
> - **Component testing**: [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component testing patterns
> - **E2E testing**: [E2E Tests Guide](../../../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - Cypress patterns

### Where Tests Are Written

**Tests are embedded in each task above** with:

- **Testing Subtask**: Checkbox in the task's subtask list (e.g., "Write Tests: Test behaviors for this task")
- **Testing Focus**: "Behaviors to Test" section listing observable outcomes
- **Testing Reference**: Links to relevant testing documentation

**Complete each task's testing subtask before moving to the next task.**

### Test Execution Commands

**Running Tests:**

```bash
# Run unit tests for player feature (includes DJ toolbar)
pnpm nx test player --watch=false

# Run tests in watch mode during development
pnpm nx test player --watch

# Run E2E tests
pnpm nx e2e teensyrom-ui-e2e --watch
```

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

> **Mark checkboxes as criteria are met**. All items must be checked before phase is complete.

**Functional Requirements:**

- [ ] DJ toolbar component created with 3 voice checkboxes
- [ ] Toolbar positioned above player-toolbar in player-device-container
- [ ] Checkboxes toggle voice mute states via DJ service
- [ ] File changes reset checkboxes to all enabled (checked)
- [ ] File change reset does not call DJ service
- [ ] Checkboxes disabled during DJ service calls (loading state)
- [ ] Error handling via alert service (no UI crashes)
- [ ] Component follows [Coding Standards](../../../CODING_STANDARDS.md)
- [ ] Styling follows [Style Guide](../../../STYLE_GUIDE.md) patterns

**Testing Requirements:**

- [ ] All testing subtasks completed within each task
- [ ] Unit tests pass with >90% coverage for DJ toolbar component
- [ ] Unit tests verify checkbox interactions call DJ service correctly
- [ ] Unit tests verify file change resets without service calls
- [ ] E2E tests verify end-to-end user flows
- [ ] All tests passing with no failures

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes with no errors (`pnpm nx lint`)
- [ ] Code formatting is consistent
- [ ] No console errors in browser when using DJ toolbar
- [ ] Checkboxes keyboard-accessible (ARIA attributes)

**Documentation:**

- [ ] Component added to [Component Library](../../../COMPONENT_LIBRARY.md) with usage example
- [ ] Inline JSDoc comments for public methods

**Ready for Production:**

- [ ] All success criteria met
- [ ] No known bugs or issues
- [ ] Code reviewed and approved
- [ ] Feature ready for user testing

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Design Decisions

- **Toolbar Placement**: Above player-toolbar to maintain visual hierarchy (controls → playback)
- **Checkbox State Management**: Local component state (signals) synced with backend via DJ service
- **File Change Reset Logic**: Uses `untracked()` to prevent infinite loops, resets without backend calls
- **Loading State**: Disables all checkboxes during API calls to prevent race conditions
- **Error Handling**: Relies on DJ service's ALERT_SERVICE integration, component stays resilient

### Implementation Constraints

- **Signal Effects**: Must use `untracked()` in file change effect to avoid calling DJ service during reset
- **Async Operations**: Checkbox handlers must await DJ service responses before updating state
- **Clean Architecture**: Component depends on domain contracts (`DJ_SERVICE`, `PLAYER_CONTEXT`), not implementations
- **Conditional Rendering**: Toolbar only visible when `isPlayerLoaded()` is true (matches player-toolbar pattern)

### Future Enhancements

- **Voice Labels**: Replace generic "Voice 1/2/3" with context-aware labels (Lead/Bass/FX) based on SID metadata
- **Voice Visualization**: Add visual waveform or frequency indicators per voice
- **Preset Configurations**: Save/load voice mute presets for quick switching
- **Keyboard Shortcuts**: Add hotkeys for quick voice muting (e.g., 1/2/3 keys)
- **History Tracking**: Track voice mute patterns for analytics or user preferences

### Integration Dependencies

**Requires Phase 1 Completion:**
- Backend DJHub must be deployed and accessible at `/api/djHub`
- MuteSidVoicesCommand must be functional and tested

**Requires Phase 2 Completion:**
- DJ_SERVICE domain contract available in libs/domain/contracts
- DjService infrastructure implementation registered in DI
- VoiceState enum available in libs/domain/models

### Accessibility Considerations

- Use semantic `<label>` elements wrapping checkboxes
- Add `aria-label` attributes for screen readers
- Ensure keyboard navigation works (Tab, Space to toggle)
- Add `aria-busy` attribute when loading state active
- Provide visual feedback for disabled state (opacity, cursor)

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

</details>

---

## 💡 Agent Implementation Guide

> **Instructions for AI agents creating and using this document**

### Before Starting Implementation

**Verify Prerequisites:**

1. ✅ Phase 1 (DJHub) completed and deployed
2. ✅ Phase 2 (DjService) completed with domain contract and infrastructure
3. ✅ VoiceState enum available in domain models
4. ✅ DJ_SERVICE injection token available in domain contracts

**Ask Clarifying Questions:**

1. **Component Visibility**:
   - Should DJ toolbar be visible for all file types or only SID music files?
   - Should toolbar visibility be user-configurable (settings toggle)?

2. **Voice Reset Behavior**:
   - Confirm file change reset should not send backend command
   - Should reset happen immediately or wait for file load completion?

3. **Styling Preferences**:
   - Should checkboxes use Material Design styles or custom styles?
   - Preferred layout: horizontal row or vertical stack?
   - Icon/label positioning preferences?

### During Implementation

**Progress Tracking:**

1. ✅ **Mark Checkboxes**: Check off each subtask as you complete it
2. 📝 **Update Notes**: Add discoveries or decisions to "Discoveries During Implementation"
3. 🚧 **Track Blockers**: Document any issues that arise
4. 📊 **Update Success Criteria**: Mark criteria as met

**Testing Integration:**

1. **Test as you go**: Complete each task's testing subtask before moving on
2. **Behavioral focus**: Test observable outcomes (checkbox states, service calls, resets)
3. **Mock boundaries**: Mock DJ_SERVICE and PLAYER_CONTEXT providers

### After Completing a Task

1. Verify all subtasks are checked off
2. Ensure testing subtask is complete
3. Confirm all behavioral tests pass
4. Update component library documentation
5. Mark task as complete in phase plan

### Remember

You are implementing a **user-facing UI component** that:

- Provides intuitive voice control for DJs
- Integrates with existing player infrastructure
- Handles errors gracefully without crashing
- Follows established Angular and component patterns
- Tests behaviors users will observe
- Maintains accessibility standards

When in doubt: **Test through template interactions. Follow player-toolbar patterns. Choose user experience over cleverness.**

---

## 🎓 Examples of Good vs Bad Implementations

### ❌ Bad (Imperative State Management)

```typescript
// Manual DOM manipulation, no signals
toggleVoice1(): void {
  const checkbox = document.querySelector('#voice1');
  checkbox.checked = !checkbox.checked;
  this.djService.muteVoices(...); // Fire and forget
}
```

### ✅ Good (Reactive Signal-Based)

```typescript
// Signal-based with proper async handling
async toggleVoice1(): Promise<void> {
  const newState = !this.voice1Enabled();
  this.isLoading.set(true);
  
  try {
    await firstValueFrom(this.djService.muteVoices(
      this.deviceId(),
      newState ? VoiceState.Enabled : VoiceState.Disabled,
      this.voice2Enabled() ? VoiceState.Enabled : VoiceState.Disabled,
      this.voice3Enabled() ? VoiceState.Enabled : VoiceState.Disabled
    ));
    this.voice1Enabled.set(newState);
  } catch (error) {
    // Error handled by DJ service
  } finally {
    this.isLoading.set(false);
  }
}
```

### ❌ Bad (File Change Triggers Service Call)

```typescript
// Effect calls service on file change (wrong!)
effect(() => {
  const currentFile = this.playerContext.getCurrentFile(this.deviceId())();
  if (currentFile) {
    // ❌ This calls service every file change!
    this.resetVoices();
  }
});

resetVoices() {
  this.djService.muteVoices(...); // Wrong - user didn't request this
}
```

### ✅ Good (File Change Resets Without Service Call)

```typescript
// Effect resets local state only, no service call
effect(() => {
  const deviceId = this.deviceId();
  const currentFile = this.playerContext.getCurrentFile(deviceId)();
  
  if (currentFile) {
    untracked(() => {
      // ✅ Reset local state only
      this.voice1Enabled.set(true);
      this.voice2Enabled.set(true);
      this.voice3Enabled.set(true);
    });
  }
});
```

</details>
