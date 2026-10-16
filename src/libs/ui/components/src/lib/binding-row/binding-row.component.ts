import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import {
  SegmentedControlComponent,
  SegmentedControlOption,
} from '../segmented-control/segmented-control.component';

/** The numeric amount a binding's style takes, e.g. a relative step's size. */
export interface BindingRowAmount {
  /** The amount's visible label, e.g. 'Amount'. */
  readonly label: string;
  /** The current value. */
  readonly value: number;
  /** The lowest value the amount accepts. */
  readonly min: number;
  /** The highest value the amount accepts. */
  readonly max: number;
  /** The input's step. */
  readonly step: number;
  /** Text shown after the input, e.g. '%'. Empty for none. */
  readonly suffix: string;
}

/** One binding's caller-composed display state and the names it announces. */
export interface BindingRowModel {
  /** The control the binding drives, e.g. 'Speed'. */
  readonly name: string;
  /** Where the binding listens, e.g. 'Launch Control XL · ch 1 · CC 21'. */
  readonly sourceText: string;
  /** The collapsed row's style chip, e.g. 'Relative · 1%'. */
  readonly styleText: string;
  /** Whether the row is expanded in place to edit the binding. */
  readonly expanded: boolean;
  /** The styles the binding can take, shown as a segmented control when expanded. */
  readonly styleOptions: readonly SegmentedControlOption[];
  /** The `id` of the binding's current style among `styleOptions`. */
  readonly selectedStyleId: string;
  /** The style's amount, or `null` when the style takes none — the amount field is not shown. */
  readonly amount: BindingRowAmount | null;
  /** Why the binding is not live, e.g. 'Controller not connected'. Rendered as text under the
   *  source, with the row dimmed; `null` for a live binding. */
  readonly statusText: string | null;
  /** Accessible name for the edit toggle, e.g. 'Edit Speed binding'. */
  readonly editAccessibleName: string;
  /** Accessible name for the delete controls, e.g. 'Delete Speed binding'. */
  readonly deleteAccessibleName: string;
}

/** Source of the per-instance ids that tie each amount input to its label and error. */
let nextRowId = 0;

/**
 * One MIDI binding in a list: what it drives, where it listens and how it behaves. Collapsed, it
 * is two lines — the control's name, a style chip and the edit and delete buttons, then the source.
 * Expanded in place, it frames itself and offers the style, the amount where the style takes one,
 * and Re-learn source and Delete.
 *
 * Purely presentational — the caller owns the model and the `expanded` flag, and updates them from
 * the outputs. The amount is a native number input that emits on `change`, and only for a finite
 * value within `min` and `max`; anything else shows an inline error and emits nothing.
 *
 * @example
 * ```html
 * <lib-binding-row
 *   [model]="row()"
 *   (editToggle)="onEditToggle()"
 *   (styleSelect)="onStyleSelect($event)"
 *   (amountChange)="onAmountChange($event)"
 *   (relearn)="onRelearn()"
 *   (deleteBinding)="onDelete()"
 * />
 * ```
 */
@Component({
  selector: 'lib-binding-row',
  imports: [IconButtonComponent, SegmentedControlComponent],
  templateUrl: './binding-row.component.html',
  styleUrl: './binding-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BindingRowComponent {
  /** The binding's display state and accessible names. */
  readonly model = input.required<BindingRowModel>();
  /** Emits when the edit button is pressed — to expand a collapsed row or collapse an expanded one. */
  readonly editToggle = output<void>();
  /** Emits the `id` of the style the user chose. */
  readonly styleSelect = output<string>();
  /** Emits a new amount, only for a finite value within the amount's `min` and `max`. */
  readonly amountChange = output<number>();
  /** Emits when Re-learn source is pressed. */
  readonly relearn = output<void>();
  /** Emits when either delete control is pressed. */
  readonly deleteBinding = output<void>();

  /** Unique id tying the amount input to its label and error. */
  protected readonly amountInputId = `binding-row-amount-${nextRowId++}`;
  /** The inline error for the last rejected amount entry, or `null`. */
  protected readonly amountError = signal<string | null>(null);

  /** Whether the row is expanded, as a value the error reset can depend on alone. */
  private readonly expanded = computed(() => this.model().expanded);
  /** The current amount's value, or `null` for a style without one. */
  private readonly amountValue = computed(() => this.model().amount?.value ?? null);

  /** Drops a rejected amount entry — which only means something while the row stays as it was —
   *  when the row collapses or the caller accepts a new amount. */
  constructor() {
    effect(() => {
      this.expanded();
      this.amountValue();
      untracked(() => this.amountError.set(null));
    });
  }

  /** Emits the entered amount when it is valid; otherwise shows the inline error. */
  protected onAmountChange(event: Event, amount: BindingRowAmount): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    const value = raw === '' ? NaN : Number(raw);
    if (!Number.isFinite(value) || value < amount.min || value > amount.max) {
      this.amountError.set(`Enter a number from ${amount.min} to ${amount.max}.`);
      return;
    }
    this.amountError.set(null);
    this.amountChange.emit(value);
  }
}
