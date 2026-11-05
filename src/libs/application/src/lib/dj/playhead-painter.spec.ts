import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TuneReference } from '@sidablist/tunes';
import { DeckRuntime } from './deck-runtime';
import { DeckSlip } from './deck-slip';
import {
  DjStore,
  EMPTY_DECK_LOOPS,
  type DeckBeatGrid,
  type DeckLoopMarker,
  type DeckLoopsState,
  type DeckStatus,
} from './dj-store';
import { PlayheadPainter } from './playhead-painter';
import type { DeckPlayheadTargets } from './playhead-targets';
import type { Slot } from './slot';

/** 20 ms a play call: 50 frames a second. */
const INTERVAL_US = 20_000;

const TUNE: TuneReference = {
  identity: { sidHash: 'hash', subtune: 1 },
  title: 'Tune',
  author: 'Author',
  released: '2024',
  subtuneCount: 1,
  byteLength: 1024,
};

interface RecordingTargets {
  readonly targets: DeckPlayheadTargets;
  readonly setLivePosition: ReturnType<typeof vi.fn>;
  readonly setLiveReturnPosition: ReturnType<typeof vi.fn>;
  readonly setLiveElapsed: ReturnType<typeof vi.fn>;
  readonly setLiveFrame: ReturnType<typeof vi.fn>;
  readonly setLiveProgress: ReturnType<typeof vi.fn>;
  readonly setLiveBpm: ReturnType<typeof vi.fn>;
}

function recordingTargets(): RecordingTargets {
  const setLivePosition = vi.fn();
  const setLiveReturnPosition = vi.fn();
  const setLiveElapsed = vi.fn();
  const setLiveFrame = vi.fn();
  const setLiveProgress = vi.fn();
  const setLiveBpm = vi.fn();
  return {
    targets: {
      transport: { setLivePosition, setLiveReturnPosition, setLiveElapsed, setLiveFrame },
      loops: { setLiveProgress },
      speed: { setLiveBpm },
    },
    setLivePosition,
    setLiveReturnPosition,
    setLiveElapsed,
    setLiveFrame,
    setLiveProgress,
    setLiveBpm,
  };
}

function allCalls(recording: RecordingTargets): ReturnType<typeof vi.fn>[] {
  return [
    recording.setLivePosition,
    recording.setLiveReturnPosition,
    recording.setLiveElapsed,
    recording.setLiveFrame,
    recording.setLiveProgress,
    recording.setLiveBpm,
  ];
}

function clearCalls(recording: RecordingTargets): void {
  allCalls(recording).forEach((fn) => fn.mockClear());
}

function totalCalls(recording: RecordingTargets): number {
  return allCalls(recording).reduce((sum, fn) => sum + fn.mock.calls.length, 0);
}

function loopMarker(id: string, start: number, end: number | null): DeckLoopMarker {
  return {
    id,
    name: null,
    start: { frame: start, offsetFrames: 0 },
    end: end === null ? null : { frame: end, offsetFrames: 0 },
    voices: [],
    ready: true,
    settings: null,
    ownSettings: false,
    wraps: false,
  };
}

