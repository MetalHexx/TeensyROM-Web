import { computed, signal, Signal, WritableSignal } from '@angular/core';
import { PAL_FRAME_INTERVAL_US } from '../asid/asid-constants';
import type { RegisterValuesSnapshot } from '../asid/register-frame';
import { C64Machine, FrameResult, MachineSnapshot } from '../cpu/c64-machine';
import { RegisterFrame } from '../asid/register-frame';
import type { SidFile } from '../sid/sid-file.model';
import { clamp, describeError } from './engine-utils';

/** The nudge window in real time. Frames are derived from the tune's rate so the felt range is
 *  the same on a 1x tune and a 2x-multispeed one. */
export const NUDGE_RANGE_MS = 1000;

/** How much music plays into the seam when a marker's end is auditioned. A feel default —
 *  confirm by ear on hardware. */
export const LOOP_AUDITION_PREROLL_MS = 2000;

/**
 * Anchor images kept at once: three recent ones plus the frame-0 seed that never leaves index 0.
 * Each is a 64 KB memory image, so this is a memory-against-replay-distance trade and nothing more.
 */
const ANCHOR_RING_SIZE = 4;

/**
 * An earlier machine image a captured point can replay forward from.
 *
 * A snapshot can only be run forward, so reaching a frame *before* a captured point means starting
 * from something older than it — this is that something.
 */
export interface PositionAnchor {
  readonly frame: number;
  readonly machine: MachineSnapshot;
  readonly registers: RegisterValuesSnapshot;
}

/**
 * A captured position plus its nudge offset, held as restorable state rather than as a frame
 * number: `machine`/`registers` are already resolved at `frame + offset`, so returning to the point
 * costs a restore and no emulation.
 */
export interface CapturedPoint {
  /** Where the point was originally captured, before any nudge. */
  readonly frame: number;
  /** −nudgeRangeFrames()..+nudgeRangeFrames(). */
  readonly offset: number;
  readonly machine: MachineSnapshot;
  readonly registers: RegisterValuesSnapshot;
  readonly anchor: PositionAnchor;
}

/**
 * A marker's end: a frame plus its nudge, and nothing else. It is compared against the position
 * counter once per tick rather than restored, so it needs no machine image — which is what keeps a
 * whole loop costing the memory of a single cue.
 */
export interface MarkerEnd {
  readonly frame: number;
  /** −nudgeRangeFrames()..+nudgeRangeFrames(). */
  readonly offset: number;
}

/**
 * A captured position, optionally with an end.
 *
 * With no end the marker is a cue: triggering it restores `start` and leaves playback running on
 * linearly. With an end that resolves after `start` it is a loop: triggering it restores `start` and
 * makes the marker the one the tick wrap plays against. An end that does not resolve after `start` —
 * absent, or nudged to or before it — describes no pass, so the marker behaves as a cue rather than
 * erroring; see `resolveLoop`.
 *
 * The asymmetry between the two fields is load-bearing: `start` carries a full machine image so
 * re-entry is a restore rather than a replay, while `end` is a bare frame number only ever compared
 * against the counter. That is what makes a loop cost the memory of a cue.
 */
export interface Marker {
  readonly start: CapturedPoint | null;
  readonly end: MarkerEnd | null;
}

/** A marker whose start and end are both present and still in order — a pass there is something to
 *  play. */
interface ResolvedLoop {
  readonly start: CapturedPoint;
  readonly outFrame: number;
}

/**
 * What `MarkerState` needs from the coordinator, handed in rather than reached for: a capture or a
 * restore touches the live machine and the tune session's position counter, which the coordinator's
 * tune session owns, and a restore ends by queueing the chip resync the coordinator's tick loop
 * drains. Taking these as callbacks — rather than importing the coordinator — is what keeps this
 * module able to sit underneath it instead of beside it.
 */
