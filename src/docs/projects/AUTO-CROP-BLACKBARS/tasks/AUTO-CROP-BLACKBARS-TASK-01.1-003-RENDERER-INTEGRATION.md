# Task Handoff: GPU Results Processing & Renderer Integration

## 📋 Task Identity

**Task ID**: AUTO-CROP-BLACKBARS-TASK-01.1-003-RENDERER-INTEGRATION  
**Task Name**: Integrate GPU Detection Pipeline into CrtRenderer  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Medium (6-10 files)

---

## 🎯 Objective

**What**: Create the `EdgeAnalysisProcessor` class to read GPU detection results via a single `gl.readPixels()` call, convert normalized depths to crop rectangles with confidence scoring, and integrate the complete multi-pass detection pipeline into `CrtRenderer` with proper render target management, frame timing, and feature toggle support.

**Why**: Completes the GPU detection pipeline by connecting detection passes (Tasks 01.1-001, 01.1-002) to the existing crop animation system. This eliminates Phase 1's 40+ readPixels calls per frame bottleneck by reading only 4 pixels once per 200ms, and adds temporal stability tracking to prevent thrashing from noisy detection results.

**Success Criteria**:
- [ ] `EdgeAnalysisProcessor` class created with single-readPixels strategy
- [ ] GPU depth map (4 pixels) read once per 200ms via `gl.readPixels()`
- [ ] Normalized depths (0-1) correctly converted to pixel values and `CropRect`
- [ ] Confidence scoring tracks temporal stability across 3+ frames
- [ ] Detection pipeline integrated into `CrtRenderer.render()` loop
- [ ] Detection throttled to 200ms intervals (5 FPS), animation at 60 FPS
- [ ] Feature toggle (`autoCropBlackBars` setting) correctly enables/disables detection
- [ ] Detected crops passed to existing `CropAnimator` for smooth transitions
- [ ] Unit tests verify results processing and confidence scoring
- [ ] Integration tests verify complete edge→depth→animate→render pipeline
- [ ] All tests pass with no WebGL errors or performance degradation

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- AUTO-CROP-BLACKBARS-TASK-01.1-001-EDGE-DETECTION-SHADER - Edge detection pass implemented
- AUTO-CROP-BLACKBARS-TASK-01.1-002-DEPTH-SCAN-SHADERS - Depth scan passes implemented
- Phase 1 `CropAnimator` class exists and will be reused

**Dependencies**:
- `DetectionPassRenderer` class with `getDepthMapTexture()` method
- Existing `CropAnimator` class from Phase 1
- `CrtSettings` interface with `autoCropBlackBars` property
- `CrtRenderer` class with established render loop

**Constraints**:
- Must maintain 60 FPS main render loop
- Detection budget: < 5ms per 200ms interval
- Single `gl.readPixels()` call per detection frame
- Must respect feature toggle (skip detection when disabled)

---

## 📁 File Scope

**Files to Create**:
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/edge-analysis-processor.ts` - Results processing class
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/edge-analysis-processor.spec.ts` - Unit tests

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/index.ts` - Add processor export
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts` - Integrate detection pipeline
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.spec.ts` - Add integration tests
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/index.ts` - Export detection classes

**Files to Review**:
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crop-animator.ts` - Reuse animation logic
- `docs/projects/AUTO-CROP-BLACKBARS/phases/AUTO-CROP-BLACKBARS-PHASE-01.1-WEBGL-DETECTION.md` - Integration specifications

---

## 🛠️ Implementation Guidance

### Standards to Follow

- [HOW_TO_ADD_WEBGL_EFFECT.md](../../../docs/HOW_TO_ADD_WEBGL_EFFECT.md) - WebGL patterns
- [Coding Standards](../../../docs/CODING_STANDARDS.md) - TypeScript conventions
- [Testing Standards](../../../docs/TESTING_STANDARDS.md) - Testing approach

### Key Requirements

#### 1. EdgeAnalysisProcessor Class

Create class with these responsibilities:

```typescript
interface CropRect {
  left: number;    // 0-1 normalized
  top: number;     // 0-1 normalized  
  width: number;   // 0-1 normalized
  height: number;  // 0-1 normalized
}

interface DetectionHistory {
  depths: { top: number; bottom: number; left: number; right: number };
  timestamp: number;
  confidence: number;
}

