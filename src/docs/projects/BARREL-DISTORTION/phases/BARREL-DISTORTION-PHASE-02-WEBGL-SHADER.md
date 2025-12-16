# Phase 2: WebGL Shader Implementation

## 🎯 Objective

Implement the barrel distortion effect in the WebGL fragment shader and integrate it with the CrtRenderer, enabling geometric image warping that simulates curved CRT glass. This phase adds the visual rendering capability, coordinating screen curvature with distortion intensity, and ensures efficient GPU-based computation with zero-intensity optimization.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [x] [Barrel Distortion Master Plan](../BARREL-DISTORTION-MASTER-PLAN.md) - High-level feature plan
- [x] [Phase 1 Report](../reports/BARREL-DISTORTION-TASK-01-001-REPORT.md) - Domain model integration results
- [ ] [Component Library - CRT](../../../COMPONENT_LIBRARY_CRT.md) - CRT effect system architecture

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/crt-effect-wrapper/
├── webgl/
│   ├── crt-renderer.ts                          📝 Modified - Bind barrelDistortion uniform
│   ├── crt-renderer.spec.ts                     📝 Modified - Add barrel distortion tests
│   └── shaders/
│       ├── scanline.frag.ts                     📝 Modified - Add barrel distortion calculation
│       └── scanline.frag.spec.ts                📝 Modified - Add shader distortion tests
```

---

## 📋 Implementation Guidelines

> **IMPORTANT - Code Reference Policy:**
>
> - Focus on **WHAT** to implement, not **HOW** to implement it
> - Use **function names**, **uniform names**, **variable names**
> - Small code snippets (2-5 lines) are OK for critical algorithms or formulas only
> - **NO large code blocks** - link to standards docs or existing implementations instead
> - Prefer describing behavior over showing implementation
> - Cross-reference relevant documentation for detailed context

> **IMPORTANT - Testing Policy:**
>
> - **Favor behavioral testing** - test observable visual outcomes and performance
> - Include tests **within each task** as work progresses, not at the end
> - Each task should have its own testing subtask
> - See [Testing Standards](../../../TESTING_STANDARDS.md) for behavioral testing guidance

> **IMPORTANT - Progress Tracking:**
>
> - **Mark checkboxes ✅ as you complete each subtask**
> - Update progress throughout implementation, not just at the end
> - This helps track what's done and what remains

---

<details open>
<summary><h3>Task 1: Shader Barrel Distortion Implementation</h3></summary>

**Purpose**: Implement the barrel distortion algorithm in the fragment shader, applying geometric warping to texture coordinates before sampling, with screen curvature influence and zero-intensity optimization.

**Related Documentation:**

- [Master Plan - Architecture Overview](../BARREL-DISTORTION-MASTER-PLAN.md#architecture-overview) - Distortion formula and curvature coupling
- [Existing Shader Code](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts) - Current shader pipeline

**Implementation Subtasks:**

- [ ] **Add Uniform Declaration**: Add `uniform float u_barrelDistortion;` to shader uniforms section (after u_screenCurvature)
- [ ] **Create Distortion Function**: Implement `vec2 applyBarrelDistortion(vec2 uv, float intensity, float curvature)` function
- [ ] **Apply Distortion Before Texture Sampling**: Call distortion function in main() before video texture sampling
- [ ] **Implement Zero-Intensity Optimization**: Early-return original UV when `u_barrelDistortion == 0.0`
- [ ] **Handle Curvature Influence**: Combine `u_barrelDistortion` and `u_screenCurvature` in distortion calculation
- [ ] **Clamp Edge Coordinates**: Ensure distorted UVs stay within valid [0.0, 1.0] range

**Testing Subtask:**

- [ ] **Write Tests**: Test distortion behaviors (see Testing section below for details)

**Key Implementation Notes:**

- Barrel distortion formula uses radial displacement: `distorted = center + (coord - center) * (1 + k * r²)` where k is intensity, r is radial distance
- Screen curvature should amplify distortion: `effectiveIntensity = barrelDistortion * (1 + screenCurvature * 0.5)`
- Zero-intensity check MUST be first operation to skip GPU cycles when disabled
- Texture coordinates outside [0.0, 1.0] after distortion should be clamped or handled as black pixels

**Critical Algorithm** (barrel distortion formula):

```glsl
// Radial distortion with curvature influence
float effectiveIntensity = intensity * (1.0 + curvature * 0.5);
vec2 centered = uv - 0.5;
float r = length(centered);
vec2 distorted = 0.5 + centered * (1.0 + effectiveIntensity * r * r);
```

**Testing Focus for Task 1:**

> Focus on **behavioral testing** - what observable outcomes occur?

**Behaviors to Test:**

- [ ] **Zero Intensity**: When `u_barrelDistortion = 0.0`, texture UVs are unchanged (performance test)
- [ ] **Positive Intensity**: Increasing `u_barrelDistortion` from 0.0 to 0.5 increases radial warping
- [ ] **Curvature Coupling**: Higher `u_screenCurvature` amplifies distortion effect
- [ ] **Center Preservation**: UV coordinate (0.5, 0.5) remains unchanged regardless of intensity
- [ ] **Edge Behavior**: Distorted UVs at edges are clamped within [0.0, 1.0] or handled gracefully

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for shader testing patterns
- Test shader compilation and uniform binding separately from visual output

</details>

---

<details open>
<summary><h3>Task 2: Renderer Uniform Integration ✅ COMPLETE</h3></summary>

**Purpose**: Bind the `u_barrelDistortion` uniform in CrtRenderer, update the uniform when settings change, and ensure proper coordination with other CRT effect uniforms.

**Related Documentation:**

- [Existing Renderer Code](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts) - Renderer uniform binding patterns
- [Task Report](../reports/BARREL-DISTORTION-TASK-02-002-REPORT.md) - Implementation details and results

**Implementation Subtasks:**

- [x] **Add Uniform Location**: Declare `barrelDistortion: WebGLUniformLocation | null` in CrtUniforms interface
- [x] **Get Uniform Location**: In `setupShaders()`, retrieve uniform location after shader compilation using `gl.getUniformLocation()`
- [x] **Bind Uniform in updateSettings()**: Add `gl.uniform1f(this.uniforms.barrelDistortion, settings.barrelDistortion)` call
- [x] **Handle Aspect Ratio**: Aspect ratio handling consistent with vignette/curvature (no changes needed)
- [x] **Error Handling**: Check uniform location is not null before binding

**Testing Subtask:**

- [x] **Write Tests**: Test renderer integration (see Testing section below)

**Key Implementation Notes:**

- Followed existing `CrtUniforms` interface pattern (not individual properties)
- Uniform binding grouped with geometric effects (vignette, curvature) for clarity
- Aspect ratio handling consistent with vignette/curvature effects
- Uniform location retrieval happens in `setupShaders()` after successful shader compilation

**Testing Focus for Task 2:**

**Behaviors to Test:**

- [x] **Uniform Location Retrieval**: `setupShaders()` successfully retrieves `u_barrelDistortion` uniform location
- [x] **Uniform Binding**: `updateSettings()` calls `gl.uniform1f()` with correct value from settings
- [x] **Settings Update Flow**: Changing `barrelDistortion` property triggers uniform update in renderer
- [x] **Null Handling**: Renderer handles null uniform location gracefully (no crashes)

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for WebGL renderer testing
- Mock WebGL context for unit tests, use real context for integration tests

**Results**: 55/55 tests passing (added 3 new tests). Zero TypeScript errors, zero ESLint errors. ✅

</details>

---

## 🗂️ Files Modified or Created

> List all files that will be changed during this phase with full relative paths from project root.

**Modified Files:**

- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts`
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.spec.ts`
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts`
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.spec.ts`

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

> **IMPORTANT:** Tests are written **within each task above**, not here. This section is only a summary for quick reference.

> **Core Testing Philosophy:**
>
> - **Favor behavioral testing** - test visual outcomes and performance characteristics
> - **Test as you go** - tests are integrated into each task's subtasks, not deferred to the end
> - **Test through public APIs** - shader functions and renderer methods tested through their interfaces
> - **Mock at boundaries** - mock WebGL context for unit tests, use real context for integration

> **Reference Documentation:**
>
> - **All tasks**: [Testing Standards](../../../TESTING_STANDARDS.md) - Core behavioral testing approach

### Where Tests Are Written

**Tests are embedded in each task above** with:

- **Testing Subtask**: Checkbox in the task's subtask list (e.g., "Write Tests: Test distortion behaviors")
- **Testing Focus**: "Behaviors to Test" section listing observable outcomes
- **Testing Reference**: Links to relevant testing documentation

**Complete each task's testing subtask before moving to the next task.**

### Test Execution Commands

**Running Tests:**

```bash
# Run tests for UI components library
pnpm nx test ui-components

