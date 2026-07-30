---
name: state-standards
description: 'NgRx Signal Store standards for TeensyROM state management. Use when writing or reviewing signal store code, actions, selectors, or state mutations - covers the mandatory updateState() + actionMessage pattern (never patchState), selectors-vs-actions folder separation, withDevtools/Redux DevTools correlation, async/await store method patterns, error handling, logging, common anti-patterns, and store testing considerations.'
---

# State Management Standards Skill

Standards for implementing NgRx Signal Store state with async/await patterns, ensuring consistency, maintainability, and Redux DevTools traceability across all store implementations.

**Primary Pattern**: Use async/await for store methods (with `firstValueFrom()` for observables) rather than raw RxJS subscriptions - it gives deterministic, sequential Promise resolution and avoids concurrency issues.

## Critical State Mutation Requirement

**REQUIRED**: All store actions MUST use `updateState()` from `@angular-architects/ngrx-toolkit` with an `actionMessage` parameter - **never** `patchState()` from `@ngrx/signals`.

`patchState()` does not support `actionMessage`, so mutations using it cannot be correlated in Redux DevTools, multi-step operations can't be traced, and debugging complex state flows becomes very difficult (this was the root cause of a real production bug where state updates silently failed to be traceable).

```typescript
// CORRECT
import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction } from '@teensyrom-nx/utils';

export function someAction(store: WritableStore<DomainState>) {
  return {
    someAction: async ({ id }: { id: string }): Promise<void> => {
      const actionMessage = createAction('some-action'); // kebab-case, matches method name

      updateState(store, actionMessage, (state) => ({ isLoading: true, error: null }));

      try {
        const data = await firstValueFrom(service.getData(id));
        updateState(store, actionMessage, (state) => ({ data, isLoading: false, isLoaded: true }));
      } catch (error) {
        updateState(store, actionMessage, (state) => ({ isLoading: false, error: error.message }));
      }
    },
  };
}
```

```typescript
// WRONG - patchState cannot be tracked in Redux DevTools
import { patchState } from '@ngrx/signals';
patchState(store, { isLoading: true });
```

Every helper function that mutates state MUST also accept `actionMessage` as its final parameter, and every mutation within one logical operation MUST reuse the same `actionMessage` so the operation's steps correlate in Redux DevTools.

See `references/STATE_STANDARDS.md` for the full rationale and historical bug context.

## When to Use This Skill

- Writing a new NgRx Signal Store, action, or selector
- Reviewing store code for `patchState()` usage that should be `updateState()` + `actionMessage`
- Deciding whether a piece of logic belongs in `/actions` (state-changing) or `/selectors` (read-only, `computed()`)
- Structuring store files: single-file state/store definition, one-function-per-file actions/selectors, custom `withDomainActions()`/`withDomainSelectors()` features
- Wiring service injection into store actions with `inject()`
- Implementing error handling, loading states, or emoji-based `LogType` logging in store methods
- Reviewing for anti-patterns: `any` types, actions calling other actions directly, mixing selectors/actions in one feature, unused injected services

## Key Standards Covered in the Reference

`references/STATE_STANDARDS.md` (full detail) covers:

- **Signal Store Architecture** - `signalStore()` composition with `withDevtools()`, `withState()`, and custom `withDomainSelectors()`/`withDomainActions()` features
- **Function Organization** - `/actions` vs `/selectors` folder separation, kebab-case file naming, one-function-per-file
- **Action Message Tracking** - `createAction('method-name')` usage and Redux DevTools correlation rules
- **Helper Utilities** - state-mutation helpers (require `actionMessage`) vs state-query helpers (read-only, no `actionMessage`)
- **Error Handling** - consistent loading/error state shape, `(error as any)?.message || 'fallback'` pattern
- **Async Operations** - async/await as the primary pattern; RxJS reserved for real reactive streams (WebSocket/SSE, component signal subscriptions)
- **Logging Standards** - `LogType` enum lifecycle logging (Start → NetworkRequest → Success → Finish)
- **Common Anti-Patterns** - `any` types, old `withMethods()`-only pattern, mixed selector/action features, actions calling actions, unused injected services
- **Store Testing Requirements** - pointer to `STORE_TESTING.md` for setup, mocking, and coverage checklists

**Reference implementation**: `StorageStore` (`libs/domain/storage/state/src/lib/storage-store.ts`) is the canonical example referenced throughout - use it as the concrete pattern to copy from.
