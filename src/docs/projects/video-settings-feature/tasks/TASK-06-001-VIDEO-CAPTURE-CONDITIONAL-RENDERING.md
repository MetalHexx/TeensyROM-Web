# TASK-06-001: Video Capture Conditional Rendering Integration

## 📋 Task Metadata

**Task ID**: TASK-06-001-VIDEO-CAPTURE-CONDITIONAL-RENDERING  
**Task Name**: Implement Conditional Rendering of Video Capture Based on EnableVideo Setting  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small (3 files total)  
**Phase**: Phase 6 - Video Capture Integration  
**Complexity**: Medium

---

## 🎯 Objective

**What**: Inject SettingsStore into PlayerDeviceContainerComponent, create an enableVideo computed signal, and wrap VideoCaptureComponent in an @if directive to conditionally render based on the user's video settings preference.

**Why**: This delivers the core user value of the video settings feature: users can hide video capture controls when they don't have capture hardware or don't want video functionality, simplifying their UI and preventing unnecessary camera permission requests.

**Success Criteria**:

- [ ] SettingsStore injected into PlayerDeviceContainerComponent using SETTINGS_STORE injection token
- [ ] enableVideo computed signal created that calls settingsStore.enableVideo()
- [ ] VideoCaptureComponent wrapped in @if (enableVideo()) { } directive in template
- [ ] Video capture shows when enableVideo is true
- [ ] Video capture hidden when enableVideo is false
- [ ] MediaStream cleanup verified (ngOnDestroy called when component destroyed)
- [ ] 12+ new tests added (3 enableVideo signal, 5 conditional rendering, 4 integration)
- [ ] All existing player tests pass (no regressions)
- [ ] No TypeScript errors or console errors
- [ ] Manual E2E verification complete (settings toggle → player update → cleanup)
- [ ] Code follows all standards (Coding, Testing, State)

---

## 📚 Context & Dependencies

### Prerequisites Completed

- ✅ Phase 1: VideoSettings backend domain model exists
- ✅ Phase 2: Backend API fully supports VideoSettings
- ✅ Phase 3: Frontend VideoSettings domain interface and infrastructure complete
- ✅ Phase 4: SettingsStore selectors created (selectEnableVideo available)
- ✅ Phase 5: Video settings UI component in settings view complete
- ✅ VideoCaptureComponent has ngOnDestroy that stops MediaStream tracks
- ✅ PlayerDeviceContainerComponent already injects PLAYER_CONTEXT store

### Dependencies

- **Application Layer**: SettingsStore with selectEnableVideo selector
- **Domain Layer**: VideoSettings interface with enableVideo property
- **Player Feature**: PlayerDeviceContainerComponent, VideoCaptureComponent
- **Angular**: Computed signals, @if directive, dependency injection

### Constraints

- **Pattern Consistency**: Follow existing store injection pattern (PLAYER_CONTEXT example)
- **Layout Preservation**: Removing video-capture shouldn't break device-header layout
- **Cleanup Critical**: Must verify MediaStream cleanup happens correctly
- **No Video Component Changes**: VideoCaptureComponent ngOnDestroy already correct
- **Reactivity**: Use computed signals (automatic updates) - no manual subscriptions

---

## 📁 File Scope

### Files to Modify (3 existing files)

- `libs/features/player/src/lib/player-view/player-device-container/player-device-container.component.ts`
  - **What Changes**: Import SETTINGS_STORE, inject store, add enableVideo computed signal
  - **Why**: Provides reactive enableVideo value for conditional rendering
  - **Lines to Add**: ~4-5 lines (import, injection, computed signal, JSDoc)

- `libs/features/player/src/lib/player-view/player-device-container/player-device-container.component.html`
  - **What Changes**: Wrap `<lib-video-capture>` element in @if (enableVideo()) { }
  - **Why**: Implements conditional rendering based on settings
  - **Lines to Add**: 2 lines (opening @if, closing })

- `libs/features/player/src/lib/player-view/player-device-container/player-device-container.component.spec.ts`
  - **What Changes**: Add tests for enableVideo signal and conditional rendering
  - **Why**: Verify store injection, signal behavior, and DOM updates
  - **Lines to Add**: ~60-80 lines (3-4 test suites with 12+ tests)

