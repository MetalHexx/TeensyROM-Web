import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import type { WritableStore } from '../../dj-store';
import type { KnownController } from '../mapping.models';
import type { MidiMappingState } from '../midi-mapping-store';

/** Adds a known controller, or replaces the one with the same id. */
export function upsertController(store: WritableStore<MidiMappingState>) {
  return {
    upsertController: ({ controller }: { controller: KnownController }): void => {
      const actionMessage = createAction('upsert-controller');

      logInfo(LogType.Info, `MIDI controller ${controller.id} set`);

      updateState(store, actionMessage, (state) => {
        const known = state.controllers.some((existing) => existing.id === controller.id);
        return {
          controllers: known
            ? state.controllers.map((existing) =>
                existing.id === controller.id ? controller : existing
              )
            : [...state.controllers, controller],
        };
      });
    },
  };
}
