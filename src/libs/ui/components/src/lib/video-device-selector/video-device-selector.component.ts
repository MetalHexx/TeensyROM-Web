import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CompactCardLayoutComponent } from '../compact-card-layout/compact-card-layout.component';

/**
 * Represents a video input device
 */
export interface VideoDevice {
  deviceId: string;
  label: string;
}

/**
 * Video Device Selector Component
 *
 * A reusable dropdown for selecting video capture devices. Encapsulates the
 * Material select, card styling, and focus management needed for overlay contexts.
 *
 * @example
 * ```html
 * <lib-video-device-selector
 *   [devices]="devices()"
 *   [selectedDeviceId]="selectedDeviceId()"
 *   (deviceSelected)="onDeviceSelected($event)"
 *   (openedChange)="onSelectorOpenedChange($event)">
 * </lib-video-device-selector>
 * ```
 */
@Component({
  selector: 'lib-video-device-selector',
  standalone: true,
  imports: [
    CommonModule,
    MatSelectModule,
    MatFormFieldModule,
    CompactCardLayoutComponent,
  ],
  templateUrl: './video-device-selector.component.html',
  styleUrl: './video-device-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.panel-hidden]': '!visible()',
    '[class.slide-left]': 'slideDirection() === "left"',
    '[class.slide-right]': 'slideDirection() === "right"',
  },
})
export class VideoDeviceSelectorComponent {
  /**
   * Direction the panel slides when hiding.
   * - 'left': slides out to the left (for left-positioned panels)
   * - 'right': slides out to the right (for right-positioned panels)
   */
  readonly slideDirection = input<'left' | 'right'>('right');

  /**
   * Controls visibility with slide animation.
   * When false, panel slides out and fades.
   */
  readonly visible = input<boolean>(true);

  /**
   * List of available video devices
   */
  readonly devices = input.required<VideoDevice[]>();

  /**
   * Currently selected device ID
   */
  readonly selectedDeviceId = input.required<string>();

  /**
   * Emits when a device is selected
   */
  readonly deviceSelected = output<string>();

  /**
   * Emits when the dropdown opens/closes.
   * Use this to pause hover-based overlay visibility.
   */
  readonly openedChange = output<boolean>();

  /**
   * Handle device selection from dropdown
   */
  protected onDeviceSelected(deviceId: string): void {
    this.deviceSelected.emit(deviceId);
  }

  /**
   * Handle dropdown open/close state change
   */
  protected onOpenedChange(isOpen: boolean): void {
    this.openedChange.emit(isOpen);
  }
}
