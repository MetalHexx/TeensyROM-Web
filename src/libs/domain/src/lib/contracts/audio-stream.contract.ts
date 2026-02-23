import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { AudioDevice } from '../models/audio-device.model';
import { AudioStreamState } from '../models/audio-stream-state.enum';

/**
 * Service contract for audio streaming operations.
 * Implemented by infrastructure layer to connect to backend SignalR hub.
 */
export interface IAudioStreamService {
  /** Gets the current stream connection state */
  streamState$: Observable<AudioStreamState>;

  /** Real-time volume level (0–1) for VU meter display (aggregate of all channels) */
  volumeLevel$: Observable<number>;

  /** Real-time per-channel volume levels (0–1) as a Map keyed by channel index */
  channelVolumes$: Observable<Map<number, number>>;

  /** Gets the list of available audio input devices */
  getDevices(): Promise<AudioDevice[]>;

  /** Connects to the audio stream for the specified TeensyROM device */
  connect(deviceId: string): Promise<void>;

  /** Disconnects from the current audio stream */
  disconnect(): Promise<void>;

  /** Sets the volume for a specific channel (0–1) */
  setChannelVolume(channelIndex: number, volume: number): void;

  /** Sets the pre-buffer duration in seconds (delay before first sample plays). Default: 0.2 */
  setPreBufferDuration(seconds: number): void;

  /** Gets the current pre-buffer duration in seconds */
  getPreBufferDuration(): number;

  /** Sets the catch-up padding in seconds (added when playback falls behind). Default: 0.05 */
  setCatchUpPadding(seconds: number): void;

  /** Gets the current catch-up padding in seconds */
  getCatchUpPadding(): number;
}

/** Injection token for the audio stream service */
export const AUDIO_STREAM_SERVICE = new InjectionToken<IAudioStreamService>('AUDIO_STREAM_SERVICE');
