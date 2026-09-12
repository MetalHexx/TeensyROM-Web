import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { DeckRef } from '../deck-ref';

@Component({
  selector: 'lib-dj-mixer-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'grid-area: mx' },
  templateUrl: './dj-mixer-card.component.html',
  styleUrl: './dj-mixer-card.component.scss',
})
export class DjMixerCardComponent {
  readonly decks = input.required<readonly DeckRef[]>();
  readonly showCrossfader = input.required<boolean>();
  readonly band = input<boolean>(false); // true → the horizontal band form at every width (three or more decks)
}
