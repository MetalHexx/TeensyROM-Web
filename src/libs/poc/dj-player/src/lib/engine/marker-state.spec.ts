import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SidFile } from '../sid/sid-file.model';
import type { RegisterValuesSnapshot } from '../asid/register-frame';
import { RegisterFrame } from '../asid/register-frame';
import { C64Machine } from '../cpu/c64-machine';
import type { MachineSnapshot } from '../cpu/c64-machine';
import { LOOP_AUDITION_PREROLL_MS, MarkerState, NUDGE_RANGE_MS } from './marker-state';
import type { MarkerHost } from './marker-state';

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

/** init increments a zero-page counter and stores it into $D400 every play call, so a restored
 *  position can be told apart from every other one by the value it carries. */
const counterTune: SidFile = tune([
  { at: 0x1000, bytes: [RTS] },
  { at: 0x1010, bytes: [0xe6, 0xfb, 0xa5, 0xfb, 0x8d, 0x00, 0xd4, RTS] }, // INC $FB; LDA $FB; STA $D400; RTS
]);

/** Drives a real `C64Machine`/`RegisterFrame` pair the way the coordinator's tick loop would, and
 *  implements `MarkerHost` against them — enough to exercise capture/restore/nudge without standing
 *  up the whole engine. */
class Harness implements MarkerHost {
  private readonly registerFrame = new RegisterFrame();
  private readonly cpuMachine = new C64Machine(counterTune, this.registerFrame);
  private position = 0;
  readonly restores: { machine: MachineSnapshot; registers: RegisterValuesSnapshot; frame: number }[] = [];
  resyncCount = 0;
  readonly failures: string[] = [];
  mutes: readonly boolean[] = [false, false, false];

  constructor() {
    this.cpuMachine.initSubtune(1);
  }

  machine(): C64Machine {
    return this.cpuMachine;
  }

  frame(): RegisterFrame {
    return this.registerFrame;
  }

  file(): SidFile {
    return counterTune;
  }

  framesRendered(): number {
    return this.position;
  }

  setFramesRendered(value: number): void {
    this.position = value;
  }

  nominalIntervalUs(): number {
    return 20_000;
  }

  restoreState(machine: MachineSnapshot, registers: RegisterValuesSnapshot, frame: number): void {
    // Mirrors `TuneSession.restoreState`, which this stands in for: adopt the frame number and
    // queue the resync the restore owes the stream, in the same call.
    this.restores.push({ machine, registers, frame });
    this.position = frame;
    this.resyncCount++;
  }

  queueResync(): void {
    this.resyncCount++;
  }

  effectiveMutes(): readonly boolean[] {
    return this.mutes;
  }

  fail(reason: string): void {
    this.failures.push(reason);
  }

  /** Runs one frame forward on the live machine — what the coordinator's tick loop does before
   *  handing the result to the transport. */
  tick(): void {
    this.cpuMachine.runFrame();
    this.registerFrame.takeSnapshot();
    this.position++;
  }

  tickBy(count: number): void {
    for (let i = 0; i < count; i++) this.tick();
  }
}

