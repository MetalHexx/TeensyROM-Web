# Task Handoff: Debug Visualization Overlay

## 📋 Task Identity

**Task ID**: AUTO-CROP-BLACKBARS-TASK-01.1-004-DEBUG-OVERLAY  
**Task Name**: Implement Debug Visualization Overlay for Detection Process  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: Medium  
**Estimated Context Size**: Medium (6-8 files)

---

## 🎯 Objective

**What**: Add an optional debug overlay that visualizes the GPU detection process in real-time, showing edge detection results, detected crop regions, bar depths, confidence scores, and detection metrics. Provide settings panel toggle and keyboard shortcut (Ctrl+Shift+D) for quick access during development and testing.

**Why**: GPU-based detection happens entirely on the GPU until final results, making it invisible to developers and users. A debug overlay provides transparency into the detection algorithm, helps tune thresholds, validates accuracy, and enables users to understand why certain crops are applied or not applied.

**Success Criteria**:
- [ ] `showDebugOverlay` setting added to `CrtSettings` model with persistence
- [ ] Debug overlay renders when `showDebugOverlay = true`
- [ ] Edge detection results visualized with colored border lines
- [ ] Crop regions highlighted with semi-transparent overlays
- [ ] Depth measurements displayed as numeric labels at boundaries
- [ ] Detection stats HUD shows depths, confidence, FPS, crop mode
- [ ] Settings panel toggle checkbox controls overlay visibility
- [ ] Keyboard shortcut (Ctrl+Shift+D) toggles overlay quickly
- [ ] Overlay rendering overhead < 1ms (negligible performance impact)
- [ ] Unit tests verify overlay rendering and toggle interaction
- [ ] E2E tests validate visual correctness with screenshots

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- AUTO-CROP-BLACKBARS-TASK-01.1-003-RENDERER-INTEGRATION - Detection pipeline integrated into CrtRenderer
- Phase 1 settings panel infrastructure established

**Dependencies**:
- `CrtSettings` interface with existing settings properties
- `DetectionPassRenderer` and `EdgeAnalysisProcessor` classes
- `CrtSettingsPanelComponent` for UI toggle
- `CrtRenderer` with access to detection results

**Constraints**:
- Overlay rendering budget: < 1ms per frame
- Must not interfere with main CRT effects
- Should be disabled by default (development/debug tool)

---

## 📁 File Scope

**Files to Create**:
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/debug-overlay-renderer.ts` - Overlay rendering class
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/debug-overlay-renderer.spec.ts` - Unit tests

**Files to Modify**:
- `libs/domain/src/lib/models/crt-settings.model.ts` - Add `showDebugOverlay` property
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - Add default value
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts` - Update interface (if separate)
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts` - Integrate overlay rendering
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/index.ts` - Export overlay renderer
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Add toggle, keyboard shortcut
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html` - Add toggle UI
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts` - Test toggle interaction

**Files to Review**:
- `docs/STYLE_GUIDE.md` - Overlay styling patterns
- `docs/COMPONENT_LIBRARY.md` - Settings panel patterns

---

## 🛠️ Implementation Guidance

### Standards to Follow

- [Style Guide](../../../docs/STYLE_GUIDE.md) - Overlay styling and colors
- [Coding Standards](../../../docs/CODING_STANDARDS.md) - TypeScript conventions
- [Testing Standards](../../../docs/TESTING_STANDARDS.md) - Testing approach
- [Component Library](../../../docs/COMPONENT_LIBRARY.md) - Settings panel patterns

### Key Requirements

#### 1. Domain Model Update

Add to `CrtSettings`:

```typescript
// crt-settings.model.ts
export interface CrtSettings {
  // ...existing properties
  autoCropBlackBars: boolean;
  showDebugOverlay: boolean;  // New property
}

// crt-settings.defaults.ts
export const DEFAULT_CRT_SETTINGS: CrtSettings = {
  // ...existing defaults
  autoCropBlackBars: true,
  showDebugOverlay: false,  // Disabled by default
};
```

#### 2. Debug Overlay Renderer Class

Create class that renders overlay elements using WebGL or Canvas2D:

```typescript
interface DebugOverlayData {
  edges: { left: number; top: number; right: number; bottom: number };  // 0-1 edge strength
  depths: { left: number; top: number; right: number; bottom: number }; // Pixel depths
  cropRect: CropRect;
  confidence: number;
  detectionFps: number;
  cropMode: 'Active' | 'Inactive' | 'Animating';
}

