import { Injectable, effect, inject } from '@angular/core';
import type { TuneReference } from '@sidablist/tunes';
import { logError, logWarn } from '@teensyrom-nx/utils';
import { DeckRuntime } from './deck-runtime';
import { DeckBindings } from './deck-bindings';
import { DeckLoops } from './deck-loops';
import { DeckMemoryKeeper } from './deck-memory-keeper';
import { DeckSpeed, type NudgeDirection } from './deck-speed';
import { NUDGE_DEFAULT_AMOUNT } from './mixer/speed-excursion';
import { MixerApplier } from './mixer-applier';
import { SidPanelPainter } from './sid-panel-painter';
import { RowUnavailableError, TuneLoader, type LoadPhase } from './tune-loader';
import {
  DjStore,
  type DeckDetectedKey,
  type DeckHolding,
  type DeckStatus,
  type DeckVoiceState,
} from './dj-store';
import { decodeRowSettings, type DeckRowSettings } from './loops/row-settings-codec';
import { DjSets } from './sets/dj-sets';
import { decodeRowHost } from './sets/row-host';
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

/** What a load puts on a deck: a SID dropped from the listing, or a row already in an open set. */
type LoadTarget = { readonly drop: LoadSource } | { readonly row: DeckHolding };

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
 * Every load puts a row of the current set on the deck: a listing drop joins the set (or reuses the
 * SID's row) and loads it, and `loadRow` loads a row of any open set. Every load and subtune switch
 * restores the row's latched state for the subtune it lands on — the SID panel, mutes, speed and
 * Repeat as last left, with holds, nudges and any speed excursion at home, and everything at home
 * for a subtune with nothing kept — so a new tune never inherits the last one's settings. It
 * attaches the subtune's markers before it plays.
 *
 * It also fronts the speed, nudge, voice and loop-marker commands and reflects the engine's tempo,
 * voice and prepared-frame state into the store.
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
  private readonly sets = inject(DjSets);
  private readonly keeper = inject(DeckMemoryKeeper);
  private readonly mixerApplier = inject(MixerApplier);
  private readonly panelPainter = inject(SidPanelPainter);

  /** This service's own per-slot command counter — distinct from the loader's generation, which
   *  guards only the loader's own awaits. Bumped by `loadOnto` and `selectSubtune` on entry; every
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

  /** A SID dropped from the listing: joins the current set, or reuses its row there, and loads that
   *  row. */
  async load(slot: Slot, source: LoadSource): Promise<void> {
    await this.loadOnto(slot, { drop: source });
  }

  /** Loads a row of an open set onto the deck, replacing whatever it plays. */
  async loadRow(slot: Slot, setId: string, rowId: string): Promise<void> {
    const holding = this.sets.holdingFor(setId, rowId);
    if (holding === null) {
      logWarn(
        `DeckService: row ${rowId} of set ${setId} is not open — loadRow refused for deck ${slot}.`
      );
      return;
    }
    await this.loadOnto(slot, { row: holding });
  }

  /** Loads the current set's selected row onto the deck, replacing whatever plays. Nothing when none
   *  is selected. */
  async loadSelected(slot: Slot): Promise<void> {
    const rowId = this.store.sets.selectedRowId();
    if (rowId !== null) {
      await this.loadSetRow(slot, rowId);
    }
  }

  /** Loads a row of the current set onto the deck, replacing whatever plays — what a row dragged
   *  from the set list asks for. Nothing when there is no current set or it has no such row. */
  async loadSetRow(slot: Slot, rowId: string): Promise<void> {
    const set = this.currentSet();
    if (set !== null && set.rows.some((row) => row.id === rowId)) {
      await this.loadRow(slot, set.id, rowId);
    }
  }

  /** Loads the row before the one the deck holds in the current set — skipping nothing, even a row
   *  the other deck holds. Nothing on the first row, or when the deck holds no row of the current
   *  set. */
  previousRow(slot: Slot): Promise<void> {
    return this.loadNeighbour(slot, -1);
  }

  /** Loads the row after the one the deck holds in the current set; nothing on the last row. */
  nextRow(slot: Slot): Promise<void> {
    return this.loadNeighbour(slot, 1);
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
    const holding = this.store.sets.holdings()[slot];
    if (holding === null) {
      logWarn(`DeckService: deck ${slot} holds no row — selectSubtune refused.`);
      return;
    }

    const target = Math.min(Math.max(Math.round(subtune), 1), current.subtuneCount);
    const previousStatus = current.status;
    const sidHash = current.loaded.identity.sidHash;

    // Before anything can close the set of the row the deck holds now.
    this.keeper.flush(slot);
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
      // The new subtune is recorded as the row's last and taken with its kept state in one step,
      // before the first await.
      const moved = this.sets.selectSubtune(holding, target);
      const restored = this.takeRow(slot, moved);

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
      if (restored !== null) {
        this.applyMutes(slot, restored.mixer.mutes);
      }
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
        {
          placementKey: `${moved.setId}:${moved.rowId}`,
          identity: playable.reference.identity,
          positions: this.sets.positionsFor(moved),
        },
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

  /** Latches or unlatches a voice's mute, and keeps it in the marker whose own settings are in
   *  play. Refused while the deck has nothing shapeable loaded. */
  setVoiceMuted(slot: Slot, voice: number, muted: boolean): void {
    if (!this.canShape(slot, 'setVoiceMuted')) {
      return;
    }
    this.runtime.setVoiceMuted(slot, voice, muted);
    this.reflectEngineControls(slot);
    this.loops.saveSettingsInPlay(slot);
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

  /** Names a marker; an empty name returns it to its place in the list. */
  renameMarker(slot: Slot, id: string, name: string): void {
    if (this.canShape(slot, 'renameMarker')) {
      this.loops.rename(slot, id, name);
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

  /** Flips the selected marker's GBL: unlatched it keeps its own settings, latched it shares the
   *  main track's. On the marker running or in play it applies at once. */
  toggleMarkerGlobal(slot: Slot): void {
    if (this.canShape(slot, 'toggleMarkerGlobal')) {
      this.loops.toggleGlobal(slot);
    }
  }

  /** Sets a boundary of the selected marker to `offsetFrames` from where it was captured, then
   *  auditions it on this deck, whatever is running or queued. The edit lands before the first
   *  await; a deck that is not playing is started first, as `toggleMarker` does. */
  async nudgeMarker(slot: Slot, boundary: LoopBoundaryName, offsetFrames: number): Promise<void> {
    if (this.canShape(slot, 'nudgeMarker')) {
      await this.auditionEdit(slot, boundary, this.loops.nudge(slot, boundary, offsetFrames));
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

  /**
   * Jumps into a marker now — the selected one when `id` is omitted, and nothing when none is —
   * without waiting for the lap, restarting it when it is the one running. A deck that is not
   * playing is started first, through the same path as Play, as `toggleMarker` does.
   */
  async playMarkerNow(slot: Slot, id?: string): Promise<void> {
    if (!this.canShape(slot, 'playMarkerNow')) {
      return;
    }
    const target = id ?? this.store.loops()[slot].selectedId;
    if (target === null) {
      return;
    }
    if (this.store.deck(slot)().status !== 'playing') {
      await this.togglePlayPause(slot);
      if (this.store.deck(slot)().status !== 'playing') {
        return;
      }
    }
    this.loops.playNow(slot, target);
  }

  /** Lets the running marker loop go and drops whatever is queued. The playhead never moves. */
  stopMarkerLoop(slot: Slot): void {
    if (this.canShape(slot, 'stopMarkerLoop')) {
      this.loops.stop(slot);
    }
  }

  /** Nudges a boundary of the selected marker onto the next detected moment in `direction`, then
   *  auditions it as `nudgeMarker` does — also when no moment is in reach. */
  async snapMarker(
    slot: Slot,
    boundary: LoopBoundaryName,
    direction: LoopSnapDirection
  ): Promise<void> {
    if (this.canShape(slot, 'snapMarker')) {
      await this.auditionEdit(slot, boundary, this.loops.snap(slot, boundary, direction));
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

  /**
   * The one load routine: a listing drop and a set row differ only in how the row is found. A row
   * loaded by name is taken in the synchronous prologue; a drop's row is taken as soon as it is
   * joined, if this load is still the newest. A failed load leaves the deck at home — or, once it
   * has taken a row, on that row's restored state — and `failed`, which is never shapeable, so the
   * keeper writes neither into a row.
   */
  private async loadOnto(slot: Slot, target: LoadTarget): Promise<void> {
    // Before anything can close the set of the row the deck holds now.
    this.keeper.flush(slot);
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

    let holding: DeckHolding | null = null;
    let known: TuneReference | null = null;
    let failure: string | null = null;
    try {
      const onPhase: LoadPhase = (phase, reference) => {
        if (this.sequence[slot] !== mySeq) {
          return;
        }
        this.store.setDeckStatus({ slot, status: phase });
        const shown = reference ?? known;
        if (shown !== null) {
          this.store.setDeckLoaded({ slot, reference: shown });
        }
      };

      let restored: DeckRowSettings | null;
      if ('row' in target) {
        holding = target.row;
        restored = this.takeRow(slot, holding);
      } else {
        known = await this.loader.reference(slot, target.drop, onPhase);
        if (known === null || this.sequence[slot] !== mySeq) {
          // Either a newer command owns the slot now, or the loader's own generation guard already
          // discarded this load in favour of one — nothing more to write either way.
          return;
        }
        const joined = await this.sets.joinForDeck(known, target.drop);
        if (this.sequence[slot] !== mySeq) {
          return;
        }
        holding = joined;
        restored = this.takeRow(slot, joined);
      }

      const playable = await this.loader.resolveRow(
        slot,
        { sidHash: holding.sidHash, subtune: holding.subtune },
        decodeRowHost(this.sets.rowOf(holding)?.host)?.source ?? null,
        onPhase
      );
      if (this.sequence[slot] !== mySeq || playable === null) {
        return;
      }
      this.sets.markAvailable(holding.rowId);

      this.runtime.load(slot, playable);
      if (restored !== null) {
        // `loadTune` cleared every latched mute.
        this.applyMutes(slot, restored.mixer.mutes);
      }
      this.store.setDeckDetectedKey({ slot, detectedKey: detectedKeyOf(playable.index) });
      // Lands the reference even on a cache hit, when the loader's own callback above never fired
      // for either phase.
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
        {
          placementKey: `${holding.setId}:${holding.rowId}`,
          identity: playable.reference.identity,
          positions: this.sets.positionsFor(holding),
        },
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
      if (
        error instanceof RowUnavailableError &&
        holding !== null &&
        this.sequence[slot] === mySeq
      ) {
        this.sets.markUnavailable(holding.rowId, error.message);
      }
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

  private currentSet() {
    const id = this.store.sets.currentSetId();
    return id === null ? null : this.store.sets.open()[id] ?? null;
  }

  /** Loads the row `step` places from the deck's, when the deck holds a row of the current set and
   *  the neighbour exists. Not gated on `busy`: the load supersedes an in-flight one, as a drop
   *  does. */
  private async loadNeighbour(slot: Slot, step: -1 | 1): Promise<void> {
    const position = this.store.deckSetSummary(slot)();
    const set = this.currentSet();
    const holding = this.store.sets.holdings()[slot];
    if (!(step < 0 ? position.canPrevious : position.canNext) || set === null || holding === null) {
      return;
    }
    const neighbour = set.rows[set.rows.findIndex((row) => row.id === holding.rowId) + step];
    if (neighbour !== undefined) {
      await this.loadRow(slot, set.id, neighbour.id);
    }
  }

  /** Puts the deck on a row: records the holding, then lands the kept state of its subtune. One
   *  synchronous step, never split by an await — a holding without its restore, or the reverse,
   *  would let a superseded or failed load write home values into a row. Returns the restored
   *  settings, or null when the subtune keeps none and the deck stays at home. */
  private takeRow(slot: Slot, holding: DeckHolding): DeckRowSettings | null {
    this.sets.hold(slot, holding);
    return this.restoreTuneShaping(slot, holding);
  }

  /** Lands the row's latched state for the holding's subtune, after `resetTuneShaping` has returned
   *  the deck to home: the panel, mutes, speed fader and Repeat. Holds, nudges and excursions stay
   *  at home, and so does a subtune with nothing kept. */
  private restoreTuneShaping(slot: Slot, holding: DeckHolding): DeckRowSettings | null {
    const settings = decodeRowSettings(this.sets.subtuneSettingsOf(holding));
    if (settings === null) {
      return null;
    }
    this.store.restoreDeckPanel({ slot, panel: settings.mixer.panel });
    this.mixerApplier.applyDeck(slot);
    this.applyMutes(slot, settings.mixer.mutes);
    this.deckSpeed.setFader(slot, settings.speed);
    this.setRepeat(slot, settings.repeat);
    this.reflectEngineControls(slot);
    return settings;
  }

  /** Latches each voice's mute on the engine and reflects it. */
  private applyMutes(slot: Slot, mutes: readonly [boolean, boolean, boolean]): void {
    mutes.forEach((muted, voice) => this.runtime.setVoiceMuted(slot, voice, muted));
    this.reflectEngineControls(slot);
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

  /** Auditions the boundary of marker `edited` — the marker an accepted edit just changed; null for
   *  a refused one, which starts nothing. A deck that is not playing is started first, which
   *  resumes a pause and restarts a stop from the top. The marker is fixed up front, since a
   *  selection change can land during that wait, and `DeckLoops` skips it then. */
  private async auditionEdit(
    slot: Slot,
    boundary: LoopBoundaryName,
    edited: string | null
  ): Promise<void> {
    if (edited === null) {
      return;
    }
    if (this.store.deck(slot)().status !== 'playing') {
      await this.togglePlayPause(slot);
      if (this.store.deck(slot)().status !== 'playing') {
        return;
      }
    }
    this.loops.audition(slot, boundary, edited);
  }

  /** Drops the marker loop, anything queued behind it or waiting for readiness, and a marker's
   *  own settings in play; a no-op while none is set, so the repeat setting and the engine are
   *  left alone. */
  private releaseMarkers(slot: Slot): void {
    const { runningId, queuedId, settingsInPlayId } = this.store.loops()[slot];
    if (runningId !== null || queuedId !== null || settingsInPlayId !== null) {
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
