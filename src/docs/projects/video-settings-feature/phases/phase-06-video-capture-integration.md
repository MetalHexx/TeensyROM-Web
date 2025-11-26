# Phase 6: Video Capture Integration - Conditional Rendering

## 🎯 Objective

Implement conditional rendering of the VideoCaptureComponent based on the EnableVideo setting, connecting the user's preference from settings to the actual visibility of video capture controls in the player interface. This phase completes the video settings feature by delivering the actual user value: hiding video capture when not needed.

**User Value**: Users who don't have video capture hardware or don't want video capture functionality can now hide the video capture component from the player interface, simplifying their UI and preventing unnecessary camera permission requests.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Master Plan](../master-plan.md) - Overall video settings feature plan
- [ ] [Phase 5 Report](../reports/TASK-05-001-report.md) - Video settings UI component complete
- [ ] [Phase 4 Report](../reports/TASK-04-001-report.md) - Video settings selectors available

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript and Angular conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches
- [ ] [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component testing patterns
- [ ] [State Standards](../../../STATE_STANDARDS.md) - Store injection and usage patterns

---

## 📂 File Structure Overview

```
libs/features/player/src/lib/player-view/player-device-container/
├── player-device-container.component.ts       📝 Modified - Inject SettingsStore, add enableVideo signal
├── player-device-container.component.html     📝 Modified - Wrap video-capture in @if directive
├── player-device-container.component.spec.ts  📝 Modified - Add tests for conditional rendering
└── video-capture/
    └── video-capture.component.ts             ✅ No changes - ngOnDestroy already handles cleanup
```

---

## 📋 Implementation Guidelines

---

<details open>
<summary><h3>Task 1: Inject SettingsStore and Subscribe to EnableVideo</h3></summary>

**Purpose**: Inject the SettingsStore into PlayerDeviceContainerComponent and create a computed signal that subscribes to the enableVideo selector. This provides the reactive value that controls video capture visibility.

**Related Documentation:**

- [State Standards](../../../STATE_STANDARDS.md#store-injection-pattern) - Store injection via injection token
- [Phase 4 Report](../reports/TASK-04-001-report.md) - selectEnableVideo selector details
- [PlayerDeviceContainerComponent](../../libs/features/player/src/lib/player-view/player-device-container/player-device-container.component.ts) - Current implementation

**Implementation Subtasks:**

- [ ] **Import SettingsStore**: Import SETTINGS_STORE injection token from @teensyrom-nx/application
- [ ] **Inject Store**: Add private readonly settingsStore = inject(SETTINGS_STORE)
- [ ] **Create Signal**: Add readonly enableVideo = computed(() => this.settingsStore.enableVideo())
- [ ] **Add JSDoc**: Document enableVideo signal explaining its purpose

**Testing Subtask:**

- [ ] **Write Tests**: Add tests verifying SettingsStore injection and enableVideo signal (see Testing section below)

**Key Implementation Notes:**

- **Injection Token Pattern**: Use SETTINGS_STORE token, not SettingsStore class directly
- **Computed Signal**: enableVideo should be a computed signal that calls settingsStore.enableVideo()
- **Reactivity**: Angular's signals automatically handle updates - no manual subscription needed
- **Default Behavior**: When settings not loaded, selectEnableVideo returns false (safe default)

**Store Injection Pattern** (reference only):

```typescript
import { SETTINGS_STORE } from '@teensyrom-nx/application';

export class PlayerDeviceContainerComponent {
  private readonly settingsStore = inject(SETTINGS_STORE);
  
  /**
   * Whether video capture is enabled in settings.
   * Controls visibility of video capture component.
   */
  readonly enableVideo = computed(() => this.settingsStore.enableVideo());
}
```

**Testing Focus for Task 1:**

> Focus on **behavioral testing** - what observable outcomes occur?

**Behaviors to Test:**

- [ ] **SettingsStore Injected**: Component successfully injects SETTINGS_STORE
- [ ] **EnableVideo Signal Exists**: enableVideo signal is defined and callable
- [ ] **EnableVideo Returns Boolean**: enableVideo() returns boolean value
- [ ] **EnableVideo Defaults to False**: When settings not loaded, enableVideo() returns false
- [ ] **EnableVideo Reflects Settings**: When settings loaded with true, enableVideo() returns true

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for behavioral testing patterns
- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) for component testing with stores

</details>

---

<details open>
<summary><h3>Task 2: Implement Conditional Rendering with @if Directive</h3></summary>

**Purpose**: Wrap the VideoCaptureComponent in an @if directive that checks the enableVideo signal. This implements the actual conditional rendering behavior that hides/shows video capture based on user settings.

**Related Documentation:**

- [Angular Control Flow](https://angular.io/guide/control-flow) - @if directive documentation
- [player-device-container.component.html](../../libs/features/player/src/lib/player-view/player-device-container/player-device-container.component.html) - Current template

**Implementation Subtasks:**

- [ ] **Wrap VideoCaptureComponent**: Add @if (enableVideo()) { } around lib-video-capture element
- [ ] **Maintain Existing Structure**: Keep video-capture in device-header div
- [ ] **Preserve Styling**: Ensure conditional rendering doesn't break layout
- [ ] **Test in Browser**: Manually verify show/hide behavior works

**Testing Subtask:**

- [ ] **Write Tests**: Add tests for conditional rendering behavior (see Testing section below)

**Key Implementation Notes:**

- **@if Directive**: Use Angular 19's modern @if control flow, not *ngIf
- **Component Destruction**: @if automatically destroys component when false - ngOnDestroy cleanup will run
- **Layout Preservation**: Video capture div is in device-header flex layout - removal shouldn't break other elements
- **Animation Consideration**: No animation needed - instant show/hide is appropriate for settings changes

**Template Change** (reference only):

```html
<!-- Before -->
<lib-video-capture [deviceId]="deviceId()"></lib-video-capture>

<!-- After -->
@if (enableVideo()) {
  <lib-video-capture [deviceId]="deviceId()"></lib-video-capture>
}
```

**Testing Focus for Task 2:**

**Behaviors to Test:**

- [ ] **Video Capture Shows When Enabled**: When enableVideo is true, video-capture component is in DOM
- [ ] **Video Capture Hidden When Disabled**: When enableVideo is false, video-capture component is NOT in DOM
- [ ] **Dynamic Toggle**: Changing enableVideo from false to true adds component to DOM
- [ ] **Dynamic Toggle Reverse**: Changing enableVideo from true to false removes component from DOM
- [ ] **Layout Integrity**: Other components (file-image, file-other) still render correctly when video-capture hidden

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for DOM query patterns
- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) for testing conditional rendering

</details>

---

<details open>
<summary><h3>Task 3: Verify MediaStream Cleanup</h3></summary>

**Purpose**: Verify that VideoCaptureComponent's ngOnDestroy correctly cleans up MediaStream resources when the component is destroyed via @if directive. This ensures no memory leaks or lingering camera access.

**Related Documentation:**

- [video-capture.component.ts](../../libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts) - ngOnDestroy implementation
- [MediaStream API](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream) - Browser API cleanup

**Implementation Subtasks:**

- [ ] **Review ngOnDestroy**: Verify VideoCaptureComponent.ngOnDestroy stops all media tracks
- [ ] **Add Console Logging**: Add temporary console.log in ngOnDestroy for manual verification
- [ ] **Manual Testing**: Toggle enableVideo setting and verify cleanup logs
- [ ] **Remove Console Logging**: Remove temporary logs after verification

**Testing Subtask:**

- [ ] **Write Tests**: Add test verifying ngOnDestroy is called when component removed (see Testing section below)

**Key Implementation Notes:**

- **Existing Implementation**: VideoCaptureComponent already has ngOnDestroy that stops tracks
- **Angular Behavior**: @if false triggers component destruction and ngOnDestroy lifecycle hook
- **Manual Verification**: Use browser DevTools to verify camera light turns off when video capture disabled
- **No Code Changes Needed**: This task is primarily verification, not new implementation

**ngOnDestroy Verification** (reference only - already exists):

```typescript
ngOnDestroy(): void {
  const stream = this.currentStream();
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
}
```

**Testing Focus for Task 3:**

**Behaviors to Test:**

- [ ] **ngOnDestroy Called**: When enableVideo changes from true to false, VideoCaptureComponent ngOnDestroy is invoked
- [ ] **Component Lifecycle**: Component destruction happens when @if becomes false
- [ ] **No Errors on Destruction**: No console errors when video capture component destroyed

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for lifecycle testing
- Use Jasmine spies to verify ngOnDestroy calls

</details>

---

<details open>
<summary><h3>Task 4: Integration Testing and E2E Verification</h3></summary>

**Purpose**: Write comprehensive integration tests and perform manual E2E verification to ensure the complete user flow works: settings toggle → player view update → MediaStream cleanup.

**Related Documentation:**

- [Testing Standards](../../../TESTING_STANDARDS.md) - Integration testing approach
- [Master Plan User Scenarios](../master-plan.md#user-scenarios) - Expected behaviors

**Implementation Subtasks:**

- [ ] **Add Integration Tests**: Test full flow from settings change to player update
- [ ] **Add Edge Case Tests**: Test rapid toggling, page navigation, settings persistence
- [ ] **Manual E2E Testing**: Test complete user journey in browser
- [ ] **Verify Settings Persistence**: Test that enableVideo state persists across sessions

**Testing Subtask:**

- [ ] **Write Tests**: All integration tests written (see Testing section below)

**Key Implementation Notes:**

- **Integration Testing**: Mock SettingsStore with writable enableVideo signal
- **E2E Verification**: Manually test in browser with real settings store
- **Settings Persistence**: Verify auto-save triggers and reloads work correctly
- **Cross-Component Communication**: Verify settings view changes immediately affect player view

**Integration Test Scenarios**:

1. **Settings Toggle Flow**: Change enableVideo in settings → player view updates immediately
2. **Persistence Flow**: Enable video → reload page → player view shows video capture
3. **Disable Flow**: Disable video → reload page → player view hides video capture
4. **Rapid Toggle**: Toggle setting multiple times rapidly → no errors, correct final state

**Testing Focus for Task 4:**

**Behaviors to Test:**

- [ ] **Settings to Player Flow**: Toggling enableVideo in settings view immediately updates player view
- [ ] **Persistence Works**: enableVideo setting persists across page reloads
- [ ] **No Console Errors**: No errors during enable/disable transitions
- [ ] **Camera Permission**: Camera permission not requested when enableVideo is false
- [ ] **Device Enumeration**: Video devices not enumerated when enableVideo is false
- [ ] **Rapid Toggle Handling**: Multiple rapid toggles don't cause errors or race conditions

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for integration testing patterns
- See [Master Plan](../master-plan.md#user-scenarios) for complete user scenarios

</details>

---

## 🗂️ Files Modified or Created

**Modified Files (3 existing files)**:

- `libs/features/player/src/lib/player-view/player-device-container/player-device-container.component.ts`
- `libs/features/player/src/lib/player-view/player-device-container/player-device-container.component.html`
- `libs/features/player/src/lib/player-view/player-device-container/player-device-container.component.spec.ts`

**No New Files** - This phase modifies existing files only

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

> **IMPORTANT:** Tests are written **within each task above**, not here. This section is only a summary for quick reference.

> **Core Testing Philosophy:**
>
> - **Favor behavioral testing** - test what users observe
> - **Test as you go** - tests integrated into each task
> - **Test through public APIs** - test component inputs/outputs
> - **Mock at boundaries** - mock SettingsStore, not Angular internals

### Where Tests Are Written

**Task 1**: SettingsStore injection and enableVideo signal tests

- SettingsStore injected successfully
- enableVideo signal defined and callable
- enableVideo returns correct boolean values
- enableVideo defaults to false

**Task 2**: Conditional rendering tests

- Video capture shows when enabled
- Video capture hidden when disabled
- Dynamic toggling adds/removes component
- Layout integrity maintained

**Task 3**: MediaStream cleanup verification

- ngOnDestroy called on component destruction
- No errors during destruction

**Task 4**: Integration and E2E tests

- Settings toggle updates player view
- Settings persistence across reloads
- No console errors during transitions
- Camera permissions handled correctly

### Test Execution Commands

**Running Tests:**

```bash
# Run player feature tests
pnpm nx test player

# Run in watch mode during development
pnpm nx test player --watch

# Run all tests
pnpm nx run-many --target=test --all
```

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

> **Mark checkboxes as criteria are met**. All items must be checked before phase is complete.

**Functional Requirements:**

- [ ] SettingsStore injected into PlayerDeviceContainerComponent
- [ ] enableVideo computed signal created and working
- [ ] VideoCaptureComponent wrapped in @if (enableVideo()) directive
- [ ] Video capture shows when enableVideo is true
- [ ] Video capture hidden when enableVideo is false
- [ ] MediaStream cleanup verified (ngOnDestroy called, tracks stopped)
- [ ] Code follows [Coding Standards](../../../CODING_STANDARDS.md)
- [ ] Store injection follows [State Standards](../../../STATE_STANDARDS.md)

**Testing Requirements:**

- [ ] Unit tests for enableVideo signal (3+ tests)
- [ ] Unit tests for conditional rendering (5+ tests)
- [ ] Integration tests for settings-to-player flow (3+ tests)
- [ ] MediaStream cleanup verification test (1 test)
- [ ] All existing player tests still pass (no regressions)
- [ ] Test coverage meets or exceeds project standards

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes with no errors (`pnpm nx lint player`)
- [ ] Code formatting is consistent
- [ ] No console errors in browser during enable/disable transitions

**Manual Verification:**

- [ ] Navigate to player view with enableVideo=false → video capture hidden
- [ ] Navigate to settings, enable video → player view updates immediately
- [ ] Video capture component appears and initializes camera
- [ ] Navigate to settings, disable video → player view updates immediately
- [ ] Video capture component disappears, camera light turns off
- [ ] Reload page with enableVideo=true → video capture shows
- [ ] Reload page with enableVideo=false → video capture hidden
- [ ] No console errors during any transitions
- [ ] Camera permission not requested when video capture hidden

**Ready for Production:**

- [ ] All success criteria met
- [ ] No known bugs or issues
- [ ] Code reviewed and approved
- [ ] Feature complete and ready for deployment

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Design Decisions

- **@if vs *ngIf**: Using modern Angular 19 @if directive for control flow consistency with rest of codebase
- **Component Destruction**: @if false destroys component (not just hides) - ensures proper MediaStream cleanup via ngOnDestroy
- **Computed Signal**: Using computed() instead of direct signal access for consistency with existing component patterns
- **Default Behavior**: enableVideo defaults to false (safe default - no surprise camera access)

### Implementation Constraints

- **No Video Component Changes**: VideoCaptureComponent already has proper ngOnDestroy - no changes needed
- **Layout Preservation**: Video capture is one of three elements in device-header flex layout - removal shouldn't affect layout
- **Store Dependency**: PlayerDeviceContainerComponent now depends on SettingsStore - acceptable for feature integration
- **Reactivity**: Angular signals provide automatic reactivity - no manual subscription management needed

### Future Enhancements

- **Smooth Transitions**: Could add fade-in/fade-out animations when showing/hiding video capture
- **Permission Prompt**: Could add user warning before enabling video (explains camera permission request)
- **Device Preference**: Could remember last selected video device per user
- **Multiple Devices**: Could support multiple simultaneous video captures (multi-device scenarios)

### External References

- [Angular Control Flow](https://angular.io/guide/control-flow) - @if directive documentation
- [MediaStream API](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream) - Browser API for camera access
- [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) - Camera permission request

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

</details>

---

## 💡 Agent Implementation Guide

### Before Starting Implementation

**Verify Prerequisites:**

1. Phase 5 complete - video settings UI exists
2. Phase 4 complete - selectEnableVideo selector available
3. SettingsStore accessible via SETTINGS_STORE injection token
4. PlayerDeviceContainerComponent exists and renders video-capture
5. VideoCaptureComponent has ngOnDestroy cleanup implementation

**Review Reference Implementations:**

1. Read PlayerDeviceContainerComponent current implementation
2. Review VideoCaptureComponent ngOnDestroy method
3. Study existing computed signals in PlayerDeviceContainerComponent
4. Examine device-header layout structure in template

### During Implementation

**Progress Tracking:**

1. ✅ Mark checkboxes in each task as you complete subtasks
2. 📝 Update notes section with any discoveries
3. 🧪 Run tests frequently to catch issues early
4. 🔍 Manual browser testing after each change

**Key Implementation Order:**

1. Add SettingsStore injection and enableVideo signal (TypeScript)
2. Write unit tests for enableVideo signal
3. Add @if directive to template
4. Write conditional rendering tests
5. Verify ngOnDestroy cleanup (manual testing)
6. Write integration tests
7. Run full test suite
8. Manual E2E verification in browser

### After Completing Each Task

1. Verify all subtasks checked off
2. Run tests for affected files
3. Fix any failures immediately
4. Update progress in this document
5. Commit changes (if using version control)

### Remember

- **Test as you go** - don't defer testing to the end
- **Manual verification matters** - camera cleanup must be verified in browser
- **Reactivity is automatic** - computed signals update automatically
- **Component destruction is key** - @if false triggers proper cleanup

---

**Phase Status**: Ready for execution  
**Dependencies**: Phase 5 complete ✅  
**Estimated Time**: 1-1.5 hours  
**Complexity**: Medium (store integration + conditional rendering + cleanup verification)
