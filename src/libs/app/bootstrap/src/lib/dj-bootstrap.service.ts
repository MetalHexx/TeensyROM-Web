import { inject, Injectable } from '@angular/core';
import { DeckService, MixerApplier } from '@teensyrom-nx/application';
import { logWarn } from '@teensyrom-nx/utils';

/**
 * Starts the DJ transport at application boot: injecting `DeckService` builds both decks'
 * runtimes, and `hydrate()` loads their MIDI bindings — auto-connecting on its own when the
 * origin has already granted Web MIDI — so a reload opens the page bound and ready to play with
 * no click. It also installs the mixer applier that keeps each deck's engine in step with the mixer
 * state. Bindings hydration and the applier install are non-critical — a failure logs a warning and
 * the decks simply stay unbound or unmixed, the one owner of that failure path.
 */
@Injectable({ providedIn: 'root' })
export class DjBootstrapService {
  private readonly deckService = inject(DeckService);
  // After `deckService`, whose constructor builds both decks' runtimes — the applier's first pass
  // needs them. A field, not an `inject()` in `init()`, which runs outside an injection context.
  private readonly mixerApplier = inject(MixerApplier);

  init(): void {
    try {
      this.mixerApplier.install();
    } catch (error) {
      logWarn(`DjBootstrap: mixer install failed — ${error instanceof Error ? error.message : String(error)}`);
    }

    void this.deckService
      .hydrate()
      .catch((error) =>
        logWarn(`DjBootstrap: bindings hydration failed — ${error instanceof Error ? error.message : String(error)}`)
      );
  }
}
