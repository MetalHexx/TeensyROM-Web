# Phase 3: Settings Panel UI Integration

## 🎯 Objective

Add a barrel distortion slider to the `crt-settings-panel` component, positioned alongside vignette and screen curvature controls in the visual effects group. The slider provides user control over distortion intensity with appropriate range, step, and formatting, respecting the `config.showDistortion` flag for visibility.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Barrel Distortion Master Plan](../BARREL-DISTORTION-MASTER-PLAN.md) - High-level feature plan
- [ ] [Phase 1 Report](../reports/BARREL-DISTORTION-TASK-01-001-DOMAIN-INTEGRATION-report.md) - Domain model integration
- [ ] [Phase 2 Report](../reports/BARREL-DISTORTION-TASK-02-002-REPORT.md) - WebGL shader implementation
- [ ] [Component Library - CRT](../../../COMPONENT_LIBRARY_CRT.md) - CRT settings panel architecture

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [Component Library](../../../COMPONENT_LIBRARY.md) - Reusable UI components
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - Global styles and utilities

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/crt-settings-panel/
├── crt-slider-configs.ts                    📝 Modified - Add DISTORTION_SLIDER config
├── crt-slider-configs.spec.ts               📝 Modified - Add distortion slider tests
├── crt-settings-panel.component.html        📝 Modified - Add distortion slider to template
├── crt-settings-panel.component.spec.ts     📝 Modified - Add distortion slider tests
```

---

## 📋 Implementation Guidelines

> **IMPORTANT - Code Reference Policy:**
>
> - Focus on **WHAT** to implement, not **HOW** to implement it
> - Use **class names**, **method names**, **property names**
> - Small code snippets (2-5 lines) are OK for critical type definitions or formulas only
> - **NO large code blocks** - link to standards docs or existing implementations instead
> - Prefer describing behavior over showing implementation
> - Cross-reference relevant documentation for detailed context

> **IMPORTANT - Testing Policy:**
>
> - **Favor behavioral testing** - test observable behaviors, not implementation details
> - Include tests **within each task** as work progresses, not at the end
> - Each task should have its own testing subtask
> - See [Testing Standards](../../../TESTING_STANDARDS.md) for behavioral testing guidance

> **IMPORTANT - Progress Tracking:**
>
> - **Mark checkboxes ✅ as you complete each subtask**
> - Update progress throughout implementation, not just at the end
> - This helps track what's done and what remains

---

<details open>
<summary><h3>Task 1: Add Distortion Slider Configuration and Template Integration</h3></summary>

**Purpose**: Create the slider configuration for barrel distortion and integrate it into the settings panel template, grouped with vignette and curvature controls.

**Related Documentation:**

- [crt-slider-configs.ts patterns](c:\dev\src\TeensyROM-Web\src\libs\ui\components\src\lib\crt-settings-panel\crt-slider-configs.ts) - Existing slider configuration patterns
- [crt-settings-panel.component.html](c:\dev\src\TeensyROM-Web\src\libs\ui\components\src\lib\crt-settings-panel\crt-settings-panel.component.html) - Template structure for slider groups

**Implementation Subtasks:**

- [ ] **Add DISTORTION_SLIDER config**: Create new `SliderConfig` constant in `crt-slider-configs.ts` with:
  - `key: 'barrelDistortion'`
  - `label: 'Barrel Distortion'`
  - `min: 0`, `max: 0.5`, `step: 0.01`
  - `format: 'percentage'`, `decimalPlaces: 0`
- [ ] **Export DISTORTION_SLIDER**: Add to file exports for consumption by settings panel component
- [ ] **Add slider to template**: Insert distortion slider in `crt-settings-panel.component.html` in the "Vignette & Curvature" section (between vignette and curvature sliders)
- [ ] **Conditional visibility**: Wrap slider in `@if (config().showDistortion)` to respect config flag
- [ ] **Update section comment**: Change section comment from "Vignette & Curvature" to "Visual Effects (Vignette, Distortion, Curvature)"

**Testing Subtask:**

- [ ] **Write Tests**: Test slider configuration and template rendering (see Testing section below)

**Key Implementation Notes:**

- Follow the exact same pattern as `VIGNETTE_SLIDER` and `CURVATURE_SLIDER` for consistency
- The `config().showDistortion` flag is already defined in `CrtSettingsConfig` (verified in Phase 1)
- Position between vignette and curvature creates logical progression: edge darkening → image warping → container curvature
- The percentage format will display values as "0%" to "50%" (0.0 to 0.5 mapped to percentage)

**Testing Focus for Task 1:**

> Focus on **behavioral testing** - what observable outcomes occur?

**Behaviors to Test:**

- [ ] **Slider config validation**: `DISTORTION_SLIDER` config has correct properties (key, label, min/max/step, format)
- [ ] **Template rendering**: Distortion slider renders in template when `config.showDistortion` is true
- [ ] **Visibility control**: Distortion slider is hidden when `config.showDistortion` is false
- [ ] **Value emission**: Changing distortion slider emits `settingsChange` event with updated `barrelDistortion` value
- [ ] **Formatting**: Slider displays percentage format with 0 decimal places

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for testing approach
- See existing tests in `crt-settings-panel.component.spec.ts` for slider testing patterns

</details>

---

## 🗂️ Files Modified or Created

> List all files that will be changed or created during this phase with full relative paths from project root.

**Modified Files:**

- `libs/ui/components/src/lib/crt-settings-panel/crt-slider-configs.ts`
- `libs/ui/components/src/lib/crt-settings-panel/crt-slider-configs.spec.ts`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts`

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

