# Subagent Task Handoff Document

## 📋 Task Identity

**Task ID**: AUTO-CROP-BLACKBARS-TASK-02-001-CONFIDENCE-ANTI-THRASH  
**Task Name**: Confidence Scoring & Anti-Thrash Logic for Animated Border Stability  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: **CRITICAL** - Addressing production stability issue  
**Estimated Context Size**: Medium-Large (8-12 files)

---

## 🎯 Objective

**What**: Implement confidence scoring, temporal stability tracking, and hysteresis logic in the `VideoModeDetector` to prevent mode bouncing when game intros display animated/flickering colored borders that create false black bar detections across successive frames.

**Why**: The current system is experiencing stability issues during game intros where borders flicker between colors (e.g., the green bars in the provided screenshot). This causes the edge detection to bounce between "bars detected" and "no bars detected" states, creating a jarring crop-in/crop-out visual effect that degrades user experience.

**Success Criteria**:
- [ ] Detection requires 5+ consecutive matching video modes before committing crop (temporal stability)
- [ ] Edge consistency scoring prevents false positives from animated/flickering borders
- [ ] System holds last known good crop during unstable detection periods
- [ ] Mode bouncing eliminated in test scenarios (game intros with animated borders)
- [ ] Normal content (static borders) still detects and crops within 1-2 seconds
- [ ] All unit tests pass with >90% coverage
- [ ] Manual testing confirms stable behavior with problematic content

---

## 🔍 Context & Dependencies

### Prerequisites Completed

- ✅ **AUTO-CROP-BLACKBARS-TASK-01.1-004-VIDEO-MODE-PRESETS**: Video mode preset system with scale detection and edge validation
- ✅ Phase 1.1 complete: Edge detection shaders, depth scanning, renderer integration

### Current Implementation State

**Files to Understand**:
- `libs/ui/components/src/lib/crt-effect-wrapper/detection/video-mode-detector.ts` - Current detector with basic temporal stability (5-frame consensus)
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts` - Renderer integration, calls detector every frame
- `libs/domain/src/lib/models/c64-video-modes.model.ts` - Video mode presets with crop percentages

**Current Behavior**:
- Detector requires 5 frames of same mode before committing (exists but insufficient)
- Edge validation uses HSV saturation check (`shouldApplyCrop()` method)
- No edge consistency scoring - accepts any mode that passes threshold
- No hysteresis beyond frame counting - doesn't distinguish stable vs unstable edges

**The Problem**:
When game intros animate borders (flickering colors like the green bars in the image), the edge detector sees different saturation values across frames:
```
Frame 1: Green borders → Low saturation → "Black bars detected" → Mode: PAL Extended
Frame 2: Darker green → High saturation → "Not black bars" → Mode: PAL Standard  
Frame 3: Bright green → Low saturation → "Black bars detected" → Mode: PAL Extended
... bounces back and forth
```

The 5-frame consensus is reset every time the mode changes, so it never stabilizes.

### Dependencies

- **No new external dependencies** - uses existing WebGL and domain models
- **Existing services**: VideoModeDetector, CrtRenderer
- **Domain models**: C64VideoMode, CrtSettings, CropRect

### Constraints

- **Performance**: Detection must remain <2ms per frame (currently ~1ms)
- **Accuracy**: Must not break existing functionality for static borders
- **Responsiveness**: Normal content should still detect within 1-2 seconds
- **Memory**: Circular history buffer must be bounded (max 60 samples = 1 second at 60fps)

---

## 📂 File Scope

### Files to Modify

**Primary Implementation**:
```
📝 libs/ui/components/src/lib/crt-effect-wrapper/detection/video-mode-detector.ts
   Changes:
   - Add DetectionHistory interface with edge consistency metrics
   - Implement calculateEdgeConsistency() method
   - Implement calculateTemporalStability() method  
   - Add confidence scoring combining consistency + stability
   - Modify hasStableMode() to require high confidence, not just frame count
   - Add detection freeze logic for very low confidence periods
   - Expand history tracking beyond just mode (include edge metrics)

📝 libs/ui/components/src/lib/crt-effect-wrapper/detection/video-mode-detector.spec.ts
   Changes:
   - Add tests for edge consistency calculation
   - Add tests for temporal stability calculation
   - Add tests for confidence scoring formula
   - Add tests for hysteresis behavior (high-confidence streak)
   - Add tests for animated border scenario (flickering modes)
   - Add tests for detection freeze during very low confidence

