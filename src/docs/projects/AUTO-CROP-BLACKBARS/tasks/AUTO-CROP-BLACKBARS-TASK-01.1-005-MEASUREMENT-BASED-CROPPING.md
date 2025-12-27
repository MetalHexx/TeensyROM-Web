# Task 01.1-005: Measurement-Based Video Mode Detection

## 📋 Task Metadata

**Task ID**: AUTO-CROP-BLACKBARS-TASK-01.1-005-MEASUREMENT-BASED-CROPPING  
**Phase**: 1.1 - Advanced WebGL-Based Black Bar Detection  
**Assigned Agent**: UI Wizard (Clean Coder)  
**Priority**: High  
**Estimated Size**: Medium (2-3 days)  
**Status**: 🔲 Not Started  
**Depends On**: AUTO-CROP-BLACKBARS-TASK-01.1-004-VIDEO-MODE-PRESETS (completed)

---

## 🎯 Objective

Refactor the C64 video mode detection system to use **measured black bar percentages** from edge detection instead of video resolution matching. This addresses the fundamental mismatch where upscalers output fixed resolutions (e.g., 640x480, 1080p) with letterboxed/pillarboxed C64 content, making resolution-based preset matching unreliable.

The system will:
1. **Measure** actual black bar percentages on all four edges (already done by GPU edge detector)
2. **Match** to the nearest C64 preset based on **crop percentage similarity**, not resolution
3. **Use** user-selected PAL/NTSC standard to filter presets (no auto-detection)
4. **Default** to PAL as the user preference
5. **Maintain** temporal stability and smooth CropAnimator transitions

---

## 📚 Required Reading

**Prior Context**:
- [x] [Task 01.1-004](./AUTO-CROP-BLACKBARS-TASK-01.1-004-VIDEO-MODE-PRESETS.md) - Current preset-based system
- [x] [Task 01.1-003 Report](../reports/AUTO-CROP-BLACKBARS-TASK-01.1-003-REPORT.md) - GPU detection issues
- [x] Discussion thread (Dec 26, 2025) - Upscaler resolution discovery

**Technical References**:
- [ ] [Edge Detection Shader](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/shaders/edge-detect.frag.ts) - Already outputs 0-1 percentages
- [ ] [DetectionPassRenderer](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/detection-pass-renderer.ts) - Converts to boolean (needs to preserve measurements)
- [ ] [VideoModeDetector](../../../../libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/video-mode-detector.ts) - Current resolution-based matching
- [ ] [C64VideoMode Model](../../../../libs/domain/src/lib/models/c64-video-modes.model.ts) - Preset definitions with crop percentages

**Standards**:
- [ ] [Coding Standards](../../../CODING_STANDARDS.md)
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md)
- [ ] [State Management Standards](../../../STATE_STANDARDS.md)

---

## 🧠 Context & Rationale

### The Resolution Mismatch Problem

**Current System Assumption** (from Task 01.1-004):
```
Video Resolution = Native C64 Output Resolution
640x480 → 2x scaled 320x240 → NTSC Extended preset
```

**Actual User Setup**:
```
Video Upscaler → 640x480 (fixed output)
                 ├─ Contains letterboxed C64 content
                 ├─ Black bars from upscaler, not VIC-II chip
                 └─ Bar sizes vary by game/mode

Browser getUserMedia → Reports 640x480
                      └─ No resolution constraints specified
                      └─ Defaults to device's lowest resolution
```

**Why This Fails**:
1. Upscaler outputs 640x480 regardless of C64 content mode
2. System matches 640x480 → 320x240 (2x scale) → NTSC Extended
3. Applies preset crop values (8% top, 16.25% bottom, 8.9% sides)
4. **But actual black bars don't match preset** - causes overcropping or undercropping

**Real-World Example** (North Star game):
```
Resolution: 640x480 (upscaler output)
Edge Detection: {left: true, top: true, right: true, bottom: true} (all edges)
System Action: Applies NTSC Extended crop (8%/16.25%/8.9%)
Result: Content gets cut off - overcropping ❌
```

### What the Edge Detector Already Measures

The GPU edge detection shader **already calculates** black bar percentages:

