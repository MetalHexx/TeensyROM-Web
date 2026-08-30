import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SidFile } from '../sid/sid-file.model';
import type { RegisterValuesSnapshot } from '../asid/register-frame';
import { RegisterFrame } from '../asid/register-frame';
import { C64Machine } from '../cpu/c64-machine';
import type { MachineSnapshot } from '../cpu/c64-machine';
import { LOOP_AUDITION_PREROLL_MS, MarkerState, NUDGE_RANGE_MS } from './marker-state';
import type { MarkerHost } from './marker-state';
import { playRateFor } from './play-rate';
import type { PlayRate } from './play-rate';

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

  playRate(): PlayRate {
    return playRateFor(this.cpuMachine, 'exact');
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

  /** Adds a marker, then marks its end `length` frames later — a loop candidate whose start sits
   *  wherever the harness's position was when this ran. */
  function markLoopMarker(length: number): number {
    const index = markerState.addMarker();
    harness.tickBy(length);
    markerState.setMarkerEnd(index);
    return index;
  }

  describe('marker capture and restore', () => {
    it('captures the machine/frame state at the current position, and triggering it hands that exact snapshot back for a restore', () => {
      harness.tickBy(5);
      const snapshotAtCapture = harness.machine().snapshot();
      const registersAtCapture = harness.frame().snapshotValues();

      const index = markerState.addMarker();

      expect(markerState.markers()).toHaveLength(1);
      expect(markerState.markers()[0].start?.frame).toBe(5);

      harness.tickBy(10); // play on past the capture

      markerState.triggerMarker(index);

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
        playRate: () => playRateFor(null, 'exact'),
        restoreState: () => undefined,
        queueResync: () => undefined,
        effectiveMutes: () => [false, false, false],
        fail: () => undefined,
      };
      const marker = new MarkerState(noTuneHarness);

      const index = marker.addMarker();

      expect(marker.markers()).toEqual([{ start: null, end: null }]);
      expect(index).toBe(0);
    });

    it('is a no-op to trigger an empty or out-of-range row', () => {
      markerState.addMarker();
      markerState.clearMarker(0);

      markerState.triggerMarker(0);
      markerState.triggerMarker(5);

      expect(harness.restores).toHaveLength(0);
    });

    it('refills a cleared row by capturing into it again, landing at the new position', () => {
      harness.tickBy(5);
      markerState.addMarker();
      markerState.clearMarker(0);

      harness.tickBy(5);
      markerState.captureMarkerStart(0);

      expect(markerState.markers()[0].start?.frame).toBe(10);
    });

    it('deletes a row outright, shifting later indices down', () => {
      markerState.addMarker();
      markerState.addMarker();

      markerState.deleteMarker(0);

      expect(markerState.markers()).toHaveLength(1);
    });
  });

  describe('the start nudge', () => {
    it('walks a marker backward onto an earlier frame', () => {
      harness.tickBy(60);
      const index = markerState.addMarker();

      markerState.setMarkerStartOffset(index, -10);

      markerState.triggerMarker(index);
      expect(harness.restores.at(-1)?.frame).toBe(50);
    });

    it('triggers a nudged marker without emulating a frame, however deep it was captured', () => {
      harness.tickBy(200);
      const index = markerState.addMarker();
      markerState.setMarkerStartOffset(index, -20); // the replay this runs happens before the spy below attaches
      const runFrame = vi.spyOn(C64Machine.prototype, 'runFrame');

      markerState.triggerMarker(index);

      // The stall this design exists to avoid: a trigger that re-derived the nudged point would run
      // frames on the live machine, blocking whatever else rides the same thread.
      expect(runFrame).not.toHaveBeenCalled();
      expect(harness.restores.at(-1)?.frame).toBe(180);
    });

    it('walks a marker forward onto a later frame', () => {
      harness.tickBy(60);
      const index = markerState.addMarker();

      markerState.setMarkerStartOffset(index, 10);

      markerState.triggerMarker(index);
      expect(harness.restores.at(-1)?.frame).toBe(70);
    });

    it('clamps the offset to the nudge range in both directions', () => {
      harness.tickBy(60);
      const index = markerState.addMarker();
      const range = markerState.nudgeRangeFrames();

      markerState.setMarkerStartOffset(index, 999);
      expect(markerState.markers()[index].start?.offset).toBe(range);

      markerState.setMarkerStartOffset(index, -999);
      expect(markerState.markers()[index].start?.offset).toBe(-range);
    });

    it('falls back to the frame-0 anchor for a marker captured before the ring has filled', () => {
      harness.tickBy(5);
      const index = markerState.addMarker();

      markerState.setMarkerStartOffset(index, -5);

      markerState.triggerMarker(index);
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
      const index = markerState.addMarker();
      const runFrame = vi.spyOn(C64Machine.prototype, 'runFrame');

      markerState.setMarkerStartOffset(index, -markerState.nudgeRangeFrames());

      // A replay from the frame-0 seed would run ~400 frames; one from a recent anchor is bounded by
      // the anchor spacing plus the nudge range, well under that.
      expect(runFrame.mock.calls.length).toBeLessThan(200);
    });

    it('drops the ring on resetAnchorRing, leaving a capture with nothing to anchor to until reseeded', () => {
      harness.tick();
      markerState.maybeRecordAnchor(harness.machine(), harness.frame(), harness.framesRendered());

      markerState.resetAnchorRing();
      const strandedIndex = markerState.addMarker();
      expect(markerState.markers()[strandedIndex].start).toBeNull(); // nothing left in the ring to pair it with

      markerState.recordAnchor(harness.machine(), harness.frame(), harness.framesRendered());
      const reseededIndex = markerState.addMarker();
      expect(markerState.markers()[reseededIndex].start).not.toBeNull();
    });
  });

  describe('converting between cue and loop shape', () => {
    it('an end at or before the start does not resolve to a loop', () => {
      const index = markerState.addMarker(); // start at frame 0
      markerState.setMarkerEnd(index); // end also at frame 0 — no pass

      markerState.triggerMarker(index);

      expect(markerState.loopingMarker()).toBeNull();
    });

    it('an end that resolves after the start turns the marker into a loop', () => {
      const index = markerState.addMarker(); // start at frame 0
      harness.tickBy(10);
      markerState.setMarkerEnd(index); // end at frame 10

      markerState.triggerMarker(index);

      expect(markerState.loopingMarker()).toBe(index);
    });

    it('setMarkerEnd and clearMarkerEnd convert a row in both directions, preserving its start and its index', () => {
      markerState.addMarker(); // a filler row ahead of the one under test
      harness.tickBy(5);
      const index = markerState.addMarker();
      const startFrame = markerState.markers()[index].start?.frame;

      markerState.setMarkerEnd(index);
      expect(markerState.markers()[index].end).not.toBeNull();
      expect(markerState.markers()[index].start?.frame).toBe(startFrame);

      markerState.clearMarkerEnd(index);
      expect(markerState.markers()[index].end).toBeNull();
      expect(markerState.markers()[index].start?.frame).toBe(startFrame);
    });

    it('a loop whose end is cleared mid-lap behaves as a cue rather than erroring at the tick wrap', () => {
      const index = markLoopMarker(10); // start 0, end 10
      markerState.triggerMarker(index);
      expect(markerState.loopingMarker()).toBe(index);

      markerState.clearMarkerEnd(index);
      const wrapped = markerState.advanceLoop(999);

      expect(wrapped).toBe(false); // no pass describes it — dropped out rather than erroring
      expect(markerState.loopingMarker()).toBeNull();
    });

    it('setMarkerEndOffset nudges the end arithmetically, without touching the start', () => {
      const index = markLoopMarker(30); // start 0, end 30
      const runFrame = vi.spyOn(C64Machine.prototype, 'runFrame');
      const startBefore = markerState.markers()[index].start;

      markerState.setMarkerEndOffset(index, -20);

      expect(runFrame).not.toHaveBeenCalled();
      expect(markerState.markers()[index].end?.offset).toBe(-20);
      expect(markerState.markers()[index].start).toBe(startBefore);
    });

    it('clamps the end offset to the nudge range in both directions', () => {
      const index = markLoopMarker(30);
      const range = markerState.nudgeRangeFrames();

      markerState.setMarkerEndOffset(index, 999);
      expect(markerState.markers()[index].end?.offset).toBe(range);

      markerState.setMarkerEndOffset(index, -999);
      expect(markerState.markers()[index].end?.offset).toBe(-range);
    });

    it('clearMarker blanks both points and keeps the row in place', () => {
      const index = markLoopMarker(10);

      markerState.clearMarker(index);

      expect(markerState.markers()[index]).toEqual({ start: null, end: null });
      expect(markerState.markers()).toHaveLength(1);
    });
  });

  describe('triggering and the lap queue', () => {
    it('engages a marker at once when nothing is looping', () => {
      const index = markLoopMarker(10);

      markerState.triggerMarker(index);

      expect(markerState.loopingMarker()).toBe(index);
      expect(harness.restores.at(-1)?.frame).toBe(0);
    });

    it('a marker triggered while a loop runs waits for the lap, then plays on linearly once it lands', () => {
      const loop = markLoopMarker(10); // start 0, end 10
      markerState.triggerMarker(loop);
      harness.tickBy(3);
      const cue = markerState.addMarker(); // a plain cue at frame 3

      markerState.triggerMarker(cue);

      expect(markerState.loopingMarker()).toBe(loop); // the running lap is unaffected
      expect(markerState.queuedMarker()).toBe(cue);

      const wrapped = markerState.advanceLoop(10);

      expect(wrapped).toBe(true);
      expect(markerState.loopingMarker()).toBeNull(); // the cue leaves the loop, deferred to the lap
      expect(markerState.queuedMarker()).toBeNull();
      expect(harness.restores.at(-1)?.frame).toBe(3);
    });

    it('a third trigger replaces a queued marker without disturbing the running lap', () => {
      const loop = markLoopMarker(10);
      markerState.triggerMarker(loop);
      const cueA = markerState.addMarker();
      const cueB = markerState.addMarker();

      markerState.triggerMarker(cueA);
      markerState.triggerMarker(cueB);

      expect(markerState.loopingMarker()).toBe(loop);
      expect(markerState.queuedMarker()).toBe(cueB);
    });

    it('re-triggering the marker already looping, with nothing queued, restarts its lap', () => {
      const loop = markLoopMarker(10); // start 0, end 10
      markerState.triggerMarker(loop);
      harness.tickBy(5);
      const restoresBefore = harness.restores.length;

      markerState.triggerMarker(loop);

      expect(harness.restores.length).toBe(restoresBefore + 1);
      expect(harness.restores.at(-1)?.frame).toBe(0);
      expect(markerState.loopingMarker()).toBe(loop);
      expect(markerState.queuedMarker()).toBeNull();
    });

    it('stopLoop escapes on the spot, dropping the queue and leaving playback running linearly', () => {
      const loop = markLoopMarker(10);
      markerState.triggerMarker(loop);
      const cue = markerState.addMarker();
      markerState.triggerMarker(cue); // queued behind the running lap

      markerState.stopLoop();

      expect(markerState.loopingMarker()).toBeNull();
      expect(markerState.queuedMarker()).toBeNull();
    });
  });

  describe('the tick wrap boundary', () => {
    it('does not wrap the frame before the resolved end is reached', () => {
      const index = markLoopMarker(10); // start 0, end 10
      markerState.triggerMarker(index);
      const restoresBefore = harness.restores.length;

      const wrapped = markerState.advanceLoop(9);

      expect(wrapped).toBe(false);
      expect(harness.restores).toHaveLength(restoresBefore);
    });

    it('wraps exactly on the frame the resolved end is reached, restoring the start', () => {
      const index = markLoopMarker(10);
      markerState.triggerMarker(index);

      const wrapped = markerState.advanceLoop(10);

      expect(wrapped).toBe(true);
      expect(harness.restores.at(-1)?.frame).toBe(0);
    });

    it('a queued marker engages exactly on the boundary frame, not a tick early or late', () => {
      const loop = markLoopMarker(10); // start 0, end 10
      markerState.triggerMarker(loop);
      harness.tickBy(3);
      const cue = markerState.addMarker(); // start frame 3
      markerState.triggerMarker(cue);

      const early = markerState.advanceLoop(9);
      expect(early).toBe(false);
      expect(markerState.queuedMarker()).toBe(cue);

      const onBoundary = markerState.advanceLoop(10);
      expect(onBoundary).toBe(true);
      expect(markerState.queuedMarker()).toBeNull();
      expect(harness.restores.at(-1)?.frame).toBe(3);
    });

    it('drops out, without restoring, once a nudge crosses the ends', () => {
      const index = markLoopMarker(10); // start 0, end 10
      markerState.triggerMarker(index);
      markerState.setMarkerEndOffset(index, -markerState.nudgeRangeFrames());
      const restoresBefore = harness.restores.length;

      const wrapped = markerState.advanceLoop(10);

      expect(wrapped).toBe(false);
      expect(markerState.loopingMarker()).toBeNull();
      expect(harness.restores).toHaveLength(restoresBefore);
    });
  });

  describe('the marker audition', () => {
    it('auditionMarkerStart restores the row to its start immediately, bypassing the queue', () => {
      const loop = markLoopMarker(10);
      markerState.triggerMarker(loop); // engages the loop
      harness.tickBy(5);
      const cue = markerState.addMarker(); // a plain cue, further along

      markerState.auditionMarkerStart(cue);

      expect(harness.restores.at(-1)?.frame).toBe(5);
      expect(markerState.loopingMarker()).toBeNull(); // a cue leaves the loop, same as engaging one does
      expect(markerState.queuedMarker()).toBeNull();
    });

    it('auditionMarkerStart is a no-op for a row with no start', () => {
      const index = markerState.addMarker();
      markerState.clearMarker(index);

      markerState.auditionMarkerStart(index);

      expect(harness.restores).toHaveLength(0);
    });

    it('auditionMarkerEnd resumes pre-roll frames before the end and queues a resync, without touching the queue', () => {
      harness.tickBy(10);
      const index = markerState.addMarker(); // start frame 10
      harness.tickBy(200);
      markerState.setMarkerEnd(index); // end frame 210

      markerState.auditionMarkerEnd(index);

      const prerollFrames = Math.round(
        (LOOP_AUDITION_PREROLL_MS * 1000) / harness.nominalIntervalUs()
      );
      expect(harness.framesRendered()).toBe(210 - prerollFrames);
      expect(markerState.loopingMarker()).toBe(index);
      expect(markerState.queuedMarker()).toBeNull();
    });

    it('auditionMarkerEnd is a no-op for a row that does not resolve to a loop', () => {
      const index = markerState.addMarker(); // no end marked

      markerState.auditionMarkerEnd(index);

      expect(markerState.loopingMarker()).toBeNull();
    });
  });

  describe('the whole-tune loop', () => {
    /** Plays forward the way the coordinator's tick loop does — one entry-capture check per frame,
     *  after the position it is checked against has been incremented. */
    function playThrough(frames: number): void {
      for (let i = 0; i < frames; i++) {
        harness.tick();
        markerState.maybeCaptureTuneLoopEntry(
          harness.machine(),
          harness.frame(),
          harness.framesRendered()
        );
      }
    }

    it('re-enters at the frame-0 seed once the first lap ends, and does so again a lap later', () => {
      markerState.setTuneLoop(0, 1000);
      expect(markerState.tuneLoopArmed()).toBe(true);
      expect(markerState.tuneLoopOutFrame()).toBe(1000);

      const wrapped = markerState.advanceLoop(1000);

      expect(wrapped).toBe(true);
      expect(harness.restores).toHaveLength(1);
      // Through MarkerHost.restoreState, exactly like a marker's re-entry — not a private field, and
      // not a second resync of its own.
      expect(harness.restores[0].frame).toBe(0);
      expect(harness.resyncCount).toBe(1);

      const wrappedAgain = markerState.advanceLoop(1000);

      expect(wrappedAgain).toBe(true);
      expect(harness.restores).toHaveLength(2);
      expect(harness.restores[1].frame).toBe(0);
    });

    it('waits out the intro as well as the lap for a loop that starts partway in', () => {
      markerState.setTuneLoop(200, 1000);

      expect(markerState.tuneLoopOutFrame()).toBe(1200);
      expect(markerState.advanceLoop(1000)).toBe(false); // one lap in, but the intro has not been paid
      expect(harness.restores).toHaveLength(0);

      expect(markerState.advanceLoop(1200)).toBe(true);
      expect(harness.restores.at(-1)?.frame).toBe(0); // the start was never played through — the seed
    });

    it('re-enters at a non-zero loop start, so an unrepeating intro plays once', () => {
      markerState.setTuneLoop(20, 40);

      playThrough(20); // the intro, ending on the loop start
      const machineAtStart = harness.machine().snapshot();
      const registersAtStart = harness.frame().snapshotValues();
      playThrough(40); // the first lap, ending on the out-frame

      expect(markerState.advanceLoop(harness.framesRendered())).toBe(true);
      expect(harness.restores.at(-1)?.frame).toBe(20);
      // The machine as it stood at the loop start, so the lap resumes mid-tune rather than replaying
      // the intro it just paid for.
      expect(harness.restores.at(-1)?.machine).toEqual(machineAtStart);
      expect(harness.restores.at(-1)?.registers).toEqual(registersAtStart);
    });

    it('re-enters a tune that repeats from the top at the frame-0 image, not the frame after it', () => {
      const machineAtZero = harness.machine().snapshot();
      markerState.setTuneLoop(0, 40);

      playThrough(40);

      expect(markerState.advanceLoop(harness.framesRendered())).toBe(true);
      expect(harness.restores.at(-1)?.frame).toBe(0);
      // The counter tune advances every play call, so a frame-1 image restored under frame 0 —
      // what capturing on `>=` would produce — reads as a different machine here.
      expect(harness.restores.at(-1)?.machine).toEqual(machineAtZero);
    });

    it('falls back to the tune start for a non-zero loop start playback never passed through', () => {
      playThrough(30); // already past the start the detection is about to name
      markerState.setTuneLoop(20, 40);

      playThrough(30); // on to the out-frame at 60, without ever crossing frame 20 again

      expect(markerState.advanceLoop(harness.framesRendered())).toBe(true);
      expect(harness.restores.at(-1)?.frame).toBe(0);
    });

    it('drops the entry image on a subtune re-init, falling back to the reseeded tune start', () => {
      markerState.setTuneLoop(20, 40);
      playThrough(60);

      // What TuneSession.initSubtune does around a re-init: drop the ring, then seed a frame-0
      // anchor on the machine it has just re-initialised.
      markerState.resetAnchorRing();
      markerState.recordAnchor(harness.machine(), harness.frame(), 0);

      expect(markerState.advanceLoop(60)).toBe(true);
      // A stale image restored onto a re-initialised machine would sound like noise rather than
      // fail, which is why the entry goes with the ring.
      expect(harness.restores.at(-1)?.frame).toBe(0);
    });

    it('drops the entry image when a new detection arrives', () => {
      markerState.setTuneLoop(20, 40);
      playThrough(20); // holds the image at frame 20

      markerState.setTuneLoop(0, 40); // a fresh detection — the held image describes the old start
      playThrough(40);

      expect(markerState.advanceLoop(harness.framesRendered())).toBe(true);
      expect(harness.restores.at(-1)?.frame).toBe(0);
    });

    it('does not fire while disarmed, even past the detected point', () => {
      markerState.setTuneLoop(0, 1000);
      markerState.setTuneLoopArmed(false);

      const wrapped = markerState.advanceLoop(1000);

      expect(wrapped).toBe(false);
      expect(harness.restores).toHaveLength(0);
    });

    it('does not fire with no detected loop', () => {
      markerState.setTuneLoop(null, null);

      const wrapped = markerState.advanceLoop(1_000_000);

      expect(wrapped).toBe(false);
      expect(harness.restores).toHaveLength(0);
    });

    it('treats a zero, negative or non-finite period as null, disarming rather than throwing', () => {
      markerState.setTuneLoop(0, 1000);
      expect(markerState.tuneLoopArmed()).toBe(true);

      markerState.setTuneLoop(0, 0);
      expect(markerState.tuneLoopOutFrame()).toBeNull();
      expect(markerState.tuneLoopArmed()).toBe(false);

      markerState.setTuneLoop(0, -5);
      expect(markerState.tuneLoopOutFrame()).toBeNull();

      markerState.setTuneLoop(0, Number.NaN);
      expect(markerState.tuneLoopOutFrame()).toBeNull();
    });

    it('keeps a start of zero — a tune that repeats from its very first frame is not a rejected one', () => {
      markerState.setTuneLoop(0, 1000);

      expect(markerState.tuneLoopStartFrame()).toBe(0);
      expect(markerState.tuneLoopArmed()).toBe(true);
      expect(markerState.tuneLoopOutFrame()).toBe(1000);
    });

    it('a marker loop and the whole-tune loop never both fire on one tick — the marker wins', () => {
      markerState.addMarker(); // a filler row, start frame 0
      harness.tickBy(5);
      const index = markerState.addMarker(); // start frame 5
      harness.tickBy(5); // now at frame 10
      markerState.setMarkerEnd(index); // end frame 10
      markerState.triggerMarker(index); // engages, restoring to frame 5
      markerState.setTuneLoop(0, 10); // armed against the same out-frame as the marker's end
      const restoresBeforeWrap = harness.restores.length;

      const wrapped = markerState.advanceLoop(10);

      expect(wrapped).toBe(true);
      expect(harness.restores).toHaveLength(restoresBeforeWrap + 1);
      // The marker's own start, not the whole-tune loop's frame-0 seed — proof only one branch ran.
      expect(harness.restores.at(-1)?.frame).toBe(5);
      expect(markerState.loopingMarker()).toBe(index);
    });

    it('a marker whose ends have been nudged across each other drops its own loop mid-lap, leaving the whole-tune arm untouched', () => {
      const index = markLoopMarker(10); // start 0, end 10
      markerState.triggerMarker(index);
      markerState.setTuneLoop(0, 1000);
      expect(markerState.tuneLoopArmed()).toBe(true);

      markerState.setMarkerEndOffset(index, -markerState.nudgeRangeFrames()); // crosses the start

      const wrapped = markerState.advanceLoop(10);

      expect(wrapped).toBe(false);
      expect(markerState.loopingMarker()).toBeNull(); // the marker loop's own get-out
      expect(markerState.tuneLoopArmed()).toBe(true); // untouched — not the operator getting out
    });

    it('the public stopLoop() clears both loop kinds, while leaving the detected point in place', () => {
      const index = markLoopMarker(10);
      markerState.triggerMarker(index);
      markerState.setTuneLoop(0, 1000);
      expect(markerState.loopingMarker()).toBe(index);
      expect(markerState.tuneLoopArmed()).toBe(true);

      markerState.stopLoop();

      expect(markerState.loopingMarker()).toBeNull();
      expect(markerState.tuneLoopArmed()).toBe(false);
      expect(markerState.tuneLoopOutFrame()).toBe(1000); // still true, only the permission to act is gone
    });

    it('clear() disarms the whole-tune loop but leaves the detected point in place', () => {
      markerState.setTuneLoop(0, 1000);

      markerState.clear();

      expect(markerState.tuneLoopArmed()).toBe(false);
      expect(markerState.tuneLoopOutFrame()).toBe(1000);
    });
  });
});
