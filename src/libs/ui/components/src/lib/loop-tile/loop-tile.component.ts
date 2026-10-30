import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { LiveProgressIndicator } from '../shared/live-indicator';
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
  /** The marker keeps its own settings: draws the dot. */
  readonly ownSettings: boolean;
  /** Names the play-now key; the caller composes it. */
  readonly playNowAccessibleName: string;
}

/**
 * A compact loop or cue tile: a trigger key whose state light shows idle, queued or running, a
 * one-shot play-now key, and a select button over the name, the length and the tile's own small
 * timeline. Purely presentational: it computes no time or percentage and the caller supplies every
 * label.
 *
 * A loop's timeline fills, with a playhead, while running; a cue draws a single magenta tick. How
 * far it fills is `--loop-tile-progress`, a percentage: a painter sets it as the running loop's lap
 * moves through `setLiveProgress`, which writes it straight on the timeline, so the lap never
 * passes through an input and restyles only the fill and the playhead, which move by `scale` and
 * `translate` alone. Until then the tile inherits it, so a caller can also set it above the tile.
 * A selected tile carries `aria-current` and a cyan ring. A small lit dot beside the name
 * marks a marker that keeps its own settings; it is decorative, so the caller puts the same fact
 * into `selectAccessibleName`.
 *
 * @example
 * ```html
 * <lib-loop-tile
 *   [model]="tile"
 *   style="--loop-tile-progress: 53%"
 *   (trigger)="onTrigger(tile.id)"
 *   (playNow)="onPlayNow(tile.id)"
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
export class LoopTileComponent implements LiveProgressIndicator {
  /** The tile's state. */
  readonly model = input.required<LoopTileModel>();
  /** Emits when the trigger key is pressed. */
  readonly trigger = output<void>();
  /** Emits when the play-now key is pressed. */
  readonly playNow = output<void>();
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

  private readonly timeline = viewChild.required<ElementRef<HTMLElement>>('timeline');
  /** The progress as last set; null until it is, so an inherited one shows. */
  private liveProgress: number | null = null;

  /** Sets how far a running loop's timeline fills, 0–100: held to that range, and 0 when not a
   *  number. Writes `--loop-tile-progress` on the timeline directly — no signal, no change
   *  detection — and only when it changed. Valid once the view has rendered. */
  setLiveProgress(percent: number): void {
    const clamped = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
    if (clamped === this.liveProgress) {
      return;
    }
    this.liveProgress = clamped;
    this.timeline().nativeElement.style.setProperty('--loop-tile-progress', `${clamped}%`);
  }
}
