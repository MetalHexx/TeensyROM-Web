# TASK-05-001: Create Video Settings Section Component and Integrate into Settings View

## 📋 Task Metadata

**Task ID**: TASK-05-001-VIDEO-SETTINGS-UI-COMPONENT  
**Task Name**: Create Video Settings Section Component and Integrate into Settings View  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Medium (7 files total)  
**Phase**: Phase 5 - Frontend UI Components  
**Complexity**: Medium

---

## 🎯 Objective

**What**: Create a new VideoSettingsSectionComponent following the established pattern of PlayerSettingsSectionComponent, then integrate it into the settings view with navigation button and section rendering.

**Why**: Provides users with a discoverable UI control to enable/disable video capture functionality. This completes the frontend implementation of the video settings feature, making it accessible through the settings interface.

**Success Criteria**:

- [ ] VideoSettingsSectionComponent created with TypeScript, template, styles, and spec files
- [ ] Component follows PlayerSettingsSectionComponent pattern exactly
- [ ] Component accepts `formGroup` (required) and `animationTrigger` (default: true) signal inputs
- [ ] Template uses ScalingCardComponent wrapper with "Video Settings" title
- [ ] Template includes SettingsToggleItemComponent for "Enable video capture" control
- [ ] Component integrated into settings-view with navigation button ("videocam" icon)
- [ ] Video section renders when navigation button clicked
- [ ] getVideoSettings() helper method added to settings-view
- [ ] All tests pass (10+ tests: 5 for component, 5 for integration)
- [ ] No console errors or TypeScript warnings
- [ ] Code follows all standards (Coding, Testing, Style Guide)

---

## 📚 Context & Dependencies

### Prerequisites Completed

- ✅ Phase 1: VideoSettings backend domain model exists
- ✅ Phase 2: Backend API fully supports VideoSettings (DTOs, endpoints, validation)
- ✅ Phase 3: Frontend VideoSettings domain interface and infrastructure integration complete
- ✅ Phase 4: SettingsStore selectors created (`selectVideoSettings`, `selectEnableVideo`)
- ✅ SettingsStore already includes videoSettings FormGroup (from Phase 3)
- ✅ Settings form structure already has videoSettings (no store changes needed)

### Dependencies

- **Application Layer**: SettingsStore (already has videoSettings state)
- **Domain Layer**: VideoSettings interface (from Phase 3)
- **UI Components**: ScalingCardComponent, SettingsToggleItemComponent
- **Angular**: CommonModule, ReactiveFormsModule, Material modules

### Constraints

- **Pattern Consistency**: Must exactly match PlayerSettingsSectionComponent pattern
- **Single Toggle**: Only one control (EnableVideo) - no settings groups needed
- **Animation System**: Use existing ScalingCardComponent animation via animationTrigger input
- **Navigation Placement**: Video button goes after Player button (before File Transfer)

---

## 📁 File Scope

### Files to Create (4 new files)

- `libs/features/settings/src/lib/settings-view/video-settings-section/video-settings-section.component.ts`
  - **Purpose**: Video settings section component class with inputs and metadata
  - **Pattern**: Copy structure from player-settings-section.component.ts
  - **Key Details**: Standalone component, signal inputs (formGroup, animationTrigger), minimal imports

- `libs/features/settings/src/lib/settings-view/video-settings-section/video-settings-section.component.html`
  - **Purpose**: Template for video settings section
  - **Pattern**: Simplified version of player-settings-section.component.html (only one toggle)
  - **Key Details**: ScalingCard wrapper, form element, single SettingsToggleItemComponent

- `libs/features/settings/src/lib/settings-view/video-settings-section/video-settings-section.component.scss`
  - **Purpose**: Component-specific styles (likely minimal or empty)
  - **Pattern**: Copy minimal structure from player-settings-section.component.scss
  - **Key Details**: Host display:block, no custom styles needed (inherited from parent components)

