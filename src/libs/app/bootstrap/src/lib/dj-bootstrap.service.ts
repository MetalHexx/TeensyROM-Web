import { inject, Injectable } from '@angular/core';
import { DeckService } from '@teensyrom-nx/application';
import { logWarn } from '@teensyrom-nx/utils';

/**
 * Starts the DJ transport at application boot: injecting `DeckService` builds both decks'
 * runtimes, and `hydrate()` loads their MIDI bindings so a reload opens the page ready to play.
 * Bindings hydration is non-critical — a rejection logs a warning and the decks simply stay
 * unbound, the one owner of that failure path.
 */
@Injectable({ providedIn: 'root' })
export class DjBootstrapService {
  private readonly deckService = inject(DeckService);

  init(): void {
    void this.deckService
      .hydrate()
      .catch((error) =>
        logWarn(`DjBootstrap: bindings hydration failed — ${error instanceof Error ? error.message : String(error)}`)
      );
  }
}
