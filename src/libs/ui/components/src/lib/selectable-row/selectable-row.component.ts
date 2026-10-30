import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * A selectable list row: a label with optional leading, after-label and trailing content.
 * It is the host that listens for click, Enter and Space and emits `selectedChange`; nothing
 * is emitted while `disabled`. The host exposes `role="option"` with `aria-selected`, so the
 * parent must supply the `role="listbox"` container and its accessible name.
 *
 * Projection slots: `[rowLeading]` before the label, `[rowAfterLabel]` right after it, and
 * `[rowTrailing]` at the trailing edge.
 *
 * @example
 * ```html
 * <div role="listbox" aria-label="Themes">
 *   <lib-selectable-row label="Neon" [selected]="current() === 'neon'" (selectedChange)="pick('neon')">
 *     <mat-icon rowLeading>palette</mat-icon>
 *   </lib-selectable-row>
 * </div>
 * ```
 */
@Component({
  selector: 'lib-selectable-row',
  templateUrl: './selectable-row.component.html',
  styleUrl: './selectable-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'option',
    '[attr.aria-selected]': 'selected()',
    '[attr.aria-disabled]': 'disabled() ? "true" : null',
    '[attr.tabindex]': 'disabled() ? -1 : 0',
    '[class.selected]': 'selected()',
    '[class.disabled]': 'disabled()',
    '(click)': 'onSelect()',
    '(keydown.enter)': 'onSelect($event)',
    '(keydown.space)': 'onSelect($event)',
  },
})
export class SelectableRowComponent {
  /** Row label text; truncated with an ellipsis when it does not fit. */
  readonly label = input.required<string>();
  /** Whether the row is the selected option; applies the `.selected` highlight and `aria-selected`. Defaults to `false`. */
  readonly selected = input<boolean>(false);
  /** Disables selection and removes the row from the tab order. Defaults to `false`. */
  readonly disabled = input<boolean>(false);

  /** Emitted on click, tap, Enter or Space; never while `disabled`. */
  readonly selectedChange = output<void>();

  /** Emits `selectedChange` unless disabled; prevents the default of key events so Space does not scroll. */
  onSelect(event?: Event): void {
    event?.preventDefault();
    if (!this.disabled()) {
      this.selectedChange.emit();
    }
  }
}
