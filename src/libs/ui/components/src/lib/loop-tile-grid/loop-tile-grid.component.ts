import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChildren,
} from '@angular/core';
import { LoopTileComponent, type LoopTileModel } from '../loop-tile/loop-tile.component';
import type { LiveProgressIndicator } from '../shared/live-indicator';

/**
 * Two columns of `lib-loop-tile`, scrolling vertically inside whatever height its parent gives it.
 * Purely presentational: the caller supplies every tile model and the running tile's progress.
 *
 * The running tile's progress moves per animation frame, so it is not an input: a painter sets it
 * through `setLiveProgress`, which hands it to the running tile alone — never to the grid's host,
 * where every tile would restyle with it — and to a tile as it starts running. Until it is set the
 * tiles inherit `--loop-tile-progress`, so a caller can set it above the grid. When the selected
 * tile changes it is scrolled into
 * view (`block: 'nearest'`); other model changes never scroll. With no tiles the grid shows
 * `emptyText`, if given.
 *
 * @example
 * ```html
 * <lib-loop-tile-grid
 *   [tiles]="tiles()"
 *   accessibleName="Loops and cues, deck A"
 *   emptyText="No loops or cues yet"
 *   (triggerTile)="onTrigger($event)"
 *   (playNowTile)="onPlayNow($event)"
 *   (selectTile)="onSelect($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-loop-tile-grid',
  imports: [LoopTileComponent],
  templateUrl: './loop-tile-grid.component.html',
  styleUrl: './loop-tile-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoopTileGridComponent implements LiveProgressIndicator {
  /** The tiles, in display order. */
  readonly tiles = input.required<readonly LoopTileModel[]>();
  /** Names the list, e.g. 'Loops and cues, deck A'. */
  readonly accessibleName = input.required<string>();
  /** Shown in place of the list when there are no tiles; `null` shows nothing. */
  readonly emptyText = input<string | null>(null);
  /** Emits the tile's id when its trigger key is pressed. */
  readonly triggerTile = output<string>();
  /** Emits the tile's id when its play-now key is pressed. */
  readonly playNowTile = output<string>();
  /** Emits the tile's id when its select button is pressed. */
  readonly selectTile = output<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  private readonly selectedId = computed(
    () => this.tiles().find((tile) => tile.selected)?.id ?? null
  );

  private readonly tileViews = viewChildren(LoopTileComponent);
  /** The tile drawn running — the only one that shows the progress — or null. */
  private readonly runningTile = computed(
    () => this.tileViews().find((tile) => tile.model().activity === 'running') ?? null
  );

  /** The running tile's progress as last set; null until it is. */
  private liveProgress: number | null = null;

  constructor() {
    effect(() => {
      if (this.selectedId() === null) return;
      afterNextRender(() => this.scrollSelectedIntoView(), { injector: this.injector });
    });
    // A tile that starts running takes the progress as last set.
    afterRenderEffect({
      write: () => {
        const tile = this.runningTile();
        const progress = this.liveProgress;
        if (tile !== null && progress !== null) {
          untracked(() => tile.setLiveProgress(progress));
        }
      },
    });
  }

  /** Sets the running tile's progress, 0–100 — the tile holds it to that range — straight on its
   *  timeline: no signal, no change detection, and nothing written when it did not change. */
  setLiveProgress(percent: number): void {
    this.liveProgress = percent;
    this.runningTile()?.setLiveProgress(percent);
  }

  private scrollSelectedIntoView(): void {
    const item = this.host.nativeElement.querySelector<HTMLElement>('[role="listitem"][data-selected]');
    if (typeof item?.scrollIntoView === 'function') {
      item.scrollIntoView({ block: 'nearest' });
    }
  }
}
