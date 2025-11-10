# Phase 2: Settings Infrastructure Layer - Angular HTTP Service Integration

## 🎯 Objective

Create the infrastructure layer for settings management by implementing an Angular service that wraps the API client generated from the backend endpoints. This service will provide the domain contract implementation that the application layer can depend on, following Clean Architecture principles with proper error handling and type safety.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [SETTINGS_FEATURE_P1](./SETTINGS_FEATURE_P1.md) - Backend endpoints that this phase integrates with
- [ ] [API Client Generation](../../API_CLIENT_GENERATION.md) - Understanding the TypeScript API client

**Standards & Guidelines:**

- [ ] [Service Standards](../../SERVICE_STANDARDS.md) - Infrastructure service patterns
- [ ] [Logging Standards](../../LOGGING_STANDARDS.md) - Operational logging patterns
- [ ] [Backend Architecture](../../BACKEND_ARCHITECTURE.md) - Understanding API integration points

**Reference Implementations:**

- [ ] `libs/infrastructure/src/lib/player/player.service.ts` - PlayerService as reference pattern
- [ ] `libs/infrastructure/src/lib/player/providers.ts` - Service provider patterns
- [ ] `libs/domain/src/lib/contracts/player.contract.ts` - Domain contract interface patterns
- [ ] `libs/data-access/api-client/src/lib/apis/` - Generated API client services

---

## 📂 File Structure Overview

```
libs/domain/src/lib/
├── contracts/
│   ├── settings.contract.ts                                      ✨ New - ISettingsService domain contract
│   └── index.ts                                                  📝 Modified - Export settings contract
└── index.ts                                                      📝 Modified - Export contracts

libs/infrastructure/src/lib/
├── settings/
│   ├── settings.service.ts                                       ✨ New - SettingsService implementation
│   ├── settings.service.spec.ts                                  ✨ New - Service unit tests
│   └── providers.ts                                              ✨ New - DI providers configuration
└── index.ts                                                      📝 Modified - Export settings service

libs/data-access/api-client/src/lib/apis/
└── SettingsApiService.ts                                         ✨ Generated - TypeScript API client (via Phase 1)
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>Task 1: Generate TypeScript API Client</h3></summary>

**Purpose**: Generate TypeScript API client from the backend OpenAPI specification created in Phase 1.

**Related Documentation:**
- [API Client Generation](../../API_CLIENT_GENERATION.md) - Client generation process
- [SETTINGS_FEATURE_P1](./SETTINGS_FEATURE_P1.md) - Backend endpoints providing the OpenAPI spec

**Implementation Subtasks:**

- [ ] **Build backend API**: Ensure Phase 1 backend is built and running
  - Run `dotnet build` in `apps/api/src/TeensyRom.Api.csproj`
  - Verify endpoints accessible at `/scalar/v1`
- [ ] **Generate TypeScript client**: Run API client generation
  - Execute from `src/TeensyRom.Api/ClientApp/teensyrom-nx/`: `pnpm run generate:api-client`
  - Verify `SettingsApiService.ts` created in `libs/data-access/api-client/src/lib/apis/`
  - Verify models created: `GetSettingsResponse.ts`, `SaveSettingsRequest.ts`, etc.
- [ ] **Review generated types**: Inspect generated TypeScript models
  - Verify DTO structure matches backend models
  - Check for proper type safety and nullability
  - Confirm enum types generated correctly

**Testing Subtask:**

- [ ] **Verify Generation**: Confirm generated files compile without TypeScript errors

**Key Implementation Notes:**

- API client generation is part of the build process - ensure backend is built first
- Generated files should not be manually edited - regenerate if backend changes
- Check `openapi.json` or `openapi.yaml` if generation fails
- Generated services use RxJS Observables for HTTP operations

</details>

---

<details open>
<summary><h3>Task 2: Define Settings Domain Contract</h3></summary>

**Purpose**: Create the domain contract interface that the infrastructure service will implement, defining the application's view of settings operations without infrastructure details.

**Related Documentation:**
- [Service Standards](../../SERVICE_STANDARDS.md) - Domain contract patterns
- `libs/domain/src/lib/contracts/player.contract.ts` - PlayerService contract as reference

**Implementation Subtasks:**

- [ ] **Create `ISettingsService` interface** in `libs/domain/src/lib/contracts/settings.contract.ts`
  - Method: `getSettings(): Observable<TeensySettings>` - Retrieve current settings
  - Method: `saveSettings(settings: TeensySettings): Observable<TeensySettings>` - Persist settings changes
  - Method: `resetToDefaults(): Observable<TeensySettings>` - Reset all settings to defaults (optional for Phase 2)
  - Add JSDoc documentation explaining each method's purpose and behavior
- [ ] **Define `SETTINGS_SERVICE` injection token**: Create `InjectionToken<ISettingsService>` for Angular DI
- [ ] **Export contract**: Add exports to `libs/domain/src/lib/contracts/index.ts`
- [ ] **Update domain barrel export**: Add contract export to `libs/domain/src/index.ts`

**Testing Subtask:**

- [ ] **Verify Types**: Confirm interface compiles and TypeScript recognizes all methods

**Key Implementation Notes:**

- Contract uses domain models (`TeensySettings`), not DTOs from API client
- Methods return `Observable` for reactive patterns consistent with Angular best practices
- Contract focuses on **what** (operations), not **how** (implementation)
- No infrastructure concerns (HTTP, API endpoints) should leak into contract

**Critical Type Definition**:

```typescript
import { Observable } from 'rxjs';
import { TeensySettings } from '../models';

