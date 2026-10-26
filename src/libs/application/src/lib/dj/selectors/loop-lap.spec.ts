import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DjStore, EMPTY_DECK_LOOPS, type DeckLoopMarker } from '../dj-store';

function marker(id: string, start: number, end: number | null, nudge = 0): DeckLoopMarker {
  return {
    id,
    start: { frame: start, offsetFrames: nudge },
    end: end === null ? null : { frame: end, offsetFrames: -nudge },
    voices: [0, 1, 2],
    ready: true,
  };
}

describe('loopLapPercent', () => {
  let store: InstanceType<typeof DjStore>;

  beforeEach(() => {
    store = TestBed.inject(DjStore);
  });

  function run(markers: readonly DeckLoopMarker[], runningId: string | null): void {
    store.setDeckLoops({
      slot: 'A',
      loops: { ...EMPTY_DECK_LOOPS, markers, selectedId: markers[0]?.id ?? null, runningId },
    });
  }

  const lap = () => store.loopLapPercent('A')();

  it('is 0 with no marker running', () => {
    run([marker('a', 100, 200)], null);
    store.samplePosition({ slot: 'A', positionFrames: 150 });

    expect(lap()).toBe(0);
  });

  it('is 0 for a cue, which has no lap', () => {
    run([marker('a', 100, null)], 'a');
    store.samplePosition({ slot: 'A', positionFrames: 150 });

    expect(lap()).toBe(0);
  });

  it('is 0 when the nudged end is not after the nudged start', () => {
    run([marker('a', 100, 120, 15)], 'a');
    store.samplePosition({ slot: 'A', positionFrames: 110 });

    expect(lap()).toBe(0);
  });

  it('is the playhead fraction between the nudged start and end', () => {
    run([marker('a', 100, 200, 10)], 'a');

    store.samplePosition({ slot: 'A', positionFrames: 150 });
    expect(lap()).toBe(50);

    store.samplePosition({ slot: 'A', positionFrames: 130 });
    expect(lap()).toBe(25);
  });

  it('holds at the ends while the playhead is outside the lap', () => {
    run([marker('a', 100, 200)], 'a');

    store.samplePosition({ slot: 'A', positionFrames: 40 });
    expect(lap()).toBe(0);

    store.samplePosition({ slot: 'A', positionFrames: 260 });
    expect(lap()).toBe(100);
  });

  it('follows the running marker, not the selected one', () => {
    run([marker('a', 100, 200), marker('b', 300, 400)], 'b');
    store.samplePosition({ slot: 'A', positionFrames: 350 });

    expect(lap()).toBe(50);
  });

  it('reads the slot it was asked for', () => {
    run([marker('a', 100, 200)], 'a');
    store.samplePosition({ slot: 'A', positionFrames: 150 });
    store.samplePosition({ slot: 'B', positionFrames: 150 });

    expect(store.loopLapPercent('A')()).toBe(50);
    expect(store.loopLapPercent('B')()).toBe(0);
  });
});
