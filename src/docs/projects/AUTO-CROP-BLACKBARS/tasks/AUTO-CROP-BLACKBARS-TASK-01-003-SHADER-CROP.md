# Subagent Task Handoff Document

## 📋 Overview

This handoff defines the work for Phase 1 Task 3: Shader-Based Cropping & Animation for AUTO-CROP-BLACKBARS.

---

## INPUT_DOC

**Task ID**: AUTO-CROP-BLACKBARS-TASK-01-003-SHADER-CROP  
**Task Name**: Integrate crop uniforms, UV remapping, and `CropAnimator` into renderer  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Medium

**What**: Modify the fragment shader to support cropping via uniforms, implement a simple `CropAnimator` with lerp, and wire both into `CrtRenderer` with detection cadence and per-frame updates.

**Why**: This enables the visible cropping effect and smooth transitions, connecting detection results to rendering output.

**Success Criteria**:
- [ ] Add `uniform vec4 u_cropRect` to `scanline.frag.ts`
- [ ] Remap UVs: `croppedUV = u_cropRect.xy + v_texCoord * u_cropRect.zw`
- [ ] Create `crop-animator.ts` with lerp-only Phase 1 behavior
- [ ] Integrate detector and animator into `CrtRenderer`
- [ ] Detector runs every ~200ms (when enabled), animator runs every frame
- [ ] Update uniform `u_cropRect` each frame based on animator state
- [ ] Respect `autoCropBlackBars` toggle: skip detection when false; reset crop to (0,0,1,1)
- [ ] Add/Store uniform location in renderer
- [ ] Unit tests for animator + renderer integration

---

**Prerequisites Completed**:
- Detector implemented (Task 2) — see [Task 2](./AUTO-CROP-BLACKBARS-TASK-01-002-BLACK-BAR-DETECTOR.md)
- Settings property implemented (Task 1) — see [Task 1](./AUTO-CROP-BLACKBARS-TASK-01-001-DOMAIN-MODEL-SETTINGS.md)

**Dependencies**:
- `CrtRenderer` for WebGL program and uniform management
- Fragment shader `scanline.frag.ts`

**Constraints**:
- Minimal shader overhead; UV remap before texture sample
- Animator uses simple lerp (10% step) for Phase 1

---

**Files to Create/Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts` — Add uniform and UV remap
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crop-animator.ts` — New animator class
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crop-animator.spec.ts` — Animator tests
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts` — Integrate detector, animator, and uniform updates
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/index.ts` — Export animator

**Critical Interfaces**:

```typescript
class CropAnimator {
  setTarget(rect: CropRect): void;
  update(): CropRect; // returns current interpolated crop
  reset(): void; // sets to (0,0,1,1)
}
```

---

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md)
- [Testing Standards](../../../TESTING_STANDARDS.md)
- [HOW_TO_ADD_WEBGL_EFFECT](../../../HOW_TO_ADD_WEBGL_EFFECT.md)

**Key Requirements**:
1. Add `u_cropRect` uniform and remap UVs in fragment shader;
2. Implement `CropAnimator` with lerp step (~0.1 per frame);
3. Integrate in `CrtRenderer` render loop (detector cadence, animator per-frame);
4. Update uniform via `gl.uniform4f(u_cropRect, left, top, width, height)`;
5. Honor `autoCropBlackBars` setting.

**Anti-Patterns to Avoid**:
- CPU-side texture cropping (must be shader-based)
- Per-frame detection (use 200ms cadence)
- Leaking WebGL resources or missing uniform locations

---

**Test Coverage Required**:
- [ ] Animator lerp convergence, reset, mid-animation retargeting
- [ ] Renderer calls detector at cadence and animator each frame
- [ ] Uniform updates match animated values (spy `gl.uniform4f`)
- [ ] Toggle off → detector skipped, uniform stays (0,0,1,1)

**Behavioral Expectations**:
- Smooth crop transitions without jitter
- Correct UV remapping produces visible cropping

---

**Related Documentation**:
- [Phase 1 Plan](../phases/AUTO-CROP-BLACKBARS-PHASE-01-CORE-DETECTION.md#task-3-shader-based-cropping--animation)
- [CrtRenderer](../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts)
- [Scanline Fragment Shader](../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts)

**Related Tasks**:
- AUTO-CROP-BLACKBARS-TASK-01-002-BLACK-BAR-DETECTOR — input provider for crop target
- AUTO-CROP-BLACKBARS-TASK-01-004-UI-CONTROLS — toggle control for feature

---

## OUTPUT_DOC

**Output Report Location**: `docs/projects/AUTO-CROP-BLACKBARS/reports/AUTO-CROP-BLACKBARS-TASK-01-003-REPORT.md`  
**Report Template**: [SUBAGENT_REPORT.md](../../subagent-planning/SUBAGENT_REPORT.md)  
**Return Value**: `docs/projects/AUTO-CROP-BLACKBARS/reports/AUTO-CROP-BLACKBARS-TASK-01-003-REPORT.md`

---

### Handoff Complete

Worker subagent: Please execute the task and save your completion report to the specified location.