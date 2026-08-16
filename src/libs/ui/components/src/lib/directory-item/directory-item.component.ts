import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DirectoryItem } from '@teensyrom-nx/domain';
import { StorageItemComponent } from '../storage-item/storage-item.component';

/**
 * A single folder row in a directory listing. Wraps `StorageItemComponent` with the
 * folder icon and directory icon color already fixed, so callers only need to supply
 * the folder's data and listen for selection/activation.
 *
 * Reach for `lib-directory-item` when rendering folders inside a directory listing.
 * Use `StorageDeviceItemComponent` instead for top-level storage devices, or the bare
 * `StorageItemComponent` when the icon and color need to vary per row (e.g. file rows).
 *
 * @example
 * ```html
 * <lib-directory-item
 *   [directoryItem]="folder"
 *   [selected]="selectedPath() === folder.path"
 *   (itemSelected)="onFolderSelected($event)"
 *   (itemDoubleClicked)="onFolderOpened($event)"
 * ></lib-directory-item>
 * ```
 */
@Component({
  selector: 'lib-directory-item',
  imports: [CommonModule, StorageItemComponent],
  templateUrl: './directory-item.component.html',
  styleUrl: './directory-item.component.scss',
})
export class DirectoryItemComponent {
  /** The folder to render. See the exported `DirectoryItem` type (`@teensyrom-nx/domain`) for its shape. */
  directoryItem = input.required<DirectoryItem>();
  /** Whether this row is currently the selected item. Defaults to `false`. */
  selected = input<boolean>(false);

  /** Emitted on single click or Space key press — selection toggle, not navigation. */
  itemSelected = output<DirectoryItem>();
  /** Emitted on double-click, single tap (touch), or Enter key press — the "open this folder" action. */
  itemDoubleClicked = output<DirectoryItem>();

  onItemClick(): void {
    this.itemSelected.emit(this.directoryItem());
  }

  onItemDoubleClick(): void {
    this.itemDoubleClicked.emit(this.directoryItem());
  }
}
