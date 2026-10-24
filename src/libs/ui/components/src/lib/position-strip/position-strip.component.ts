import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { ScrubBarState } from '../scrub-position-bar/scrub-position-bar.component';

/** What a segment is coloured as when lit. `dim` is both an ended tune's dead tail and every
 *  segment of a deck that is still analyzing. */
type SegmentTone = 'intro' | 'music' | 'dim';

/**
 * A row of lit segments with a loop mark and a playhead, over a native range input that does the
 * scrubbing. Same contract as `lib-scrub-position-bar`, new look: the range is stretched over the
 * whole strip and made see-through by styling, so a click anywhere, a drag, the arrow keys, Home
 * and End all work as they do on any slider. Purely presentational: it holds no drag-pin state, so
 * `positionPercent` is whatever the caller decides to show — the live playhead or a pinned drag
 * value.
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
})
export class PositionStripComponent {
  /** What the strip draws: how the segments are coloured and whether a loop mark appears. */
  readonly barState = input.required<ScrubBarState>();
  /** 0–100. The caller decides whether this is the live playhead or a pinned drag value. */
  readonly positionPercent = input.required<number>();
  /** Accessible label announced to assistive technology, e.g. 'Position deck A'. */
  readonly accessibleName = input.required<string>();
  /** The range's `aria-valuetext`, e.g. '01:23.4 of 03:12' — caller-composed, so it says the
   *  position as time rather than as a percentage. */
  readonly valueText = input<string | null>(null);
  /** How many segments the strip is divided into. */
  readonly segments = input<number>(60);
  /** Fires on every drag tick — a live preview, never a seek. */
  readonly scrubInput = output<number>();
  /** Fires on release only. This is the one that should seek. */
  readonly scrubCommit = output<number>();

  /** The playhead position as a percentage, held to 0–100; 0 when not finite. */
  protected readonly clampedPercent = computed<number>(() => {
    const percent = this.positionPercent();
    return Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  });

  /** `segments` rounded to a whole number, never below one. */
  private readonly segmentCount = computed<number>(() => Math.max(1, Math.round(this.segments())));

  /** How many segments, from the left, are lit for the current position. */
  protected readonly litCount = computed<number>(() =>
    Math.round((this.clampedPercent() / 100) * this.segmentCount())
  );

  /** Where the loop mark sits, or `null` outside the 'loop' state. 0 means loop-from-top. */
  protected readonly loopMarkPercent = computed<number | null>(() => {
    const state = this.barState();
    return state.kind === 'loop' ? state.introPercent : null;
  });

  /** Each segment's tone once lit, decided by where its centre falls against the state's split. */
  protected readonly segmentTones = computed<readonly SegmentTone[]>(() => {
    const count = this.segmentCount();
    const state = this.barState();
    return Array.from({ length: count }, (_, index): SegmentTone => {
      const centre = ((index + 0.5) / count) * 100;
      switch (state.kind) {
        case 'loop':
          return centre < state.introPercent ? 'intro' : 'music';
        case 'ended':
          return centre < state.musicPercent ? 'music' : 'dim';
        case 'unknown':
          return 'music';
        case 'analyzing':
          return 'dim';
      }
    });
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