class DebugOverlayRenderer {
  private canvas2d: CanvasRenderingContext2D;
  
  constructor(overlayCanvas: HTMLCanvasElement) {
    this.canvas2d = overlayCanvas.getContext('2d')!;
  }
  
  /**
   * Render debug overlay elements on top of CRT output
   */
  render(data: DebugOverlayData, videoWidth: number, videoHeight: number): void {
    const ctx = this.canvas2d;
    
    // Clear previous frame
    ctx.clearRect(0, 0, videoWidth, videoHeight);
    
    // 1. Draw edge detection highlights
    this.drawEdgeHighlights(ctx, data.edges, videoWidth, videoHeight);
    
    // 2. Draw crop region overlay
    this.drawCropRegion(ctx, data.cropRect, videoWidth, videoHeight);
    
    // 3. Draw depth labels
    this.drawDepthLabels(ctx, data.depths, videoWidth, videoHeight);
    
    // 4. Draw stats HUD
    this.drawStatsHUD(ctx, data);
  }
  
  private drawEdgeHighlights(
    ctx: CanvasRenderingContext2D,
    edges: { left: number; top: number; right: number; bottom: number },
    width: number,
    height: number
  ): void {
    const EDGE_THRESHOLD = 0.7;
    const LINE_WIDTH = 3;
    
    // Green for detected edges, red for ignored edges
    ctx.lineWidth = LINE_WIDTH;
    
    // Top edge
    ctx.strokeStyle = edges.top > EDGE_THRESHOLD ? '#00FF00' : '#FF000080';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.stroke();
    
    // Bottom edge
    ctx.strokeStyle = edges.bottom > EDGE_THRESHOLD ? '#00FF00' : '#FF000080';
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.stroke();
    
    // Left edge
    ctx.strokeStyle = edges.left > EDGE_THRESHOLD ? '#00FF00' : '#FF000080';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, height);
    ctx.stroke();
    
    // Right edge
    ctx.strokeStyle = edges.right > EDGE_THRESHOLD ? '#00FF00' : '#FF000080';
    ctx.beginPath();
    ctx.moveTo(width, 0);
    ctx.lineTo(width, height);
    ctx.stroke();
  }
  
  private drawCropRegion(
    ctx: CanvasRenderingContext2D,
    cropRect: CropRect,
    width: number,
    height: number
  ): void {
    const left = cropRect.left * width;
    const top = cropRect.top * height;
    const cropWidth = cropRect.width * width;
    const cropHeight = cropRect.height * height;
    
    // Draw black bar regions (red semi-transparent)
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    
    // Top bar
    if (top > 0) {
      ctx.fillRect(0, 0, width, top);
    }
    
    // Bottom bar
    const bottomY = top + cropHeight;
    if (bottomY < height) {
      ctx.fillRect(0, bottomY, width, height - bottomY);
    }
    
    // Left bar
    if (left > 0) {
      ctx.fillRect(0, 0, left, height);
    }
    
    // Right bar
    const rightX = left + cropWidth;
    if (rightX < width) {
      ctx.fillRect(rightX, 0, width - rightX, height);
    }
    
    // Draw content region border (green)
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, cropWidth, cropHeight);
  }
  
  private drawDepthLabels(
    ctx: CanvasRenderingContext2D,
    depths: { left: number; top: number; right: number; bottom: number },
    width: number,
    height: number
  ): void {
    ctx.font = '14px monospace';
    ctx.fillStyle = '#FFFF00';  // Yellow text
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    
    // Top depth
    if (depths.top > 0) {
      const text = `↓ ${depths.top}px`;
      ctx.strokeText(text, width / 2 - 40, depths.top + 20);
      ctx.fillText(text, width / 2 - 40, depths.top + 20);
    }
    
    // Bottom depth
    if (depths.bottom > 0) {
      const text = `↑ ${depths.bottom}px`;
      ctx.strokeText(text, width / 2 - 40, height - depths.bottom - 10);
      ctx.fillText(text, width / 2 - 40, height - depths.bottom - 10);
    }
    
    // Left depth
    if (depths.left > 0) {
      const text = `→ ${depths.left}px`;
      ctx.strokeText(text, depths.left + 10, height / 2);
      ctx.fillText(text, depths.left + 10, height / 2);
    }
    
    // Right depth
    if (depths.right > 0) {
      const text = `← ${depths.right}px`;
      ctx.strokeText(text, width - depths.right - 80, height / 2);
      ctx.fillText(text, width - depths.right - 80, height / 2);
    }
  }
  
  private drawStatsHUD(ctx: CanvasRenderingContext2D, data: DebugOverlayData): void {
    const x = 10;
    let y = 20;
    const lineHeight = 18;
    
    ctx.font = '14px monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    
    const stats = [
      `Auto-Crop Debug Overlay`,
      `─────────────────────────`,
      `Top:    ${data.depths.top}px`,
      `Bottom: ${data.depths.bottom}px`,
      `Left:   ${data.depths.left}px`,
      `Right:  ${data.depths.right}px`,
      `Confidence: ${(data.confidence * 100).toFixed(0)}%`,
      `Mode: ${data.cropMode}`,
      `Detection: ${data.detectionFps.toFixed(1)} FPS`
    ];
    
    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x - 5, y - 15, 250, stats.length * lineHeight + 10);
    
    // Draw text
    ctx.fillStyle = '#FFFFFF';
    stats.forEach(line => {
      ctx.strokeText(line, x, y);
      ctx.fillText(line, x, y);
      y += lineHeight;
    });
  }
}
```

#### 3. CrtRenderer Integration

Modify `CrtRenderer` to collect debug data and render overlay:

```typescript
class CrtRenderer {
  private debugOverlayRenderer?: DebugOverlayRenderer;
  private debugCanvas?: HTMLCanvasElement;
  
