import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The six states the DJ surface distinguishes today. Declared here, not imported — the library
 *  must not depend on `@sidablist/core`'s `PlayerSnapshot['transport']`. */
export type StatusLedState = 'stopped' | 'playing' | 'paused' | 'ended' | 'error' | 'analyzing';

/**
 * A colored dot plus its adjacent text label — a compact state readout for a deck's transport.
 * Distinct from `StatusIconLabelComponent`, which pairs a Material *icon* with text; reach for this
 * one when the indicator is a plain colored LED rather than an icon glyph.
 *
 * @example
 * ```html
 * <lib-status-led [state]="transportState()" [label]="transportStateLabel()" />
 * ```
 */
@Component({
  selector: 'lib-status-led',
  templateUrl: './status-led.component.html',
  styleUrl: './status-led.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusLedComponent {
  /** Which of the six states the dot's colour and glow represent. */
  readonly state = input.required<StatusLedState>();
  /** The label rendered beside the dot, e.g. 'Playing', 'Analyzing…' — caller-composed; this
   *  component owns no state-to-text mapping of its own. */
  readonly label = input.required<string>();
}
