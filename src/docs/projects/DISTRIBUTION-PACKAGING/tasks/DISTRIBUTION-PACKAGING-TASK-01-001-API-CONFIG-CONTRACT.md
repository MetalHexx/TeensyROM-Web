# Task Handoff: API Config Contract

## 📋 Task Identity

**Task ID**: DISTRIBUTION-PACKAGING-TASK-01-001-API-CONFIG-CONTRACT  
**Task Name**: Create API Configuration Domain Contract  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High (Foundation)  
**Estimated Context Size**: Small

---

## 🎯 Objective

**What**: Create a domain contract interface and injection token for API configuration that enables environment-aware URL handling.

**Why**: This contract establishes the foundation for removing hardcoded `localhost:5168` URLs from the infrastructure layer, enabling production builds to use relative URLs.

**Success Criteria**:
- [ ] `IApiConfig` interface defined with `basePath` and `signalRBasePath` properties
- [ ] `API_CONFIG` injection token created using Angular's `InjectionToken`
- [ ] Exported from domain contracts barrel (`index.ts`)
- [ ] TypeScript compiles without errors
- [ ] ESLint passes (no boundary violations)

---

## 📚 Context & Dependencies

**Prerequisites Completed**: None (this is the first task)

**Dependencies**:
- `@angular/core` - for `InjectionToken`

**Constraints**:
- Must be in domain layer (no infrastructure dependencies)
- Follow existing contract patterns in `libs/domain/src/lib/contracts/`

---

## 📂 File Scope

**Files to Create**:
- `libs/domain/src/lib/contracts/api-config.contract.ts` - Interface and token

**Files to Modify**:
- `libs/domain/src/lib/contracts/index.ts` - Add export

**Files to Review** (for patterns):
- `libs/domain/src/lib/contracts/device.contract.ts` - Similar pattern example
- `libs/domain/src/lib/contracts/settings.contract.ts` - Similar pattern example

---

## 📋 Implementation Guidance

**Standards to Follow**:
- [DOMAIN_STANDARDS.md](../../../../DOMAIN_STANDARDS.md) - Contract patterns
- [CODING_STANDARDS.md](../../../../CODING_STANDARDS.md) - TypeScript conventions

**Key Requirements**:

1. Create `IApiConfig` interface:
   - `basePath: string` - Base URL for API clients (empty for relative, full URL for dev)
   - `signalRBasePath: string` - Base URL for SignalR hubs

2. Create `API_CONFIG` injection token:
   - Use `InjectionToken<IApiConfig>`
   - Descriptive token name: `'ApiConfig'`

3. Export from barrel:
   - Add to `libs/domain/src/lib/contracts/index.ts`

**Pattern Reference**:

Look at existing contracts for pattern:
```typescript
// Example from device.contract.ts
export interface IDeviceService { ... }
export const DEVICE_SERVICE = new InjectionToken<IDeviceService>('DeviceService');
```

**Anti-Patterns to Avoid**:
- Don't add any implementation logic to domain layer
- Don't import from infrastructure or application layers
- Don't add default values (those belong in provider)

---

## 🧪 Testing Requirements

**No new tests required** for this task (it's a pure TypeScript interface/token).

**Verification**:
- [ ] `pnpm nx build domain` succeeds
- [ ] `pnpm nx lint domain` passes
- [ ] Token can be imported from `@teensyrom-nx/domain`

---

## 📚 Reference Materials

**Related Documentation**:
- [DISTRIBUTION_PACKAGING_PLAN.md](../../../../features/DISTRIBUTION_PACKAGING_PLAN.md) - Section 3.1.1
- [Phase 01 Plan](../phases/DISTRIBUTION-PACKAGING-PHASE-01-RELATIVE-URL-MIGRATION.md)

---

## 📤 Output

**Output Report Location**: `docs/projects/DISTRIBUTION-PACKAGING/reports/DISTRIBUTION-PACKAGING-TASK-01-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report when complete.