export interface ISettingsService {
  /** Retrieves current application settings from server */
  getSettings(): Observable<TeensySettings>;
  
  /** Persists settings changes to server */
  saveSettings(settings: TeensySettings): Observable<TeensySettings>;
}

export const SETTINGS_SERVICE = new InjectionToken<ISettingsService>('ISettingsService');
```

</details>

---

<details open>
<summary><h3>Task 3: Implement SettingsService with TDD</h3></summary>

**Purpose**: Implement the infrastructure service that fulfills the domain contract by wrapping the generated API client with proper error handling, logging, and domain model mapping.

**Related Documentation:**
- [Service Standards](../../SERVICE_STANDARDS.md) - Service implementation patterns
- [Logging Standards](../../LOGGING_STANDARDS.md) - Logging patterns for operations
- `libs/infrastructure/src/lib/player/player.service.ts` - PlayerService implementation reference

**Implementation Focus**: Create a thin wrapper around `SettingsApiService` that maps between API DTOs and domain models.

**Behaviors Being Built**:

- Call SettingsApiService to retrieve current settings
- Map API DTOs to domain models (`TeensySettings`)
- Handle HTTP errors gracefully with meaningful error messages
- Log operations for observability (start, success, error)
- Return typed Observables for reactive consumption

#### Step 3A: Write Failing Tests

- [ ] **Create `settings.service.spec.ts`**: Set up test infrastructure with Vitest
- [ ] **Test: getSettings() Success**: Verify service calls API and returns mapped domain model
- [ ] **Test: getSettings() Error**: Verify HTTP errors handled and logged appropriately
- [ ] **Test: saveSettings() Success**: Verify service calls API with mapped DTO and returns domain model
- [ ] **Test: saveSettings() Error**: Verify validation/server errors handled gracefully
- [ ] **Test: Domain Model Mapping**: Verify API DTOs correctly mapped to/from domain models
- [ ] **Test: Logging Integration**: Verify operations logged with appropriate LogType values
- [ ] Verify tests fail (red phase)

#### Step 3B: Implement to Pass Tests

- [ ] **Create `SettingsService` class** in `libs/infrastructure/src/lib/settings/settings.service.ts`
  - Implement `ISettingsService` interface
  - Inject `SettingsApiService` via constructor
- [ ] **Implement `getSettings()` method**:
  - Call `settingsApiService.getSettings()`
  - Use `pipe(map())` to transform `GetSettingsResponse` to `TeensySettings`
  - Add `catchError()` for HTTP error handling
  - Add logging: `LogType.Start`, `LogType.NetworkRequest`, `LogType.Success`/`LogType.Error`
- [ ] **Implement `saveSettings()` method**:
  - Map domain `TeensySettings` to `SaveSettingsRequest` DTO
  - Call `settingsApiService.saveSettings(request)`
  - Use `pipe(map())` to transform response back to `TeensySettings`
  - Add `catchError()` for validation/server error handling
  - Add comprehensive logging for operation lifecycle
- [ ] **Create mapping helper methods** (private):
  - `mapToDto(settings: TeensySettings): SaveSettingsRequest` - Domain to DTO
  - `mapFromDto(dto: GetSettingsResponse): TeensySettings` - DTO to domain
  - Handle nested objects: Connection, Player, FileTransfer, Search, App settings
- [ ] Verify tests pass (green phase)

**Testing Subtask:**

- [ ] **Run Tests**: Execute `npx nx test infrastructure` and verify all tests pass
- [ ] **Coverage Check**: Ensure >90% coverage on service implementation

**Key Implementation Notes:**

- Service is stateless - no caching or state management (that's application layer's job)
- Use RxJS operators (`map`, `catchError`, `tap`) for transformations and logging
- Preserve HTTP error information in custom error messages
- Log with consistent emoji-based `LogType` system
- Keep service thin - just API integration, mapping, and error handling

**Behaviors to Test:**

- [ ] Service successfully retrieves settings and maps to domain model
- [ ] Service successfully saves settings and returns updated domain model
- [ ] HTTP errors produce meaningful error messages without throwing
- [ ] Validation errors from backend are properly propagated
- [ ] Operations are logged at appropriate lifecycle points
- [ ] Domain model mapping preserves all settings properties correctly

</details>

---

<details open>
<summary><h3>Task 4: Create Service Providers Configuration</h3></summary>

**Purpose**: Set up Angular dependency injection providers to make the settings service available throughout the application.

**Related Documentation:**
- [Service Standards](../../SERVICE_STANDARDS.md) - Provider configuration patterns
- `libs/infrastructure/src/lib/player/providers.ts` - Provider pattern reference

**Implementation Subtasks:**

- [ ] **Create `providers.ts`** in `libs/infrastructure/src/lib/settings/`
  - Define `provideSettingsService()` function returning `Provider[]`
  - Provide `SettingsApiService` from API client library
  - Provide `SettingsService` implementation bound to `SETTINGS_SERVICE` token
  - Add JSDoc documentation explaining provider setup
- [ ] **Export providers** in `libs/infrastructure/src/index.ts`
- [ ] **Document usage** in provider file comments:
  - Where to call `provideSettingsService()` (typically in app config)
  - Dependencies that must be available (HttpClient, API configuration)

**Testing Subtask:**

- [ ] **Verify DI Setup**: Create test that obtains service via injection token

**Key Implementation Notes:**

- Use `useClass` to bind interface token to implementation class
- Ensure `SettingsApiService` is provided before `SettingsService` (dependency order)
- Consider using `providedIn: 'root'` for singleton behavior if appropriate
- Follow existing provider patterns from PlayerService for consistency

**Critical Provider Pattern**:

```typescript
import { Provider } from '@angular/core';
import { SETTINGS_SERVICE } from '@teensyrom-nx/domain';
import { SettingsApiService } from '@teensyrom-nx/api-client';
import { SettingsService } from './settings.service';

