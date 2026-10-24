import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * A vertical fader drawn as hardware: a dark slot, tick marks, an optional magenta home line and a
 * cap with a white line. It is still a native range input — drag and the arrow keys work as on
 * `lib-channel-fader` — and the hardware is painted on the range itself and on non-interactive
 * siblings behind it, so the control stays visible and focusable to assistive technology. Purely
 * presentational: it holds no local copy of its value and never re-rounds what the range reports.
 *
 * Like `lib-channel-fader` this is Chrome/Edge territory (`writing-mode` on a range input).
 *
 * @example
 * ```html
 * <lib-synth-fader
 *   [value]="speed()"
 *   [min]="0.25" [max]="4" [step]="0.001" [home]="1"
 *   accessibleName="Speed multiplier deck A"
 *   (valueChange)="onSpeed($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-synth-fader',
  templateUrl: './synth-fader.component.html',
  styleUrl: './synth-fader.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-disabled]': "disabled() ? '' : null",
  },
})
export class SynthFaderComponent {
  /** The fader's current position, between `min()` and `max()`. */
  readonly value = input.required<number>();
  /** Minimum of the range. Defaults to `0`. */
  readonly min = input<number>(0);
  /** Maximum of the range. Defaults to `1`. */
  readonly max = input<number>(1);
  /** Granularity of the native range. Defaults to `0.01`. */
  readonly step = input<number>(0.01);
  /** Draws the home line at this value; it is a mark only, with no detent. `null` draws none. */
  readonly home = input<number | null>(null);
  /** Accessible name announced for the range, e.g. 'Speed multiplier deck A'. */
  readonly accessibleName = input.required<string>();
  /** Disables the range and dims the fader; it emits nothing while disabled. Defaults to false. */
  readonly disabled = input<boolean>(false);
  /** Emits the raw numeric value read off the native range, unrounded. */
  readonly valueChange = output<number>();

  /** The home line's position along the travel, 0 (bottom) to 1 (top), clamped; `null` for none. */
  protected readonly homeFraction = computed<number | null>(() => {
    const home = this.home();
    const span = this.max() - this.min();
    if (home === null || span <= 0) {
      return null;
    }
    return Math.min(1, Math.max(0, (home - this.min()) / span));
  });

  /** Forwards the range input's new value as `valueChange`; ignored while disabled. */
  protected onInput(event: Event): void {
    if (this.disabled()) {
      return;
    }
    this.valueChange.emit(Number((event.target as HTMLInputElement).value));
  }
}
