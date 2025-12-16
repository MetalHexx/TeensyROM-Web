# Task: Shader Barrel Distortion Implementation

**Task ID**: BARREL-DISTORTION-TASK-02-001-SHADER-IMPLEMENTATION  
**Task Name**: Implement Barrel Distortion Algorithm in Fragment Shader  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small (2 files)  
**Estimated Effort**: 60-90 minutes

---

## 📋 Task Overview

### What

Implement the barrel distortion effect in the WebGL fragment shader (`scanline.frag.ts`), adding geometric warping to texture coordinates before video sampling. The distortion should coordinate with screen curvature settings and include zero-intensity optimization for performance.

### Why

This is the core visual rendering logic for the barrel distortion effect. Without this shader implementation, the domain model changes from Phase 1 have no visual impact. The shader must efficiently calculate radial coordinate warping on the GPU while respecting aspect ratio constraints and avoiding wasted cycles when the effect is disabled.

### Success Criteria

- [ ] `u_barrelDistortion` uniform added to shader uniforms section
- [ ] `applyBarrelDistortion()` function implemented with correct radial distortion formula
- [ ] Zero-intensity optimization implemented (early-return when `u_barrelDistortion == 0.0`)
- [ ] Screen curvature coupling implemented (curvature amplifies distortion effect)
- [ ] Distortion applied to texture coordinates before video sampling in main()
- [ ] Edge coordinate clamping implemented to prevent texture sampling errors
- [ ] All shader tests pass with >90% coverage
- [ ] Visual inspection confirms distortion works as expected at various intensities

---

## 🔗 Context & Dependencies

### Prerequisites Completed

- **BARREL-DISTORTION-TASK-01-001-DOMAIN-INTEGRATION**: Domain model updated with `barrelDistortion` property, presets configured, config flags verified

### Dependencies

- **WebGL Fragment Shader**: `scanline.frag.ts` contains the CRT post-processing pipeline
- **Existing Uniforms**: `u_screenCurvature`, `u_vignetteStrength` show patterns for uniform usage
- **Texture Sampling**: Current video texture sampling at line ~60 in main() function

### Constraints

- **WebGL 1.0 Compatibility**: Must use GLSL ES 1.0 syntax (no modern GLSL features)
- **Performance**: Distortion adds per-pixel cost; must maintain 60fps at 1080p resolution
- **Aspect Ratio**: Must respect content aspect ratio to avoid warping letterbox areas
- **Zero-Cost Disabled**: When `barrelDistortion = 0`, shader MUST skip calculation entirely

---

## 📂 File Scope

### Files to Create

None - modifying existing shader file only.

### Files to Modify

- **`libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts`**
  - Add `u_barrelDistortion` uniform declaration
  - Implement `applyBarrelDistortion()` function
  - Apply distortion in main() before texture sampling
  - Add edge clamping logic

- **`libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.spec.ts`**
  - Add test suite for barrel distortion function
  - Test zero-intensity optimization
  - Test curvature coupling behavior
  - Test edge coordinate handling

### Files to Review (for context)

- **`libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts`** - Shows how uniforms are bound and updated
- **`libs/domain/src/lib/models/crt-settings.model.ts`** - Shows barrelDistortion property definition
- **Existing shader functions** - `calculateScanline()`, `calculateVignette()`, `calculatePhosphor()` show implementation patterns

---

## 🛠️ Implementation Steps

### Step 1: Add Uniform Declaration

**Location**: Uniforms section near top of shader (after `u_screenCurvature`)

**Action**: Add `uniform float u_barrelDistortion;` declaration

**Notes**:
- Group with other geometric effect uniforms (vignette, curvature)
- Use consistent naming convention (lowercase with camelCase)
- Uniform will be bound by CrtRenderer in Phase 2 Task 2

### Step 2: Implement Distortion Function

**Location**: Before main() function, after other helper functions

**Function Signature**: `vec2 applyBarrelDistortion(vec2 uv, float intensity, float curvature)`

