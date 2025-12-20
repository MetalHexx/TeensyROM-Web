import { InjectionToken, Signal } from '@angular/core';
import { VoiceState } from '../models/voice-state.model';

/**
 * Service contract for DJ audio manipulation commands via SignalR.
 */
export interface IDjService {
  /**
   * Mute or unmute individual SID voices on a device.
   * Returns a signal that indicates command execution state.
   *
   * @param deviceId - Target device identifier
   * @param voice1 - Voice 1 state (Enabled/Disabled)
   * @param voice2 - Voice 2 state (Enabled/Disabled)
   * @param voice3 - Voice 3 state (Enabled/Disabled)
   * @returns Signal<void> that completes when command is sent to hub (not when device confirms)
   */
  muteVoices(
    deviceId: string,
    voice1: VoiceState,
    voice2: VoiceState,
    voice3: VoiceState
  ): Signal<void>;
}

export const DJ_SERVICE = new InjectionToken<IDjService>('DJ_SERVICE');
