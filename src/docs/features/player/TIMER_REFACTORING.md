# Timer Architecture Refactoring: Remove Store Pollution

## 🎯 Objective

Refactor the player timer implementation to eliminate unnecessary store pollution by converting timer state from store-managed signals to direct observable-to-signal conversion. This improves performance by preventing 100ms timer updates from triggering change detection across all player store consumers, while preserving the existing `IPlayerContext` contract so components remain completely unaware of internal changes.

**User-Facing Impact**: Improved UI performance with targeted change detection - only components consuming timer state will react to 100ms updates instead of all components watching player state.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Architecture Context:**

- [ ] [Overview Context](../../OVERVIEW_CONTEXT.md) - Clean Architecture layers and dependency rules
- [ ] [State Standards](../../STATE_STANDARDS.md) - NgRx Signal Store patterns and best practices
- [ ] [Store Testing](../../STORE_TESTING.md) - Testing patterns for store state and reducers

**Testing Standards:**

- [ ] [Testing Standards](../../TESTING_STANDARDS.md) - Behavioral testing approach and patterns
- [ ] [Coding Standards](../../CODING_STANDARDS.md) - General coding patterns and conventions

**Related Documentation:**

- [ ] Current file: `libs/application/src/lib/player/player-context.service.ts` - Implementation to refactor
- [ ] Current file: `libs/application/src/lib/player/player-store.ts` - Store to simplify
- [ ] Current file: `libs/application/src/lib/player/player-timer-manager.ts` - Observable source

---

## 🔍 Problem Analysis

### Current Architecture Issues

**Flow Problem:**
```
TimerService (100ms tick) 
  → PlayerTimerManager emits TimerState 
  → PlayerContextService subscribes 
  → Calls store.updateTimerState() 
  → Store mutation triggers signal updates 
  → ALL components watching player state recompute 
  → Progress bar updates (intended) + unnecessary component re-renders (unintended)
```

**Issue 1: Store Pollution**
- Timer updates are **presentation concerns**, not application state
- Store holds `timerState: TimerState | null` alongside domain state like `currentFile`, `status`, `launchMode`
- Every 100ms update mutates store state unnecessarily

**Issue 2: Performance Overhead**
- Timer updates trigger change detection for ALL components consuming player store
- Components unrelated to timing (device list, file browser, settings) react to timer updates
- Progress bar needs updates, but shouldn't affect entire application state management

**Issue 3: Architecture Violation**
- Application layer manages domain state (current file, playback status, history)
- Timer progress is a UI presentation concern that shouldn't live in application state
- Clean Architecture separation compromised

**Issue 4: Unnecessary Complexity**
- `PlayerContextService` acts as message bus between timer manager and store
- Manual subscription management for timer updates (in addition to completion events)
- Store action `updateTimerState` exists solely to push presentation data into state

### What Needs to Change

**Internal Implementation Only:**
1. Remove `timerState` from store state interface
2. Remove `updateTimerState` action from store actions
3. Remove `getTimerState` selector from store selectors
4. Refactor `PlayerContextService.getTimerState()` to convert observable to signal directly
5. Remove timer update subscriptions (keep only completion subscriptions for auto-progression)

**Public Contract Stays Identical:**
- `IPlayerContext.getTimerState(deviceId): Signal<TimerState | null>` - unchanged signature
- All component code remains unchanged
- All other context methods unchanged

---

## 📂 File Structure Overview

```
libs/application/src/lib/player/
├── player-store.ts                          📝 Modified - Remove timerState from DevicePlayerState
├── player-context.service.ts                📝 Modified - Convert observable to signal directly
├── player-context.interface.ts              ✅ Unchanged - Contract preserved
├── actions/
│   ├── index.ts                             📝 Modified - Remove updateTimerState export
│   └── update-timer-state.ts                🗑️ Delete - No longer needed
├── selectors/
│   ├── index.ts                             📝 Modified - Remove getTimerState export
│   └── get-timer-state.ts                   🗑️ Delete - No longer needed
└── (test files)                             📝 Modified - Update mocks and expectations

libs/features/player/
└── (all component files)                    ✅ Unchanged - Components unaware of changes
```

---

<details open>
<summary><h3>Task 1: Refactor PlayerContextService Timer State Management</h3></summary>

**Purpose**: Replace store-mediated timer state with direct observable-to-signal conversion. This is the core architectural change that eliminates store pollution while preserving the existing contract.

