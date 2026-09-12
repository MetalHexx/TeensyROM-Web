import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MarkerRowComponent } from '../marker-row/marker-row.component';
import type { MarkerRowModel } from '../marker-row/marker-row.component';

/** Names one row-level control's emission, so the panel can re-emit all twelve through a single
 *  index-carrying output. `startNudgeInput`/`startNudgeCommit` and their `end` equivalents carry a
 *  frame offset in `value`; the rest carry none. */
export type MarkerRowAction =
  | 'trigger'
  | 'setEnd'
  | 'clearEnd'
  | 'delete'
  | 'startNudgeInput'
  | 'startNudgeCommit'
  | 'startSnapPrevious'
  | 'startSnapNext'
  | 'endNudgeInput'
  | 'endNudgeCommit'
  | 'endSnapPrevious'
  | 'endSnapNext';

/** One deck's whole loops/cues panel: its own accessible name, the header controls' names, and every
 *  marker row in render order. */
export interface LoopsCuesPanelModel {
  /** e.g. 'Loops/Cues deck A' — the panel section's own aria-label. */
  readonly accessibleName: string;
  readonly addAccessibleName: string;
  readonly stopAccessibleName: string;
  /** Rendered in this array's order, one `MarkerRowComponent` each. */
  readonly rows: readonly MarkerRowModel[];
}

/**
 * One deck's whole marker list: an Add/Stop header and one `MarkerRowComponent` per `model().rows`
 * entry. Purely presentational — it composes `MarkerRowComponent` and holds no state of its own; the
 * caller owns every drag offset, every frame/millisecond conversion and every write.
 *
 * The twelve row-level outputs arrive as one `rowAction` carrying the row's index rather than twelve
 * index-carrying outputs of their own: the row already names them, and re-declaring each here would
 * be a wall of forwarding with no added type safety.
 *
 * @example
 * ```html
 * <lib-loops-cues-panel
 *   [model]="loopsCuesModel()"
 *   [rowProgressPercents]="loopsCuesRowProgressPercents()"
 *   (addMarker)="onAddMarker()"
 *   (stopLoop)="onStopLoop()"
 *   (rowAction)="onMarkerRowAction($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-loops-cues-panel',
  templateUrl: './loops-cues-panel.component.html',
  styleUrl: './loops-cues-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MarkerRowComponent],
})
export class LoopsCuesPanelComponent {
  /** The loops/cues panel's display model and state. */
  readonly model = input.required<LoopsCuesPanelModel>();
  /** Index-aligned with `model().rows`, forwarded to each row's own `progressPercent`. Split out for
   *  the reason given on that input: this is the only per-animation-frame value in the panel, and it
   *  must not drag the whole row list's identity along with it. */
  readonly rowProgressPercents = input<readonly number[]>([]);
  /** Emits when the Add/Set marker button is pressed. */
  readonly addMarker = output<void>();
  /** Emits when the Stop loop button is pressed. */
  readonly stopLoop = output<void>();
  /** Every row-level output re-emitted with the row's index. */
  readonly rowAction = output<{ index: number; action: MarkerRowAction; value?: number }>();

  /** One row's progress percent, zero when `rowProgressPercents` is shorter than `model().rows` —
   *  the caller may hand over a model with no per-frame values beside it at all. */
  protected progressPercentAt(index: number): number {
    return this.rowProgressPercents()[index] ?? 0;
  }

  /** Re-packages one row's output with its own position in `model().rows`. */
  protected onRowAction(index: number, action: MarkerRowAction, value?: number): void {
    this.rowAction.emit({ index, action, value });
  }
}
