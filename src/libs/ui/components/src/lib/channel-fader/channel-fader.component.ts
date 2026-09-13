import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ControlSize } from '../shared/control-size';

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
  host: {
    '[attr.data-size]': 'size()',
    '[style.--channel-fader-length]': 'length()',
    '[attr.data-fixed-length]': "length() !== null ? '' : null",
  },
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
  /** Scales the label font and the width the host reserves for the fader — reflected as `data-size`
   *  on the host. The native range input's own thumb and track are the browser's and do not scale;
   *  see `--channel-fader-thickness` in this component's stylesheet. Defaults to `'large'`, today's
   *  only size, so every existing use renders pixel-identical. */
  readonly size = input<ControlSize>('large');
  /** A CSS length applied to the range input's own extent (its travel), not the host — the host
   *  column also holds the deck-letter label beneath the input, so a host height would make the
   *  travel `length − label − gap`. `null` (the default) keeps today's flex-grow behavior exactly. */
  readonly length = input<string | null>(null);
  /** Emits the raw numeric value read off the native range input, unrounded. */
  readonly valueChange = output<number>();

  /** `step` is the input's own granularity; the model stores whatever value arrives and never
   *  re-rounds it. */
  protected onInput(event: Event): void {
    this.valueChange.emit(Number((event.target as HTMLInputElement).value));
  }
}
