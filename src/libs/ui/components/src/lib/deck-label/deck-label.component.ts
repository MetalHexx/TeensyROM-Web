import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A deck's heading on the SID panel: bold, widely spaced uppercase text beside a short glowing
 * magenta accent bar. `accentSide` puts the bar before the text (`'start'`) or after it
 * (`'end'`, how deck B is drawn). Purely presentational.
 *
 * @example
 * ```html
 * <lib-deck-label label="Deck A" />
 * <lib-deck-label label="Deck B" accentSide="end" />
 * ```
 */
@Component({
  selector: 'lib-deck-label',
  templateUrl: './deck-label.component.html',
  styleUrl: './deck-label.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-accent-side]': 'accentSide()',
  },
})
export class DeckLabelComponent {
  /** The heading text, e.g. 'Deck A'; drawn in uppercase. */
  readonly label = input.required<string>();
  /** Which side of the text the accent bar sits on. Defaults to `'start'`. */
  readonly accentSide = input<'start' | 'end'>('start');
}
