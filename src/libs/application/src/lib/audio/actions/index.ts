import { inject } from '@angular/core';
import { withMethods } from '@ngrx/signals';
import { StateSignals, WritableStateSource } from '@ngrx/signals';
import { AUDIO_STREAM_SERVICE, IAudioStreamService } from '@teensyrom-nx/domain';
import { AudioState } from '../audio-store.state';
import { loadDevices } from './load-devices';
import { selectDevice } from './select-device';
import { startStream } from './start-stream';
import { stopStream } from './stop-stream';
import { clearError } from './clear-error';
import { loadChannelConfigs } from './load-channel-configs';
import { setChannelVolume } from './set-channel-volume';

export type WritableStore<T extends object> = StateSignals<T> & WritableStateSource<T>;

export function withAudioActions() {
  return withMethods((store, audioService: IAudioStreamService = inject(AUDIO_STREAM_SERVICE)) => {
    const writableStore = store as WritableStore<AudioState>;
    return {
      ...loadDevices(writableStore, audioService),
      ...selectDevice(writableStore),
      ...startStream(writableStore, audioService),
      ...stopStream(writableStore, audioService),
      ...clearError(writableStore),
      ...loadChannelConfigs(writableStore),
      ...setChannelVolume(writableStore, audioService),
    };
  });
}
