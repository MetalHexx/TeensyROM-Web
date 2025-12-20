# Task Handoff: DJ-SIGNALR-HUB-TASK-02-004-UNIT-TESTS

## 📋 Task Identity

**Task ID**: DJ-SIGNALR-HUB-TASK-02-004-UNIT-TESTS  
**Task Name**: Add Comprehensive Unit Tests for DjService  
**Assigned To**: UI Test Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Test Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Medium (reviewing service implementation + writing tests)

---

## 🎯 Objective

**What**: Create thorough unit tests for DjService covering all behaviors, error scenarios, and edge cases with >90% code coverage.

**Why**: Comprehensive testing ensures the SignalR service works correctly in all scenarios, provides confidence for future refactoring, and documents expected behaviors.

**Success Criteria**:
- [ ] Unit test file created at `libs/infrastructure/src/lib/dj/dj.service.spec.ts`
- [ ] All happy path behaviors tested
- [ ] All error scenarios covered (connection failure, hub invocation failure)
- [ ] Alert service integration verified
- [ ] Connection lifecycle tested (lazy connection, reuse)
- [ ] All tests pass consistently with >90% code coverage
- [ ] Tests follow [Testing Standards](../../../TESTING_STANDARDS.md)

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- DJ-SIGNALR-HUB-TASK-02-001-DOMAIN-CONTRACT: IDjService contract defined
- DJ-SIGNALR-HUB-TASK-02-002-IMPLEMENT-SERVICE: DjService implementation complete
- DJ-SIGNALR-HUB-TASK-02-003-PROVIDERS: DI providers configured

**Dependencies**:
- Vitest (test framework)
- Testing Library Angular utilities (if needed for DI)
- jasmine spy objects OR vitest mocks (`vi.fn()`)
- RxJS testing utilities (Observables)

