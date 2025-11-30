# Task Handoff: API Config Provider

## 📋 Task Identity

**Task ID**: DISTRIBUTION-PACKAGING-TASK-01-002-API-CONFIG-PROVIDER  
**Task Name**: Create Environment-Based API Config Provider  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small

---

## 🎯 Objective

**What**: Create an Angular provider factory that returns different API configurations based on development vs production mode.

**Why**: This provider enables automatic URL switching - development uses absolute URLs (`http://localhost:5168`) while production uses relative URLs (empty string).

**Success Criteria**:
- [ ] `provideApiConfig()` factory function created
- [ ] Uses `isDevMode()` to detect environment
- [ ] Returns correct configuration for each environment
- [ ] `API_CONFIG_PROVIDER` provider definition exported
- [ ] Barrel exports created
- [ ] TypeScript compiles, ESLint passes

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- DISTRIBUTION-PACKAGING-TASK-01-001-API-CONFIG-CONTRACT: `IApiConfig` and `API_CONFIG` token exist

**Dependencies**:
- `@angular/core` - for `isDevMode()`, `Provider`
- `@teensyrom-nx/domain` - for `IApiConfig`, `API_CONFIG`

**Constraints**:
- Must be in infrastructure layer
- No external dependencies beyond Angular core

---

## 📂 File Scope

**Files to Create**:
- `libs/infrastructure/src/lib/config/api-config.provider.ts` - Provider factory
- `libs/infrastructure/src/lib/config/index.ts` - Barrel export

**Files to Modify**:
- `libs/infrastructure/src/index.ts` - Re-export config module

**Files to Review** (for patterns):
- `libs/infrastructure/src/lib/device/providers.ts` - Provider patterns
- Task 01-001 report for contract details

---

## 📋 Implementation Guidance

**Standards to Follow**:
- [SERVICE_STANDARDS.md](../../../../SERVICE_STANDARDS.md) - Provider patterns
- [CODING_STANDARDS.md](../../../../CODING_STANDARDS.md) - TypeScript conventions

**Key Requirements**:

1. **Create `provideApiConfig()` factory**:
   - Import `isDevMode` from `@angular/core`
   - Return `IApiConfig` object
   - Development mode: `{ basePath: 'http://localhost:5168', signalRBasePath: 'http://localhost:5168' }`
   - Production mode: `{ basePath: '', signalRBasePath: '' }`

2. **Create `API_CONFIG_PROVIDER` provider definition**:
   - `provide: API_CONFIG`
   - `useFactory: provideApiConfig`

3. **Create barrel export**:
   - Export provider from `config/index.ts`
   - Re-export from main infrastructure index

**Environment Detection**:

Angular's `isDevMode()`:
- Returns `true` during `ng serve` / dev builds
- Returns `false` in production builds
- No environment files needed

**Anti-Patterns to Avoid**:
- Don't use environment.ts files (not needed)
- Don't hardcode values outside the factory
- Don't make the factory async

---

## 🧪 Testing Requirements

**Unit Test** (optional but recommended):

Create `api-config.provider.spec.ts`:
- Test factory returns correct structure
- Note: `isDevMode()` behavior may vary in test environment

**Verification**:
- [ ] `pnpm nx build infrastructure` succeeds
- [ ] `pnpm nx lint infrastructure` passes
- [ ] Provider can be imported from `@teensyrom-nx/infrastructure`

---

## 📚 Reference Materials

**Related Documentation**:
- [DISTRIBUTION_PACKAGING_PLAN.md](../../../../features/DISTRIBUTION_PACKAGING_PLAN.md) - Section 3.1.2
- [Phase 01 Plan](../phases/DISTRIBUTION-PACKAGING-PHASE-01-RELATIVE-URL-MIGRATION.md)
- [Angular isDevMode Docs](https://angular.io/api/core/isDevMode)

**Related Tasks**:
- DISTRIBUTION-PACKAGING-TASK-01-001-API-CONFIG-CONTRACT: Provides the interface and token

---

## 📤 Output

**Output Report Location**: `docs/projects/DISTRIBUTION-PACKAGING/reports/DISTRIBUTION-PACKAGING-TASK-01-002-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report when complete.