```glsl
// edge-detect.frag.ts (existing code)
float sampleEdge(vec2 startPos, vec2 stepDir) {
  int blackCount = 0;
  
  for (int i = 0; i < SAMPLES_PER_EDGE; i++) {
    // ...sample pixel, check if black...
    if (luminance < BLACK_LUMINANCE_THRESHOLD && saturation < BLACK_SATURATION_THRESHOLD) {
      blackCount++;
    }
  }
  
  return float(blackCount) / float(SAMPLES_PER_EDGE); // ✅ Returns 0.0-1.0 percentage
}

void main() {
  // Sample all four edges
  float leftEdge = sampleEdge(...);    // e.g., 0.95 = 95% black pixels
  float topEdge = sampleEdge(...);     // e.g., 0.88 = 88% black pixels
  float rightEdge = sampleEdge(...);   // e.g., 0.92 = 92% black pixels
  float bottomEdge = sampleEdge(...);  // e.g., 0.15 = 15% black pixels
  
  gl_FragColor = vec4(leftEdge, topEdge, rightEdge, bottomEdge); // ✅ Raw measurements
}
```

**But then we throw away the measurements:**

```typescript
// detection-pass-renderer.ts (current code - PROBLEM)
readEdgeResults(): { left: boolean; top: boolean; right: boolean; bottom: boolean } {
  const pixels = new Uint8Array(4);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  
  const threshold = 0.85;
  return {
    left: pixels[0] / 255 > threshold,   // ❌ 0.95 becomes "true" - measurement lost
    top: pixels[1] / 255 > threshold,    // ❌ 0.88 becomes "true" - measurement lost
    right: pixels[2] / 255 > threshold,  // ❌ 0.92 becomes "true" - measurement lost
    bottom: pixels[3] / 255 > threshold  // ❌ 0.15 becomes "false" - measurement lost
  };
}
```

**We need to preserve these measurements** and use them for preset matching.

---

## ✅ Success Criteria

**Functional Requirements**:
- [ ] Edge detector returns **percentage measurements** (0-1) for all four edges
- [ ] VideoModeDetector matches presets by **crop percentage similarity**, not resolution
- [ ] User-selected `videoStandard` (PAL/NTSC) filters preset candidates
- [ ] System defaults to PAL when no setting exists
- [ ] Ignores video resolution entirely (works with 640x480, 1080p, 4K upscalers)
- [ ] Maintains temporal stability (5-frame history consensus)
- [ ] CropAnimator smooth transitions unchanged
- [ ] Feature toggle (`autoCropBlackBars`) still respected

**Quality Requirements**:
- [ ] All existing tests pass (201+ tests)
- [ ] New tests for percentage-based matching (10+ tests)
- [ ] No performance regression (maintain 60 FPS)
- [ ] Console logs show measured percentages for debugging

**User Experience**:
- [ ] North Star game: Content not cut off ✅
- [ ] Works with any upscaler resolution (640x480, 720p, 1080p)
- [ ] Works with PAL games (320x200 with thick borders)
- [ ] Works with NTSC games (320x200 with asymmetric bars)
- [ ] No overcropping into content

---

## 📐 Technical Design

### Updated Architecture: Measurement-Based Matching

**Current Pipeline** (from Task 01.1-004):
```
┌─────────────────────────────────────────────────────────────────┐
│ Pass 1: Edge Detection Shader                                   │
│ - Samples 20 points per edge, calculates black percentage       │
│ - Output: RGBA = (left%, top%, right%, bottom%) as 0-1 floats   │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ DetectionPassRenderer.readEdgeResults()                          │
│ ❌ CURRENT: Converts to boolean (threshold > 0.85)              │
│ ✅ NEW: Returns raw percentages {left: 0.95, top: 0.88, ...}   │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ VideoModeDetector.detectMode()                                   │
│ ❌ CURRENT: Matches resolution to presets, returns preset crops │
│ ✅ NEW: Matches MEASURED percentages to preset crops           │
│                                                                  │
│ Algorithm:                                                       │
│ 1. Read measured edge percentages (0-1 for each edge)           │
│ 2. Filter presets by user's videoStandard (PAL/NTSC)           │
│ 3. Calculate similarity score for each preset:                  │
│    score = |measured.left - preset.left| +                     │
│            |measured.top - preset.top| +                       │
│            |measured.right - preset.right| +                   │
│            |measured.bottom - preset.bottom|                   │
│ 4. Select preset with lowest score (best match)                │
│ 5. Require temporal stability (5 consecutive frames)            │
│ 6. Return matched preset's crop values                          │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ CropAnimator (UNCHANGED)                                         │
│ - Smooth interpolation to preset crop values                    │
└─────────────────────────────────────────────────────────────────┘
```

### Key Changes

#### 1. Update Edge Detection Result Interface

