# Task Handoff: WebGL Renderer Infrastructure

## 📋 Task Identity

**Task ID**: CRT-EFFECT-ENHANCEMENT-TASK-02-001-WEBGL-RENDERER  
**Task Name**: Create WebGL Renderer Infrastructure  
**Phase**: 02 - WebGL Renderer Implementation  
**Priority**: High  
**Estimated Effort**: 2-3 hours  
**Estimated Context Size**: Medium (5 new files)

---

## 🎯 Objective

**What**: Create the `CrtRenderer` class that encapsulates all WebGL boilerplate for rendering anti-aliased scanlines. This is a standalone, testable class with no Angular dependencies.

**Why**: WebGL renders at device pixel ratio and uses mathematical anti-aliasing (`smoothstep`), completely eliminating the Moiré banding that CSS gradients suffer from at non-100% zoom levels.

**Success Criteria**:
- [x] `CrtRenderer` class created with full lifecycle management
- [x] Vertex and fragment shaders compile successfully
- [x] Uniforms for all CrtSettings properties are bound
- [x] Canvas resizes correctly at device pixel ratio
- [x] Context loss/restore events are handled
- [x] Unit tests pass with mocked WebGL context (40/40 tests)
- [x] Static `isSupported()` method works correctly

**Status**: ✅ **COMPLETED** - 2025-01-24  
**Report**: [CRT-EFFECT-ENHANCEMENT-TASK-02-001-REPORT.md](../reports/CRT-EFFECT-ENHANCEMENT-TASK-02-001-REPORT.md)

---

## 📦 Context & Dependencies

**Prerequisites Completed**:
- Phase 1 completed (CSS approach confirmed ineffective)

**Dependencies**:
- None - this task creates standalone infrastructure

**Constraints**:
- No Angular dependencies in the WebGL code (pure TypeScript)
- Must work with WebGL 1.0 for maximum browser compatibility
- Must handle context loss gracefully (mobile browsers)
- Shader code as inline TypeScript strings (not external files)

---

## 📁 File Scope

**Files to Create**:

1. `libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/passthrough.vert.ts`
   - Vertex shader source as exported string constant
   - Simple passthrough that outputs position and tex coords

2. `libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts`
   - Fragment shader source as exported string constant
   - Scanline rendering with smoothstep anti-aliasing
   - Uniforms for intensity, size, vignette, resolution

3. `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts`
   - Main WebGL lifecycle class
   - Methods: `init()`, `updateSettings()`, `render()`, `resize()`, `destroy()`
   - Static `isSupported()` method

4. `libs/ui/components/src/lib/crt-effect-wrapper/webgl/webgl-context.mock.ts`
   - Mock WebGL context for unit testing
   - Stubs for getContext, bindBuffer, bindShader, etc.

5. `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.spec.ts`
   - Unit tests for CrtRenderer
   - Uses mocked WebGL context

---

## 🔧 Implementation Guidance

### 1. Vertex Shader (`passthrough.vert.ts`)

```typescript
/**
 * Passthrough vertex shader for fullscreen quad rendering.
 * Transforms clip-space positions and generates UV coordinates.
 */
export const PASSTHROUGH_VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_texCoord;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    // Convert from clip space (-1 to 1) to texture space (0 to 1)
    v_texCoord = (a_position + 1.0) / 2.0;
  }
`;
```

### 2. Fragment Shader (`scanline.frag.ts`)

```typescript
/**
 * Scanline fragment shader with anti-aliased rendering.
 * Uses smoothstep for sub-pixel accurate scanline edges.
 */
