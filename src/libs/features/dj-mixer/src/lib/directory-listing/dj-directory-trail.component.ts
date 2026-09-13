import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { StorageStore } from '@teensyrom-nx/application';
import { StorageType } from '@teensyrom-nx/domain';
import { DirectoryTrailComponent } from '@teensyrom-nx/ui/components';
import type { ActiveStorage } from '../active-storage';

/**
 * Smart container wiring the presentational directory trail to `StorageStore` for the DJ
 * view's active storage. A sibling of `DjDirectoryListingComponent` rather than nested
 * inside it, so a later task can restyle or relocate the listing without touching this.
 *
 * Carries over the player's `DirectoryTrailContainerComponent` verbatim except: the DJ view
 * has no device level to go up to, so `canNavigateUp` is `false` at the storage root instead
 * of `true`; and the storage-type label reads from the active storage directly rather than
 * the store's per-device selection.
 */
@Component({
  selector: 'lib-dj-directory-trail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DirectoryTrailComponent],
  templateUrl: './dj-directory-trail.component.html',
})
export class DjDirectoryTrailComponent {
  readonly activeStorage = input.required<ActiveStorage>();

  private readonly storageStore = inject(StorageStore);

  private readonly selectedDirectoryState = computed(() =>
    this.storageStore.getSelectedDirectoryState(this.activeStorage().deviceId)()
  );

  readonly currentPath = computed(() => this.selectedDirectoryState()?.currentPath ?? '/');

  readonly storageTypeLabel = computed(() =>
    this.activeStorage().storageType === StorageType.Sd ? 'SD Card' : 'USB Drive'
  );

  readonly canNavigateUp = computed(() => this.currentPath() !== '/');

  readonly canNavigateBack = computed(() => {
    const history = this.storageStore.navigationHistory()[this.activeStorage().deviceId];
    return !!(history && history.currentIndex > 0);
  });

  readonly canNavigateForward = computed(() => {
    const history = this.storageStore.navigationHistory()[this.activeStorage().deviceId];
    return !!(history && history.currentIndex < history.history.length - 1);
  });

  readonly isLoading = computed(() => this.selectedDirectoryState()?.isLoading ?? false);

  onBackClick(): void {
    if (this.canNavigateBack()) {
      void this.storageStore.navigateDirectoryBackward({ deviceId: this.activeStorage().deviceId });
    }
  }

  onForwardClick(): void {
    if (this.canNavigateForward()) {
      void this.storageStore.navigateDirectoryForward({ deviceId: this.activeStorage().deviceId });
    }
  }

  onUpClick(): void {
    if (!this.canNavigateUp()) return;
    const { deviceId, storageType } = this.activeStorage();
    void this.storageStore.navigateUpOneDirectory({ deviceId, storageType });
  }

  onRefreshClick(): void {
    const { deviceId, storageType } = this.activeStorage();
    void this.storageStore.refreshDirectory({ deviceId, storageType });
  }

  onNavigationRequested(path: string): void {
    const { deviceId, storageType } = this.activeStorage();
    void this.storageStore.navigateToDirectory({ deviceId, storageType, path });
  }
}
