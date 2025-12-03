# Phase 1: Configuration & Quick Fixes

## 🎯 Objective

Unregister generated libraries from test targets and fix simple assertion/provider issues in app-shell and infrastructure config tests. These are quick wins that unblock the test suite.

---

## 📚 Required Reading

- [ ] [TEST_BASELINE_REPORT_2025-12-02.md](../../../test-repair-reports/TEST_BASELINE_REPORT_2025-12-02.md) - Source of failure details
- [ ] [TESTING_STANDARDS.md](../../../TESTING_STANDARDS.md) - Testing patterns and mock standards

---

## 📂 Files to Modify

```
libs/data-access/api-client/
└── project.json                                    📝 Disable vite:test target

libs/app/bootstrap/
└── project.json                                    📝 Disable vite:test target

libs/app/shell/src/lib/components/header/
└── header.component.spec.ts                        📝 Add VERSION_SERVICE provider

libs/app/shell/src/lib/layout/
└── layout.component.spec.ts                        📝 Add DEVICE_SERVICE providers

libs/infrastructure/src/lib/config/
└── api-config.provider.spec.ts                     📝 Fix assertion mismatches
```

---

## 📋 Tasks

### TASK-01-001: Disable Test Targets for Generated/Empty Libraries
**File**: `tasks/TEST-REPAIR-TASK-01-001-DISABLE-TEST-TARGETS.md`
**Parallel**: ✅ Can run with other Phase 1 tasks

### TASK-01-002: Fix App-Shell Component Tests  
**File**: `tasks/TEST-REPAIR-TASK-01-002-APP-SHELL-TESTS.md`
**Parallel**: ✅ Can run with other Phase 1 tasks

### TASK-01-003: Fix API Config Provider Assertions
**File**: `tasks/TEST-REPAIR-TASK-01-003-API-CONFIG-ASSERTIONS.md`
**Parallel**: ✅ Can run with other Phase 1 tasks

---

## ✅ Phase Completion Criteria

- [ ] `pnpm exec nx run api-client:vite:test` no longer fails (target disabled)
- [ ] `pnpm exec nx run app-bootstrap:vite:test` no longer fails (target disabled)
- [ ] `pnpm exec nx run app-shell:vite:test` passes (2 tests fixed)
- [ ] `pnpm exec nx lint app-shell` passes with zero violations
- [ ] `api-config.provider.spec.ts` tests pass (2 assertions fixed)
- [ ] Zero TypeScript errors in modified files

---

## 🔍 Validation Command

```powershell
pnpm exec nx run-many --target=vite:test --projects=app-shell,infrastructure --exclude=teensyrom-ui-e2e
```

---

*Phase 1 of 4 | Est. Time: 30-45 minutes*