### Files to Review (for context only)

- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts`
  - **Why Review**: Verify ngOnDestroy implementation (stops tracks correctly)
  - **Key Pattern**: ngOnDestroy iterates currentStream tracks and calls stop()

- `libs/application/src/lib/settings/selectors/select-enable-video.ts`
  - **Why Review**: Understand selectEnableVideo return value (boolean, defaults to false)
  - **Key Pattern**: Returns enableVideo from videoSettings or false if not loaded

- `libs/application/src/lib/player/player-store.ts`
  - **Why Review**: See existing PLAYER_CONTEXT injection pattern
  - **Key Pattern**: Injection token + signalStore pattern

---

## 🛠️ Implementation Guidance

### Standards to Follow

- [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript, Angular 19 conventions (signals, @if)
- [Testing Standards](../../../TESTING_STANDARDS.md) - Behavioral testing approach
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component testing with stores
- [State Standards](../../../STATE_STANDARDS.md) - Store injection patterns

### Key Requirements

1. **Store Injection Pattern**:
   - Import SETTINGS_STORE from '@teensyrom-nx/application'
   - Use inject(SETTINGS_STORE) - NOT SettingsStore class
   - Follow same pattern as existing playerContext injection
   - Add as private readonly field

2. **Computed Signal Pattern**:
   - Use `readonly enableVideo = computed(() => this.settingsStore.enableVideo())`
   - Don't create local signal - use computed() for reactivity
   - Add JSDoc comment explaining purpose
   - Signal automatically updates when settings change

3. **Template Conditional Rendering**:
   - Use Angular 19 @if directive (not *ngIf)
   - Wrap entire `<lib-video-capture [deviceId]="deviceId()"></lib-video-capture>` element
   - Keep video-capture inside device-header div
   - Maintain proper indentation

4. **Testing Requirements**:
   - **EnableVideo Signal Tests** (3+ tests):
     - enableVideo signal defined and callable
     - Returns false when settings not loaded
     - Returns true when settings have enableVideo=true
   - **Conditional Rendering Tests** (5+ tests):
     - Video capture shows when enableVideo is true
     - Video capture hidden when enableVideo is false
     - Dynamic toggle adds component to DOM
     - Dynamic toggle removes component from DOM
     - Other components still render when video hidden
   - **Integration Tests** (4+ tests):
     - Settings store injected successfully
     - enableVideo reflects store value
     - Component destruction triggers ngOnDestroy
     - No errors during enable/disable transitions

### Anti-Patterns to Avoid

- ❌ **Don't inject SettingsStore class directly** - Use SETTINGS_STORE injection token
- ❌ **Don't use *ngIf** - Use Angular 19's @if directive
- ❌ **Don't create manual subscriptions** - Use computed() for automatic reactivity
- ❌ **Don't modify VideoCaptureComponent** - ngOnDestroy already handles cleanup
- ❌ **Don't forget JSDoc** - Document enableVideo signal purpose
- ❌ **Don't test implementation details** - Test observable behaviors only

---

## 🧪 Testing Requirements

### Test Coverage Required

**Unit Tests (EnableVideo Signal)**:

- [ ] enableVideo signal is defined
- [ ] enableVideo signal is callable and returns boolean
- [ ] enableVideo returns false when settings not loaded (default)
- [ ] enableVideo returns true when settings have enableVideo=true
- [ ] enableVideo returns false when settings have enableVideo=false

**Unit Tests (Conditional Rendering)**:

- [ ] lib-video-capture element present when enableVideo is true
- [ ] lib-video-capture element absent when enableVideo is false
- [ ] Changing enableVideo from false to true adds video-capture to DOM
- [ ] Changing enableVideo from true to false removes video-capture from DOM
- [ ] lib-file-image and lib-file-other still render when video-capture hidden
- [ ] device-header layout maintained when video-capture hidden

**Integration Tests (Store Integration)**:

- [ ] SettingsStore successfully injected via SETTINGS_STORE token
- [ ] enableVideo signal reflects SettingsStore.enableVideo() value
- [ ] Mocking settingsStore.enableVideo signal updates component.enableVideo()
- [ ] No TypeScript errors with SETTINGS_STORE injection

**Lifecycle Tests (MediaStream Cleanup)**:

- [ ] Component destruction occurs when enableVideo changes from true to false
- [ ] No console errors during component destruction

### Behavioral Expectations

**Component Behaviors**:

- Component renders without errors with SettingsStore injected
- enableVideo signal reactively updates when settings change
- Video capture component shows/hides based on enableVideo value
- Component destruction is clean (no errors, proper cleanup)

**Integration Behaviors**:

- Settings view toggle immediately updates player view
- Enabling video shows video capture and requests camera permission
- Disabling video hides video capture and stops camera (light turns off)
- Settings persist across page reloads (video capture shows/hides correctly on load)

**Edge Cases**:

- Rapid toggling enableVideo doesn't cause errors or race conditions
- Component handles undefined/null settings gracefully (defaults to false)
- Layout doesn't break when video capture removed from DOM
- Other device-header components (file-image, file-other) unaffected

---

## 📚 Related Documentation

**Planning Documents**:

- [Master Plan](../master-plan.md#phase-6) - Overall feature plan
- [Phase 6 Plan](../phases/phase-06-video-capture-integration.md) - Detailed phase plan for this task
- [Phase 5 Report](../reports/TASK-05-001-report.md) - Video settings UI complete
- [Phase 4 Report](../reports/TASK-04-001-report.md) - Selectors available

**Architecture & Standards**:

- [Overview Context](../../../OVERVIEW_CONTEXT.md) - Clean Architecture layers
- [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript and Angular 19 conventions
- [Testing Standards](../../../TESTING_STANDARDS.md) - Behavioral testing approach
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component testing with stores
- [State Standards](../../../STATE_STANDARDS.md) - Store injection patterns

**Reference Implementations**:

- [PlayerDeviceContainerComponent](../../libs/features/player/src/lib/player-view/player-device-container/player-device-container.component.ts) - Existing store injection pattern (PLAYER_CONTEXT)
- [VideoCaptureComponent](../../libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts) - ngOnDestroy cleanup implementation
- [selectEnableVideo](../../libs/application/src/lib/settings/selectors/select-enable-video.ts) - Selector being consumed

**Related Tasks**:

- TASK-01-001: Backend VideoSettings domain model (completed)
- TASK-04-001: SettingsStore selectors (completed - provides selectEnableVideo)
- TASK-05-001: Video settings UI component (completed - provides settings toggle)

---

## 📤 Output Requirements

### Output Report Location

**File Path**: `docs/projects/video-settings-feature/reports/TASK-06-001-report.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

