import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { DeviceStore, StorageStore } from '@teensyrom-nx/application';
import { DirectoryTreeNode, DirectoryTreeNodeType } from '@teensyrom-nx/domain';
import { LogType, logInfo } from '@teensyrom-nx/utils';
import {
  DirectoryTreeComponent,
  buildDirectoryListingCache,
  buildDirectoryTree,
  resolveSelectedNodeId,
} from '@teensyrom-nx/ui/components';

/** Smart container wiring the presentational directory tree to StorageStore. */
@Component({
  selector: 'lib-directory-tree-container',
  imports: [DirectoryTreeComponent],
  templateUrl: './directory-tree-container.component.html',
  styleUrl: './directory-tree-container.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectoryTreeContainerComponent {
  deviceId = input.required<string>();
  directoryNavigated = output<void>();

  private readonly storageStore = inject(StorageStore);
  private readonly deviceStore = inject(DeviceStore);

  private readonly deviceName = computed(
    () =>
      this.deviceStore.devices().find((d) => d.deviceId === this.deviceId())?.name ??
      this.deviceId()
  );

  // The folder listings live in the store, so the tree is rebuilt from them on every mount.
  readonly nodes = computed(() => {
    const entries = Object.values(this.storageStore.getDeviceStorageEntries(this.deviceId())());

    return buildDirectoryTree({
      deviceId: this.deviceId(),
      deviceName: this.deviceName(),
      storageTypes: entries.map((entry) => entry.storageType),
      cache: buildDirectoryListingCache(entries),
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
