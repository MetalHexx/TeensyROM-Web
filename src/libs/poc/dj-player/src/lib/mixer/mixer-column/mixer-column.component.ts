import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DECKS } from '../../deck/deck.config';
import { CrossfaderComponent } from '../crossfader/crossfader.component';
import { DeckStripComponent } from '../deck-strip/deck-strip.component';

/**
 * The mixer column: one deck strip per `DECKS` entry — filter mode, the four scale knobs and the
 * channel fader — and the crossfader beneath them both.
 *
 * `:host` claims the fixed `mx` grid area directly, in both the page's two-deck layout and its
 * N-deck fallback: there is exactly one mixer column regardless of how many decks compose, so naming
 * it here is not a deck naming a column — see `dj-poc-view.component.ts`'s own grid layout, which
 * never touches this area name.
 */
@Component({
  selector: 'lib-mixer-column',
  templateUrl: './mixer-column.component.html',
  styleUrl: './mixer-column.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DeckStripComponent, CrossfaderComponent],
})
export class MixerColumnComponent {
  protected readonly decks = DECKS;
}
