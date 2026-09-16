import { Injectable, inject } from '@angular/core';
import { DeckBinding, IDeckBindingsRepository, Slot } from '@teensyrom-nx/application';
import { DjDatabase, DECK_BINDINGS_STORE } from './dj-database';

/**
 * `IDeckBindingsRepository` over `DjDatabase`. No in-memory fallback: degraded, `load`/`loadAll`
 * answer empty and `save` no-ops — a binding chosen this session still lives in the DJ store's
 * state, it is simply not remembered across a refresh.
 *
 * `load`/`loadAll` pick `slot`/`midiPortId`/`midiPortName` off whatever `DjDatabase` returns
 * rather than spreading it, so a record a prior build wrote with extra fields (e.g. a device
 * binding) reaches application code narrowed to today's shape. `save` always puts today's
 * `DeckBinding` shape, so IndexedDB's whole-record `put` scrubs those stale fields from the store
 * the next time this slot is bound.
 */
@Injectable({ providedIn: 'root' })
export class IndexedDbDeckBindingsRepository implements IDeckBindingsRepository {
  private readonly db = inject(DjDatabase);

  async load(slot: Slot): Promise<DeckBinding | null> {
    const binding = await this.db.get<DeckBinding>(DECK_BINDINGS_STORE, slot);
    return binding ? narrow(binding) : null;
  }

  async loadAll(): Promise<readonly DeckBinding[]> {
    const bindings = await this.db.getAll<DeckBinding>(DECK_BINDINGS_STORE);
    return bindings.map(narrow);
  }

  async save(binding: DeckBinding): Promise<void> {
    await this.db.put(DECK_BINDINGS_STORE, binding);
  }
}

/** Picks exactly `DeckBinding`'s own fields off whatever the database handed back, so a stale
 *  record carrying fields from an earlier shape (e.g. `deviceId`/`deviceName`) never reaches
 *  application code. */
function narrow(binding: DeckBinding): DeckBinding {
  return { slot: binding.slot, midiPortId: binding.midiPortId, midiPortName: binding.midiPortName };
}
