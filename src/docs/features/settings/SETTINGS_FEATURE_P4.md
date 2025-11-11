# Phase 4: Bootstrap Integration

## 🎯 Objective

Integrate settings initialization into the application bootstrap process to ensure settings are loaded before the application becomes fully interactive. This establishes deterministic application startup with graceful error handling and default fallbacks. The bootstrap service will coordinate settings loading via the store during app initialization.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md) - High-level feature overview
- [ ] [Phase 3 Completion](./SETTINGS_FEATURE_P3.md) - Settings store (prerequisite)

**Standards & Guidelines:**

- [ ] [Bootstrap Standards](../../BOOTSTRAP.md) - Bootstrap service patterns and error handling
- [ ] [State Standards](../../STATE_STANDARDS.md) - Store integration patterns
- [ ] [Testing Standards](../../TESTING_STANDARDS.md) - Testing approaches

**Reference Implementations:**

- [ ] [AppBootstrapService](../../../libs/app/bootstrap/src/lib/app-bootstrap.service.ts) - Main bootstrap service to modify
- [ ] [DeviceBootstrapService](../../../libs/app/bootstrap/src/lib/device-bootstrap.service.ts) - Reference bootstrap pattern

---

## 📂 File Structure Overview

> Modifications to existing bootstrap service.

```
libs/app/bootstrap/src/lib/
├── app-bootstrap.service.ts                  📝 Modified - Add settings initialization
└── app-bootstrap.service.spec.ts             📝 Modified - Add settings bootstrap tests
```

---

<details open>
<summary><h3>Task 1: Add Settings Initialization to Bootstrap</h3></summary>

**Purpose**: Modify AppBootstrapService to load settings during application startup before the app becomes interactive.

**Related Documentation:**

- [Bootstrap Standards](../../BOOTSTRAP.md) - Bootstrap patterns and async initialization
- [AppBootstrapService](../../../libs/app/bootstrap/src/lib/app-bootstrap.service.ts) - Service to modify

**Implementation Subtasks:**

- [ ] **Inject SettingsStore**: Add SettingsStore to AppBootstrapService constructor
- [ ] **Create initializeSettings method**: Private async method loading settings
- [ ] **Call loadSettings action**: Trigger store action to load from backend
- [ ] **Wait for completion**: Use effect pattern to wait for isLoading signal to become false
- [ ] **Clean up effect**: Destroy effect after resolution to prevent memory leaks
- [ ] **Add to bootstrap sequence**: Call initializeSettings in bootstrap() method
- [ ] **Handle timing**: Settings should load early (before or after device initialization based on dependencies)

**Testing Subtask:**

- [ ] **Write Bootstrap Tests**: Test settings initialization during bootstrap using Vitest

**Key Implementation Notes:**

- Use effect pattern to wait for store signal changes (isLoading)
- Clean up effects with effectRef.destroy() after resolution
- Bootstrap returns Promise that resolves when settings loaded
- Settings should load early in bootstrap sequence
- Reference DeviceBootstrapService for async wait pattern
- Follow BOOTSTRAP.md patterns exactly

</details>

<details open>
<summary><h3>Task 2: Implement Graceful Error Handling</h3></summary>

**Purpose**: Add error handling for settings load failures with fallback to defaults, allowing app to continue with degraded functionality.

**Related Documentation:**

