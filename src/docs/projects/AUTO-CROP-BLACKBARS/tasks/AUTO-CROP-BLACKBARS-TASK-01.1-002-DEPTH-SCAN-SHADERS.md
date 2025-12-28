# Task Handoff: Depth Scan Shaders Implementation

## 📋 Task Identity

**Task ID**: AUTO-CROP-BLACKBARS-TASK-01.1-002-DEPTH-SCAN-SHADERS  
**Task Name**: Implement Horizontal and Vertical Bar Depth Scanning Shaders  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Medium (4-8 files)

---

## 🎯 Objective

**What**: Create fragment shaders that measure black bar depth by scanning inward from detected edges using histogram variance analysis to identify the precise boundary between uniform black bars and textured content regions. Implement shaders for both horizontal (top/bottom) and vertical (left/right) bar depth measurement.

**Why**: Phase 1's CPU-based depth detection failed across 7 different approaches because inward scanning with `gl.readPixels()` caused severe performance degradation (100+ calls per frame) and simple heuristics couldn't distinguish black regions within content from true black bars. GPU-based histogram variance analysis can detect content boundaries accurately at real-time speeds by analyzing texture patterns in parallel.

**Success Criteria**:
- [ ] Horizontal scan shader (`horizontal-scan.frag.ts`) compiles without errors
- [ ] Vertical scan shader (`vertical-scan.frag.ts`) compiles without errors
- [ ] Shaders implement row/column variance calculation for texture detection
- [ ] Variance threshold correctly identifies uniform bars (low variance) vs content (high variance)
- [ ] Depth scanning limited to 50% of image dimension for performance
- [ ] Depth map encodes results: R=top depth, G=bottom depth, B=left depth, A=right depth
- [ ] Depth values normalized to 0-1 range (fraction of dimension)
- [ ] Shaders only execute when edge map indicates bars present (conditional logic)
- [ ] Unit tests verify variance calculation and boundary detection accuracy
- [ ] All tests pass with no WebGL errors

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- AUTO-CROP-BLACKBARS-TASK-01.1-001-EDGE-DETECTION-SHADER - Edge map texture available
- Phase 1 depth detection failures documented in [Task 01-002 Report](../reports/AUTO-CROP-BLACKBARS-TASK-01-002-REPORT.md)

**Dependencies**:
- `DetectionPassRenderer` class from Task 01.1-001
- Edge map texture (`edgeMapTexture`) containing bar presence flags
- Video texture for content analysis

**Constraints**:
- GLSL ES 1.0 limitations (no dynamic loop bounds)
- Max scan depth: 50% of image dimension (performance limit)
- Must maintain < 5ms detection overhead budget
- Depth scan only runs when edge map indicates bars present

---

## 📁 File Scope

**Files to Create**:
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/shaders/horizontal-scan.frag.ts` - Top/bottom bar depth shader
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/shaders/vertical-scan.frag.ts` - Left/right bar depth shader

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/shaders/index.ts` - Add shader exports
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/detection-pass-renderer.ts` - Add depth scan render methods
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/detection-pass-renderer.spec.ts` - Add depth scan tests

**Files to Review**:
- `docs/projects/AUTO-CROP-BLACKBARS/phases/AUTO-CROP-BLACKBARS-PHASE-01.1-WEBGL-DETECTION.md` - Variance algorithm specification
- `docs/projects/AUTO-CROP-BLACKBARS/reports/AUTO-CROP-BLACKBARS-TASK-01-002-REPORT.md` - Phase 1 failures to avoid

---

## 🛠️ Implementation Guidance

### Standards to Follow

- [HOW_TO_ADD_WEBGL_EFFECT.md](../../../docs/HOW_TO_ADD_WEBGL_EFFECT.md) - WebGL shader patterns
- [Coding Standards](../../../docs/CODING_STANDARDS.md) - TypeScript conventions
- [Testing Standards](../../../docs/TESTING_STANDARDS.md) - Testing approach

### Key Requirements

#### 1. Histogram Variance Technique

**Core Concept**: Uniform black bars have low pixel variance (all pixels similar), while textured content has high variance (diverse pixel values). Detect the boundary by finding where variance exceeds a threshold.

**Variance Formula**:
```glsl
// For a set of luminance samples:
mean = sum(samples) / n
variance = sum((sample - mean)^2) / n
```

**Thresholds**:
```glsl
const float CONTENT_VARIANCE_THRESHOLD = 0.03;  // Content detected when variance > 0.03
const float MAX_SCAN_DEPTH_PERCENT = 0.5;        // Scan up to 50% of dimension
const float EDGE_DETECTION_THRESHOLD = 0.7;      // Edge map must be > 70% to trigger scan
```

#### 2. Horizontal Scan Shader

Create `horizontal-scan.frag.ts`:

```glsl
precision mediump float;

