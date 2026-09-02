import { Injectable, signal, type Signal } from '@angular/core';
import { DjPlayerEngine } from '../engine/dj-player-engine';
import { DeckMidiBinding } from '../midi/deck-midi-binding';
import { TuneIndexService } from '../analysis/tune-index.service';
import { DeckTuneLoader } from './deck-tune-loader';
import { DECKS, type DeckDescriptor } from './deck.config';

/** What a page-level surface may reach of one deck — never the deck's own injector, only the
 *  collaborators it composed. */
export interface DeckHandle {
  readonly descriptor: DeckDescriptor;
  readonly engine: DjPlayerEngine;
  readonly binding: DeckMidiBinding;
  readonly tuneIndex: TuneIndexService;
  readonly tuneLoader: DeckTuneLoader;
}

const deckOrder = new Map<string, number>(DECKS.map((deck, index) => [deck.id, index]));

/** `DECKS` order, not registration order — a deck host that mounts out of order (or a later entry
 *  that finishes constructing first) must never reorder page-level surfaces that iterate `decks()`. */
function sortByDeckOrder(handles: readonly DeckHandle[]): readonly DeckHandle[] {
  return [...handles].sort(
    (a, b) => (deckOrder.get(a.descriptor.id) ?? 0) - (deckOrder.get(b.descriptor.id) ?? 0)
  );
}

/**
 * Page-level: the only way a page-level surface reaches a deck's collaborators. One instance for
 * the whole page, so every `DeckHostComponent` registers into the same list its siblings do.
 */
@Injectable()
export class DeckRegistry {
  private readonly _decks = signal<readonly DeckHandle[]>([]);
  readonly decks: Signal<readonly DeckHandle[]> = this._decks.asReadonly();

  /** Replaces any existing entry for the same deck id, so a hot-reloaded host can never register
   *  twice under one id. */
  register(handle: DeckHandle): void {
    this._decks.update((decks) =>
      sortByDeckOrder([...decks.filter((existing) => existing.descriptor.id !== handle.descriptor.id), handle])
    );
  }

  unregister(id: string): void {
    this._decks.update((decks) => decks.filter((handle) => handle.descriptor.id !== id));
  }
}
