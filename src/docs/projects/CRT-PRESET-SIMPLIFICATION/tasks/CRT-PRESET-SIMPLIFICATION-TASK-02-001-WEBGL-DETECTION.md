# Task Handoff: Create WebGL Detection Utility

## 📋 Task Identity

**Task ID**: CRT-PRESET-SIMPLIFICATION-TASK-02-001-WEBGL-DETECTION  
**Task Name**: Create WebGL Detection Utility  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High (Foundation for Phase 2)  
**Estimated Context Size**: Small (1-2 files)

---

## 🎯 Objective

**What**: Create a simple, reusable utility function in the infrastructure layer to detect WebGL support.

**Why**: Components need to choose appropriate default CRT presets (WebGL vs CSS) for first-time users based on browser capabilities.

**Success Criteria**:
- [ ] Function created in `libs/infrastructure/src/lib/utils/webgl-detector.ts`
- [ ] Function returns boolean indicating WebGL availability
- [ ] Handles SSR environment (returns false when `document` undefined)
- [ ] Handles exceptions gracefully (returns false on any error)
- [ ] Function is pure with no side effects (tree-shakable)
- [ ] Exported from infrastructure barrel (`utils/index.ts`)
- [ ] JSDoc documentation added
- [ ] Tests written and passing

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- CRT-PRESET-SIMPLIFICATION-TASK-01-001: Domain preset keys updated
- CRT-PRESET-SIMPLIFICATION-TASK-01-002: UI preset definitions refactored
- Phase 1 complete: New Small/Large preset structure established

**Dependencies**:
- No external dependencies
- Browser `document` API (with SSR check)
- Canvas WebGL context creation

**Constraints**:
- Must handle server-side rendering (Angular Universal compatibility)
- Must not throw errors (fail gracefully)
- Must be stateless (no caching needed)
- Should follow same logic as existing `CrtRenderer.isSupported()` in `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts`

---

## 📂 File Scope

**Files to Create**:
- `libs/infrastructure/src/lib/utils/webgl-detector.ts` - WebGL detection utility
- `libs/infrastructure/src/lib/utils/webgl-detector.spec.ts` - Unit tests

**Files to Modify**:
- `libs/infrastructure/src/lib/utils/index.ts` - Add export for new utility

**Files to Review** (for context):
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts` - Existing WebGL detection logic (lines 20-40)

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript conventions
- [Testing Standards](../../../TESTING_STANDARDS.md) - Unit testing approach
- [Infrastructure Layer Patterns](../../../OVERVIEW_CONTEXT.md#infrastructure-layer) - Utility organization

**Key Requirements**:

1. **Function Signature**:
   - Name: `detectWebGLSupport()`
   - Return type: `boolean`
   - No parameters (pure function)

2. **Detection Logic**:
   - Check if `document` is defined (SSR check)
   - Create temporary canvas element
   - Attempt to get WebGL context (`'webgl'` or `'experimental-webgl'`)
   - Return `true` if context obtained, `false` otherwise
   - Catch and handle any exceptions → return `false`

3. **Code Pattern** (architectural guidance):
```typescript
export function detectWebGLSupport(): boolean {
  // SSR check
  if (typeof document === 'undefined') return false;
  
  try {
    // Create canvas, attempt context
    // Return true if context !== null
  } catch {
    return false;
  }
}
```

4. **JSDoc Documentation**:
   - Explain purpose (WebGL capability detection for CRT preset selection)
   - Document return value (true = WebGL available, false = not available or SSR)
   - Note exception handling behavior
   - Add usage example

**Anti-Patterns to Avoid**:
- Don't cache the result (components call once during initialization)
- Don't create a service wrapper (overkill for simple utility)
- Don't modify global state
- Don't throw exceptions (handle all errors internally)

---

## 🧪 Testing Requirements

**Test Coverage Required**:

**Unit Tests** (in `webgl-detector.spec.ts`):
- [ ] Returns `true` when WebGL context is available
- [ ] Returns `false` when WebGL context is unavailable
- [ ] Returns `false` in SSR environment (`document` undefined)
- [ ] Returns `false` when context creation throws exception
- [ ] Does not throw errors for any input

**Behavioral Expectations**:
- Mock `document.createElement` to return mock canvas
- Mock canvas `getContext` to return:
  - Valid WebGL context (truthy object) → expect `true`
  - `null` → expect `false`
- Mock `document` as `undefined` → expect `false`
- Mock `getContext` to throw error → expect `false`

**Testing Reference**:
- See [Testing Standards](../../../TESTING_STANDARDS.md#unit-tests) for utility function patterns
- Use Vitest mocking: `vi.spyOn(document, 'createElement')`

---

## 📖 Reference Materials

**Related Documentation**:
- [Master Plan - WebGL Detection](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md#integration-points)
- [Phase 2 Plan](../phases/CRT-PRESET-SIMPLIFICATION-PHASE-02-COMPONENT-IMPLEMENTATION.md#task-1-create-webgl-detection-utility)

**Related Tasks**:
- CRT-PRESET-SIMPLIFICATION-TASK-02-002-FILE-IMAGE: Will use this utility
- CRT-PRESET-SIMPLIFICATION-TASK-02-003-VIDEO-CAPTURE: Will use this utility
- CRT-PRESET-SIMPLIFICATION-TASK-02-004-VIDEO-DIALOG: Will use this utility

**Similar Implementations**:
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts` (lines 20-40) - Existing detection logic to reference

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/CRT-PRESET-SIMPLIFICATION/reports/CRT-PRESET-SIMPLIFICATION-TASK-02-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report

---

## 💡 Implementation Notes

**Design Rationale**:
- **Pure Function**: No service overhead, easier to test, tree-shakable
- **SSR Compatible**: Angular Universal safe (returns false server-side)
- **No Caching**: Components initialize once, so caching provides no benefit
- **Fail-Safe**: All error paths return false (safe default fallback)

**Integration Flow**:
1. Component constructor executes
2. Check for saved settings
3. If no saved settings: call `detectWebGLSupport()`
4. Select SMALL_WEBGL or SMALL_CSS based on result
5. Initialize CRT settings with selected preset

**Why Not a Service**:
- Single-purpose utility doesn't need DI
- No state to manage
- Called once per component lifecycle
- Simpler to test as pure function
