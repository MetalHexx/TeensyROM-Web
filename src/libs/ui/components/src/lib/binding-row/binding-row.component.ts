import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  output,
  signal,
  untracked,
  viewChild,
  type WritableSignal,
} from '@angular/core';
import { ActionButtonComponent } from '../action-button/action-button.component';
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
  /** Label above the first choice: 'Action' for one-shot, on/off and note-step controls, 'Style' otherwise. */
  readonly styleLabel: string;
  /** The choices of the first segmented control (the Action or Style) when expanded. Empty when
   *  there is nothing to choose, which hides the control. */
  readonly styleOptions: readonly SegmentedControlOption[];
  /** The `id` of the binding's current choice among `styleOptions`. */
  readonly selectedStyleId: string;
  /** The trigger choice, or `null` when the selected style has none. */
  readonly triggerOptions: readonly SegmentedControlOption[] | null;
  /** The `id` of the binding's current trigger among `triggerOptions`; `null` without a trigger. */
  readonly selectedTriggerId: string | null;
  /** The style's amount, or `null` when the style takes none — the amount field is not shown. */
  readonly amount: BindingRowAmount | null;
  /** The style's second setting — the hand's grip — shown as its own labelled field after the
   *  amount, or null for every style with one setting or none. */
  readonly secondAmount: BindingRowAmount | null;
  /** Why the binding is not live, e.g. 'Controller not connected'. Rendered as text under the
   *  source, with the row dimmed; `null` for a live binding. */
  readonly statusText: string | null;
  /** Accessible name for the edit toggle, e.g. 'Edit Speed binding'. */
  readonly editAccessibleName: string;
  /** Accessible name for the Delete button in the open row, e.g. 'Delete Speed binding'. */
  readonly deleteAccessibleName: string;
}

/** Source of the per-instance ids that tie each amount input to its label and error. */
let nextRowId = 0;

/** How long after a row opens a pointer press on its Delete button is ignored, so the click that
 *  opened the row (or a quick follow-up at the same spot) cannot delete it. */
export const DELETE_ARM_MS = 600;

/**
 * One MIDI binding in a list: what it drives, where it listens and how it behaves. Collapsed, it
 * is two lines — the control's name, a style chip and the edit button, then the source. Expanded
 * in place, it frames itself and offers the style (or Action), the trigger where the style has
 * one, the amount (and a second amount) where the style takes them, and Re-learn source and
 * Delete. The edit button stays at the same place in both states.
 *
 * Purely presentational — the caller owns the model and the `expanded` flag, and updates them from
 * the outputs. Each amount is a native number input that emits on `change`, and only for a finite
 * value within its `min` and `max`; anything else shows an inline error and emits nothing. A
 * pointer press on Delete within {@link DELETE_ARM_MS} of the row opening is ignored; keyboard
 * activation always deletes.
 *
 * @example
 * ```html
 * <lib-binding-row
 *   [model]="row()"
 *   (editToggle)="onEditToggle()"
 *   (styleSelect)="onStyleSelect($event)"
 *   (triggerSelect)="onTriggerSelect($event)"
 *   (amountChange)="onAmountChange($event)"
 *   (secondAmountChange)="onSecondAmountChange($event)"
 *   (relearn)="onRelearn()"
 *   (deleteBinding)="onDelete()"
 * />
 * ```
 */
