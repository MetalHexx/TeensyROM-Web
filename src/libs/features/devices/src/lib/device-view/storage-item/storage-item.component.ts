import { Component, input, output, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { IconLabelComponent, IconButtonComponent, TooltipConfig, TooltipPosition } from '@teensyrom-nx/ui/components';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'lib-storage-status',
  imports: [
    MatIconModule,
    CommonModule,
    MatCardModule,
    MatChipsModule,
    IconLabelComponent,
    MatButtonModule,
    IconButtonComponent,
  ],
  templateUrl: './storage-item.component.html',
  styleUrl: './storage-item.component.scss',
})
export class StorageStatusComponent {
  icon = input<string>('');
  label = input<string>('');
  status = input<boolean | undefined>(undefined);
  /** Whether storage has been indexed */
  indexExists = input<boolean>(true);
  
  index = output<void>();

  /** Subtitle text based on storage state */
  readonly subtitle = computed(() => {
    if (!this.status()) {
      return 'Unavailable';
    }
    return this.indexExists() ? 'Available' : 'Requires Indexing';
  });

  /** CSS class for subtitle color */
  readonly subtitleClass = computed(() => {
    if (!this.status()) {
      return 'dimmed';
    }
    return this.indexExists() ? 'highlight' : 'error';
  });

  /** Tooltip configuration */
  tooltipMessage = computed<TooltipConfig>(() => {
    const storageType = this.icon() === 'usb' ? 'USB device' : 'SD card';
    return {
      title: `Index ${storageType}`,
      body: `Indexes the ${storageType} to make files available for search and random launch.`,
      position: TooltipPosition.Top
    };
  });

  onIndex() {
    this.index.emit();
  }
}
