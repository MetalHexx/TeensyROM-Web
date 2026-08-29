import { computed, signal, Signal, WritableSignal } from '@angular/core';
import { logWarn } from '@teensyrom-nx/utils';
import { C64Machine, MachineSnapshot } from '../cpu/c64-machine';
import { RegisterFrame } from '../asid/register-frame';
import type { RegisterValuesSnapshot } from '../asid/register-frame';
import type { SidFile } from '../sid/sid-file.model';
import type { ReplayRequest, ReplayResponse, ReplayRunner } from '../replay/replay-runner';
import { clamp, describeError, MICROSECONDS_PER_SECOND, sanitizePositiveFrame } from './engine-utils';

/** The assumed length the scrub and playhead percentages are measured against — not the tune's real,
 * unmeasured length. A single tunable constant, not derived from anything about the file. */
export const JUMP_CEILING_SECONDS = 300;

/**
 * What `TuneSession` needs from the coordinator: the tune's configured rate, the mutes to seed a
 * jump's replay with, and the handful of coordinator-owned effects a load/subtune/jump can trigger
 * (clearing the error state, queueing a resync, re-resolving the clock interval, recording an
 * anchor). Taking these as callbacks is what lets this module own the machine/frame/position triple
 * without importing the coordinator that also reads them.
 */
export interface TuneSessionHost {
  nominalIntervalUs(): number;
  effectiveMutes(): readonly boolean[];
  /** Clears the engine's error state — the tell that a subtune init succeeded. */
  clearError(): void;
  /** Marks the engine's failure state and logs why. */
  fail(reason: string): void;
  /** Queues the chip resync a restore owes the stream. */
  queueResync(): void;
  /** Drops the marker state's anchor ring — its entries describe a machine a subtune re-init has
   *  just invalidated. */
  resetAnchors(): void;
  /** Seeds the marker state's anchor ring with the freshly re-initialised machine. */
  recordAnchor(machine: C64Machine, frame: RegisterFrame, framesRendered: number): void;
  /** Re-resolves the clock's tick rate — a subtune can carry its own multispeed. */
  applyIntervalChange(): void;
}

/**
 * Owns the loaded tune, the live `C64Machine`/`RegisterFrame` pair it plays through, the position
 * counter, and the off-thread replay a scrub or a cue hands to the worker.
 *
 * Rebuilds the machine and frame on every `load()`, exactly as the engine did before the split —
 * this class is the one place that constructs them.
 */
export class TuneSession {
  constructor(
    private readonly replayRunner: ReplayRunner,
    private readonly host: TuneSessionHost
  ) {}

  readonly currentSubtune: WritableSignal<number> = signal(1);
  readonly subtuneCount: WritableSignal<number> = signal(1);

  /** Frames in the fixed jump ceiling at the current nominal interval. Ignores multispeed
   *  deliberately: for a callsPerFrame > 1 tune the ceiling represents a shorter real-world duration
   *  than JUMP_CEILING_SECONDS, since more play-calls land in the same frame count. Acceptable
   *  simplification for this iteration — most of the tune list is callsPerFrame 1. */
  readonly ceilingFrames: Signal<number> = computed<number>(() =>
    Math.round((JUMP_CEILING_SECONDS * MICROSECONDS_PER_SECOND) / this.host.nominalIntervalUs())
  );

  /** The indexed length, when one was found and is usable; null falls back to the fixed ceiling. */
  private readonly _indexedLengthFrames = signal<number | null>(null);

  /** What a position percentage is measured against, in both directions. A `computed` over a signal
   *  rather than a value snapshotted at load time, so a record landing mid-play moves the playhead's
   *  meaning on the next stats publish with no further wiring. */
  readonly positionBasisFrames: Signal<number> = computed(
    () => this._indexedLengthFrames() ?? this.ceilingFrames()
  );

  private _file: SidFile | null = null;
  private _machine: C64Machine | null = null;
  private _frame: RegisterFrame | null = null;
  private _framesRendered = 0;
  /** Stamped onto every jump request, so responses can be told apart by age. */
  private jumpRequestId = 0;
  /**
   * The id of the only jump whose result may still be applied, or null when none may.
   *
   * A replay runs off-thread while playback carries on, so a result can arrive after the operator
   * has already asked for another position — or after a stop, a tune load or a subtune change made
   * the answer describe a machine this session no longer has. Anything that does not match is
   * dropped without a trace of it reaching the stream.
   */
  private outstandingJumpId: number | null = null;

  get file(): SidFile | null {
    return this._file;
  }

  get machine(): C64Machine | null {
    return this._machine;
  }

  get frame(): RegisterFrame | null {
    return this._frame;
  }

  get framesRendered(): number {
    return this._framesRendered;
  }

  set framesRendered(value: number) {
    this._framesRendered = value;
  }

  /** Rebuilds the machine and register frame for `file`. Does not initialise a subtune — the
   *  coordinator calls `initSubtune()` once it has decided what else a fresh load resets. */
  load(file: SidFile): void {
    this._file = file;
    this._frame = new RegisterFrame();
    this._machine = new C64Machine(file, this._frame);
    this.subtuneCount.set(Math.max(1, file.songs));
  }

  /** Zeroes the position counter — what a fresh play run or a fresh load starts from. */
  resetPosition(): void {
    this._framesRendered = 0;
  }

  /** Stores the tune-index's measured length as the position basis. Anything that is not a finite
   *  number greater than zero is stored as null instead — a zero or negative basis would divide the
   *  playhead by nothing — which makes `positionBasisFrames` fall back to `ceilingFrames`. */
  setIndexedLengthFrames(frames: number | null): void {
    this._indexedLengthFrames.set(sanitizePositiveFrame(frames));
  }

