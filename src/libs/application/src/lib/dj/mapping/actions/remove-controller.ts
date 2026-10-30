import { updateState } from '../../../with-devtools';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import type { WritableStore } from '../../dj-store';
import type { MidiMappingState } from '../midi-mapping-store';

/** Removes a known controller and its runtime status and port. Its mappings are not touched. */
export function removeController(store: WritableStore<MidiMappingState>) {
  return {
    removeController: ({ id }: { id: string }): void => {
      const actionMessage = createAction('remove-controller');

      logInfo(LogType.Info, `MIDI controller ${id} removed`);

      const without = <T>(record: Record<string, T>): Record<string, T> =>
        Object.fromEntries(Object.entries(record).filter(([key]) => key !== id));

      updateState(store, actionMessage, (state) => ({
        controllers: state.controllers.filter((controller) => controller.id !== id),
        controllerStatus: without(state.controllerStatus),
        controllerPorts: without(state.controllerPorts),
      }));
    },
  };
}
