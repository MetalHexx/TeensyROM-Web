# Task Handoff: Add /api/ Prefix to Backend Routes

## 📋 Task Identity

**Task ID**: DISTRIBUTION-PACKAGING-TASK-01-000-API-ROUTE-PREFIX  
**Task Name**: Add /api/ Prefix to All Backend API Routes  
**Assigned To**: Backend Wizard  
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`  
**Priority**: Critical (Blocking)  
**Estimated Context Size**: Large

---

## 🎯 Objective

**What**: Add `/api/` prefix to all backend API routes and SignalR hub endpoints to prevent conflicts with Angular SPA routes.

**Why**: Without this prefix, there's ambiguity between Angular routes and API routes:
- `/devices` → Both Angular device page AND API endpoint
- `/player` → Both Angular player page AND API endpoint
- `/settings` → Both Angular settings page AND API endpoint

The SPA fallback pattern requires clear route separation.

**Success Criteria**:
- [ ] All API endpoints prefixed with `/api/` (e.g., `/api/devices/*`, `/api/files/*`)
- [ ] SignalR hubs accessible at `/api/logHub` and `/api/deviceEventHub`
- [ ] OpenAPI spec regenerated with new routes
- [ ] TypeScript API client regenerated
- [ ] E2E test constants updated
- [ ] Application fully functional with new routes

---

## 📚 Context & Dependencies

**Prerequisites Completed**: None (this is the first task)

**Dependencies**:
- RadEndpoints framework
- OpenAPI generator
- TypeScript API client generator

**Constraints**:
- Must update ALL endpoints consistently
- Must regenerate API client after changes
- E2E tests must be updated to match

---

## 📂 File Scope

### Backend Files to Modify

**Option A: Global Prefix (Preferred if RadEndpoints supports it)**
- `apps/api/src/TeensyRom.Api/Startup/*.cs` - Configure global route prefix

**Option B: Individual Endpoint Updates**
Each endpoint in these directories needs route update:
- `apps/api/src/TeensyRom.Api/Endpoints/Files/**/*Endpoint.cs`
- `apps/api/src/TeensyRom.Api/Endpoints/Player/**/*Endpoint.cs`
- `apps/api/src/TeensyRom.Api/Endpoints/Serial/**/*Endpoint.cs`
- `apps/api/src/TeensyRom.Api/Endpoints/Settings/**/*Endpoint.cs`
- `apps/api/src/TeensyRom.Api/Endpoints/Assets/**/*Endpoint.cs`

**Program.cs**:
- `apps/api/src/TeensyRom.Api/Program.cs` - Update SignalR hub routes

### Frontend Files (Regenerated)
- `libs/data-access/api-client/**` - Regenerated automatically

### E2E Test Files to Update
- `apps/teensyrom-ui-e2e/src/support/constants/api.constants.ts`

---

## 📋 Implementation Guidance

### Step 1: Update Endpoint Routes

Update each endpoint's `Configure()` method:

**Before**:
```csharp
Get("/devices/")
```

**After**:
```csharp
Get("/api/devices/")
```

**Endpoints to Update**:

| Current Route | New Route |
|--------------|-----------|
| `/devices/` | `/api/devices/` |
| `/devices/{deviceId}/connect` | `/api/devices/{deviceId}/connect` |
| `/devices/{deviceId}/disconnect` | `/api/devices/{deviceId}/disconnect` |
| `/devices/{deviceId}/ping` | `/api/devices/{deviceId}/ping` |
| `/devices/{deviceId}/reset` | `/api/devices/{deviceId}/reset` |
| `/devices/{deviceId}/storage/{storageType}/directories` | `/api/devices/{deviceId}/storage/...` |
| `/devices/{deviceId}/storage/{storageType}/index` | `/api/devices/{deviceId}/storage/...` |
| `/devices/events/start` | `/api/devices/events/start` |
| `/devices/events/stop` | `/api/devices/events/stop` |
| `/devices/logs/start` | `/api/devices/logs/start` |
| `/devices/logs/stop` | `/api/devices/logs/stop` |
| `/files/search` | `/api/files/search` |
| `/files/index/all` | `/api/files/index/all` |
| `/files/favorites` | `/api/files/favorites` |
| `/player/launch` | `/api/player/launch` |
| `/player/toggle` | `/api/player/toggle` |
| `/player/random` | `/api/player/random` |
| `/settings` | `/api/settings` |

### Step 2: Update SignalR Hub Routes

In `Program.cs`:

**Before**:
```csharp
app.MapHub<LogsHub>("/logHub");
app.MapHub<DeviceEventHub>("/deviceEventHub");
```

**After**:
```csharp
app.MapHub<LogsHub>("/api/logHub");
app.MapHub<DeviceEventHub>("/api/deviceEventHub");
```

### Step 3: Regenerate OpenAPI Spec

```powershell
cd apps/api/src/TeensyRom.Api
dotnet build
```

This should regenerate `openapi-spec.json` with new routes.

### Step 4: Regenerate TypeScript API Client

```powershell
cd <workspace-root>
pnpm run generate:api-client
```

### Step 5: Update E2E Constants

Update `apps/teensyrom-ui-e2e/src/support/constants/api.constants.ts`:

**Before**:
```typescript
export const API_CONFIG = {
  BASE_URL: 'http://localhost:5168',
  // routes without /api/ prefix
};
```

**After**:
```typescript
export const API_CONFIG = {
  BASE_URL: 'http://localhost:5168',
  // All route patterns should include /api/ prefix
};
```

---

## 🧪 Testing Requirements

**Manual Testing**:
- [ ] Start backend: `dotnet run`
- [ ] Verify `/api/devices` returns device list
- [ ] Verify old routes (`/devices`) return 404
- [ ] Start frontend: `pnpm start`
- [ ] Verify all device operations work
- [ ] Verify file browsing works
- [ ] Verify player controls work
- [ ] Verify settings load/save works
- [ ] Verify SignalR connections establish at new paths

**E2E Testing**:
- [ ] Run E2E tests after updating constants
- [ ] All existing tests should pass with new routes

---

## 📚 Reference Materials

**Related Documentation**:
- [DISTRIBUTION_PACKAGING_PLAN.md](../../../../features/DISTRIBUTION_PACKAGING_PLAN.md)
- [Phase 01 Plan](../phases/DISTRIBUTION-PACKAGING-PHASE-01-RELATIVE-URL-MIGRATION.md)
- [API_CLIENT_GENERATION.md](../../../../API_CLIENT_GENERATION.md)
- [BACKEND_ARCHITECTURE.md](../../../../BACKEND_ARCHITECTURE.md)

**RadEndpoints Documentation**:
- Check RadEndpoints GitHub/docs for global prefix configuration

---

## 📤 Output

**Output Report Location**: `docs/projects/DISTRIBUTION-PACKAGING/reports/DISTRIBUTION-PACKAGING-TASK-01-000-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report when complete.

---

## ⚠️ Important Notes

### Route Conflicts Resolved

| Angular Route | API Route (Before) | API Route (After) | Conflict |
|--------------|-------------------|-------------------|----------|
| `/devices` | `/devices` | `/api/devices` | ✅ Resolved |
| `/player` | `/player/*` | `/api/player/*` | ✅ Resolved |
| `/settings` | `/settings` | `/api/settings` | ✅ Resolved |

### Assets Path Consideration

The `/Assets/*` route serves embedded game images. Consider:
- Keep as `/Assets/*` if it doesn't conflict with Angular
- Or move to `/api/Assets/*` for consistency

Since Angular doesn't have an `/Assets` route, it can likely remain unchanged.

### SignalR Path Update

The SignalR hub paths MUST be updated to `/api/logHub` and `/api/deviceEventHub`. The frontend SignalR services will be updated in a later task (01-004) to use the configurable base path.

### This Task Must Complete First

All subsequent Phase 01 tasks depend on this being complete because:
1. The API client is regenerated with new routes
2. The infrastructure services use the regenerated client
3. The URL configuration must account for `/api/` prefix
