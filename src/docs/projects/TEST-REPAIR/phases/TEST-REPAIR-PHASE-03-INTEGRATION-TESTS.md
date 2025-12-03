# Phase 3: Integration Test Repairs

## 🎯 Objective

Fix Angular DI context issues in MSW-based integration tests and simplify environment-gated live API tests to basic happy-path coverage. Keep these tests light - they should verify basic connectivity, not comprehensive behavior.

---

## 📚 Required Reading

- [ ] [TEST_BASELINE_REPORT_2025-12-02.md](../../../test-repair-reports/TEST_BASELINE_REPORT_2025-12-02.md) - Failure Groups 4 & 5
- [ ] [TESTING_STANDARDS.md](../../../TESTING_STANDARDS.md) - Integration test patterns

---

## 📂 Files to Modify

```
libs/infrastructure/src/lib/storage/
└── storage.service.integration.spec.ts             📝 Fix DI context error (NG0203)

libs/infrastructure/src/lib/device/
├── device.service.integration.spec.ts              📝 Simplify env-gated tests
└── storage.service.integration.spec.ts             📝 Simplify env-gated tests
```

---

## 📋 Tasks

### TASK-03-001: Fix Storage Service Integration Tests (MSW-based)
**File**: `tasks/TEST-REPAIR-TASK-03-001-STORAGE-INTEGRATION.md`
**Parallel**: ❌ Run first - establishes pattern for MSW + Angular DI

### TASK-03-002: Simplify Device Service Integration Tests
**File**: `tasks/TEST-REPAIR-TASK-03-002-DEVICE-INTEGRATION.md`
**Parallel**: ✅ Can run after TASK-03-001

### TASK-03-003: Simplify Storage Service Integration Tests (Device Folder)
**File**: `tasks/TEST-REPAIR-TASK-03-003-STORAGE-DEVICE-INTEGRATION.md`
**Parallel**: ✅ Can run after TASK-03-001

---

## ⚠️ Integration Test Philosophy

These are **live API integration tests** that require a running backend. Keep them:

- **Simple**: Basic happy-path tests only
- **Light**: 1-3 tests per file maximum
- **Fast**: Quick verification of connectivity
- **Optional**: They may be skipped in CI if backend unavailable

**Delete complicated tests** - they belong in unit tests with mocks, not integration tests.

---

## ✅ Phase Completion Criteria

- [ ] `storage.service.integration.spec.ts` (storage folder) - DI error fixed, tests pass
- [ ] `device.service.integration.spec.ts` - Simplified to basic happy-path tests
- [ ] `storage.service.integration.spec.ts` (device folder) - Simplified to basic tests
- [ ] `pnpm exec nx lint infrastructure` passes with zero violations
- [ ] Zero TypeScript errors in modified files
- [ ] `pnpm nx run infrastructure:test:integration` passes

---

## 🔍 Validation Command

```powershell
pnpm nx run infrastructure:test:integration
```

---

*Phase 3 of 4 | Est. Time: 1-1.5 hours*