export interface MarkerHost {
  /** The live machine, or null with nothing loaded. */
  machine(): C64Machine | null;
  /** The live register frame, or null with nothing loaded. */
  frame(): RegisterFrame | null;
  /** The loaded file, needed to build the throwaway machine a nudge replays on. */
  file(): SidFile | null;
  /** The position counter — read for a capture. */
  framesRendered(): number;
  /** Adopts a new position counter without restoring machine state — what an audition's live
   *  forward replay needs, since it never leaves the live machine to begin with. */
  setFramesRendered(value: number): void;
  /** The tune's nominal frame interval, feeding the same rate `msToFrames` converts against. */
  nominalIntervalUs(): number;
  /** Puts machine + register state back onto the live pair, adopts the frame number, and queues the
   *  chip resync the restore owes the stream. */
  restoreState(machine: MachineSnapshot, registers: RegisterValuesSnapshot, frameNumber: number): void;
  /** Queues the chip resync directly, for a restore that never left the live machine — see
   *  `auditionMarkerEnd`. */
  queueResync(): void;
  /** Whichever voices are silenced right now, latched XOR held — seeds a replay's throwaway frame. */
  effectiveMutes(): readonly boolean[];
  /** Marks the engine's failure state and logs why. */
  fail(reason: string): void;
}

/**
 * Markers and the nudge machinery behind them: capture, restore and walk a position without
 * re-emulating the tune, and the anchor ring that makes a deep nudge affordable.
 *
 * Every public marker method here is synchronous — "launch playback first if it is not already
 * running" is the coordinator's job (`play()`), sequenced around a call into this class rather than
 * folded into it.
 */
export class MarkerState {
  constructor(private readonly host: MarkerHost) {}

  /**
   * Markers marked up side by side, appended and removed freely. Each holds its start as restorable
   * state — re-entry is a snapshot restore, so a pass costs the same whether the point sits at frame
   * 10 or frame 10,000 — and its end, if any, as a frame number alone, only ever compared against the
   * position counter. Never holds `null`: an empty row is `{ start: null, end: null }`, so there is
   * exactly one representation for "nothing marked" rather than two that mean the same thing.
   */
  readonly markers: WritableSignal<readonly Marker[]> = signal([]);
  /** The marker currently looping, or null. */
  readonly loopingMarker: WritableSignal<number | null> = signal(null);
  /** The marker that takes over when the looping one finishes its lap, or null. */
  readonly queuedMarker: WritableSignal<number | null> = signal(null);

  /**
   * The nudge range in frames for the loaded tune.
   *
   * Derived from the tune's own rate (`nominalIntervalUs` divided by `callsPerFrame`), never the
   * live speed multiplier — riding the speed fader must not make the range breathe, and the anchor
   * spacing below is only valid because this stays fixed for a given tune.
   */
  readonly nudgeRangeFrames: Signal<number> = computed<number>(() => this.msToFrames(NUDGE_RANGE_MS));

  /**
   * Frames between the anchor images `recordAnchor` retains for the nudge to replay forward from.
   *
   * Derived from the nudge range rather than fixed, to hold the ring's actual reach: eviction keeps
   * the seed plus the 3 newest recordings, i.e. `ANCHOR_RING_SIZE − 2` gaps of this interval between
   * the oldest kept (non-seed) anchor and the newest. A query can land right on the newest recording
   * (nothing rounds that away), so the guarantee needs `(ANCHOR_RING_SIZE − 2) × interval ≥
   * nudgeRangeFrames()` — one fewer factor than `(ANCHOR_RING_SIZE − 1)` would suggest, since the
   * seed anchor is not part of this evenly-spaced run. A wider range on a multispeed tune widens the
   * spacing accordingly, or the ring falls short of it and every nudge that deep replays from the
   * frame-0 seed instead of a recent anchor — the O(distance-from-start) stall this ring exists to
   * avoid.
   */
  private readonly anchorSnapshotFrameInterval = computed<number>(() =>
    Math.max(1, Math.ceil(this.nudgeRangeFrames() / (ANCHOR_RING_SIZE - 2)))
  );

  /**
   * Recent machine images, oldest first, that a nudge can replay forward from.
   *
   * Index 0 is the frame-0 seed and is never evicted: it is the only anchor guaranteed to sit
   * before every capture, so it is what a point taken in the first seconds of a tune falls back to.
   */
  private anchorRing: PositionAnchor[] = [];

