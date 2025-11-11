# Phase 9: E2E Testing & Polish

## 🎯 Objective

Add comprehensive end-to-end test coverage using Cypress and implement final UI/UX polish based on user feedback and testing insights. This phase ensures production-readiness through thorough validation of all user workflows, accessibility compliance, responsive design verification, and addressing any quality issues discovered during testing. The goal is a polished, fully-tested settings feature ready for release.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md) - Complete feature overview
- [ ] [Phase 8 Completion](./SETTINGS_FEATURE_P8.md) - Undo/redo functionality (prerequisite)
- [ ] All previous phases (P1-P8) - Complete implementation context

**Standards & Guidelines:**

- [ ] [E2E Testing Guide](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - Cypress patterns and conventions
- [ ] [Testing Standards](../../TESTING_STANDARDS.md) - Testing approaches
- [ ] [Style Guide](../../STYLE_GUIDE.md) - Visual design standards
- [ ] [Coding Standards](../../CODING_STANDARDS.md) - Accessibility and responsive design

---

## 📂 File Structure Overview

> E2E tests and final polish touchups.

```
apps/teensyrom-ui-e2e/src/e2e/
├── settings/
│   ├── settings-navigation.cy.ts             ✨ New - Navigation and initial load tests
│   ├── settings-form-interaction.cy.ts       ✨ New - Form input and validation tests
│   ├── settings-auto-save.cy.ts              ✨ New - Auto-save functionality tests
│   ├── settings-undo-redo.cy.ts              ✨ New - Undo/redo workflow tests
│   ├── settings-validation.cy.ts             ✨ New - Form validation tests
│   ├── settings-error-handling.cy.ts         ✨ New - Error scenario tests
│   ├── settings-responsive.cy.ts             ✨ New - Mobile/tablet viewport tests
│   └── settings-accessibility.cy.ts          ✨ New - Accessibility compliance tests
└── fixtures/
    └── settings.json                         ✨ New - Test data fixtures

libs/features/settings/src/lib/
└── (various components)                      📝 Modified - Polish improvements based on testing

apps/teensyrom-ui/src/styles/
└── _settings-overrides.scss                  ✨ New - Settings-specific style overrides (if needed)
```

---

<details open>
<summary><h3>Task 1: Create E2E Navigation and Load Tests</h3></summary>

**Purpose**: Verify users can navigate to settings and the page loads correctly with all sections displayed.

**Related Documentation:**

- [E2E Testing Guide](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - Cypress patterns
- [Phase 5 - Settings View](./SETTINGS_FEATURE_P5.md) - View component details

**Implementation Subtasks:**

- [ ] **Create navigation spec**: New Cypress test file
- [ ] **Test menu navigation**: Verify clicking settings menu item
- [ ] **Test URL routing**: Verify `/settings` route loads
- [ ] **Test initial load**: Verify all sections display
- [ ] **Test loading state**: Verify loading indicator appears and disappears
- [ ] **Test error state**: Verify error display on load failure
- [ ] **Add test fixtures**: Mock settings data for consistent tests

**Testing Subtask:**

- [ ] **Write Navigation E2E Tests**: Complete navigation test scenarios (see Testing section)

**Key Implementation Notes:**

- Use Cypress best practices (data-testid attributes)
- Mock backend responses for consistent tests
- Test both successful load and error scenarios
- Verify all 4 section cards display
- Test direct navigation to `/settings` (deep linking)
- Use fixtures for test data consistency

**E2E Test Pattern** (structure only):

```typescript
describe('Settings Navigation', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.intercept('GET', '**/api/settings', {
      fixture: 'settings.json'
    }).as('getSettings');
  });

  it('should navigate to settings from menu', () => {
    cy.get('[data-testid="nav-settings"]').click();
    cy.url().should('include', '/settings');
    cy.wait('@getSettings');
    cy.get('[data-testid="settings-view"]').should('be.visible');
  });

  it('should display all settings sections', () => {
    cy.visit('/settings');
    cy.wait('@getSettings');
    
    cy.get('[data-testid="player-settings-card"]').should('be.visible');
    cy.get('[data-testid="file-transfer-card"]').should('be.visible');
    cy.get('[data-testid="search-settings-card"]').should('be.visible');
    cy.get('[data-testid="app-settings-card"]').should('be.visible');
  });
});
```

**Testing Focus for Task 1:**

> Focus on **navigation and initial load** - ensure users can access settings.

**E2E Scenarios to Test:**

- [ ] User clicks settings menu item and navigates to settings page
- [ ] Settings page URL is `/settings`
- [ ] All four section cards display after load
- [ ] Loading indicator shows during fetch
- [ ] Error message displays if backend fails
- [ ] Direct navigation to `/settings` works (deep link)
- [ ] Browser back/forward buttons work correctly

</details>

<details open>
<summary><h3>Task 2: Create E2E Form Interaction Tests</h3></summary>

**Purpose**: Verify users can interact with all form fields and inputs behave correctly.

**Related Documentation:**

- [Phase 6 - Reactive Forms](./SETTINGS_FEATURE_P6.md) - Form implementation details
- [E2E Testing Guide - Form Testing](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md#form-testing) - Form test patterns

**Implementation Subtasks:**

- [ ] **Create form interaction spec**: New Cypress test file
- [ ] **Test text inputs**: Verify typing in text fields
- [ ] **Test select dropdowns**: Verify selecting options
- [ ] **Test checkboxes**: Verify checking/unchecking
- [ ] **Test sliders**: Verify adjusting slider values
- [ ] **Test array inputs**: Verify adding/removing watch folders
- [ ] **Test form changes**: Verify form tracks dirty state

**Testing Subtask:**

- [ ] **Write Form Interaction E2E Tests**: Complete form test scenarios (see Testing section)

**Key Implementation Notes:**

- Test all form control types
- Verify form state updates after interaction
- Test form dirty state indicator
- Use Cypress commands for form interaction
- Test keyboard and mouse interaction
- Verify form values persist in UI

**E2E Test Pattern** (structure only):

```typescript
describe('Settings Form Interaction', () => {
  beforeEach(() => {
    cy.visit('/settings');
    cy.wait('@getSettings');
  });

  it('should update player repeat mode', () => {
    cy.get('[data-testid="player-repeat-mode"]').click();
    cy.get('mat-option').contains('All').click();
    cy.get('[data-testid="player-repeat-mode"]').should('contain', 'All');
  });

  it('should adjust SID timer with slider', () => {
    cy.get('[data-testid="sid-timer-slider"]')
      .invoke('val', 240)
      .trigger('change');
    cy.get('[data-testid="sid-timer-value"]').should('contain', '240');
  });

  it('should toggle checkbox', () => {
    cy.get('[data-testid="sid-auto-advance"]').click();
    cy.get('[data-testid="sid-auto-advance"]').should('be.checked');
  });
});
```

**Testing Focus for Task 2:**

> Focus on **form interaction** - ensure all inputs work correctly.

**E2E Scenarios to Test:**

- [ ] User can select repeat mode from dropdown
- [ ] User can adjust SID timer slider
- [ ] User can toggle auto-advance checkbox
- [ ] User can toggle launch on startup checkbox
- [ ] User can enable/disable watch folders
- [ ] User can add folder to watch list
- [ ] User can remove folder from watch list
- [ ] User can adjust search weights
- [ ] User can edit stop words
- [ ] Form shows dirty state when modified

</details>

<details open>
<summary><h3>Task 3: Create E2E Auto-Save Tests</h3></summary>

**Purpose**: Verify auto-save functionality works correctly including debouncing, save status indicators, and error handling.

**Related Documentation:**

- [Phase 7 - Auto-Save](./SETTINGS_FEATURE_P7.md) - Auto-save implementation details
- [E2E Testing Guide - Async Testing](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md#async-testing) - Async patterns

**Implementation Subtasks:**

- [ ] **Create auto-save spec**: New Cypress test file
- [ ] **Test save trigger**: Verify changes trigger save after debounce
- [ ] **Test debouncing**: Verify rapid changes batch into single save
- [ ] **Test save status**: Verify "Saving..." and "Saved" indicators
- [ ] **Test save persistence**: Verify values persist after page reload
- [ ] **Test save errors**: Verify error handling and retry

**Testing Subtask:**

- [ ] **Write Auto-Save E2E Tests**: Complete auto-save test scenarios (see Testing section)

**Key Implementation Notes:**

- Mock backend save endpoint
- Use Cypress wait() for timing-dependent tests
- Verify save indicators display correctly
- Test successful save and error scenarios
- Verify persistence across page reloads
- Test network error recovery

**E2E Test Pattern** (structure only):

```typescript
describe('Settings Auto-Save', () => {
  beforeEach(() => {
    cy.visit('/settings');
    cy.wait('@getSettings');
    cy.intercept('POST', '**/api/settings', {
      statusCode: 200
    }).as('saveSettings');
  });

  it('should auto-save after changes', () => {
    cy.get('[data-testid="player-repeat-mode"]').click();
    cy.get('mat-option').contains('Single').click();
    
    // Wait for debounce
    cy.wait(600);
    
    // Verify save was called
    cy.wait('@saveSettings');
    cy.get('[data-testid="save-status"]').should('contain', 'Saved');
  });

  it('should batch rapid changes into single save', () => {
    cy.get('[data-testid="sid-timer-slider"]').invoke('val', 200).trigger('change');
    cy.wait(100);
    cy.get('[data-testid="sid-timer-slider"]').invoke('val', 240).trigger('change');
    
    cy.wait(600);
    cy.get('@saveSettings.all').should('have.length', 1);
  });
});
```

**Testing Focus for Task 3:**

> Focus on **auto-save behavior** - ensure changes persist automatically.

**E2E Scenarios to Test:**

- [ ] Form changes trigger save after 500ms debounce
- [ ] Rapid changes batch into single save
- [ ] Save status shows "Saving..." during save
- [ ] Save status shows "Saved" on success
- [ ] Settings persist across page reload
- [ ] Save error displays error message
- [ ] User can retry failed save
- [ ] Invalid form doesn't trigger save

</details>

<details open>
<summary><h3>Task 4: Create E2E Undo/Redo Tests</h3></summary>

**Purpose**: Verify undo/redo functionality works end-to-end including button clicks, keyboard shortcuts, and form updates.

**Related Documentation:**

- [Phase 8 - Undo/Redo](./SETTINGS_FEATURE_P8.md) - Undo/redo implementation details
- [E2E Testing Guide - Keyboard Testing](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md#keyboard-testing) - Keyboard patterns

**Implementation Subtasks:**

- [ ] **Create undo/redo spec**: New Cypress test file
- [ ] **Test undo button**: Verify button click reverts changes
- [ ] **Test redo button**: Verify button click reapplies changes
- [ ] **Test keyboard shortcuts**: Verify Ctrl+Z and Ctrl+Y work
- [ ] **Test history position**: Verify position indicator updates
- [ ] **Test disabled states**: Verify buttons disable at boundaries
- [ ] **Test multiple operations**: Verify chained undo/redo

**Testing Subtask:**

- [ ] **Write Undo/Redo E2E Tests**: Complete undo/redo test scenarios (see Testing section)

**Key Implementation Notes:**

- Test button and keyboard triggers
- Verify form values revert correctly
- Test history position indicator
- Test boundary conditions
- Verify undo clears redo on new change
- Test multiple undo/redo operations

**E2E Test Pattern** (structure only):

```typescript
describe('Settings Undo/Redo', () => {
  beforeEach(() => {
    cy.visit('/settings');
    cy.wait('@getSettings');
  });

  it('should undo and redo changes', () => {
    // Make change
    cy.get('[data-testid="player-repeat-mode"]').click();
    cy.get('mat-option').contains('All').click();
    cy.wait(600); // Wait for auto-save
    
    // Undo
    cy.get('[data-testid="undo-button"]').click();
    cy.get('[data-testid="player-repeat-mode"]').should('contain', 'Off');
    
    // Redo
    cy.get('[data-testid="redo-button"]').click();
    cy.get('[data-testid="player-repeat-mode"]').should('contain', 'All');
  });

  it('should undo with keyboard shortcut', () => {
    cy.get('[data-testid="player-repeat-mode"]').click();
    cy.get('mat-option').contains('Single').click();
    cy.wait(600);
    
    cy.get('body').type('{ctrl}z');
    cy.get('[data-testid="player-repeat-mode"]').should('contain', 'Off');
  });
});
```

**Testing Focus for Task 4:**

> Focus on **undo/redo workflows** - ensure history navigation works.

**E2E Scenarios to Test:**

- [ ] User can undo changes with button
- [ ] User can redo changes with button
- [ ] Ctrl+Z triggers undo
- [ ] Ctrl+Y triggers redo
- [ ] History position indicator updates
- [ ] Undo button disabled at history start
- [ ] Redo button disabled at history end
- [ ] New change after undo clears redo
- [ ] Multiple undo operations work correctly

</details>

<details open>
<summary><h3>Task 5: Create E2E Validation Tests</h3></summary>

**Purpose**: Verify form validation works correctly and prevents invalid data submission.

**Related Documentation:**

- [Phase 6 - Validation](./SETTINGS_FEATURE_P6.md#task-8-add-form-validation) - Validation implementation
- [Backend Plan - Validation Rules](./BASIC_SETTINGS_ENDPOINT_PLAN.md#validation) - Backend validation

**Implementation Subtasks:**

- [ ] **Create validation spec**: New Cypress test file
- [ ] **Test required fields**: Verify required validation
- [ ] **Test min/max values**: Verify range validation
- [ ] **Test pattern matching**: Verify format validation
- [ ] **Test error messages**: Verify error text displays
- [ ] **Test save prevention**: Verify invalid forms don't save

**Testing Subtask:**

- [ ] **Write Validation E2E Tests**: Complete validation test scenarios (see Testing section)

**Key Implementation Notes:**

- Test all validation rules
- Verify error messages display
- Test that invalid forms don't save
- Verify error styling (red text, field highlighting)
- Test validation triggers (blur, submit)
- Test validation clearing on valid input

**E2E Test Pattern** (structure only):

```typescript
describe('Settings Validation', () => {
  beforeEach(() => {
    cy.visit('/settings');
    cy.wait('@getSettings');
  });

  it('should show error for invalid SID timer', () => {
    cy.get('[data-testid="sid-timer-input"]').clear().type('0').blur();
    cy.get('[data-testid="sid-timer-error"]')
      .should('be.visible')
      .and('contain', 'must be at least 1');
  });

  it('should prevent save when form invalid', () => {
    cy.intercept('POST', '**/api/settings').as('saveSettings');
    
    cy.get('[data-testid="sid-timer-input"]').clear().type('-1').blur();
    cy.wait(600);
    
    cy.get('@saveSettings.all').should('have.length', 0);
  });
});
```

**Testing Focus for Task 5:**

> Focus on **validation behavior** - ensure invalid data is caught.

**E2E Scenarios to Test:**

- [ ] Required field error shows when empty
- [ ] Min value error shows for too-small number
- [ ] Max value error shows for too-large number
- [ ] Pattern error shows for invalid format
- [ ] Error messages are user-friendly
- [ ] Invalid form prevents auto-save
- [ ] Valid input clears error message
- [ ] Multiple errors display correctly

</details>

<details open>
<summary><h3>Task 6: Create E2E Error Handling Tests</h3></summary>

**Purpose**: Verify error scenarios are handled gracefully including network errors, validation errors, and backend failures.

**Related Documentation:**

- [Phase 7 - Error Handling](./SETTINGS_FEATURE_P7.md#task-6-handle-save-errors-gracefully) - Error handling details
- [Phase 4 - Bootstrap Errors](./SETTINGS_FEATURE_P4.md#task-4-handle-settings-load-errors-gracefully) - Bootstrap error handling

**Implementation Subtasks:**

- [ ] **Create error handling spec**: New Cypress test file
- [ ] **Test network errors**: Verify offline/timeout scenarios
- [ ] **Test backend errors**: Verify 500 error handling
- [ ] **Test validation errors**: Verify 400 error handling
- [ ] **Test error recovery**: Verify retry functionality
- [ ] **Test error preservation**: Verify form state preserved on error

**Testing Subtask:**

- [ ] **Write Error Handling E2E Tests**: Complete error test scenarios (see Testing section)

**Key Implementation Notes:**

- Mock various error responses
- Verify error messages display
- Test form state preserved on error
- Test retry mechanisms
- Verify graceful degradation
- Test error recovery workflows

**E2E Test Pattern** (structure only):

```typescript
describe('Settings Error Handling', () => {
  it('should handle network error gracefully', () => {
    cy.visit('/settings');
    cy.intercept('GET', '**/api/settings', { forceNetworkError: true }).as('getError');
    
    cy.wait('@getError');
    cy.get('[data-testid="error-message"]')
      .should('be.visible')
      .and('contain', 'Unable to connect');
  });

  it('should preserve form on save error', () => {
    cy.visit('/settings');
    cy.wait('@getSettings');
    
    cy.intercept('POST', '**/api/settings', {
      statusCode: 500,
      body: { message: 'Internal server error' }
    }).as('saveError');
    
    cy.get('[data-testid="player-repeat-mode"]').click();
    cy.get('mat-option').contains('All').click();
    cy.wait(600);
    
    cy.wait('@saveError');
    cy.get('[data-testid="player-repeat-mode"]').should('contain', 'All');
  });
});
```

**Testing Focus for Task 6:**

> Focus on **error resilience** - ensure errors don't break functionality.

**E2E Scenarios to Test:**

- [ ] Network error shows appropriate message
- [ ] Backend 500 error shows server error message
- [ ] Backend 400 error shows validation message
- [ ] Form state preserved on error
- [ ] User can retry after error
- [ ] Error message dismissable
- [ ] App remains functional after error
- [ ] Bootstrap error uses defaults and shows warning

</details>

<details open>
<summary><h3>Task 7: Create E2E Responsive Design Tests</h3></summary>

**Purpose**: Verify settings interface works correctly on mobile and tablet viewports with touch-friendly controls.

**Related Documentation:**

- [Style Guide - Responsive Design](../../STYLE_GUIDE.md#responsive-design) - Responsive patterns
- [E2E Testing Guide - Viewport Testing](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md#viewport-testing) - Viewport patterns

**Implementation Subtasks:**

- [ ] **Create responsive spec**: New Cypress test file
- [ ] **Test mobile viewport**: Verify layout on small screens
- [ ] **Test tablet viewport**: Verify layout on medium screens
- [ ] **Test desktop viewport**: Verify layout on large screens
- [ ] **Test touch interactions**: Verify touch-friendly controls
- [ ] **Test card stacking**: Verify cards stack on mobile

**Testing Subtask:**

- [ ] **Write Responsive E2E Tests**: Complete responsive test scenarios (see Testing section)

**Key Implementation Notes:**

- Test multiple viewport sizes
- Verify layout adapts appropriately
- Test touch interactions (if supported)
- Verify scrolling works on all viewports
- Test button/input sizing for touch
- Verify text remains readable

**E2E Test Pattern** (structure only):

```typescript
describe('Settings Responsive Design', () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1920, height: 1080 }
  ];

  viewports.forEach(viewport => {
    it(`should display correctly on ${viewport.name}`, () => {
      cy.viewport(viewport.width, viewport.height);
      cy.visit('/settings');
      cy.wait('@getSettings');
      
      cy.get('[data-testid="settings-view"]').should('be.visible');
      cy.get('[data-testid="player-settings-card"]').should('be.visible');
      
      // Verify layout specific to viewport
      if (viewport.name === 'mobile') {
        // Verify cards stack vertically
        cy.get('[data-testid="settings-grid"]')
          .should('have.css', 'grid-template-columns', '1fr');
      }
    });
  });
});
```

**Testing Focus for Task 7:**

> Focus on **responsive behavior** - ensure UI works on all devices.

**E2E Scenarios to Test:**

- [ ] Settings page displays on mobile viewport
- [ ] Cards stack vertically on mobile
- [ ] Settings page displays on tablet viewport
- [ ] Cards display 2-column on desktop
- [ ] Form inputs are touch-friendly
- [ ] Buttons large enough for touch
- [ ] Text remains readable on mobile
- [ ] Scrolling works smoothly on all viewports

</details>

<details open>
<summary><h3>Task 8: Create E2E Accessibility Tests</h3></summary>

**Purpose**: Verify settings interface meets WCAG 2.1 AA accessibility standards including keyboard navigation, screen reader support, and proper ARIA attributes.

**Related Documentation:**

- [Coding Standards - Accessibility](../../CODING_STANDARDS.md#accessibility) - Accessibility patterns
- [E2E Testing Guide - Accessibility Testing](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md#accessibility-testing) - A11y patterns

**Implementation Subtasks:**

- [ ] **Create accessibility spec**: New Cypress test file
- [ ] **Test keyboard navigation**: Verify Tab key navigation
- [ ] **Test focus management**: Verify focus indicators
- [ ] **Test ARIA labels**: Verify descriptive labels
- [ ] **Test screen reader**: Verify announcements (if tooling supports)
- [ ] **Test color contrast**: Verify readable text
- [ ] **Run axe-core**: Automated accessibility checks

**Testing Subtask:**

- [ ] **Write Accessibility E2E Tests**: Complete accessibility test scenarios (see Testing section)

**Key Implementation Notes:**

- Use cypress-axe for automated checks
- Test keyboard-only navigation
- Verify focus indicators visible
- Test ARIA attributes present
- Verify error announcements
- Test form labels associated

**E2E Test Pattern** (structure only):

```typescript
describe('Settings Accessibility', () => {
  beforeEach(() => {
    cy.visit('/settings');
    cy.wait('@getSettings');
    cy.injectAxe(); // Requires cypress-axe
  });

  it('should have no accessibility violations', () => {
    cy.checkA11y('[data-testid="settings-view"]');
  });

  it('should support keyboard navigation', () => {
    cy.get('body').tab();
    cy.focused().should('have.attr', 'data-testid', 'player-repeat-mode');
    
    cy.focused().tab();
    // Verify next element focused
  });

  it('should have proper ARIA labels', () => {
    cy.get('[data-testid="sid-timer-slider"]')
      .should('have.attr', 'aria-label')
      .and('not.be.empty');
  });
});
```

**Testing Focus for Task 8:**

> Focus on **accessibility compliance** - ensure usable by all users.

**E2E Scenarios to Test:**

- [ ] No automated accessibility violations (axe-core)
- [ ] Keyboard navigation works through all fields
- [ ] Focus indicators are visible
- [ ] All interactive elements keyboard accessible
- [ ] Form fields have descriptive labels
- [ ] Validation errors have ARIA attributes
- [ ] Buttons have accessible names
- [ ] Color contrast meets WCAG AA standards

</details>

<details open>
<summary><h3>Task 9: Implement UI/UX Polish Improvements</h3></summary>

**Purpose**: Address any UX issues discovered during testing and implement final polish touches for production readiness.

**Related Documentation:**

- [Style Guide](../../STYLE_GUIDE.md) - Visual design standards
- [Component Library](../../COMPONENT_LIBRARY.md) - Component patterns

**Implementation Subtasks:**

- [ ] **Review test findings**: Collect UX issues from E2E testing
- [ ] **Improve transitions**: Add smooth animations where appropriate
- [ ] **Enhance feedback**: Improve visual feedback for interactions
- [ ] **Refine spacing**: Adjust margins/padding for visual balance
- [ ] **Optimize loading**: Improve perceived performance
- [ ] **Add help text**: Tooltips or explanations for complex settings
- [ ] **Polish error messages**: Make errors more actionable
- [ ] **Add empty states**: Handle edge cases gracefully

**Testing Subtask:**

- [ ] **Manual Testing**: Verify polish improvements enhance UX

**Key Implementation Notes:**

- Focus on issues discovered during E2E testing
- Small improvements compound to better UX
- Consider user feedback if available
- Don't over-animate (keep subtle)
- Ensure consistency with app design language
- Test polish changes don't introduce bugs

**Polish Areas** (examples):

- Smooth transitions on card hover
- Loading skeletons instead of spinners
- Tooltips explaining search weights
- Help icon with setting explanations
- Improved error message wording
- Empty state for watch folders list
- Confirmation dialog for reset to defaults
- Keyboard shortcut legend

**Testing Focus for Task 9:**

> Focus on **user experience** - ensure interface is polished and intuitive.

**Polish Checklist:**

- [ ] Transitions are smooth and purposeful
- [ ] Visual feedback clear for all interactions
- [ ] Help text available for complex settings
- [ ] Error messages actionable and clear
- [ ] Empty states handle edge cases
- [ ] Loading states feel fast
- [ ] Design consistent with app
- [ ] All interactions feel responsive

</details>

<details open>
<summary><h3>Task 10: Final Integration and Smoke Testing</h3></summary>

**Purpose**: Perform final integration testing and smoke tests to verify all features work together correctly and the feature is production-ready.

**Related Documentation:**

- [Testing Standards - Integration Testing](../../TESTING_STANDARDS.md#integration-testing) - Integration patterns
- All previous phase documents - Complete implementation context

**Implementation Subtasks:**

- [ ] **Run all E2E tests**: Verify complete E2E test suite passes
- [ ] **Run all unit tests**: Verify all layer tests pass
- [ ] **Run linters**: Verify code quality standards met
- [ ] **Test complete workflows**: Manual testing of user journeys
- [ ] **Verify performance**: Check load times and responsiveness
- [ ] **Test browser compatibility**: Verify works in target browsers
- [ ] **Review code coverage**: Ensure >90% coverage
- [ ] **Document known issues**: List any remaining minor issues

**Testing Subtask:**

- [ ] **Execute Final Test Plan**: Complete testing checklist (see Testing section)

**Key Implementation Notes:**

- Run complete test suite (unit + integration + E2E)
- Manual testing supplements automated tests
- Test in multiple browsers if possible
- Check performance metrics
- Review code coverage reports
- Document any limitations or known issues
- Ensure documentation is current

**Final Testing Checklist:**

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Linters pass with no errors
- [ ] Code coverage >90%
- [ ] Performance acceptable
- [ ] Works in Chrome, Firefox, Safari, Edge
- [ ] No console errors or warnings
- [ ] Documentation complete
- [ ] Known issues documented

**Testing Focus for Task 10:**

> Focus on **production readiness** - ensure feature is complete and robust.

**Final Verification:**

- [ ] Complete user workflows tested
- [ ] All features functional
- [ ] No critical bugs
- [ ] Performance acceptable
- [ ] Accessibility compliant
- [ ] Responsive design works
- [ ] Error handling robust
- [ ] Code quality high
- [ ] Tests comprehensive
- [ ] Documentation complete

</details>

---

## ✅ Success Criteria

> Mark these checkboxes as you validate each criterion.

- [ ] **E2E Tests Complete**: All E2E test scenarios implemented
- [ ] **All Tests Pass**: Unit, integration, and E2E tests pass
- [ ] **Accessibility Compliant**: Meets WCAG 2.1 AA standards
- [ ] **Responsive Design**: Works on mobile, tablet, desktop
- [ ] **Error Handling**: All error scenarios handled gracefully
- [ ] **UI Polish**: Interface is polished and intuitive
- [ ] **Performance**: Load times and interactions feel responsive
- [ ] **Browser Compatibility**: Works in all target browsers
- [ ] **Code Quality**: Linters pass, coverage >90%
- [ ] **Documentation**: All documentation complete and current
- [ ] **Production Ready**: Feature ready for release

---

## 🧪 Testing Summary

### Testing Approach

This phase focuses on **comprehensive E2E testing and production readiness**:

1. **Navigation E2E**: Verify settings access
2. **Form Interaction E2E**: Verify all inputs work
3. **Auto-Save E2E**: Verify save functionality
4. **Undo/Redo E2E**: Verify history navigation
5. **Validation E2E**: Verify data validation
6. **Error Handling E2E**: Verify error scenarios
7. **Responsive E2E**: Verify viewport adaptation
8. **Accessibility E2E**: Verify WCAG compliance
9. **Polish**: Verify UX improvements
10. **Integration**: Verify complete feature

### Test Types Summary

| Phase | Unit | Integration | E2E | Total |
|-------|------|-------------|-----|-------|
| P1 | Manual | - | - | Manual |
| P2 | ✓ | ✓ | - | ~50 tests |
| P3 | ✓ | ✓ | - | ~80 tests |
| P4 | ✓ | ✓ | - | ~20 tests |
| P5 | ✓ | - | ✓ | ~30 tests |
| P6 | ✓ | ✓ | - | ~60 tests |
| P7 | ✓ | ✓ | - | ~40 tests |
| P8 | ✓ | ✓ | - | ~40 tests |
| P9 | - | - | ✓ | ~80 tests |
| **Total** | **~300+** | **~50+** | **~110+** | **~460+ tests** |

### Testing Standards Reference

- Follow [E2E Testing Guide](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) for Cypress patterns
- Use [Testing Standards](../../TESTING_STANDARDS.md) for behavioral approach
- Achieve >90% code coverage
- Test all user workflows end-to-end

---

## 📝 Implementation Notes

> Track discoveries, decisions, and issues encountered during implementation.

### Discoveries During Implementation

- [Add notes here as you implement]

### Blockers & Questions

- [Document any blockers or questions here]

### Deviations from Plan

- [Note any changes from the original plan and why]

### Known Issues

- [Document any minor issues that don't block release]

---

## 🔗 Related Documentation

- **Previous Phase**: [Phase 8 - Undo/Redo with Keyboard Shortcuts](./SETTINGS_FEATURE_P8.md)
- **Feature Overview**: [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md)
- **E2E Testing**: [E2E Testing Guide](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md)
- **All Previous Phases**: P1-P8 implementation documents
- **Production Checklist**: Verify all success criteria met

---

_Phase Status: Ready for Implementation_
_Last Updated: 2025-01-11_
_Estimated Effort: 6-8 hours_
_Completion: Final Phase - Feature Production Ready After This Phase_
