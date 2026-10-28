import { inject, Injectable } from '@angular/core';
import {
  DeckMemoryKeeper,
  DeckService,
  DjSets,
  MidiControllers,
  MidiInputRouter,
  MixerApplier,
} from '@teensyrom-nx/application';
import { logWarn } from '@teensyrom-nx/utils';

/**
 * Starts the DJ transport at application boot: injecting `DeckService` builds both decks'
 * runtimes, and `hydrate()` loads their MIDI bindings — auto-connecting on its own when the
 * origin has already granted Web MIDI — so a reload opens the page bound and ready to play with
 * no click. It also installs the mixer applier that keeps each deck's engine in step with the mixer
 * state, and the memory keeper that keeps each deck's settings in the row it holds; loads the saved
 * MIDI controllers and mappings, and starts routing controller input to them. It also hydrates the
 * DJ library — the saved sets and the current one — whose own failure path alerts and suppresses
 * saves for the session, so it never rejects. Bindings hydration, mappings hydration and the
 * applier and keeper installs are non-critical — a failure logs a warning and the decks simply stay
 * unbound, unmixed, unmapped or unremembered, the one owner of that failure path.
 */
@Injectable({ providedIn: 'root' })
export class DjBootstrapService {
  private readonly deckService = inject(DeckService);
  // After `deckService`, whose constructor builds both decks' runtimes — the applier's first pass
  // needs them. A field, not an `inject()` in `init()`, which runs outside an injection context.
  private readonly mixerApplier = inject(MixerApplier);
  private readonly deckMemoryKeeper = inject(DeckMemoryKeeper);
  private readonly midiControllers = inject(MidiControllers);
  private readonly midiInputRouter = inject(MidiInputRouter);
  private readonly djSets = inject(DjSets);

  init(): void {
    try {
      this.mixerApplier.install();
    } catch (error) {
      logWarn(`DjBootstrap: mixer install failed — ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      this.deckMemoryKeeper.install();
    } catch (error) {
      logWarn(`DjBootstrap: memory keeper install failed — ${error instanceof Error ? error.message : String(error)}`);
    }

    void this.deckService
      .hydrate()
      .catch((error) =>
        logWarn(`DjBootstrap: bindings hydration failed — ${error instanceof Error ? error.message : String(error)}`)
      );

    void this.midiControllers
      .hydrate()
      .then(() => this.midiInputRouter.start())
      .catch((error) =>
        logWarn(`DjBootstrap: mappings hydration failed — ${error instanceof Error ? error.message : String(error)}`)
      );

    void this.djSets.hydrate();
  }
}
