import { RegisterFrame } from '../asid/register-frame';
import { C64Machine } from '../cpu/c64-machine';
import type { FrameResult } from '../cpu/c64-machine';
import { ASID_SLOT_COUNT } from '../asid/asid-constants';
import type { SidFile } from '../sid/sid-file.model';

/** A postMessage per scanned frame would cost more than the emulation itself. */
const PROGRESS_INTERVAL_FRAMES = 256;

export interface ScanOutput {
  /** Accumulated slot values per frame, flat: frame f occupies [f*28, f*28+28). */
  readonly slotValues: Uint8Array;
  /** Registers written during each frame — the density signal. One entry per frame. */
  readonly writeCounts: Uint8Array;
  readonly frames: number;
  /** Play-routine calls per video frame, read off the machine. 1 for most tunes, 2+ for multispeed. */
  readonly callsPerFrame: number;
}

/**
 * Replays a tune from a clean `init` for exactly `maxFrames` play-routine calls, recording every
 * frame's slot values and write density rather than discarding them.
 *
 * Free of Angular and of the engine for the same reason `replayToFrame` is — it must produce the same
 * answer whether it runs on a worker or on the calling thread.
 *
 * There is deliberately no tune-end detection: the scan always runs exactly `maxFrames` frames, and
 * distinguishing "ceiling reached" from "tune ended" belongs to the self-similarity reader that
 * consumes this output, not to this loop.
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
  const frame = new RegisterFrame();
  // Voices are never muted during a scan — a muted voice's control register would be forced to 0 and
  // its writes dropped, erasing it from the analysis.
  const machine = new C64Machine(file, frame);
  machine.initSubtune(subtune);

  const slotValues = new Uint8Array(maxFrames * ASID_SLOT_COUNT);
  const writeCounts = new Uint8Array(maxFrames);

  for (let i = 0; i < maxFrames; i++) {
    const result: FrameResult = machine.runFrame();
    if (!result.completed) {
      throw new Error(`analysis scan exceeded its cycle budget at frame ${i}`);
    }

    // Must run every frame regardless of whether the presentMask is consumed below: this call is
    // also what resets per-frame duplicate-write tracking.
    const snapshot = frame.takeSnapshot();
    writeCounts[i] = popcountMask(snapshot.presentMask);

    slotValues.set(frame.snapshotValues().values, i * ASID_SLOT_COUNT);

    if (onProgress !== undefined && i % PROGRESS_INTERVAL_FRAMES === 0) {
      onProgress(i);
    }
  }

  return { slotValues, writeCounts, frames: maxFrames, callsPerFrame: machine.callsPerFrame };
}

function popcountMask(mask: readonly number[]): number {
  let count = 0;
  for (const byte of mask) {
    count += popcount8(byte);
  }
  return count;
}

function popcount8(value: number): number {
  let count = 0;
  let remaining = value;
  while (remaining !== 0) {
    count += remaining & 1;
    remaining >>= 1;
  }
  return count;
}