class EdgeAnalysisProcessor {
  private gl: WebGLRenderingContext;
  private pixelBuffer = new Uint8Array(4 * 4);  // 4 pixels × RGBA
  private history: DetectionHistory[] = [];
  private readonly HISTORY_SIZE = 5;
  private readonly CONFIDENCE_THRESHOLD = 0.7;
  private readonly MIN_CHANGE_THRESHOLD_PX = 5;
  
  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
  }
  
  /**
   * Read depth map texture and compute crop rectangle with confidence scoring
   */
  processCropResults(
    depthMapTexture: WebGLTexture,
    videoWidth: number,
    videoHeight: number
  ): CropRect | null {
    // 1. Read 4 pixels from depth map (single readPixels call)
    const depths = this.readDepthMap(depthMapTexture);
    
    // 2. Convert normalized depths to pixels
    const pixelDepths = {
      top: Math.round(depths.top * videoHeight),
      bottom: Math.round(depths.bottom * videoHeight),
      left: Math.round(depths.left * videoWidth),
      right: Math.round(depths.right * videoWidth)
    };
    
    // 3. Calculate confidence score
    const confidence = this.calculateConfidence(pixelDepths);
    
    // 4. Add to history
    this.addToHistory({ depths: pixelDepths, timestamp: performance.now(), confidence });
    
    // 5. Only commit if stable and significant change
    if (this.shouldCommitCrop(pixelDepths, confidence)) {
      return this.createCropRect(pixelDepths, videoWidth, videoHeight);
    }
    
    return null;  // Not confident enough or insignificant change
  }
  
  /**
   * Single readPixels call to read entire depth map (4 pixels)
   */
  private readDepthMap(depthMapTexture: WebGLTexture): { top: number; bottom: number; left: number; right: number } {
    const gl = this.gl;
    
    // Read 4x1 texture (4 pixels: R=top, G=bottom, B=left, A=right)
    gl.readPixels(0, 0, 4, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.pixelBuffer);
    
    // Extract depths from buffer (normalized 0-255 → 0-1)
    return {
      top: this.pixelBuffer[0] / 255.0,     // Pixel 0, R channel
      bottom: this.pixelBuffer[1] / 255.0,  // Pixel 0, G channel
      left: this.pixelBuffer[8] / 255.0,    // Pixel 2, R channel (or pixel 0, B channel depending on shader encoding)
      right: this.pixelBuffer[12] / 255.0   // Pixel 3, R channel (or pixel 0, A channel)
    };
  }
  
  /**
   * Calculate confidence score based on temporal stability
   */
  private calculateConfidence(currentDepths: { top: number; bottom: number; left: number; right: number }): number {
    if (this.history.length < 3) return 0.5;  // Need 3+ samples
    
    // Compute variance across recent history
    const recentHistory = this.history.slice(-3);
    const avgDepths = {
      top: recentHistory.reduce((sum, h) => sum + h.depths.top, 0) / 3,
      bottom: recentHistory.reduce((sum, h) => sum + h.depths.bottom, 0) / 3,
      left: recentHistory.reduce((sum, h) => sum + h.depths.left, 0) / 3,
      right: recentHistory.reduce((sum, h) => sum + h.depths.right, 0) / 3
    };
    
    // Calculate variance (lower variance = higher confidence)
    const variance = 
      Math.pow(currentDepths.top - avgDepths.top, 2) +
      Math.pow(currentDepths.bottom - avgDepths.bottom, 2) +
      Math.pow(currentDepths.left - avgDepths.left, 2) +
      Math.pow(currentDepths.right - avgDepths.right, 2);
    
    // Convert to confidence: low variance (< 4px²) = high confidence
    const maxVariance = 16;  // 4px² per edge
    const confidence = 1.0 - Math.min(variance / maxVariance, 1.0);
    
    return confidence;
  }
  
  /**
   * Decide if crop should be committed based on confidence and change significance
   */
  private shouldCommitCrop(
    depths: { top: number; bottom: number; left: number; right: number },
    confidence: number
  ): boolean {
    // Need high confidence
    if (confidence < this.CONFIDENCE_THRESHOLD) return false;
    
    // Check if change is significant vs last committed crop
    if (this.history.length === 0) return true;
    const lastDepths = this.history[this.history.length - 1].depths;
    
    const maxChange = Math.max(
      Math.abs(depths.top - lastDepths.top),
      Math.abs(depths.bottom - lastDepths.bottom),
      Math.abs(depths.left - lastDepths.left),
      Math.abs(depths.right - lastDepths.right)
    );
    
    return maxChange >= this.MIN_CHANGE_THRESHOLD_PX;
  }
  
  /**
   * Convert pixel depths to normalized CropRect
   */
  private createCropRect(
    depths: { top: number; bottom: number; left: number; right: number },
    videoWidth: number,
    videoHeight: number
  ): CropRect {
    return {
      left: depths.left / videoWidth,
      top: depths.top / videoHeight,
      width: 1.0 - (depths.left + depths.right) / videoWidth,
      height: 1.0 - (depths.top + depths.bottom) / videoHeight
    };
  }
  
  private addToHistory(entry: DetectionHistory): void {
    this.history.push(entry);
    if (this.history.length > this.HISTORY_SIZE) {
      this.history.shift();  // Remove oldest
    }
  }
}
```

#### 2. CrtRenderer Integration

Modify `CrtRenderer` class:

```typescript
class CrtRenderer {
  private detectionPassRenderer: DetectionPassRenderer;
  private edgeAnalysisProcessor: EdgeAnalysisProcessor;
  private cropAnimator: CropAnimator;  // Reuse from Phase 1
  private lastDetectionTime = 0;
  private readonly DETECTION_INTERVAL_MS = 200;
  
