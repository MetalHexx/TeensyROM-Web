import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DECKS } from '../../deck/deck.config';
import { ChannelFaderComponent } from '../channel-fader/channel-fader.component';
import { CrossfaderComponent } from '../crossfader/crossfader.component';

/**
 * The mixer column: one vertical channel fader per `DECKS` entry, and the crossfader beneath them.
 * No curve selector, no curve-shape preview, and no numeric readout of the resulting register value.
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
  imports: [ChannelFaderComponent, CrossfaderComponent],
})
export class MixerColumnComponent {
  protected readonly decks = DECKS;
}
