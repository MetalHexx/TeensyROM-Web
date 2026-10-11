import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DjState, KeyDisplayFormat, WritableStore } from '../dj-store';

/** Sets how the Key readout renders a detected key. */
export function setKeyDisplayFormat(store: WritableStore<DjState>) {
  return {
    setKeyDisplayFormat: ({ format }: { format: KeyDisplayFormat }): void => {
      const actionMessage = createAction('set-key-display-format');

      logInfo(LogType.Info, `Key display format -> ${format}`);

      updateState(store, actionMessage, () => ({ keyDisplayFormat: format }));
    },
  };
}
