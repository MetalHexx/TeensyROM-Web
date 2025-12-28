# Task 01.1-006: Black Bar Detection Debug Visualization

## 📋 Task Metadata

**Task ID**: AUTO-CROP-BLACKBARS-TASK-01.1-006-DEBUG-VISUALIZATION  
**Phase**: 1.1 - Advanced WebGL-Based Black Bar Detection  
**Assigned Agent**: UI Wizard (Clean Coder)  
**Priority**: High  
**Estimated Size**: Small (1-2 days)  
**Status**: 🔲 Not Started  
**Depends On**: AUTO-CROP-BLACKBARS-TASK-01.1-005-MEASUREMENT-BASED-CROPPING (completed)

---

## 🎯 Objective

Add visual debugging overlay to display detected black bar boundaries as a colored rectangle frame, along with real-time measurement values. This allows empirical tuning of detection thresholds before applying automated cropping, preventing the overcropping issues discovered in Task 01.1-005.

**What**: Render a colored rectangle border showing the detected content area (after removing black bars) on top of the video
**Why**: Visual feedback for threshold tuning - see what the system detects vs what's actually visible
**Success**: User can see detection accuracy in real-time and adjust thresholds accordingly

---

## 📚 Required Reading

**Prior Context**:
- [x] [Task 01.1-005 Report](../reports/AUTO-CROP-BLACKBARS-TASK-01.1-005-REPORT.md) - Overcropping issue discovered
- [x] [CrtRenderer](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts) - Main rendering loop
- [x] [Edge Detection Shader](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/shaders/edge-detect.frag.ts) - Current detection thresholds

**Standards**:
- [ ] [Coding Standards](../../../CODING_STANDARDS.md)
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md)
- [ ] [Component Library](../../../COMPONENT_LIBRARY.md) - For UI controls

---

## 🧠 Context & Rationale

### The Problem

Task 01.1-005 successfully implemented measurement-based detection, but real-world testing revealed **overcropping** - the system cuts into actual game content because dark game areas (space backgrounds) are detected as "black bars". Current thresholds:
- `BLACK_LUMINANCE_THRESHOLD = 0.05` (5% brightness)
- `BLACK_SATURATION_THRESHOLD = 0.1` (10% saturation)

These values are too loose, but we don't know what the correct values should be.

### Why Visualization First

**Current workflow (broken)**:
1. Adjust shader threshold
2. Rebuild frontend
3. Load game
4. See if crop is better/worse
5. Repeat

**With visualization (efficient)**:
1. Draw rectangle showing detected boundaries
2. See immediately if detection matches visual reality
3. Adjust threshold via slider (no rebuild)
4. Iterate in real-time
5. Apply tuned values to shader

### What We Need to See

```
┌─────────────────────────────────────┐
│ ┌───────────────────────────────┐   │ ← Green rectangle border
│ │                               │   │    shows detected content area
│ │    C64 Game Content           │   │
│ │                               │   │
│ │  Measurements:                │   │ ← Text overlay with values
│ │  L:0.25 T:0.30 R:0.40 B:0.20  │   │
│ └───────────────────────────────┘   │
└─────────────────────────────────────┘
     ↑ Black bars outside rectangle
```

---

## ✅ Success Criteria

**Functional Requirements**:
- [ ] Green rectangle border drawn on video showing detected content area
- [ ] Rectangle position based on current measurements from VideoModeDetector
- [ ] Measurement values displayed as text overlay (left, top, right, bottom percentages)
- [ ] Toggle visualization on/off with keyboard shortcut (e.g., 'D' for Debug)
- [ ] Visualization updates in real-time (every detection cycle ~200ms)
- [ ] Does not interfere with normal video rendering or CRT effects
- [ ] Works in both cropped and uncropped modes

**Quality Requirements**:
- [ ] Rectangle rendering is performant (no frame drops)
- [ ] Text is readable on both dark and light backgrounds
- [ ] Visual style consistent with existing UI (neon green glow theme)
- [ ] Keyboard shortcut documented in UI tooltip/help

**User Experience**:
- [ ] Clear visual distinction between detected area and bars
- [ ] Measurements easy to read and understand
- [ ] Toggle is discoverable (UI button + keyboard shortcut)

---

## 📐 Technical Design

### Architecture Approach

**Option A: Canvas Overlay** (Recommended)
- Create separate 2D canvas positioned absolutely over video canvas
- Draw rectangle and text using Canvas 2D API
- Pros: Simple, no WebGL complexity, easy text rendering
- Cons: Extra DOM element