  /** Converts a real-time duration to frames at the tune's own rate (`nominalIntervalUs` divided by
   *  `callsPerFrame`), never the live speed multiplier — shared by the nudge range and the loop
   *  audition pre-roll so both breathe with the tune, never the speed fader. */
  private msToFrames(ms: number): number {
    const callsPerFrame = this.host.machine()?.callsPerFrame ?? 1;
    const nominalUs = this.host.nominalIntervalUs();
    const tuneIntervalUs = nominalUs > 0 ? nominalUs / callsPerFrame : PAL_FRAME_INTERVAL_US;
    return Math.round((ms * 1000) / tuneIntervalUs);
  }

  /** Clears every marker, and lets go of whatever was looping — a new tune invalidates every
   *  captured snapshot, since a marker's start holds machine state, not a frame number. */
  clear(): void {
    this.markers.set([]);
    this.stopLoop();
  }

  /** Drops the anchor ring — its entries describe a machine that no longer exists, at frame numbers
   *  a subtune re-init has just invalidated. A marker's start survives this deliberately: it owns
   *  its own anchor, so it needs no ring to persist. */
  resetAnchorRing(): void {
    this.anchorRing = [];
  }

  /** Adds the live machine to the ring, dropping the oldest non-seed entry once it is full. */
  recordAnchor(machine: C64Machine, frame: RegisterFrame, framesRendered: number): void {
    this.anchorRing.push({
      frame: framesRendered,
      machine: machine.snapshot(),
      registers: frame.snapshotValues(),
    });
    if (this.anchorRing.length > ANCHOR_RING_SIZE) {
      this.anchorRing.splice(1, 1);
    }
  }

  /** Records an anchor only once every `anchorSnapshotFrameInterval()` frames — what the tick loop
   *  calls every frame so the interval check lives beside the ring it gates. */
  maybeRecordAnchor(machine: C64Machine, frame: RegisterFrame, framesRendered: number): void {
    if (framesRendered % this.anchorSnapshotFrameInterval() === 0) {
      this.recordAnchor(machine, frame, framesRendered);
    }
  }

  /**
   * The newest ring entry far enough back that a full backward nudge from `frame` still lands after
   * it, falling back to the frame-0 seed.
   */
  private selectAnchor(frame: number): PositionAnchor | null {
    const latestUsable = frame - this.nudgeRangeFrames();
    for (let i = this.anchorRing.length - 1; i >= 0; i--) {
      if (this.anchorRing[i].frame <= latestUsable) {
        return this.anchorRing[i];
      }
    }
    return this.anchorRing[0] ?? null;
  }

  /**
   * Snapshots the live machine at the current position and pairs it with an anchor from the ring.
   * Returns null when no tune is loaded.
   *
   * `offset` starts at 0, so the resolved snapshot *is* the captured one — capture costs a copy and
   * no replay.
   */
  private captureAnchoredPoint(): CapturedPoint | null {
    const machine = this.host.machine();
    const frame = this.host.frame();
    if (machine === null || frame === null) return null;

    const framesRendered = this.host.framesRendered();
    const anchor = this.selectAnchor(framesRendered);
    if (anchor === null) return null;

    return {
      frame: framesRendered,
      offset: 0,
      machine: machine.snapshot(),
      registers: frame.snapshotValues(),
      anchor,
    };
  }

  /**
   * Replays forward from `point.anchor` to `point.frame + newOffset`, returning the resolved point.
   * Returns null and fails the engine if the replay cannot complete.
   *
   * Deliberately does *not* adopt the throwaway pair as live the way a landing jump does: a nudge is
   * a setup gesture and must leave playback exactly where it is.
   */
  private resolvePoint(point: CapturedPoint, newOffset: number): CapturedPoint | null {
    const file = this.host.file();
    if (file === null) return null;

    const target = resolvedFrame({ ...point, offset: newOffset });
    const replayFrame = new RegisterFrame();
    this.host.effectiveMutes().forEach((muted, voice) => replayFrame.setVoiceMuted(voice, muted));
    const replayMachine = new C64Machine(file, replayFrame);
    replayMachine.restore(point.anchor.machine);
    replayFrame.restoreValues(point.anchor.registers);

    for (let i = point.anchor.frame; i < target; i++) {
      let result: FrameResult;
      try {
        result = replayMachine.runFrame();
      } catch (error) {
        this.host.fail(`the marker nudge to frame ${target} failed during replay — ${describeError(error)}`);
        return null;
      }
      if (!result.completed) {
        this.host.fail(`the marker nudge to frame ${target} exceeded its cycle budget during replay`);
        return null;
      }
      replayFrame.takeSnapshot(); // discarded — clears per-frame duplicate-write tracking only
    }

    return {
      ...point,
      offset: newOffset,
      machine: replayMachine.snapshot(),
      registers: replayFrame.snapshotValues(),
    };
  }