📝 libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts
   Changes:
   - Read confidence score from detector result
   - Only update crop animator when confidence is sufficient
   - Add detection state tracking ("Detecting", "High Confidence", "Holding")
   - Log state transitions for debugging (console.debug)
```

**Supporting Test Files**:
```
📝 libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.spec.ts
   Changes:
   - Add integration test: low confidence doesn't update crop
   - Add integration test: high confidence commits crop after streak
   - Add integration test: confidence streak interrupted by low confidence resets counter
   - Add test: detection state transitions correctly
```

### Files to Review (Context Only)

```
👀 libs/ui/components/src/lib/crt-effect-wrapper/detection/edge-analysis-processor.ts
   Relevance: Contains edge metrics calculation that informs consistency scoring
   
👀 libs/domain/src/lib/models/c64-video-modes.model.ts
   Relevance: Video mode presets define expected crop values
   
👀 docs/projects/AUTO-CROP-BLACKBARS/reports/AUTO-CROP-BLACKBARS-TASK-01.1-004-REPORT.md
   Relevance: Context on current implementation and known issues
```

---

## 🛠️ Implementation Guidance

### Standards to Follow

- [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript conventions, class design
- [Testing Standards](../../../TESTING_STANDARDS.md) - Behavioral testing approach
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Integration testing patterns

### Key Requirements

#### 1. Edge Consistency Scoring

**Purpose**: Detect when edge characteristics are stable vs flickering across frames.

**Approach**:
- Track edge metrics over last N frames (suggest N=10 for 160ms history at 60fps)
- Calculate variance/standard deviation of edge saturation values
- Low variance = stable edge (high consistency score)
- High variance = animated/flickering edge (low consistency score)

**Suggested Metric**:
```typescript
interface EdgeMetrics {
  topSaturation: number;    // 0-1 (from HSV)
  bottomSaturation: number;
  leftSaturation: number;
  rightSaturation: number;
}

calculateEdgeConsistency(history: EdgeMetrics[]): number {
  // Calculate coefficient of variation (CV) for each edge
  // CV = stdDev / mean (normalized measure of variance)
  // Return: 1.0 - averageCV (so stable = high score, unstable = low score)
  // Range: 0 (very inconsistent) to 1 (perfectly consistent)
}
```

**Anti-Pattern**: Don't use absolute variance - normalized measures (CV or relative std dev) work better across different brightness ranges.

#### 2. Temporal Stability Scoring

**Purpose**: Measure how similar consecutive mode detections are.

**Approach**:
- Track last N detected modes (not just count of same mode)
- Calculate percentage of frames matching current candidate mode
- High percentage = stable detection
- Low percentage = mode is bouncing

**Suggested Metric**:
```typescript
interface ModeHistory {
  mode: C64VideoMode | null;
  edgeMetrics: EdgeMetrics;
  timestamp: number;
}

calculateTemporalStability(history: ModeHistory[], currentMode: C64VideoMode): number {
  // Count frames in history matching currentMode
  // Return: matchCount / historyLength
  // Range: 0 (no matches) to 1 (all match)
}
```

#### 3. Confidence Score Formula

**Purpose**: Combine edge consistency and temporal stability into single confidence metric.

**Formula**:
```
confidence = (edgeConsistency * 0.6) + (temporalStability * 0.4)
```

**Rationale**: Edge consistency weighted higher (60%) because it's the primary indicator of animation. Temporal stability (40%) confirms the pattern persists.

**Confidence Threshold**: Require `confidence > 0.75` for high-confidence classification.

#### 4. Hysteresis Logic

**Purpose**: Require sustained high confidence before committing crop changes.

**Approach**:
- Track consecutive high-confidence samples (confidence > 0.75)
- Require **5+ consecutive** high-confidence samples before committing mode
- Reset counter if any sample has low confidence
- During low-confidence periods, hold last committed mode (don't revert to no-crop)

**State Machine**:
```
States:
- DETECTING: Initial state, no committed mode yet
- HIGH_CONFIDENCE_STREAK: Counting consecutive high-confidence samples (< 5)
- COMMITTED: 5+ consecutive samples, crop is active
- HOLDING: Low confidence, maintaining last committed mode

