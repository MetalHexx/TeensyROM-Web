import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormsModule } from '@angular/forms';
import { ChannelConfig } from '@teensyrom-nx/domain';
import { VuMeterComponent } from '../vu-meter/vu-meter.component';

/**
 * Dumb/presentational component for configuring a single audio channel.
 * Displays channel number, enabled toggle, and VU meter.
 *
 * @example
 * ```html
 * <lib-channel-config
 *   [channelConfig]="channel"
 *   [vuLevel]="0.75"
 *   [isTestActive]="true"
 *   (configChanged)="onChannelChanged($event)" />
 * ```
 */
@Component({
  selector: 'lib-channel-config',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatSlideToggleModule,
    FormsModule,
    VuMeterComponent,
  ],
  templateUrl: './channel-config.component.html',
  styleUrl: './channel-config.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelConfigComponent {
  /** Channel configuration data */
  channelConfig = input.required<ChannelConfig>();

  /** VU meter level (0-1) for real-time audio visualization */
  vuLevel = input<number>(0);

  /** Whether test capture is active (shows VU meter) */
  isTestActive = input<boolean>(false);

  /** Emitted when channel configuration changes */
  configChanged = output<ChannelConfig>();

  /**
   * Handles enabled toggle changes and emits updated config.
   */
  onEnabledChange(enabled: boolean): void {
    this.configChanged.emit({
      ...this.channelConfig(),
      enabled,
    });
  }
}
