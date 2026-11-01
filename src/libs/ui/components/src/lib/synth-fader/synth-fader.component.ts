import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** A pause this long between wheel events ends the gesture; a partial click does not outlast it. */
const WHEEL_IDLE_MS = 250;

/**
 * A vertical fader drawn as hardware: a dark slot, tick marks, an optional magenta home line and a
 * cap with a white line. It is still a native range input — drag and the arrow keys work as on
 * `lib-channel-fader` — and the hardware is painted on the range itself and on non-interactive
 * siblings behind it, so the control stays visible and focusable to assistive technology. Purely
 * presentational: it holds no local copy of its value and never re-rounds what the range reports.
 *
 * Wheel turns over the fader are reported as whole clicks with their times and never applied here,
 * and a double-click returns it to `home()`; the caller decides what a click is worth.
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
  /** Text announced for the range in place of its number, e.g. '+1.25%'. `null` announces the
   *  number. */
  readonly valueText = input<string | null>(null);
  /** Emits the raw numeric value read off the native range, unrounded. */
  readonly valueChange = output<number>();
  /** Emits whole wheel clicks over the fader, upward positive, with the event's `timeStamp`. The
   *  page does not scroll while the fader is enabled; nothing is emitted while disabled. */
  readonly wheelTurn = output<{ clicks: number; timeStampMs: number }>();

  /** Wheel delta not yet worth a whole click, carried between events of one gesture. */
  private wheelRemainder = 0;
  private lastWheelMs: number | null = null;

  /** The home line's position along the travel, 0 (bottom) to 1 (top), clamped; `null` for none. */
  protected readonly homeFraction = computed<number | null>(() => {
    const home = this.home();
    const span = this.max() - this.min();
    if (home === null || span <= 0) {
      return null;
    }
    return Math.min(1, Math.max(0, (home - this.min()) / span));
  });

  /** Turns the wheel's delta into whole clicks: 100 px, 3 lines or one page each. A remainder is
   *  kept only within one gesture: it is dropped after a pause or a change of direction. */
  protected onWheel(event: WheelEvent): void {
    if (this.disabled()) {
      this.wheelRemainder = 0;
      this.lastWheelMs = null;
      return;
    }
    event.preventDefault();
    const idle = this.lastWheelMs === null || event.timeStamp - this.lastWheelMs > WHEEL_IDLE_MS;
    const reversed =
      this.wheelRemainder !== 0 && Math.sign(-event.deltaY) !== Math.sign(this.wheelRemainder);
    if (idle || reversed) {
      this.wheelRemainder = 0;
    }
    this.lastWheelMs = event.timeStamp;
    const perClick = event.deltaMode === 1 ? 3 : event.deltaMode === 2 ? 1 : 100;
    this.wheelRemainder += -event.deltaY / perClick;
    const clicks = Math.trunc(this.wheelRemainder);
    if (clicks === 0) {
      return;
    }
    this.wheelRemainder -= clicks;
    this.wheelTurn.emit({ clicks, timeStampMs: event.timeStamp });
  }

  /** Returns the fader to its home value; ignored while disabled or without a home. */
  protected onDoubleClick(): void {
    const home = this.home();
    if (this.disabled() || home === null) {
      return;
    }
    this.valueChange.emit(home);
  }

  /** Forwards the range input's new value as `valueChange`; ignored while disabled. */
  protected onInput(event: Event): void {
    if (this.disabled()) {
      return;
    }
    this.valueChange.emit(Number((event.target as HTMLInputElement).value));
  }
}
