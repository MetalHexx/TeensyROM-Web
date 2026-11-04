import { ChangeDetectionStrategy, Component, input, output, viewChild } from '@angular/core';
import { LiveLoopRowComponent, type LiveLoopRowModel } from '../live-loop-row/live-loop-row.component';
import {
  LoopSelectedRowComponent,
  type LoopBoundaryNudge,
  type LoopEdgeMove,
  type LoopMoveStepOptionModel,
  type LoopSelectedRowModel,
} from '../loop-selected-row/loop-selected-row.component';
import { LoopTileGridComponent } from '../loop-tile-grid/loop-tile-grid.component';
import type { LoopTileModel } from '../loop-tile/loop-tile.component';
import type { LiveProgressIndicator } from '../shared/live-indicator';
import { SynthKeyComponent } from '../synth-key/synth-key.component';
import { SynthPanelComponent } from '../synth-panel/synth-panel.component';

/** Everything the loops/cues plate draws, caller-composed. */
export interface LoopsCuesPlateModel {
  /** The section's own aria-label, e.g. 'Loops/Cues deck A'. */
  readonly accessibleName: string;
  readonly addAccessibleName: string;
  readonly stopAccessibleName: string;
  readonly duplicateAccessibleName: string;
  readonly addDisabled: boolean;
  /** True with nothing selected or no tune to shape. */
  readonly duplicateDisabled: boolean;
  readonly stopDisabled: boolean;
  /** Names the tile grid, e.g. 'Loops and cues, deck A'. */
  readonly gridAccessibleName: string;
  /** Shown in the grid's place when there are no tiles: no tune, or a tune with no markers. */
  readonly emptyText: string | null;
  /** The live loop row above the selected row. */
  readonly live: LiveLoopRowModel;
  readonly selected: LoopSelectedRowModel;
  readonly tiles: readonly LoopTileModel[];
}

