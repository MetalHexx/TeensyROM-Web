# Phase 2: Domain Contracts & Infrastructure Layer

## 🎯 Objective

Define domain-layer contracts for settings services and implement the infrastructure-layer service that communicates with the backend API. This establishes Clean Architecture boundaries by creating domain interfaces (contracts) and infrastructure implementations that map API DTOs to domain models and dispatch error alerts following the player service pattern. The infrastructure service will be injected into the application layer (Phase 3) via dependency injection tokens.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md) - High-level feature overview and architecture
- [ ] [Phase 1 Completion](./SETTINGS_FEATURE_P1.md) - API client generation (prerequisite)

**Standards & Guidelines:**

- [ ] [Coding Standards](../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Service Standards](../../SERVICE_STANDARDS.md) - Service implementation patterns and error handling
- [ ] [Testing Standards](../../TESTING_STANDARDS.md) - Testing approaches by layer

**Reference Implementations:**

- [ ] [PlayerService](../../../libs/infrastructure/src/lib/player/player.service.ts) - Error handling with alert service pattern to follow
- [ ] [Domain Mapper](../../../libs/infrastructure/src/lib/domain.mapper.ts) - DTO mapping patterns

---

## 📂 File Structure Overview

> New domain contracts and infrastructure implementation.

```
libs/domain/src/lib/settings/
├── index.ts                                  ✨ New - Barrel export for settings domain
├── settings.contract.ts                      ✨ New - ISettingsService interface
├── settings.models.ts                        ✨ New - Domain models (Settings, PlayerSettings, etc.)
└── settings.tokens.ts                        ✨ New - DI injection token for ISettingsService

libs/infrastructure/src/lib/settings/
├── index.ts                                  ✨ New - Barrel export for settings infrastructure
├── settings.service.ts                       ✨ New - SettingsService with alert-based error handling
├── settings.mappers.ts                       ✨ New - DTO-to-domain mapping functions
└── settings.service.spec.ts                  ✨ New - Service unit tests

libs/infrastructure/src/index.ts              📝 Modified - Export settings infrastructure
```

---

<details open>
<summary><h3>Task 1: Define Domain Models</h3></summary>

**Purpose**: Create TypeScript interfaces representing settings in the domain layer. These models are framework-agnostic and represent the business concepts independent of API DTOs.

**Related Documentation:**

