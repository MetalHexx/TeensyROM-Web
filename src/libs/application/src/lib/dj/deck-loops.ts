import { Injectable, inject } from '@angular/core';
import { logError, logWarn } from '@teensyrom-nx/utils';
import type { JumpSettings, VarispeedLoopStart } from '@sidablist/core';
import type { LoopMarker, LoopPositionsStore, TuneIdentity } from '@sidablist/tunes';
import { DeckRuntime } from './deck-runtime';
import {
  DjStore,
  EMPTY_DECK_LOOPS,
  type DeckBeatGrid,
  type DeckLoopBoundary,
  type DeckLoopMarker,
  type DeckLoopsState,
  type DeckMixerSettings,
  type DeckPanelState,
} from './dj-store';
import { MixerApplier } from './mixer-applier';
import { otherSlot, type Slot } from './slot';
import {
  clamp,
  markerKind,
  nudgeLimits,
  oneSecondFrames,
  resolvedFrame,
  type LoopBoundaryName,
} from './loops/loop-marker-math';
import { decodeMixerSettings, encodeMixerSettings } from './loops/marker-settings-codec';
import {
  inGridSpan,
  lengthLadder,
  MOVE_STEPS,
  nearestBeat,
  nextBeat,
  onBeat,
  type MoveStep,
  type MoveStepBeats,
} from './grid/beat-math';
import { engineSettingsOf } from './mixer/engine-settings';
import {
  MARKER_NAME_MAX_LENGTH,
  MAX_MARKERS_PER_SUBTUNE,
  sanitizeName,
} from './sets/set-limits';

/** The SID's three voices: a new marker plays them all. */
const ALL_VOICES: readonly number[] = [0, 1, 2];

/** The length a cue gains when a Length press has no loop to halve or double. */
const CUE_BEATS = 4;

function sameTune(a: TuneIdentity, b: TuneIdentity): boolean {
  return a.sidHash === b.sidHash && a.subtune === b.subtune;
}

/** What a deck's markers are attached to: where they are read and written, and who else may share
 *  the edits. */
export interface DeckLoopsHolding {
  /** The row the deck holds, as `setId:rowId`. Two decks share edits only when this and the subtune
   *  match. */
  readonly placementKey: string;
  readonly identity: TuneIdentity;
  /** Where this deck reads and writes the markers: one subtune of that row. */
  readonly positions: LoopPositionsStore;
}

/** A loop's bounds in the engine's terms: the resolved start and end frames, and what backing a
 *  scrubbed record past the start does. */
interface LoopBounds {
  readonly startFrame: number;
  readonly endFrame: number;
  readonly varispeedStart: VarispeedLoopStart;
}

/** Where a queued marker waits: in the engine, for the end of the running loop's lap, or here, for
 *  its start to be ready. */
type QueuedVia = 'engine' | 'ready';

/** An edit to the running marker's bounds that waits for the end of the pass instead of applying
 *  at once, with the marker it belongs to. `'engine'` is queued in the engine; `'behind-queued'` is
 *  saved here while a queued marker owns the engine's one queue slot. */
interface EndOfPassEdit {
  readonly markerId: string;
  readonly bounds: LoopBounds;
  readonly via: 'engine' | 'behind-queued';
}

/** When an edit to the running marker's bounds reaches the engine: at once (a nudge), or when the
 *  current pass ends (every other positions edit, and any edit arriving from the other deck). */
type EditTiming = 'immediate' | 'end-of-pass';

type Mutes = DeckMixerSettings['mutes'];

const NO_MUTES: Mutes = [false, false, false];

/** What an edit changed in the list: where the markers are, or only the settings or names they
 *  carry. A settings change fires on every knob tick, so it skips what a position change must
 *  redo. */
type MarkerChange = 'positions' | 'settings';

function sameBoundary(a: DeckLoopBoundary | null, b: DeckLoopBoundary | null): boolean {
  return (
    a === b ||
    (a !== null && b !== null && a.frame === b.frame && a.offsetFrames === b.offsetFrames)
  );
}

function sameBounds(a: LoopBounds, b: LoopBounds): boolean {
  return a.startFrame === b.startFrame && a.endFrame === b.endFrame;
}

function mutesOf(voices: readonly { readonly muted: boolean }[]): Mutes {
  return [voices[0]?.muted ?? false, voices[1]?.muted ?? false, voices[2]?.muted ?? false];
}

function sameMutes(a: Mutes, b: Mutes): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/** The settings a marker plays with itself, or null while it shares the main track's. */
function ownSettingsOf(marker: DeckLoopMarker): DeckMixerSettings | null {
  return marker.ownSettings ? marker.settings : null;
}

/** What the engine runs for a marker: its bounds and WRAP mode as a loop, or null for a cue. */
function loopBoundsOf(marker: DeckLoopMarker): LoopBounds | null {
  return marker.end !== null && markerKind(marker) === 'loop'
    ? {
        startFrame: resolvedFrame(marker.start),
        endFrame: resolvedFrame(marker.end),
        varispeedStart: marker.wraps ? 'wrap' : 'stop',
      }
    : null;
}

/** The jump the engine queues for a marker: a loop, with its WRAP mode, when it has an end, else a
 *  cue. */
function jumpOf(marker: DeckLoopMarker): {
  startFrame: number;
  endFrame: number | null;
  varispeedStart?: VarispeedLoopStart;
} {
  const bounds = loopBoundsOf(marker);
  return {
    startFrame: resolvedFrame(marker.start),
    endFrame: bounds?.endFrame ?? null,
    ...(bounds === null ? {} : { varispeedStart: bounds.varispeedStart }),
  };
}

