import { Injectable, effect, inject } from '@angular/core';
import { logError, logWarn } from '@teensyrom-nx/utils';
import { DeckRuntime } from './deck-runtime';
import { DeckBindings } from './deck-bindings';
import { DeckLoops } from './deck-loops';
import { DeckSpeed, type NudgeDirection } from './deck-speed';
import { NUDGE_DEFAULT_AMOUNT } from './mixer/speed-excursion';
import { MixerApplier } from './mixer-applier';
import { SidPanelPainter } from './sid-panel-painter';
import { TuneLoader } from './tune-loader';
import { DjStore, type DeckDetectedKey, type DeckStatus, type DeckVoiceState } from './dj-store';
import { DECK_SLOTS, type Slot } from './slot';
import type { LoadSource } from './load-source';
import type { LoopBoundaryName, LoopSnapDirection } from './selectors/loops-summary';

/** `error instanceof Error ? error.message : String(error)` — a local helper, not core's
 *  `describeError`. This file imports nothing from `@sidablist/*`; every type it touches flows in
 *  through `DeckRuntime` and `TuneLoader`'s own signatures. */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type Transport = ReturnType<DeckRuntime['snapshot']>['transport'];

const RESUMABLE_STATUSES: readonly DeckStatus[] = ['playing', 'paused', 'stopped'];

/** The SID's three voices, in engine order. */
const VOICES: readonly number[] = [0, 1, 2];

/** The detected key an index record carries, or `null` unless tonic, mode and camelot are all
 *  known. */
function detectedKeyOf(index: {
  readonly tonic: number | null;
  readonly mode: 'major' | 'minor' | null;
  readonly camelot: string | null;
}): DeckDetectedKey | null {
  const { tonic, mode, camelot } = index;
  return tonic !== null && mode !== null && camelot !== null ? { tonic, mode, camelot } : null;
}

function sameVoices(a: readonly DeckVoiceState[], b: readonly DeckVoiceState[]): boolean {
  return a.length === b.length && a.every((voice, i) => voice.muted === b[i].muted && voice.held === b[i].held);
}