describe('PlayheadPainter', () => {
  let painter: PlayheadPainter;
  let store: InstanceType<typeof DjStore>;
  let positions: Record<Slot, number>;
  let position: ReturnType<typeof vi.fn>;
  let returnFrames: Record<Slot, number | null>;
  let frameCallbacks: FrameRequestCallback[];

  function runFrames(): void {
    const due = frameCallbacks;
    frameCallbacks = [];
    for (const callback of due) {
      callback(0);
    }
  }

  /** The loop's paint on the next frame it paints on. */
  function paintNextFrame(slot: Slot = 'A'): void {
    painter.paint(slot);
  }

  /** How many paints ran for `slot`: every paint reads the playhead once. */
  function readsOf(slot: Slot): number {
    return position.mock.calls.filter(([readSlot]) => readSlot === slot).length;
  }

  function setLength(lengthFrames: number): void {
    store.setDeckStructure({
      slot: 'A',
      structure: { loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: null },
      lengthFrames,
    });
  }

  function setStatus(status: DeckStatus): void {
    store.setDeckStatus({ slot: 'A', status });
    TestBed.flushEffects();
  }

  /** Puts the playhead at `frame` on a deck with a 1000-frame tune at 20 ms a play call. */
  function tuneAt(frame: number): void {
    positions.A = frame;
    setLength(1000);
    store.setDeckTiming({ slot: 'A', playCallIntervalUs: INTERVAL_US });
    TestBed.flushEffects();
  }

  beforeEach(() => {
    positions = { A: 0, B: 0 };
    returnFrames = { A: null, B: null };
    position = vi.fn((slot: Slot) => positions[slot]);
    frameCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number =>
      frameCallbacks.push(callback)
    );

    TestBed.configureTestingModule({
      providers: [
        { provide: DeckRuntime, useValue: { position } },
        { provide: DeckSlip, useValue: { returnFrame: (slot: Slot) => returnFrames[slot] } },
      ],
    });
    painter = TestBed.inject(PlayheadPainter);
    store = TestBed.inject(DjStore);
    TestBed.flushEffects();
    runFrames();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('paints every readout on attach, and a second paint at the same frame writes none', () => {
    tuneAt(250);
    const recording = recordingTargets();

    painter.attach('A', recording.targets);

    expect(recording.setLivePosition).toHaveBeenCalledExactlyOnceWith(25);
    expect(recording.setLiveElapsed).toHaveBeenCalledExactlyOnceWith('00:05.0');
    expect(recording.setLiveFrame).toHaveBeenCalledExactlyOnceWith('frame 250');
    expect(recording.setLiveProgress).toHaveBeenCalledExactlyOnceWith(0);
    expect(recording.setLiveBpm).toHaveBeenCalledExactlyOnceWith('---.-- BPM');

    clearCalls(recording);
    paintNextFrame();

    expect(totalCalls(recording)).toBe(0);
  });

  it('writes only the readouts whose shown value changed', () => {
    tuneAt(250);
    const recording = recordingTargets();
    painter.attach('A', recording.targets);
    clearCalls(recording);

    positions.A = 251; // 5.02 s: the tenths have not moved
    paintNextFrame();

    expect(recording.setLivePosition).toHaveBeenCalledExactlyOnceWith(25.1);
    expect(recording.setLiveFrame).toHaveBeenCalledExactlyOnceWith('frame 251');
    expect(totalCalls(recording)).toBe(2);

    positions.A = 255; // 5.1 s
    paintNextFrame();
    expect(recording.setLiveElapsed).toHaveBeenCalledExactlyOnceWith('00:05.1');
  });

  it('holds the bar to 0–100, and shows 0 and no time until the length and interval are known', () => {
    positions.A = 300;
    const recording = recordingTargets();
    painter.attach('A', recording.targets);

    expect(recording.setLivePosition).toHaveBeenLastCalledWith(0);
    expect(recording.setLiveElapsed).toHaveBeenLastCalledWith('00:00.0');
    expect(recording.setLiveFrame).toHaveBeenLastCalledWith('frame 300');

    tuneAt(5000);
    paintNextFrame();
    expect(recording.setLivePosition).toHaveBeenLastCalledWith(100);
    expect(recording.setLiveElapsed).toHaveBeenLastCalledWith('01:40.0');
  });

  it('is a no-op with nothing attached, and after detach', () => {
    painter.paint('A');
    expect(position).not.toHaveBeenCalled();

    const recording = recordingTargets();
    const detach = painter.attach('A', recording.targets);
    clearCalls(recording);
    position.mockClear();
    detach();
    positions.A = 40;
    paintNextFrame();
    painter.pin('A', 50);

    expect(position).not.toHaveBeenCalled();
    expect(totalCalls(recording)).toBe(0);
  });

  it('a stale detach does not remove a replacement target set', () => {
    const first = recordingTargets();
    const second = recordingTargets();
    const detachFirst = painter.attach('A', first.targets);
    painter.attach('A', second.targets);
    clearCalls(second);

    detachFirst();
    positions.A = 40;
    paintNextFrame();

    expect(second.setLiveFrame).toHaveBeenCalledExactlyOnceWith('frame 40');
  });

  it('repaints everything after a re-attach', () => {
    const recording = recordingTargets();
    painter.attach('A', recording.targets);
    clearCalls(recording);

    painter.attach('A', recording.targets);

    expect(allCalls(recording).every((fn) => fn.mock.calls.length === 1)).toBe(true);
  });

  it('keeps the decks apart', () => {
    const a = recordingTargets();
    const b = recordingTargets();
    painter.attach('A', a.targets);
    painter.attach('B', b.targets);
    clearCalls(a);
    clearCalls(b);

    positions.A = 10;
    positions.B = 20;
    paintNextFrame('A');

    expect(a.setLiveFrame).toHaveBeenCalledExactlyOnceWith('frame 10');
    expect(totalCalls(b)).toBe(0);
  });

  describe('the second playhead', () => {
    it('hides on attach and while there is no slip departure', () => {
      tuneAt(250);
      const recording = recordingTargets();

      painter.attach('A', recording.targets);

      expect(recording.setLiveReturnPosition).toHaveBeenCalledExactlyOnceWith(null);
    });

    it('shows the return frame as a percent of the tune, and moves with it', () => {
      tuneAt(250);
      const recording = recordingTargets();
      painter.attach('A', recording.targets);

      returnFrames.A = 600;
      paintNextFrame();
      expect(recording.setLiveReturnPosition).toHaveBeenLastCalledWith(60);

      returnFrames.A = 640;
      paintNextFrame();
      expect(recording.setLiveReturnPosition).toHaveBeenLastCalledWith(64);
    });

    it('writes only when the value changed', () => {
      tuneAt(250);
      const recording = recordingTargets();
      returnFrames.A = 600;
      painter.attach('A', recording.targets);
      recording.setLiveReturnPosition.mockClear();

      positions.A = 260;
      paintNextFrame();
      paintNextFrame();

      expect(recording.setLiveReturnPosition).not.toHaveBeenCalled();
    });

    it('hides when the departure ends', () => {
      tuneAt(250);
      returnFrames.A = 600;
      const recording = recordingTargets();
      painter.attach('A', recording.targets);

      returnFrames.A = null;
      paintNextFrame();

      expect(recording.setLiveReturnPosition).toHaveBeenLastCalledWith(null);
    });

    it('hides when the return frame meets the playhead, and shows again once they part', () => {
      tuneAt(250);
      returnFrames.A = 400;
      const recording = recordingTargets();
      painter.attach('A', recording.targets);

      positions.A = 400;
      paintNextFrame();
      expect(recording.setLiveReturnPosition).toHaveBeenLastCalledWith(null);

      positions.A = 401;
      paintNextFrame();
      expect(recording.setLiveReturnPosition).toHaveBeenLastCalledWith(40);
    });

    it('paintReturn follows the return frame alone while the playhead stands still', () => {
      tuneAt(250);
      returnFrames.A = 600;
      const recording = recordingTargets();
      painter.attach('A', recording.targets);
      clearCalls(recording);

      returnFrames.A = 640;
      painter.paintReturn('A');
      painter.paintReturn('A');
      expect(recording.setLiveReturnPosition).toHaveBeenCalledExactlyOnceWith(64);

      returnFrames.A = null;
      painter.paintReturn('A');
      expect(recording.setLiveReturnPosition).toHaveBeenLastCalledWith(null);
      expect(totalCalls(recording)).toBe(2);
    });

    it('paintReturn is a no-op with nothing attached', () => {
      returnFrames.A = 600;

      painter.paintReturn('A');

      expect(position).not.toHaveBeenCalled();
    });

    it('paints on the still paint of a paused deck', () => {
      tuneAt(100);
      setStatus('paused');
      const recording = recordingTargets();
      painter.attach('A', recording.targets);
      runFrames();
      recording.setLiveReturnPosition.mockClear();

      returnFrames.A = 500;
      store.samplePosition({ slot: 'A', positionFrames: 100 });
      TestBed.flushEffects();
      runFrames();

      expect(recording.setLiveReturnPosition).toHaveBeenCalledExactlyOnceWith(50);
    });
  });

  describe('the running marker loop', () => {
    /** The running marker runs on the bounds its list entry holds, unless `runningBounds` says the
     *  engine is still on others. */
    function runLoop(
      markers: readonly DeckLoopMarker[],
      runningId: string | null,
      selectedId: string | null = null,
      runningBounds?: DeckLoopsState['runningBounds']
    ): void {
      const running = markers.find((marker) => marker.id === runningId);
      store.setDeckLoops({
        slot: 'A',
        loops: {
          ...EMPTY_DECK_LOOPS,
          markers,
          runningId,
          selectedId,
          runningBounds:
            runningBounds !== undefined
              ? runningBounds
              : running?.end
              ? { start: running.start.frame, end: running.end.frame }
              : null,
        },
      });
      TestBed.flushEffects();
    }

    it("paints how far the playhead is through the running loop's lap, held to 0–100", () => {
      const recording = recordingTargets();
      painter.attach('A', recording.targets);
      runLoop([loopMarker('cue', 50, null), loopMarker('loop', 100, 300)], 'loop');

      positions.A = 150;
      paintNextFrame();
      expect(recording.setLiveProgress).toHaveBeenLastCalledWith(25);

      positions.A = 400;
      paintNextFrame();
      expect(recording.setLiveProgress).toHaveBeenLastCalledWith(100);
    });

    it('paints the lap of the bounds the engine enforces while an edit waits for the end of the pass', () => {
      const recording = recordingTargets();
      positions.A = 150;
      painter.attach('A', recording.targets);
      runLoop([loopMarker('loop', 100, 500)], 'loop', null, { start: 100, end: 300 });

      paintNextFrame();
      expect(recording.setLiveProgress).toHaveBeenLastCalledWith(25);

      store.setRunningBounds({ slot: 'A', runningBounds: { start: 100, end: 500 } });
      TestBed.flushEffects();
      paintNextFrame();
      expect(recording.setLiveProgress).toHaveBeenLastCalledWith(12.5);
    });

    it('paints 0 for a running marker with no length, and once no loop runs', () => {
      const recording = recordingTargets();
      positions.A = 150;
      painter.attach('A', recording.targets);
      const loop = loopMarker('loop', 100, 300);

      runLoop([loop, loopMarker('flat', 100, 100)], 'flat');
      paintNextFrame();
      expect(recording.setLiveProgress.mock.calls).toEqual([[0]]);

      runLoop([loop], 'loop');
      paintNextFrame();
      runLoop([loop], null);
      paintNextFrame();
      expect(recording.setLiveProgress.mock.calls).toEqual([[0], [25], [0]]);
    });

    it("schedules no paint for a loop change that leaves the running loop's bounds alone", () => {
      setStatus('paused');
      runLoop([loopMarker('a', 100, 300), loopMarker('b', 400, 500)], 'a', 'a');
      painter.attach('A', recordingTargets().targets);
      runFrames();
      position.mockClear();

      runLoop([loopMarker('a', 100, 300), loopMarker('b', 400, 500)], 'a', 'b');
      runFrames();

      expect(readsOf('A')).toBe(0);
    });
  });

  describe('the BPM', () => {
    /** 25 play calls a beat at 20 ms: 120 BPM at 1x. */
    const GRID: DeckBeatGrid = {
      beatFrames: 25,
      beatOneFrame: 0,
      startFrame: 100,
      endFrame: 500,
      source: 'scan',
    };

    function setGrid(beatGrid: DeckBeatGrid | null): void {
      store.setDeckBeatGrid({ slot: 'A', beatGrid });
      TestBed.flushEffects();
    }

    function setSpeed(speed: number): void {
      store.setDeckEngineControls({
        slot: 'A',
        speed,
        faderSpeed: speed,
        nudging: false,
        nudgeHeld: { up: false, down: false },
        varispeed: false,
        voices: store.decks().A.voices,
      });
      TestBed.flushEffects();
    }

    it('shows the tempo of the grid at the played speed while the playhead is in the span', () => {
      tuneAt(200);
      setGrid(GRID);
      setSpeed(1.5);
      const recording = recordingTargets();

      painter.attach('A', recording.targets);

      expect(recording.setLiveBpm).toHaveBeenCalledExactlyOnceWith('180.00 BPM');
    });

    it('blanks with no grid and outside the span, and returns on re-entry', () => {
      tuneAt(200);
      const recording = recordingTargets();
      painter.attach('A', recording.targets);
      expect(recording.setLiveBpm).toHaveBeenLastCalledWith('---.-- BPM');

      setGrid(GRID);
      positions.A = 200;
      paintNextFrame();
      expect(recording.setLiveBpm).toHaveBeenLastCalledWith('120.00 BPM');

      positions.A = 500;
      paintNextFrame();
      expect(recording.setLiveBpm).toHaveBeenLastCalledWith('---.-- BPM');

      positions.A = 50;
      paintNextFrame();
      expect(recording.setLiveBpm).toHaveBeenLastCalledWith('---.-- BPM');

      positions.A = 150;
      paintNextFrame();
      expect(recording.setLiveBpm).toHaveBeenLastCalledWith('120.00 BPM');
    });

    it('writes only when the text changed', () => {
      tuneAt(200);
      setGrid(GRID);
      const recording = recordingTargets();
      painter.attach('A', recording.targets);
      recording.setLiveBpm.mockClear();

      positions.A = 300;
      paintNextFrame();

      expect(recording.setLiveBpm).not.toHaveBeenCalled();
    });

    it('repaints a paused deck on a fader move or a new grid', () => {
      tuneAt(200);
      setGrid(GRID);
      setStatus('paused');
      const recording = recordingTargets();
      painter.attach('A', recording.targets);
      runFrames();
      recording.setLiveBpm.mockClear();

      setSpeed(0.5);
      runFrames();
      expect(recording.setLiveBpm).toHaveBeenLastCalledWith('60.00 BPM');

      setGrid({ ...GRID, beatFrames: 50 });
      runFrames();
      expect(recording.setLiveBpm).toHaveBeenLastCalledWith('30.00 BPM');
    });
  });

  describe('a scrub drag pin', () => {
    it('shows the pin on the transport at once, while the lap keeps following the playhead', () => {
      tuneAt(100);
      store.setDeckLoops({
        slot: 'A',
        loops: {
          ...EMPTY_DECK_LOOPS,
          markers: [loopMarker('loop', 0, 400)],
          runningId: 'loop',
          runningBounds: { start: 0, end: 400 },
        },
      });
      const recording = recordingTargets();
      painter.attach('A', recording.targets);
      paintNextFrame();
      clearCalls(recording);

      painter.pin('A', 50);

      // 50% of 1000 frames at 20 ms each is 10 s.
      expect(recording.setLivePosition).toHaveBeenCalledExactlyOnceWith(50);
      expect(recording.setLiveElapsed).toHaveBeenCalledExactlyOnceWith('00:10.0');
      expect(recording.setLiveFrame).toHaveBeenCalledExactlyOnceWith('frame 500');
      clearCalls(recording);

      positions.A = 200;
      paintNextFrame();

      expect(recording.setLiveProgress).toHaveBeenCalledExactlyOnceWith(50);
      expect(totalCalls(recording)).toBe(1);
    });

    it('shows each drag tick at once', () => {
      tuneAt(0);
      const recording = recordingTargets();
      painter.attach('A', recording.targets);
      paintNextFrame();

      painter.pin('A', 10);
      painter.pin('A', 20);

      expect(recording.setLivePosition).toHaveBeenLastCalledWith(20);
      expect(recording.setLiveFrame).toHaveBeenLastCalledWith('frame 200');
    });

    it('hands the transport back to the playhead the moment it clears, writing what moved', () => {
      tuneAt(100);
      const recording = recordingTargets();
      painter.attach('A', recording.targets);
      painter.pin('A', 64);
      positions.A = 641; // the seek landed a frame past the pin
      clearCalls(recording);

      painter.pin('A', null);

      expect(recording.setLivePosition).toHaveBeenCalledExactlyOnceWith(64.1);
      expect(recording.setLiveFrame).toHaveBeenCalledExactlyOnceWith('frame 641');
      expect(recording.setLiveElapsed).not.toHaveBeenCalled(); // 12.8 s either way
    });

    it('is dropped by a re-attach', () => {
      tuneAt(100);
      painter.attach('A', recordingTargets().targets);
      painter.pin('A', 64);

      const recording = recordingTargets();
      painter.attach('A', recording.targets);

      expect(recording.setLivePosition).toHaveBeenCalledExactlyOnceWith(10);
      expect(recording.setLiveFrame).toHaveBeenCalledExactlyOnceWith('frame 100');
    });
  });

  describe('holding still', () => {
    // Angular's own scheduler also asks for animation frames, so the scheduled paints are counted
    // at the playhead read rather than at the frame queue.

    function setVarispeed(varispeed: boolean): void {
      store.setDeckEngineControls({
        slot: 'A',
        speed: 1,
        faderSpeed: 1,
        nudging: false,
        nudgeHeld: { up: false, down: false },
        varispeed,
        voices: store.decks().A.voices,
      });
      TestBed.flushEffects();
    }

    function attachPaused(): RecordingTargets {
      tuneAt(100);
      setStatus('paused');
      const recording = recordingTargets();
      painter.attach('A', recording.targets);
      runFrames();
      clearCalls(recording);
      position.mockClear();
      return recording;
    }

    it('paints once on the next frame when a transition sample lands on a paused deck', () => {
      const recording = attachPaused();

      positions.A = 300;
      store.samplePosition({ slot: 'A', positionFrames: 300 });
      TestBed.flushEffects();
      expect(position).not.toHaveBeenCalled();

      runFrames();
      expect(readsOf('A')).toBe(1);
      expect(recording.setLivePosition).toHaveBeenCalledExactlyOnceWith(30);
      expect(recording.setLiveElapsed).toHaveBeenCalledExactlyOnceWith('00:06.0');
      expect(recording.setLiveFrame).toHaveBeenCalledExactlyOnceWith('frame 300');
    });

    it.each<[string, () => void]>([
      ['a stop', () => store.setDeckStatus({ slot: 'A', status: 'stopped' })],
      ['a new length', () => setLength(2000)],
      [
        'a new play-call interval',
        () => store.setDeckTiming({ slot: 'A', playCallIntervalUs: 40_000 }),
      ],
      [
        'a loop starting',
        () =>
          store.setDeckLoops({
            slot: 'A',
            loops: {
              ...EMPTY_DECK_LOOPS,
              markers: [loopMarker('loop', 0, 400)],
              runningId: 'loop',
              runningBounds: { start: 0, end: 400 },
            },
          }),
      ],
    ])('repaints a deck that is not playing after %s', (_name, change) => {
      attachPaused();

      change();
      TestBed.flushEffects();
      runFrames();

      expect(readsOf('A')).toBe(1);
    });

    it('repaints a paused deck once a hand on it lets go', () => {
      attachPaused();
      setVarispeed(true);
      runFrames();
      position.mockClear();

      setVarispeed(false);
      runFrames();

      expect(readsOf('A')).toBe(1);
    });

    it('repaints a load', () => {
      const recording = attachPaused();
      positions.A = 0;

      store.setDeckLoaded({ slot: 'A', reference: TUNE });
      TestBed.flushEffects();
      runFrames();

      expect(recording.setLivePosition).toHaveBeenCalledExactlyOnceWith(0);
      expect(recording.setLiveFrame).toHaveBeenCalledExactlyOnceWith('frame 0');
    });

    it('de-duplicates the scheduled paint per deck', () => {
      attachPaused();

      store.samplePosition({ slot: 'A', positionFrames: 300 });
      TestBed.flushEffects();
      setLength(2000);
      TestBed.flushEffects();
      runFrames();

      expect(readsOf('A')).toBe(1);
    });

    it('a playing deck schedules nothing: the loop paints its playhead', () => {
      tuneAt(100);
      setStatus('playing');
      painter.attach('A', recordingTargets().targets);
      runFrames();
      position.mockClear();

      store.samplePosition({ slot: 'A', positionFrames: 300 });
      setLength(2000);
      TestBed.flushEffects();
      runFrames();

      expect(position).not.toHaveBeenCalled();
    });
  });
});
