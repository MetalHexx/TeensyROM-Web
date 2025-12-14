# Task Handoff: Integration Testing

## 📋 Task Identity

**Task ID**: CRT-PRESET-SIMPLIFICATION-TASK-02-006-INTEGRATION-TESTING  
**Task Name**: Integration Testing  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: Medium  
**Estimated Context Size**: Small (Manual testing and validation)

---

## 🎯 Objective

**What**: Perform comprehensive manual and automated integration testing to verify all three components work correctly together with the new preset system.

**Why**: Validate real-world usage scenarios, visual quality, and ensure no regressions in component integration or user workflows.

**Success Criteria**:
- [ ] All three components display CRT effects correctly with new presets
- [ ] WebGL detection selects appropriate preset for first-time users
- [ ] Preset switching in settings panel shows new preset names (Small CSS/WebGL, Large CSS/WebGL)
- [ ] Custom preset creation/deletion still works
- [ ] Settings persistence works across page reloads
- [ ] Device switching re-initializes settings correctly
- [ ] Video device enumeration works (no regressions)
- [ ] Dialog opening/closing works correctly
- [ ] No console errors or warnings
- [ ] Visual quality of CRT effects maintained or improved

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- CRT-PRESET-SIMPLIFICATION-TASK-02-001 through 02-005: All Phase 2 implementation tasks
- All unit tests passing for affected components

**Dependencies**:
- Backend API running (for device communication)
- TeensyROM device connected (for real device testing)
- Test devices available for video capture testing
- All browsers for cross-browser testing (Chrome, Firefox, Edge)

**Constraints**:
- Manual testing required (automated E2E tests optional)
- Requires visual inspection of CRT effect quality
- Should test on real hardware (TeensyROM device) if available
- Test both WebGL-capable and non-WebGL browsers if possible

---

## 📂 File Scope

**No Files to Modify** (manual testing task)

**Files to Review** (testing targets):
- `libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.ts`
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts`
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` (dropdown)

---

## 🔧 Testing Guidance

