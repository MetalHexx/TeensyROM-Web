import { Component, input, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TooltipDirective, TooltipConfig, TooltipPosition } from '../tooltip/tooltip.directive';

/**
 * Projects action buttons and trailing metadata (e.g. file size, item count, storage
 * type icon) into the right side of a `StorageItemComponent` row, following the Angular
 * Material `mat-card-actions` content-projection pattern. Always used together with
 * `StorageItemComponent`, which owns the row's own click/tap/keyboard selection handling —
 * this component owns only the trailing metadata label and the per-row action menu content
 * projected into it (e.g. `lib-icon-button`s for play/download/delete).
 *
 * @example
 * ```html
 * <lib-storage-item icon="music_note" label="Song.sid">
 *   <lib-storage-item-actions label="1.5 KB" storageType="SD">
 *     <lib-icon-button icon="play_arrow" ariaLabel="Play" (buttonClick)="play()"></lib-icon-button>
 *     <lib-icon-button icon="download" ariaLabel="Download" (buttonClick)="download()"></lib-icon-button>
 *   </lib-storage-item-actions>
 * </lib-storage-item>
 * ```
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
  styleUrl: './storage-item-actions.component.scss',
})
export class StorageItemActionsComponent {
  /** Optional text label to display before actions (e.g., file size, item count). Unset renders no label. */
  label = input<string>();

  /**
   * Optional storage type; when set, renders a tooltipped icon after the label. `'SD'`
   * renders the SD-card icon, anything else (typically `'USB'`) renders the USB icon.
   * Unset renders no icon.
   */
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
