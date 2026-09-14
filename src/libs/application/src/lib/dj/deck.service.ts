import { Injectable, effect, inject } from '@angular/core';
import { logError } from '@teensyrom-nx/utils';
import { DeckRuntime } from './deck-runtime';
import { DeckBindings } from './deck-bindings';
import { TuneLoader } from './tune-loader';
import { DjStore, type DeckStatus } from './dj-store';
import { DECK_SLOTS, type Slot } from './slot';
import type { LoadSource } from './load-source';

/** `error instanceof Error ? error.message : String(error)` — a local helper, not core's
 *  `describeError`. This file imports nothing from `@sidablist/*`; every type it touches flows in
 *  through `DeckRuntime` and `TuneLoader`'s own signatures. */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const RESUMABLE_STATUSES: readonly DeckStatus[] = ['playing', 'paused', 'stopped'];

/**
 * The root of the DJ transport: two decks, each a `DeckRuntime` slot fronted by a `TuneLoader`
 * load sequence and mapped onto `DjStore`. Owns the play path end to end — drop, insert, resolve,
 * play — and the per-slot bookkeeping that keeps a superseded command from ever writing over a
 * newer one: the loader's own generation guard covers its awaits, and this service's own
 * `sequence` counter extends that protection through `runtime.play` itself, a span the loader's
 * guard cannot see because it has already returned by then.
 *
 * Isolation is structural: every command is addressed to one slot, and a throw caught at that
 * slot's command boundary never touches the other slot's status, `loaded` reference or runtime.
 */
@Injectable({ providedIn: 'root' })
export class DeckService {
  private readonly runtime = inject(DeckRuntime);
  private readonly loader = inject(TuneLoader);
  private readonly store = inject(DjStore);
  private readonly bindings = inject(DeckBindings);

  /** This service's own per-slot command counter — distinct from the loader's generation, which
   *  guards only the loader's own awaits. Bumped by `load` and `selectSubtune` on entry; every
   *  write either of those commands makes after an await is gated on still holding the current
   *  number. */
  private readonly sequence: Record<Slot, number> = { A: 0, B: 0 };

  /** True for exactly the span of an in-flight `load` or `selectSubtune`: the engine's own
   *  snapshot notifications are real but mid-transition (a fresh `loadTune` reports `stopped`
   *  before the awaited `play` lands), so the subscription mapping is dropped while this is set
   *  and applied once, deliberately, when the owning call clears it. */
  private readonly suspended: Record<Slot, boolean> = { A: false, B: false };

  constructor() {
    for (const slot of DECK_SLOTS) {
      this.runtime.build(slot);
      this.runtime.subscribe(slot, () => {
        if (!this.suspended[slot]) {
          this.applySnapshot(slot);
        }
      });
      this.setRepeat(slot, true);
      this.watchPosition(slot);
    }
  }

  async load(slot: Slot, source: LoadSource): Promise<void> {
    const mySeq = ++this.sequence[slot];
    this.suspended[slot] = true;

    // Always, idempotent on an already-stopped player: a drop during an older load's `play` must
    // silence that tune, and the status alone cannot say whether one is currently sounding.
    this.runtime.stop(slot);
    this.sample(slot);
    this.store.setDeckStatus({ slot, status: 'loading' });

    let failure: string | null = null;
    try {
      const playable = await this.loader.load(slot, source, (phase, reference) => {
        if (this.sequence[slot] !== mySeq) {
          return;
        }
        this.store.setDeckStatus({ slot, status: phase });
        if (reference !== null) {
          this.store.setDeckLoaded({ slot, reference });
        }
      });

      if (this.sequence[slot] !== mySeq || playable === null) {
        // Either a newer command owns the slot now, or the loader's own generation guard already
        // discarded this load in favour of one — nothing more to write either way.
        return;
      }

      this.runtime.load(slot, playable);
      this.store.setDeckStructure({
        slot,
        structure: {
          loopStartFrame: playable.index.loopStartFrame,
          loopPeriodFrames: playable.index.loopPeriodFrames,
          endedAtFrame: playable.index.endedAtFrame,
        },
        lengthFrames: this.runtime.snapshot(slot).basis.positionBasisFrames,
      });

      await this.runtime.play(slot);

      if (this.sequence[slot] !== mySeq) {
        return;
      }
      this.sample(slot);
    } catch (error) {
      failure = describeError(error);
    } finally {
      if (this.sequence[slot] === mySeq) {
        this.suspended[slot] = false;
        // The notification that matters — `play()` announcing `playing` — arrives inside the
        // suspended window above and is dropped there; this is what lands it, once, on the way out.
        this.applySnapshot(slot);
        if (failure !== null) {
          // After the snapshot applies, so the engine's own `stopped` cannot overwrite the reason.
          this.store.setDeckStatus({ slot, status: 'failed', error: failure });
          logError(`DeckService: load failed for slot ${slot}: ${failure}`);
        }
      }
    }
  }

