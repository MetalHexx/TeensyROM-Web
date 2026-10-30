import { updateState } from '../../with-devtools';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DjState, WritableStore } from '../dj-store';

/** Posts a message for the set card to announce. Each one gets a new `seq`, so the same text twice
 *  is announced twice. */
export function announceSets(store: WritableStore<DjState>) {
  return {
    announceSets: ({ text }: { text: string }): void => {
      const actionMessage = createAction('announce-sets');

      logInfo(LogType.Info, `Sets announcement: ${text}`);

      updateState(store, actionMessage, (state) => ({
        sets: {
          ...state.sets,
          announcement: { seq: (state.sets.announcement?.seq ?? 0) + 1, text },
        },
      }));
    },
  };
}
