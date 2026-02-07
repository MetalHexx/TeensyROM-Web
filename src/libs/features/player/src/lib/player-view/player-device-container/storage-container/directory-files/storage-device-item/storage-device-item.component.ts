import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageItemComponent } from '@teensyrom-nx/ui/components';
import { StorageDeviceItem } from '@teensyrom-nx/domain';

@Component({
  selector: 'lib-storage-device-item',
  imports: [CommonModule, StorageItemComponent],
  templateUrl: './storage-device-item.component.html',
  styleUrl: './storage-device-item.component.scss',
})
export class StorageDeviceItemComponent {
  storageDevice = input.required<StorageDeviceItem>();
  selected = input<boolean>(false);

  itemSelected = output<StorageDeviceItem>();
  itemDoubleClicked = output<StorageDeviceItem>();

  onItemClick(): void {
    this.itemSelected.emit(this.storageDevice());
  }

  onItemDoubleClick(): void {
    this.itemDoubleClicked.emit(this.storageDevice());
  }
}
