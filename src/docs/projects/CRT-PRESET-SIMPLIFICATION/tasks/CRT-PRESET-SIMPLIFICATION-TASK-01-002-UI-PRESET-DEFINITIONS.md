# Task Handoff: Update UI Preset Definitions

## 📋 Task Identity

**Task ID**: CRT-PRESET-SIMPLIFICATION-TASK-01-002-UI-PRESET-DEFINITIONS  
**Task Name**: Update UI Preset Definitions  
**Phase**: Phase 1 - Structure Refactoring  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/copilot-instructions.md` (UI Wizard mode)  
**Priority**: High (Blocks remaining Phase 1 tasks)  
**Estimated Context Size**: Medium (~150 lines modified)

---

## 🎯 Objective

**What**: Refactor `CRT_PRESETS` object in the UI layer to use new key structure with appropriate values inherited from existing IMAGE and FULLSCREEN presets.

**Why**: The preset definitions hold the actual CRT effect values that components use. This task translates the structural changes from Task 1 (domain keys) into concrete effect configurations that match our size-based system.

**Success Criteria**:
- [ ] `CRT_PRESETS` contains exactly 4 presets using new keys from domain layer
- [ ] SMALL_CSS and SMALL_WEBGL inherit values from current IMAGE presets
- [ ] LARGE_CSS and LARGE_WEBGL inherit values from current FULLSCREEN presets
- [ ] All preset objects satisfy `CrtSettings` interface (complete property sets)
- [ ] JSDoc comments reflect size-based usage patterns
- [ ] All tests pass

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- Task 01-001: Domain preset keys updated (SMALL_CSS, SMALL_WEBGL, LARGE_CSS, LARGE_WEBGL exist)

**Dependencies**:
- `CRT_PRESET_KEYS` from domain layer (updated in Task 01-001)
- `CrtSettings` interface from UI layer (unchanged)

**Constraints**:
- Must maintain complete `CrtSettings` structure for each preset (no partial objects)
- Small presets: `screenCurvature: 0` (no curvature for compact displays)
- Large presets: `screenCurvature: 115` (curvature for fullscreen immersion)
- CSS presets: `phosphorPattern: 'none'`, `phosphorIntensity: 0`
- WebGL presets: `phosphorPattern: 'aperture-grille'`, `phosphorIntensity > 0`

---

## 📂 File Scope

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - Update CRT_PRESETS object (remove 6 presets, add 4 new presets)

**Files to Review** (for context):
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts` - CrtSettings interface definition
- `libs/domain/src/lib/models/crt-preset-names.const.ts` - Updated preset keys from Task 01-001

---

## 🔧 Implementation Guidance

### Standards to Follow

