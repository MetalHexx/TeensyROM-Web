# Settings Feature - Phase Planning Overview

## Executive Summary

This document provides an overview of the Settings Feature implementation, broken down into 4 comprehensive phases that follow Clean Architecture principles and align with established project patterns from the Player and Device features.

---

## Phase Structure

The Settings Feature is organized into 4 sequential phases, each building on the previous:

### [Phase 1: Backend Foundation](./SETTINGS_FEATURE_P1.md)
**Layer**: Backend API (.NET 9 Web API)  
**Estimated Effort**: 6-8 hours

Implements RadEndpoints-based GET and POST endpoints for settings management with comprehensive validation and integration testing.

**Key Deliverables**:
- DTO models for all settings sections (Connection, Player, FileTransfer, Search, App)
- FluentValidation validators for input validation
- Bidirectional RadEndpoints mappers
- GET `/settings` endpoint
- POST `/settings` endpoint
- Comprehensive integration tests (>90% coverage)
- Startup settings initialization

**Dependencies**: None (foundation phase)

---

### [Phase 2: Infrastructure Layer](./SETTINGS_FEATURE_P2.md)
**Layer**: Angular Infrastructure (TypeScript Service)  
**Estimated Effort**: 4-6 hours

Creates Angular service wrapper that implements domain contract for settings operations, integrating with the backend API via generated TypeScript client.

**Key Deliverables**:
- Generated TypeScript API client (`SettingsApiService`)
- `ISettingsService` domain contract interface
- `SettingsService` implementation with error handling and logging
- Service DI providers configuration
- Unit and integration tests with HTTP mocking

**Dependencies**: Phase 1 (Backend API must be complete)

---

### [Phase 3: Application Layer](./SETTINGS_FEATURE_P3.md)
**Layer**: Angular Application (NgRx Signal Store)  
**Estimated Effort**: 8-10 hours

Implements reactive state management using NgRx Signal Store with async/await patterns, providing the foundation for UI components to consume.

**Key Deliverables**:
- `SettingsStore` with NgRx Signal Store pattern
- State structure with loading/dirty tracking
- Helper functions for state mutations (using `updateState` with `actionMessage`)
- Selectors (computed signals) for reactive data access
- Actions (async operations) for load/save/update/reset
- Comprehensive store testing (>95% coverage)

**Dependencies**: Phase 2 (Infrastructure service must be complete)

**Critical Standards**: [STATE_STANDARDS.md](../../STATE_STANDARDS.md) - Must follow NgRx Signal Store patterns with `updateState` and action message tracking

---

### [Phase 4: Feature Layer](./SETTINGS_FEATURE_P4.md)
**Layer**: Angular Feature (UI Components)  
**Estimated Effort**: 10-12 hours

Creates the user-facing components for viewing, editing, and persisting settings through an intuitive tabbed interface.

**Key Deliverables**:
- Settings feature library (`@teensyrom-nx/features/settings`)
- `SettingsViewComponent` (smart container)
- Settings form components (Connection, Player, Search, FileTransfer)
- `SettingsToolbarComponent` with save/reset actions
- Settings route and navigation integration
- E2E tests for full user workflows

**Dependencies**: Phase 3 (Application layer store must be complete)

---

## Architecture Overview

### Clean Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│  Phase 4: Feature Layer (Angular Components)            │
│  - SettingsViewComponent (smart)                        │
│  - Form components (dumb)                               │
│  - Toolbar component                                    │
└────────────────┬────────────────────────────────────────┘
                 │ consumes
┌────────────────▼────────────────────────────────────────┐
│  Phase 3: Application Layer (State Management)          │
│  - SettingsStore (NgRx Signal Store)                    │
│  - Actions (load, save, update, reset)                  │
│  - Selectors (computed signals)                         │
└────────────────┬────────────────────────────────────────┘
                 │ depends on
┌────────────────▼────────────────────────────────────────┐
│  Phase 2: Infrastructure Layer (HTTP Service)           │
│  - SettingsService (implements ISettingsService)        │
│  - API client wrapper with error handling               │
│  - Domain model mapping                                 │
└────────────────┬────────────────────────────────────────┘
                 │ calls
┌────────────────▼────────────────────────────────────────┐
│  Phase 1: Backend API (RadEndpoints)                    │
│  - GET /settings (retrieve current settings)            │
│  - POST /settings (save settings changes)               │
│  - DTOs, Validators, Mappers                            │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

**Read Flow** (Loading Settings):
```
UI Component → SettingsStore.loadSettings() → SettingsService.getSettings() 
→ SettingsApiService (HTTP GET) → Backend API → DTOs mapped to domain models 
→ Store state updated → Computed signals trigger UI update
```

**Write Flow** (Saving Settings):
```
UI Form → SettingsStore.saveSettings() → Domain model mapped to DTOs 
→ SettingsService.saveSettings() → SettingsApiService (HTTP POST) 
→ Backend API validates & persists → Response mapped back 
→ Store state updated (clear dirty flag) → UI reflects saved state
```

---

## Key Standards & Patterns

### Backend (Phase 1)
- **RadEndpoints**: Minimal API pattern with automatic validation
- **FluentValidation**: Comprehensive input validation
- **DTO Mapping**: Clean separation between API contracts and domain models
- **Integration Testing**: TestContainers and endpoint fixture patterns

### Infrastructure (Phase 2)
- **Domain Contracts**: `ISettingsService` interface defines operations
- **Service Pattern**: Thin wrapper around generated API client
- **Error Handling**: Graceful HTTP error transformation
- **Logging**: Emoji-based `LogType` system for operational visibility