```typescript
// libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/video-mode-detector.ts

// ❌ OLD: Boolean flags
export interface EdgeDetectionResult {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

// ✅ NEW: Percentage measurements
export interface EdgeDetectionMeasurements {
  left: number;   // 0-1: Percentage of edge that is black (e.g., 0.95 = 95% black)
  top: number;    // 0-1: Percentage of edge that is black
  right: number;  // 0-1: Percentage of edge that is black
  bottom: number; // 0-1: Percentage of edge that is black
}
```

#### 2. Update DetectionPassRenderer to Return Measurements

```typescript
// libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/detection-pass-renderer.ts

export class DetectionPassRenderer {
  /**
   * Read edge detection measurements from the 1x1 edge map texture.
   * 
   * Returns raw percentage values (0-1) indicating how much of each edge is black.
   * These measurements are used for preset matching, not boolean validation.
   * 
   * @returns Object with percentage measurements for each edge, or null if no edge map exists
   */
  readEdgeMeasurements(): EdgeDetectionMeasurements | null {
    const gl = this.gl;

    if (!this.edgeMapFBO || !this.edgeMapTexture) {
      return null;
    }

    // Bind edge map framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.edgeMapFBO);

    // Read single pixel at (0,0) containing all edge results
    const pixels = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Unbind framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Convert 0-255 to 0.0-1.0 percentages (NO thresholding - preserve measurements)
    return {
      left: pixels[0] / 255,    // e.g., 242/255 = 0.949 = 94.9% black
      top: pixels[1] / 255,     // e.g., 224/255 = 0.878 = 87.8% black
      right: pixels[2] / 255,   // e.g., 235/255 = 0.922 = 92.2% black
      bottom: pixels[3] / 255   // e.g., 38/255 = 0.149 = 14.9% black
    };
  }
  
  // Add helper method for validation (optional - for UI debugging)
  hasSignificantBars(measurements: EdgeDetectionMeasurements, threshold = 0.7): boolean {
    const detectedCount = [
      measurements.left > threshold,
      measurements.top > threshold,
      measurements.right > threshold,
      measurements.bottom > threshold
    ].filter(Boolean).length;
    
    return detectedCount >= 2; // At least 2 edges must have significant bars
  }
}
```

#### 3. Update VideoModeDetector to Match by Percentage

