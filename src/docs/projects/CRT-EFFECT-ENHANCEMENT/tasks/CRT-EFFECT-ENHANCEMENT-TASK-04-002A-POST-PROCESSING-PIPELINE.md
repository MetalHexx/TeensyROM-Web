# Subagent Task Handoff

## 📋 Task Identity

**Task ID**: CRT-EFFECT-ENHANCEMENT-TASK-04-002A-POST-PROCESSING-PIPELINE  
**Task Name**: WebGL Post-Processing Pipeline Refactor  
**Assigned To**: UI Wizard (Clean Coder mode)  
**Agent Chatmode**: `.github/chatmodes/ui-wizard.chatmode.md`  
**Priority**: High  
**Estimated Size**: Large (architectural refactor + shader rewrite)  
**Estimated Time**: 3-4 hours

---

## 🎯 Objective

### What

Refactor the CRT effect system from an overlay-based architecture to a proper WebGL post-processing pipeline where the fragment shader samples the video frame as a texture and outputs the final CRT image with multiplicative phosphor and scanline effects.

### Why

The current overlay approach has fundamental limitations:
- Can only tint or darken the image via alpha blending
- Cannot multiply video pixels by phosphor masks (true color filtering)
- Blacks become less black when phosphor glow is visible
- Effects are inherently limited compared to real CRT shader implementations (CRT-Lottes, CRT-Royale)

The post-processing pipeline approach will enable true multiplicative blending:
```glsl
finalColor = videoColor * phosphorMask * scanlineFactor;
```

### Success Criteria

- [ ] Video element content is sampled as a WebGL `sampler2D` texture
- [ ] Fragment shader samples video texture and applies effects multiplicatively
- [ ] Phosphor patterns multiply video RGB (not overlay)
- [ ] Scanlines multiply video brightness (not overlay)
- [ ] Vignette multiplies final output (not overlay)
- [ ] Output is complete final image with no alpha blending dependency
- [ ] Existing UI controls (pattern dropdown, sliders) continue working
- [ ] All unit tests pass (update as needed for new architecture)
- [ ] Visual quality is significantly improved over overlay approach
- [ ] CSS fallback mode still works (unchanged)

---

## 🔧 Technical Architecture

### Current Architecture (OVERLAY)

```
┌──────────────────────────────────────┐
│  HTML Layer Stack (z-indexed)        │
├──────────────────────────────────────┤
│  z-3: WebGL Canvas (alpha overlay)   │  ← Outputs semi-transparent RGBA
│  z-2: CSS ::after (vignette)         │    blended on top of video
│  z-1: CSS ::before (scanlines)       │
│  z-0: <video> / ng-content           │  ← Video plays here independently
└──────────────────────────────────────┘
```

**Problems**: 
- Canvas cannot access video pixels
- Only additive/alpha blending possible
- Effects can't truly filter the source

### Target Architecture (POST-PROCESSING)

```
┌──────────────────────────────────────┐
│  Single WebGL Pipeline               │
├──────────────────────────────────────┤
│  1. Video → Texture Upload           │  texImage2D(videoElement)
│  2. Fullscreen Quad Draw             │  Draw with CRT shader
│  3. Fragment Shader:                 │
│     - Sample video at vUv            │
│     - Apply phosphor mask (multiply) │
│     - Apply scanlines (multiply)     │
│     - Apply vignette (multiply)      │
│     - Output final RGB               │
│  4. WebGL Canvas = Final Output      │  No more alpha blending
└──────────────────────────────────────┘
```

**Benefits**:
- True multiplicative color filtering
- Authentic phosphor RGB separation
- Scanlines properly darken video content
- Single-pass rendering (efficient)

---

## 📁 File Scope

### Files to Modify

```
📝 libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts
   - Add video texture creation and management
   - Add requestVideoFrameCallback or requestAnimationFrame loop
   - Update uniforms for texture sampling
   - Remove alpha blending dependency
   - Add video element reference handling

📝 libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts
   - Add sampler2D u_videoTexture uniform
   - Rewrite main() to sample video first
   - Change phosphor from additive to multiplicative
   - Change scanlines from additive to multiplicative
   - Change vignette from additive to multiplicative
   - Output gl_FragColor = vec4(finalColor, 1.0)

📝 libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts
   - Pass video element reference to CrtRenderer
   - Handle video element detection (from ng-content or explicit input)
   - Set up continuous render loop (RAF-based)
   - Update cleanup logic

📝 libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.html
   - May need to restructure for video capture
   - Consider: ng-content projection vs explicit video input

📝 libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss
   - Remove CSS overlay effects for WebGL mode (they conflict now)
   - Keep CSS fallback mode intact
   - WebGL canvas should fully cover content

📝 libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.spec.ts
   - Add tests for video texture handling
   - Update existing tests for new architecture
   - Mock texImage2D with video element
```

