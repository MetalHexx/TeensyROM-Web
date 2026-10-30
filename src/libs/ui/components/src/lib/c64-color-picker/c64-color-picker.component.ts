import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  linkedSignal,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { C64_COLOR_COUNT, C64_PALETTE, c64Color } from '../c64-color/c64-palette';
import { C64ColorSwatchComponent } from '../c64-color-swatch/c64-color-swatch.component';
import { CompactCardLayoutComponent } from '../compact-card-layout/compact-card-layout.component';
import { DropdownDialogComponent } from '../dropdown-dialog';

/** Colors per row of the popover grid, and so the step of ArrowUp and ArrowDown. */
const COLUMNS = 4;

/**
 * Chooses one of the C64's sixteen colors. A button shows the current color's swatch and name;
 * clicking it opens a popover with all sixteen colors in a 4x4 grid, each shown as a swatch with
 * its name, and the current one marked with a check so no color is identified by color alone.
 *
 * The popover is a radio group with a roving tab stop that starts on the current color.
 * ArrowLeft and ArrowRight move by one, ArrowUp and ArrowDown by a row, clamped at the ends; Home
 * and End jump to the first and last color. Enter, Space or a click chooses and closes; Escape
 * closes without choosing, and focus returns to the button either way.
 *
 * The caller owns `value` and updates it from `valueChange`, which fires only when the chosen
 * color differs from the current one.
 *
 * @example
 * ```html
 * <lib-c64-color-picker label="Background" [value]="background()" (valueChange)="setBackground($event)" />
 * ```
 */
@Component({
  selector: 'lib-c64-color-picker',
  imports: [MatIconModule, C64ColorSwatchComponent, CompactCardLayoutComponent, DropdownDialogComponent],
  templateUrl: './c64-color-picker.component.html',
  styleUrl: './c64-color-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class C64ColorPickerComponent {
  /** The current color index, 0..15. */
  readonly value = input.required<number>();
  /** The slot being colored, e.g. 'Background'; names the button and the group. */
  readonly label = input.required<string>();
  /** Disables the button so the popover cannot open. Defaults to false. */
  readonly disabled = input<boolean>(false);
  /** Emits the chosen index; not emitted when it equals `value`. */
  readonly valueChange = output<number>();

  /** The sixteen colors, in grid order. */
  protected readonly palette = C64_PALETTE;
  /** Whether the popover is open; drives `aria-expanded` on the button. */
  protected readonly expanded = signal(false);
  /** The one color in the tab order; follows `value` until the arrow keys move it. */
  protected readonly tabStopIndex = linkedSignal(() => this.value());
  /** The current color's name, shown on the button and in its accessible name. */
  protected readonly currentName = computed(() => c64Color(this.value())?.name ?? 'Unknown color');

  /** The rendered color buttons in index order, so a key press can move focus to one. */
  private readonly options = viewChildren<ElementRef<HTMLButtonElement>>('option');

  /** Starts the roving tab stop on the current color and marks the button expanded. */
  protected onOpened(): void {
    this.tabStopIndex.set(this.value());
    this.expanded.set(true);
  }

  /** Emits `index` unless it is already the current color, then closes `dialog`. */
  protected choose(index: number, dialog: DropdownDialogComponent): void {
    if (index !== this.value()) {
      this.valueChange.emit(index);
    }
    dialog.close();
  }

  /** Moves focus within the grid for arrow, Home and End keys. */
  protected onKeydown(event: KeyboardEvent, index: number): void {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const target = this.targetIndex(event.key, index);
    if (target === null) {
      return;
    }
    event.preventDefault();
    this.tabStopIndex.set(target);
    this.options()[target]?.nativeElement.focus();
  }

  /** The index `key` leads to from `index`, clamped to the grid, or `null` for a non-navigation key. */
  private targetIndex(key: string, index: number): number | null {
    const last = C64_COLOR_COUNT - 1;
    switch (key) {
      case 'ArrowLeft':
        return Math.max(index - 1, 0);
      case 'ArrowRight':
        return Math.min(index + 1, last);
      case 'ArrowUp':
        return Math.max(index - COLUMNS, 0);
      case 'ArrowDown':
        return Math.min(index + COLUMNS, last);
      case 'Home':
        return 0;
      case 'End':
        return last;
      default:
        return null;
    }
  }
}