Transitions:
- DETECTING → HIGH_CONFIDENCE_STREAK: First high-confidence sample
- HIGH_CONFIDENCE_STREAK → COMMITTED: 5th consecutive high-confidence sample
- HIGH_CONFIDENCE_STREAK → DETECTING: Low confidence resets counter
- COMMITTED → HOLDING: Low confidence but keep last mode
- HOLDING → HIGH_CONFIDENCE_STREAK: High confidence returns, start counting for new mode
- COMMITTED → HIGH_CONFIDENCE_STREAK: High confidence for different mode, start counting
```

#### 5. Detection Freeze for Extreme Instability

**Purpose**: During very unstable periods (e.g., crazy animated intros), stop trying to detect entirely.

**Approach**:
- If confidence < 0.3 for 10+ consecutive frames, enter FREEZE state
- In FREEZE state, return last committed mode without re-evaluation
- Exit FREEZE when confidence > 0.5 for 3+ consecutive frames

**Rationale**: Prevents wasting cycles trying to detect during chaotic animation sequences.

### Detailed Implementation Notes

#### VideoModeDetector Changes

**Expand History Tracking**:
```typescript
interface DetectionHistoryEntry {
  mode: C64VideoMode | null;
  edgeMetrics: EdgeMetrics;
  confidence: number;
  timestamp: number;
}

class VideoModeDetector {
  private detectionHistory: DetectionHistoryEntry[] = [];
  private readonly MAX_HISTORY = 60; // 1 second at 60fps
  
  private highConfidenceStreak = 0;
  private lastCommittedMode: C64VideoMode | null = null;
  private detectionState: 'DETECTING' | 'HIGH_CONFIDENCE_STREAK' | 'COMMITTED' | 'HOLDING' = 'DETECTING';
  
  // ... existing code
}
```

**Add Edge Metrics Extraction**:
```typescript
private extractEdgeMetrics(edgeData: EdgeDetectionResult): EdgeMetrics {
  // Calculate average HSV saturation for each edge from edge detection results
  // Return object with top/bottom/left/right saturation values
}
```

**Implement Consistency Calculation**:
```typescript
private calculateEdgeConsistency(history: DetectionHistoryEntry[]): number {
  // For each edge (top/bottom/left/right):
  //   Extract saturation values from history
  //   Calculate coefficient of variation (stdDev / mean)
  // Average the 4 edge CVs
  // Return 1.0 - averageCV (normalized to 0-1)
}
```

**Implement Stability Calculation**:
```typescript
private calculateTemporalStability(
  history: DetectionHistoryEntry[],
  currentMode: C64VideoMode | null
): number {
  // Count how many history entries match currentMode
  // Return matchCount / history.length
}
```

**Modify detectMode() Method**:
```typescript
detectMode(videoWidth: number, videoHeight: number, edgeData: EdgeDetectionResult): DetectionResult {
  // 1. Find best matching mode (existing logic)
  const candidateMode = this.findBestMatch(videoWidth, videoHeight);
  
  // 2. Extract edge metrics
  const edgeMetrics = this.extractEdgeMetrics(edgeData);
  
  // 3. Calculate confidence
  const edgeConsistency = this.calculateEdgeConsistency(this.detectionHistory);
  const temporalStability = this.calculateTemporalStability(this.detectionHistory, candidateMode);
  const confidence = (edgeConsistency * 0.6) + (temporalStability * 0.4);
  
  // 4. Add to history
  this.detectionHistory.push({ mode: candidateMode, edgeMetrics, confidence, timestamp: Date.now() });
  if (this.detectionHistory.length > this.MAX_HISTORY) {
    this.detectionHistory.shift();
  }
  
  // 5. Update state machine and hysteresis
  this.updateDetectionState(candidateMode, confidence);
  
  // 6. Return result
  return {
    mode: this.getEffectiveMode(),
    confidence,
    state: this.detectionState
  };
}
```

**Implement State Machine**:
```typescript
private updateDetectionState(candidateMode: C64VideoMode | null, confidence: number): void {
  const HIGH_CONFIDENCE_THRESHOLD = 0.75;
  const FREEZE_THRESHOLD = 0.3;
  const REQUIRED_STREAK = 5;
  
  // Check for freeze condition
  if (confidence < FREEZE_THRESHOLD) {
    this.freezeCount++;
    if (this.freezeCount > 10) {
      this.detectionState = 'HOLDING';
      return;
    }
  } else {
    this.freezeCount = 0;
  }
  
  // High confidence path
  if (confidence > HIGH_CONFIDENCE_THRESHOLD) {
    if (this.detectionState === 'COMMITTED' && candidateMode !== this.lastCommittedMode) {
      // Different mode detected, restart streak
      this.highConfidenceStreak = 1;
      this.detectionState = 'HIGH_CONFIDENCE_STREAK';
    } else if (this.detectionState === 'HIGH_CONFIDENCE_STREAK') {
      this.highConfidenceStreak++;
      if (this.highConfidenceStreak >= REQUIRED_STREAK) {
        this.lastCommittedMode = candidateMode;
        this.detectionState = 'COMMITTED';
      }
    } else if (this.detectionState === 'DETECTING') {
      this.highConfidenceStreak = 1;
      this.detectionState = 'HIGH_CONFIDENCE_STREAK';
    }
  } else {
    // Low confidence - reset streak or enter holding
    if (this.detectionState === 'COMMITTED') {
      this.detectionState = 'HOLDING';
    } else {
      this.highConfidenceStreak = 0;
      this.detectionState = 'DETECTING';
    }
  }
}

