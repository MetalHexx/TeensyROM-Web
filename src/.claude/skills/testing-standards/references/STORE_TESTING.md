# Application Layer Behavioral Testing

This document describes the standard methodology for testing application layer services, stores, and workflows in this repository. It promotes behavioral testing through facades and context services rather than direct store testing.

## Overview

- Test application layer behaviors through facade/context services, not stores directly.
- Allow real integration between services, stores, and utilities within the application layer.
- Mock only at the infrastructure boundary using strongly typed interface contracts.
- Focus on observable outcomes and complete workflows, not implementation details.
- Avoid testing store actions, selectors, or internal methods in isolation.

## Philosophy: Behavioral Testing vs Unit Testing

**Behavioral Testing** validates that the application layer delivers correct outcomes for user workflows and use cases. Tests should answer "does this feature work correctly?" rather than "does this store method update state correctly?"

**Why Test Facades Instead of Stores**:

- Facades represent the actual API that components consume - test what's really used.
- Store actions and selectors are implementation details that may change during refactoring.
- Behavioral tests survive refactoring better because they validate outcomes, not mechanics.
- Integration between stores, services, and utilities catches coordination bugs that unit tests miss.
- Mirrors real application usage patterns more accurately.

**Integration Scope**: Within the application layer, use real implementations. Only mock at the infrastructure boundary where external systems (HTTP, SignalR, file system) are accessed.

## Environment & Setup

- **Test Runner**: Vitest via `@nx/vite:test`
- **Environment**: jsdom for Angular TestBed support
- **Setup File**: `src/test-setup.ts` initializes Angular TestBed and Zones
- **TestBed Configuration**: Provide facade under test, real stores, mocked infrastructure services

## Mocking Strategy

**Mock at Infrastructure Boundary Only**:

Infrastructure services are defined as interface contracts in the domain layer. Mock these contracts using strongly typed mocks with Vitest's `vi.fn()`. Never mock stores, utilities, or other application layer components.

**Test Boundary Pattern**:

- **Real**: Facade/context service under test
- **Real**: Application layer stores used by the facade
- **Real**: Shared utilities and helper functions
- **Mocked**: Infrastructure services implementing domain contracts (IDeviceService, IPlayerService, IStorageService)

**Why This Boundary Matters**: The application layer exists to coordinate stores, services, and utilities into cohesive behaviors. Unit-testing individual store actions or selectors misses integration bugs — when two stores' changes must happen atomically, when timing matters, or when a workflow requires specific state sequences. Behavioral tests through the facade catch these bugs because they test the actual contract components see. Refactoring the store's internal state shape is safe because tests only assert on observable outcomes, not on whether specific actions fired or selectors computed particular values.

**Mock Setup**:

Define typed mock functions matching interface signatures. Provide mocks via injection tokens in TestBed. Control mock return values to simulate various infrastructure responses.

## Facade Testing Pattern

**Service Under Test**: Inject the facade/context service as the primary subject. The facade coordinates stores and infrastructure to deliver behaviors.

**Async Handling**: Use helper function to flush microtask queue after invoking asynchronous facade methods. This ensures all reactive updates complete before assertions.

**State Assertions**: Read state through facade signal getters. Never access store internals directly. Assert on observable outcomes visible to consuming components.

## Fixture Libraries

The project provides two complementary libraries for building mocks and test data:

### `@teensyrom-nx/testing/fixtures`

**Scope**: Low-level domain model factories and infrastructure-service mocks.

**What belongs here**: 
- Test data builders (e.g., `createTestFileItem`, `createTestStorageDirectory`) — complete, realistic domain models with sensible defaults and overridable fields
- Infrastructure service mocks (e.g., `createMockPlayerService`, `createMockStorageService`) — `Partial<IInfrastructureService>` stubs matching domain contracts
- These are reusable across layers and test files

**Examples**: `createTestFileItem`, `createMockDeviceService`, `createMockPlayerService`

### `@teensyrom-nx/testing/app-mocks`

**Scope**: Application layer mocks — facades and context services the feature layer depends on.

**What belongs here**:
- Application-layer mocks (e.g., `createMockPlayerContext`) — `Partial<IApplicationFacade>` stubs with all members stubbed to safe defaults
- Used only in feature layer tests to mock the application layer
- Kept separate from fixtures because application-layer mocks depend on application interfaces, creating a cycle if mixed with fixtures (which infrastructure and domain layers import)

**Examples**: `createMockPlayerContext`

**Important**: Never import `app-mocks` into application-layer tests — the application layer's own tests (using harnesses like `createPlayerHarness`) provide real application layer services, mocking only infrastructure. The separation enforces this: attempting to import `app-mocks` in application tests will fail the module-boundary lint rule.

## Timing Rules

**No test waits on a real wall-clock delay** — Every production delay has an injection token, and specs override it to zero. Named timing tokens in this codebase:

