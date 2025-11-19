# Phase 1: State Management & Core Timer Logic

## 🎯 Objective

Establish the state structure and core logic for custom play timers by adding timer configuration state to the player store, implementing store actions for managing timer settings, and updating the timer setup logic to respect custom timer configurations. This phase creates a fully functional backend system that can enable/disable custom timers and apply user-specified durations, validated through behavioral tests.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Custom Play Timer Feature Plan](./CUSTOM_PLAY_TIMER_PLAN.md) - High-level feature plan with user scenarios
- [ ] [Phase 1 Open Questions](./CUSTOM_PLAY_TIMER_PLAN.md#open-questions-for-phase-1) - Review decision recommendations

**Standards & Guidelines:**

- [ ] [Coding Standards](../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [State Standards](../../STATE_STANDARDS.md) - NgRx Signal Store patterns and state management
- [ ] [Store Testing Guide](../../STORE_TESTING.md) - Store-specific testing patterns

---

## 📂 File Structure Overview

```
libs/application/src/lib/player/
├── player-store.ts                          📝 Modified - Add PlayTimerConfig to DevicePlayerState
├── player-context.service.ts                📝 Modified - Update setupTimerForFile to check custom timer config
├── actions/
│   ├── index.ts                             📝 Modified - Export new update-player-timer action
│   └── update-player-timer.ts               ✨ New - Action to toggle/update custom timer config
└── player-context-playTimer.service.spec.ts 📝 Modified - Add behavioral tests for custom timer logic
```

---

<details open>
<summary><h3>Task 1: Define PlayTimerConfig State Model</h3></summary>

**Purpose**: Create the state model structure that will hold custom timer configuration (enabled flag and duration value) as a property on DevicePlayerState.

**Related Documentation:**

- [State Standards - State Structure Organization](../../STATE_STANDARDS.md#state-structure-organization)
- [Coding Standards - Type Definitions](../../CODING_STANDARDS.md)

**Implementation Subtasks:**

- [ ] **Add PlayTimerConfig interface** to `libs/application/src/lib/player/player-store.ts` with two properties: `enabled: boolean` and `durationMs: number`
- [ ] **Add playTimerConfig property** to `DevicePlayerState` interface with type `PlayTimerConfig`
- [ ] **Update initialState** in `PlayerStore` to include default `playTimerConfig: { enabled: false, durationMs: 180000 }` (3 minutes default, disabled)
- [ ] **Update initializePlayer action** to set default playTimerConfig when creating new device player state

**Testing Subtask:**

- [ ] **Write Tests**: Behavioral tests verify PlayTimerConfig initializes correctly (see Testing section below)

**Key Implementation Notes:**

- Duration stored in milliseconds for consistency with existing timer infrastructure (e.g., 180000ms = 3 minutes)
- Default state: disabled with 3-minute duration matches existing music timer default
- PlayTimerConfig is a simple value object with no computed properties or methods

**Critical Type Structure**:

```typescript
export interface PlayTimerConfig {
  enabled: boolean;
  durationMs: number;
}

export interface DevicePlayerState {
  // ... existing properties
  playTimerConfig: PlayTimerConfig;
  // ... rest of properties
}
```

**Testing Focus for Task 1:**

> Focus on **behavioral testing** - what observable outcomes occur?

**Behaviors to Test:**

- [ ] **PlayTimerConfig initializes with correct defaults**: When device player is created, playTimerConfig.enabled is false and durationMs is 180000
- [ ] **PlayTimerConfig persists in state**: After initialization, playTimerConfig property exists on DevicePlayerState and is accessible via store

**Testing Reference:**

- See [Testing Standards](../../TESTING_STANDARDS.md) for behavioral testing patterns
- See [Store Testing](../../STORE_TESTING.md) for store state verification patterns

</details>

---

<details open>
<summary><h3>Task 2: Implement update-player-timer Action</h3></summary>

**Purpose**: Create a store action that allows toggling the custom timer enabled state and updating the duration value, using the standard action pattern with updateState and actionMessage.

**Related Documentation:**

- [State Standards - Action Pattern](../../STATE_STANDARDS.md#function-organization)
- [State Standards - updateState Requirement](../../STATE_STANDARDS.md#use-updatestate-with-actionmessage-for-all-state-mutations)
- [State Standards - Action File Structure](../../STATE_STANDARDS.md#function-file-structure)

**Implementation Subtasks:**

- [ ] **Create update-player-timer.ts** in `libs/application/src/lib/player/actions/` folder
- [ ] **Import dependencies**: `updateState` from `@angular-architects/ngrx-toolkit`, `createAction` from `@teensyrom-nx/utils`, WritableStore type
- [ ] **Define updatePlayerTimer function** that accepts `store: WritableStore<PlayerState>` parameter
- [ ] **Return object with updatePlayerTimer method** accepting params: `{ deviceId: string, enabled: boolean, durationMs: number }`
- [ ] **Create actionMessage** using `createAction('update-player-timer')` at start of method
- [ ] **Use updateState with actionMessage** to update `players[deviceId].playTimerConfig` properties
- [ ] **Add logging** with LogType.Info when timer config is updated (include deviceId, enabled, durationMs)
- [ ] **Export updatePlayerTimer** from actions/index.ts
- [ ] **Add action to withPlayerActions** custom feature in actions/index.ts

**Testing Subtask:**

- [ ] **Write Tests**: Behavioral tests verify action updates state correctly (see Testing section below)

**Key Implementation Notes:**

- Must use `updateState` with `actionMessage` parameter (not `patchState`) per STATE_STANDARDS.md critical requirement
- Action message format: `'update-player-timer [randomNumber]'` for Redux DevTools tracking
- Preserve immutability - create new playTimerConfig object when updating
- No validation logic needed - UI layer ensures valid inputs (durationMs > 0, enabled is boolean)

**Testing Focus for Task 2:**

**Behaviors to Test:**

- [ ] **Action updates enabled flag**: Calling updatePlayerTimer with enabled=true sets playTimerConfig.enabled to true
- [ ] **Action updates duration**: Calling updatePlayerTimer with durationMs=30000 sets playTimerConfig.durationMs to 30000
- [ ] **Action updates both properties**: Calling updatePlayerTimer with enabled=true and durationMs=60000 updates both values simultaneously
- [ ] **Action preserves other state**: Updating playTimerConfig does not modify currentFile, status, or other DevicePlayerState properties

**Testing Reference:**

- See [Store Testing](../../STORE_TESTING.md) for action testing patterns

</details>

---

<details open>
<summary><h3>Task 3: Update Timer Setup Logic in PlayerContextService</h3></summary>

**Purpose**: Modify the setupTimerForFile method to check custom timer configuration before using file metadata, enabling any file type (except .Hex) to have a timer when custom timer is enabled.

**Related Documentation:**

- [Custom Play Timer Plan - Timer Priority Logic](./CUSTOM_PLAY_TIMER_PLAN.md#key-design-decisions)
- [State Standards - Service Integration](../../STATE_STANDARDS.md#service-integration)

**Implementation Subtasks:**

- [ ] **Locate setupTimerForFile method** in `libs/application/src/lib/player/player-context.service.ts` (line ~397)
- [ ] **Read playTimerConfig state** at start of method using `this.store.getPlayTimerConfig(deviceId)()`
- [ ] **Check if custom timer is enabled**: If `playTimerConfig.enabled === true`, use `playTimerConfig.durationMs` as totalTime
- [ ] **Update file type check**: Change from `if (file.type !== FileItemType.Song)` to include custom timer logic
- [ ] **Add .Hex file exclusion**: If `file.extension === '.Hex'`, skip timer setup regardless of custom timer state
- [ ] **Update logging**: Add log statements showing whether custom timer or metadata timer is being used
- [ ] **Preserve existing metadata logic**: If custom timer disabled and file is music, continue using parsePlayLength with metadata

**Testing Subtask:**

- [ ] **Write Tests**: Behavioral tests verify timer setup respects custom timer config (see Testing section below).  
  - Add this to a new test file player-context-playTimer.service.spec.ts.  
  - You can follow the pattern similar to the other tests for the player context service.

**Key Implementation Notes:**

- Priority order: (1) .Hex files = no timer, (2) Custom timer enabled = use durationMs, (3) Music file = use metadata, (4) Other files = no timer
- Do NOT modify timer manager, timer service, or auto-progression logic - only change timer setup decision logic
- Preserve backward compatibility: when custom timer disabled, behavior is identical to current implementation
- Add selector method to PlayerStore if needed: `getPlayTimerConfig(deviceId: string)` returning `Signal<PlayTimerConfig>`

**Testing Focus for Task 3:**

**Behaviors to Test:**

- [ ] **Custom timer overrides metadata for music**: When custom timer enabled with 30s duration, music file with 3:45 metadata uses 30s timer
- [ ] **Custom timer enables game file timers**: When custom timer enabled with 60s duration, game file (.prg) creates timer with 60s
- [ ] **Custom timer enables image file timers**: When custom timer enabled with 10s duration, image file (.png) creates timer with 10s
- [ ] **Custom timer respects .Hex exclusion**: When custom timer enabled, .Hex file launch still has no timer
- [ ] **Disabled custom timer preserves existing behavior**: When custom timer disabled, music files use metadata and game/image files have no timer
- [ ] **Custom timer state changes mid-session**: Enabling custom timer after launching a non-timer file, then navigating to next file, creates timer with custom duration

**Testing Reference:**

- See [Testing Standards](../../TESTING_STANDARDS.md) for behavioral testing guidance
- See [Player Context Service Tests](../../libs/application/src/lib/player/player-context.service.spec.ts) for existing timer test patterns

</details>

---

<details open>
<summary><h3>Task 4: Add getPlayTimerConfig Selector</h3></summary>

**Purpose**: Expose custom timer configuration through a computed selector signal so components can reactively read timer config state.

**Related Documentation:**

- [State Standards - Computed Signals](../../STATE_STANDARDS.md#computed-signals)
- [State Standards - Selectors Pattern](../../STATE_STANDARDS.md#selectors-and-actions-pattern)

**Implementation Subtasks:**

- [ ] **Create get-play-timer-config.ts** in `libs/application/src/lib/player/selectors/` folder
- [ ] **Define getPlayTimerConfig function** that accepts `store: WritableStore<PlayerState>` parameter
- [ ] **Return object with getPlayTimerConfig method** accepting `deviceId: string` parameter
- [ ] **Return computed signal** that reads `store.players()[deviceId]?.playTimerConfig ?? null`
- [ ] **Export getPlayTimerConfig** from selectors/index.ts
- [ ] **Add selector to withPlayerSelectors** custom feature in selectors/index.ts

**Testing Subtask:**

- [ ] **Write Tests**: Behavioral tests verify selector returns correct config (see Testing section below)

**Key Implementation Notes:**

- Selector is read-only - no state mutations
- Return null if deviceId doesn't exist in players record (defensive programming)
- Use computed() for reactive signal that updates when playTimerConfig changes
- Pattern matches existing selectors like `getCurrentFile(deviceId)` and `getTimerState(deviceId)`

**Testing Focus for Task 4:**

**Behaviors to Test:**

- [ ] **Selector returns initial config**: After device initialization, getPlayTimerConfig returns { enabled: false, durationMs: 180000 }
- [ ] **Selector updates reactively**: After calling updatePlayerTimer action, getPlayTimerConfig reflects new values
- [ ] **Selector returns null for non-existent device**: Calling getPlayTimerConfig with invalid deviceId returns null

**Testing Reference:**

- See [Store Testing](../../STORE_TESTING.md) for selector testing patterns

</details>

---

## 🗂️ Files Modified or Created

**New Files:**

- `libs/application/src/lib/player/actions/update-player-timer.ts`
- `libs/application/src/lib/player/selectors/get-play-timer-config.ts`

**Modified Files:**

- `libs/application/src/lib/player/player-store.ts`
- `libs/application/src/lib/player/actions/index.ts`
- `libs/application/src/lib/player/selectors/index.ts`
- `libs/application/src/lib/player/player-context.service.ts`
- `libs/application/src/lib/player/player-context.service.spec.ts`

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

> **IMPORTANT:** Tests are written **within each task above**, not here. This section is only a summary for quick reference.

### Where Tests Are Written

**Tests are embedded in each task above** with:

- **Testing Subtask**: Checkbox in the task's subtask list (e.g., "Write Tests: Behavioral tests verify...")
- **Testing Focus**: "Behaviors to Test" section listing observable outcomes
- **Testing Reference**: Links to relevant testing documentation

**Complete each task's testing subtask before moving to the next task.**

### Test Execution Commands

**Running Tests:**

```bash
# Run player store and context service tests
npx nx test application

# Run tests in watch mode during development
npx nx test application --watch

# Run all tests
npx nx run-many --target=test --all
```

### Testing Approach

**Behavioral Testing**: All tests focus on observable outcomes - what the user/consumer can observe, not implementation details.

**Test Organization**:

- Task 1: PlayTimerConfig state initialization tests (in player-store.spec.ts if created, or player-context.service.spec.ts)
- Task 2: updatePlayerTimer action tests (in player-context.service.spec.ts - behavioral integration test)
- Task 3: Timer setup logic tests with custom timer scenarios (in player-context.service.spec.ts - existing timer tests section)
- Task 4: getPlayTimerConfig selector tests (in player-context.service.spec.ts - selectors section)

**Key Test Pattern**:

```typescript
// Example behavioral test for Task 2
it('should enable custom timer and update duration', async () => {
  const deviceId = 'device-1';
  service.initializePlayer(deviceId);

  // Act - call the action through the service
  await store.updatePlayerTimer({ deviceId, enabled: true, durationMs: 30000 });

  // Assert - verify observable outcome
  const config = store.getPlayTimerConfig(deviceId)();
  expect(config).not.toBeNull();
  expect(config?.enabled).toBe(true);
  expect(config?.durationMs).toBe(30000);
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
- [ ] State management follows [State Standards](../../STATE_STANDARDS.md)

**Testing Requirements:**

- [ ] All testing subtasks completed within each task
- [ ] All behavioral test checkboxes verified
- [ ] Tests written alongside implementation (not deferred)
- [ ] All tests passing with no failures
- [ ] Test coverage includes all timer setup scenarios (music override, game files, image files, .Hex exclusion)

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes with no errors (`npm run lint`)
- [ ] Code formatting is consistent
- [ ] No console errors in browser/terminal when running application

**Documentation:**

- [ ] Inline code comments added for timer priority logic in setupTimerForFile
- [ ] JSDoc comments added for PlayTimerConfig interface

**Ready for Next Phase:**

- [ ] All success criteria met
- [ ] No known bugs or issues
- [ ] Custom timer state can be toggled and duration updated via store action
- [ ] Timer setup logic respects custom timer configuration correctly
- [ ] Ready to proceed to Phase 2 (Player Context Service Integration)

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Design Decisions

- **Decision: PlayTimerConfig as property on DevicePlayerState**: Co-located with other player state (currentFile, timerState) for logical grouping and easy access. Alternative of separate timer config store was rejected due to added complexity without clear benefit.

- **Decision: Duration stored in milliseconds**: Consistent with existing timer infrastructure (totalTime, currentTime all in ms). UI layer will convert to/from user-friendly formats (seconds, minutes).

- **Decision: Default disabled with 3-minute duration**: Matches recommendation from Open Question 1 in planning doc. Custom timer is opt-in feature, preventing unexpected auto-progression for users. 3 minutes matches existing music timer default.

### Implementation Constraints

- **Constraint: No timer manager changes**: Existing timer manager, timer service, and auto-progression logic remain unchanged. Custom timer integrates by changing timer setup decision logic only.

- **Constraint: .Hex file exclusion preserved**: .Hex files must remain incompatible with timers regardless of custom timer state (existing system constraint).

### Open Questions Resolved

**Phase 1 - Question 1: Default Timer State**
- **Resolution**: Option A selected - Disabled by default
- **Rationale**: Custom timers are power-user feature for specific use cases. Starting disabled keeps UI predictable and prevents unexpected auto-progression.

**Phase 1 - Question 2: Duration Persistence**
- **Resolution**: Option A selected - Duration persists across file launches
- **Rationale**: If user sets 30 seconds for demo reel, they likely want that duration for entire session. Resetting forces unnecessary re-configuration.

### Future Enhancements

- **Per-file-type duration defaults**: Remember different default durations for games vs images (e.g., 10s for games, 30s for images)
- **Timer profiles**: Save named configurations like "Demo Reel - 10s" or "Slideshow - 30s"
- **Global default setting**: Add custom timer default configuration in settings view

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

- **Discovery 1**: [Something learned during implementation that affects approach]
- **Discovery 2**: [Unexpected complexity or simplification found]

</details>

---

## 💡 Phase 1 Quick Reference

**What This Phase Delivers:**

- PlayTimerConfig state model integrated into player state
- update-player-timer action for toggling/updating timer configuration
- Timer setup logic respects custom timer configuration
- Selector for reading custom timer config state
- Complete behavioral test coverage for all timer scenarios

**Integration Points:**

- PlayerStore state structure extended with playTimerConfig
- PlayerContextService setupTimerForFile method updated with custom timer logic
- Store actions and selectors expose timer config to higher layers

**Key Testing Focus:**

- Custom timer overrides music metadata when enabled
- Custom timer enables timers for game and image files
- Custom timer respects .Hex file exclusion
- Disabled custom timer preserves existing behavior
- State updates are immutable and traceable in Redux DevTools

**Next Phase Preview:**

Phase 2 will integrate custom timer configuration with the player context service layer, exposing methods for the UI to interact with timer settings through the IPlayerContext interface contract.
