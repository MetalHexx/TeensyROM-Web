# Phase 3: Default Value Tuning

## 🎯 Objective

User-driven testing phase where default values for all four presets (SMALL_CSS, SMALL_WEBGL, LARGE_CSS, LARGE_WEBGL) are manually tuned in real-world usage scenarios, then hardcoded as production defaults. This ensures presets are optimized for actual viewing contexts rather than theoretical values.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Master Plan](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md) - Complete project overview
- [ ] [Phase 2 Completion](./CRT-PRESET-SIMPLIFICATION-PHASE-02-COMPONENT-IMPLEMENTATION.md) - Component implementation foundation

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Component Library CRT](../../../COMPONENT_LIBRARY_CRT.md) - CRT system documentation

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/crt-effect-wrapper/
└── crt-settings.defaults.ts                📝 Modified - Update preset values with tuned defaults

docs/projects/CRT-PRESET-SIMPLIFICATION/
└── tuning-values.md                        ✨ New - User-provided tuned values (temporary file)
```

---

<details open>
<parameter name="summary"><h3>Task 1: User Testing - Small Presets</h3></summary>

**Purpose**: User manually tests file-image and video-capture components, adjusting CRT settings to find optimal values for compact display contexts.

**Related Documentation:**

- [File-Image Component](../../../../libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.ts)
- [Video-Capture Component](../../../../libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts)

**Testing Scenarios:**

- [ ] **File-Image Testing**: Browse files, view different image types, adjust CRT settings for optimal thumbnail display
- [ ] **Video-Capture Testing**: Capture live video, view compact stream, adjust CRT settings for best compact video quality
- [ ] **CSS Mode Testing**: Disable WebGL, test CSS rendering, tune for CSS-specific artifacts
- [ ] **WebGL Mode Testing**: Enable WebGL, test GPU rendering, tune for WebGL-specific quality

**User Actions:**

1. Open application, navigate to file browser
2. Select device with image files
3. View file-image component (thumbnails/previews)
4. Open CRT settings panel
5. Adjust sliders to optimal values:
   - Scanline intensity
   - Scanline size
   - Vignette strength
   - Screen curvature (should be 0 for Small)
   - Contrast, brightness, saturation, hue
   - Phosphor pattern and intensity (WebGL only)
6. Switch between CSS and WebGL modes
7. Test on different screen sizes/resolutions
8. Record final settings for SMALL_CSS and SMALL_WEBGL

**Key Testing Considerations:**

- Small displays benefit from subtle effects (don't overpower content)
- Scanlines should be visible but not distracting at thumbnail sizes
- Curvature should remain 0 (doesn't make sense for compact displays)
- Brightness/contrast critical for readability at small sizes
- Phosphor intensity should be minimal for WebGL (avoid noise)

**Output Requirements:**

- [ ] **SMALL_CSS values documented** - Complete CrtSettings object with all properties
- [ ] **SMALL_WEBGL values documented** - Complete CrtSettings object with all properties
- [ ] **Rationale notes** - Brief explanation of why values chosen

</details>

---

<details open>
<parameter name="summary"><h3>Task 2: User Testing - Large Presets</h3></summary>

**Purpose**: User manually tests video-dialog component in fullscreen context, adjusting CRT settings to find optimal values for immersive viewing.

**Related Documentation:**

- [Video-Dialog Component](../../../../libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts)

**Testing Scenarios:**

- [ ] **Fullscreen Video Testing**: Open video in fullscreen dialog, view high-quality stream, adjust CRT settings for maximum immersion
- [ ] **CSS Mode Testing**: Disable WebGL, test CSS rendering at fullscreen scale
- [ ] **WebGL Mode Testing**: Enable WebGL, test GPU rendering with phosphor patterns and advanced effects
- [ ] **Different Content Types**: Test with various video content (games, music visualizations, capture devices)

**User Actions:**

1. Open application, navigate to video capture
2. Click fullscreen button to open video-dialog
3. View video stream in fullscreen
4. Open CRT settings panel
5. Adjust sliders to optimal values:
   - Scanline intensity (can be stronger for fullscreen)
   - Scanline size (scale appropriately for fullscreen)
   - Vignette strength (dramatic edge darkening for immersion)
   - Screen curvature (CRT monitor curvature simulation)
   - Contrast, brightness, saturation, hue
   - Phosphor pattern and intensity (WebGL aperture grille effect)
   - Advanced effects (bloom, chromatic aberration, barrel distortion)
6. Switch between CSS and WebGL modes
7. Test on different display sizes (1080p, 1440p, 4K monitors)
8. Record final settings for LARGE_CSS and LARGE_WEBGL

**Key Testing Considerations:**

- Fullscreen can handle stronger effects without overwhelming content
- Curvature adds authentic CRT monitor feel (test range 50-150px)
- Phosphor patterns are more visible and impactful at fullscreen scale
- Bloom and advanced effects should enhance without obscuring content
- Consider aspect ratio handling (4:3 content on 16:9 displays)

**Output Requirements:**

- [ ] **LARGE_CSS values documented** - Complete CrtSettings object with all properties
- [ ] **LARGE_WEBGL values documented** - Complete CrtSettings object with all properties
- [ ] **Rationale notes** - Brief explanation of why values chosen
- [ ] **Edge case notes** - Any specific scenarios where defaults don't work well

</details>

---

<details open>
<parameter name="summary"><h3>Task 3: Document Tuned Values</h3></summary>

**Purpose**: Collect all user-tuned values into a structured document for easy reference during implementation.

**Related Documentation:**

- [CRT Settings Interface](../../../../libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts)

**Implementation Subtasks:**

- [ ] **Create tuning-values.md** in project root with all four presets
- [ ] **Verify completeness** - Each preset has all 17 CrtSettings properties
- [ ] **Add usage notes** - Context for each preset (when/where it's used)
- [ ] **Include rationale** - Why specific values were chosen
- [ ] **Format as TypeScript** - Ready to copy-paste into code

**Testing Subtask:**

- [ ] **Validate structure**: Verify all properties match CrtSettings interface

**Key Documentation Format:**

```markdown
# Tuned CRT Preset Values

