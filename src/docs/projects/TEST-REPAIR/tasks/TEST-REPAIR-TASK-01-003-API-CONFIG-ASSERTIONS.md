# Task: Fix API Config Provider Assertions

## 📋 Task Identity

**Task ID**: TEST-REPAIR-TASK-01-003-API-CONFIG-ASSERTIONS  
**Task Name**: Fix api-config.provider.spec.ts assertion mismatches  
**Assigned To**: UI Test Wizard  
**Agent Chatmode**: `.github/chatmodes/ui-test-wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small  

---

## 🎯 Objective

**What**: Update assertions in `api-config.provider.spec.ts` to account for the `getBaseUrl` function that was added to the `ApiConfig` interface.

**Why**: Tests use `toEqual()` for exact matching, but the actual object now includes a `getBaseUrl` function that isn't in the expected object.

**Success Criteria**:
- [ ] `Development Mode > should return absolute URLs when in dev mode` test passes
- [ ] `Production Mode > should return relative URLs (empty strings) when in production mode` test passes
- [ ] `pnpm exec nx run infrastructure:vite:test` passes
- [ ] `pnpm exec nx lint infrastructure` passes with zero violations
- [ ] Zero TypeScript errors in modified files

---

## 📁 File Scope

**Files to Modify**:
- `libs/infrastructure/src/lib/config/api-config.provider.spec.ts` - Fix 2 assertions

**Files to Review** (for context):
- `libs/infrastructure/src/lib/config/api-config.provider.ts` - See current ApiConfig shape

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Testing Standards](../../../TESTING_STANDARDS.md)
- [Coding Standards](../../../CODING_STANDARDS.md)

**Key Requirements**:

The `ApiConfig` interface now includes `getBaseUrl: () => string`. Update assertions to handle this.

**Option A - Use toMatchObject (ignores extra properties)**:
```typescript
expect(config).toMatchObject({
  basePath: 'http://localhost:5168',
  signalRBasePath: 'http://localhost:5168',
});
```

**Option B - Include function in expected (more explicit)**:
```typescript
expect(config).toEqual({
  basePath: 'http://localhost:5168',
  signalRBasePath: 'http://localhost:5168',
  getBaseUrl: expect.any(Function),
});
```

**Recommendation**: Use Option A (`toMatchObject`) for cleaner tests - we care about the URL values, not the function.

**Anti-Patterns to Avoid**:
- Don't remove or skip tests
- Don't modify the actual provider code

---

## ✅ Testing Requirements

**Validation Steps**:
1. Run `pnpm exec nx run infrastructure:vite:test -- --testPathPattern=api-config` - both tests should pass
2. Run `pnpm exec nx lint infrastructure` - zero violations
3. Verify no TypeScript red squiggles in modified file

---

## 📤 Output

Save completion report to: `reports/TEST-REPAIR-TASK-01-003-REPORT.md`

---

*Task 3 of 3 in Phase 1 | Est. Time: 10 minutes*
