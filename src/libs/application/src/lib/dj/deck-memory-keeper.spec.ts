import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FakeClock } from '@sidablist/core';
import type { FrameClock, ReplayRunner } from '@sidablist/core';
import { InMemorySetStore, InMemoryTuneMemoryStore } from '@sidablist/tunes';
import type { TuneReference } from '@sidablist/tunes';
import {
  ALERT_SERVICE,
  FILE_CONTENT_SERVICE,
  StorageType,
  type Device,
} from '@teensyrom-nx/domain';
import { logError } from '@teensyrom-nx/utils';
import { DeviceStore } from '../device/device-store';
import { DeckMemoryKeeper } from './deck-memory-keeper';
import { DeckRuntime } from './deck-runtime';
import { DeckSpeed } from './deck-speed';
import { DjStore, HOME_DECK_PANEL, type DeckHolding, type DeckMixerSettings } from './dj-store';
import type { LoadSource } from './load-source';
import { decodeRowSettings, type DeckRowSettings } from './loops/row-settings-codec';
import {
  DJ_LIBRARY_STATE_REPOSITORY,
  FRAME_CLOCK_FACTORY,
  MIDI_ACCESS,
  REPLAY_RUNNER_FACTORY,
  SET_STORE,
  TUNE_INSERTER,
  TUNE_MEMORY_STORE,
  TUNE_RESOLVER,
} from './ports';
import type {
  IMidiAccess,
  MidiAccessState,
  MidiPermission,
  MidiPortOption,
} from './ports/midi-access';
import { DjSets } from './sets/dj-sets';
import type { Slot } from './slot';

vi.mock('@teensyrom-nx/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@teensyrom-nx/utils')>();
  return { ...actual, logError: vi.fn(actual.logError) };
});

const fakeMidiAccess: IMidiAccess = {
  accessState: signal<MidiAccessState>('granted'),
  ports: signal<readonly MidiPortOption[]>([]),
  lastError: signal<string | null>(null),
  queryPermission: (): Promise<MidiPermission> => Promise.resolve('granted'),
  requestAccess: (): Promise<void> => Promise.resolve(),
  holderOf: (): string | null => null,
  claim: (): boolean => true,
  release: (): void => undefined,
  outputPortFor: () => null,
};

const idleReplay: ReplayRunner = {
  run: () => Promise.reject(new Error('replay is not exercised here')),
  dispose: (): void => undefined,
};

const WRITE_DELAY_MS = 250;

