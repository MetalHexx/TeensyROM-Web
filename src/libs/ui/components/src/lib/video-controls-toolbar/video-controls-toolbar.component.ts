import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompactCardLayoutComponent } from '../compact-card-layout/compact-card-layout.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { TooltipConfig, TooltipPosition } from '../tooltip/tooltip.directive';

/**
 * Video Controls Toolbar Component
 *
 * A configurable vertical toolbar for video player controls. Supports CRT toggle,
 * CRT settings, device selector, fullscreen, and close buttons with active state styling.
 *
 * This component only emits click events for the buttons it renders; it holds no panel
 * state itself. Pair `crtSettingsClick`/`deviceSelectorClick` with a sibling
 * `CrtSettingsPanelComponent`/`VideoDeviceSelectorComponent` (typically in the same
 * `ContentOverlayContainerComponent`) and reflect their visibility back through
 * `showCrtControls`/`isDeviceSelectorActive` so the toolbar's active styling stays in sync.
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
   * Whether CRT effect is currently enabled. Default `true`. Drives the CRT toggle
   * button's icon (`tv`/`tv_off`), tooltip text, and active styling — this component
   * does not toggle the effect itself, it only reflects the parent's state.
   */
  readonly isCrtEnabled = input<boolean>(true);

  /**
   * Whether the CRT settings panel is currently visible. Default `false`. Reflects the
   * active state of the CRT settings button; the parent owns the panel's actual
   * visibility and updates this input to match.
   */
  readonly showCrtControls = input<boolean>(false);

  /**
   * Whether the device selector panel is currently visible. Default `false`. Reflects
   * the active state of the device selector button; the parent owns the panel's actual
   * visibility and updates this input to match.
   */
  readonly isDeviceSelectorActive = input<boolean>(false);

  /**
   * Whether the video view is currently in fullscreen mode. Default `false`. Drives the
   * fullscreen button's icon (`fullscreen`/`fullscreen_exit`), tooltip, and aria-label.
   */
  readonly isFullscreen = input<boolean>(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Visibility Inputs - Configure which buttons appear
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Show/hide the CRT toggle button. Default `true`. Set `false` when the host view has
   * no CRT effect to toggle.
   */
  readonly showCrtToggle = input<boolean>(true);

  /**
   * Show/hide the CRT settings button. Default `true`. The button only renders when
   * this is `true` AND `isCrtEnabled()` is `true` — settings are meaningless while the
   * effect is off.
   */
  readonly showCrtSettings = input<boolean>(true);

  /**
   * Show/hide the device selector toggle button. Default `true`. Set `false` for
   * contexts with a fixed video source (e.g. a single dedicated capture device).
   */
  readonly showDeviceSelector = input<boolean>(true);

  /**
   * Show/hide the fullscreen toggle button. Default `true`. Set `false` where
   * fullscreen doesn't apply (e.g. already inside a fullscreen dialog).
   */
  readonly showFullscreen = input<boolean>(true);

  /**
   * Show/hide the close button. Default `false`. Set `true` for dialog/overlay video
   * views that need an explicit dismiss action.
   */
  readonly showClose = input<boolean>(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Output Events
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Emits when the CRT toggle button is clicked. The parent is responsible for flipping
   * its CRT-enabled state and feeding the new value back through `isCrtEnabled`.
   */
  readonly crtToggleClick = output<void>();

  /**
   * Emits when the CRT settings button is clicked. The parent is responsible for
   * showing/hiding its `CrtSettingsPanelComponent` and feeding the resulting visibility
   * back through `showCrtControls`.
   */
  readonly crtSettingsClick = output<void>();

  /**
   * Emits when the device selector button is clicked. The parent is responsible for
   * showing/hiding its `VideoDeviceSelectorComponent` and feeding the resulting
   * visibility back through `isDeviceSelectorActive`.
   */
  readonly deviceSelectorClick = output<void>();

  /**
   * Emits when the fullscreen button is clicked. The parent is responsible for entering
   * or exiting fullscreen and feeding the resulting state back through `isFullscreen`.
   */
  readonly fullscreenClick = output<void>();

  /**
   * Emits when the close button is clicked. Only reachable when `showClose` is `true`.
   */
  readonly closeClick = output<void>();

  // ─────────────────────────────────────────────────────────────────────────
  // Tooltip Configurations
  // ─────────────────────────────────────────────────────────────────────────

  /** Tooltip config for the CRT toggle button when CRT is currently on. */
  readonly crtOnTooltip: TooltipConfig = {
    title: 'Turn off CRT effect',
    position: TooltipPosition.Left,
  };

  /** Tooltip config for the CRT toggle button when CRT is currently off. */
  readonly crtOffTooltip: TooltipConfig = {
    title: 'Turn on CRT effect',
    position: TooltipPosition.Left,
  };

  /** Tooltip config for the CRT settings button. */
  readonly crtSettingsTooltip: TooltipConfig = {
    title: 'Open CRT settings',
    position: TooltipPosition.Left,
  };

  /** Tooltip config for the device selector button. */
  readonly deviceSelectorTooltip: TooltipConfig = {
    title: 'Select Video Device',
    body: `Select the source video capture device that is connected to your TeensyROM.\n
    ● Should work with most USB video capture devices.
    ● Ensure no other application is using the device.`,
    position: TooltipPosition.Left,
  };

  /** Tooltip config for the fullscreen button when not currently fullscreen. */
  readonly enterFullscreenTooltip: TooltipConfig = {
    title: 'Enter fullscreen',
    position: TooltipPosition.Left,
  };

  /** Tooltip config for the fullscreen button when currently fullscreen. */
  readonly exitFullscreenTooltip: TooltipConfig = {
    title: 'Exit fullscreen',
    position: TooltipPosition.Left,
  };

  /** Tooltip config for the close button. */
  readonly closeTooltip: TooltipConfig = {
    title: 'Close',
    position: TooltipPosition.Left,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Computed Properties
  // ─────────────────────────────────────────────────────────────────────────

  /** `crtOnTooltip`/`crtOffTooltip` selected by `isCrtEnabled()`. */
  readonly crtTooltip = computed(() =>
    this.isCrtEnabled() ? this.crtOnTooltip : this.crtOffTooltip
  );

  /** `exitFullscreenTooltip`/`enterFullscreenTooltip` selected by `isFullscreen()`. */
  readonly fullscreenTooltip = computed(() =>
    this.isFullscreen() ? this.exitFullscreenTooltip : this.enterFullscreenTooltip
  );

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
