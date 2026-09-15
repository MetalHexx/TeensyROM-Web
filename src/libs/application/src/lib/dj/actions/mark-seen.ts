import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import type { TuneReference } from '@sidablist/tunes';
import { DjState, WritableStore } from '../dj-store';
import type { DjFileKey } from '../dj-file-key.util';

/** Records that a dropped file's tune has been resolved this session, keyed by its file key. */
export function markSeen(store: WritableStore<DjState>) {
  return {
    markSeen: ({ key, reference }: { key: DjFileKey; reference: TuneReference }): void => {
      const actionMessage = createAction('mark-seen');

      logInfo(LogType.Info, `Marked ${key} seen`);

      updateState(store, actionMessage, (state) => ({
        seen: { ...state.seen, [key]: reference },
      }));
    },
  };
}