**Standards to Follow**:
- [Testing Standards](../../../TESTING_STANDARDS.md) - Integration testing approach
- [E2E Testing Guide](../../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - E2E patterns (if writing Cypress tests)

**Key Testing Areas**:

### 1. Component Visual Testing

**File-Image Component** (Small Preset):
1. Navigate to file browser
2. Select image file to display
3. Verify CRT effect displays with subtle effects (Small preset)
4. Check scanline intensity, vignette, curvature appropriate for small display
5. Open settings panel, verify preset dropdown shows "Small CSS" or "Small WebGL"
6. Switch between Small CSS and Small WebGL presets
7. Verify visual changes are correct

**Video-Capture Component** (Small Preset):
1. Navigate to video capture view (compact)
2. Ensure video device is selected
3. Verify CRT effect overlays video stream with subtle effects
4. Check that effect doesn't overwhelm video content
5. Open settings panel, verify preset shows "Small CSS" or "Small WebGL"
6. Test device switching (dropdown) - verify re-initialization works

**Video-Dialog Component** (Large Preset):
1. Open video dialog from compact view (fullscreen button)
2. Verify CRT effect displays with prominent effects (Large preset)
3. Check scanline intensity, vignette, curvature appropriate for fullscreen
4. Open settings panel, verify preset shows "Large CSS" or "Large WebGL"
5. Test fullscreen toggle
6. Close dialog, reopen - verify settings persist

### 2. First-Time User Experience

**WebGL Detection Testing**:
1. Clear browser storage (localStorage)
2. Reload application
3. Navigate to file-image component
4. Verify WebGL preset selected (check DevTools → Application → Storage)
5. Should see "default-small-webgl" or "default-small-css" based on browser
6. Repeat for video-capture and video-dialog
7. Check console for no errors during detection

**CSS Fallback Testing** (if possible):
1. Disable WebGL in browser (Chrome DevTools → Rendering → "Emulate WebGL")
2. Clear storage, reload
3. Navigate to components
4. Verify CSS preset selected ("default-small-css", "default-large-css")
5. Verify CRT effects still render (CSS-based)

### 3. Settings Persistence Testing

**Saved Settings Override**:
1. Set up test: Clear storage, load component, verify WebGL preset selected
2. Modify CRT settings (adjust scanline, vignette, etc.)
3. Save settings (should auto-save)
4. Reload page
5. Verify custom settings loaded (not preset defaults)
6. Check that WebGL detection not called (saved settings override)

**Device Switching**:
1. Connect multiple devices (or mock multiple devices)
2. Switch between devices in UI
3. Verify each device has separate CRT settings
4. Modify settings for device A
5. Switch to device B, verify different settings
6. Switch back to device A, verify settings preserved

### 4. Preset System Testing

**Preset Dropdown**:
1. Open CRT settings panel
2. Verify dropdown shows new preset names:
   - "Small CSS"
   - "Small WebGL"
   - "Large CSS"
   - "Large WebGL"
   - Any custom presets
3. Verify old preset names NOT present (IMAGE, FULLSCREEN, DIALOG variants)
4. Select different presets from dropdown
5. Verify CRT effect updates correctly

**Custom Preset Creation**:
1. Modify CRT settings to custom values
2. Create new custom preset (name: "My Test Preset")
3. Verify preset appears in dropdown
4. Switch to built-in preset, then back to custom
5. Verify custom values restored
6. Delete custom preset
7. Verify preset removed from dropdown

### 5. Regression Testing

**File Display**:
- [ ] File browser still loads and displays files correctly
- [ ] Image rendering not broken by CRT changes
- [ ] File selection and navigation works

**Video Capture**:
- [ ] Video device enumeration works
- [ ] Device selection dropdown functional
- [ ] Video stream displays correctly
- [ ] Compact view layout not broken

**Video Dialog**:
- [ ] Dialog opens from compact view
- [ ] Fullscreen toggle works
- [ ] Close button works
- [ ] Dialog size and layout correct
- [ ] Multiple open/close cycles work

### 6. Error Handling

**Console Monitoring**:
1. Open browser DevTools → Console
2. Perform all testing scenarios above
3. Verify no errors or warnings logged
4. Check for:
   - No WebGL context creation errors
   - No preset key lookup errors
   - No storage errors
   - No undefined reference errors

**Edge Cases**:
- [ ] Component with no deviceId signal (should not crash)
- [ ] Rapid device switching (should not cause race conditions)
- [ ] Opening/closing dialog rapidly (should not cause errors)
- [ ] Invalid saved settings in storage (should fall back gracefully)

---

## 🧪 Testing Requirements

**Manual Test Checklist**:

### File-Image Component
- [ ] Displays with Small preset (WebGL or CSS)
- [ ] Settings panel shows correct preset name
- [ ] Preset switching works
- [ ] Visual quality maintained
- [ ] No console errors

### Video-Capture Component
- [ ] Displays with Small preset (WebGL or CSS)
- [ ] Video device enumeration works
- [ ] Device switching re-initializes correctly
- [ ] Settings panel shows correct preset name
- [ ] No console errors

### Video-Dialog Component
- [ ] Opens with Large preset (WebGL or CSS)
- [ ] Fullscreen toggle works
- [ ] Settings panel shows correct preset name
- [ ] Close and reopen preserves settings
- [ ] No console errors

### Cross-Cutting Scenarios
- [ ] First-time user gets WebGL detection
- [ ] Saved settings override detection
- [ ] Device switching preserves separate settings
- [ ] Custom preset creation/deletion works
- [ ] No visual regressions
- [ ] Page reload preserves settings

**Test Execution**:

```powershell
# Start development server
pnpm start

# Navigate to http://localhost:4200
# Perform manual testing scenarios above

# Optional: Run E2E tests if written
pnpm nx e2e teensyrom-ui-e2e
```

**Documentation of Findings**:
- Document any issues found during testing
- Note any unexpected behavior
- Record visual quality assessments
- Note browser-specific issues (if any)

---

## 📖 Reference Materials

**Related Documentation**:
- [Master Plan - Success Criteria](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md#success-criteria)
- [Phase 2 Plan - Task 6](../phases/CRT-PRESET-SIMPLIFICATION-PHASE-02-COMPONENT-IMPLEMENTATION.md#task-6-integration-testing)
- [E2E Testing Guide](../../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - If writing automated tests

**Related Tasks**:
- CRT-PRESET-SIMPLIFICATION-TASK-02-001 through 02-005: All implementation tasks (completed)

**Reports from Previous Tasks**:
- Review all Phase 2 completion reports for context on changes made

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/CRT-PRESET-SIMPLIFICATION/reports/CRT-PRESET-SIMPLIFICATION-TASK-02-006-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Report Should Include**:
- Summary of testing performed (which scenarios tested)
- List of issues found (if any)
- Visual quality assessment
- Browser compatibility notes
- Recommendations for fixes or improvements
- Confirmation that all success criteria met (or note what failed)

**Return Value**: File path of saved report

---

## 💡 Implementation Notes

**Testing Environment Setup**:
1. Clean browser profile (no cached settings)
2. Backend API running (if testing with real device)
3. Multiple test devices for video testing
4. DevTools open for console monitoring

**Visual Quality Criteria**:
- **Small Preset**: Subtle CRT effect, doesn't overwhelm content
  - Scanline intensity ~0.3
  - Vignette ~0.7
  - Minimal curvature (if any)
- **Large Preset**: Prominent CRT effect, authentic retro look
  - Scanline intensity ~0.6
  - Vignette ~1.5
  - Visible curvature (~115px)

**Common Issues to Watch For**:
- WebGL context creation failures (check console)
- Storage key conflicts causing wrong settings to load
- Preset dropdown showing wrong names
- Settings not persisting across reloads
- Device switching causing race conditions
- Dialog not opening/closing correctly

**Success Indicators**:
- All components render correctly with new presets
- No console errors or warnings
- User workflows unchanged (no regressions)
- Visual quality maintained or improved
- Settings persistence works reliably
- WebGL detection provides appropriate fallback

**When to Report Issues**:
- Any console errors or warnings
- Visual regressions (CRT effects look worse)
- Broken functionality (dialog won't open, settings won't save)
- Performance issues (sluggish rendering, delays)
- Browser-specific problems

**Documentation Format**:
```markdown
## Testing Results

### File-Image Component
✅ Small preset displays correctly
✅ Settings panel shows "Small WebGL"
⚠️ Issue: [Describe any issues found]

### Video-Capture Component
[Results...]

### Video-Dialog Component
[Results...]

### Issues Found
1. [Issue description, steps to reproduce, severity]
2. [Issue description...]

### Recommendations
- [Any recommendations for improvements]
```
