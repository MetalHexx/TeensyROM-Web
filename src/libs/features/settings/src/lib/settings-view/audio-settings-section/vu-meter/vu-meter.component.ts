import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';

/**
 * Presentational VU meter bar displaying a volume level from 0 to 1.
 *
 * Uses a CSS gradient background (green → yellow → red) with an overlay
 * that covers the unreached portion from the right.
 *
 * @example
 * ```html
 * <lib-vu-meter [level]="0.65" />
 * ```
 */
@Component({
  selector: 'lib-vu-meter',
  standalone: true,
  templateUrl: './vu-meter.component.html',
  styleUrl: './vu-meter.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VuMeterComponent {
  /** Volume level from 0 (silent) to 1 (maximum). */
  readonly level = input<number>(0);

  /**
   * Width percentage for the cover overlay that hides the unreached
   * portion of the gradient.  A level of 0 → 100 % cover (silent);
   * a level of 1 → 0 % cover (full gradient visible).
   */
  readonly coverWidth = computed(() => {
    const clamped = Math.max(0, Math.min(1, this.level()));
    return `${Math.round((1 - clamped) * 100)}%`;
  });

  /** Accessible label describing the current level. */
  readonly ariaValueText = computed(() => {
    const pct = Math.round(Math.max(0, Math.min(1, this.level())) * 100);
    return `Volume level ${pct}%`;
  });
}
