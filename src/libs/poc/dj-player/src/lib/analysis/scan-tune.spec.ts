import { describe, it, expect } from 'vitest';
import type { SidFile } from '../sid/sid-file.model';
import { RegisterFrame } from '../asid/register-frame';
import { C64Machine } from '../cpu/c64-machine';
import { ASID_SLOT_COUNT } from '../asid/asid-constants';
import { scanTune } from './scan-tune';

interface CodeBlock {
  readonly at: number;
  readonly bytes: readonly number[];
}

function tune(blocks: readonly CodeBlock[]): SidFile {
  const loadAddress = 0x1000;
  const codeEnd = blocks.reduce((end, block) => Math.max(end, block.at + block.bytes.length), loadAddress);
  const data = new Uint8Array(codeEnd - loadAddress);
  for (const block of blocks) {
    data.set(block.bytes, block.at - loadAddress);
  }
  return {
    format: 'PSID',
    version: 2,
    loadAddress,
    initAddress: loadAddress,
    playAddress: 0x1010,
    songs: 1,
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

/** init is a no-op; play increments a zero-page counter and stores it into $D400 (voice 1 freq lo)
 *  every frame — one write, always to the same register, so writeCounts is 1 for every frame and
 *  slot 0's value names how many play calls actually ran. */
const counterTune: SidFile = tune([
  { at: 0x1000, bytes: [RTS] },
  { at: 0x1010, bytes: [0xe6, 0xfb, 0xa5, 0xfb, 0x8d, 0x00, 0xd4, RTS] }, // INC $FB; LDA $FB; STA $D400; RTS
]);

/** Writes four distinct registers every frame — voice 1's freq lo and control, voice 2's freq lo and
 *  control — so the popcount over the dirty mask has a known, non-trivial answer. */
const fourWriteTune: SidFile = tune([
  { at: 0x1000, bytes: [RTS] },
  {
    at: 0x1010,
    bytes: [
      0xa9, 0x01, // LDA #$01
      0x8d, 0x00, 0xd4, // STA $D400 (voice 1 freq lo)
      0x8d, 0x04, 0xd4, // STA $D404 (voice 1 control)
      0x8d, 0x07, 0xd4, // STA $D407 (voice 2 freq lo)
      0x8d, 0x0b, 0xd4, // STA $D40B (voice 2 control)
      RTS,
    ],
  },
]);

/** The play routine never returns, so the frame burns its whole cycle budget. */
const runawayTune: SidFile = tune([
  { at: 0x1000, bytes: [RTS] },
  { at: 0x1010, bytes: [0x4c, 0x10, 0x10] }, // JMP $1010
]);

describe('scanTune', () => {
  it('returns one slot row and one write count per requested frame', () => {
    const frames = 10;
    const output = scanTune(counterTune, 1, frames);

    expect(output.frames).toBe(frames);
    expect(output.writeCounts.length).toBe(frames);
    expect(output.slotValues.length).toBe(frames * ASID_SLOT_COUNT);
  });

  it('accumulates register state across frames, so later rows differ from earlier ones', () => {
    const output = scanTune(counterTune, 1, 10);

    // Slot 0 is $D400, which counterTune's play routine increments and stores every frame.
    const early = output.slotValues[3 * ASID_SLOT_COUNT + 0];
    const late = output.slotValues[9 * ASID_SLOT_COUNT + 0];
    expect(late).toBeGreaterThan(early);
  });

  it('counts one write for a frame that touches a single register, regardless of value', () => {
    const output = scanTune(counterTune, 1, 5);

    expect(Array.from(output.writeCounts)).toEqual([1, 1, 1, 1, 1]);
  });

  it('pops the dirty mask correctly for a frame that touches several distinct registers', () => {
    const output = scanTune(fourWriteTune, 1, 3);

    expect(Array.from(output.writeCounts)).toEqual([4, 4, 4]);
  });

  it('fails with a cycle-budget message instead of hanging', () => {
    expect(() => scanTune(runawayTune, 1, 5)).toThrow('analysis scan exceeded its cycle budget at frame 0');
  });

  it('reports the calls-per-frame the machine actually used', () => {
    const output = scanTune(counterTune, 1, 5);

    const machine = new C64Machine(counterTune, new RegisterFrame());
    machine.initSubtune(1);
    expect(output.callsPerFrame).toBe(machine.callsPerFrame);
  });

  it('reports progress at a coarse interval rather than once per frame', () => {
    const frames = 600;
    const progressFrames: number[] = [];

    scanTune(counterTune, 1, frames, (frame) => progressFrames.push(frame));

    expect(progressFrames.length).toBeGreaterThan(0);
    expect(progressFrames.length).toBeLessThan(frames / 10);
  });
});
