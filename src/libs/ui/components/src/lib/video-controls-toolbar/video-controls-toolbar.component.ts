import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompactCardLayoutComponent } from '../compact-card-layout/compact-card-layout.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';

/**
 * Video Controls Toolbar Component
 *
 * A configurable vertical toolbar for video player controls. Supports CRT toggle,
 * CRT settings, device selector, fullscreen, and close buttons with active state styling.
 *
 * @example
 * ```html
 * <!-- Embedded video view -->
 * <lib-video-controls-toolbar
 *   [isCrtEnabled]="isCrtEnabled()"
 *   [showFullscreen]="true"
 *   [showClose]="false"
 *   (crtToggleClick)="toggleCrt()"
 *   (crtSettingsClick)="toggleCrtSettings()"
 *   (deviceSelectorClick)="toggleDeviceSelector()"
 *   (fullscreenClick)="openDialog()">
 * </lib-video-controls-toolbar>
 *
 * <!-- Dialog video view -->
 * <lib-video-controls-toolbar
 *   [isCrtEnabled]="isCrtEnabled()"
 *   [showCrtControls]="showCrtControls()"
 *   [isFullscreen]="isFullscreen()"
 *   [showFullscreen]="true"
 *   [showClose]="false"
 *   (crtToggleClick)="toggleCrt()"
 *   (crtSettingsClick)="toggleCrtSettings()"
 *   (deviceSelectorClick)="toggleDeviceSelector()"
 *   (fullscreenClick)="toggleFullscreen()">
 * </lib-video-controls-toolbar>
 * ```
 */
@Component({
  selector: 'lib-video-controls-toolbar',
  standalone: true,
  imports: [
    CommonModule,
    CompactCardLayoutComponent,
    IconButtonComponent,
  ],
  templateUrl: './video-controls-toolbar.component.html',
  styleUrl: './video-controls-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoControlsToolbarComponent {
  // ─────────────────────────────────────────────────────────────────────────
  // State Inputs
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Whether CRT effect is currently enabled
   */
  readonly isCrtEnabled = input<boolean>(true);

  /**
   * Whether CRT settings panel is currently visible
   */
  readonly showCrtControls = input<boolean>(false);

  /**
   * Whether device selector panel is currently visible
   */
  readonly isDeviceSelectorActive = input<boolean>(false);

  /**
   * Whether currently in fullscreen mode
   */
  readonly isFullscreen = input<boolean>(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Visibility Inputs - Configure which buttons appear
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Show/hide CRT toggle button
   */
  readonly showCrtToggle = input<boolean>(true);

  /**
   * Show/hide CRT settings button (only shown when CRT is enabled)
   */
  readonly showCrtSettings = input<boolean>(true);

  /**
   * Show/hide device selector toggle button
   */
  readonly showDeviceSelector = input<boolean>(true);

  /**
   * Show/hide fullscreen toggle button
   */
  readonly showFullscreen = input<boolean>(true);

  /**
   * Show/hide close button
   */
  readonly showClose = input<boolean>(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Output Events
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Emits when CRT toggle button is clicked
   */
  readonly crtToggleClick = output<void>();

  /**
   * Emits when CRT settings button is clicked
   */
  readonly crtSettingsClick = output<void>();

  /**
   * Emits when device selector button is clicked
   */
  readonly deviceSelectorClick = output<void>();

  /**
   * Emits when fullscreen button is clicked
   */
  readonly fullscreenClick = output<void>();

  /**
   * Emits when close button is clicked
   */
  readonly closeClick = output<void>();

  // ─────────────────────────────────────────────────────────────────────────
  // Computed Properties
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Icon for CRT toggle button based on enabled state
   */
  protected get crtIcon(): string {
    return this.isCrtEnabled() ? 'tv' : 'tv_off';
  }

  /**
   * Icon for fullscreen button based on fullscreen state
   */
  protected get fullscreenIcon(): string {
    return this.isFullscreen() ? 'fullscreen_exit' : 'fullscreen';
  }

  /**
   * Aria label for fullscreen button
   */
  protected get fullscreenAriaLabel(): string {
    return this.isFullscreen() ? 'Exit fullscreen' : 'Enter fullscreen';
  }
}
