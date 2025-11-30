# Phase 01: Relative URL Migration

## 🎯 Objective

Remove all hardcoded `http://localhost:5168` URLs from the infrastructure layer and replace them with a centralized, environment-aware configuration that uses relative URLs in production and absolute URLs in development.

**Value Delivered**: Production builds use relative URLs enabling the Angular app to be served from any host, while development workflow remains unchanged.

---

## 📚 Required Reading

- [ ] [DISTRIBUTION_PACKAGING_PLAN.md](../../../features/DISTRIBUTION_PACKAGING_PLAN.md) - Section 3.1 "Relative URL Migration"
- [ ] [OVERVIEW_CONTEXT.md](../../../OVERVIEW_CONTEXT.md) - Clean Architecture layers
- [ ] [DOMAIN_STANDARDS.md](../../../DOMAIN_STANDARDS.md) - Contract patterns (if exists)
- [ ] [SERVICE_STANDARDS.md](../../../SERVICE_STANDARDS.md) - Service patterns

---

## 📂 File Structure Overview

```
apps/api/src/TeensyRom.Api/
├── Program.cs                               📝 Modified - SignalR hub routes with /api/ prefix
└── Endpoints/**/*Endpoint.cs                📝 Modified - All routes prefixed with /api/

libs/data-access/api-client/                 🔄 Regenerated - New API routes

libs/domain/src/lib/contracts/
├── api-config.contract.ts                   ✨ New - IApiConfig interface + token
└── index.ts                                 📝 Modified - Export new contract

libs/infrastructure/src/lib/
├── config/
│   ├── api-config.provider.ts               ✨ New - Environment-based provider
│   └── index.ts                             ✨ New - Barrel export
├── device/
│   ├── providers.ts                         📝 Modified - Use API_CONFIG
│   ├── device-logs.service.ts               📝 Modified - Inject API_CONFIG, update hub path
│   └── device-events.service.ts             📝 Modified - Inject API_CONFIG, update hub path
├── storage/
│   └── providers.ts                         📝 Modified - Use API_CONFIG
├── player/
│   └── providers.ts                         📝 Modified - Use API_CONFIG
├── settings/
│   └── providers.ts                         📝 Modified - Use API_CONFIG
├── providers.ts                             📝 Modified - Export API_CONFIG_PROVIDER
└── index.ts                                 📝 Modified - Re-export config
```

---

## 📋 Implementation Tasks

<details>
<summary><h3>Task 0: Add /api/ Prefix to Backend Routes</h3></summary>

**Status**: ✅ **COMPLETE** (2025-11-30)