uniform sampler2D u_videoTexture;
uniform sampler2D u_edgeMap;
uniform vec2 u_resolution;
varying vec2 v_texCoord;

const float CONTENT_VARIANCE_THRESHOLD = 0.03;
const float MAX_SCAN_DEPTH_PERCENT = 0.5;
const float EDGE_DETECTION_THRESHOLD = 0.7;
const int ROW_SAMPLES = 10;

// Compute luminance variance for a horizontal row
float computeRowVariance(float rowY) {
  float mean = 0.0;
  float samples[ROW_SAMPLES];
  
  // Sample 10 points across row
  for (int i = 0; i < ROW_SAMPLES; i++) {
    float x = float(i) / float(ROW_SAMPLES - 1);
    vec3 rgb = texture2D(u_videoTexture, vec2(x, rowY)).rgb;
    samples[i] = dot(rgb, vec3(0.299, 0.587, 0.114));  // Luminance
    mean += samples[i];
  }
  mean /= float(ROW_SAMPLES);
  
  // Compute variance
  float variance = 0.0;
  for (int i = 0; i < ROW_SAMPLES; i++) {
    float diff = samples[i] - mean;
    variance += diff * diff;
  }
  return variance / float(ROW_SAMPLES);
}

// Scan from top edge downward
float scanTopEdge() {
  float maxRows = u_resolution.y * MAX_SCAN_DEPTH_PERCENT;
  
  // Scan inward row by row
  for (float row = 0.0; row < maxRows; row += 1.0) {
    float rowY = row / u_resolution.y;
    float variance = computeRowVariance(rowY);
    
    // Content detected when variance exceeds threshold
    if (variance > CONTENT_VARIANCE_THRESHOLD) {
      return row / u_resolution.y;  // Return normalized depth
    }
  }
  
  return 0.0;  // No content found (entire region is black)
}

// Scan from bottom edge upward
float scanBottomEdge() {
  float maxRows = u_resolution.y * MAX_SCAN_DEPTH_PERCENT;
  
  // Scan inward from bottom
  for (float row = 0.0; row < maxRows; row += 1.0) {
    float rowY = 1.0 - (row / u_resolution.y);  // Start from bottom
    float variance = computeRowVariance(rowY);
    
    if (variance > CONTENT_VARIANCE_THRESHOLD) {
      return row / u_resolution.y;  // Return normalized depth
    }
  }
  
  return 0.0;
}

