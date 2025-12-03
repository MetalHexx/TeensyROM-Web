# Task: Add Global Test Polyfills

## 📋 Task Identity

**Task ID**: TEST-REPAIR-TASK-04-001-TEST-POLYFILLS  
**Task Name**: Add ResizeObserver and MediaDevices polyfills to test setup  
**Assigned To**: UI Test Wizard  
**Agent Chatmode**: `.github/chatmodes/ui-test-wizard.chatmode.md`  
**Priority**: Low  
**Estimated Context Size**: Small  

---

## 🎯 Objective

**What**: Add global polyfills/mocks for `ResizeObserver` and `MediaDevices` APIs to eliminate test console warnings.

**Why**: These warnings clutter test output and make real failures harder to spot. The tests pass (components handle missing APIs gracefully), but the noise is distracting.

**Success Criteria**:
- [ ] `ResizeObserver is not defined` warnings eliminated
- [ ] `MediaDevices API not available` warnings eliminated
- [ ] All infrastructure tests still pass
- [ ] `pnpm exec nx lint infrastructure` passes with zero violations
- [ ] Zero TypeScript errors in modified files

---

## 📁 File Scope

**Files to Modify**:
- `libs/infrastructure/src/test-setup.ts` - Add polyfills (or create if doesn't exist)

**Files to Review** (for context):
- `libs/infrastructure/vite.config.ts` - See test setup file configuration
- Existing test-setup files in other projects for patterns

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Testing Standards](../../../TESTING_STANDARDS.md)
- [Coding Standards](../../../CODING_STANDARDS.md)

**Key Requirements**:

### ResizeObserver Polyfill

```typescript
// Mock ResizeObserver for tests
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
```

### MediaDevices Polyfill

```typescript
import { vi } from 'vitest';

// Mock navigator.mediaDevices for tests
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockRejectedValue(new Error('Not supported in tests')),
    enumerateDevices: vi.fn().mockResolvedValue([]),
  },
  writable: true,
});
```

### Placement

Add these polyfills to `test-setup.ts` which runs before all tests. If the file doesn't exist, create it and ensure it's referenced in `vite.config.ts`:

```typescript
// vite.config.ts
test: {
  setupFiles: ['src/test-setup.ts'],
}
```

**Anti-Patterns to Avoid**:
- Don't add polyfills inline in individual test files
- Don't modify actual component code to suppress warnings

---

## ✅ Testing Requirements

**Validation Steps**:
1. Run `pnpm exec nx run infrastructure:vite:test` - should pass with cleaner output
2. Run `pnpm exec nx run ui-components:vite:test` - check for cleaner output (if CRT tests there)
3. Run `pnpm exec nx lint infrastructure` - zero violations
4. Verify no TypeScript red squiggles in modified file

---

## 📤 Output

Save completion report to: `reports/TEST-REPAIR-TASK-04-001-REPORT.md`

---

*Task 1 of 1 in Phase 4 | Est. Time: 15 minutes*
