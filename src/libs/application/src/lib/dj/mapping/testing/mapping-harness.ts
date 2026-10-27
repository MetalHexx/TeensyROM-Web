import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FakeClock } from '@sidablist/core';
import type { ReplayRunner } from '@sidablist/core';
import { InMemorySetStore, InMemoryTuneMemoryStore } from '@sidablist/tunes';
import type { TuneReference } from '@sidablist/tunes';
import { ALERT_SERVICE, FILE_CONTENT_SERVICE, type Device } from '@teensyrom-nx/domain';
import { DeviceStore } from '../../../device/device-store';
import { DeckBindings } from '../../deck-bindings';
import { DeckService } from '../../deck.service';
import { DjStore, EMPTY_DECK_LOOPS } from '../../dj-store';
import { MidiSettingsPersistence } from '../../midi-settings-persistence';
import { MixerService } from '../../mixer.service';
import {
  DJ_LIBRARY_STATE_REPOSITORY,
  FRAME_CLOCK_FACTORY,
  MIDI_ACCESS,
  MIDI_INPUT,
  MIDI_SETTINGS_REPOSITORY,
  REPLAY_RUNNER_FACTORY,
  SET_STORE,
  TUNE_INSERTER,
  TUNE_MEMORY_STORE,
  TUNE_RESOLVER,
} from '../../ports';
import type {
  IMidiAccess,
  MidiAccessState,
  MidiPermission,
  MidiPortOption,
  MidiSettingsRecord,
} from '../../ports';
import type { Slot } from '../../slot';
import { MappableControls } from '../mappable-controls';
import { FakeMidiInput } from './fake-midi-input';
import type { MidiSource, SourceEvent } from '../mapping.models';
import { MidiControllers } from '../midi-controllers';
import { MidiInputRouter } from '../midi-input-router';
import { MidiLearn } from '../midi-learn';
import { MidiMappingEngine } from '../midi-mapping-engine';
import { MidiMappingStore } from '../midi-mapping-store';
import { MidiMappings } from '../midi-mappings';

export const EMPTY_SETTINGS: MidiSettingsRecord = {
  controllers: [],
  mappings: [],
  deckBindings: [],
};

const TUNE: TuneReference = {
  identity: { sidHash: 'hash-1', subtune: 1 },
  title: 'Test Tune',
  author: 'Test Author',
  released: '2024 Test',
  subtuneCount: 3,
  byteLength: 1234,
};

