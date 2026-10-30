import { isDevMode } from '@angular/core';
import { patchState } from '@ngrx/signals';
import {
  updateState as updateStateWithDevtools,
  withDevtools as withReduxDevtools,
  withDevToolsStub,
} from '@angular-architects/ngrx-toolkit';

/**
 * The toolkit's `withDevtools`, but only in dev builds. Its tracker snapshots every store on each
 * state change to sync Redux DevTools, which production (the real-time DJ/MIDI paths) shouldn't
 * pay for, so production builds get the toolkit's no-op stub. Stores import this, not the toolkit's.
 */
export const withDevtools: typeof withReduxDevtools = isDevMode()
  ? withReduxDevtools
  : withDevToolsStub;

/**
 * The toolkit's `updateState`, but only in dev builds, paired with `withDevtools` above. It records
 * each action's name for the next devtools sync to report and clear; under the production stub
 * nothing ever syncs, so that set would keep every name — each made unique by `createAction`'s
 * suffix — for the life of the page. Production patches the state directly. Actions import this,
 * not the toolkit's.
 */
export const updateState: typeof updateStateWithDevtools = isDevMode()
  ? updateStateWithDevtools
  : (stateSource, _action, ...updaters) => patchState(stateSource, ...updaters);