/**
 * The root of the DJ transport: two decks, each a `DeckRuntime` slot fronted by a `TuneLoader`
 * load sequence and mapped onto `DjStore`. Owns the play path end to end — drop, insert, resolve,
 * play — and the per-slot bookkeeping that keeps a superseded command from ever writing over a
 * newer one: the loader's own generation guard covers its awaits, and this service's own
 * `sequence` counter extends that protection through `runtime.play` itself, a span the loader's
 * guard cannot see because it has already returned by then.
 *
 * It also fronts the speed, nudge, voice and loop-marker commands and reflects the engine's tempo,
 * voice and prepared-frame state into the store. Every load and subtune switch returns the deck's
 * SID panel, speed, nudges, mutes and holds to home before anything else, so a new tune never
 * inherits the last one's settings, and attaches the incoming tune's markers before it plays.
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
  private readonly deckSpeed = inject(DeckSpeed);
  private readonly loops = inject(DeckLoops);
  private readonly mixerApplier = inject(MixerApplier);
  private readonly panelPainter = inject(SidPanelPainter);

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

  /** The transport and subtune of the snapshot `applySnapshot` last landed per slot, so the
   *  subscription re-applies only on a real transition — a speed-fader tick or a hold press
   *  notifies too, and must not re-run the status, subtune and structure writes. */
  private readonly applied: Record<Slot, { transport: Transport; subtune: number | null } | null> = {
    A: null,
    B: null,
  };

  constructor() {
    for (const slot of DECK_SLOTS) {
      this.runtime.build(slot);
      this.runtime.subscribe(slot, () => {
        this.reflectEngineControls(slot);
        this.loops.reflect(slot);
        if (!this.suspended[slot] && this.transitioned(slot)) {
          this.applySnapshot(slot);
        }
      });
      this.setRepeat(slot, true);
      this.watchPosition(slot);
    }
  }

  async load(slot: Slot, source: LoadSource): Promise<void> {
    const mySeq = ++this.sequence[slot];
    this.store.setDeckBusy({ slot, busy: true });
    this.store.setDeckSwitching({ slot, switching: true });
    this.suspended[slot] = true;

    // Always, idempotent on an already-stopped player: a drop during an older load's `play` must
    // silence that tune, and the status alone cannot say whether one is currently sounding.
    this.runtime.stop(slot);
    // Synchronous, before the first await: it always lands ahead of the new tune's `play`, a failed
    // load still ends at home, and a superseded load can never reset after a newer one has started.
    this.resetTuneShaping(slot);
    this.loops.detach(slot);
    this.sample(slot);

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
      this.store.setDeckDetectedKey({ slot, detectedKey: detectedKeyOf(playable.index) });
      // Lands the reference even on a cache hit, when the loader's own callback above never fired
      // for either phase — the subtune path below always did this at its own equivalent line.
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
      this.store.setDeckTiming({ slot, playCallIntervalUs: this.runtime.playCallIntervalUs(slot) });
      await this.loops.attach(
        slot,
        playable.reference.identity,
        playable.index.detectedMoments.map((moment) => moment.frame)
      );

      if (this.sequence[slot] !== mySeq) {
        return;
      }
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
        this.store.setDeckBusy({ slot, busy: false });
        this.store.setDeckSwitching({ slot, switching: false });
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
    const deck = this.store.deck(slot)();
    if (deck.busy) {
      return;
    }
    if (deck.status === 'playing') {
      this.runtime.pause(slot);
      this.sample(slot);
      return;
    }
    if (deck.status === 'paused' || deck.status === 'stopped') {
      // Busy for the whole await, exactly as `load()` holds it across its own `runtime.play` —
      // otherwise `canStop` reads true against a status that has not moved yet (`paused` stays
      // `paused` until this resolves) and a Stop click can reach the runtime mid-flight, superseding
      // this call's still-pending `clock.start()` and leaving the store reporting `playing` for a
      // deck that the superseded start actually left silent.
      this.store.setDeckBusy({ slot, busy: true });
      try {
        await this.runtime.play(slot);
      } finally {
        this.store.setDeckBusy({ slot, busy: false });
      }
      this.sample(slot);
    }
  }

  stop(slot: Slot): void {
    const deck = this.store.deck(slot)();
    if (deck.busy || (deck.status !== 'playing' && deck.status !== 'paused')) {
      return;
    }
    // The engine disarms its loop on a stop, but not a marker still waiting for readiness.
    this.releaseMarkers(slot);
    this.runtime.stop(slot);
    this.sample(slot);
  }

  async seek(slot: Slot, percent: number): Promise<void> {
    const deck = this.store.deck(slot)();
    if (deck.busy || !RESUMABLE_STATUSES.includes(deck.status)) {
      return;
    }
    // A scrub is a gesture of its own: a marker loop would pull it straight back.
    this.releaseMarkers(slot);
    await this.runtime.seekToPercent(slot, percent);
    this.sample(slot);
  }

  async selectSubtune(slot: Slot, subtune: number): Promise<void> {
    const current = this.store.deck(slot)();
    if (current.busy || !RESUMABLE_STATUSES.includes(current.status) || current.loaded === null) {
      return;
    }

    const target = Math.min(Math.max(Math.round(subtune), 1), current.subtuneCount);
    const previousStatus = current.status;
    const sidHash = current.loaded.identity.sidHash;

    const mySeq = ++this.sequence[slot];
    this.store.setDeckBusy({ slot, busy: true });
    this.store.setDeckSwitching({ slot, switching: true });
    this.suspended[slot] = true;
    this.runtime.stop(slot);
    this.resetTuneShaping(slot);
    this.loops.detach(slot);
    this.sample(slot);

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
      this.store.setDeckDetectedKey({ slot, detectedKey: detectedKeyOf(playable.index) });
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
      this.store.setDeckTiming({ slot, playCallIntervalUs: this.runtime.playCallIntervalUs(slot) });
      await this.loops.attach(
        slot,
        playable.reference.identity,
        playable.index.detectedMoments.map((moment) => moment.frame)
      );

      if (this.sequence[slot] !== mySeq) {
        return;
      }

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
        this.store.setDeckBusy({ slot, busy: false });
        this.store.setDeckSwitching({ slot, switching: false });
        this.applySnapshot(slot);
        if (failure !== null) {
          this.store.setDeckStatus({ slot, status: 'failed', error: failure });
          logError(`DeckService: subtune select failed for slot ${slot}: ${failure}`);
        }
      }
    }
  }

  /** Steps one subtune down. `selectSubtune` clamps to the tune's range and applies its own gates. */
  previousSubtune(slot: Slot): Promise<void> {
    return this.selectSubtune(slot, this.store.deck(slot)().subtune - 1);
  }

  /** Steps one subtune up. `selectSubtune` clamps to the tune's range and applies its own gates. */
  nextSubtune(slot: Slot): Promise<void> {
    return this.selectSubtune(slot, this.store.deck(slot)().subtune + 1);
  }

  setRepeat(slot: Slot, on: boolean): void {
    this.runtime.setRepeat(slot, on);
    this.store.setDeckRepeat({ slot, repeat: on });
  }

  /** The speed fader: sets the tempo multiplier within 0.5x–1.5x. Refused while the deck has
   *  nothing shapeable loaded. */
  setSpeed(slot: Slot, multiplier: number): void {
    if (!this.canShape(slot, 'setSpeed')) {
      return;
    }
    this.deckSpeed.setFader(slot, multiplier);
    this.reflectEngineControls(slot);
  }

  /** A speed jump button press, following the remembered-speed excursion rules within
   *  0.3x–1.7x. Refused while the deck has nothing shapeable loaded. */
  jumpSpeed(slot: Slot, id: 'up' | 'home' | 'down'): void {
    if (!this.canShape(slot, 'jumpSpeed')) {
      return;
    }
    this.deckSpeed.jump(slot, id);
    this.reflectEngineControls(slot);
  }

  /** A nudge pad's press or release. A press is refused while the deck has nothing shapeable
   *  loaded; a release is always honoured, so a nudge can never be left stuck. A non-finite or
   *  non-positive `amount` falls back to the default. */
  setNudge(
    slot: Slot,
    direction: NudgeDirection,
    held: boolean,
    amount: number = NUDGE_DEFAULT_AMOUNT
  ): void {
    if (held && !this.canShape(slot, 'setNudge')) {
      return;
    }
    const usable = Number.isFinite(amount) && amount > 0 ? amount : NUDGE_DEFAULT_AMOUNT;
    this.deckSpeed.setNudge(slot, direction, held, usable);
    this.reflectEngineControls(slot);
  }

  /** Latches or unlatches a voice's mute. Refused while the deck has nothing shapeable loaded. */
  setVoiceMuted(slot: Slot, voice: number, muted: boolean): void {
    if (!this.canShape(slot, 'setVoiceMuted')) {
      return;
    }
    this.runtime.setVoiceMuted(slot, voice, muted);
    this.reflectEngineControls(slot);
  }

  /** Holds or releases a voice. A release is always honoured — a hold must never be left stuck
   *  because the deck stopped being shapeable while the button was down. */
  setVoiceHeld(slot: Slot, voice: number, held: boolean): void {
    if (held && !this.canShape(slot, 'setVoiceHeld')) {
      return;
    }
    this.runtime.setVoiceHeld(slot, voice, held);
    this.reflectEngineControls(slot);
  }

  /** Marks the playhead as a new cue and selects it. */
  addMarker(slot: Slot): void {
    if (this.canShape(slot, 'addMarker')) {
      this.loops.add(slot);
    }
  }

  selectMarker(slot: Slot, id: string): void {
    if (this.canShape(slot, 'selectMarker')) {
      this.loops.select(slot, id);
    }
  }

  /** Moves the marker selection by `delta` places, stopping at the ends. */
  moveMarkerSelection(slot: Slot, delta: number): void {
    if (this.canShape(slot, 'moveMarkerSelection')) {
      this.loops.move(slot, delta);
    }
  }

  /** Selects the marker at `index`, rounded and clamped into the list. */
  selectMarkerAt(slot: Slot, index: number): void {
    if (this.canShape(slot, 'selectMarkerAt')) {
      this.loops.selectAt(slot, index);
    }
  }

  /** Ends the selected marker at the playhead, making it a loop. */
  setMarkerEnd(slot: Slot): void {
    if (this.canShape(slot, 'setMarkerEnd')) {
      this.loops.setEnd(slot);
    }
  }

  clearMarkerEnd(slot: Slot): void {
    if (this.canShape(slot, 'clearMarkerEnd')) {
      this.loops.clearEnd(slot);
    }
  }

  deleteMarker(slot: Slot): void {
    if (this.canShape(slot, 'deleteMarker')) {
      this.loops.remove(slot);
    }
  }

  /** Sets a boundary of the selected marker to `offsetFrames` from where it was captured, then
   *  auditions it. A running marker is not auditioned: the nudge already reaches the engine. */
  nudgeMarker(slot: Slot, boundary: LoopBoundaryName, offsetFrames: number): void {
    if (!this.canShape(slot, 'nudgeMarker')) {
      return;
    }
    this.loops.nudge(slot, boundary, offsetFrames);
    const { selectedId, runningId } = this.store.loops()[slot];
    if (selectedId !== null && selectedId !== runningId) {
      this.loops.audition(slot, boundary);
    }
  }

  /**
   * Presses a marker — the selected one when `id` is omitted, and nothing when none is. Idle, it
   * starts looping, or queues behind the loop running; queued, it cancels; running, it lets go. A
   * press that starts a marker on a deck that is not playing starts playback first, through the
   * same path as Play.
   */
  async toggleMarker(slot: Slot, id?: string): Promise<void> {
    if (!this.canShape(slot, 'toggleMarker')) {
      return;
    }
    const { selectedId, runningId, queuedId } = this.store.loops()[slot];
    const target = id ?? selectedId;
    if (target === null) {
      return;
    }
    const starts = target !== runningId && target !== queuedId;
    if (starts && this.store.deck(slot)().status !== 'playing') {
      await this.togglePlayPause(slot);
      if (this.store.deck(slot)().status !== 'playing') {
        return;
      }
    }
    this.loops.toggle(slot, target);
  }

  /** Lets the running marker loop go and drops whatever is queued. The playhead never moves. */
  stopMarkerLoop(slot: Slot): void {
    if (this.canShape(slot, 'stopMarkerLoop')) {
      this.loops.stop(slot);
    }
  }

  /** Nudges a boundary of the selected marker onto the next detected moment in `direction`. */
  snapMarker(slot: Slot, boundary: LoopBoundaryName, direction: LoopSnapDirection): void {
    if (this.canShape(slot, 'snapMarker')) {
      this.loops.snap(slot, boundary, direction);
    }
  }

  /** Loads both slots' cartridge bindings from the saved MIDI settings, reconciles them against
   *  what is currently enumerated, and installs the effects that keep reconciling from then on.
   *  The constructor above builds the runtimes a bind can target; this is the separate call
   *  `DjBootstrapService` makes in the same startup beat, so a spec can construct this service
   *  without the settings ever loading. */
  async hydrate(): Promise<void> {
    await this.bindings.hydrate();
  }

  /** Binds the slot to a TeensyROM device by id; `null` clears it. */
  bindDevice(slot: Slot, deviceId: string | null): void {
    this.bindings.bindDevice(slot, deviceId);
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
   *  it was already holding. Specs exercise this indirectly, through the public commands that
   *  already call it. */
  private sample(slot: Slot): void {
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

    this.applied[slot] = { transport: snapshot.transport, subtune: snapshot.tune.subtune };

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

  /** Whether the engine's transport or current subtune differs from what `applySnapshot` last
   *  landed for this slot — the only notifications worth re-running its writes and logs for. */
  private transitioned(slot: Slot): boolean {
    const snapshot = this.runtime.snapshot(slot);
    const applied = this.applied[slot];
    return (
      applied === null ||
      applied.transport !== snapshot.transport ||
      applied.subtune !== (snapshot.tune?.subtune ?? null)
    );
  }

  /** Mirrors the engine's tempo and voice state, and the speed controls' fader value and nudge
   *  state, onto the store, writing only on a difference — every notification calls this,
   *  including those during a load's suspended window. */
  private reflectEngineControls(slot: Slot): void {
    const { tempo, voices } = this.runtime.snapshot(slot);
    const faderSpeed = this.deckSpeed.faderValue(slot);
    const nudging = this.deckSpeed.isNudging(slot);
    const deck = this.store.deck(slot)();
    if (
      deck.speed !== tempo.multiplier ||
      deck.faderSpeed !== faderSpeed ||
      deck.nudging !== nudging ||
      !sameVoices(deck.voices, voices)
    ) {
      this.store.setDeckEngineControls({ slot, speed: tempo.multiplier, faderSpeed, nudging, voices });
    }
  }

  /** Returns the deck's tune-shaping controls to home on both the store and the engine: the SID
   *  panel and detected key (via the applier), tempo, held nudges and any open speed excursion,
   *  latched mutes and holds. */
  private resetTuneShaping(slot: Slot): void {
    this.mixerApplier.resetPanel(slot);
    this.deckSpeed.reset(slot);
    this.runtime.clearVoiceMutes(slot);
    for (const voice of VOICES) {
      this.runtime.setVoiceHeld(slot, voice, false);
    }
    this.reflectEngineControls(slot);
  }

  /** Drops the marker loop and anything queued behind it or waiting for readiness; a no-op while
   *  neither is set, so the repeat setting and the engine are left alone. */
  private releaseMarkers(slot: Slot): void {
    const { runningId, queuedId } = this.store.loops()[slot];
    if (runningId !== null || queuedId !== null) {
      this.loops.disengage(slot);
    }
  }

  /** The gate for the speed, voice and marker commands: true when the deck's controls are live,
   *  otherwise warns once naming the slot and command, and returns false. */
  private canShape(slot: Slot, command: string): boolean {
    if (this.store.canShape(slot)()) {
      return true;
    }
    logWarn(`DeckService: deck ${slot} has nothing shapeable loaded — ${command} refused.`);
    return false;
  }

  /** A `requestAnimationFrame` loop for this slot, running only while it is `playing` and paused
   *  while the document is hidden — the POC's `animationFrameSignal` bridge rule, generalised per
   *  slot. Samples and paints the SID panel only when the polled frame actually moved; every other
   *  reason to sample runs through the explicit calls each command already makes. Reschedules
   *  first, so a fault in either cannot end the loop. */
  private watchPosition(slot: Slot): void {
    let frameId: number | null = null;
    let lastFrame: number | null = null;

    const tick = (): void => {
      frameId = requestAnimationFrame(tick);
      const position = this.runtime.position(slot);
      if (position !== lastFrame) {
        lastFrame = position;
        this.sample(slot);
        this.panelPainter.paint(slot);
      }
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