```typescript
// libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/video-mode-detector.ts

export class VideoModeDetector {
  private detectionHistory: C64VideoMode[] = [];
  private readonly HISTORY_SIZE = 5;

  /**
   * Detect C64 video mode from MEASURED black bar percentages.
   * 
   * Ignores video resolution (works with any upscaler output).
   * Matches measured bar percentages to preset crop values.
   * 
   * @param measurements - Measured black bar percentages (0-1) for each edge
   * @param videoStandard - User-selected video standard (PAL or NTSC)
   * @returns Crop rectangle if mode matched and stable, null otherwise
   */
  detectMode(
    measurements: EdgeDetectionMeasurements,
    videoStandard: 'PAL' | 'NTSC'
  ): CropRect | null {
    // Step 1: Validate measurements show significant bars
    if (!this.hasSufficientBars(measurements)) {
      console.log('[VideoModeDetector] Insufficient black bars detected:', measurements);
      return null;
    }

    // Step 2: Filter presets by user's selected standard
    const standardPresets = C64_VIDEO_MODE_PRESETS.filter(
      (mode) => mode.region === videoStandard
    );

    // Step 3: Find preset with most similar crop percentages
    const matchedMode = this.findBestMatchByPercentage(measurements, standardPresets);

    if (!matchedMode) {
      console.log('[VideoModeDetector] No preset match for measurements:', {
        measurements,
        videoStandard
      });
      return null;
    }

    // Step 4: Add to history for temporal stability
    this.detectionHistory.push(matchedMode);
    if (this.detectionHistory.length > this.HISTORY_SIZE) {
      this.detectionHistory.shift();
    }

    // Step 5: Require consensus across history
    if (!this.hasStableMode()) {
      console.log('[VideoModeDetector] Waiting for stable mode detection', {
        historySize: this.detectionHistory.length,
        requiredSize: this.HISTORY_SIZE,
        recentModes: this.detectionHistory.map((m) => m.name)
      });
      return null;
    }

    // Step 6: Convert preset crop percentages to CropRect
    const crop = this.convertToCropRect(matchedMode);
    console.log(`[VideoModeDetector] Mode detected: ${matchedMode.name} (${videoStandard})`, {
      measurements,
      presetCrops: matchedMode.cropPercent,
      appliedCrop: crop,
      stability: `${this.detectionHistory.length}/${this.HISTORY_SIZE} frames`
    });

    return crop;
  }

  /**
   * Find preset with crop percentages most similar to measured bar percentages.
   * 
   * Uses Manhattan distance (sum of absolute differences) as similarity metric.
   * Lower score = better match.
   * 
   * @param measurements - Measured black bar percentages
   * @param presets - Filtered list of presets (by video standard)
   * @returns Best matching preset, or null if no good match found
   */
  private findBestMatchByPercentage(
    measurements: EdgeDetectionMeasurements,
    presets: C64VideoMode[]
  ): C64VideoMode | null {
    let bestMatch: C64VideoMode | null = null;
    let bestScore = Infinity;
    const MAX_ACCEPTABLE_DIFFERENCE = 0.5; // Max 50% total difference across all edges

    for (const preset of presets) {
      // Calculate similarity score (Manhattan distance)
      // Note: Measurements are edge percentages, preset.cropPercent are crop amounts
      // For matching purposes, a high edge percentage (e.g., 0.95) means that edge has a bar
      // We want to match this to presets that crop that edge (e.g., cropPercent.left > 0)
      
      const score =
        Math.abs(measurements.left - preset.cropPercent.left) +
        Math.abs(measurements.top - preset.cropPercent.top) +
        Math.abs(measurements.right - preset.cropPercent.right) +
        Math.abs(measurements.bottom - preset.cropPercent.bottom);

      console.log(`[VideoModeDetector] Comparing to ${preset.name}:`, {
        measurements,
        presetCrops: preset.cropPercent,
        score: score.toFixed(3)
      });

      if (score < bestScore) {
        bestScore = score;
        bestMatch = preset;
      }
    }

    // Reject match if difference is too large
    if (bestScore > MAX_ACCEPTABLE_DIFFERENCE) {
      console.log('[VideoModeDetector] Best match rejected (difference too large):', {
        bestMode: bestMatch?.name,
        score: bestScore.toFixed(3),
        threshold: MAX_ACCEPTABLE_DIFFERENCE
      });
      return null;
    }

    return bestMatch;
  }

  /**
   * Check if measurements show sufficient black bars to warrant cropping.
   * 
   * Requires at least 2 edges with >70% black pixels to avoid false positives.
   * Open border modes are exempt (might show colored borders, not black).
   * 
   * @param measurements - Measured black bar percentages
   * @returns True if sufficient bars detected
   */
  private hasSufficientBars(measurements: EdgeDetectionMeasurements): boolean {
    const THRESHOLD = 0.7; // 70% of edge must be black
    
    const detectedCount = [
      measurements.left > THRESHOLD,
      measurements.top > THRESHOLD,
      measurements.right > THRESHOLD,
      measurements.bottom > THRESHOLD
    ].filter(Boolean).length;

    return detectedCount >= 2;
  }

  private hasStableMode(): boolean {
    if (this.detectionHistory.length < this.HISTORY_SIZE) {
      return false;
    }

    const recentMode = this.detectionHistory[this.detectionHistory.length - 1];
    return this.detectionHistory.every((mode) => mode.name === recentMode.name);
  }

  private convertToCropRect(mode: C64VideoMode): CropRect {
    const { top, bottom, left, right } = mode.cropPercent;

    return {
      left: left,
      top: top,
      width: 1 - left - right,
      height: 1 - top - bottom
    };
  }

  reset(): void {
    this.detectionHistory = [];
    console.log('[VideoModeDetector] History reset');
  }
}
```

#### 4. Update CrtRenderer Integration

