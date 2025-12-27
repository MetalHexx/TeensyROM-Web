# Task Handoff: Edge Detection Shader Implementation

## 📋 Task Identity

**Task ID**: AUTO-CROP-BLACKBARS-TASK-01.1-001-EDGE-DETECTION-SHADER  
**Task Name**: Implement GPU-Based Edge Detection Shader and Render Pass  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High (Foundation for Phase 1.1)  
**Estimated Context Size**: Medium (4-8 files)

---

## 🎯 Objective

**What**: Create a WebGL fragment shader that performs black bar detection on all four edges (top/bottom/left/right) using dual-threshold HSV saturation + luminance checks, and build the `DetectionPassRenderer` class to execute this shader as a render pass, outputting edge detection results to a texture.

**Why**: Phase 1's CPU-based detection using `gl.readPixels()` caused performance degradation (40+ calls per frame). GPU-based detection runs all edge sampling in parallel on the GPU at real-time speeds, eliminating CPU stalls and enabling more sophisticated analysis algorithms.

**Success Criteria**:
- [ ] Edge detection fragment shader (`edge-detect.frag.ts`) compiles without errors
- [ ] Shader implements HSV saturation calculation matching Phase 1's proven algorithm
- [ ] Shader samples 20 points per edge (denser than Phase 1's 10)
- [ ] Dual-threshold logic correctly identifies black bars: `luminance < 0.05 && saturation < 0.1`
- [ ] Edge map output encodes results in RGBA channels: R=left, G=top, B=right, A=bottom
- [ ] `DetectionPassRenderer` class created with FBO/texture management
- [ ] Edge map renders at 1/8 scale for performance (e.g., 320x240 → 40x30)
- [ ] Unit tests verify shader compilation, FBO creation, and edge map accuracy
- [ ] All tests pass with no WebGL errors

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- Phase 1 completed - existing CRT renderer pipeline established
- HSV saturation algorithm proven effective in [Phase 1 Task 01-002](../reports/AUTO-CROP-BLACKBARS-TASK-01-002-REPORT.md)
- `CropAnimator` class exists and will be reused
- Shader uniforms infrastructure in place from scanline shader

**Dependencies**:
- WebGL 1.0 rendering context
- Existing CrtRenderer class structure
- Video texture from HTMLVideoElement

**Constraints**:
- Must use GLSL ES 1.0 (WebGL 1.0 limitation - no compute shaders)
- Loops must have compile-time bounds (GLSL ES constraint)
- Must maintain 60 FPS main render loop
- Detection overhead budget: < 5ms per frame

---

## 📁 File Scope

**Files to Create**:
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/shaders/edge-detect.frag.ts` - Edge detection fragment shader (GLSL ES code)
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/shaders/index.ts` - Shader barrel exports
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/detection-pass-renderer.ts` - Render pass class
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/detection-pass-renderer.spec.ts` - Unit tests
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/index.ts` - Detection barrel exports

**Files to Modify**:
- None in this task (integration with CrtRenderer happens in Task 01.1-003)

**Files to Review** (for context only):
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts` - Understand existing render pass pattern
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts` - Existing shader example
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/black-bar-detector.ts` - Phase 1 CPU algorithm to port
- `docs/projects/AUTO-CROP-BLACKBARS/phases/AUTO-CROP-BLACKBARS-PHASE-01.1-WEBGL-DETECTION.md` - Complete phase specification

---

## 🛠️ Implementation Guidance

### Standards to Follow

- [HOW_TO_ADD_WEBGL_EFFECT.md](../../../docs/HOW_TO_ADD_WEBGL_EFFECT.md) - WebGL shader patterns
- [Coding Standards](../../../docs/CODING_STANDARDS.md) - TypeScript conventions
- [Testing Standards](../../../docs/TESTING_STANDARDS.md) - Testing approach
- [GLSL ES Specification](https://www.khronos.org/files/webgl/webgl-reference-card-1_0.pdf) - Shader syntax

### Key Requirements

#### 1. Edge Detection Shader Structure

Create `edge-detect.frag.ts` with this structure:

```glsl
precision mediump float;

uniform sampler2D u_videoTexture;
uniform vec2 u_resolution;
varying vec2 v_texCoord;

const float BLACK_LUMINANCE_THRESHOLD = 0.05;
const float BLACK_SATURATION_THRESHOLD = 0.1;
const int SAMPLES_PER_EDGE = 20;

// Port HSV saturation from Phase 1
float calculateSaturation(vec3 rgb) {
  float maxVal = max(max(rgb.r, rgb.g), rgb.b);
  float minVal = min(min(rgb.r, rgb.g), rgb.b);
  return (maxVal == 0.0) ? 0.0 : (maxVal - minVal) / maxVal;
}

// Sample edge and return black bar strength (0.0-1.0)
float sampleEdge(vec2 startPos, vec2 stepDir) {
  int blackCount = 0;
  for (int i = 0; i < SAMPLES_PER_EDGE; i++) {
    vec2 samplePos = startPos + stepDir * float(i) / float(SAMPLES_PER_EDGE - 1);
    vec4 color = texture2D(u_videoTexture, samplePos);
    
    float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    float saturation = calculateSaturation(color.rgb);
    
    if (luminance < BLACK_LUMINANCE_THRESHOLD && saturation < BLACK_SATURATION_THRESHOLD) {
      blackCount++;
    }
  }
  return float(blackCount) / float(SAMPLES_PER_EDGE);
}

void main() {
  // Sample all four edges
  float leftEdge = sampleEdge(vec2(0.0, 0.0), vec2(0.0, 1.0));   // Left edge, vertical
  float topEdge = sampleEdge(vec2(0.0, 0.0), vec2(1.0, 0.0));    // Top edge, horizontal
  float rightEdge = sampleEdge(vec2(1.0, 0.0), vec2(0.0, 1.0));  // Right edge, vertical
  float bottomEdge = sampleEdge(vec2(0.0, 1.0), vec2(1.0, 0.0)); // Bottom edge, horizontal
  
  // Output RGBA: each channel encodes edge strength (0.0 = content, 1.0 = black bar)
  gl_FragColor = vec4(leftEdge, topEdge, rightEdge, bottomEdge);
}
```

**Export Pattern**:
```typescript
// edge-detect.frag.ts
export const edgeDetectFragmentShader = `...shader code above...`;
```

#### 2. DetectionPassRenderer Class

Create class with these responsibilities:

**Constructor**:
- Accept `WebGLRenderingContext` parameter
- Create shader program from edge detection fragment shader
- Create edge map framebuffer and texture at 1/8 scale
- Cache uniform/attribute locations

**Key Methods**:
- `renderEdgeDetection(videoTexture: WebGLTexture, videoWidth: number, videoHeight: number): void` - Execute edge detection pass
- `getEdgeMapTexture(): WebGLTexture` - Return edge map for next pass
- `destroy(): void` - Clean up WebGL resources

**Render Pass Logic**:
```typescript
renderEdgeDetection(videoTexture: WebGLTexture, videoWidth: number, videoHeight: number): void {
  const gl = this.gl;
  
  // Bind edge map FBO (1/8 scale)
  gl.bindFramebuffer(gl.FRAMEBUFFER, this.edgeMapFBO);
  gl.viewport(0, 0, Math.floor(videoWidth / 8), Math.floor(videoHeight / 8));
  
  // Bind shader program
  gl.useProgram(this.edgeDetectProgram);
  
  // Set uniforms
  gl.uniform1i(this.uniforms.u_videoTexture, 0);
  gl.uniform2f(this.uniforms.u_resolution, videoWidth, videoHeight);
  
  // Bind video texture
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, videoTexture);
  
  // Draw full-screen quad
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  
  // Unbind FBO (return to default framebuffer)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
```

**Framebuffer Setup**:
```typescript
private createEdgeMapRenderTarget(width: number, height: number): void {
  const gl = this.gl;
  
  // Create texture (8-bit RGBA)
  this.edgeMapTexture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, this.edgeMapTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  
  // Create framebuffer
  this.edgeMapFBO = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, this.edgeMapFBO);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.edgeMapTexture, 0);
  
  // Verify completeness
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error('Edge map framebuffer incomplete');
  }
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
```

#### 3. Testing Requirements

**Unit Tests** (`detection-pass-renderer.spec.ts`):

- **Shader Compilation**: Verify edge detection shader compiles without errors
- **FBO Creation**: Verify framebuffer and texture created at 1/8 scale
- **Edge Map Output**: Verify RGBA channels contain expected values for test patterns
- **HSV Saturation**: Compare GLSL saturation results with CPU version on known RGB values
- **Dual Threshold**: Test that only pixels passing both thresholds are marked as black
- **Render Pass Execution**: Verify no WebGL errors during edge detection pass

**Test Patterns**:
- Solid black frame: all channels should be 1.0 (255)
- Solid white frame: all channels should be 0.0 (0)
- Purple borders (RGB(20,0,30)): all channels should be 0.0 (saturation check works)
- Black top bar only: G channel should be 1.0, others 0.0
- Black letterbox (top+bottom): G and A channels should be 1.0

**Mocking Strategy**:
- Use existing `webgl-context.mock.ts` pattern
- Mock `gl.createShader()`, `gl.compileShader()`, `gl.createProgram()`
- Mock FBO/texture creation methods
- Create synthetic video textures with known pixel patterns

### Anti-Patterns to Avoid

- ❌ Don't use `gl.readPixels()` in this task - results stay on GPU
- ❌ Don't add depth scanning logic - that's Task 01.1-002
- ❌ Don't integrate with CrtRenderer yet - that's Task 01.1-003
- ❌ Don't optimize prematurely - focus on correctness first
- ❌ Don't use dynamic loop bounds in GLSL (use constants)

---

## 🧪 Test Coverage Required

### Unit Tests

- [ ] **Shader Compilation Success**: Edge detection shader compiles without errors
- [ ] **HSV Saturation Calculation**: GLSL matches CPU algorithm on RGB(20,0,30), RGB(255,0,0), RGB(0,0,0)
- [ ] **Luminance Calculation**: GLSL matches ITU-R BT.601 formula on test RGB values
- [ ] **Dual Threshold Logic**: Only pixels with low luminance AND low saturation marked as black
- [ ] **Edge Map Output Format**: RGBA channels correctly encode left/top/right/bottom edges
- [ ] **FBO Creation**: Framebuffer and texture created at 1/8 scale resolution
- [ ] **Render Pass Execution**: No WebGL errors during `renderEdgeDetection()` call

### Behavioral Expectations

- Solid black frame: all channels = 1.0 (edge map shows bars on all sides)
- Solid white frame: all channels = 0.0 (no bars detected)
- Purple border frame: channels = 0.0 (saturation check prevents false positive)
- Black top bar only: G=1.0, R/B/A=0.0 (only top edge detected)
- Black letterbox: G=1.0, A=1.0, R/B=0.0 (top and bottom edges detected)

---

## 📖 Related Documentation

**Planning Documents**:
- [Phase 1.1 Plan](../phases/AUTO-CROP-BLACKBARS-PHASE-01.1-WEBGL-DETECTION.md) - Complete phase specification
- [Master Plan](../AUTO-CROP-BLACKBARS-MASTER-PLAN.md) - Project overview

**Phase 1 Reports** (Lessons Learned):
- [Task 01-002 Report](../reports/AUTO-CROP-BLACKBARS-TASK-01-002-REPORT.md) - HSV saturation solution, depth detection failures
- [Task 01-004 Report](../reports/AUTO-CROP-BLACKBARS-TASK-01-004-REPORT.md) - Settings integration patterns

**Technical References**:
- [HOW_TO_ADD_WEBGL_EFFECT.md](../../../docs/HOW_TO_ADD_WEBGL_EFFECT.md) - WebGL patterns
- [GLSL ES Reference Card](https://www.khronos.org/files/webgl/webgl-reference-card-1_0.pdf) - Shader syntax

**Related Tasks**:
- AUTO-CROP-BLACKBARS-TASK-01.1-002-DEPTH-SCAN-SHADERS (next) - Will consume edge map texture
- AUTO-CROP-BLACKBARS-TASK-01.1-003-RENDERER-INTEGRATION (depends on this) - Integration point

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/AUTO-CROP-BLACKBARS/reports/AUTO-CROP-BLACKBARS-TASK-01.1-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/AUTO-CROP-BLACKBARS/reports/AUTO-CROP-BLACKBARS-TASK-01.1-001-REPORT.md`

---

## 🎯 Summary

This task establishes the foundation for GPU-based black bar detection by implementing the edge detection shader and render pass infrastructure. The shader ports Phase 1's proven HSV saturation algorithm to GLSL, running all edge sampling in parallel on the GPU. This eliminates the performance bottlenecks that plagued Phase 1's CPU-based detection and enables more sophisticated analysis in subsequent tasks.

**Key Deliverables**:
1. Edge detection fragment shader with dual-threshold algorithm
2. DetectionPassRenderer class managing render targets
3. Comprehensive unit tests verifying shader correctness
4. Foundation for Tasks 01.1-002 (depth scanning) and 01.1-003 (integration)

**Estimated Effort**: 1-2 days
