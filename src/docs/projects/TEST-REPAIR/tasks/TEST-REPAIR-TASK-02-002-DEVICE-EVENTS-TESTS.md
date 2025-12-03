# Task: Fix DeviceEventsService Tests

## 📋 Task Identity

**Task ID**: TEST-REPAIR-TASK-02-002-DEVICE-EVENTS-TESTS  
**Task Name**: Add API_CONFIG provider to device-events.service.spec.ts  
**Assigned To**: UI Test Wizard  
**Agent Chatmode**: `.github/chatmodes/ui-test-wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small  

---

## 🎯 Objective

**What**: Add the missing `API_CONFIG` injection token provider to the DeviceEventsService test suite.

**Why**: 6 tests fail with `NullInjectorError: No provider for InjectionToken API_CONFIG` because the service injects this token but the test bed doesn't provide it.

**Success Criteria**:
- [ ] All 6 failing tests in "Alert Integration" suite pass
- [ ] `pnpm exec nx run infrastructure:vite:test` passes
- [ ] `pnpm exec nx lint infrastructure` passes with zero violations
- [ ] Zero TypeScript errors in modified files

---

## 📁 File Scope

**Files to Modify**:
- `libs/infrastructure/src/lib/device/device-events.service.spec.ts` - Add API_CONFIG provider

**Files to Review** (for context):
- `libs/infrastructure/src/lib/config/api-config.provider.ts` - API_CONFIG token and interface
- `libs/infrastructure/src/lib/device/device-events.service.ts` - Service dependencies

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Testing Standards](../../../TESTING_STANDARDS.md) - Mock contract standards
- [Coding Standards](../../../CODING_STANDARDS.md)

**Key Requirements**:

Add the `API_CONFIG` provider to the TestBed configuration in the failing describe block:

```typescript
import { API_CONFIG, ApiConfig } from '../config/api-config.provider';

const mockApiConfig: ApiConfig = {
  basePath: 'http://localhost:5168',
  signalRBasePath: 'http://localhost:5168',
  getBaseUrl: () => 'http://localhost:5168',
};

// In TestBed.configureTestingModule providers:
{ provide: API_CONFIG, useValue: mockApiConfig }
```

**Failing Tests to Fix**:
1. `connect() error handling > should display alert when startDeviceEvents API fails`
2. `connect() error handling > should use fallback message when error message is missing`
3. `connect() error handling > should extract message from error.error.message`
4. `disconnect() error handling > should display alert when stopDeviceEvents API fails`
5. `disconnect() error handling > should use fallback message for stopDeviceEvents`
6. `getDeviceState operation > should return null for non-existent device`

**Anti-Patterns to Avoid**:
- Don't modify the service code
- Don't skip tests

---

## ✅ Testing Requirements

**Validation Steps**:
1. Run `pnpm exec nx run infrastructure:vite:test -- --testPathPattern=device-events` - all tests should pass
2. Run `pnpm exec nx lint infrastructure` - zero violations
3. Verify no TypeScript red squiggles in modified file

---

## 📤 Output

Save completion report to: `reports/TEST-REPAIR-TASK-02-002-REPORT.md`

---

*Task 2 of 2 in Phase 2 | Est. Time: 15 minutes*