**Purpose**: Prefix all backend API routes with `/api/` to prevent conflicts with Angular SPA routes.

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-01-000-API-ROUTE-PREFIX`

**Background**: 
Both Angular and the API currently use overlapping routes:
- `/devices` → Angular device management page AND API endpoint
- `/player` → Angular player page AND API endpoint  
- `/settings` → Angular settings page AND API endpoint

Without a prefix, the SPA fallback cannot distinguish between API requests and Angular routes.

**Implementation Subtasks**:

- [x] Update RadEndpoints configuration to use `/api/` prefix globally OR update each endpoint route
- [x] Update all endpoint routes: `/devices/*` → `/api/devices/*`, `/files/*` → `/api/files/*`, etc.
- [x] Update SignalR hub routes: `/logHub` → `/api/logHub`, `/deviceEventHub` → `/api/deviceEventHub`
- [x] Update `/Assets/*` route to `/api/Assets/*` (or keep as-is if no conflict)
- [x] Regenerate OpenAPI spec with new routes
- [x] Regenerate TypeScript API client

**Files to Modify**:
- All endpoint files in `apps/api/src/TeensyRom.Api/Endpoints/**/*Endpoint.cs`
- `apps/api/src/TeensyRom.Api/Program.cs` (SignalR hub routes)
- `openapi-spec.json` (regenerated)
- `libs/data-access/api-client/**` (regenerated)

**Key Consideration**: 
The most efficient approach is to configure a global route prefix in RadEndpoints if supported, rather than updating each endpoint individually.

**Testing Subtask**:
- [x] API endpoints respond at new `/api/*` routes
- [x] SignalR hubs connect at `/api/logHub` and `/api/deviceEventHub`
- [x] Frontend still works after API client regeneration
- [x] No 404 errors for API calls

**Report**: [DISTRIBUTION-PACKAGING-TASK-01-000-REPORT.md](../reports/DISTRIBUTION-PACKAGING-TASK-01-000-REPORT.md)

</details>

---

<details>
<summary><h3>Task 1: Create API Config Contract</h3></summary>

**Status**: ✅ **COMPLETE** (2025-11-30)

**Purpose**: Define a domain contract for API configuration that can be injected into infrastructure services.

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-01-001-API-CONFIG-CONTRACT`

**Implementation Subtasks**:

- [x] Create `IApiConfig` interface with `basePath` and `signalRBasePath` properties
- [x] Create `API_CONFIG` injection token
- [x] Export from `libs/domain/src/lib/contracts/index.ts`

**Key Requirements**:
- Interface should be in domain layer (contracts folder)
- Both paths should be strings (empty string for relative URLs)
- Token should use standard Angular `InjectionToken` pattern

**Testing Subtask**:
- [x] Verify exports compile and are accessible from infrastructure layer

**Report**: [DISTRIBUTION-PACKAGING-TASK-01-001-REPORT.md](../reports/DISTRIBUTION-PACKAGING-TASK-01-001-REPORT.md)

</details>

---

<details>
<summary><h3>Task 2: Create API Config Provider</h3></summary>

**Status**: ✅ **COMPLETE** (2025-11-30)

**Purpose**: Implement the environment-aware provider factory that returns different configurations for development vs production builds.

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-01-002-API-CONFIG-PROVIDER`

**Implementation Subtasks**:

- [x] Create `libs/infrastructure/src/lib/config/` directory
- [x] Implement `provideApiConfig()` factory using Angular's `isDevMode()`
- [x] Create `API_CONFIG_PROVIDER` provider definition
- [x] Create barrel export `libs/infrastructure/src/lib/config/index.ts`
- [x] Export from main infrastructure barrel

**Key Requirements**:
- Use `isDevMode()` from `@angular/core` to detect environment
- Development: `{ basePath: 'http://localhost:5168', signalRBasePath: 'http://localhost:5168' }`
- Production: `{ basePath: '', signalRBasePath: '' }` (empty = relative URLs)

**Testing Subtask**:
- [x] Verify provider can be instantiated
- [x] Verify `isDevMode()` behavior in test environment

**Report**: [DISTRIBUTION-PACKAGING-TASK-01-002-REPORT.md](../reports/DISTRIBUTION-PACKAGING-TASK-01-002-REPORT.md)

</details>

---

<details>
<summary><h3>Task 3: Update API Client Providers</h3></summary>

**Status**: ✅ **COMPLETE** (2025-11-30)

**Purpose**: Modify all API client providers to use injected `API_CONFIG` instead of hardcoded URLs.

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-01-003-UPDATE-PROVIDERS`

**Implementation Subtasks**:

- [x] Update `libs/infrastructure/src/lib/device/providers.ts` - `DEVICES_API_CLIENT_PROVIDER`
- [x] Update `libs/infrastructure/src/lib/storage/providers.ts` - `FILES_API_CLIENT_PROVIDER`
- [x] Update `libs/infrastructure/src/lib/player/providers.ts` - `PLAYER_API_CLIENT_PROVIDER`
- [x] Update `libs/infrastructure/src/lib/settings/providers.ts` - `SETTINGS_API_CLIENT_PROVIDER`
- [x] Update app config to include `API_CONFIG_PROVIDER`

**Key Requirements**:
- Each provider's `useFactory` must inject `API_CONFIG`
- Add `API_CONFIG` to `deps` array for each provider
- Use `apiConfig.basePath` in `Configuration({ basePath: ... })`

**Pattern**:
```typescript
export const DEVICES_API_CLIENT_PROVIDER = {
  provide: DevicesApiService,
  useFactory: (apiConfig: IApiConfig) => {
    const config = new Configuration({ basePath: apiConfig.basePath });
    return new DevicesApiService(config);
  },
  deps: [API_CONFIG],
};
```

**Testing Subtask**:
- [x] Run `pnpm start` - verify API calls still work in development
- [x] Verify no hardcoded `localhost:5168` remains in provider files

**Report**: [DISTRIBUTION-PACKAGING-TASK-01-003-REPORT.md](../reports/DISTRIBUTION-PACKAGING-TASK-01-003-REPORT.md)

</details>

---

<details>
<summary><h3>Task 4: Update SignalR Services</h3></summary>

**Status**: ✅ **COMPLETE** (2025-11-30)

**Purpose**: Modify SignalR hub connections to use injected configuration instead of hardcoded URLs.

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-01-004-UPDATE-SIGNALR-SERVICES`

**Implementation Subtasks**:

- [x] Update `DeviceLogsService` constructor to inject `API_CONFIG`
- [x] Update `DeviceLogsService.connect()` to use `apiConfig.signalRBasePath`
- [x] Update `DeviceEventsService` constructor to inject `API_CONFIG`
- [x] Update `DeviceEventsService.connect()` to use `apiConfig.signalRBasePath`
- [x] Update provider definitions to include `API_CONFIG` in deps

**Key Requirements**:
- Inject using `@Inject(API_CONFIG) private apiConfig: IApiConfig`
- Hub URL pattern: `` `${this.apiConfig.signalRBasePath}/api/logHub` ``
- Ensure providers include `API_CONFIG` in dependency array

**Files to Modify**:
- `libs/infrastructure/src/lib/device/device-logs.service.ts`
- `libs/infrastructure/src/lib/device/device-events.service.ts`
- `libs/infrastructure/src/lib/device/providers.ts` (update deps)

**Testing Subtask**:
- [x] Run application and verify SignalR connections establish
- [x] Check browser DevTools Network tab for correct hub URLs
- [x] Verify device logs and events stream correctly

**Report**: [DISTRIBUTION-PACKAGING-TASK-01-004-REPORT.md](../reports/DISTRIBUTION-PACKAGING-TASK-01-004-REPORT.md)

</details>

---

## 🗂️ Files Modified or Created

**New Files**:
- `libs/domain/src/lib/contracts/api-config.contract.ts`
- `libs/infrastructure/src/lib/config/api-config.provider.ts`
- `libs/infrastructure/src/lib/config/index.ts`

**Modified Files**:
- `libs/domain/src/lib/contracts/index.ts`
- `libs/infrastructure/src/lib/device/providers.ts`
- `libs/infrastructure/src/lib/storage/providers.ts`
- `libs/infrastructure/src/lib/player/providers.ts`
- `libs/infrastructure/src/lib/settings/providers.ts`
- `libs/infrastructure/src/lib/device/device-logs.service.ts`
- `libs/infrastructure/src/lib/device/device-events.service.ts`
- `libs/infrastructure/src/lib/providers.ts`
- `libs/infrastructure/src/index.ts`

---

## 📝 Testing Summary

**Manual Testing** (after all tasks complete):

1. **Development Mode**:
   - Run `pnpm start` 
   - Open `http://localhost:4200`
   - Verify API calls go to `http://localhost:5168`
   - Verify SignalR connects to `http://localhost:5168/logHub` and `/deviceEventHub`
   - All device functionality works

2. **Production Build Verification**:
   - Run `pnpm nx build teensyrom-ui --configuration=production`
   - Inspect generated JavaScript for URL patterns
   - Verify no hardcoded `localhost:5168` in production bundles

**Automated Tests**:
- Run `pnpm nx test infrastructure` - all existing tests pass
- No new unit tests required (integration verified via manual testing)

---

## ✅ Success Criteria

- [ ] All backend API routes prefixed with `/api/` (e.g., `/api/devices`, `/api/files`)
- [ ] SignalR hubs accessible at `/api/logHub` and `/api/deviceEventHub`
- [ ] TypeScript API client regenerated with new routes
- [ ] All hardcoded `http://localhost:5168` removed from infrastructure code
- [ ] `API_CONFIG` contract exists in domain layer
- [ ] `API_CONFIG_PROVIDER` exists in infrastructure layer
- [ ] Development server (`pnpm start`) works without changes to developer workflow
- [ ] Production build uses empty basePath (relative URLs)
- [ ] All existing unit tests pass
- [ ] SignalR connections work in development mode
- [ ] No TypeScript errors or ESLint violations

---

## 📝 Notes & Considerations

### Why /api/ Prefix is Required

The SPA fallback pattern (`MapFallbackToFile("index.html")`) catches ALL unmatched routes. Without a distinguishing prefix, there's ambiguity:

| Route | Angular Route? | API Route? | Conflict! |
|-------|---------------|------------|-----------|
| `/devices` | ✅ Device page | ✅ List devices | ⚠️ |
| `/player` | ✅ Player page | ✅ Player controls | ⚠️ |
| `/settings` | ✅ Settings page | ✅ Get/save settings | ⚠️ |

With `/api/` prefix:
- `/devices` → Unmatched → SPA fallback → Angular handles it
- `/api/devices` → Matched → API handles it

### Design Decisions

- **`/api/` prefix**: Industry standard, clear separation between SPA and API
- **`isDevMode()` over environment files**: Angular's built-in function is more reliable and doesn't require maintaining separate environment configurations
- **Empty string for production**: Relative URLs (`/api/devices/*`) work when Angular is served from same origin as API
- **Domain contract pattern**: Aligns with existing Clean Architecture where infrastructure depends on domain contracts

### Potential Issues

- **E2E Tests**: Cypress tests use hardcoded URLs in `api.constants.ts` - these will need updating to include `/api/` prefix
- **OpenAPI spec**: Must be regenerated after backend route changes
- **API Client**: Must be regenerated after OpenAPI spec changes

### Future Enhancements

- Could add additional config properties (timeout settings, retry policies) to `IApiConfig`
- Could expose configuration for external API URL override (advanced deployment scenarios)
