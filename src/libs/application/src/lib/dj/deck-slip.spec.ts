import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { milliseconds, replayToFrame } from '@sidablist/core';
import type { RegisterRecord, ReplayRequest, ReplayResponse, ReplayRunner } from '@sidablist/core';
import { createRow, createSet } from '@sidablist/tunes';
import type { LoopMarker, Playable, TuneIdentity } from '@sidablist/tunes';
import type { TuneIndexRecord } from '@sidablist/analysis';
import { DeckRuntime } from './deck-runtime';
import { DeckSlip } from './deck-slip';
import type { DeckBeatGrid } from './dj-store';
import { PITCH_BEND_CENTRE } from './ports';
import type { Slot } from './slot';
import type { ControlIdentity, MappingStyle } from './mapping/mapping.models';
import {
  entryIndexOf,
  indexedRecord,
  pitchBend,
  pitchBendSource,
  setUpMappingHarness,
  type MappingHarness,
} from './mapping/testing/mapping-harness';

/** Answers every replay request against the real `replayToFrame`, so a landing's handback has the
 *  machine's image to rebuild from. */
class FakeReplayRunner implements ReplayRunner {
  run(request: ReplayRequest): Promise<ReplayResponse> {
    try {
      return Promise.resolve({
        id: request.id,
        ok: true,
        result: replayToFrame(
          request.file,
          request.subtune,
          request.targetFrame,
          request.mutes,
          request.start
        ),
      });
    } catch (error) {
      return Promise.resolve({
        id: request.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  dispose(): void {
    // nothing to release
  }
}

const PSID_HEADER_SIZE = 0x7c;

/**
 * A PSID v2 tune whose play routine writes a 16-bit call counter, then counts, to registers 5 and
 * 6. Its sounding byte names the frame, so the register record the harness hands the player
 * (`indexedRecord`) says exactly what the machine would play, and two decks of it that were not
 * disturbed read the same bytes at the same position.
 */
function counterTune(): Uint8Array {
  const payload = [
    ...[0xa9, 0x00, 0x85, 0xfb, 0x85, 0xfc, 0x60], // init: counter = 0
    ...[0xa5, 0xfb, 0x8d, 0x05, 0xd4, 0xa5, 0xfc, 0x8d, 0x06, 0xd4], // play: write the counter
    ...[0xe6, 0xfb, 0xd0, 0x02, 0xe6, 0xfc, 0x60], // then count
  ];
  const buffer = new Uint8Array(PSID_HEADER_SIZE + payload.length);
  const view = new DataView(buffer.buffer);
  buffer.set([0x50, 0x53, 0x49, 0x44], 0x00); // 'PSID'
  view.setUint16(0x04, 2, false);
  view.setUint16(0x06, PSID_HEADER_SIZE, false);
  view.setUint16(0x08, 0x1000, false);
  view.setUint16(0x0a, 0x1000, false);
  view.setUint16(0x0c, 0x1007, false);
  view.setUint16(0x0e, 3, false);
  view.setUint16(0x10, 1, false);
  buffer.set(payload, PSID_HEADER_SIZE);
  return buffer;
}

function indexRecord(identity: TuneIdentity): TuneIndexRecord {
  return {
    sidHash: identity.sidHash,
    subtune: identity.subtune,
    loopStartFrame: null,
    loopPeriodFrames: null,
    endedAtFrame: null,
    sectionBoundaries: [],
    detectedMoments: [],
    tonic: null,
    mode: null,
    camelot: null,
    tuningReferenceHz: null,
    tuningCents: null,
    keyConfidence: 'none',
    scalePitchClasses: [],
    beatGrid: null,
    beatConfidence: 'none',
    callsPerFrame: 1,
    exactCallsPerFrame: 1,
    timingMode: 'exact',
    formatVersion: 5,
    computedAt: new Date(0).toISOString(),
  };
}

function playableOf(identity: TuneIdentity): Playable {
  const bytes = counterTune();
  return {
    reference: {
      identity,
      title: identity.sidHash,
      author: 'Test Author',
      released: '2024 Test',
      subtuneCount: 3,
      byteLength: bytes.byteLength,
    },
    bytes,
    index: indexRecord(identity),
  };
}

const SET_ID = 'set-1';

/** 24 frames a beat from frame 0, so a 1-beat live loop lasts 24 frames. */
const GRID: DeckBeatGrid = {
  beatFrames: 24,
  beatOneFrame: 0,
  startFrame: 0,
  endFrame: null,
  source: 'scan',
};

const SEEK_A: ControlIdentity = { owner: 'A', control: 'seek' };
const HAND: MappingStyle = { kind: 'hand', amount: 2, grip: 0.4 };

const loop = (id: string, start: number, end: number): LoopMarker => ({
  id,
  start: { frame: start, offsetFrames: 0 },
  end: { frame: end, offsetFrames: 0 },
  voices: [0, 1, 2],
});

const cue = (id: string, at: number): LoopMarker => ({
  id,
  start: { frame: at, offsetFrames: 0 },
  end: null,
  voices: [0, 1, 2],
});

/** Deck A, the deck under test, and deck B, which plays the same tune undisturbed: the line. */
describe('DeckSlip', () => {
  let h: MappingHarness;
  let runtime: DeckRuntime;
  let slip: DeckSlip;
  let tickCount: number;
  const written = new Uint8Array(25);
  const sent = new Uint8Array(25);

  const settle = async (): Promise<void> => {
    TestBed.flushEffects();
    await new Promise<void>((resolve) => setTimeout(resolve));
    TestBed.flushEffects();
  };

  /** Fires `count` frames of both decks, B undisturbed beside A. */
  function tick(count = 1): void {
    for (let i = 0; i < count; i++) {
      tickCount++;
      h.clocks[0].tick(milliseconds(tickCount));
      h.clocks[1].tick(milliseconds(tickCount));
    }
  }

  function tickUntil(done: () => boolean, limit = 3000): void {
    for (let i = 0; i < limit && !done(); i++) {
      tick();
    }
    expect(done()).toBe(true);
  }

  const position = (slot: Slot = 'A'): number => runtime.position(slot);
  /** The byte sounding on the deck: the entry index the counter tune, or its record, names. */
  const sounding = (slot: Slot = 'A'): number => {
    runtime.readRegisters(slot, written, sent);
    return entryIndexOf(written);
  };
  const deck = (slot: Slot = 'A') => h.djStore.deck(slot)();
  const loopsOf = (slot: Slot = 'A') => h.djStore.loops()[slot];
  const engineVarispeed = (slot: Slot = 'A'): boolean => runtime.snapshot(slot).tempo.varispeed;
  const engineLoop = (slot: Slot = 'A') => runtime.snapshot(slot).loop;

  /** A and B read the same position and the same sounding byte. */
  function expectOnTheLine(): void {
    expect(position('A')).toBe(position('B'));
    expect(sounding('A')).toBe(sounding('B'));
  }

  /**
   * Right after a landing sent to the engine: the positions agree at once and through the gate-off
   * frame, and from the first frame the record plays the sounding bytes agree too.
   */
  function expectLandedOnTheLine(): void {
    expect(position('A')).toBe(position('B'));
    tick();
    expect(position('A')).toBe(position('B'));
    tick();
    expectOnTheLine();
  }

  /** Plays on until A's handback hands over to the machine, comparing with the line every frame. */
  async function playOutTheHandback(): Promise<void> {
    for (let i = 0; i < 400 && engineVarispeed(); i++) {
      if (i % 10 === 0) {
        await settle();
      }
      tick();
      expectOnTheLine();
    }
    expect(engineVarispeed()).toBe(false);
    tick(20);
    expectOnTheLine();
  }

  /** A and B have left the line, A behind or ahead of it, with no landing sent. */
  function expectOffTheLine(): void {
    expect(position('A')).not.toBe(position('B'));
  }

  function seedRows(
    markers: readonly LoopMarker[] = [],
    markersB: readonly LoopMarker[] = []
  ): void {
    const rows = [
      { sidHash: 'hash-0', markers },
      { sidHash: 'hash-1', markers: markersB },
    ].map(({ sidHash, markers: held }, index) =>
      createRow({
        id: `row-${index}`,
        tune: {
          sidHash,
          title: `Tune ${index}`,
          author: 'Author',
          released: '',
          subtuneCount: 3,
          byteLength: 1,
        },
        memory: {
          sidHash,
          lastSubtune: 1,
          subtunes: [{ subtune: 1, markers: [...held] }],
          updated: '2026-01-01T00:00:00.000Z',
        },
        startSubtune: 1,
      })
    );
    const set = {
      ...createSet({ id: SET_ID, placeholder: 'Set 1', now: '2026-01-01T00:00:00.000Z' }),
      rows,
    };
    h.djStore.setSetsLibrary({ summaries: [], current: set });
    h.djStore.putOpenSet({ set });
    h.djStore.selectSetRow({ rowId: rows[0].id, turned: false });
  }

  interface PlayOptions {
    readonly markers?: readonly LoopMarker[];
    readonly markersB?: readonly LoopMarker[];
    readonly record?: RegisterRecord | null;
    readonly slipOn?: boolean;
    readonly beats?: number;
    /** Frames both decks play before the test starts. */
    readonly frames?: number;
  }

  /** Both decks loaded with the counter tune and playing, A with a grid, the live loop size and
   *  slip as asked. */
  async function playing(options: PlayOptions = {}): Promise<void> {
    if (options.record !== undefined) {
      h.recorder.answer = options.record;
    }
    seedRows(options.markers, options.markersB);
    for (const [slot, rowId] of [
      ['A', 'row-0'],
      ['B', 'row-1'],
    ] as const) {
      await h.deckService.loadRow(slot, SET_ID, rowId);
      await settle();
    }
    h.djStore.setDeckBeatGrid({ slot: 'A', beatGrid: GRID });
    h.deckService.setLiveLoopBeats('A', options.beats ?? 1);
    h.deckService.setSlip('A', options.slipOn ?? true);
    h.deckService.setSlip('B', false);
    await settle();
    await vi.waitFor(() =>
      expect(
        [...loopsOf('A').markers, ...loopsOf('B').markers].every((marker) => marker.ready)
      ).toBe(true)
    );
    tick(options.frames ?? 100);
    expectOnTheLine();
  }

  function bend(value: number, timeStampMs = 0): void {
    h.engine.handle(pitchBend(value, timeStampMs, 1));
  }

  /** Touches the record and moves it a little, the finger staying down. */
  function stroke(): void {
    bend(9000, 0);
    tick();
    bend(12000, 10);
    tick(3);
  }

  const toggleMarker = (id: string, slot: Slot = 'A') => h.deckService.toggleMarker(slot, id);

  beforeEach(async () => {
    TestBed.resetTestingModule();
    tickCount = 0;
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    h = setUpMappingHarness(undefined, new FakeReplayRunner());
    runtime = TestBed.inject(DeckRuntime);
    slip = TestBed.inject(DeckSlip);
    h.resolve.mockImplementation(async (identity: TuneIdentity) => playableOf(identity));
    h.recorder.answer = indexedRecord(6000);
    await h.mappings.hydrate();
    h.mappings.bind(pitchBendSource(1), SEEK_A, HAND);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('a live loop', () => {
    it('lands the deck on the line when it ends, frame-exact', async () => {
      await playing();

      h.deckService.toggleLiveLoop('A');
      tick(40);
      expect(loopsOf().live).not.toBeNull();
      expect(slip.returnFrame('A')).toBe(position('B'));
      expectOffTheLine();

      h.deckService.endLiveLoop('A');

      expect(loopsOf().live).toBeNull();
      expect(engineLoop()).toBeNull();
      expect(slip.returnFrame('A')).toBeNull();
      expect(runtime.getShadowPosition('A')).toBeNull();
      expectLandedOnTheLine();
      await playOutTheHandback();
    });

    it('reads as varispeed until the landing hands over, and is no hand', async () => {
      await playing();
      h.deckService.toggleLiveLoop('A');
      tick(40);

      h.deckService.endLiveLoop('A');
      tick();

      expect(engineVarispeed()).toBe(true);
      expect(deck().varispeed).toBe(true);
      expect(deck().handHeld).toBe(false);
      expect(h.djStore.transportSummary('A')().held).toBe(false);
    });

    it('sends nothing when it ends before the first lap, where the deck already is', async () => {
      await playing();
      h.deckService.toggleLiveLoop('A');
      tick(10);

      h.deckService.endLiveLoop('A');
      tick();

      expect(engineVarispeed()).toBe(false);
      expectOnTheLine();
    });

    it('ends as with slip off when slip is off: the deck keeps playing where it is', async () => {
      await playing({ slipOn: false });
      h.deckService.toggleLiveLoop('A');
      tick(40);
      expect(slip.returnFrame('A')).toBeNull();

      h.deckService.endLiveLoop('A');
      tick();

      expect(engineVarispeed()).toBe(false);
      expectOffTheLine();
    });

    it('ends as with slip off when slip was switched off mid-departure, and stops the shadow', async () => {
      await playing();
      h.deckService.toggleLiveLoop('A');
      tick(40);

      h.deckService.setSlip('A', false);
      expect(runtime.getShadowPosition('A')).toBeNull();
      expect(slip.returnFrame('A')).toBeNull();
      h.deckService.endLiveLoop('A');
      tick();

      expect(engineVarispeed()).toBe(false);
      expectOffTheLine();
    });

    it('starts nothing for a live loop already running when slip is switched on', async () => {
      await playing({ slipOn: false });
      h.deckService.toggleLiveLoop('A');
      tick(40);

      h.deckService.setSlip('A', true);
      expect(runtime.getShadowPosition('A')).toBeNull();
      h.deckService.endLiveLoop('A');
      tick();

      expect(engineVarispeed()).toBe(false);
      expectOffTheLine();
    });

    it('falls back to the slip-off end when the deck has no record, with no stall', async () => {
      await playing({ record: null });
      h.deckService.toggleLiveLoop('A');
      tick(40);
      expect(loopsOf().live).not.toBeNull();

      h.deckService.endLiveLoop('A');
      const at = position('A');
      tick(5);

      expect(loopsOf().live).toBeNull();
      expect(engineLoop()).toBeNull();
      expect(slip.returnFrame('A')).toBeNull();
      expect(engineVarispeed()).toBe(false);
      expect(position('A')).toBeGreaterThan(at);
    });

    it('falls back to the slip-off end when the count is past the record', async () => {
      await playing({ record: indexedRecord(150) });
      h.deckService.toggleLiveLoop('A');
      tick(90);
      expect(slip.returnFrame('A')).toBeGreaterThan(150);

      h.deckService.endLiveLoop('A');
      const at = position('A');
      tick(5);

      expect(loopsOf().live).toBeNull();
      expect(engineLoop()).toBeNull();
      expect(slip.returnFrame('A')).toBeNull();
      expect(engineVarispeed()).toBe(false);
      expect(position('A')).toBeGreaterThan(at);
    });
  });

  describe('a list marker loop', () => {
    const markers = [loop('m', 200, 224), loop('n', 300, 324)];

    it('begins as it is fired and lands the deck on the line when the play key lets it go', async () => {
      await playing({ markers });

      await toggleMarker('m');
      expect(position('A')).toBe(200);
      expect(slip.returnFrame('A')).toBe(position('B'));
      tick(40);
      expect(slip.returnFrame('A')).toBe(position('B'));

      await toggleMarker('m');

      expect(loopsOf().runningId).toBeNull();
      expect(engineLoop()).toBeNull();
      expect(slip.returnFrame('A')).toBeNull();
      expect(runtime.getShadowPosition('A')).toBeNull();
      expectLandedOnTheLine();
      await playOutTheHandback();
    });

    it('begins as it is played now, and the plate Stop lands the deck on the line', async () => {
      await playing({ markers });

      await h.deckService.playMarkerNow('A', 'm');
      tick(40);
      expect(slip.returnFrame('A')).toBe(position('B'));
      h.deckService.stopMarkerLoop('A');

      expect(loopsOf().runningId).toBeNull();
      expect(engineLoop()).toBeNull();
      expect(slip.returnFrame('A')).toBeNull();
      expectLandedOnTheLine();
    });

    it('lets go with no landing when slip is off', async () => {
      await playing({ markers, slipOn: false });
      await toggleMarker('m');
      tick(40);

      await toggleMarker('m');
      tick();

      expect(engineVarispeed()).toBe(false);
      expectOffTheLine();
    });

    describe.each([
      ['losing its end (No End)', (): void => h.deckService.clearMarkerEnd('A')],
      ['being deleted', (): void => h.deckService.deleteMarker('A')],
    ])('when the running loop is let go by %s', (_name, letGo) => {
      it('lands the deck on the line and ends the departure with slip on', async () => {
        await playing({ markers });
        await toggleMarker('m');
        tick(40);
        expect(slip.returnFrame('A')).toBe(position('B'));

        letGo();

        expect(loopsOf().runningId).toBeNull();
        expect(engineLoop()).toBeNull();
        expect(slip.returnFrame('A')).toBeNull();
        expect(runtime.getShadowPosition('A')).toBeNull();
        expectLandedOnTheLine();
        await playOutTheHandback();
      });

      it('counts the next marker from its own start, not the departure it ended', async () => {
        await playing({ markers });
        await toggleMarker('m');
        tick(40);
        letGo();
        expectLandedOnTheLine();
        await playOutTheHandback();

        const firedAt = tickCount;
        await toggleMarker('n');
        tick(5);

        expect(loopsOf().runningId).toBe('n');
        expect(position('A')).toBeGreaterThanOrEqual(300);
        expect(slip.returnFrame('A')).toBe(position('B'));
        expect(runtime.getShadowTicks('A')).toBe(tickCount - firedAt);
      });

      it('lets the deck play on where it is with slip off', async () => {
        await playing({ markers, slipOn: false });
        await toggleMarker('m');
        tick(40);

        letGo();
        tick();

        expect(loopsOf().runningId).toBeNull();
        expect(engineVarispeed()).toBe(false);
        expectOffTheLine();
      });
    });

    it('begins as it is queued behind a loop running before slip, and a cancelled queue stops the shadow', async () => {
      await playing({ markers, slipOn: false });
      await toggleMarker('m');
      tick(10);
      h.deckService.setSlip('A', true);
      expect(slip.returnFrame('A')).toBeNull();

      await toggleMarker('n');
      expect(loopsOf().queuedId).toBe('n');
      expect(runtime.getShadowPosition('A')).not.toBeNull();

      await toggleMarker('n');

      expect(loopsOf().queuedId).toBeNull();
      expect(runtime.getShadowPosition('A')).toBeNull();
      expect(slip.returnFrame('A')).toBeNull();
      expect(loopsOf().runningId).toBe('m');
    });

    it('drops the lap of the loop it was queued over at its hand-off, and ends on the line', async () => {
      // B runs the same loop as A from the same frame, and lets it go on the frame A hands off:
      // from there it plays the line the shadow is counting.
      await playing({
        markers: [loop('m', 200, 224), loop('n', 300, 324)],
        markersB: [loop('m', 200, 224)],
        slipOn: false,
      });
      await toggleMarker('m');
      await toggleMarker('m', 'B');
      tick(10);
      expectOnTheLine();
      h.deckService.setSlip('A', true);
      await toggleMarker('n');

      tickUntil(() => loopsOf().runningId === 'n');
      h.deckService.stopMarkerLoop('B');
      expect(position('A')).toBe(300);
      tick(30);
      expect(slip.returnFrame('A')).toBe(position('B'));

      await toggleMarker('n');

      expect(slip.returnFrame('A')).toBeNull();
      expectLandedOnTheLine();
    });
  });

  describe('the hand', () => {
    it('lands on the line at the lift when slip is on, and goes idle', async () => {
      await playing();

      stroke();
      expect(deck().handHeld).toBe(true);
      expect(slip.returnFrame('A')).toBe(position('B'));
      expectOffTheLine();
      bend(PITCH_BEND_CENTRE, 500);

      expect(deck().handHeld).toBe(false);
      expect(h.djStore.transportSummary('A')().held).toBe(false);
      expect(slip.returnFrame('A')).toBeNull();
      expectLandedOnTheLine();
      await playOutTheHandback();
    });

    it('nests inside a list marker loop departure: the lift lands at the loop lap point, and the loop ends on the line', async () => {
      await playing({ markers: [loop('m', 200, 224)] });
      await toggleMarker('m');
      tick(10);
      const touchedAt = position('A');

      stroke();
      expect(slip.returnFrame('A')).not.toBe(position('B'));
      bend(PITCH_BEND_CENTRE, 500);

      expect(position('A')).toBe(touchedAt + 4);
      expect(loopsOf().runningId).toBe('m');
      expect(engineLoop()).toMatchObject({ startFrame: 200, endFrame: 224 });
      expect(slip.returnFrame('A')).toBe(position('B'));
      tick(30);

      await toggleMarker('m');

      expect(slip.returnFrame('A')).toBeNull();
      expectLandedOnTheLine();
    });

    it('throws at the lift when slip is off', async () => {
      await playing({ slipOn: false });

      stroke();
      expect(slip.returnFrame('A')).toBeNull();
      bend(PITCH_BEND_CENTRE, 500);
      tick(3);

      expectOffTheLine();
    });

    it('throws at the lift when slip was switched off since the touch', async () => {
      await playing();

      stroke();
      h.deckService.setSlip('A', false);
      expect(runtime.getShadowPosition('A')).toBeNull();
      bend(PITCH_BEND_CENTRE, 500);
      tick(3);

      expectOffTheLine();
    });
  });

  describe('a live loop over a list marker loop', () => {
    const markers = [loop('m', 200, 224)];

    /** Where the marker loop is when the live loop is pushed over it, and how long the live loop
     *  runs: well inside the marker's lap, so the lap point is the sum. */
    let pushedAt = 0;
    const LIVE_FRAMES = 5;

    async function loopOverMarker(): Promise<void> {
      await playing({ markers });
      await toggleMarker('m');
      tick(10);
      pushedAt = position('A');
      h.deckService.toggleLiveLoop('A');
      tick(LIVE_FRAMES);
      expect(loopsOf().live).not.toBeNull();
    }

    it('returns at the marker loop lap point, and the marker loop ends later on the line', async () => {
      await loopOverMarker();
      expect(loopsOf().runningId).toBe('m');

      h.deckService.endLiveLoop('A');

      expect(loopsOf().live).toBeNull();
      expect(loopsOf().runningId).toBe('m');
      expect(position('A')).toBe(pushedAt + LIVE_FRAMES);
      expect(engineLoop()).toMatchObject({ startFrame: 200, endFrame: 224 });
      expect(slip.returnFrame('A')).toBe(position('B'));
      tick(30);

      await toggleMarker('m');

      expect(slip.returnFrame('A')).toBeNull();
      expectLandedOnTheLine();
    });

    it('keeps the live loop going when the marker under it loses its end', async () => {
      await loopOverMarker();

      h.deckService.clearMarkerEnd('A');

      expect(loopsOf().runningId).toBeNull();
      expect(loopsOf().live).not.toBeNull();

      h.deckService.endLiveLoop('A');

      expect(loopsOf().live).toBeNull();
      expect(slip.returnFrame('A')).toBeNull();
      expectLandedOnTheLine();
    });

    it('is ended by the plate Stop on the outermost line', async () => {
      await loopOverMarker();

      h.deckService.stopMarkerLoop('A');

      expect(loopsOf().live).toBeNull();
      expect(loopsOf().runningId).toBeNull();
      expect(engineLoop()).toBeNull();
      expect(slip.returnFrame('A')).toBeNull();
      expectLandedOnTheLine();
    });
  });

  describe('a list marker loop fired over a live loop', () => {
    it('carries the count on and ends on the line', async () => {
      await playing({ markers: [loop('n', 300, 324)] });
      h.deckService.toggleLiveLoop('A');
      const pushedAt = tickCount;
      tick(5);

      await toggleMarker('n');
      expect(loopsOf().queuedId).toBe('n');
      tickUntil(() => loopsOf().runningId === 'n');

      expect(position('A')).toBe(300);
      expect(slip.returnFrame('A')).toBe(position('B'));
      expect(runtime.getShadowTicks('A')).toBe(tickCount - pushedAt);
      tick(30);

      await toggleMarker('n');

      expect(slip.returnFrame('A')).toBeNull();
      expectLandedOnTheLine();
    });

    it('moves the count back to the line without the lap of the loop under the live loop', async () => {
      await playing({
        markers: [loop('m', 200, 224), loop('n', 300, 324)],
        markersB: [loop('m', 200, 224)],
        slipOn: false,
      });
      await toggleMarker('m');
      await toggleMarker('m', 'B');
      tick(10);
      h.deckService.setSlip('A', true);
      h.deckService.toggleLiveLoop('A');
      tick(5);
      await toggleMarker('n');

      tickUntil(() => loopsOf().runningId === 'n');
      h.deckService.stopMarkerLoop('B');
      tick(30);
      expect(slip.returnFrame('A')).toBe(position('B'));

      await toggleMarker('n');

      expectLandedOnTheLine();
    });
  });

  describe('an older departure that ends while a newer one nested inside it runs', () => {
    it('lifting the hand over a live loop pushed in the hold leaves the live loop the line, and its end lands on it', async () => {
      await playing();
      stroke();
      h.deckService.toggleLiveLoop('A');
      tick(5);
      expect(loopsOf().live).not.toBeNull();

      bend(PITCH_BEND_CENTRE, 500);
      tick(5);

      expect(deck().handHeld).toBe(false);
      expect(slip.returnFrame('A')).toBe(position('B'));
      tick(10);

      h.deckService.endLiveLoop('A');

      expect(slip.returnFrame('A')).toBeNull();
      expect(runtime.getShadowPosition('A')).toBeNull();
      expectLandedOnTheLine();
    });

    /** A hand lifted over a live loop pushed in the hold throws, and the loop's landing inside that
     *  throw takes the record off the hand. */
    async function landInsideTheThrow(): Promise<void> {
      await playing();
      stroke();
      h.deckService.toggleLiveLoop('A');
      tick(2);
      bend(PITCH_BEND_CENTRE, 500);
      tick(2);
      h.deckService.endLiveLoop('A');
      tick(2);
    }

    it('a touch after a landing ended the throw takes the record back', async () => {
      await landInsideTheThrow();

      stroke();
      const heldAt = position('A');
      tick(3);

      expect(deck().handHeld).toBe(true);
      expect(position('A')).toBe(heldAt);
    });

    it('the strip takes slip again once the throw of that touch ends', async () => {
      await landInsideTheThrow();
      stroke();
      // That touch took over a throw, so it started no departure and its lift throws too.
      bend(PITCH_BEND_CENTRE, 1000);
      for (let i = 0; i < 400 && engineVarispeed(); i++) {
        tick();
        await settle();
      }
      expect(engineVarispeed()).toBe(false);

      stroke();
      const line = slip.returnFrame('A');
      expect(line).not.toBeNull();
      bend(PITCH_BEND_CENTRE, 2000);

      expect(position('A')).toBe(line);
      expect(deck().handHeld).toBe(false);
    });

    it('ending the live loop under a held hand leaves the hand the line, and the lift lands on it', async () => {
      await playing();
      h.deckService.toggleLiveLoop('A');
      tick(40);
      stroke();

      h.deckService.endLiveLoop('A');

      expect(loopsOf().live).toBeNull();
      expect(deck().handHeld).toBe(true);
      expect(slip.returnFrame('A')).toBe(position('B'));
      tick(10);
      expect(slip.returnFrame('A')).toBe(position('B'));

      bend(PITCH_BEND_CENTRE, 500);

      expect(slip.returnFrame('A')).toBeNull();
      expect(runtime.getShadowPosition('A')).toBeNull();
      expectLandedOnTheLine();
    });

    it('letting the marker loop go under a live loop leaves the live loop the line, and its end lands on it', async () => {
      await playing({ markers: [loop('m', 200, 224)] });
      await toggleMarker('m');
      tick(10);
      h.deckService.toggleLiveLoop('A');
      tick(5);
      expect(loopsOf().live).not.toBeNull();

      await toggleMarker('m');

      expect(loopsOf().runningId).toBeNull();
      expect(slip.returnFrame('A')).toBe(position('B'));
      tick(10);

      h.deckService.endLiveLoop('A');

      expect(slip.returnFrame('A')).toBeNull();
      expectLandedOnTheLine();
    });
  });

  describe('a cue', () => {
    it('landing over a departure ends it, and the line starts again at the cue', async () => {
      await playing({ markers: [cue('c', 400)] });
      h.deckService.toggleLiveLoop('A');
      tick(5);
      await toggleMarker('c');
      expect(loopsOf().queuedId).toBe('c');
      expect(slip.returnFrame('A')).not.toBeNull();

      tickUntil(() => position('A') >= 400);

      expect(loopsOf().live).toBeNull();
      expect(slip.returnFrame('A')).toBeNull();
      expect(runtime.getShadowPosition('A')).toBeNull();
    });

    it('fired with no departure running starts nothing', async () => {
      await playing({ markers: [cue('c', 400)] });

      await toggleMarker('c');

      expect(position('A')).toBe(400);
      expect(runtime.getShadowPosition('A')).toBeNull();
    });
  });

  describe('a stop, a load, a subtune switch and a scrub', () => {
    async function departing(): Promise<void> {
      await playing();
      h.deckService.toggleLiveLoop('A');
      tick(40);
      expect(slip.returnFrame('A')).not.toBeNull();
    }

    function expectEndedWithNoLanding(): void {
      expect(slip.returnFrame('A')).toBeNull();
      expect(runtime.getShadowPosition('A')).toBeNull();
      expect(engineVarispeed()).toBe(false);
    }

    it('end the departure on a stop', async () => {
      await departing();

      h.deckService.stop('A');

      expectEndedWithNoLanding();
    });

    it('end the departure on a scrub', async () => {
      await departing();

      await h.deckService.seek('A', 50);

      expectEndedWithNoLanding();
    });

    it('end the departure on a load', async () => {
      await departing();

      await h.deckService.loadRow('A', SET_ID, 'row-1');

      expectEndedWithNoLanding();
    });

    it('end the departure on a subtune switch', async () => {
      await departing();

      await h.deckService.selectSubtune('A', 2);

      expectEndedWithNoLanding();
    });
  });
});