  enableDebugOverlay(overlayCanvas: HTMLCanvasElement): void {
    this.debugCanvas = overlayCanvas;
    this.debugOverlayRenderer = new DebugOverlayRenderer(overlayCanvas);
  }
  
  disableDebugOverlay(): void {
    this.debugOverlayRenderer = undefined;
    if (this.debugCanvas) {
      const ctx = this.debugCanvas.getContext('2d')!;
      ctx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
    }
  }
  
  render(videoElement: HTMLVideoElement, settings: CrtSettings): void {
    // ...existing detection and rendering code
    
    // Render debug overlay if enabled
    if (settings.showDebugOverlay && this.debugOverlayRenderer) {
      const debugData: DebugOverlayData = {
        edges: this.getEdgeStrengths(),  // From edge analysis processor
        depths: this.getCurrentDepths(), // From edge analysis processor
        cropRect: this.cropAnimator.getCurrentCrop(),
        confidence: this.getConfidenceScore(),
        detectionFps: 1000 / this.DETECTION_INTERVAL_MS,
        cropMode: this.getCropMode()
      };
      
      this.debugOverlayRenderer.render(
        debugData,
        videoElement.videoWidth,
        videoElement.videoHeight
      );
    }
  }
  
  private getCropMode(): 'Active' | 'Inactive' | 'Animating' {
    if (!this.settings.autoCropBlackBars) return 'Inactive';
    return this.cropAnimator.isAnimating() ? 'Animating' : 'Active';
  }
}
```

#### 4. Settings Panel Integration

Add toggle and keyboard shortcut:

```typescript
// crt-settings-panel.component.ts
@Component({
  selector: 'lib-crt-settings-panel',
  // ...
})
export class CrtSettingsPanelComponent {
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    // Ctrl+Shift+D to toggle debug overlay
    if (event.ctrlKey && event.shiftKey && event.key === 'D') {
      event.preventDefault();
      const current = this.settings();
      this.settingsChange.emit({
        ...current,
        showDebugOverlay: !current.showDebugOverlay
      });
    }
  }
}
```

```html
<!-- crt-settings-panel.component.html -->
<!-- Add in appropriate section, likely near auto-crop toggle -->
<div class="slider-row">
  <mat-slide-toggle
    [(ngModel)]="settings().showDebugOverlay"
    (ngModelChange)="onToggleChange($event)"
    matTooltip="Show debug visualization of black bar detection (Ctrl+Shift+D)">
    Show Debug Overlay
  </mat-slide-toggle>
