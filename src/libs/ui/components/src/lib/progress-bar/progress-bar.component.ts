import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';

/**
 * A thin, absolutely-positioned progress bar built on `MatProgressBarModule`, driven purely by a
 * current/total value pair rather than a pre-computed percentage. It is fully presentational —
 * no dependency on player state or any other feature context — so it fits any "how far along is
 * this" use case: playback position, file transfer progress, download status.
 *
 * Reach for `ProgressBarComponent` whenever progress is expressible as `currentValue`/`totalValue`
 * and should render flush to the top edge of its container (a card, a toolbar) as a subtle 4px
 * strip rather than a full form-style progress indicator. It uses the `--color-primary-bright`
 * design token for its fill color and a 4px border radius to match card corners — see the
 * `style-guide` skill for the underlying tokens.
 *
 * @example
 * ```html
 * <lib-progress-bar
 *   [currentValue]="50"
 *   [totalValue]="100"
 *   [show]="true">
 * </lib-progress-bar>
 * ```
 */
@Component({
  selector: 'lib-progress-bar',
  imports: [MatProgressBarModule],
  templateUrl: './progress-bar.component.html',
  styleUrl: './progress-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressBarComponent {
  /** Current progress value, in the same unit as `totalValue` (e.g. elapsed seconds of a track) — defaults to `0`. */
  currentValue = input<number>(0);

  /** Total/max progress value, in the same unit as `currentValue` (e.g. total duration in seconds) — defaults to `0`. When `0`, `progressPercent` resolves to `0` rather than dividing by zero. */
  totalValue = input<number>(0);

  /** Whether the progress bar is rendered at all — defaults to `false`. Use this to hide the bar entirely rather than setting `currentValue` to `0`, which would still render an empty bar. */
  show = input<boolean>(false);

  /** `currentValue` as a percentage of `totalValue`, clamped implicitly to `0` when `totalValue` is `0`. Not clamped to 100 — callers should keep `currentValue <= totalValue`. */
  progressPercent = computed(() => {
    const current = this.currentValue();
    const total = this.totalValue();

    if (total === 0) return 0;
    return (current / total) * 100;
  });
}
