# Phase 4: Bootstrap Integration

## 🎯 Objective

Integrate settings loading into the application bootstrap process, ensuring settings are available before any user interactions begin. This establishes settings as a first-class system concern alongside device discovery and connection management. The bootstrap service will initialize the settings store during app startup, handle errors gracefully, and ensure settings signals are ready for consumption by all features.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md) - High-level feature overview
- [ ] [Phase 3 Completion](./SETTINGS_FEATURE_P3.md) - Settings store implementation (prerequisite)

**Standards & Guidelines:**

- [ ] [Coding Standards](../../CODING_STANDARDS.md) - General coding patterns
- [ ] [Service Standards](../../SERVICE_STANDARDS.md) - Service implementation patterns
- [ ] [Testing Standards](../../TESTING_STANDARDS.md) - Testing approaches

**Reference Implementations:**

- [ ] [Device Bootstrap Service](../../../libs/app/bootstrap/src/lib/device-bootstrap.service.ts) - Similar bootstrap pattern to follow
- [ ] [App Bootstrap Service](../../../libs/app/bootstrap/src/lib/app-bootstrap.service.ts) - Main bootstrap orchestrator

---

## 📂 File Structure Overview

> Modified bootstrap service to include settings initialization.

```
libs/app/bootstrap/src/lib/
├── app-bootstrap.service.ts                  📝 Modified - Add settings store injection and initialization
└── app-bootstrap.service.spec.ts             📝 Modified - Add settings bootstrap tests
```

---

<details open>
<summary><h3>Task 1: Inject Settings Store into Bootstrap Service</h3></summary>

**Purpose**: Add the settings store as a dependency to the `AppBootstrapService` so it can trigger settings loading during application startup.

**Related Documentation:**