### Files to Review (Context)

```
📖 libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts
   - Understand current settings shape (no changes needed)

📖 libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts
   - Understand default values (no changes needed)

📖 libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts
   - Verify UI controls don't need changes
```

---

## 🔧 Implementation Guidance

### Step 1: Add Video Texture Support to CrtRenderer

**Key additions to CrtRenderer class:**

```typescript
interface CrtUniforms {
  // existing...
  videoTexture: WebGLUniformLocation | null;  // NEW: sampler2D location
}

// New private members
private videoTexture: WebGLTexture | null = null;
private videoElement: HTMLVideoElement | null = null;
private animationFrameId: number | null = null;

// New methods
setVideoElement(video: HTMLVideoElement): void;
private createVideoTexture(): void;
private updateVideoTexture(): void;  // Called each frame
startRenderLoop(): void;
stopRenderLoop(): void;
```

**Texture setup pattern (WebGL 1):**
```typescript
private createVideoTexture(): void {
  if (!this.gl) return;
  
  this.videoTexture = this.gl.createTexture();
  this.gl.bindTexture(this.gl.TEXTURE_2D, this.videoTexture);
  
  // Required for video textures (NPOT = Non-Power-Of-Two)
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
}

private updateVideoTexture(): void {
  if (!this.gl || !this.videoTexture || !this.videoElement) return;
  if (this.videoElement.readyState < 2) return; // Not ready yet
  
  this.gl.bindTexture(this.gl.TEXTURE_2D, this.videoTexture);
  this.gl.texImage2D(
    this.gl.TEXTURE_2D,
    0,
    this.gl.RGBA,
    this.gl.RGBA,
    this.gl.UNSIGNED_BYTE,
    this.videoElement
  );
}
```

### Step 2: Rewrite Fragment Shader for Multiplicative Effects

**New shader structure:**

```glsl
precision highp float;

// Video texture
uniform sampler2D u_videoTexture;

// CRT effect uniforms (existing)
uniform float u_scanlineIntensity;
uniform float u_scanlineSize;
uniform float u_vignetteStrength;
uniform vec2 u_resolution;
uniform int u_phosphorPattern;
uniform float u_phosphorIntensity;

varying vec2 v_texCoord;

// Reuse existing phosphor pattern functions (apertureGrille, shadowMask, dotTriad)
// but now they return RGB multipliers

void main() {
    // 1. Sample video texture
    vec4 videoColor = texture2D(u_videoTexture, v_texCoord);
    
    // 2. Calculate phosphor mask (0-1 RGB multiplier)
    vec3 phosphorMask = calculatePhosphor(v_texCoord, u_resolution, u_phosphorPattern, u_phosphorIntensity);
    
    // 3. Calculate scanline factor (0-1 multiplier)
    float scanlineFactor = 1.0 - (calculateScanline(v_texCoord, u_scanlineSize, u_resolution) * u_scanlineIntensity);
    
    // 4. Calculate vignette (0-1 multiplier)
    float vignetteFactor = 1.0 - calculateVignette(v_texCoord, u_vignetteStrength);
    
    // 5. Combine multiplicatively
    vec3 finalColor = videoColor.rgb * phosphorMask * scanlineFactor * vignetteFactor;
    
    // 6. Output final color (no alpha dependency)
    gl_FragColor = vec4(finalColor, 1.0);
}
```

**Key changes from overlay approach:**
- `texture2D(u_videoTexture, v_texCoord)` samples video pixels
- Multiply instead of alpha-blend
- Output `vec4(finalColor, 1.0)` - fully opaque, no blending

### Step 3: Modify Phosphor Pattern Functions

The existing phosphor functions return RGB masks. Keep the mask calculation logic but ensure:

