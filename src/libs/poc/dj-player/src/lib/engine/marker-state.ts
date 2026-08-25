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

/** How much music plays into the seam when a loop's out-point is auditioned. A feel default —
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

export type CueSlot = CapturedPoint;

/**
 * The loop's exit point: a frame plus its nudge, and nothing else. It is compared against the
 * position counter once per tick rather than restored, so it needs no machine image — which is what
 * keeps a whole loop costing the memory of a single cue.
 */
export interface LoopOutPoint {
  readonly frame: number;
  /** −nudgeRangeFrames()..+nudgeRangeFrames(). */
  readonly offset: number;
}

/**
 * One punch-in loop: a loop's two ends held together, appended and removed freely, so any number of
 * loops can be marked up independently and engaged against each other.
 *
 * A row comes into being on its first tap, whichever end that is, and only *plays* once both ends
 * are marked and still in order with their nudges applied. `addLoop`/`clearLoopSlot` both start it
 * at `{ in: null, out: null }`, so `null` never occurs in the collection itself — only inside a row.
 */
export interface LoopSlot {
  /** Restorable state, exactly as a cue holds it — re-entry is a restore, never a replay. */
  readonly in: CapturedPoint | null;
  /** A frame plus its nudge; compared against the counter, never restored. */
  readonly out: LoopOutPoint | null;
}

/** A slot whose ends are both marked and still in order — a pass there is something to play. */
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
   *  `auditionLoopOut`. */
  queueResync(): void;
  /** Whichever voices are silenced right now, latched XOR held — seeds a replay's throwaway frame. */
  effectiveMutes(): readonly boolean[];
  /** Marks the engine's failure state and logs why. */
  fail(reason: string): void;
}

/**
 * Cues, loops and the nudge machinery behind both: capture, restore and walk a position without
 * re-emulating the tune, and the anchor ring that makes a deep nudge affordable.
 *
 * Every public cue/loop method here is synchronous — "launch playback first if it is not already
 * running" is the coordinator's job (`ensurePlaying()`), sequenced around a call into this class
 * rather than folded into it.
 */
export class MarkerState {
  constructor(private readonly host: MarkerHost) {}

  readonly cues: WritableSignal<readonly (CueSlot | null)[]> = signal([]);
  /**
   * Loops marked up side by side, appended and removed freely. Each holds its entry as restorable
   * state — re-entry is a snapshot restore, so a pass costs the same whether the point sits at frame
   * 10 or frame 10,000 — and its exit as a frame number alone, which is only ever compared against
   * the position counter. Never holds `null`: an empty row is `{ in: null, out: null }`, so there is
   * exactly one representation for "nothing marked" rather than two that mean the same thing.
   */
  readonly loopSlots: WritableSignal<readonly LoopSlot[]> = signal([]);
  /** The slot currently looping, or null. */
  readonly activeLoopSlot: WritableSignal<number | null> = signal(null);
  /** The slot that takes over when the active one finishes its lap, or null. */
  readonly queuedLoopSlot: WritableSignal<number | null> = signal(null);

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

  /** Clears every cue and loop row, and lets go of whatever was looping — a new tune invalidates
   *  every captured snapshot, since cues and loop entries hold machine state, not frame numbers. */
  clear(): void {
    this.cues.set([]);
    this.loopSlots.set([]);
    this.stopLoop();
  }