**Constraints**:
- Must mock SignalR HubConnection (don't use real hub)
- Must mock ALERT_SERVICE and API_CONFIG
- Tests must be deterministic and not flaky
- Follow behavioral testing approach (test observable outcomes)

---

## 📂 File Scope

**Files to Create**:
- `libs/infrastructure/src/lib/dj/dj.service.spec.ts` - Unit tests

**Files to Modify**:
- None

**Files to Review**:
- `libs/infrastructure/src/lib/dj/dj.service.ts` - Implementation to test
- `libs/infrastructure/src/lib/device/device-events.service.spec.ts` - SignalR testing example
- `libs/infrastructure/src/lib/player/player.service.spec.ts` - Error handling testing example

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approach and patterns
- [Coding Standards](../../../CODING_STANDARDS.md) - Test code quality

**Key Requirements**:

1. **Test Structure**:
   - Use `describe('DjService', ...)` for test suite
   - Group related tests with nested `describe` blocks
   - Use clear test names: "should [expected behavior] when [condition]"
   - Follow AAA pattern (Arrange, Act, Assert)

2. **Mock Setup**:
   - Mock HubConnection with `jasmine.createSpyObj` or `vi.fn()`
   - Mock methods: `start()`, `invoke()`, `on()`, `off()`, `stop()`
   - Mock ALERT_SERVICE with `error()` method
   - Mock API_CONFIG with `signalRBasePath` property

3. **Test Categories**:
   - **Happy Path**: Successful voice muting with various combinations
   - **Connection Lifecycle**: Lazy connection, connection reuse
   - **Error Scenarios**: Connection failure, hub invocation failure
   - **Alert Integration**: Verify alerts shown on errors
   - **Parameter Validation**: Correct parameters passed to hub

4. **Observable Testing**:
   - Subscribe to Observable returned by muteVoices
   - Use `done` callback for async tests
   - Verify Observable completes or errors as expected
   - Use `catchError` or error callback to test error paths

**Anti-Patterns to Avoid**:
- Don't test implementation details (private methods)
- Don't use real SignalR connections (too slow, flaky)
- Don't skip error scenarios (most important tests)
- Don't write tests that depend on execution order

---

## 📋 Test Scenarios to Cover

**1. Happy Path Behaviors**:
- [ ] Successfully mutes voices with all enabled
- [ ] Successfully mutes voices with all disabled
- [ ] Successfully mutes voices with mixed states (e.g., V1 enabled, V2 disabled, V3 enabled)
- [ ] Observable completes after successful hub call

**2. Connection Lifecycle**:
- [ ] Hub connection created on first muteVoices call
- [ ] Hub connection NOT created on service instantiation (lazy)
- [ ] Hub connection reused for subsequent muteVoices calls
- [ ] Connection start() called before invoke()

**3. Error Scenarios**:
- [ ] Shows alert when hub connection fails to start
- [ ] Shows alert when hub invoke() rejects
- [ ] Observable errors when hub connection fails
- [ ] Observable errors when hub invoke() rejects
- [ ] Error message extracted correctly from Error objects
- [ ] Error message handled for unknown error types

**4. Parameter Verification**:
- [ ] Hub invoke() called with correct method name ('MuteSidVoices')
- [ ] Device ID passed correctly as first parameter
- [ ] Voice states passed in correct order (voice1, voice2, voice3)
- [ ] Voice state enum values passed as strings ('Enabled', 'Disabled')

**5. Alert Service Integration**:
- [ ] Alert service error() called when connection fails
- [ ] Alert service error() called when hub invocation fails
- [ ] Alert message contains meaningful error description

---

## 📋 Code References

**Test Structure Template**:

```typescript
// libs/infrastructure/src/lib/dj/dj.service.spec.ts
import { TestBed } from '@angular/core/testing';
import * as signalR from '@microsoft/signalr';
import { DjService } from './dj.service';
import { ALERT_SERVICE, IAlertService } from '../alert/alert.contract';
import { API_CONFIG, IApiConfig } from '../config/api-config.contract';
import { VoiceState } from '@teensyrom-nx/domain';

describe('DjService', () => {
  let service: DjService;
  let mockHubConnection: jasmine.SpyObj<signalR.HubConnection>;
  let mockAlertService: jasmine.SpyObj<IAlertService>;
  let mockApiConfig: IApiConfig;

  beforeEach(() => {
    // Create mock hub connection
    mockHubConnection = jasmine.createSpyObj('HubConnection', [
      'start',
      'invoke',
      'on',
      'off',
      'stop'
    ]);

    // Create mock alert service
    mockAlertService = jasmine.createSpyObj('IAlertService', ['error']);

    // Create mock API config
    mockApiConfig = {
      signalRBasePath: 'http://localhost:5000',
      basePath: 'http://localhost:5000/api'
    };

    // Configure TestBed
    TestBed.configureTestingModule({
      providers: [
        DjService,
        { provide: ALERT_SERVICE, useValue: mockAlertService },
        { provide: API_CONFIG, useValue: mockApiConfig }
      ]
    });

    service = TestBed.inject(DjService);
    
    // Inject mock hub connection (may need to access private field or use spy)
  });

  describe('muteVoices', () => {
    it('should invoke hub method with correct parameters', (done) => {
      // Arrange
      mockHubConnection.start.and.returnValue(Promise.resolve());
      mockHubConnection.invoke.and.returnValue(Promise.resolve());

      // Act
      service.muteVoices('device1', VoiceState.Enabled, VoiceState.Disabled, VoiceState.Enabled)
        .subscribe({
          complete: () => {
            // Assert
            expect(mockHubConnection.invoke).toHaveBeenCalledWith(
              'MuteSidVoices',
              'device1',
              'Enabled',
              'Disabled',
              'Enabled'
            );
            done();
          }
        });
    });

    it('should show alert and error Observable on hub failure', (done) => {
      // Arrange
      const error = new Error('Hub connection failed');
      mockHubConnection.start.and.returnValue(Promise.resolve());
      mockHubConnection.invoke.and.returnValue(Promise.reject(error));

      // Act
      service.muteVoices('device1', VoiceState.Enabled, VoiceState.Enabled, VoiceState.Enabled)
        .subscribe({
          error: (err) => {
            // Assert
            expect(mockAlertService.error).toHaveBeenCalledWith('Hub connection failed');
            expect(err.message).toBe('Hub connection failed');
            done();
          }
        });
    });

    // Add more test cases...
  });

  describe('connection lifecycle', () => {
    it('should create connection on first call, not on instantiation', () => {
      // Test lazy connection pattern
    });

    it('should reuse connection for subsequent calls', (done) => {
      // Test connection reuse
    });
  });
});
```

---

## 🧪 Testing Requirements

**Test Execution**:

```bash
# Run tests during development
pnpm nx test infrastructure --watch

# Run tests once for verification
pnpm nx test infrastructure --watch=false

# Run with coverage
pnpm nx test infrastructure --coverage
```

**Coverage Requirements**:
- Overall: >90% lines, branches, functions
- DjService: 100% coverage (achievable with thorough tests)

**Test Quality Checks**:
- [ ] All tests pass consistently (no flaky tests)
- [ ] No `fit` or `fdescribe` (focused tests) in committed code
- [ ] No `xit` or `xdescribe` (skipped tests) without comment explaining why
- [ ] Tests are fast (<100ms per test typically)
- [ ] Tests are isolated (no shared state between tests)

---

## 📖 Reference Materials

**Related Documentation**:
- [DJ SignalR Hub Master Plan](../DJ-SIGNALR-HUB-MASTER-PLAN.md#phase-2)
- [Phase 2 Plan](../phases/DJ-SIGNALR-HUB-PHASE-02-DJ-SERVICE.md#task-4)
- [Testing Standards](../../../TESTING_STANDARDS.md) - Testing philosophy and patterns

**Reference Test Implementations**:
- [DeviceEventsService Tests](../../../../libs/infrastructure/src/lib/device/device-events.service.spec.ts) - SignalR testing
- [PlayerService Tests](../../../../libs/infrastructure/src/lib/player/player.service.spec.ts) - Error handling testing

**Related Tasks**:
- DJ-SIGNALR-HUB-TASK-02-002-IMPLEMENT-SERVICE (completed): Service implementation being tested

**Reports from Previous Tasks**:
- [Task 02-002 Report](../reports/DJ-SIGNALR-HUB-TASK-02-002-REPORT.md) - Service implementation details

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/DJ-SIGNALR-HUB/reports/DJ-SIGNALR-HUB-TASK-02-004-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/DJ-SIGNALR-HUB/reports/DJ-SIGNALR-HUB-TASK-02-004-REPORT.md`

---

## 🎯 Success Checklist

Before marking this task complete, verify:

- [ ] Unit test file created with comprehensive test suite
- [ ] All happy path scenarios tested
- [ ] All error scenarios covered
- [ ] Connection lifecycle verified (lazy connection, reuse)
- [ ] Alert service integration tested
- [ ] Parameter passing verified
- [ ] All tests pass consistently with >90% coverage
- [ ] No flaky or skipped tests
- [ ] Tests follow testing standards
- [ ] Phase 2 ready for completion and Phase 3 handoff