**Algorithm Requirements**:
1. **Zero-Intensity Check**: If `intensity == 0.0`, return `uv` unchanged (MUST be first check)
2. **Curvature Coupling**: Calculate `effectiveIntensity = intensity * (1.0 + curvature * 0.5)`
3. **Center Coordinates**: Calculate `centered = uv - vec2(0.5, 0.5)`
4. **Radial Distance**: Calculate `r = length(centered)`
5. **Radial Distortion**: Apply formula `distorted = vec2(0.5) + centered * (1.0 + effectiveIntensity * r * r)`
6. **Return**: Return distorted coordinates

**Critical Formula** (barrel distortion with curvature):

```glsl
vec2 applyBarrelDistortion(vec2 uv, float intensity, float curvature) {
  // Zero-intensity optimization (CRITICAL for performance)
  if (intensity == 0.0) return uv;
  
  // Curvature amplifies distortion effect
  float effectiveIntensity = intensity * (1.0 + curvature * 0.5);
  
  // Radial distortion from center point
  vec2 centered = uv - vec2(0.5, 0.5);
  float r = length(centered);
  vec2 distorted = vec2(0.5) + centered * (1.0 + effectiveIntensity * r * r);
  
  return distorted;
}
```

**Why This Formula**:
- **Radial**: Distortion increases with distance from center (authentic CRT behavior)
- **Quadratic**: `r²` term creates smooth barrel curve (vs. linear which looks artificial)
- **Center-Preserving**: UV (0.5, 0.5) always maps to itself (no shift at screen center)
- **Curvature Coupling**: Screen curvature naturally amplifies distortion (synergistic effects)

### Step 3: Apply Distortion in main()

**Location**: In `main()` function, before video texture sampling (currently around line 60)

**Action**: Call `applyBarrelDistortion()` before `texture2D(u_videoTexture, ...)`

**Current Code Pattern** (approximate):
```glsl
void main() {
  vec2 uv = v_texCoord;
  
  // Apply barrel distortion HERE
  
  vec4 videoColor = texture2D(u_videoTexture, uv);
  // ... rest of post-processing pipeline
}
```

**Updated Pattern**:
```glsl
void main() {
  vec2 uv = v_texCoord;
  
  // Apply barrel distortion before sampling
  uv = applyBarrelDistortion(uv, u_barrelDistortion, u_screenCurvature);
  
  vec4 videoColor = texture2D(u_videoTexture, uv);
  // ... rest of post-processing pipeline
}
```

**Integration Notes**:
- Distortion MUST happen before texture sampling (affects input coordinates)
- Pass both `u_barrelDistortion` and `u_screenCurvature` to function
- Other effects (scanlines, vignette) happen after sampling (affect pixel color)

### Step 4: Add Edge Clamping

**Location**: After distortion calculation in `applyBarrelDistortion()`

**Action**: Clamp distorted UVs to [0.0, 1.0] range to prevent undefined texture sampling

**Implementation**:
```glsl
vec2 distorted = vec2(0.5) + centered * (1.0 + effectiveIntensity * r * r);

// Clamp to valid texture coordinate range
distorted = clamp(distorted, vec2(0.0), vec2(1.0));

return distorted;
```

**Why**: Barrel distortion can push coordinates outside [0.0, 1.0] at high intensities. Clamping prevents:
- Texture wrap/repeat artifacts
- Undefined behavior in texture sampling
- Visual glitches at screen edges

**Alternative**: Could return black pixels for out-of-range coords, but clamping is simpler and creates smooth edge falloff.

---

## 🧪 Testing Requirements

### Test Coverage Required

**Unit Tests** (shader function testing):

