import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';
import {
  CrossfaderComponent,
  DeckStripComponent,
  ScalingCompactCardComponent,
  type DeckStripModel,
} from '@teensyrom-nx/ui/components';
import type { DeckRef } from '../deck-ref';
import { createDeckPlaceholders } from '../placeholders/deck-placeholders';

@Component({
  selector: 'lib-dj-mixer-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'grid-area: mx', '[class.dj-mixer-card--band]': 'band()' },
  imports: [ScalingCompactCardComponent, DeckStripComponent, CrossfaderComponent],
  templateUrl: './dj-mixer-card.component.html',
  styleUrl: './dj-mixer-card.component.scss',
})
export class DjMixerCardComponent {
  readonly decks = input.required<readonly DeckRef[]>();
  readonly showCrossfader = input.required<boolean>();
  readonly band = input<boolean>(false); // true → the horizontal band form at every width (three or more decks)

  private readonly stripsByIndex = computed<ReadonlyMap<number, DeckStripModel>>(
    () => new Map(this.decks().map((deck) => [deck.index, createDeckPlaceholders(deck).strip]))
  );

  readonly firstLetter = computed(() => this.decks()[0]?.letter ?? '');
  readonly lastLetter = computed(() => this.decks()[this.decks().length - 1]?.letter ?? '');
  readonly crossfaderName = computed(
    () => `Crossfader, deck ${this.firstLetter()} to deck ${this.lastLetter()}`
  );

  stripFor(deck: DeckRef): DeckStripModel {
    const strip = this.stripsByIndex().get(deck.index);
    return strip ?? createDeckPlaceholders(deck).strip;
  }
}
