# Task: Create PR Unit Test Workflow

## 📋 Task Identity

**Task ID**: TEST-REPAIR-TASK-05-001-PR-WORKFLOW  
**Task Name**: Create GitHub Actions workflow for PR unit tests  
**Assigned To**: UI Test Wizard  
**Agent Chatmode**: `.github/chatmodes/ui-test-wizard.chatmode.md`  
**Priority**: Medium  
**Estimated Context Size**: Small  

---

## 🎯 Objective

**What**: Create a GitHub Actions workflow that runs all unit tests when a PR is opened or updated.

**Why**: Automated testing on PRs catches regressions early and provides confidence that changes don't break existing functionality.

**Success Criteria**:
- [ ] Workflow file created at `.github/workflows/pr-unit-tests.yml`
- [ ] Triggers on: `pull_request` (opened, synchronize, reopened)
- [ ] Runs unit tests via Nx (excludes E2E and integration tests)
- [ ] Uses correct Node.js version (check package.json engines or .nvmrc)
- [ ] Uses pnpm for package management
- [ ] Workflow YAML syntax is valid

---

## 📁 File Scope

**Files to Create**:
- `.github/workflows/pr-unit-tests.yml` - PR workflow for unit tests

**Files to Review** (for context):
- `package.json` - Check Node.js version and pnpm version
- `.nvmrc` or `.node-version` - If exists, use specified version
- `nx.json` - Understand Nx configuration
- Existing `.github/workflows/` - Check for existing patterns to follow

---

## 🔧 Implementation Guidance

**Key Requirements**:

### Workflow Structure

```yaml
name: PR Unit Tests

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    
    defaults:
      run:
        working-directory: ./src  # Frontend is in src/ subdirectory
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Needed for Nx affected commands
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9  # Check package.json for exact version
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'  # Check package.json engines
          cache: 'pnpm'
          cache-dependency-path: './src/pnpm-lock.yaml'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Run unit tests
        run: pnpm exec nx run-many --target=vite:test --exclude=teensyrom-ui-e2e
```

### Important Notes

1. **Working Directory**: The frontend workspace is in `src/` subdirectory, not repo root
2. **Exclude E2E**: Use `--exclude=teensyrom-ui-e2e` to skip Cypress tests
3. **No Integration Tests**: The `vite:test` target runs unit tests only (not `test:integration`)
4. **Fetch Depth**: Use `fetch-depth: 0` for Nx to calculate affected projects
5. **Cache**: Cache pnpm store for faster subsequent runs

### Optional Enhancements

- Add `nx affected` instead of `run-many` to only test changed projects
- Add lint step before tests
- Add concurrency group to cancel outdated runs

**Anti-Patterns to Avoid**:
- Don't include integration tests (require backend)
- Don't include E2E tests (require browser/Cypress)
- Don't use npm when project uses pnpm
- Don't forget the working-directory for src/ subdirectory

---

## ✅ Testing Requirements

**Validation Steps**:
1. Validate YAML syntax (use online validator or VS Code YAML extension)
2. Verify workflow file is in correct location: `.github/workflows/`
3. Create a test PR to verify workflow triggers and runs successfully

**Manual Test**:
```powershell
# Verify the test command works locally first
cd src
pnpm exec nx run-many --target=vite:test --exclude=teensyrom-ui-e2e
```

---

## 📤 Output

Save completion report to: `reports/TEST-REPAIR-TASK-05-001-REPORT.md`

---

*Task 1 of 1 in Phase 5 | Est. Time: 20 minutes*
