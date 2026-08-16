import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageDeviceItem } from '@teensyrom-nx/domain';
import { StorageItemComponent } from '../storage-item/storage-item.component';

/**
 * A top-level storage device row (e.g. "SD Storage", "USB Storage"). Wraps
 * `StorageItemComponent` with the highlight icon color already fixed, taking the device's
 * icon and name from the supplied `StorageDeviceItem` rather than exposing them as
 * separate inputs.
 *
 * Reach for `lib-storage-device-item` when listing a device's storage roots. Use
 * `DirectoryItemComponent` instead for folders within one of those roots, or the bare
 * `StorageItemComponent` when neither the directory nor device defaults apply.
 *
 * @example
 * ```html
 * <lib-storage-device-item
 *   [storageDevice]="sdStorage"
 *   [selected]="selectedDeviceId() === sdStorage.deviceId"
 *   (itemSelected)="onDeviceSelected($event)"
 *   (itemDoubleClicked)="onDeviceOpened($event)"
 * ></lib-storage-device-item>
 * ```
 */
@Component({
  selector: 'lib-storage-device-item',
  imports: [CommonModule, StorageItemComponent],
  templateUrl: './storage-device-item.component.html',
  styleUrl: './storage-device-item.component.scss',
})
export class StorageDeviceItemComponent {
  /** The storage device to render. See the exported `StorageDeviceItem` type (`@teensyrom-nx/domain`) for its shape. */
  storageDevice = input.required<StorageDeviceItem>();
  /** Whether this row is currently the selected item. Defaults to `false`. */
  selected = input<boolean>(false);

  /** Emitted on single click or Space key press — selection toggle, not navigation. */
  itemSelected = output<StorageDeviceItem>();
  /** Emitted on double-click, single tap (touch), or Enter key press — the "open this storage" action. */
  itemDoubleClicked = output<StorageDeviceItem>();

  onItemClick(): void {
    this.itemSelected.emit(this.storageDevice());
  }

  onItemDoubleClick(): void {
    this.itemDoubleClicked.emit(this.storageDevice());
  }
}
