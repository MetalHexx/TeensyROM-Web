import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** What the bar draws. `unknown` is a verdict (hatched: "we looked and found nothing"), `analyzing`
 *  a transient (dimmed: "nothing has been looked for yet"). Neither carries a tick. */
export type ScrubBarState =
  | { kind: 'analyzing' }
  | { kind: 'unknown' }
  | { kind: 'loop'; introPercent: number } // tick sits at introPercent; 0 means loop-from-top
  | { kind: 'ended'; musicPercent: number }; // no tick — there is no loop point

/**
 * A range input overlaid with colored regions and an optional tick. Purely presentational: it holds
 * no drag-pin state of its own, so `positionPercent` is whatever the caller decides to show — the
 * live playhead or a pinned drag value — and `scrubInput`/`scrubCommit` are the caller's only way to
 * find out what the operator did with the thumb.
 *
 * @example
 * ```html
 * <lib-scrub-position-bar
 *   [barState]="barState()"
 *   [positionPercent]="scrubDisplayPercent()"
 *   accessibleName="Position deck A"
 *   (scrubInput)="onScrubInput($event)"
 *   (scrubCommit)="onScrubCommit($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-scrub-position-bar',
  templateUrl: './scrub-position-bar.component.html',
  styleUrl: './scrub-position-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrubPositionBarComponent {
  /** What the bar draws: which regions render, and whether a loop tick appears. */
  readonly barState = input.required<ScrubBarState>();
  /** 0–100. The caller decides whether this is the live playhead or a pinned drag value. */
  readonly positionPercent = input.required<number>();
  /** Accessible label announced to assistive technology, e.g. 'Position deck A'. */
  readonly accessibleName = input.required<string>();
  /** Fires on every drag tick — for a live readout, not a seek. */
  readonly scrubInput = output<number>();
  /** Fires on release only. This is the one that should seek. */
  readonly scrubCommit = output<number>();

  /** The intro region's share of the bar, and the tick's left offset — 0 for a loop that repeats
   *  from the top. Zero outside the 'loop' state, where the template never reads it. */
  protected readonly introRegionPercent = computed<number>(() => {
    const state = this.barState();
    return state.kind === 'loop' ? state.introPercent : 0;
  });

  /** The music region's share of the bar: the loop case's remainder after the intro, or the ended
   *  case's own share. Zero outside those two states. */
  protected readonly musicRegionPercent = computed<number>(() => {
    const state = this.barState();
    if (state.kind === 'loop') return 100 - state.introPercent;
    if (state.kind === 'ended') return state.musicPercent;
    return 0;
  });

  /** The dead-tail region's share for an ended tune — the remainder after the music. Zero outside
   *  'ended', where the template never reads it. */
  protected readonly deadRegionPercent = computed<number>(() => {
    const state = this.barState();
    return state.kind === 'ended' ? 100 - state.musicPercent : 0;
  });

  /** Forwards every drag tick as a live readout — never a seek. */
  protected onInput(event: Event): void {
    this.scrubInput.emit(Number((event.target as HTMLInputElement).value));
  }

  /** Forwards the release value only — the one the caller should seek to. */
  protected onChange(event: Event): void {
    this.scrubCommit.emit(Number((event.target as HTMLInputElement).value));
  }
}
