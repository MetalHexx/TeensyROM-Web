import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { milliseconds, replayToFrame } from '@sidablist/core';
import type { ReplayRequest, ReplayResponse, ReplayRunner } from '@sidablist/core';
import { createRow, createSet } from '@sidablist/tunes';
import type { LoopMarker, Playable, TuneIdentity } from '@sidablist/tunes';
import type { TuneIndexRecord } from '@sidablist/analysis';
import { DeckRuntime } from './deck-runtime';
import { PITCH_BEND_CENTRE, PITCH_BEND_MAX } from './ports';
import type { Slot } from './slot';
import type { ControlIdentity, MappingStyle } from './mapping/mapping.models';
import {
  LAUNCH_CONTROL,
  RECORD_FRAMES,
  entryIndexOf,
  indexedRecord,
  pitchBend,
  pitchBendSource,
  setUpMappingHarness,
  type MappingHarness,
} from './mapping/testing/mapping-harness';

/** Answers every replay request against the real `replayToFrame`, so a handback and a paused
 *  landing have the machine's image to rebuild from. */
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

/** A well-formed PSID v2 file of three subtunes whose init and play routines do nothing. */
function sidBytes(): Uint8Array {
  const payload = [0xa9, 0x00, 0x60, 0x60]; // init: LDA #0; RTS — play: RTS
  const buffer = new Uint8Array(PSID_HEADER_SIZE + payload.length);
  const view = new DataView(buffer.buffer);
  buffer.set([0x50, 0x53, 0x49, 0x44], 0x00); // 'PSID'
  view.setUint16(0x04, 2, false);
  view.setUint16(0x06, PSID_HEADER_SIZE, false);
  view.setUint16(0x08, 0x1000, false);
  view.setUint16(0x0a, 0x1000, false);
  view.setUint16(0x0c, 0x1003, false);
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
    dominantIntervalFrames: null,
    pulseConfidence: 'none',
    nativeTempo: null,
    callsPerFrame: 1,
    exactCallsPerFrame: 1,
    timingMode: 'exact',
    formatVersion: 5,
    computedAt: new Date(0).toISOString(),
  };
}