/** What a marker list is stored as: the marker without its readiness, its settings encoded. */
function stored(marker: DeckLoopMarker): LoopMarker {
  return {
    id: marker.id,
    start: marker.start,
    end: marker.end,
    voices: marker.voices,
    ...(marker.name === null ? {} : { name: marker.name }),
    ...(marker.settings === null ? {} : { settings: encodeMixerSettings(marker.settings) }),
    ...(marker.ownSettings ? { usesOwnSettings: true } : {}),
    ...(marker.wraps ? { wraps: true } : {}),
  };
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
 * Attaching a tune loads the saved markers of the row and subtune the deck holds and declares their
 * start frames to the engine, which prepares each off the main thread; `reflect` mirrors the
 * engine's published readiness onto the list. Every edit writes through to that row's positions, and
 * to the other deck when it holds the same row and subtune — through the one `land` routine a local
 * edit uses, so the other deck's readiness always comes from its own engine. A name is part of the
 * marker and follows the same path.
 *
 * It also performs the markers: toggling one idle, queued or running, queuing through the engine so
 * the hand-off lands at the end of the lap, following a landing with the selection, keeping a
 * running or queued marker true to its edits, and auditioning a boundary after any boundary edit. A
 * marker loop is looping when `runningId` is set; the track's own repeat loop counts as nothing
 * looping.
 *
 * A nudge to the running loop applies at once. Every other edit to its positions (the beat commands
 * In, Out, Length and Move, and any edit arriving from the other deck) is held for the end of the
 * pass: the edited loop is queued in the engine and handed off to when the pass ends, while
 * `runningBounds` keeps publishing the bounds the engine enforces until then.
 *
 * Each marker can keep its own mixer settings (GBL unlatched). The deck's settings in play are the
 * main track's until a jump lands in an independent marker, which swaps its copy in (the main
 * track's held aside) and carries it to the engine with the jump; a jump into a sharing marker
 * brings the main track's back, and so does letting go. Mixer edits reach the copy in play.
 *
 * The engine notifies synchronously inside calls such as `capturePosition`, `setJumpTargets`,
 * `setActiveLoop` and `queueJump`, and `reflect` runs in that notification. Every path here
 * therefore writes the store and its own bookkeeping before it calls the engine, so `reflect`
 * never reads a half-updated state.
 */
@Injectable({ providedIn: 'root' })
export class DeckLoops {
  private readonly runtime = inject(DeckRuntime);
  private readonly store = inject(DjStore);
  private readonly mixerApplier = inject(MixerApplier);

  /** The holding each slot's markers belong to; null while nothing is attached. */
  private readonly attached: Record<Slot, DeckLoopsHolding | null> = { A: null, B: null };

  /** Bumped by every `attach` and `detach`: an attach whose load resolves after a newer one has
   *  started drops its result instead of writing over it. */
  private readonly attachTokens: Record<Slot, number> = { A: 0, B: 0 };

  /** Where the deck's queued marker waits; null while nothing is queued. */
  private readonly queuedVia: Record<Slot, QueuedVia | null> = { A: null, B: null };

  /** The bounds the engine is enforcing for the running marker, which trail its list entry while a
   *  changed start waits for readiness or an edit waits for the end of the pass. Written through
   *  `setEngaged`, which publishes them. */
  private readonly engaged: Record<Slot, LoopBounds | null> = { A: null, B: null };

  /** The running marker's edit waiting for the end of the pass; null when there is none. Dropped
   *  wherever `engaged` is replaced by anything but this edit's own hand-off. */
  private readonly endOfPass: Record<Slot, EndOfPassEdit | null> = { A: null, B: null };

  /** The running marker whose audition is waiting for its changed start to be ready: `reflect` seeks
   *  to that start once it applies. Held only while that marker runs and nothing else is queued. */
  private readonly pendingStart: Record<Slot, string | null> = { A: null, B: null };

  /** The last `tune.handOffs` `reflect` saw. A landing is only ever this rising: the engine drops
   *  its queue for other reasons too, and this collaborator's own edits are among them. */
  private readonly seenHandOffs: Record<Slot, number> = { A: 0, B: 0 };

  /** The voices' latched mutes as of the end of the last `reflect`. At a queued landing the engine
   *  and the store's mirror already hold the landed mutes, so this is what the main track had. */
  private readonly seenMutes: Record<Slot, Mutes> = { A: NO_MUTES, B: NO_MUTES };

  /** The settings the engine's queued jump was built from, or null when it carries none:
   *  `syncQueued` re-queues when the settings the marker would carry now are another object. */
  private readonly queuedSource: Record<Slot, DeckMixerSettings | null> = { A: null, B: null };

  /** Loads the holding's saved markers into the deck, selects the first, and declares their start
   *  frames to the engine. A store that fails to load is logged and leaves the deck with no
   *  markers. */
  async attach(slot: Slot, holding: DeckLoopsHolding): Promise<void> {
    const token = ++this.attachTokens[slot];
    this.attached[slot] = null;

    let saved: readonly LoopMarker[] = [];
    try {
      saved = await holding.positions.load(holding.identity);
    } catch (error) {
      logError(`DeckLoops: loading deck ${slot}'s loops failed`, error);
    }
    if (this.attachTokens[slot] !== token) {
      return;
    }

    this.attached[slot] = holding;
    this.resetActivity(slot);
    // The engine resets its hand-off counter on a load and on a subtune change.
    this.seenHandOffs[slot] = this.runtime.snapshot(slot).tune?.handOffs ?? 0;
    const markers = saved.map((record): DeckLoopMarker => {
      const settings = decodeMixerSettings(record.settings);
      return {
        id: record.id,
        name: record.name ?? null,
        start: record.start,
        end: record.end,
        voices: record.voices,
        settings,
        ownSettings: record.usesOwnSettings === true && settings !== null,
        wraps: record.wraps === true,
        ready: false,
      };
    });
    this.store.setDeckLoops({
      slot,
      loops: {
        ...EMPTY_DECK_LOOPS,
        markers,
        selectedId: markers[0]?.id ?? null,
      },
    });
    this.declare(slot);
    this.reflect(slot);
  }

  /** Clears the deck's loop state and cancels an attach still loading. The positions are never
   *  touched: the saved markers stay for the next time the tune is loaded. */
  detach(slot: Slot): void {
    this.attachTokens[slot]++;
    this.attached[slot] = null;
    this.resetActivity(slot);
    if (this.loopsOf(slot) !== EMPTY_DECK_LOOPS) {
      this.store.setDeckLoops({ slot, loops: EMPTY_DECK_LOOPS });
    }
  }

  /**
   * Follows the engine. Mirrors its prepared frames onto the markers' readiness, writing only when
   * a flag changed, then brings the performance state in line with what it did:
   * - a rising `handOffs` is a queued jump landing — the one thing read as a landing, since a
   *   queue also disappears on `setActiveLoop`, a stop, a load and a subtune change. It is the
   *   running marker's own queued edit landing when one is held and no marker is queued in the
   *   engine, else the queued marker;
   * - no loop at all while a marker is running, with no hand-off, is the engine disarming (a
   *   transport stop, a load), which ends the marker and anything queued. A marker only waiting for
   *   readiness is not seen here — `DeckService` drops it through `disengage` on a stop;
   * - a marker waiting for readiness engages once its start is ready;
   * - a running marker's changed start applies once that start is ready, and an audition waiting
   *   on it seeks there.
   * It ends by noting the voices' mutes, which a queued landing reads as the main track's.
   */
  reflect(slot: Slot): void {
    if (this.attached[slot] === null) {
      return;
    }
    const snapshot = this.runtime.snapshot(slot);
    const handOffs = snapshot.tune?.handOffs ?? 0;
    const handedOff = handOffs > this.seenHandOffs[slot];
    this.seenHandOffs[slot] = handOffs;

    const prepared = this.preparedOf(slot);
    const { markers } = this.loopsOf(slot);
    const next = markers.map((marker) => {
      const ready = prepared.has(resolvedFrame(marker.start));
      return ready === marker.ready ? marker : { ...marker, ready };
    });
    if (next.some((marker, i) => marker !== markers[i])) {
      this.store.setLoopMarkers({ slot, markers: next });
    }

    if (handedOff) {
      if (!this.landEdit(slot)) {
        this.landQueued(slot);
      }
    } else if (snapshot.loop === null && this.loopsOf(slot).runningId !== null) {
      this.resetActivity(slot);
      this.releaseSettings(slot);
    }
    this.engageWhenReady(slot);
    this.syncRunning(slot);
    this.seekToPendingStart(slot);
    // Read afresh: a nested reflect may have stored newer mutes than this one's snapshot held.
    this.seenMutes[slot] = mutesOf(this.runtime.snapshot(slot).voices);
  }

  /**
   * Presses a marker. Idle with nothing looping, it engages now, or once its start is ready; idle
   * with a marker looping, it queues in the engine to land at the end of the lap; queued, it
   * cancels; running, it is let go as `stop` does. A deck that is not playing is started by the
   * caller first.
   */
  toggle(slot: Slot, id: string): void {
    if (this.holdingOf(slot, 'toggle') === null) {
      return;
    }
    const { markers, runningId, queuedId } = this.loopsOf(slot);
    const marker = markers.find((candidate) => candidate.id === id);
    if (marker === undefined) {
      this.refuse(slot, 'toggle', `has no marker ${id}`);
      return;
    }
    if (runningId === id) {
      this.stop(slot);
    } else if (queuedId === id) {
      this.cancelQueue(slot);
    } else if (runningId !== null) {
      this.queueThroughEngine(slot, marker);
    } else {
      this.engageOrWait(slot, marker);
    }
  }

  /**
   * Jumps into marker `id` now, without waiting for the lap. Any marker but the running one engages
   * as `toggle`'s idle press does (now, or once its start is ready), replacing whatever was queued;
   * it never queues behind a running loop and never lets a marker go. The running marker restarts
   * from the start the engine holds, as a stab: the engine and a marker queued behind it are left
   * as they are, and a start audition still waiting is dropped. A deck that is not playing is
   * started by the caller first.
   */
  playNow(slot: Slot, id: string): void {
    if (this.holdingOf(slot, 'playNow') === null) {
      return;
    }
    const { markers, runningId } = this.loopsOf(slot);
    const marker = markers.find((candidate) => candidate.id === id);
    if (marker === undefined) {
      this.refuse(slot, 'playNow', `has no marker ${id}`);
      return;
    }
    const engaged = this.engaged[slot];
    if (runningId === id && engaged !== null) {
      this.pendingStart[slot] = null;
      this.jumpInto(slot, marker, engaged.startFrame);
    } else {
      this.engageOrWait(slot, marker);
    }
  }

  /** Lets the running marker go, drops whatever is queued, and returns the deck to the main
   *  track's settings. The playhead never moves. */
  stop(slot: Slot): void {
    this.resetActivity(slot);
    this.runtime.setActiveLoop(slot, null);
    this.releaseSettings(slot);
  }

  /** A manual scrub or a transport stop: the marker loop, the queue and a wait for readiness are
   *  dropped, so the scrub is not pulled back into a loop and a stopped deck is not re-armed when a
   *  start becomes ready. The repeat-track setting is untouched. */
  disengage(slot: Slot): void {
    this.stop(slot);
  }

  /**
   * Plays marker `id`'s boundary after an edit to it, taking over from any marker running or
   * queued. A start lands on the new start; an end, on a loop only, arms the loop and lands two
   * seconds before it so the wrap is heard. Skipped unless `id` is still the selected marker, as
   * the caller may have waited for playback to start. The caller starts playback first; this
   * never does.
   *
   * An idle or queued marker engages now, through the readiness wait when its start is not ready.
   * A running marker is already on the right bounds, so it only seeks — a start not yet ready
   * seeks once `reflect` has applied it, the marker staying the running one meanwhile.
   */
  audition(slot: Slot, boundary: LoopBoundaryName, id: string): void {
    const { markers, selectedId, runningId } = this.loopsOf(slot);
    const marker = markers.find((candidate) => candidate.id === id);
    if (marker === undefined || selectedId !== id) {
      return;
    }
    if (runningId === id) {
      this.auditionRunning(slot, marker, boundary);
    } else if (boundary === 'start') {
      this.engageOrWait(slot, marker);
    } else {
      const bounds = loopBoundsOf(marker);
      if (bounds !== null) {
        this.arm(slot, marker, false);
        this.jumpInto(
          slot,
          marker,
          Math.max(bounds.startFrame, bounds.endFrame - 2 * this.oneSecond(slot))
        );
      }
    }
  }

  /** Marks the playhead, on the nearest beat when the deck has a grid, as a new cue and selects it. */
  add(slot: Slot): void {
    if (this.holdingOf(slot, 'add') === null) {
      return;
    }
    if (this.loopsOf(slot).markers.length >= MAX_MARKERS_PER_SUBTUNE) {
      this.refuse(
        slot,
        'add',
        `already has the most markers a subtune keeps (${MAX_MARKERS_PER_SUBTUNE})`
      );
      return;
    }
    const frame = this.cueFrame(slot);
    if (frame === null) {
      this.refuse(slot, 'add', 'has no position to capture');
      return;
    }
    const marker: DeckLoopMarker = {
      id: crypto.randomUUID(),
      name: null,
      start: { frame, offsetFrames: 0 },
      end: null,
      voices: ALL_VOICES,
      settings: null,
      ownSettings: false,
      wraps: false,
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

  /** Names a marker. Control characters are removed and the name trimmed and capped to
   *  `MARKER_NAME_MAX_LENGTH`; an empty name returns the marker to its place in the list. */
  rename(slot: Slot, id: string, name: string): void {
    if (this.holdingOf(slot, 'rename') === null) {
      return;
    }
    const { markers, selectedId } = this.loopsOf(slot);
    const marker = markers.find((candidate) => candidate.id === id);
    if (marker === undefined) {
      this.refuse(slot, 'rename', `has no marker ${id}`);
      return;
    }
    const cleaned = sanitizeName(name, MARKER_NAME_MAX_LENGTH);
    const renamed = cleaned === '' ? null : cleaned;
    if (renamed === marker.name) {
      return;
    }
    this.commit(
      slot,
      markers.map((other) => (other.id === id ? { ...other, name: renamed } : other)),
      selectedId,
      'settings'
    );
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

  /** Sets the selected marker's start at the playhead, on the nearest beat when the deck has a
   *  grid. Refused when the start would fall past the tune's end or at or after the marker's end. */
  setIn(slot: Slot): void {
    const marker = this.selectedMarker(slot, 'setIn');
    if (marker !== null) {
      this.place(slot, 'setIn', marker, this.boundaryAt(this.snappedPlayhead(slot)), marker.end);
    }
  }

  /** Sets the selected marker's end at the playhead, on the nearest beat when the deck has a grid:
   *  a cue becomes a loop, a loop's end moves. Refused when the end would fall past the tune's end
   *  or at or before the marker's start. */
  setOut(slot: Slot): void {
    const marker = this.selectedMarker(slot, 'setOut');
    if (marker !== null) {
      this.place(slot, 'setOut', marker, marker.start, this.boundaryAt(this.snappedPlayhead(slot)));
    }
  }

  /**
   * Halves or doubles the selected loop, keeping its start. From a length off the ladder, halving
   * takes the largest size below it and doubling the smallest above, so the length lands on the
   * ladder in that direction. Doubling stops at 128 beats and at the tune's end; a cue gains a
   * 4-beat end either way. A no-op, logged, off the grid.
   */
  resize(slot: Slot, direction: 'halve' | 'double'): void {
    const marker = this.selectedMarker(slot, 'resize');
    if (marker === null) {
      return;
    }
    const start = resolvedFrame(marker.start);
    const grid = this.gridAt(slot, start, 'resize');
    if (grid === null) {
      return;
    }
    const ladder = lengthLadder(grid.beatFrames);
    const length =
      markerKind(marker) === 'loop' && marker.end !== null
        ? resolvedFrame(marker.end) - start
        : null;
    const size =
      length === null
        ? ladder.find((candidate) => candidate.beats === CUE_BEATS)
        : direction === 'halve'
        ? [...ladder].reverse().find((candidate) => candidate.frames < length)
        : ladder.find((candidate) => candidate.frames > length);
    if (size === undefined) {
      this.refuse(slot, 'resize', `has no length to ${direction} to`);
      return;
    }
    this.place(slot, 'resize', marker, marker.start, this.boundaryAt(start + size.frames));
  }

  /** Gives the selected marker an end exactly `beats` after its start, a ladder size. A no-op,
   *  logged, off the grid or for a length the grid's beat cannot hold in whole frames. */
  setLength(slot: Slot, beats: number): void {
    const marker = this.selectedMarker(slot, 'setLength');
    if (marker === null) {
      return;
    }
    const start = resolvedFrame(marker.start);
    const grid = this.gridAt(slot, start, 'setLength');
    if (grid === null) {
      return;
    }
    const size = lengthLadder(grid.beatFrames).find((candidate) => candidate.beats === beats);
    if (size === undefined) {
      this.refuse(slot, 'setLength', `has no ${beats}-beat length on its grid`);
      return;
    }
    this.place(slot, 'setLength', marker, marker.start, this.boundaryAt(start + size.frames));
  }

  /**
   * Shifts the selected marker, start and end together, by the deck's Move step in `direction`,
   * keeping its length; a cue moves alone. A start off the beats lands first on the next beat that
   * way, the end following at the same length. A no-op, logged, off the grid. On the frame step,
   * both edges' nudges move by one frame instead, grid or none (`shiftByFrame`).
   */
  moveLoop(slot: Slot, direction: -1 | 1): void {
    const marker = this.selectedMarker(slot, 'moveLoop');
    if (marker === null) {
      return;
    }
    const step = this.store.decks()[slot].moveStepBeats;
    if (step === 'frame') {
      this.shiftByFrame(slot, marker, direction);
      return;
    }
    const from = resolvedFrame(marker.start);
    const to = this.beatStep(slot, from, step, direction, 'moveLoop');
    if (to === null) {
      return;
    }
    const end = marker.end === null ? null : this.boundaryAt(resolvedFrame(marker.end) + to - from);
    this.place(slot, 'moveLoop', marker, this.boundaryAt(to), end);
  }

  /** Moves one edge of the selected marker by the deck's Move step in `direction`. An edge off the
   *  beats lands first on the next beat that way. A no-op, logged, off the grid; refused for the
   *  end of a cue. On the frame step, the edge's nudge moves by one frame instead
   *  (`nudgedByFrame`). */
  moveEdge(slot: Slot, boundary: LoopBoundaryName, direction: -1 | 1): void {
    const marker = this.selectedMarker(slot, 'moveEdge');
    if (marker === null) {
      return;
    }
    const edge = this.boundaryOf(slot, marker, boundary, 'moveEdge');
    if (edge === null) {
      return;
    }
    const step = this.store.decks()[slot].moveStepBeats;
    let moved: DeckLoopBoundary | null;
    if (step === 'frame') {
      moved = this.nudgedByFrame(slot, marker, boundary, edge, direction);
    } else {
      const to = this.beatStep(slot, resolvedFrame(edge), step, direction, 'moveEdge');
      moved = to === null ? null : this.boundaryAt(to);
    }
    if (moved === null) {
      return;
    }
    this.place(
      slot,
      'moveEdge',
      marker,
      boundary === 'start' ? moved : marker.start,
      boundary === 'end' ? moved : marker.end
    );
  }

  /** Sets how far the deck's Move controls shift a loop or an edge: beats, or one frame. Kept across
   *  loads. */
  setMoveStep(slot: Slot, step: MoveStep): void {
    if (!MOVE_STEPS.includes(step)) {
      this.refuse(slot, 'setMoveStep', `has no Move step of ${step}`);
      return;
    }
    if (this.store.decks()[slot].moveStepBeats !== step) {
      this.store.setDeckMoveStep({ slot, moveStepBeats: step });
    }
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
   *  end stays after its start. Returns the edited marker's id for the caller to `audition`, even
   *  when the boundary did not move; null when the edit was refused. */
  nudge(slot: Slot, boundary: LoopBoundaryName, offsetFrames: number): string | null {
    const marker = this.selectedMarker(slot, 'nudge');
    if (marker === null || !Number.isFinite(offsetFrames)) {
      return null;
    }
    const target = this.boundaryOf(slot, marker, boundary, 'nudge');
    if (target === null) {
      return null;
    }
    // The caller's audition replaces any seek still waiting on an earlier start edit.
    this.pendingStart[slot] = null;
    const { min, max } = nudgeLimits(marker, boundary, this.oneSecond(slot));
    const offset = clamp(Math.round(offsetFrames), min, max);
    if (offset !== target.offsetFrames) {
      const moved = { ...target, offsetFrames: offset };
      this.replaceSelected(
        slot,
        boundary === 'start' ? { ...marker, start: moved } : { ...marker, end: moved }
      );
    }
    return marker.id;
  }

  /**
   * Flips the selected marker's GBL: unlatched it keeps its own settings, latched it shares the
   * main track's. The marker running or in play changes at once — unlatching makes its settings
   * the ones in play, latching lets them go; any other marker only has its list entry change, and
   * its settings land at its next jump-in. The settings in play settle first and the marker's new
   * state is committed after, so a marker queued behind is re-synced against the settings in play
   * once they have changed.
   */
  toggleGlobal(slot: Slot): void {
    const marker = this.selectedMarker(slot, 'toggleGlobal');
    if (marker === null) {
      return;
    }
    const { markers, selectedId, runningId, settingsInPlayId, mainSettings } = this.loopsOf(slot);
    const sounding = this.soundingOf(slot);
    if (marker.ownSettings) {
      if (settingsInPlayId === marker.id) {
        this.releaseSettings(slot);
      }
    } else if (marker.id === runningId || marker.id === settingsInPlayId) {
      const kept = marker.settings;
      this.swapSettings(slot, (kept ?? sounding).panel, marker.id, mainSettings ?? sounding);
      if (kept !== null) {
        this.pushSettings(slot, kept.mutes);
      }
    }
    const toggled: DeckLoopMarker = {
      ...marker,
      settings: marker.settings ?? sounding,
      ownSettings: !marker.ownSettings,
    };
    this.commit(
      slot,
      markers.map((other) => (other.id === marker.id ? toggled : other)),
      selectedId,
      'settings'
    );
  }

  /**
   * Flips the selected loop's WRAP: lit, a scrubbed or thrown record backed past the loop's start
   * wraps to its end; unlit, it stops at the start. A running loop passes the new mode to the
   * engine at once, keeping any jump queued behind it. Refused on a cue, which has no loop to wrap.
   */
  toggleWrap(slot: Slot): void {
    const marker = this.selectedMarker(slot, 'toggleWrap');
    if (marker === null) {
      return;
    }
    if (markerKind(marker) !== 'loop') {
      this.refuse(slot, 'toggleWrap', 'has a cue selected');
      return;
    }
    const { markers, selectedId } = this.loopsOf(slot);
    this.commit(
      slot,
      markers.map((other) =>
        other.id === marker.id ? { ...marker, wraps: !marker.wraps } : other
      ),
      selectedId,
      'settings'
    );
  }

  /**
   * Keeps the marker whose own settings are in play true to the deck's mixer: when what is sounding
   * (the panel, the voices' mutes) differs from its copy, the copy takes it. Does nothing while the
   * main track's settings are in play, whose panel already lives in the store. Not gated on the
   * marker being independent: with the same tune on both decks the other deck may latch it while
   * it is in play here, and this deck keeps playing — and editing — its copy until its next jump.
   */
  saveSettingsInPlay(slot: Slot): void {
    const { markers, selectedId, settingsInPlayId } = this.loopsOf(slot);
    const marker = markers.find((candidate) => candidate.id === settingsInPlayId);
    if (marker === undefined) {
      return;
    }
    const sounding = this.soundingOf(slot);
    const { settings } = marker;
    if (
      settings !== null &&
      settings.panel === sounding.panel &&
      sameMutes(settings.mutes, sounding.mutes)
    ) {
      return;
    }
    this.commit(
      slot,
      markers.map((other) => (other === marker ? { ...marker, settings: sounding } : other)),
      selectedId,
      'settings'
    );
  }

  /** Lands a changed list on the slot, saves it, and gives it to the other deck when that deck
   *  holds the same row and subtune. `timing` is when an edit to the running marker's bounds
   *  reaches this deck's engine; the other deck always takes it at the end of its pass. A settings
   *  or names change leaves the other deck's pending start audition and its own sound alone: it
   *  plays the new settings at its next jump into the marker. */
  private commit(
    slot: Slot,
    markers: readonly DeckLoopMarker[],
    selectedId: string | null,
    change: MarkerChange = 'positions',
    timing: EditTiming = 'immediate'
  ): void {
    const mine = this.attached[slot];
    if (mine === null) {
      return;
    }
    this.land(slot, markers, selectedId, change, timing);
    this.save(slot, mine, markers);

    const other = otherSlot(slot);
    const theirs = this.attached[other];
    if (
      theirs !== null &&
      theirs.placementKey === mine.placementKey &&
      sameTune(theirs.identity, mine.identity)
    ) {
      const { markers: before, selectedId: beforeId } = this.loopsOf(other);
      if (change === 'positions') {
        // An edit from this deck never moves the other deck's playhead.
        this.pendingStart[other] = null;
      }
      this.land(other, markers, reselect(before, beforeId, markers), change, 'end-of-pass');
    }
  }

  /**
   * The one routine that puts a list on a deck, for a local edit and for the other deck alike:
   * store first — each marker's readiness taken from this deck's own engine — then, unless only
   * settings changed, which moves no start, the running marker's edit held for the end of the pass
   * (or let go, for an edit that applies at once) and the engine's targets, then the engine's
   * running and queued markers, then a reflect for whatever the declaration made ready. The targets
   * are declared before anything is queued, so a start queued in the engine is built by its prepare
   * runner and never captured off-thread. A marker in play that the list no longer holds is let go.
   */
  private land(
    slot: Slot,
    markers: readonly DeckLoopMarker[],
    selectedId: string | null,
    change: MarkerChange,
    timing: EditTiming
  ): void {
    const running = this.runningMarker(slot);
    const prepared = this.preparedOf(slot);
    this.store.setLoopMarkers({
      slot,
      markers: markers.map((marker) => ({
        ...marker,
        ready: prepared.has(resolvedFrame(marker.start)),
      })),
    });
    this.selectId(slot, selectedId);
    if (change === 'positions') {
      if (timing === 'end-of-pass') {
        this.holdEdit(slot, running);
      } else {
        this.releaseEdit(slot, running);
      }
      this.declare(slot);
    }
    this.syncActivity(slot);
    const { settingsInPlayId } = this.loopsOf(slot);
    if (settingsInPlayId !== null && !markers.some((marker) => marker.id === settingsInPlayId)) {
      this.releaseSettings(slot);
    }
    this.reflect(slot);
  }

  /** Brings the engine in line with a changed list for the marker the deck is running and the one
   *  it has queued. */
  private syncActivity(slot: Slot): void {
    this.syncRunning(slot);
    this.syncQueued(slot);
  }

  /**
   * Keeps the engine on the running marker's bounds as its entry changes, by one of two rules
   * chosen by whether an end-of-pass edit is held. With none, a changed end or WRAP mode applies
   * at once, taking effect at the next wrap; a changed start is held until its frame is ready and
   * takes effect at the next re-entry. With one, the list's bounds never reach the engine until
   * the pass ends. None seeks. A marker that is gone, or no longer a loop, is let go.
   */
  private syncRunning(slot: Slot): void {
    const { markers, runningId } = this.loopsOf(slot);
    const engaged = this.engaged[slot];
    if (runningId === null || engaged === null) {
      return;
    }
    const marker = markers.find((candidate) => candidate.id === runningId);
    const desired = marker === undefined ? null : loopBoundsOf(marker);
    if (marker === undefined || desired === null) {
      this.stop(slot);
      return;
    }
    const edit = this.endOfPass[slot];
    if (edit !== null && edit.markerId === runningId) {
      this.syncEndOfPass(slot, edit, desired.varispeedStart);
      return;
    }
    const next = {
      startFrame: marker.ready ? desired.startFrame : engaged.startFrame,
      endFrame: desired.endFrame,
      varispeedStart: desired.varispeedStart,
    };
    const unchanged =
      next.startFrame === engaged.startFrame &&
      next.endFrame === engaged.endFrame &&
      next.varispeedStart === engaged.varispeedStart;
    if (!unchanged && next.endFrame > next.startFrame) {
      this.setEngaged(slot, next);
      this.runtime.setActiveLoop(slot, next);
      // `setActiveLoop` drops the engine's queue.
      this.syncQueued(slot);
    }
  }

  /** `syncRunning` while the running marker's edit waits for the end of the pass: only a WRAP
   *  change applies at once, on the bounds in force, and the edit is queued again since
   *  `setActiveLoop` drops the engine's queue. */
  private syncEndOfPass(slot: Slot, edit: EndOfPassEdit, varispeedStart: VarispeedLoopStart): void {
    const engaged = this.engaged[slot];
    if (engaged !== null && engaged.varispeedStart !== varispeedStart) {
      const next = { ...engaged, varispeedStart };
      this.setEngaged(slot, next);
      this.endOfPass[slot] = { ...edit, bounds: { ...edit.bounds, varispeedStart } };
      this.runtime.setActiveLoop(slot, next);
      this.syncQueued(slot);
    }
    this.syncPendingEdit(slot);
  }

  /**
   * Keeps the running marker's end-of-pass edit where the engine can land it: queued there, unless a
   * marker queued in the engine owns its one slot, in which case the edit waits behind that marker
   * and is queued when the marker goes. Queues only when the engine's queue is not already the
   * edit, and only for the marker still running; an edit of any other marker is dropped.
   */
  private syncPendingEdit(slot: Slot): void {
    const edit = this.endOfPass[slot];
    if (edit === null) {
      return;
    }
    if (edit.markerId !== this.loopsOf(slot).runningId) {
      this.endOfPass[slot] = null;
      return;
    }
    const via = this.queuedVia[slot] === 'engine' ? 'behind-queued' : 'engine';
    if (edit.via !== via) {
      this.endOfPass[slot] = { ...edit, via };
    }
    if (via === 'behind-queued') {
      return;
    }
    const { startFrame, endFrame, varispeedStart } = edit.bounds;
    const queued = this.runtime.snapshot(slot).tune?.queuedJump ?? null;
    if (
      queued?.startFrame !== startFrame ||
      queued.endFrame !== endFrame ||
      queued.varispeedStart !== varispeedStart
    ) {
      this.runtime.queueJump(slot, { startFrame, endFrame, varispeedStart });
    }
  }

  /**
   * Holds the running marker's bounds from the list as an edit for the end of the pass, when the
   * edit just landed changed them. An edit that brings them back to what the engine is enforcing
   * holds nothing and lets go of one already held.
   */
  private holdEdit(slot: Slot, before: DeckLoopMarker | undefined): void {
    const edited = this.editedBounds(slot, before);
    const engaged = this.engaged[slot];
    if (edited === null || engaged === null) {
      return;
    }
    if (sameBounds(edited.bounds, engaged)) {
      this.dropEndOfPass(slot, edited.id);
      return;
    }
    this.endOfPass[slot] = {
      markerId: edited.id,
      bounds: edited.bounds,
      via: this.queuedVia[slot] === 'engine' ? 'behind-queued' : 'engine',
    };
  }

  /** An edit that applies at once and changed the running marker's bounds supersedes the edit held
   *  for the end of the pass. */
  private releaseEdit(slot: Slot, before: DeckLoopMarker | undefined): void {
    const edited = this.editedBounds(slot, before);
    if (edited !== null) {
      this.dropEndOfPass(slot, edited.id);
    }
  }

  /** The running marker and its bounds as listed now, when they differ from what `before` listed;
   *  null when the deck runs nothing, or the marker is not, or no longer, a loop. */
  private editedBounds(
    slot: Slot,
    before: DeckLoopMarker | undefined
  ): { readonly id: string; readonly bounds: LoopBounds } | null {
    const running = this.runningMarker(slot);
    const previous = before === undefined ? null : loopBoundsOf(before);
    const bounds = running === undefined ? null : loopBoundsOf(running);
    return running === undefined ||
      previous === null ||
      bounds === null ||
      sameBounds(previous, bounds)
      ? null
      : { id: running.id, bounds };
  }

  /** Lets go of marker `id`'s end-of-pass edit, taking it out of the engine's queue when it was
   *  queued there. A different marker's edit stays. */
  private dropEndOfPass(slot: Slot, id: string): void {
    const edit = this.endOfPass[slot];
    if (edit === null || edit.markerId !== id) {
      return;
    }
    this.endOfPass[slot] = null;
    if (edit.via === 'engine') {
      this.runtime.queueJump(slot, null);
    }
  }

  /** The engine handed off to the running marker's own queued edit: its bounds are what the engine
   *  enforces now. False when the hand-off was not that edit's — none held, or a marker queued in
   *  the engine owns the slot. */
  private landEdit(slot: Slot): boolean {
    const edit = this.endOfPass[slot];
    if (
      edit === null ||
      edit.via !== 'engine' ||
      edit.markerId !== this.loopsOf(slot).runningId ||
      this.queuedVia[slot] === 'engine'
    ) {
      return false;
    }
    this.endOfPass[slot] = null;
    this.setEngaged(slot, edit.bounds);
    return true;
  }

  /** The marker the deck is running, as listed, or undefined when none is. */
  private runningMarker(slot: Slot): DeckLoopMarker | undefined {
    const { markers, runningId } = this.loopsOf(slot);
    return runningId === null ? undefined : markers.find((marker) => marker.id === runningId);
  }

  /** Keeps the engine's queue on the queued marker's current target and the settings it carries,
   *  and drops a queue whose marker is gone. */
  private syncQueued(slot: Slot): void {
    const { markers, queuedId } = this.loopsOf(slot);
    if (queuedId === null) {
      return;
    }
    const marker = markers.find((candidate) => candidate.id === queuedId);
    if (marker === undefined) {
      this.cancelQueue(slot);
      return;
    }
    if (this.queuedVia[slot] !== 'engine') {
      return;
    }
    const target = jumpOf(marker);
    const queued = this.runtime.snapshot(slot).tune?.queuedJump ?? null;
    if (
      queued?.startFrame !== target.startFrame ||
      queued.endFrame !== target.endFrame ||
      queued.varispeedStart !== target.varispeedStart ||
      this.queuedSource[slot] !== this.settingsToCarry(slot, marker)
    ) {
      this.queueInEngine(slot, marker);
    }
  }

  /** The engine handed off to the marker queued in it: that marker is running now (a cue runs
   *  nothing), the settings the jump carried are in play, and the selection follows it unless it
   *  moved while the jump waited. */
  private landQueued(slot: Slot): void {
    const { markers, queuedId, selectionMovedWhileQueued } = this.loopsOf(slot);
    if (this.queuedVia[slot] !== 'engine' || queuedId === null) {
      return;
    }
    const marker = markers.find((candidate) => candidate.id === queuedId);
    if (marker === undefined) {
      this.stop(slot);
      return;
    }
    const bounds = loopBoundsOf(marker);
    const carried = this.queuedSource[slot];
    // The queue's bookkeeping goes first: the swap re-syncs the queue, and a marker still queued
    // would be queued again.
    this.queuedVia[slot] = null;
    this.queuedSource[slot] = null;
    this.endOfPass[slot] = null;
    this.setEngaged(slot, bounds);
    this.setActivity(slot, bounds === null ? null : marker.id, null, false);
    if (carried !== null) {
      const { mainSettings } = this.loopsOf(slot);
      if (marker.ownSettings) {
        const main = mainSettings ?? {
          panel: this.store.panel()[slot],
          mutes: this.seenMutes[slot],
        };
        this.swapSettings(slot, carried.panel, marker.id, main);
      } else {
        this.swapSettings(slot, carried.panel, null, null);
      }
      this.mixerApplier.markInEngine(slot, carried.panel);
    }
    if (!selectionMovedWhileQueued) {
      this.selectId(slot, marker.id);
    }
  }

  /** Seeks the running marker to its changed start once `syncRunning` has applied it, then lets go
   *  of the wait. */
  private seekToPendingStart(slot: Slot): void {
    const id = this.pendingStart[slot];
    const engaged = this.engaged[slot];
    const marker = this.loopsOf(slot).markers.find((candidate) => candidate.id === id);
    if (marker?.ready && engaged?.startFrame === resolvedFrame(marker.start)) {
      this.pendingStart[slot] = null;
      this.jumpInto(slot, marker, engaged.startFrame);
    }
  }

  /** Auditions a boundary of the marker the deck is already running. Anything queued is dropped, but
   *  the engine is left on the bounds `syncRunning` holds: re-arming would replace the entry image
   *  the tracker keeps for the loop. */
  private auditionRunning(slot: Slot, marker: DeckLoopMarker, boundary: LoopBoundaryName): void {
    const engaged = this.engaged[slot];
    this.cancelQueue(slot);
    if (boundary === 'end') {
      this.pendingStart[slot] = null;
      if (marker.end !== null && engaged !== null) {
        this.jumpInto(
          slot,
          marker,
          Math.max(engaged.startFrame, resolvedFrame(marker.end) - 2 * this.oneSecond(slot))
        );
      }
    } else if (marker.ready) {
      this.pendingStart[slot] = null;
      this.jumpInto(slot, marker, resolvedFrame(marker.start));
    } else {
      this.pendingStart[slot] = marker.id;
    }
  }

  /** Engages the marker waiting for readiness once its start is ready. */
  private engageWhenReady(slot: Slot): void {
    const { markers, queuedId, selectionMovedWhileQueued } = this.loopsOf(slot);
    if (this.queuedVia[slot] !== 'ready') {
      return;
    }
    const marker = markers.find((candidate) => candidate.id === queuedId);
    if (marker?.ready) {
      this.arm(slot, marker, !selectionMovedWhileQueued);
      this.jumpInto(slot, marker, resolvedFrame(marker.start));
    }
  }

  /** Engages the marker now when its start is ready, else waits for it to be. */
  private engageOrWait(slot: Slot, marker: DeckLoopMarker): void {
    if (marker.ready) {
      this.arm(slot, marker, false);
      this.jumpInto(slot, marker, resolvedFrame(marker.start));
      return;
    }
    const via = this.queuedVia[slot];
    this.queuedVia[slot] = 'ready';
    this.queuedSource[slot] = null;
    this.setActivity(slot, this.loopsOf(slot).runningId, marker.id, false);
    if (via === 'engine') {
      this.runtime.queueJump(slot, null);
      // A running marker's edit saved behind that queue has the engine's slot to itself again.
      this.syncPendingEdit(slot);
    }
  }

  /** Queues the marker in the engine to land at the end of the running loop's lap. It replaces the
   *  running marker's edit there, which waits behind it. */
  private queueThroughEngine(slot: Slot, marker: DeckLoopMarker): void {
    const edit = this.endOfPass[slot];
    if (edit !== null) {
      this.endOfPass[slot] = { ...edit, via: 'behind-queued' };
    }
    this.queuedVia[slot] = 'engine';
    this.setActivity(slot, this.loopsOf(slot).runningId, marker.id, false);
    this.queueInEngine(slot, marker);
  }

  /** Queues `marker` in the engine with the settings its landing needs, noting what they were
   *  built from first so `syncQueued` can tell when they go stale. */
  private queueInEngine(slot: Slot, marker: DeckLoopMarker): void {
    const source = this.settingsToCarry(slot, marker);
    this.queuedSource[slot] = source;
    this.runtime.queueJump(slot, {
      ...jumpOf(marker),
      ...(source === null ? {} : { settings: engineSettingsOf(source.panel, source.mutes) }),
    });
  }

  /** Drops the queued marker, and the engine's queue when that is where it waits. */
  private cancelQueue(slot: Slot): void {
    const via = this.queuedVia[slot];
    this.queuedVia[slot] = null;
    this.queuedSource[slot] = null;
    this.setActivity(slot, this.loopsOf(slot).runningId, null, false);
    if (via === 'engine') {
      this.runtime.queueJump(slot, null);
      // The running marker's edit saved behind the cancelled marker goes into the engine instead.
      this.syncPendingEdit(slot);
    }
  }

  /**
   * Makes `marker` what the engine runs: its loop, or no loop for a cue, with the queue cleared.
   * The caller moves the playhead. The selection follows when `follow` is set.
   */
  private arm(slot: Slot, marker: DeckLoopMarker, follow: boolean): void {
    const bounds = loopBoundsOf(marker);
    this.queuedVia[slot] = null;
    this.queuedSource[slot] = null;
    this.endOfPass[slot] = null;
    this.setEngaged(slot, bounds);
    this.setActivity(slot, bounds === null ? null : marker.id, null, false);
    if (follow) {
      this.selectId(slot, marker.id);
    }
    this.runtime.setActiveLoop(slot, bounds);
  }

  /**
   * The one routine for every immediate jump into `marker`: the settings it plays with go in with
   * the jump, and the deck's settings in play follow. A marker sharing the main track's settings
   * while those are in play has nothing to carry, and the jump is a plain seek.
   *
   * What the jump carries is captured before the swap, which clears what it is read from. The store
   * is written before the engine is called, since the engine notifies synchronously. A target in
   * the engine's prepared frames always lands within the call, so the settings travel with the
   * seek; any other target may land by replay or from an entry image, so the settings go in at
   * once and the seek carries none.
   */
  private jumpInto(slot: Slot, marker: DeckLoopMarker, frame: number): void {
    const target = this.settingsToCarry(slot, marker);
    if (target === null) {
      this.seek(slot, frame);
      return;
    }
    const own = ownSettingsOf(marker);
    const { mainSettings } = this.loopsOf(slot);
    if (own === null) {
      this.swapSettings(slot, target.panel, null, null);
    } else {
      this.swapSettings(slot, target.panel, marker.id, mainSettings ?? this.soundingOf(slot));
    }
    if (this.preparedOf(slot).has(frame)) {
      this.mixerApplier.markInEngine(slot, target.panel);
      this.seek(slot, frame, engineSettingsOf(target.panel, target.mutes));
    } else {
      this.pushSettings(slot, target.mutes);
      this.seek(slot, frame);
    }
  }

  private seek(slot: Slot, frame: number, settings?: JumpSettings): void {
    (settings === undefined
      ? this.runtime.seekToFrame(slot, frame)
      : this.runtime.seekToFrame(slot, frame, settings)
    ).catch((error: unknown) => logError(`DeckLoops: deck ${slot}'s jump failed`, error));
  }

  /** What is sounding on the deck: its panel and the voices' latched mutes as the store holds them. */
  private soundingOf(slot: Slot): DeckMixerSettings {
    return { panel: this.store.panel()[slot], mutes: mutesOf(this.store.decks()[slot].voices) };
  }

  /** The settings a jump into `marker` carries: its own while it is independent, else the main
   *  track's when a marker's own are in play, else none — the main track's stay in play. */
  private settingsToCarry(slot: Slot, marker: DeckLoopMarker): DeckMixerSettings | null {
    const own = ownSettingsOf(marker);
    if (own !== null) {
      return own;
    }
    const { settingsInPlayId, mainSettings } = this.loopsOf(slot);
    return settingsInPlayId === null ? null : mainSettings;
  }

  /** Every change to the settings in play goes through here: the deck's panel, the marker in play
   *  and the held main settings are written together, then a marker queued behind is re-synced
   *  against the new settings in play rather than the old. */
  private swapSettings(
    slot: Slot,
    panel: DeckPanelState,
    settingsInPlayId: string | null,
    mainSettings: DeckMixerSettings | null
  ): void {
    this.store.setSettingsInPlay({ slot, panel, settingsInPlayId, mainSettings });
    this.syncQueued(slot);
  }

  /** Puts the store's panel and `mutes` in the engine now, synchronously. */
  private pushSettings(slot: Slot, mutes: Mutes): void {
    this.mixerApplier.applyDeck(slot);
    mutes.forEach((muted, voice) => this.runtime.setVoiceMuted(slot, voice, muted));
  }

  /** Returns the deck to the main track's settings, at once, when a marker's own are in play. The
   *  playhead never moves. */
  private releaseSettings(slot: Slot): void {
    const { settingsInPlayId, mainSettings } = this.loopsOf(slot);
    if (settingsInPlayId === null) {
      return;
    }
    const main = mainSettings ?? this.soundingOf(slot);
    this.swapSettings(slot, main.panel, null, null);
    this.pushSettings(slot, main.mutes);
  }

  /** Forgets the running and queued markers and the bounds the engine was enforcing. Touches
   *  nothing in the engine. */
  private resetActivity(slot: Slot): void {
    this.queuedVia[slot] = null;
    this.queuedSource[slot] = null;
    this.endOfPass[slot] = null;
    this.setEngaged(slot, null);
    this.setActivity(slot, null, null, false);
  }

  /** Records the bounds the engine is enforcing for the running marker, and publishes them. */
  private setEngaged(slot: Slot, bounds: LoopBounds | null): void {
    this.engaged[slot] = bounds;
    const current = this.loopsOf(slot).runningBounds;
    if (current?.start !== bounds?.startFrame || current?.end !== bounds?.endFrame) {
      this.store.setRunningBounds({
        slot,
        runningBounds: bounds === null ? null : { start: bounds.startFrame, end: bounds.endFrame },
      });
    }
  }

  private setActivity(
    slot: Slot,
    runningId: string | null,
    queuedId: string | null,
    selectionMovedWhileQueued: boolean
  ): void {
    // The wait for a changed start ends with the marker's run, or as soon as another is queued.
    if (this.pendingStart[slot] !== runningId || queuedId !== null) {
      this.pendingStart[slot] = null;
    }
    const current = this.loopsOf(slot);
    if (
      current.runningId !== runningId ||
      current.queuedId !== queuedId ||
      current.selectionMovedWhileQueued !== selectionMovedWhileQueued
    ) {
      this.store.setLoopActivity({ slot, runningId, queuedId, selectionMovedWhileQueued });
    }
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

  private save(slot: Slot, holding: DeckLoopsHolding, markers: readonly DeckLoopMarker[]): void {
    holding.positions
      .save(holding.identity, markers.map(stored))
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

  private replaceSelected(
    slot: Slot,
    updated: DeckLoopMarker,
    timing: EditTiming = 'immediate'
  ): void {
    const { markers, selectedId } = this.loopsOf(slot);
    this.commit(
      slot,
      markers.map((marker) => (marker.id === updated.id ? updated : marker)),
      selectedId,
      'positions',
      timing
    );
  }

  private boundaryAt(frame: number): DeckLoopBoundary {
    return { frame, offsetFrames: 0 };
  }

  /**
   * Puts `start` and `end` on the selected marker as an end-of-pass edit. Refused, changing
   * nothing, when an edge would fall before the start of the tune or past its length, or the end
   * at or before the start. An edit that leaves both boundaries as they were does nothing.
   */
  private place(
    slot: Slot,
    command: string,
    marker: DeckLoopMarker,
    start: DeckLoopBoundary,
    end: DeckLoopBoundary | null
  ): void {
    const edges = [start, ...(end === null ? [] : [end])].map(
      (boundary) => boundary.frame + boundary.offsetFrames
    );
    const { lengthFrames } = this.store.decks()[slot];
    if (edges.some((edge) => edge < 0)) {
      this.refuse(slot, command, 'would put an edge before the start of the tune');
    } else if (lengthFrames !== null && edges.some((edge) => edge > lengthFrames)) {
      this.refuse(slot, command, "would put an edge past the tune's length");
    } else if (end !== null && edges[1] <= edges[0]) {
      this.refuse(slot, command, 'would put the end at or before the start');
    } else if (!sameBoundary(start, marker.start) || !sameBoundary(end, marker.end)) {
      // Nothing is auditioned, so a seek still waiting on an earlier nudge would surprise.
      this.pendingStart[slot] = null;
      this.replaceSelected(slot, { ...marker, start, end }, 'end-of-pass');
    }
  }

  /** The grid the beat commands snap to when `frame` is inside its span; else null, with a warning
   *  naming the refused command. */
  private gridAt(slot: Slot, frame: number, command: string): DeckBeatGrid | null {
    const grid = this.store.decks()[slot].beatGrid;
    if (grid === null) {
      this.refuse(slot, command, 'has no beat grid');
      return null;
    }
    if (!inGridSpan(grid, frame)) {
      this.refuse(slot, command, 'is outside its beat grid');
      return null;
    }
    return grid;
  }

  /**
   * The frame step's whole-marker move: both edges' nudges change by one frame in `direction`, so
   * the length holds exactly and each edge keeps the beat it is on; the grid is not read or moved.
   * Refused when either nudge would pass the strips' one second; `place` refuses an edge past the
   * tune's ends.
   */
  private shiftByFrame(slot: Slot, marker: DeckLoopMarker, direction: -1 | 1): void {
    const second = this.oneSecond(slot);
    const shifted = (boundary: DeckLoopBoundary): DeckLoopBoundary => ({
      ...boundary,
      offsetFrames: boundary.offsetFrames + direction,
    });
    const start = shifted(marker.start);
    const end = marker.end === null ? null : shifted(marker.end);
    const tooFar = [start, end].some(
      (boundary) => boundary !== null && Math.abs(boundary.offsetFrames) > second
    );
    if (tooFar) {
      this.refuse(slot, 'moveLoop', 'would nudge an edge more than a second off its beat');
      return;
    }
    this.place(slot, 'moveLoop', marker, start, end);
  }

  /** The frame step's edge move: that edge's nudge one frame on in `direction`, inside the limits
   *  the nudge strips keep (`nudgeLimits`). Null, refused, past them. */
  private nudgedByFrame(
    slot: Slot,
    marker: DeckLoopMarker,
    boundary: LoopBoundaryName,
    edge: DeckLoopBoundary,
    direction: -1 | 1
  ): DeckLoopBoundary | null {
    const { min, max } = nudgeLimits(marker, boundary, this.oneSecond(slot));
    const offsetFrames = edge.offsetFrames + direction;
    if (offsetFrames < min || offsetFrames > max) {
      this.refuse(slot, 'moveEdge', 'would nudge the edge past its limit');
      return null;
    }
    return { ...edge, offsetFrames };
  }

  /** Where a Move of `beats` in `direction` takes the edge at `frame`: that many beats on from the
   *  beat it is on, else the next beat that way. Null, with a warning, when there is no such beat in
   *  the grid's span. */
  private beatStep(
    slot: Slot,
    frame: number,
    beats: MoveStepBeats,
    direction: -1 | 1,
    command: string
  ): number | null {
    const grid = this.gridAt(slot, frame, command);
    if (grid === null) {
      return null;
    }
    const beat = nearestBeat(grid, frame);
    const target =
      beat !== null && onBeat(grid, frame)
        ? beat + direction * beats * grid.beatFrames
        : nextBeat(grid, frame, direction);
    const rounded = target === null ? null : Math.round(target);
    if (rounded === null || !inGridSpan(grid, rounded)) {
      this.refuse(slot, command, 'has no beat to move to');
      return null;
    }
    return rounded;
  }

  /** The playhead's frame, on the nearest beat when the deck has a grid and the playhead is inside
   *  its span. */
  private snappedPlayhead(slot: Slot): number {
    const position = Math.round(this.runtime.position(slot));
    const grid = this.store.decks()[slot].beatGrid;
    const beat = grid === null ? null : nearestBeat(grid, position);
    return beat === null ? position : Math.round(beat);
  }

  /** The frame a new cue takes: the playhead's, captured so its image is ready at once, or the
   *  nearest beat when that is another frame, which the declaration then builds. Null with nothing
   *  to capture. */
  private cueFrame(slot: Slot): number | null {
    const snapped = this.snappedPlayhead(slot);
    return snapped === Math.round(this.runtime.position(slot))
      ? this.runtime.capturePosition(slot)
      : snapped;
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

  /** What the slot is attached to, or null with a warning naming the refused command. */
  private holdingOf(slot: Slot, command: string): DeckLoopsHolding | null {
    const holding = this.attached[slot];
    if (holding === null) {
      this.refuse(slot, command, 'has no tune attached');
    }
    return holding;
  }

  /** The selected marker, or null with a warning naming the refused command. */
  private selectedMarker(slot: Slot, command: string): DeckLoopMarker | null {
    if (this.holdingOf(slot, command) === null) {
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
