import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type {
  LoopsCuesPanelModel,
  MarkerRowAction,
} from '../loops-cues-panel/loops-cues-panel.component';
import { MarkerRowComponent } from '../marker-row/marker-row.component';
import { SynthKeyComponent } from '../synth-key/synth-key.component';
import { SynthPanelComponent } from '../synth-panel/synth-panel.component';

/**
 * One deck's loops/cues faceplate: an engraved caption, the Add and Stop keys, and one
 * `MarkerRowComponent` per `model().rows` entry. The row list scrolls once the rows outgrow the
 * plate, and the plate fills its slot's height. Purely presentational and inert — the caller owns
 * every marker, every drag offset and every write. The keys carry no `data-control` anchor: Stop
 * here would collide with the transport's mappable `stop` on the same deck.
 *
 * The twelve row-level outputs arrive as one `rowAction` carrying the row's index, the same shape
 * as `LoopsCuesPanelComponent`.
 *
 * @example
 * ```html
 * <lib-loops-cues-plate
 *   [model]="loopsCuesModel()"
 *   (addMarker)="onAddMarker()"
 *   (stopLoop)="onStopLoop()"
 *   (rowAction)="onMarkerRowAction($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-loops-cues-plate',
  templateUrl: './loops-cues-plate.component.html',
  styleUrl: './loops-cues-plate.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SynthPanelComponent, SynthKeyComponent, MarkerRowComponent],
})
export class LoopsCuesPlateComponent {
  /** The plate's display model and state. */
  readonly model = input.required<LoopsCuesPanelModel>();
  /** Emits when the Add key is pressed. */
  readonly addMarker = output<void>();
  /** Emits when the Stop key is pressed. */
  readonly stopLoop = output<void>();
  /** Every row-level output re-emitted with the row's index in `model().rows`. */
  readonly rowAction = output<{ index: number; action: MarkerRowAction; value?: number }>();

  /** Re-packages one row's output with its own position in `model().rows`. */
  protected onRowAction(index: number, action: MarkerRowAction, value?: number): void {
    this.rowAction.emit({ index, action, value });
  }
}
