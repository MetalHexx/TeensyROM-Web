# Task Handoff: DJ-SIGNALR-HUB-TASK-02-002-IMPLEMENT-SERVICE

## 📋 Task Identity

**Task ID**: DJ-SIGNALR-HUB-TASK-02-002-IMPLEMENT-SERVICE  
**Task Name**: Implement DjService Infrastructure Layer  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Medium (4-6 files including tests)

---

## 🎯 Objective

**What**: Create the infrastructure layer service that connects to the SignalR DJHub and implements the IDjService contract, enabling frontend components to invoke DJ commands.

**Why**: This service is the bridge between the backend SignalR hub and frontend application layer, providing type-safe async operations with proper error handling.

**Success Criteria**:
- [ ] DjService class created implementing IDjService
- [ ] SignalR HubConnection configured with correct URL and reconnection
- [ ] Lazy connection pattern implemented (connect on first invocation)
- [ ] muteVoices method invokes hub with correct parameters
- [ ] Error handling shows alerts via ALERT_SERVICE
- [ ] Unit tests written with >90% code coverage
- [ ] All unit tests pass consistently
- [ ] Code follows [Coding Standards](../../../CODING_STANDARDS.md)

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- DJ-SIGNALR-HUB-TASK-01-001-CREATE-HUB: Backend DJHub exists at `/api/djHub`
- DJ-SIGNALR-HUB-TASK-02-001-DOMAIN-CONTRACT: IDjService contract and VoiceState enum created

**Dependencies**:
- `@microsoft/signalr` - SignalR client library
- `rxjs` - Observable/from/catchError operators
- Domain contracts: IDjService, DJ_SERVICE, VoiceState
- Infrastructure contracts: ALERT_SERVICE, API_CONFIG
- Shared utilities: logError (from `@teensyrom-nx/utils`)

