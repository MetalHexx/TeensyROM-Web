import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** One selectable output port. `label` is caller-composed, e.g. 'TeensyROM (PJRC)' — this component
 *  renders it as-is and knows nothing of what backs it. */
export interface BindingPortModel {
  readonly id: string;
  readonly label: string;
}

/** One deck's whole MIDI binding: its own accessible name, the port list, and up to three distinct
 *  error states. */
export interface BindingCardModel {
  /** The section's own aria-label, e.g. 'MIDI binding deck A'. */
  readonly accessibleName: string;
  /** e.g. 'Deck A'. */
  readonly heading: string;
  readonly ports: readonly BindingPortModel[];
  readonly selectedPortId: string | null;
  /** false renders the single disabled '— MIDI not enabled —' option instead of the port list. */
  readonly portsEnabled: boolean;
  /** true while the grant is in flight. */
  readonly enableDisabled: boolean;
  readonly identifyDisabled: boolean;
  readonly selectAccessibleName: string;
  readonly enableAccessibleName: string;
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
  readonly model = input.required<BindingCardModel>();
  /** The chosen port id, or '' when the placeholder option was chosen. */
  readonly portSelect = output<string>();
  readonly enableMidi = output<void>();
  readonly identify = output<void>();

  protected onSelectPort(event: Event): void {
    this.portSelect.emit((event.target as HTMLSelectElement).value);
  }
}
