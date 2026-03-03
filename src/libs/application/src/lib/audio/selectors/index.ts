import { withMethods } from '@ngrx/signals';
import { StateSignals, WritableStateSource } from '@ngrx/signals';
import { AudioState } from '../audio-store.state';
import { isStreaming } from './is-streaming';
import { isConnecting } from './is-connecting';
import { hasDevices } from './has-devices';
import { selectedDevice } from './selected-device';
import { channels } from './channels';
import { hasChannels } from './has-channels';
import { isMuted } from './is-muted';
import { masterVolume } from './master-volume';

export type WritableStore<T extends object> = StateSignals<T> & WritableStateSource<T>;

export function withAudioSelectors() {
  return withMethods((store) => {
    const writableStore = store as WritableStore<AudioState>;
    return {
      ...isStreaming(writableStore),
      ...isConnecting(writableStore),
      ...hasDevices(writableStore),
      ...selectedDevice(writableStore),
      ...channels(writableStore),
      ...hasChannels(writableStore),
      ...isMuted(writableStore),
      ...masterVolume(writableStore),
    };
  });
}
