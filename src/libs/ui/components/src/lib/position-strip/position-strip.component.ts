import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { ScrubBarState } from '../scrub-position-bar/scrub-position-bar.component';

/** One loop bracket or cue tick drawn in the strip's marks lane. */
export interface PositionMark {
  readonly id: string;
  readonly kind: 'loop' | 'cue';
  /** 0–100 across the track. */
  readonly startPercent: number;
  /** 0–100; loops only. */
  readonly endPercent: number | null;
  readonly activity: 'idle' | 'queued' | 'running';
  readonly selected: boolean;
}

/** A mark with its position held to 0–100, ready to draw. */
interface DrawnMark {
  readonly mark: PositionMark;
  readonly left: number;
  /** A loop's bracket width; `null` for a cue. */
  readonly width: number | null;
}

const clampPercent = (value: number): number =>
  Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

/**
 * One continuous bar, lit from the start up to the position, with a loop mark and a playhead, over
 * a native range input that does the scrubbing. Same contract as `lib-scrub-position-bar`, new
 * look: the range is stretched over the whole strip and made see-through by styling, so a click
 * anywhere, a drag, the arrow keys, Home and End all work as they do on any slider. The range is
 * continuous (`step="any"`), so drag values are fractional percents and nothing rounds them on the
 * way to the bar. Purely presentational: it holds no drag-pin state, so `positionPercent` is
 * whatever the caller decides to show — the live playhead or a pinned drag value.
 *
 * Given `marks` (even an empty list) it reserves a lane above the strip and draws a bracket per
 * loop and a tick per cue. The lane ignores the pointer and is hidden from assistive technology;
 * the range keeps every pointer and keyboard interaction. With `marks` null nothing is added.
 *
 * @example
 * ```html
 * <lib-position-strip
 *   [barState]="barState()"
 *   [positionPercent]="scrubDisplayPercent()"
 *   accessibleName="Position deck A"
 *   valueText="01:23.4 of 03:12"
 *   (scrubInput)="onScrubInput($event)"
 *   (scrubCommit)="onScrubCommit($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-position-strip',
  templateUrl: './position-strip.component.html',
  styleUrl: './position-strip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-marks]': 'marks() !== null ? "" : null',
  },
})
export class PositionStripComponent {
  /** What the strip draws: how the bar is coloured and whether a loop mark appears. */
  readonly barState = input.required<ScrubBarState>();
  /** 0–100. The caller decides whether this is the live playhead or a pinned drag value. */
  readonly positionPercent = input.required<number>();
  /** Accessible label announced to assistive technology, e.g. 'Position deck A'. */
  readonly accessibleName = input.required<string>();
  /** The range's `aria-valuetext`, e.g. '01:23.4 of 03:12' — caller-composed, so it says the
   *  position as time rather than as a percentage. */
  readonly valueText = input<string | null>(null);
  /** Loop brackets and cue ticks for the marks lane. `null` reserves no lane; an array, even an
   *  empty one, does. Changes rarely — the playhead is `positionPercent`, not this. */
  readonly marks = input<readonly PositionMark[] | null>(null);
  /** Fires on every drag tick — a live preview, never a seek. */
  readonly scrubInput = output<number>();
  /** Fires on release only. This is the one that should seek. */
  readonly scrubCommit = output<number>();

  /** The playhead position as a percentage, held to 0–100; 0 when not finite. */
  protected readonly clampedPercent = computed<number>(() => {
    const percent = this.positionPercent();
    return Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  });

  /** The marks held to 0–100, a loop's end never before its start. */
  protected readonly drawnMarks = computed<readonly DrawnMark[]>(() =>
    (this.marks() ?? []).map((mark) => {
      const left = clampPercent(mark.startPercent);
      const width =
        mark.kind === 'loop' ? Math.max(0, clampPercent(mark.endPercent ?? left) - left) : null;
      return { mark, left, width };
    })
  );

  /** Where the loop mark sits, or `null` outside the 'loop' state. 0 means loop-from-top. */
  protected readonly loopMarkPercent = computed<number | null>(() => {
    const state = this.barState();
    return state.kind === 'loop' ? state.introPercent : null;
  });

  /** Where the lit bar changes colour, as a percentage of the whole strip, or `null` when it is
   *  one colour throughout: the intro point of a loop, the end of the music of an ended tune. */
  private readonly toneSplitPercent = computed<number | null>(() => {
    const state = this.barState();
    switch (state.kind) {
      case 'loop':
        return state.introPercent;
      case 'ended':
        return state.musicPercent;
      default:
        return null;
    }
  });

  /** The colour change as a percentage of the lit bar's own width (the bar is only as long as the
   *  position), held to 0–100. 100 puts it past the end, so the bar is its first colour only. */
  protected readonly fillSplit = computed<string>(() => {
    const split = this.toneSplitPercent();
    const position = this.clampedPercent();
    if (split === null || position <= 0) {
      return '100%';
    }
    return `${Math.min(100, Math.max(0, (split / position) * 100))}%`;
  });

  /** Forwards every drag tick as a live preview — never a seek. */
  protected onInput(event: Event): void {
    this.scrubInput.emit(Number((event.target as HTMLInputElement).value));
  }

  /** Forwards the release value only — the one the caller should seek to. */
  protected onChange(event: Event): void {
    this.scrubCommit.emit(Number((event.target as HTMLInputElement).value));
  }
}
