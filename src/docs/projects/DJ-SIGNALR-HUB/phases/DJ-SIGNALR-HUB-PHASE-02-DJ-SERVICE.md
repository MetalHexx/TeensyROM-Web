# Phase 2: Frontend Infrastructure (DjService)

## 🎯 Objective

Create the infrastructure layer service that connects to the SignalR DJHub, enabling frontend components to invoke DJ commands through a clean domain contract. This phase implements the bridge between the backend hub and frontend application layer, following established patterns from device-events and player services.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [x] [DJ SignalR Hub Master Plan](../DJ-SIGNALR-HUB-MASTER-PLAN.md) - High-level feature plan
- [ ] [Phase 1 Report](../reports/DJ-SIGNALR-HUB-TASK-01-001-REPORT.md) - Backend hub implementation details

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - Angular & TypeScript conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches
- [ ] [Service Standards](../../../SERVICE_STANDARDS.md) - Infrastructure service patterns

**Reference Implementations:**

- [ ] [DeviceEventsService](../../../../libs/infrastructure/src/lib/device/device-events.service.ts) - SignalR service pattern
- [ ] [PlayerService](../../../../libs/infrastructure/src/lib/player/player.service.ts) - Service with alert handling
- [ ] [Device Providers](../../../../libs/infrastructure/src/lib/device/providers.ts) - DI configuration pattern
- [ ] [Player Contract](../../../../libs/domain/src/lib/contracts/player.contract.ts) - Domain contract example

---

## 📂 File Structure Overview

```
libs/domain/src/lib/
├── contracts/
│   ├── dj.contract.ts                          ✨ New - IDjService interface + injection token
│   └── index.ts                                 📝 Modified - Export dj contract
├── models/
│   ├── voice-state.model.ts                     ✨ New - VoiceState enum (Enabled/Disabled)
│   └── index.ts                                 📝 Modified - Export voice-state

libs/infrastructure/src/lib/
├── dj/
│   ├── dj.service.ts                            ✨ New - DjService implementation
│   ├── dj.service.spec.ts                       ✨ New - Unit tests
│   └── providers.ts                             ✨ New - DI bindings
└── index.ts                                     📝 Modified - Export DJ_PROVIDERS
```

---

## 📋 Implementation Guidelines

<details open>
<summary><h3>Task 1: Create Domain Contract</h3></summary>

**Purpose**: Define the IDjService interface in the domain layer that abstracts DJ command invocation from implementation details.

**Related Documentation:**

- [Player Contract](../../../../libs/domain/src/lib/contracts/player.contract.ts) - Contract pattern reference
- [Domain Standards](../../../DOMAIN_STANDARDS.md) - Contract design principles

**Implementation Subtasks:**

- [ ] **Create dj.contract.ts** in `libs/domain/src/lib/contracts/`
- [ ] **Define IDjService interface** with `muteVoices` method signature
- [ ] **Create DJ_SERVICE injection token** using `InjectionToken<IDjService>`
- [ ] **Add VoiceState enum** in `libs/domain/src/lib/models/voice-state.model.ts`
- [ ] **Export contract** from `libs/domain/src/lib/contracts/index.ts`
- [ ] **Export model** from `libs/domain/src/lib/models/index.ts`

**Testing Subtask:**

- [ ] **No tests needed**: Domain contracts are interfaces (compile-time only)

**Key Implementation Notes:**

- Use `Observable<void>` return type for async operations
- VoiceState enum: `Enabled = 'Enabled'`, `Disabled = 'Disabled'` (matches backend)
- Method signature: `muteVoices(deviceId: string, voice1: VoiceState, voice2: VoiceState, voice3: VoiceState): Observable<void>`

**Critical Type/Interface**:

```typescript
// dj.contract.ts
export interface IDjService {
  /**
   * Mute or unmute individual SID voices on a device.
   * @param deviceId - Target device identifier
   * @param voice1 - Voice 1 state (Enabled/Disabled)
   * @param voice2 - Voice 2 state (Enabled/Disabled)
   * @param voice3 - Voice 3 state (Enabled/Disabled)
   * @returns Observable that completes when command is sent (not when device responds)
   */
  muteVoices(
    deviceId: string,
    voice1: VoiceState,
    voice2: VoiceState,
    voice3: VoiceState
  ): Observable<void>;
}

export const DJ_SERVICE = new InjectionToken<IDjService>('DJ_SERVICE');
```

