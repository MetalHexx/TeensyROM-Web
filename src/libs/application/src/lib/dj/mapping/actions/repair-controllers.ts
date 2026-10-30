import { updateState } from '../../../with-devtools';
import { createAction } from '@teensyrom-nx/utils';
import type { WritableStore } from '../../dj-store';
import type { ControlMapping, KnownController } from '../mapping.models';
import type { MidiMappingState } from '../midi-mapping-store';

/** Replaces the controllers and mappings with a repaired set; the store stays as loaded as it was. */
export function repairControllers(store: WritableStore<MidiMappingState>) {
  return {
    repairControllers: ({
      controllers,
      mappings,
    }: {
      controllers: readonly KnownController[];
      mappings: readonly ControlMapping[];
    }): void => {
      const actionMessage = createAction('repair-controllers');

      updateState(store, actionMessage, () => ({ controllers, mappings }));
    },
  };
}