describe('DeckMemoryKeeper', () => {
  let keeper: DeckMemoryKeeper;
  let sets: DjSets;
  let speed: DeckSpeed;
  let store: InstanceType<typeof DjStore>;
  let memoryStore: InMemoryTuneMemoryStore;
  let tunes: number;

  function reference(name: string, subtuneCount = 3): TuneReference {
    return {
      identity: { sidHash: `hash-${name}`, subtune: 1 },
      title: name,
      author: 'Author',
      released: '2024',
      subtuneCount,
      byteLength: 3,
    };
  }

  function source(name: string): LoadSource {
    return {
      deviceId: 'device-1',
      storageType: StorageType.Sd,
      path: `/${name}.sid`,
      fileName: `${name}.sid`,
    };
  }

  /** A row of the current set for a new tune, as a drop makes one. */
  async function newRow(subtune = 1): Promise<DeckHolding> {
    const name = `tune-${++tunes}`;
    const holding = await sets.joinForDeck(reference(name), source(name));
    return sets.selectSubtune(holding, subtune);
  }

  /** The deck holds the row and sits at a settled status, which is what makes it shapeable. */
  function settle(slot: Slot, holding: DeckHolding): void {
    sets.hold(slot, holding);
    store.setDeckLoaded({ slot, reference: reference('loaded') });
    store.setDeckStatus({ slot, status: 'playing' });
    TestBed.flushEffects();
  }

  /** Mirrors the speed controls into the store, as `DeckService` does after every change; the
   *  voices stay as they are unless given. */
  function reflectSpeed(slot: Slot, voices = store.decks()[slot].voices): void {
    store.setDeckEngineControls({
      slot,
      speed: speed.faderValue(slot),
      faderSpeed: speed.faderValue(slot),
      nudging: speed.isNudging(slot),
      voices,
    });
  }

  const voicesWith = (state: { muted?: number; held?: number }) =>
    [0, 1, 2].map((voice) => ({ muted: voice === state.muted, held: voice === state.held }));

  function keptFor(holding: DeckHolding): DeckRowSettings | null {
    return decodeRowSettings(sets.subtuneSettingsOf(holding));
  }

  async function wait(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.mocked(logError).mockClear();
    tunes = 0;
    memoryStore = new InMemoryTuneMemoryStore();

    TestBed.configureTestingModule({
      providers: [
        { provide: SET_STORE, useValue: new InMemorySetStore() },
        { provide: TUNE_MEMORY_STORE, useValue: memoryStore },
        {
          provide: DJ_LIBRARY_STATE_REPOSITORY,
          useValue: {
            load: vi.fn().mockResolvedValue(null),
            save: vi.fn().mockResolvedValue(undefined),
          },
        },
        { provide: ALERT_SERVICE, useValue: { warning: vi.fn(), error: vi.fn() } },
        { provide: FILE_CONTENT_SERVICE, useValue: { getFileContent: vi.fn() } },
        { provide: TUNE_INSERTER, useValue: { insert: vi.fn() } },
        { provide: TUNE_RESOLVER, useValue: { resolve: vi.fn() } },
        { provide: DeviceStore, useValue: { usableDevices: signal<Device[]>([]) } },
        { provide: FRAME_CLOCK_FACTORY, useValue: (): FrameClock => new FakeClock() },
        { provide: REPLAY_RUNNER_FACTORY, useValue: (): ReplayRunner => idleReplay },
        { provide: MIDI_ACCESS, useValue: fakeMidiAccess },
      ],
    });
    store = TestBed.inject(DjStore);
    sets = TestBed.inject(DjSets);
    speed = TestBed.inject(DeckSpeed);
    const runtime = TestBed.inject(DeckRuntime);
    runtime.build('A');
    runtime.build('B');
    keeper = TestBed.inject(DeckMemoryKeeper);
    keeper.install();
    await sets.hydrate();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes a knob turn to the held row and subtune once 250 ms have passed', async () => {
    const holding = await newRow(2);
    settle('A', holding);

    store.setDeckPanel({ slot: 'A', patch: { cutoff: 300 } });
    TestBed.flushEffects();
    await wait(WRITE_DELAY_MS - 1);
    expect(sets.subtuneSettingsOf(holding)).toBeUndefined();
    await wait(1);

    expect(keptFor(holding)?.mixer.panel.cutoff).toBe(300);
    expect(sets.subtuneSettingsOf({ ...holding, subtune: 1 })).toBeUndefined();

    await wait(300);
    const memory = await memoryStore.load(holding.sidHash);
    expect(memory?.subtunes.find((entry) => entry.subtune === 2)?.settings).toEqual(
      sets.subtuneSettingsOf(holding)
    );
  });

  it("keeps the voices' latched mutes, the speed fader and Repeat with the panel", async () => {
    const holding = await newRow();
    settle('A', holding);

    speed.setFader('A', 1.25);
    reflectSpeed('A', voicesWith({ muted: 1 }));
    store.setDeckRepeat({ slot: 'A', repeat: false });
    TestBed.flushEffects();
    await wait(WRITE_DELAY_MS);

    expect(keptFor(holding)).toEqual({
      mixer: { panel: HOME_DECK_PANEL, mutes: [false, true, false] },
      speed: 1.25,
      repeat: false,
    });
  });

  it('writes only the latest of the changes made within the delay, once', async () => {
    const holding = await newRow();
    settle('A', holding);
    const save = vi.spyOn(sets, 'saveSubtuneSettings');

    store.setDeckPanel({ slot: 'A', patch: { cutoff: 100 } });
    TestBed.flushEffects();
    await wait(100);
    store.setDeckPanel({ slot: 'A', patch: { cutoff: 200 } });
    TestBed.flushEffects();
    await wait(200);

    expect(save).toHaveBeenCalledTimes(1);
    expect(keptFor(holding)?.mixer.panel.cutoff).toBe(200);
  });

  it('records the state a deck settles in as its baseline, writing nothing', async () => {
    const holding = await newRow();
    store.setDeckPanel({ slot: 'A', patch: { cutoff: 150 } });

    settle('A', holding);
    await wait(WRITE_DELAY_MS * 2);

    expect(sets.subtuneSettingsOf(holding)).toBeUndefined();
  });

  it('writes nothing while the deck is not shapeable, and re-baselines when it is again', async () => {
    const holding = await newRow();
    settle('A', holding);

    store.setDeckStatus({ slot: 'A', status: 'failed', error: 'no' });
    store.setDeckPanel({ slot: 'A', patch: { cutoff: 150 } });
    store.setDeckRepeat({ slot: 'A', repeat: false });
    TestBed.flushEffects();
    await wait(WRITE_DELAY_MS * 2);
    expect(sets.subtuneSettingsOf(holding)).toBeUndefined();

    store.setDeckStatus({ slot: 'A', status: 'paused' });
    TestBed.flushEffects();
    await wait(WRITE_DELAY_MS * 2);
    expect(sets.subtuneSettingsOf(holding)).toBeUndefined();

    store.setDeckPanel({ slot: 'A', patch: { cutoff: 160 } });
    TestBed.flushEffects();
    await wait(WRITE_DELAY_MS);
    expect(keptFor(holding)?.mixer.panel.cutoff).toBe(160);
  });

  it('writes nothing while a load or a subtune switch is running', async () => {
    const holding = await newRow();
    settle('A', holding);

    store.setDeckSwitching({ slot: 'A', switching: true });
    store.setDeckPanel({ slot: 'A', patch: { cutoff: 150 } });
    TestBed.flushEffects();
    await wait(WRITE_DELAY_MS * 2);

    expect(sets.subtuneSettingsOf(holding)).toBeUndefined();
  });

  it("takes the deck's state under a new holding as that holding's baseline, writing home into no row", async () => {
    const first = await newRow();
    const second = await newRow();
    settle('A', first);
    store.setDeckPanel({ slot: 'A', patch: { cutoff: 150 } });
    TestBed.flushEffects();
    await wait(WRITE_DELAY_MS);

    store.setDeckSwitching({ slot: 'A', switching: true });
    store.resetDeckPanel({ slot: 'A', reason: 'tune-change' });
    sets.hold('A', second);
    store.setDeckSwitching({ slot: 'A', switching: false });
    TestBed.flushEffects();
    await wait(WRITE_DELAY_MS * 2);

    expect(sets.subtuneSettingsOf(second)).toBeUndefined();
    expect(keptFor(first)?.mixer.panel.cutoff).toBe(150);
  });

  it('writes a change still waiting to the row it was made on when the deck moves to another', async () => {
    const first = await newRow();
    const second = await newRow();
    settle('A', first);

    store.setDeckPanel({ slot: 'A', patch: { cutoff: 150 } });
    TestBed.flushEffects();
    sets.hold('A', second);
    TestBed.flushEffects();

    expect(keptFor(first)?.mixer.panel.cutoff).toBe(150);
    expect(sets.subtuneSettingsOf(second)).toBeUndefined();
    await wait(WRITE_DELAY_MS * 2);
    expect(sets.subtuneSettingsOf(second)).toBeUndefined();
  });

  describe('flush', () => {
    it('writes the waiting change at once, and the delay then writes nothing more', async () => {
      const holding = await newRow();
      settle('A', holding);
      const save = vi.spyOn(sets, 'saveSubtuneSettings');
      store.setDeckPanel({ slot: 'A', patch: { cutoff: 150 } });
      TestBed.flushEffects();

      keeper.flush('A');

      expect(keptFor(holding)?.mixer.panel.cutoff).toBe(150);
      await wait(WRITE_DELAY_MS * 2);
      expect(save).toHaveBeenCalledTimes(1);
    });

    it("does nothing when no change is waiting, and leaves the other deck's alone", async () => {
      const first = await newRow();
      const second = await newRow();
      settle('A', first);
      settle('B', second);
      store.setDeckPanel({ slot: 'B', patch: { cutoff: 150 } });
      TestBed.flushEffects();
      const save = vi.spyOn(sets, 'saveSubtuneSettings');

      keeper.flush('A');

      expect(save).not.toHaveBeenCalled();
      await wait(WRITE_DELAY_MS);
      expect(keptFor(second)?.mixer.panel.cutoff).toBe(150);
    });

    it('logs a write that fails rather than throwing', async () => {
      const holding = await newRow();
      settle('A', holding);
      vi.spyOn(sets, 'saveSubtuneSettings').mockImplementation(() => {
        throw new Error('no copy');
      });
      store.setDeckPanel({ slot: 'A', patch: { cutoff: 150 } });
      TestBed.flushEffects();

      expect(() => keeper.flush('A')).not.toThrow();
      expect(logError).toHaveBeenCalledTimes(1);
    });
  });

  describe('what it keeps', () => {
    const MAIN: DeckMixerSettings = {
      panel: { ...HOME_DECK_PANEL, cutoff: 40 },
      mutes: [false, false, false],
    };

    it("keeps the main track's settings while a marker's own are in play", async () => {
      const holding = await newRow();
      store.setDeckPanel({ slot: 'A', patch: { cutoff: 40 } });
      settle('A', holding);

      store.setSettingsInPlay({
        slot: 'A',
        panel: { ...HOME_DECK_PANEL, cutoff: 900 },
        settingsInPlayId: 'marker',
        mainSettings: MAIN,
      });
      TestBed.flushEffects();
      store.setDeckPanel({ slot: 'A', patch: { cutoff: 901 } });
      TestBed.flushEffects();
      await wait(WRITE_DELAY_MS * 2);
      expect(sets.subtuneSettingsOf(holding)).toBeUndefined();

      store.setDeckRepeat({ slot: 'A', repeat: false });
      TestBed.flushEffects();
      await wait(WRITE_DELAY_MS);
      expect(keptFor(holding)).toEqual({ mixer: MAIN, speed: 1, repeat: false });
    });

    it('keeps the remembered speed of an open excursion, and nudges and holds not at all', async () => {
      const holding = await newRow();
      settle('A', holding);
      const save = vi.spyOn(sets, 'saveSubtuneSettings');

      speed.setFader('A', 1.2);
      reflectSpeed('A');
      TestBed.flushEffects();
      await wait(WRITE_DELAY_MS);
      expect(save).toHaveBeenCalledTimes(1);

      speed.jump('A', 'up');
      speed.setNudge('A', 'up', true, 0.05);
      reflectSpeed('A', voicesWith({ held: 0 }));
      TestBed.flushEffects();
      await wait(WRITE_DELAY_MS * 2);

      expect(save).toHaveBeenCalledTimes(1);
      expect(keptFor(holding)?.speed).toBe(1.2);
    });
  });

  describe('tracking', () => {
    it('is not re-run by a position sample, nor does one rebuild the set summary', async () => {
      const holding = await newRow();
      settle('A', holding);
      const kept = vi.spyOn(speed, 'keptSpeed');
      const summary = store.setCardSummary();
      const before = summary();
      kept.mockClear();

      for (let frame = 1; frame <= 5; frame++) {
        store.samplePosition({ slot: 'A', positionFrames: frame });
        TestBed.flushEffects();
      }

      expect(kept).not.toHaveBeenCalled();
      expect(summary()).toBe(before);
    });

    it("is not re-run for one deck by the other deck's write", async () => {
      const first = await newRow();
      const second = await newRow();
      settle('A', first);
      settle('B', second);
      const kept = vi.spyOn(speed, 'keptSpeed');
      kept.mockClear();

      store.setDeckPanel({ slot: 'A', patch: { cutoff: 150 } });
      TestBed.flushEffects();
      await wait(WRITE_DELAY_MS);
      TestBed.flushEffects();

      expect(keptFor(first)?.mixer.panel.cutoff).toBe(150);
      expect(kept.mock.calls.filter(([slot]) => slot === 'B')).toHaveLength(0);
    });

    it('installs its effects once however often it is asked', async () => {
      keeper.install();
      const holding = await newRow();
      settle('A', holding);
      const kept = vi.spyOn(speed, 'keptSpeed');

      store.setDeckPanel({ slot: 'A', patch: { cutoff: 150 } });
      TestBed.flushEffects();

      expect(kept).toHaveBeenCalledTimes(1);
    });
  });

  it('writes a bounded number of times when both decks hold one row and subtune, the row keeping the last change', async () => {
    const holding = await newRow();
    settle('A', holding);
    settle('B', holding);
    const save = vi.spyOn(sets, 'saveSubtuneSettings');

    store.setDeckPanel({ slot: 'A', patch: { cutoff: 100 } });
    TestBed.flushEffects();
    await wait(WRITE_DELAY_MS);
    store.setDeckPanel({ slot: 'B', patch: { cutoff: 200 } });
    TestBed.flushEffects();
    await wait(WRITE_DELAY_MS);
    await wait(WRITE_DELAY_MS * 2);

    expect(save).toHaveBeenCalledTimes(2);
    expect(keptFor(holding)?.mixer.panel.cutoff).toBe(200);
    expect(store.panel().A.cutoff).toBe(100);
    expect(store.panel().B.cutoff).toBe(200);
  });
});
