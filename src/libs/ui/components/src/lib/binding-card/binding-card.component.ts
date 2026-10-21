import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** One selectable option — an output port, or a cartridge. `label` is caller-composed, e.g.
 *  'TeensyROM (PJRC)' or 'TR-1: TeensyROM-14470230 (Microsoft Corporation)' — this component
 *  renders it as-is and knows nothing of what backs it. */
export interface BindingPortModel {
  /** The option's unique identifier. */
  readonly id: string;
  /** The option's user-readable name. */
  readonly label: string;
  /** The deck letter that already holds this option, if set. Rendered as text in the option
   *  (`{{ label }} — taken by Deck {{ takenBy }} —`) and disables it — never colour alone. */
  readonly takenBy?: string;
  /** True when the option is not currently available (a cartridge that is not plugged in). The
   *  select is drawn in the error colour while it is the selection; the caller's label carries the
   *  text cue. */
  readonly absent?: boolean;
}

/** One deck's whole MIDI binding: its own accessible name, the option list (output ports or
 *  cartridges), and up to three distinct error states. */
export interface BindingCardModel {
  /** The section's own aria-label, e.g. 'MIDI binding deck A'. */
  readonly accessibleName: string;
  /** The card's heading text, e.g. 'Deck A'. */
  readonly heading: string;
  /** Array of the available options. */
  readonly ports: readonly BindingPortModel[];
  /** The currently selected option's id, or `null` if none selected. */
  readonly selectedPortId: string | null;
  /** false renders the single disabled `portPlaceholder` option instead of the option list. */
  readonly portsEnabled: boolean;
  /** The select's placeholder option text — composed by the caller, e.g. `— select a cartridge —`
   *  or `— select a port —`. Rendered as the select's one option when `!portsEnabled`, and as its
   *  first when enabled. */
  readonly portPlaceholder: string;
  /** false hides the Enable MIDI button entirely — a granted origin auto-connects on its own, so
   *  there is nothing left for the button to do. */
  readonly enableVisible: boolean;
  /** true while the permission grant is in flight. */
  readonly enableDisabled: boolean;
  /** true when the Identify button should be disabled. */
  readonly identifyDisabled: boolean;
  /** The selector's own accessible name, e.g. 'Cartridge deck A'. */
  readonly selectAccessibleName: string;
  /** The Enable MIDI button's own accessible name. */
  readonly enableAccessibleName: string;
  /** The Identify button's own accessible name. */
  readonly identifyAccessibleName: string;
  /** Rendered in order as `role="alert"` paragraphs; empty renders nothing. */
  readonly errors: readonly string[];
}

/**
 * One deck's MIDI binding card: its own selector — of output ports, or of cartridges — Enable MIDI
 * beside Identify, and whichever of its three distinct error states apply. Purely presentational —
 * it holds no state of its own; the caller owns the permission grant, the option list, and this
 * deck's own persisted selection.
 *
 * The `<select>`'s own disabled state is derived here from `portsEnabled` and `ports.length`
 * — neither is carried on the model, one owner, and it is this side.
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
  host: {
    '[attr.data-layout]': 'layout()',
  },
})
export class BindingCardComponent {
  /** The binding card's display model and state. */
  readonly model = input.required<BindingCardModel>();
  /** `'stacked'` (the default) is today's column layout, unchanged. `'inline'` lays the heading,
   *  the port control and the two buttons on one row, for a host with less vertical room to
   *  give. */
  readonly layout = input<'stacked' | 'inline'>('stacked');
  /** Emits the chosen option's id, or '' when the placeholder option was chosen. */
  readonly portSelect = output<string>();
  /** Emits when the Enable MIDI button is pressed. */
  readonly enableMidi = output<void>();
  /** Emits when the Identify button is pressed. */
  readonly identify = output<void>();

  /** Whether the selected option is flagged `absent`. */
  protected readonly selectedAbsent = computed(() => {
    const { ports, selectedPortId, portsEnabled } = this.model();
    return portsEnabled && ports.some((port) => port.id === selectedPortId && port.absent === true);
  });

  /** Forwards the selected option's id, or '' for the placeholder. */
  protected onSelectPort(event: Event): void {
    this.portSelect.emit((event.target as HTMLSelectElement).value);
  }
}
