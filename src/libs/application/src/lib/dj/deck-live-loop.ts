import { Injectable, effect, inject, untracked } from '@angular/core';
import {
  foldIntoLoop,
  gridLine,
  lapPhaseOfFold,
  loopStartAtOrBefore,
  shrinkLanding,
} from '@sidablist/analysis';
import { lapLength, lapPhaseAfter, reduceLapPhase, type CrossingLines } from '@sidablist/core';
import { logError, logWarn } from '@teensyrom-nx/utils';
import { DeckLoops } from './deck-loops';
import { DeckRuntime } from './deck-runtime';
import { DeckSlip } from './deck-slip';
import { DjStore, type DeckBeatGrid, type DeckLiveLoopState } from './dj-store';
import {
  lapPhaseOrNone,
  lengthLadder,
  loopLapPhase,
  nearestRungIndex,
  type LadderSize,
} from './grid/beat-math';
import { DECK_SLOTS, type Slot } from './slot';

/** How many of the most recent crossings of each declared line the engine keeps an image of. */
const CROSSINGS_KEPT = 2;

/** A live loop's state, carrying its lap phase only when it has one. */
function liveLoopOf(
  startFrame: number,
  endFrame: number,
  pendingEndFrame: number | null,
  lapPhase: number | undefined
): DeckLiveLoopState {
  return { startFrame, endFrame, pendingEndFrame, ...(lapPhase === undefined ? {} : { lapPhase }) };
}

/** The deck's grid and the rung of its ladder the kept live loop size names. */
interface LiveSize {
  readonly grid: DeckBeatGrid;
  readonly ladder: readonly LadderSize[];
  readonly index: number;
}

/** The first line of `period` frames through the grid's beat one that lies after `frame`. */
function lineAfter(grid: DeckBeatGrid, period: number, frame: number): number {
  let index = Math.floor((frame - grid.beatOneFrame) / period);
  while (gridLine(grid, period, index) <= frame) {
    index++;
  }
  while (gridLine(grid, period, index - 1) > frame) {
    index--;
  }
  return gridLine(grid, period, index);
}

/**
 * Each deck's live loop: a loop of the deck's chosen size pushed on the beat grid over whatever is
 * playing, resized on the grid, and ended back into whatever loop is running underneath.
 *
 * It declares the grid lines the engine saves the machine at as the playhead crosses them, so a
 * push starts from an image taken on a line and replays nothing. A loop starts on the last line at
 * or behind the playhead (a beat line at a beat or more, else a line of its own size) and lasts one
 * size; a shrink lands on the first lap end the wrap lead allows and a grow applies at once. The
 * start never moves.
 *
 * The live loop is state of the deck's loops (`live`), never one of its markers. It is written
 * before every engine call, since the engine notifies synchronously. `DeckLoops` keeps the marker
 * underneath, and the marker queued over the live loop, true while it runs.
 *
 * With slip on, a push is a slip departure and its end lands the deck on the count `DeckSlip`
 * kept, instead of on the playhead.
 */
@Injectable({ providedIn: 'root' })
export class DeckLiveLoop {
  private readonly runtime = inject(DeckRuntime);
  private readonly store = inject(DjStore);
  private readonly loops = inject(DeckLoops);
  private readonly slip = inject(DeckSlip);

  constructor() {
    for (const slot of DECK_SLOTS) {
      effect(() => {
        const deck = this.store.decks[slot];
        const grid = deck.beatGrid();
        const beats = deck.liveLoopBeats();
        untracked(() => this.follow(slot, grid, beats));
      });
    }
  }

  /** Pushes a live loop on an idle deck, ends a running one. Nothing off the grid. */
  toggle(slot: Slot): void {
    if (this.liveOf(slot) === null) {
      this.push(slot);
    } else {
      this.end(slot);
    }
  }

  /** Ends a running live loop, back into the marker running underneath. Nothing when idle. */
  end(slot: Slot): void {
    if (this.liveOf(slot) !== null) {
      this.returnFrom(slot);
    }
  }

