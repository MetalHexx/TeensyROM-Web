# Phase 5: Settings View & Card Layout

## 🎯 Objective

Generate the settings feature library and create the settings view component with card-based layout structure following the player-view pattern. This establishes the feature shell that will house section components in Phase 6, integrates with navigation, and provides the visual structure for the settings interface.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md) - High-level feature overview
- [ ] [Phase 4 Completion](./SETTINGS_FEATURE_P4.md) - Bootstrap integration (prerequisite)

**Standards & Guidelines:**

- [ ] [Coding Standards](../../CODING_STANDARDS.md) - Component structure and Angular patterns
- [ ] [Navigation Standards](../../NAVIGATION_STANDARDS.md) - Navigation and routing patterns
- [ ] [Style Guide](../../STYLE_GUIDE.md) - UI styling standards
- [ ] [NX Library Standards](../../NX_LIBRARY_STANDARDS.md) - Feature library organization

**Reference Implementations:**

- [ ] [PlayerViewComponent](../../../libs/features/player/src/lib/player-view/) - Reference view structure with child components
- [ ] [Player Device Container](../../../libs/features/player/src/lib/player-view/player-device-container/) - Card-based component pattern
- [ ] [DeviceViewComponent](../../../libs/features/device/src/lib/device-view/) - Alternative view pattern

---

## 📂 File Structure Overview

> New feature library with view component.

```
libs/features/settings/
├── src/
│   ├── index.ts                              ✨ New - Feature barrel export
│   └── lib/
│       └── settings-view/
│           ├── settings-view.component.ts    ✨ New - Smart container component
│           ├── settings-view.component.html  ✨ New - View template
│           ├── settings-view.component.scss  ✨ New - View styles
│           └── settings-view.component.spec.ts ✨ New - View tests
├── project.json                              ✨ New - NX project configuration
└── tsconfig.json                             ✨ New - TypeScript configuration
```

---

<details open>
<summary><h3>Task 1: Generate Settings Feature Library</h3></summary>

**Purpose**: Create the NX feature library using the Angular component generator to establish proper project structure.

**Related Documentation:**

- [NX Library Standards](../../NX_LIBRARY_STANDARDS.md) - Library organization patterns
- [Coding Standards](../../CODING_STANDARDS.md) - Angular component patterns

**Implementation Subtasks:**

- [ ] **Generate library**: Run `pnpm nx g @nx/angular:library` with settings feature options
- [ ] **Configure library**: Set up feature library with proper tags and dependencies
- [ ] **Generate component**: Create settings-view component with `--standalone` flag
- [ ] **Update barrel exports**: Export SettingsViewComponent from feature index.ts
- [ ] **Verify structure**: Check project.json and tsconfig.json generated correctly

**Testing Subtask:**

- [ ] **Verify Generation**: Build library to ensure no errors

**Key Implementation Notes:**

- Use NX generators for consistency
- Feature library tags: `scope:features`, `feature:settings`
- Component should be standalone (Angular 19 pattern)
- Follow existing feature library structure (player, device)
- Library dependencies: application (store), domain (contracts), shared UI components

</details>

<details open>
<summary><h3>Task 2: Create Settings View Component Structure</h3></summary>

**Purpose**: Implement the smart container component that will coordinate settings state, forms, and child section components.

**Related Documentation:**