### Report Contents Required

Your completion report must include:

1. **Task Summary**: What was accomplished
2. **Files Modified**: List 3 files with changes made
3. **Implementation Details**:
   - Store injection approach
   - Computed signal implementation
   - Conditional rendering strategy
   - MediaStream cleanup verification
4. **Testing Results**:
   - Number of tests added (should be 12+)
   - All tests passing confirmation
   - Test execution output summary
   - No regression confirmation
5. **Code Quality Verification**:
   - TypeScript compilation: no errors
   - Linting: no new warnings
   - Console: no browser errors
6. **Manual Verification**:
   - Settings toggle immediately updates player view
   - Video capture shows when enabled
   - Video capture hidden when disabled
   - Camera cleanup verified (camera light turns off)
   - Settings persistence across reloads verified
7. **Discoveries**: Any insights or decisions made during implementation
8. **Feature Complete**: Confirmation that video settings feature is production-ready

### Return Value

When complete, return the file path: `docs/projects/video-settings-feature/reports/TASK-06-001-report.md`

---

## 🎯 Quick Start Checklist

Before you begin, verify:

- [x] Phase 5 complete (video settings UI exists)
- [x] Phase 4 complete (selectEnableVideo selector available)
- [x] SettingsStore accessible via SETTINGS_STORE injection token
- [x] PlayerDeviceContainerComponent exists and renders video-capture
- [x] VideoCaptureComponent has ngOnDestroy cleanup

