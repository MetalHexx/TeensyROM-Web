import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** How well two decks' keys fit. Declared here, not imported — the library must not depend on
 *  the application's key-match state. */
export type KeyMatchLightState = 'full' | 'close' | 'possible' | 'clash' | 'none';

const LABELS: Readonly<Record<KeyMatchLightState, string>> = {
  full: 'Key match: full',
  close: 'Key match: close',
  possible: 'Key match: possible',
  clash: 'Key match: clash',
  none: 'Key match: no key',
};

/**
 * A single 8px LED showing how well the two decks' keys match: green for a full match, softer
 * green for close, amber for possible, red for a clash, and unlit when a deck has no key. Purely
 * a readout — not focusable and not clickable.
 *
 * @example
 * ```html
 * <lib-key-match-light [state]="keyMatch()" />
 * ```
 */
@Component({
  selector: 'lib-key-match-light',
  templateUrl: './key-match-light.component.html',
  styleUrl: './key-match-light.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'img',
    '[attr.aria-label]': 'label()',
  },
})
export class KeyMatchLightComponent {
  /** Which of the five match states the dot represents. */
  readonly state = input.required<KeyMatchLightState>();

  protected readonly label = computed(() => LABELS[this.state()]);
}