## SMALL_CSS
Context: File-image thumbnails, video-capture compact view
Rationale: [User's explanation]

```typescript
{
  scanlineIntensity: 0.X,
  scanlineSize: X.X,
  vignetteStrength: X.X,
  screenCurvature: 0,
  contrast: X.XX,
  brightness: X.XX,
  saturation: X.XX,
  hue: 0,
  renderMode: 'css',
  phosphorPattern: 'none',
  phosphorIntensity: 0,
  bloomEnabled: false,
  bloomIntensity: 0,
  bloomRadius: 1,
  barrelDistortion: 0,
  chromaticAberration: 0,
}
```

[Repeat for SMALL_WEBGL, LARGE_CSS, LARGE_WEBGL]
```

**Output Requirements:**

- [ ] **Document created** in `docs/projects/CRT-PRESET-SIMPLIFICATION/tuning-values.md`
- [ ] **All four presets documented** with complete settings
- [ ] **TypeScript-formatted** for easy copy-paste
- [ ] **Rationale included** for each preset

</details>

---

<details open>
<parameter name="summary"><h3>Task 4: Apply Tuned Values to Presets</h3></summary>

**Purpose**: Update `CRT_PRESETS` object in crt-settings.defaults.ts with user-tuned production values, replacing placeholder inherited values.

**Related Documentation:**

- [CRT Settings Defaults](../../../../libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts)
- [Tuning Values](../tuning-values.md)

**Implementation Subtasks:**

- [ ] **Update SMALL_CSS preset** with tuned values from tuning-values.md
- [ ] **Update SMALL_WEBGL preset** with tuned values from tuning-values.md
- [ ] **Update LARGE_CSS preset** with tuned values from tuning-values.md
- [ ] **Update LARGE_WEBGL preset** with tuned values from tuning-values.md
- [ ] **Update JSDoc comments** to reflect tuning rationale if needed
- [ ] **Verify type safety** - All presets satisfy CrtSettings interface

**Testing Subtask:**

- [ ] **Write Tests**: Verify preset values match documented tuning (see Testing section below)

**Key Implementation Notes:**

- Copy values directly from tuning-values.md
- Maintain existing object structure (don't reformat or reorder properties)
- Preserve comments about render mode and phosphor patterns
- Double-check numeric precision (decimals match tuning doc exactly)
- Update JSDoc if tuning reveals new insights about preset usage

**Testing Focus for Task 4:**

**Behaviors to Test:**

- [ ] **SMALL_CSS preset has screenCurvature: 0**
- [ ] **SMALL_WEBGL preset has screenCurvature: 0**
- [ ] **LARGE presets have appropriate screenCurvature** (tuned value, likely > 0)
- [ ] **CSS presets have renderMode: 'css' and phosphorPattern: 'none'**
- [ ] **WebGL presets have renderMode: 'webgl' and appropriate phosphorPattern**
- [ ] **All numeric values match tuning document** (spot-check critical properties)

**Testing Reference:**

- Create snapshot tests to prevent accidental changes to tuned values
- Verify presets still satisfy CrtSettings type constraint

</details>

---

<details open>
<parameter name="summary"><h3>Task 5: Final Verification Testing</h3></summary>

**Purpose**: Comprehensive testing of all components with final production default values to ensure optimal user experience and no regressions.

**Related Documentation:**

- [Testing Standards](../../../TESTING_STANDARDS.md)
- [E2E Testing Guide](../../../../apps/teensyrom-ui-e2e/E2E_TESTS.md)

**Implementation Subtasks:**

- [ ] **Clear all saved settings** - Test first-time user experience with production defaults
- [ ] **Test file-image component** - Verify SMALL preset looks good with tuned values
- [ ] **Test video-capture component** - Verify SMALL preset works well with live video
- [ ] **Test video-dialog component** - Verify LARGE preset provides immersive experience
- [ ] **Cross-browser testing** - Chrome, Firefox, Edge, Safari (WebGL differences)
- [ ] **Different screen sizes** - 1080p, 1440p, 4K displays
- [ ] **Performance testing** - Ensure no frame drops or stuttering

**Testing Subtask:**

- [ ] **Document results**: Note any issues or final adjustments needed

**Key Verification Points:**

- Visual quality meets or exceeds Phase 2 placeholder values
- No visual artifacts (banding, flickering, clipping)
- Performance is acceptable (60fps for video, smooth interactions)
- Settings panel shows correct preset names
- Switching between presets works smoothly
- Custom preset creation/loading still works
- Saved settings continue working (backward compatibility)

**Testing Focus for Task 5:**

**Critical Scenarios:**

- [ ] **First-time user on WebGL-capable browser** sees SMALL_WEBGL/LARGE_WEBGL defaults
- [ ] **First-time user on non-WebGL browser** sees SMALL_CSS/LARGE_CSS defaults
- [ ] **Existing user with saved settings** sees their saved values (unchanged)
- [ ] **Preset switching** updates visuals immediately and correctly
- [ ] **Fullscreen transition** from compact to dialog shows appropriate preset change
- [ ] **Visual quality** is subjectively good across all scenarios

**Testing Reference:**

- Manual testing checklist for each component
- Performance profiling if frame drops detected
- Visual comparison against Phase 2 defaults

</details>

---

## 🗂️ Files Modified or Created

**New Files (Temporary):**

- `docs/projects/CRT-PRESET-SIMPLIFICATION/tuning-values.md` - User-provided tuned values (can be deleted after Task 4)

**Modified Files:**

- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - Update all four preset objects with tuned values

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

> **IMPORTANT:** Tests are written **within each task above**, not here. This section is only a summary for quick reference.

### Test Execution Commands

**Running Tests:**

```powershell
# Run UI components tests
pnpm nx test ui-components

# Run player feature tests  
pnpm nx test player

# Run all tests
pnpm nx run-many --target=test --all

# Build application to verify no regressions
pnpm nx build teensyrom-ui
```

### Expected Outcomes

**User Testing Phase (Tasks 1-2):**
- User provides complete CrtSettings objects for all four presets
- Values are optimized for real-world usage, not theoretical
- Rationale explains why specific values were chosen

**Implementation Phase (Tasks 3-4):**
- Tuned values successfully applied to preset objects
- All tests pass with new values
- Type safety maintained

**Verification Phase (Task 5):**
- Visual quality meets expectations
- No performance regressions
- First-time and existing user scenarios both work correctly

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

**User Testing Requirements:**

- [ ] User has tested all three components (file-image, video-capture, video-dialog)
- [ ] User has tested both CSS and WebGL modes
- [ ] User has provided complete settings for all four presets
- [ ] Rationale documented for tuning decisions

**Implementation Requirements:**

- [ ] All tuned values applied to CRT_PRESETS object
- [ ] JSDoc comments updated if needed
- [ ] Type safety maintained
- [ ] All tests passing

**Verification Requirements:**

- [ ] First-time user experience tested with production defaults
- [ ] Visual quality verified across all components
- [ ] Performance verified (no frame drops)
- [ ] Cross-browser compatibility verified
- [ ] Backward compatibility verified (saved settings work)

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes with no errors
- [ ] Code formatting is consistent
- [ ] No console errors when running application

**Documentation:**

- [ ] Component Library CRT docs updated with new preset recommendations
- [ ] Tuning rationale captured in comments or docs
- [ ] Migration notes added to master plan if needed

**Project Complete:**

- [ ] All success criteria met
- [ ] No known bugs or issues
- [ ] Production-ready default values in place
- [ ] Project ready for deployment

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Design Decisions

- **User-Driven Tuning**: Real-world usage trumps theoretical values - user tests in actual viewing scenarios
- **Complete Settings Objects**: All 17 properties documented even if unchanged from inherited values
- **Rationale Capture**: Understanding "why" helps future maintainers adjust or extend presets

### Testing Scope

- **Focus on Visual Quality**: Primary goal is optimal appearance, not technical perfection
- **Subjective Evaluation**: User's aesthetic judgment determines final values
- **Performance Balance**: Beautiful effects shouldn't compromise frame rate or responsiveness

### Future Maintenance

- **Preset Versioning**: Consider version stamping if presets evolve significantly in future
- **User Feedback Loop**: Monitor user reports after deployment, may need minor tuning adjustments
- **Platform-Specific Tuning**: Different GPUs/browsers may benefit from variant presets in future

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

**User Testing Notes:**
- [User to add findings from testing phase here]

**Visual Quality Notes:**
- [User to note any particularly good/bad combinations]

**Performance Notes:**
- [User to note any performance issues discovered]

</details>

---

## 🎓 User Testing Guide

### Getting Started

1. **Clear Saved Settings** (optional, to test first-time experience):
   - Open browser DevTools (F12)
   - Go to Application > Local Storage
   - Clear entries related to CRT settings for test device

2. **Launch Application**: Open TeensyROM Web UI in browser

3. **Navigate to Test Components**: Browse files, open video capture, open fullscreen dialog

### Tuning Workflow

For each component (file-image, video-capture, video-dialog):

1. **Open CRT Settings Panel**: Click settings icon/button
2. **Adjust Sliders**: Move sliders to find optimal values
3. **Toggle CSS/WebGL**: Test both render modes
4. **Note Values**: Record all slider positions when satisfied
5. **Screenshot** (optional): Capture example of optimal settings

### What to Tune

**Scanline Intensity**: How dark/visible the horizontal scanlines are
**Scanline Size**: Thickness of scanline effect (px)
**Vignette Strength**: Edge darkening effect
**Screen Curvature**: CRT monitor bulge (0 for Small, experiment for Large)
**Contrast**: Overall image contrast
**Brightness**: Overall image brightness  
**Saturation**: Color intensity
**Hue**: Color shift (usually leave at 0)
**Phosphor Pattern**: WebGL only - "aperture-grille" or "none"
**Phosphor Intensity**: WebGL only - strength of RGB pixel pattern

### Output Format

For each preset, provide a complete object like:

```typescript
SMALL_CSS: {
  scanlineIntensity: 0.3,  // Your tuned value
  scanlineSize: 1.5,       // Your tuned value
  // ... all 17 properties
}
```

### Tips

- **Start with inherited values** (from Phase 2), then adjust
- **Test at different zoom levels** (Ctrl+Plus/Minus)
- **Consider color content** - test with games, images, music visualizations
- **Trust your eyes** - if it looks good, it is good
- **Document why** - brief note explaining your reasoning helps future tuning

</details>
