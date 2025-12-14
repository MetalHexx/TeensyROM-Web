# Task: Final CSS Render Mode Cleanup

## 📋 Overview

**Task ID**: WEBGL-ONLY-CRT-TASK-01-005-CSS-RENDER-CLEANUP
**Task Name**: Final CSS Render Mode Cleanup
**Assigned To**: UI Test Wizard
**Agent Chatmode**: `.github/chatmodes/UI Test Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Medium

---

## 🎯 Objective

**What**: Conduct a comprehensive code audit to find and remove all lingering references to CSS render mode, including fallbacks, backwards compatibility hacks, and related code that assumes dual-mode rendering existed.

**Why**: Ensure the codebase is completely free of CSS render mode artifacts. Remove all backwards compatibility logic so the code reflects that CSS rendering mode never existed. This eliminates technical debt and prevents confusion from stale code.

**Success Criteria**:
- [ ] All CSS render mode references found and removed from codebase
- [ ] All backwards compatibility hacks for CSS mode removed
- [ ] All fallback logic assuming CSS mode might be present removed
- [ ] Code behaves as if only WebGL rendering ever existed
- [ ] No TypeScript errors or lint violations introduced
- [ ] All tests pass after cleanup
- [ ] Code review confirms no CSS render mode artifacts remain

---

## 🔍 Context & Dependencies

**Prerequisites Completed**:
- WEBGL-ONLY-CRT-TASK-01-001-DOMAIN-INFRASTRUCTURE-CLEANUP: Domain models and infrastructure cleaned
- WEBGL-ONLY-CRT-TASK-01-002-UI-COMPONENTS-REFACTOR: UI components refactored
- WEBGL-ONLY-CRT-TASK-01-003-FEATURE-COMPONENTS-UPDATE: Feature components updated
- (WEBGL-ONLY-CRT-TASK-01-004 was skipped)

**Dependencies**:
- Grep/semantic search tools to find lingering references
- Understanding of what CSS render mode was and how it worked
- Knowledge of common backwards compatibility patterns

**Constraints**:
- Don't remove WebGL-specific code (we want to keep WebGL)
- Don't remove CSS `brightness` filter (still used by WebGL renderer)
- Do remove any code that checks for, falls back to, or handles CSS mode
- Do remove any comments mentioning CSS render mode

---

## 📂 Search Areas & Patterns

**Files to Search Comprehensively**:
- `libs/domain/**/*.ts` - Domain models, constants, types
- `libs/application/**/*.ts` - Stores, actions, selectors
- `libs/features/**/*.ts` - Smart components
- `libs/ui/**/*.ts` - Dumb components, especially CRT wrapper
- `libs/infrastructure/**/*.ts` - Services, utilities
- `**/*.spec.ts` - Test files with old assumptions
- `**/*.scss` - Stylesheets with CSS render mode styles
- `**/*.html` - Templates with CSS mode conditionals

**Search Patterns to Look For**:

1. **String/Comment References**:
   - "CSS" or "css" in variable names, comments, strings
   - "render mode" or "renderMode" or "rendering mode"
   - "fallback"
   - "backwards compatible" or "backward compatible"
   - "legacy"

2. **Code Patterns**:
   - Conditional logic checking for CSS vs WebGL
   - Null checks or optional chaining assuming CSS mode might not work
   - Default values or fallbacks related to rendering
   - Guard clauses protecting against missing WebGL
   - Type narrowing that distinguishes CSS from WebGL

3. **Specific Artifacts**:
   - `CrtRenderMode` type references (should be gone)
   - `SMALL_CSS`, `LARGE_CSS` preset references (should be gone)
   - WebGL detector service usage (should be gone)
   - Mode switching UI logic (should be gone)

---

## 🛠️ Implementation Guidance

### Cleanup Strategy

1. **Search Systematically**:
   - Use grep_search with regex patterns for CSS/render mode terms
   - Use semantic search for "fallback" and "backwards compatible"
   - Check each result to determine if it's CSS render mode related

2. **Evaluate Each Reference**:
   - Is this CSS render mode related? → Remove it
   - Is this WebGL-specific code? → Keep it
   - Is this general CSS styling? → Keep it (unless CSS render mode specific)
   - Is this the brightness filter? → Keep it (used by WebGL)

3. **Remove Decisively**:
   - Delete entire functions/methods if they only handled CSS mode
   - Remove conditional branches that checked for CSS mode
   - Simplify logic that had CSS mode fallbacks
   - Delete stale comments referencing old rendering system

4. **Validate After Each Change**:
   - Run TypeScript compiler to catch errors
   - Run linter to ensure code quality
   - Run tests to verify behavior
   - Test visually in browser if needed

### Examples of What to Remove

**❌ Backwards Compatibility Hack**:
```typescript
// Old code with CSS mode fallback
const preset = settings.renderMode === 'css' 
  ? CRT_PRESETS.SMALL_CSS 
  : CRT_PRESETS.SMALL_WEBGL;
```
**✅ After Cleanup**:
```typescript
const preset = CRT_PRESETS.SMALL_WEBGL;
```

**❌ Conditional CSS Mode Check**:
```typescript
if (this.webGLSupported()) {
  this.initWebGL();
} else {
  this.fallbackToCSS();
}
```
**✅ After Cleanup**:
```typescript
this.initWebGL();
```

**❌ Comment Mentioning CSS Mode**:
```typescript
// If WebGL is not available, we fall back to CSS rendering
const canvas = this.renderer.getCanvas();
```
**✅ After Cleanup**:
```typescript
const canvas = this.renderer.getCanvas();
```

**❌ Type Union with CSS Mode**:
```typescript
type RenderMethod = 'webgl' | 'css';
```
**✅ After Cleanup**:
```typescript
// Just use 'webgl' inline, or remove type entirely if not needed
```

### What NOT to Remove

**✅ Keep WebGL-Specific Code**:
```typescript
// This is WebGL-specific, not CSS mode related
this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
```

**✅ Keep Brightness CSS Filter**:
```typescript
// This CSS is used BY WebGL rendering, keep it
this.element.style.filter = `brightness(${brightness})`;
```

**✅ Keep General CSS Styling**:
```typescript
// General styling, not CSS render mode related
.crt-container {
  display: flex;
  align-items: center;
}
```

---

## 🔍 Implementation Subtasks

### Subtask 1: Systematic Search
- [ ] Search codebase for "CSS" or "css" in variable/comment context
- [ ] Search for "render mode", "renderMode", "rendering mode"
- [ ] Search for "fallback" in CRT-related files
- [ ] Search for "backwards compatible" or "legacy" 
- [ ] Document all findings with file paths and line numbers

### Subtask 2: Code Cleanup
- [ ] Remove CSS mode conditional logic
- [ ] Remove CSS mode fallback branches
- [ ] Delete functions that only served CSS mode
- [ ] Remove null checks assuming CSS mode might fail
- [ ] Simplify logic that had CSS mode variations

### Subtask 3: Comment & Documentation Cleanup
- [ ] Remove comments mentioning CSS render mode
- [ ] Update comments that reference old dual-mode system
- [ ] Remove stale JSDoc tags about render mode
- [ ] Clean up TODO comments about CSS mode

### Subtask 4: Style & Template Cleanup
- [ ] Remove CSS render mode specific SCSS
- [ ] Remove HTML conditionals checking for CSS mode
- [ ] Remove CSS classes only used for CSS render mode
- [ ] Verify no broken styling after removals

### Subtask 5: Test Cleanup
- [ ] Remove test cases for CSS render mode
- [ ] Remove test mocks for CSS mode behavior
- [ ] Update test descriptions mentioning CSS mode
- [ ] Remove assertions checking for CSS mode properties

### Subtask 6: Validation
- [ ] Run TypeScript compiler (`pnpm nx build teensyrom-ui`)
- [ ] Run linter (`pnpm nx lint`)
- [ ] Run unit tests (`pnpm nx test`)
- [ ] Visual test in browser (file-image, video-capture, video-dialog)
- [ ] Confirm no console errors or warnings

---

## 🧪 Testing Requirements

**Test Coverage Required**:

**Build & Lint**:
- [ ] TypeScript compiles without errors
- [ ] ESLint passes with no violations
- [ ] No new console warnings

**Unit Tests**:
- [ ] All existing tests pass after cleanup
- [ ] No test failures from removed code
- [ ] Test descriptions accurate (no CSS mode references)

**Integration Tests**:
- [ ] CRT effect wrapper renders correctly
- [ ] Settings panel loads and updates presets
- [ ] Components initialize without errors

**Manual Verification**:
- [ ] File-image view displays CRT effect
- [ ] Video-capture view displays CRT effect
- [ ] Video-dialog displays CRT effect
- [ ] Settings panel preset switching works
- [ ] No console errors in browser dev tools

**Behavioral Expectations**:
- Code behaves identically to before cleanup (no functional changes)
- No performance degradation
- No visual differences in rendering
- Cleaner, simpler code with less branching

---

## 📚 Related Documentation

**Feature Planning**:
- [Master Plan](../WEBGL-ONLY-CRT-MASTER-PLAN.md) - Complete project context
- [Phase 1 Plan](../phases/WEBGL-ONLY-CRT-PHASE-01-WEBGL-ONLY-REFACTORING.md) - Phase objectives

**Standards**:
- [Coding Standards](../../../CODING_STANDARDS.md) - Code style and conventions
- [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approach

**Related Tasks**:
- WEBGL-ONLY-CRT-TASK-01-001-DOMAIN-INFRASTRUCTURE-CLEANUP: Initial cleanup work
- WEBGL-ONLY-CRT-TASK-01-002-UI-COMPONENTS-REFACTOR: UI component refactoring
- WEBGL-ONLY-CRT-TASK-01-003-FEATURE-COMPONENTS-UPDATE: Feature component updates

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/WEBGL-ONLY-CRT/reports/WEBGL-ONLY-CRT-TASK-01-005-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/WEBGL-ONLY-CRT/reports/WEBGL-ONLY-CRT-TASK-01-005-REPORT.md`

---

## 💡 Tips for Success

**Be Thorough**: This is a final cleanup pass. Take time to search comprehensively.

**Be Decisive**: If code only served CSS mode, remove it. Don't leave "just in case" code.

**Be Careful**: Don't remove WebGL-specific code or the brightness CSS filter.

**Document Findings**: Note interesting patterns or surprises in the report.

**Test Incrementally**: After each significant removal, run tests to catch issues early.

**Ask if Uncertain**: If you find code and aren't sure if it's CSS mode related, note it in the report and ask.

---

**Remember**: The goal is to make the codebase look like CSS rendering mode never existed. Be thorough and decisive in removing all traces of the old dual-mode system.
