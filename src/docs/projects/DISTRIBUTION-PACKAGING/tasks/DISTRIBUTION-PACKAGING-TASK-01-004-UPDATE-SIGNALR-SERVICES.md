# Task Handoff: Update SignalR Services

## 📋 Task Identity

**Task ID**: DISTRIBUTION-PACKAGING-TASK-01-004-UPDATE-SIGNALR-SERVICES  
**Task Name**: Update SignalR Hub URLs to Use API_CONFIG  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small-Medium

---

## 🎯 Objective

**What**: Modify SignalR service classes to inject `API_CONFIG` and use it for hub connection URLs.

**Why**: Removes the last hardcoded `localhost:5168` references, completing the URL migration for Phase 01.

**Success Criteria**:
- [ ] `DeviceLogsService` injects `API_CONFIG` and uses `signalRBasePath`
- [ ] `DeviceEventsService` injects `API_CONFIG` and uses `signalRBasePath`
- [ ] Provider definitions updated with `API_CONFIG` in deps
- [ ] SignalR connections establish successfully in development
- [ ] No hardcoded `localhost:5168` in service files

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- DISTRIBUTION-PACKAGING-TASK-01-001-API-CONFIG-CONTRACT: `IApiConfig` and `API_CONFIG` token exist
- DISTRIBUTION-PACKAGING-TASK-01-002-API-CONFIG-PROVIDER: `API_CONFIG_PROVIDER` exists
- DISTRIBUTION-PACKAGING-TASK-01-003-UPDATE-PROVIDERS: API_CONFIG_PROVIDER included

**Dependencies**:
- `@teensyrom-nx/domain` - for `API_CONFIG`, `IApiConfig`
- `@microsoft/signalr` - for SignalR client

**Constraints**:
- Must maintain existing service functionality
- Constructor signature change requires provider update

---

## 📂 File Scope

**Files to Modify**:
- `libs/infrastructure/src/lib/device/device-logs.service.ts`
- `libs/infrastructure/src/lib/device/device-events.service.ts`
- `libs/infrastructure/src/lib/device/providers.ts` (update deps for logs/events providers)

**Files to Review**:
- Task 01-003 report for provider pattern reference

---

## 📋 Implementation Guidance

**Standards to Follow**:
- [SERVICE_STANDARDS.md](../../../../SERVICE_STANDARDS.md) - Service patterns
- [CODING_STANDARDS.md](../../../../CODING_STANDARDS.md) - TypeScript conventions

**Key Requirements**:

1. **Update DeviceLogsService**:
   - Import `API_CONFIG`, `IApiConfig` from `@teensyrom-nx/domain`
   - Add `@Inject(API_CONFIG) private apiConfig: IApiConfig` to constructor
   - Change hub URL in `connect()` to use template literal: `` `${this.apiConfig.signalRBasePath}/logHub` ``

2. **Update DeviceEventsService**:
   - Same pattern as DeviceLogsService
   - Hub URL: `` `${this.apiConfig.signalRBasePath}/deviceEventHub` ``

3. **Update provider definitions**:
   - Add `API_CONFIG` to deps array for both service providers

**Current Code Pattern** (to change):

```typescript
// In connect() method
this.hubConnection = new signalR.HubConnectionBuilder()
  .withUrl('http://localhost:5168/logHub')  // ← hardcoded
  .withAutomaticReconnect()
  .build();
```

**Updated Pattern**:

```typescript
// In constructor
constructor(
  deviceService: DevicesApiService,
  @Inject(ALERT_SERVICE) alertService: IAlertService,
  @Inject(API_CONFIG) private apiConfig: IApiConfig  // ← new
) { ... }

// In connect() method
this.hubConnection = new signalR.HubConnectionBuilder()
  .withUrl(`${this.apiConfig.signalRBasePath}/logHub`)  // ← dynamic
  .withAutomaticReconnect()
  .build();
```

**Provider Update**:

```typescript
export const DEVICE_LOGS_SERVICE_PROVIDER = {
  provide: DEVICE_LOGS_SERVICE,
  useClass: DeviceLogsService,
  deps: [DevicesApiService, ALERT_SERVICE, API_CONFIG],  // ← add API_CONFIG
};
```

**Anti-Patterns to Avoid**:
- Don't forget to update provider deps
- Don't use `this.apiConfig` before it's injected
- Don't change hub path (only the base URL)

---

## 🧪 Testing Requirements

**Manual Testing**:
- [ ] Run `pnpm start` with backend running
- [ ] Open browser DevTools → Network tab → WS (WebSocket)
- [ ] Verify SignalR connects to `ws://localhost:5168/logHub`
- [ ] Verify SignalR connects to `ws://localhost:5168/deviceEventHub`
- [ ] Device logs appear in UI when device connected
- [ ] Device events update (connection state changes)

**Verification**:
- [ ] `pnpm nx build infrastructure` succeeds
- [ ] `pnpm nx lint infrastructure` passes
- [ ] Grep for `localhost:5168` returns no matches in service files

**Final Phase 01 Verification**:
- [ ] No `localhost:5168` in any infrastructure TypeScript files
- [ ] Application fully functional in development mode
- [ ] All API calls and SignalR connections work

---

## 📚 Reference Materials

**Related Documentation**:
- [DISTRIBUTION_PACKAGING_PLAN.md](../../../../features/DISTRIBUTION_PACKAGING_PLAN.md) - Section 3.1.4
- [Phase 01 Plan](../phases/DISTRIBUTION-PACKAGING-PHASE-01-RELATIVE-URL-MIGRATION.md)

**Related Tasks**:
- DISTRIBUTION-PACKAGING-TASK-01-001-API-CONFIG-CONTRACT: Provides interface
- DISTRIBUTION-PACKAGING-TASK-01-002-API-CONFIG-PROVIDER: Provides provider
- DISTRIBUTION-PACKAGING-TASK-01-003-UPDATE-PROVIDERS: Updated other providers

---

## 📤 Output

**Output Report Location**: `docs/projects/DISTRIBUTION-PACKAGING/reports/DISTRIBUTION-PACKAGING-TASK-01-004-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report when complete.

---

## 🎯 Phase 01 Completion Checklist

After this task, verify Phase 01 is complete:

- [ ] `IApiConfig` interface exists in domain
- [ ] `API_CONFIG` token exists in domain
- [ ] `provideApiConfig()` factory exists in infrastructure
- [ ] All 4 API client providers use `API_CONFIG`
- [ ] Both SignalR services use `API_CONFIG`
- [ ] `API_CONFIG_PROVIDER` included in infrastructure providers
- [ ] Zero hardcoded `localhost:5168` in infrastructure layer
- [ ] Application works in development mode
- [ ] All tests pass

**Phase 01 Complete! → Proceed to Phase 02**
