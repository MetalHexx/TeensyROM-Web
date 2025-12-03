# Task: Fix App-Shell Component Tests

## 📋 Task Identity

**Task ID**: TEST-REPAIR-TASK-01-002-APP-SHELL-TESTS  
**Task Name**: Fix HeaderComponent and LayoutComponent test DI providers  
**Assigned To**: UI Test Wizard  
**Agent Chatmode**: `.github/chatmodes/ui-test-wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small  

---

## 🎯 Objective

**What**: Add missing DI providers to `HeaderComponent` and `LayoutComponent` tests so they can create the components successfully.

**Why**: Tests fail with `NullInjectorError` because the components inject services that aren't provided in the test bed.

**Success Criteria**:
- [ ] `HeaderComponent > should create` test passes
- [ ] `LayoutComponent > should create` test passes
- [ ] `pnpm exec nx run app-shell:vite:test` passes (all tests)
- [ ] `pnpm exec nx lint app-shell` passes with zero violations
- [ ] Zero TypeScript errors in modified files

---

## 📁 File Scope

**Files to Modify**:
- `libs/app/shell/src/lib/components/header/header.component.spec.ts` - Add VERSION_SERVICE mock
- `libs/app/shell/src/lib/layout/layout.component.spec.ts` - Add DEVICE_SERVICE and other required mocks

**Files to Review** (for context):
- `libs/domain/src/lib/contracts/` - Contract interfaces and injection tokens
- `libs/app/shell/src/lib/components/header/header.component.ts` - See what's injected
- `libs/app/shell/src/lib/layout/layout.component.ts` - See what's injected

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Testing Standards](../../../TESTING_STANDARDS.md) - Mock contract standards
- [Coding Standards](../../../CODING_STANDARDS.md)

**Key Requirements**:

### HeaderComponent Fix

The component injects `VERSION_SERVICE`. Add a mock provider:

```typescript
import { VERSION_SERVICE } from '@teensyrom-nx/domain';
import { of } from 'rxjs';

// In TestBed.configureTestingModule providers:
{ provide: VERSION_SERVICE, useValue: { version$: of('1.0.0-test') } }
```

### LayoutComponent Fix

The component uses a SignalStore that depends on infrastructure services. Add mock providers:

```typescript
import { DEVICE_SERVICE, DEVICE_STORAGE_SERVICE } from '@teensyrom-nx/domain';

// Create contract-typed mocks (Partial<IContract>)
const mockDeviceService: Partial<IDeviceService> = {
  // Add minimal properties needed for test
};

// In TestBed.configureTestingModule providers:
{ provide: DEVICE_SERVICE, useValue: mockDeviceService },
{ provide: DEVICE_STORAGE_SERVICE, useValue: mockStorageService },
```

**Critical**: Use `Partial<IContract>` typing for all mocks per TESTING_STANDARDS.md.

**Anti-Patterns to Avoid**:
- Don't use ad-hoc mock objects without contract types
- Don't over-mock - only provide what's needed for component creation

---

## ✅ Testing Requirements

**Validation Steps**:
1. Run `pnpm exec nx run app-shell:vite:test` - all tests should pass
2. Run `pnpm exec nx lint app-shell` - zero violations
3. Verify no TypeScript red squiggles in modified files

---

## 📤 Output

Save completion report to: `reports/TEST-REPAIR-TASK-01-002-REPORT.md`

---

*Task 2 of 3 in Phase 1 | Est. Time: 15-20 minutes*
