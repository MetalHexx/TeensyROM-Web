import { Injectable, inject } from '@angular/core';
import { logError, logWarn } from '@teensyrom-nx/utils';
import type { LoopMarker, TuneIdentity } from '@sidablist/tunes';
import { DeckRuntime } from './deck-runtime';
import {
  DjStore,
  EMPTY_DECK_LOOPS,
  type DeckLoopBoundary,
  type DeckLoopMarker,
  type DeckLoopsState,
} from './dj-store';
import { LOOP_POSITIONS_STORE } from './ports';
import { otherSlot, type Slot } from './slot';
import {
  clamp,
  nudgeLimits,
  oneSecondFrames,
  resolvedFrame,
  type LoopBoundaryName,
} from './loops/loop-marker-math';
import { nextOffset, type LoopSnapDirection } from './loops/moment-reach';

/** The SID's three voices: a new marker plays them all. */
const ALL_VOICES: readonly number[] = [0, 1, 2];

function sameTune(a: TuneIdentity, b: TuneIdentity): boolean {
  return a.sidHash === b.sidHash && a.subtune === b.subtune;
}

/** What a marker list is stored as: the marker without its readiness. */
function stored(marker: DeckLoopMarker): LoopMarker {
  return { id: marker.id, start: marker.start, end: marker.end, voices: marker.voices };
}

/** The selection a deck keeps when its list becomes `next`: the same marker where it still exists,
 *  else the marker that took its place, else the one before it, else none. */
function reselect(
  previous: readonly DeckLoopMarker[],
  previousId: string | null,
  next: readonly DeckLoopMarker[]
): string | null {
  if (next.length === 0) {
    return null;
  }
  if (previousId !== null && next.some((marker) => marker.id === previousId)) {
    return previousId;
  }
  const index = previous.findIndex((marker) => marker.id === previousId);
  return next[index < 0 ? 0 : Math.min(index, next.length - 1)].id;
}

/**
 * Each deck's loop markers: the list for the tune it holds, the readiness of each marker's start
 * in the engine, and every edit to the list.
 *
 * Attaching a tune loads its saved markers and declares their start frames to the engine, which
 * prepares each off the main thread; `reflect` mirrors the engine's published readiness onto the
 * list. Every edit writes through to the positions store, and to the other deck when it holds the
 * same tune — through the one `land` routine a local edit uses, so the other deck's readiness always
 * comes from its own engine.
 *
 * The engine notifies synchronously inside calls such as `capturePosition` and `setJumpTargets`,
 * and `reflect` runs in that notification. Every path here therefore writes the store before it
 * calls the engine, so `reflect` never reads a half-updated list.
 */
@Injectable({ providedIn: 'root' })
export class DeckLoops {
  private readonly runtime = inject(DeckRuntime);
  private readonly store = inject(DjStore);
  private readonly positions = inject(LOOP_POSITIONS_STORE);

  /** The tune each slot's markers belong to; null while nothing is attached. */
  private readonly attached: Record<Slot, TuneIdentity | null> = { A: null, B: null };

  /** Bumped by every `attach` and `detach`: an attach whose load resolves after a newer one has
   *  started drops its result instead of writing over it. */
  private readonly attachTokens: Record<Slot, number> = { A: 0, B: 0 };

  /** Loads the tune's saved markers into the deck, selects the first, and declares their start
   *  frames to the engine. A store that fails to load is logged and leaves the deck with no
   *  markers. */
  async attach(
    slot: Slot,
    identity: TuneIdentity,
    detectedMoments: readonly number[]
  ): Promise<void> {
    const token = ++this.attachTokens[slot];
    this.attached[slot] = null;

    let saved: readonly LoopMarker[] = [];
    try {
      saved = await this.positions.load(identity);
    } catch (error) {
      logError(`DeckLoops: loading deck ${slot}'s loops failed`, error);
    }
    if (this.attachTokens[slot] !== token) {
      return;
    }

    this.attached[slot] = identity;
    const markers = saved.map((marker): DeckLoopMarker => ({ ...marker, ready: false }));
    this.store.setDeckLoops({
      slot,
      loops: {
        ...EMPTY_DECK_LOOPS,
        markers,
        selectedId: markers[0]?.id ?? null,
        detectedMoments: [...detectedMoments].sort((a, b) => a - b),
      },
    });
    this.declare(slot);
    this.reflect(slot);
  }

  /** Clears the deck's loop state and cancels an attach still loading. The positions store is
   *  never touched: the saved markers stay for the next time the tune is loaded. */
  detach(slot: Slot): void {
    this.attachTokens[slot]++;
    this.attached[slot] = null;
    if (this.loopsOf(slot) !== EMPTY_DECK_LOOPS) {
      this.store.setDeckLoops({ slot, loops: EMPTY_DECK_LOOPS });
    }
  }