void main() {
  // Read edge detection results (from Task 01.1-001)
  vec4 edges = texture2D(u_edgeMap, vec2(0.5));  // Single pixel read
  
  // Only scan if edges detected (> 70% black)
  float topDepth = 0.0;
  if (edges.g > EDGE_DETECTION_THRESHOLD) {  // Green channel = top edge
    topDepth = scanTopEdge();
  }
  
  float bottomDepth = 0.0;
  if (edges.a > EDGE_DETECTION_THRESHOLD) {  // Alpha channel = bottom edge
    bottomDepth = scanBottomEdge();
  }
  
  // Output: R = top depth, G = bottom depth, B/A unused (for vertical depths)
  gl_FragColor = vec4(topDepth, bottomDepth, 0.0, 0.0);
}
```

**Export Pattern**:
```typescript
// horizontal-scan.frag.ts
export const horizontalScanFragmentShader = `...shader code above...`;
```

#### 3. Vertical Scan Shader

Create `vertical-scan.frag.ts` following similar pattern:

```glsl
// Similar structure to horizontal scan, but:
// - computeColumnVariance() samples vertically (x=constant, y varies)
// - scanLeftEdge() scans from x=0 inward
// - scanRightEdge() scans from x=1 inward
// - Output: vec4(leftDepth, rightDepth, 0.0, 0.0) 
//   OR append to horizontal results: vec4(topDepth, bottomDepth, leftDepth, rightDepth)
```

**Key Difference**: Sample columns instead of rows:
```glsl
float computeColumnVariance(float colX) {
  // Sample 10 points down column
  for (int i = 0; i < 10; i++) {
    float y = float(i) / 9.0;
    vec3 rgb = texture2D(u_videoTexture, vec2(colX, y)).rgb;
    // ... variance calculation
  }
}
```

#### 4. DetectionPassRenderer Integration

Add methods to `DetectionPassRenderer` class:

```typescript
class DetectionPassRenderer {
  private depthMapFBO: WebGLFramebuffer;
  private depthMapTexture: WebGLTexture;
  private horizontalScanProgram: WebGLProgram;
  private verticalScanProgram: WebGLProgram;
  