- [Bootstrap Standards - Error Handling](../../BOOTSTRAP.md#error-handling-strategies)
- [AppBootstrapService](../../../libs/app/bootstrap/src/lib/app-bootstrap.service.ts)

**Implementation Subtasks:**

- [ ] **Check error state**: After wait, check store error signal
- [ ] **Log warnings**: Log error message if settings failed to load
- [ ] **Allow continuation**: Don't throw error, let app continue with defaults
- [ ] **Optional notification**: Consider showing user notification of degraded state
- [ ] **Document behavior**: Note that default settings used on load failure

**Testing Subtask:**

- [ ] **Write Error Tests**: Test bootstrap with settings load failure using Vitest

**Key Implementation Notes:**

- Settings load failure is non-critical (app can use defaults)
- Log warnings but don't block app startup
- Store already contains default values from initial state
- Infrastructure service dispatches error alerts (don't duplicate)
- Reference BOOTSTRAP.md for error handling patterns
- Test both success and failure scenarios

</details>

<details open>
<summary><h3>Task 3: Add Bootstrap Logging</h3></summary>

**Purpose**: Add appropriate logging to track settings initialization progress for debugging.

**Related Documentation:**

- [Bootstrap Standards](../../BOOTSTRAP.md) - Logging patterns
- [Logging Standards](../../LOGGING_STANDARDS.md) - Logging best practices

**Implementation Subtasks:**

- [ ] **Log initialization start**: Info log when settings init begins
- [ ] **Log successful load**: Info log when settings loaded
- [ ] **Log errors**: Error log if settings load fails
- [ ] **Use LogType enum**: Use appropriate LogType values
- [ ] **Include context**: Add relevant context (timing, error details)

**Testing Subtask:**

- [ ] **Verify Logging**: Check logs appear in console during bootstrap

**Key Implementation Notes:**

- Use existing logging service/utilities
- Keep logs concise but informative
- Avoid excessive logging (clutters console)
- Error logs should include error details
- Follow existing bootstrap logging patterns

</details>

<details open>
<summary><h3>Task 4: Write Bootstrap Integration Tests</h3></summary>

**Purpose**: Create Vitest tests verifying settings bootstrap integration and error scenarios.

**Related Documentation:**

- [Testing Standards](../../TESTING_STANDARDS.md) - Testing approaches
- [Bootstrap Standards - Testing](../../BOOTSTRAP.md#testing-bootstrap-services)

**Implementation Subtasks:**

- [ ] **Test successful bootstrap**: Mock store with successful load
- [ ] **Test load failure**: Mock store with error, verify app continues
- [ ] **Test timing**: Verify settings load called in correct sequence
- [ ] **Mock SettingsStore**: Use TestBed to provide mock store
- [ ] **Verify wait pattern**: Ensure effect cleans up properly
- [ ] **Test integration**: Verify bootstrap completes successfully

**Testing Subtask:**

- [ ] **Run Tests**: Execute `pnpm nx test app-bootstrap --testFile=app-bootstrap.service.spec.ts`

**Key Implementation Notes:**

- Use Vitest (NOT Jasmine) for testing
- Mock SettingsStore with signal-based methods
- Test both success and failure paths
- Verify effect cleanup (no memory leaks)
- Follow existing bootstrap test patterns
- Use vi.fn() for mocking

</details>

---

## ✅ Success Criteria

> Mark these checkboxes as you validate each criterion.

- [ ] **Settings Load on Startup**: Settings loaded during application bootstrap
- [ ] **Async Wait Works**: Bootstrap waits for settings load completion
- [ ] **Effect Cleanup**: Effects destroyed after resolution (no memory leaks)
- [ ] **Error Handling**: App continues with defaults on load failure
- [ ] **Logging Added**: Appropriate logs for debugging
- [ ] **All Tests Pass**: Vitest tests verify bootstrap behavior
- [ ] **No Blocking Errors**: Settings load failure doesn't prevent app startup

---

## 🧪 Testing Summary

### Testing Approach

This phase focuses on **integration testing** of bootstrap process:

1. **Bootstrap Tests**: Verify settings initialization in bootstrap sequence
2. **Error Tests**: Test graceful degradation on load failure
3. **Timing Tests**: Verify async wait and cleanup

### Test Types by Task

| Task | Test Type | Focus |
|------|-----------|-------|
| Task 1 | Integration | Settings initialization |
| Task 2 | Integration | Error handling and fallbacks |
| Task 3 | Verification | Logging output |
| Task 4 | Integration | Full bootstrap sequence |

### Testing Framework

- **Integration Tests**: Vitest (NOT Jasmine)
- **Mocking**: TestBed providers for SettingsStore
- **Assertions**: Vitest matchers

### Key Testing Principles

- Mock store with signal-based API
- Test both success and failure scenarios
- Verify effect cleanup to prevent leaks
- Follow existing bootstrap test patterns
- Test observable outcomes (app state after bootstrap)

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

- **Previous Phase**: [Phase 3 - Settings Store (Application Layer)](./SETTINGS_FEATURE_P3.md)
- **Next Phase**: [Phase 5 - Settings View & Card Layout](./SETTINGS_FEATURE_P5.md)
- **Feature Overview**: [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md)
- **Bootstrap Standards**: [BOOTSTRAP.md](../../BOOTSTRAP.md) - **CRITICAL REFERENCE**
- **AppBootstrapService**: [App Bootstrap Service](../../../libs/app/bootstrap/src/lib/app-bootstrap.service.ts)
- **DeviceBootstrapService**: [Device Bootstrap Service](../../../libs/app/bootstrap/src/lib/device-bootstrap.service.ts)

---

_Phase Status: Ready for Implementation_
_Last Updated: 2025-01-11_
_Estimated Effort: 2-3 hours_