> **IMPORTANT:** Tests are written **within the task above**, not here. This section is only a summary for quick reference.

> **Core Testing Philosophy:**
>
> - **Favor behavioral testing** - test what users/consumers observe, not how it's implemented
> - **Test as you go** - tests are integrated into task subtasks, not deferred to the end
> - **Test through public APIs** - components should be tested through their public interfaces
> - **Mock at boundaries** - mock external dependencies, not internal logic

> **Reference Documentation:**
>
> - **All tasks**: [Testing Standards](../../../TESTING_STANDARDS.md) - Core behavioral testing approach

### Where Tests Are Written

**Tests are embedded in Task 1 above** with:

- **Testing Subtask**: Checkbox in the task's subtask list ("Write Tests: Test slider configuration and template rendering")
- **Testing Focus**: "Behaviors to Test" section listing observable outcomes
- **Testing Reference**: Links to relevant testing documentation

**Complete the task's testing subtask before marking the task complete.**

### Test Execution Commands

**Running Tests:**

```bash
# Run tests for crt-settings-panel component
pnpm nx test ui-components --testFile=crt-settings-panel.component.spec.ts

# Run tests in watch mode during development
pnpm nx test ui-components --testFile=crt-settings-panel.component.spec.ts --watch

# Run all ui-components tests
pnpm nx test ui-components
```

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

> **Mark checkboxes as criteria are met**. All items must be checked before phase is complete.

**Functional Requirements:**

- [ ] `DISTORTION_SLIDER` config added to `crt-slider-configs.ts` with correct properties
- [ ] Distortion slider renders in template between vignette and curvature sliders
- [ ] Slider respects `config().showDistortion` flag for visibility
- [ ] Slider value changes emit `settingsChange` event with updated `barrelDistortion` value
- [ ] Code follows [Coding Standards](../../../CODING_STANDARDS.md)

**Testing Requirements:**

- [ ] All testing subtasks completed within Task 1
- [ ] All behavioral test checkboxes verified
- [ ] Tests written alongside implementation (not deferred)
- [ ] All tests passing with no failures
- [ ] Test coverage meets or exceeds project standards

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes with no errors (`pnpm nx lint ui-components`)
- [ ] Code formatting is consistent
- [ ] No console errors in browser when running application
- [ ] Slider visually renders correctly in settings panel

**Documentation:**

- [ ] Inline code comments added for complex logic (if any)
- [ ] Section comment in template updated to reflect all three visual effects

**Ready for Next Phase:**

- [ ] All success criteria met
- [ ] No known bugs or issues
- [ ] Distortion slider fully functional and tested
- [ ] Ready to proceed to Phase 4 (Integration Testing & Documentation)

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Design Decisions