  constructor(gl: WebGLRenderingContext, /* ...other params */) {
    // ...existing initialization
    
    // Initialize detection pipeline
    this.detectionPassRenderer = new DetectionPassRenderer(gl);
    this.edgeAnalysisProcessor = new EdgeAnalysisProcessor(gl);
    this.cropAnimator = new CropAnimator();  // Existing from Phase 1
  }
  
  render(videoElement: HTMLVideoElement, settings: CrtSettings): void {
    const now = performance.now();
    
    // Step 1: Run detection passes (if throttle elapsed and feature enabled)
    if (this.shouldRunDetection(now, settings)) {
      this.runDetectionPipeline(videoElement);
      this.lastDetectionTime = now;
    }
    
    // Step 2: Animate current crop (60 FPS)
    const deltaTime = now - this.lastFrameTime;
    this.cropAnimator.update(deltaTime);
    const currentCrop = this.cropAnimator.getCurrentCrop();
    
    // Step 3: Update main shader uniform
    this.gl.uniform4f(
      this.uniforms.u_cropRect,
      currentCrop.left,
      currentCrop.top,
      currentCrop.width,
      currentCrop.height
    );
    
    // Step 4: Render main pass with CRT effects
    this.renderMainPass(videoElement, settings);
    
    this.lastFrameTime = now;
  }
  
  private shouldRunDetection(now: number, settings: CrtSettings): boolean {
    // Feature must be enabled
    if (!settings.autoCropBlackBars) return false;
    
    // Throttle to 200ms intervals
    return (now - this.lastDetectionTime) >= this.DETECTION_INTERVAL_MS;
  }
  
  private runDetectionPipeline(videoElement: HTMLVideoElement): void {
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;
    
    // Pass 1: Edge detection
    this.detectionPassRenderer.renderEdgeDetection(
      this.videoTexture,
      videoWidth,
      videoHeight
    );
    
    // Pass 2: Horizontal scan (top/bottom bars)
    this.detectionPassRenderer.renderHorizontalScan(
      this.videoTexture,
      this.detectionPassRenderer.getEdgeMapTexture(),
      videoWidth,
      videoHeight
    );
    
    // Pass 3: Vertical scan (left/right bars)
    this.detectionPassRenderer.renderVerticalScan(
      this.videoTexture,
      this.detectionPassRenderer.getEdgeMapTexture(),
      videoWidth,
      videoHeight
    );
    
    // Pass 4: Process results (single readPixels)
    const cropRect = this.edgeAnalysisProcessor.processCropResults(
      this.detectionPassRenderer.getDepthMapTexture(),
      videoWidth,
      videoHeight
    );
    
    // Pass 5: Update animator target (if confident)
    if (cropRect) {
      this.cropAnimator.setTargetCrop(cropRect);
    }
  }
  