private getEffectiveMode(): C64VideoMode | null {
  return (this.detectionState === 'COMMITTED' || this.detectionState === 'HOLDING')
    ? this.lastCommittedMode
    : null;
}
```

#### CrtRenderer Integration Changes

**Update Detector Usage**:
```typescript
private updateAutoCrop(): void {
  if (!this.autoCropEnabled) {
    return;
  }
  
  // ... existing edge detection ...
  
  const detectionResult = this.videoModeDetector.detectMode(
    this.videoWidth,
    this.videoHeight,
    edgeDetectionResult
  );
  
  // Log state transitions (debug)
  if (detectionResult.state !== this.lastDetectionState) {
    console.debug(`[AutoCrop] State: ${this.lastDetectionState} → ${detectionResult.state}, Confidence: ${detectionResult.confidence.toFixed(2)}`);
    this.lastDetectionState = detectionResult.state;
  }
  
  // Only update crop if in COMMITTED state
  if (detectionResult.state === 'COMMITTED' && detectionResult.mode) {
    const newCrop = this.calculateCropFromMode(detectionResult.mode);
    this.cropAnimator.setTarget(newCrop);
  } else if (detectionResult.state === 'DETECTING' && this.cropAnimator.hasTarget()) {
    // Reset to full frame if we're back to detecting and had a crop
    this.cropAnimator.setTarget({ top: 0, bottom: 0, left: 0, right: 0 });
  }
  // If HOLDING or HIGH_CONFIDENCE_STREAK, keep current crop target
}
```

### Anti-Patterns to Avoid

❌ **Don't use absolute thresholds for edge variance** - Different brightness levels will have different natural variance ranges. Use normalized measures (coefficient of variation).

❌ **Don't commit immediately on high confidence** - The whole point is hysteresis. Require sustained high confidence.

❌ **Don't reset to no-crop during HOLDING state** - Maintain last committed mode during unstable periods. Only reset when in DETECTING state.

❌ **Don't use fixed history size without performance consideration** - 60 entries * (mode + 4 floats + confidence + timestamp) ≈ 1KB per detector, acceptable.

❌ **Don't forget to handle edge case: no history yet** - First few frames should have graceful defaults (confidence = 0, return null mode).

---

## 🧪 Testing Requirements

### Test Coverage Required

**Unit Tests** (in `video-mode-detector.spec.ts`):
- [ ] Edge consistency calculation with stable edges returns high score (>0.9)
- [ ] Edge consistency calculation with flickering edges returns low score (<0.5)
- [ ] Temporal stability with uniform history returns high score (>0.9)
- [ ] Temporal stability with mixed modes returns low score
- [ ] Confidence formula correctly combines consistency and stability
- [ ] High confidence (>0.75) increments streak counter
- [ ] Low confidence resets streak counter
- [ ] 5 consecutive high-confidence samples commit mode
- [ ] Interrupted streak (4 high + 1 low) resets and requires 5 more
- [ ] HOLDING state maintains last mode during low confidence
- [ ] State transitions follow state machine diagram
- [ ] Detection freeze activates after 10 frames of very low confidence

**Integration Tests** (in `crt-renderer.spec.ts`):
- [ ] Low confidence detection doesn't update crop animator
- [ ] High confidence streak (5 samples) commits crop change
- [ ] State change logs appear in console.debug
- [ ] DETECTING state with existing crop resets to full frame
- [ ] HOLDING state maintains crop target

**Behavioral Expectations**:
- **Stable borders**: Should detect and crop within 1-2 seconds (60-120 frames)
- **Animated borders**: Should NOT commit crop, remain in DETECTING or HOLDING state
- **Normal gameplay**: Should maintain committed crop throughout, not thrash
- **Confidence score**: Should accurately reflect detection reliability

### Manual Testing Scenarios

**Scenario 1: Animated Border Game Intro**
1. Load content with flickering colored borders (like the provided screenshot)
2. Enable auto crop
3. **Expected**: System stays in DETECTING or HIGH_CONFIDENCE_STREAK state, never commits
4. **Expected**: No visible crop-in/crop-out bouncing
5. **Check console**: Should see confidence scores <0.75, state remains DETECTING

**Scenario 2: Static Border Content**
1. Load normal C64 content with stable black borders
2. Enable auto crop
3. **Expected**: Within 1-2 seconds, state transitions to COMMITTED
4. **Expected**: Crop applies smoothly, no bouncing
5. **Check console**: Should see confidence scores >0.75, streak count increasing to 5

**Scenario 3: Transition from Intro to Gameplay**
1. Load content that starts with animated intro, then transitions to stable gameplay
2. Enable auto crop before intro
3. **Expected**: During intro, stays in DETECTING (no crop)
4. **Expected**: After transition, detects stable borders within 1-2 seconds and commits
5. **Check console**: Should see confidence rise from <0.5 to >0.75 after transition

---

## 📎 Reference Materials

### Related Documentation

- [Master Plan Confidence Scoring Section](../AUTO-CROP-BLACKBARS-MASTER-PLAN.md#confidence-scoring) - Original algorithm specification
- [Phase 2 Plan](../phases/AUTO-CROP-BLACKBARS-PHASE-02-SMOOTH-TRANSITIONS.md) - Complete phase overview
- [Phase 1.1 Report](../reports/AUTO-CROP-BLACKBARS-TASK-01.1-004-REPORT.md) - Current implementation details

### Related Tasks

- ✅ AUTO-CROP-BLACKBARS-TASK-01.1-001-EDGE-DETECTION-SHADER: Edge detection foundation
- ✅ AUTO-CROP-BLACKBARS-TASK-01.1-003-RENDERER-INTEGRATION: Renderer integration patterns
- ✅ AUTO-CROP-BLACKBARS-TASK-01.1-004-VIDEO-MODE-PRESETS: Current detector implementation

### Implementation Examples

**Similar Confidence Scoring Pattern** (from hypothetical audio level detection):
```typescript
// Example of temporal consistency scoring
class AudioLevelDetector {
  private history: number[] = [];
  
