import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { BindingCardModel } from '../binding-card/binding-card.component';
import { SynthKeyComponent } from '../synth-key/synth-key.component';
import { SynthPanelComponent } from '../synth-panel/synth-panel.component';

/**
 * One deck's MIDI binding on a faceplate, as a single row: the deck's label, the selector of output
 * ports or cartridges, Identify, and Enable MIDI while it is still offered. Whichever of its three
 * distinct error states apply render beneath the row as `role="alert"` paragraphs. Purely
 * presentational — it holds no state of its own; the caller owns the permission grant, the option
 * list and this deck's own persisted selection.
 *
 * The `<select>`'s disabled state is derived here from `portsEnabled` and `ports.length`, as on
 * `BindingCardComponent`. The row shrinks to a deck column of about 248px: the select takes the
 * slack and its text truncates.
 *
 * @example
 * ```html
 * <lib-binding-plate
 *   [model]="bindingModel()"
 *   (portSelect)="onPortSelect($event)"
 *   (enableMidi)="onEnableMidi()"
 *   (identify)="onIdentify()"
 * />
 * ```
 */
@Component({
  selector: 'lib-binding-plate',
  templateUrl: './binding-plate.component.html',
  styleUrl: './binding-plate.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SynthPanelComponent, SynthKeyComponent],
})
export class BindingPlateComponent {
  /** The binding plate's display model and state. */
  readonly model = input.required<BindingCardModel>();
  /** Emits the chosen option's id, or '' when the placeholder option was chosen. */
  readonly portSelect = output<string>();
  /** Emits when the Enable MIDI key is pressed. */
  readonly enableMidi = output<void>();
  /** Emits when the Identify key is pressed. */
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
