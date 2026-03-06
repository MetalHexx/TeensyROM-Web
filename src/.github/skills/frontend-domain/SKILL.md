---
name: frontend-domain
description: 'TeensyROM Angular 19 frontend domain knowledge — Clean Architecture, Nx monorepo, NgRx Signal Store, component patterns, testing standards, and coding conventions. Use when working on Angular components, stores, services, infrastructure, features, UI components, writing frontend tests, or understanding frontend architecture. Covers dependency injection, layer boundaries, ESLint enforcement, and modern Angular patterns.'
---

# Frontend Domain Skill

Architecture guardrails and task routing for the TeensyROM Angular 19 Nx monorepo. Enables any agent to understand layer boundaries, enforce patterns, and navigate to the right documentation.

## When to Use

- Implementing or modifying Angular components, stores, or services
- Planning frontend features or architectural changes
- Writing or fixing frontend tests
- Debugging ESLint module boundary violations
- Integrating with the generated API client

## Architecture Overview

Angular 19 Nx monorepo with **Clean Architecture** enforced by ESLint module boundaries.

**Layer dependency direction** (inner ← outer):

```
Domain (pure TS) ← Application (Signal Stores) ← Infrastructure (HTTP, SignalR)
                            ↑
                 Presentation (features + UI)
```

**Key libraries**: `libs/domain`, `libs/application`, `libs/infrastructure`, `libs/features/{devices,player}`, `libs/ui/{components,styles}`, `libs/data-access/api-client`

## Critical Rules

1. **Layer boundaries are ESLint-enforced** — violations fail builds. Domain has zero dependencies. Features depend on application + domain only. Features **cannot import each other**.
2. **Dependency inversion via contracts** — Application and presentation inject domain tokens (`DEVICE_SERVICE`), never infrastructure classes. Infrastructure implements domain interfaces.
3. **API client restricted to infrastructure** — `*ApiService` classes from `libs/data-access/api-client` are only imported in `libs/infrastructure`. Mappers convert DTOs to domain models.
4. **Signals-first** — Use `input()`, `output()`, `signal()`, `computed()`. No legacy `@Input()` / `@Output()` decorators.
5. **Modern control flow** — Use `@if`, `@for`, `@switch`. No `*ngIf`, `*ngFor`, `*ngSwitch`.
6. **Standalone by default** — Angular 19 components are standalone. No `standalone: true` needed.
7. **No `::ng-deep`** — Use CSS variables, inputs, or wrapper components instead.
8. **Spacing via design tokens** — No hardcoded pixel values. No raw `@media` queries. Use shared mixins.
9. **Contract-typed mocks** — All test mocks typed as `Partial<IContract>` from domain layer. No ad-hoc inline types.
10. **Check component library before creating** — Reuse existing `libs/ui/components` before building new shared components.

## Implementation Patterns

### Dependency Injection Flow

Domain contract → injection token → infrastructure implementation → provider binding → application/feature consumes via `inject(TOKEN)`.

Contracts live in `libs/domain/contracts/`. Providers live in `libs/infrastructure/*/providers.ts`.

### State Management

NgRx Signal Stores in `libs/application/` with computed selectors and use case methods. Stores depend on domain contracts only — infrastructure injected via tokens.

### Testing by Layer

- **Infrastructure**: Unit test, mock generated `*ApiService`
- **Application**: Behavioral test — real stores + mock infrastructure
- **Features**: Unit test — mock application stores/services
- **UI**: Unit test presentational logic with minimal mocking
- **E2E**: Cypress with interceptor-based API mocking

Mock only at infrastructure boundaries. See `docs/TESTING_STANDARDS.md` for full patterns.

## Task Routing

| Task | Read First |
|------|-----------|
| Architecture / layer rules | `docs/OVERVIEW_CONTEXT.md` |
| Component patterns, naming, TypeScript | `docs/CODING_STANDARDS.md` |
| Testing approach by layer | `docs/TESTING_STANDARDS.md` |
| Store testing patterns | `docs/STORE_TESTING.md` |
| Feature component testing | `docs/SMART_COMPONENT_TESTING.md` |
| Store / state patterns | `docs/STATE_STANDARDS.md` |
| Styling, spacing, breakpoints | `docs/STYLE_GUIDE.md` |
| Reusable UI components | `docs/COMPONENT_LIBRARY.md` |
| Service layer patterns | `docs/SERVICE_STANDARDS.md` |
| Form patterns | `docs/FORM_STANDARDS.md` |
| Logging | `docs/LOGGING_STANDARDS.md` |
| API client generation | `.github/skills/api-client-generation/SKILL.md` |
| Visual UI verification | `.github/skills/chrome-devtools-mcp/SKILL.md` |

## Anti-Patterns

- **Cross-feature imports** — Share state via application layer, never import between features
- **API client outside infrastructure** — Always go through domain contracts + infrastructure mappers
- **Legacy Angular** — No `@Input()`, `@Output()`, `*ngIf`, `*ngFor`, `standalone: true`
- **`::ng-deep`** — Deprecated; breaks encapsulation
- **Hardcoded spacing** — Use design tokens and breakpoint mixins
- **Ad-hoc mock types** — Always `Partial<IContract>` from domain
- **Skipping mappers** — Infrastructure must map API DTOs ↔ domain models