  /** Ends a running live loop with no return: the engine's loop goes too, and the marker underneath
   *  with it. A slip departure of the live loop ends with no landing. Nothing when idle. */
  drop(slot: Slot): void {
    if (this.liveOf(slot) !== null) {
      this.store.setLiveLoop({ slot, live: null });
      this.slip.release(slot, 'live-loop');
      this.runtime.setActiveLoop(slot, null);
    }
  }

  /** The size in beats one rung of the ladder from the kept one, or null at the end of the ladder
   *  and off the grid. */
  steppedBeats(slot: Slot, direction: 'halve' | 'double'): number | null {
    const size = this.sizing(slot);
    if (size === null) {
      return null;
    }
    const next = size.index + (direction === 'halve' ? -1 : 1);
    return next < 0 || next >= size.ladder.length ? null : size.ladder[next].beats;
  }

  /**
   * Brings a running live loop to the deck's kept size, keeping its start. A larger size applies at
   * once and drops a shrink still waiting. A smaller one applies at once while the playhead is
   * early enough in the first lap of the new size, else at the end of the lap it falls in, named in
   * the engine by frame; a newer turn replaces a shrink waiting. Nothing when idle or off the grid.
   *
   * Every size laps from the lap the running loop is in (`getLapPhase`), so a length that is not a
   * whole number of frames carries the alternation on exactly: at once from the lap in progress, and
   * from a shrink's landing — always a whole frame, a lap end of both sizes — at the phase there.
   */
  resize(slot: Slot): void {
    const live = this.liveOf(slot);
    const size = this.sizing(slot);
    if (live === null || size === null) {
      return;
    }
    const { startFrame, endFrame, pendingEndFrame } = live;
    const frames = size.ladder[size.index].frames;
    const newEnd = startFrame + frames;
    // The lap in progress of the loop in force — the one a shrink waiting would change.
    const phase = this.runtime.getLapPhase(slot) ?? reduceLapPhase(live.lapPhase ?? 0);
    if (newEnd >= endFrame) {
      if (newEnd !== endFrame || pendingEndFrame !== null) {
        this.apply(slot, liveLoopOf(startFrame, newEnd, null, lapPhaseOrNone(phase)));
      }
      return;
    }

    const position = Number(this.runtime.position(slot));
    if (position <= startFrame + lapLength(phase, frames) - 2) {
      this.apply(slot, liveLoopOf(startFrame, newEnd, null, lapPhaseOrNone(phase)));
      return;
    }
    const lapEnd = startFrame + lapLength(phase, endFrame - startFrame);
    const at = shrinkLanding(startFrame, frames, position + 1, lapEnd, phase);
    const lapPhase = lapPhaseOrNone(lapPhaseOfFold(at, startFrame, newEnd, phase));
    this.store.setLiveLoop({
      slot,
      live: liveLoopOf(startFrame, endFrame, newEnd, live.lapPhase),
    });
    const named = this.runtime.changeLoopAt(slot, at, {
      startFrame,
      endFrame: newEnd,
      varispeedStart: 'wrap',
      ...(lapPhase === undefined ? {} : { lapPhase }),
    });
    if (!named) {
      logWarn(`DeckLiveLoop: deck ${slot} could not name a loop change at ${at} — left as it is.`);
      this.store.setLiveLoop({
        slot,
        live: liveLoopOf(startFrame, endFrame, null, live.lapPhase),
      });
    }
  }

  /**
   * Follows the engine: a live loop the engine no longer runs is over, and a shrink named in the
   * engine that has landed becomes the loop in force, with the lap phase it landed at.
   */
  reflect(slot: Slot): void {
    const live = this.liveOf(slot);
    if (live === null) {
      return;
    }
    const snapshot = this.runtime.snapshot(slot);
    if (snapshot.loop === null) {
      this.store.setLiveLoop({ slot, live: null });
      return;
    }
    if (live.pendingEndFrame === null || (snapshot.tune?.loopChange ?? null) !== null) {
      return;
    }
    const landed = snapshot.loop.endFrame === live.pendingEndFrame;
    this.store.setLiveLoop({
      slot,
      live: liveLoopOf(
        live.startFrame,
        landed ? live.pendingEndFrame : live.endFrame,
        null,
        landed ? lapPhaseOrNone(snapshot.loop.lapPhase) : live.lapPhase
      ),
    });
  }