- [Settings Feature Plan - Data Structures](./SETTINGS_FEATURE_PLAN.md#phase-2-domain-contracts--infrastructure-layer)
- [Coding Standards - TypeScript](../../CODING_STANDARDS.md#typescript-conventions)

**Implementation Subtasks:**

- [ ] **Create settings.models.ts**: New file in `libs/domain/src/lib/settings/`
- [ ] **Define Settings interface**: Root interface containing all settings sections
- [ ] **Define PlayerSettings interface**: `repeatMode`, `sidTimerSeconds`, `sidAutoAdvance`, `launchOnStartup`
- [ ] **Define FileTransferSettings interface**: `watchFoldersEnabled`, `watchFolders`, `autoLaunchTransferred`
- [ ] **Define SearchSettings interface**: `weights`, `stopWords`, `enableMetadataSearch`, `showHiddenFiles`
- [ ] **Define SearchWeights interface**: Nested object for search weight values
- [ ] **Define AppSettings interface**: `setupCompleted`
- [ ] **Define RepeatMode type**: Union type `'Off' | 'Single' | 'All'`
- [ ] **Add JSDoc comments**: Document each interface and property

**Testing Subtask:**

- [ ] **Write Model Tests**: Type-checking tests validating model structure

**Key Implementation Notes:**

- Use TypeScript interfaces (not classes) following domain patterns
- All properties required unless business logic demands optionality
- No framework-specific types (no Angular, no RxJS in domain layer)
- Domain models may differ from DTOs if business logic requires it

</details>

<details open>
<summary><h3>Task 2: Define Service Contract Interface</h3></summary>

**Purpose**: Create the `ISettingsService` contract interface defining the operations for settings management. This contract will be implemented by the infrastructure service and consumed by the application layer.

**Related Documentation:**

- [Service Standards - Contract Definition](../../SERVICE_STANDARDS.md#service-contracts)
- [Coding Standards - Interfaces](../../CODING_STANDARDS.md#typescript-conventions)

**Implementation Subtasks:**

- [ ] **Create settings.contract.ts**: New file in `libs/domain/src/lib/settings/`
- [ ] **Define ISettingsService interface**: Contract with `getSettings()` and `saveSettings()` methods
- [ ] **Use Observable return types**: `Observable<Settings>` for both methods
- [ ] **Add JSDoc documentation**: Document each method's purpose and behavior
- [ ] **Export from index.ts**: Add to domain barrel export

**Testing Subtask:**

- [ ] **Verify Contract Compilation**: Ensure interface compiles without errors

**Key Implementation Notes:**

- Contract defines "what" not "how" (implementation details in infrastructure)
- Use RxJS Observable for async operations (infrastructure layer pattern)
- Methods should be intuitive and match business terminology
- Contract consumed by application layer stores via injection token

**Interface Structure**: Define methods for getting and saving settings, returning Observables

</details>

<details open>
<summary><h3>Task 3: Create Dependency Injection Token</h3></summary>

**Purpose**: Create an Angular injection token for the `ISettingsService` interface to enable dependency injection with proper typing.

**Related Documentation:**

- [Service Standards - Injection Tokens](../../SERVICE_STANDARDS.md#injection-tokens)
- [Coding Standards - Dependency Injection](../../CODING_STANDARDS.md#dependency-injection)

**Implementation Subtasks:**

- [ ] **Create settings.tokens.ts**: New file in `libs/domain/src/lib/settings/`
- [ ] **Define SETTINGS_SERVICE token**: `InjectionToken<ISettingsService>` with descriptive name
- [ ] **Add token description**: Provide clear description string for debugging
- [ ] **Export from index.ts**: Add to domain barrel export

**Testing Subtask:**

- [ ] **Verify Token Creation**: Ensure token is properly typed and exported

**Key Implementation Notes:**

- Token enables type-safe dependency injection across layers
- Token name should be descriptive for Angular DevTools
- Token will be used in application layer to inject infrastructure service
- Follow existing token patterns in domain layer

**Token Pattern**: Create InjectionToken with interface type and descriptive string

</details>

<details open>
<summary><h3>Task 4: Implement DTO-to-Domain Mappers</h3></summary>

**Purpose**: Create mapping functions that convert API DTOs to domain models and vice versa. These mappers isolate the infrastructure layer from domain layer changes.

**Related Documentation:**

- [Service Standards - Mapping Patterns](../../SERVICE_STANDARDS.md#dto-mapping)
- [Domain Mapper Reference](../../../libs/infrastructure/src/lib/domain.mapper.ts) - Existing mapping patterns

**Implementation Subtasks:**

- [ ] **Create settings.mappers.ts**: New file in `libs/infrastructure/src/lib/settings/`
- [ ] **Implement mapSettingsDtoToDomain**: Convert DTO to domain Settings
- [ ] **Implement mapSettingsDomainToDto**: Convert domain Settings to DTO  
- [ ] **Handle enum mapping**: Map RepeatMode string values correctly
- [ ] **Add null safety**: Handle potential undefined/null values from API
- [ ] **Add type safety**: Ensure full type coverage with no `any` types

**Testing Subtask:**

- [ ] **Write Mapper Tests**: Test bidirectional conversion and round-trip

**Key Implementation Notes:**

- Mappers are pure functions with no side effects
- Handle all properties explicitly (no spread if structures diverge later)
- Enum mapping should be explicit and type-safe
- Test round-trip conversion (DTO → Domain → DTO produces identical result)
- Follow patterns in existing DomainMapper utility

**Mapping Pattern**: Create pure functions converting between DTO and domain types with explicit property mapping

</details>

<details open>
<summary><h3>Task 5: Implement Infrastructure Service with Alert-Based Error Handling</h3></summary>

**Purpose**: Implement `SettingsService` that calls the API client, maps responses to domain models, and dispatches error alerts via the alert service following the player service pattern.

**Related Documentation:**

- [PlayerService Reference](../../../libs/infrastructure/src/lib/player/player.service.ts) - Error handling pattern to follow
- [Service Standards - Error Handling](../../SERVICE_STANDARDS.md#error-handling)
- [Alert Service Usage](../../SERVICE_STANDARDS.md#alert-service)

**Implementation Subtasks:**

- [ ] **Create settings.service.ts**: New file implementing ISettingsService
- [ ] **Inject dependencies**: SettingsApiService and IAlertService via constructor
- [ ] **Implement getSettings()**: Call API, map response, handle errors with alerts
- [ ] **Implement saveSettings()**: Map domain to DTO, call API, handle errors with alerts
- [ ] **Add error handler method**: Private method dispatching alerts and logging errors
- [ ] **Use RxJS operators**: `map()` for success, `catchError()` for errors
- [ ] **Inject ALERT_SERVICE**: Use @Inject decorator with ALERT_SERVICE token
- [ ] **Follow player service pattern**: Match error handling structure exactly

**Testing Subtask:**

- [ ] **Write Service Tests**: Test API calls, mapping, and error handling with alerts

**Key Implementation Notes:**

- Service implements ISettingsService contract from domain layer
- Errors dispatched via `alertService.error()` (infrastructure responsibility)
- Follow exact pattern from PlayerService (reference implementation)
- Use `catchError` to handle errors and dispatch alerts
- Log errors for debugging while showing user-friendly messages
- Return throwError after alert dispatch to propagate error
- Extract error messages using utility function
- Test both success paths and error scenarios with alert spy

**Error Handling Pattern**: Use alert service in catchError operator like PlayerService

**Reference**: See PlayerService.handleError() private method for exact pattern

</details>

<details open>
<summary><h3>Task 6: Configure Dependency Injection Providers</h3></summary>

**Purpose**: Configure Angular providers to wire up the infrastructure service implementation to the domain contract token.

**Related Documentation:**

- [Service Standards - Provider Configuration](../../SERVICE_STANDARDS.md#provider-configuration)
- [Coding Standards - Dependency Injection](../../CODING_STANDARDS.md#dependency-injection)

**Implementation Subtasks:**

- [ ] **Create providers.ts**: New file in `libs/infrastructure/src/lib/settings/`
- [ ] **Define SETTINGS_PROVIDERS**: Export provider configuration array
- [ ] **Map token to implementation**: Provide SettingsService for SETTINGS_SERVICE token
- [ ] **Export from infrastructure index**: Add to infrastructure barrel export
- [ ] **Verify providedIn**: Consider if service should use `providedIn: 'root'` or explicit providers

**Testing Subtask:**

- [ ] **Verify Provider Configuration**: Test that service can be injected via token

**Key Implementation Notes:**

- Providers typically configured in infrastructure library
- Token from domain layer maps to service from infrastructure layer
- Application layer injects via token (never imports infrastructure directly)
- Follow existing provider patterns in infrastructure layer
- Consider using class provider pattern or factory if needed

**Provider Pattern**: Map domain token to infrastructure implementation class

</details>

<details open>
<summary><h3>Task 7: Write Comprehensive Service Tests</h3></summary>

**Purpose**: Create Vitest unit tests for the SettingsService verifying API interactions, mapping, and alert-based error handling.

**Related Documentation:**

- [Testing Standards - Service Testing](../../TESTING_STANDARDS.md#service-layer-testing)
- [Service Standards - Testing](../../SERVICE_STANDARDS.md#testing-services)
- [PlayerService Tests](../../../libs/infrastructure/src/lib/player/player.service.spec.ts) - Test patterns to follow

**Implementation Subtasks:**

- [ ] **Create settings.service.spec.ts**: New test file using Vitest
- [ ] **Setup test dependencies**: Mock SettingsApiService and IAlertService
- [ ] **Test getSettings success**: Verify API call, mapping, and return value
- [ ] **Test getSettings error**: Verify error handling and alert dispatch
- [ ] **Test saveSettings success**: Verify mapping, API call, and return value
- [ ] **Test saveSettings error**: Verify error handling and alert dispatch
- [ ] **Test mapper integration**: Verify correct DTO-domain conversion
- [ ] **Verify alert calls**: Use spy to verify alertService.error() called on errors

**Testing Subtask:**

- [ ] **Run Tests**: Execute `pnpm nx test infrastructure --testFile=settings.service.spec.ts`

**Key Implementation Notes:**

- Use Vitest (NOT Jasmine) for testing
- Mock API client methods using vi.fn()
- Mock alert service to verify error dispatch
- Test both happy path and error scenarios
- Verify error messages are user-friendly
- Follow behavioral testing approach (test observable outcomes)
- Reference PlayerService tests for exact testing patterns

**Test Structure**: Describe blocks for each method, test success and error cases, verify alert service called on errors

</details>

---

## ✅ Success Criteria

> Mark these checkboxes as you validate each criterion.

- [ ] **Domain Models Defined**: All interfaces created in `libs/domain/src/lib/settings/`
- [ ] **Service Contract Created**: ISettingsService interface defines operations
- [ ] **Injection Token Created**: SETTINGS_SERVICE token enables DI
- [ ] **Mappers Implemented**: Bidirectional DTO-domain conversion working
- [ ] **Service Implemented**: SettingsService implements contract with alert-based errors
- [ ] **Providers Configured**: DI providers map token to implementation
- [ ] **All Tests Pass**: Service tests verify API calls, mapping, and alert dispatch
- [ ] **No TypeScript Errors**: All code compiles without errors
- [ ] **Error Alerts Work**: Errors trigger alert notifications like PlayerService

---

## 🧪 Testing Summary

### Testing Approach

This phase focuses on **service layer testing** with behavioral approach:

1. **Model Tests**: Type-checking tests for domain interfaces
2. **Mapper Tests**: Bidirectional conversion and round-trip tests
3. **Service Tests**: API interaction, mapping, and alert-based error handling tests

### Test Types by Task

| Task | Test Type | Focus |
|------|-----------|-------|
| Task 1 | Unit | Model type checking |
| Task 2 | Verification | Contract compilation |
| Task 3 | Verification | Token creation |
| Task 4 | Unit | Mapper functions |
| Task 5 | Unit | Service API calls and alert dispatch |
| Task 6 | Integration | Provider configuration |
| Task 7 | Unit | Comprehensive service testing |

### Testing Framework

- **Unit Tests**: Vitest (NOT Jasmine)
- **Mocking**: vi.fn() for API client and alert service
- **Assertions**: Vitest matchers (expect, toBe, toHaveBeenCalled, etc.)

### Key Testing Principles

- Mock at infrastructure boundary (API client)
- Test observable outcomes (what consumers see)
- Verify error alerts are dispatched correctly
- Test both success and failure scenarios
- Follow PlayerService test patterns exactly

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

- **Previous Phase**: [Phase 1 - Backend API & Type Generation](./SETTINGS_FEATURE_P1.md)
- **Next Phase**: [Phase 3 - Settings Store (Application Layer)](./SETTINGS_FEATURE_P3.md)
- **Feature Overview**: [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md)
- **PlayerService Reference**: [Player Service](../../../libs/infrastructure/src/lib/player/player.service.ts) - Error handling pattern
- **Service Standards**: [Service Standards](../../SERVICE_STANDARDS.md) - Service patterns and error handling
- **Testing Standards**: [Testing Standards](../../TESTING_STANDARDS.md) - Testing approaches

---

_Phase Status: Ready for Implementation_
_Last Updated: 2025-01-11_
_Estimated Effort: 3-4 hours_
