# Phase 2: WebGL Renderer Implementation

## 🎯 Objective

Create a WebGL-based scanline renderer that eliminates banding completely by rendering at device pixel ratio, enabling future advanced CRT effects.

> **✅ GATE PASSED**: Phase 1 CSS approach confirmed ineffective. WebGL is required to solve the Moiré banding issue.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Project Documentation:**

- [ ] [CRT-EFFECT-ENHANCEMENT-MASTER-PLAN.md](../CRT-EFFECT-ENHANCEMENT-MASTER-PLAN.md) - Project overview
- [ ] [Phase 1 Report](../reports/CRT-EFFECT-ENHANCEMENT-TASK-01-001-REPORT.md) - Why CSS failed
- [ ] [COMPONENT_LIBRARY_CRT.md](../../../COMPONENT_LIBRARY_CRT.md) - CRT component documentation

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript patterns
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - CSS/SCSS conventions

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/crt-effect-wrapper/
├── crt-effect-wrapper.component.ts       📝 Modified - Add WebGL integration
├── crt-effect-wrapper.component.html     📝 Modified - Add canvas element
├── crt-effect-wrapper.component.scss     📝 Modified - Add WebGL mode styles
├── crt-effect-wrapper.component.spec.ts  📝 Modified - Add WebGL integration tests
├── crt-settings.interface.ts             📝 Modified - Add renderMode type
├── crt-settings.defaults.ts              📝 Modified - Add renderMode defaults
└── webgl/
    ├── crt-renderer.ts                   ✨ New - WebGL lifecycle class
    ├── crt-renderer.spec.ts              ✨ New - WebGL unit tests
    ├── webgl-context.mock.ts             ✨ New - WebGL mock for testing
    └── shaders/
        ├── scanline.frag.ts              ✨ New - Fragment shader (inline GLSL)
        └── passthrough.vert.ts           ✨ New - Vertex shader (inline GLSL)

libs/domain/src/lib/models/
└── crt-settings.model.ts                 📝 Modified - Add renderMode property
```

---

## 🏗️ Architecture Overview

### Design Decisions

1. **Single Component Strategy**: Keep `CrtEffectWrapperComponent` as the only component. CSS and WebGL modes toggle via CSS classes, not conditional rendering (due to `ng-content` limitations).

2. **Abstracted WebGL**: All WebGL complexity lives in `CrtRenderer` class. Component just calls `init()`, `updateSettings()`, `render()`, `destroy()`.

3. **Canvas Overlay**: Canvas element always in DOM, visibility controlled by CSS. Avoids expensive WebGL re-initialization on mode toggle.

4. **Render Mode**: Add `renderMode: 'css' | 'webgl' | 'auto'` to settings. Default to `'auto'` which prefers WebGL when available.

### Data Flow

```
CrtSettings.renderMode
        │
        ▼
┌─────────────────────────────────┐
│  CrtEffectWrapperComponent      │
│  ─────────────────────────────  │
│  - Detects WebGL availability   │
│  - Sets CSS class for mode      │
│  - Manages CrtRenderer lifecycle│
└─────────────────────────────────┘
        │
        ├──── mode-css ────► CSS ::before scanlines (existing)
        │
        └──── mode-webgl ──► CrtRenderer
                                  │
                                  ▼
                            ┌─────────────┐
                            │ WebGL Canvas │
                            │ + Shaders    │
                            └─────────────┘
```

---

## 📋 Implementation Tasks

### Task 02-001: WebGL Renderer Infrastructure (Foundation)

**Purpose**: Create the `CrtRenderer` class that encapsulates all WebGL boilerplate.

**Deliverables**:
- `webgl/crt-renderer.ts` - WebGL lifecycle class
- `webgl/shaders/passthrough.vert.ts` - Vertex shader
- `webgl/shaders/scanline.frag.ts` - Fragment shader
- `webgl/crt-renderer.spec.ts` - Unit tests with mocked WebGL

**Key Implementation**:
- Canvas/context creation and cleanup
- Shader compilation and program linking
- Uniform locations for settings
- Resize handling at device pixel ratio
- Context loss/restore event handling
- Render loop with requestAnimationFrame

---

### Task 02-002: Domain Model & Settings Update

**Purpose**: Add `renderMode` property to enable mode switching.

**Deliverables**:
- Updated `crt-settings.model.ts` with `renderMode` property
- Updated `crt-settings.interface.ts` with type re-export
- Updated `crt-settings.defaults.ts` with default value

**Key Implementation**:
- Add `renderMode: 'css' | 'webgl' | 'auto'` to `CrtSettings`
- Default to `'auto'` (prefer WebGL when available)
- Document the property in JSDoc

---

### Task 02-003: Component Integration

**Purpose**: Integrate WebGL renderer into the existing component.

**Deliverables**:
- Updated `crt-effect-wrapper.component.ts` with WebGL integration
- Updated `crt-effect-wrapper.component.html` with canvas element
- Updated `crt-effect-wrapper.component.scss` with mode-switching styles
- Updated `crt-effect-wrapper.component.spec.ts` with integration tests

**Key Implementation**:
- WebGL availability detection
- CrtRenderer lifecycle management (init on render, destroy on cleanup)
- Settings binding to shader uniforms via effect()
- Canvas positioning and sizing
- CSS class toggling for mode visibility
- Fallback logic when WebGL unavailable

---

## 🔗 Task Dependencies

```
Task 02-001 (WebGL Renderer) ─────────────────┐
                                               │