**Related Documentation:**
- [State Standards](../../STATE_STANDARDS.md#signal-conversion) - Using `toSignal()` with observables
- [Testing Standards](../../TESTING_STANDARDS.md#behavioral-testing) - Testing observable behaviors

**Implementation Subtasks:**

- [ ] **Add Signal Cache Map**: Add `private timerSignals = new Map<string, Signal<TimerState | null>>()` property to `PlayerContextService` class
- [ ] **Add Completion Subscription Map**: Rename existing `timerSubscriptions` to `completionSubscriptions` for clarity (now only stores completion subscriptions)
- [ ] **Add RxJS Import**: Import `toSignal` from `@angular/core/rxjs-interop`
- [ ] **Refactor `getTimerState()` Method**: Replace store selector call with lazy signal creation from `PlayerTimerManager.onTimerUpdate$(deviceId)` observable using `toSignal()`
  - Use `toSignal()` with `{ initialValue: null }` option
  - Cache created signal in `timerSignals` map per device
  - Return cached signal on subsequent calls
- [ ] **Update `createAndSubscribeToTimer()` Method**: Rename to `setupTimerForFile()`, remove timer update subscription logic
  - Remove the subscription to `onTimerUpdate$()` that calls `store.updateTimerState()`
  - Keep only completion subscription for auto-progression (`onTimerComplete$()`)
  - Store completion subscription in `completionSubscriptions` map
- [ ] **Update `cleanupTimerSubscriptions()` Method**: Rename to `cleanupTimer()`, add signal cleanup
  - Call `timerManager.destroyTimer(deviceId)`
  - Remove cached signal from `timerSignals` map
  - Unsubscribe completion subscription from `completionSubscriptions` map
  - Remove the completion subscription from map
- [ ] **Update All Callers**: Update all methods calling renamed functions (`setupTimerForFile`, `cleanupTimer`)
  - `launchFileWithContext()` - calls `setupTimerForFile()`
  - `play()` - resumes timer via manager
  - `pause()` - pauses timer via manager
  - `stop()` - calls `cleanupTimer()`
  - `next()` - calls `setupTimerForFile()` after navigation
  - `previous()` - calls `setupTimerForFile()` after navigation
  - `removePlayer()` - calls `cleanupTimer()`
  - `setCustomTimer()` - calls `setupTimerForFile()` when recreating timer
- [ ] **Remove Store Import**: Remove `updateTimerState` action import (no longer used)

**Testing Subtask:**

- [ ] **Write Tests**: Test timer state management behaviors (see Testing section below)

**Key Implementation Notes:**

- Signal caching is critical - each device should reuse the same signal instance across multiple calls
- `toSignal()` automatically manages the subscription lifecycle - no manual cleanup needed for update subscriptions
- Only completion subscriptions need manual management (for auto-progression feature)
- The contract signature `getTimerState(deviceId): Signal<TimerState | null>` remains unchanged - components won't know the difference

**Critical Type Reference:**

```typescript
// Cache map type - stores signals per device
private timerSignals = new Map<string, Signal<TimerState | null>>();

// Completion subscription map - only stores completion subscriptions
private completionSubscriptions = new Map<string, Subscription>();
```

**Testing Focus for Task 1:**

> Focus on **behavioral testing** - verify observable behaviors through public API

**Behaviors to Test:**

- [ ] **Lazy Signal Creation**: `getTimerState()` creates signal on first call, reuses on subsequent calls for same device
- [ ] **Signal Updates**: Signal emits timer state updates when timer is running
- [ ] **Null State**: Signal returns null when no timer exists for device
- [ ] **Multiple Devices**: Different device IDs get independent signal instances
- [ ] **Cleanup**: Signal is removed from cache when timer is cleaned up
- [ ] **Completion Event**: Timer completion still triggers auto-progression (completion subscription preserved)

**Testing Reference:**
- See [Testing Standards](../../TESTING_STANDARDS.md) for behavioral testing patterns
- See [Store Testing](../../STORE_TESTING.md) for testing service-to-observable patterns

</details>

---

<details open>
<summary><h3>Task 2: Remove Timer State from PlayerStore</h3></summary>

**Purpose**: Simplify the store by removing timer state management, which is now handled directly in `PlayerContextService`. This reduces store responsibility and eliminates unnecessary state mutations.

**Related Documentation:**
- [State Standards](../../STATE_STANDARDS.md#state-shape) - Store state interface patterns
- [Store Testing](../../STORE_TESTING.md) - Testing store state changes

**Implementation Subtasks:**

- [ ] **Remove `timerState` Property**: Remove `timerState: TimerState | null` from `DevicePlayerState` interface in `player-store.ts`
- [ ] **Remove Action Import**: Remove `updateTimerState` import from `actions/index.ts`
- [ ] **Remove Action Export**: Remove `...updateTimerState(writableStore)` from actions composition in `actions/index.ts`
- [ ] **Delete Action File**: Delete `actions/update-timer-state.ts` file entirely
- [ ] **Remove Selector Import**: Remove `getTimerState` import from `selectors/index.ts`
- [ ] **Remove Selector Export**: Remove `...getTimerState(writableStore)` from selectors composition in `selectors/index.ts`
- [ ] **Delete Selector File**: Delete `selectors/get-timer-state.ts` file entirely
- [ ] **Verify No Other References**: Search codebase for any remaining references to removed action/selector

**Testing Subtask:**

- [ ] **Write Tests**: Update store tests to reflect timer state removal (see Testing section below)

**Key Implementation Notes:**

- `playTimerConfig` (custom timer configuration with enabled/durationMs) is **domain state** and should remain in store
- Only `timerState` (currentTime/totalTime presentation data) is being removed
- Store tests should no longer expect `timerState` in device state
- No behavioral changes to store operations - just removing unused state property

**Testing Focus for Task 2:**

**Behaviors to Test:**

- [ ] **Store Initialization**: Device player state initializes without `timerState` property
- [ ] **Play Timer Config Preserved**: `playTimerConfig` still exists and functions correctly (separate concern)
- [ ] **State Shape**: Verify `DevicePlayerState` no longer includes `timerState` in type checking
- [ ] **No Action Available**: Attempting to call `updateTimerState` should result in TypeScript error (compile-time check)

**Testing Reference:**
- See [Store Testing](../../STORE_TESTING.md) for store state interface testing patterns

</details>

---

<details open>
<summary><h3>Task 3: Update Test Files and Mocks</h3></summary>

**Purpose**: Update test files to reflect the new timer state management approach. Tests should verify the new observable-to-signal behavior while ensuring existing functionality remains intact.

**Related Documentation:**
- [Testing Standards](../../TESTING_STANDARDS.md#mocking-strategies) - Mock creation and boundaries
- [Store Testing](../../STORE_TESTING.md) - Store testing patterns

**Implementation Subtasks:**

- [ ] **Update `player-context.service.spec.ts`**: Remove expectations for `store.updateTimerState()` calls
  - Remove mock setup for `updateTimerState` action
  - Verify `getTimerState()` returns signal correctly
  - Test signal caching behavior (same signal instance returned for same device)
  - Test completion subscription still triggers auto-progression
- [ ] **Update `player-context-playTimer.service.spec.ts`**: Update timer-specific test expectations
  - Remove store update expectations
  - Verify timer state flows through observable-to-signal conversion
  - Test custom timer configuration still works (separate from timer state)
- [ ] **Update Other Spec Files**: Find and update any other test files that mock timer state
  - Search for `getTimerState` mock implementations
  - Search for `updateTimerState` in test expectations
  - Update to reflect new implementation (signal from observable instead of store)
- [ ] **Update Component Test Mocks**: Update component tests that mock `IPlayerContext.getTimerState()`
  - Replace store-based mocks with signal mocks
  - Ensure mock returns `Signal<TimerState | null>` type
  - Verify component tests still pass with new implementation

**Testing Subtask:**

- [ ] **Run All Tests**: Execute full test suite and verify no failures related to timer changes

**Key Implementation Notes:**

- Component tests should remain unchanged since contract is preserved
- Service tests need to verify new signal caching behavior
- Mock complexity should reduce (no store action mocking needed)
- Focus on testing the observable-to-signal conversion correctness

**Testing Focus for Task 3:**

**Behaviors to Test:**

- [ ] **Signal Creation Test**: `getTimerState()` creates and returns signal from observable
- [ ] **Signal Caching Test**: Subsequent calls to `getTimerState()` for same device return same signal instance
- [ ] **Observable Integration Test**: Signal emits values when `PlayerTimerManager` emits timer updates
- [ ] **Cleanup Test**: Signal cache is cleared when timer is cleaned up
- [ ] **Multiple Device Test**: Different devices maintain independent signals
- [ ] **Completion Integration Test**: Timer completion still triggers `next()` for auto-progression

**Testing Reference:**
- See [Testing Standards](../../TESTING_STANDARDS.md) for behavioral testing approach
- See [Store Testing](../../STORE_TESTING.md) for service testing patterns

</details>

---

<details open>
<summary><h3>Task 4: Verification and Documentation</h3></summary>

**Purpose**: Verify the refactoring is complete, all tests pass, and the application works correctly. Document the architectural change for future reference.

**Implementation Subtasks:**

- [ ] **Run Full Test Suite**: Execute `pnpm nx test application` and verify all tests pass
- [ ] **Run Linting**: Execute `pnpm nx lint` and verify no errors
- [ ] **Manual Testing**: Start application and verify timer/progress bar functionality
  - Launch a music file and verify progress bar updates
  - Pause/resume playback and verify timer state updates correctly
  - Navigate next/previous and verify new timer is created
  - Test with multiple devices to verify independent timer management
  - Verify custom timer settings still work correctly
- [ ] **DevTools Verification**: Open Angular DevTools and verify store no longer updates every 100ms
  - Observe store state during playback
  - Confirm `timerState` property is gone from device state
  - Confirm only completion events affect store (not 100ms updates)
- [ ] **Update Architecture Docs**: Add notes to relevant documentation about this refactoring
  - Update `OVERVIEW_CONTEXT.md` if timer state is mentioned
  - Add note to this document's "Discoveries During Implementation" section with any learnings

**Testing Subtask:**

- [ ] **Performance Verification**: Measure change detection cycles before/after refactoring (optional but valuable)

**Key Implementation Notes:**

- This is a pure refactoring - application behavior should be identical before and after
- Store DevTools should show significantly less activity during playback
- Component re-renders should be reduced (only timer-consuming components update)
- Timer functionality should work exactly as before from user perspective

**Testing Focus for Task 4:**

**Behaviors to Verify:**

- [ ] **Functional Equivalence**: All timer features work identically to before refactoring
- [ ] **Performance Improvement**: Store update frequency reduced (no 100ms updates visible in DevTools)
- [ ] **No Regressions**: All existing tests pass without modification to component tests
- [ ] **Multi-Device Support**: Multiple devices with simultaneous playback work correctly
- [ ] **Custom Timer**: Custom timer configuration feature still functions correctly

</details>

---

## 🗂️ Files Modified or Created

**Modified Files:**
- `libs/application/src/lib/player/player-context.service.ts` - Refactor timer state management
- `libs/application/src/lib/player/player-store.ts` - Remove timerState from DevicePlayerState
- `libs/application/src/lib/player/actions/index.ts` - Remove updateTimerState export
- `libs/application/src/lib/player/selectors/index.ts` - Remove getTimerState export
- `libs/application/src/lib/player/player-context.service.spec.ts` - Update test expectations
- `libs/application/src/lib/player/player-context-playTimer.service.spec.ts` - Update timer tests

**Deleted Files:**
- `libs/application/src/lib/player/actions/update-timer-state.ts` - Action no longer needed
- `libs/application/src/lib/player/selectors/get-timer-state.ts` - Selector no longer needed

**Unchanged Files (Contract Preserved):**
- `libs/application/src/lib/player/player-context.interface.ts` - Public contract unchanged
- `libs/features/player/**/*.ts` - All component files unchanged
- `libs/application/src/lib/player/player-timer-manager.ts` - Observable source unchanged
- `libs/application/src/lib/player/timer.service.ts` - Core timer unchanged

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

> **IMPORTANT:** Tests are written **within each task above**, not here. This section is only a summary for quick reference.

> **Core Testing Philosophy:**
> - **Favor behavioral testing** - test observable outcomes, not implementation details
> - **Test as you go** - tests are integrated into each task, not deferred
> - **Test through public APIs** - verify contract compliance, not internals
> - **Mock at boundaries** - mock `PlayerTimerManager`, not internal signal mechanics

### Testing Strategy by Layer

**PlayerContextService (Application Layer):**
- Test through `IPlayerContext` interface (public contract)
- Mock `PlayerTimerManager` observable streams
- Verify signal creation, caching, and cleanup behaviors
- Verify completion subscription still triggers auto-progression

**PlayerStore (Application Layer):**
- Verify `timerState` property removed from state interface
- Verify `updateTimerState` action no longer available
- Verify `playTimerConfig` (domain state) still functions correctly

**Components (Presentation Layer):**
- No changes needed - contract preserved
- Verify existing tests still pass
- Mocks should return `Signal<TimerState | null>` type

### Test Execution Commands

**Running Tests:**
```bash
# Run application layer tests
pnpm nx test application

# Run tests in watch mode during development
pnpm nx test application --watch

# Run all tests across workspace
pnpm nx run-many --target=test --all

# Run linting to catch type errors
pnpm nx lint
```

### Expected Test Changes

**Tests That Should Change:**
- `player-context.service.spec.ts` - Remove `updateTimerState` expectations, add signal caching tests
- `player-context-playTimer.service.spec.ts` - Update timer state flow expectations
- Any tests mocking `getTimerState()` - Update mock implementations

**Tests That Should NOT Change:**
- Component tests - contract preserved
- `player-timer-manager.spec.ts` - Timer manager unchanged
- `timer.service.spec.ts` - Core timer unchanged

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

> **Mark checkboxes as criteria are met**. All items must be checked before phase is complete.

**Functional Requirements:**

- [ ] All implementation tasks completed and checked off
- [ ] All subtasks within each task completed
- [ ] `IPlayerContext.getTimerState()` contract signature unchanged
- [ ] Components work without modification (zero breaking changes)
- [ ] Timer state no longer exists in `PlayerStore`
- [ ] `updateTimerState` action and `getTimerState` selector deleted
- [ ] Signal caching implemented and working correctly
- [ ] Completion subscriptions preserved for auto-progression

**Testing Requirements:**

- [ ] All testing subtasks completed within each task
- [ ] All behavioral test checkboxes verified
- [ ] All tests passing (`pnpm nx test application`)
- [ ] No TypeScript errors (`pnpm nx lint`)
- [ ] Component tests unchanged and passing

**Performance Verification:**

- [ ] Store DevTools show no timer updates during playback (no 100ms mutations)
- [ ] Only completion events affect store
- [ ] Progress bar still updates correctly
- [ ] Multi-device playback works correctly with independent timers

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes with no errors
- [ ] Code formatting is consistent
- [ ] No console errors when running application
- [ ] Manual testing confirms identical user-facing behavior

**Documentation:**

- [ ] Inline comments added for signal caching logic
- [ ] JSDoc updated for refactored methods
- [ ] This plan document updated with implementation discoveries

**Architectural Compliance:**

- [ ] Clean Architecture separation restored (presentation state not in application state)
- [ ] Single Responsibility: `PlayerContextService` no longer acts as message bus
- [ ] Performance: Targeted change detection (only timer consumers react to updates)
- [ ] Maintainability: Reduced subscription management complexity

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Design Decisions

**Decision 1: Preserve Contract vs. Expose Observable**
- **Chosen**: Preserve existing `Signal<TimerState | null>` contract
- **Rationale**: Zero breaking changes, components unaware of internal refactoring, cleaner migration path
- **Alternative Considered**: Expose `Observable<TimerState | null>` directly, but would require component changes

**Decision 2: Signal Caching Strategy**
- **Chosen**: Cache signals per device in `PlayerContextService`
- **Rationale**: Ensures components get same signal instance, prevents unnecessary signal creation overhead
- **Alternative Considered**: Create new signal on each call, but wastes resources and loses referential equality

**Decision 3: Keep Completion Subscriptions**
- **Chosen**: Maintain completion subscriptions for auto-progression feature
- **Rationale**: Completion event triggers domain behavior (navigation), not just presentation
- **Note**: Update subscriptions removed (presentation), completion subscriptions preserved (domain behavior)

**Decision 4: Timer Config Stays in Store**
- **Chosen**: Keep `playTimerConfig` (enabled/durationMs) in store as domain state
- **Rationale**: Configuration is domain state (user settings), current position is presentation state
- **Distinction**: Config = what timer should do (domain), state = what timer is doing (presentation)

### Implementation Constraints

**Constraint 1: RxJS Interop Requirement**
- Requires `@angular/core/rxjs-interop` for `toSignal()` function
- Angular 16+ feature, ensure version compatibility

**Constraint 2: Signal Lifecycle Management**
- `toSignal()` creates subscription internally that's tied to injection context
- Must be called within injection context or use explicit injector parameter
- Signal cleanup is automatic when component/service is destroyed

**Constraint 3: Store State Shape**
- Removing `timerState` is not a breaking change for consumers (they access via contract)
- But it is a breaking change for store state interface (internal implementation)
- Ensure no direct store state access outside of selectors

### Future Enhancements

**Enhancement 1: Speed Control**
- When implementing speed control for DJ features, `setSpeed()` will affect `TimerService` progression
- Observable stream will automatically emit updated timer states
- Signal consumers get updates without modification

**Enhancement 2: Multiple Concurrent Timers**
- Architecture supports multiple device timers (already implemented)
- Could extend to multiple timers per device (deck A + B + crossfade timer)
- Each timer gets independent observable stream and cached signal

**Enhancement 3: Custom Update Frequencies**
- Could add throttling/debouncing to observable streams for performance
- Example: throttle to 60fps for waveform visualization (16ms intervals)
- Doesn't affect core architecture - just RxJS operators on streams

**Enhancement 4: Timer Synchronization**
- Future DJ features could sync multiple timer streams
- `combineLatest()` or custom RxJS operators on timer observables
- Signal consumers would receive synchronized updates

### Architectural Benefits Achieved

**Benefit 1: Clean Separation**
- Domain state (file, status, mode, history) in store
- Presentation state (timer progress) via direct observables
- Clear architectural boundary maintained

**Benefit 2: Performance Optimization**
- Store mutation frequency reduced from 10 times per second to event-driven
- Targeted change detection - only timer-consuming components react
- Reduced Angular zone overhead and digest cycles

**Benefit 3: Maintainability**
- Less subscription management code (no manual timer update subscriptions)
- Fewer store actions and selectors (simpler state management)
- Clearer responsibility boundaries (service manages streams, store manages state)

**Benefit 4: Extensibility**
- Observable streams easily composable with RxJS operators
- Signal caching pattern reusable for other high-frequency data
- Foundation for advanced timing features without refactoring

### External References

- [Angular toSignal() Documentation](https://angular.io/api/core/rxjs-interop/toSignal)
- [NgRx Signal Store Guide](https://ngrx.io/guide/signals)
- [Clean Architecture Principles](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

- **Discovery 1**: [Document any unexpected complexities or simplifications]
- **Discovery 2**: [Document any performance measurements or improvements observed]
- **Discovery 3**: [Document any architectural insights gained during refactoring]

</details>

---

## 💡 Implementation Summary for AI Agents

### What This Refactoring Does

**Changes Internal Implementation Only:**
1. `PlayerContextService.getTimerState()` now converts observable to signal using `toSignal()` instead of returning store signal
2. Timer state removed from `PlayerStore` (no longer part of application state)
3. Timer update subscriptions removed from `PlayerContextService` (only completion subscriptions remain)
4. Signal caching added to reuse signal instances per device

**Preserves External Contract:**
1. `IPlayerContext.getTimerState(deviceId): Signal<TimerState | null>` signature unchanged
2. All component code remains unchanged
3. Timer functionality identical from user perspective
4. All playback features work exactly the same

### Why This Approach Is Better

**Before (Problematic):**
- Timer updates flow through store → all store consumers react → unnecessary re-renders
- Application state polluted with presentation concerns
- Manual subscription management for pushing updates to store

**After (Optimal):**
- Timer updates flow directly to interested components → targeted change detection
- Clean separation: domain state in store, presentation state via observables
- Less code: no store action, no store selector, fewer subscriptions

### Implementation Approach

**Phase 1: Refactor PlayerContextService**
- Replace store selector with `toSignal(observable)` conversion
- Add signal caching for performance
- Remove timer update subscriptions (keep completion subscriptions)

**Phase 2: Clean Up Store**
- Remove `timerState` property from store state interface
- Delete `updateTimerState` action and `getTimerState` selector
- Verify no other references exist

**Phase 3: Update Tests**
- Remove store update expectations from tests
- Add signal caching behavior tests
- Verify all existing functionality still works

**Phase 4: Verify and Document**
- Manual testing of timer features
- DevTools verification (no 100ms store updates)
- Update architecture documentation

### Key Testing Focus

- **Behavioral Testing**: Test through public `IPlayerContext` API
- **Integration Testing**: Verify observable-to-signal conversion works correctly
- **Regression Testing**: Ensure all existing timer features work identically
- **Performance Verification**: Confirm store update frequency reduced

### Success Indicators

- ✅ All tests pass without component changes
- ✅ Store DevTools show no timer updates during playback
- ✅ Progress bar updates correctly and smoothly
- ✅ Multi-device playback works independently
- ✅ Performance improvement observable (fewer re-renders)
- ✅ Code is simpler (less subscription management, fewer store artifacts)
