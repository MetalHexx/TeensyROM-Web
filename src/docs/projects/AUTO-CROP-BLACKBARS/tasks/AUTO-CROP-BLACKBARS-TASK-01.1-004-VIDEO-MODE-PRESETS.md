# Task 01.1-004: C64 Video Mode Preset System

## 📋 Task Metadata

**Task ID**: AUTO-CROP-BLACKBARS-TASK-01.1-004-VIDEO-MODE-PRESETS  
**Phase**: 1.1 - Advanced WebGL-Based Black Bar Detection  
**Assigned Agent**: UI Wizard (Clean Coder)  
**Priority**: High  
**Estimated Size**: Medium (2-3 days)  
**Status**: 🔲 Not Started

---

## 🎯 Objective

Replace variance-based black bar depth detection with a C64-specific video mode preset system. Instead of attempting to distinguish content from black bars using pixel variance, use a **user-provided PAL/NTSC setting** combined with video dimensions to snap to the nearest known C64 video mode (standard/extended/open-border) with pre-configured crop values. This leverages domain knowledge about standardized C64 video output to eliminate detection accuracy issues while maintaining the smooth cropping UX.

**Key Implementation Change**: Add a `videoStandard` dropdown (PAL/NTSC) to the CRT settings panel. Future enhancement will source this automatically from the TeensyROM device, but for now the user manually selects their region.

---

## 📚 Required Reading