### Application (Phase 3) - CRITICAL
- **NgRx Signal Store**: Custom features pattern with `withState`, `withMethods`
- **Async/Await**: Deterministic Promise resolution (NOT RxJS in store methods)
- **updateState with actionMessage**: **REQUIRED** for Redux DevTools correlation
- **Helper Functions**: All accept `actionMessage` as final parameter
- **Action Organization**: One file per action, grouped in custom feature
- **Selector Organization**: One file per selector, return computed signals

### Feature (Phase 4)
- **Smart/Dumb Split**: Container smart component, forms are dumb
- **Reactive Forms**: Angular forms with validation
- **Material Design**: Consistent UI with Angular Material components
- **Accessibility**: WCAG 2.1 AA compliance with proper ARIA attributes

---

## Reference Implementations

Each phase document links to relevant reference implementations:

- **Backend**: `LaunchRandomEndpoint`, `TeensySettings`, `SettingsService`
- **Infrastructure**: `PlayerService`, domain contracts
- **Application**: `StorageStore`, storage actions/selectors/helpers
- **Feature**: Player/Device feature components, shared component library

---

## Testing Strategy

### Phase 1: Backend
- **Integration Tests**: NUnit with endpoint fixture
- **Coverage**: >90% on endpoints, validators, mappers
- **Focus**: API contracts, validation, persistence

### Phase 2: Infrastructure
- **Unit Tests**: Vitest with mocked API client
- **Integration Tests**: HTTP mocking with MSW
- **Coverage**: >90% on service implementation
- **Focus**: Error handling, logging, domain mapping

### Phase 3: Application
- **Unit Tests**: Vitest with mocked infrastructure service
- **Store Tests**: Full store behavior with state transitions
- **Coverage**: >95% on store, actions, selectors, helpers
- **Focus**: State consistency, error recovery, Redux DevTools tracking

### Phase 4: Feature
- **Component Tests**: Vitest with mocked store
- **E2E Tests**: Cypress/Playwright for full workflows
- **Coverage**: >80% on component logic
- **Focus**: User interactions, validation, accessibility

---

## Critical Implementation Notes

### Phase 3 (Application Layer) - SPECIAL ATTENTION

**The most critical phase for following standards**:

1. **MUST use `updateState()` from `@angular-architects/ngrx-toolkit`**
   - ❌ NEVER use `patchState()` from `@ngrx/signals`
   - ✅ Reason: Redux DevTools correlation requires `actionMessage` parameter

2. **MUST create action message in every action**:
   ```typescript
   const actionMessage = createAction('action-name'); // kebab-case
   ```

3. **MUST pass actionMessage to ALL helper functions**:
   ```typescript
   setLoadingSettings(store, actionMessage);
   setSettingsLoaded(store, settings, actionMessage);
   ```

4. **Helper functions MUST accept actionMessage as final parameter**:
   ```typescript
   export function setLoadingSettings(
     store: WritableStore<SettingsState>,
     actionMessage: string  // REQUIRED
   ): void {
     updateState(store, actionMessage, (state) => ({
       isLoading: true,
       error: null,
     }));
   }
   ```

**Why This Matters**: Without action messages, Redux DevTools cannot correlate related state mutations, making debugging impossible. This was a critical bug discovered in Phase 3 of Player Domain implementation.

---

## Dependencies Between Phases

- **Phase 2** depends on **Phase 1** completing (requires backend API)
- **Phase 3** depends on **Phase 2** completing (requires infrastructure service)
- **Phase 4** depends on **Phase 3** completing (requires application store)

**Each phase must be fully complete and tested before starting the next phase.**

---

## Estimated Total Effort

- **Phase 1**: 6-8 hours
- **Phase 2**: 4-6 hours  
- **Phase 3**: 8-10 hours
- **Phase 4**: 10-12 hours

**Total**: 28-36 hours (approximately 4-5 working days)

---

## Success Criteria for Feature Completion

All phases complete when:

- ✅ Backend API endpoints operational and tested
- ✅ TypeScript API client generated successfully
- ✅ Infrastructure service tested with HTTP mocking
- ✅ NgRx Signal Store implemented with proper patterns
- ✅ UI components functional and accessible
- ✅ E2E tests validate full user workflows
- ✅ All tests passing (>90% coverage across layers)
- ✅ Feature deployed and accessible via navigation
- ✅ Redux DevTools tracking working correctly

---

## Next Steps

1. **Start with Phase 1**: Implement backend foundation first
2. **Generate API Client**: After Phase 1, generate TypeScript client for Phase 2
3. **Follow Standards**: Each phase references specific standards documents
4. **Test Continuously**: Write tests alongside implementation (TDD)
5. **Review Redux DevTools**: Verify action message tracking in Phase 3

---

## Questions or Issues?

- **Backend**: Review [BACKEND_ARCHITECTURE.md](../../BACKEND_ARCHITECTURE.md)
- **State Management**: Review [STATE_STANDARDS.md](../../STATE_STANDARDS.md) - **CRITICAL**
- **Testing**: Review [STORE_TESTING.md](../../STORE_TESTING.md)
- **Components**: Review [COMPONENT_LIBRARY.md](../../COMPONENT_LIBRARY.md)
- **Reference**: Check Player/Device features for similar patterns

---

_Last Updated: 2025-11-10_
_Planning Author: Coding Agent_
_Status: Ready for Implementation_
