import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** One selectable output port. `label` is caller-composed, e.g. 'TeensyROM (PJRC)' — this component
 *  renders it as-is and knows nothing of what backs it. */
export interface BindingPortModel {
  /** The port's unique identifier. */
  readonly id: string;
  /** The port's user-readable name. */
  readonly label: string;
}

/** One deck's whole MIDI binding: its own accessible name, the port list, and up to three distinct
 *  error states. */
export interface BindingCardModel {
  /** The section's own aria-label, e.g. 'MIDI binding deck A'. */
  readonly accessibleName: string;
  /** The card's heading text, e.g. 'Deck A'. */
  readonly heading: string;
  /** Array of available output ports. */
  readonly ports: readonly BindingPortModel[];
  /** The currently selected port's id, or `null` if none selected. */
  readonly selectedPortId: string | null;
  /** false renders the single disabled '— MIDI not enabled —' option instead of the port list. */
  readonly portsEnabled: boolean;
  /** true while the permission grant is in flight. */
  readonly enableDisabled: boolean;
  /** true when the Identify button should be disabled. */
  readonly identifyDisabled: boolean;
  /** The output port selector's own accessible name. */
  readonly selectAccessibleName: string;
  /** The Enable MIDI button's own accessible name. */
  readonly enableAccessibleName: string;
  /** The Identify button's own accessible name. */
  readonly identifyAccessibleName: string;
  /** Rendered in order as `role="alert"` paragraphs; empty renders nothing. */
  readonly errors: readonly string[];
}

/**
 * One deck's MIDI binding card: its own Output port selector, Enable MIDI beside Identify, and
 * whichever of its three distinct error states apply. Purely presentational — it holds no state of
 * its own; the caller owns the permission grant, the enumerated port list and this deck's own
 * persisted selection.
 *
 * The `<select>`'s own disabled state is derived here from `portsEnabled` and `ports.length`, not
 * carried on the model — one owner, and it is this side.
 *
 * @example
 * ```html
 * <lib-binding-card
 *   [model]="bindingModel()"
 *   (portSelect)="onPortSelect($event)"
 *   (enableMidi)="onEnableMidi()"
 *   (identify)="onIdentify()"
 * />
 * ```
 */
@Component({
  selector: 'lib-binding-card',
  templateUrl: './binding-card.component.html',
  styleUrl: './binding-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BindingCardComponent {
  /** The binding card's display model and state. */
  readonly model = input.required<BindingCardModel>();
  /** Emits the chosen port id, or '' when the placeholder option was chosen. */
  readonly portSelect = output<string>();
  /** Emits when the Enable MIDI button is pressed. */
  readonly enableMidi = output<void>();
  /** Emits when the Identify button is pressed. */
  readonly identify = output<void>();

  /** Forwards the selected port's id, or '' for the placeholder. */
  protected onSelectPort(event: Event): void {
    this.portSelect.emit((event.target as HTMLSelectElement).value);
  }
}