  /** Puts a captured point back onto the live machine. The stored snapshot is the nudged one, so the
   *  counter has to name the frame it actually is — otherwise the playhead and the row's frame
   *  readout both drift by the offset. */
  private restorePoint(point: CapturedPoint): void {
    this.host.restoreState(point.machine, point.registers, resolvedFrame(point));
  }

  /**
   * Appends a new marker, capturing the current position into its start — as machine state, not as
   * a frame number. Returns the row's index.
   *
   * The point is paired with an anchor from the ring on the way in, which is what makes a later
   * backward nudge of it possible at all. With no tune loaded the capture comes back null and the
   * row is still appended, empty — `captureMarkerStart` is what fills it in once a tune exists.
   */
  addMarker(): number {
    const start = this.captureAnchoredPoint();
    const index = this.markers().length;
    this.markers.update((markers) => [...markers, { start, end: null }]);
    return index;
  }

  /**
   * (Re)captures the current position into an existing row's start, exactly as `addMarker` captures
   * a new one. Leaves whatever end the row already holds untouched. The only way back into a start
   * `clearMarker` has blanked, since markers are otherwise append-only.
   */
  captureMarkerStart(index: number): void {
    if (index < 0 || index >= this.markers().length) return;
    const start = this.captureAnchoredPoint();
    if (start === null) return;
    this.updateMarker(index, (current) => ({ ...current, start }));
  }

  /**
   * Marks a row's end at the current frame, which is what turns it into a loop candidate — see
   * `resolveLoop` for when it actually resolves to one. No snapshot: the end is only ever compared.
   */
  setMarkerEnd(index: number): void {
    if (index < 0 || index >= this.markers().length || this.host.machine() === null) return;
    const end: MarkerEnd = { frame: this.host.framesRendered(), offset: 0 };
    this.updateMarker(index, (current) => ({ ...current, end }));
  }

  /** Drops a row's end, which is what turns a loop back into a cue. Leaves the start untouched. */
  clearMarkerEnd(index: number): void {
    if (index < 0 || index >= this.markers().length) return;
    this.updateMarker(index, (current) => ({ ...current, end: null }));
  }

  /**
   * Walks a row's start up to ±`nudgeRangeFrames()` onto the exact transient, re-deriving its
   * snapshot from the point's anchor; a no-op with no start marked. A setup gesture, for the same
   * reason the capture itself is not: the re-derivation replays frames, so it must not run per drag
   * tick.
   */
  setMarkerStartOffset(index: number, offset: number): void {
    if (index < 0 || index >= this.markers().length || !Number.isFinite(offset)) return;
    const start = this.markers()[index].start;
    if (start === null) return;

    const range = this.nudgeRangeFrames();
    const clamped = clamp(Math.round(offset), -range, range);
    if (clamped === start.offset) return;

    const resolved = this.resolvePoint(start, clamped);
    if (resolved === null) return;
    this.updateMarker(index, (current) => ({ ...current, start: resolved }));
  }

  /**
   * Walks a row's end up to ±`nudgeRangeFrames()`; a no-op with no end marked. Arithmetic alone —
   * the end is a number the tick compares, so moving it replays nothing.
   */
  setMarkerEndOffset(index: number, offset: number): void {
    if (index < 0 || index >= this.markers().length || !Number.isFinite(offset)) return;
    const end = this.markers()[index].end;
    if (end === null) return;

    const range = this.nudgeRangeFrames();
    const nudged: MarkerEnd = { ...end, offset: clamp(Math.round(offset), -range, range) };
    this.updateMarker(index, (current) => ({ ...current, end: nudged }));
  }