  calculateConsistency(): number {
    const mean = this.history.reduce((a, b) => a + b) / this.history.length;
    const variance = this.history.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.history.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean; // Coefficient of variation
    return Math.max(0, 1.0 - cv); // Invert and clamp
  }
}
```

**State Machine Pattern** (from existing component):
```typescript
// Example from existing codebase showing state management
enum ConnectionState { CONNECTING, CONNECTED, RECONNECTING, DISCONNECTED }

private updateConnectionState(newState: ConnectionState): void {
  if (this.state !== newState) {
    console.debug(`Connection: ${this.state} → ${newState}`);
    this.state = newState;
    this.onStateChange(newState);
  }
}
```

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/AUTO-CROP-BLACKBARS/reports/AUTO-CROP-BLACKBARS-TASK-02-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/AUTO-CROP-BLACKBARS/reports/AUTO-CROP-BLACKBARS-TASK-02-001-REPORT.md`

### Report Must Include

- [ ] Detailed explanation of confidence scoring implementation
- [ ] Analysis of edge consistency calculation approach chosen
- [ ] State machine transition diagram or description
- [ ] Test results showing animated border scenario passes
- [ ] Manual test results with problematic content (if available)
- [ ] Any discoveries about edge detection behavior
- [ ] Recommendations for Phase 2 Task 2 (animation system)

---

## ✅ Checklist Before Starting

- [ ] I understand the animated border false detection problem
- [ ] I've reviewed the current VideoModeDetector implementation
- [ ] I understand confidence scoring (edge consistency + temporal stability)
- [ ] I understand the hysteresis requirement (5 consecutive samples)
- [ ] I understand the state machine (DETECTING → HIGH_CONFIDENCE_STREAK → COMMITTED → HOLDING)
- [ ] I have a plan for calculating edge consistency (coefficient of variation or similar)
- [ ] I know where to add console.debug logging for state transitions
- [ ] I'm ready to write comprehensive unit tests

---

## 🎯 Success Summary

When this task is complete:
- ✅ Mode bouncing eliminated during animated border sequences
- ✅ Normal content still detects correctly within 1-2 seconds
- ✅ Confidence scoring accurately reflects detection reliability
- ✅ Hysteresis prevents premature crop commits
- ✅ System holds last good crop during unstable periods
- ✅ All tests pass with coverage >90%
- ✅ Console logging provides clear state transition visibility

This task is **CRITICAL** for production stability. Take time to test thoroughly with the problematic content before considering it complete.