```typescript
// libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts

private runDetection(): void {
  const videoWidth = this.videoElement?.videoWidth || this.imageElement?.naturalWidth || this.canvas.width;
  const videoHeight = this.videoElement?.videoHeight || this.imageElement?.naturalHeight || this.canvas.height;

  // Pass 1: Edge detection (unchanged)
  this.detectionPassRenderer.renderEdgeDetection(
    this.videoTexture,
    videoWidth,
    videoHeight
  );

  // Read edge measurements (NEW - preserve percentages, not boolean)
  const measurements = this.detectionPassRenderer.readEdgeMeasurements();

  console.log('[CrtRenderer] Edge measurements:', measurements, 
    'videoStandard:', this.pendingSettings.videoStandard,
    'source dims:', videoWidth, 'x', videoHeight);

  if (measurements) {
    // Pass 2: Detect C64 video mode from measurements (ignores resolution)
    const cropRect = this.videoModeDetector.detectMode(
      measurements, // NEW - pass measurements instead of resolution
      this.pendingSettings.videoStandard
    );

    console.log('[CrtRenderer] VideoModeDetector result:', cropRect);

    if (this.cropAnimator) {
      if (cropRect) {
        // Validate crop rect before applying
        const isValid =
          cropRect.left >= 0 && cropRect.left <= 1 &&
          cropRect.top >= 0 && cropRect.top <= 1 &&
          cropRect.width > 0 && cropRect.width <= 1 &&
          cropRect.height > 0 && cropRect.height <= 1 &&
          (cropRect.left + cropRect.width) <= 1.001 &&
          (cropRect.top + cropRect.height) <= 1.001;

        if (isValid) {
          this.cropAnimator.setTarget(cropRect);
        } else {
          console.warn('[CrtRenderer] Invalid crop rejected:', cropRect);
        }
      } else {
        // Reset crop when no bars detected
        this.cropAnimator.setTarget({
          left: 0,
          top: 0,
          width: 1,
          height: 1
        });
      }
    }
  }
}
```

---

## 🧪 Testing Strategy

### Unit Tests: DetectionPassRenderer

```typescript
// libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/detection-pass-renderer.spec.ts

describe('DetectionPassRenderer - Measurement Extraction', () => {
  it('should return raw percentage measurements (not thresholded)', () => {
    // Mock gl.readPixels to return specific values
    const mockPixels = new Uint8Array([242, 224, 235, 38]); // 95%, 88%, 92%, 15%
    mockGl._mocks.readPixels.mockImplementation((...args) => {
      const pixels = args[6]; // 7th argument is the output array
      pixels[0] = mockPixels[0];
      pixels[1] = mockPixels[1];
      pixels[2] = mockPixels[2];
      pixels[3] = mockPixels[3];
    });

    renderer.renderEdgeDetection(mockVideoTexture, 640, 480);
    const measurements = renderer.readEdgeMeasurements();

    expect(measurements).not.toBeNull();
    expect(measurements!.left).toBeCloseTo(0.949, 3);   // 242/255
    expect(measurements!.top).toBeCloseTo(0.878, 3);    // 224/255
    expect(measurements!.right).toBeCloseTo(0.922, 3);  // 235/255
    expect(measurements!.bottom).toBeCloseTo(0.149, 3); // 38/255
  });

  it('should return null when no edge map exists', () => {
    const measurements = renderer.readEdgeMeasurements();
    expect(measurements).toBeNull();
  });
});
```

### Unit Tests: VideoModeDetector