export const SCANLINE_FRAGMENT_SHADER = `
  precision mediump float;

  // CRT Settings uniforms
  uniform float u_scanlineIntensity;  // 0.0 - 1.0
  uniform float u_scanlineSize;       // pixels (1.0 - 6.0)
  uniform float u_vignetteStrength;   // 0.0 - 2.0
  uniform vec2 u_resolution;          // canvas width/height in pixels

  varying vec2 v_texCoord;

  void main() {
    // === SCANLINES ===
    // Calculate scanline pattern based on pixel Y position
    float y = gl_FragCoord.y;
    float lineHeight = u_scanlineSize * 2.0;  // full cycle = dark + light
    float linePos = mod(y, lineHeight);
    
    // Smoothstep creates anti-aliased transitions
    // Creates a smooth wave pattern: 0 -> 1 -> 0 over lineHeight
    float scanline = smoothstep(0.0, u_scanlineSize * 0.5, linePos) * 
                     smoothstep(lineHeight, lineHeight - u_scanlineSize * 0.5, linePos);
    
    // Invert: scanline=1 means transparent, scanline=0 means dark
    float scanlineAlpha = u_scanlineIntensity * (1.0 - scanline);

    // === VIGNETTE ===
    // Calculate distance from center (0 at center, ~1 at corners)
    vec2 uv = v_texCoord;
    vec2 center = uv - 0.5;
    float vignette = dot(center, center) * u_vignetteStrength;
    vignette = clamp(vignette, 0.0, 1.0);

    // Combine effects
    float alpha = max(scanlineAlpha, vignette * 0.5);
    
    gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
  }
`;
```

### 3. CrtRenderer Class Structure

```typescript
import { CrtSettings } from '../crt-settings.interface';
import { PASSTHROUGH_VERTEX_SHADER } from './shaders/passthrough.vert';
import { SCANLINE_FRAGMENT_SHADER } from './shaders/scanline.frag';

/**
 * WebGL-based CRT effect renderer.
 * Renders scanlines and vignette with proper anti-aliasing at device pixel ratio.
 */
