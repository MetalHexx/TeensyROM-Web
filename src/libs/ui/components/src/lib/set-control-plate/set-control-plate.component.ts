import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SynthKeyComponent } from '../synth-key/synth-key.component';
import { SynthPanelComponent } from '../synth-panel/synth-panel.component';

/** The set control plate's caller-composed state. */
export interface SetControlPlateModel {
  /** The selected row's place, e.g. '03/08', or '— / —' with no selection. */
  readonly positionText: string;
  /** The selected row's tune. `null`: nothing is selected. */
  readonly title: string | null;
  readonly author: string | null;
  readonly previousDisabled: boolean;
  readonly nextDisabled: boolean;
  /** Disables both Load keys together. */
  readonly loadDisabled: boolean;
  /** Names the readout, e.g. 'Set selection, 3 of 8, Cybernoid II by Jeroen Tel'. */
  readonly selectAccessibleName: string;
  readonly previousAccessibleName: string;
  readonly nextAccessibleName: string;
  readonly loadAAccessibleName: string;
  readonly loadBAccessibleName: string;
}

/**
 * The set's controls on a plate: the Select group — an up key, a readout of the selected row
 * (`SEL`, its position, its title and author) and a down key — and the Load A and Load B keys. The
 * knob and the keys drive the same selection, so the plate only reports presses. Every key is a
 * one-shot; purely presentational.
 *
 * @example
 * ```html
 * <lib-set-control-plate
 *   [model]="plate()"
 *   (selectPrevious)="onUp()"
 *   (selectNext)="onDown()"
 *   (loadA)="onLoadA()"
 *   (loadB)="onLoadB()"
 * />
 * ```
 */
@Component({
  selector: 'lib-set-control-plate',
  imports: [SynthPanelComponent, SynthKeyComponent],
  templateUrl: './set-control-plate.component.html',
  styleUrl: './set-control-plate.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetControlPlateComponent {
  /** The plate's state. */
  readonly model = input.required<SetControlPlateModel>();
  /** Emits when the Select up key is pressed. */
  readonly selectPrevious = output<void>();
  /** Emits when the Select down key is pressed. */
  readonly selectNext = output<void>();
  /** Emits when Load A is pressed. */
  readonly loadA = output<void>();
  /** Emits when Load B is pressed. */
  readonly loadB = output<void>();

  /** The tune line: 'Title · Author', or the title alone when there is no author. */
  protected readonly tuneText = computed(() => {
    const { title, author } = this.model();
    if (title === null) return '';
    return author ? `${title} · ${author}` : title;
  });
}