- [Coding Standards - Component Structure](../../CODING_STANDARDS.md#component-structure)
- [PlayerViewComponent](../../../libs/features/player/src/lib/player-view/player-view.component.ts) - Reference smart container pattern

**Implementation Subtasks:**

- [ ] **Inject SettingsStore**: Add store injection for state management
- [ ] **Create component class**: Smart container with signal-based state
- [ ] **Add metadata**: Component decorator with selector, template, styles
- [ ] **Import dependencies**: Import necessary modules (ReactiveFormsModule, Material, etc.)
- [ ] **Add computed signals**: Derive needed state from store signals
- [ ] **Structure for sections**: Prepare for section components to be added in Phase 6

**Testing Subtask:**

- [ ] **Write Component Tests**: Basic component instantiation tests using Vitest

**Key Implementation Notes:**

- Smart container owns reactive form (Phase 6)
- Injects store for state management
- Coordinates auto-save, undo/redo (Phases 7-8)
- Use signal inputs and outputs following Angular 19 patterns
- Reference PlayerViewComponent for smart container patterns
- Keep component focused on coordination, not presentation

</details>

<details open>
<summary><h3>Task 3: Implement Card-Based Layout</h3></summary>

**Purpose**: Create the visual layout structure using Material cards for section grouping following the player-view component hierarchy pattern.

**Related Documentation:**

- [Style Guide](../../STYLE_GUIDE.md) - UI styling patterns and utility classes
- [Player Device Container](../../../libs/features/player/src/lib/player-view/player-device-container/) - Reference card layout with child components

**Implementation Subtasks:**

- [ ] **Add container div**: Main settings container element
- [ ] **Use Material cards**: Mat-card components for visual grouping (to be added to child section components in Phase 6)
- [ ] **Add flex layout**: Use CSS flexbox for responsive layout
- [ ] **Style container**: Add SCSS styles for spacing and layout
- [ ] **Prepare for sections**: Structure ready for section component insertion
- [ ] **Reference player styles**: Follow similar patterns from player view components

**Testing Subtask:**

- [ ] **Visual Verification**: Run app to verify layout structure

**Key Implementation Notes:**

- Cards will be on individual section components (Phase 6), not view wrapper
- View component provides container structure
- Use Material Design spacing (8px grid)
- Responsive layout (stack on mobile, grid on desktop)
- Reference PlayerViewComponent and child components for layout patterns
- Section components (Phase 6) will each have their own cards
- Follow player-view component tree structure

</details>

<details open>
<summary><h3>Task 4: Add Navigation Integration</h3></summary>

**Purpose**: Integrate settings route into application navigation system using established navigation patterns.

**Related Documentation:**

- [Navigation Standards](../../NAVIGATION_STANDARDS.md) - Navigation and routing patterns
- [Navigation Constants](../../../libs/app/navigation/src/lib/navigation.constants.ts) - Centralized navigation configuration
- [App Routes](../../../apps/teensyrom-ui/src/app/app.routes.ts) - Route configuration

**Implementation Subtasks:**

- [ ] **Verify ROUTES constant**: Check that 'settings' route already exists in navigation.constants.ts
- [ ] **Verify NAV_ITEMS**: Check that settings nav item already exists with icon and title
- [ ] **Add route to app.routes.ts**: Add lazy-loaded settings route with data.title
- [ ] **Test navigation**: Verify clicking settings nav item navigates to settings view
- [ ] **Verify route resolver**: Determine if settings needs route resolver (likely not)

**Testing Subtask:**

- [ ] **Navigation Tests**: Manual testing of navigation flow

**Key Implementation Notes:**

- Settings route and nav item may already exist in navigation constants
- Use lazy loading pattern: `loadComponent: () => import(...)`
- Set `data: { title: 'Settings' }` for page title
- No route resolver needed (bootstrap handles initialization)
- Follow exact pattern from player and device routes
- Reference NAVIGATION_STANDARDS.md for complete patterns

</details>

<details open>
<summary><h3>Task 5: Write Component Tests</h3></summary>

**Purpose**: Create Vitest tests for the settings view component verifying rendering, store integration, and component behavior.

**Related Documentation:**

- [Smart Component Testing](../../SMART_COMPONENT_TESTING.md) - Component testing patterns
- [Testing Standards](../../TESTING_STANDARDS.md) - Testing approaches

**Implementation Subtasks:**

- [ ] **Create settings-view.component.spec.ts**: Component test file using Vitest
- [ ] **Setup TestBed**: Configure testing module with mock store
- [ ] **Test component creation**: Verify component instantiates
- [ ] **Test store injection**: Verify store properly injected
- [ ] **Test rendering**: Verify template renders correctly
- [ ] **Mock SettingsStore**: Use TestBed providers for mock store
- [ ] **Test signal subscriptions**: Verify component reacts to store changes

**Testing Subtask:**

- [ ] **Run Tests**: Execute `pnpm nx test settings --testFile=settings-view.component.spec.ts`

**Key Implementation Notes:**

- Use Vitest (NOT Jasmine) for testing
- Mock SettingsStore with signal-based API
- Test component behavior, not implementation
- Shallow rendering (mock child components when added in Phase 6)
- Focus on store integration and state management
- Reference PlayerViewComponent tests for patterns

</details>

<details open>
<summary><h3>Task 6: Setup E2E Test Infrastructure</h3></summary>

**Purpose**: Prepare E2E testing infrastructure for settings feature following the established interceptor/fixture/generator patterns.

**Related Documentation:**

- **IMPORTANT**: [E2E Testing Standards](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - **READ THIS ENTIRE DOCUMENT AND ALL LINKED DOCUMENTATION**
- [E2E Fixtures](../../../apps/teensyrom-ui-e2e/src/support/test-data/fixtures/E2E_FIXTURES.md) - Fixture patterns
- [E2E Interceptors](../../../apps/teensyrom-ui-e2e/src/support/interceptors/E2E_INTERCEPTORS.md) - Interceptor patterns
- [E2E Generators](../../../apps/teensyrom-ui-e2e/src/support/test-data/generators/E2E_TEST_GENERATORS.md) - Generator patterns
- [Backend Settings Endpoints](https://github.com/MetalHexx/TeensyROM-Web/tree/main/src/apps/api/src/TeensyRom.Api/Endpoints/Settings) - Endpoints to mock

**Implementation Subtasks:**

- [ ] **Create settings fixtures**: Define pre-built settings data in fixtures/settings.fixture.ts
- [ ] **Create settings generators**: Factory functions for dynamic settings data in generators/settings.generators.ts
- [ ] **Create settings interceptors**: Wrapper functions for cy.intercept in interceptors/settings.interceptors.ts
- [ ] **Add route constants**: Settings routes in constants/routes.ts
- [ ] **Create test helpers**: Selectors and navigation helpers in e2e/settings/test-helpers.ts
- [ ] **Reference backend endpoints**: Study GET/POST settings endpoints for accurate mocking

**Testing Subtask:**

- [ ] **Verify Infrastructure**: Test that interceptors work with fixtures/generators

**Key Implementation Notes:**

- **CRITICAL**: Follow E2E_TESTS.md three-layer architecture (fixtures → interceptors → tests)
- Create multiple fixture scenarios (default, custom, invalid)
- Generators use @faker-js/faker for dynamic data
- Interceptors handle both success and error modes
- Include waitForSettingsLoad() function co-located with interceptor
- Reference backend Settings endpoints for accurate request/response structure
- Follow existing device and player E2E patterns exactly
- All E2E files use TypeScript with proper typing

</details>

---

## ✅ Success Criteria

> Mark these checkboxes as you validate each criterion.

- [ ] **Feature Library Generated**: Settings feature library exists with proper structure
- [ ] **View Component Created**: SettingsViewComponent renders successfully
- [ ] **Layout Structure**: Card-based layout prepared for section components
- [ ] **Navigation Works**: Settings accessible via navigation menu
- [ ] **Route Configured**: Lazy-loaded settings route in app.routes.ts
- [ ] **Component Tests Pass**: Vitest tests verify component behavior
- [ ] **E2E Infrastructure Ready**: Fixtures, interceptors, and helpers created
- [ ] **Store Integration**: Component properly injects and uses SettingsStore

---

## 🧪 Testing Summary

### Testing Approach

This phase focuses on **component and E2E infrastructure testing**:

1. **Component Tests**: Verify view component with mock store
2. **Navigation Tests**: Manual verification of routing
3. **E2E Infrastructure**: Prepare fixtures, interceptors, generators

### Test Types by Task

| Task | Test Type | Focus |
|------|-----------|-------|
| Task 1 | Verification | Library generation |
| Task 2 | Unit | Component creation and store injection |
| Task 3 | Visual | Layout rendering |
| Task 4 | Manual | Navigation flow |
| Task 5 | Unit | Component behavior |
| Task 6 | Infrastructure | E2E test setup |

### Testing Framework

- **Unit Tests**: Vitest (NOT Jasmine)
- **E2E Tests**: Cypress with fixture/interceptor pattern
- **Mocking**: TestBed for component tests, interceptors for E2E

### Key Testing Principles

- Mock SettingsStore for unit tests
- Use shallow rendering for component tests
- Follow E2E_TESTS.md patterns exactly
- Test observable component behavior
- Reference player and device test patterns

---

## 📝 Implementation Notes

> Track discoveries, decisions, and issues encountered during implementation.

### Discoveries During Implementation

- [Add notes here as you implement]

### Blockers & Questions

- [Document any blockers or questions here]

### Deviations from Plan

- [Note any changes from the original plan and why]

---

## 🔗 Related Documentation

- **Previous Phase**: [Phase 4 - Bootstrap Integration](./SETTINGS_FEATURE_P4.md)
- **Next Phase**: [Phase 6 - Reactive Forms & Section Components](./SETTINGS_FEATURE_P6.md)
- **Feature Overview**: [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md)
- **Navigation Standards**: [NAVIGATION_STANDARDS.md](../../NAVIGATION_STANDARDS.md)
- **E2E Testing**: [E2E_TESTS.md](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - **CRITICAL**
- **PlayerView Reference**: [Player View Components](../../../libs/features/player/src/lib/player-view/)
- **Smart Component Testing**: [SMART_COMPONENT_TESTING.md](../../SMART_COMPONENT_TESTING.md)

---

_Phase Status: Ready for Implementation_
_Last Updated: 2025-01-11_
_Estimated Effort: 3-4 hours_
