import { Injectable, inject } from '@angular/core';
import { logError, logWarn } from '@teensyrom-nx/utils';
import type { JumpSettings } from '@sidablist/core';
import type { LoopMarker, LoopPositionsStore, TuneIdentity } from '@sidablist/tunes';
import { DeckRuntime } from './deck-runtime';
import {
  DjStore,
  EMPTY_DECK_LOOPS,
  MARKER_NAME_MAX_LENGTH,
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
import { nextOffset, type LoopSnapDirection } from './loops/moment-reach';
import { engineSettingsOf } from './mixer/engine-settings';
import { MAX_MARKERS_PER_SUBTUNE, sanitizeName } from './sets/dj-sets';

/** The SID's three voices: a new marker plays them all. */
const ALL_VOICES: readonly number[] = [0, 1, 2];

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

/** A loop's bounds in the engine's terms: the resolved start and end frames. */
interface LoopBounds {
  readonly startFrame: number;
  readonly endFrame: number;
}

/** Where a queued marker waits: in the engine, for the end of the running loop's lap, or here, for
 *  its start to be ready. */
type QueuedVia = 'engine' | 'ready';

type Mutes = DeckMixerSettings['mutes'];

const NO_MUTES: Mutes = [false, false, false];

/** What an edit changed in the list: where the markers are, or only the settings or names they
 *  carry. A settings change fires on every knob tick, so it skips what a position change must
 *  redo. */
type MarkerChange = 'positions' | 'settings';

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

/** What the engine runs for a marker: its bounds as a loop, or null for a cue. */
function loopBoundsOf(marker: DeckLoopMarker): LoopBounds | null {
  return marker.end !== null && markerKind(marker) === 'loop'
    ? { startFrame: resolvedFrame(marker.start), endFrame: resolvedFrame(marker.end) }
    : null;
}

/** The jump the engine queues for a marker: a loop when it has an end, else a cue. */
function jumpOf(marker: DeckLoopMarker): { startFrame: number; endFrame: number | null } {
  return {
    startFrame: resolvedFrame(marker.start),
    endFrame: loopBoundsOf(marker)?.endFrame ?? null,
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
   *  changed start waits for readiness. */
  private readonly engaged: Record<Slot, LoopBounds | null> = { A: null, B: null };

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
  async attach(
    slot: Slot,
    holding: DeckLoopsHolding,
    detectedMoments: readonly number[]
  ): Promise<void> {
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
        ready: false,
      };
    });
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
   *   queue also disappears on `setActiveLoop`, a stop, a load and a subtune change;
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
      this.landQueued(slot);
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

  /** Marks the playhead as a new cue and selects it. */
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
    const frame = this.runtime.capturePosition(slot);
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

  /** Ends the selected cue at the playhead, making it a loop. Refused for a marker that already
   *  has an end, and unless the playhead is after the marker's start. */
  setEnd(slot: Slot): void {
    const marker = this.selectedMarker(slot, 'setEnd');
    if (marker === null) {
      return;
    }
    if (marker.end !== null) {
      this.refuse(slot, 'setEnd', 'selected marker already has an end');
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

  /** Nudges a boundary to the next detected moment in `direction` within a second of where it was
   *  captured. Returns the edited marker's id for the caller to `audition`, even when no moment is
   *  in reach and the boundary stays put; null when the edit was refused. */
  snap(slot: Slot, boundary: LoopBoundaryName, direction: LoopSnapDirection): string | null {
    const marker = this.selectedMarker(slot, 'snap');
    if (marker === null) {
      return null;
    }
    const target = this.boundaryOf(slot, marker, boundary, 'snap');
    if (target === null) {
      return null;
    }
    const offset = nextOffset(
      this.loopsOf(slot).detectedMoments,
      target.frame,
      target.offsetFrames,
      this.oneSecond(slot),
      direction
    );
    return offset === null ? marker.id : this.nudge(slot, boundary, offset);
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
   *  holds the same row and subtune. A settings or names change leaves the other deck's pending
   *  start audition and its own sound alone: it plays the new settings at its next jump into the
   *  marker. */
  private commit(
    slot: Slot,
    markers: readonly DeckLoopMarker[],
    selectedId: string | null,
    change: MarkerChange = 'positions'
  ): void {
    const mine = this.attached[slot];
    if (mine === null) {
      return;
    }
    this.land(slot, markers, selectedId, change);
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
      this.land(other, markers, reselect(before, beforeId, markers), change);
    }
  }

  /**
   * The one routine that puts a list on a deck, for a local edit and for the other deck alike:
   * store first — each marker's readiness taken from this deck's own engine — then the engine's
   * targets (unless only settings changed, which moves no start), then a reflect for whatever the
   * declaration made ready. A marker in play that the list no longer holds is let go.
   */
  private land(
    slot: Slot,
    markers: readonly DeckLoopMarker[],
    selectedId: string | null,
    change: MarkerChange
  ): void {
    const prepared = this.preparedOf(slot);
    this.store.setLoopMarkers({
      slot,
      markers: markers.map((marker) => ({
        ...marker,
        ready: prepared.has(resolvedFrame(marker.start)),
      })),
    });
    this.selectId(slot, selectedId);
    this.syncActivity(slot);
    const { settingsInPlayId } = this.loopsOf(slot);
    if (settingsInPlayId !== null && !markers.some((marker) => marker.id === settingsInPlayId)) {
      this.releaseSettings(slot);
    }
    if (change === 'positions') {
      this.declare(slot);
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
   * Keeps the engine on the running marker's bounds as its entry changes. A changed end applies at
   * once, taking effect at the next wrap; a changed start is held until its frame is ready and
   * takes effect at the next re-entry. Neither seeks. A marker that is gone, or no longer a loop,
   * is let go.
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
    const next = {
      startFrame: marker.ready ? desired.startFrame : engaged.startFrame,
      endFrame: desired.endFrame,
    };
    const unchanged = next.startFrame === engaged.startFrame && next.endFrame === engaged.endFrame;
    if (!unchanged && next.endFrame > next.startFrame) {
      this.engaged[slot] = next;
      this.runtime.setActiveLoop(slot, next);
      // `setActiveLoop` drops the engine's queue.
      this.syncQueued(slot);
    }
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
    this.engaged[slot] = bounds;
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
    }
  }

  /** Queues the marker in the engine to land at the end of the running loop's lap. */
  private queueThroughEngine(slot: Slot, marker: DeckLoopMarker): void {
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
    this.engaged[slot] = bounds;
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
    this.engaged[slot] = null;
    this.setActivity(slot, null, null, false);
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
