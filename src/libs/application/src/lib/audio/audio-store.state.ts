import { AudioDevice, AudioStreamState, ChannelConfig } from '@teensyrom-nx/domain';

/**
 * Audio stream state shape for NgRx Signal Store
 */
export interface AudioState {
  /** Available audio input devices on the host */
  devices: AudioDevice[];
  /** Currently selected audio device index (null if none selected) */
  selectedDeviceIndex: number | null;
  /** Current stream connection state */
  streamState: AudioStreamState;
  /** Error message if stream failed */
  error: string | null;
  /** Whether devices are being loaded */
  isLoading: boolean;
  /** Channel configurations from device audio settings */
  channelConfigs: ChannelConfig[];
  /** Per-channel volume levels (0.0 to 1.0), keyed by channel index */
  channelVolumes: Map<number, number>;
}

/**
 * Initial state for audio store
 */
export const initialAudioState: AudioState = {
  devices: [],
  selectedDeviceIndex: null,
  streamState: AudioStreamState.Disconnected,
  error: null,
  isLoading: false,
  channelConfigs: [],
  channelVolumes: new Map(),
};
