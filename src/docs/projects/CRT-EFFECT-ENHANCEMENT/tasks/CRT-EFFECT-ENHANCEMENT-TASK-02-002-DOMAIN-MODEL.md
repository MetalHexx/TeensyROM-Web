# Task Handoff: Domain Model & Settings Update

## 📋 Task Identity

**Task ID**: CRT-EFFECT-ENHANCEMENT-TASK-02-002-DOMAIN-MODEL  
**Task Name**: Add renderMode to CRT Settings Domain Model  
**Phase**: 02 - WebGL Renderer Implementation  
**Priority**: High  
**Estimated Effort**: 30 minutes  
**Estimated Context Size**: Small (3 files)

---

## 🎯 Objective

**What**: Add `renderMode` property to the `CrtSettings` domain model to enable users to choose between CSS and WebGL rendering modes.

**Why**: Users need the ability to switch between CSS (lightweight, always works) and WebGL (high-fidelity, no banding) modes. The 'auto' option allows intelligent default behavior.

**Success Criteria**:
- [ ] `renderMode` property added to `CrtSettings` interface in domain layer
- [ ] Type exported: `'css' | 'webgl' | 'auto'`
- [ ] Default value set to `'auto'` in defaults
- [ ] All presets updated with renderMode
- [ ] JSDoc documentation complete
- [ ] Existing tests still pass

---

## 📦 Context & Dependencies

**Prerequisites Completed**:
- None - can run in parallel with Task 02-001

**Dependencies**:
- None

**Constraints**:
- Domain layer must remain pure (no Angular dependencies)
- Backward compatible - existing code without renderMode should still work
- Default to 'auto' for optimal user experience

---

## 📁 File Scope

**Files to Modify**:

1. `libs/domain/src/lib/models/crt-settings.model.ts`
   - Add `renderMode` property to `CrtSettings` interface
   - Add `CrtRenderMode` type alias
   - Add JSDoc documentation

2. `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts`
   - Re-export `CrtRenderMode` type from domain

3. `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`
   - Add `renderMode: 'auto'` to `DEFAULT_CRT_SETTINGS`
   - Add `renderMode` to all `CRT_PRESETS`

---

## 🔧 Implementation Guidance

### 1. Domain Model (`crt-settings.model.ts`)

Add the following to the existing interface:

```typescript
/**
 * Render mode for CRT effects.
 * - 'css': Use CSS-based rendering (lightweight, may have banding at non-100% zoom)
 * - 'webgl': Use WebGL-based rendering (high-fidelity, no banding, requires GPU)
 * - 'auto': Automatically choose best available option (WebGL if supported, else CSS)
 */
export type CrtRenderMode = 'css' | 'webgl' | 'auto';

export interface CrtSettings {
  // ... existing properties ...

  /**
   * Rendering mode for CRT effects.
   * - 'css': CSS-based rendering (lightweight, universal support)
   * - 'webgl': WebGL-based rendering (eliminates banding at any zoom level)
   * - 'auto': Automatically select best available mode (default)
   * 
   * Use 'auto' for optimal experience - WebGL when available, CSS fallback otherwise.
   * Use 'css' to force lightweight mode or when WebGL causes issues.
   * Use 'webgl' to require WebGL (will show no effects if WebGL unavailable).
   */
  renderMode: CrtRenderMode;
}
```

### 2. Interface Re-export (`crt-settings.interface.ts`)

Add re-export:

```typescript
/**
 * Re-export CrtSettings and CrtRenderMode from domain layer for convenience.
 */
export type { CrtSettings, CrtRenderMode } from '@teensyrom-nx/domain';
```

### 3. Defaults (`crt-settings.defaults.ts`)

Update the default settings:

```typescript
export const DEFAULT_CRT_SETTINGS: CrtSettings = {
  scanlineIntensity: 0.5,
  scanlineSize: 2.5,
  vignetteStrength: 1.3,
  screenCurvature: 115,
  contrast: 1.1,
  brightness: 1.5,
  saturation: 1.3,
  hue: 0,
  renderMode: 'auto',  // NEW: Default to auto-detection
};
```

Update all presets in `CRT_PRESETS`:

```typescript
export const CRT_PRESETS = {
  full: {
    // ... existing values ...
    renderMode: 'auto' as const,
  },
  standard: {
    // ... existing values ...
    renderMode: 'auto' as const,
  },
  // ... other presets ...
};
```

---

## 🧪 Testing Requirements

**Test Coverage Required**:

1. **Type Safety**
   - Verify `CrtRenderMode` type is exported correctly
   - Verify `renderMode` is required on `CrtSettings`

2. **Defaults**
   - Verify `DEFAULT_CRT_SETTINGS.renderMode` is `'auto'`
   - Verify all presets include `renderMode`

3. **Existing Tests**
   - All existing CRT component tests should still pass
   - No breaking changes to existing functionality

**Test Execution**:
```bash
# Run domain tests
pnpm nx test domain

# Run UI component tests  
pnpm nx test ui-components --testFile=crt-effect-wrapper

# Run all affected tests
pnpm nx affected:test
```

---

## 📚 Reference Materials

**Related Documentation**:
- [Phase 2 Plan](../phases/CRT-EFFECT-ENHANCEMENT-PHASE-02-WEBGL-RENDERER.md)
- [CrtSettings Domain Model](../../../../libs/domain/src/lib/models/crt-settings.model.ts)

**Existing Code to Reference**:
- Current `CrtSettings` interface structure
- Existing preset patterns in `crt-settings.defaults.ts`

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/CRT-EFFECT-ENHANCEMENT/reports/CRT-EFFECT-ENHANCEMENT-TASK-02-002-REPORT.md`

---

## ✅ Completion Checklist

Before marking complete:

- [ ] `CrtRenderMode` type added to domain model
- [ ] `renderMode` property added to `CrtSettings` interface
- [ ] JSDoc documentation complete for new property
- [ ] Type re-exported from UI components interface file
- [ ] Default value set to `'auto'`
- [ ] All presets updated with `renderMode`
- [ ] All existing tests pass
- [ ] No TypeScript errors
- [ ] Report saved to specified location

---

## 💡 Hints for Success

1. **Keep it simple**: This is a straightforward model extension - just add the property and type.

2. **Use `as const`**: When adding to presets, use `renderMode: 'auto' as const` for proper type narrowing.

3. **Check exports**: Make sure the new type is properly exported from the domain barrel file (`libs/domain/src/lib/models/index.ts`).

4. **Backward compatibility**: If any code doesn't provide `renderMode`, TypeScript will catch it. That's intentional - we want all usages to be explicit.

5. **Don't update component yet**: The component integration happens in Task 02-003. This task only updates the data model.