- `libs/features/settings/src/lib/settings-view/video-settings-section/video-settings-section.component.spec.ts`
  - **Purpose**: Unit tests for VideoSettingsSectionComponent
  - **Pattern**: Follow player-settings-section.component.spec.ts structure
  - **Key Details**: Test component creation, input bindings, template rendering, formControl binding

### Files to Modify (3 existing files)

- `libs/features/settings/src/lib/settings-view/settings-view.component.ts`
  - **What Changes**: Add VideoSettingsSectionComponent import, add to imports array, add getVideoSettings() helper method
  - **Why**: Enable video section rendering and form access
  - **Integration Point**: Imports array, component class methods

- `libs/features/settings/src/lib/settings-view/settings-view.component.html`
  - **What Changes**: Add video navigation button (after player button), add video-settings-section rendering (after player-settings-section)
  - **Why**: Make video section navigable and visible in UI
  - **Integration Point**: Navigation card button list, section-content div

- `libs/features/settings/src/lib/settings-view/settings-view.component.spec.ts`
  - **What Changes**: Add tests for video section rendering, navigation button, section activation, formGroup binding
  - **Why**: Verify video section integrates correctly with settings view
  - **Integration Point**: Test suite - add new describe block or tests to existing blocks

### Files to Review (for context only)

- `libs/features/settings/src/lib/settings-view/player-settings-section/player-settings-section.component.ts`
  - **Why Review**: Reference implementation - shows exact pattern to follow
  - **Key Patterns**: Component decorator structure, signal inputs, JSDoc comments

- `libs/features/settings/src/lib/settings-view/player-settings-section/player-settings-section.component.html`
  - **Why Review**: Template pattern - shows ScalingCard and SettingsToggleItem usage
  - **Key Patterns**: Form binding, toggle item configuration

- `libs/features/settings/src/lib/settings-view/settings-toggle-item/settings-toggle-item.component.ts`
  - **Why Review**: Understanding SettingsToggleItemComponent API
  - **Key Patterns**: label, description, control inputs

---

## 🛠️ Implementation Guidance

### Standards to Follow

