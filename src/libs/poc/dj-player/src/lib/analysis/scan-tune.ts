import { C64Machine, RegisterFrame, SID_REGISTER_COUNT } from '@sidablist/core';
import type { FrameResult, SidFile } from '@sidablist/core';

/** A postMessage per scanned frame would cost more than the emulation itself. */
const PROGRESS_INTERVAL_FRAMES = 256;

export interface ScanOutput {
  /** Accumulated register values per frame, flat and indexed by SID register number: frame f's
   *  register r is at `f * SID_REGISTER_COUNT + r`. */
  readonly registerValues: Uint8Array;
  /** Registers written during each frame — the density signal. One entry per frame. */
  readonly writeCounts: Uint8Array;
  readonly frames: number;
  /** Play-routine calls per video frame, read off the machine. 1 for most tunes, 2+ for multispeed. */
  readonly callsPerFrame: number;
}

/**
 * A replay of one tune that can be deepened, recording every frame's register values and write
 * density rather than discarding them.
 *
 * Owns its own `C64Machine`/`RegisterFrame` pair from a clean `init` and keeps them live between
 * calls, so a later, deeper request only pays for the frames it has not already emulated. Continuing
 * on the same objects — rather than restoring a serialised snapshot — is what makes a deepened scan
 * bit-identical to one that never stopped.
 *
 * Free of Angular and of the engine for the same reason `replayToFrame` is — it must produce the same
 * answer whether it runs on a worker or on the calling thread.
 *
 * There is deliberately no tune-end detection: `advanceTo` runs exactly the frames it is asked for,
 * and distinguishing "ceiling reached" from "tune ended" belongs to `detectLoop`, which reads this
 * output, not to this loop.
 */
export class TuneScan {
  private readonly frame = new RegisterFrame();
  private readonly machine: C64Machine;
  private registerValues = new Uint8Array(0);
  private writeCounts = new Uint8Array(0);
  private recorded = 0;

  constructor(file: SidFile, subtune: number) {
    // Voices are never muted during a scan — a muted voice's control register would be forced to 0
    // and its writes dropped, erasing it from the analysis.
    this.machine = new C64Machine(file, this.frame);
    this.machine.initSubtune(subtune);
  }

  /** How many frames have been emulated and recorded so far. */
  get frames(): number {
    return this.recorded;
  }

  /**
   * Emulates forward until `frames` reaches `toFrames`; a no-op when already at or past it.
   *
   * @param onProgress called at a coarse interval, not per frame, against the absolute frame index.
   * @throws when a frame exceeds its cycle budget. The message names the frame it failed at, and the
   *  scan must not be deepened afterwards — it is left holding a machine that never finished a frame.
   */
  advanceTo(toFrames: number, onProgress?: (frame: number) => void): void {
    if (toFrames <= this.recorded) {
      return;
    }
    this.reserve(toFrames);

    for (let i = this.recorded; i < toFrames; i++) {
      const result: FrameResult = this.machine.runFrame();
      if (!result.completed) {
        throw new Error(`analysis scan exceeded its cycle budget at frame ${i}`);
      }

      // Must run every frame: it is also what resets the per-frame duplicate-write tracking the next
      // frame's count depends on.
      this.writeCounts[i] = this.frame.takeSnapshot().count;

      this.registerValues.set(this.frame.snapshotValues().values, i * SID_REGISTER_COUNT);
      this.recorded = i + 1;

      if (onProgress !== undefined && i % PROGRESS_INTERVAL_FRAMES === 0) {
        onProgress(i);
      }
    }
  }

  /**
   * The frames recorded so far, in the shape the detectors read.
   *
   * Both arrays are copies sized exactly to `frames`, never views over the working buffers: a caller
   * posting this across a thread boundary would otherwise ship the spare capacity too, and would see
   * its output rewritten by the next `advanceTo`.
   */
  output(): ScanOutput {
    return {
      registerValues: this.registerValues.slice(0, this.recorded * SID_REGISTER_COUNT),
      writeCounts: this.writeCounts.slice(0, this.recorded),
      frames: this.recorded,
      callsPerFrame: this.machine.callsPerFrame,
    };
  }

  /** Regrows both buffers to `frames`, carrying the recorded prefix over. O(recorded bytes) against
   *  the O(frames × cycles) of the emulation it saves. */
  private reserve(frames: number): void {
    if (frames <= this.writeCounts.length) {
      return;
    }
    const registerValues = new Uint8Array(frames * SID_REGISTER_COUNT);
    registerValues.set(this.registerValues.subarray(0, this.recorded * SID_REGISTER_COUNT));
    const writeCounts = new Uint8Array(frames);
    writeCounts.set(this.writeCounts.subarray(0, this.recorded));
    this.registerValues = registerValues;
    this.writeCounts = writeCounts;
  }
}

/**
 * Replays a tune from a clean `init` for exactly `maxFrames` play-routine calls, recording every
 * frame's register values and write density rather than discarding them.
 *
 * A thin wrapper over `TuneScan`, so the one-shot and the deepenable path share one emulation loop
 * rather than two that could drift apart.
 *
 * @param onProgress called at a coarse interval, not per frame.
 * @throws when a frame exceeds its cycle budget. The message names the frame it failed at.
 */
export function scanTune(
  file: SidFile,
  subtune: number,
  maxFrames: number,
  onProgress?: (frame: number) => void
): ScanOutput {
  const scan = new TuneScan(file, subtune);
  scan.advanceTo(maxFrames, onProgress);
  return scan.output();
}