  async togglePlayPause(slot: Slot): Promise<void> {
    const status = this.store.deck(slot)().status;
    if (status === 'playing') {
      this.runtime.pause(slot);
      this.sample(slot);
      return;
    }
    if (status === 'paused' || status === 'stopped') {
      await this.runtime.play(slot);
      this.sample(slot);
    }
  }

  stop(slot: Slot): void {
    const status = this.store.deck(slot)().status;
    if (status !== 'playing' && status !== 'paused') {
      return;
    }
    this.runtime.stop(slot);
    this.sample(slot);
  }

  async seek(slot: Slot, percent: number): Promise<void> {
    if (!RESUMABLE_STATUSES.includes(this.store.deck(slot)().status)) {
      return;
    }
    await this.runtime.seekToPercent(slot, percent);
    this.sample(slot);
  }

  async selectSubtune(slot: Slot, subtune: number): Promise<void> {
    const current = this.store.deck(slot)();
    if (!RESUMABLE_STATUSES.includes(current.status) || current.loaded === null) {
      return;
    }

    const target = Math.min(Math.max(Math.round(subtune), 1), current.subtuneCount);
    const previousStatus = current.status;
    const sidHash = current.loaded.identity.sidHash;

    const mySeq = ++this.sequence[slot];
    this.suspended[slot] = true;
    this.runtime.stop(slot);
    this.sample(slot);
    this.store.setDeckStatus({ slot, status: 'indexing' });

    let failure: string | null = null;
    try {
      const playable = await this.loader.resolveSubtune(
        slot,
        { sidHash, subtune: target },
        (phase, reference) => {
          if (this.sequence[slot] !== mySeq) {
            return;
          }
          this.store.setDeckStatus({ slot, status: phase });
          if (reference !== null) {
            this.store.setDeckLoaded({ slot, reference });
          }
        }
      );

      if (this.sequence[slot] !== mySeq || playable === null) {
        return;
      }

      this.runtime.load(slot, playable);
      this.store.setDeckLoaded({ slot, reference: playable.reference });
      this.store.setDeckStructure({
        slot,
        structure: {
          loopStartFrame: playable.index.loopStartFrame,
          loopPeriodFrames: playable.index.loopPeriodFrames,
          endedAtFrame: playable.index.endedAtFrame,
        },
        lengthFrames: this.runtime.snapshot(slot).basis.positionBasisFrames,
      });

      // Restores the transport state the switch started from. A subtune shares no position with
      // its sibling, so "the position it was at" has no meaning here — a resumed pause holds the
      // new subtune at its own start rather than the old one's.
      if (previousStatus === 'playing') {
        await this.runtime.play(slot);
      } else if (previousStatus === 'paused') {
        await this.runtime.play(slot);
        this.runtime.pause(slot);
      }

      if (this.sequence[slot] !== mySeq) {
        return;
      }
      this.sample(slot);
    } catch (error) {
      failure = describeError(error);
    } finally {
      if (this.sequence[slot] === mySeq) {
        this.suspended[slot] = false;
        this.applySnapshot(slot);
        if (failure !== null) {
          this.store.setDeckStatus({ slot, status: 'failed', error: failure });
          logError(`DeckService: subtune select failed for slot ${slot}: ${failure}`);
        }
      }
    }
  }

