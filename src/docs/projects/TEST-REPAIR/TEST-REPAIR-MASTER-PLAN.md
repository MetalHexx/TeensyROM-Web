# Test Repair Project - Master Plan

**Project Overview**: Repair all failing unit tests and integration tests identified in the December 2, 2025 baseline report. The goal is to achieve a clean test run across all workspace projects with zero failures, clean TypeScript compilation, and no ESLint violations.

**Standards Documentation**:
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)
- **Store Testing**: [STORE_TESTING.md](../../STORE_TESTING.md)
- **Smart Component Testing**: [SMART_COMPONENT_TESTING.md](../../SMART_COMPONENT_TESTING.md)
- **Coding Standards**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md)

**Source Report**: [TEST_BASELINE_REPORT_2025-12-02.md](../../test-repair-reports/TEST_BASELINE_REPORT_2025-12-02.md)

---

## 🎯 Project Objective

Restore all failing unit tests and integration tests to a passing state while ensuring code quality. The baseline report identified 18 failing tests across 7 test suites, with an additional 4 skipped integration tests that need simplification.

**User Value**: A reliable, fast test suite that provides confidence in code changes and enables CI/CD automation.

**Success Criteria**:
- [ ] All unit tests pass (`pnpm exec nx run-many --target=vite:test --exclude=teensyrom-ui-e2e`)
- [ ] All integration tests pass (`pnpm nx run infrastructure:test:integration`)
- [ ] Zero TypeScript compilation errors in modified files
- [ ] Zero ESLint violations in modified files
- [ ] Test output is clean (polyfill warnings resolved)
- [ ] No test configuration errors (api-client unregistered, bootstrap disabled)
- [ ] GitHub Actions PR workflow runs unit tests on PR open/update

---

## 📊 Failure Summary (from Baseline Report)

| Category | Count | Files Affected |
|----------|-------|----------------|
| No test files (config issue) | 2 projects | api-client, app-bootstrap |
| Missing DI providers | 14 tests | 4 spec files |
| Assertion mismatches | 2 tests | 1 spec file |
| DI injection context error | 6 tests | 1 spec file |
| Environment-gated skips | 4 tests | 2 spec files |
| Test warnings (polyfills) | Multiple | test-setup.ts |

---

## 📋 Implementation Phases

### Phase 1: Configuration & Quick Fixes
**Objective**: Unregister generated libraries from test targets and fix simple assertion/provider issues in app-shell and infrastructure config tests.

**Tasks** (can run in parallel):
- TASK-01-001: Unregister api-client from tests, disable bootstrap test target
- TASK-01-002: Fix app-shell component tests (HeaderComponent, LayoutComponent)
- TASK-01-003: Fix api-config.provider assertion mismatches

**Estimated Time**: 30-45 minutes total

---

### Phase 2: Infrastructure Unit Test Repairs  
**Objective**: Add missing API_CONFIG providers to infrastructure service tests.

**Tasks** (can run in parallel):
- TASK-02-001: Fix device-logs.service.spec.ts (6 tests)
- TASK-02-002: Fix device-events.service.spec.ts (6 tests)

**Estimated Time**: 30 minutes total

---

### Phase 3: Integration Test Repairs
**Objective**: Fix Angular DI context issues in MSW-based integration tests and simplify environment-gated live API tests to basic happy-path coverage only.

**Tasks** (sequential recommended):
- TASK-03-001: Fix storage.service.integration.spec.ts (DI context error)
- TASK-03-002: Simplify device.service.integration.spec.ts (env-gated, live API)
- TASK-03-003: Simplify storage.service.integration.spec.ts (device folder, env-gated)

**Estimated Time**: 1-1.5 hours total

---

### Phase 4: Test Environment Polish
**Objective**: Add global polyfills to reduce test noise from ResizeObserver and MediaDevices warnings.

**Tasks**:
- TASK-04-001: Add global test polyfills (ResizeObserver, MediaDevices)

**Estimated Time**: 15 minutes

---

### Phase 5: GitHub Actions PR Workflow
**Objective**: Create a GitHub Actions workflow that runs all unit tests when a PR is opened or updated.

**Tasks**:
- TASK-05-001: Create PR unit test workflow

**Estimated Time**: 20 minutes

---

## 🔄 Parallel Execution Strategy

```
Phase 1 (Configuration & Quick Fixes)
├── TASK-01-001 (config)      ──┐
├── TASK-01-002 (app-shell)   ──┼── Run in parallel
└── TASK-01-003 (api-config)  ──┘

Phase 2 (Infrastructure Unit Tests)
├── TASK-02-001 (device-logs)   ──┐
└── TASK-02-002 (device-events) ──┴── Run in parallel

Phase 3 (Integration Tests) - Sequential recommended
├── TASK-03-001 (storage integration - MSW)
├── TASK-03-002 (device integration - live API)
└── TASK-03-003 (storage device folder - live API)

Phase 4 (Polish)
└── TASK-04-001 (polyfills) - Can run after Phase 1-3

Phase 5 (CI/CD) - Run after Phase 1-4 complete
└── TASK-05-001 (PR workflow) - Depends on all tests passing
```

**Agents**: All tasks assigned to **UI Test Wizard** (`ui-test-wizard.chatmode.md`)

---

## ⚠️ Quality Gates (All Tasks)

Every task MUST include these verification steps:

1. **TypeScript Check**: Verify no red squiggles in VS Code / no compilation errors
2. **ESLint Check**: `pnpm exec nx lint <project>` must pass with zero violations
3. **Test Run**: Specific test file(s) must pass
4. **No Regressions**: Other tests in the project still pass

**Critical**: Fix any TypeScript or ESLint errors discovered during repairs. Do not leave broken code.

---

## ✅ Validation Commands

**After each phase, verify:**

```powershell
# Phase 1-2: Unit tests
pnpm exec nx run-many --target=vite:test --exclude=teensyrom-ui-e2e

# Phase 3: Integration tests  
pnpm nx run infrastructure:test:integration

# Lint checks
pnpm exec nx lint infrastructure
pnpm exec nx lint app-shell

# Full validation (after all phases)
pnpm exec nx run-many --target=vite:test --exclude=teensyrom-ui-e2e; pnpm nx run infrastructure:test:integration
```

---

## 📁 Project Files

- **Phases**: `docs/projects/TEST-REPAIR/phases/`
- **Tasks**: `docs/projects/TEST-REPAIR/tasks/`
- **Reports**: `docs/projects/TEST-REPAIR/reports/`

---

*Created: December 2, 2025*