**For `calculatePhosphor`:**
- When intensity = 0: return `vec3(1.0)` (no color filtering, full pass-through)
- When intensity = 1: return full phosphor mask (maximum color separation)
- Use `mix(vec3(1.0), mask, intensity)` for smooth blending

**For phosphor patterns:**
- Aperture Grille: Return RGB stripes where each column only passes one color
- Shadow Mask: Return staggered dot pattern with proper RGB masking
- Dot Triad: Return triangular arrangement

The existing pattern logic is correct - just ensure it's used as a multiplier, not an overlay.

### Step 4: Update Component to Pass Video Element

**Option A - Explicit Video Input (Recommended):**
```typescript
// Add new input for video element reference
readonly videoElement = input<HTMLVideoElement | null>(null);

// In effect() or afterNextRender:
effect(() => {
  const video = this.videoElement();
  if (video && this.renderer) {
    this.renderer.setVideoElement(video);
    this.renderer.startRenderLoop();
  }
});
```

**Option B - Auto-detect from ng-content:**
```typescript
// Query for video element within projected content
// This is more fragile but works with existing usage
afterNextRender(() => {
  const wrapper = this.wrapperRef()?.nativeElement;
  const video = wrapper?.querySelector('video');
  if (video && this.renderer) {
    this.renderer.setVideoElement(video);
    this.renderer.startRenderLoop();
  }
});
```

**Recommendation**: Start with Option B for backward compatibility, but consider Option A for cleaner API.

### Step 5: Implement Render Loop

The renderer needs continuous updates when video is playing:

```typescript
startRenderLoop(): void {
  if (this.animationFrameId !== null) return;
  
  const loop = () => {
    if (this.contextLost) {
      this.animationFrameId = requestAnimationFrame(loop);
      return;
    }
    
    this.updateVideoTexture();
    this.render();
    this.animationFrameId = requestAnimationFrame(loop);
  };
  
  this.animationFrameId = requestAnimationFrame(loop);
}

stopRenderLoop(): void {
  if (this.animationFrameId !== null) {
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }
}
```

**Performance consideration**: Use `requestVideoFrameCallback` when available (Chrome 83+) for more efficient video-synced rendering. Fall back to RAF for other browsers.

### Step 6: Update WebGL Context Options

```typescript
// In init(), update context options:
const gl = canvas.getContext('webgl', {
  alpha: false,           // CHANGED: No alpha needed, we're the final output
  premultipliedAlpha: false,
  antialias: false,
  preserveDrawingBuffer: false,
});
```

### Step 7: Remove Alpha Blending

```typescript
// In init(), REMOVE these lines:
// this.gl.enable(this.gl.BLEND);
// this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

// The canvas will now be fully opaque and positioned over the video
```

### Step 8: Update CSS for WebGL Mode

```scss
.crt-wrapper {
  &.mode-webgl {
    // Hide CSS overlay effects - WebGL canvas renders everything
    &::before, &::after {
      display: none;
    }
    
    // Content (video) should be hidden when WebGL is active
    // because the canvas now shows the processed video
    .crt-content {
      // Option A: Hide original video
      visibility: hidden;
      
      // Option B: Or use opacity
      // opacity: 0;
    }
    
    .webgl-canvas {
      // Canvas is the only visible layer
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10;
    }
  }
}
```

---

## 🧪 Testing Requirements

### Unit Tests - CrtRenderer

```typescript
describe('CrtRenderer - Video Texture', () => {
  it('should create video texture when setVideoElement called');
  it('should update video texture each frame in render loop');
  it('should handle video not ready (readyState < 2)');
  it('should bind video texture to uniform in render');
  it('should stop render loop on destroy');
  it('should handle context loss during render loop');
});
```

### Unit Tests - Shader

```typescript
describe('Scanline Shader - Post-Processing', () => {
  it('should compile with u_videoTexture uniform');
  it('should sample video texture at correct UV coordinates');
  // Shader logic tests via uniform verification
});
```

### Integration Tests

```typescript
describe('CrtEffectWrapper - Post-Processing Mode', () => {
  it('should auto-detect video element from ng-content');
  it('should start render loop when video element available');
  it('should stop render loop on component destroy');
  it('should apply multiplicative effects to video');
});
```

### Manual Testing Checklist

