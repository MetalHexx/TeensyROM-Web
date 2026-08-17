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
 * `devices` is normally populated upstream from `navigator.mediaDevices.enumerateDevices()`
 * (filtered to `kind: 'videoinput'`) — this component is a pure display/selection surface
 * and never calls the Media Devices API itself. Pairs with `VideoStreamComponent` (renders
 * the stream from the chosen device) and typically sits alongside
 * `VideoControlsToolbarComponent` in a `ContentOverlayContainerComponent` slot, whose
 * `deviceSelectorClick` output toggles this panel's `visible` input.
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
   * Direction the panel slides when hiding. Default `'right'`.
   * - `'left'`: slides out to the left (for left-positioned panels)
   * - `'right'`: slides out to the right (for right-positioned panels)
   */
  readonly slideDirection = input<'left' | 'right'>('right');

  /**
   * Controls visibility with slide animation. Default `true`. When `false`, the panel
   * slides out (per `slideDirection`) and fades rather than being removed from the DOM.
   */
  readonly visible = input<boolean>(true);

  /**
   * List of available video capture devices to populate the dropdown. Required — there
   * is no default. Typically sourced from `navigator.mediaDevices.enumerateDevices()`.
   */
  readonly devices = input.required<VideoDevice[]>();

  /**
   * `deviceId` of the currently selected device, used to drive the select's displayed
   * value. Required — there is no default.
   */
  readonly selectedDeviceId = input.required<string>();

  /**
   * Emits the `deviceId` of the device the user selected from the dropdown.
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