export class CrtRenderer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private canvas: HTMLCanvasElement | null = null;
  
  // Uniform locations
  private uniforms: {
    scanlineIntensity: WebGLUniformLocation | null;
    scanlineSize: WebGLUniformLocation | null;
    vignetteStrength: WebGLUniformLocation | null;
    resolution: WebGLUniformLocation | null;
  } = {
    scanlineIntensity: null,
    scanlineSize: null,
    vignetteStrength: null,
    resolution: null,
  };

  // Context loss handling
  private contextLostHandler: ((e: Event) => void) | null = null;
  private contextRestoredHandler: ((e: Event) => void) | null = null;
  private pendingSettings: CrtSettings | null = null;

  /**
   * Check if WebGL is available in this browser.
   */
  static isSupported(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return gl !== null;
    } catch {
      return false;
    }
  }

  /**
   * Initialize WebGL context and compile shaders.
   * @returns true if initialization succeeded, false otherwise
   */
  init(canvas: HTMLCanvasElement): boolean {
    // Implementation: create context, compile shaders, set up buffers
  }

  /**
   * Update shader uniforms from CRT settings.
   */
  updateSettings(settings: CrtSettings): void {
    // Implementation: bind uniforms
  }

  /**
   * Render a single frame.
   */
  render(): void {
    // Implementation: clear and draw fullscreen quad
  }

  /**
   * Handle canvas resize. Call when container size changes.
   */
  resize(width: number, height: number): void {
    // Implementation: update canvas size at device pixel ratio
  }

  /**
   * Clean up all WebGL resources.
   */
  destroy(): void {
    // Implementation: delete program, buffers, remove event listeners
  }

  // Private methods for shader compilation, buffer setup, etc.
}
```

### 4. Key Implementation Details

**Device Pixel Ratio Handling**:
```typescript
resize(width: number, height: number): void {
  if (!this.canvas || !this.gl) return;
  
  const dpr = window.devicePixelRatio || 1;
  this.canvas.width = width * dpr;
  this.canvas.height = height * dpr;
  this.canvas.style.width = `${width}px`;
  this.canvas.style.height = `${height}px`;
  
  this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  
  // Update resolution uniform
  if (this.uniforms.resolution) {
    this.gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
  }
}
```

**Context Loss Handling**:
```typescript
private setupContextLossHandling(): void {
  this.contextLostHandler = (e: Event) => {
    e.preventDefault();
    // Mark as lost, render() should check this
  };
  
  this.contextRestoredHandler = () => {
    // Re-initialize everything
    if (this.canvas) {
      this.init(this.canvas);
      if (this.pendingSettings) {
        this.updateSettings(this.pendingSettings);
      }
    }
  };
  
  this.canvas?.addEventListener('webglcontextlost', this.contextLostHandler);
  this.canvas?.addEventListener('webglcontextrestored', this.contextRestoredHandler);
}
```

**Fullscreen Quad Buffer**:
```typescript
private setupBuffers(): void {
  // Fullscreen quad vertices (two triangles)
  const vertices = new Float32Array([
    -1, -1,  // bottom-left
     1, -1,  // bottom-right
    -1,  1,  // top-left
     1,  1,  // top-right
  ]);
  
  const buffer = this.gl.createBuffer();
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
  this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
  
  const positionLocation = this.gl.getAttribLocation(this.program!, 'a_position');
  this.gl.enableVertexAttribArray(positionLocation);
  this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
}
```

---

## 🧪 Testing Requirements

**Test Coverage Required**:

1. **Static Support Check**
   - Test `CrtRenderer.isSupported()` returns boolean

2. **Initialization**
   - Test `init()` returns true with valid canvas
   - Test `init()` returns false when WebGL unavailable (mock)
   - Test shaders compile without errors

3. **Settings Update**
   - Test `updateSettings()` binds uniforms correctly
   - Test all CrtSettings properties are mapped

4. **Resize**
   - Test `resize()` updates canvas dimensions
   - Test device pixel ratio is applied

5. **Cleanup**
   - Test `destroy()` removes event listeners
   - Test WebGL resources are released

**Mock Strategy**:
```typescript
// webgl-context.mock.ts
export function createMockWebGLContext(): WebGLRenderingContext {
  return {
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    useProgram: vi.fn(),
    getUniformLocation: vi.fn(() => ({})),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    // ... other stubs
  } as unknown as WebGLRenderingContext;
}
```

**Test Execution**:
```bash
pnpm nx test ui-components --testFile=crt-renderer
```

---

## 📚 Reference Materials

**Related Documentation**:
- [Phase 2 Plan](../phases/CRT-EFFECT-ENHANCEMENT-PHASE-02-WEBGL-RENDERER.md)
- [Master Plan](../CRT-EFFECT-ENHANCEMENT-MASTER-PLAN.md)

**External References**:
- [WebGL Fundamentals](https://webglfundamentals.org/)
- [MDN WebGL API](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
- [GLSL smoothstep](https://thebookofshaders.com/glossary/?search=smoothstep)

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/CRT-EFFECT-ENHANCEMENT/reports/CRT-EFFECT-ENHANCEMENT-TASK-02-001-REPORT.md`

---

## ✅ Completion Checklist

Before marking complete:

- [ ] All 5 files created in `webgl/` folder
- [ ] Shaders compile without errors (verified in tests)
- [ ] All CrtRenderer methods implemented
- [ ] Context loss handling implemented
- [ ] Unit tests pass with mocked WebGL
- [ ] No TypeScript errors
- [ ] Code follows project conventions
- [ ] Report saved to specified location

---

## 💡 Hints for Success

1. **Start with shaders**: Create the shader files first, they're the simplest and define the uniforms you need.

2. **Test shader compilation**: Write a test that actually compiles the shaders (even with mocked context, verify syntax).

3. **Use WebGL 1.0**: Stick to `webgl` context (not `webgl2`) for maximum compatibility.

4. **Canvas attributes**: Use `{ alpha: true, premultipliedAlpha: false, antialias: false }` for proper transparency blending.

5. **Keep it stateless**: The renderer should work purely based on the settings passed to `updateSettings()`, no Angular signals or state.

6. **Export cleanly**: Create a barrel export (`webgl/index.ts`) for clean imports.
