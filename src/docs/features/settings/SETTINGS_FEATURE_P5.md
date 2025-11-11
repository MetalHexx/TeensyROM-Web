# Phase 5: Settings View & Card Layout

## 🎯 Objective

Create the settings feature library with the main view component that displays settings in a card-based layout. This phase establishes the visual structure, navigation integration, and store connection without form interactivity yet. The view displays current settings values in a read-only card layout, providing the foundation for Phase 6's reactive forms implementation.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md) - High-level feature overview
- [ ] [Phase 4 Completion](./SETTINGS_FEATURE_P4.md) - Bootstrap integration (prerequisite)

**Standards & Guidelines:**

- [ ] [Coding Standards](../../CODING_STANDARDS.md) - Component patterns and conventions
- [ ] [Smart Component Testing](../../SMART_COMPONENT_TESTING.md) - Component testing patterns
- [ ] [Style Guide](../../STYLE_GUIDE.md) - Visual design system
- [ ] [Component Library](../../COMPONENT_LIBRARY.md) - Reusable components (lib-scaling-card)
- [ ] [NX Library Standards](../../NX_LIBRARY_STANDARDS.md) - Feature library organization
- [ ] [Testing Standards](../../TESTING_STANDARDS.md) - Testing approaches

**Reference Implementations:**

- [ ] [Player View Component](../../../libs/features/player/src/lib/player-view/player-view.component.ts) - Similar card-based layout pattern
- [ ] [Device View Component](../../../libs/features/device/src/lib/device-view/device-view.component.ts) - Card layout reference

---

## 📂 File Structure Overview

> New feature library and view component.

```
libs/features/settings/
├── project.json                              ✨ New - Nx project configuration
├── src/
│   ├── index.ts                              ✨ New - Barrel export
│   └── lib/
│       ├── settings.routes.ts                ✨ New - Feature routing
│       └── settings-view/
│           ├── settings-view.component.ts    ✨ New - Main view component
│           ├── settings-view.component.html  ✨ New - Component template
│           ├── settings-view.component.scss  ✨ New - Component styles
│           └── settings-view.component.spec.ts ✨ New - Component tests

apps/teensyrom-ui/src/app/
├── app.routes.ts                             📝 Modified - Add settings route
└── navigation/
    └── navigation.service.ts                 📝 Modified - Add settings menu item
```

---

<details open>
<summary><h3>Task 1: Generate Settings Feature Library</h3></summary>

**Purpose**: Create the settings feature library following Nx workspace conventions. This establishes proper module boundaries and dependency constraints.

**Related Documentation:**

- [NX Library Standards](../../NX_LIBRARY_STANDARDS.md) - Feature library patterns
- [Dependency Constraints](../../DEPENDENCY_CONSTRAINTS_PLAN.md) - Layer boundaries

**Implementation Subtasks:**

- [ ] **Generate library**: Run `nx generate @nx/angular:library settings --directory=libs/features/settings --tags=scope:features,feature:settings`
- [ ] **Configure project**: Verify project.json has correct tags and configuration
- [ ] **Update tsconfig**: Ensure library path mapping in root tsconfig
- [ ] **Verify boundaries**: Check ESLint dependency constraints enforce boundaries
- [ ] **Export barrel**: Create index.ts with public API exports

**Testing Subtask:**

- [ ] **Verify Library Generation**: Check library builds and lints successfully

**Key Implementation Notes:**

- Use Nx CLI generator to ensure proper configuration
- Feature libraries are tagged with `scope:features` and `feature:settings`
- Library can depend on: application, domain, shared, infrastructure
- Library cannot depend on: other features, app layer
- Follow existing feature library structure (player, device) as reference

**Library Generation Command**:

```bash
nx generate @nx/angular:library settings \
  --directory=libs/features/settings \
  --tags=scope:features,feature:settings \
  --standalone
```

**Testing Focus for Task 1:**

> Focus on **library setup** - ensure proper Nx configuration.

**Behaviors to Verify:**

- [ ] Library generates without errors
- [ ] Project.json has correct tags
- [ ] Library builds successfully: `nx build settings`
- [ ] Library lints successfully: `nx lint settings`
- [ ] ESLint enforces dependency constraints