  destroy(): void {
    // ...existing cleanup
    this.detectionPassRenderer.destroy();
  }
}
```

#### 3. Testing Requirements

**Unit Tests** (`edge-analysis-processor.spec.ts`):

- **Single ReadPixels**: Verify only 1 `gl.readPixels()` call per `processCropResults()`
- **Depth Conversion**: Verify normalized depths (0-1) correctly converted to pixels
- **CropRect Calculation**: Verify left/top/width/height computed correctly
- **Confidence Scoring**: Verify temporal stability increases confidence
- **Commit Logic**: Verify crop only committed when confidence > 0.7 and change > 5px
- **History Management**: Verify history limited to 5 most recent samples

**Integration Tests** (`crt-renderer.spec.ts`):

- **Feature Toggle**: Verify detection skipped when `autoCropBlackBars = false`
- **Throttling**: Verify detection runs at 200ms intervals, animation at 60 FPS
- **Pipeline Execution**: Verify edge→horizontal→vertical→process sequence
- **Animator Integration**: Verify detected crops passed to `CropAnimator`
- **Uniform Update**: Verify `u_cropRect` uniform updated each frame
- **No Errors**: Verify no WebGL errors during detection pipeline

### Anti-Patterns to Avoid

- ❌ Don't call `gl.readPixels()` multiple times per frame
- ❌ Don't skip confidence scoring (prevents thrashing)
- ❌ Don't forget to throttle detection (200ms intervals)
- ❌ Don't bypass feature toggle check
- ❌ Don't animate detection results directly (use CropAnimator)

---

## 🧪 Test Coverage Required

### Unit Tests

- [ ] **Single ReadPixels Call**: Only 1 `gl.readPixels()` per `processCropResults()`
- [ ] **Depth Extraction**: Correct depths extracted from pixel buffer
- [ ] **Pixel Conversion**: Normalized depths correctly converted to pixels
- [ ] **CropRect Math**: left/top/width/height correctly computed
- [ ] **Confidence Scoring**: Stable depths yield high confidence (> 0.7)
- [ ] **Confidence Scoring**: Noisy depths yield low confidence (< 0.5)
- [ ] **Commit Logic**: Crop committed when confident and change > 5px
- [ ] **Commit Logic**: Crop rejected when low confidence or change < 5px

### Integration Tests

- [ ] **Detection Pipeline**: All 4 passes execute in order
- [ ] **Feature Toggle On**: Detection runs when `autoCropBlackBars = true`
- [ ] **Feature Toggle Off**: Detection skipped when `autoCropBlackBars = false`
- [ ] **Throttling**: Detection runs every 200ms, not every frame
- [ ] **Animator Integration**: Detected crops passed to `CropAnimator.setTargetCrop()`
- [ ] **Uniform Update**: `u_cropRect` updated with animated values each frame
- [ ] **No WebGL Errors**: No errors logged during complete render cycle

### Behavioral Expectations

**Stable Detection**:
- Same bar depths detected 3+ times → confidence > 0.7 → crop committed

**Noisy Detection**:
- Varying bar depths across frames → confidence < 0.7 → crop NOT committed (prevents thrashing)

**Feature Toggle**:
- `autoCropBlackBars = false` → detection passes skipped, crop remains (0,0,1,1)

**Performance**:
- Detection overhead < 5ms per 200ms interval
- Main render maintains 60 FPS

---

## 📖 Related Documentation

**Planning Documents**:
- [Phase 1.1 Plan](../phases/AUTO-CROP-BLACKBARS-PHASE-01.1-WEBGL-DETECTION.md) - Complete integration specification
- [Master Plan](../AUTO-CROP-BLACKBARS-MASTER-PLAN.md) - Project overview

**Related Tasks**:
- AUTO-CROP-BLACKBARS-TASK-01.1-001-EDGE-DETECTION-SHADER (prerequisite) - Edge detection
- AUTO-CROP-BLACKBARS-TASK-01.1-002-DEPTH-SCAN-SHADERS (prerequisite) - Depth scanning
- AUTO-CROP-BLACKBARS-TASK-01.1-004-DEBUG-OVERLAY (next) - Debug visualization

**Phase 1 Context**:
- [Phase 1 CropAnimator](../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/crop-animator.ts) - Reuse animation
- [Task 01-002 Report](../reports/AUTO-CROP-BLACKBARS-TASK-01-002-REPORT.md) - Performance issues to avoid

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/AUTO-CROP-BLACKBARS/reports/AUTO-CROP-BLACKBARS-TASK-01.1-003-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/AUTO-CROP-BLACKBARS/reports/AUTO-CROP-BLACKBARS-TASK-01.1-003-REPORT.md`

---

## 🎯 Summary

This task completes the GPU detection pipeline by integrating all components into `CrtRenderer`. The `EdgeAnalysisProcessor` reads GPU results via a single `gl.readPixels()` call (vs Phase 1's 40+ calls), adds confidence scoring to prevent thrashing, and passes stable crops to the existing `CropAnimator` for smooth transitions. This achieves Phase 1.1's performance goals (< 5ms detection overhead) while maintaining 60 FPS rendering.

**Key Deliverables**:
1. `EdgeAnalysisProcessor` class with single-readPixels strategy
2. Confidence scoring and temporal stability tracking
3. Complete detection pipeline integrated into `CrtRenderer`
4. Feature toggle and throttling support
5. Unit and integration tests verifying pipeline correctness

**Estimated Effort**: 1.5-2 days
