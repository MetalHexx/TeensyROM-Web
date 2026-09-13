import { Component, input, output } from '@angular/core';
import { DirectoryTreeNodeComponent } from '../directory-tree/directory-tree-node/directory-tree-node.component';
import { DirectoryTreeNodeType, StorageType } from '@teensyrom-nx/domain';

/**
 * The DJ view's storage browser tree: a single device node with its storage types as leaves.
 * Uses `DirectoryTreeNodeComponent` for node iconography and colors without the player's
 * `mat-tree` component. Renders the device node with an expand/collapse toggle, and when
 * expanded, shows a list of storage type leaves. Emits `expandedChange` on device node
 * activation and `storageSelect` when a storage leaf is selected.
 *
 * @example
 * ```html
 * <lib-browse-tree
 *   [model]="deviceModel"
 *   [expanded]="isExpanded()"
 *   [selectedStorageType]="currentStorageType()"
 *   (expandedChange)="onExpandedChange($event)"
 *   (storageSelect)="onStorageSelect($event)"
 * ></lib-browse-tree>
 * ```
 */
@Component({
  selector: 'lib-browse-tree',
  imports: [DirectoryTreeNodeComponent],
  templateUrl: './browse-tree.component.html',
  styleUrl: './browse-tree.component.scss',
  changeDetection: 'OnPush',
})
export class BrowseTreeComponent {
  /**
   * The device model containing device information and its storage options.
   * This is a required input that defines the device node and its storage leaves.
   */
  readonly model = input.required<BrowseTreeModel>();

  /**
   * Whether the device node is expanded, showing its storage leaves. Defaults to `true`.
   */
  readonly expanded = input<boolean>(true);

  /**
   * The currently selected storage type, or `null` if no storage is selected.
   * The selected storage leaf will display the selected state. Defaults to `null`.
   */
  readonly selectedStorageType = input<StorageType | null>(null);

  /**
   * Emitted when the device node is clicked or activated (Enter/Space),
   * with the new expanded state (toggled from current).
   */
  readonly expandedChange = output<boolean>();

  /**
   * Emitted when a storage leaf is clicked or activated (Enter/Space),
   * with the storage type of the selected leaf.
   */
  readonly storageSelect = output<StorageType>();

  // Export enum for template use
  readonly DirectoryTreeNodeType = DirectoryTreeNodeType;

  /**
   * Toggle the expanded state and emit `expandedChange`.
   */
  onDeviceClick(): void {
    this.expandedChange.emit(!this.expanded());
  }

  /**
   * Emit `storageSelect` with the given storage type.
   */
  onStorageSelect(storageType: StorageType): void {
    this.storageSelect.emit(storageType);
  }
}

/**
 * Model for a storage type leaf in the browse tree.
 */
export interface BrowseTreeStorageModel {
  readonly storageType: StorageType;
  readonly label: string; // 'SD Storage' | 'USB Storage'
  readonly icon: string; // 'sd_storage' | 'usb'
  readonly accessibleName: string; // 'SD Storage, Device SGVISJTN'
}

/**
 * Model for the device node in the browse tree.
 */
export interface BrowseTreeModel {
  readonly deviceId: string;
  readonly label: string; // the device's display name
  readonly icon: string; // 'desktop_windows'
  readonly accessibleName: string; // 'Device SGVISJTN'
  readonly storages: readonly BrowseTreeStorageModel[];
}
