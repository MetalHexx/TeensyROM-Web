import { Component, input, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TooltipDirective, TooltipConfig, TooltipPosition } from '../tooltip/tooltip.directive';

/**
 * Directive component for projecting action buttons/content into the storage item.
 * Similar to mat-card-actions pattern from Angular Material.
 * Can display optional text label along with action buttons.
 * Optionally displays storage type icon (SD card or USB) after the label.
 *
 * @example
 * <lib-storage-item icon="music_note" label="Song.sid">
 *   <lib-storage-item-actions label="1.5 KB" storageType="SD">
 *     <button>Play</button>
 *     <button>Download</button>
 *   </lib-storage-item-actions>
 * </lib-storage-item>
 */
@Component({
  selector: 'lib-storage-item-actions',
  imports: [MatIconModule, TooltipDirective],
  template: `
    @if (label()) {
      <span class="actions-label">{{ label() }}</span>
    }
    @if (storageIcon()) {
      <mat-icon class="storage-type-icon" [libTooltip]="storageTooltipConfig()">
        {{ storageIcon() }}
      </mat-icon>
    }
    <ng-content></ng-content>
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .actions-label {
        color: var(--color-dimmed);
        font-size: 0.875rem;
        white-space: nowrap;
      }

      .storage-type-icon {
        font-size: 1rem;
        width: 1rem;
        height: 1rem;
        color: var(--color-dimmed);
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `,
  ],
})
export class StorageItemActionsComponent {
  /** Optional text label to display before actions (e.g., file size, item count) */
  label = input<string>();

  /** Optional storage type (SD or USB) to display icon */
  storageType = input<string | undefined>();

  /** Computed icon name based on storage type */
  storageIcon = computed(() => {
    const type = this.storageType();
    if (!type) return '';
    return type === 'SD' ? 'sd_card' : 'usb';
  });

  /** Computed tooltip configuration for storage type icon */
  storageTooltipConfig = computed<TooltipConfig>(() => {
    const type = this.storageType();
    if (!type) return { body: '' };
    
    return {
      body: type === 'SD' ? 'SD Storage' : 'USB Storage',
      position: TooltipPosition.Top
    };
  });
}