  /** Drops the anchor ring — its entries describe a machine that no longer exists, at frame numbers
   *  a subtune re-init has just invalidated. Cues and a loop's entry survive this deliberately: each
   *  owns its own anchor, so neither needs the ring to persist. */
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
        this.host.fail(`the cue nudge to frame ${target} failed during replay — ${describeError(error)}`);
        return null;
      }
      if (!result.completed) {
        this.host.fail(`the cue nudge to frame ${target} exceeded its cycle budget during replay`);
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
   * Appends a new cue row, capturing the current position into it — as machine state, not as a
   * frame number. Returns the row's index.
   *
   * The whole point: you are already *at* this position, so there is nothing to re-derive. Storing
   * the state itself is what lets `hopToCue` skip the replay a frame-number jump cannot avoid.
   *
   * The point is paired with an anchor from the ring on the way in, which is what makes a later
   * backward nudge of it possible at all. With no tune loaded the capture comes back null and the
   * row is still appended, empty — `captureCue` is what fills it in once a tune exists.
   */
  addCue(): number {
    const cue = this.captureAnchoredPoint();
    const index = this.cues().length;
    this.cues.update((cues) => [...cues, cue]);
    return index;
  }

  /**
   * (Re)captures the current position into an existing cue row, exactly as `addCue` captures a new
   * one. The only way back into a row `clearCue` has blanked, since cues are otherwise append-only.
   */
  captureCue(index: number): void {
    if (index < 0 || index >= this.cues().length) return;
    const cue = this.captureAnchoredPoint();
    if (cue === null) return;
    this.cues.update((cues) => cues.map((c, i) => (i === index ? cue : c)));
  }

  /**
   * Walks a captured cue up to ±`nudgeRangeFrames()` onto the exact transient; a no-op for an empty
   * row. Clamped to that range, and rounded — a frame is the finest position there is.
   *
   * Re-derives the row's resolved snapshot by replaying from its anchor, which is why this is a
   * setup gesture and `hopToCue` is not: the cost here is bounded by the anchor distance plus the
   * nudge range, never by how deep into the tune the point was taken.
   */
  setCueOffset(index: number, offset: number): void {
    if (index < 0 || index >= this.cues().length || !Number.isFinite(offset)) return;
    const cue = this.cues()[index];
    if (cue === null) return;

    const range = this.nudgeRangeFrames();
    const clamped = clamp(Math.round(offset), -range, range);
    if (clamped === cue.offset) return;

    const resolved = this.resolvePoint(cue, clamped);
    if (resolved === null) return;
    this.cues.update((cues) => cues.map((c, i) => (i === index ? resolved : c)));
  }

  /** Whether `index` names a cue row that has something captured — the bounds-and-emptiness half of
   *  `hopToCue`, split out so the coordinator can check it before deciding whether to launch. */
  hasCue(index: number): boolean {
    return index >= 0 && index < this.cues().length && this.cues()[index] !== null;
  }

  /**
   * Returns to a captured cue row; a no-op for an empty or out-of-range row. See `restorePoint` for
   * why the hop itself costs no emulation.
   *
   * Escapes a running loop immediately rather than waiting out its lap — the same effect as
   * `stopLoop()`, called rather than reimplemented — and leaves both slots' points untouched.
   */
  hopToCue(index: number): void {
    if (!this.hasCue(index)) return;
    const cue = this.cues()[index];
    if (cue === null) return;
    this.stopLoop();
    this.restorePoint(cue);
  }

  /** Empties a cue row, returning it to "Add", and keeps the row itself in place. */
  clearCue(index: number): void {
    if (index < 0 || index >= this.cues().length) return;
    this.cues.update((cues) => cues.map((c, i) => (i === index ? null : c)));
  }

  /** Removes a cue row outright, shifting every later index down by one. */
  deleteCue(index: number): void {
    if (index < 0 || index >= this.cues().length) return;
    this.cues.update((cues) => cues.filter((_, i) => i !== index));
  }

  /**
   * Marks a row's entry at the current position, capturing it exactly as `addCue` does — the
   * snapshot is what lets every later pass re-enter without replaying the tune. Leaves whatever
   * exit the row already holds.
   */
  tapLoopIn(index: number): void {
    if (index < 0 || index >= this.loopSlots().length) return;
    const point = this.captureAnchoredPoint();
    if (point === null) return;
    this.updateLoopSlot(index, (current) => ({ in: point, out: current.out }));
  }

  /** Marks a row's exit at the current frame. No snapshot: the exit is only ever compared. */
  tapLoopOut(index: number): void {
    if (index < 0 || index >= this.loopSlots().length || this.host.machine() === null) return;
    const point: LoopOutPoint = { frame: this.host.framesRendered(), offset: 0 };
    this.updateLoopSlot(index, (current) => ({ in: current.in, out: point }));
  }

  /**
   * Walks a row's entry up to ±`nudgeRangeFrames()` onto the transient, re-deriving its snapshot
   * from the point's anchor; a no-op with no entry marked. A setup gesture, for the same reason
   * `setCueOffset` is: the re-derivation replays frames, so it must not run per drag tick.
   */
  setLoopInOffset(index: number, frames: number): void {
    if (index < 0 || index >= this.loopSlots().length || !Number.isFinite(frames)) return;
    const point = this.loopSlots()[index].in;
    if (point === null) return;

    const range = this.nudgeRangeFrames();
    const clamped = clamp(Math.round(frames), -range, range);
    if (clamped === point.offset) return;

    const resolved = this.resolvePoint(point, clamped);
    if (resolved === null) return;
    this.updateLoopSlot(index, (current) => ({ ...current, in: resolved }));
  }

  /**
   * Walks a row's exit up to ±`nudgeRangeFrames()`; a no-op with no exit marked. Arithmetic
   * alone — the exit is a number the tick compares, so moving it replays nothing.
   */
  setLoopOutOffset(index: number, frames: number): void {
    if (index < 0 || index >= this.loopSlots().length || !Number.isFinite(frames)) return;
    const point = this.loopSlots()[index].out;
    if (point === null) return;

    const range = this.nudgeRangeFrames();
    const nudged: LoopOutPoint = { ...point, offset: clamp(Math.round(frames), -range, range) };
    this.updateLoopSlot(index, (current) => ({ ...current, out: nudged }));
  }

  /** Whether `index` names a row whose ends are both marked and still in order — the punch-time
   *  playability half of `punchLoop`, split out so the coordinator can check it before launching. */
  isLoopPlayable(index: number): boolean {
    return (
      index >= 0 && index < this.loopSlots().length && this.resolveLoopSlot(this.loopSlots()[index]) !== null
    );
  }

  /**
   * Engages `index` now if nothing is looping, or queues it behind the current lap if something is.
   * Assumes playability has already been checked (`isLoopPlayable`) and playback is already running.
   *
   * The asymmetry with `stopLoop` is the point of the gesture: a punch is musical and waits for the
   * bar it is already in to finish, so the switch lands where the operator hears it land.
   */
  punchLoop(index: number): void {
    const active = this.activeLoopSlot();
    // Punching the row already playing, with nothing waiting behind it, is a re-trigger — the same
    // gesture as re-hopping a cue.
    if (active === null || (active === index && this.queuedLoopSlot() === null)) {
      this.engageLoop(index);
      return;
    }
    // Newest punch wins, and playback is left alone to finish its lap.
    this.queuedLoopSlot.set(index);
  }

  /**
   * Re-enters `index` far enough before its out-point to hear the loop-back seam, and makes it the
   * active loop so the wrap actually happens. No-op for a row that is not playable.
   *
   * Re-entry is a restore, not a replay — see `engageLoop` — and the pre-roll itself replays forward
   * on the live machine from that restored in-point, so the cost is bounded by the loop's own length
   * however deep the loop sits in the tune.
   */
  auditionLoopOut(index: number): void {
    if (index < 0 || index >= this.loopSlots().length) return;
    const loop = this.resolveLoopSlot(this.loopSlots()[index]);
    if (loop === null) return;
    const machine = this.host.machine();
    const frame = this.host.frame();
    if (machine === null || frame === null) return;

    this.engageLoop(index);

    const inFrame = resolvedFrame(loop.start);
    const prerollFrames = this.msToFrames(LOOP_AUDITION_PREROLL_MS);
    const target = Math.max(inFrame, loop.outFrame - prerollFrames);
    const framesToReplay = target - inFrame;
    if (framesToReplay <= 0) return;

    for (let i = 0; i < framesToReplay; i++) {
      let result: FrameResult;
      try {
        result = machine.runFrame();
      } catch (error) {
        this.host.fail(`the loop audition for slot ${index} failed during replay — ${describeError(error)}`);
        return;
      }
      if (!result.completed) {
        this.host.fail(`the loop audition for slot ${index} exceeded its cycle budget during replay`);
        return;
      }
      frame.takeSnapshot(); // discarded — resets per-frame duplicate-write tracking only;
                             // the accumulated register values persist across the call regardless
    }

    this.host.setFramesRendered(target);
    this.host.queueResync();
  }

  /**
   * Re-enters `index` at its in-point and makes it the active loop, immediately and without going
   * through the queue — a setup gesture on a specific row, not a performance punch, mirroring
   * `auditionLoopOut`. Unlike the out-point audition there is no seam ahead to pre-roll toward:
   * restoring the in-point snapshot is itself the audible feedback. No-op for a row that is not
   * playable.
   */
  auditionLoopIn(index: number): void {
    if (index < 0 || index >= this.loopSlots().length) return;
    if (this.resolveLoopSlot(this.loopSlots()[index]) === null) return;
    this.engageLoop(index);
  }

  /** Empties a row, and lets go of it if it was the one playing or the one waiting to. */
  clearLoopSlot(index: number): void {
    if (index < 0 || index >= this.loopSlots().length) return;
    this.updateLoopSlot(index, () => ({ in: null, out: null }));
    if (this.activeLoopSlot() === index) {
      this.activeLoopSlot.set(null);
    }
    if (this.queuedLoopSlot() === index) {
      this.queuedLoopSlot.set(null);
    }
  }

  /**
   * Appends an empty loop row — `{ in: null, out: null }`, the same shape `clearLoopSlot` blanks a
   * row back to, so an empty row has exactly one representation. Returns the row's index.
   */
  addLoop(): number {
    const index = this.loopSlots().length;
    this.loopSlots.update((slots) => [...slots, { in: null, out: null }]);
    return index;
  }

  /**
   * Removes a loop row outright, shifting every later index down by one. `activeLoopSlot` and
   * `queuedLoopSlot` are indices into this same array, so each is cleared if it names the deleted
   * row and decremented if it names one that just shifted — getting this wrong silently loops the
   * wrong row, which is worse than an error.
   */
  deleteLoop(index: number): void {
    if (index < 0 || index >= this.loopSlots().length) return;
    this.loopSlots.update((slots) => slots.filter((_, i) => i !== index));

    const active = this.activeLoopSlot();
    if (active === index) {
      this.activeLoopSlot.set(null); // the row playing is gone — stop looping
    } else if (active !== null && active > index) {
      this.activeLoopSlot.set(active - 1);
    }

    const queued = this.queuedLoopSlot();
    if (queued === index) {
      this.queuedLoopSlot.set(null);
    } else if (queued !== null && queued > index) {
      this.queuedLoopSlot.set(queued - 1);
    }
  }

  /**
   * Drops out of the loop at once, leaving playback running on linearly from wherever it is, and
   * forgets anything queued behind it.
   *
   * Deliberately immediate where a punched switch waits for the lap: stopping is a get-out, not a
   * musical transition.
   */
  stopLoop(): void {
    this.activeLoopSlot.set(null);
    this.queuedLoopSlot.set(null);
  }

  /**
   * How far the active row is through its bounds, 0–100; 0 for every other row, playable or not.
   *
   * `framesRendered` is the coordinator's *published* stats figure, not the live counter, so
   * progress moves with the same every-25-frames cadence the playhead does instead of demanding
   * change detection per frame.
   */
  progressPercentFor(slot: number, framesRendered: number): number {
    if (slot !== this.activeLoopSlot()) return 0;
    if (slot < 0 || slot >= this.loopSlots().length) return 0;
    const loop = this.resolveLoopSlot(this.loopSlots()[slot]);
    if (loop === null) return 0;

    const startFrame = resolvedFrame(loop.start);
    const span = loop.outFrame - startFrame;
    return clamp(((framesRendered - startFrame) / span) * 100, 0, 100);
  }

  /**
   * Advances the active loop against the position the tick loop just reached: drops out when a
   * nudge has crossed its ends, or re-enters/switches once the out-point is reached. Returns
   * whether a restore was just queued — the tick loop must not publish stats twice on that tick,
   * since the resync it queued goes out on the next one.
   */
  advanceLoop(framesRendered: number): boolean {
    const active = this.activeLoopSlot();
    if (active === null) return false;

    const loop = this.resolveLoopSlot(this.loopSlots()[active]);
    if (loop === null) {
      // Ends nudged until they crossed describe no pass — drop out rather than re-enter every tick.
      this.stopLoop();
      return false;
    }
    if (framesRendered < loop.outFrame) return false;

    const queued = this.queuedLoopSlot();
    if (queued === null) {
      // A restore, not a replay: the pass costs nothing per frame however deep the entry sits.
      this.restorePoint(loop.start);
    } else if (!this.engageLoop(queued)) {
      // The lap the punch waited for is over, but the queued slot's ends were nudged across
      // each other while it waited — nothing playable to switch to, so drop out.
      this.stopLoop();
    }
    return true;
  }

  /**
   * The row as `advanceLoop` needs it: the point to restore, and the frame that triggers the
   * restore. Null unless both ends are marked and, with their nudges applied, still in order — ends
   * that have crossed or met describe no pass at all, and a loop running on them would re-enter on
   * every tick rather than play anything.
   */
  private resolveLoopSlot(slot: LoopSlot): ResolvedLoop | null {
    if (slot.in === null || slot.out === null) return null;
    const outFrame = resolvedFrame(slot.out);
    return outFrame > resolvedFrame(slot.in) ? { start: slot.in, outFrame } : null;
  }

  /**
   * Re-enters a row and makes it the one playing, dropping whatever was queued behind it.
   * Re-checks playability at the point of engagement — a queued row's ends can be nudged across
   * each other while it waits, so the punch-time check alone isn't enough. Returns whether the
   * engage actually happened.
   */
  private engageLoop(index: number): boolean {
    if (index < 0 || index >= this.loopSlots().length) return false;
    const resolved = this.resolveLoopSlot(this.loopSlots()[index]);
    if (resolved === null) return false;
    this.restorePoint(resolved.start);
    this.activeLoopSlot.set(index);
    this.queuedLoopSlot.set(null);
    return true;
  }

  private updateLoopSlot(index: number, next: (current: LoopSlot) => LoopSlot): void {
    this.loopSlots.update((slots) => slots.map((s, i) => (i === index ? next(s) : s)));
  }
}

/** Where a point actually sits once its nudge is applied — never before the start of the tune. */
function resolvedFrame(point: { readonly frame: number; readonly offset: number }): number {
  return Math.max(0, point.frame + point.offset);
}