```typescript
// libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/video-mode-detector.spec.ts

describe('VideoModeDetector - Measurement-Based Matching', () => {
  let detector: VideoModeDetector;

  beforeEach(() => {
    detector = new VideoModeDetector();
  });

  // Helper to run detection multiple times for stability
  const detectStable = (
    measurements: EdgeDetectionMeasurements,
    standard: 'PAL' | 'NTSC',
    count = 5
  ) => {
    let result = null;
    for (let i = 0; i < count; i++) {
      result = detector.detectMode(measurements, standard);
    }
    return result;
  };

  describe('PAL Standard Mode Matching', () => {
    it('should match PAL Standard when measurements align with preset crops', () => {
      // PAL Standard preset: {top: 0.11, bottom: 0.25, left: 0.1, right: 0.1}
      // Simulate measurements close to these values
      const measurements: EdgeDetectionMeasurements = {
        left: 0.95,   // High percentage = significant bar
        top: 0.88,    // High percentage = significant bar
        right: 0.92,  // High percentage = significant bar
        bottom: 0.85  // High percentage = significant bar
      };

      const result = detectStable(measurements, 'PAL');

      expect(result).not.toBeNull();
      expect(result!.left).toBeCloseTo(0.1, 2);
      expect(result!.top).toBeCloseTo(0.11, 2);
      expect(result!.width).toBeCloseTo(0.8, 2);
      expect(result!.height).toBeCloseTo(0.64, 2);
    });

    it('should NOT match when measurements differ significantly from all presets', () => {
      // Measurements that don't match any preset
      const measurements: EdgeDetectionMeasurements = {
        left: 0.50,   // Medium bar
        top: 0.20,    // Small bar
        right: 0.50,  // Medium bar
        bottom: 0.90  // Large bar (unusual pattern)
      };

      const result = detectStable(measurements, 'PAL');

      expect(result).toBeNull(); // No good match found
    });
  });

  describe('NTSC Extended Mode Matching', () => {
    it('should match NTSC Extended when measurements align with preset', () => {
      // NTSC Extended preset: {top: 0.08, bottom: 0.1625, left: 0.089, right: 0.089}
      const measurements: EdgeDetectionMeasurements = {
        left: 0.85,
        top: 0.82,
        right: 0.87,
        bottom: 0.80
      };

      const result = detectStable(measurements, 'NTSC');

      expect(result).not.toBeNull();
      // Should apply NTSC Extended crops
      expect(result!.top).toBeCloseTo(0.08, 2);
      expect(result!.left).toBeCloseTo(0.089, 2);
    });
  });

  describe('Video Standard Filtering', () => {
    it('should only consider PAL presets when standard=PAL', () => {
      // Measurements that match NTSC Extended better than any PAL preset
      const measurements: EdgeDetectionMeasurements = {
        left: 0.85,
        top: 0.82,
        right: 0.87,
        bottom: 0.80
      };

      // Force PAL standard - should find best PAL match, not NTSC
      const result = detectStable(measurements, 'PAL');

      expect(result).not.toBeNull();
      // Should match a PAL preset (PAL Standard or PAL Extended), not NTSC
    });

    it('should only consider NTSC presets when standard=NTSC', () => {
      const measurements: EdgeDetectionMeasurements = {
        left: 0.95,
        top: 0.90,
        right: 0.92,
        bottom: 0.88
      };

      const result = detectStable(measurements, 'NTSC');

      expect(result).not.toBeNull();
      // Should match NTSC Standard or NTSC Extended, not PAL
    });
  });

  describe('Insufficient Bar Detection', () => {
    it('should return null when <2 edges have significant bars', () => {
      // Only 1 edge above 70% threshold
      const measurements: EdgeDetectionMeasurements = {
        left: 0.85,   // Above threshold
        top: 0.60,    // Below threshold
        right: 0.55,  // Below threshold
        bottom: 0.40  // Below threshold
      };

      const result = detectStable(measurements, 'PAL');

      expect(result).toBeNull();
    });

    it('should accept when >=2 edges have significant bars', () => {
      const measurements: EdgeDetectionMeasurements = {
        left: 0.85,   // Above threshold
        top: 0.75,    // Above threshold
        right: 0.60,  // Below threshold
        bottom: 0.55  // Below threshold
      };

      const result = detectStable(measurements, 'PAL');

      expect(result).not.toBeNull();
    });
  });

  describe('Temporal Stability', () => {
    it('should require 5 consecutive matching detections', () => {
      const measurements: EdgeDetectionMeasurements = {
        left: 0.95,
        top: 0.88,
        right: 0.92,
        bottom: 0.85
      };

      // Detection 1-4: should return null (not stable yet)
      for (let i = 0; i < 4; i++) {
        const result = detector.detectMode(measurements, 'PAL');
        expect(result).toBeNull();
      }

      // Detection 5: should return crop (now stable)
      const result = detector.detectMode(measurements, 'PAL');
      expect(result).not.toBeNull();
    });

    it('should reject thrashing between modes', () => {
      const palMeasurements: EdgeDetectionMeasurements = {
        left: 0.95, top: 0.88, right: 0.92, bottom: 0.85
      };
      const ntscMeasurements: EdgeDetectionMeasurements = {
        left: 0.85, top: 0.82, right: 0.87, bottom: 0.80
      };

      // Alternate between PAL and NTSC-like measurements
      detector.detectMode(palMeasurements, 'PAL');
      detector.detectMode(ntscMeasurements, 'PAL');
      detector.detectMode(palMeasurements, 'PAL');
      detector.detectMode(ntscMeasurements, 'PAL');
      const result = detector.detectMode(palMeasurements, 'PAL');

      expect(result).toBeNull(); // No consensus
    });
  });

  describe('Resolution Independence', () => {
    it('should produce same result for 640x480 and 1080p with same bar percentages', () => {
      const measurements: EdgeDetectionMeasurements = {
        left: 0.95,
        top: 0.88,
        right: 0.92,
        bottom: 0.85
      };

      // Detection doesn't take resolution as input anymore
      const result1 = detectStable(measurements, 'PAL');
      
      detector.reset();
      
      // Same measurements, should get same preset match
      const result2 = detectStable(measurements, 'PAL');

      expect(result1).toEqual(result2);
    });
  });
});
```

