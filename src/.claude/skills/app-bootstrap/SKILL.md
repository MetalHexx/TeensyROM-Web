---
name: app-bootstrap
description: 'Angular application bootstrap and startup initialization pattern for TeensyROM (AppBootstrapService, APP_INITIALIZER). Use when adding a new feature to the app startup/initialization sequence, implementing effect-based waiting for store/signal readiness, deciding between critical vs non-critical bootstrap error handling, wiring APP_INITIALIZER, or writing unit tests for bootstrap services.'
---

# App Bootstrap Skill

Angular app bootstrap/initialization service pattern used to coordinate async startup tasks (settings load, device discovery, etc.) before the app becomes interactive.

## When to Use This Skill

- Adding a new feature's initialization step to `AppBootstrapService`
- Implementing an effect-based "wait for signal" pattern during bootstrap
- Deciding whether a bootstrap failure should be critical (blocks startup) or non-critical (degrades gracefully)
- Wiring bootstrap into Angular's `APP_INITIALIZER` token
- Writing or reviewing unit tests for bootstrap services

## Architecture Overview

```
App Initialization
    ↓
AppBootstrapService.bootstrap()
    ↓
Initialize Core Services (Settings, Device Discovery, etc.)
    ↓
Wait for Initialization Complete
    ↓
App Becomes Interactive
```

**Key Components**:
- **`AppBootstrapService`** (`src/libs/app/bootstrap/src/lib/app-bootstrap.service.ts`) — orchestrates the startup sequence via async/await, one private init method per concern
- **Feature Bootstrap Services** (e.g., `DeviceBootstrapService`) — feature-specific init logic, injected into `AppBootstrapService`
- **Effect-based waiting** — `effect()` watches a store signal (e.g., `isLoading()`) and resolves a `Promise` once it flips, always destroying the `EffectRef` on resolution

See [references/BOOTSTRAP.md](references/BOOTSTRAP.md) for the full pattern, including step-by-step integration instructions, critical-vs-non-critical error handling, timeout wrapping, `APP_INITIALIZER` wiring, and the unit-test template.

## Critical Rules

1. **Always destroy the effect** (`effectRef.destroy()`) once it resolves — forgetting this leaks a live signal watcher
2. **Order matters** — features that depend on settings must initialize after settings
3. **Prefer graceful degradation** — non-critical failures should log a warning and let the app continue with defaults; only truly blocking dependencies should `throw`
4. **Test both paths** — success and failure, plus effect cleanup

## Related Skills

- **`service-standards`** — the domain-service interface/token pattern the stores injected during bootstrap typically follow