- [App Bootstrap Service](../../../libs/app/bootstrap/src/lib/app-bootstrap.service.ts) - Current bootstrap implementation
- [Device Bootstrap Pattern](../../../libs/app/bootstrap/src/lib/device-bootstrap.service.ts) - Similar store injection pattern
- [Service Standards - Dependency Injection](../../SERVICE_STANDARDS.md#dependency-injection) - Injection patterns

**Implementation Subtasks:**

- [ ] **Import SettingsStore**: Add import from application layer
- [ ] **Inject store**: Use `inject()` function to get store instance
- [ ] **Store reference**: Add private readonly property for store
- [ ] **Verify injection works**: Check that store is available in service

**Testing Subtask:**

- [ ] **Write Injection Tests**: Verify store is injected correctly (see Testing section)

**Key Implementation Notes:**

- Use Angular's `inject()` function for modern dependency injection
- Store is singleton (providedIn: 'root') so same instance across app
- Follow same pattern as existing device store injection in bootstrap
- No need to call store constructor - DI handles instantiation

**Injection Pattern** (reference only):

```typescript
export class AppBootstrapService {
  private readonly settingsStore = inject(SettingsStore);
  // ... other dependencies
}
```

**Testing Focus for Task 1:**

> Focus on **dependency injection** - ensure store is available in service.

**Behaviors to Test:**

- [ ] Service instantiates with settings store injected
- [ ] Store instance is defined and not null
- [ ] Store has expected methods (loadSettings, etc.)

</details>

<details open>
<summary><h3>Task 2: Call Load Settings During Bootstrap</h3></summary>

**Purpose**: Trigger the settings store's `loadSettings()` action during the bootstrap initialization process. This ensures settings are fetched from the backend before the app becomes interactive.

**Related Documentation:**

- [Settings Store - Load Action](./SETTINGS_FEATURE_P3.md#task-4-implement-load-settings-action) - Load settings action details
- [Device Bootstrap Service](../../../libs/app/bootstrap/src/lib/device-bootstrap.service.ts) - Similar initialization pattern

**Implementation Subtasks:**

- [ ] **Call loadSettings**: Invoke `settingsStore.loadSettings()` in bootstrap initialization
- [ ] **Position correctly**: Call after core services but before features need settings
- [ ] **Handle synchronously**: Don't await (store handles async internally)
- [ ] **Add logging**: Log settings initialization start for debugging

**Testing Subtask:**

- [ ] **Write Load Trigger Tests**: Verify loadSettings is called during bootstrap (see Testing section)

**Key Implementation Notes:**

- Call `loadSettings()` early in bootstrap sequence
- Method is rxMethod - calling it starts async operation
- Don't need to subscribe or await - store manages internally
- Bootstrap will wait for completion via effect pattern (Task 3)
- Consider calling after database/core services initialize

**Bootstrap Call Pattern** (reference only):

```typescript
async bootstrap(): Promise<void> {
  // ... existing initialization
  
  this.logger.info('Initializing settings...');
  this.settingsStore.loadSettings();
  
  // ... continue bootstrap
}
```

**Testing Focus for Task 2:**

> Focus on **action invocation** - ensure loadSettings is triggered.

**Behaviors to Test:**

- [ ] Bootstrap calls `settingsStore.loadSettings()`
- [ ] Load is called exactly once per bootstrap
- [ ] Load is called at appropriate point in sequence
- [ ] Logging occurs for settings initialization

</details>

<details open>
<summary><h3>Task 3: Wait for Settings Initialization</h3></summary>

**Purpose**: Use Angular's effect pattern to wait for settings to finish loading before resolving the bootstrap process. This ensures settings signals are populated before components try to access them.

**Related Documentation:**

- [Device Bootstrap Service - Effect Pattern](../../../libs/app/bootstrap/src/lib/device-bootstrap.service.ts) - Reference implementation
- [Settings Store State](./SETTINGS_FEATURE_P3.md#task-1-define-store-state-interface) - State properties to check

**Implementation Subtasks:**

- [ ] **Create effect**: Use `effect()` to watch settings loading state
- [ ] **Check isLoading**: Monitor when `isLoading` becomes false
- [ ] **Resolve promise**: Complete bootstrap when settings finish loading (success or error)
- [ ] **Cleanup effect**: Unregister effect after completion
- [ ] **Add timeout**: Consider timeout if settings take too long

**Testing Subtask:**

- [ ] **Write Initialization Wait Tests**: Test bootstrap waits for settings (see Testing section)

**Key Implementation Notes:**

- Use `effect()` to react to signal changes
- Effect watches `settingsStore.isLoading()` signal
- Resolve bootstrap when `isLoading` transitions to false
- Don't fail bootstrap on settings error (use defaults - see Task 4)
- Clean up effect to prevent memory leaks
- Follow device bootstrap service pattern exactly

**Effect Pattern** (reference only):

```typescript
private async waitForSettingsInit(): Promise<void> {
  return new Promise((resolve) => {
    const effectRef = effect(() => {
      const isLoading = this.settingsStore.isLoading();
      
      if (!isLoading) {
        effectRef.destroy();
        resolve();
      }
    });
  });
}
```

**Testing Focus for Task 3:**

> Focus on **async waiting** - ensure bootstrap pauses until settings ready.

**Behaviors to Test:**

- [ ] Bootstrap waits for settings to finish loading
- [ ] Bootstrap resolves when `isLoading` becomes false
- [ ] Effect cleans up after completion
- [ ] Promise resolves even if settings load fails
- [ ] Timeout prevents indefinite waiting (if implemented)

</details>

<details open>
<summary><h3>Task 4: Handle Settings Load Errors Gracefully</h3></summary>

**Purpose**: Implement error handling for settings load failures that allows the app to continue startup with default settings. This provides graceful degradation rather than blocking the application.

**Related Documentation:**

- [Settings Store - Error State](./SETTINGS_FEATURE_P3.md#task-1-define-store-state-interface) - Error property details
- [Service Standards - Error Handling](../../SERVICE_STANDARDS.md#error-handling) - Error handling patterns

**Implementation Subtasks:**

- [ ] **Check error state**: After load completes, check if error occurred
- [ ] **Log error**: Use logger to record settings load failure
- [ ] **Show warning**: Display non-blocking warning to user (toast or banner)
- [ ] **Continue startup**: Don't prevent app from becoming interactive
- [ ] **Verify defaults**: Confirm store uses DEFAULT_SETTINGS when load fails
- [ ] **Add retry option**: Consider allowing manual retry later

**Testing Subtask:**

- [ ] **Write Error Handling Tests**: Test bootstrap handles errors gracefully (see Testing section)

**Key Implementation Notes:**

- Settings errors should NOT block app startup
- Store automatically uses DEFAULT_SETTINGS if load fails
- Log error for debugging but don't throw exception
- User should see warning but app remains functional
- Manual retry can be added to settings UI later (Phase 9)
- Follow "fail gracefully" principle for non-critical features

**Error Handling Pattern** (reference only):

```typescript
private async handleSettingsError(): Promise<void> {
  const error = this.settingsStore.error();
  
  if (error) {
    this.logger.warn(`Settings failed to load: ${error}. Using defaults.`);
    // Optionally show user-facing warning
    // this.notificationService.showWarning('Settings unavailable - using defaults');
  }
}
```

**Testing Focus for Task 4:**

> Focus on **graceful degradation** - ensure errors don't block startup.

**Behaviors to Test:**

- [ ] Bootstrap completes even when settings fail to load
- [ ] Error is logged appropriately
- [ ] Store uses default settings on error
- [ ] App remains functional with defaults
- [ ] User sees warning notification (if implemented)
- [ ] No exceptions thrown during bootstrap

</details>

<details open>
<summary><h3>Task 5: Verify Settings Available After Bootstrap</h3></summary>

**Purpose**: Add verification tests that confirm settings are loaded and available via store signals after bootstrap completes. This validates the integration works end-to-end.

**Related Documentation:**

- [Settings Store - Selectors](./SETTINGS_FEATURE_P3.md#task-9-implement-computed-selectors) - Available selectors
- [Testing Standards - Integration Tests](../../TESTING_STANDARDS.md#integration-testing) - Integration test patterns

**Implementation Subtasks:**

- [ ] **Test settings loaded**: Verify `settings` signal has values after bootstrap
- [ ] **Test selectors work**: Confirm computed selectors return expected values
- [ ] **Test store methods available**: Check store actions are callable
- [ ] **Test integration timing**: Verify settings ready before features initialize
- [ ] **Test with mocked backend**: Use test doubles for backend service

**Testing Subtask:**

- [ ] **Write Integration Tests**: Test complete bootstrap→settings flow (see Testing section)

**Key Implementation Notes:**

- Integration tests mock the backend service
- Tests should verify settings available after `bootstrap()` completes
- Check both successful load and error scenarios
- Verify selectors return values (not null/undefined)
- Test that features can safely access settings after bootstrap
- Consider using TestBed for integration testing

**Integration Test Pattern** (reference only):

```typescript
describe('Settings Bootstrap Integration', () => {
  let bootstrapService: AppBootstrapService;
  let settingsStore: SettingsStore;
  let mockApiService: jasmine.SpyObj<SettingsApiService>;

  beforeEach(() => {
    mockApiService = jasmine.createSpyObj('SettingsApiService', ['getSettings']);
    
    TestBed.configureTestingModule({
      providers: [
        AppBootstrapService,
        { provide: SettingsApiService, useValue: mockApiService }
      ]
    });
    
    bootstrapService = TestBed.inject(AppBootstrapService);
    settingsStore = TestBed.inject(SettingsStore);
  });

  it('should load settings during bootstrap', async () => {
    mockApiService.getSettings.and.returnValue(of(mockSettingsDto));
    
    await bootstrapService.bootstrap();
    
    expect(settingsStore.settings()).toBeDefined();
    expect(settingsStore.isLoading()).toBeFalse();
  });
});
```

**Testing Focus for Task 5:**

> Focus on **end-to-end integration** - ensure bootstrap→settings flow works.

**Behaviors to Test:**

- [ ] Settings store has values after bootstrap completes
- [ ] Settings signals emit correct values
- [ ] Store selectors return expected data
- [ ] Bootstrap completes successfully with mocked backend
- [ ] Bootstrap handles backend errors gracefully
- [ ] Settings available before features initialize

</details>

<details open>
<summary><h3>Task 6: Update Bootstrap Documentation</h3></summary>

**Purpose**: Document the settings bootstrap integration for future developers. This includes inline comments and potentially updating bootstrap-related documentation.

**Related Documentation:**

- [Service Standards - Documentation](../../SERVICE_STANDARDS.md#documentation) - Documentation guidelines
- [Coding Standards - Comments](../../CODING_STANDARDS.md#comments) - Comment conventions

**Implementation Subtasks:**

- [ ] **Add JSDoc to methods**: Document settings-related bootstrap methods
- [ ] **Add inline comments**: Explain settings initialization logic
- [ ] **Update service description**: Include settings in bootstrap service description
- [ ] **Note error handling**: Document graceful degradation behavior
- [ ] **Cross-reference**: Link to settings feature plan if appropriate

**Testing Subtask:**

- [ ] **Review Documentation**: Verify documentation is clear and complete

**Key Implementation Notes:**

- Keep comments focused and concise
- Explain "why" more than "what" (code shows what)
- Document error handling decisions
- Note timing dependencies (settings before features)
- Update service-level JSDoc if needed

**Documentation Example** (pattern only):

```typescript
/**
 * Initializes application settings during bootstrap.
 * Settings are loaded from backend and made available via store signals.
 * Errors are handled gracefully - app continues with default settings.
 */
private async initializeSettings(): Promise<void> {
  this.settingsStore.loadSettings();
  await this.waitForSettingsInit();
  await this.handleSettingsError();
}
```

**Testing Focus for Task 6:**

> Focus on **documentation quality** - ensure future developers understand integration.

**Documentation Checklist:**

- [ ] Methods have clear JSDoc comments
- [ ] Error handling is documented
- [ ] Timing/sequence is explained
- [ ] Graceful degradation is noted
- [ ] References to related docs included

</details>

---

## ✅ Success Criteria

> Mark these checkboxes as you validate each criterion.

- [ ] **Settings Store Injected**: Store is available in bootstrap service
- [ ] **Load Triggered**: `loadSettings()` called during bootstrap
- [ ] **Bootstrap Waits**: App startup waits for settings to initialize
- [ ] **Error Handling Works**: Bootstrap continues with defaults on error
- [ ] **Settings Available**: Store signals populated after bootstrap
- [ ] **All Tests Pass**: Unit and integration tests pass
- [ ] **Documentation Updated**: Bootstrap integration documented
- [ ] **No Startup Failures**: App starts successfully in all scenarios
- [ ] **Graceful Degradation**: Errors logged but don't block startup

---

## 🧪 Testing Summary

### Testing Approach

This phase focuses on **integration testing of bootstrap flow**:

1. **Injection Tests**: Verify store is injected into bootstrap service
2. **Action Trigger Tests**: Verify `loadSettings()` is called
3. **Wait Pattern Tests**: Verify bootstrap waits for completion
4. **Error Handling Tests**: Verify graceful degradation on failure
5. **Integration Tests**: Verify settings available after bootstrap

### Test Types by Task

| Task | Test Type | Focus |
|------|-----------|-------|
| Task 1 | Unit | Store injection |
| Task 2 | Unit | Load action trigger |
| Task 3 | Unit | Async waiting pattern |
| Task 4 | Unit | Error handling |
| Task 5 | Integration | End-to-end bootstrap flow |
| Task 6 | Review | Documentation quality |

### Testing Standards Reference

- Follow [Testing Standards](../../TESTING_STANDARDS.md) for behavioral testing
- Use [Service Standards](../../SERVICE_STANDARDS.md) for service testing patterns
- Mock backend service at infrastructure boundary
- Test both success and error scenarios

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
- **Bootstrap Service**: [App Bootstrap Service](../../../libs/app/bootstrap/src/lib/app-bootstrap.service.ts)
- **Device Bootstrap Reference**: [Device Bootstrap Service](../../../libs/app/bootstrap/src/lib/device-bootstrap.service.ts)

---

_Phase Status: Ready for Implementation_
_Last Updated: 2025-01-11_
_Estimated Effort: 2-3 hours_
