import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ALERT_SERVICE } from '@teensyrom-nx/domain';
import { DjStore } from './dj-store';
import { MidiSettingsPersistence } from './midi-settings-persistence';
import { MidiMappingStore } from './mapping/midi-mapping-store';
import { MIDI_SETTINGS_REPOSITORY } from './ports';
import type { IMidiSettingsRepository, MidiSettingsRecord } from './ports';

const SERVER_SET: MidiSettingsRecord = {
  controllers: [{ id: 'launchpad', name: 'Launchpad', lastPortId: 'p1', listening: true }],
  mappings: [
    {
      id: 'm1',
      source: { controllerId: 'launchpad', channel: 1, kind: 'cc', number: 7 },
      owner: 'A',
      control: 'speed',
      style: { kind: 'absolute', amount: null },
    },
  ],
  deckBindings: [{ slot: 'B', deviceId: '19277260', lastSeenName: 'TR-2' }],
};

/** Resolves the next pending call when asked, so a test decides exactly when a request settles. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('MidiSettingsPersistence', () => {
  let persistence: MidiSettingsPersistence;
  let store: InstanceType<typeof DjStore>;
  let repository: { load: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let alertService: { warning: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  function configure(): void {
    TestBed.resetTestingModule();
    repository = {
      load: vi.fn().mockResolvedValue(SERVER_SET),
      save: vi.fn().mockResolvedValue(undefined),
    };
    alertService = { warning: vi.fn(), error: vi.fn() };
    const typed: Partial<IMidiSettingsRepository> = repository;
    TestBed.configureTestingModule({
      providers: [
        MidiSettingsPersistence,
        DjStore,
        { provide: MIDI_SETTINGS_REPOSITORY, useValue: typed },
        { provide: ALERT_SERVICE, useValue: alertService },
      ],
    });
    persistence = TestBed.inject(MidiSettingsPersistence);
    store = TestBed.inject(DjStore);
  }

  function bind(slot: 'A' | 'B', id: string, name: string): void {
    store.setBinding({
      slot,
      binding: { device: { id, name }, portId: null, present: false, error: null },
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    configure();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('load', () => {
    it('fetches once and hands every caller the same promise', async () => {
      const first = persistence.load();
      const second = persistence.load();

      expect(second).toBe(first);
      expect(await first).toEqual(SERVER_SET);
      expect(repository.load).toHaveBeenCalledTimes(1);
    });

    it('resolves an empty set and warns once when the fetch fails', async () => {
      repository.load.mockRejectedValue(new Error('offline'));

      const settings = await persistence.load();

      expect(settings).toEqual({ controllers: [], mappings: [], deckBindings: [] });
      expect(alertService.warning).toHaveBeenCalledTimes(1);
    });

    it('sends no save for the rest of the session after a failed load', async () => {
      repository.load.mockRejectedValue(new Error('offline'));
      await persistence.load();
      bind('A', '14470230', 'TR-1');

      persistence.scheduleSave();
      await vi.advanceTimersByTimeAsync(1000);

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('snapshot', () => {
    it('takes deck bindings from the store, one per slot with a device', async () => {
      await persistence.load();
      bind('A', '14470230', 'TR-1');

      expect(persistence.snapshot().deckBindings).toEqual([
        { slot: 'A', deviceId: '14470230', lastSeenName: 'TR-1' },
      ]);
    });

    it('passes controllers and mappings through exactly as loaded', async () => {
      await persistence.load();

      const snapshot = persistence.snapshot();

      expect(snapshot.controllers).toEqual(SERVER_SET.controllers);
      expect(snapshot.mappings).toEqual(SERVER_SET.mappings);
    });

    it('takes controllers and mappings from the mapping store once it has loaded them', async () => {
      await persistence.load();
      const source = { controllerId: 'pad', channel: 2, kind: 'note', number: 36 } as const;
      const controller = { id: 'pad', name: 'Pad', lastPortId: null, listening: false };
      TestBed.inject(MidiMappingStore).setMidiMappingData({
        controllers: [controller],
        mappings: [
          {
            id: 'm9',
            source,
            control: { owner: 'B', control: 'speed' },
            style: { kind: 'step', amount: 0.1 },
          },
        ],
      });

      const snapshot = persistence.snapshot();

      expect(snapshot.controllers).toEqual([controller]);
      expect(snapshot.mappings).toEqual([
        { id: 'm9', source, owner: 'B', control: 'speed', style: { kind: 'step', amount: 0.1 } },
      ]);
    });

    it('cuts a last seen name to 128 characters', async () => {
      await persistence.load();
      bind('A', '14470230', 'N'.repeat(300));

      expect(persistence.snapshot().deckBindings[0].lastSeenName).toHaveLength(128);
    });
  });

  describe('scheduleSave', () => {
    beforeEach(async () => {
      await persistence.load();
      bind('A', '14470230', 'TR-1');
    });

    it('sends one save of the whole set after 300 ms, however many requests came before', async () => {
      persistence.scheduleSave();
      await vi.advanceTimersByTimeAsync(200);
      persistence.scheduleSave();
      await vi.advanceTimersByTimeAsync(200);
      expect(repository.save).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(100);

      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(repository.save).toHaveBeenCalledWith({
        controllers: SERVER_SET.controllers,
        mappings: SERVER_SET.mappings,
        deckBindings: [{ slot: 'A', deviceId: '14470230', lastSeenName: 'TR-1' }],
      });
    });

    it('runs saves one at a time and sends the latest snapshot after the one in flight', async () => {
      const inFlight = deferred();
      repository.save.mockReturnValueOnce(inFlight.promise);
      persistence.scheduleSave();
      await vi.advanceTimersByTimeAsync(300);
      expect(repository.save).toHaveBeenCalledTimes(1);

      bind('B', '19277260', 'TR-2');
      persistence.scheduleSave();
      await vi.advanceTimersByTimeAsync(1000);
      expect(repository.save).toHaveBeenCalledTimes(1);

      inFlight.resolve();
      await vi.advanceTimersByTimeAsync(0);

      expect(repository.save).toHaveBeenCalledTimes(2);
      expect(repository.save.mock.calls[1][0].deckBindings).toEqual([
        { slot: 'A', deviceId: '14470230', lastSeenName: 'TR-1' },
        { slot: 'B', deviceId: '19277260', lastSeenName: 'TR-2' },
      ]);
    });

    it('raises one error per failed save and never throws to the caller', async () => {
      repository.save.mockRejectedValue(new Error('500'));

      expect(() => persistence.scheduleSave()).not.toThrow();
      await vi.advanceTimersByTimeAsync(300);
      expect(alertService.error).toHaveBeenCalledTimes(1);

      persistence.scheduleSave();
      await vi.advanceTimersByTimeAsync(300);
      expect(alertService.error).toHaveBeenCalledTimes(2);
    });

    it('still saves later after a failed save', async () => {
      repository.save.mockRejectedValueOnce(new Error('500'));
      persistence.scheduleSave();
      await vi.advanceTimersByTimeAsync(300);

      persistence.scheduleSave();
      await vi.advanceTimersByTimeAsync(300);

      expect(repository.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('when the page is hidden', () => {
    const pagehide = (): void => {
      window.dispatchEvent(new Event('pagehide'));
    };

    beforeEach(async () => {
      await persistence.load();
      bind('A', '14470230', 'TR-1');
    });

    it('saves a pending change at once with keepalive, and the debounce does not send it again', async () => {
      persistence.scheduleSave();
      await vi.advanceTimersByTimeAsync(100);

      pagehide();

      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(repository.save).toHaveBeenCalledWith(
        {
          controllers: SERVER_SET.controllers,
          mappings: SERVER_SET.mappings,
          deckBindings: [{ slot: 'A', deviceId: '14470230', lastSeenName: 'TR-1' }],
        },
        { keepalive: true }
      );
      await vi.advanceTimersByTimeAsync(1000);
      expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('sends the mapping set without a mapping deleted inside the debounce window', async () => {
      TestBed.inject(MidiMappingStore).setMidiMappingData({
        controllers: [...SERVER_SET.controllers],
        mappings: [],
      });
      persistence.scheduleSave();

      pagehide();

      expect(repository.save.mock.calls[0][0].mappings).toEqual([]);
      expect(repository.save.mock.calls[0][1]).toEqual({ keepalive: true });
    });

    it('re-sends the latest snapshot with keepalive while a save is in flight', async () => {
      repository.save.mockReturnValueOnce(deferred().promise);
      persistence.scheduleSave();
      await vi.advanceTimersByTimeAsync(300);
      expect(repository.save).toHaveBeenCalledTimes(1);
      bind('B', '19277260', 'TR-2');

      pagehide();

      expect(repository.save).toHaveBeenCalledTimes(2);
      expect(repository.save.mock.calls[1][0].deckBindings).toHaveLength(2);
      expect(repository.save.mock.calls[1][1]).toEqual({ keepalive: true });
    });

    it('sends nothing when nothing is pending and nothing is in flight', async () => {
      pagehide();
      expect(repository.save).not.toHaveBeenCalled();

      persistence.scheduleSave();
      await vi.advanceTimersByTimeAsync(300);
      expect(repository.save).toHaveBeenCalledTimes(1);

      pagehide();
      expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('sends nothing after the service is destroyed', () => {
      persistence.scheduleSave();
      TestBed.resetTestingModule();

      pagehide();

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('when the page is hidden before a good load', () => {
    const pagehide = (): void => {
      window.dispatchEvent(new Event('pagehide'));
    };

    it('sends nothing after a failed load', async () => {
      repository.load.mockRejectedValue(new Error('offline'));
      await persistence.load();
      bind('A', '14470230', 'TR-1');
      persistence.scheduleSave();

      pagehide();

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('sends nothing while the load has not settled', async () => {
      repository.load.mockReturnValue(deferred<MidiSettingsRecord>().promise);
      void persistence.load();
      bind('A', '14470230', 'TR-1');
      persistence.scheduleSave();

      pagehide();

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  it('waits for an unfinished load before saving, so the pass-through is never lost', async () => {
    const loading = deferred<MidiSettingsRecord>();
    repository.load.mockReturnValue(loading.promise);
    bind('A', '14470230', 'TR-1');

    persistence.scheduleSave();
    await vi.advanceTimersByTimeAsync(300);
    expect(repository.save).not.toHaveBeenCalled();

    loading.resolve(SERVER_SET);
    await vi.advanceTimersByTimeAsync(0);

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save.mock.calls[0][0].controllers).toEqual(SERVER_SET.controllers);
    expect(repository.save.mock.calls[0][0].mappings).toEqual(SERVER_SET.mappings);
  });
});
