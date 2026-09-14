import { Injectable, inject } from '@angular/core';
import { DeckBinding, IDeckBindingsRepository, Slot } from '@teensyrom-nx/application';
import { DjDatabase, DECK_BINDINGS_STORE } from './dj-database';

/**
 * `IDeckBindingsRepository` over `DjDatabase`. No in-memory fallback: degraded, `load`/`loadAll`
 * answer empty and `save` no-ops — a binding chosen this session still lives in the DJ store's
 * state, it is simply not remembered across a refresh.
 */
@Injectable({ providedIn: 'root' })
export class IndexedDbDeckBindingsRepository implements IDeckBindingsRepository {
  private readonly db = inject(DjDatabase);

  async load(slot: Slot): Promise<DeckBinding | null> {
    const binding = await this.db.get<DeckBinding>(DECK_BINDINGS_STORE, slot);
    return binding ?? null;
  }

  loadAll(): Promise<readonly DeckBinding[]> {
    return this.db.getAll<DeckBinding>(DECK_BINDINGS_STORE);
  }

  async save(binding: DeckBinding): Promise<void> {
    await this.db.put(DECK_BINDINGS_STORE, binding);
  }
}
