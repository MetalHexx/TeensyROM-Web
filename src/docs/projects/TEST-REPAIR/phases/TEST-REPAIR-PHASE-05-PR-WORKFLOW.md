# Phase 5: GitHub Actions PR Workflow

## 🎯 Objective

Create a GitHub Actions workflow that automatically runs all unit tests when a pull request is opened or updated. This provides immediate feedback on code quality and prevents regressions from being merged.

**Scope**: Unit tests only - excludes MSW-based integration tests and E2E tests (which require backend or browser).

---

## 📚 Required Reading

- [ ] [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [ ] [Nx in CI](https://nx.dev/ci/intro/ci-with-nx)

---

## 📂 Files to Create

```
.github/workflows/
└── pr-unit-tests.yml                               ✨ New - PR unit test workflow
```

---

## 📋 Tasks

### TASK-05-001: Create PR Unit Test Workflow
**File**: `tasks/TEST-REPAIR-TASK-05-001-PR-WORKFLOW.md`
**Parallel**: ❌ Run after Phases 1-4 complete (needs passing tests)

---

## ✅ Phase Completion Criteria

- [ ] `.github/workflows/pr-unit-tests.yml` exists
- [ ] Workflow triggers on PR open, synchronize, and reopen
- [ ] Workflow runs `pnpm exec nx run-many --target=vite:test --exclude=teensyrom-ui-e2e`
- [ ] Workflow excludes integration tests (MSW-based) and E2E tests
- [ ] Workflow uses proper Node.js and pnpm setup
- [ ] Workflow YAML is valid (no syntax errors)

---

## 🔍 Validation

Test the workflow by:
1. Creating a feature branch
2. Opening a PR against main
3. Verifying the workflow runs and passes

---

*Phase 5 of 5 | Est. Time: 20 minutes*