  /** Mirrors the engine's prepared frames onto the deck's markers' readiness, writing only when a
   *  flag changed. */
  reflect(slot: Slot): void {
    if (this.attached[slot] === null) {
      return;
    }
    const prepared = this.preparedOf(slot);
    const { markers } = this.loopsOf(slot);
    const next = markers.map((marker) => {
      const ready = prepared.has(resolvedFrame(marker.start));
      return ready === marker.ready ? marker : { ...marker, ready };
    });
    if (next.some((marker, i) => marker !== markers[i])) {
      this.store.setLoopMarkers({ slot, markers: next });
    }
  }

  /** Marks the playhead as a new cue and selects it. */
  add(slot: Slot): void {
    if (this.identityOf(slot, 'add') === null) {
      return;
    }
    const frame = this.runtime.capturePosition(slot);
    if (frame === null) {
      this.refuse(slot, 'add', 'has no position to capture');
      return;
    }
    const marker: DeckLoopMarker = {
      id: crypto.randomUUID(),
      start: { frame, offsetFrames: 0 },
      end: null,
      voices: ALL_VOICES,
      ready: false,
    };
    this.commit(slot, [...this.loopsOf(slot).markers, marker], marker.id);
  }

  select(slot: Slot, id: string): void {
    if (!this.loopsOf(slot).markers.some((marker) => marker.id === id)) {
      this.refuse(slot, 'select', `has no marker ${id}`);
      return;
    }
    this.selectId(slot, id);
  }

  /** Moves the selection by `delta` places, stopping at the ends. */
  move(slot: Slot, delta: number): void {
    const { markers, selectedId } = this.loopsOf(slot);
    if (!Number.isFinite(delta) || markers.length === 0) {
      return;
    }
    const index = markers.findIndex((marker) => marker.id === selectedId);
    const from = index >= 0 ? index : delta > 0 ? -1 : markers.length;
    this.selectId(slot, markers[clamp(from + Math.round(delta), 0, markers.length - 1)].id);
  }

  /** Selects the marker at `index`, rounded and clamped into the list. */
  selectAt(slot: Slot, index: number): void {
    const { markers } = this.loopsOf(slot);
    if (!Number.isFinite(index) || markers.length === 0) {
      return;
    }
    this.selectId(slot, markers[clamp(Math.round(index), 0, markers.length - 1)].id);
  }

  /** Ends the selected marker at the playhead, making it a loop. Refused unless the playhead is
   *  after the marker's start. */
  setEnd(slot: Slot): void {
    const marker = this.selectedMarker(slot, 'setEnd');
    if (marker === null) {
      return;
    }
    const position = this.runtime.position(slot);
    if (!(position > resolvedFrame(marker.start))) {
      this.refuse(slot, 'setEnd', 'playhead is not after the marker start');
      return;
    }
    this.replaceSelected(slot, { ...marker, end: { frame: position, offsetFrames: 0 } });
  }

  /** Turns the selected loop back into a cue. */
  clearEnd(slot: Slot): void {
    const marker = this.selectedMarker(slot, 'clearEnd');
    if (marker === null || marker.end === null) {
      return;
    }
    this.replaceSelected(slot, { ...marker, end: null });
  }

  /** Deletes the selected marker. The selection moves to the marker that took its place, else the
   *  one before, else none. */
  remove(slot: Slot): void {
    const marker = this.selectedMarker(slot, 'remove');
    if (marker === null) {
      return;
    }
    const { markers, selectedId } = this.loopsOf(slot);
    const next = markers.filter((other) => other.id !== marker.id);
    this.commit(slot, next, reselect(markers, selectedId, next));
  }

  /** Sets a boundary's nudge to `offsetFrames`, held within one second either way and so the loop's
   *  end stays after its start. */
  nudge(slot: Slot, boundary: LoopBoundaryName, offsetFrames: number): void {
    const marker = this.selectedMarker(slot, 'nudge');
    if (marker === null || !Number.isFinite(offsetFrames)) {
      return;
    }
    const target = this.boundaryOf(slot, marker, boundary, 'nudge');
    if (target === null) {
      return;
    }
    const { min, max } = nudgeLimits(marker, boundary, this.oneSecond(slot));
    const offset = clamp(Math.round(offsetFrames), min, max);
    if (offset === target.offsetFrames) {
      return;
    }
    const moved = { ...target, offsetFrames: offset };
    this.replaceSelected(
      slot,
      boundary === 'start' ? { ...marker, start: moved } : { ...marker, end: moved }
    );
  }