  /**
   * Render horizontal depth scan (top/bottom bars)
   */
  renderHorizontalScan(videoTexture: WebGLTexture, edgeMapTexture: WebGLTexture, videoWidth: number, videoHeight: number): void {
    const gl = this.gl;
    
    // Bind depth map FBO (1x4 resolution: 4 pixels for top/bottom/left/right)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.depthMapFBO);
    gl.viewport(0, 0, 4, 1);
    
    // Bind shader
    gl.useProgram(this.horizontalScanProgram);
    
    // Set uniforms
    gl.uniform1i(this.horizontalScanUniforms.u_videoTexture, 0);
    gl.uniform1i(this.horizontalScanUniforms.u_edgeMap, 1);
    gl.uniform2f(this.horizontalScanUniforms.u_resolution, videoWidth, videoHeight);
    
    // Bind textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, edgeMapTexture);
    
    // Draw quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  
  /**
   * Render vertical depth scan (left/right bars)
   * Similar to horizontal scan, but uses verticalScanProgram
   */
  renderVerticalScan(videoTexture: WebGLTexture, edgeMapTexture: WebGLTexture, videoWidth: number, videoHeight: number): void {
    // Similar logic, appends to depth map texture
  }
  
  /**
   * Get depth map texture containing all 4 depths (RGBA)
   */
  getDepthMapTexture(): WebGLTexture {
    return this.depthMapTexture;
  }
  
  private createDepthMapRenderTarget(): void {
    const gl = this.gl;
    
    // Create 4x1 texture (4 pixels: R=top, G=bottom, B=left, A=right)
    this.depthMapTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.depthMapTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    
    // Create FBO
    this.depthMapFBO = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.depthMapFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.depthMapTexture, 0);
    
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Depth map framebuffer incomplete');
    }
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
}
```

#### 5. Testing Requirements

**Unit Tests** (`detection-pass-renderer.spec.ts` additions):

- **Variance Calculation**: Verify shader computes correct variance for synthetic row/column patterns
- **Uniform Black Detection**: Test that solid black rows return 0 variance
- **Textured Content Detection**: Test that diverse pixel patterns return high variance
- **Boundary Detection**: Verify depth stops at correct row/column when variance exceeds threshold
- **Conditional Execution**: Verify scan only runs when edge map indicates bars present
- **Depth Encoding**: Verify normalized depths (0-1) correctly stored in texture channels
- **Max Depth Limit**: Verify scanning stops at 50% dimension

**Test Patterns**:
- Solid black frame: all depths should be 0.0 (no content boundary found)
- Black top bar (20px): top depth = 20/height, others = 0.0
- Black letterbox (top=30px, bottom=40px): R=30/height, G=40/height, B/A=0.0
- Purple borders: all depths = 0.0 (edge map indicates no bars)

### Anti-Patterns to Avoid

- ❌ Don't use dynamic loop bounds (GLSL ES limitation)
- ❌ Don't scan beyond 50% depth (performance limit)
- ❌ Don't call depth scan shaders when edge map shows no bars
- ❌ Don't use `gl.readPixels()` in shader code
- ❌ Don't forget to normalize depths to 0-1 range

---

## 🧪 Test Coverage Required

### Unit Tests

- [ ] **Shader Compilation**: Horizontal and vertical scan shaders compile without errors
- [ ] **Variance Calculation**: Computed variance matches expected values for synthetic patterns
- [ ] **Uniform Black Row**: Variance < 0.01 for solid black RGB(0,0,0) row
- [ ] **Textured Content Row**: Variance > 0.05 for diverse pixel pattern
- [ ] **Boundary Detection**: Depth stops at correct row when variance crosses threshold
- [ ] **Conditional Execution**: Scan skipped when edge map < 0.7
- [ ] **Depth Encoding**: Normalized depths correctly stored in RGBA channels
- [ ] **FBO Creation**: Depth map framebuffer created at 4x1 resolution

### Behavioral Expectations

**Horizontal Scan**:
- Black top bar (20px, 480px height): top depth = 20/480 ≈ 0.042
- Black bottom bar (30px, 480px height): bottom depth = 30/480 ≈ 0.063
- No bars detected: all depths = 0.0

**Vertical Scan**:
- Black left bar (15px, 640px width): left depth = 15/640 ≈ 0.023
- Black right bar (25px, 640px width): right depth = 25/640 ≈ 0.039
- No bars detected: all depths = 0.0

---

## 📖 Related Documentation

**Planning Documents**:
- [Phase 1.1 Plan](../phases/AUTO-CROP-BLACKBARS-PHASE-01.1-WEBGL-DETECTION.md) - Variance algorithm specification
- [Master Plan](../AUTO-CROP-BLACKBARS-MASTER-PLAN.md#phase-11) - Project overview

**Phase 1 Lessons Learned**:
- [Task 01-002 Report](../reports/AUTO-CROP-BLACKBARS-TASK-01-002-REPORT.md#black-bar-depth-detection-challenges-unsolved-) - 7 failed depth detection approaches

**Related Tasks**:
- AUTO-CROP-BLACKBARS-TASK-01.1-001-EDGE-DETECTION-SHADER (prerequisite) - Edge map input
- AUTO-CROP-BLACKBARS-TASK-01.1-003-RENDERER-INTEGRATION (next) - Will consume depth map

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/AUTO-CROP-BLACKBARS/reports/AUTO-CROP-BLACKBARS-TASK-01.1-002-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/AUTO-CROP-BLACKBARS/reports/AUTO-CROP-BLACKBARS-TASK-01.1-002-REPORT.md`

---

## 🎯 Summary

This task solves Phase 1's depth detection failures by implementing GPU-based histogram variance analysis. Unlike CPU-based approaches that required 100+ `gl.readPixels()` calls and hit false boundaries, GPU shaders can analyze entire rows/columns in parallel and accurately distinguish uniform black bars from textured content regions.

**Key Deliverables**:
1. Horizontal scan shader for top/bottom bar depth measurement
2. Vertical scan shader for left/right bar depth measurement
3. Depth map texture encoding all 4 depths (RGBA channels)
4. Conditional execution (only scan when edges detected)
5. Unit tests verifying variance calculation and boundary detection

**Estimated Effort**: 1.5-2 days
