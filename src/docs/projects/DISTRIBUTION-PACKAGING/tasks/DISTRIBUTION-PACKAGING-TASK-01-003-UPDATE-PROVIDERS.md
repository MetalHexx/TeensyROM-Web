# Task Handoff: Update API Client Providers

## 📋 Task Identity

**Task ID**: DISTRIBUTION-PACKAGING-TASK-01-003-UPDATE-PROVIDERS  
**Task Name**: Update All API Client Providers to Use API_CONFIG  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Medium

---

## 🎯 Objective

**What**: Modify all API client provider factories to inject and use `API_CONFIG` instead of hardcoded `localhost:5168` URLs.

**Why**: This removes the hardcoded URLs from 4 provider files, enabling environment-aware URL configuration.

**Success Criteria**:
- [ ] `DEVICES_API_CLIENT_PROVIDER` updated to use `API_CONFIG`
- [ ] `FILES_API_CLIENT_PROVIDER` updated to use `API_CONFIG`
- [ ] `PLAYER_API_CLIENT_PROVIDER` updated to use `API_CONFIG`
- [ ] `SETTINGS_API_CLIENT_PROVIDER` updated to use `API_CONFIG`
- [ ] `API_CONFIG_PROVIDER` included in main infrastructure providers
- [ ] No hardcoded `localhost:5168` in any provider files
- [ ] Application starts and API calls work in development mode

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- DISTRIBUTION-PACKAGING-TASK-01-001-API-CONFIG-CONTRACT: `IApiConfig` and `API_CONFIG` token exist
- DISTRIBUTION-PACKAGING-TASK-01-002-API-CONFIG-PROVIDER: `API_CONFIG_PROVIDER` exists

**Dependencies**:
- `@teensyrom-nx/domain` - for `API_CONFIG`, `IApiConfig`
- `@teensyrom-nx/infrastructure` - for `API_CONFIG_PROVIDER`

**Constraints**:
- Must maintain existing provider structure
- Must not break existing functionality

---

## 📂 File Scope

**Files to Modify**:
- `libs/infrastructure/src/lib/device/providers.ts`
- `libs/infrastructure/src/lib/storage/providers.ts`
- `libs/infrastructure/src/lib/player/providers.ts`
- `libs/infrastructure/src/lib/settings/providers.ts`
- `libs/infrastructure/src/lib/providers.ts` (add API_CONFIG_PROVIDER)

**Files to Review**:
- `libs/infrastructure/src/lib/config/api-config.provider.ts` - The provider to include

---

## 📋 Implementation Guidance

**Standards to Follow**:
- [SERVICE_STANDARDS.md](../../../../SERVICE_STANDARDS.md) - Provider patterns
- [CODING_STANDARDS.md](../../../../CODING_STANDARDS.md) - TypeScript conventions

**Key Requirements**:

1. **Update each API client provider**:
   - Import `API_CONFIG`, `IApiConfig` from `@teensyrom-nx/domain`
   - Change `useFactory` to accept `apiConfig: IApiConfig` parameter
   - Use `apiConfig.basePath` in `Configuration({ basePath: ... })`
   - Add `API_CONFIG` to `deps` array

2. **Include API_CONFIG_PROVIDER in main providers**:
   - Import `API_CONFIG_PROVIDER` from config module
   - Add to providers array in `libs/infrastructure/src/lib/providers.ts`

**Pattern for Updated Providers**:

Before:
```typescript
export const DEVICES_API_CLIENT_PROVIDER = {
  provide: DevicesApiService,
  useFactory: () => {
    const config = new Configuration({ basePath: 'http://localhost:5168' });
    return new DevicesApiService(config);
  },
};
```

After:
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

**Files to Update**:

| File | Provider Name |
|------|---------------|
| `device/providers.ts` | `DEVICES_API_CLIENT_PROVIDER` |
| `storage/providers.ts` | `FILES_API_CLIENT_PROVIDER` |
| `player/providers.ts` | `PLAYER_API_CLIENT_PROVIDER` |
| `settings/providers.ts` | `SETTINGS_API_CLIENT_PROVIDER` |

**Anti-Patterns to Avoid**:
- Don't leave any hardcoded `localhost:5168` URLs
- Don't forget to add `deps: [API_CONFIG]`
- Don't change the provider token (e.g., `DevicesApiService`)

---

## 🧪 Testing Requirements

**Manual Testing**:
- [ ] Run `pnpm start` - application starts
- [ ] Open browser DevTools Network tab
- [ ] Verify API calls go to `http://localhost:5168` (development mode)
- [ ] All device operations work (list, connect, etc.)
- [ ] File operations work (browse, search)
- [ ] Player operations work
- [ ] Settings load correctly

**Verification**:
- [ ] `pnpm nx build infrastructure` succeeds
- [ ] `pnpm nx lint infrastructure` passes
- [ ] No `localhost:5168` in provider files (use grep to verify)

---

## 📚 Reference Materials

**Related Documentation**:
- [DISTRIBUTION_PACKAGING_PLAN.md](../../../../features/DISTRIBUTION_PACKAGING_PLAN.md) - Section 3.1.3
- [Phase 01 Plan](../phases/DISTRIBUTION-PACKAGING-PHASE-01-RELATIVE-URL-MIGRATION.md)

**Related Tasks**:
- DISTRIBUTION-PACKAGING-TASK-01-001-API-CONFIG-CONTRACT: Provides interface
- DISTRIBUTION-PACKAGING-TASK-01-002-API-CONFIG-PROVIDER: Provides provider factory

---

## 📤 Output

**Output Report Location**: `docs/projects/DISTRIBUTION-PACKAGING/reports/DISTRIBUTION-PACKAGING-TASK-01-003-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report when complete.
