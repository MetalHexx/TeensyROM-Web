import { Component, input, inject, computed } from '@angular/core';
import { StorageStore } from '@teensyrom-nx/application';
import { DirectoryTrailComponent } from '@teensyrom-nx/ui/components';

/** Smart container wiring the presentational directory trail to StorageStore. */
@Component({
  selector: 'lib-directory-trail-container',
  standalone: true,
  imports: [DirectoryTrailComponent],
  templateUrl: './directory-trail-container.component.html',
})
export class DirectoryTrailContainerComponent {
  // Inputs
  deviceId = input.required<string>();

  // Store injection
  private readonly storageStore = inject(StorageStore);

  // Computed state selectors
  selectedDirectoryState = computed(() => {
    const deviceId = this.deviceId();
    return this.storageStore.getSelectedDirectoryState(deviceId)();
  });

  selectedDirectory = computed(() => {
    const deviceId = this.deviceId();
    return this.storageStore.getSelectedDirectoryForDevice(deviceId);
  });

  // Computed properties for child component
  currentPath = computed(() => {
    const state = this.selectedDirectoryState();
    return state?.currentPath || '/';
  });

  storageTypeLabel = computed(() => {
    const selected = this.selectedDirectory();
    if (!selected) return 'Storage';

    switch (selected.storageType) {
      case 'SD':
        return 'SD Card';
      case 'USB':
        return 'USB Drive';
      default:
        return 'Storage';
    }
  });

  isDeviceLevelView = computed(() => {
    const selected = this.selectedDirectory();
    return !selected || selected.storageType === null;
  });

  canNavigateUp = computed(() => {
    // Cannot navigate up from device level (nowhere higher to go)
    if (this.isDeviceLevelView()) return false;

    // Can navigate up from any storage directory (including root)
    // When at root (/), navigating up goes to device level
    return true;
  });

  canNavigateBack = computed(() => {
    const deviceId = this.deviceId();
    const history = this.storageStore.navigationHistory()[deviceId];
    return !!(history && history.currentIndex > 0);
  });

  canNavigateForward = computed(() => {
    const deviceId = this.deviceId();
    const history = this.storageStore.navigationHistory()[deviceId];
    return !!(history && history.currentIndex < history.history.length - 1);
  });

  isLoading = computed(() => {
    const state = this.selectedDirectoryState();
    return state?.isLoading ?? false;
  });

  onBackClick(): void {
    const deviceId = this.deviceId();
    if (this.canNavigateBack()) {
      this.storageStore.navigateDirectoryBackward({ deviceId });
    }
  }

  onForwardClick(): void {
    const deviceId = this.deviceId();
    if (this.canNavigateForward()) {
      this.storageStore.navigateDirectoryForward({ deviceId });
    }
  }

  onUpClick(): void {
    const selected = this.selectedDirectory();
    if (!selected) return;

    // If at device level, can't go up (nowhere higher)
    if (selected.storageType === null) return;

    // navigateUpOneDirectory handles both:
    // - Regular directory navigation (goes to parent directory)
    // - Root directory navigation (goes to device level by setting storageType to null)
    this.storageStore.navigateUpOneDirectory({
      deviceId: selected.deviceId,
      storageType: selected.storageType,
    });
  }

  onRefreshClick(): void {
    const selected = this.selectedDirectory();
    if (!selected || selected.storageType === null) return;

    this.storageStore.refreshDirectory({
      deviceId: selected.deviceId,
      storageType: selected.storageType,
    });
  }

  onNavigationRequested(path: string): void {
    const selected = this.selectedDirectory();
    if (!selected || selected.storageType === null) return;

    this.storageStore.navigateToDirectory({
      deviceId: selected.deviceId,
      storageType: selected.storageType,
      path: path,
    });
  }
}
