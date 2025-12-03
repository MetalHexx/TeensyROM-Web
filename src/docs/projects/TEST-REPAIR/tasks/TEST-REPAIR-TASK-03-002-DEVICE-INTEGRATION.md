# Task: Simplify Device Service Integration Tests

## 📋 Task Identity

**Task ID**: TEST-REPAIR-TASK-03-002-DEVICE-INTEGRATION  
**Task Name**: Simplify device.service.integration.spec.ts to basic happy-path tests  
**Assigned To**: UI Test Wizard  
**Agent Chatmode**: `.github/chatmodes/ui-test-wizard.chatmode.md`  
**Priority**: Medium  
**Estimated Context Size**: Small  

---

## 🎯 Objective

**What**: Simplify the environment-gated device service integration tests to basic happy-path tests only.

**Why**: These tests hit a live API at `http://localhost:5168` and require a running backend. They're currently skipped due to environment gating issues. Keep them simple - integration tests should verify connectivity, not comprehensive behavior.

**Success Criteria**:
- [ ] Tests are simplified to 1-2 basic happy-path tests
- [ ] Environment gating works correctly with `test:integration` target
- [ ] `pnpm nx run infrastructure:test:integration` runs the tests (with backend)
- [ ] `pnpm exec nx lint infrastructure` passes with zero violations
- [ ] Zero TypeScript errors in modified files

---

## 📁 File Scope

**Files to Modify**:
- `libs/infrastructure/src/lib/device/device.service.integration.spec.ts` - Simplify tests

**Files to Review** (for context):
- `libs/infrastructure/project.json` - See test:integration target configuration

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Testing Standards](../../../TESTING_STANDARDS.md)
- [Coding Standards](../../../CODING_STANDARDS.md)

**Key Requirements**:

### Simplification Strategy

**Keep only basic happy-path tests**:
- 1 test: `findDevices` returns a list (may be empty)
- (Optional) 1 test: Basic connect/disconnect cycle if practical

**Delete complicated tests** - error handling, edge cases, etc. belong in unit tests with mocks.

### Fix Environment Gating

Use Vitest's `describe.skipIf` or `describe.runIf`:

```typescript
describe.runIf(process.env['RUN_INTEGRATION'] === 'true')('DeviceService Integration Tests', () => {
  // Simple happy-path tests only
  
  it('should find devices (returns list)', async () => {
    const devices = await deviceService.findDevices();
    expect(Array.isArray(devices)).toBe(true);
    // Don't assert specific devices - just verify API works
  });
});
```

**Philosophy**: These tests verify "the API is reachable and returns expected shapes" - nothing more.

**Anti-Patterns to Avoid**:
- Don't test error handling in integration tests
- Don't test edge cases in integration tests
- Don't require specific device responses (hardware-dependent)

---

## ✅ Testing Requirements

**Validation Steps**:
1. Run `pnpm nx run infrastructure:test:integration` with backend running - tests should pass
2. Run `pnpm nx run infrastructure:test:integration` without backend - tests should skip gracefully
3. Run `pnpm exec nx lint infrastructure` - zero violations
4. Verify no TypeScript red squiggles in modified file

---

## 📤 Output

Save completion report to: `reports/TEST-REPAIR-TASK-03-002-REPORT.md`

---

*Task 2 of 3 in Phase 3 | Est. Time: 20 minutes*