describe('MarkerState', () => {
  let harness: Harness;
  let markerState: MarkerState;

  beforeEach(() => {
    harness = new Harness();
    markerState = new MarkerState(harness);
    // Mirrors what `TuneSession.initSubtune` does on every real load: seed the ring with a frame-0
    // anchor, so a capture always has something to pair with even before the ring has filled.
    markerState.recordAnchor(harness.machine(), harness.frame(), harness.framesRendered());
  });

  describe('cue capture and restore', () => {
    it('captures the machine/frame state at the current position, and hopping to it hands that exact snapshot back for a restore', () => {
      harness.tickBy(5);
      const snapshotAtCapture = harness.machine().snapshot();
      const registersAtCapture = harness.frame().snapshotValues();

      const index = markerState.addCue();

      expect(markerState.cues()).toHaveLength(1);
      expect(markerState.cues()[0]?.frame).toBe(5);

      harness.tickBy(10); // play on past the capture

      markerState.hopToCue(index);

      expect(harness.restores).toHaveLength(1);
      expect(harness.restores[0].frame).toBe(5);
      expect(harness.restores[0].machine).toEqual(snapshotAtCapture);
      expect(harness.restores[0].registers).toEqual(registersAtCapture);
      expect(harness.resyncCount).toBe(1);
    });

    it('appends an empty row with no tune loaded, rather than throwing', () => {
      const noTuneHarness: MarkerHost = {
        machine: () => null,
        frame: () => null,
        file: () => null,
        framesRendered: () => 0,
        setFramesRendered: () => undefined,
        nominalIntervalUs: () => 20_000,
        restoreState: () => undefined,
        queueResync: () => undefined,
        effectiveMutes: () => [false, false, false],
        fail: () => undefined,
      };
      const marker = new MarkerState(noTuneHarness);

      const index = marker.addCue();

      expect(marker.cues()).toEqual([null]);
      expect(index).toBe(0);
    });

    it('is a no-op to hop to an empty or out-of-range cue', () => {
      markerState.addCue();
      markerState.clearCue(0);

      markerState.hopToCue(0);
      markerState.hopToCue(5);

      expect(harness.restores).toHaveLength(0);
    });

    it('refills a cleared row by capturing into it again, landing at the new position', () => {
      harness.tickBy(5);
      markerState.addCue();
      markerState.clearCue(0);

      harness.tickBy(5);
      markerState.captureCue(0);

      expect(markerState.cues()[0]?.frame).toBe(10);
    });

    it('deletes a row outright, shifting later indices down', () => {
      markerState.addCue();
      markerState.addCue();

      markerState.deleteCue(0);

      expect(markerState.cues()).toHaveLength(1);
    });
  });

  describe('the cue nudge', () => {
    it('walks a cue backward onto an earlier frame', () => {
      harness.tickBy(60);
      const index = markerState.addCue();

      markerState.setCueOffset(index, -10);

      markerState.hopToCue(index);
      expect(harness.restores.at(-1)?.frame).toBe(50);
    });

    it('hops to a nudged cue without emulating a frame, however deep it was captured', () => {
      harness.tickBy(200);
      const index = markerState.addCue();
      markerState.setCueOffset(index, -20); // the replay this runs happens before the spy below attaches
      const runFrame = vi.spyOn(C64Machine.prototype, 'runFrame');

      markerState.hopToCue(index);

      // The stall this design exists to avoid: a hop that re-derived the nudged point would run
      // frames on the live machine, blocking whatever else rides the same thread.
      expect(runFrame).not.toHaveBeenCalled();
      expect(harness.restores.at(-1)?.frame).toBe(180);
    });

    it('walks a cue forward onto a later frame', () => {
      harness.tickBy(60);
      const index = markerState.addCue();

      markerState.setCueOffset(index, 10);

      markerState.hopToCue(index);
      expect(harness.restores.at(-1)?.frame).toBe(70);
    });

    it('clamps the offset to the nudge range in both directions', () => {
      harness.tickBy(60);
      const index = markerState.addCue();
      const range = markerState.nudgeRangeFrames();

      markerState.setCueOffset(index, 999);
      expect(markerState.cues()[index]?.offset).toBe(range);

      markerState.setCueOffset(index, -999);
      expect(markerState.cues()[index]?.offset).toBe(-range);
    });

    it('falls back to the frame-0 anchor for a cue captured before the ring has filled', () => {
      harness.tickBy(5);
      const index = markerState.addCue();

      markerState.setCueOffset(index, -5);

      markerState.hopToCue(index);
      expect(harness.restores.at(-1)?.frame).toBe(0);
    });

    it('derives ~1 s of frames from the tune rate', () => {
      expect(markerState.nudgeRangeFrames()).toBe(
        Math.round((NUDGE_RANGE_MS * 1000) / harness.nominalIntervalUs())
      );
    });
  });

  describe('anchor ring', () => {
    it('replays a deep nudge from a recent anchor rather than the frame-0 seed', () => {
      // Seed the ring the way the coordinator's tick loop would: one anchor check per frame,
      // interleaved with the tick that advances the position it is recorded against.
      for (let f = 0; f < 400; f++) {
        harness.tick();
        markerState.maybeRecordAnchor(harness.machine(), harness.frame(), harness.framesRendered());
      }
      const index = markerState.addCue();
      const runFrame = vi.spyOn(C64Machine.prototype, 'runFrame');

      markerState.setCueOffset(index, -markerState.nudgeRangeFrames());

      // A replay from the frame-0 seed would run ~400 frames; one from a recent anchor is bounded by
      // the anchor spacing plus the nudge range, well under that.
      expect(runFrame.mock.calls.length).toBeLessThan(200);
    });

    it('drops the ring on resetAnchorRing, leaving a capture with nothing to anchor to until reseeded', () => {
      harness.tick();
      markerState.maybeRecordAnchor(harness.machine(), harness.frame(), harness.framesRendered());

      markerState.resetAnchorRing();
      const strandedIndex = markerState.addCue();
      expect(markerState.cues()[strandedIndex]).toBeNull(); // nothing left in the ring to pair it with

      markerState.recordAnchor(harness.machine(), harness.frame(), harness.framesRendered());
      const reseededIndex = markerState.addCue();
      expect(markerState.cues()[reseededIndex]).not.toBeNull();
    });
  });

  describe('loops', () => {
    it('creates a slot from whichever end is tapped first, and becomes playable once both are marked in order', () => {
      markerState.addLoop();

      markerState.tapLoopOut(0);
      expect(markerState.loopSlots()[0].out?.frame).toBe(0);
      expect(markerState.loopSlots()[0].in).toBeNull();
      expect(markerState.isLoopPlayable(0)).toBe(false); // only one end marked

      harness.tickBy(10);
      markerState.tapLoopIn(0); // the wrong order for a playable pass — in now sits after out
      expect(markerState.isLoopPlayable(0)).toBe(false);

      harness.tickBy(10);
      markerState.tapLoopOut(0); // re-tapping out ahead of in makes the pass playable
      expect(markerState.isLoopPlayable(0)).toBe(true);
    });

    it('engages a playable slot at once when nothing is looping', () => {
      markerState.addLoop();
      markerState.tapLoopIn(0);
      harness.tickBy(10);
      markerState.tapLoopOut(0);

      markerState.punchLoop(0);

      expect(markerState.activeLoopSlot()).toBe(0);
      expect(harness.restores.at(-1)?.frame).toBe(0);
    });

    it('queues a punch behind the active slot rather than switching immediately', () => {
      markerState.addLoop();
      markerState.tapLoopIn(0);
      harness.tickBy(10);
      markerState.tapLoopOut(0);
      markerState.addLoop();
      harness.tickBy(10);
      markerState.tapLoopIn(1);
      harness.tickBy(10);
      markerState.tapLoopOut(1);

      markerState.punchLoop(0);
      markerState.punchLoop(1);

      expect(markerState.activeLoopSlot()).toBe(0);
      expect(markerState.queuedLoopSlot()).toBe(1);
    });

    it('advanceLoop re-enters the in-point once the tick reaches the out-point, and reports it happened', () => {
      markerState.addLoop();
      markerState.tapLoopIn(0);
      harness.tickBy(10);
      markerState.tapLoopOut(0); // in 0, out 10
      markerState.punchLoop(0);
      harness.setFramesRendered(0);

      const wrapped = markerState.advanceLoop(10);

      expect(wrapped).toBe(true);
      expect(harness.restores.at(-1)?.frame).toBe(0);
    });

    it('advanceLoop is a no-op before the out-point is reached', () => {
      markerState.addLoop();
      markerState.tapLoopIn(0);
      harness.tickBy(10);
      markerState.tapLoopOut(0);
      markerState.punchLoop(0);
      const restoresBefore = harness.restores.length;

      const wrapped = markerState.advanceLoop(5);

      expect(wrapped).toBe(false);
      expect(harness.restores).toHaveLength(restoresBefore);
    });

    it('advanceLoop drops out, without restoring, once a nudge crosses the ends', () => {
      markerState.addLoop();
      markerState.tapLoopIn(0);
      harness.tickBy(10);
      markerState.tapLoopOut(0);
      markerState.punchLoop(0);
      markerState.setLoopOutOffset(0, -markerState.nudgeRangeFrames());
      const restoresBefore = harness.restores.length;

      const wrapped = markerState.advanceLoop(10);

      expect(wrapped).toBe(false);
      expect(markerState.activeLoopSlot()).toBeNull();
      expect(harness.restores).toHaveLength(restoresBefore);
    });

    it('deleteLoop shifts a later active index down, and clears it outright when it names the deleted row', () => {
      markerState.addLoop();
      markerState.addLoop();
      markerState.activeLoopSlot.set(1);

      markerState.deleteLoop(0);
      expect(markerState.activeLoopSlot()).toBe(0);

      markerState.deleteLoop(0);
      expect(markerState.activeLoopSlot()).toBeNull();
    });

    it('clear empties both collections and lets go of whatever was looping', () => {
      markerState.addLoop();
      markerState.tapLoopIn(0);
      harness.tickBy(10);
      markerState.tapLoopOut(0);
      markerState.punchLoop(0);
      markerState.addCue();

      markerState.clear();

      expect(markerState.cues()).toEqual([]);
      expect(markerState.loopSlots()).toEqual([]);
      expect(markerState.activeLoopSlot()).toBeNull();
    });
  });

  describe('the loop audition', () => {
    it('resumes pre-roll frames before the out-point and queues a resync, without touching activeLoopSlot via the queue', () => {
      markerState.addLoop();
      harness.tickBy(10);
      markerState.tapLoopIn(0);
      harness.tickBy(200);
      markerState.tapLoopOut(0); // in 10, out 210

      markerState.auditionLoopOut(0);

      const prerollFrames = Math.round(
        (LOOP_AUDITION_PREROLL_MS * 1000) / harness.nominalIntervalUs()
      );
      expect(harness.framesRendered()).toBe(210 - prerollFrames);
      expect(markerState.activeLoopSlot()).toBe(0);
      expect(markerState.queuedLoopSlot()).toBeNull();
    });

    it('is a no-op for a slot that is not playable', () => {
      markerState.addLoop();
      markerState.tapLoopIn(0); // no out marked

      markerState.auditionLoopOut(0);

      expect(markerState.activeLoopSlot()).toBeNull();
    });
  });
});