- **Slider Positioning**: Placed between vignette and curvature to create a logical visual effects progression: edge darkening → geometric warping → container curvature. This grouping helps users understand that these three effects work together to create the CRT appearance.

- **Range Selection (0-0.5)**: Matches the range used for chromatic aberration effect (another distortion effect), creating consistency across distortion-related settings. Values above 0.5 would cause extreme warping that looks unrealistic for CRT emulation.

- **Percentage Format**: Displays as "0%" to "50%" which is more user-friendly than decimal values (0.0-0.5). Users can think of it as "50% distortion intensity" rather than abstract decimals.

### Implementation Constraints

- **Config Flag Dependency**: The `showDistortion` flag must exist in `CrtSettingsConfig` (verified in Phase 1) for visibility control to work. If the flag is missing, the slider will always render.

- **Existing Slider Pattern**: Must follow the exact same pattern as existing sliders (vignette, curvature) for maintainability and consistency. This includes slider binding, value emission, and formatting.

### Future Enhancements

- **Distortion Presets**: Consider adding a "Distortion Preset" dropdown alongside the slider (like phosphor pattern dropdown) with options like "None", "Subtle", "Moderate", "Strong" for users who prefer presets over fine-tuning.

- **Screen Curvature Coupling UI**: Display an info tooltip explaining that distortion is influenced by screen curvature setting, helping users understand the relationship between the two effects.

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

</details>

---

## 💡 Agent Implementation Guide

> **Instructions for AI agents creating and using this document**

### Before Implementation

**Ask Clarifying Questions:**

1. **Testing Strategy**:
   - Are there specific edge cases for the distortion slider that need testing?
   - Should we test interaction between distortion slider and screen curvature slider?

2. **Implementation Approach**:
   - Should the slider be positioned immediately after vignette or immediately before curvature?
   - Any specific tooltip text to explain barrel distortion to users?

3. **Success Definition**:
   - Should we manually test the slider in the actual application UI?
   - Any specific visual appearance requirements for the slider?

### During Implementation

**Progress Tracking:**

1. ✅ **Mark Checkboxes**: Check off each item as you complete it
2. 📝 **Update Notes**: Add discoveries or decisions made during implementation
3. 🚧 **Track Blockers**: Document any blockers or questions that arise
4. 📊 **Update Status**: Keep success criteria current as work progresses

**Testing Integration:**

1. **Test as you go**: Complete the task's testing subtask before moving on
2. **Behavioral focus**: Test observable outcomes (slider renders, value emits, visibility toggles)
3. **Public API**: Test through component inputs/outputs
4. **Reference docs**: Use [Testing Standards](../../../TESTING_STANDARDS.md)

### After Completing Task 1

1. Verify all subtasks are checked off
2. Ensure testing subtask is complete
3. Confirm all behavioral tests pass
4. Update any relevant notes or discoveries
5. Mark task as complete in document

### Remember

You are a **disciplined implementer** who:

- Tests first to establish baseline
- Follows standards rigorously
- Writes clean, idiomatic Angular code
- Avoids hacky solutions and shortcuts
- Respects framework conventions and web standards
- Documents changes pragmatically
- Tracks debt when appropriate
- Asks clarifying questions early
- Marks progress incrementally
- Delivers high-quality, maintainable code

When in doubt: **Test first. Follow standards. Choose quality over speed. Ask questions rather than hack.**

---

## 🎓 Examples of Good Task Completion

### ✅ Good Progress Tracking

```markdown
- [x] **Add DISTORTION_SLIDER config**: Created with correct properties
- [x] **Export DISTORTION_SLIDER**: Added to exports
- [x] **Add slider to template**: Inserted between vignette and curvature
- [x] **Conditional visibility**: Wrapped in @if (config().showDistortion)
- [x] **Update section comment**: Changed to "Visual Effects (Vignette, Distortion, Curvature)"
- [x] **Write Tests**: All 5 behavioral tests passing
```

### ✅ Good Notes Section

```markdown
### Discoveries During Implementation

- **Slider Positioning**: Placed after vignette (line 234) and before curvature (line 256) in template
- **Test Pattern**: Followed exact same test pattern as vignette slider tests for consistency
- **Visual Verification**: Manually tested slider in video-dialog - renders correctly with proper spacing
```
