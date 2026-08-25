import { RegisterFrame } from '../asid/register-frame';
import type { RegisterValuesSnapshot } from '../asid/register-frame';
import { C64Machine } from '../cpu/c64-machine';
import type { FrameResult, MachineSnapshot } from '../cpu/c64-machine';
import type { SidFile } from '../sid/sid-file.model';

/** Where a silent replay ended up: the machine and register state at `frame`. */
export interface ReplayResult {
  readonly machine: MachineSnapshot;
  readonly registers: RegisterValuesSnapshot;
  readonly frame: number;
}

/**
 * Rebuilds a tune from a clean `init` and runs it forward to `targetFrame` with every packet
 * discarded, returning the state it arrived in.
 *
 * Free of Angular and of the engine on purpose: it is the body of a jump, and it has to produce the
 * same answer whether it runs on a worker or on the thread that asked for it.
 *
 * Builds its own `C64Machine`/`RegisterFrame` pair rather than touching a live one — RAM from
 * wherever playback currently is would otherwise bleed into the replay and the answer would depend
 * on when the jump was asked for.
 *
 * @param mutes the effective mute per voice, seeded onto the replay frame so a muted voice's control
 *   register stays 0 through the whole replay exactly as it would live.
 * @throws when `init` or a replayed frame fails, or a frame exceeds its cycle budget. The message is
 *   the one the diagnostics readout shows verbatim.
 */
export function replayToFrame(
  file: SidFile,
  subtune: number,
  targetFrame: number,
  mutes: readonly boolean[]
): ReplayResult {
  const target = Math.max(0, Math.round(targetFrame));

  const frame = new RegisterFrame();
  mutes.forEach((muted, voice) => frame.setVoiceMuted(voice, muted));
  const machine = new C64Machine(file, frame);

  try {
    machine.initSubtune(subtune);
  } catch (error) {
    throw new Error(`jump to frame ${target} failed during init — ${describeError(error)}`);
  }

  for (let i = 0; i < target; i++) {
    let result: FrameResult;
    try {
      result = machine.runFrame();
    } catch (error) {
      throw new Error(`jump to frame ${target} failed during replay — ${describeError(error)}`);
    }
    if (!result.completed) {
      throw new Error(`jump to frame ${target} exceeded its cycle budget during replay`);
    }
    frame.takeSnapshot(); // discarded — resets per-frame duplicate-write tracking only;
                          // the accumulated register values persist across the call regardless
  }

  return { machine: machine.snapshot(), registers: frame.snapshotValues(), frame: target };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
