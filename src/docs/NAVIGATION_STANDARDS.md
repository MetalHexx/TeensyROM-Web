# Navigation Standards

## Overview

This document defines the standards for implementing navigation and routing in the TeensyROM application. The navigation system uses Angular Router with lazy-loaded feature modules and a centralized navigation service.

---

## Navigation Architecture

### Centralized Navigation Configuration

**Location**: `src/libs/app/navigation/src/lib/navigation.constants.ts`

All navigation items are defined in a central constants file using the `NAV_ITEMS` array. This ensures consistency across the application and provides a single source of truth for navigation configuration.

**Key Components**:
- `ROUTES` - Route path constants (e.g., `'player'`, `'devices'`, `'settings'`)
- `ROUTE_TITLES` - Human-readable route titles
- `NAV_ITEMS` - Array of `NavItem` objects defining menu structure

**NavItem Interface**:
```typescript
export interface NavItem {
  name: string;      // Display name in navigation menu
  icon: string;      // Material Icon name
  route: string;     // Route path (matches ROUTES constant)
}
```

**Reference Implementation**: See [navigation.constants.ts](../libs/app/navigation/src/lib/navigation.constants.ts)

---

## Adding New Navigation Items

### Step 1: Add Route Constant

Add your route path to the `ROUTES` object in `navigation.constants.ts`:

```typescript
export const ROUTES = {
  PLAYER: 'player',
  DEVICES: 'devices',
  SETTINGS: 'settings',  // Add your route here
  // ... other routes
} as const;
```

### Step 2: Add Route Title

Add the human-readable title to `ROUTE_TITLES`:

```typescript
export const ROUTE_TITLES = {
  [ROUTES.PLAYER]: 'Player',
  [ROUTES.DEVICES]: 'Devices',
  [ROUTES.SETTINGS]: 'Settings',  // Add your title here
  // ... other titles
} as const;
```

### Step 3: Add Navigation Item

Add your nav item to the `NAV_ITEMS` array:

```typescript
export const NAV_ITEMS: NavItem[] = [
  {
    name: ROUTE_TITLES[ROUTES.SETTINGS],
    icon: 'settings',  // Material Icon name
    route: ROUTES.SETTINGS,
  },
  // ... other items
];
```

**Icon Selection**: Use [Material Icons](https://fonts.google.com/icons) names. Common icons:
- `settings` - Settings/configuration
- `play_arrow` - Player/playback
- `devices` - Hardware devices
- `folder` - File/directory browsing
- `search` - Search functionality

---

## Routing Configuration

### App Routes Structure

**Location**: `src/apps/teensyrom-ui/src/app/app.routes.ts`

The application uses Angular Router with lazy-loaded feature components. All routes are children of the `LayoutComponent` which provides the navigation shell.

**Pattern**:
```typescript
{
  path: 'your-route',
  data: { title: 'Your Title' },
  loadComponent: () => 
    import('@teensyrom-nx/features/your-feature').then(m => m.YourComponent),
}
```

**Key Principles**:
- Use lazy loading (`loadComponent`) for all feature routes
- Set `data.title` for page titles and navigation context
- All routes are children of `LayoutComponent`
- Default route redirects to `'devices'`

**Reference Implementation**: See [app.routes.ts](../apps/teensyrom-ui/src/app/app.routes.ts)

---

## Navigation Service

**Location**: `src/libs/app/navigation/src/lib/navigation.service.ts`

The `NavigationService` provides centralized navigation control with signals for reactive state management.

**Key Methods**:
- `navigateTo(navItem: NavItem)` - Navigate to a route and close mobile nav
- `openNav()` - Open navigation drawer (mobile)
- `closeNav()` - Close navigation drawer
- `toggleNav()` - Toggle navigation drawer state

**Signals**:
- `isNavOpen` - Readonly signal for nav drawer state
- `navItems` - Readonly signal for navigation items

**Usage Pattern**:
```typescript
// Inject service
private navService = inject(NavigationService);

// Navigate programmatically
this.navService.navigateTo(NAV_ITEMS[0]);

// Or use router directly for simple navigation
private router = inject(Router);
this.router.navigate(['/settings']);
```

**Reference Implementation**: See [navigation.service.ts](../libs/app/navigation/src/lib/navigation.service.ts)

---

## Route Resolvers

For routes that require initialization before component activation, use Angular route resolvers.

**Example**: Player route uses `playerRouteResolver` to ensure player context is initialized:

```typescript
{
  path: 'player',
  resolve: { initialized: playerRouteResolver },
  loadComponent: () => import('@teensyrom-nx/features/player').then(m => m.PlayerViewComponent),
}
```

**When to Use Resolvers**:
- Feature requires bootstrap data before rendering
- State must be initialized before component access
- Async dependencies need resolution

---

## Testing Navigation

### E2E Navigation Tests

**Location**: `src/apps/teensyrom-ui-e2e/src/e2e/`

Navigation tests verify routing behavior and menu interactions:

```typescript
describe('Navigation', () => {
  it('should navigate to settings from menu', () => {
    cy.get('[data-testid="nav-settings"]').click();
    cy.url().should('include', '/settings');
  });
});
```

**Test Attributes**: Use `data-testid` attributes for navigation elements:
- `data-testid="nav-settings"` - Settings navigation item
- `data-testid="nav-player"` - Player navigation item
- etc.

**Reference Implementation**: See existing E2E tests in [device-view-navigation.cy.ts](../apps/teensyrom-ui-e2e/src/e2e/devices/device-view-navigation.cy.ts)

---

## Best Practices

### Do's
✅ Add routes to centralized `ROUTES` constants
✅ Use lazy loading for all feature routes
✅ Provide descriptive route titles in `data.title`
✅ Use Material Icons for consistent iconography
✅ Close navigation drawer after navigation (mobile)
✅ Use `data-testid` attributes for E2E testing

### Don'ts
❌ Hardcode route paths in components
❌ Duplicate navigation logic across components
❌ Skip lazy loading for features
❌ Use custom icons inconsistently
❌ Navigate without closing mobile nav
❌ Skip E2E tests for new routes

---

## Related Documentation

- [CODING_STANDARDS.md](./CODING_STANDARDS.md) - General coding patterns
- [E2E_TESTS.md](../apps/teensyrom-ui-e2e/E2E_TESTS.md) - E2E testing patterns
- [Angular Router Documentation](https://angular.io/guide/router) - Official Angular routing guide
