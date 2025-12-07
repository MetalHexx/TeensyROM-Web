# Task Handoff: WebGL Shader Quality Polish

## 📋 Task Identity

**Task ID**: CRT-EFFECT-ENHANCEMENT-TASK-02-003A-SHADER-QUALITY-POLISH  
**Task Name**: Refine WebGL Scanline Shader for Production Quality  
**Phase**: 02 - WebGL Renderer Implementation (Follow-up)  
**Priority**: Medium  
**Estimated Effort**: 1-2 hours  
**Estimated Context Size**: Small (2-3 files)  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`

---

## 🎯 Objective

**What**: Refine the WebGL scanline shader to eliminate remaining visual artifacts (banding at certain slider positions, jank at low values) and optionally clamp UI slider minimum in WebGL mode.

**Why**: Task 02-003 successfully integrated WebGL mode, but shader quality has known issues that affect user experience. Production-ready quality requires further iteration.

**Success Criteria**:
- [ ] No visible banding/Moiré at any slider position between 2-6
- [ ] Slider behavior feels smooth when dragging (no jank)
- [ ] WebGL scanlines visually approximate CSS version at equivalent settings
- [ ] Consider: UI slider minimum clamped to effective minimum in WebGL mode
- [ ] All existing tests pass (111 CRT-related tests)

---

## 📦 Context & Dependencies

**Prerequisites Completed**:
- Task 02-001: WebGL Renderer Infrastructure ✅
- Task 02-002: Domain Model Update ✅  
- Task 02-003: Component Integration ✅ (shader quality partial)

**Prior Work Summary** (from Task 02-003 Report):

The shader went through 4 iterations:
1. **Hard-Edge Smoothstep**: Discrete bands, banding at non-100% zoom
2. **Cosine Wave Pattern**: Smoother gradients, reduced but not eliminated banding
3. **Cosine + DPR Scaling**: Sizes now match CSS proportionally
4. **Anti-Aliasing Filter (Current)**: Better at moderate sizes, still issues at extremes

**Current Issues Identified**:
1. Slider shows visual changes below effective minimum (2.0) causing confusion
2. Banding/Moiré at specific slider values (frequency aliasing)
3. Different visual appearance from CSS version (expected but could be closer)

**Dependencies**:
- `CrtRenderer` class from `./webgl/crt-renderer`
- `SCANLINE_FRAGMENT_SHADER` from `./webgl/shaders/scanline.frag.ts`
- `CrtSettingsPanelComponent` (if modifying slider constraints)

---

## 📁 File Scope

**Files to Modify (Primary)**:

1. `libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts`
   - Refine `calculateScanline()` function
   - Consider quantized sizes, improved AA, or different approach
   - Document shader algorithm decisions in comments

2. `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts`
   - May need to adjust DPR scaling or uniform passing
   - Consider pre-computing "blessed" scanline sizes

**Files to Modify (Optional - if clamping slider)**:

3. `libs/features/src/lib/player/components/crt-settings-panel/crt-settings-panel.component.ts`
   - Add minimum constraint logic for WebGL mode
   - Receive `renderMode` as input to determine constraints

---

## 🔧 Implementation Guidance

### Approach Options (Choose Best Path)

#### Option A: Quantized Scanline Sizes (Recommended)
Pre-compute "blessed" sizes that align well with pixel boundaries. Shader snaps to nearest blessed value.

```glsl
// Example: Snap to pixel-aligned sizes
float quantize(float size, float step) {
  return floor(size / step + 0.5) * step;
}