**Implementation Order**:

1. ✅ Review PlayerDeviceContainerComponent current implementation
2. ✅ Review VideoCaptureComponent ngOnDestroy cleanup
3. ✅ Add SETTINGS_STORE import to player-device-container.component.ts
4. ✅ Inject SettingsStore as private readonly field
5. ✅ Create enableVideo computed signal
6. ✅ Add JSDoc comments
7. ✅ Write enableVideo signal tests (3+ tests)
8. ✅ Run tests (`pnpm nx test player`)
9. ✅ Add @if (enableVideo()) { } wrapper to template
10. ✅ Write conditional rendering tests (5+ tests)
11. ✅ Write integration tests (4+ tests)
12. ✅ Run all tests (`pnpm nx test player`)
13. ✅ Manual browser verification (toggle settings, verify camera cleanup)
14. ✅ Verify settings persistence across reloads
15. ✅ Write completion report

---

## 💡 Implementation Tips

### Store Injection Pattern

**Current Pattern** (PLAYER_CONTEXT - to follow):

```typescript
import { PLAYER_CONTEXT } from '@teensyrom-nx/application';

export class PlayerDeviceContainerComponent {
  private readonly playerContext = inject(PLAYER_CONTEXT);
}
```

**New Pattern** (SETTINGS_STORE - to add):

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

### Template Pattern

**Current** (video-capture always shown):

```html
<lib-video-capture [deviceId]="deviceId()"></lib-video-capture>
```

**New** (video-capture conditionally rendered):

```html
@if (enableVideo()) {
  <lib-video-capture [deviceId]="deviceId()"></lib-video-capture>
}
```

### Testing Pattern

**Mock SettingsStore**:

```typescript
const mockSettingsStore = {
  enableVideo: signal(false), // Writable signal for testing
};

TestBed.configureTestingModule({
  providers: [
    { provide: SETTINGS_STORE, useValue: mockSettingsStore },
  ],
});

// In test, change value:
mockSettingsStore.enableVideo.set(true);
fixture.detectChanges();
// Verify video-capture now in DOM
```

### Common Gotchas

- **Signal Syntax**: Remember to call signal functions: `enableVideo()` not `enableVideo`
- **Import Path**: Use `@teensyrom-nx/application` barrel export for SETTINGS_STORE
- **Computed Pattern**: Use `computed(() => ...)` not direct signal access
- **Template Syntax**: Use `@if` not `*ngIf` (Angular 19)
- **Test Mocking**: Mock settingsStore.enableVideo as a writable signal for testing

### Manual Verification Steps

1. **Enable Video**:
   - Go to Settings → Video → Toggle "Enable video capture" ON
   - Navigate to Player view
   - ✅ Video capture component visible
   - ✅ Camera permission requested
   - ✅ Camera light turns on (if granted)

2. **Disable Video**:
   - Go to Settings → Video → Toggle "Enable video capture" OFF
   - Navigate to Player view (or stay on it)
   - ✅ Video capture component hidden
   - ✅ Camera light turns off (stream stopped)
   - ✅ No console errors

3. **Persistence**:
   - Enable video → Reload page
   - ✅ Video capture still shows
   - Disable video → Reload page
   - ✅ Video capture still hidden

---

## 🚀 Ready to Execute

**Estimated Time**: 1-1.5 hours  
**Complexity**: Medium (store integration + conditional rendering + cleanup verification)  
**Dependencies**: All prerequisites met ✅  
**Blockers**: None  

This task is **ready for immediate execution**. All context provided. Follow the Phase 6 plan document for detailed guidance on each subtask.

**FINAL PHASE**: This completes the video settings feature. After this task:
- ✅ Backend fully supports VideoSettings
- ✅ Frontend fully supports VideoSettings
- ✅ Settings UI allows user control
- ✅ Player view respects user preference
- ✅ MediaStream cleanup verified
- 🎉 **Feature production-ready**

---

**Document Version**: 1.0  
**Created**: November 26, 2025  
**Status**: Ready for execution