Task 02-002 (Domain Model) ───────────────────┼──► Task 02-003 (Component Integration)
                                               │
                                     (parallel)
```

**Execution Order**:
1. Tasks 02-001 and 02-002 can run in **parallel** (no dependencies)
2. Task 02-003 requires both 02-001 and 02-002 complete

---

## ✅ Success Criteria

**Functional Requirements:**

- [ ] Zero banding at any browser zoom level with WebGL mode
- [ ] Canvas properly positioned over content
- [ ] Canvas resizes correctly with container
- [ ] All CrtSettings properties bound to shader uniforms
- [ ] Scanline intensity, size, vignette, curvature all work in WebGL
- [ ] Context loss triggers re-initialization
- [ ] Graceful CSS fallback when WebGL unavailable
- [ ] Mode can be switched at runtime

**Testing Requirements:**

- [ ] CrtRenderer unit tests pass with mocked WebGL context
- [ ] Component integration tests verify mode switching
- [ ] All existing CSS-mode tests still pass
- [ ] Manual verification at 100%, 125%, 150% zoom

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes
- [ ] No console errors during operation
- [ ] No memory leaks (proper cleanup on destroy)

---

## 📝 Technical Specifications

### WebGL Shader Details

**Vertex Shader** (`passthrough.vert.ts`):
```glsl
attribute vec2 a_position;
varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = (a_position + 1.0) / 2.0;
}
```

**Fragment Shader** (`scanline.frag.ts`):
```glsl
precision mediump float;

uniform float u_scanlineIntensity;
uniform float u_scanlineSize;
uniform float u_vignetteStrength;
uniform vec2 u_resolution;

varying vec2 v_texCoord;

void main() {
  // Scanline calculation with smoothstep anti-aliasing
  float y = gl_FragCoord.y;
  float lineHeight = u_scanlineSize * 2.0;
  float line = mod(y, lineHeight);
  
  // Smoothstep for anti-aliased edges
  float scanline = smoothstep(0.0, 1.0, line / u_scanlineSize) * 
                   smoothstep(u_scanlineSize * 2.0, u_scanlineSize, line);
  
  float alpha = u_scanlineIntensity * (1.0 - scanline);
  
  // Vignette (optional - can be CSS or shader)
  // ... vignette calculation ...
  
  gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
}
```

### CrtRenderer API

```typescript
export class CrtRenderer {
  constructor();
  
  /** Initialize WebGL context and compile shaders */
  init(canvas: HTMLCanvasElement): boolean;
  
  /** Update shader uniforms from settings */
  updateSettings(settings: CrtSettings): void;
  
  /** Render a single frame */
  render(): void;
  
  /** Handle canvas resize */
  resize(width: number, height: number): void;
  
  /** Clean up WebGL resources */
  destroy(): void;
  
  /** Check if WebGL is available */
  static isSupported(): boolean;
}
```

---

## 📝 Notes & Considerations

### Performance

- Use `requestAnimationFrame` for render loop, but only when visible
- Consider pausing render when tab is hidden (Page Visibility API)
- Canvas should use `{ alpha: true, premultipliedAlpha: false }` for proper blending

### Browser Quirks

- Safari: May need `webgl` instead of `webgl2` for broader support
- Mobile: Monitor for context loss events more aggressively
- iOS: Check for half-float texture support if needed later

### Future Extensibility

The shader architecture should allow easy addition of:
- Phosphor pattern (Phase 4)
- Bloom effect (Phase 4)
- Barrel distortion (Phase 4)

Keep uniform binding flexible to accommodate new parameters.

---

## 📊 Effort Estimation

| Task | Effort | Files | Complexity | Status |
|------|--------|-------|------------|--------|
| 02-001 WebGL Renderer | 2-3 hours | 5 new | High | ✅ Complete |
| 02-002 Domain Model | 30 min | 3 modified | Low | ✅ Complete |
| 02-003 Component Integration | 1-2 hours | 4 modified | Medium | ✅ Complete |
| 02-003A Shader Quality Polish | 1-2 hours | 2-3 modified | Medium | 🔄 In Progress |

**Total Estimated Effort**: 5-8 hours

---

## 🔗 Task Files

- [CRT-EFFECT-ENHANCEMENT-TASK-02-001-WEBGL-RENDERER.md](../tasks/CRT-EFFECT-ENHANCEMENT-TASK-02-001-WEBGL-RENDERER.md) ✅
- [CRT-EFFECT-ENHANCEMENT-TASK-02-002-DOMAIN-MODEL.md](../tasks/CRT-EFFECT-ENHANCEMENT-TASK-02-002-DOMAIN-MODEL.md) ✅
- [CRT-EFFECT-ENHANCEMENT-TASK-02-003-COMPONENT-INTEGRATION.md](../tasks/CRT-EFFECT-ENHANCEMENT-TASK-02-003-COMPONENT-INTEGRATION.md) ✅
- [CRT-EFFECT-ENHANCEMENT-TASK-02-003A-SHADER-QUALITY-POLISH.md](../tasks/CRT-EFFECT-ENHANCEMENT-TASK-02-003A-SHADER-QUALITY-POLISH.md) 🔄 (follow-up)