```typescript
// voice-state.model.ts
export enum VoiceState {
  Enabled = 'Enabled',
  Disabled = 'Disabled',
}
```

</details>

---

<details open>
<summary><h3>Task 2: Implement DjService</h3></summary>

**Purpose**: Create the infrastructure service that connects to SignalR DJHub and implements the IDjService contract.

**Related Documentation:**

- [DeviceEventsService](../../../../libs/infrastructure/src/lib/device/device-events.service.ts) - SignalR connection pattern
- [PlayerService](../../../../libs/infrastructure/src/lib/player/player.service.ts) - Error handling pattern
- [Service Standards](../../../SERVICE_STANDARDS.md) - Infrastructure service patterns

**Implementation Subtasks:**

- [ ] **Create dj.service.ts** in `libs/infrastructure/src/lib/dj/`
- [ ] **Implement IDjService interface** in DjService class
- [ ] **Inject ALERT_SERVICE and API_CONFIG** via constructor
- [ ] **Create HubConnection** using `@microsoft/signalr` library
- [ ] **Implement lazy connection** - connect on first `muteVoices` call
- [ ] **Implement muteVoices method** - invoke hub method with parameters
- [ ] **Error handling** - catch SignalR errors, show alert, return error Observable
- [ ] **Connection lifecycle** - implement connect/disconnect/reconnect logic
- [ ] **Add @Injectable decorator** with `providedIn: 'root'` (or omit if provided in module)

**Testing Subtask:**

- [ ] **Write Tests**: Test service behaviors (see Testing section below)

**Key Implementation Notes:**