float effectiveSize = quantize(max(u_scanlineSize, 2.0), 0.5);
```

**Pros**: Eliminates aliasing at problematic intermediate values  
**Cons**: Slider won't feel perfectly smooth (discrete steps)

#### Option B: Improved Anti-Aliasing Filter
Refine the current `fwidth`-based approach with better tuning.

```glsl
// Current approach uses phaseDerivative = PI / effectiveSize
// Try adjusting the AA threshold or fade curve
float aa = smoothstep(0.8, 1.5, phaseDerivative);
```

**Pros**: Smooth slider feel maintained  
**Cons**: May not fully eliminate banding

#### Option C: Different Wave Function
Try triangle wave or other smooth periodic function that may alias less.

```glsl
// Triangle wave (more linear transitions)
float triangle = 1.0 - 2.0 * abs(fract(phase / TWO_PI) - 0.5);
```

**Pros**: Different frequency characteristics  
**Cons**: May look less like classic CRT scanlines

#### Option D: UI Slider Clamping
Keep shader as-is but clamp the slider minimum in WebGL mode to avoid the problematic range.

```typescript
// In settings panel
readonly minScanlineSize = computed(() => 
  this.renderMode() === 'webgl' ? 2.0 : 1.0
);
```

**Pros**: Simple solution, no shader changes  
**Cons**: Reduces user control, doesn't fix intermediate banding

---

### Current Shader Analysis

**Current Implementation** (`scanline.frag.ts`):

```glsl
float calculateScanline(float y, float lineSize) {
  // Enforce minimum size to prevent sub-pixel chaos
  float effectiveSize = max(lineSize, 2.0);
  
  // Calculate the phase (position within the wave cycle)
  float phase = y * PI / effectiveSize;
  
  // Calculate how fast the phase changes per pixel (frequency)
  float phaseDerivative = PI / effectiveSize;
  
  // Anti-aliasing: when frequency is too high, fade out
  float aa = clamp(1.5 / phaseDerivative, 0.0, 1.0);
  
  // Cosine wave: peaks at 0, troughs at PI
  float wave = cos(phase);
  
  // Convert to 0-1 range
  float scanline = (wave + 1.0) * 0.5;
  
  // Sharpen with power curve
  scanline = pow(scanline, 1.8);
  
  // Apply anti-aliasing fade
  float uniformGray = 0.35;
  scanline = mix(uniformGray, scanline, aa);
  
  return scanline;
}
```

**Key Insight**: The `phaseDerivative` is constant per frame (based on `effectiveSize`), not per-pixel. The current AA logic reduces pattern intensity globally when lines are small, but doesn't address mid-range aliasing.

**Potential Issue**: At specific sizes (e.g., 3.7px), the phase relationship between adjacent pixels creates Moiré. Need either:
- Quantization to avoid problematic sizes
- True per-pixel AA using `fwidth(gl_FragCoord.y)`
- Dithering to break up regular patterns

---

### Testing Checklist

Manual verification at these zoom levels:
- [ ] 100% zoom - baseline quality
- [ ] 110% zoom - common Windows setting
- [ ] 125% zoom - common Windows setting
- [ ] 150% zoom - high DPI scenario

Test slider positions (scan for artifacts):
- [ ] Minimum value (1.0 or 2.0)
- [ ] Low range (2.0 - 3.0)
- [ ] Mid range (3.0 - 4.5)
- [ ] High range (4.5 - 6.0)
- [ ] Maximum value (6.0)

Compare to CSS mode:
- [ ] Toggle between CSS and WebGL at same settings
- [ ] Note visual differences
- [ ] Assess if "close enough" for production

---

## 📝 Standards to Follow

- [CODING_STANDARDS.md](../../../CODING_STANDARDS.md) - TypeScript conventions
- [TESTING_STANDARDS.md](../../../TESTING_STANDARDS.md) - Testing approach
- [COMPONENT_LIBRARY_CRT.md](../../../COMPONENT_LIBRARY_CRT.md) - CRT component docs

**Key Standards**:
- Document shader algorithm decisions in JSDoc/comments
- All shader math should have explanatory comments
- No magic numbers without explanation
- Test with existing test suite (111 tests must pass)

---

## 🧪 Testing Requirements

**Automated Tests**:
- Run: `pnpm nx test ui-components --testFile=crt --watch=false`
- All 111 CRT-related tests must pass
- No new tests required (unless adding slider clamping logic)

**Manual Testing** (Critical for shader work):
- Test at multiple zoom levels
- Test full slider range
- Compare visually to CSS mode
- Check for jank during slider dragging

---

## 📚 Reference Materials

**Prior Reports**:
- [Task 02-003 Report](../reports/CRT-EFFECT-ENHANCEMENT-TASK-02-003-REPORT.md) - Shader iteration history

**Shader References**:
- [CRT-Lottes shader](https://www.shadertoy.com/view/XsjSzR) - Reference implementation
- [Anti-aliasing in shaders](https://blog.demofox.org/2015/04/23/aliasing-in-shaders/) - Theory

**Existing Code**:
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/shaders/scanline.frag.ts`
- `libs/ui/components/src/lib/crt-effect-wrapper/webgl/crt-renderer.ts`
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss` (CSS scanlines for comparison)

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/CRT-EFFECT-ENHANCEMENT/reports/CRT-EFFECT-ENHANCEMENT-TASK-02-003A-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Include in Report**:
1. Which approach was chosen and why
2. Final shader code with algorithm explanation
3. Before/after comparison observations
4. Any remaining known issues
5. Recommendations for future work

---

## 🔄 Related Tasks

| Task ID | Status | Relationship |
|---------|--------|--------------|
| TASK-02-001-WEBGL-RENDERER | ✅ Complete | Created CrtRenderer class |
| TASK-02-002-DOMAIN-MODEL | ✅ Complete | Added renderMode property |
| TASK-02-003-COMPONENT-INTEGRATION | ✅ Complete | Integration done, shader quality partial |
| **TASK-02-003A-SHADER-QUALITY-POLISH** | 🔄 This Task | Refine shader quality |
| TASK-03-001 (Future) | Pending | Add render mode toggle UI |

---

## ⚠️ Key Constraints

1. **No breaking changes**: Existing WebGL/CSS mode switching must continue to work
2. **No test regressions**: All 111 CRT tests must pass
3. **Performance budget**: Shader should not significantly impact GPU (mobile consideration)
4. **Incremental improvement**: Perfect is enemy of good - aim for "production ready", not "perfect"

---

## 💡 Decision Points for Worker

Before implementing, decide:

1. **Which approach?** (Options A-D above, or combination)
2. **Slider clamping?** Add to this task or defer to Phase 3?
3. **"Good enough" threshold?** At what point stop iterating?

If unsure, try Option A (Quantized Sizes) first as it's most likely to eliminate the core issue.