**Option B: WebGL Overlay Pass**
- Add final rendering pass that draws debug primitives
- Pros: Single canvas, integrated with existing pipeline
- Cons: Text rendering in WebGL is complex, shader overhead

**Recommendation**: **Option A** - Canvas overlay is simpler and sufficient for debug feature.

### Implementation Plan

#### 1. Add Debug Canvas Overlay

Create a debug canvas positioned over the video canvas:

```typescript
// libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts

export class CrtRenderer {
  private debugCanvas?: HTMLCanvasElement;
  private debugCtx?: CanvasRenderingContext2D;
  private debugVisualizationEnabled = false;
  
  constructor(canvas: HTMLCanvasElement, ...) {
    // Existing initialization
    
    // Create debug overlay canvas
    this.createDebugCanvas();
  }
  
  private createDebugCanvas(): void {
    this.debugCanvas = document.createElement('canvas');
    this.debugCanvas.style.position = 'absolute';
    this.debugCanvas.style.top = '0';
    this.debugCanvas.style.left = '0';
    this.debugCanvas.style.pointerEvents = 'none'; // Don't block mouse events
    this.debugCanvas.style.zIndex = '1000'; // Above video
    
    // Match main canvas size
    this.debugCanvas.width = this.canvas.width;
    this.debugCanvas.height = this.canvas.height;
    
    // Insert after main canvas
    this.canvas.parentElement?.appendChild(this.debugCanvas);
    
    this.debugCtx = this.debugCanvas.getContext('2d');
  }
  
  public setDebugVisualization(enabled: boolean): void {
    this.debugVisualizationEnabled = enabled;
    if (!enabled && this.debugCanvas) {
      // Clear canvas when disabled
      this.debugCtx?.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
    }
  }
}
```

#### 2. Draw Detection Rectangle

Add rendering logic after detection completes:

```typescript
// In runDetection() method, after cropRect is determined

private runDetection(): void {
  // ... existing detection code ...
  
  const cropRect = this.videoModeDetector.detectMode(measurements, videoStandard);
  
  if (this.debugVisualizationEnabled) {
    this.drawDebugOverlay(measurements, cropRect);
  }
  
  // ... rest of method ...
}

private drawDebugOverlay(
  measurements: EdgeDetectionMeasurements | null,
  cropRect: CropRect | null
): void {
  if (!this.debugCanvas || !this.debugCtx) return;
  
  const ctx = this.debugCtx;
  const width = this.debugCanvas.width;
  const height = this.debugCanvas.height;
  
  // Clear previous frame
  ctx.clearRect(0, 0, width, height);
  
  if (!cropRect || !measurements) return;
  
  // Calculate content rectangle coordinates
  const contentX = cropRect.left * width;
  const contentY = cropRect.top * height;
  const contentWidth = cropRect.width * width;
  const contentHeight = cropRect.height * height;
  
  // Draw neon green rectangle border (4px wide)
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 4;
  ctx.shadowColor = '#00ff00';
  ctx.shadowBlur = 10; // Glow effect
  ctx.strokeRect(contentX, contentY, contentWidth, contentHeight);
  
  // Draw measurement text in top-left corner
  ctx.shadowBlur = 5;
  ctx.fillStyle = '#00ff00';
  ctx.font = '16px monospace';
  
  const measurementText = `L:${measurements.left.toFixed(2)} T:${measurements.top.toFixed(2)} R:${measurements.right.toFixed(2)} B:${measurements.bottom.toFixed(2)}`;
  
  // Background for text readability
  const textMetrics = ctx.measureText(measurementText);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(10, 10, textMetrics.width + 20, 30);
  
  // Draw text
  ctx.fillStyle = '#00ff00';
  ctx.fillText(measurementText, 20, 30);
}
```

#### 3. Add Keyboard Toggle

Add keyboard event listener in component:

```typescript
// libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts

export class CrtEffectWrapperComponent implements OnInit {
  private debugMode = false;
  
  ngOnInit(): void {
    // Existing initialization
    
    // Add keyboard listener
    this.setupKeyboardShortcuts();
  }
  
  private setupKeyboardShortcuts(): void {
    window.addEventListener('keydown', (event) => {
      if (event.key === 'd' || event.key === 'D') {
        this.toggleDebugVisualization();
      }
    });
  }
  
  private toggleDebugVisualization(): void {
    this.debugMode = !this.debugMode;
    this.renderer?.setDebugVisualization(this.debugMode);
    
    console.log(`[CrtEffectWrapper] Debug visualization ${this.debugMode ? 'enabled' : 'disabled'} (press 'D' to toggle)`);
  }
}
```