function playableOf(identity: TuneIdentity): Playable {
  const bytes = sidBytes();
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
const PORT = 'port-1';
const NAME = 'Launch Control XL';

const SEEK_A: ControlIdentity = { owner: 'A', control: 'seek' };
const SEEK_B: ControlIdentity = { owner: 'B', control: 'seek' };

/** The longest the hand reaches and a short grip, so strokes travel far and throws settle fast. */
const REACH = 2;
const GRIP = 0.4;
const HAND: MappingStyle = { kind: 'hand', amount: REACH, grip: GRIP };

/** One call of a deck's rate source, as the engine made it. */
interface Tick {
  readonly position: number;
  readonly intervalUs: number;
  readonly rate: number;
}

describe('DeckHand', () => {
  let h: MappingHarness;
  let runtime: DeckRuntime;
  let ticks: Record<Slot, Tick[]>;
  let tickCount: number;
  let animationFrames: Map<number, FrameRequestCallback>;
  let nextFrameId: number;
  const written = new Uint8Array(25);
  const sent = new Uint8Array(25);

  const settle = async (): Promise<void> => {
    TestBed.flushEffects();
    await new Promise<void>((resolve) => setTimeout(resolve));
    TestBed.flushEffects();
  };

  /** Fires frames of the deck's clock, one at a time. */
  function tick(count = 1, slot: Slot = 'A'): void {
    for (let i = 0; i < count; i++) {
      h.clocks[slot === 'A' ? 0 : 1].tick(milliseconds(++tickCount));
    }
  }

  function tickUntil(done: () => boolean, slot: Slot = 'A', limit = 3000): void {
    for (let i = 0; i < limit && !done(); i++) {
      tick(1, slot);
    }
    expect(done()).toBe(true);
  }

  /** Runs the animation frames requested so far, once. */
  function runAnimationFrames(): void {
    const due = [...animationFrames.values()];
    animationFrames.clear();
    due.forEach((callback) => callback(0));
  }

  const position = (slot: Slot = 'A'): number => runtime.position(slot);
  const entry = (slot: Slot = 'A'): number => {
    runtime.readRegisters(slot, written, sent);
    return entryIndexOf(written);
  };
  const lastTick = (slot: Slot = 'A'): Tick => ticks[slot][ticks[slot].length - 1];
  /** Where the tick left the playhead had nothing else moved it. */
  const landing = (t: Tick): number => t.position + t.rate;
  const deck = (slot: Slot = 'A') => h.djStore.deck(slot)();
  const engineVarispeed = (slot: Slot = 'A'): boolean => runtime.snapshot(slot).tempo.varispeed;
  const framesPerCount = (reach = REACH, slot: Slot = 'A'): number =>
    (reach * 1e6) / runtime.playCallIntervalUs(slot) / PITCH_BEND_MAX;

  /** Records every call the engine makes to a hand's rate source. */
  function traceRates(): void {
    const enter = runtime.enterVarispeed.bind(runtime);
    vi.spyOn(runtime, 'enterVarispeed').mockImplementation((slot, source) =>
      enter(slot, (at, intervalUs) => {
        const rate = source(at, intervalUs);
        ticks[slot].push({ position: at, intervalUs, rate });
        return rate;
      })
    );
  }

  function bend(value: number, timeStampMs = 0, channel = 1): void {
    h.engine.handle(pitchBend(value, timeStampMs, channel));
  }

  function mapStrip(
    control: ControlIdentity = SEEK_A,
    style: MappingStyle = HAND,
    channel = 1
  ): void {
    h.mappings.bind(pitchBendSource(channel), control, style);
  }

  function seedRows(
    rows: readonly { sidHash: string; markers?: readonly LoopMarker[] }[] = [
      { sidHash: 'hash-0' },
      { sidHash: 'hash-1' },
    ]
  ): void {
    const setRows = rows.map(({ sidHash, markers }, index) =>
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
        memory:
          markers === undefined
            ? null
            : {
                sidHash,
                lastSubtune: 1,
                subtunes: [{ subtune: 1, markers: [...markers] }],
                updated: '2026-01-01T00:00:00.000Z',
              },
        startSubtune: 1,
      })
    );
    const set = {
      ...createSet({ id: SET_ID, placeholder: 'Set 1', now: '2026-01-01T00:00:00.000Z' }),
      rows: setRows,
    };
    h.djStore.setSetsLibrary({ summaries: [], current: set });
    h.djStore.putOpenSet({ set });
    h.djStore.selectSetRow({ rowId: setRows[0].id, turned: false });
  }

  async function load(slot: Slot = 'A', rowId = 'row-0'): Promise<void> {
    await h.deckService.loadRow(slot, SET_ID, rowId);
    await settle();
  }

  /** A deck playing `frames` play calls into its tune, with the strip mapped to its seek. */
  async function playing(frames = 100, slot: Slot = 'A'): Promise<void> {
    await load(slot, slot === 'A' ? 'row-0' : 'row-1');
    tick(frames, slot);
    expect(position(slot)).toBe(frames);
  }

  async function paused(frames = 100): Promise<void> {
    await playing(frames);
    await h.deckService.togglePlayPause('A');
    expect(deck().status).toBe('paused');
  }

  beforeEach(async () => {
    TestBed.resetTestingModule();
    ticks = { A: [], B: [] };
    tickCount = 0;
    animationFrames = new Map();
    nextFrameId = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
      animationFrames.set(++nextFrameId, callback);
      return nextFrameId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
      animationFrames.delete(id);
    });

    h = setUpMappingHarness(undefined, new FakeReplayRunner());
    runtime = TestBed.inject(DeckRuntime);
    h.resolve.mockImplementation(async (identity: TuneIdentity) => playableOf(identity));
    traceRates();
    seedRows();
    await h.mappings.hydrate();
    mapStrip();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('a touch', () => {
    it('holds the tune where it is, at rate 0, without moving it', async () => {
      await playing(100);

      bend(9000);
      tick(3);

      expect(ticks.A.map((t) => t.rate)).toEqual([0, 0, 0]);
      expect(position()).toBe(100);
      expect(entry()).toBe(99);
      expect(runtime.snapshot('A').tempo.varispeed).toBe(true);
    });

    it('leaves a paused deck as it was when the finger lifts without having moved', async () => {
      await paused(100);

      bend(9000);
      tick(3);
      expect(position()).toBe(100);
      expect(deck().status).toBe('paused');
      bend(PITCH_BEND_CENTRE, 10);
      tick();
      await settle();

      expect(engineVarispeed()).toBe(false);
      expect(deck().varispeed).toBe(false);
      expect(deck().status).toBe('paused');
      expect(position()).toBe(100);
    });

    it('is the one write of the hand to the store, and shows as held', async () => {
      await playing(100);
      const hand = vi.spyOn(h.djStore, 'setDeckHand');

      bend(9000);

      expect(hand).toHaveBeenCalledExactlyOnceWith({ slot: 'A', held: true });
      expect(deck().handHeld).toBe(true);
      expect(h.djStore.transportSummary('A')().held).toBe(true);
      expect(h.djStore.transportSummary('B')().held).toBe(false);
    });

    it("mirrors the engine's varispeed into the deck", async () => {
      await playing(100);
      expect(deck().varispeed).toBe(false);

      bend(9000);
      expect(deck().varispeed).toBe(true);
      expect(deck().status).toBe('playing');
    });

    it('anchors at the position the first tick is handed, however the messages ran ahead of it', async () => {
      await playing(100);

      bend(9000);
      bend(9000 + 3000);
      tick();

      expect(lastTick().position).toBe(100);
      expect(landing(lastTick())).toBeCloseTo(100 + 3000 * framesPerCount(), 9);
    });
  });

  describe('a stroke', () => {
    it('lands the position at the anchor plus the counts moved times frames per count on the very next tick', async () => {
      await playing(100);
      bend(9000);
      tick();

      bend(9000 + 4000);
      tick();

      expect(landing(lastTick())).toBeCloseTo(100 + 4000 * framesPerCount(), 9);
      expect(position()).toBe(Math.floor(100 + 4000 * framesPerCount()));
      expect(entry()).toBe(position() - 1);
    });

    it('follows the finger back down as well as up', async () => {
      await playing(100);
      bend(9000);
      tick();
      bend(11000);
      tick();

      bend(9000 - 2000);
      tick();

      expect(landing(lastTick())).toBeCloseTo(100 - 2000 * framesPerCount(), 9);
    });

    it('uses the latest of several messages that arrive within one tick', async () => {
      await playing(100);
      bend(9000);
      tick();

      bend(9500, 10);
      bend(10500, 12);
      bend(10100, 14);
      tick();

      expect(landing(lastTick())).toBeCloseTo(100 + 1100 * framesPerCount(), 9);
    });

    it('moves nothing for a wobble within 12 counts of the last accepted value', async () => {
      await playing(100);
      bend(9000);
      tick();

      for (const value of [9012, 8988, 9005, 8995, 9012]) {
        bend(value);
        tick();
      }

      expect(ticks.A.every((t) => t.rate === 0)).toBe(true);
      expect(position()).toBe(100);
    });

    it('takes a value 13 counts away, and measures the next wobble from it', async () => {
      await playing(100);
      bend(9000);
      tick();
      bend(9013);
      tick();
      expect(landing(lastTick())).toBeCloseTo(100 + 13 * framesPerCount(), 9);

      bend(9013 + 12);
      bend(9013 - 12);
      tick();

      expect(landing(lastTick())).toBeCloseTo(100 + 13 * framesPerCount(), 9);
    });

    it("scales its travel with the mapping's reach", async () => {
      await playing(100);
      h.mappingStore.upsertMapping({
        mapping: {
          id: 'short',
          source: pitchBendSource(2),
          control: SEEK_A,
          style: { kind: 'hand', amount: 0.5, grip: GRIP },
        },
      });

      h.engine.handle(pitchBend(9000, 0, 2));
      tick();
      h.engine.handle(pitchBend(9000 + 4000, 10, 2));
      tick();

      expect(landing(lastTick())).toBeCloseTo(100 + 4000 * framesPerCount(0.5), 9);
      expect(framesPerCount(0.5)).toBeCloseTo(framesPerCount(2) / 4, 12);
    });

    it('carries on from where a mouse seek put the playhead', async () => {
      await playing(100);
      bend(9000);
      tick();
      bend(9000 + 2000);
      tick();

      await h.deckService.seek('A', 20);
      const seeked = position();
      expect(seeked).toBe(Math.round(runtime.snapshot('A').basis.positionBasisFrames * 0.2));
      tick();

      expect(lastTick().rate).toBeCloseTo(0, 9);
      expect(position()).toBe(seeked);

      bend(9000 + 2000 + 1000);
      tick();
      expect(landing(lastTick())).toBeCloseTo(lastTick().position + 1000 * framesPerCount(), 9);
    });

    it('carries on from where the end of the record stopped it', async () => {
      h.recorder.answer = indexedRecord(130);
      await playing(100);
      bend(9000);
      tick();

      bend(16000);
      tick();
      expect(position()).toBe(130);
      tick();
      const stuck = lastTick();
      expect(stuck.rate).toBeCloseTo(0, 9);

      bend(8300);
      tick();

      expect(landing(lastTick())).toBeCloseTo(130 + (8300 - 16000) * framesPerCount(), 9);
      expect(position()).toBeLessThan(130);
    });

    it('writes setDeckHand exactly twice over a 50-message stroke, and varispeed once', async () => {
      await playing(100);
      const hand = vi.spyOn(h.djStore, 'setDeckHand');
      const controls = vi.spyOn(h.djStore, 'setDeckEngineControls');

      bend(9000);
      for (let i = 1; i <= 50; i++) {
        bend(9000 + i * 40, i * 5);
        tick();
      }
      bend(PITCH_BEND_CENTRE, 260);

      expect(hand.mock.calls).toEqual([[{ slot: 'A', held: true }], [{ slot: 'A', held: false }]]);
      expect(controls).toHaveBeenCalledTimes(1);
      expect(h.djStore.transportSummary('A')().held).toBe(false);
    });
  });

  describe('a throw', () => {
    /** 20 counts per millisecond over the last 40 ms of the stroke. */
    function fling(): void {
      bend(9000, 0);
      tick();
      bend(9200, 100);
      bend(9600, 120);
      bend(10000, 140);
      tick();
    }

    it('starts at the release speed taken from the message timestamps', async () => {
      await playing(100);
      fling();

      bend(PITCH_BEND_CENTRE, 145);
      tick();

      const first = lastTick();
      expect(first.rate).toBeCloseTo(20 * framesPerCount() * (first.intervalUs / 1000), 9);
      expect(first.rate).toBeGreaterThan(1);
    });

    it('reaches only back 40 ms from the newest sample, and never counts the lifting message', async () => {
      await playing(100);
      bend(9000, 0);
      tick();
      bend(9400, 20);
      bend(10200, 100);
      bend(10400, 120);
      tick();

      bend(PITCH_BEND_CENTRE, 125);
      tick();

      // Only the samples at 100 and 120 are within 40 ms of the newest: 200 counts in 20 ms.
      const first = lastTick();
      expect(first.rate).toBeCloseTo(10 * framesPerCount() * (first.intervalUs / 1000), 9);
    });

    it('starts at rest when the finger had stopped before it lifted', async () => {
      await playing(100);
      bend(9000, 0);
      tick();
      bend(9400, 20);
      bend(10200, 40);
      tick();

      bend(PITCH_BEND_CENTRE, 100);
      tick();

      expect(lastTick().rate).toBe(0);
    });

    it('starts at rest when only one movement was accepted', async () => {
      await playing(100);
      bend(9000, 0);
      tick();
      bend(12000, 10);
      tick();

      bend(PITCH_BEND_CENTRE, 15);
      tick();

      expect(lastTick().rate).toBe(0);
    });

    it("slows by equal steps, constant friction, down to the deck's own speed", async () => {
      await playing(100);
      fling();
      bend(PITCH_BEND_CENTRE, 145);
      tick();
      const launch = lastTick();
      const step = launch.intervalUs / 1e6 / GRIP;

      tickUntil(() => lastTick().rate === 1);

      const rates = ticks.A.slice(ticks.A.indexOf(launch)).map((t) => t.rate);
      for (let i = 0; i < rates.length - 2; i++) {
        expect(rates[i] - rates[i + 1]).toBeCloseTo(step, 9);
      }
      expect(rates[rates.length - 1]).toBe(1);
      expect(rates.length).toBeGreaterThan(5);
    });

    it.each([0.1, 0.4, 1.6])('slows at the rate its %s s grip sets', async (grip) => {
      await playing(100);
      h.mappings.setStyle(h.mappingStore.mappings()[0].id, { kind: 'hand', amount: REACH, grip });
      fling();
      bend(PITCH_BEND_CENTRE, 145);
      tick(2);

      const [first, second] = ticks.A.slice(-2);
      expect(first.rate - second.rate).toBeCloseTo(first.intervalUs / 1e6 / grip, 9);
    });

    it('leaves varispeed on a playing deck by handing back, and plays on live', async () => {
      await playing(100);
      fling();
      bend(PITCH_BEND_CENTRE, 145);
      tick();
      expect(deck().handHeld).toBe(false);

      tickUntil(() => lastTick().rate === 1);
      await settle();
      const count = ticks.A.length;
      tick();

      expect(ticks.A.length).toBe(count);
      expect(engineVarispeed()).toBe(true);
      tickUntil(() => !engineVarispeed());
      await settle();
      expect(deck().varispeed).toBe(false);
      expect(deck().status).toBe('playing');
      const live = position();
      tick(3);
      expect(position()).toBe(live + 3);
    });

    it('leaves a paused deck paused where the throw stopped', async () => {
      await paused(100);
      fling();
      bend(PITCH_BEND_CENTRE, 145);
      tick();
      expect(lastTick().rate).toBeGreaterThan(1);

      tickUntil(() => lastTick().rate === 0);
      const stoppedAt = position();
      await settle();

      expect(stoppedAt).toBeGreaterThan(100);
      expect(engineVarispeed()).toBe(false);
      expect(deck().varispeed).toBe(false);
      expect(deck().status).toBe('paused');
      expect(position()).toBe(stoppedAt);
    });

    it("heads for the deck's speed as it changes: a pause mid-throw brings it to a stop", async () => {
      await playing(100);
      fling();
      bend(PITCH_BEND_CENTRE, 145);
      tick();
      await h.deckService.togglePlayPause('A');
      expect(deck().status).toBe('paused');

      tickUntil(() => lastTick().rate === 0);
      await settle();

      expect(engineVarispeed()).toBe(false);
      expect(deck().status).toBe('paused');
    });

    it('is stopped under the finger by a touch mid-throw', async () => {
      await playing(100);
      fling();
      bend(PITCH_BEND_CENTRE, 145);
      tick(3);
      expect(lastTick().rate).toBeGreaterThan(1);
      const hand = vi.spyOn(h.djStore, 'setDeckHand');

      bend(11000, 200);
      tick();
      const caught = position();
      tick(3);

      expect(hand).toHaveBeenCalledExactlyOnceWith({ slot: 'A', held: true });
      expect(ticks.A.slice(-4).map((t) => t.rate)).toEqual([0, 0, 0, 0]);
      expect(position()).toBe(caught);
      expect(deck().handHeld).toBe(true);
    });

    it('is not handed back by an arrival that a touch got in front of', async () => {
      await playing(100);
      fling();
      bend(PITCH_BEND_CENTRE, 145);
      tick();
      tickUntil(() => lastTick().rate === 1);

      bend(11000, 300);
      await settle();
      tick();

      expect(engineVarispeed()).toBe(true);
      expect(deck().handHeld).toBe(true);
      expect(lastTick().rate).toBeCloseTo(0, 9);
    });
  });

  describe('a lost source', () => {
    it('throws as a lift when the controller is lost', async () => {
      await playing(100);
      vi.spyOn(performance, 'now').mockReturnValue(1000);
      bend(9000, 960);
      tick();
      bend(9400, 970);
      bend(9800, 1000);
      tick();

      h.engine.releaseHolds(LAUNCH_CONTROL);
      tick();

      expect(deck().handHeld).toBe(false);
      const first = lastTick();
      expect(first.rate).toBeCloseTo((400 / 30) * framesPerCount() * (first.intervalUs / 1000), 9);
    });

    it('is thrown at rest when the newest sample is already older than the window', async () => {
      await playing(100);
      vi.spyOn(performance, 'now').mockReturnValue(5000);
      bend(9000, 0);
      tick();
      bend(9400, 20);
      bend(9800, 30);
      tick();

      h.mappings.remove(h.mappingStore.mappings()[0].id);
      tick();

      expect(deck().handHeld).toBe(false);
      expect(lastTick().rate).toBe(0);
    });

    describe('on the router', () => {
      beforeEach(async () => {
        TestBed.resetTestingModule();
        ticks = { A: [], B: [] };
        h = setUpMappingHarness(
          {
            controllers: [{ id: LAUNCH_CONTROL, name: NAME, lastPortId: PORT, listening: true }],
            mappings: [
              {
                id: 'hand-a',
                source: { controllerId: LAUNCH_CONTROL, channel: 1, kind: 'pitch-bend', number: 0 },
                owner: 'A',
                control: 'seek',
                style: HAND,
              },
            ],
            deckBindings: [],
          },
          new FakeReplayRunner()
        );
        runtime = TestBed.inject(DeckRuntime);
        h.resolve.mockImplementation(async (identity: TuneIdentity) => playableOf(identity));
        traceRates();
        seedRows();
        h.midiInput.plug(PORT, NAME);
        await h.controllers.hydrate();
        await h.mappings.hydrate();
        h.router.start();
        await settle();
        await playing(100);
        h.midiInput.emitPitchBend(PORT, 9000, 1, 0);
        expect(deck().handHeld).toBe(true);
      });

      it('throws when its listening is switched off', async () => {
        h.controllers.setListening(LAUNCH_CONTROL, false);
        await settle();
        await settle();

        expect(deck().handHeld).toBe(false);
      });

      it('throws when its port is unplugged', async () => {
        h.midiInput.unplug(PORT);
        await settle();
        await settle();

        expect(deck().handHeld).toBe(false);
      });
    });
  });

  describe('a stop, a load or a subtune switch', () => {
    /** The hand lets go of the deck and ignores the strip until it lifts and touches again. */
    async function expectDropped(): Promise<void> {
      expect(deck().handHeld).toBe(false);
      expect(engineVarispeed()).toBe(false);
      const before = ticks.A.length;
      bend(12000, 500);
      bend(15000, 510);
      expect(deck().handHeld).toBe(false);
      expect(ticks.A.length).toBe(before);

      bend(PITCH_BEND_CENTRE, 520);
      bend(10000, 600);
      expect(deck().handHeld).toBe(true);
      expect(engineVarispeed()).toBe(true);
    }

    it('lets go on a stop', async () => {
      await playing(100);
      bend(9000);
      tick();
      expect(deck().handHeld).toBe(true);

      h.deckService.stop('A');

      expect(deck().status).toBe('stopped');
      await expectDropped();
    });

    it('lets go on a load', async () => {
      await playing(100);
      bend(9000);
      tick();

      await load('A', 'row-1');

      expect(deck().loaded?.identity.sidHash).toBe('hash-1');
      await expectDropped();
    });

    it('lets go on a subtune switch', async () => {
      await playing(100);
      bend(9000);
      tick();

      await h.deckService.selectSubtune('A', 2);
      await settle();

      expect(deck().subtune).toBe(2);
      await expectDropped();
    });

    it('lets go of a throw in flight, ending it with the stop', async () => {
      await playing(100);
      bend(9000, 0);
      tick();
      bend(10000, 100);
      bend(11000, 130);
      tick();
      bend(PITCH_BEND_CENTRE, 135);
      tick(2);
      expect(engineVarispeed()).toBe(true);

      h.deckService.stop('A');
      await settle();

      expect(engineVarispeed()).toBe(false);
      expect(deck().status).toBe('stopped');
      expect(position()).toBe(0);
    });

    it('leaves the hand alone when a stop returns early', async () => {
      await playing(100);
      h.deckService.stop('A');
      expect(deck().status).toBe('stopped');
      bend(9000);
      tick();
      expect(deck().handHeld).toBe(true);
      expect(engineVarispeed()).toBe(true);

      h.deckService.stop('A');

      expect(deck().handHeld).toBe(true);
      expect(engineVarispeed()).toBe(true);
      bend(11000, 50);
      tick();
      expect(landing(lastTick())).toBeCloseTo(lastTick().position + 0 + 2000 * framesPerCount(), 9);
    });

    it('leaves the hand alone when a subtune switch is refused, and the throw still lets the deck out of varispeed', async () => {
      await playing(100);
      bend(9000, 0);
      tick();
      bend(9400, 100);
      bend(9800, 130);
      tick();
      h.djStore.setDeckBusy({ slot: 'A', busy: true });

      await h.deckService.selectSubtune('A', 2);

      expect(deck().subtune).toBe(1);
      expect(deck().handHeld).toBe(true);
      expect(engineVarispeed()).toBe(true);

      h.djStore.setDeckBusy({ slot: 'A', busy: false });
      bend(PITCH_BEND_CENTRE, 135);
      tick();
      tickUntil(() => lastTick().rate === 1);
      await settle();
      tickUntil(() => !engineVarispeed());
      expect(deck().varispeed).toBe(false);
    });
  });

  describe('a touch that cannot be taken', () => {
    it('is ignored on a deck with nothing loaded, and the next stroke works once loaded', async () => {
      bend(9000);
      bend(12000, 10);

      expect(deck().handHeld).toBe(false);
      expect(engineVarispeed()).toBe(false);

      bend(PITCH_BEND_CENTRE, 20);
      await playing(100);
      bend(9000, 30);
      expect(deck().handHeld).toBe(true);
    });

    it('is ignored until the strip is lifted, even after the deck becomes ready', async () => {
      await playing(100);
      h.djStore.setDeckBusy({ slot: 'A', busy: true });
      bend(9000);
      h.djStore.setDeckBusy({ slot: 'A', busy: false });

      bend(12000, 10);
      tick();

      expect(deck().handHeld).toBe(false);
      expect(engineVarispeed()).toBe(false);
      bend(PITCH_BEND_CENTRE, 20);
      bend(9000, 30);
      expect(deck().handHeld).toBe(true);
    });

    it('is ignored while there is no record yet, and plays on untouched', async () => {
      h.recorder.answer = null;
      await playing(100);

      bend(9000);
      bend(12000, 10);
      tick();

      expect(deck().handHeld).toBe(false);
      expect(engineVarispeed()).toBe(false);
      expect(position()).toBe(101);
    });

    it('is ignored when the position is already past the end of the record', async () => {
      h.recorder.answer = indexedRecord(50);
      await playing(100);

      bend(9000);
      tick();

      expect(deck().handHeld).toBe(false);
      expect(position()).toBe(101);
    });

    it('returns to idle when the controller is lost, so the next stroke is not ignored', async () => {
      h.recorder.answer = null;
      await playing(100);
      bend(9000);
      expect(deck().handHeld).toBe(false);

      h.engine.releaseHolds(LAUNCH_CONTROL);
      h.recorder.answer = indexedRecord(RECORD_FRAMES);
      await load();
      tick(10);
      bend(9000, 10);

      expect(deck().handHeld).toBe(true);
    });
  });

  describe('two decks', () => {
    it('keep their hands independent', async () => {
      mapStrip(SEEK_B, HAND, 2);
      await playing(100, 'A');
      await playing(60, 'B');

      bend(9000, 0, 1);
      h.engine.handle(pitchBend(9000, 0, 2));
      tick(1, 'A');
      tick(1, 'B');
      bend(9000 + 3000, 10, 1);
      tick(1, 'A');
      tick(1, 'B');

      expect(landing(lastTick('A'))).toBeCloseTo(100 + 3000 * framesPerCount(), 9);
      expect(position('B')).toBe(60);
      expect(lastTick('B').rate).toBe(0);
      expect(deck('A').handHeld).toBe(true);
      expect(deck('B').handHeld).toBe(true);

      bend(PITCH_BEND_CENTRE, 20, 1);
      expect(deck('A').handHeld).toBe(false);
      expect(deck('B').handHeld).toBe(true);
      h.engine.handle(pitchBend(9000 + 2000, 30, 2));
      tick(1, 'B');
      expect(landing(lastTick('B'))).toBeCloseTo(60 + 2000 * framesPerCount(REACH, 'B'), 9);
    });
  });

  describe('the position poll', () => {
    it('follows the hand on a paused deck, and stops once the deck leaves varispeed', async () => {
      await paused(100);
      await settle();
      runAnimationFrames();
      expect(animationFrames.size).toBe(0);

      bend(9000);
      TestBed.flushEffects();
      expect(animationFrames.size).toBeGreaterThan(0);
      tick();
      bend(9000 + 3000, 10);
      tick();
      runAnimationFrames();

      expect(deck().positionFrames).toBe(position());
      expect(position()).toBeGreaterThan(100);

      bend(PITCH_BEND_CENTRE, 15);
      tickUntil(() => lastTick().rate === 0);
      await settle();
      expect(deck().varispeed).toBe(false);
      expect(deck().positionFrames).toBe(position());
      runAnimationFrames();
      expect(animationFrames.size).toBe(0);
    });
  });

  describe('loops and queued jumps', () => {
    const loop = (id: string, start: number, end: number): LoopMarker => ({
      id,
      start: { frame: start, offsetFrames: 0 },
      end: { frame: end, offsetFrames: 0 },
      voices: [0, 1, 2],
    });

    async function loadWithLoops(): Promise<void> {
      seedRows([{ sidHash: 'hash-0', markers: [loop('a', 100, 120), loop('b', 300, 320)] }]);
      await load();
      await vi.waitFor(() =>
        expect(h.djStore.loops()['A'].markers.every((marker) => marker.ready)).toBe(true)
      );
    }

    /** A hand stroke from inside the loop to `to` and a lift that comes to rest at once. */
    async function dragTo(to: number, from = 9000): Promise<void> {
      bend(from, 0);
      tick();
      bend(to, 10);
      tick();
      bend(PITCH_BEND_CENTRE, 500);
      tick();
    }

    const frameOf = (value: number): number => Math.floor(110 + (value - 9000) * framesPerCount());

    it('releases a running loop that the throw landed past the end of', async () => {
      await loadWithLoops();
      await h.deckService.toggleMarker('A', 'a');
      tickUntil(() => position() >= 105);
      expect(h.djStore.loops()['A'].runningId).toBe('a');

      await dragTo(9000 + 8000);
      tickUntil(() => lastTick().rate === 1);
      await settle();

      expect(position()).toBeGreaterThanOrEqual(120);
      expect(h.djStore.loops()['A'].runningId).toBeNull();
      expect(runtime.snapshot('A').loop).toBeNull();
    });

    it('keeps a running loop that the throw landed inside, and fires the queued jump at its end', async () => {
      await loadWithLoops();
      await h.deckService.toggleMarker('A', 'a');
      tickUntil(() => position() >= 105);
      await h.deckService.toggleMarker('A', 'b');
      expect(h.djStore.loops()['A'].queuedId).toBe('b');

      await dragTo(9000 + 100);
      expect(frameOf(9100)).toBeGreaterThanOrEqual(100);
      tickUntil(() => lastTick().rate === 1);
      await settle();

      expect(h.djStore.loops()['A'].runningId).toBe('a');
      expect(h.djStore.loops()['A'].queuedId).toBe('b');
      expect(runtime.snapshot('A').loop).toEqual({ startFrame: 100, endFrame: 120 });

      tickUntil(() => !engineVarispeed());
      tickUntil(() => position() >= 300);
      await settle();
      expect(h.djStore.loops()['A'].runningId).toBe('b');
    });

    it('leaves the loop and the queue set while the finger holds the deck', async () => {
      await loadWithLoops();
      await h.deckService.toggleMarker('A', 'a');
      tickUntil(() => position() >= 105);
      await h.deckService.toggleMarker('A', 'b');

      bend(9000);
      tick();
      bend(9000 + 8000, 10);
      tick(5);

      expect(h.djStore.loops()['A'].runningId).toBe('a');
      expect(h.djStore.loops()['A'].queuedId).toBe('b');
      expect(position()).toBeGreaterThan(120);
    });
  });
});
