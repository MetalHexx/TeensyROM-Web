# Task: Simplify Storage Service Integration Tests (Device Folder)

## 📋 Task Identity

**Task ID**: TEST-REPAIR-TASK-03-003-STORAGE-DEVICE-INTEGRATION  
**Task Name**: Simplify storage.service.integration.spec.ts in device folder  
**Assigned To**: UI Test Wizard  
**Agent Chatmode**: `.github/chatmodes/ui-test-wizard.chatmode.md`  
**Priority**: Medium  
**Estimated Context Size**: Small  

---

## 🎯 Objective

**What**: Simplify the environment-gated storage service integration tests in the device folder to basic happy-path tests only.

**Why**: These tests hit a live API and require a running backend. They're currently skipped and test error scenarios. Keep them simple or remove them entirely if they duplicate other tests.

**Success Criteria**:
- [ ] Tests are simplified to basic happy-path OR removed if duplicative
- [ ] Environment gating works correctly with `test:integration` target
- [ ] `pnpm nx run infrastructure:test:integration` passes
- [ ] `pnpm exec nx lint infrastructure` passes with zero violations
- [ ] Zero TypeScript errors in modified files

---

## 📁 File Scope

**Files to Modify**:
- `libs/infrastructure/src/lib/device/storage.service.integration.spec.ts` - Simplify or remove

**Files to Review** (for context):
- `libs/infrastructure/src/lib/storage/storage.service.integration.spec.ts` - Main storage integration tests (TASK-03-001)
- `libs/infrastructure/project.json` - See test:integration target configuration

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Testing Standards](../../../TESTING_STANDARDS.md)
- [Coding Standards](../../../CODING_STANDARDS.md)

**Key Requirements**:

### Evaluate First

1. Check what this test file covers vs the main `storage.service.integration.spec.ts`
2. If it's duplicative, consider deleting the file entirely
3. If it tests unique device-folder specific behavior, simplify to 1 happy-path test

### Current Test (from baseline report)

The only test is:
- `index > should throw an error when indexing fails`

**This is an error-handling test** - it belongs in unit tests, not integration tests.

### Recommended Action

**Option A**: Delete this integration test file entirely (error handling tested in unit tests)

**Option B**: Replace with a simple happy-path test if there's unique behavior to verify:
```typescript
describe.runIf(process.env['RUN_INTEGRATION'] === 'true')('StorageService Integration Tests', () => {
  it('should index storage successfully', async () => {
    // Simple happy-path only
  });
});
```

**Recommendation**: Option A (delete) - error handling belongs in unit tests.

**Anti-Patterns to Avoid**:
- Don't test error handling in integration tests
- Don't keep tests that duplicate other test coverage

---

## ✅ Testing Requirements

**Validation Steps**:
1. Run `pnpm nx run infrastructure:test:integration` - should pass (file deleted or simplified)
2. Run `pnpm exec nx lint infrastructure` - zero violations
3. Verify no orphaned imports if file deleted

---

## 📤 Output

Save completion report to: `reports/TEST-REPAIR-TASK-03-003-REPORT.md`

---

*Task 3 of 3 in Phase 3 | Est. Time: 15 minutes*
