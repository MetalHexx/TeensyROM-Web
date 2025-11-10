# Phase 4: Settings Feature Layer - UI Components & User Interactions

## 🎯 Objective

Implement the feature layer UI components for settings management, enabling users to view, edit, and save application settings through an intuitive interface. This phase creates the Angular components that consume the SettingsStore from Phase 3, following Clean Architecture with proper component testing and accessibility.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [SETTINGS_FEATURE_P1](./SETTINGS_FEATURE_P1.md) - Backend foundation
- [ ] [SETTINGS_FEATURE_P2](./SETTINGS_FEATURE_P2.md) - Infrastructure service
- [ ] [SETTINGS_FEATURE_P3](./SETTINGS_FEATURE_P3.md) - Application layer state management

**Standards & Guidelines:**

- [ ] [Smart Component Testing](../../SMART_COMPONENT_TESTING.md) - Component testing with stores
- [ ] [Style Guide](../../STYLE_GUIDE.md) - UI styling standards
- [ ] [Component Library](../../COMPONENT_LIBRARY.md) - Available shared components
- [ ] [State Standards](../../STATE_STANDARDS.md) - Store consumption patterns

**Reference Implementations:**

- [ ] `libs/features/player/` - Player feature components as reference
- [ ] `libs/features/devices/` - Device feature components as reference  
- [ ] `libs/ui/components/` - Shared UI component library

---

## 📂 File Structure Overview