- Use lazy connection pattern (connect on first invocation) - follows device-events pattern
- SignalR hub URL: `${apiConfig.signalRBasePath}/api/djHub`
- Hub method name: `MuteSidVoices` (PascalCase - matches backend C# convention)
- Parameters match backend: `deviceId: string, voice1: string, voice2: string, voice3: string`
- Use `withAutomaticReconnect()` for resilience
- Wrap hub invocation in `from()` to convert Promise to Observable
- Use `catchError` to handle exceptions and show alert

**Service Structure**:

```typescript
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
    // Ensure connection
    // Invoke hub method
    // Handle errors
  }

  private async ensureConnected(): Promise<void> {
    // Lazy connect logic
  }
}
```

**Error Handling Pattern**:

```typescript
return from(hubConnection.invoke('MuteSidVoices', deviceId, voice1, voice2, voice3)).pipe(
  catchError((error) => {
    const message = error instanceof Error ? error.message : 'Failed to mute voices';
    logError('DjService.muteVoices error:', error);
    this.alertService.error(message);
    return throwError(() => new Error(message));
  })
);
```

**Testing Focus for Task 2:**

> Focus on **behavioral testing** - what observable outcomes occur?

**Behaviors to Test:**

- [ ] **Connection established**: Hub connection created with correct URL on first call
- [ ] **Method invocation**: Hub method invoked with correct parameters
- [ ] **Success path**: Observable completes successfully when hub call succeeds
- [ ] **Error handling**: Alert shown and Observable errors when hub call fails
- [ ] **Lazy connection**: Connection not created until first muteVoices call
- [ ] **Reconnection**: Automatic reconnect configured with withAutomaticReconnect()

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for service testing patterns
- Mock SignalR HubConnection (use jasmine spies or NSubstitute equivalent)

</details>

---

<details open>
<summary><h3>Task 3: Create Providers Configuration</h3></summary>

**Purpose**: Configure dependency injection to bind the IDjService contract to the DjService implementation.

**Related Documentation:**

- [Device Providers](../../../../libs/infrastructure/src/lib/device/providers.ts) - Provider pattern reference

**Implementation Subtasks:**

- [ ] **Create providers.ts** in `libs/infrastructure/src/lib/dj/`
- [ ] **Export DJ_PROVIDERS array** with provider binding
- [ ] **Bind DJ_SERVICE token** to DjService class using `useClass`
- [ ] **Export providers** from `libs/infrastructure/src/lib/index.ts`
- [ ] **Add to application providers** (usually in app.config.ts or main.ts)

**Testing Subtask:**

- [ ] **No tests needed**: Providers are configuration (tested via integration)

**Key Implementation Notes:**

- Follow existing provider patterns from device/player infrastructure
- Use `useClass` binding (not `useExisting` or `useFactory`)
- Export as named constant `DJ_PROVIDERS` for consistency

**Provider Configuration**:

```typescript
// providers.ts
import { Provider } from '@angular/core';
import { DJ_SERVICE } from '@teensyrom-nx/domain';
import { DjService } from './dj.service';

export const DJ_PROVIDERS: Provider[] = [
  {
    provide: DJ_SERVICE,
    useClass: DjService,
  },
];
```

**Export from infrastructure index**:

```typescript
// libs/infrastructure/src/lib/index.ts
export { DJ_PROVIDERS } from './dj/providers';
```

</details>

---

<details open>
<summary><h3>Task 4: Add Comprehensive Unit Tests</h3></summary>

**Purpose**: Create thorough unit tests covering all service behaviors and error scenarios.

**Related Documentation:**

- [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approach
- Vitest + Testing Library (existing test stack)

**Implementation Subtasks:**

- [ ] **Create dj.service.spec.ts** in `libs/infrastructure/src/lib/dj/`
- [ ] **Test setup**: Create test fixtures with mocked dependencies
- [ ] **Happy path**: Valid parameters result in successful hub invocation
- [ ] **Connection lifecycle**: Test lazy connection and reconnection
- [ ] **Error scenarios**: Test all error paths (connection failed, hub invocation failed)
- [ ] **Alert service**: Verify alerts shown on errors
- [ ] **Parameter mapping**: Verify VoiceState enums passed correctly to hub
- [ ] **Observable behavior**: Verify completion and error propagation

**Testing Subtask:**

- [ ] **Run Tests**: All unit tests pass with >90% code coverage

**Key Implementation Notes:**

- Mock SignalR HubConnection using jasmine spy objects or vi.fn()
- Mock ALERT_SERVICE and API_CONFIG using injection tokens
- Use Testing Library best practices for Angular services
- Follow AAA pattern (Arrange, Act, Assert)

**Testing Focus for Task 4:**

**Behaviors to Test:**

- [ ] **Successful voice muting**: Hub method invoked, Observable completes
- [ ] **All voice combinations**: Test various Enabled/Disabled combinations
- [ ] **Connection failure**: Alert shown, Observable errors
- [ ] **Hub invocation failure**: Alert shown, Observable errors
- [ ] **Lazy connection**: Connection created on first call, reused on subsequent calls
- [ ] **Parameter correctness**: DeviceId and voice states passed to hub correctly

**Test Example Structure**:

```typescript
describe('DjService', () => {
  let service: DjService;
  let mockHubConnection: jasmine.SpyObj<signalR.HubConnection>;
  let mockAlertService: jasmine.SpyObj<IAlertService>;

  beforeEach(() => {
    // Setup mocks
    mockHubConnection = jasmine.createSpyObj('HubConnection', ['start', 'invoke']);
    mockAlertService = jasmine.createSpyObj('IAlertService', ['error']);
    
    // Create service with mocks
    service = new DjService(mockAlertService, mockApiConfig);
  });

  it('should invoke hub method with correct parameters', (done) => {
    mockHubConnection.invoke.and.returnValue(Promise.resolve());
    
    service.muteVoices('device1', VoiceState.Enabled, VoiceState.Disabled, VoiceState.Enabled)
      .subscribe({
        complete: () => {
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
    const error = new Error('Hub connection failed');
    mockHubConnection.invoke.and.returnValue(Promise.reject(error));
    
    service.muteVoices('device1', VoiceState.Enabled, VoiceState.Enabled, VoiceState.Enabled)
      .subscribe({
        error: (err) => {
          expect(mockAlertService.error).toHaveBeenCalledWith('Hub connection failed');
          done();
        }
      });
  });
});
```

</details>

---

## 🗂️ Files Modified or Created

> List all files that will be changed or created during this phase with full relative paths from project root.

**New Files:**

- `libs/domain/src/lib/contracts/dj.contract.ts`
- `libs/domain/src/lib/models/voice-state.model.ts`
- `libs/infrastructure/src/lib/dj/dj.service.ts`
- `libs/infrastructure/src/lib/dj/dj.service.spec.ts`
- `libs/infrastructure/src/lib/dj/providers.ts`

**Modified Files:**

- `libs/domain/src/lib/contracts/index.ts` (export dj contract)
- `libs/domain/src/lib/models/index.ts` (export voice-state model)
- `libs/infrastructure/src/lib/index.ts` (export DJ_PROVIDERS)

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

> **IMPORTANT:** Tests are written **within each task above**, not here. This section is only a summary for quick reference.

### Test Execution Commands

**Running Tests:**

```bash
# Run tests for infrastructure library
pnpm nx test infrastructure --watch=false

# Run tests in watch mode during development
pnpm nx test infrastructure --watch

# Run with coverage
pnpm nx test infrastructure --coverage
```

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

> **Mark checkboxes as criteria are met**. All items must be checked before phase is complete.

**Functional Requirements:**

- [ ] IDjService contract created in `libs/domain/contracts/dj.contract.ts`
- [ ] VoiceState enum created in `libs/domain/models/voice-state.model.ts`
- [ ] DJ_SERVICE injection token exported from domain
- [ ] DjService implements IDjService contract
- [ ] SignalR hub connection established lazily on first call
- [ ] muteVoices method invokes hub with correct parameters
- [ ] Error handling shows alerts via ALERT_SERVICE
- [ ] DJ_PROVIDERS exported from infrastructure
- [ ] Code follows [Coding Standards](../../../CODING_STANDARDS.md)

**Testing Requirements:**

- [ ] Unit tests created for DjService
- [ ] All test behaviors verified (connection, invocation, errors, alerts)
- [ ] Unit tests pass with >90% code coverage
- [ ] No flaky or failing tests
- [ ] Tests follow [Testing Standards](../../../TESTING_STANDARDS.md)

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes (`pnpm nx lint`)
- [ ] Formatting is consistent (`pnpm run format`)
- [ ] No console errors when running application

**Documentation:**

- [ ] JSDoc comments on IDjService interface methods
- [ ] JSDoc comments on DjService public methods
- [ ] Inline comments for complex logic (hub connection lifecycle)

**Ready for Next Phase:**

- [ ] All success criteria met
- [ ] No known bugs or issues
- [ ] Service ready for UI integration (Phase 3)
- [ ] Code reviewed and approved

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Design Decisions

- **Lazy Connection**: Hub connection created on first `muteVoices` call, not on service instantiation. This follows the device-events pattern and avoids unnecessary connections.

- **VoiceState Enum**: Matches backend enum values (`Enabled`/`Disabled` strings). This ensures compatibility without transformation logic.

- **Observable Pattern**: Returns `Observable<void>` for async operations, consistent with other infrastructure services. Consumers can subscribe for completion/error handling.

- **Alert Service Integration**: Uses ALERT_SERVICE injection token for user-visible error messages, following established error handling patterns.

### Implementation Constraints

- **SignalR HubConnection**: Must use `@microsoft/signalr` library version compatible with project
- **Hub Method Naming**: Backend uses PascalCase (`MuteSidVoices`), frontend must match exactly
- **Error Propagation**: Errors from hub must propagate to Observable subscribers after showing alert

### Future Enhancements

- **Connection Pooling**: If multiple DJ services needed, consider connection pooling
- **State Caching**: Cache last known voice states for reconnection scenarios
- **Batch Operations**: Support batching multiple voice commands in single hub call

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

</details>

---

## 💡 Agent Implementation Guide

> **Instructions for AI agents creating and using this document**

### Key Questions Resolved

**Q: Should connection be eager or lazy?**
A: Lazy - connect on first `muteVoices` call. This follows device-events pattern and avoids wasted connections.

**Q: Where should VoiceState enum live?**
A: Domain models layer (`libs/domain/models/voice-state.model.ts`). This keeps domain contracts free of implementation details.

**Q: How to handle hub connection failures?**
A: Show alert via ALERT_SERVICE, log error, return error Observable. This provides user feedback and allows callers to handle errors.

### During Implementation

**Progress Tracking:**

1. ✅ Mark checkboxes as completing each subtask
2. 📝 Document any design decisions or deviations
3. 🚧 Note blockers if SignalR connection behavior differs from expected

**Testing Integration:**

1. Write unit tests alongside implementation (Task 2 + Task 4)
2. Run tests continuously during development
3. Verify error scenarios work as expected
4. Test connection lifecycle (connect, disconnect, reconnect)

</details>
