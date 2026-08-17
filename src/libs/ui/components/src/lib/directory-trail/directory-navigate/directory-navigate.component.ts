import { Component, input, output, computed } from '@angular/core';
import { IconButtonComponent } from '../../icon-button/icon-button.component';
import { TooltipConfig, TooltipPosition } from '../../tooltip/tooltip.directive';

/**
 * A cluster of four tooltipped icon buttons — back, forward, up, and refresh — for
 * directory history navigation. Each button is independently enabled/disabled by its
 * matching `canNavigate*`/`isLoading` input and emits its own output on activation; this
 * component holds no navigation state itself.
 *
 * `lib-directory-navigate` is normally rendered by `DirectoryTrailComponent` as the
 * left-hand half of the directory toolbar; render it directly only where a surface needs
 * just the navigation controls without the trail's breadcrumb.
 *
 * @example
 * ```html
 * <lib-directory-navigate
 *   [canNavigateUp]="canNavigateUp()"
 *   [canNavigateBack]="canNavigateBack()"
 *   [canNavigateForward]="canNavigateForward()"
 *   [isLoading]="isLoading()"
 *   (backClicked)="onBack()"
 *   (forwardClicked)="onForward()"
 *   (upClicked)="onUp()"
 *   (refreshClicked)="onRefresh()"
 * ></lib-directory-navigate>
 * ```
 */
@Component({
  selector: 'lib-directory-navigate',
  standalone: true,
  imports: [IconButtonComponent],
  templateUrl: './directory-navigate.component.html',
  styleUrl: './directory-navigate.component.scss',
})
export class DirectoryNavigateComponent {
  // Inputs
  /** Enables the "up to parent directory" button when `true`. Defaults to `false`. */
  canNavigateUp = input<boolean>(false);
  /** Enables the "back" (previous directory in history) button when `true`. Defaults to `false`. */
  canNavigateBack = input<boolean>(false);
  /** Enables the "forward" (next directory in history) button when `true`. Defaults to `false`. */
  canNavigateForward = input<boolean>(false);
  /** Disables the refresh button while a directory listing is loading. Defaults to `false`. */
  isLoading = input<boolean>(false);

  // Outputs
  /** Emitted when the back button is activated. */
  backClicked = output<void>();
  /** Emitted when the forward button is activated. */
  forwardClicked = output<void>();
  /** Emitted when the up-to-parent button is activated. */
  upClicked = output<void>();
  /** Emitted when the refresh button is activated. */
  refreshClicked = output<void>();

  // Tooltip configurations
  /** Tooltip config for the back button. */
  readonly backTooltip: TooltipConfig = {
    title: 'Previous Directory',
    body: 'Takes you to the previous directory in your navigation history',
    position: TooltipPosition.Top,
  };

  /** Tooltip config for the forward button. */
  readonly forwardTooltip: TooltipConfig = {
    title: 'Next Directory',
    body: 'Takes you to the next directory in your navigation history',
    position: TooltipPosition.Top,
  };

  /** Tooltip config for the up-to-parent button. */
  readonly upTooltip: TooltipConfig = {
    title: 'Parent Directory',
    body: 'Go to parent directory of the current directory',
    position: TooltipPosition.Top,
  };

  /** Tooltip config for the refresh button. */
  readonly refreshTooltip: TooltipConfig = {
    title: 'Refresh Directory',
    body: 'Synchronizes the current directory with the latest files and subdirectories on your TeensyROM storage.',
    position: TooltipPosition.Top,
  };

  // Event handlers
  /** Emits `backClicked` when the back button is activated. */
  onBackClick(): void {
    this.backClicked.emit();
  }

  /** Emits `forwardClicked` when the forward button is activated. */
  onForwardClick(): void {
    this.forwardClicked.emit();
  }

  /** Emits `upClicked` when the up-to-parent button is activated. */
  onUpClick(): void {
    this.upClicked.emit();
  }

  /** Emits `refreshClicked` when the refresh button is activated. */
  onRefreshClick(): void {
    this.refreshClicked.emit();
  }
}
