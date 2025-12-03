# Task: Disable Test Targets for Generated/Empty Libraries

## 📋 Task Identity

**Task ID**: TEST-REPAIR-TASK-01-001-DISABLE-TEST-TARGETS  
**Task Name**: Disable vite:test targets for api-client and app-bootstrap  
**Assigned To**: UI Test Wizard  
**Agent Chatmode**: `.github/chatmodes/ui-test-wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small  

---

## 🎯 Objective

**What**: Disable the `vite:test` target for `api-client` (generated code) and `app-bootstrap` (no tests) projects to prevent test suite failures.

**Why**: These projects have no test files, causing vitest to exit with code 1 when running `run-many` test commands.

**Success Criteria**:
- [ ] `api-client` project.json has `vite:test` target disabled or removed
- [ ] `app-bootstrap` project.json has `vite:test` target disabled or removed
- [ ] `pnpm exec nx run-many --target=vite:test` no longer fails on these projects
- [ ] Zero TypeScript errors
- [ ] Zero ESLint violations

---

## 📁 File Scope

**Files to Modify**:
- `libs/data-access/api-client/project.json` - Add target override to disable testing
- `libs/app/bootstrap/project.json` - Add target override to disable testing

**Files to Review** (for context):
- `libs/infrastructure/project.json` - Example of project with proper test configuration

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md)

**Key Requirements**:

1. For each project.json, add a target override that disables the inherited `vite:test` target:

```json
{
  "targets": {
    "vite:test": {}
  }
}
```

Or explicitly mark it as not runnable by setting executor to false or removing it from the project.

2. The simplest approach is to add an empty target override which effectively disables the inherited target.

**Anti-Patterns to Avoid**:
- Don't add placeholder test files with skips (unnecessary complexity)
- Don't modify workspace-level configuration

---

## ✅ Testing Requirements

**Validation Steps**:
1. Run `pnpm exec nx run api-client:vite:test` - should report no target or be disabled
2. Run `pnpm exec nx run app-bootstrap:vite:test` - should report no target or be disabled
3. Run `pnpm exec nx run-many --target=vite:test --exclude=teensyrom-ui-e2e` - should not fail on these projects

---

## 📤 Output

Save completion report to: `reports/TEST-REPAIR-TASK-01-001-REPORT.md`

---

*Task 1 of 3 in Phase 1 | Est. Time: 10 minutes*
