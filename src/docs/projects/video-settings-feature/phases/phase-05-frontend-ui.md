# Phase 5: Frontend UI - Video Settings Section Component

## 🎯 Objective

Create a video settings section component for the settings view that allows users to toggle video capture functionality on/off. This component follows the established pattern of other settings sections (PlayerSettingsSectionComponent, ConnectionSettingsSectionComponent, etc.) and integrates into the existing settings view navigation.

**User Value**: Users gain a dedicated UI control to enable or disable video capture functionality, making the feature discoverable and easy to control.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Master Plan](../master-plan.md) - Overall video settings feature plan
- [ ] [Phase 3 Report](../reports/TASK-03-002-report.md) - VideoSettings domain interface
- [ ] [Phase 4 Report](../reports/TASK-04-001-report.md) - Video settings selectors

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript and Angular conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches
- [ ] [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component testing patterns
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - Styling patterns and utilities
- [ ] [Component Library](../../../COMPONENT_LIBRARY.md) - Available UI components

---

## 📂 File Structure Overview

```
libs/features/settings/src/lib/settings-view/
├── video-settings-section/
│   ├── video-settings-section.component.ts       ✨ New - Video settings section component
│   ├── video-settings-section.component.html     ✨ New - Component template
│   ├── video-settings-section.component.scss     ✨ New - Component styles
│   └── video-settings-section.component.spec.ts  ✨ New - Component tests
├── settings-view.component.ts                     📝 Modified - Import and integrate video section
├── settings-view.component.html                   📝 Modified - Add video section and nav button
└── settings-view.component.spec.ts                📝 Modified - Add tests for video section
```

---

## 📋 Implementation Guidelines

---

<details open>
<summary><h3>Task 1: Create Video Settings Section Component</h3></summary>

**Purpose**: Create a presentational component for video settings that follows the established pattern of PlayerSettingsSectionComponent. This component will display a single toggle control for enabling/disabling video capture.

**Related Documentation:**

- [PlayerSettingsSectionComponent](../../libs/features/settings/src/lib/settings-view/player-settings-section/) - Reference implementation to follow
- [SettingsToggleItemComponent](../../libs/features/settings/src/lib/settings-view/settings-toggle-item/) - Toggle control to use
- [Component Library](../../../COMPONENT_LIBRARY.md#scalingcardcomponent) - ScalingCardComponent usage

**Implementation Subtasks:**

- [ ] **Create Component File**: Create `video-settings-section.component.ts` with VideoSettingsSectionComponent class
- [ ] **Add Component Metadata**: Define selector `lib-video-settings-section`, standalone imports, template/style URLs
- [ ] **Add Input Properties**: Add `formGroup` (required) and `animationTrigger` (default: true) signal inputs
- [ ] **Add JSDoc Comments**: Document component purpose, inputs, and usage example

**Testing Subtask:**

- [ ] **Write Tests**: Create `video-settings-section.component.spec.ts` with component tests (see Testing section below)

**Key Implementation Notes:**

- **Pattern Consistency**: Follow the exact pattern of PlayerSettingsSectionComponent
- **Imports**: Include CommonModule, ReactiveFormsModule, ScalingCardComponent, SettingsToggleItemComponent
- **FormGroup Structure**: Expects a FormGroup with a single `enableVideo` FormControl<boolean>
- **Animation**: Use `animationTrigger` input to control card visibility via ScalingCardComponent

**Component TypeScript Structure** (reference only - minimal snippet):

```typescript
@Component({
  selector: 'lib-video-settings-section',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ScalingCardComponent,
    SettingsToggleItemComponent,
  ],
  // ... template and style URLs
})
export class VideoSettingsSectionComponent {
  formGroup = input.required<FormGroup>();
  animationTrigger = input<boolean>(true);
}
```

**Testing Focus for Task 1:**

> Focus on **behavioral testing** - what observable outcomes occur?

**Behaviors to Test:**

- [ ] **Component Creation**: Component creates successfully without errors
- [ ] **FormGroup Binding**: Component accepts FormGroup via input signal
- [ ] **AnimationTrigger Binding**: Component accepts animationTrigger via input signal with default true
- [ ] **Template Renders**: Component template renders ScalingCardComponent with title "Video Settings"
- [ ] **Toggle Control Renders**: Template renders SettingsToggleItemComponent bound to formControl

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for behavioral testing patterns
- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) for component testing guidance

</details>

---

<details open>
<summary><h3>Task 2: Create Video Settings Section Template</h3></summary>

**Purpose**: Create the HTML template for the video settings section following the established pattern and using the SettingsToggleItemComponent for the EnableVideo control.

**Related Documentation:**

- [player-settings-section.component.html](../../libs/features/settings/src/lib/settings-view/player-settings-section/player-settings-section.component.html) - Reference template
- [SettingsToggleItemComponent](../../libs/features/settings/src/lib/settings-view/settings-toggle-item/) - Toggle control API

**Implementation Subtasks:**

- [ ] **Create Template File**: Create `video-settings-section.component.html`
- [ ] **Add ScalingCard Wrapper**: Use `lib-scaling-card` with title "Video Settings" and bound animationTrigger
- [ ] **Add Form Element**: Wrap content in `<form [formGroup]="formGroup()">` 
- [ ] **Add SettingsToggleItem**: Add single `lib-settings-toggle-item` bound to `enableVideo` form control
- [ ] **Set Toggle Properties**: Configure label, description, and control binding for the toggle

**Testing Subtask:**

- [ ] **Write Tests**: Tests for template rendering are included in Task 1 spec file

**Key Implementation Notes:**

- **Title**: Use "Video Settings" as the card title
- **Toggle Label**: "Enable video capture" (clear and actionable)
- **Toggle Description**: "Show video capture controls in the player interface. Allows capturing video from connected devices." (descriptive and helpful)
- **FormControlName**: Use `enableVideo` to match the FormControl name in VideoSettings domain model
- **No Group Divs Needed**: Only one toggle, so no settings-group divs required (unlike PlayerSettings with multiple groups)

**Template Structure** (reference only):

```html
<lib-scaling-card title="Video Settings" [animationTrigger]="animationTrigger()">
  <form [formGroup]="formGroup()">
    <lib-settings-toggle-item
      label="Enable video capture"
      description="Show video capture controls in the player interface. Allows capturing video from connected devices."
      [control]="formGroup().controls['enableVideo']" />
  </form>
</lib-scaling-card>
```

**Testing Focus for Task 2:**

**Behaviors to Test:**

- [ ] **Card Title Renders**: ScalingCard displays "Video Settings" title
- [ ] **Toggle Label Correct**: Toggle item displays "Enable video capture" label
- [ ] **Toggle Description Correct**: Toggle item displays full description text
- [ ] **FormControl Binding**: Toggle control is bound to formGroup.controls['enableVideo']

**Testing Reference:**

- Tests are written in Task 1's spec file - verify template structure and bindings

</details>

---

<details open>
<summary><h3>Task 3: Create Video Settings Section Styles</h3></summary>

**Purpose**: Create minimal component-specific styles if needed. Most styling is inherited from ScalingCardComponent and SettingsToggleItemComponent.

**Related Documentation:**

- [Style Guide](../../../STYLE_GUIDE.md) - Styling patterns and utilities
- [player-settings-section.component.scss](../../libs/features/settings/src/lib/settings-view/player-settings-section/player-settings-section.component.scss) - Reference styles

**Implementation Subtasks:**

- [ ] **Create Style File**: Create `video-settings-section.component.scss`
- [ ] **Add Minimal Styles**: Only add custom styles if needed for spacing adjustments
- [ ] **Follow Style Guide**: Use CSS variables and utility classes from style guide

**Testing Subtask:**

- [ ] **No Tests Required**: Styling does not require additional tests beyond visual verification

**Key Implementation Notes:**

- **Minimal Styles**: Most styling is provided by ScalingCardComponent and SettingsToggleItemComponent
- **Consistent Spacing**: Match spacing patterns from other settings sections
- **Responsive Design**: Inherited from parent components - no custom media queries needed

**Expected Styles** (likely empty or minimal):

```scss
// Component-specific overrides only if needed
// Most styling inherited from ScalingCardComponent and SettingsToggleItemComponent

:host {
  display: block;
}
```

**Testing Focus for Task 3:**

- No behavioral tests needed for styles
- Visual verification during manual testing

</details>

---

<details open>
<summary><h3>Task 4: Integrate Video Section into Settings View</h3></summary>

**Purpose**: Integrate the new VideoSettingsSectionComponent into the settings view by adding navigation button, FormGroup binding, and section rendering.

**Related Documentation:**

- [settings-view.component.ts](../../libs/features/settings/src/lib/settings-view/settings-view.component.ts) - Main settings view
- [settings-view.component.html](../../libs/features/settings/src/lib/settings-view/settings-view.component.html) - Settings template

**Implementation Subtasks:**

- [ ] **Import Component**: Add VideoSettingsSectionComponent to settings-view.component.ts imports array
- [ ] **Add Navigation Button**: Add "Video" button to navigation card in settings-view.component.html (after "Player" button)
- [ ] **Add Section Rendering**: Add video-settings-section component rendering in section-content div (after player-settings-section)
- [ ] **Add Helper Method**: Add `getVideoSettings()` method to settings-view.component.ts returning video settings FormGroup
- [ ] **Update Active Section Type**: Add 'video' to activeSection signal type union if needed

**Testing Subtask:**

- [ ] **Write Tests**: Add tests for video section integration to settings-view.component.spec.ts (see Testing section below)

**Key Implementation Notes:**

- **Navigation Button Placement**: Place video button after player button (before "File Transfer")
- **Section Icon**: Use Material icon "videocam" for consistency
- **Animation Binding**: Pass `[animationTrigger]="activeSection() === 'video'"` to control visibility
- **FormGroup Accessor**: `getVideoSettings()` should return `this.settingsForm()!.get('videoSettings') as FormGroup`
- **Active Section Default**: No need to change default - keep 'player' as default active section

**Integration Code Structure** (reference only):

```typescript
// In settings-view.component.ts imports
import { VideoSettingsSectionComponent } from './video-settings-section/video-settings-section.component';

// Add to imports array
imports: [
  // ... existing imports
  VideoSettingsSectionComponent,
],

// Add helper method
getVideoSettings(): FormGroup {
  return this.settingsForm()!.get('videoSettings') as FormGroup;
}
```

**Template Integration** (reference only):

```html
<!-- Navigation button (after Player button) -->
<lib-action-button
  icon="videocam"
  label="Video"
  [variant]="activeSection() === 'video' ? 'raised' : 'stroked'"
  [color]="activeSection() === 'video' ? 'primary' : 'normal'"
  (buttonClick)="setActiveSection('video')" />

<!-- Section rendering (after player-settings-section) -->
<lib-video-settings-section
  [formGroup]="getVideoSettings()"
  [animationTrigger]="activeSection() === 'video'" />
```

**Testing Focus for Task 4:**

**Behaviors to Test:**

- [ ] **Video Section Renders**: video-settings-section component is present in DOM
- [ ] **Navigation Button Exists**: Video navigation button is rendered with correct icon and label
- [ ] **Section Activation**: Clicking video button sets activeSection to 'video'
- [ ] **FormGroup Binding**: getVideoSettings() returns correct FormGroup from settings form
- [ ] **Animation Trigger**: Video section receives correct animationTrigger based on activeSection

**Testing Reference:**

- See [settings-view.component.spec.ts](../../libs/features/settings/src/lib/settings-view/settings-view.component.spec.ts) - Follow existing section test patterns
- Look for tests like "should render all settings sections" and "should activate section on navigation button click"

</details>

---

## 🗂️ Files Modified or Created

**New Files:**

- `libs/features/settings/src/lib/settings-view/video-settings-section/video-settings-section.component.ts`
- `libs/features/settings/src/lib/settings-view/video-settings-section/video-settings-section.component.html`
- `libs/features/settings/src/lib/settings-view/video-settings-section/video-settings-section.component.scss`
- `libs/features/settings/src/lib/settings-view/video-settings-section/video-settings-section.component.spec.ts`

**Modified Files:**

- `libs/features/settings/src/lib/settings-view/settings-view.component.ts` - Import video section, add helper method
- `libs/features/settings/src/lib/settings-view/settings-view.component.html` - Add navigation button and section rendering
- `libs/features/settings/src/lib/settings-view/settings-view.component.spec.ts` - Add tests for video section integration

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

> **IMPORTANT:** Tests are written **within each task above**, not here. This section is only a summary for quick reference.

> **Core Testing Philosophy:**
>
> - **Favor behavioral testing** - test what users observe, not implementation details
> - **Test as you go** - tests are integrated into each task's subtasks
> - **Test through public APIs** - components tested through inputs/outputs
> - **Mock at boundaries** - mock form controls, not Angular internals

### Where Tests Are Written

**Task 1**: VideoSettingsSectionComponent behavioral tests

- Component creation
- Input signal bindings
- Template rendering
- FormControl binding

**Task 2**: Template rendering tests (in Task 1 spec)

- Card title
- Toggle labels and descriptions
- FormGroup binding

**Task 3**: No tests required (styles only)

**Task 4**: Settings view integration tests

- Video section rendering
- Navigation button
- Section activation
- FormGroup accessor

### Test Execution Commands

**Running Tests:**

```bash
# Run settings feature tests
pnpm nx test settings

# Run in watch mode during development
pnpm nx test settings --watch

# Run all tests
pnpm nx run-many --target=test --all
```

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

> **Mark checkboxes as criteria are met**. All items must be checked before phase is complete.

**Functional Requirements:**

- [ ] VideoSettingsSectionComponent created following PlayerSettingsSection pattern
- [ ] Component accepts formGroup and animationTrigger inputs
- [ ] Template uses ScalingCardComponent and SettingsToggleItemComponent
- [ ] Video section integrated into settings view navigation
- [ ] Video navigation button displays with "videocam" icon
- [ ] Clicking video button activates video section
- [ ] getVideoSettings() helper method returns correct FormGroup
- [ ] Code follows [Coding Standards](../../../CODING_STANDARDS.md)

**Testing Requirements:**

- [ ] VideoSettingsSectionComponent spec tests pass (5+ tests)
- [ ] Settings view integration tests pass (5+ tests for video section)
- [ ] All existing settings view tests still pass (no regressions)
- [ ] Test coverage meets or exceeds project standards

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes with no errors (`pnpm nx lint settings`)
- [ ] Code formatting is consistent
- [ ] No console errors in browser when navigating to settings view
- [ ] Video section card animates correctly when activated

**Documentation:**

- [ ] Component has JSDoc comments explaining purpose and usage
- [ ] Inputs documented with JSDoc
- [ ] Template includes descriptive labels and help text

**Manual Verification:**

- [ ] Navigate to settings view - all sections visible
- [ ] Click Video button - video section becomes visible
- [ ] Toggle EnableVideo control - form state updates
- [ ] Auto-save triggers correctly when toggling EnableVideo
- [ ] Animation transitions are smooth
- [ ] No layout or styling issues

**Ready for Next Phase:**

- [ ] All success criteria met
- [ ] No known bugs or issues
- [ ] Code reviewed and approved
- [ ] Ready for Phase 6 (Video Capture Integration)

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Design Decisions

- **Single Toggle Pattern**: VideoSettings currently has only one control (EnableVideo), so no settings groups or complex layouts needed. Template is simpler than PlayerSettings.
- **Navigation Placement**: Video button placed after Player button for logical grouping (both media-related settings).
- **Icon Choice**: Using "videocam" Material icon for visual consistency with video capture theme.
- **Default State**: EnableVideo defaults to false (established in Phase 1) - users must explicitly opt-in to video capture.

### Implementation Constraints

- **FormGroup Structure**: SettingsStore already includes videoSettings FormGroup (from Phase 3) - no store changes needed.
- **Pattern Consistency**: Must exactly follow PlayerSettingsSection pattern for maintainability and team familiarity.
- **Animation System**: ScalingCardComponent animation system already established - just pass animationTrigger correctly.

### Future Enhancements

- **Additional Video Settings**: Quality selection, device picker, recording options could be added to this section later
- **Preview Thumbnail**: Could add video preview in settings (requires camera access, probably better in player)
- **Advanced Options**: Codec selection, resolution settings, frame rate controls as power-user features

### External References

- [Material Icons](https://fonts.google.com/icons) - videocam icon reference
- [Angular Reactive Forms](https://angular.io/guide/reactive-forms) - FormGroup and FormControl usage

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

</details>

---

## 💡 Agent Implementation Guide

### Before Starting Implementation

**Verify Prerequisites:**

1. Phase 4 complete - selectors available in SettingsStore
2. VideoSettings domain interface exists with enableVideo property
3. Settings form structure includes videoSettings FormGroup
4. SettingsToggleItemComponent available in features/settings library

**Review Reference Implementations:**

1. Read PlayerSettingsSectionComponent (TypeScript, template, styles)
2. Examine SettingsToggleItemComponent usage patterns
3. Study settings-view.component integration patterns (navigation + sections)

### During Implementation

**Progress Tracking:**

1. ✅ Mark checkboxes in each task as you complete subtasks
2. 📝 Update notes section with any discoveries or decisions
3. 🚧 Document any blockers or questions immediately
4. 📊 Run tests frequently to catch issues early

**Key Implementation Order:**

1. Create component TypeScript file first
2. Create template immediately after (to verify structure)
3. Create minimal styles (likely empty)
4. Write component tests
5. Integrate into settings view (TypeScript + template)
6. Add integration tests to settings view spec
7. Run full test suite to verify no regressions

### After Completing Each Task

1. Verify all subtasks checked off
2. Run tests for that specific file
3. Fix any failures before moving to next task
4. Update progress in this document

### Remember

- **Test as you go** - don't defer testing
- **Follow patterns** - PlayerSettingsSection is your reference
- **Keep it simple** - Only one toggle for now, minimal complexity
- **Animation matters** - Test that sections show/hide correctly

---

**Phase Status**: Ready for execution  
**Dependencies**: Phase 4 complete ✅  
**Estimated Time**: 1-1.5 hours  
**Complexity**: Medium (component creation + integration)
