import { Component, input, output } from '@angular/core';
import { DirectoryNavigateComponent } from './directory-navigate/directory-navigate.component';
import { DirectoryBreadcrumbComponent } from './directory-breadcrumb/directory-breadcrumb.component';

/**
 * The directory browser's top toolbar. Composes `DirectoryNavigateComponent` (back /
 * forward / up / refresh buttons, on the left) with `DirectoryBreadcrumbComponent` (the
 * current path as a responsive breadcrumb trail, on the right), wiring each child's
 * outputs through to this component's own outputs.
 *
 * Reach for `lib-directory-trail` whenever a directory browser needs both history
 * navigation controls and a path breadcrumb together. Use the two children directly
 * only in the narrow cases documented on each of them.
 *
 * @example
 * ```html
 * <lib-directory-trail
 *   [currentPath]="currentPath()"
 *   [storageTypeLabel]="storageTypeLabel()"
 *   [canNavigateUp]="canNavigateUp()"
 *   [canNavigateBack]="canNavigateBack()"
 *   [canNavigateForward]="canNavigateForward()"
 *   [isLoading]="isLoading()"
 *   (backClicked)="onBack()"
 *   (forwardClicked)="onForward()"
 *   (upClicked)="onUp()"
 *   (refreshClicked)="onRefresh()"
 *   (navigationRequested)="onNavigate($event)"
 * ></lib-directory-trail>
 * ```
 */
@Component({
  selector: 'lib-directory-trail',
  standalone: true,
  imports: [DirectoryNavigateComponent, DirectoryBreadcrumbComponent],
  templateUrl: './directory-trail.component.html',
  styleUrl: './directory-trail.component.scss',
})
export class DirectoryTrailComponent {
  /** The absolute path currently displayed, e.g. `/games/arcade`. Passed to the breadcrumb child. */
  currentPath = input.required<string>();
  /** Label for the root breadcrumb segment (e.g. `'SD Card'`, `'USB'`) — the storage device's display name. */
  storageTypeLabel = input.required<string>();
  /** Whether the "up to parent directory" button is enabled. Defaults to `false`. */
  canNavigateUp = input<boolean>(false);
  /** Whether the "back" (previous directory in history) button is enabled. Defaults to `false`. */
  canNavigateBack = input<boolean>(false);
  /** Whether the "forward" (next directory in history) button is enabled. Defaults to `false`. */
  canNavigateForward = input<boolean>(false);
  /** Whether a directory listing is currently loading; disables the refresh button while `true`. Defaults to `false`. */
  isLoading = input<boolean>(false);

  /** Emitted when the back button is activated. */
  backClicked = output<void>();
  /** Emitted when the forward button is activated. */
  forwardClicked = output<void>();
  /** Emitted when the up-to-parent button is activated. */
  upClicked = output<void>();
  /** Emitted when the refresh button is activated. */
  refreshClicked = output<void>();
  /** Emitted with the absolute path of the breadcrumb segment (visible or overflowed) the user chose to navigate to. */
  navigationRequested = output<string>();

  onBackClick(): void {
    this.backClicked.emit();
  }

  onForwardClick(): void {
    this.forwardClicked.emit();
  }

  onUpClick(): void {
    this.upClicked.emit();
  }

  onRefreshClick(): void {
    this.refreshClicked.emit();
  }

  onNavigationRequested(path: string): void {
    this.navigationRequested.emit(path);
  }
}