  /** Nudges a boundary to the next detected moment in `direction` within a second of where it was
   *  captured; does nothing when there is none. Never auditions. */
  snap(slot: Slot, boundary: LoopBoundaryName, direction: LoopSnapDirection): void {
    const marker = this.selectedMarker(slot, 'snap');
    if (marker === null) {
      return;
    }
    const target = this.boundaryOf(slot, marker, boundary, 'snap');
    if (target === null) {
      return;
    }
    const offset = nextOffset(
      this.loopsOf(slot).detectedMoments,
      target.frame,
      target.offsetFrames,
      this.oneSecond(slot),
      direction
    );
    if (offset !== null) {
      this.nudge(slot, boundary, offset);
    }
  }

  /** Lands a changed list on the slot, saves it, and gives it to the other deck when that deck
   *  holds the same tune. */
  private commit(slot: Slot, markers: readonly DeckLoopMarker[], selectedId: string | null): void {
    const identity = this.attached[slot];
    if (identity === null) {
      return;
    }
    this.land(slot, markers, selectedId);
    this.save(slot, identity, markers);

    const other = otherSlot(slot);
    const otherIdentity = this.attached[other];
    if (otherIdentity !== null && sameTune(identity, otherIdentity)) {
      const { markers: before, selectedId: beforeId } = this.loopsOf(other);
      this.land(other, markers, reselect(before, beforeId, markers));
    }
  }

  /**
   * The one routine that puts a list on a deck, for a local edit and for the other deck alike:
   * store first — each marker's readiness taken from this deck's own engine — then the engine's
   * targets, then a reflect for whatever the declaration made ready.
   */
  private land(slot: Slot, markers: readonly DeckLoopMarker[], selectedId: string | null): void {
    const prepared = this.preparedOf(slot);
    this.store.setLoopMarkers({
      slot,
      markers: markers.map((marker) => ({
        ...marker,
        ready: prepared.has(resolvedFrame(marker.start)),
      })),
    });
    this.selectId(slot, selectedId);
    this.declare(slot);
    this.reflect(slot);
  }

  /** Declares the sorted, unique resolved start frames of the deck's markers. Ends are never
   *  declared. */
  private declare(slot: Slot): void {
    const starts = new Set(this.loopsOf(slot).markers.map((marker) => resolvedFrame(marker.start)));
    this.runtime.setJumpTargets(
      slot,
      Array.from(starts).sort((a, b) => a - b)
    );
  }

  private save(slot: Slot, identity: TuneIdentity, markers: readonly DeckLoopMarker[]): void {
    this.positions
      .save(identity, markers.map(stored))
      .catch((error: unknown) => logError(`DeckLoops: saving deck ${slot}'s loops failed`, error));
  }

  /** Changes the selection, noting when it moved while a jump is queued. */
  private selectId(slot: Slot, id: string | null): void {
    const { selectedId, selectionMovedWhileQueued, queuedId } = this.loopsOf(slot);
    if (id === selectedId) {
      return;
    }
    this.store.setLoopSelection({
      slot,
      selectedId: id,
      selectionMovedWhileQueued: selectionMovedWhileQueued || queuedId !== null,
    });
  }

  private replaceSelected(slot: Slot, updated: DeckLoopMarker): void {
    const { markers, selectedId } = this.loopsOf(slot);
    this.commit(
      slot,
      markers.map((marker) => (marker.id === updated.id ? updated : marker)),
      selectedId
    );
  }

  private boundaryOf(
    slot: Slot,
    marker: DeckLoopMarker,
    boundary: LoopBoundaryName,
    command: string
  ): DeckLoopBoundary | null {
    const target = boundary === 'start' ? marker.start : marker.end;
    if (target === null) {
      this.refuse(slot, command, 'selected marker has no end');
    }
    return target;
  }

  /** The tune the slot is attached to, or null with a warning naming the refused command. */
  private identityOf(slot: Slot, command: string): TuneIdentity | null {
    const identity = this.attached[slot];
    if (identity === null) {
      this.refuse(slot, command, 'has no tune attached');
    }
    return identity;
  }

  /** The selected marker, or null with a warning naming the refused command. */
  private selectedMarker(slot: Slot, command: string): DeckLoopMarker | null {
    if (this.identityOf(slot, command) === null) {
      return null;
    }
    const { markers, selectedId } = this.loopsOf(slot);
    const marker = markers.find((candidate) => candidate.id === selectedId) ?? null;
    if (marker === null) {
      this.refuse(slot, command, 'has no marker selected');
    }
    return marker;
  }

  private refuse(slot: Slot, command: string, reason: string): void {
    logWarn(`DeckLoops: deck ${slot} ${reason} — ${command} refused.`);
  }

  private loopsOf(slot: Slot): DeckLoopsState {
    return this.store.loops()[slot];
  }

  private oneSecond(slot: Slot): number {
    return oneSecondFrames(this.store.decks()[slot].playCallIntervalUs);
  }

  private preparedOf(slot: Slot): ReadonlySet<number> {
    return new Set<number>(this.runtime.snapshot(slot).tune?.preparedFrames ?? []);
  }
}
