import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { StorageStore } from '@teensyrom-nx/application';
import {
  DirectoryListing,
  DirectoryTreeNode,
  DirectoryTreeNodeType,
  StorageType,
} from '@teensyrom-nx/domain';
import { LogType, logInfo } from '@teensyrom-nx/utils';
import {
  DirectoryTreeComponent,
  buildDirectoryTree,
  mergeDirectoryListings,
  resolveSelectedNodeId,
  type DirectoryListingCache,
} from '@teensyrom-nx/ui/components';

/** Smart container wiring the presentational directory tree to StorageStore. */
@Component({
  selector: 'lib-directory-tree-container',
  imports: [DirectoryTreeComponent],
  templateUrl: './directory-tree-container.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectoryTreeContainerComponent {
  deviceId = input.required<string>();
  directoryNavigated = output<void>();

  private readonly storageStore = inject(StorageStore);

  private readonly cache = signal<DirectoryListingCache>(new Map());

  // Use effect to sync store data to cache (cannot write to signals in computed)
  private readonly cacheSync = effect(() => {
    const deviceDirectories = this.storageStore.getDeviceDirectories(this.deviceId())();
    const listings: DirectoryListing[] = [];

    deviceDirectories.forEach((entry) => {
      if (entry.directory) {
        listings.push({
          deviceId: entry.deviceId,
          storageType: entry.storageType,
          path: entry.currentPath,
          directories: entry.directory.directories,
        });
      }
    });

    this.cache.update((current) => mergeDirectoryListings(current, listings));
  });

  readonly nodes = computed(() => {
    const storageTypes: StorageType[] = Object.values(
      this.storageStore.getDeviceStorageEntries(this.deviceId())()
    ).map((entry) => entry.storageType);

    return buildDirectoryTree({
      deviceId: this.deviceId(),
      storageTypes,
      cache: this.cache(),
    });
  });

  readonly selectedNodeId = computed(() => {
    const state = this.storageStore.getSelectedDirectoryState(this.deviceId())();

    return resolveSelectedNodeId({
      deviceId: this.deviceId(),
      isDeviceLevel: this.storageStore.isDeviceLevelView(this.deviceId())(),
      storageType: state?.storageType ?? null,
      currentPath: state?.currentPath ?? null,
    });
  });

  onNodeActivated(node: DirectoryTreeNode): void {
    logInfo(LogType.Select, `Directory selected: ${node.name}`, node);

    // Handle device node click - navigate to device level
    if (node.type === DirectoryTreeNodeType.Device && node.deviceId) {
      this.storageStore.navigateToDeviceLevel({ deviceId: node.deviceId });
      this.directoryNavigated.emit();
      return;
    }

    // Only trigger navigation for directories and storage types
    if (
      (node.type === DirectoryTreeNodeType.Directory ||
        node.type === DirectoryTreeNodeType.StorageType) &&
      node.deviceId &&
      node.storageType &&
      node.path
    ) {
      this.storageStore.navigateToDirectory({
        deviceId: node.deviceId,
        storageType: node.storageType,
        path: node.path,
      });
      this.directoryNavigated.emit();
    }
  }

  onNodeExpansionNeedsData(node: DirectoryTreeNode): void {
    if (
      (node.type === DirectoryTreeNodeType.Directory ||
        node.type === DirectoryTreeNodeType.StorageType) &&
      node.deviceId &&
      node.storageType &&
      node.path
    ) {
      this.storageStore.navigateToDirectory({
        deviceId: node.deviceId,
        storageType: node.storageType,
        path: node.path,
      });
    }
  }
}
