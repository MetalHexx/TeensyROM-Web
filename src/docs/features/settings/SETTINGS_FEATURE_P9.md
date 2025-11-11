# Phase 9: E2E Testing & Polish

## 🎯 Objective

Create comprehensive Cypress E2E test suites covering all settings functionality with proper interceptor, fixture, and data generator infrastructure. Complete the feature with accessibility testing, responsive design validation, and final polish touchups. This phase ensures production-ready quality through rigorous end-to-end testing following established E2E patterns.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md) - Complete feature overview
- [ ] [Phase 8 Completion](./SETTINGS_FEATURE_P8.md) - Undo/redo functionality (prerequisite)

**E2E Testing Documentation (CRITICAL - Read Deeply):**

- [ ] **CRITICAL**: [E2E Testing Guide](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - **Read deeply through this document and ALL linked documentation**
- [ ] [E2E Test Patterns](../../../apps/teensyrom-ui-e2e/src/support/) - Study interceptor, fixture, and generator patterns
- [ ] **Study Existing Tests**: Review all *.cy.ts files for established patterns

**Backend Reference:**

- [ ] [Settings Endpoints](https://github.com/MetalHexx/TeensyROM-Web/tree/main/src/apps/api/src/TeensyRom.Api/Endpoints/Settings) - API endpoints to mock

**Standards & Guidelines:**

- [ ] [Testing Standards](../../TESTING_STANDARDS.md) - Testing philosophy
- [ ] [Coding Standards](../../CODING_STANDARDS.md) - Accessibility requirements

**Accessibility:**

- WCAG 2.1 AA Guidelines - Accessibility compliance standards

---

## 📂 File Structure Overview

> E2E test infrastructure and test suites.

```
apps/teensyrom-ui-e2e/src/
├── e2e/
│   └── settings.cy.ts                        ✨ New - Complete settings E2E test suite
├── support/
│   ├── interceptors/
│   │   └── settings.interceptors.ts          ✨ New - API mocking for settings endpoints
│   ├── generators/
│   │   └── settings.generators.ts            ✨ New - Test data generation functions
│   └── constants/
│       └── settings.constants.ts             ✨ New - Selectors, routes, test constants
└── fixtures/
    └── settings.json                         ✨ New - Static test fixture data
```

---

<details open>
<summary><h3>Task 1: Create E2E Testing Infrastructure</h3></summary>

**Purpose**: Build foundational E2E testing infrastructure following established patterns from E2E_TESTS.md.

**Related Documentation:**

- **CRITICAL**: [E2E Testing Guide](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - Read ALL sections and linked docs
- [Settings Backend Endpoints](https://github.com/MetalHexx/TeensyROM-Web/tree/main/src/apps/api/src/TeensyRom.Api/Endpoints/Settings) - Endpoints to mock
- **Study**: Existing interceptor files in `apps/teensyrom-ui-e2e/src/support/interceptors/` for patterns

**Implementation Subtasks:**

- [ ] Create `settings.interceptors.ts` following interceptor patterns
- [ ] Mock GET /api/v1/settings endpoint (load settings)
- [ ] Mock PUT /api/v1/settings endpoint (save settings)
- [ ] Create `settings.generators.ts` for dynamic test data
- [ ] Implement generateSettings() function with configurable options
- [ ] Implement generateInvalidSettings() for validation testing
- [ ] Create `settings.constants.ts` for selectors and routes
- [ ] Define data-testid selectors for all interactive elements
- [ ] Create `settings.json` fixture with sample settings data

**Testing Subtask:**

- [ ] Verify infrastructure works with basic E2E tests (see Task 2)

**Key Implementation Notes:**

- **CRITICAL**: Study existing interceptor files to match established patterns exactly
- Interceptors must handle both success and error scenarios
- Generators should create realistic, varied test data
- Constants file centralizes selectors (prevents brittle tests)
- Fixtures provide consistent baseline data
- Follow naming conventions from existing E2E infrastructure
- Mock all Settings endpoints per backend API structure

**Infrastructure Pattern** (reference existing files for exact implementation):

```typescript
// settings.interceptors.ts pattern (simplified - see actual interceptor files)
export const interceptGetSettings = (settings?: Settings) => {
  cy.intercept('GET', '/api/v1/settings', {
    statusCode: 200,
    body: settings || generateSettings()
  }).as('getSettings');
};

export const interceptSaveSettings = (shouldFail = false) => {
  cy.intercept('PUT', '/api/v1/settings', {
    statusCode: shouldFail ? 500 : 200,
    body: shouldFail ? { error: 'Save failed' } : { success: true }
  }).as('saveSettings');
};
```

**Testing Focus for Task 1:**

> **Infrastructure setup** - verify mocking works correctly.

**Behaviors to Verify:**

- [ ] Interceptors successfully mock settings endpoints
- [ ] Generators produce valid test data
- [ ] Constants provide correct selectors
- [ ] Fixtures load correctly in tests

</details>

<details open>
<summary><h3>Task 2: Create Navigation and Load E2E Tests</h3></summary>

**Purpose**: Test settings view navigation, initial load, and data display.

**Related Documentation:**

- [E2E Testing Guide](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - Navigation testing patterns
- [Settings Constants](./SETTINGS_FEATURE_P5.md) - Route configuration

**Implementation Subtasks:**

- [ ] Create settings.cy.ts file
- [ ] Write test: "navigates to settings view via menu"
- [ ] Write test: "loads settings on view mount"
- [ ] Write test: "displays all settings sections"
- [ ] Write test: "shows loading indicator while fetching"
- [ ] Write test: "handles settings load errors with alerts"
- [ ] Use interceptors for API mocking
- [ ] Use data-testid selectors from constants

**Testing Subtask:**

- [ ] Complete Navigation Test Suite (see Testing section below)

**Key Implementation Notes:**

- Use interceptGetSettings() to mock API responses
- Verify all four sections render (player, file-transfer, search, app)
- Test loading states with interceptor delays
- Test error scenarios with failed interceptors
- Verify infrastructure layer alerts appear on errors

**Testing Focus for Task 2:**

> Test **navigation and initial load** - verify view loads correctly.

**Behaviors to Test (Cypress):**

- [ ] Settings menu item navigates to /settings route
- [ ] Settings view renders on navigation
- [ ] API call made to GET /api/v1/settings
- [ ] Loading indicator shown during fetch
- [ ] All four sections displayed after load
- [ ] Alert shown if settings load fails

</details>

<details open>
<summary><h3>Task 3: Create Form Interaction E2E Tests</h3></summary>

**Purpose**: Test form field interactions, validation, and user input handling.

**Related Documentation:**

- [E2E Testing Guide](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - Form testing patterns
- [SaveSettings Validators](https://github.com/MetalHexx/TeensyROM-Web/blob/main/src/apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/SaveSettingsModels.cs) - Validation rules

**Implementation Subtasks:**

- [ ] Write test: "updates player settings fields"
- [ ] Write test: "updates file transfer settings"
- [ ] Write test: "adds and removes watch folders"
- [ ] Write test: "updates search settings and weights"
- [ ] Write test: "updates app settings"
- [ ] Write test: "shows validation errors for invalid inputs"
- [ ] Write test: "prevents save when form invalid"
- [ ] Use Cypress commands for form interaction

**Testing Subtask:**

- [ ] Complete Form Interaction Test Suite (see Testing section below)

**Key Implementation Notes:**

- Test all form field types (selects, sliders, checkboxes, text inputs)
- Verify FormArray behavior (watch folders add/remove)
- Test inline validation error messages
- Test validation prevents invalid form submission
- Use cy.get() with data-testid selectors for reliability

**Testing Focus for Task 3:**

> Test **form interactions** - verify all form fields work correctly.

**Behaviors to Test (Cypress):**

- [ ] All form fields accept user input
- [ ] Form values update correctly
- [ ] Watch folders can be added dynamically
- [ ] Watch folders can be removed
- [ ] Invalid inputs show validation errors
- [ ] Invalid form cannot be submitted
- [ ] Form validity updates reactively

</details>

<details open>
<summary><h3>Task 4: Create Auto-Save E2E Tests</h3></summary>

**Purpose**: Test debounced auto-save functionality with loading indicators and success feedback.

**Related Documentation:**

- [E2E Testing Guide](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - Async behavior testing
- [Phase 7](./SETTINGS_FEATURE_P7.md) - Auto-save implementation

**Implementation Subtasks:**

- [ ] Write test: "triggers auto-save after debounce period"
- [ ] Write test: "shows loading indicator during save"
- [ ] Write test: "updates last saved timestamp on success"
- [ ] Write test: "debounces multiple rapid changes"
- [ ] Write test: "does not save invalid forms"
- [ ] Write test: "shows alert on save error"
- [ ] Use cy.clock() and cy.tick() for debounce testing
- [ ] Use interceptSaveSettings() for API mocking

**Testing Subtask:**

- [ ] Complete Auto-Save Test Suite (see Testing section below)

**Key Implementation Notes:**

- Use cy.clock() to control time and test debounce accurately
- Use cy.tick(500) to advance past debounce period
- Intercept PUT /api/v1/settings to verify save called
- Test both successful and failed save scenarios
- Verify infrastructure layer alerts on errors
- Verify loading-text component visibility during saves

**Testing Focus for Task 4:**

> Test **auto-save behavior** - verify debounced saves work correctly.

**Behaviors to Test (Cypress):**

- [ ] Form changes trigger save after 500ms
- [ ] Multiple rapid changes debounced to single save
- [ ] Loading indicator shown during save
- [ ] Timestamp updated after successful save
- [ ] Invalid forms do not trigger save
- [ ] Save errors show alert notifications
- [ ] User can continue editing after save

</details>

<details open>
<summary><h3>Task 5: Create Undo/Redo E2E Tests</h3></summary>

**Purpose**: Test undo/redo functionality via buttons and keyboard shortcuts.

**Related Documentation:**

- [E2E Testing Guide](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - Keyboard interaction testing
- [Phase 8](./SETTINGS_FEATURE_P8.md) - Undo/redo implementation

**Implementation Subtasks:**

- [ ] Write test: "undo button reverts changes"
- [ ] Write test: "redo button reapplies changes"
- [ ] Write test: "Ctrl+Z keyboard shortcut triggers undo"
- [ ] Write test: "Ctrl+Y keyboard shortcut triggers redo"
- [ ] Write test: "buttons disabled when unavailable"
- [ ] Write test: "history position indicator updates"
- [ ] Write test: "auto-save does not trigger on undo/redo"
- [ ] Use cy.type() with special keys for keyboard shortcuts

**Testing Subtask:**

- [ ] Complete Undo/Redo Test Suite (see Testing section below)

**Key Implementation Notes:**

- Test both button clicks and keyboard shortcuts
- Verify form updates correctly on undo/redo
- Verify auto-save does NOT trigger during undo/redo operations
- Test button disabled states via canUndo/canRedo
- Test history position indicator accuracy
- Use cy.type('{ctrl}z') for keyboard shortcuts

**Testing Focus for Task 5:**

> Test **undo/redo functionality** - verify history navigation works.

**Behaviors to Test (Cypress):**

- [ ] Undo button reverts form to previous state
- [ ] Redo button reapplies undone changes
- [ ] Ctrl+Z triggers undo
- [ ] Ctrl+Y triggers redo
- [ ] Buttons disabled appropriately
- [ ] History indicator shows correct position
- [ ] No auto-save during undo/redo
- [ ] Multiple undo/redo operations work correctly

</details>

<details open>
<summary><h3>Task 6: Create Error Handling E2E Tests</h3></summary>

**Purpose**: Test error scenarios and infrastructure layer alert notifications.

**Related Documentation:**

- [E2E Testing Guide](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - Error scenario testing
- [PlayerService](../../../libs/infrastructure/src/lib/player/player.service.ts) - Alert pattern reference

**Implementation Subtasks:**

- [ ] Write test: "shows alert on settings load error"
- [ ] Write test: "shows alert on settings save error"
- [ ] Write test: "form remains editable after save error"
- [ ] Write test: "user can retry save after error"
- [ ] Write test: "loading indicator disappears on error"
- [ ] Use failed interceptors to trigger errors
- [ ] Verify alert component appears with error messages

**Testing Subtask:**

- [ ] Complete Error Handling Test Suite (see Testing section below)

**Key Implementation Notes:**

- **CRITICAL**: Verify infrastructure layer alerts appear (not component errors)
- Use interceptors with error responses (status 500, 400, etc.)
- Test that isSaving flag resets on error
- Verify form remains editable and functional after errors
- Test user can make changes and retry save
- Alert messages should be user-friendly

**Testing Focus for Task 6:**

> Test **error handling** - verify errors handled gracefully via alerts.

**Behaviors to Test (Cypress):**

- [ ] Load errors show alert notification
- [ ] Save errors show alert notification
- [ ] Loading indicator hidden on error
- [ ] Form remains editable after error
- [ ] isSaving flag reset on error
- [ ] User can retry operations after error
- [ ] Error messages clear and actionable

</details>

<details open>
<summary><h3>Task 7: Create Responsive Design E2E Tests</h3></summary>

**Purpose**: Test settings view on different viewport sizes (desktop, tablet, mobile).

**Related Documentation:**

- [E2E Testing Guide](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - Responsive testing patterns
- [Style Guide](../../STYLE_GUIDE.md) - Responsive breakpoints

**Implementation Subtasks:**

- [ ] Write test: "renders correctly on desktop (1920x1080)"
- [ ] Write test: "renders correctly on tablet (768x1024)"
- [ ] Write test: "renders correctly on mobile (375x667)"
- [ ] Write test: "sections stack vertically on mobile"
- [ ] Write test: "toolbar remains accessible on mobile"
- [ ] Write test: "forms usable on touch devices"
- [ ] Use cy.viewport() to test different sizes

**Testing Subtask:**

- [ ] Complete Responsive Design Test Suite (see Testing section below)

**Key Implementation Notes:**

- Test at standard breakpoints (desktop, tablet, mobile)
- Verify card layout adapts to screen size
- Ensure toolbar buttons accessible on small screens
- Test form fields usable on touch devices
- Verify no horizontal scrolling on mobile
- Test menu and navigation work on all sizes

**Testing Focus for Task 7:**

> Test **responsive design** - verify layout adapts to screen sizes.

**Behaviors to Test (Cypress):**

- [ ] Desktop layout uses multi-column grid
- [ ] Tablet layout uses appropriate columns
- [ ] Mobile layout stacks sections vertically
- [ ] All controls accessible on mobile
- [ ] No horizontal overflow on any size
- [ ] Touch interactions work on mobile
- [ ] Toolbar buttons accessible on all sizes

</details>

<details open>
<summary><h3>Task 8: Create Accessibility (a11y) E2E Tests</h3></summary>

**Purpose**: Verify WCAG 2.1 AA compliance and keyboard navigation support.

**Related Documentation:**

- [E2E Testing Guide](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - Accessibility testing patterns
- WCAG 2.1 AA Guidelines - Accessibility standards
- **Study**: Existing a11y tests in other *.cy.ts files

**Implementation Subtasks:**

- [ ] Install and configure cypress-axe plugin
- [ ] Write test: "passes axe accessibility audit"
- [ ] Write test: "all form fields have labels"
- [ ] Write test: "keyboard navigation works throughout"
- [ ] Write test: "focus indicators visible"
- [ ] Write test: "ARIA attributes present"
- [ ] Write test: "screen reader compatible"
- [ ] Use cy.checkA11y() for automated audits

**Testing Subtask:**

- [ ] Complete Accessibility Test Suite (see Testing section below)

**Key Implementation Notes:**

- Use cypress-axe for automated WCAG 2.1 AA testing
- Test keyboard-only navigation (tab, enter, space, arrows)
- Verify focus management and visible focus indicators
- Test ARIA labels on interactive elements
- Verify form field label associations
- Test screen reader support (role attributes)
- Address any axe violations found

**Testing Focus for Task 8:**

> Test **accessibility** - verify WCAG 2.1 AA compliance.

**Behaviors to Test (Cypress):**

- [ ] No axe accessibility violations
- [ ] All form fields have associated labels
- [ ] Keyboard navigation reaches all controls
- [ ] Focus indicators clearly visible
- [ ] ARIA labels present on icon buttons
- [ ] Semantic HTML structure maintained
- [ ] Color contrast meets WCAG standards
- [ ] Form validation errors announced properly

</details>

---

## ✅ Success Criteria

> All criteria must be met for feature completion.

**E2E Testing Infrastructure:**

- [ ] Interceptors created for all Settings endpoints
- [ ] Data generators produce realistic test data
- [ ] Constants file defines all selectors
- [ ] Fixtures provide baseline test data
- [ ] Infrastructure follows E2E_TESTS.md patterns exactly

**Test Coverage:**

- [ ] Navigation and load tests (6 tests)
- [ ] Form interaction tests (7 tests)
- [ ] Auto-save tests (7 tests)
- [ ] Undo/redo tests (8 tests)
- [ ] Error handling tests (7 tests)
- [ ] Responsive design tests (7 tests)
- [ ] Accessibility tests (8 tests)
- [ ] **Total: 50 E2E tests minimum**

**Quality Assurance:**

- [ ] All E2E tests passing consistently
- [ ] No flaky tests (intermittent failures)
- [ ] Tests run in reasonable time (<5 minutes)
- [ ] WCAG 2.1 AA compliance verified
- [ ] Responsive design validated
- [ ] Error scenarios thoroughly tested

**User Experience:**

- [ ] All interactions smooth and intuitive
- [ ] Visual feedback clear and timely
- [ ] Error messages helpful and actionable
- [ ] Loading states prevent confusion
- [ ] Keyboard shortcuts discoverable

**Production Ready:**

- [ ] All unit tests passing (Phases 1-8)
- [ ] All E2E tests passing (Phase 9)
- [ ] No console errors or warnings
- [ ] Performance acceptable
- [ ] Documentation complete

---

## 🧪 Testing Summary

> Comprehensive E2E test coverage for production readiness.

**Test Distribution:**

- **E2E Tests**: 50+ tests across 8 test suites (navigation, forms, auto-save, undo/redo, errors, responsive, a11y)
- **Infrastructure**: Interceptors, generators, constants, fixtures
- **Total Feature Tests**: ~460 tests (300 unit, 50 integration, 110 E2E)

**Testing Tools:**

- **Framework**: Cypress for all E2E tests
- **Patterns**: Follow [E2E Testing Guide](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) exactly
- **Accessibility**: cypress-axe for WCAG 2.1 AA testing
- **Mocking**: Interceptors for API responses, generators for test data

**Key Testing Patterns:**

1. **Infrastructure Setup** (Task 1):
   - Interceptors for API mocking (following existing patterns)
   - Generators for dynamic test data
   - Constants for selector centralization
   - Fixtures for baseline data

2. **Navigation Testing** (Task 2):
   - Route navigation and view rendering
   - Initial data load with loading states
   - Error scenario handling with alerts

3. **Form Testing** (Task 3):
   - All form field types and interactions
   - FormArray dynamic behavior
   - Validation and error display

4. **Auto-Save Testing** (Task 4):
   - Debounced save behavior with cy.clock()
   - Loading indicators during saves
   - Success and error scenarios with alerts

5. **Undo/Redo Testing** (Task 5):
   - Button and keyboard shortcut interactions
   - History navigation accuracy
   - Auto-save prevention during undo/redo

6. **Error Handling Testing** (Task 6):
   - Infrastructure layer alert notifications
   - Error recovery and retry capability
   - State management during errors

7. **Responsive Testing** (Task 7):
   - Multiple viewport sizes
   - Layout adaptation
   - Touch device compatibility

8. **Accessibility Testing** (Task 8):
   - WCAG 2.1 AA compliance via axe
   - Keyboard navigation
   - Screen reader support

**Coverage Goals:**

- **E2E Tests**: 100% of user-facing workflows
- **Error Scenarios**: All failure paths tested with infrastructure alerts
- **Accessibility**: WCAG 2.1 AA compliance verified
- **Responsive**: All major viewport sizes validated

---

## 🎯 Estimated Effort

**Total Phase Time**: 6-8 hours

**Task Breakdown:**

- Task 1 (E2E Infrastructure): 90 minutes
- Task 2 (Navigation Tests): 45 minutes
- Task 3 (Form Tests): 60 minutes
- Task 4 (Auto-Save Tests): 60 minutes
- Task 5 (Undo/Redo Tests): 60 minutes
- Task 6 (Error Handling Tests): 45 minutes
- Task 7 (Responsive Tests): 45 minutes
- Task 8 (Accessibility Tests): 60 minutes
- Test Debugging and Polish: 60 minutes

**Total Feature Effort**: ~35-45 hours across all 9 phases

**Milestone**: Settings feature 100% complete and production-ready with comprehensive test coverage.
