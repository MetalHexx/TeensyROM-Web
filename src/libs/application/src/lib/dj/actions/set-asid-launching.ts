import { updateState } from '../../with-devtools';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DjState, WritableStore } from '../dj-store';

/** Sets the ASID launching flag: true only while `AsidPlayerLauncher` has launches in flight. */
export function setAsidLaunching(store: WritableStore<DjState>) {
  return {
    setAsidLaunching: ({ launching }: { launching: boolean }): void => {
      const actionMessage = createAction('set-asid-launching');

      logInfo(LogType.Info, `ASID launching -> ${launching}`);

      updateState(store, actionMessage, () => ({ asidLaunching: launching }));
    },
  };
}
