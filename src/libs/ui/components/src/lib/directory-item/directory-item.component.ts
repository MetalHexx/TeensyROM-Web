import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DirectoryItem } from '@teensyrom-nx/domain';
import { StorageItemComponent } from '../storage-item/storage-item.component';

@Component({
  selector: 'lib-directory-item',
  imports: [CommonModule, StorageItemComponent],
  templateUrl: './directory-item.component.html',
  styleUrl: './directory-item.component.scss',
})
export class DirectoryItemComponent {
  directoryItem = input.required<DirectoryItem>();
  selected = input<boolean>(false);

  itemSelected = output<DirectoryItem>();
  itemDoubleClicked = output<DirectoryItem>();

  onItemClick(): void {
    this.itemSelected.emit(this.directoryItem());
  }

  onItemDoubleClick(): void {
    this.itemDoubleClicked.emit(this.directoryItem());
  }
}