**Architecture Context**:
- [x] [Phase 1.1 Plan](../phases/AUTO-CROP-BLACKBARS-PHASE-01.1-WEBGL-DETECTION.md) - Original GPU detection approach
- [x] [Task 01.1-003 Report](../reports/AUTO-CROP-BLACKBARS-TASK-01.1-003-REPORT.md) - Integration complete but accuracy issues
- [ ] [C64 Video Modes Reference](https://www.c64-wiki.com/wiki/VIC-II) - VIC-II chip video specifications

**Standards**:
- [ ] [Coding Standards](../../../CODING_STANDARDS.md)
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md)
- [ ] [Domain Model Standards](../../../docs/OVERVIEW_CONTEXT.md#domain-layer)

---

## 🧠 Context & Rationale

### Why Pivot from Variance Detection?

**Phase 1.1 GPU Detection Issues** (see [Task 01.1-003 Report](../reports/AUTO-CROP-BLACKBARS-TASK-01.1-003-REPORT.md)):
- **Over-aggressive left/right cropping**: Cuts 24.7% left, 18.1% right - removes blue UI spheres and red/magenta colored text
- **Top/bottom detection failing**: Returns 0 depths despite edge detection confirming bars present
- **Variance threshold too sensitive**: C64 content (blue decorations, colored text, dither patterns) confounds texture-based detection
- **Multiple tuning attempts failed**: Thresholds (0.03 → 0.01), resolution (1/8 → 1/4 scale), sampling coordinates - all insufficient

**Root Cause**: Generic content detection fundamentally mismatched to C64 emulator domain. Trying to distinguish "black bar" from "content" using pixel statistics fails when content includes solid colors, dithering, and decorative UI elements.

**Solution**: C64 games use **standardized video modes** defined by VIC-II chip hardware. Instead of detecting arbitrary bars, use **user-provided video standard (PAL/NTSC)** combined with video dimensions to apply known crop values for that mode.

**Why User-Provided Standard?**:
- **Simpler**: No complex PAL/NTSC detection algorithm needed
- **More Reliable**: User knows which region they're running
- **Future-Proof**: TeensyROM device will provide this info automatically later
- **Fits Architecture**: Device knows what video standard it's outputting

### C64 Video Mode Standards

The VIC-II chip outputs specific resolutions based on:
1. **Region**: PAL (50 Hz) vs NTSC (60 Hz)
2. **Border Mode**: Standard / Extended / Open Border
3. **Aspect Ratio**: Original square pixels vs modern display-corrected

#### Standard C64 Video Modes

| Mode Name | Resolution | Aspect Ratio | Typical Black Bars | Use Case |
|-----------|------------|--------------|-------------------|----------|
| **PAL Standard** | 320x200 | ~1.6:1 | Top: 16px, Bottom: 16px, Sides: 32px each | Most common PAL games |
| **PAL Extended** | 320x256 | 1.25:1 | Minimal (2-8px all sides) | Full screen PAL demos |
| **PAL Open Border** | 384x272 | ~1.41:1 | None (shows border color) | VIC-II tricks, sideborder demos |
| **NTSC Standard** | 320x200 | ~1.6:1 | Top: 8px, Bottom: 32px, Sides: 32px each | Most NTSC games (asymmetric bars) |
| **NTSC Extended** | 320x240 | 1.33:1 (4:3) | Minimal (4-12px all sides) | Full screen NTSC |
| **NTSC Open Border** | 384x240 | 1.6:1 | None | NTSC border effects |

**Asymmetric PAL vs NTSC**: PAL has more vertical resolution (256 vs 240 lines), NTSC has different vertical centering causing uneven top/bottom bars.

#### Display Aspect Correction

Modern displays expect rectangular pixels (1:1 pixel aspect ratio), but C64 output was designed for CRT TVs with non-square pixels:
- **PAL Pixel Aspect**: ~0.9375:1 (slightly taller than wide)
- **NTSC Pixel Aspect**: ~1.125:1 (slightly wider than tall)

**Display Correction Factor**:
- PAL 320x200 @ square pixels → effective 300x200 in original aspect
- NTSC 320x200 @ square pixels → effective 360x200 in original aspect

---

## ✅ Success Criteria

**Functional Requirements**:
- [ ] **UI Control**: PAL/NTSC dropdown added to CRT settings panel
- [ ] **Domain Model**: `videoStandard: 'PAL' | 'NTSC'` added to `CrtSettings` with persistence
- [ ] System detects standard/extended/open-border modes based on video dimensions
- [ ] Crop values snap to nearest preset mode for selected standard (<10px error)
- [ ] Smooth CropAnimator transitions maintained (no regression)
- [ ] Feature toggle (`autoCropBlackBars`) still respected
- [ ] Fallback to edge detection if source doesn't match known modes

**Quality Requirements**:
- [ ] All existing tests pass (201 tests: 66 CrtRenderer + 135 detection)
- [ ] New tests for mode detection logic (15+ tests)
- [ ] No performance regression (maintain 60 FPS rendering)
- [ ] Console logs simplified (removed noisy debug output)

**User Experience**:
- [ ] Works correctly with North Star game (current test case)
- [ ] Works with PAL games (320x200 with thick borders)
- [ ] Works with NTSC games (320x200 with asymmetric bars)
- [ ] No over-cropping into content (blue spheres, colored text)
- [ ] Top/bottom bars correctly removed (fixed from Phase 1.1 GPU issues)

---

## 📐 Technical Design

### Architecture: Replace EdgeAnalysisProcessor with VideoModeDetector

**Current Pipeline** (keeping GPU edge detection, replacing depth scanning):
```
┌─────────────────────────────────────────────────────────────────┐
│ Pass 1: Edge Detection Shader (KEEP)                            │
│ - Detects presence of black bars on all 4 edges                 │
│ - Output: Edge map (0-1 values per side)                        │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ NEW: VideoModeDetector (replaces depth scanning shaders)        │
│ Input: Video dimensions, user's videoStandard setting (PAL/NTSC)│
│                                                                  │
│ Algorithm:                                                       │
│ 1. Read video source dimensions (width × height)                │
│ 2. Read user's videoStandard setting from CrtSettings           │
│ 3. Calculate aspect ratio                                       │
│ 4. Detect border mode from dimensions for selected standard:    │
│    PAL:  Height ≈ 200 → Standard, ≈ 256 → Extended, ≈ 272 → Open│
│    NTSC: Height ≈ 200 → Standard, ≈ 240 → Extended, ≈ 240 → Open│
│ 5. Match to nearest mode from preset table (filtered by standard)│
│ 6. Return preset crop values for matched mode                   │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ CropAnimator (UNCHANGED)                                         │
│ - Smooth interpolation to preset crop values                    │
└─────────────────────────────────────────────────────────────────┘
```

**Key Changes**:
- **Remove**: `horizontal-scan.frag.ts`, `vertical-scan.frag.ts` (variance-based depth scanning)
- **Remove**: `EdgeAnalysisProcessor.processCropResults()` (pixel-based depth conversion)
- **Add**: `VideoModeDetector` class (preset mode matching)
- **Keep**: `edge-detect.frag.ts` (confirms bars present before applying preset)
- **Keep**: `CropAnimator` (smooth transitions)

### C64 Video Mode Preset Table

**NEW: Add user-provided video standard setting** (PAL/NTSC selector in UI)

```typescript
// libs/domain/src/lib/models/crt-settings.model.ts

export interface CrtSettings {
  // ...existing properties
  autoCropBlackBars: boolean;
  videoStandard: 'PAL' | 'NTSC'; // NEW - user selects region
}

// crt-settings.defaults.ts
export const DEFAULT_CRT_SETTINGS: CrtSettings = {
  // ...existing defaults
  autoCropBlackBars: false,
  videoStandard: 'PAL' // Default to PAL (most common)
};
```

```typescript
// libs/domain/src/lib/models/c64-video-modes.model.ts

export interface C64VideoMode {
  name: string;
  region: 'PAL' | 'NTSC';
  borderMode: 'standard' | 'extended' | 'open';
  resolution: { width: number; height: number };
  aspectRatio: number;
  cropPercent: {
    top: number;    // 0-1 normalized crop from top edge
    bottom: number; // 0-1 normalized crop from bottom edge
    left: number;   // 0-1 normalized crop from left edge
    right: number;  // 0-1 normalized crop from right edge
  };
  tolerance: number; // ±px for matching resolution
}

export const C64_VIDEO_MODE_PRESETS: C64VideoMode[] = [
  {
    name: 'PAL Standard',
    region: 'PAL',
    borderMode: 'standard',
    resolution: { width: 320, height: 200 },
    aspectRatio: 1.6,
    cropPercent: { top: 0.08, bottom: 0.08, left: 0.1, right: 0.1 }, // 16px top/bottom, 32px sides
    tolerance: 10
  },
  {
    name: 'PAL Extended',
    region: 'PAL',
    borderMode: 'extended',
    resolution: { width: 320, height: 256 },
    aspectRatio: 1.25,
    cropPercent: { top: 0.01, bottom: 0.01, left: 0.02, right: 0.02 }, // Minimal bars
    tolerance: 10
  },
  {
    name: 'NTSC Standard',
    region: 'NTSC',
    borderMode: 'standard',
    resolution: { width: 320, height: 200 },
    aspectRatio: 1.6,
    cropPercent: { top: 0.04, bottom: 0.16, left: 0.1, right: 0.1 }, // Asymmetric: 8px top, 32px bottom
    tolerance: 10
  },
  {
    name: 'NTSC Extended',
    region: 'NTSC',
    borderMode: 'extended',
    resolution: { width: 320, height: 240 },
    aspectRatio: 1.33,
    cropPercent: { top: 0.02, bottom: 0.05, left: 0.03, right: 0.03 },
    tolerance: 10
  },
  {
    name: 'PAL Open Border',
    region: 'PAL',
    borderMode: 'open',
    resolution: { width: 384, height: 272 },
    aspectRatio: 1.41,
    cropPercent: { top: 0, bottom: 0, left: 0, right: 0 }, // No crop (shows border color)
    tolerance: 15
  },
  {
    name: 'NTSC Open Border',
    region: 'NTSC',
    borderMode: 'open',
    resolution: { width: 384, height: 240 },
    aspectRatio: 1.6,
    cropPercent: { top: 0, bottom: 0, left: 0, right: 0 },
    tolerance: 15
  }
];
```

### VideoModeDetector Class

**Updated to use user's videoStandard setting**:

```typescript
// libs/infrastructure/src/lib/video/video-mode-detector.ts

export class VideoModeDetector {
  private detectionHistory: C64VideoMode[] = [];
  private readonly HISTORY_SIZE = 5; // Require stability over 5 frames
  
  /**
   * Detect C64 video mode from source dimensions and user's video standard setting.
   * Uses temporal stability to prevent mode thrashing.
   */
  detectMode(
    videoWidth: number,
    videoHeight: number,
    videoStandard: 'PAL' | 'NTSC', // NEW - from CrtSettings
    edgeDetected: { top: boolean; bottom: boolean; left: boolean; right: boolean }
  ): CropRect | null {
    // Step 1: Filter presets by user's selected standard
    const standardPresets = C64_VIDEO_MODE_PRESETS.filter(
      mode => mode.region === videoStandard
    );
    
    // Step 2: Match dimensions to nearest preset within filtered list
    const matchedMode = this.findBestMatch(videoWidth, videoHeight, standardPresets);
    
    if (!matchedMode) {
      console.log('[VideoModeDetector] No preset match for dimensions:', { 
        videoWidth, 
        videoHeight, 
        videoStandard 
      });
      return null; // Fallback to edge detection
    }
    
    // Step 3: Verify bars present via edge detection
    if (!this.shouldApplyCrop(edgeDetected, matchedMode)) {
      console.log('[VideoModeDetector] Bars not detected, skipping crop');
      return null;
    }
    
    // Step 4: Add to history for temporal stability
    this.detectionHistory.push(matchedMode);
    if (this.detectionHistory.length > this.HISTORY_SIZE) {
      this.detectionHistory.shift();
    }
    
    // Step 5: Require consensus across history
    if (!this.hasStableMode()) {
      console.log('[VideoModeDetector] Waiting for stable mode detection');
      return null;
    }
    
    // Step 6: Convert preset crop percentages to CropRect
    const crop = this.convertToCropRect(matchedMode, videoWidth, videoHeight);
    console.log(`[VideoModeDetector] Mode detected: ${matchedMode.name} (${videoStandard})`, crop);
    
    return crop;
  }
  
  private findBestMatch(
    width: number, 
    height: number, 
    presets: C64VideoMode[]
  ): C64VideoMode | null {
    let bestMatch: C64VideoMode | null = null;
    let bestScore = Infinity;
    
    for (const mode of presets) {
      const widthDiff = Math.abs(width - mode.resolution.width);
      const heightDiff = Math.abs(height - mode.resolution.height);
      const totalDiff = widthDiff + heightDiff;
      
      // Within tolerance?
      if (widthDiff <= mode.tolerance && heightDiff <= mode.tolerance) {
        if (totalDiff < bestScore) {
          bestScore = totalDiff;
          bestMatch = mode;
        }
      }
    }
    
    return bestMatch;
  }
  
  private shouldApplyCrop(
    edgeDetected: { top: boolean; bottom: boolean; left: boolean; right: boolean },
    mode: C64VideoMode
  ): boolean {
    // For open border modes, don't require edge detection (might show blue border color)
    if (mode.borderMode === 'open') {
      return true;
    }
    
    // For standard/extended, require at least 2 edges detected
    const detectedCount = [
      edgeDetected.top,
      edgeDetected.bottom,
      edgeDetected.left,
      edgeDetected.right
    ].filter(Boolean).length;
    
    return detectedCount >= 2;
  }
  
  private hasStableMode(): boolean {
    if (this.detectionHistory.length < this.HISTORY_SIZE) {
      return false;
    }
    
    // All recent detections must agree on mode name
    const recentMode = this.detectionHistory[this.detectionHistory.length - 1];
    return this.detectionHistory.every(mode => mode.name === recentMode.name);
  }
  
  private convertToCropRect(mode: C64VideoMode, width: number, height: number): CropRect {
    const { top, bottom, left, right } = mode.cropPercent;
    
    return {
      left: left,
      top: top,
      width: 1 - left - right,
      height: 1 - top - bottom
    };
  }
}
```

### Integration with CrtRenderer

**Minimal changes** - replace EdgeAnalysisProcessor with VideoModeDetector:

```typescript
// libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts

class CrtRenderer {
  private detectionPassRenderer: DetectionPassRenderer;
  private videoModeDetector: VideoModeDetector; // NEW - replaces EdgeAnalysisProcessor
  private cropAnimator: CropAnimator;
  
  // ... existing code ...
  
  render(videoElement: HTMLVideoElement): void {
    // ... existing video rendering ...
    
    // Run detection (throttled to 200ms)
    if (this.shouldRunDetection()) {
      this.runVideoModeDetection(videoElement);
    }
    
    // ... existing main render pass ...
  }
  
  private runVideoModeDetection(videoElement: HTMLVideoElement): void {
    // Step 1: Edge detection (unchanged)
    this.detectionPassRenderer.renderEdgeDetection(videoTexture, width, height);
    const edgeMapTexture = this.detectionPassRenderer.getEdgeMapTexture();
    
    // Step 2: Read edge results
    const edgeResults = this.detectionPassRenderer.readEdgeResults(); // NEW method
    const edgeDetected = {
      top: edgeResults.top > 0.7,
      bottom: edgeResults.bottom > 0.7,
      left: edgeResults.left > 0.7,
      right: edgeResults.right > 0.7
    };
    
    // Step 3: Video mode detection (replaces depth scanning)
    // Pass user's videoStandard setting from CrtSettings
    const crop = this.videoModeDetector.detectMode(
      videoElement.videoWidth,
      videoElement.videoHeight,
      this.settings.videoStandard, // NEW - from CrtSettings
      edgeDetected
    );
    
    // Step 4: Apply crop (unchanged)
    if (crop) {
      this.cropAnimator.setTarget(crop);
    }
  }
}
```

---

## 🧪 Testing Strategy

### Unit Tests: VideoModeDetector

```typescript
// libs/infrastructure/src/lib/video/video-mode-detector.spec.ts

describe('VideoModeDetector', () => {
  let detector: VideoModeDetector;
  
  beforeEach(() => {
    detector = new VideoModeDetector();
  });
  
  describe('PAL Standard Mode (320x200)', () => {
    it('should match PAL standard mode within tolerance', () => {
      const crop = detector.detectMode(
        320, 200,
        { top: true, bottom: true, left: true, right: true }
      );
      
      // First detection returns null (needs history)
      expect(crop).toBeNull();
      
      // After 5 stable detections...
      for (let i = 0; i < 4; i++) {
        detector.detectMode(320, 200, { top: true, bottom: true, left: true, right: true });
      }
      
      const stableCrop = detector.detectMode(
        320, 200,
        { top: true, bottom: true, left: true, right: true }
      );
      
      expect(stableCrop).not.toBeNull();
      expect(stableCrop?.top).toBeCloseTo(0.08, 2); // 8% top crop
      expect(stableCrop?.height).toBeCloseTo(0.84, 2); // 84% height (16% bars removed)
    });
    
    it('should handle dimensions within tolerance (±10px)', () => {
      // Test 315x195 (5px under)
      // Test 325x205 (5px over)
      // Both should match PAL Standard
    });
  });
  
  describe('NTSC Standard Mode (320x200 asymmetric)', () => {
    it('should detect NTSC with asymmetric crop', () => {
      // Expected: top 4%, bottom 16% (NTSC has uneven bars)
    });
  });
  
  describe('PAL Extended Mode (320x256)', () => {
    it('should match extended mode with minimal crop', () => {
      // Expected: 1% crop on all sides
    });
  });
  
  describe('Open Border Modes', () => {
    it('should not require edge detection for open border', () => {
      const crop = detector.detectMode(
        384, 272,
        { top: false, bottom: false, left: false, right: false } // No edges
      );
      
      // Should still match PAL Open Border after stability
      // Expected: 0% crop (shows blue border)
    });
  });
  
  describe('Temporal Stability', () => {
    it('should require 5 consecutive matching detections', () => {
      // Detection 1-4: PAL Standard → null
      // Detection 5: PAL Standard → returns crop
    });
    
    it('should reject thrashing between modes', () => {
      // PAL Standard, NTSC Standard, PAL Standard... → null
    });
  });
  
  describe('Edge Detection Validation', () => {
    it('should reject crop if <2 edges detected (standard modes)', () => {
      const crop = detector.detectMode(
        320, 200,
        { top: false, bottom: false, left: true, right: false } // Only 1 edge
      );
      
      expect(crop).toBeNull();
    });
  });
  
  describe('No Match Scenarios', () => {
    it('should return null for non-C64 dimensions', () => {
      const crop = detector.detectMode(
        1920, 1080, // HD video
        { top: true, bottom: true, left: true, right: true }
      );
      
      expect(crop).toBeNull(); // Falls back to edge detection
    });
  });
});
```

### Integration Tests: CrtRenderer with VideoModeDetector

Update existing tests to use video mode detection instead of depth scanning:

```typescript
// libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.spec.ts

describe('CrtRenderer - Video Mode Detection Integration', () => {
  it('should detect PAL standard mode and apply preset crop', () => {
    // Mock video: 320x200, edge detection shows bars
    // Expected: Crop to { top: 0.08, left: 0.1, width: 0.8, height: 0.84 }
  });
  
  it('should fall back to no crop if mode not matched', () => {
    // Mock video: 1920x1080 (non-C64)
    // Expected: No crop applied
  });
});
```

---

## 📂 Files to Create

**Domain Model** (new preset definitions + settings):
```
📝 libs/domain/src/lib/models/crt-settings.model.ts
   Change: Add videoStandard: 'PAL' | 'NTSC' property
   
📝 libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts
   Change: Add videoStandard: 'PAL' default value

✨ libs/domain/src/lib/models/c64-video-modes.model.ts
   Purpose: C64VideoMode interface, C64_VIDEO_MODE_PRESETS table
   Exports: C64VideoMode, C64_VIDEO_MODE_PRESETS
```

**Infrastructure** (new detector class):
```
✨ libs/infrastructure/src/lib/video/video-mode-detector.ts
   Purpose: Detect C64 video mode from dimensions + videoStandard setting
   Exports: VideoModeDetector class

✨ libs/infrastructure/src/lib/video/video-mode-detector.spec.ts
   Purpose: Unit tests for mode detection logic
   Test count: 15+ tests
```

**UI Settings Panel** (add PAL/NTSC dropdown):
```
📝 libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts
   Change: Add videoStandard dropdown handler
   
📝 libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html
   Change: Add <mat-select> for PAL/NTSC selection
   Location: Below "Auto-Crop Border" toggle, before sliders
   
📝 libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts
   Change: Test videoStandard dropdown interaction
```

**Infrastructure Barrel** (export new detector):
```
📝 libs/infrastructure/src/index.ts
   Change: Add export { VideoModeDetector } from './lib/video/video-mode-detector';
```

---

## 🎨 UI Implementation: PAL/NTSC Dropdown

### Settings Panel HTML

Add dropdown below the "Auto-Crop Border" toggle:

```html
<!-- libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html -->

<div class="slider-row">
  <mat-slide-toggle
    [(ngModel)]="settings().autoCropBlackBars"
    (ngModelChange)="onToggleChange($event)"
    matTooltip="Automatically crop black borders from C64 video">
    Auto-Crop Border
  </mat-slide-toggle>
</div>

<!-- NEW: Video Standard Selector -->
<div class="slider-row" *ngIf="settings().autoCropBlackBars">
  <label class="setting-label">Video Standard</label>
  <mat-select
    [(ngModel)]="settings().videoStandard"
    (ngModelChange)="onVideoStandardChange($event)"
    class="video-standard-select"
    matTooltip="Select PAL (Europe/Asia) or NTSC (Americas/Japan) video standard">
    <mat-option value="PAL">PAL (Europe)</mat-option>
    <mat-option value="NTSC">NTSC (Americas)</mat-option>
  </mat-select>
</div>
```

### Settings Panel TypeScript

```typescript
// libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts

export class CrtSettingsPanelComponent {
  // ...existing code...
  
  onVideoStandardChange(videoStandard: 'PAL' | 'NTSC'): void {
    console.log('[CrtSettingsPanel] Video standard changed:', videoStandard);
    this.settingsChange.emit({ ...this.settings(), videoStandard });
  }
}
```

### Settings Panel SCSS

```scss
// libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.scss

.video-standard-select {
  width: 150px;
  margin-left: auto; // Align right
  
  ::ng-deep .mat-mdc-select-trigger {
    font-size: 0.9rem;
  }
}

.setting-label {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-right: 12px;
}
```

### Future Enhancement Note

Add comment in code indicating TeensyROM integration path:

```typescript
/**
 * Video standard selector (PAL/NTSC).
 * 
 * TODO: Future enhancement - auto-detect from TeensyROM device:
 *   - Query device API for current video standard
 *   - Update settings automatically when device connects
 *   - Keep manual selector as override option
 * 
 * See: TeensyROM device API documentation
 */
```

---

## 📂 Files to Modify

**Remove Depth Scanning Shaders**:
```
❌ DELETE: libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/shaders/horizontal-scan.frag.ts
❌ DELETE: libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/shaders/vertical-scan.frag.ts
```

**Simplify Detection Pipeline**:
```
📝 libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/detection-pass-renderer.ts
   Changes:
   - Remove renderHorizontalScan() method
   - Remove renderVerticalScan() method
   - Remove depthMapFBO/depthMapTexture
   - Add readEdgeResults() method (read edge map texture instead of depth map)
   - Simplify to single-pass edge detection only
```

**Replace Processor with Detector**:
```
❌ DELETE: libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/edge-analysis-processor.ts
❌ DELETE: libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/edge-analysis-processor.spec.ts
```

**Update CrtRenderer Integration**:
```
📝 libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts
   Changes:
   - Replace EdgeAnalysisProcessor with VideoModeDetector
   - Update runDetection() to call detectMode() instead of processCropResults()
   - Remove horizontal/vertical scan render calls
   - Simplify to: edge detection → mode detection → crop animation
```

**Update Tests**:
```
📝 libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.spec.ts
   Changes: Update integration tests to expect video mode detection behavior
```

---

## 🚧 Implementation Checklist

### Phase 1: Create Domain Model & Presets
- [ ] Create `c64-video-modes.model.ts` with C64VideoMode interface
- [ ] Define C64_VIDEO_MODE_PRESETS table with 6 standard modes
- [ ] Add JSDoc comments explaining each mode and crop values
- [ ] Export from domain barrel

### Phase 2: Implement VideoModeDetector
- [ ] Create `video-mode-detector.ts` class
- [ ] Implement `detectMode()` main method
- [ ] Implement `findBestMatch()` dimension matching logic
- [ ] Implement `shouldApplyCrop()` edge validation
- [ ] Implement `hasStableMode()` temporal stability
- [ ] Implement `convertToCropRect()` percentage to CropRect conversion
- [ ] Add console logging for debugging
- [ ] Export from infrastructure barrel

### Phase 3: Write Unit Tests
- [ ] Create `video-mode-detector.spec.ts`
- [ ] Test PAL standard mode detection
- [ ] Test NTSC standard mode detection (asymmetric)
- [ ] Test PAL/NTSC extended modes
- [ ] Test open border modes
- [ ] Test tolerance matching (±10px)
- [ ] Test temporal stability (5-frame history)
- [ ] Test edge detection validation
- [ ] Test no-match fallback
- [ ] Verify all 15+ tests pass

### Phase 4: Simplify Detection Pipeline
- [ ] Remove horizontal-scan.frag.ts
- [ ] Remove vertical-scan.frag.ts
- [ ] Update DetectionPassRenderer: remove depth scan methods
- [ ] Update DetectionPassRenderer: add readEdgeResults() method
- [ ] Remove depthMapFBO/depthMapTexture from renderer
- [ ] Update tests for simplified pipeline
- [ ] Verify DetectionPassRenderer tests still pass

### Phase 5: Replace EdgeAnalysisProcessor with VideoModeDetector
- [ ] Delete edge-analysis-processor.ts
- [ ] Delete edge-analysis-processor.spec.ts
- [ ] Update CrtRenderer: inject VideoModeDetector
- [ ] Update runDetection() method: call detectMode() instead of processCropResults()
- [ ] Remove horizontal/vertical scan render calls
- [ ] Simplify detection flow: edge detection → mode detection → crop animation
- [ ] Update CrtRenderer tests for new behavior
- [ ] Verify all tests pass (should be 66 CrtRenderer + 15 VideoModeDetector)

### Phase 6: Manual Testing & Validation
- [ ] Test with North Star game (current test case) - verify no over-cropping
- [ ] Test with known PAL standard game (320x200 thick borders)
- [ ] Test with known NTSC standard game (320x200 asymmetric)
- [ ] Test with PAL extended mode if available
- [ ] Verify smooth crop transitions maintained
- [ ] Verify top/bottom bars now removed correctly
- [ ] Verify blue spheres and colored text not cut
- [ ] Verify 60 FPS performance maintained

---

## 🎯 Definition of Done

- [ ] VideoModeDetector created with mode detection logic
- [ ] C64_VIDEO_MODE_PRESETS table defined with 6 standard modes
- [ ] Edge detection shader kept, depth scanning shaders removed
- [ ] CrtRenderer integration updated to use VideoModeDetector
- [ ] All unit tests pass (81+ total: 66 renderer + 15 detector)
- [ ] Manual testing confirms accurate cropping without over-cutting content
- [ ] Top/bottom bars now removed correctly (fixed from Phase 1.1 issues)
- [ ] No performance regression (60 FPS maintained)
- [ ] Console logging simplified and informative
- [ ] Documentation updated with video mode preset approach

---

## 📊 Success Metrics

**Before (Phase 1.1 GPU Detection)**:
- ❌ Left/right over-crops 24.7%/18.1% into content
- ❌ Top/bottom detection fails (0 depths)
- ⚠️ Cuts blue spheres, red/magenta text
- ✅ 60 FPS rendering maintained

**After (Video Mode Presets) - Target**:
- ✅ Accurate crop within ±5px of actual bars
- ✅ No content cut (blue spheres, colored text preserved)
- ✅ Top/bottom bars removed correctly
- ✅ Works for PAL standard, NTSC standard, extended modes
- ✅ Graceful fallback for non-C64 content
- ✅ 60 FPS rendering maintained

---

## 🔗 Related Tasks

**Prerequisites**:
- ✅ AUTO-CROP-BLACKBARS-TASK-01.1-001 (Edge Detection Shader)
- ✅ AUTO-CROP-BLACKBARS-TASK-01.1-003 (Renderer Integration)

**Blocks**:
- AUTO-CROP-BLACKBARS-TASK-01.1-005 (Debug Overlay) - Can proceed in parallel
- Phase 2 Tasks (Smooth Transitions & User Control) - Depends on accurate detection

**Related**:
- [Task 01.1-003 Report](../reports/AUTO-CROP-BLACKBARS-TASK-01.1-003-REPORT.md) - Documents why pivot needed

---

## 📝 Notes for Agent

**Key Decisions**:
- **Keep edge detection**: Still useful to confirm bars present before applying preset
- **Remove depth scanning**: Variance-based approach fundamentally flawed for C64 content
- **Temporal stability**: 5-frame consensus prevents mode thrashing
- **Tolerance matching**: ±10px handles upscaled/downscaled sources
- **Fallback to null**: If no mode matches, feature gracefully disables (no crop)

**User Quotes** (from conversation):
> "I wonder if we should simplify this by snapping to known C64 video modes that developers used to use back in those days"

**Design Philosophy**:
- Domain-specific solution > generic algorithm for specialized use case
- Leverage hardware standards (VIC-II chip specs) for accuracy
- Fail gracefully when assumptions don't hold (non-C64 content)

---

## ✍️ Sign-off

**Task Handoff Complete** ✅  
**Ready for Execution**: Yes  
**Blocked By**: None  
**Output Report Path**: `docs/projects/AUTO-CROP-BLACKBARS/reports/AUTO-CROP-BLACKBARS-TASK-01.1-004-REPORT.md`
