import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * A single vertical range fader with an optional label rendered beneath it. Purely presentational:
 * it holds no local copy of its value and never re-rounds what it reads off the native range input,
 * so caller and control cannot drift apart. Bounds (`min`/`max`/`step`) are inputs rather than fixed
 * 0–1 gain, so any bounded numeric range can reuse this same fader with its own span.
 *
 * @example
 * ```html
 * <lib-channel-fader
 *   [value]="gain()"
 *   accessibleName="Channel fader deck A"
 *   label="A"
 *   (valueChange)="onGainChange($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-channel-fader',
  templateUrl: './channel-fader.component.html',
  styleUrl: './channel-fader.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelFaderComponent {
  /** The fader's current position, between `min()` and `max()`. */
  readonly value = input.required<number>();
  /** Accessible label announced to assistive technology, e.g. 'Channel fader deck A'. */
  readonly accessibleName = input.required<string>();
  /** Minimum of the fader's range. Defaults to `0`. */
  readonly min = input<number>(0);
  /** Maximum of the fader's range. Defaults to `1`. */
  readonly max = input<number>(1);
  /** Granularity of the native range input. Defaults to `0.01`. */
  readonly step = input<number>(0.01);
  /** Rendered beneath the fader when present — the deck letter today. `null` hides it entirely. */
  readonly label = input<string | null>(null);
  /** Emits the raw numeric value read off the native range input, unrounded. */
  readonly valueChange = output<number>();

  /** `step` is the input's own granularity; the model stores whatever value arrives and never
   *  re-rounds it. */
  protected onInput(event: Event): void {
    this.valueChange.emit(Number((event.target as HTMLInputElement).value));
  }
}
