# Task Handoff: Component Integration

## 📋 Task Identity

**Task ID**: CRT-EFFECT-ENHANCEMENT-TASK-02-003-COMPONENT-INTEGRATION  
**Task Name**: Integrate WebGL Renderer into CRT Effect Wrapper Component  
**Phase**: 02 - WebGL Renderer Implementation  
**Priority**: High  
**Estimated Effort**: 1-2 hours  
**Estimated Context Size**: Medium (4 files modified)

---

## 🎯 Objective

**What**: Integrate the `CrtRenderer` class into `CrtEffectWrapperComponent`, adding the WebGL canvas overlay, mode switching logic, and fallback behavior.

**Why**: This connects the WebGL infrastructure (Task 02-001) with the domain model (Task 02-002) to deliver the anti-aliased scanline rendering to users.

**Success Criteria**:
- [ ] Canvas element added to template (always present, visibility toggled)
- [ ] WebGL mode renders scanlines without banding at any zoom
- [ ] CSS mode continues to work as before
- [ ] Mode switching works at runtime via settings
- [ ] 'auto' mode correctly detects and uses WebGL when available
- [ ] Fallback to CSS when WebGL unavailable
- [ ] Canvas resizes correctly with container
- [ ] All existing tests pass
- [ ] New integration tests for mode switching

---

## 📦 Context & Dependencies

**Prerequisites Completed**:
- Task 02-001: WebGL Renderer Infrastructure (CrtRenderer class exists)
- Task 02-002: Domain Model Update (renderMode property exists)

**Dependencies**:
- `CrtRenderer` class from `./webgl/crt-renderer`
- `CrtRenderMode` type from domain model

**Constraints**:
- Cannot use conditional rendering for `ng-content` (must use CSS visibility)
- Canvas must be positioned as overlay, not affecting content layout
- Must handle resize via existing ResizeObserver
- Must clean up WebGL resources on component destroy

---

## 📁 File Scope

**Files to Modify**:

1. `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts`
   - Import and instantiate CrtRenderer
   - Add WebGL initialization logic in afterNextRender
   - Add effect() to sync settings to renderer
   - Add computed for active render mode
   - Update destroy logic for cleanup

2. `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.html`
   - Add canvas element with template ref
   - Add CSS class bindings for mode

3. `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss`
   - Add `.mode-css` and `.mode-webgl` classes
   - Style canvas as overlay
   - Hide/show appropriate effects based on mode

4. `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.spec.ts`
   - Add tests for mode switching
   - Add tests for WebGL fallback
   - Mock CrtRenderer for unit tests

---

## 🔧 Implementation Guidance

### 1. Component TypeScript Updates

```typescript
import { CrtRenderer } from './webgl/crt-renderer';

@Component({
  // ... existing config
})
export class CrtEffectWrapperComponent {
  // ... existing code ...

  // New: Canvas reference for WebGL
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('glCanvas');
  
  // New: WebGL renderer instance
  private renderer: CrtRenderer | null = null;
  
  // New: Track if WebGL is available
  private readonly webglSupported = signal<boolean>(false);

  /**
   * Computed: Determine which render mode is actually active.
   * Resolves 'auto' to 'webgl' or 'css' based on browser support.
   */
  protected readonly activeRenderMode = computed(() => {
    const requested = this.settings().renderMode;
    
    if (requested === 'css') return 'css';
    if (requested === 'webgl') return this.webglSupported() ? 'webgl' : 'css';
    // 'auto' - prefer WebGL when available
    return this.webglSupported() ? 'webgl' : 'css';
  });

  /**
   * Computed: CSS class for current render mode.
   */
  protected readonly renderModeClass = computed(() => {
    return `mode-${this.activeRenderMode()}`;
  });

  constructor() {
    // Check WebGL support once
    this.webglSupported.set(CrtRenderer.isSupported());

    afterNextRender(() => {
      this.setupResizeObserver();
      this.initializeWebGL();
    });

    // Sync settings to WebGL renderer when they change
    effect(() => {
      const settings = this.settings();
      const mode = this.activeRenderMode();
      
      if (mode === 'webgl' && this.renderer) {
        this.renderer.updateSettings(settings);
        this.renderer.render();
      }
    });

    this.destroyRef.onDestroy(() => {
      this.resizeObserver?.disconnect();
      this.renderer?.destroy();
    });
  }

  /**
   * Initialize WebGL renderer if supported and in WebGL mode.
   */
  private initializeWebGL(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !this.webglSupported()) return;

    this.renderer = new CrtRenderer();
    const success = this.renderer.init(canvas);
    
    if (!success) {
      this.webglSupported.set(false);
      this.renderer = null;
      return;
    }

    // Initial settings and size
    this.renderer.updateSettings(this.settings());
    this.handleResize();
  }

  /**
   * Handle resize - update both container dimensions and WebGL canvas.
   */
  private handleResize(): void {
    const wrapper = this.wrapperRef()?.nativeElement;
    if (!wrapper) return;

    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    this.containerWidth.set(width);
    this.containerHeight.set(height);

    // Update WebGL canvas size
    if (this.renderer && this.activeRenderMode() === 'webgl') {
      this.renderer.resize(width, height);
      this.renderer.render();
    }
  }

  // Update setupResizeObserver to call handleResize
  private setupResizeObserver(): void {
    const wrapper = this.wrapperRef()?.nativeElement;
    if (!wrapper) return;

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });

    this.resizeObserver.observe(wrapper);
    this.handleResize(); // Initial measurement
  }
}
```

### 2. Template Updates (`component.html`)