/**
 * One deck's loops/cues faceplate: an engraved caption with the Add, Duplicate and Stop keys, the live loop
 * row (Live loop, SIZE, SLIP), the fixed selected-loop row, and beneath it the scrolling tile grid, which takes the remaining height.
 * Purely presentational and inert — the caller owns every marker, every drag offset and every
 * write. The keys carry their own `data-control` ids (`loop-add`, `loop-duplicate`, `loop-stop`), distinct from the
 * transport's `stop`, so the mapping overlay resolves each to the right control. The live loop row's
 * keys are `live-loop`, `live-loop-halve`, `live-loop-double`, `live-loop-size` and `slip`. The selected row's
 * In and Out keys are `loop-in` and `loop-set-end`, the Length readout `loop-length`, the Move keys
 * `loop-move-earlier` and `loop-move-later`, and the step readout `loop-move-step`; the boundaries'
 * edge-move arrows sit under `loop-start` and `loop-end` as `move-earlier` and `move-later` parts. The running
 * tile's progress moves per animation frame, so a painter sets it through `setLiveProgress`
 * rather than an input.
 *
 * @example
 * ```html
 * <lib-loops-cues-plate
 *   [model]="plateModel()"
 *   (addMarker)="onAdd()"
 *   (duplicateMarker)="onDuplicate()"
 *   (stopLoop)="onStop()"
 *   (toggleLiveLoop)="onToggleLiveLoop()"
 *   (endLiveLoop)="onEndLiveLoop()"
 *   (halveLiveLoop)="onHalveLiveLoop()"
 *   (doubleLiveLoop)="onDoubleLiveLoop()"
 *   (pickLiveLoopSize)="onPickLiveLoopSize($event)"
 *   (liveLoopSizeWheel)="onLiveLoopSizeWheel($event)"
 *   (toggleSlip)="onToggleSlip()"
 *   (triggerTile)="onTrigger($event)"
 *   (playNowTile)="onPlayNow($event)"
 *   (playNowSelected)="onPlayNowSelected()"
 *   (toggleGlobal)="onToggleGlobal()"
 *   (toggleWrap)="onToggleWrap()"
 *   (setIn)="onSetIn()"
 *   (setOut)="onSetOut()"
 *   (halve)="onHalve()"
 *   (double)="onDouble()"
 *   (pickLength)="onPickLength($event)"
 *   (moveEarlier)="onMoveEarlier()"
 *   (moveLater)="onMoveLater()"
 *   (pickMoveStep)="onPickMoveStep($event)"
 *   (moveEdge)="onMoveEdge($event)"
 *   (selectTile)="onSelect($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-loops-cues-plate',
  templateUrl: './loops-cues-plate.component.html',
  styleUrl: './loops-cues-plate.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SynthPanelComponent,
    SynthKeyComponent,
    LiveLoopRowComponent,
    LoopSelectedRowComponent,
    LoopTileGridComponent,
  ],
})
export class LoopsCuesPlateComponent implements LiveProgressIndicator {
  /** The plate's display model and state. */
  readonly model = input.required<LoopsCuesPlateModel>();
  /** While non-null, the selected loop's Start boundary follows it. */
  readonly startDragOffset = input<number | null>(null);
  /** While non-null, the selected loop's End boundary follows it. */
  readonly endDragOffset = input<number | null>(null);
  /** Emits when the Add key is pressed. */
  readonly addMarker = output<void>();
  /** Emits when the Duplicate key is pressed. */
  readonly duplicateMarker = output<void>();
  /** Emits when the Stop key is pressed. */
  readonly stopLoop = output<void>();
  /** Emits when the Live loop key goes down. */
  readonly toggleLiveLoop = output<void>();
  /** Emits when a Live loop press that started the loop is released after a hold. */
  readonly endLiveLoop = output<void>();
  /** Emits when the live loop's ½ key is pressed. */
  readonly halveLiveLoop = output<void>();
  /** Emits when the live loop's 2× key is pressed. */
  readonly doubleLiveLoop = output<void>();
  /** Emits the size picked in the live loop's picker, in beats. */
  readonly pickLiveLoopSize = output<number>();
  /** Emits whole wheel clicks over the live loop's size readout, upward positive. */
  readonly liveLoopSizeWheel = output<{ clicks: number; timeStampMs: number }>();
  /** Emits when the SLIP key is pressed. */
  readonly toggleSlip = output<void>();
  /** Emits when the selected row's trigger key is pressed. */
  readonly toggleSelected = output<void>();
  /** Emits when the selected row's play-now key is pressed. */
  readonly playNowSelected = output<void>();
  /** Emits when the selected row's GBL switch is pressed. */
  readonly toggleGlobal = output<void>();
  /** Emits when the selected row's WRAP switch is pressed. */
  readonly toggleWrap = output<void>();
  /** Emits when the selected row's In key is pressed. */
  readonly setIn = output<void>();
  /** Emits when the selected row's Out key is pressed. */
  readonly setOut = output<void>();
  /** Emits when the selected row's ½ key is pressed. */
  readonly halve = output<void>();
  /** Emits when the selected row's 2× key is pressed. */
  readonly double = output<void>();
  /** Emits the size picked in the selected row's Length picker, in beats. */
  readonly pickLength = output<number>();
  /** Emits when the selected row's Move earlier key is pressed. */
  readonly moveEarlier = output<void>();
  /** Emits when the selected row's Move later key is pressed. */
  readonly moveLater = output<void>();
  /** Emits the step picked in the selected row's Move step picker: beats, or `'frame'`. */
  readonly pickMoveStep = output<LoopMoveStepOptionModel['beats']>();
  /** Emits when the selected row's Clear End key is pressed. */
  readonly clearEnd = output<void>();
  /** Emits when the selected row's Delete key is pressed. */
  readonly deleteSelected = output<void>();
  /** Emits a tile's id when its trigger key is pressed. */
  readonly triggerTile = output<string>();
  /** Emits a tile's id when its play-now key is pressed. */
  readonly playNowTile = output<string>();
  /** Emits a tile's id when its select button is pressed. */
  readonly selectTile = output<string>();
  /** Fires on every nudge drag tick, tagged with the boundary — readout only. */
  readonly nudgeInput = output<LoopBoundaryNudge>();
  /** Fires when a nudge is released, tagged with the boundary. */
  readonly nudgeCommit = output<LoopBoundaryNudge>();
  /** Emits when a boundary's edge-move arrow is pressed, tagged with the boundary and direction. */
  readonly moveEdge = output<LoopEdgeMove>();
  /** Emits the new name and the id of the marker it was opened on when the selected row's name is renamed in place. */
  readonly rename = output<{ id: string; name: string }>();

  private readonly grid = viewChild.required(LoopTileGridComponent);

  /** Sets the running tile's progress, 0–100, on the grid — straight on the DOM, outside change
   *  detection. Valid once the view has rendered. */
  setLiveProgress(percent: number): void {
    this.grid().setLiveProgress(percent);
  }
}
