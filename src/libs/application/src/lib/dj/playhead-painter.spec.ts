import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TuneReference } from '@sidablist/tunes';
import { DeckRuntime } from './deck-runtime';
import { DjStore, EMPTY_DECK_LOOPS, type DeckLoopMarker, type DeckStatus } from './dj-store';
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
  readonly setLiveElapsed: ReturnType<typeof vi.fn>;
  readonly setLiveFrame: ReturnType<typeof vi.fn>;
  readonly setLiveProgress: ReturnType<typeof vi.fn>;
}

function recordingTargets(): RecordingTargets {
  const setLivePosition = vi.fn();
  const setLiveElapsed = vi.fn();
  const setLiveFrame = vi.fn();
  const setLiveProgress = vi.fn();
  return {
    targets: {
      transport: { setLivePosition, setLiveElapsed, setLiveFrame },
      loops: { setLiveProgress },
    },
    setLivePosition,
    setLiveElapsed,
    setLiveFrame,
    setLiveProgress,
  };
}

function allCalls(recording: RecordingTargets): ReturnType<typeof vi.fn>[] {
  return [
    recording.setLivePosition,
    recording.setLiveElapsed,
    recording.setLiveFrame,
    recording.setLiveProgress,
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
    position = vi.fn((slot: Slot) => positions[slot]);
    frameCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number =>
      frameCallbacks.push(callback)
    );

    TestBed.configureTestingModule({
      providers: [{ provide: DeckRuntime, useValue: { position } }],
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

  describe('the running marker loop', () => {
    function runLoop(
      markers: readonly DeckLoopMarker[],
      runningId: string | null,
      selectedId: string | null = null
    ): void {
      store.setDeckLoops({
        slot: 'A',
        loops: { ...EMPTY_DECK_LOOPS, markers, runningId, selectedId },
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

  describe('a scrub drag pin', () => {
    it('shows the pin on the transport at once, while the lap keeps following the playhead', () => {
      tuneAt(100);
      store.setDeckLoops({
        slot: 'A',
        loops: { ...EMPTY_DECK_LOOPS, markers: [loopMarker('loop', 0, 400)], runningId: 'loop' },
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