- [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript conventions, object literals
- [Testing Standards](../../../TESTING_STANDARDS.md) - Unit testing patterns
- [Component Library CRT](../../../COMPONENT_LIBRARY_CRT.md) - CRT system documentation

### Current Implementation

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`

The file currently contains a `CRT_PRESETS` object with 6 entries. Here are the relevant current presets for inheritance:

**IMAGE_CSS** (becomes SMALL_CSS):
- scanlineIntensity: 0.3, scanlineSize: 1.5
- vignetteStrength: 0.7
- screenCurvature: 0 (no curvature)
- renderMode: 'css'
- Subtle effects for compact displays

**IMAGE_WEBGL** (becomes SMALL_WEBGL):
- Similar to IMAGE_CSS but with WebGL features
- phosphorPattern: 'aperture-grille', phosphorIntensity: 0.22

**FULLSCREEN_CSS** (becomes LARGE_CSS):
- scanlineIntensity: 0.6, scanlineSize: 2.5
- vignetteStrength: 1.5
- screenCurvature: 115 (strong curvature)
- renderMode: 'css'
- Strong effects for fullscreen immersion

**FULLSCREEN_WEBGL** (becomes LARGE_WEBGL):
- Similar to FULLSCREEN_CSS but with WebGL features
- phosphorPattern: 'aperture-grille', phosphorIntensity: 0.22

### Required Changes

**Remove Old Presets**:

Delete all references to:
- `FULLSCREEN_CSS`, `FULLSCREEN_WEBGL`
- `DIALOG_CSS`, `DIALOG_WEBGL`
- `IMAGE_CSS`, `IMAGE_WEBGL`

**Add New Presets**:

Create 4 new preset definitions using `CRT_PRESET_KEYS` from domain layer:

```typescript
export const CRT_PRESETS: Record<string, CrtSettings> = {
  [CRT_PRESET_KEYS.SMALL_CSS]: {
    // Inherit from current IMAGE_CSS values
    scanlineIntensity: 0.3,
    scanlineSize: 1.5,
    vignetteStrength: 0.7,
    screenCurvature: 0,  // No curvature for small displays
    renderMode: 'css',
    phosphorPattern: 'none',
    phosphorIntensity: 0,
    // ... (all other CrtSettings properties)
  },
  [CRT_PRESET_KEYS.SMALL_WEBGL]: {
    // Inherit from current IMAGE_WEBGL values
    // Same as SMALL_CSS but with WebGL features
  },
  [CRT_PRESET_KEYS.LARGE_CSS]: {
    // Inherit from current FULLSCREEN_CSS values
    scanlineIntensity: 0.6,
    scanlineSize: 2.5,
    vignetteStrength: 1.5,
    screenCurvature: 115,  // Strong curvature for fullscreen
    renderMode: 'css',
    // ...
  },
  [CRT_PRESET_KEYS.LARGE_WEBGL]: {
    // Inherit from current FULLSCREEN_WEBGL values
    // Same as LARGE_CSS but with WebGL features
  },
};
```

**Complete CrtSettings Structure**:

Each preset must include all properties from `CrtSettings` interface:
- scanlineIntensity, scanlineSize, vignetteStrength, screenCurvature
- contrast, brightness, saturation, hue
- renderMode, phosphorPattern, phosphorIntensity
- bloomEnabled, bloomIntensity, bloomRadius
- barrelDistortion, chromaticAberration

**Update JSDoc**:

```typescript
/**
 * Built-in CRT effect presets using size-based naming.
 * 
 * SMALL presets: Optimized for compact displays (thumbnails, compact video)
 * - No screen curvature (screenCurvature: 0)
 * - Subtle scanlines and vignette
 * 
 * LARGE presets: Optimized for fullscreen displays (video dialog, fullscreen images)
 * - Screen curvature enabled (screenCurvature: 115)
 * - Strong scanlines and vignette for immersion
 * 
 * CSS vs WebGL:
 * - CSS: Pure CSS implementation, phosphor patterns disabled
 * - WebGL: Advanced effects with phosphor patterns and bloom
 */
```

### Anti-Patterns to Avoid

- ❌ **Don't create partial objects** - Each preset must have all CrtSettings properties
- ❌ **Don't mix up inheritance** - Small ← IMAGE, Large ← FULLSCREEN
- ❌ **Don't change core values** - Copy existing values exactly (Phase 3 will tune)
- ❌ **Don't hardcode preset keys** - Import from domain layer

---

## 🧪 Testing Requirements

**Test Coverage Required**:

Update tests in `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.spec.ts` (create if doesn't exist):

1. **Verify preset count**: CRT_PRESETS has exactly 4 entries
2. **Verify preset keys**: Keys match domain layer CRT_PRESET_KEYS values
3. **Verify complete structure**: Each preset has all CrtSettings properties
4. **Verify Small preset characteristics**:
   - screenCurvature: 0
   - renderMode matches key suffix (css/webgl)
5. **Verify Large preset characteristics**:
   - screenCurvature: 115
   - renderMode matches key suffix (css/webgl)
6. **Verify CSS preset characteristics**: phosphorPattern: 'none', phosphorIntensity: 0
7. **Verify WebGL preset characteristics**: phosphorPattern: 'aperture-grille', phosphorIntensity > 0

**Test Pattern Example**:

```typescript
describe('CRT_PRESETS', () => {
  it('should have exactly 4 presets', () => {
    expect(Object.keys(CRT_PRESETS)).toHaveLength(4);
  });

  it('should have Small presets with no curvature', () => {
    expect(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_CSS].screenCurvature).toBe(0);
    expect(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_WEBGL].screenCurvature).toBe(0);
  });

  it('should have Large presets with curvature', () => {
    expect(CRT_PRESETS[CRT_PRESET_KEYS.LARGE_CSS].screenCurvature).toBe(115);
    expect(CRT_PRESETS[CRT_PRESET_KEYS.LARGE_WEBGL].screenCurvature).toBe(115);
  });

  it('should have complete CrtSettings structure', () => {
    const requiredProps = ['scanlineIntensity', 'scanlineSize', 'vignetteStrength', 
                           'screenCurvature', 'renderMode', 'phosphorPattern', /* ... */];
    
    Object.values(CRT_PRESETS).forEach(preset => {
      requiredProps.forEach(prop => {
        expect(preset).toHaveProperty(prop);
      });
    });
  });
});
```

**Acceptance Tests**:
- [ ] All unit tests pass
- [ ] No TypeScript compilation errors
- [ ] Type constraint `Record<string, CrtSettings>` satisfied

---

## 📤 Output Requirements

**Completion Report Path**: `docs/projects/CRT-PRESET-SIMPLIFICATION/reports/CRT-PRESET-SIMPLIFICATION-TASK-01-002-COMPLETION.md`

**Report Must Include**:
1. ✅ All implementation subtasks completed
2. ✅ All testing subtasks completed
3. 📝 Test results (pass/fail summary)
4. 📝 Value inheritance verification (Small ← IMAGE, Large ← FULLSCREEN)
5. 📝 Any discoveries or issues encountered

**Handoff to Next Task**:

After completion, Task 01-003 (Update Preset Labels) can begin. Preset definitions are now ready for UI display.

---

## 📖 Reference Documentation

**Phase Documentation**:
- [Phase 1 Plan](../phases/CRT-PRESET-SIMPLIFICATION-PHASE-01-STRUCTURE-REFACTOR.md) - Complete phase context
- [Master Plan](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md) - Preset value inheritance decisions

**Related Standards**:
- [Coding Standards](../../../CODING_STANDARDS.md)
- [Testing Standards](../../../TESTING_STANDARDS.md)
- [Component Library CRT](../../../COMPONENT_LIBRARY_CRT.md)

**Related Files**:
- Current file: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`
- Interface: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts`
- Domain keys: `libs/domain/src/lib/models/crt-preset-names.const.ts`

---

**Task Created**: December 13, 2025  
**Status**: 🟡 Ready to Start (after Task 01-001 complete)  
**Next Task**: CRT-PRESET-SIMPLIFICATION-TASK-01-003-PRESET-LABELS
