import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * The fader and its two end labels only — no per-deck gain fader, no curve selector, no curve
 * preview, and no numeric readout of the resulting register value. Purely presentational: it holds
 * no local copy of its value and never re-rounds what it reads off the native range input.
 *
 * @example
 * ```html
 * <lib-crossfader
 *   [value]="position()"
 *   startLabel="A"
 *   endLabel="B"
 *   accessibleName="Crossfader, deck A to deck B"
 *   (valueChange)="onPositionChange($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-crossfader',
  templateUrl: './crossfader.component.html',
  styleUrl: './crossfader.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--crossfader-track-length]': 'trackLength()',
    '[attr.data-fixed-track]': "trackLength() !== null ? '' : null",
  },
})
export class CrossfaderComponent {
  /** The fader's current position, between `min()` and `max()`. */
  readonly value = input.required<number>();
  /** e.g. 'A' — the label rendered at the fader's minimum end. */
  readonly startLabel = input.required<string>();
  /** e.g. 'B' — the label rendered at the fader's maximum end. */
  readonly endLabel = input.required<string>();
  /** Accessible label announced to assistive technology, e.g. 'Crossfader, deck A to deck B'. */
  readonly accessibleName = input.required<string>();
  /** Minimum of the fader's range. Defaults to `-1`. */
  readonly min = input<number>(-1);
  /** Maximum of the fader's range. Defaults to `1`. */
  readonly max = input<number>(1);
  /** Granularity of the native range input. Defaults to `0.01`. */
  readonly step = input<number>(0.01);
  /** A CSS length for the track's own extent. When set, the two deck-letter labels move above the
   *  track (`.crossfader-labels`) so the track itself can claim the card's full content width, and
   *  the track stops growing with `flex: 1 1 auto`, pinned instead to this length. `null` (the
   *  default) keeps today's row layout: inline labels and a track that grows with its container. */
  readonly trackLength = input<string | null>(null);
  /** Emits the raw numeric value read off the native range input, unrounded. */
  readonly valueChange = output<number>();

  /** `step` is the input's own granularity; the model stores whatever value arrives and never
   *  re-rounds it. */
  protected onInput(event: Event): void {
    this.valueChange.emit(Number((event.target as HTMLInputElement).value));
  }
}
