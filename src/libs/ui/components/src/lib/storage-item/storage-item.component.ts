import { Component, input, output, HostListener, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconLabelComponent } from '../icon-label/icon-label.component';
import { StyledIconColor } from '../styled-icon/styled-icon.component';

const TAP_MOVEMENT_THRESHOLD_PX = 10;

/**
 * A single row for storage entries — files, folders, devices — with an icon, a label,
 * selection/active/disabled visual states, and full keyboard and touch support. Owns row
 * selection: it is the host that listens for click/tap/keyboard input and emits
 * `selectedChange`/`activated`.
 *
 * It projects two optional slots: `[storageItemAfterLabel]`/`[storageItemIncompatibleIcon]`
 * next to the label, and any content (typically `lib-storage-item-actions`) at the row's
 * trailing edge for per-row metadata and action buttons. `StorageItemActionsComponent` owns
 * that action-menu slot; the two are meant to be used together.
 *
 * Reach for `lib-storage-item` directly when a row's icon/color varies per instance and
 * no folder-specific defaults are wanted; prefer `DirectoryItemComponent` for folder rows
 * or `StorageDeviceItemComponent` for top-level device rows, both of which wrap this
 * component with their icon/color already fixed.
 *
 * @example
 * ```html
 * <lib-storage-item
 *   icon="music_note"
 *   iconColor="primary"
 *   label="Song.sid"
 *   [selected]="isSelected()"
 *   (activated)="onPlay()"
 *   (selectedChange)="onToggleSelection()"
 * >
 *   <lib-storage-item-actions label="1.5 KB">
 *     <lib-icon-button icon="download" ariaLabel="Download"></lib-icon-button>
 *   </lib-storage-item-actions>
 * </lib-storage-item>
 * ```
 */
@Component({
  selector: 'lib-storage-item',
  imports: [CommonModule, IconLabelComponent],
  templateUrl: './storage-item.component.html',
  styleUrls: ['./storage-item.component.scss'],
})
export class StorageItemComponent {
  /** Material icon name shown before the label. */
  icon = input.required<string>();

  /** Icon color variant. See the `StyledIconColor` type for the allowed values. Defaults to `'normal'`. */
  iconColor = input<StyledIconColor>('normal');

  /** Primary label text. */
  label = input.required<string>();

  /** Whether the item is currently selected; applies the `.selected` highlight and `aria-selected`. Defaults to `false`. */
  selected = input<boolean>(false);

  /** Whether the item is the current active/focused item in a list; applies the `.active` highlight, independent of `selected`. Defaults to `false`. */
  active = input<boolean>(false);

  /** Disables all interaction (click/tap/keyboard emit nothing) and sets `tabindex="-1"` and `aria-disabled`. Defaults to `false`. */
  disabled = input<boolean>(false);

  /** Emitted on double-click, single tap (touch), or Enter key press — the row's primary "open/play" action. */
  activated = output<void>();

  /** Emitted on single click or Space key press — the row's selection-toggle action. */
  selectedChange = output<void>();

  /** Set on touch end to suppress the synthetic `click` a tap generates immediately after emitting `activated`. */
  private suppressNextClick = false;
  /** Horizontal touch start position (px), used to distinguish a tap from a swipe/scroll. */
  private touchStartX = 0;
  /** Vertical touch start position (px), used to distinguish a tap from a swipe/scroll. */
  private touchStartY = 0;

  /** Applies the `.selected` host class from `selected()`. */
  @HostBinding('class.selected')
  get isSelected(): boolean {
    return this.selected();
  }

  /** Applies the `.active` host class from `active()`. */
  @HostBinding('class.active')
  get isActive(): boolean {
    return this.active();
  }

  /** Applies the `.disabled` host class from `disabled()`. */
  @HostBinding('class.disabled')
  get isDisabled(): boolean {
    return this.disabled();
  }

  /** Host `tabindex`: `-1` when `disabled()`, otherwise `0`. */
  @HostBinding('attr.tabindex')
  get tabIndex(): string {
    return this.disabled() ? '-1' : '0';
  }

  /** Host ARIA `role`, always `'button'`. */
  @HostBinding('attr.role')
  get role(): string {
    return 'button';
  }

  /** Host `aria-selected`, mirroring `selected()`. */
  @HostBinding('attr.aria-selected')
  get ariaSelected(): string {
    return this.selected().toString();
  }

  /** Host `aria-disabled`, set to `'true'` when `disabled()`, otherwise omitted. */
  @HostBinding('attr.aria-disabled')
  get ariaDisabled(): string | null {
    return this.disabled() ? 'true' : null;
  }

  /** Emits `selectedChange` on host click, unless suppressed by a just-handled tap or the row is disabled. */
  @HostListener('click')
  onClick(): void {
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }
    if (!this.disabled()) {
      this.selectedChange.emit();
    }
  }

  /** Emits `activated` on host double-click, unless the row is disabled. */
  @HostListener('dblclick')
  onDoubleClick(): void {
    if (!this.disabled()) {
      this.activated.emit();
    }
  }

  /** Records the touch start position for tap-vs-swipe detection in `onTouchEnd`. */
  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    if (event.touches.length > 0) {
      this.touchStartX = event.touches[0].clientX;
      this.touchStartY = event.touches[0].clientY;
    }
  }

  /** Emits `activated` for a tap (movement under the threshold) and suppresses the resulting synthetic click. */
  @HostListener('touchend', ['$event'])
  onTouchEnd(event: TouchEvent): void {
    if (this.disabled()) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const moveX = Math.abs(touch.clientX - this.touchStartX);
    const moveY = Math.abs(touch.clientY - this.touchStartY);

    if (moveX < TAP_MOVEMENT_THRESHOLD_PX && moveY < TAP_MOVEMENT_THRESHOLD_PX) {
      event.preventDefault();
      this.suppressNextClick = true;
      this.activated.emit();
    }
  }

  /** Emits `activated` on `Enter`, unless the row is disabled. */
  @HostListener('keydown.enter')
  onEnterKey(): void {
    if (!this.disabled()) {
      this.activated.emit();
    }
  }

  /** Emits `selectedChange` on `Space`, unless the row is disabled. */
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.disabled() && (event.code === 'Space' || event.key === ' ')) {
      event.preventDefault(); // Prevent scrolling
      this.selectedChange.emit();
    }
  }
}