</div>
```

#### 5. Testing Requirements

**Unit Tests**:

- **Domain Model**: Verify `showDebugOverlay` property exists and defaults to `false`
- **Overlay Renderer**: Verify Canvas2D drawing methods called correctly
- **Toggle Interaction**: Verify checkbox updates setting
- **Keyboard Shortcut**: Verify Ctrl+Shift+D toggles setting
- **Conditional Rendering**: Verify overlay only renders when `showDebugOverlay = true`

**E2E Tests** (Cypress):

- **Visual Verification**: Capture screenshots with overlay enabled/disabled
- **Edge Highlights**: Verify green lines appear on detected edges
- **Crop Region**: Verify red overlay appears on black bar regions
- **Stats HUD**: Verify stats display shows correct values
- **Toggle Interaction**: Click toggle, verify overlay appears/disappears
- **Keyboard Shortcut**: Press Ctrl+Shift+D, verify toggle

### Anti-Patterns to Avoid

- ❌ Don't use WebGL for overlay rendering (Canvas2D is simpler and sufficient)
- ❌ Don't render overlay when feature is disabled (performance waste)
- ❌ Don't block main render loop (overlay rendering must be fast)
- ❌ Don't hardcode colors (use constants for maintainability)

---

## 🧪 Test Coverage Required

### Unit Tests

- [ ] **Settings Property**: `showDebugOverlay` exists in `CrtSettings` interface
- [ ] **Default Value**: `showDebugOverlay` defaults to `false`
- [ ] **Toggle Rendering**: Overlay only renders when `showDebugOverlay = true`
- [ ] **Keyboard Shortcut**: Ctrl+Shift+D toggles `showDebugOverlay`
- [ ] **Canvas Drawing**: Canvas2D methods called with expected parameters
- [ ] **Stats Accuracy**: HUD displays correct depths, confidence, FPS values

### E2E Tests (Cypress)

- [ ] **Overlay Visibility**: Overlay appears when toggle enabled
- [ ] **Overlay Hidden**: Overlay hidden when toggle disabled
- [ ] **Edge Highlights**: Green lines visible on detected edges
- [ ] **Crop Region**: Red overlay visible on black bar areas
- [ ] **Depth Labels**: Numeric labels show correct pixel depths
- [ ] **Stats HUD**: Stats display shows detection metrics
- [ ] **Keyboard Shortcut**: Ctrl+Shift+D toggles overlay
- [ ] **Performance**: Overlay rendering completes in < 1ms

### Behavioral Expectations

**Overlay Enabled**:
- Green border lines on detected edges
- Red semi-transparent overlay on black bar regions
- Yellow depth labels at boundaries
- White stats HUD in top-left corner

**Overlay Disabled**:
- No overlay elements visible
- Normal CRT effects render unaffected

**Keyboard Shortcut**:
- Press Ctrl+Shift+D → overlay appears
- Press again → overlay disappears

---

## 📖 Related Documentation

**Planning Documents**:
- [Phase 1.1 Plan](../phases/AUTO-CROP-BLACKBARS-PHASE-01.1-WEBGL-DETECTION.md) - Debug overlay specification
- [Master Plan](../AUTO-CROP-BLACKBARS-MASTER-PLAN.md) - Project overview

**Design Resources**:
- [Style Guide](../../../docs/STYLE_GUIDE.md) - Color palette and styling patterns
- [Component Library](../../../docs/COMPONENT_LIBRARY.md) - Settings panel patterns

**Related Tasks**:
- AUTO-CROP-BLACKBARS-TASK-01.1-003-RENDERER-INTEGRATION (prerequisite) - Detection data source
- AUTO-CROP-BLACKBARS-TASK-01-004-UI-CONTROLS (Phase 1) - Settings panel patterns

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/AUTO-CROP-BLACKBARS/reports/AUTO-CROP-BLACKBARS-TASK-01.1-004-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/AUTO-CROP-BLACKBARS/reports/AUTO-CROP-BLACKBARS-TASK-01.1-004-REPORT.md`

---

## 🎯 Summary

This task adds transparency to GPU-based detection by visualizing the entire detection process: edge detection results, bar depths, crop regions, and confidence scores. The debug overlay helps developers validate detection accuracy, tune thresholds, and troubleshoot issues while providing users with insight into why certain crops are applied.

**Key Deliverables**:
1. `DebugOverlayRenderer` class using Canvas2D for fast rendering
2. Real-time visualization of edges, depths, crops, and confidence
3. Stats HUD showing detection metrics
4. Settings toggle and keyboard shortcut (Ctrl+Shift+D)
5. Unit and E2E tests verifying overlay correctness
6. < 1ms rendering overhead

**Estimated Effort**: 1-1.5 days