  /** Declares the lines the engine saves at for the deck's grid and kept size, and ends a live
   *  loop when the deck has no grid. */
  private follow(slot: Slot, grid: DeckBeatGrid | null, beats: number): void {
    this.runtime.setCrossingCaptures(slot, this.linesFor(grid, beats));
    if (grid === null) {
      this.drop(slot);
    }
  }

  /** The beat lines, and the lines of the size when it is shorter than a beat: the images a push
   *  can start from. None without a grid, or when the ladder is empty. */
  private linesFor(grid: DeckBeatGrid | null, beats: number): readonly CrossingLines[] {
    if (grid === null) {
      return [];
    }
    const ladder = lengthLadder(grid.beatFrames);
    const index = nearestRungIndex(ladder, beats);
    if (index < 0) {
      return [];
    }
    const lines = (periodFrames: number): CrossingLines => ({
      originFrame: grid.beatOneFrame,
      periodFrames,
      keep: CROSSINGS_KEPT,
    });
    const frames = ladder[index].frames;
    return frames < grid.beatFrames ? [lines(grid.beatFrames), lines(frames)] : [lines(grid.beatFrames)];
  }

  /**
   * Pushes a loop of the kept size. It starts on the last line at or behind the frame after the
   * playhead — one ahead, since a wrap falls due a frame before the end and an end at the playhead
   * could never be met — or the first line ahead when none is behind. A start behind the playhead
   * whose image is not held, on a deck with no register record to lap on, starts on the next line
   * instead and is armed as the playhead crosses it. The end is a size on, which need not be a whole
   * frame: the loop then laps from its start line's lap phase, its lap ends on that line's grid.
   */
  private push(slot: Slot): void {
    const size = this.sizing(slot);
    if (size === null) {
      this.refuse(slot, 'has no beat grid with sizes to loop');
      return;
    }
    const snapshot = this.runtime.snapshot(slot);
    if (snapshot.transport !== 'playing') {
      this.refuse(slot, 'is not playing');
      return;
    }
    const { grid, ladder, index } = size;
    const frames = ladder[index].frames;
    const period = frames >= grid.beatFrames ? grid.beatFrames : frames;
    const ahead = Math.floor(Number(this.runtime.position(slot))) + 1;

    let start = loopStartAtOrBefore(grid, frames, ahead) ?? lineAfter(grid, period, ahead);
    if (
      start < ahead &&
      !this.runtime.holdsImageAt(slot, start) &&
      (snapshot.tune?.recordedFrames ?? null) === null
    ) {
      start = lineAfter(grid, period, ahead);
    }
    this.slip.begin(slot, 'live-loop');
    this.apply(slot, liveLoopOf(start, start + frames, null, loopLapPhase(grid, start, frames)));
  }

  /** Makes `live` the engine's loop: the store first, then the engine, then the marker queued
   *  over it, which `setActiveLoop` dropped. */
  private apply(slot: Slot, live: DeckLiveLoopState): void {
    this.store.setLiveLoop({ slot, live });
    this.runtime.setActiveLoop(slot, {
      startFrame: live.startFrame,
      endFrame: live.endFrame,
      varispeedStart: 'wrap',
      ...(live.lapPhase === undefined ? {} : { lapPhase: live.lapPhase }),
    });
    this.loops.reassertQueue(slot);
  }

