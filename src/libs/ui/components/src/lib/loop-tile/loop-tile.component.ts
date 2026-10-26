import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SynthKeyComponent } from '../synth-key/synth-key.component';

/** Whether a loop or cue is idle, queued to fire at the next boundary, or running now. */
export type LoopTileActivity = 'idle' | 'queued' | 'running';

/** One loop or cue tile's caller-composed state. */
export interface LoopTileModel {
  readonly id: string;
  /** e.g. 'Item 3'. */
  readonly name: string;
  readonly kind: 'loop' | 'cue';
  /** e.g. '7.8s', or 'CUE'. */
  readonly lengthText: string;
  readonly activity: LoopTileActivity;
  readonly selected: boolean;
  /** False while the loop's audio is not yet prepared; the timeline is drawn dashed and dim. */
  readonly ready: boolean;
  /** Names the trigger key; the caller composes it. */
  readonly triggerAccessibleName: string;
  /** Names the select button and carries kind, length and state in words, e.g. 'not ready'. */
  readonly selectAccessibleName: string;
}

/**
 * A compact loop or cue tile: a trigger key whose state light shows idle, queued or running, and a
 * select button over the name, the length and the tile's own small timeline. Purely presentational:
 * it computes no time or percentage and the caller supplies every label.
 *
 * A loop's timeline fills to `progressPercent` with a playhead while running; a cue draws a single
 * magenta tick. A selected tile carries `aria-current` and a cyan ring.
 *
 * @example
 * ```html
 * <lib-loop-tile
 *   [model]="tile"
 *   [progressPercent]="53"
 *   (trigger)="onTrigger(tile.id)"
 *   (selectTile)="onSelect(tile.id)"
 * />
 * ```
 */
@Component({
  selector: 'lib-loop-tile',
  imports: [SynthKeyComponent],
  templateUrl: './loop-tile.component.html',
  styleUrl: './loop-tile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-activity]': 'model().activity',
    '[attr.data-kind]': 'model().kind',
    '[attr.data-selected]': 'model().selected ? "" : null',
    '[attr.data-ready]': 'model().ready',
  },
})
export class LoopTileComponent {
  /** The tile's state. */
  readonly model = input.required<LoopTileModel>();
  /** 0–100; drawn only while the tile is running. */
  readonly progressPercent = input<number>(0);
  /** Emits when the trigger key is pressed. */
  readonly trigger = output<void>();
  /** Emits when the select button is pressed. */
  readonly selectTile = output<void>();

  protected readonly stateLight = computed(() => {
    switch (this.model().activity) {
      case 'running':
        return 'playing';
      case 'queued':
        return 'paused';
      default:
        return 'off';
    }
  });

  protected readonly clampedProgress = computed(() => Math.min(100, Math.max(0, this.progressPercent())));
}