### Integration Tests: CrtRenderer

```typescript
// libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.spec.ts

describe('CrtRenderer - Measurement-Based Detection Integration', () => {
  it('should pass measurements (not resolution) to VideoModeDetector', () => {
    const mockMeasurements: EdgeDetectionMeasurements = {
      left: 0.95, top: 0.88, right: 0.92, bottom: 0.85
    };
    
    vi.spyOn(detectionPassRenderer, 'readEdgeMeasurements').mockReturnValue(mockMeasurements);
    const detectModeSpy = vi.spyOn(videoModeDetector, 'detectMode');

    renderer.render();

    expect(detectModeSpy).toHaveBeenCalledWith(
      mockMeasurements,
      'PAL' // or 'NTSC' depending on settings
    );
    // Should NOT pass videoWidth/videoHeight
  });

  it('should work with 640x480 upscaler output', () => {
    // Simulate upscaler outputting 640x480 with letterboxed C64 content
    mockVideoElement.videoWidth = 640;
    mockVideoElement.videoHeight = 480;
    
    const measurements: EdgeDetectionMeasurements = {
      left: 0.95, top: 0.88, right: 0.92, bottom: 0.85
    };
    
    vi.spyOn(detectionPassRenderer, 'readEdgeMeasurements').mockReturnValue(measurements);

    renderer.render();

    // Should detect mode based on measurements, not resolution
    expect(cropAnimator.setTarget).toHaveBeenCalled();
  });

  it('should work with 1080p upscaler output', () => {
    // Same test but with 1080p resolution
    mockVideoElement.videoWidth = 1920;
    mockVideoElement.videoHeight = 1080;
    
    const measurements: EdgeDetectionMeasurements = {
      left: 0.95, top: 0.88, right: 0.92, bottom: 0.85
    };
    
    vi.spyOn(detectionPassRenderer, 'readEdgeMeasurements').mockReturnValue(measurements);

    renderer.render();

    // Should produce same result as 640x480 test
    expect(cropAnimator.setTarget).toHaveBeenCalled();
  });
});
```

---

## 📂 Files to Modify

### Domain Layer

```
📝 libs/domain/src/lib/models/crt-settings.model.ts
   Change: Ensure videoStandard defaults to 'PAL'
   Location: DEFAULT_CRT_SETTINGS constant

📝 libs/domain/src/lib/models/c64-video-modes.model.ts
   Changes:
   - Adjust cropPercent values in C64_VIDEO_MODE_PRESETS based on measured data
   - Update preset values for PAL Standard, PAL Extended, NTSC Standard, NTSC Extended
   - Document measurement data in comments
```

### Infrastructure Layer

```
📝 libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/video-mode-detector.ts
   Changes:
   - Update EdgeDetectionResult → EdgeDetectionMeasurements (percentages)
   - Remove resolution-based matching (findBestMatch method)
   - Add percentage-based matching (findBestMatchByPercentage method)
   - Update detectMode() signature to take measurements instead of dimensions
   - Update logging to show measurements and comparison scores

📝 libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/detection-pass-renderer.ts
   Changes:
   - Rename readEdgeResults() → readEdgeMeasurements()
   - Remove threshold conversion, return raw 0-1 percentages
   - Update JSDoc to explain measurement preservation
   - Add optional helper method hasSignificantBars() for validation
```

### UI Layer

```
📝 libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts
   Changes:
   - Update runDetection() to call readEdgeMeasurements()
   - Pass measurements to videoModeDetector.detectMode() instead of resolution
   - Update console logging to show measurements
   - Remove videoWidth/videoHeight from detectMode() call
```

### Tests

```
📝 libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/detection-pass-renderer.spec.ts
   Changes:
   - Update tests for readEdgeMeasurements() (preserve percentages)
   - Add tests for raw measurement extraction
   - Remove boolean threshold tests

📝 libs/ui/components/src/lib/crt-effect-wrapper/webgl/detection/video-mode-detector.spec.ts
   Changes:
   - Update all tests to use EdgeDetectionMeasurements
   - Replace resolution-based matching tests with percentage-based tests
   - Add tests for similarity scoring
   - Add tests for insufficient bar detection
   - Add tests for resolution independence

📝 libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.spec.ts
   Changes:
   - Update integration tests to use measurements
   - Add tests for 640x480 and 1080p upscaler scenarios
   - Verify resolution is ignored in detection
```

---

## 🚧 Implementation Checklist

