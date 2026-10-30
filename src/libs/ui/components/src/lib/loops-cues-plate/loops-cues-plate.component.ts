import { ChangeDetectionStrategy, Component, input, output, viewChild } from '@angular/core';
import {
  LoopSelectedRowComponent,
  type LoopBoundaryNudge,
  type LoopBoundarySnap,
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
  readonly addDisabled: boolean;
  readonly stopDisabled: boolean;
  /** Names the tile grid, e.g. 'Loops and cues, deck A'. */
  readonly gridAccessibleName: string;
  /** Shown in the grid's place when there are no tiles: no tune, or a tune with no markers. */
  readonly emptyText: string | null;
  readonly selected: LoopSelectedRowModel;
  readonly tiles: readonly LoopTileModel[];
}

/**
 * One deck's loops/cues faceplate: an engraved caption with the Add and Stop keys, the fixed
 * selected-loop row, and beneath it the scrolling tile grid, which takes the remaining height.
 * Purely presentational and inert — the caller owns every marker, every drag offset and every
 * write. The keys carry their own `data-control` ids (`loop-add`, `loop-stop`), distinct from the
 * transport's `stop`, so the mapping overlay resolves each to the right control. The running
 * tile's progress moves per animation frame, so a painter sets it through `setLiveProgress`
 * rather than an input.
 *
 * @example
 * ```html
 * <lib-loops-cues-plate
 *   [model]="plateModel()"
 *   (addMarker)="onAdd()"
 *   (stopLoop)="onStop()"
 *   (triggerTile)="onTrigger($event)"
 *   (playNowTile)="onPlayNow($event)"
 *   (playNowSelected)="onPlayNowSelected()"
 *   (toggleGlobal)="onToggleGlobal()"
 *   (selectTile)="onSelect($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-loops-cues-plate',
  templateUrl: './loops-cues-plate.component.html',
  styleUrl: './loops-cues-plate.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SynthPanelComponent, SynthKeyComponent, LoopSelectedRowComponent, LoopTileGridComponent],
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
  /** Emits when the Stop key is pressed. */
  readonly stopLoop = output<void>();
  /** Emits when the selected row's trigger key is pressed. */
  readonly toggleSelected = output<void>();
  /** Emits when the selected row's play-now key is pressed. */
  readonly playNowSelected = output<void>();
  /** Emits when the selected row's GBL switch is pressed. */
  readonly toggleGlobal = output<void>();
  /** Emits when the selected row's Set End key, in a cue's End slot, is pressed. */
  readonly setEnd = output<void>();
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
  /** Emits when a boundary's snap key is pressed, tagged with the boundary and direction. */
  readonly snap = output<LoopBoundarySnap>();
  /** Emits the new name when the selected row's name is renamed in place. */
  readonly rename = output<string>();

  private readonly grid = viewChild.required(LoopTileGridComponent);

  /** Sets the running tile's progress, 0–100, on the grid — straight on the DOM, outside change
   *  detection. Valid once the view has rendered. */
  setLiveProgress(percent: number): void {
    this.grid().setLiveProgress(percent);
  }
}