  /**
   * Engages `index` now if nothing is looping, or queues it behind the current lap if something is
   * — the sync half of the trigger. The coordinator's async `triggerMarker` launches playback first
   * if it is not already running, then calls this once it is.
   *
   * A no-op for a row with no start. Re-triggering the marker already looping, with nothing queued
   * behind it, restarts its lap rather than queueing behind itself.
   */
  triggerMarker(index: number): void {
    if (index < 0 || index >= this.markers().length) return;
    if (this.markers()[index].start === null) return;

    const active = this.loopingMarker();
    if (active === null || (active === index && this.queuedMarker() === null)) {
      this.engageMarker(index);
      return;
    }
    // Newest trigger wins, and playback is left alone to finish its lap.
    this.queuedMarker.set(index);
  }

  /**
   * Re-enters `index` at its start and makes it the active marker, immediately and without going
   * through the queue — a setup gesture on a specific row, not a performance trigger. No-op for a
   * row with no start.
   */
  auditionMarkerStart(index: number): void {
    this.engageMarker(index);
  }

  /**
   * Re-enters `index` far enough before its end to hear the loop-back seam, and makes it the active
   * marker so the wrap actually happens. No-op for a row that does not resolve to a loop.
   *
   * Re-entry is a restore, not a replay — see `engageMarker` — and the pre-roll itself replays
   * forward on the live machine from that restored start, so the cost is bounded by the loop's own
   * length however deep the marker sits in the tune.
   */
  auditionMarkerEnd(index: number): void {
    if (index < 0 || index >= this.markers().length) return;
    const loop = this.resolveLoop(this.markers()[index]);
    if (loop === null) return;
    const machine = this.host.machine();
    const frame = this.host.frame();
    if (machine === null || frame === null) return;

    this.engageMarker(index);

    const startFrame = resolvedFrame(loop.start);
    const prerollFrames = this.msToFrames(LOOP_AUDITION_PREROLL_MS);
    const target = Math.max(startFrame, loop.outFrame - prerollFrames);
    const framesToReplay = target - startFrame;
    if (framesToReplay <= 0) return;

    for (let i = 0; i < framesToReplay; i++) {
      let result: FrameResult;
      try {
        result = machine.runFrame();
      } catch (error) {
        this.host.fail(`the marker audition for row ${index} failed during replay — ${describeError(error)}`);
        return;
      }
      if (!result.completed) {
        this.host.fail(`the marker audition for row ${index} exceeded its cycle budget during replay`);
        return;
      }
      frame.takeSnapshot(); // discarded — resets per-frame duplicate-write tracking only;
                             // the accumulated register values persist across the call regardless
    }

    this.host.setFramesRendered(target);
    this.host.queueResync();
  }

  /**
   * Drops out of the loop at once, leaving playback running on linearly from wherever it is, and
   * forgets anything queued behind it.
   *
   * Deliberately immediate where a trigger waits for the lap: stopping is a get-out, not a musical
   * transition.
   */
  stopLoop(): void {
    this.loopingMarker.set(null);
    this.queuedMarker.set(null);
  }

  /** Empties a row's start and end, returning it to "Add", and keeps the row itself in place. Lets
   *  go of it if it was the one looping or the one queued behind it. */
  clearMarker(index: number): void {
    if (index < 0 || index >= this.markers().length) return;
    this.updateMarker(index, () => ({ start: null, end: null }));
    if (this.loopingMarker() === index) {
      this.loopingMarker.set(null);
    }
    if (this.queuedMarker() === index) {
      this.queuedMarker.set(null);
    }
  }

  /**
   * Removes a row outright, shifting every later index down by one. `loopingMarker` and
   * `queuedMarker` are indices into this same array, so each is cleared if it names the deleted row
   * and decremented if it names one that just shifted — getting this wrong silently loops the wrong
   * row, which is worse than an error.
   */
  deleteMarker(index: number): void {
    if (index < 0 || index >= this.markers().length) return;
    this.markers.update((markers) => markers.filter((_, i) => i !== index));

    const active = this.loopingMarker();
    if (active === index) {
      this.loopingMarker.set(null); // the row looping is gone — stop looping
    } else if (active !== null && active > index) {
      this.loopingMarker.set(active - 1);
    }

    const queued = this.queuedMarker();
    if (queued === index) {
      this.queuedMarker.set(null);
    } else if (queued !== null && queued > index) {
      this.queuedMarker.set(queued - 1);
    }
  }