### Phase 1: Update Interfaces & Data Flow
- [ ] Update `EdgeDetectionResult` → `EdgeDetectionMeasurements` interface
- [ ] Update `DetectionPassRenderer.readEdgeMeasurements()` to return raw percentages
- [ ] Update `VideoModeDetector.detectMode()` signature (remove resolution params, add measurements)
- [ ] Update `CrtRenderer` to pass measurements instead of resolution
- [ ] Verify compilation succeeds

### Phase 2: Implement Percentage-Based Matching
- [ ] Implement `VideoModeDetector.findBestMatchByPercentage()` method
- [ ] Implement `VideoModeDetector.hasSufficientBars()` validation
- [ ] Update detection logging to show measurements and scores
- [ ] Remove old resolution-based matching code
- [ ] Verify no references to videoWidth/videoHeight in detection logic

### Phase 3: Adjust Preset Crop Values
- [ ] Add logging to output measured edge percentages for test games
- [ ] Test North Star game - record measured percentages
- [ ] Test additional PAL/NTSC games - record measured percentages
- [ ] Analyze measurement patterns across games
- [ ] Adjust preset crop percentages in `C64_VIDEO_MODE_PRESETS` to match typical measurements:
  - [ ] PAL Standard crop values
  - [ ] PAL Extended crop values
  - [ ] NTSC Standard crop values
  - [ ] NTSC Extended crop values
- [ ] Document measurement data and rationale for adjustments
- [ ] Verify adjusted presets match well across test games

### Phase 4: Write Unit Tests
- [ ] Test DetectionPassRenderer measurement extraction
- [ ] Test VideoModeDetector percentage matching (10+ tests)
- [ ] Test temporal stability with measurement inputs
- [ ] Test insufficient bar detection
- [ ] Test video standard filtering (PAL/NTSC)
- [ ] Test resolution independence
- [ ] Update tests with adjusted preset values
- [ ] Verify all 15+ new tests pass

### Phase 5: Integration & Manual Testing
- [ ] Run full test suite (ensure 201+ tests pass)
- [ ] Test with North Star game (verify content not cut off)
- [ ] Test with different upscaler resolutions (640x480, 720p, 1080p)
- [ ] Test with PAL games (thick borders)
- [ ] Test with NTSC games (asymmetric bars)
- [ ] Verify smooth crop transitions maintained

### Phase 6: Documentation & Cleanup
- [ ] Update JSDoc comments with measurement-based approach
- [ ] Remove obsolete resolution-matching comments
- [ ] Simplify console logging (remove noisy debug output)
- [ ] Update task report with results
- [ ] Document any preset crop adjustments needed

---

## 📊 Definition of Done

- [ ] All code changes implemented and compiling
- [ ] All existing tests passing (201+ tests)
- [ ] All new tests passing (15+ measurement tests)
- [ ] Manual testing confirms:
  - [ ] North Star game works correctly (no content cutoff)
  - [ ] Works with 640x480 upscaler
  - [ ] Works with 1080p upscaler
  - [ ] PAL games crop correctly
  - [ ] NTSC games crop correctly (asymmetric)
- [ ] No performance regression (<60 FPS)
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Task report created

---

## 🔗 Dependencies

**Blocks**:
- None (this is a refinement of Task 01.1-004)

**Blocked By**:
- AUTO-CROP-BLACKBARS-TASK-01.1-004-VIDEO-MODE-PRESETS (must be completed first)

---

## 📝 Notes

**Key Insight**: The edge detection shader already outputs the exact information we need (0-1 percentages), but we were throwing it away by converting to boolean. This refactor simply preserves and uses those measurements for smarter preset matching.

**Why This Solves Overcropping**:
- Upscalers output fixed resolutions (640x480, 1080p) regardless of content
- Resolution-based matching incorrectly assumes 640x480 = 2x scaled C64 (320x240)
- Measurement-based matching looks at **actual bar sizes** in the video
- Works with any upscaler resolution
- More robust to content variations

**Backward Compatibility**:
- User settings unchanged (videoStandard still used)
- CropAnimator transitions unchanged
- Feature toggle (`autoCropBlackBars`) still works
- Preset crop values **will be adjusted** based on measured data from test games
- No breaking changes to public APIs

**Future Enhancements** (not in this task):
- Auto-detect videoStandard from TeensyROM device
- Add preset for "no bars" mode (full-screen content)
- User-adjustable similarity threshold
- Preset editor UI for fine-tuning crops per-game