- [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript, Angular 19 conventions (standalone, signals)
- [Testing Standards](../../../TESTING_STANDARDS.md) - Behavioral testing approach
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component testing patterns
- [Style Guide](../../../STYLE_GUIDE.md) - CSS utilities, Material Design tokens
- [Component Library](../../../COMPONENT_LIBRARY.md) - ScalingCardComponent, SettingsToggleItemComponent usage

### Key Requirements

1. **Component Structure**:
   - Standalone component with all imports in decorator
   - Signal-based inputs: `formGroup = input.required<FormGroup>()`, `animationTrigger = input<boolean>(true)`
   - JSDoc comments on class and all inputs
   - No component logic (pure presentational)

2. **Template Requirements**:
   - Use `lib-scaling-card` with title "Video Settings"
   - Bind `[animationTrigger]="animationTrigger()"`
   - Wrap content in `<form [formGroup]="formGroup()">`
   - Use `lib-settings-toggle-item` with:
     - `label="Enable video capture"`
     - `description="Show video capture controls in the player interface. Allows capturing video from connected devices."`
     - `[control]="formGroup().controls['enableVideo']"`

3. **Integration Requirements**:
   - Import VideoSettingsSectionComponent in settings-view.component.ts
   - Add to imports array
   - Add `getVideoSettings(): FormGroup { return this.settingsForm()!.get('videoSettings') as FormGroup; }`
   - Add navigation button after Player button with icon "videocam"
   - Add section rendering after player-settings-section
   - Pass `[formGroup]="getVideoSettings()"` and `[animationTrigger]="activeSection() === 'video'"`

4. **Testing Requirements**:
   - **Component Tests** (5+ tests in video-settings-section.component.spec.ts):
     - Component creates successfully
     - Accepts formGroup input
     - Accepts animationTrigger input with default true
     - Renders ScalingCard with "Video Settings" title
     - Renders SettingsToggleItem bound to enableVideo control
   - **Integration Tests** (5+ tests in settings-view.component.spec.ts):
     - Video section renders in DOM
     - Video navigation button exists with correct icon/label
     - Clicking video button activates video section
     - getVideoSettings() returns correct FormGroup
     - Video section receives correct animationTrigger

### Anti-Patterns to Avoid

- ❌ **Don't add business logic** - This is a presentational component
- ❌ **Don't inject stores directly** - FormGroup comes from parent via input
- ❌ **Don't create custom form controls** - Use SettingsToggleItemComponent
- ❌ **Don't add complex styling** - Inherit from ScalingCard and SettingsToggleItem
- ❌ **Don't test implementation details** - Test observable behaviors only
- ❌ **Don't modify store structure** - videoSettings FormGroup already exists

---

## 🧪 Testing Requirements

### Test Coverage Required

**Unit Tests (VideoSettingsSectionComponent)**:

- [ ] Component creates without errors
- [ ] Accepts formGroup signal input
- [ ] Accepts animationTrigger signal input
- [ ] Defaults animationTrigger to true when not provided
- [ ] Renders ScalingCard with correct title
- [ ] Renders SettingsToggleItem with correct label
- [ ] Binds SettingsToggleItem to formGroup.controls['enableVideo']

**Integration Tests (SettingsViewComponent)**:

- [ ] Video section component is present in DOM
- [ ] Video navigation button renders with "videocam" icon
- [ ] Video navigation button has "Video" label
- [ ] Clicking video button calls setActiveSection('video')
- [ ] Video section receives formGroup from getVideoSettings()
- [ ] Video section animationTrigger is true when activeSection is 'video'
- [ ] Video section animationTrigger is false when activeSection is not 'video'
- [ ] getVideoSettings() returns FormGroup from settingsForm.get('videoSettings')

### Behavioral Expectations

**Component Behaviors**:

- Component renders without errors when given valid FormGroup
- Component displays video settings card with animation
- Toggle control updates form state when clicked
- Form validation works correctly (enableVideo is boolean)

**Integration Behaviors**:

- Video section becomes visible when video button clicked
- Animation transitions smoothly when switching sections
- Form changes in video section trigger auto-save (inherited from settings view)
- Video section hidden when other navigation buttons clicked

**Edge Cases**:

- Component handles missing formGroup gracefully (required input enforced by TypeScript)
- animationTrigger=false hides card correctly
- Switching sections rapidly doesn't cause animation glitches

---

## 📚 Related Documentation

**Planning Documents**:

- [Master Plan](../master-plan.md#phase-5) - Overall feature plan
- [Phase 5 Plan](../phases/phase-05-frontend-ui.md) - Detailed phase plan for this task
- [Phase 4 Report](../reports/TASK-04-001-report.md) - Selectors available for consumption
- [Phase 3 Report](../reports/TASK-03-002-report.md) - VideoSettings domain interface

**Architecture & Standards**:

- [Overview Context](../../../OVERVIEW_CONTEXT.md) - Clean Architecture layers
- [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript and Angular 19 conventions
- [Testing Standards](../../../TESTING_STANDARDS.md) - Behavioral testing approach
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component testing patterns
- [Style Guide](../../../STYLE_GUIDE.md) - CSS variables and utilities
- [Component Library](../../../COMPONENT_LIBRARY.md) - UI component catalog

**Reference Implementations**:

- [PlayerSettingsSectionComponent](../../libs/features/settings/src/lib/settings-view/player-settings-section/) - Pattern to follow
- [SettingsViewComponent](../../libs/features/settings/src/lib/settings-view/settings-view.component.ts) - Integration target
- [SettingsToggleItemComponent](../../libs/features/settings/src/lib/settings-view/settings-toggle-item/) - Toggle control API

**Related Tasks**:

- TASK-01-001: Backend VideoSettings domain model (completed)
- TASK-03-002: Frontend domain interface and mapper (completed)
- TASK-04-001: SettingsStore selectors (completed)
- TASK-06-001: Video capture conditional rendering (next phase)

---

## 📤 Output Requirements

### Output Report Location

**File Path**: `docs/projects/video-settings-feature/reports/TASK-05-001-report.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

### Report Contents Required

Your completion report must include:

1. **Task Summary**: What was accomplished
2. **Files Created/Modified**: List all 7 files with purposes
3. **Implementation Details**:
   - Component structure and key decisions
   - Template structure and toggle configuration
   - Integration approach (navigation + rendering)
4. **Testing Results**:
   - Number of tests added (should be 10+)
   - All tests passing confirmation
   - Test execution output summary
5. **Code Quality Verification**:
   - TypeScript compilation: no errors
   - Linting: no warnings
   - Console: no browser errors
6. **Manual Verification**:
   - Settings view navigation works
   - Video section displays correctly
   - Toggle control functions properly
   - Animation transitions smoothly
7. **Discoveries**: Any insights or decisions made during implementation
8. **Next Steps**: Ready for Phase 6 (video capture integration)

### Return Value

When complete, return the file path: `docs/projects/video-settings-feature/reports/TASK-05-001-report.md`

---

## 🎯 Quick Start Checklist

Before you begin, verify:

- [x] Phase 4 complete (selectors available)
- [x] SettingsStore has videoSettings FormGroup
- [x] VideoSettings domain interface exists
- [x] PlayerSettingsSectionComponent exists (reference pattern)
- [x] SettingsToggleItemComponent exists (UI control)
- [x] ScalingCardComponent exists (layout wrapper)

**Implementation Order**:

1. ✅ Review reference implementations (player-settings-section files)
2. ✅ Create VideoSettingsSectionComponent TypeScript file
3. ✅ Create template with ScalingCard and toggle
4. ✅ Create minimal styles file
5. ✅ Write component unit tests
6. ✅ Run component tests (`pnpm nx test settings`)
7. ✅ Integrate into settings-view.component.ts
8. ✅ Integrate into settings-view.component.html
9. ✅ Add integration tests to settings-view.component.spec.ts
10. ✅ Run all tests (`pnpm nx test settings`)
11. ✅ Manual verification in browser
12. ✅ Write completion report

---

## 💡 Implementation Tips

### Pattern Replication

**PlayerSettingsSection → VideoSettingsSection Mapping**:

- `selector: 'lib-player-settings-section'` → `selector: 'lib-video-settings-section'`
- Card title "Player Settings" → "Video Settings"
- Multiple toggles and dropdown → Single toggle
- No settings-group divs needed (only one control)

### Common Gotchas

- **FormControl Access**: Use `formGroup().controls['enableVideo']` (not `formGroup().get('enableVideo')`)
- **Signal Syntax**: Remember to call signal functions: `formGroup()`, `animationTrigger()`
- **Animation Binding**: Must pass `[animationTrigger]="activeSection() === 'video'"` correctly
- **Import Paths**: Use `@teensyrom-nx/ui/components` for ScalingCardComponent

### Testing Tips

- **Component Tests**: Mock FormGroup with FormControl('enableVideo', false)
- **Integration Tests**: Mock entire settings form structure including videoSettings
- **Query Selectors**: Use `lib-video-settings-section`, `lib-settings-toggle-item` for DOM queries
- **Animation Testing**: Can test animationTrigger input changes (input visible/hidden)

---

## 🚀 Ready to Execute

**Estimated Time**: 1-1.5 hours  
**Complexity**: Medium (component creation + integration)  
**Dependencies**: All prerequisites met ✅  
**Blockers**: None  

This task is **ready for immediate execution**. All context provided. Follow the Phase 5 plan document for detailed guidance on each subtask.

---

**Document Version**: 1.0  
**Created**: November 26, 2025  
**Status**: Ready for execution