```html
<div
  #wrapper
  class="crt-wrapper"
  [class]="renderModeClass()"
  [class.crt-enabled]="enabled()"
  [style.--scanline-intensity]="effectiveSettings().scanlineIntensity"
  [style.--scanline-size.px]="effectiveSettings().scanlineSize"
  [style.--vignette-strength]="effectiveSettings().vignetteStrength"
  [style.--screen-curvature.px]="effectiveSettings().screenCurvature"
  [style.--crt-contrast]="effectiveSettings().contrast"
  [style.--crt-brightness]="effectiveSettings().brightness"
  [style.--crt-saturation]="effectiveSettings().saturation"
  [style.--crt-hue.deg]="effectiveSettings().hue"
  [style.clip-path]="clipPath()"
>
  <div class="crt-content">
    <ng-content></ng-content>
  </div>
  
  <!-- WebGL Canvas Overlay -->
  <canvas #glCanvas class="webgl-canvas"></canvas>
</div>
```

### 3. SCSS Updates (`component.scss`)

```scss
.crt-wrapper {
  // ... existing styles ...

  // WebGL canvas overlay
  .webgl-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2;
    border-radius: var(--screen-curvature, 0px);
    
    // Hidden by default
    display: none;
  }

  // === CSS MODE ===
  &.mode-css {
    // CSS scanlines visible (existing ::before behavior)
    &.crt-enabled::before {
      opacity: 1;
    }
    
    // WebGL canvas hidden
    .webgl-canvas {
      display: none;
    }
  }

  // === WEBGL MODE ===
  &.mode-webgl {
    // CSS scanlines hidden
    &.crt-enabled::before {
      opacity: 0;
      display: none;
    }
    
    // WebGL canvas visible
    .webgl-canvas {
      display: block;
    }
  }

  // ... rest of existing styles ...
}
```

### 4. Key Integration Points

**Settings Synchronization**:
- Use `effect()` to watch settings changes
- Only update WebGL renderer when in WebGL mode
- Trigger re-render after settings update

**Resize Handling**:
- Existing ResizeObserver triggers `handleResize()`
- Update both container dimensions AND WebGL canvas
- Re-render after resize

**Cleanup**:
- Call `renderer.destroy()` in destroyRef callback
- Handles WebGL resource cleanup

---

## 🧪 Testing Requirements

**Test Coverage Required**:

1. **Mode Detection**
   - Test `activeRenderMode` resolves 'auto' to 'webgl' when supported
   - Test `activeRenderMode` resolves 'auto' to 'css' when not supported
   - Test explicit 'css' mode always returns 'css'
   - Test explicit 'webgl' mode falls back to 'css' when not supported

2. **CSS Class Application**
   - Test `mode-css` class applied in CSS mode
   - Test `mode-webgl` class applied in WebGL mode

3. **Canvas Presence**
   - Test canvas element exists in DOM
   - Test canvas has correct class

4. **Fallback Behavior**
   - Test graceful fallback when WebGL init fails

5. **Existing Tests**
   - All existing CSS-based tests must still pass
   - May need to mock CrtRenderer.isSupported()

**Mock Strategy**:
```typescript
// In test setup
vi.mock('./webgl/crt-renderer', () => ({
  CrtRenderer: {
    isSupported: vi.fn(() => true), // or false for fallback tests
  },
}));
```

**Test Execution**:
```bash
pnpm nx test ui-components --testFile=crt-effect-wrapper
```

---

## 📚 Reference Materials

**Related Documentation**:
- [Phase 2 Plan](../phases/CRT-EFFECT-ENHANCEMENT-PHASE-02-WEBGL-RENDERER.md)
- [Task 02-001 Report](../reports/CRT-EFFECT-ENHANCEMENT-TASK-02-001-REPORT.md)
- [Task 02-002 Report](../reports/CRT-EFFECT-ENHANCEMENT-TASK-02-002-REPORT.md)

**Existing Code**:
- Current component implementation
- ResizeObserver pattern already in use
- CSS custom property bindings

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/CRT-EFFECT-ENHANCEMENT/reports/CRT-EFFECT-ENHANCEMENT-TASK-02-003-REPORT.md`

---

## ✅ Completion Checklist

Before marking complete:

- [ ] Canvas element added to template
- [ ] CrtRenderer imported and instantiated
- [ ] `activeRenderMode` computed signal works correctly
- [ ] Mode CSS classes applied (`mode-css`, `mode-webgl`)
- [ ] Settings synced to renderer via effect()
- [ ] Resize updates WebGL canvas
- [ ] Cleanup destroys renderer
- [ ] All existing tests pass
- [ ] New mode switching tests pass
- [ ] Manual verification: WebGL mode shows no banding at 125% zoom
- [ ] Manual verification: CSS mode still works
- [ ] Report saved to specified location

---

## 💡 Hints for Success

1. **Test early**: After adding the canvas, verify it appears in the DOM before wiring up WebGL.

2. **Mock for tests**: Mock `CrtRenderer.isSupported()` in tests to control mode detection.

3. **Check z-index**: Canvas must be above content but below any interactive elements.

4. **Verify clip-path**: The clip-path for aspect ratio handling should still work with WebGL canvas.

5. **Render on demand**: Only call `render()` when settings change or resize occurs, not continuously.

6. **Keep CSS fallback working**: Don't break the CSS mode - it's the fallback for ~3% of users.

---

## 🔄 Post-Task Verification

After completing this task, perform manual verification:

1. **Open the application** in a browser
2. **Set browser zoom to 125%**
3. **Enable CRT effects** with WebGL mode
4. **Verify**: Scanlines appear uniform with no banding
5. **Switch to CSS mode**: Verify CSS effects still work (banding expected)
6. **Resize the window**: Verify canvas resizes correctly
7. **Check console**: No WebGL errors

This manual verification confirms the Moiré banding issue is resolved.