- [ ] **Zero-Intensity Test**: When `intensity = 0.0`, function returns input UV unchanged
- [ ] **Positive Intensity Test**: Increasing intensity from 0.0 to 0.5 increases radial displacement
- [ ] **Curvature Coupling Test**: Higher curvature values amplify distortion effect
- [ ] **Center Preservation Test**: UV (0.5, 0.5) always maps to (0.5, 0.5) regardless of intensity
- [ ] **Edge Clamping Test**: Distorted UVs never exceed [0.0, 1.0] range, even at max intensity
- [ ] **Radial Symmetry Test**: Distortion is symmetric around center point (all quadrants equal)

**Behavioral Test Suite**:

```typescript
describe('applyBarrelDistortion shader function', () => {
  it('should return original UV when intensity is 0', () => {
    const result = applyBarrelDistortion([0.3, 0.7], 0.0, 0.2);
    expect(result).toEqual([0.3, 0.7]);
  });

  it('should increase radial displacement with higher intensity', () => {
    const uv = [0.8, 0.8]; // Corner coordinate
    const result1 = applyBarrelDistortion(uv, 0.1, 0.0);
    const result2 = applyBarrelDistortion(uv, 0.3, 0.0);
    
    const displacement1 = distance(result1, uv);
    const displacement2 = distance(result2, uv);
    
    expect(displacement2).toBeGreaterThan(displacement1);
  });

  it('should amplify distortion when curvature is higher', () => {
    const uv = [0.8, 0.8];
    const resultNoCurve = applyBarrelDistortion(uv, 0.2, 0.0);
    const resultWithCurve = applyBarrelDistortion(uv, 0.2, 0.3);
    
    const displacementNoCurve = distance(resultNoCurve, uv);
    const displacementWithCurve = distance(resultWithCurve, uv);
    
    expect(displacementWithCurve).toBeGreaterThan(displacementNoCurve);
  });

  it('should preserve center point at (0.5, 0.5)', () => {
    const result = applyBarrelDistortion([0.5, 0.5], 0.4, 0.2);
    expect(result).toBeCloseTo([0.5, 0.5], 0.001);
  });

  it('should clamp distorted coordinates within [0.0, 1.0]', () => {
    const result = applyBarrelDistortion([0.95, 0.95], 0.5, 0.3);
    expect(result[0]).toBeLessThanOrEqual(1.0);
    expect(result[1]).toBeLessThanOrEqual(1.0);
    expect(result[0]).toBeGreaterThanOrEqual(0.0);
    expect(result[1]).toBeGreaterThanOrEqual(0.0);
  });
});
```

**Testing Notes**:
- Shader testing may require WebGL context mock or shader compilation testing framework
- Focus on mathematical correctness of distortion formula
- Performance testing (zero-intensity optimization) can be manual GPU profiling
- Visual inspection is critical - run in browser with various settings

---

## 📚 Standards to Follow

- **[Coding Standards](../../../CODING_STANDARDS.md)** - TypeScript/WebGL conventions
- **[Testing Standards](../../../TESTING_STANDARDS.md)** - Behavioral testing approaches
- **[Component Library CRT](../../../COMPONENT_LIBRARY_CRT.md)** - CRT effect system architecture

### Shader-Specific Standards

1. **GLSL ES 1.0 Syntax**: Use `vec2`, `vec3`, `vec4`, `float` types; no modern GLSL features
2. **Uniform Naming**: Use `u_` prefix for all uniforms (e.g., `u_barrelDistortion`)
3. **Function Naming**: Use camelCase (e.g., `applyBarrelDistortion`)
4. **Performance**: Always optimize for GPU efficiency (early-returns, minimize operations)
5. **Precision**: Use `mediump` precision for most calculations (balance quality/performance)
6. **Comments**: Document complex formulas with mathematical explanations

---

## ⚠️ Anti-Patterns to Avoid

- ❌ **Always Calculating Distortion**: Must check for zero-intensity and early-return (wasted GPU cycles)
- ❌ **Ignoring Curvature**: Distortion should coordinate with screen curvature, not be independent
- ❌ **Unclamped Coordinates**: Distorted UVs outside [0.0, 1.0] cause texture sampling errors
- ❌ **Linear Distortion**: Using `r` instead of `r²` creates unnatural-looking effect
- ❌ **Applying After Sampling**: Distortion must happen to coordinates, not to sampled colors
- ❌ **Forgetting Center Preservation**: Center point (0.5, 0.5) must remain stable