export interface MappingHarness {
  readonly djStore: InstanceType<typeof DjStore>;
  readonly mappingStore: InstanceType<typeof MidiMappingStore>;
  readonly controls: MappableControls;
  readonly engine: MidiMappingEngine;
  readonly mappings: MidiMappings;
  readonly deckService: DeckService;
  readonly mixerService: MixerService;
  readonly persistence: MidiSettingsPersistence;
  readonly controllers: MidiControllers;
  readonly learn: MidiLearn;
  readonly router: MidiInputRouter;
  readonly midiInput: FakeMidiInput;
  readonly accessState: WritableSignal<MidiAccessState>;
  readonly requestAccess: ReturnType<typeof vi.fn>;
  readonly alerts: { warning: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  readonly repository: { load: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  /** Puts a tune on the slot at a settled status, which is what makes its controls live. */
  makeShapeable(slot: Slot): void;
  /** Gives the slot `count` cue markers (ids `marker-0`…), with the one at `selectedIndex`
   *  selected, or none when it is null. The harness loads no tune into the engine, so a marker
   *  cannot be captured through `addMarker`. */
  seedMarkers(slot: Slot, count: number, selectedIndex?: number | null): void;
}

/**
 * The mapping TestBed: the real stores, services, engine and mappable controls over the real deck
 * runtime, with fakes only at the ports — the settings repository, MIDI access, the frame clock and
 * replay factories, the alert service and the tune sources. `DeckBindings` is the one non-port
 * fake: nothing here binds a cartridge.
 */
export function setUpMappingHarness(settings: MidiSettingsRecord = EMPTY_SETTINGS): MappingHarness {
  const repository = {
    load: vi.fn().mockResolvedValue(settings),
    save: vi.fn().mockResolvedValue(undefined),
  };
  const midiInput = new FakeMidiInput();
  const alerts = { warning: vi.fn(), error: vi.fn() };
  const accessState = signal<MidiAccessState>('granted');
  const requestAccess = vi.fn(async (): Promise<void> => accessState.set('granted'));
  const midiAccess: IMidiAccess = {
    accessState,
    ports: signal<readonly MidiPortOption[]>([]),
    lastError: signal<string | null>(null),
    queryPermission: (): Promise<MidiPermission> => Promise.resolve('granted'),
    requestAccess,
    holderOf: (): string | null => null,
    claim: (): boolean => true,
    release: (): void => undefined,
    outputPortFor: () => null,
  };
  const idleReplay: ReplayRunner = {
    run: () => Promise.reject(new Error('no replay in this spec')),
    dispose: () => undefined,
  };

  TestBed.configureTestingModule({
    providers: [
      { provide: MIDI_SETTINGS_REPOSITORY, useValue: repository },
      { provide: ALERT_SERVICE, useValue: alerts },
      {
        provide: DeckBindings,
        useValue: { hydrate: vi.fn(), bindDevice: vi.fn(), enableMidi: vi.fn(), identify: vi.fn() },
      },
      { provide: FRAME_CLOCK_FACTORY, useValue: (): FakeClock => new FakeClock() },
      { provide: REPLAY_RUNNER_FACTORY, useValue: (): ReplayRunner => idleReplay },
      { provide: MIDI_ACCESS, useValue: midiAccess },
      { provide: MIDI_INPUT, useValue: midiInput },
      { provide: FILE_CONTENT_SERVICE, useValue: { getFileContent: vi.fn() } },
      { provide: TUNE_INSERTER, useValue: { insert: vi.fn() } },
      { provide: TUNE_RESOLVER, useValue: { resolve: vi.fn() } },
      { provide: SET_STORE, useFactory: () => new InMemorySetStore() },
      { provide: TUNE_MEMORY_STORE, useFactory: () => new InMemoryTuneMemoryStore() },
      {
        provide: DJ_LIBRARY_STATE_REPOSITORY,
        useValue: { load: vi.fn().mockResolvedValue(null), save: vi.fn().mockResolvedValue(undefined) },
      },
      { provide: DeviceStore, useValue: { usableDevices: signal<Device[]>([]) } },
    ],
  });

  const djStore = TestBed.inject(DjStore);
  return {
    djStore,
    mappingStore: TestBed.inject(MidiMappingStore),
    controls: TestBed.inject(MappableControls),
    engine: TestBed.inject(MidiMappingEngine),
    mappings: TestBed.inject(MidiMappings),
    deckService: TestBed.inject(DeckService),
    mixerService: TestBed.inject(MixerService),
    persistence: TestBed.inject(MidiSettingsPersistence),
    controllers: TestBed.inject(MidiControllers),
    learn: TestBed.inject(MidiLearn),
    router: TestBed.inject(MidiInputRouter),
    midiInput,
    accessState,
    requestAccess,
    alerts,
    repository,
    makeShapeable: (slot) => {
      djStore.setDeckLoaded({ slot, reference: TUNE });
      djStore.setDeckStatus({ slot, status: 'paused' });
    },
    seedMarkers: (slot, count, selectedIndex = 0) => {
      const markers = Array.from({ length: count }, (_, index) => ({
        id: `marker-${index}`,
        name: null,
        start: { frame: index * 100, offsetFrames: 0 },
        end: null,
        voices: [],
        settings: null,
        ownSettings: false,
        ready: true,
      }));
      djStore.setDeckLoops({
        slot,
        loops: {
          ...EMPTY_DECK_LOOPS,
          markers,
          selectedId: markers[selectedIndex ?? -1]?.id ?? null,
        },
      });
    },
  };
}

export const LAUNCH_CONTROL = 'launch-control';

export function ccSource(number: number, channel = 1, controllerId = LAUNCH_CONTROL): MidiSource {
  return { controllerId, channel, kind: 'cc', number };
}

export function noteSource(number: number, channel = 1, controllerId = LAUNCH_CONTROL): MidiSource {
  return { controllerId, channel, kind: 'note', number };
}

/** A CC message; it reads as a key down from 64 up. */
export function cc(
  number: number,
  value: number,
  channel = 1,
  controllerId = LAUNCH_CONTROL
): SourceEvent {
  return { ...ccSource(number, channel, controllerId), value, pressed: value >= 64 };
}

/** A note message; velocity 0 is the release. */
export function note(
  number: number,
  velocity: number,
  channel = 1,
  controllerId = LAUNCH_CONTROL
): SourceEvent {
  return { ...noteSource(number, channel, controllerId), value: velocity, pressed: velocity > 0 };
}