- [ ] Video content is visible through WebGL canvas
- [ ] Phosphor patterns create visible RGB separation
- [ ] Scanlines properly darken the video (not overlay)
- [ ] Vignette darkens edges without affecting black level
- [ ] Settings sliders update effects in real-time
- [ ] CSS fallback mode still works
- [ ] No visible delay between video and canvas

---

## ⚠️ Edge Cases & Gotchas

### Video Element Readiness

```typescript
// Video must have metadata loaded before texture upload
if (video.readyState < video.HAVE_CURRENT_DATA) {
  video.addEventListener('loadeddata', () => this.startRenderLoop(), { once: true });
  return;
}
```

### Cross-Origin Video

If video source is cross-origin, texture upload fails silently. Handle with:
```typescript
// Check if video is tainted (cross-origin without CORS)
try {
  this.gl.texImage2D(..., videoElement);
} catch (e) {
  console.warn('CrtRenderer: Cannot use video as texture (CORS issue)');
  // Fall back to CSS mode
}
```

### Power of Two Textures

WebGL 1 has issues with non-power-of-two textures. The texture parameters in Step 1 handle this:
```glsl
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
```

### Render Loop Cleanup

Always stop render loop on:
- Component destroy
- Mode switch to CSS
- Video element removed
- Context loss (resume when restored)

---

## 📊 Performance Considerations

### Texture Upload Cost

`texImage2D` with a video element is optimized by browsers but still has cost:
- Desktop: ~0.5-1ms per frame at 1080p
- Mobile: ~2-3ms per frame at 720p

### Frame Synchronization

Use `requestVideoFrameCallback` when available:
```typescript
if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
  video.requestVideoFrameCallback(() => {
    this.updateVideoTexture();
    this.render();
    this.scheduleNextFrame();
  });
}
```

This avoids rendering frames that haven't changed.

### Effect Intensity

Consider adding a quality/performance toggle:
- High: Full shader with all effects
- Low: Simplified shader (scanlines only, simpler phosphor)

---

## 🔗 Dependencies

### Prerequisite Tasks

- **TASK-04-001-DOMAIN-MODEL**: Must be complete (phosphor settings in domain) ✅
- **TASK-04-002-PHOSPHOR-PATTERN**: Overlay implementation complete, patterns will be reused ✅

### Blocking Tasks

- **TASK-04-003-BLOOM-EFFECT**: Should wait for this refactor (bloom needs texture access)
- **TASK-04-004-BARREL-DISTORTION**: Should wait for this refactor (needs texture sampling)
- **TASK-04-005-CHROMATIC-ABERRATION**: Should wait for this refactor (needs texture sampling)

---

## 📚 Standards to Follow

- [CODING_STANDARDS.md](../../../CODING_STANDARDS.md) - TypeScript/Angular patterns
- [TESTING_STANDARDS.md](../../../TESTING_STANDARDS.md) - Test structure and mocking
- [COMPONENT_LIBRARY_CRT.md](../../../COMPONENT_LIBRARY_CRT.md) - CRT component documentation

### Anti-Patterns to Avoid

1. **Don't break CSS fallback mode** - Keep it working for WebGL-unavailable browsers
2. **Don't assume video is always available** - Handle gracefully if no video element
3. **Don't forget cleanup** - Stop render loops, delete textures, handle context loss
4. **Don't use synchronous texture uploads** - Browser handles async internally
5. **Don't ignore cross-origin issues** - They cause silent failures

---

## 📤 Output Requirements

Upon completion, create a report at:
```
docs/projects/CRT-EFFECT-ENHANCEMENT/reports/CRT-EFFECT-ENHANCEMENT-TASK-04-002A-REPORT.md
```

Include:
1. Summary of changes made
2. Files modified with key changes
3. Test results
4. Before/after comparison (describe visual improvement)
5. Any technical decisions made
6. Recommendations for dependent tasks (04-003, 04-004, 04-005)

---

## ✅ Definition of Done

- [ ] Video texture pipeline implemented in `CrtRenderer`
- [ ] Fragment shader samples video and applies multiplicative effects
- [ ] Render loop syncs canvas with video playback
- [ ] All existing UI controls work unchanged
- [ ] All unit tests pass (new + updated)
- [ ] CSS fallback mode verified working
- [ ] Visual quality noticeably improved
- [ ] No console errors or warnings
- [ ] Report created with findings

---

**Ready for execution.** 🚀
