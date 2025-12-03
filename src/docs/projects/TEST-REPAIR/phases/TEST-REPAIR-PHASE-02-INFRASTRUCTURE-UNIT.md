# Phase 2: Infrastructure Unit Test Repairs

## 🎯 Objective

Add missing `API_CONFIG` providers to infrastructure service tests. These tests fail because the services inject `API_CONFIG` but the test bed doesn't provide it.

---

## 📚 Required Reading

- [ ] [TEST_BASELINE_REPORT_2025-12-02.md](../../../test-repair-reports/TEST_BASELINE_REPORT_2025-12-02.md) - Failure Group 2 details
- [ ] [TESTING_STANDARDS.md](../../../TESTING_STANDARDS.md) - Mock contract standards

---

## 📂 Files to Modify

```
libs/infrastructure/src/lib/device/
├── device-logs.service.spec.ts                     📝 Add API_CONFIG provider (6 tests)
└── device-events.service.spec.ts                   📝 Add API_CONFIG provider (6 tests)
```

---

## 📋 Tasks

### TASK-02-001: Fix DeviceLogsService Tests
**File**: `tasks/TEST-REPAIR-TASK-02-001-DEVICE-LOGS-TESTS.md`
**Parallel**: ✅ Can run with TASK-02-002

### TASK-02-002: Fix DeviceEventsService Tests
**File**: `tasks/TEST-REPAIR-TASK-02-002-DEVICE-EVENTS-TESTS.md`
**Parallel**: ✅ Can run with TASK-02-001

---

## ✅ Phase Completion Criteria

- [ ] `device-logs.service.spec.ts` - All 6 failing tests now pass
- [ ] `device-events.service.spec.ts` - All 6 failing tests now pass
- [ ] `pnpm exec nx lint infrastructure` passes with zero violations
- [ ] Zero TypeScript errors in modified files
- [ ] No regressions in other infrastructure tests

---

## 🔍 Validation Command

```powershell
pnpm exec nx run infrastructure:vite:test
```

---

*Phase 2 of 4 | Est. Time: 30 minutes*