export function provideSettingsService(): Provider[] {
  return [
    SettingsApiService,
    {
      provide: SETTINGS_SERVICE,
      useClass: SettingsService,
    },
  ];
}
```

</details>

---

<details open>
<summary><h3>Task 5: Integration Testing with Mock API</h3></summary>

**Purpose**: Create integration tests that verify the service works correctly with mocked HTTP responses, validating the full request/response lifecycle.

**Related Documentation:**
- [Service Standards](../../SERVICE_STANDARDS.md) - Integration testing patterns
- [MSW (Mock Service Worker)](https://mswjs.io/) - HTTP mocking library (if used)

**Implementation Subtasks:**

- [ ] **Set up HTTP mocking infrastructure**: 
  - Configure test environment to intercept HTTP calls
  - Create mock handlers for `/api/settings` GET and POST endpoints
  - Define sample response payloads matching backend DTOs
- [ ] **Test: getSettings() with mock response**:
  - Mock successful GET `/api/settings` with sample settings
  - Verify service maps response correctly to domain model
  - Assert all nested settings objects populated correctly
- [ ] **Test: saveSettings() with mock response**:
  - Mock successful POST `/api/settings` with echo response
  - Verify service sends correctly formatted request body
  - Verify service maps response back to domain model
- [ ] **Test: HTTP error scenarios**:
  - Mock 400 validation error response
  - Mock 500 server error response
  - Mock network failure (timeout, connection refused)
  - Verify service handles each gracefully with proper error messages
- [ ] **Test: Logging behavior**:
  - Spy on console logging functions
  - Verify appropriate `LogType` values used at operation lifecycle points
  - Verify error logging includes relevant context

**Testing Subtask:**

- [ ] **Run Integration Tests**: Execute all integration tests and verify passes
- [ ] **Coverage Verification**: Ensure error paths and logging are covered

**Key Implementation Notes:**

- Integration tests validate the full service+API client stack
- Use realistic API response payloads from backend OpenAPI examples
- Test both success and failure paths comprehensively
- Verify logging happens at correct lifecycle points

**Behaviors to Test:**

- [ ] Service correctly handles successful GET requests with full settings payload
- [ ] Service correctly handles successful POST requests with validation
- [ ] Service transforms backend validation errors into meaningful client errors
- [ ] Service logs operations at appropriate lifecycle stages
- [ ] Service handles network failures gracefully without crashing
- [ ] Nested settings objects (connection, player, search, etc.) mapped correctly

</details>

---

## ✅ Success Criteria

> **Mark checkboxes as criteria are met**. All items must be checked before phase is complete.

**Functional Requirements:**

- [ ] All implementation tasks completed and checked off
- [ ] All subtasks within each task completed
- [ ] Code follows [Service Standards](../../SERVICE_STANDARDS.md) patterns
- [ ] TypeScript API client generated successfully from Phase 1 backend
- [ ] Domain contract (`ISettingsService`) defined with clear interface

**Testing Requirements:**

- [ ] All testing subtasks completed within each task
- [ ] Unit tests written alongside implementation (TDD approach)
- [ ] Integration tests validate HTTP mocking and full lifecycle
- [ ] All tests passing with no failures
- [ ] Test coverage meets or exceeds 90% for service implementation

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes with no errors (`pnpm nx lint infrastructure`)
- [ ] Service properly registered in Angular DI system
- [ ] Logging integrated consistently with `LogType` system

**Documentation:**

- [ ] Inline code comments added for complex mapping logic
- [ ] JSDoc documentation complete for public service methods
- [ ] Provider setup documented with usage instructions

**Ready for Next Phase:**

- [ ] All success criteria met
- [ ] No known bugs or issues
- [ ] Service contract defined and ready for application layer consumption (Phase 3)
- [ ] Infrastructure layer tested and stable for state management integration

---

## 📝 Notes & Considerations

### Design Decisions

- **Observable-Based API**: Returns RxJS Observables for consistency with Angular ecosystem
- **Stateless Service**: No caching or state management - purely infrastructure concern
- **Domain Model Mapping**: Service boundary transforms between API DTOs and domain models
- **Error Handling**: Catches HTTP errors and transforms to meaningful domain errors

### Implementation Constraints

- **Generated Client**: API client is generated, not hand-written - must regenerate if backend changes
- **RxJS Dependency**: Service uses RxJS Observables - consumers must handle async operations
- **No Caching**: Settings retrieved fresh on every call - caching is application layer concern

### Future Enhancements

- **Optimistic Updates**: Return cached settings immediately, then sync with server
- **Offline Support**: Queue settings changes when offline, sync when reconnected
- **Settings Diff**: Only send changed settings properties to backend
- **Settings Validation**: Client-side validation before calling API

### External References

- [RxJS Documentation](https://rxjs.dev/) - Observable patterns and operators
- [Angular HTTP Client](https://angular.io/guide/http) - Angular HTTP integration
- [OpenAPI Generator](https://openapi-generator.tech/) - API client generation tool

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

- API client generation quirks or type mapping issues
- Backend DTO structure differences from domain models
- HTTP error response format details
- Logging integration challenges

---

## 💡 Agent Implementation Guide

> **Instructions for AI agents implementing this phase**

### Prerequisites

- Phase 1 (Backend) must be complete and backend API running
- Understand domain contract pattern from PlayerService reference
- Familiarize with generated API client structure
- Review RxJS operators for HTTP transformation

### Key Patterns to Follow

1. **Domain Contract First**:
   - Define interface in domain layer
   - Use injection token for DI
   - Contract uses domain models, not DTOs

2. **Service Implementation**:
   - Thin wrapper around API client
   - Map DTOs ↔ domain models
   - Add logging and error handling
   - Return Observables for reactive patterns

3. **TDD Approach**:
   - Write tests first
   - Mock HTTP with realistic payloads
   - Test success and error paths
   - Verify logging behavior

4. **Provider Configuration**:
   - Export provider function
   - Include API client service
   - Bind implementation to interface token

### Common Pitfalls to Avoid

- Don't skip domain contract - directly using API client couples layers
- Don't add business logic - keep service thin (just API + mapping)
- Don't ignore error handling - HTTP failures must be graceful
- Don't skip logging - operational visibility is critical
- Don't cache in infrastructure - that's application layer responsibility

### Testing Strategy

- Unit tests: Mock SettingsApiService, test mapping and error handling
- Integration tests: Mock HTTP, test full request/response cycle
- Coverage: >90% on service implementation
- Verify: Logging calls with correct LogType values

---

_Last Updated: 2025-11-10_
_Phase Author: Coding Agent_
_Status: Ready for Implementation_
