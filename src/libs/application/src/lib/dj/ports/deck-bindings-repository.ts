import { InjectionToken } from '@angular/core';
import { Slot } from '../slot';

/** Which MIDI output port a deck slot is bound to. Null fields mean unbound. */
export interface DeckBinding {
  readonly slot: Slot;
  readonly midiPortId: string | null;
  readonly midiPortName: string | null;
}

/** Persists per-slot deck bindings so they survive a refresh. */
export interface IDeckBindingsRepository {
  load(slot: Slot): Promise<DeckBinding | null>;
  loadAll(): Promise<readonly DeckBinding[]>;
  save(binding: DeckBinding): Promise<void>;
}

export const DECK_BINDINGS_REPOSITORY = new InjectionToken<IDeckBindingsRepository>(
  'DECK_BINDINGS_REPOSITORY'
);
