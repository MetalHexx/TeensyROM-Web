import { Component, input, output, HostListener, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconLabelComponent } from '../icon-label/icon-label.component';
import { StyledIconColor } from '../styled-icon/styled-icon.component';

const TAP_MOVEMENT_THRESHOLD_PX = 10;

@Component({
  selector: 'lib-storage-item',
  imports: [CommonModule, IconLabelComponent],
  templateUrl: './storage-item.component.html',
  styleUrls: ['./storage-item.component.scss'],
})
export class StorageItemComponent {
  /** Material icon name */
  icon = input.required<string>();

  /** Icon color (e.g., 'normal', 'directory', 'primary') */
  iconColor = input<StyledIconColor>('normal');

  /** Primary label text */
  label = input.required<string>();

  /** Whether the item is currently selected */
  selected = input<boolean>(false);

  /** Whether the item is currently active (e.g., focused or highlighted) */
  active = input<boolean>(false);

  /** Whether the item is disabled */
  disabled = input<boolean>(false);

  /** Emitted on double-click, single tap (touch), or Enter key press */
  activated = output<void>();

  /** Emitted on single click or Space key press */
  selectedChange = output<void>();

  private suppressNextClick = false;
  private touchStartX = 0;
  private touchStartY = 0;

  @HostBinding('class.selected')
  get isSelected(): boolean {
    return this.selected();
  }

  @HostBinding('class.active')
  get isActive(): boolean {
    return this.active();
  }

  @HostBinding('class.disabled')
  get isDisabled(): boolean {
    return this.disabled();
  }

  @HostBinding('attr.tabindex')
  get tabIndex(): string {
    return this.disabled() ? '-1' : '0';
  }

  @HostBinding('attr.role')
  get role(): string {
    return 'button';
  }

  @HostBinding('attr.aria-selected')
  get ariaSelected(): string {
    return this.selected().toString();
  }

  @HostBinding('attr.aria-disabled')
  get ariaDisabled(): string | null {
    return this.disabled() ? 'true' : null;
  }

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

  @HostListener('dblclick')
  onDoubleClick(): void {
    if (!this.disabled()) {
      this.activated.emit();
    }
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    if (event.touches.length > 0) {
      this.touchStartX = event.touches[0].clientX;
      this.touchStartY = event.touches[0].clientY;
    }
  }

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

  @HostListener('keydown.enter')
  onEnterKey(): void {
    if (!this.disabled()) {
      this.activated.emit();
    }
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.disabled() && (event.code === 'Space' || event.key === ' ')) {
      event.preventDefault(); // Prevent scrolling
      this.selectedChange.emit();
    }
  }
}