**Constraints**:
- Hub URL must use `signalRBasePath` from API_CONFIG
- Hub method name is `MuteSidVoices` (PascalCase - matches backend C# convention)
- Must use lazy connection pattern (connect on first call, not on service instantiation)
- Automatic reconnection must be configured with `withAutomaticReconnect()`

---

## 📂 File Scope

**Files to Create**:
- `libs/infrastructure/src/lib/dj/dj.service.ts` - DjService implementation
- `libs/infrastructure/src/lib/dj/dj.service.spec.ts` - Unit tests

**Files to Modify**:
- None (providers handled in Task 02-003)

**Files to Review** (for context):
- `libs/infrastructure/src/lib/device/device-events.service.ts` - SignalR lazy connection pattern
- `libs/infrastructure/src/lib/player/player.service.ts` - Error handling via ALERT_SERVICE
- `libs/domain/src/lib/contracts/dj.contract.ts` - Contract to implement
- `apps/api/src/TeensyRom.Api/Endpoints/DJ/DJHub.cs` - Backend hub method signature

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript and Angular conventions
- [Service Standards](../../../SERVICE_STANDARDS.md) - Infrastructure service patterns
- [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches

**Key Requirements**:

1. **Service Class**:
   - Use `@Injectable()` decorator (no providedIn - handled by providers)
   - Implement IDjService interface
   - Inject ALERT_SERVICE and API_CONFIG via constructor

2. **Hub Connection**:
   - Create `HubConnection` using `HubConnectionBuilder`
   - URL: `${apiConfig.signalRBasePath}/api/djHub`
   - Configure `withAutomaticReconnect()` for resilience
   - Store connection in private field (nullable initially)

3. **Lazy Connection**:
   - Don't connect in constructor
   - Create private `ensureConnected()` method
   - Call `ensureConnected()` before every hub invocation
   - Connection created on first call, reused for subsequent calls

4. **muteVoices Implementation**:
   - Call `ensureConnected()` first
   - Invoke hub method: `hubConnection.invoke('MuteSidVoices', deviceId, voice1, voice2, voice3)`
   - Wrap Promise in `from()` to convert to Observable
   - Use `catchError` to handle exceptions

5. **Error Handling**:
   - Catch all hub invocation errors
   - Extract error message (handle Error objects and unknown types)
   - Call `alertService.error(message)` to show user-visible alert
   - Log error using `logError('DjService.muteVoices error:', error)`
   - Return `throwError(() => new Error(message))`

**Anti-Patterns to Avoid**:
- Don't create connection eagerly in constructor
- Don't forget to handle connection failures (null checks)
- Don't swallow errors - always propagate after showing alert
- Don't use hardcoded URLs - use API_CONFIG

---

## 📋 Code References

**Service Structure** (architectural guidance, not full implementation):

```typescript
// libs/infrastructure/src/lib/dj/dj.service.ts
import { Injectable, Inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Observable, from, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IDjService, DJ_SERVICE, VoiceState } from '@teensyrom-nx/domain';
import { ALERT_SERVICE, IAlertService } from '../alert/alert.contract';
import { API_CONFIG, IApiConfig } from '../config/api-config.contract';
import { logError } from '@teensyrom-nx/utils';

@Injectable()
export class DjService implements IDjService {
  private hubConnection: signalR.HubConnection | null = null;

  constructor(
    @Inject(ALERT_SERVICE) private alertService: IAlertService,
    @Inject(API_CONFIG) private apiConfig: IApiConfig
  ) {}

  muteVoices(
    deviceId: string,
    voice1: VoiceState,
    voice2: VoiceState,
    voice3: VoiceState
  ): Observable<void> {
    // 1. Ensure connected
    // 2. Invoke hub method
    // 3. Handle errors with alert
  }

  private async ensureConnected(): Promise<void> {
    // Lazy connection logic
  }
}
```

**Hub Connection Creation Pattern** (reference DeviceEventsService):

```typescript
private createConnection(): signalR.HubConnection {
  return new signalR.HubConnectionBuilder()
    .withUrl(`${this.apiConfig.signalRBasePath}/api/djHub`)
    .withAutomaticReconnect()
    .build();
}
```

**Error Handling Pattern** (reference PlayerService):

```typescript
catchError((error) => {
  const message = error instanceof Error ? error.message : 'Failed to mute voices';
  logError('DjService.muteVoices error:', error);
  this.alertService.error(message);
  return throwError(() => new Error(message));
})
```

---

## 🧪 Testing Requirements

**Test Coverage Required**:
- [ ] Unit tests for DjService with mocked dependencies
- [ ] Test lazy connection (connection created on first call)
- [ ] Test successful voice muting with various combinations
- [ ] Test error scenarios (connection failure, hub invocation failure)
- [ ] Test alert service called on errors
- [ ] Test Observable completion on success
- [ ] Test Observable error propagation on failure

**Testing Approach**:
- Mock SignalR HubConnection using jasmine.createSpyObj or vi.fn()
- Mock ALERT_SERVICE and API_CONFIG using injection tokens
- Use AAA pattern (Arrange, Act, Assert)
- Test behaviors, not implementation details

**Test Structure**:

```typescript
// libs/infrastructure/src/lib/dj/dj.service.spec.ts
describe('DjService', () => {
  let service: DjService;
  let mockHubConnection: jasmine.SpyObj<signalR.HubConnection>;
  let mockAlertService: jasmine.SpyObj<IAlertService>;
  let mockApiConfig: IApiConfig;

  beforeEach(() => {
    // Create spies/mocks
    mockHubConnection = jasmine.createSpyObj('HubConnection', ['start', 'invoke']);
    mockAlertService = jasmine.createSpyObj('IAlertService', ['error']);
    mockApiConfig = { signalRBasePath: 'http://localhost:5000' };
    
    // Inject mocks into service
  });

  it('should invoke hub method with correct parameters', (done) => {
    // Arrange: Mock successful hub invocation
    // Act: Call service.muteVoices()
    // Assert: Verify hub.invoke called with correct args
  });

  it('should show alert and error Observable on hub failure', (done) => {
    // Arrange: Mock hub invocation rejection
    // Act: Call service.muteVoices()
    // Assert: Verify alert shown and Observable errors
  });
});
```

**Behavioral Tests to Cover**:
- ✅ Hub connection created with correct URL
- ✅ Connection not created until first muteVoices call
- ✅ Hub method invoked with deviceId and voice states
- ✅ Observable completes on successful hub call
- ✅ Alert shown on hub connection failure
- ✅ Alert shown on hub invocation failure
- ✅ Observable errors propagated to subscribers
- ✅ Connection reused for subsequent calls

---

## 📖 Reference Materials

**Related Documentation**:
- [DJ SignalR Hub Master Plan](../DJ-SIGNALR-HUB-MASTER-PLAN.md#phase-2)
- [Phase 2 Plan](../phases/DJ-SIGNALR-HUB-PHASE-02-DJ-SERVICE.md#task-2)
- [Service Standards](../../../SERVICE_STANDARDS.md) - Infrastructure patterns

**Reference Implementations**:
- [DeviceEventsService](../../../../libs/infrastructure/src/lib/device/device-events.service.ts) - SignalR lazy connection
- [PlayerService](../../../../libs/infrastructure/src/lib/player/player.service.ts) - Error handling with alerts

**Related Tasks**:
- DJ-SIGNALR-HUB-TASK-02-001-DOMAIN-CONTRACT (completed): IDjService interface created
- DJ-SIGNALR-HUB-TASK-02-003-PROVIDERS (next): Will bind this service to contract

**Reports from Previous Tasks**:
- [Task 02-001 Report](../reports/DJ-SIGNALR-HUB-TASK-02-001-REPORT.md) - Domain contract implementation

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/DJ-SIGNALR-HUB/reports/DJ-SIGNALR-HUB-TASK-02-002-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/DJ-SIGNALR-HUB/reports/DJ-SIGNALR-HUB-TASK-02-002-REPORT.md`

---

## 🎯 Success Checklist

Before marking this task complete, verify:

- [ ] DjService class created and implements IDjService
- [ ] SignalR HubConnection configured correctly
- [ ] Lazy connection pattern implemented
- [ ] muteVoices method invokes hub with correct parameters
- [ ] Error handling shows alerts and propagates errors
- [ ] Unit test file created with comprehensive coverage
- [ ] All tests pass with >90% code coverage
- [ ] No TypeScript errors or lint warnings
- [ ] Code follows coding standards
- [ ] Ready for provider configuration (Task 02-003)
