import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** One selectable output port. `label` is caller-composed, e.g. 'TeensyROM (PJRC)' — this component
 *  renders it as-is and knows nothing of what backs it. */
export interface BindingPortModel {
  /** The port's unique identifier. */
  readonly id: string;
  /** The port's user-readable name. */
  readonly label: string;
  /** The deck letter that already holds this port, if set. Rendered as text in the option
   *  (`{{ label }} — taken by Deck {{ takenBy }} —`) and disables it — never colour alone. */
  readonly takenBy?: string;
}

/** One selectable input device, mirroring `BindingPortModel`. */
export interface BindingDeviceModel {
  /** The device's unique identifier. */
  readonly id: string;
  /** The device's user-readable name. */
  readonly label: string;
  /** The deck letter that already holds this device, if set — see `BindingPortModel.takenBy`. */
  readonly takenBy?: string;
}

/** One deck's whole MIDI binding: its own accessible name, the port and device lists, and up to
 *  three distinct error states. */
export interface BindingCardModel {
  /** The section's own aria-label, e.g. 'MIDI binding deck A'. */
  readonly accessibleName: string;
  /** The card's heading text, e.g. 'Deck A'. */
  readonly heading: string;
  /** Array of available output ports. */
  readonly ports: readonly BindingPortModel[];
  /** The currently selected port's id, or `null` if none selected. */
  readonly selectedPortId: string | null;
  /** false renders the single disabled `portPlaceholder` option instead of the port list. */
  readonly portsEnabled: boolean;
  /** The port select's placeholder option text — composed by the caller, e.g.
   *  `— select a port —`, `— MIDI not enabled —`, or `— last saw TeensyROM (PJRC) —` before the
   *  Enable gesture (every reload) when a previously bound port is not currently present. Rendered
   *  as the select's one option when `!portsEnabled`, and as its first when enabled. */
  readonly portPlaceholder: string;
  /** Array of available input devices. */
  readonly devices: readonly BindingDeviceModel[];
  /** The currently selected device's id, or `null` if none selected. */
  readonly selectedDeviceId: string | null;
  /** The device select's placeholder option text, composed the same way as `portPlaceholder`.
   *  Rendered as the select's one option when `devices` is empty, and as its first otherwise. */
  readonly devicePlaceholder: string;
  /** true while the permission grant is in flight. */
  readonly enableDisabled: boolean;
  /** true when the Identify button should be disabled. */
  readonly identifyDisabled: boolean;
  /** The output port selector's own accessible name. */
  readonly selectAccessibleName: string;
  /** The device selector's own accessible name. */
  readonly deviceSelectAccessibleName: string;
  /** The Enable MIDI button's own accessible name. */
  readonly enableAccessibleName: string;
  /** The Identify button's own accessible name. */
  readonly identifyAccessibleName: string;
  /** Rendered in order as `role="alert"` paragraphs; empty renders nothing. */
  readonly errors: readonly string[];
}

/**
 * One deck's MIDI binding card: its own Output port selector beside a Device selector, Enable MIDI
 * beside Identify, and whichever of its three distinct error states apply. Purely presentational —
 * it holds no state of its own; the caller owns the permission grant, the enumerated port and
 * device lists, and this deck's own persisted selections.
 *
 * The port `<select>`'s own disabled state is derived here from `portsEnabled` and `ports.length`;
 * the device `<select>`'s from `devices.length` alone — neither is carried on the model, one owner,
 * and it is this side.
 *
 * @example
 * ```html
 * <lib-binding-card
 *   [model]="bindingModel()"
 *   (portSelect)="onPortSelect($event)"
 *   (deviceSelect)="onDeviceSelect($event)"
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
   *  the port control, the device control and the two buttons on one row, for a host with less
   *  vertical room to give. */
  readonly layout = input<'stacked' | 'inline'>('stacked');
  /** Emits the chosen port id, or '' when the placeholder option was chosen. */
  readonly portSelect = output<string>();
  /** Emits the chosen device id, or '' when the placeholder option was chosen. */
  readonly deviceSelect = output<string>();
  /** Emits when the Enable MIDI button is pressed. */
  readonly enableMidi = output<void>();
  /** Emits when the Identify button is pressed. */
  readonly identify = output<void>();

  /** Forwards the selected port's id, or '' for the placeholder. */
  protected onSelectPort(event: Event): void {
    this.portSelect.emit((event.target as HTMLSelectElement).value);
  }

  /** Forwards the selected device's id, or '' for the placeholder. */
  protected onSelectDevice(event: Event): void {
    this.deviceSelect.emit((event.target as HTMLSelectElement).value);
  }
}