</details>

<details open>
<summary><h3>Task 2: Create Settings View Component</h3></summary>

**Purpose**: Create the main settings view component with card-based layout structure. This component will display all settings sections using scaling card components.

**Related Documentation:**

- [Coding Standards - Component Structure](../../CODING_STANDARDS.md#component-structure) - Component patterns
- [Component Library - lib-scaling-card](../../COMPONENT_LIBRARY.md#lib-scaling-card) - Card component usage
- [Player View Component](../../../libs/features/player/src/lib/player-view/player-view.component.ts) - Reference pattern

**Implementation Subtasks:**

- [ ] **Generate component**: Create `settings-view` component in feature library
- [ ] **Add component decorator**: Configure standalone component with imports
- [ ] **Inject SettingsStore**: Use `inject()` to get store instance
- [ ] **Create card layout**: Add 4 `lib-scaling-card` instances for sections
- [ ] **Add page header**: Include "Application Settings" title with subtitle
- [ ] **Add loading state**: Show skeleton or spinner during initial load
- [ ] **Add error state**: Display error message if settings fail to load
- [ ] **Add empty state**: Handle case where settings haven't loaded yet

**Testing Subtask:**

- [ ] **Write Component Tests**: Test rendering and state display (see Testing section)

**Key Implementation Notes:**

- Use standalone component pattern (imports array, no module)
- Inject store using `inject()` function (modern DI pattern)
- Use Material components for layout (MatCard if not using lib-scaling-card)
- Follow player view pattern for header and layout structure
- Use `@if` control flow for conditional rendering
- Display read-only values initially (forms in Phase 6)

**Component Structure Pattern** (reference only):

```typescript
@Component({
  selector: 'lib-settings-view',
  standalone: true,
  imports: [
    CommonModule,
    ScalingCardComponent,
    MatIconModule,
    // ... other imports
  ],
  templateUrl: './settings-view.component.html',
  styleUrls: ['./settings-view.component.scss']
})
export class SettingsViewComponent {
  private readonly store = inject(SettingsStore);
  
  // Expose signals for template
  settings = this.store.settings;
  isLoading = this.store.isLoading;
  error = this.store.error;
}
```

**Template Pattern** (structure only):

```html
<div class="settings-view">
  <header class="settings-header">
    <h1>Application Settings</h1>
    <p>Configure TeensyROM behavior and preferences</p>
  </header>

  @if (isLoading()) {
    <div class="loading-state">Loading settings...</div>
  } @else if (error()) {
    <div class="error-state">{{ error() }}</div>
  } @else {
    <div class="settings-grid">
      <lib-scaling-card title="Player Settings">
        <!-- Player section content - Phase 6 -->
      </lib-scaling-card>
      
      <lib-scaling-card title="File Transfer">
        <!-- File Transfer section content - Phase 6 -->
      </lib-scaling-card>
      
      <lib-scaling-card title="Search">
        <!-- Search section content - Phase 6 -->
      </lib-scaling-card>
      
      <lib-scaling-card title="Application">
        <!-- App section content - Phase 6 -->
      </lib-scaling-card>
    </div>
  }
</div>
```

**Testing Focus for Task 2:**

> Focus on **component rendering** - ensure component displays correctly.

**Behaviors to Test:**

- [ ] Component renders without errors
- [ ] Header displays "Application Settings" title
- [ ] Four scaling cards render when settings loaded
- [ ] Loading state displays when `isLoading` is true
- [ ] Error state displays when `error` is present
- [ ] Store is injected correctly
- [ ] Signals are exposed to template

</details>

<details open>
<summary><h3>Task 3: Style Settings View Component</h3></summary>

**Purpose**: Apply SCSS styling to create an attractive, responsive card grid layout following the application's design system.

**Related Documentation:**

- [Style Guide](../../STYLE_GUIDE.md) - Design system and utility classes
- [Coding Standards - SCSS](../../CODING_STANDARDS.md#scss-conventions) - SCSS patterns
- [Player View Styles](../../../libs/features/player/src/lib/player-view/player-view.component.scss) - Reference styles

**Implementation Subtasks:**

- [ ] **Create card grid**: Use CSS Grid for responsive 2-column layout
- [ ] **Style header**: Typography and spacing for title/subtitle
- [ ] **Style loading state**: Center spinner or skeleton
- [ ] **Style error state**: Error message display with appropriate color
- [ ] **Add responsive breakpoints**: Single column on mobile, two columns on desktop
- [ ] **Apply theme colors**: Use Material theme variables for consistency
- [ ] **Add spacing utilities**: Use margin/padding from style guide

**Testing Subtask:**

- [ ] **Manual Visual Testing**: Verify layout at different screen sizes

**Key Implementation Notes:**

- Use CSS Grid for card layout (more flexible than flexbox for this use case)
- Follow existing player/device view styling patterns
- Use Material Design spacing scale (8px base unit)
- Apply theme colors via CSS custom properties
- Ensure cards scale properly on different viewports
- Use utility classes from style guide when appropriate

**Grid Layout Pattern** (reference only):

```scss
.settings-view {
  padding: var(--spacing-md);
  max-width: 1400px;
  margin: 0 auto;
}

.settings-header {
  margin-bottom: var(--spacing-lg);
  
  h1 {
    font-size: 2rem;
    margin-bottom: var(--spacing-xs);
  }
  
  p {
    color: var(--text-secondary);
  }
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: var(--spacing-md);
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}
```

**Testing Focus for Task 3:**

> Focus on **visual presentation** - ensure layout is attractive and responsive.

**Visual Testing Checklist:**

- [ ] Cards arrange in 2-column grid on desktop
- [ ] Cards stack in single column on mobile
- [ ] Header typography is clear and readable
- [ ] Spacing is consistent with design system
- [ ] Colors match application theme
- [ ] Loading/error states are visually distinct
- [ ] Layout works at various viewport sizes

</details>

<details open>
<summary><h3>Task 4: Add Settings Navigation Menu Item</h3></summary>

**Purpose**: Add a settings menu item to the application navigation, allowing users to access the settings view.

**Related Documentation:**

- [Navigation Service](../../../apps/teensyrom-ui/src/app/navigation/navigation.service.ts) - Navigation configuration
- [Coding Standards - Navigation](../../CODING_STANDARDS.md#navigation-patterns) - Navigation patterns

**Implementation Subtasks:**

- [ ] **Update navigation service**: Add settings menu item to nav configuration
- [ ] **Add settings icon**: Use Material icon `settings`
- [ ] **Set route path**: Point to `/settings` route
- [ ] **Position in menu**: Place appropriately in menu order
- [ ] **Add accessibility**: Include aria-label for screen readers

**Testing Subtask:**

- [ ] **Write Navigation Tests**: Test menu item renders and routes correctly (see Testing section)

**Key Implementation Notes:**

- Follow existing navigation item pattern
- Use Material Icons icon set
- Consider menu item placement (likely after player/device items)
- Ensure keyboard navigation works
- Test navigation item displays in menu

**Navigation Item Pattern** (reference only):

```typescript
{
  label: 'Settings',
  icon: 'settings',
  route: '/settings',
  ariaLabel: 'Application settings'
}
```

**Testing Focus for Task 4:**

> Focus on **navigation integration** - ensure menu item works correctly.

**Behaviors to Test:**

- [ ] Settings menu item appears in navigation
- [ ] Clicking item navigates to `/settings`
- [ ] Icon displays correctly
- [ ] Active state shows when on settings route
- [ ] Keyboard navigation works
- [ ] Screen reader announces item correctly

</details>

<details open>
<summary><h3>Task 5: Configure Settings Route</h3></summary>

**Purpose**: Add the `/settings` route to the application routing configuration with lazy loading for optimal performance.

**Related Documentation:**

- [App Routes](../../../apps/teensyrom-ui/src/app/app.routes.ts) - Application routing
- [Coding Standards - Routing](../../CODING_STANDARDS.md#routing-patterns) - Routing patterns

**Implementation Subtasks:**

- [ ] **Create settings.routes.ts**: Define feature routes in library
- [ ] **Add default route**: Map empty path to settings view component
- [ ] **Update app.routes.ts**: Add lazy-loaded settings route
- [ ] **Test route navigation**: Verify `/settings` loads component
- [ ] **Test route guards**: Ensure no guards block access (settings should be public)

**Testing Subtask:**

- [ ] **Write Routing Tests**: Test route configuration (see Testing section)

**Key Implementation Notes:**

- Use lazy loading for better initial load performance
- Feature routes defined in library, imported by app
- Settings should be accessible without authentication (if app has auth)
- Follow existing player/device route patterns
- Ensure route works with or without trailing slash

**Route Configuration Pattern** (reference only):

```typescript
// libs/features/settings/src/lib/settings.routes.ts
export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    component: SettingsViewComponent
  }
];

// apps/teensyrom-ui/src/app/app.routes.ts
{
  path: 'settings',
  loadChildren: () => import('@teensyrom/features/settings').then(m => m.SETTINGS_ROUTES)
}
```

**Testing Focus for Task 5:**

> Focus on **routing functionality** - ensure route loads component correctly.

**Behaviors to Test:**

- [ ] Navigating to `/settings` loads SettingsViewComponent
- [ ] Route lazy loads (not in initial bundle)
- [ ] Route works with browser back/forward
- [ ] Route updates browser URL correctly
- [ ] Direct navigation to `/settings` works (deep linking)

</details>

<details open>
<summary><h3>Task 6: Connect Component to Settings Store</h3></summary>

**Purpose**: Wire up the settings view component to display actual settings values from the store. This creates a live, reactive connection between store state and UI.

**Related Documentation:**

- [Settings Store - Selectors](./SETTINGS_FEATURE_P3.md#task-9-implement-computed-selectors) - Available store selectors
- [Coding Standards - Signals](../../CODING_STANDARDS.md#signals) - Signal usage patterns

**Implementation Subtasks:**

- [ ] **Expose store signals**: Make store signals available in component template
- [ ] **Display player settings**: Show repeat mode, timer, auto-advance, launch on startup
- [ ] **Display file transfer settings**: Show watch folders enabled, folders list, auto-launch
- [ ] **Display search settings**: Show weights, stop words, metadata search, hidden files
- [ ] **Display app settings**: Show setup completed status
- [ ] **Format values**: Use pipes for formatting (e.g., time display, boolean labels)

**Testing Subtask:**

- [ ] **Write Store Integration Tests**: Test component displays store values (see Testing section)

**Key Implementation Notes:**

- Use store signals directly in template (reactive)
- No need to subscribe - signals handle reactivity
- Format values for user-friendly display
- Consider using pipes for formatting (e.g., seconds to minutes)
- Display arrays as lists (watch folders, stop words)
- Show boolean values as Yes/No or checkmarks

**Template Integration Pattern** (reference only):

```html
<lib-scaling-card title="Player Settings">
  <div class="setting-row">
    <span class="setting-label">Repeat Mode:</span>
    <span class="setting-value">{{ settings().player.repeatMode }}</span>
  </div>
  <div class="setting-row">
    <span class="setting-label">SID Timer:</span>
    <span class="setting-value">{{ settings().player.sidTimerSeconds }} seconds</span>
  </div>
  <!-- ... other player settings -->
</lib-scaling-card>
```

**Testing Focus for Task 6:**

> Focus on **data binding** - ensure store values display correctly.

**Behaviors to Test:**

- [ ] Component displays player settings from store
- [ ] Component displays file transfer settings from store
- [ ] Component displays search settings from store
- [ ] Component displays app settings from store
- [ ] Values update when store signals change
- [ ] Arrays display as readable lists
- [ ] Boolean values display as Yes/No
- [ ] Formatting is user-friendly

</details>

<details open>
<summary><h3>Task 7: Add E2E Navigation Tests</h3></summary>

**Purpose**: Create end-to-end tests that verify users can navigate to settings and see the settings view with all sections displayed.

**Related Documentation:**

- [E2E Testing Guide](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - Cypress patterns
- [Testing Standards - E2E](../../TESTING_STANDARDS.md#e2e-testing) - E2E approach

**Implementation Subtasks:**

- [ ] **Create settings E2E spec**: New Cypress test file
- [ ] **Test navigation click**: Verify clicking settings menu item navigates
- [ ] **Test route URL**: Verify URL changes to `/settings`
- [ ] **Test view renders**: Verify settings view component displays
- [ ] **Test cards display**: Verify all 4 section cards are visible
- [ ] **Test loading state**: Verify loading indicator appears briefly
- [ ] **Test error state**: Verify error displays if backend fails

**Testing Subtask:**

- [ ] **Write E2E Tests**: Create Cypress tests for settings navigation (see Testing section)

**Key Implementation Notes:**

- Follow existing E2E patterns in player/device specs
- Use Cypress best practices (data-testid attributes)
- Test user journey, not implementation details
- Mock backend responses for consistent tests
- Test both success and error scenarios

**E2E Test Pattern** (reference only):

```typescript
describe('Settings Navigation', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.intercept('GET', '/api/settings', { fixture: 'settings.json' }).as('getSettings');
  });

  it('should navigate to settings page', () => {
    cy.get('[data-testid="nav-settings"]').click();
    cy.url().should('include', '/settings');
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

**Testing Focus for Task 7:**

> Focus on **user experience** - ensure users can access and view settings.

**E2E Test Scenarios:**

- [ ] User clicks settings menu item and navigates to settings page
- [ ] Settings page URL is `/settings`
- [ ] Settings view displays with header
- [ ] All four section cards display
- [ ] Loading state appears during data fetch
- [ ] Error state displays if backend fails
- [ ] Direct navigation to `/settings` works

</details>

---

## ✅ Success Criteria

> Mark these checkboxes as you validate each criterion.

- [ ] **Feature Library Created**: Settings library exists and builds successfully
- [ ] **Component Implemented**: Settings view component displays card layout
- [ ] **Styling Complete**: Layout is responsive and follows design system
- [ ] **Navigation Added**: Settings menu item appears in navigation
- [ ] **Routing Configured**: `/settings` route loads component
- [ ] **Store Connected**: Component displays settings from store
- [ ] **Loading State Works**: Loading indicator displays during fetch
- [ ] **Error State Works**: Error message displays on failure
- [ ] **All Tests Pass**: Component, navigation, and E2E tests pass
- [ ] **E2E Tests Added**: Cypress tests verify user can access settings

---

## 🧪 Testing Summary

### Testing Approach

This phase focuses on **component rendering and navigation integration**:

1. **Component Tests**: Verify component renders correctly with mocked store
2. **Navigation Tests**: Verify menu item displays and routes correctly
3. **Routing Tests**: Verify route configuration works
4. **Store Integration Tests**: Verify component displays store values
5. **E2E Tests**: Verify user can navigate to and view settings

### Test Types by Task

| Task | Test Type | Focus |
|------|-----------|-------|
| Task 1 | Verification | Library generation |
| Task 2 | Unit | Component rendering |
| Task 3 | Manual | Visual layout |
| Task 4 | Unit | Navigation integration |
| Task 5 | Unit | Route configuration |
| Task 6 | Integration | Store connection |
| Task 7 | E2E | User navigation |

### Testing Standards Reference

- Follow [Smart Component Testing](../../SMART_COMPONENT_TESTING.md) for component patterns
- Use [Testing Standards](../../TESTING_STANDARDS.md) for behavioral testing approach
- Follow [E2E Testing Guide](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md) for Cypress patterns
- Mock store at component boundary for unit tests
- Use real store for E2E tests with mocked backend

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
- **Next Phase**: [Phase 6 - Settings Section Components](./SETTINGS_FEATURE_P6.md)
- **Feature Overview**: [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md)
- **Component Library**: [lib-scaling-card](../../COMPONENT_LIBRARY.md#lib-scaling-card)
- **Player View Reference**: [Player View Component](../../../libs/features/player/src/lib/player-view/player-view.component.ts)
- **E2E Testing**: [E2E Testing Guide](../../../apps/teensyrom-ui-e2e/E2E_TESTS.md)

---

_Phase Status: Ready for Implementation_
_Last Updated: 2025-01-11_
_Estimated Effort: 4-5 hours_
