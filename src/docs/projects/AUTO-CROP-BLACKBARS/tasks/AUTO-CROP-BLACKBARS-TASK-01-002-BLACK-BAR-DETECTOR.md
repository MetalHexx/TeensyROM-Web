# Subagent Task Handoff Document

## 📋 Overview

This handoff defines the work for Phase 1 Task 2: Black Bar Detection Engine for AUTO-CROP-BLACKBARS.

---

## INPUT_DOC

**Task ID**: AUTO-CROP-BLACKBARS-TASK-01-002-BLACK-BAR-DETECTOR  
**Task Name**: Implement `BlackBarDetector` edge sampling and crop rect computation  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Medium

**What**: Create `BlackBarDetector` to sample edge pixels via WebGL, compute luminance, detect black borders using a threshold, and output a normalized crop rectangle with a 200ms detection cadence.

**Why**: Accurate, efficient detection is the foundation of the auto-crop feature, driving shader cropping and user experience stability.

**Success Criteria**:
- [ ] `black-bar-detector.ts` created with clean interface and core logic
- [ ] Samples 10 points per edge via `gl.readPixels()`
- [ ] Luminance calculation implemented (`Y = 0.299R + 0.587G + 0.114B`)
- [ ] Black threshold configurable (default `Y < 0.15`)
- [ ] Returns `CropRect` in 0-1 normalized coordinates or null for no-crop
- [ ] Throttled to run at ~200ms interval
- [ ] Barrel export added in `webgl/index.ts`
- [ ] Unit tests cover key scenarios

---

**Prerequisites Completed**:
- Settings property defined in Task 1 (for toggle) — see [Task 1](./AUTO-CROP-BLACKBARS-TASK-01-001-DOMAIN-MODEL-SETTINGS.md)
- Phase plan: [Phase 1: Core Detection & Cropping Infrastructure](../phases/AUTO-CROP-BLACKBARS-PHASE-01-CORE-DETECTION.md)

**Dependencies**:
- WebGL access via `CrtRenderer`
- Pixel buffer operations via `gl.readPixels()`

**Constraints**:
- Performance-first: sparse sampling (10 points per edge)
- Throttle detection: do not run each frame

---

**Files to Create/Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/black-bar-detector.ts` — New detector class
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/black-bar-detector.spec.ts` — Unit tests
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/index.ts` — Export detector
- (Review only) `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts` — Integration target

**Critical Interfaces**:

```typescript
interface CropRect {
  left: number;  // 0-1
  top: number;   // 0-1
  width: number; // 0-1
  height: number;// 0-1
}

class BlackBarDetector {
  detect(gl: WebGLRenderingContext, texture: WebGLTexture, width: number, height: number): CropRect | null;
}
```

---

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md)
- [Testing Standards](../../../TESTING_STANDARDS.md)
- [HOW_TO_ADD_WEBGL_EFFECT](../../../HOW_TO_ADD_WEBGL_EFFECT.md)

**Key Requirements**:
1. Edge sampling of 10 points per edge;
2. Luminance threshold default 0.15, configurable constant;
3. Crop rect computation normalized to [0,1];
4. Throttle to 200ms via `performance.now()` gating;
5. Robust handling of all-black and mixed-edge frames.

**Anti-Patterns to Avoid**:
- Full-frame readbacks per detection cycle
- Non-normalized crop coordinates
- Tight coupling to renderer internals; keep detector self-contained

---

**Test Coverage Required**:
- [ ] All black frame → no-crop behavior
- [ ] Single-edge black borders (top/bottom/left/right)
- [ ] Combined edges (letterbox + pillarbox)
- [ ] Mixed content threshold behavior
- [ ] Throttling verified with mocked `performance.now()`

**Behavioral Expectations**:
- Accurate edge detection with minimal performance impact
- Stable output avoiding noise-induced thrashing

---

**Related Documentation**:
- [Phase 1 Plan](../phases/AUTO-CROP-BLACKBARS-PHASE-01-CORE-DETECTION.md#task-2-black-bar-detection-engine)
- [Master Plan Detection Algorithm](../AUTO-CROP-BLACKBARS-MASTER-PLAN.md#detection-algorithm)

**Related Tasks**:
- AUTO-CROP-BLACKBARS-TASK-01-003-SHADER-CROP — Consumes detector output

---

## OUTPUT_DOC

**Output Report Location**: `docs/projects/AUTO-CROP-BLACKBARS/reports/AUTO-CROP-BLACKBARS-TASK-01-002-REPORT.md`  
**Report Template**: [SUBAGENT_REPORT.md](../../subagent-planning/SUBAGENT_REPORT.md)  
**Return Value**: `docs/projects/AUTO-CROP-BLACKBARS/reports/AUTO-CROP-BLACKBARS-TASK-01-002-REPORT.md`

---

### Handoff Complete

Worker subagent: Please execute the task and save your completion report to the specified location.