@Component({
  selector: 'lib-binding-row',
  imports: [ActionButtonComponent, IconButtonComponent, SegmentedControlComponent],
  templateUrl: './binding-row.component.html',
  styleUrl: './binding-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BindingRowComponent {
  /** The binding's display state and accessible names. */
  readonly model = input.required<BindingRowModel>();
  /** Emits when the edit button is pressed — to expand a collapsed row or collapse an expanded one. */
  readonly editToggle = output<void>();
  /** Emits the `id` of the style (or Action) the user chose. */
  readonly styleSelect = output<string>();
  /** Emits the `id` of the trigger the user chose. */
  readonly triggerSelect = output<string>();
  /** Emits a new amount, only for a finite value within the amount's `min` and `max`. */
  readonly amountChange = output<number>();
  /** Emits a new second amount, only for a finite value within its `min` and `max`. */
  readonly secondAmountChange = output<number>();
  /** Emits when Re-learn source is pressed. */
  readonly relearn = output<void>();
  /** Emits when Delete in the open row is activated. */
  readonly deleteBinding = output<void>();

  /** Unique id tying the amount input to its label and error. */
  protected readonly amountInputId = `binding-row-amount-${nextRowId++}`;
  /** The inline error for the last rejected amount entry, or `null`. */
  protected readonly amountError = signal<string | null>(null);
  /** Unique id tying the second amount input to its label and error. */
  protected readonly secondAmountInputId = `binding-row-second-amount-${nextRowId++}`;
  /** The inline error for the last rejected second amount entry, or `null`. */
  protected readonly secondAmountError = signal<string | null>(null);

  /** Whether the row is expanded, as a value the error reset can depend on alone. */
  private readonly expanded = computed(() => this.model().expanded);
  /** The current amount's value, or `null` for a style without one. */
  private readonly amountValue = computed(() => this.model().amount?.value ?? null);
  /** The current second amount's value, or `null` for a style without one. */
  private readonly secondAmountValue = computed(() => this.model().secondAmount?.value ?? null);

  private readonly editButton = viewChild(IconButtonComponent, { read: ElementRef });
  /** When the row last became expanded, from `performance.now()`. */
  private expandedAt = 0;
  /** Whether the Delete activation in flight began with a pointer press. */
  private deletePointerPress = false;

  /** Drops a rejected entry — which only means something while the row stays as it was — when the
   *  row collapses or the caller accepts a new value for that field, and stamps the moment the row
   *  opens for the Delete guard. */
  constructor() {
    effect(() => {
      if (this.expanded()) {
        this.expandedAt = performance.now();
      }
    });
    effect(() => {
      this.expanded();
      this.amountValue();
      untracked(() => this.amountError.set(null));
    });
    effect(() => {
      this.expanded();
      this.secondAmountValue();
      untracked(() => this.secondAmountError.set(null));
    });
  }

  /** Moves keyboard focus to the edit button. */
  focusEdit(): void {
    this.editButton()?.nativeElement.querySelector('button')?.focus();
  }

  protected onDeletePointerDown(): void {
    this.deletePointerPress = true;
  }

  protected onDeleteKeyDown(): void {
    this.deletePointerPress = false;
  }

  /** Emits `deleteBinding`, unless a pointer press lands within {@link DELETE_ARM_MS} of the row
   *  opening. */
  protected onDeleteClick(): void {
    const byPointer = this.deletePointerPress;
    this.deletePointerPress = false;
    if (byPointer && performance.now() - this.expandedAt < DELETE_ARM_MS) {
      return;
    }
    this.deleteBinding.emit();
  }

  /** Emits the entered amount when it is valid; otherwise shows the inline error. */
  protected onAmountChange(event: Event, amount: BindingRowAmount): void {
    this.commit(event, amount, this.amountError, (value) => this.amountChange.emit(value));
  }

  /** Emits the entered second amount when it is valid; otherwise shows the inline error. */
  protected onSecondAmountChange(event: Event, amount: BindingRowAmount): void {
    this.commit(event, amount, this.secondAmountError, (value) =>
      this.secondAmountChange.emit(value)
    );
  }

  private commit(
    event: Event,
    amount: BindingRowAmount,
    error: WritableSignal<string | null>,
    emit: (value: number) => void
  ): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    const value = raw === '' ? NaN : Number(raw);
    if (!Number.isFinite(value) || value < amount.min || value > amount.max) {
      error.set(`Enter a number from ${amount.min} to ${amount.max}.`);
      return;
    }
    error.set(null);
    emit(value);
  }
}
