---
name: navigation-standards
description: 'Angular Router navigation and routing standards for TeensyROM (centralized NAV_ITEMS/ROUTES config, NavigationService, route resolvers). Use when adding a new navigation menu item or route, wiring lazy-loaded feature routes, deciding whether a route needs a resolver, working with NavigationService, or writing navigation E2E tests.'
---

# Navigation Standards Skill

Angular Router navigation standards for TeensyROM: centralized nav configuration, lazy-loaded feature routes, and the `NavigationService`.

## When to Use This Skill

- Adding a new navigation menu item or route
- Wiring a new feature's lazy-loaded route into `app.routes.ts`
- Deciding whether a route needs a resolver for pre-activation initialization
- Using `NavigationService` to navigate or control the mobile nav drawer
- Writing E2E tests for navigation/menu behavior

## Centralized Navigation Configuration

**Location**: `src/libs/app/navigation/src/lib/navigation.constants.ts`

All navigation items live in one place — `ROUTES` (path constants), `ROUTE_TITLES` (human-readable titles), and `NAV_ITEMS` (the `NavItem[]` array driving the menu). Never hardcode route paths in components.

```typescript
export interface NavItem {
  name: string;      // Display name in navigation menu
  icon: string;       // Material Icon name
  route: string;      // Route path (matches ROUTES constant)
}
```

## Adding a New Navigation Item

1. Add the path to `ROUTES` in `navigation.constants.ts`
2. Add the human-readable title to `ROUTE_TITLES`
3. Add the entry to the `NAV_ITEMS` array, using a [Material Icons](https://fonts.google.com/icons) name

## Routing Configuration

**Location**: `src/apps/teensyrom-ui/src/app/app.routes.ts` — all routes are children of `LayoutComponent` and use `loadComponent` for lazy loading:

```typescript
{
  path: 'your-route',
  data: { title: 'Your Title' },
  loadComponent: () =>
    import('@teensyrom-nx/features/your-feature').then(m => m.YourComponent),
}
```

Set `data.title` for page titles/nav context. Default route redirects to `'devices'`.

## Navigation Service

**Location**: `src/libs/app/navigation/src/lib/navigation.service.ts`

Key methods: `navigateTo(navItem)`, `openNav()`, `closeNav()`, `toggleNav()`. Signals: `isNavOpen`, `navItems`. Always close the mobile nav drawer after navigating.

## Route Resolvers

Use a resolver when a route needs bootstrap/initialization data before the component activates (e.g., `playerRouteResolver` on the `player` route). See [references/NAVIGATION_STANDARDS.md](references/NAVIGATION_STANDARDS.md) for the full example.

## Testing

Use `data-testid` attributes (e.g., `data-testid="nav-settings"`) on nav elements for E2E assertions in `src/apps/teensyrom-ui-e2e/src/e2e/`.

See [references/NAVIGATION_STANDARDS.md](references/NAVIGATION_STANDARDS.md) for the full standard, including complete code samples, the full best-practices do's/don'ts list, and reference implementations.

## Related Skills

- **`ui-component-coding-standards`** — component conventions for the views these routes load
