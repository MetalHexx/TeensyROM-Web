import { signalStore, withState } from '@ngrx/signals';
import { withDevtools } from '../with-devtools';
import { logInfo, LogType } from '@teensyrom-nx/utils';
import { WatchFolder } from '@teensyrom-nx/domain';
import { withWatchFolderSelectors } from './selectors';
import { withWatchFolderActions } from './actions';

// Named WatchFolderStoreState because the domain already exports the WatchFolderState enum.
export interface WatchFolderStoreState {
  folders: WatchFolder[];
  isLoading: boolean;
  error: string | null;
  /** Folders with a change in flight, so their controls can hold still. */
  pendingFolderIds: string[];
  lastUpdated: number | null;
}

const initialState: WatchFolderStoreState = {
  folders: [],
  isLoading: false,
  error: null,
  pendingFolderIds: [],
  lastUpdated: null,
};

logInfo(LogType.Start, 'WatchFolderStore: Initializing watch folder state management store');

export const WatchFolderStore = signalStore(
  { providedIn: 'root' },
  withDevtools('watch-folders'),
  withState(initialState),
  withWatchFolderSelectors(),
  withWatchFolderActions()
);

logInfo(LogType.Success, 'WatchFolderStore: Watch folder store configured successfully');
