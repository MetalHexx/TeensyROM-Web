import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction } from '@teensyrom-nx/utils';
import type { WritableStore } from '../../dj-store';
import type { ControllerStatus, MidiMappingState } from '../midi-mapping-store';

/** Records a controller's runtime status and the input port it resolved to. */
export function setControllerRuntime(store: WritableStore<MidiMappingState>) {
  return {
    setControllerRuntime: ({
      id,
      status,
      portId,
    }: {
      id: string;
      status: ControllerStatus;
      portId: string | null;
    }): void => {
      const actionMessage = createAction('set-controller-runtime');

      updateState(store, actionMessage, (state) => ({
        controllerStatus: { ...state.controllerStatus, [id]: status },
        controllerPorts: { ...state.controllerPorts, [id]: portId },
      }));
    },
  };
}
