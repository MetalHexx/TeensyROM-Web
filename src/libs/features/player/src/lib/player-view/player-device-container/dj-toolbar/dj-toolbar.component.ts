import { Component, input } from '@angular/core';
import { VoiceMutesComponent } from './voice-mutes/voice-mutes.component';
import { ScalingCompactCardComponent } from '@teensyrom-nx/ui/components';

/**
 * Container component for DJ controls and utilities.
 * Provides a toolbar interface for real-time SID manipulation during playback.
 * 
 * Currently contains:
 * - Voice mutes: Control individual SID chip voices
 * 
 * Future enhancements:
 * - Tempo control
 * - Filter effects
 * - Preset configurations
 */
@Component({
  selector: 'lib-dj-toolbar',
  standalone: true,
  imports: [VoiceMutesComponent, ScalingCompactCardComponent],
  templateUrl: './dj-toolbar.component.html',
  styleUrl: './dj-toolbar.component.scss',
})
export class DjToolbarComponent {
  /**
   * Unique identifier for the device being controlled.
   * Passed to child components for DJ service calls.
   */
  deviceId = input.required<string>();
}