---

## 🎯 Acceptance Criteria

Before marking this task complete, verify:

1. ✅ **Shader Compiles**: No GLSL syntax errors, shader compiles successfully in browser
2. ✅ **Zero-Intensity Works**: When `barrelDistortion = 0`, video looks unchanged (no performance cost)
3. ✅ **Distortion Visible**: Setting `barrelDistortion = 0.15` creates visible barrel warping effect
4. ✅ **Curvature Coupling**: Higher curvature values amplify distortion (test with curvature = 0.3)
5. ✅ **No Edge Artifacts**: No texture wrap/repeat at screen edges (coordinates clamped)
6. ✅ **Center Stable**: Center of video remains visually stable at all distortion levels
7. ✅ **All Tests Pass**: Unit tests pass with >90% coverage
8. ✅ **Code Review**: Code follows shader standards and best practices

---

## 📖 Related Documentation

### Planning Documents

- **[Master Plan](../BARREL-DISTORTION-MASTER-PLAN.md)** - Complete project overview
- **[Phase 2 Plan](../phases/BARREL-DISTORTION-PHASE-02-WEBGL-SHADER.md)** - This phase's detailed plan
- **[Phase 1 Report](../reports/BARREL-DISTORTION-TASK-01-001-REPORT.md)** - Domain model integration results

### Technical References

- **[Existing Shader Code](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts)** - Current shader implementation
- **[CRT Renderer](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts)** - Uniform binding patterns
- **[WebGL Fundamentals - Distortion](https://webglfundamentals.org/webgl/lessons/webgl-3d-textures.html)** - Texture coordinate manipulation

### Related Tasks

- **BARREL-DISTORTION-TASK-02-002-RENDERER-INTEGRATION**: Binds `u_barrelDistortion` uniform in CrtRenderer (executes after this task)

---

## 💡 Implementation Hints

### Debugging Shader Issues

1. **Syntax Errors**: Check browser console for WebGL shader compilation errors
2. **Visual Debugging**: Temporarily return distorted UV as color: `gl_FragColor = vec4(uv, 0.0, 1.0);`
3. **Range Checking**: Ensure all calculations stay within valid ranges (no NaN or Inf values)
4. **Incremental Testing**: Test with intensity = 0.1 first, then gradually increase to 0.5

### Performance Considerations

- **Zero-Intensity Optimization**: Critical for maintaining performance when effect is disabled
- **GPU Profiling**: Use browser DevTools > Performance > GPU to measure shader cost
- **Batch Uniform Updates**: Renderer should update all uniforms in single call (Phase 2 Task 2)

### Visual Validation

Test with these preset combinations:
- Small video: `barrelDistortion: 0`, `screenCurvature: 0.1` (no distortion visible)
- Large video: `barrelDistortion: 0.15`, `screenCurvature: 0.2` (moderate barrel effect)
- Extreme test: `barrelDistortion: 0.5`, `screenCurvature: 0.4` (maximum warping for testing)

---

## 📊 Output Report

**Output Report Location**: `docs/projects/BARREL-DISTORTION/reports/BARREL-DISTORTION-TASK-02-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**What to Include in Report**:
- Shader code changes made (uniform, function, main() integration)
- Test results (all passing tests with coverage metrics)
- Visual validation screenshots at various intensities
- Performance notes (frame rate impact, zero-intensity optimization confirmed)
- Any challenges encountered (shader debugging, formula tuning)
- Recommendations for next task (uniform binding in renderer)

---

**Return Value**: Return the file path when complete: `docs/projects/BARREL-DISTORTION/reports/BARREL-DISTORTION-TASK-02-001-REPORT.md`