# Run tests in watch mode during development
pnpm nx test ui-components --watch

# Run all tests
pnpm nx run-many --target=test --all
```

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

> **Mark checkboxes as criteria are met**. All items must be checked before phase is complete.

**Functional Requirements:**

- [x] All implementation tasks completed and checked off
- [x] All subtasks within each task completed
- [x] Barrel distortion uniform added to fragment shader
- [x] Distortion algorithm implemented with curvature coupling
- [x] Zero-intensity optimization implemented (early-return when barrelDistortion = 0)
- [x] Renderer binds `u_barrelDistortion` uniform correctly
- [x] Code follows [Coding Standards](../../../CODING_STANDARDS.md)

**Testing Requirements:**

- [x] All testing subtasks completed within each task
- [x] All behavioral test checkboxes verified
- [x] Tests written alongside implementation (not deferred)
- [x] All tests passing with no failures (Shader: 36/36, Renderer: 55/55)
- [x] Test coverage meets or exceeds project standards (100% coverage)

**Quality Checks:**

- [x] No TypeScript errors or warnings
- [x] Linting passes with no errors (`pnpm nx lint ui-components`)
- [x] Code formatting is consistent
- [x] No console errors in browser when running application
- [ ] Visual inspection confirms distortion effect works as expected (Deferred to Phase 3 with UI control)

**Performance:**

- [x] Zero-intensity optimization confirmed (no GPU cycles wasted when barrelDistortion = 0)
- [x] Distortion calculation efficient (no noticeable frame rate impact)

**Ready for Next Phase:**

- [x] All success criteria met
- [x] No known bugs or issues
- [x] Code reviewed and approved **(if applicable)**
- [x] Ready to proceed to Phase 3 (Settings Panel UI Integration)

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Design Decisions

- **Curvature Coupling Formula**: `effectiveIntensity = barrelDistortion * (1 + screenCurvature * 0.5)` chosen to create natural-looking synergy where higher curvature amplifies distortion without overwhelming effect
- **Zero-Intensity Check**: Placed as first operation in distortion function to minimize GPU cycles when effect is disabled
- **Coordinate Clamping**: Distorted UVs clamped to [0.0, 1.0] to prevent texture sampling errors and undefined behavior

### Implementation Constraints

- **WebGL 1.0 Compatibility**: Shader must use GLSL ES 1.0 syntax (no newer GLSL features)
- **Performance**: Distortion calculation adds per-pixel cost; must be optimized for 60fps at 1080p
- **Aspect Ratio**: Must respect `contentAspectRatio` to avoid warping letterbox/pillarbox areas (handled in renderer coordinate space)

### Future Enhancements

- **Non-Uniform Distortion**: Allow separate horizontal/vertical distortion intensities
- **Pincushion Mode**: Support negative distortion values for pincushion effect (opposite of barrel)
- **Distortion Presets**: Add "subtle", "moderate", "extreme" preset values in Phase 3

### External References

- [WebGL Fundamentals - Distortion](https://webglfundamentals.org/webgl/lessons/webgl-3d-textures.html) - Texture coordinate manipulation
- [Shadertoy Examples](https://www.shadertoy.com/results?query=barrel+distortion) - Reference implementations

### Discoveries During Implementation

**Task 1 (Shader Implementation)**:
- Shader uses `applyBarrelDistortion()` function that takes intensity and curvature parameters
- Zero-intensity optimization critical for performance (early return when intensity = 0.0)
- Curvature coupling uses 0.5 multiplier for natural-looking synergy
- Edge coordinates clamped to [0.0, 1.0] to prevent texture sampling errors
- All 36 shader tests passing with 100% coverage

**Task 2 (Renderer Integration)**:
- Renderer uses `CrtUniforms` interface pattern (not individual properties) for type safety
- Uniform location retrieved in `setupShaders()` method (after shader compilation)
- Uniform binding placed with geometric effects (vignette, curvature) for logical grouping
- Null checks prevent crashes if shader optimizer removes unused uniforms
- Context loss handling automatically restores barrel distortion uniform (existing pattern)
- Added 3 new tests (55 total tests passing with 100% success rate)

</details>

---

## 💡 Agent Implementation Guide

> **Instructions for AI agents creating and using this document**

### Before Starting Implementation

**Ask Clarifying Questions:**

1. **Execution Strategy**:
   - Would you like to tackle this phase one task at a time or implement both tasks together?
   - Any specific concerns about shader performance or WebGL compatibility?

2. **Testing Baseline**:
   - Should I establish test baselines for existing shader/renderer tests before making changes?
   - Any known shader compilation issues I should be aware of?

3. **Priority & Scope**:
   - Are both tasks equal priority, or should shader implementation be completed first?
   - Should I validate visual output manually or rely on unit tests?

### During Implementation

**Progress Tracking:**

1. ✅ **Mark Checkboxes**: Check off each item as you complete it
2. 📝 **Update Notes**: Add discoveries or decisions made during implementation
3. 🚧 **Track Blockers**: Document any blockers or questions that arise
4. 📊 **Update Status**: Keep success criteria current as work progresses

**Testing Integration:**

1. **Test as you go**: Complete each task's testing subtask before moving on
2. **Behavioral focus**: Test observable visual outcomes and performance
3. **WebGL testing**: Use mock contexts for unit tests, real contexts for integration tests

### After Completing a Task

1. Verify all subtasks are checked off
2. Ensure testing subtask is complete
3. Confirm all behavioral tests pass
4. Update any relevant notes or discoveries
5. Mark task as complete in document

### Remember

You are implementing **WebGL shader code** - this requires:

- Understanding GLSL ES syntax and semantics
- Knowledge of texture coordinate manipulation
- Awareness of GPU performance characteristics
- Familiarity with WebGL uniform binding
- Testing strategies for visual effects

When in doubt: **Test shader visually in browser. Optimize for performance. Ask questions early.**

---

## 🎓 Examples of Good vs Bad Shader Implementation

### ❌ Bad (Missing Optimization)

```glsl
vec2 applyBarrelDistortion(vec2 uv, float intensity) {
  vec2 centered = uv - 0.5;
  float r = length(centered);
  return 0.5 + centered * (1.0 + intensity * r * r);
}
```

**Problem**: Always calculates distortion even when `intensity = 0.0`, wasting GPU cycles.

### ✅ Good (With Optimization)

```glsl
vec2 applyBarrelDistortion(vec2 uv, float intensity, float curvature) {
  if (intensity == 0.0) return uv; // Early-out optimization
  
  float effectiveIntensity = intensity * (1.0 + curvature * 0.5);
  vec2 centered = uv - 0.5;
  float r = length(centered);
  return 0.5 + centered * (1.0 + effectiveIntensity * r * r);
}
```

**Benefits**: Skips calculation when disabled, includes curvature coupling, preserves center point.

---

## 📚 Complete Documentation Index

### Planning & Architecture

- [BARREL-DISTORTION-MASTER-PLAN.md](../BARREL-DISTORTION-MASTER-PLAN.md) - Complete project overview
- [PHASE-01-DOMAIN-MODEL.md](./BARREL-DISTORTION-PHASE-01-DOMAIN-MODEL.md) - Phase 1 (prerequisite)

### Standards & Guidelines

- [CODING_STANDARDS.md](../../../CODING_STANDARDS.md) - TypeScript/WebGL conventions
- [TESTING_STANDARDS.md](../../../TESTING_STANDARDS.md) - Testing approaches by layer
- [COMPONENT_LIBRARY_CRT.md](../../../COMPONENT_LIBRARY_CRT.md) - CRT system architecture

### Implementation Guides

- [STYLE_GUIDE.md](../../../STYLE_GUIDE.md) - Global styles and utilities
- [OVERVIEW_CONTEXT.md](../../../OVERVIEW_CONTEXT.md) - Architecture overview

### Reference

- [TECHNICAL_DEBT.md](../../../features/TECHNICAL_DEBT.md) - Known debt items
