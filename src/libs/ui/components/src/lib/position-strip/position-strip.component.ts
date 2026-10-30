import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { ScrubBarState } from '../scrub-position-bar/scrub-position-bar.component';
import type { LivePositionIndicator } from '../shared/live-indicator';

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

/** `percent` on the nearest of `pixels` steps across the track, held to 0–100; as it is while the
 *  track is unmeasured (`pixels` 0). */
function onPixel(percent: number, pixels: number): number {
  return pixels > 0 ? Math.min(100, (Math.round((percent * pixels) / 100) * 100) / pixels) : percent;
}

/**
 * One continuous bar, lit from the start up to the position, with a loop mark and a playhead, over
 * a native range input that does the scrubbing. Same contract as `lib-scrub-position-bar`, new
 * look: the range is stretched over the whole strip and made see-through by styling, so a click
 * anywhere, a drag, the arrow keys, Home and End all work as they do on any slider. The range is
 * continuous (`step="any"`), so drag values are fractional percents and nothing rounds them on the
 * way to the bar. Purely presentational: it holds no drag-pin state, so the position is whatever
 * the caller decides to show — the live playhead or a pinned drag value.
 *
 * The position and the range's value text move with the playhead, so they are not inputs: a
 * painter sets them through `setLivePosition` and `setLiveValueText`, straight on the DOM and
 * outside change detection. The position moves in whole device pixels of the track, so a long tune
 * redraws the bar a few times a second rather than on every paint. The lit bar and the playhead
 * read it from the track's `--playhead-position`, so a bar redrawn for a new state picks it up as
 * it is drawn, and they move by `scale` and `translate` alone: a new position restyles only them
 * and lays nothing out.
 *
 * Given `marks` (even an empty list) it reserves a lane above the strip and draws a bracket per
 * loop and a tick per cue. The lane ignores the pointer and is hidden from assistive technology;
 * the range keeps every pointer and keyboard interaction. With `marks` null nothing is added.
 *
 * @example
 * ```html
 * <lib-position-strip
 *   [barState]="barState()"
 *   accessibleName="Position deck A"
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
export class PositionStripComponent implements LivePositionIndicator {
  /** What the strip draws: how the bar is coloured and whether a loop mark appears. */
  readonly barState = input.required<ScrubBarState>();
  /** Accessible label announced to assistive technology, e.g. 'Position deck A'. */
  readonly accessibleName = input.required<string>();
  /** Loop brackets and cue ticks for the marks lane. `null` reserves no lane; an array, even an
   *  empty one, does. Changes rarely — the playhead is `setLivePosition`'s, not this. */
  readonly marks = input<readonly PositionMark[] | null>(null);
  /** A finger is on this deck's record: the playhead turns the warning amber. */
  readonly held = input<boolean>(false);
  /** Fires on every drag tick — a live preview, never a seek. */
  readonly scrubInput = output<number>();
  /** Fires on release only. This is the one that should seek. */
  readonly scrubCommit = output<number>();

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

  private readonly destroyRef = inject(DestroyRef);
  private readonly range = viewChild.required<ElementRef<HTMLInputElement>>('range');
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  /** The position as last shown, held to 0–100. */
  private livePercent = 0;
  private liveValueText: string | null = null;
  /** The track's width in device pixels; 0 until it is measured. */
  private trackPixels = 0;

  /** The colour change moves with the bar's state as well as with the position. */
  constructor() {
    afterRenderEffect({ write: () => this.writeBar(this.toneSplitPercent()) });
    afterNextRender(() => this.observeTrack());
  }

  /** Sets the position, 0–100: held to that range, 0 when not a number, and put on the nearest
   *  device pixel of the track once it is measured. Writes the range's value and the track's
   *  `--playhead-position` and `--fill-split` directly — no signal, no change detection — and only
   *  when the shown position changed. Valid once the view has rendered. */
  setLivePosition(percent: number): void {
    const shown = onPixel(clampPercent(percent), this.trackPixels);
    if (shown === this.livePercent) {
      return;
    }
    this.livePercent = shown;
    this.range().nativeElement.value = String(shown);
    this.writeBar(this.toneSplitPercent());
  }

  /** Sets the range's `aria-valuetext`, e.g. '01:23.4 of 03:12', so it says the position as time
   *  rather than as a percentage. Written directly, and only when it changed. Valid once the view
   *  has rendered. */
  setLiveValueText(text: string): void {
    if (text === this.liveValueText) {
      return;
    }
    this.liveValueText = text;
    this.range().nativeElement.setAttribute('aria-valuetext', text);
  }

  /** Forwards every drag tick as a live preview — never a seek. */
  protected onInput(event: Event): void {
    this.scrubInput.emit(Number((event.target as HTMLInputElement).value));
  }

  /** Forwards the release value only — the one the caller should seek to. */
  protected onChange(event: Event): void {
    this.scrubCommit.emit(Number((event.target as HTMLInputElement).value));
  }

  /** The lit bar's length, and how far its first colour reaches — the colour change, never past
   *  the position — as custom properties on the track, both as shares of it. Only the few elements
   *  inside the track inherit them, and the bar and the playhead read them however often the bar's
   *  state redraws them. */
  private writeBar(split: number | null): void {
    const style = this.track().nativeElement.style;
    const position = this.livePercent;
    style.setProperty('--playhead-position', `${position}%`);
    style.setProperty(
      '--fill-split',
      `${split === null ? position : Math.min(clampPercent(split), position)}%`
    );
  }

  /** Keeps `trackPixels` to the track's width, where there is a `ResizeObserver` to say it. */
  private observeTrack(): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      this.trackPixels = Math.round(entry.contentRect.width * (globalThis.devicePixelRatio || 1));
    });
    observer.observe(this.track().nativeElement);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }
}