  /**
   * The one way a live loop ends into the deck's play: back into the marker running underneath,
   * else into the tune on its own with a marker queued over the live loop engaged at once. The
   * live loop is cleared first, so `DeckLoops` lets its own engine calls through.
   *
   * A slip departure lands on the shadow's count, which laps the marker underneath. When the landing
   * cannot be made the end is the slip-off end below.
   *
   * The marker's loop goes back into the engine first, before any landing: a landing gives the loop
   * running at it the lap its count or fold is in, and a different loop set after it would start
   * again from its own lap 0 — a lap of alternating length off from then on.
   */
  private returnFrom(slot: Slot): void {
    this.store.setLiveLoop({ slot, live: null });
    const { runningId, runningBounds } = this.store.loops()[slot];
    if (runningId === null || runningBounds === null) {
      // No loop to land in: the line, then a marker queued over the live loop engages.
      this.slip.land(slot, 'live-loop');
      this.runtime.setActiveLoop(slot, null);
      this.loops.resumeRunning(slot);
      return;
    }
    this.loops.resumeRunning(slot);
    if (this.slip.land(slot, 'live-loop')) {
      return;
    }
    const { start, end } = runningBounds;
    // The lap the re-armed marker is in: its own lap 0, or the live loop's lap carried on when the
    // two have the same bounds.
    const phase = this.runtime.getLapPhase(slot) ?? reduceLapPhase(runningBounds.lapPhase ?? 0);
    const position = Math.floor(Number(this.runtime.position(slot)));
    if (position < start + lapLength(phase, end - start) - 1) {
      // Accepted transient: the marker restarts at its lap 0 wherever the playhead is in a lap, so
      // one lap of an alternating length may be a frame off; the laps after it add up exactly.
      return;
    }
    this.foldInto(slot, position, start, end, phase);
  }

  /**
   * Returns a deck whose playhead is at or past the marker's wrap point into the marker at the
   * place its lap has reached: the record lands there, carrying the lap's phase — a playhead one
   * tick from the loop's start would otherwise leave the marker a tick behind once a lap. The fold
   * counts the marker's laps in their alternating lengths from `phase`, and the landing carries the
   * lap it lands in, so the alternation carries on from there. The caller has re-armed the marker.
   *
   * With no register record to land on, the one exception: the deck plays with no loop and a worker
   * jump takes it to the fold computed now, so the landing is late by the worker's latency. It is
   * never sent to the loop's start.
   */
  private foldInto(slot: Slot, position: number, start: number, end: number, phase: number): void {
    const length = end - start;
    const lapPhase = lapPhaseOfFold(position, start, end, phase);
    const folded = foldIntoLoop(position, start, end, phase);
    const atGateOff = folded - start === lapLength(lapPhase, length) - 1;
    // A whole length lands as it always has: its laps never alternate.
    const lapOf = (landedPhase: number) =>
      Number.isInteger(length) ? {} : { lapPhase: reduceLapPhase(landedPhase) };
    const landed = this.runtime.land(
      slot,
      atGateOff
        ? { frame: start, held: true, ...lapOf(lapPhaseAfter(lapPhase, length, 1)) }
        : { frame: folded, held: false, ...lapOf(lapPhase) }
    );
    if (landed) {
      return;
    }

    const resume = this.loops.holdRunning(slot);
    this.runtime.setActiveLoop(slot, null);
    // Accepted transient: the resume re-arms the marker at its lap 0 after the worker jump, so one
    // lap of an alternating length may be a frame off; the laps after it add up exactly.
    this.runtime.seekToFrame(slot, folded).then(resume, (error: unknown) => {
      logError(`DeckLiveLoop: deck ${slot}'s jump back into its loop failed`, error);
      resume();
    });
  }

  private sizing(slot: Slot): LiveSize | null {
    const { beatGrid: grid, liveLoopBeats } = this.store.decks()[slot];
    if (grid === null) {
      return null;
    }
    const ladder = lengthLadder(grid.beatFrames);
    const index = nearestRungIndex(ladder, liveLoopBeats);
    return index < 0 ? null : { grid, ladder, index };
  }

  private liveOf(slot: Slot): DeckLiveLoopState | null {
    return this.store.loops()[slot].live;
  }

  private refuse(slot: Slot, reason: string): void {
    logWarn(`DeckLiveLoop: deck ${slot} ${reason} — live loop refused.`);
  }
}