#### 4. Add UI Toggle Button

Add button to CRT effect controls:

```html
<!-- crt-effect-wrapper.component.html -->
<div class="debug-controls">
  <button 
    mat-icon-button 
    (click)="toggleDebugVisualization()"
    [class.active]="debugMode"
    matTooltip="Toggle black bar detection overlay (D)">
    <mat-icon>bug_report</mat-icon>
  </button>
</div>
```

---

## 🧪 Testing Strategy

### Manual Testing

**Test 1: Rectangle Accuracy**
- Load North Star game
- Press 'D' to enable overlay
- Verify green rectangle aligns with visual black bar boundaries
- Measurements should match visual estimation

**Test 2: Real-Time Updates**
- Keep overlay enabled
- Switch between different games/modes
- Rectangle should update within ~1 second (5 frames at 200ms intervals)

**Test 3: Performance**
- Enable overlay
- Verify no frame drops (maintain 60 FPS)
- WebGL rendering should not be affected

**Test 4: Toggle Behavior**
- Press 'D' multiple times
- Overlay should appear/disappear smoothly
- No visual artifacts when toggling

### Edge Cases

- [ ] No measurements yet (game just started) - show "Detecting..." text
- [ ] No crop detected (no black bars) - show message or hide overlay
- [ ] Canvas resize - debug canvas should resize with main canvas
- [ ] Multiple devices - debug mode should be per-device

---

## 📁 Files to Modify

**Primary Changes**:
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts` - Add debug canvas and rendering
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts` - Add keyboard/UI toggle
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.html` - Add debug button
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss` - Style debug button

**No New Files Required** - This is a pure enhancement to existing rendering

---

## 📝 Implementation Notes

### Visual Style Guidelines

**Colors**:
- Rectangle border: `#00ff00` (neon green) - matches CRT aesthetic
- Text: `#00ff00` on semi-transparent black background
- Glow: 10px blur for neon effect

**Layout**:
- Rectangle: 4px stroke width, rounded corners optional
- Text: Top-left corner with 10px padding
- Font: 16px monospace for precise alignment

### Performance Considerations

- Canvas 2D drawing is very fast for simple shapes
- Clear canvas every frame (avoid overdraw)
- Only draw when debug mode enabled
- No impact on WebGL rendering pipeline

### Accessibility

- Keyboard shortcut clearly documented in UI
- Button has tooltip explaining functionality
- High contrast colors for visibility

---

## 🔗 Dependencies & Blockers

**Depends On**:
- AUTO-CROP-BLACKBARS-TASK-01.1-005 (completed) - Provides measurements and crop data

**Blocks**:
- Threshold tuning task (needs visualization to iterate)
- Preset calibration task (needs accurate measurements)

**No External Dependencies** - Uses standard Canvas 2D API

---

## 🎯 Success Metrics

### How to Verify Success

1. **Visual Accuracy**: Rectangle matches human perception of black bar boundaries
2. **Real-Time Feedback**: Updates within 1 second of detection change
3. **Zero Performance Impact**: Maintains 60 FPS with overlay enabled
4. **User-Friendly**: Toggle is intuitive and documented

### Definition of "Done"

- [ ] Green rectangle renders on video
- [ ] Measurements display as text
- [ ] Keyboard shortcut works ('D')
- [ ] UI button works with visual feedback
- [ ] No frame drops with overlay enabled
- [ ] Works on all supported browsers (Chrome, Firefox, Edge)
- [ ] Code follows style guide and passes linting

---

## 💡 Future Enhancements (Out of Scope)

- **Threshold Sliders**: Add UI sliders to adjust luminance/saturation thresholds in real-time
- **Sampling Visualization**: Show the 20 sample points along each edge
- **Measurement History Graph**: Show how measurements change over time
- **Preset Comparison**: Show multiple preset rectangles overlaid

These can be added in subsequent tasks once basic visualization proves useful.

---

## 📚 Related Documentation

- [Task 01.1-005](./AUTO-CROP-BLACKBARS-TASK-01.1-005-MEASUREMENT-BASED-CROPPING.md) - Detection implementation
- [CRT Renderer Architecture](../../../../libs/ui/components/src/lib/crt-effect-wrapper/README.md)
- [Component Library](../../../COMPONENT_LIBRARY.md) - UI button patterns
- [Style Guide](../../../STYLE_GUIDE.md) - Neon theme colors

---

**Ready for Assignment**: This task is well-defined and can be implemented immediately after Task 01.1-005 completion.
