# Task: Fix Storage Service Integration Tests (MSW-based)

## 📋 Task Identity

**Task ID**: TEST-REPAIR-TASK-03-001-STORAGE-INTEGRATION  
**Task Name**: Fix DI context error in storage.service.integration.spec.ts  
**Assigned To**: UI Test Wizard  
**Agent Chatmode**: `.github/chatmodes/ui-test-wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Medium  

---

## 🎯 Objective

**What**: Fix the Angular DI context error (NG0203) in the MSW-based storage service integration tests.

**Why**: The test creates `StorageService` using `new StorageService()` directly, bypassing Angular's DI system. This causes `inject()` calls in the service to fail.

**Success Criteria**:
- [ ] All 6 tests in the suite pass (no NG0203 error)
- [ ] MSW server properly mocks HTTP requests
- [ ] `pnpm nx run infrastructure:test:integration` passes
- [ ] `pnpm exec nx lint infrastructure` passes with zero violations
- [ ] Zero TypeScript errors in modified files

---

## 📁 File Scope

**Files to Modify**:
- `libs/infrastructure/src/lib/storage/storage.service.integration.spec.ts` - Fix DI context

**Files to Review** (for context):
- `libs/infrastructure/src/lib/storage/storage.service.ts` - See injected dependencies
- `libs/infrastructure/src/lib/config/api-config.provider.ts` - API_CONFIG token

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Testing Standards](../../../TESTING_STANDARDS.md) - Integration test patterns
- [Coding Standards](../../../CODING_STANDARDS.md)

**Key Requirements**:

The root cause is creating the service outside Angular's injection context. Fix by using `TestBed.inject()`:

```typescript
import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';
import { FilesApiService } from '@teensyrom-nx/data-access/api-client';
import { ALERT_SERVICE } from '@teensyrom-nx/domain';
import { API_CONFIG } from '../config/api-config.provider';

beforeEach(async () => {
  await TestBed.configureTestingModule({
    providers: [
      StorageService,
      FilesApiService,
      { provide: ALERT_SERVICE, useValue: mockAlertService },
      { 
        provide: API_CONFIG, 
        useValue: { 
          basePath: 'http://localhost:5168',
          signalRBasePath: 'http://localhost:5168',
          getBaseUrl: () => 'http://localhost:5168'
        } 
      },
    ],
  }).compileComponents();
  
  // Use TestBed.inject instead of new StorageService()
  storageService = TestBed.inject(StorageService);
});
```

**MSW Server Setup**: Keep the existing MSW server setup for HTTP mocking - just fix how the service is instantiated.

**Anti-Patterns to Avoid**:
- Don't use `new StorageService()` directly
- Don't bypass Angular DI for services that use `inject()`
- Don't remove tests - fix the setup

---

## ✅ Testing Requirements

**Validation Steps**:
1. Run `pnpm nx run infrastructure:test:integration` - storage integration tests should pass
2. Run `pnpm exec nx lint infrastructure` - zero violations
3. Verify no TypeScript red squiggles in modified file

---

## 📤 Output

Save completion report to: `reports/TEST-REPAIR-TASK-03-001-REPORT.md`

---

*Task 1 of 3 in Phase 3 | Est. Time: 30 minutes*
