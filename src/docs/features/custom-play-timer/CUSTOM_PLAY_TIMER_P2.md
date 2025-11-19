# Phase 2: Player Context Service Integration

## 🎯 Objective

Integrate custom timer configuration with the player context service layer by exposing methods for the UI to interact with timer settings and ensuring the service coordinates timer setup based on custom configuration. This phase bridges state management (Phase 1) with the UI layer (Phase 3), creating the application service contract that components will consume.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Custom Play Timer Feature Plan](./CUSTOM_PLAY_TIMER_PLAN.md) - High-level feature plan with user scenarios
- [ ] [Phase 1 Implementation](./CUSTOM_PLAY_TIMER_P1.md) - Prerequisites completed in Phase 1
- [ ] [Phase 2 Open Questions](./CUSTOM_PLAY_TIMER_PLAN.md#open-questions-for-phase-2) - Review decision recommendations

**Standards & Guidelines:**

- [ ] [Coding Standards](../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [Service Standards](../../SERVICE_STANDARDS.md) - Service layer patterns and conventions

---

## 📂 File Structure Overview

```
libs/application/src/lib/player/
├── player-context.interface.ts              📝 Modified - Add custom timer methods to IPlayerContext
├── player-context.service.ts                📝 Modified - Implement custom timer methods
└── player-context-playTimer.service.spec.ts 📝 Modified - Add behavioral tests for service methods
```

---

<details>
<summary><h3>✅ Task 1: Extend IPlayerContext Interface with Custom Timer Methods (COMPLETE)</h3></summary>

**Purpose**: Add method signatures to the player context interface contract that allow UI components to enable/disable custom timer and update duration values.

**Related Documentation:**

- [Coding Standards - Interface Design](../../CODING_STANDARDS.md)
- [Custom Play Timer Plan - Service Layer Contract](./CUSTOM_PLAY_TIMER_PLAN.md#integration-points)

**Implementation Subtasks:**

- [x] **Open player-context.interface.ts** in `libs/application/src/lib/player/` folder
- [x] **Add setCustomTimer method signature**: `setCustomTimer(deviceId: string, enabled: boolean, durationMs: number): void`
- [x] **Add getPlayTimerConfig method signature** (name adjusted to match selector): `getPlayTimerConfig(deviceId: string): Signal<PlayTimerConfig | null>`
- [x] **Import PlayTimerConfig type** from player-store.ts
- [x] **Add JSDoc comments** explaining each method's purpose and parameters

**Testing Subtask:**

- [x] **Write Tests**: Behavioral tests verify interface methods are implemented (all 21 custom timer tests passing)

**Key Implementation Notes:**

- setCustomTimer is void return - delegates to store action synchronously
- getPlayTimerConfig returns Signal for reactive state reading (consistent with getTimerState pattern)
- No validation logic in interface - parameter types enforce valid inputs
- Method names align with existing patterns: `set*` for mutations, `get*` for queries
- **Implementation includes mid-playback timer recreation** - setCustomTimer checks if file is playing and recreates timer immediately with new config

**Testing Focus for Task 1:**

> Focus on **behavioral testing** - what observable outcomes occur?

**Behaviors to Test:**

- [x] **setCustomTimer enables timer**: Calling setCustomTimer with enabled=true updates store state to enabled
- [x] **setCustomTimer updates duration**: Calling setCustomTimer with durationMs=60000 updates store state duration
- [x] **getPlayTimerConfig returns current state**: After setCustomTimer call, getPlayTimerConfig reflects new values
- [x] **Methods are available on service instance**: IPlayerContext interface methods are callable on PlayerContextService instance

**Testing Reference:**

- See [Testing Standards](../../TESTING_STANDARDS.md) for behavioral testing patterns
- See [Player Context Service Tests](../../libs/application/src/lib/player/player-context.service.spec.ts) for service test patterns

**Implementation Summary:**

- Extended IPlayerContext with `getPlayTimerConfig()` and `setCustomTimer()` method signatures
- Implemented `getPlayTimerConfig()` in PlayerContextService - delegates to store selector
- Implemented `setCustomTimer()` with mid-playback timer recreation logic - updates store and recreates active timer
- Fixed test file method naming to match service API (replaced updatePlayerTimer with setCustomTimer)
- All 461 application tests passing

</details>

---

<details open>
<summary><h3>Task 2: Implement setCustomTimer Method in PlayerContextService</h3></summary>

**Purpose**: Create service method that delegates to the store updatePlayerTimer action, providing the interface layer for UI components to modify custom timer configuration.

**Related Documentation:**

- [Service Standards - Service Implementation](../../SERVICE_STANDARDS.md)
- [State Standards - Service Integration](../../STATE_STANDARDS.md#service-integration)

**Implementation Subtasks:**

- [ ] **Open player-context.service.ts** in `libs/application/src/lib/player/` folder
- [ ] **Add setCustomTimer method** with signature matching IPlayerContext interface
- [ ] **Delegate to store action**: Call `this.store.updatePlayerTimer({ deviceId, enabled, durationMs })`
- [ ] **Add logging** with LogType.Info indicating custom timer config was updated (include deviceId, enabled, durationMs)
- [ ] **No validation logic needed**: Store action handles state mutation, UI ensures valid inputs

**Testing Subtask:**

- [ ] **Write Tests**: Behavioral tests verify method updates store state (see Testing section below)

**Key Implementation Notes:**

- Simple delegation method - no complex logic or error handling
- Logging provides operational visibility for debugging
- Method is synchronous (void return) - state update happens immediately
- Consistent with existing service patterns like `toggleShuffle`, `updateShuffleSettings`

**Testing Focus for Task 2:**

**Behaviors to Test:**

- [ ] **Method delegates to store action**: Calling setCustomTimer results in store state change
- [ ] **Method updates enabled flag correctly**: setCustomTimer(deviceId, true, 180000) sets enabled to true in store
- [ ] **Method updates duration correctly**: setCustomTimer(deviceId, true, 60000) sets durationMs to 60000 in store
- [ ] **Method logs operation**: Console log shows custom timer config update with correct parameters

**Testing Reference:**

- See [Testing Standards](../../TESTING_STANDARDS.md) for service testing guidance

</details>

---

<details open>
<summary><h3>Task 3: Implement getCustomTimerConfig Method in PlayerContextService</h3></summary>

**Purpose**: Expose custom timer configuration state through the service layer as a computed signal, allowing UI components to reactively read timer config.

**Related Documentation:**

- [State Standards - Computed Signals](../../STATE_STANDARDS.md#computed-signals)
- [Service Standards - State Exposure](../../SERVICE_STANDARDS.md)

**Implementation Subtasks:**

- [ ] **Add getCustomTimerConfig method** with signature matching IPlayerContext interface
- [ ] **Delegate to store selector**: Return `this.store.getPlayTimerConfig(deviceId)`
- [ ] **No logging needed**: Read-only operation, selector handles state access

**Testing Subtask:**

- [ ] **Write Tests**: Behavioral tests verify method returns correct config (see Testing section below)

**Key Implementation Notes:**

- Direct delegation to store selector - no transformation or additional logic
- Returns Signal<PlayTimerConfig | null> for reactive data flow
- Consistent with existing patterns like `getTimerState(deviceId)`, `getCurrentFile(deviceId)`
- Null return when deviceId doesn't exist (handled by store selector)

**Testing Focus for Task 3:**

**Behaviors to Test:**

- [ ] **Method returns initial config**: After device initialization, getCustomTimerConfig returns default config
- [ ] **Method updates reactively**: After setCustomTimer call, getCustomTimerConfig signal emits new values
- [ ] **Method returns null for invalid device**: Calling getCustomTimerConfig with non-existent deviceId returns null signal

**Testing Reference:**

- See [Testing Standards](../../TESTING_STANDARDS.md) for selector method testing

</details>

---

<details open>
<summary><h3>Task 4: Verify Timer Setup Coordination with Custom Config</h3></summary>

**Purpose**: Ensure the setupTimerForFile method (updated in Phase 1) correctly coordinates with custom timer configuration through the service layer, validating the integration between state and service.

**Related Documentation:**

- [Phase 1 - Task 3](./CUSTOM_PLAY_TIMER_P1.md#task-3-update-timer-setup-logic-in-playercontextservice) - setupTimerForFile changes
- [Custom Play Timer Plan - Integration Points](./CUSTOM_PLAY_TIMER_PLAN.md#integration-points)

**Implementation Subtasks:**

- [ ] **Review setupTimerForFile implementation** from Phase 1 (no changes needed if Phase 1 complete)
- [ ] **Verify custom timer config is read** using store selector at start of timer setup
- [ ] **Verify priority logic is correct**: Custom timer → Music metadata → No timer
- [ ] **Verify .Hex file exclusion works** regardless of custom timer state
- [ ] **Verify logging is comprehensive** showing which timer source is used (custom vs metadata)

**Testing Subtask:**

- [ ] **Write Tests**: Integration tests verify service coordinates timer setup correctly (see Testing section below)

**Key Implementation Notes:**

- This task is verification/validation - primary implementation was Phase 1
- Integration testing ensures service layer properly coordinates state with timer manager
- Focus on end-to-end workflows: set custom timer → launch file → verify timer created with correct duration
- Tests cover all file type scenarios with custom timer enabled/disabled

**Testing Focus for Task 4:**

**Behaviors to Test:**

- [ ] **Custom timer with game file workflow**: setCustomTimer(enabled=true, 30s) → launch game → timer created with 30s duration
- [ ] **Custom timer with image file workflow**: setCustomTimer(enabled=true, 10s) → launch image → timer created with 10s duration
- [ ] **Custom timer overrides music metadata**: setCustomTimer(enabled=true, 60s) → launch music (3:45 metadata) → timer created with 60s duration
- [ ] **Disabled custom timer preserves music behavior**: setCustomTimer(enabled=false) → launch music (3:45) → timer created with 3:45 duration
- [ ] **Custom timer respects .Hex exclusion**: setCustomTimer(enabled=true, 30s) → launch .Hex file → no timer created
- [ ] **Custom timer state persists across file launches**: setCustomTimer(enabled=true, 15s) → launch file → next() → new file uses 15s timer

**Testing Reference:**

- See [Testing Standards](../../TESTING_STANDARDS.md) for integration testing patterns
- See [Player Context Service Tests](../../libs/application/src/lib/player/player-context.service.spec.ts) for timer workflow test examples

</details>

---

<details open>
<summary><h3>Task 5: Handle Timer Control During Playback (Mid-Session Changes)</h3></summary>

**Purpose**: Implement the behavior for when custom timer settings change during playback, ensuring changes take effect immediately by recreating the timer with the new configuration.

**Related Documentation:**

- [Custom Play Timer Plan - User Scenario 13](./CUSTOM_PLAY_TIMER_PLAN.md#scenario-13-change-duration-during-session)
- [Player Timer Manager API](../../../libs/application/src/lib/player/player-timer-manager.ts) - createTimer() destroys and recreates timers

**Implementation Subtasks:**

- [ ] **Add timer recreation logic to setCustomTimer**: After updating store state, check if a file is currently playing with a timer
- [ ] **Get current file**: Use `this.store.getCurrentFile(deviceId)()` to check if file is playing
- [ ] **Check if timer is active**: Use `this.store.getTimerState(deviceId)()` to verify timer exists
- [ ] **Recreate timer if active**: If file is playing and timer exists, call `this.setupTimerForFile(deviceId, currentFile.file)` to restart timer with new config
- [ ] **Document behavior in JSDoc**: Add comment to setCustomTimer explaining changes take effect immediately for currently playing files
- [ ] **Add logging**: Log when timer is recreated mid-playback with new duration

**Testing Subtask:**

- [ ] **Write Tests**: Behavioral tests verify mid-playback changes recreate timer immediately (see Testing section below)

**Key Implementation Notes:**

- Immediate timer recreation provides better UX - users see changes take effect right away
- `PlayerTimerManager.createTimer()` automatically destroys existing timer before creating new one (line 30-31 of player-timer-manager.ts)
- Timer recreation resets `currentTime` to 0 with new `totalTime` - acceptable behavior for duration changes
- If user disables timer mid-playback, timer is destroyed immediately (no timer for current file)
- setupTimerForFile handles all timer logic (custom config check, .Hex exclusion, music metadata fallback)

**Implementation Pattern:**

```typescript
setCustomTimer(deviceId: string, enabled: boolean, durationMs: number): void {
  // Update store state
  this.store.updatePlayerTimer({ deviceId, enabled, durationMs });
  
  // Get current file and timer state
  const currentFile = this.store.getCurrentFile(deviceId)();
  const timerState = this.store.getTimerState(deviceId)();
  
  // Recreate timer if file is playing with a timer
  if (currentFile?.file && timerState) {
    logInfo(LogType.Info, `Recreating timer mid-playback for device ${deviceId} with new config`);
    this.setupTimerForFile(deviceId, currentFile.file);
  }
}
```

**Testing Focus for Task 5:**

**Behaviors to Test:**

- [ ] **Changing duration mid-playback restarts timer**: Launch file with custom timer (30s) → wait 10s → setCustomTimer(60s) → timer restarts at 0s with 60s total
- [ ] **Disabling custom timer mid-playback destroys timer**: Launch file with custom timer (30s) → wait 10s → setCustomTimer(enabled=false) → timer destroyed, no timer visible
- [ ] **Enabling custom timer mid-playback creates timer**: Launch game (no timer) → wait 5s → setCustomTimer(enabled=true, 30s) → timer created with 30s duration
- [ ] **Timer recreation preserves play status**: Launch file with custom timer (30s) → wait 10s → setCustomTimer(60s) → file continues playing, status unchanged
- [ ] **No timer recreation when no file playing**: setCustomTimer(60s) with no file playing → no errors, state updated only
- [ ] **Timer recreation works with music files**: Launch music (3:45 metadata) → custom timer enabled (60s) → timer recreated with 60s, overriding metadata

**Testing Reference:**

- See [Testing Standards](../../TESTING_STANDARDS.md) for state persistence testing patterns

</details>

---

## 🗂️ Files Modified or Created

**New Files:**

- None (Phase 2 only modifies existing files)

**Modified Files:**

- `libs/application/src/lib/player/player-context.interface.ts`
- `libs/application/src/lib/player/player-context.service.ts`
- `libs/application/src/lib/player/player-context-playTimer.service.spec.ts`

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
# Run player context service tests
npx nx test application

# Run tests in watch mode during development
npx nx test application --watch

# Run all tests
npx nx run-many --target=test --all
```

### Testing Approach

**Behavioral Testing**: All tests focus on observable outcomes through the service API - what consumers (UI components) will observe.

**Test Organization**:

- Task 1: Interface method availability tests (in player-context-playTimer.service.spec.ts)
- Task 2: setCustomTimer delegation tests (in player-context-playTimer.service.spec.ts)
- Task 3: getCustomTimerConfig selector tests (in player-context-playTimer.service.spec.ts)
- Task 4: Timer setup coordination integration tests (in player-context-playTimer.service.spec.ts - new section)
- Task 5: Mid-playback change behavior tests (in player-context-playTimer.service.spec.ts - new section)

**Key Test Patterns**:

```typescript
// Example behavioral test for Task 2
it('should enable custom timer through service method', () => {
  const deviceId = 'device-1';
  service.initializePlayer(deviceId);

  // Act - call service method
  service.setCustomTimer(deviceId, true, 60000);

  // Assert - verify observable outcome through service API
  const config = service.getCustomTimerConfig(deviceId)();
  expect(config?.enabled).toBe(true);
  expect(config?.durationMs).toBe(60000);
});

// Example integration test for Task 4
it('should create timer with custom duration for game file', async () => {
  const deviceId = 'device-1';
  const gameFile = createTestFileItem({ type: FileItemType.Game });
  
  service.initializePlayer(deviceId);
  service.setCustomTimer(deviceId, true, 30000);

  // Act - launch game file
  await service.launchFileWithContext({
    deviceId,
    storageType: StorageType.Usb,
    file: gameFile,
    files: [gameFile],
  });

  await nextTick();
  await waitForTime(200);

  // Assert - verify timer created with custom duration
  const timerState = service.getTimerState(deviceId)();
  expect(timerState).not.toBeNull();
  expect(timerState?.totalTime).toBe(30000);
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
- [ ] Service implementation follows [Service Standards](../../SERVICE_STANDARDS.md)

**Testing Requirements:**

- [ ] All testing subtasks completed within each task
- [ ] All behavioral test checkboxes verified
- [ ] Tests written alongside implementation (not deferred)
- [ ] All tests passing with no failures
- [ ] Test coverage includes all timer coordination scenarios (game files, image files, music override, mid-playback changes)

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes with no errors (`npm run lint`)
- [ ] Code formatting is consistent
- [ ] No console errors in browser/terminal when running application

**Documentation:**

- [ ] JSDoc comments added for IPlayerContext custom timer methods
- [ ] Mid-playback behavior documented in setCustomTimer JSDoc

**Ready for Next Phase:**

- [ ] All success criteria met
- [ ] No known bugs or issues
- [ ] Custom timer can be enabled/disabled through service API
- [ ] Timer setup correctly uses custom timer configuration
- [ ] Mid-playback changes recreate timer immediately with new duration
- [ ] Ready to proceed to Phase 3 (UI Components & Toolbar Integration)

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Design Decisions

- **Decision: setCustomTimer is void (synchronous)**: Matches existing service method patterns (toggleShuffle, updateShuffleSettings). State update is immediate, no async coordination needed.

- **Decision: getCustomTimerConfig returns Signal**: Consistent with getTimerState and getCurrentFile patterns. Enables reactive data flow in UI components.

- **Decision: Mid-playback changes recreate timer immediately**: Provides better UX - users see timer changes instantly. PlayerTimerManager.createTimer() automatically destroys existing timer, making recreation safe and clean. Timer resets to 0 with new duration (acceptable trade-off for immediate feedback).

### Implementation Constraints

- **Constraint: Service layer is coordination only**: Service methods delegate to store actions/selectors. No complex business logic or state management in service layer.

- **Constraint: No validation in service layer**: UI components ensure valid inputs (durationMs > 0, enabled is boolean). Service trusts inputs and delegates to store.

- **Constraint: Timer recreation resets currentTime**: When timer is recreated mid-playback, currentTime resets to 0. This is acceptable because user is changing duration intentionally - they want a fresh timer with the new settings.

### Open Questions Resolved

**Phase 2 - Question 1: Timer Control during Playback**
- **Resolution**: Changed to Option A - Changes take effect immediately by recreating timer
- **Rationale**: Better UX with immediate feedback. PlayerTimerManager.createTimer() safely destroys existing timer before creating new one. Timer reset to 0 with new duration is acceptable trade-off for instant updates. Users changing duration mid-playback expect to see changes immediately.

### Future Enhancements

- **Timer resume from currentTime**: When recreating timer mid-playback, preserve currentTime instead of resetting to 0 (would require timer manager API enhancement)
- **Custom timer pause/resume**: Extend timer controls to support pausing/resuming custom timers independently
- **Timer speed control**: Integrate custom timer with playback speed controls (1x, 1.5x, 2x speeds)

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

- **Discovery 1**: PlayerTimerManager.createTimer() already handles cleanup - calls destroyTimer() before creating new timer (line 30-31), making timer recreation safe
- **Discovery 2**: setupTimerForFile can be safely called mid-playback - it follows same logic path as initial file launch, respecting custom timer config
- **Discovery 3**: Timer recreation resets currentTime to 0, but this is acceptable UX - users changing duration expect a "fresh start" with new settings

</details>

---

## 💡 Phase 2 Quick Reference

**What This Phase Delivers:**

- IPlayerContext interface extended with custom timer methods
- PlayerContextService implements setCustomTimer and getCustomTimerConfig methods
- Service layer coordinates timer setup with custom timer configuration
- Mid-playback timer config changes recreate timer immediately with new settings
- Complete behavioral test coverage for service integration

**Integration Points:**

- IPlayerContext contract exposes custom timer API to UI layer
- PlayerContextService delegates to store actions and selectors
- Timer setup coordination verified through integration tests
- Service methods follow existing patterns (void setters, Signal getters)

**Key Testing Focus:**

- Service methods delegate correctly to store
- Timer setup uses custom config for all file types
- Custom timer overrides music metadata when enabled
- Mid-playback changes recreate timer immediately with new duration
- Timer recreation resets currentTime to 0 (expected behavior)
- State changes are observable through service API

**Next Phase Preview:**

Phase 3 will create UI components (play timer button, duration dropdown) and integrate them into the player toolbar, providing users with intuitive controls for enabling custom timers and selecting durations. Users will see timer changes take effect immediately when adjusting settings during playback.