```
libs/features/settings/
├── src/
│   ├── lib/
│   │   ├── settings-view/
│   │   │   ├── settings-view.component.ts                        ✨ New - Main settings container (smart)
│   │   │   ├── settings-view.component.html                      ✨ New - Settings view template
│   │   │   ├── settings-view.component.scss                      ✨ New - Settings view styles
│   │   │   ├── settings-view.component.spec.ts                   ✨ New - Component tests
│   │   │   ├── connection-settings/
│   │   │   │   ├── connection-settings.component.ts              ✨ New - Connection config form
│   │   │   │   ├── connection-settings.component.html            ✨ New - Connection form template
│   │   │   │   ├── connection-settings.component.scss            ✨ New - Connection form styles
│   │   │   │   ├── connection-settings.component.spec.ts         ✨ New - Form tests
│   │   │   ├── player-settings/
│   │   │   │   ├── player-settings.component.ts                  ✨ New - Player preferences form
│   │   │   │   ├── player-settings.component.html                ✨ New - Player form template
│   │   │   │   ├── player-settings.component.scss                ✨ New - Player form styles
│   │   │   │   ├── player-settings.component.spec.ts             ✨ New - Form tests
│   │   │   ├── search-settings/
│   │   │   │   ├── search-settings.component.ts                  ✨ New - Search config form
│   │   │   │   ├── search-settings.component.html                ✨ New - Search form template
│   │   │   │   ├── search-settings.component.scss                ✨ New - Search form styles
│   │   │   │   ├── search-settings.component.spec.ts             ✨ New - Form tests
│   │   │   ├── file-transfer-settings/
│   │   │   │   ├── file-transfer-settings.component.ts           ✨ New - File transfer form
│   │   │   │   ├── file-transfer-settings.component.html         ✨ New - File transfer template
│   │   │   │   ├── file-transfer-settings.component.scss         ✨ New - File transfer styles
│   │   │   │   ├── file-transfer-settings.component.spec.ts      ✨ New - Form tests
│   │   │   └── settings-toolbar/
│   │   │       ├── settings-toolbar.component.ts                 ✨ New - Save/reset toolbar
│   │   │       ├── settings-toolbar.component.html               ✨ New - Toolbar template
│   │   │       ├── settings-toolbar.component.scss               ✨ New - Toolbar styles
│   │   │       ├── settings-toolbar.component.spec.ts            ✨ New - Toolbar tests
│   │   └── index.ts                                              ✨ New - Feature barrel export
│   └── index.ts                                                  ✨ New - Library barrel export
├── project.json                                                  📝 Modified - Add library config
└── README.md                                                     ✨ New - Feature documentation

apps/teensyrom-ui/src/app/
└── app.routes.ts                                                 📝 Modified - Add settings route
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>Task 1: Create Settings Feature Library</h3></summary>

**Purpose**: Set up the Nx library structure for the settings feature following the established patterns.

**Related Documentation:**
- [Nx Library Standards](../../NX_LIBRARY_STANDARDS.md) - Library creation patterns (if exists)
- Player feature library structure - Reference for library organization

**Implementation Subtasks:**

- [ ] **Generate settings feature library**: 
  - Run: `npx nx g @nx/angular:library settings --directory=libs/features/settings --importPath=@teensyrom-nx/features/settings --standalone`
  - Verify library created in correct location
  - Update `tsconfig.base.json` paths if needed
- [ ] **Configure library dependencies**:
  - Add `@teensyrom-nx/domain` - For models and contracts
  - Add `@teensyrom-nx/application` - For SettingsStore
  - Add `@teensyrom-nx/ui/components` - For shared UI components
  - Add `@angular/forms` - For reactive forms
  - Add `@angular/material` - For Material Design components
- [ ] **Create feature barrel exports**: Set up `index.ts` files for clean imports
- [ ] **Update project.json**: Configure test, lint, and build targets

**Testing Subtask:**

- [ ] **Verify Setup**: Run `npx nx build features-settings` and verify successful build

**Key Implementation Notes:**

- Follow feature library naming convention: `libs/features/[feature-name]`
- Use `importPath` for clean import statements in consuming code
- Standalone components - no NgModule needed
- Feature is lazy-loadable via routing

</details>

---

<details open>
<summary><h3>Task 2: Create Settings View Container (Smart Component)</h3></summary>

**Purpose**: Implement the main settings container component that orchestrates child components and manages store interaction.

**Related Documentation:**
- [Smart Component Testing](../../SMART_COMPONENT_TESTING.md) - Smart component patterns
- [Component Library - Layout Components](../../COMPONENT_LIBRARY.md#layout-components) - Available layouts

**Implementation Subtasks:**

- [ ] **Create `SettingsViewComponent`**: 
  - Smart component that injects `SettingsStore`
  - Uses Angular Material tabs for settings sections
  - Orchestrates child setting form components
  - Handles save/reset operations via toolbar
- [ ] **Implement component TypeScript**:
  - Inject `SettingsStore` from application layer
  - Create computed signals for store data: `settings()`, `isLoading()`, `hasUnsavedChanges()`
  - Implement `onSave()` method calling store's `saveSettings()`
  - Implement `onReset()` method calling store's `resetToDefaults()`
  - Handle component initialization: call `loadSettings()` on `ngOnInit()`
- [ ] **Create component template**:
  - Use `<lib-scaling-card>` for main container with animation
  - Use `<mat-tab-group>` for settings sections
  - Include child components: connection, player, search, file-transfer settings
  - Add `<lib-settings-toolbar>` in corner slot for save/reset actions
  - Show loading state with `<mat-spinner>` or `<lib-loading-text>`
  - Show error state with Material snackbar or error message
- [ ] **Create component styles**:
  - Use SCSS with design tokens from [Style Guide](../../STYLE_GUIDE.md)
  - Ensure responsive layout for different screen sizes
  - Style tabs according to Material theme
  - Add proper spacing and padding

**Testing Subtask:**

- [ ] **Write Component Tests**: 
  - Test component initialization loads settings
  - Test save button triggers store action
  - Test reset button triggers store action
  - Test unsaved changes enable save button
  - Test loading state displays correctly
  - Test error state displays error message

**Key Implementation Notes:**

- Component is "smart" - knows about store, coordinates child components
- Use Angular Material components for consistent UI
- Leverage shared UI components from `@teensyrom-nx/ui/components`
- Follow [Smart Component Testing](../../SMART_COMPONENT_TESTING.md) for tests
- Component is lazy-loaded via routing

**Behaviors to Test:**

- [ ] Component loads settings on initialization
- [ ] Save button disabled when no unsaved changes
- [ ] Save button enabled when settings modified
- [ ] Save button triggers store saveSettings action
- [ ] Reset button shows confirmation dialog
- [ ] Reset button triggers store resetToDefaults action
- [ ] Loading spinner shows during operations
- [ ] Error messages display on failures

</details>

---

<details open>
<summary><h3>Task 3: Create Connection Settings Form Component</h3></summary>

**Purpose**: Implement form component for connection configuration (serial, TCP, auto-connect).

**Related Documentation:**
- [Component Library - Form Components](../../COMPONENT_LIBRARY.md#form-components) - Form input patterns
- [Style Guide](../../STYLE_GUIDE.md) - Form styling standards

**Implementation Subtasks:**

- [ ] **Create `ConnectionSettingsComponent`**:
  - Dumb component (input/output pattern)
  - Input: `connectionSettings()` - Current connection config
  - Output: `settingsChange` - Emits updated settings
  - Uses Angular reactive forms for validation
- [ ] **Implement component TypeScript**:
  - Create `FormGroup` with form controls for all connection properties
  - Add validators: required fields, port ranges, valid formats
  - Patch form values when input changes
  - Emit changes on form value updates (debounced)
  - Handle connection type toggle (serial vs TCP)
- [ ] **Create component template**:
  - Use `<lib-input-field>` for text inputs
  - Use `<mat-form-field>` with Material inputs for numbers
  - Use `<mat-radio-group>` for connection type selection
  - Use `<mat-slide-toggle>` for auto-connect checkbox
  - Group serial settings (port, baud rate)
  - Group TCP settings (host, port, timeouts)
  - Show/hide sections based on connection type
  - Display validation errors inline
- [ ] **Create component styles**:
  - Use form grid layout for organized fields
  - Add conditional styling for show/hide sections
  - Style validation errors with error color

**Testing Subtask:**

- [ ] **Write Component Tests**:
  - Test form initializes with provided settings
  - Test form emits changes on user input
  - Test connection type toggle shows/hides sections
  - Test validation errors display correctly
  - Test invalid forms don't emit changes

**Key Implementation Notes:**

- Component is "dumb" - no store interaction, pure input/output
- Use reactive forms for validation and change tracking
- Debounce form value changes to avoid excessive emissions
- Follow Angular Material form patterns
- Ensure accessibility with proper labels and ARIA attributes

**Behaviors to Test:**

- [ ] Form populates with initial connection settings
- [ ] Form emits updated settings on change
- [ ] Connection type toggle switches between serial/TCP sections
- [ ] Validation errors prevent form submission
- [ ] Invalid port ranges show validation messages
- [ ] Auto-connect checkbox toggles correctly

</details>

---

<details open>
<summary><h3>Task 4: Create Player Settings Form Component</h3></summary>

**Purpose**: Implement form component for player preferences (repeat mode, timers, filters, startup settings).

**Related Documentation:**
- [Component Library - Form Components](../../COMPONENT_LIBRARY.md#form-components) - Form patterns
- [Style Guide](../../STYLE_GUIDE.md) - UI styling

**Implementation Subtasks:**

- [ ] **Create `PlayerSettingsComponent`**:
  - Dumb component (input/output pattern)
  - Input: `playerSettings()` - Current player config
  - Output: `settingsChange` - Emits updated settings
  - Uses reactive forms
- [ ] **Implement component TypeScript**:
  - Create `FormGroup` for all player properties
  - Add form controls for booleans (slide toggles)
  - Add select for startup filter type
  - Patch form values when input changes
  - Emit changes on form updates
- [ ] **Create component template**:
  - Use `<mat-slide-toggle>` for boolean preferences
  - Use `<mat-select>` for filter type dropdown
  - Group related settings (playback, filters, startup)
  - Add helpful descriptions for each setting
  - Use Material card/section dividers
- [ ] **Create component styles**:
  - Organize settings in logical groups
  - Add spacing between sections
  - Style toggle switches consistently

**Testing Subtask:**

- [ ] **Write Component Tests**:
  - Test form initializes with player settings
  - Test toggles update settings correctly
  - Test filter dropdown emits changes
  - Test form emits complete settings object

**Key Implementation Notes:**

- Component is "dumb" - input/output only
- Use slide toggles for boolean preferences (better UX than checkboxes)
- Group settings logically (playback, filters, startup)
- Add tooltips or help text for complex settings

**Behaviors to Test:**

- [ ] Form populates with initial player settings
- [ ] Toggle switches update settings
- [ ] Filter dropdown changes emit updates
- [ ] Form emits complete updated settings object

</details>

---

<details open>
<summary><h3>Task 5: Create Search Settings Form Component</h3></summary>

**Purpose**: Implement form component for search configuration (weights, stop words, banned files/directories).

**Related Documentation:**
- [Component Library - Form Components](../../COMPONENT_LIBRARY.md#form-components) - Form inputs
- [Style Guide](../../STYLE_GUIDE.md) - Styling standards

**Implementation Subtasks:**

- [ ] **Create `SearchSettingsComponent`**:
  - Dumb component (input/output pattern)
  - Input: `searchSettings()` - Current search config
  - Output: `settingsChange` - Emits updated settings
  - Uses reactive forms with nested form groups
- [ ] **Implement component TypeScript**:
  - Create nested `FormGroup` for search weights
  - Add form arrays for stop words and banned lists
  - Add validators for weight ranges (>= 0)
  - Patch form values when input changes
  - Emit changes on form updates
  - Implement add/remove for list items
- [ ] **Create component template**:
  - Use sliders or number inputs for search weights
  - Use chip lists with add/remove for stop words
  - Use chip lists for banned directories/files
  - Add helpful labels and descriptions
  - Show weight value feedback
  - Add buttons to add/remove list items
- [ ] **Create component styles**:
  - Layout weights in grid format
  - Style chip lists consistently
  - Add spacing for readability

**Testing Subtask:**

- [ ] **Write Component Tests**:
  - Test form initializes with search settings
  - Test weight sliders update settings
  - Test adding items to lists works
  - Test removing items from lists works
  - Test validation prevents negative weights

**Key Implementation Notes:**

- Component is "dumb" - input/output pattern
- Use Material chip lists for dynamic arrays
- Weight sliders provide better UX than number inputs
- Validate weights sum to meaningful values

**Behaviors to Test:**

- [ ] Form populates with initial search settings
- [ ] Weight sliders emit changes
- [ ] Stop words can be added and removed
- [ ] Banned lists can be modified
- [ ] Validation prevents invalid weights

</details>

---

<details open>
<summary><h3>Task 6: Create File Transfer Settings Form Component</h3></summary>

**Purpose**: Implement form component for file transfer configuration (watch directory, auto-transfer settings).

**Related Documentation:**
- [Component Library - Form Components](../../COMPONENT_LIBRARY.md#form-components) - Input components
- [Style Guide](../../STYLE_GUIDE.md) - Form styling

**Implementation Subtasks:**

- [ ] **Create `FileTransferSettingsComponent`**:
  - Dumb component (input/output pattern)
  - Input: `fileTransferSettings()` - Current file transfer config
  - Output: `settingsChange` - Emits updated settings
  - Uses reactive forms
- [ ] **Implement component TypeScript**:
  - Create `FormGroup` for file transfer properties
  - Add validators for path formats
  - Patch form values when input changes
  - Emit changes on form updates
- [ ] **Create component template**:
  - Use `<lib-input-field>` for directory paths
  - Use `<mat-slide-toggle>` for auto-copy/launch flags
  - Add file/directory picker button (if feasible)
  - Display path validation errors
  - Add help text for path formats
- [ ] **Create component styles**:
  - Layout paths with adequate width
  - Style toggle switches
  - Add spacing between settings

**Testing Subtask:**

- [ ] **Write Component Tests**:
  - Test form initializes with file transfer settings
  - Test path inputs emit changes
  - Test toggles update settings
  - Test validation for invalid paths

**Key Implementation Notes:**

- Component is "dumb" - input/output only
- Path validation depends on platform (Windows/Unix)
- Consider file picker integration if supported
- Add helpful examples for path formats

**Behaviors to Test:**

- [ ] Form populates with initial file transfer settings
- [ ] Path inputs emit changes
- [ ] Toggle switches update auto-transfer flags
- [ ] Validation catches invalid paths

</details>

---

<details open>
<summary><h3>Task 7: Create Settings Toolbar Component</h3></summary>

**Purpose**: Implement toolbar component with save and reset buttons, including unsaved changes indicator.

**Related Documentation:**
- [Component Library - Action Buttons](../../COMPONENT_LIBRARY.md#action-button-component) - Button components
- [Style Guide](../../STYLE_GUIDE.md) - Button styling

**Implementation Subtasks:**

- [ ] **Create `SettingsToolbarComponent`**:
  - Dumb component (input/output pattern)
  - Input: `hasUnsavedChanges()` - Dirty flag from store
  - Input: `isSaving()` - Saving operation in progress
  - Output: `save` - Emits save request
  - Output: `reset` - Emits reset request
- [ ] **Implement component TypeScript**:
  - Emit save event on save button click
  - Emit reset event on reset button click
  - Show confirmation dialog for reset (Material Dialog)
- [ ] **Create component template**:
  - Use `<lib-action-button>` for save button
  - Use `<lib-action-button>` for reset button with error color
  - Disable save button when no unsaved changes
  - Show loading spinner on save button when saving
  - Add unsaved changes indicator (badge or icon)
- [ ] **Create component styles**:
  - Layout buttons horizontally with spacing
  - Style save button with success color
  - Style reset button with error color

**Testing Subtask:**

- [ ] **Write Component Tests**:
  - Test save button emits save event
  - Test reset button shows confirmation dialog
  - Test save button disabled when no changes
  - Test loading state on save button

**Key Implementation Notes:**

- Component is "dumb" - input/output pattern
- Use Material Dialog for reset confirmation
- Disable save button to prevent accidental saves
- Show loading feedback during save operation

**Behaviors to Test:**

- [ ] Save button emits save event
- [ ] Reset button shows confirmation dialog
- [ ] Confirmed reset emits reset event
- [ ] Save button disabled when no unsaved changes
- [ ] Loading indicator shows during save

</details>

---

<details open>
<summary><h3>Task 8: Add Settings Route and Navigation</h3></summary>

**Purpose**: Configure routing to make settings accessible and add navigation from app shell.

**Related Documentation:**
- [Angular Routing](https://angular.dev/guide/routing) - Routing patterns
- App shell component - Navigation structure

**Implementation Subtasks:**

- [ ] **Add settings route** in `app.routes.ts`:
  - Path: `'/settings'`
  - Lazy load: `loadComponent: () => import('@teensyrom-nx/features/settings').then(m => m.SettingsViewComponent)`
  - Add route guard if needed (authentication)
- [ ] **Add navigation menu item**:
  - Add settings icon and label to navigation menu
  - Link to `/settings` route
  - Add icon: `'settings'` from Material Icons
- [ ] **Test navigation**:
  - Verify clicking navigation opens settings
  - Verify direct URL navigation works
  - Verify lazy loading works correctly

**Testing Subtask:**

- [ ] **Manual Navigation Test**: Open settings from menu and via URL

**Key Implementation Notes:**

- Use lazy loading for performance
- Settings accessible from main navigation
- Consider route guard for authenticated access (if needed)
- Add breadcrumb or header indicating settings page

</details>

---

<details open>
<summary><h3>Task 9: Integration Testing with E2E</h3></summary>

**Purpose**: Create end-to-end tests validating the full settings workflow from UI to backend.

**Related Documentation:**
- [E2E Tests Documentation](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - E2E testing patterns (if exists)
- Cypress or Playwright setup - E2E framework

**Implementation Subtasks:**

- [ ] **Create E2E test spec** for settings feature:
  - Navigate to settings page
  - Modify connection settings
  - Modify player settings
  - Save changes
  - Verify settings persist after reload
  - Reset to defaults
  - Verify defaults restored
- [ ] **Test error scenarios**:
  - Test validation errors display
  - Test network error handling
  - Test unsaved changes warning
- [ ] **Test accessibility**:
  - Verify keyboard navigation works
  - Verify screen reader labels correct
  - Test focus management

**Testing Subtask:**

- [ ] **Run E2E Tests**: Execute full E2E suite and verify passes

**Key Implementation Notes:**

- Mock backend API for consistent test environment
- Test happy paths and error scenarios
- Verify accessibility compliance
- Ensure tests are stable and repeatable

**Behaviors to Test:**

- [ ] User can navigate to settings page
- [ ] User can modify all settings sections
- [ ] Save button persists changes to backend
- [ ] Settings reload correctly after page refresh
- [ ] Reset button restores default settings
- [ ] Validation errors prevent invalid saves
- [ ] Unsaved changes warning prevents data loss

</details>

---

## ✅ Success Criteria

> **Mark checkboxes as criteria are met**. All items must be checked before phase is complete.

**Functional Requirements:**

- [ ] All implementation tasks completed and checked off
- [ ] All subtasks within each task completed
- [ ] Code follows [Style Guide](../../STYLE_GUIDE.md) and component patterns
- [ ] Settings UI accessible via navigation menu
- [ ] All settings sections implemented with forms
- [ ] Save functionality persists changes to backend
- [ ] Reset functionality restores defaults

**Testing Requirements:**

- [ ] All testing subtasks completed within each task
- [ ] Component tests validate behaviors
- [ ] E2E tests cover full user workflows
- [ ] All tests passing with no failures
- [ ] Test coverage meets project standards

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes with no errors (`pnpm nx lint features-settings`)
- [ ] Components follow Angular best practices
- [ ] Accessibility standards met (WCAG 2.1 AA)
- [ ] Responsive design works on all screen sizes

**Documentation:**

- [ ] Inline code comments for complex component logic
- [ ] Component JSDoc documentation complete
- [ ] Feature README with usage instructions
- [ ] Update main application documentation

**Ready for Release:**

- [ ] All success criteria met
- [ ] No known bugs or issues
- [ ] Feature tested end-to-end
- [ ] Settings feature ready for production use

---

## 📝 Notes & Considerations

### Design Decisions

- **Tab-Based Layout**: Settings organized in tabs for better organization (connection, player, search, file transfer)
- **Dumb/Smart Component Split**: Forms are dumb (input/output), container is smart (store integration)
- **Reactive Forms**: Angular reactive forms for validation and change tracking
- **Material Design**: Consistent with application's Material theme
- **Unsaved Changes Warning**: Prevent accidental data loss with dirty flag

### Implementation Constraints

- **Browser Limitations**: File picker may have limited functionality in web context
- **Path Validation**: Platform-specific path formats need consideration
- **Real-time Updates**: Settings don't auto-save - require explicit save action
- **No Multi-User**: Settings are per-application, not per-user (for now)

### Future Enhancements

- **Settings Import/Export**: Allow users to share/backup settings
- **Settings Profiles**: Named settings configurations for different scenarios
- **Settings Sync**: Sync settings across devices (cloud storage)
- **Advanced Validation**: More sophisticated validation rules
- **Keyboard Shortcuts**: Quick access to save/reset actions
- **Settings Search**: Filter/search settings by keyword

### External References

- [Angular Material Components](https://material.angular.io/components) - Material component library
- [Reactive Forms Guide](https://angular.dev/guide/forms/reactive-forms) - Form patterns
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/) - Accessibility standards

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

- Component composition patterns that work well
- Material component quirks or limitations
- Form validation challenges
- Accessibility findings

---

## 💡 Agent Implementation Guide

> **Instructions for AI agents implementing this phase**

### Prerequisites

- Phase 3 (Application Layer) must be complete with working SettingsStore
- Understand Angular standalone components pattern
- Familiarize with Angular Material components
- Review shared component library from `@teensyrom-nx/ui/components`

### Key Patterns to Follow

1. **Component Architecture**:
   - Smart container: SettingsViewComponent (store integration)
   - Dumb forms: All settings form components (input/output)
   - Toolbar component: Dumb button container

2. **Form Handling**:
   - Use reactive forms for validation
   - Debounce form value changes
   - Emit complete settings objects
   - Display validation errors inline

3. **Store Integration**:
   - Inject SettingsStore in smart component only
   - Use computed signals for reactive data
   - Call store actions for save/reset
   - Handle loading and error states

4. **Styling**:
   - Use SCSS with design tokens
   - Follow Material theme
   - Ensure responsive layout
   - Maintain accessibility

5. **Testing**:
   - Test component behaviors, not implementation
   - Mock store for component tests
   - Use E2E tests for full workflows
   - Verify accessibility

### Common Pitfalls to Avoid

- Don't put store logic in dumb components (forms)
- Don't skip form validation - user input needs validation
- Don't forget accessibility attributes (labels, ARIA)
- Don't ignore responsive design - test on mobile
- Don't skip E2E tests - UI workflows are critical
- Don't hardcode styles - use design tokens

### Component Development Workflow

1. Create component with CLI: `npx nx g component`
2. Define inputs and outputs (for dumb components)
3. Implement TypeScript logic
4. Create template with Material components
5. Add styles following style guide
6. Write component tests
7. Test manually in browser
8. Verify accessibility

### Testing Strategy

- Component tests: Test each component in isolation
- Integration tests: Test smart component with mocked store
- E2E tests: Test full user workflows with real backend
- Accessibility: Use automated tools + manual testing
- Coverage: Aim for >80% on component logic

---

_Last Updated: 2025-11-10_
_Phase Author: Coding Agent_
_Status: Ready for Implementation_
