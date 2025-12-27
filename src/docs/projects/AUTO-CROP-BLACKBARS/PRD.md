# Feature Proposal: Auto Black-Bar Detection + Smooth Crop/Scale (C64 Video Capture)

## Summary
Add an optional **“Auto-Crop Border”** feature to the TeensyROM Web CRT pipeline. When enabled, the system continuously analyzes incoming C64 capture frames (PAL or NTSC) to detect black borders on all sides, then **smoothly crops and scales** the active content to fill the available **4:3** viewport. Transitions must feel natural (not jarring), like a camera operator making gentle adjustments.

This is intended to improve the viewing experience across C64 games/programs that present varying safe-area/border usage—especially PAL, where bottom borders are often larger than top.

---

## Goals
- Automatically eliminate visible black bars around the active content area.
- Preserve a clean, sleek “CRT display” experience with **smooth, non-jarring transitions**.
- Handle dynamic content (menus, gameplay, demos) where borders may change over time.
- Provide a simple **UI toggle** in the CRT settings panel (On/Off).
- Phase 1: implement a **naive approach** that works well for most content (no “modes” required yet).

---

## Non-Goals (Phase 1)
- Perfect classification of C64 “screen modes” (standard, PAL-extended, open border, border UI, etc.).
- Preventing all edge cases (e.g., full-screen black with a tiny sprite) from ever producing a wrong guess.
- Pixel-perfect emulation accuracy. This is a UX/visual enhancement feature, not a VIC-II correctness feature.

---

## User Experience
### User Story
As a user watching my real C64 through TeensyROM CRT effects, I want the video to automatically remove black bars so the active picture uses the full 4:3 space, without abrupt jumps.

### UX Requirements
- **Toggle**: “Auto-Crop Border” (default Off; discuss desired default).
- When enabled:
  - The crop/scale changes should be **smooth** (easing over time).
  - The system should be resilient to short-lived edge cases.
  - The output remains **4:3** (content stretches within 4:3, not widescreen).

### Visual Behavior
- “Camera-man style”: gradual pans/zooms to new framing instead of instant snaps.
- Avoid thrashing: don’t change crop every single frame unless necessary.

---

## Problem Context / Constraints
- Input is a **live capture** of a real C64, presented as **4:3**.
- We run **WebGL shaders** for CRT effects.
- PAL vs NTSC is known to the system (or can be configured). PAL frequently has larger bottom borders.
- Frames can occasionally be “undeterministic”:
  - Example: almost entire frame is black except a small sprite in the middle.
  - Example: loading screens, fades, scene transitions, or very dark scenes.

---

## Proposed Solution (Phase 1: Naive, Practical)
### Core Idea
Continuously “poll” frames and estimate the **active content rectangle** by detecting black bars on:
- Top
- Bottom
- Left
- Right

Then crop to that rectangle and **scale** it back to fill the 4:3 viewport.

### Key Behaviors
1. **Frame Sampling / Polling**
   - Analyze frames at a fixed cadence (e.g., every N frames or N ms).
   - Compute a candidate crop rectangle each sample.
   - Aggregate over a short window to stabilize (e.g., moving average / majority vote).

2. **Black Detection**
   - Determine what counts as “black” using a threshold (luma-based recommended).
   - Consider noise, compression artifacts, and capture black level variation.
   - Optional: treat “near black” as black with a configurable tolerance.

3. **Confidence / Undeterministic Frames**
   - Establish a confidence score for the computed rectangle.
   - If confidence is low (e.g., “mostly black frame”), do NOT commit to a new crop.
   - Hold last known good crop until confidence returns.

4. **Smooth Transitions**
   - When crop rectangle changes, animate toward the new rectangle:
     - ease-in/out
     - limited speed per update (max delta per second)
   - No visible snapping unless user explicitly requests a “fast snap” mode (future).

5. **PAL/NTSC Awareness**
   - Use PAL/NTSC to bias expectations:
     - PAL: bottom border often larger than top
     - NTSC: different typical overscan/border distribution
   - Phase 1: only use this as a mild bias/guardrail (not strict rules).

---

## Detailed Requirements

### Functional Requirements
- **FR1**: Provide a CRT settings toggle: `AutoCropBlackBars` (On/Off).
- **FR2**: When enabled, compute black bar sizes (top/bottom/left/right) from sampled frames.
- **FR3**: Produce a crop rectangle and scale output to fill 4:3.
- **FR4**: Maintain stability through brief undeterministic frames by holding last good crop.
- **FR5**: Crop/scale adjustments animate smoothly to avoid jarring transitions.
- **FR6**: Support PAL and NTSC assumptions (system knows which is active).

### Non-Functional Requirements
- **NFR1**: Real-time performance: analysis must not tank FPS (lightweight sampling).
- **NFR2**: Avoid “thrash” and “jitter” (use smoothing + hysteresis).
- **NFR3**: Graceful failure: if detection fails, fall back to “no crop” or “last stable crop.”

---

## Detection Heuristics (Phase 1 Expectations)
The agent should choose a robust-yet-simple heuristic. Examples:
- Sample a small grid of pixels/lines near edges.
- Detect contiguous rows/columns that are below a black threshold.
- Ignore a few pixels margin to avoid false positives from CRT effects or shader artifacts by making sure to sample the raw capture if possible.
- Confidence can consider:
  - how consistently edges are black
  - whether detected borders persist across multiple samples

---

## Output Behavior
- Maintain a current “camera framing” state:
  - `currentCropRect`
  - `targetCropRect`
  - `confidence`
- Update target when stable; animate current toward target.

---

## Edge Cases to Handle
- Full black screen (or near black): keep last stable crop; don’t zoom wildly.
- Limit the amount we'll possibly zoom in (to avoid extreme crops).
- Tiny object on black: treat as undeterministic, hold last stable crop.
- Fade transitions: don’t chase the fade.
- Border UI / colored borders: don’t crop if borders aren’t truly black (phase 1 may miss this; acceptable).
- CRT shaders may darken edges: consider analyzing pre-CRT or raw capture if available.

---

## Acceptance Criteria
- With feature enabled, common C64 captures that have black borders will:
  - visibly reduce or eliminate black bars
  - fill 4:3 view with active picture
  - adjust smoothly without visible snapping
- During undeterministic frames (mostly black / tiny sprite), the crop does not “hunt.”
- Toggle off returns to normal (no crop adjustments).

---

## Phase 2 (Future): “Modes” / Profiles
After naive cropping works, introduce selectable “modes” to improve correctness and reduce false crops:
- Standard content (typical 320x200 safe area)
- Reduced playfield (large borders)
- PAL-extended vertical
- Border-augmented UI (avoid cropping meaningful border content)
- Open-border / near full-frame (minimal crop)

System behavior:
- Start with best guess mode based on PAL/NTSC + measured bars
- Switch modes only when stable and confident
- Smooth transitions between mode changes

---

## Open Questions (Agent to decide)
- Should analysis be done on the raw capture texture (pre-CRT) vs post-shader output?
  - Answer: Use the raw capture if accessible for more accurate black detection.
- Best thresholds for black detection across capture devices?
- Sampling frequency vs stability tradeoffs?
- Default setting: Off or On?
 - Answer: On by default to enhance user experience.
- Any user control for “aggressiveness” (future)?  
    - Answer: Consider in Phase 2 after initial rollout.

---

## Deliverables
- CRT settings toggle + persistence
- Runtime black-bar analyzer (PAL/NTSC aware)
- Smooth crop/scale controller
- (Optional) debug overlay for tuning
- Basic documentation / release note entry
