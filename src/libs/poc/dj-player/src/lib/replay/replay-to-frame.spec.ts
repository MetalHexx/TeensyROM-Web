import { describe, it, expect } from 'vitest';
import { RegisterFrame } from '../asid/register-frame';
import { C64Machine } from '../cpu/c64-machine';
import type { SidFile } from '../sid/sid-file.model';
import { replayToFrame } from './replay-to-frame';

interface CodeBlock {
  readonly at: number;
  readonly bytes: readonly number[];
}

interface TuneOptions {
  playAddress?: number;
  songs?: number;
  blocks: readonly CodeBlock[];
}

/** Assembles hand-written blocks into a `SidFile` whose payload is the machine's memory image. */
function tune(options: TuneOptions): SidFile {
  const loadAddress = 0x1000;
  const codeEnd = options.blocks.reduce(
    (end, block) => Math.max(end, block.at + block.bytes.length),
    loadAddress
  );
  const data = new Uint8Array(codeEnd - loadAddress);
  for (const block of options.blocks) {
    data.set(block.bytes, block.at - loadAddress);
  }

  return {
    format: 'PSID',
    version: 2,
    loadAddress,
    initAddress: loadAddress,
    playAddress: options.playAddress ?? 0x1010,
    songs: options.songs ?? 1,
    startSong: 1,
    speedFlags: 0,
    name: '',
    author: '',
    released: '',
    clock: 'pal',
    model: 'unknown',
    secondSidAddress: null,
    thirdSidAddress: null,
    data,
  };
}

const RTS = 0x60;

/** init sets each voice's control register once, non-zero; play increments a zero-page counter and
 *  stores it into $D400 every frame, so the accumulated state names how many frames actually ran. */
function counterTune(): SidFile {
  return tune({
    blocks: [
      {
        at: 0x1000,
        bytes: [
          0xa9, 0x11, // LDA #$11
          0x8d, 0x04, 0xd4, // STA $D404 (voice 1 control)
          0x8d, 0x0b, 0xd4, // STA $D40B (voice 2 control)
          0x8d, 0x12, 0xd4, // STA $D412 (voice 3 control)
          RTS,
        ],
      },
      {
        at: 0x1010,
        bytes: [
          0xe6, 0xfb, // INC $FB
          0xa5, 0xfb, // LDA $FB
          0x8d, 0x00, 0xd4, // STA $D400
          RTS,
        ],
      },
    ],
  });
}

/** The play routine never returns, so the frame burns its whole cycle budget. */
function runawayTune(): SidFile {
  return tune({
    blocks: [
      { at: 0x1000, bytes: [RTS] },
      { at: 0x1010, bytes: [0x4c, 0x10, 0x10] }, // JMP $1010
    ],
  });
}

/** A header play address of 0 means the tune installs its own vector during init; this one's init
 *  returns without installing anything, so there is nothing to call each frame. */
function unplayableTune(): SidFile {
  return tune({ playAddress: 0, blocks: [{ at: 0x1000, bytes: [RTS] }] });
}

/**
 * The live path this replaces: a machine and frame built together, initialised, then run forward
 * frame by frame with each snapshot discarded. What `replayToFrame` has to reproduce exactly.
 */
function runLive(file: SidFile, subtune: number, frames: number) {
  const frame = new RegisterFrame();
  const machine = new C64Machine(file, frame);
  machine.initSubtune(subtune);
  for (let i = 0; i < frames; i++) {
    machine.runFrame();
    frame.takeSnapshot();
  }
  return { machine: machine.snapshot(), registers: frame.snapshotValues() };
}

/** Where $D404/$D40B/$D412 land in a values snapshot — see `ASID_SLOT_TO_REGISTER`, whose slots
 *  22/23/24 carry the three voice control registers. Slot 0 is $D400. */
const VOICE_CONTROL_SLOTS = [22, 23, 24];

describe('replayToFrame', () => {
  it('lands on the same machine and register state the live path reaches at that frame', () => {
    const file = counterTune();

    const replayed = replayToFrame(file, 1, 40, [false, false, false]);
    const live = runLive(file, 1, 40);

    expect(replayed.frame).toBe(40);
    expect(replayed.registers.values).toEqual(live.registers.values);
    expect(replayed.machine.memory).toEqual(live.machine.memory);
    expect(replayed.machine.cpu).toEqual(live.machine.cpu);
    expect(replayed.machine.playAddress).toBe(live.machine.playAddress);
    expect(replayed.machine.timerALatch).toBe(live.machine.timerALatch);
  });

  it('is deterministic: the same request twice gives the same answer', () => {
    const file = counterTune();

    const first = replayToFrame(file, 1, 25, [false, false, false]);
    const second = replayToFrame(file, 1, 25, [false, false, false]);

    expect(second.registers.values).toEqual(first.registers.values);
    expect(second.machine.memory).toEqual(first.machine.memory);
  });

  it('actually runs the frames rather than stopping at init', () => {
    const file = counterTune();

    const shallow = replayToFrame(file, 1, 3, [false, false, false]);
    const deep = replayToFrame(file, 1, 30, [false, false, false]);

    // $D400 carries the play-call count, so the two must differ — a replay that never ran a frame
    // would leave both at init's state and pass every equality check above by coincidence.
    expect(deep.registers.values[0]).not.toBe(shallow.registers.values[0]);
  });

  it('runs no frames at all for a target of 0', () => {
    const result = replayToFrame(counterTune(), 1, 0, [false, false, false]);
    const live = runLive(counterTune(), 1, 0);

    expect(result.frame).toBe(0);
    expect(result.registers.values).toEqual(live.registers.values);
  });

  it('clamps a negative or fractional target to a whole frame at or after the start', () => {
    expect(replayToFrame(counterTune(), 1, -12, [false, false, false]).frame).toBe(0);
    expect(replayToFrame(counterTune(), 1, 7.4, [false, false, false]).frame).toBe(7);
  });

  it('holds a muted voice at 0 throughout, leaving the others live', () => {
    const result = replayToFrame(counterTune(), 1, 20, [false, true, false]);

    const [voice0, voice1, voice2] = VOICE_CONTROL_SLOTS.map(
      (slot) => result.registers.values[slot]
    );
    expect(voice1).toBe(0);
    expect(voice0).toBeGreaterThan(0);
    expect(voice2).toBeGreaterThan(0);
  });

  it('reports an init that cannot produce a playable machine', () => {
    expect(() => replayToFrame(unplayableTune(), 1, 10, [false, false, false])).toThrow(
      /^jump to frame 10 failed during init — /
    );
  });

  it('reports a replayed frame that never returns, rather than the frame count it managed', () => {
    expect(() => replayToFrame(runawayTune(), 1, 5, [false, false, false])).toThrow(
      'jump to frame 5 exceeded its cycle budget during replay'
    );
  });

  it('reports a subtune the tune does not have', () => {
    expect(() => replayToFrame(counterTune(), 4, 10, [false, false, false])).toThrow(
      /^jump to frame 10 failed during init — /
    );
  });
});
