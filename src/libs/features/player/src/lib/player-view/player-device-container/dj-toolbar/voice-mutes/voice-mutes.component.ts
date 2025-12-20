import {
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { DJ_SERVICE, VoiceState } from '@teensyrom-nx/domain';
import { PLAYER_CONTEXT } from '@teensyrom-nx/application';

/**
 * Voice muting control component for SID chip voices.
 * Provides 3 checkboxes to toggle individual SID voices on/off in real-time.
 * Automatically resets when a new file is loaded.
 */
@Component({
  selector: 'lib-voice-mutes',
  standalone: true,
  imports: [MatCheckboxModule],
  templateUrl: './voice-mutes.component.html',
  styleUrl: './voice-mutes.component.scss',
})
export class VoiceMutesComponent {
  /**
   * Unique identifier for the device being controlled.
   * Used for DJ service calls and file change detection.
   */
  deviceId = input.required<string>();

  private djService = inject(DJ_SERVICE);
  private playerContext = inject(PLAYER_CONTEXT);

  /**
   * Voice state signals - true = enabled (playing), false = disabled (muted)
   */
  protected voice1Enabled = signal(true);
  protected voice2Enabled = signal(true);
  protected voice3Enabled = signal(true);

  /**
   * Loading state - disables checkboxes during DJ service API calls
   */
  protected isLoading = signal(false);

  constructor() {
    // Watch for file changes and reset voice states
    effect(() => {
      const deviceId = this.deviceId(); // Track dependency
      const currentFile = this.playerContext.getCurrentFile(deviceId)();

      // When file changes, reset all voices to enabled
      if (currentFile) {
        untracked(() => {
          // Reset without triggering further effects
          this.voice1Enabled.set(true);
          this.voice2Enabled.set(true);
          this.voice3Enabled.set(true);
        });
      }
    });
  }

  /**
   * Toggle voice 1 state and send command to DJ service.
   * Disables all checkboxes during API call.
   */
  protected toggleVoice1(): void {
    const newState = !this.voice1Enabled();
    this.isLoading.set(true);

    try {
      this.djService.muteVoices(
        this.deviceId(),
        newState ? VoiceState.Enabled : VoiceState.Disabled,
        this.voice2Enabled() ? VoiceState.Enabled : VoiceState.Disabled,
        this.voice3Enabled() ? VoiceState.Enabled : VoiceState.Disabled
      );
      this.voice1Enabled.set(newState);
    } catch {
      // DjService already showed alert via ALERT_SERVICE
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Toggle voice 2 state and send command to DJ service.
   * Disables all checkboxes during API call.
   */
  protected toggleVoice2(): void {
    const newState = !this.voice2Enabled();
    this.isLoading.set(true);

    try {
      this.djService.muteVoices(
        this.deviceId(),
        this.voice1Enabled() ? VoiceState.Enabled : VoiceState.Disabled,
        newState ? VoiceState.Enabled : VoiceState.Disabled,
        this.voice3Enabled() ? VoiceState.Enabled : VoiceState.Disabled
      );
      this.voice2Enabled.set(newState);
    } catch {
      // DjService already showed alert via ALERT_SERVICE
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Toggle voice 3 state and send command to DJ service.
   * Disables all checkboxes during API call.
   */
  protected toggleVoice3(): void {
    const newState = !this.voice3Enabled();
    this.isLoading.set(true);

    try {
      this.djService.muteVoices(
        this.deviceId(),
        this.voice1Enabled() ? VoiceState.Enabled : VoiceState.Disabled,
        this.voice2Enabled() ? VoiceState.Enabled : VoiceState.Disabled,
        newState ? VoiceState.Enabled : VoiceState.Disabled
      );
      this.voice3Enabled.set(newState);
    } catch {
      // DjService already showed alert via ALERT_SERVICE
    } finally {
      this.isLoading.set(false);
    }
  }
}