  /**
   * How far the looping marker is through its bounds, 0–100; 0 for every other row, whatever shape
   * it is.
   *
   * `framesRendered` is the coordinator's *published* stats figure, not the live counter, so
   * progress moves with the same every-25-frames cadence the playhead does instead of demanding
   * change detection per frame.
   */
  progressPercentFor(index: number, framesRendered: number): number {
    if (index !== this.loopingMarker()) return 0;
    if (index < 0 || index >= this.markers().length) return 0;
    const loop = this.resolveLoop(this.markers()[index]);
    if (loop === null) return 0;

    const startFrame = resolvedFrame(loop.start);
    const span = loop.outFrame - startFrame;
    return clamp(((framesRendered - startFrame) / span) * 100, 0, 100);
  }

  /**
   * Advances the looping marker against the position the tick loop just reached: drops out when a
   * nudge has crossed its ends (or its end was dropped), or re-enters/switches once the end is
   * reached. Returns whether a restore was just queued — the tick loop must not publish stats twice
   * on that tick, since the resync it queued goes out on the next one.
   */
  advanceLoop(framesRendered: number): boolean {
    const active = this.loopingMarker();
    if (active === null) return false;

    const loop = this.resolveLoop(this.markers()[active]);
    if (loop === null) {
      // Ends nudged until they crossed (or an end dropped mid-lap) describe no pass — drop out
      // rather than re-enter every tick.
      this.stopLoop();
      return false;
    }
    if (framesRendered < loop.outFrame) return false;

    const queued = this.queuedMarker();
    if (queued === null) {
      // A restore, not a replay: the pass costs nothing per frame however deep the start sits.
      this.restorePoint(loop.start);
    } else if (!this.engageMarker(queued)) {
      // The lap the trigger waited for is over, but the queued marker lost its start (or its end
      // was nudged across it) while it waited — nothing to switch to, so drop out.
      this.stopLoop();
    }
    return true;
  }

  /**
   * The row as `advanceLoop` needs it: the point to restore, and the frame that triggers the
   * restore. Null unless start and end are both present and, with their nudges applied, still in
   * order — an absent end, or one that has crossed or met the start, describes no pass at all, and a
   * loop running on it would re-enter on every tick rather than play anything. A marker in this
   * state is not broken, it is a cue.
   */
  private resolveLoop(marker: Marker): ResolvedLoop | null {
    if (marker.start === null || marker.end === null) return null;
    const outFrame = resolvedFrame(marker.end);
    return outFrame > resolvedFrame(marker.start) ? { start: marker.start, outFrame } : null;
  }

  /**
   * Re-enters a row at its start and makes it the one running, dropping whatever was queued behind
   * it. `loopingMarker` only ends up naming it when the row resolves to a loop — a cue's engagement
   * restores its start and leaves the loop, exactly as it must. Re-checks the resolved shape at the
   * point of engagement — a queued row's end can be nudged across its start while it waits, so the
   * trigger-time check alone isn't enough. Returns false when the row has no start.
   */
  private engageMarker(index: number): boolean {
    if (index < 0 || index >= this.markers().length) return false;
    const marker = this.markers()[index];
    if (marker.start === null) return false;
    this.restorePoint(marker.start);
    this.loopingMarker.set(this.resolveLoop(marker) === null ? null : index);
    this.queuedMarker.set(null);
    return true;
  }

  private updateMarker(index: number, next: (current: Marker) => Marker): void {
    this.markers.update((markers) => markers.map((m, i) => (i === index ? next(m) : m)));
  }
}

/** Where a point actually sits once its nudge is applied — never before the start of the tune.
 *  Applies equally to a `CapturedPoint`'s start and a `MarkerEnd`, which is why this stays one
 *  implementation over their common shape rather than two. */
function resolvedFrame(point: { readonly frame: number; readonly offset: number }): number {
  return Math.max(0, point.frame + point.offset);
}
