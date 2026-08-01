import { signalStore, withState } from '@ngrx/signals';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import { logInfo, LogType } from '@teensyrom-nx/utils';
import { initialAudioState } from './audio-store.state';
import { withAudioSelectors } from './selectors';
import { withAudioActions } from './actions';

logInfo(LogType.Start, 'AudioStore: Initializing audio stream state management store');

export const AudioStore = signalStore(
  { providedIn: 'root' },
  withDevtools('audio'),
  withState(initialAudioState),
  withAudioSelectors(),
  withAudioActions()
);

logInfo(LogType.Success, 'AudioStore: Audio store configured successfully');

// Re-export types for consumers
export type { AudioState } from './audio-store.state';
