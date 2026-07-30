---
name: ui-component-coding-standards
description: 'Angular component and TypeScript coding conventions for TeensyROM. Use when creating or reviewing an Angular component, deciding between input()/output() signals vs legacy @Input()/@Output(), ordering component class members, writing template control-flow (@if/@for/@switch), naming components/files/properties, adding JSDoc documentation, avoiding ::ng-deep or magic strings, or running through the new-component checklist.'
---

# UI Component Coding Standards Skill

Angular component and TypeScript conventions that keep the TeensyROM codebase consistent, maintainable, and readable.

## When to Use This Skill

- Writing a new Angular component or reviewing one in a PR
- Deciding how to declare inputs/outputs (signals vs legacy decorators)
- Ordering a component class's members
- Writing/rewriting template logic that uses `*ngIf`/`*ngFor`/`*ngSwitch` (should be modern control flow instead)
- Naming a new component, file, property, or method
- Documenting a public component API with JSDoc
- Working through the new-component checklist before opening a PR

## Signals-First Policy

Prefer Signals for component APIs and internal state by default:

- `input<T>(default)` / `input.required<T>()` instead of legacy `@Input()`
- `output<T>()` instead of legacy `@Output()`
- `signal`, `computed`, `effect` for state/derivations instead of imperative patterns
- Legacy decorators only for interop with libraries that don't yet support Signals

```typescript
export class ExampleComponent {
  icon = input<string>('');           // 1. inputs — typed, with defaults
  itemClick = output<string>();       // 2. outputs — typed, descriptive names

  isLoading = false;                  // 3. public properties
  private subscription = new Subscription(); // 4. private properties

  constructor(private service: DataService) {} // 5. constructor

  ngOnInit() { /* ... */ }            // 6. lifecycle hooks (Angular's execution order)

  onItemClick(item: string) { /* ... */ } // 7. public methods

  private loadData() { /* ... */ }    // 8. private methods
}
```

## Template Syntax

Use modern control flow — `@if`/`@else`, `@for`/`@empty`, `@switch`/`@case`/`@default` — never `*ngIf`/`*ngFor`/`*ngSwitch`. Always provide a `track` expression in `@for` loops.

## Standalone Components

Angular 19+ components are standalone by default — do not add `standalone: true`. Import dependencies directly in the component decorator's `imports` array, ordered like TypeScript imports (Angular, Material, third-party, application).

## TypeScript Standards

- Explicit typing everywhere; avoid `any`. Use `null as any` (never `undefined!`) for test mocking.
- String `enum`s (PascalCase name/members) for fixed value sets, preferred over const assertions.
- Never import API client types outside infrastructure — map to domain enums (`domain/[domain]/services/src/lib/*.models.ts` + `*.mapper.ts`); mock domain enums in tests, not API types.
- Never use `::ng-deep`, `/deep/`, or `>>>` — pass configuration via `input()`/`output()`, CSS custom properties, or wrapper components instead.
- Avoid magic strings — use enums or `as const` constants objects (SCREAMING_SNAKE_CASE names) instead.
- Import order: Angular core → Angular feature modules → third-party → application (absolute) → relative, with blank lines between groups.

## Naming Conventions

- **Components**: PascalCase, `[Feature][Purpose]Component` (e.g., `StorageItemComponent`)
- **Files**: kebab-case, `[feature-name].[file-type].[extension]` (e.g., `storage-item.component.ts`)
- **Properties/methods**: camelCase (e.g., `isConnected`, `onItemClick()`)

## Documentation Standards

Document all public components with JSDoc — a class-level `@example` block plus per-property doc comments for `input()`/`output()` members. Update docs when introducing new patterns.

## New Component Checklist

- [ ] Follows naming conventions
- [ ] Inputs use `input()` with typing and defaults
- [ ] Outputs use `output()` with descriptive names
- [ ] Class members ordered per standard
- [ ] Imports organized correctly
- [ ] Public APIs documented with JSDoc

See [references/UI_COMPONENT_CODING_STANDARDS.md](references/UI_COMPONENT_CODING_STANDARDS.md) for the full standard, including complete code examples for each rule and additional "Used In" references to concrete components.

## Related Skills

- **`style-guide`** — global styles, design tokens, and Material customizations components should consume
- **`navigation-standards`** — routing/navigation conventions for feature components