  setRepeat(slot: Slot, on: boolean): void {
    this.runtime.setRepeat(slot, on);
    this.store.setDeckRepeat({ slot, repeat: on });
  }

  /** Loads both slots' bindings from the repository, reconciles them against what is enumerated
   *  and connected, and installs the effects that keep reconciling from then on. The constructor
   *  above builds the runtimes a bind can target; this is the separate call `DjBootstrapService`
   *  makes in the same startup beat, so a spec can construct this service without the repository
   *  ever answering. */
  async hydrate(): Promise<void> {
    await this.bindings.hydrate();
  }

  async bindPort(slot: Slot, portId: string | null): Promise<void> {
    await this.bindings.bindPort(slot, portId);
  }

  async bindDevice(slot: Slot, deviceId: string | null): Promise<void> {
    await this.bindings.bindDevice(slot, deviceId);
  }

  async enableMidi(): Promise<void> {
    await this.bindings.enableMidi();
  }

  identify(slot: Slot): void {
    this.bindings.identify(slot);
  }

  /** Records this slot's current playhead. Unconditional — the rAF loop gates its own calls on
   *  the frame having changed, but every explicit transport transition samples regardless, so a
   *  stop shows the bar back at the start even when the engine happened to land on the same frame
   *  it was already holding. Specs drive this directly, in place of a real animation frame. */
  sample(slot: Slot): void {
    this.store.samplePosition({ slot, positionFrames: this.runtime.position(slot) });
  }

  /** Applies `runtime.snapshot(slot)` onto the store: transport → status, the loaded tune's
   *  current subtune, and the position basis mirrored onto `lengthFrames`. The one mapping the
   *  subscription listener and the suspend-clearing exit both call, so neither path can disagree
   *  with the other about what "the current snapshot" means. */
  private applySnapshot(slot: Slot): void {
    const snapshot = this.runtime.snapshot(slot);
    if (snapshot.tune === null) {
      // Nothing loaded: 'empty' is an application concept the engine has no notion of. A fresh
      // player's own default transport would otherwise land here — from the constructor's own
      // `setRepeat` notify among other things — and overwrite it before anything was ever dropped.
      return;
    }

    const status: DeckStatus =
      snapshot.transport === 'ended' ? 'stopped' : snapshot.transport === 'error' ? 'failed' : snapshot.transport;

    this.store.setDeckStatus({
      slot,
      status,
      error: snapshot.transport === 'error' ? snapshot.error : null,
    });

    this.store.setDeckSubtune({ slot, subtune: snapshot.tune.subtune });

    // subtuneCount has no action of its own to write independently — it lands only through
    // `setDeckLoaded`, already called wherever a fresh `TuneReference` becomes known, so there is
    // nothing to mirror here beyond what that call already landed.
    const structure = this.store.deck(slot)().structure;
    if (structure !== null) {
      this.store.setDeckStructure({ slot, structure, lengthFrames: snapshot.basis.positionBasisFrames });
    }
  }

  /** A `requestAnimationFrame` loop for this slot, running only while it is `playing` and paused
   *  while the document is hidden — the POC's `animationFrameSignal` bridge rule, generalised per
   *  slot. Samples only when the polled frame actually moved; every other reason to sample runs
   *  through the explicit calls each command already makes. */
  private watchPosition(slot: Slot): void {
    let frameId: number | null = null;
    let lastFrame: number | null = null;

    const tick = (): void => {
      const position = this.runtime.position(slot);
      if (position !== lastFrame) {
        lastFrame = position;
        this.sample(slot);
      }
      frameId = requestAnimationFrame(tick);
    };

    const start = (): void => {
      if (frameId === null && !document.hidden) {
        frameId = requestAnimationFrame(tick);
      }
    };

    const stop = (): void => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    };

    effect(() => {
      if (this.store.deck(slot)().status === 'playing') {
        start();
      } else {
        stop();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stop();
      } else if (this.store.deck(slot)().status === 'playing') {
        start();
      }
    });
  }
}
