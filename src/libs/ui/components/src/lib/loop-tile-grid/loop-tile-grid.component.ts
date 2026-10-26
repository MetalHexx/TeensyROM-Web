import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { LoopTileComponent, type LoopTileModel } from '../loop-tile/loop-tile.component';

/**
 * Two columns of `lib-loop-tile`, scrolling vertically inside whatever height its parent gives it.
 * Purely presentational: the caller supplies every tile model and the running tile's progress.
 *
 * `runningProgressPercent` feeds only the tile whose activity is `running`. When the selected tile
 * changes it is scrolled into view (`block: 'nearest'`); other model changes never scroll. With no
 * tiles the grid shows `emptyText`, if given.
 *
 * @example
 * ```html
 * <lib-loop-tile-grid
 *   [tiles]="tiles()"
 *   [runningProgressPercent]="progress()"
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
export class LoopTileGridComponent {
  /** The tiles, in display order. */
  readonly tiles = input.required<readonly LoopTileModel[]>();
  /** 0–100; reaches only the running tile. */
  readonly runningProgressPercent = input<number>(0);
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

  constructor() {
    effect(() => {
      if (this.selectedId() === null) return;
      afterNextRender(() => this.scrollSelectedIntoView(), { injector: this.injector });
    });
  }

  private scrollSelectedIntoView(): void {
    const item = this.host.nativeElement.querySelector<HTMLElement>('[role="listitem"][data-selected]');
    if (typeof item?.scrollIntoView === 'function') {
      item.scrollIntoView({ block: 'nearest' });
    }
  }
}