  /** Re-inits the machine and marks every register dirty, so the chip cannot inherit the old state. */
  initSubtune(song: number): boolean {
    const machine = this._machine;
    const frame = this._frame;
    if (machine === null || frame === null) {
      return false;
    }

    const clamped = clamp(song, 1, this.subtuneCount());
    try {
      const result = machine.initSubtune(clamped);
      if (!result.completed) {
        logWarn(
          `DJ engine: subtune ${clamped} init ran out of cycles (${result.cyclesUsed}) — playing it anyway.`
        );
      }
    } catch (error) {
      this.host.fail(`subtune ${clamped} could not be initialised — ${describeError(error)}`);
      return false;
    }

    frame.markAllDirty();
    this._framesRendered = 0;
    // The ring is dropped rather than carried: its entries describe a machine that no longer exists,
    // at frame numbers the reset counter has just invalidated. Cues and the loop's entry survive
    // this deliberately — each owns its own anchor, so none of them needs the ring to persist.
    this.host.resetAnchors();
    this.host.recordAnchor(machine, frame, this._framesRendered);
    this.currentSubtune.set(clamped);
    this.host.clearError();
    return true;
  }

  private selectSubtune(song: number): void {
    if (this._machine === null) {
      return;
    }
    const clamped = clamp(song, 1, this.subtuneCount());
    if (clamped === this.currentSubtune()) {
      return;
    }
    // A jump in flight was replaying the outgoing subtune, so its answer is about to be wrong.
    this.discardOutstandingJump();
    if (!this.initSubtune(clamped)) {
      return;
    }
    // The tick rate itself also has to be re-resolved.
    this.host.applyIntervalChange();
  }

  nextSubtune(): void {
    this.selectSubtune(this.currentSubtune() + 1);
  }

  previousSubtune(): void {
    this.selectSubtune(this.currentSubtune() - 1);
  }

  /**
   * Asks for `percent` of `positionBasisFrames()`. The position does not move as soon as this
   * returns — the replay runs off this thread and lands a moment later, and a second scrub issued in
   * the meantime supersedes this one. The returned promise resolves once this request has settled —
   * landed, failed, or been superseded/discarded.
   */
  scrubTo(percent: number): Promise<void> {
    if (this._machine === null) return Promise.resolve();
    return this.jumpToFrame(this.frameForPercent(percent));
  }

  private frameForPercent(percent: number): number {
    const clamped = clamp(percent, 0, 100);
    return Math.round((clamped / 100) * this.positionBasisFrames());
  }

  /**
   * The shared silent-replay primitive: hands the rebuild to the replay runner and returns at once,
   * so the frame clock keeps ticking and a packet still goes out on every tick while the replay
   * runs. The landing happens later, in `awaitJump`.
   *
   * Only the newest request may land. The id stamped here is recorded as the outstanding one, and a
   * response carrying any other id is dropped — a second scrub supersedes the first rather than
   * queueing behind it.
   */
  private jumpToFrame(targetFrame: number): Promise<void> {
    const file = this._file;
    if (file === null || this._machine === null || this._frame === null) return Promise.resolve();

    const request: ReplayRequest = {
      id: ++this.jumpRequestId,
      file,
      subtune: this.currentSubtune(),
      targetFrame,
      // The mutes as they stand now; `awaitJump` re-asserts whatever they have become by the time
      // the result lands.
      mutes: this.host.effectiveMutes(),
    };
    this.outstandingJumpId = request.id;
    return this.awaitJump(request);
  }

  /** Waits out one replay request and applies its result if it is still the one being waited on. */
  private async awaitJump(request: ReplayRequest): Promise<void> {
    let response: ReplayResponse;
    try {
      response = await this.replayRunner.run(request);
    } catch (error) {
      response = {
        id: request.id,
        ok: false,
        error: `jump to frame ${request.targetFrame} failed during replay — ${describeError(error)}`,
      };
    }

    if (response.id !== this.outstandingJumpId) {
      return; // superseded, or discarded by a stop, a tune load or a subtune change
    }
    this.outstandingJumpId = null;

    if (!response.ok) {
      this.host.fail(response.error);
      return;
    }

    // The operator can move a mute while the replay is in flight, so what the request carried may
    // already be stale. This has to land before `restoreState` takes the resync snapshot:
    // `restoreValues` re-zeroes exactly the voices the live frame knows about at that moment.
    const mutes = this.host.effectiveMutes();
    for (let voice = 0; voice < 3; voice++) {
      this._frame?.setVoiceMuted(voice, mutes[voice]);
    }
    this.restoreState(response.result.machine, response.result.registers, response.result.frame);
  }

  /**
   * Puts an image back onto the live pair: restore, adopt its frame number, resync. Shared by a cue
   * or loop re-entry (via `MarkerHost.restoreState`) and by a landing jump.
   *
   * No emulation, so the main thread never stalls and the frame clock keeps ticking straight
   * through. That stall is what made a deep cue hop — and a loop with a deep entry — hold its last
   * note: with the thread blocked, no packets went out and the SID simply kept sounding whatever it
   * was last told.
   */
  restoreState(machine: MachineSnapshot, registers: RegisterValuesSnapshot, frameNumber: number): void {
    if (this._machine === null || this._frame === null) return;

    this._machine.restore(machine);
    this._frame.restoreValues(registers);
    this._framesRendered = frameNumber;
    this.host.queueResync();
  }

  /** Drops whatever jump is in flight, so its result is discarded rather than applied. */
  discardOutstandingJump(): void {
    this.outstandingJumpId = null;
  }

  /** Releases the replay thread — nothing else holds the runner, and it outlives this session
   *  otherwise. */
  dispose(): void {
    this.replayRunner.dispose();
  }
}