- `PLAYER_LAUNCH_DELAY_MS` — delay before device launch completes
- `PLAYER_INCOMPATIBLE_RETRY_DELAY_MS` — delay before retrying incompatible files
- `PLAYER_TIMER_TICK_MS` — interval for timer updates

These are injected via TestBed in harnesses (e.g., `createPlayerHarness`) and default to `0` so tests run instantly. If a test legitimately needs to exercise timing logic, override the token to the desired value.

**Fake-Timer Pattern** — When a spec uses `vi.useFakeTimers()`:

1. **Always** include `afterEach(() => vi.useRealTimers())` — unconditionally, even if the test passes. A hung spec that never restores the clock poisons every test after it in the same file because `vi.useFakeTimers()` is global.
2. **Always** use `vi.advanceTimersByTimeAsync(ms)` instead of `await somePromise`. This advances the fake clock synchronously and lets async code run, ensuring the test doesn't deadlock and cleanup runs.

```typescript
describe('RetryLogic', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers()); // Unconditional — critical

  it('retries with exponential backoff', async () => {
    const promise = service.retry();
    
    await vi.advanceTimersByTimeAsync(100); // Advance fake time
    // ... assertions ...
  });
});
```

## Behaviors to Test

Design tests around observable user workflows and feature behaviors. Focus on end-to-end outcomes rather than individual state mutations.

### 1. Feature Initialization & Lifecycle

- Feature initializes correctly for new contexts (devices, sessions, tenants)
- Re-initialization is idempotent and doesn't corrupt existing state
- Cleanup properly removes context-scoped state without affecting other contexts
- Multi-context isolation: independent state and behaviors per context key

### 2. Primary User Workflows

- Complete workflows from user action to final observable outcome
- Infrastructure calls made with correct parameters
- Success paths update state correctly and clear previous errors
- Loading states appear and clear appropriately during async operations

### 3. Error Handling & Recovery

- Infrastructure failures set observable error states without throwing
- Error states display meaningful information to consuming components
- Subsequent successful operations clear previous errors
- Failed operations leave system in consistent, recoverable state

### 4. State Transitions & Coordination

- Observable state changes match expected transitions for user actions
- Multiple coordinated updates complete atomically from component perspective
- State consistency maintained across rapid successive operations
- Workflow steps execute in correct order with proper state at each stage

### 5. Edge Cases & Boundary Conditions

- Empty or missing data handled gracefully
- Invalid inputs handled without corrupting state
- Concurrent operations resolve to consistent final state
- Operations on uninitialized or removed contexts fail safely

## Do / Don't

### Do

- Test facades/context services that components actually consume
- Use real stores and utilities within the application layer
- Mock only infrastructure services at domain contract boundaries
- Use strongly typed mocks implementing full interface contracts
- Assert on observable outcomes through facade signal getters
- Verify infrastructure calls with expected parameters
- Test complete workflows from user action to final state
- Focus on behaviors answering "does this feature work?"

### Don't

- Test store methods, actions, or selectors directly
- Mock application layer components (stores, utilities, helpers)
- Assert on internal store state or implementation details
- Test individual store methods in isolation
- Use `any` types in mocks - always strongly type mock functions
- Make real HTTP calls or access real external systems
- Test what state transitions occurred - test what outcomes are observable

## Test Organization

Structure tests by user-facing feature behaviors:

- **Initialization & Lifecycle**: Context setup, multi-context isolation, cleanup
- **Primary Workflows**: Complete user journeys from action to outcome (e.g., "launch file with context", "navigate to next file")
- **Playback Controls**: State transitions observable through user controls (play, pause, stop)
- **Navigation**: Sequential and shuffle mode behaviors, directory context loading
- **Error Handling**: Infrastructure failure scenarios and recovery
- **State Transitions**: Complex multi-step workflows and state consistency

## Quick Checklist

- [ ] TestBed setup with facade under test, real stores, mocked infrastructure services
- [ ] Strongly typed infrastructure mocks via injection tokens
- [ ] Initialization and multi-context isolation behaviors
- [ ] Primary user workflow scenarios tested end-to-end
- [ ] Error handling and recovery paths validated
- [ ] State transitions tested through observable outcomes
- [ ] Edge cases and concurrent operation handling
- [ ] All assertions via facade signals, never accessing store internals

## Reference Examples

For comprehensive examples of behavioral application layer testing following this methodology:

- [`player-context-launch.spec.ts`](../../../../libs/application/src/lib/player/player-context-launch.spec.ts) - Full facade testing with real store integration, using the `createPlayerHarness` helper
- [`player-context-harness.spec.ts`](../../../../libs/application/src/lib/player/testing/player-context-harness.spec.ts) - Demonstrates the harness setup and multi-context isolation patterns
- [`player-context-timer.spec.ts`](../../../../libs/application/src/lib/player/player-context-timer.spec.ts) - Shows fake-timer patterns and injection token overrides for timing delays
