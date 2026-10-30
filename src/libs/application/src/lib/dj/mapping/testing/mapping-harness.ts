import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FakeClock, SID_REGISTER_COUNT } from '@sidablist/core';
import type { RegisterRecord, ReplayRunner } from '@sidablist/core';
import { InMemorySetStore, InMemoryTuneMemoryStore, createRow, createSet } from '@sidablist/tunes';
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
  PITCH_BEND_CENTRE,
  REGISTER_RECORDER_FACTORY,
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
  RegisterRecorder,
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

/** The play calls the harness's register record covers unless a spec says otherwise. */
export const RECORD_FRAMES = 6000;

/**
 * A register record of `frames` entries that names its own entry. Registers 5 and 6 (voice 1's
 * attack/decay and sustain/release) carry the entry index in two bytes: the output stage scales
 * only frequency bytes, so the index survives a held or stroked record, which a frequency would
 * not.
 */
export function indexedRecord(frames: number): RegisterRecord {
  const values = new Uint8Array(frames * SID_REGISTER_COUNT);
  for (let entry = 0; entry < frames; entry++) {
    values[entry * SID_REGISTER_COUNT + 5] = entry & 0xff;
    values[entry * SID_REGISTER_COUNT + 6] = (entry >> 8) & 0xff;
  }
  return {
    frames,
    values,
    retriggerEntries: new Uint32Array(0),
    retriggerRegisters: new Uint8Array(0),
    retriggerValues: new Uint8Array(0),
  };
}

/** The entry index an `indexedRecord` frame names, from the registers as written. */
export function entryIndexOf(written: Uint8Array): number {
  return written[5] | (written[6] << 8);
}

/** The recorder the harness hands every deck slot: it answers `answer` to every request, and
 *  remembers what it was asked. */
export interface FakeRegisterRecorder {
  /** What each request asked for, in order. */
  readonly requests: { readonly subtune: number; readonly frames: number }[];
  /** What `record` answers; null answers a failed scan. */
  answer: RegisterRecord | null;
}

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
  /** The frame clock each deck slot built, in build order: A then B. */
  readonly clocks: FakeClock[];
  readonly recorder: FakeRegisterRecorder;
  /** What `TUNE_RESOLVER.resolve` answers; unset it answers nothing. */
  readonly resolve: ReturnType<typeof vi.fn>;
  readonly alerts: { warning: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  readonly repository: { load: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  /** Puts a tune on the slot at a settled status, which is what makes its controls live. */
  makeShapeable(slot: Slot): void;
  /** Gives the slot `count` cue markers (ids `marker-0`…), with the one at `selectedIndex`
   *  selected, or none when it is null. The harness loads no tune into the engine, so a marker
   *  cannot be captured through `addMarker`. */
  seedMarkers(slot: Slot, count: number, selectedIndex?: number | null): void;
  /** Makes a current set of `count` rows (ids `row-0`…) with the one at `selectedIndex` selected, or
   *  none when it is null. */
  seedSetRows(count: number, selectedIndex?: number | null): void;
}

/**
 * The mapping TestBed: the real stores, services, engine and mappable controls over the real deck
 * runtime, with fakes only at the ports — the settings repository, MIDI access, the frame clock,
 * replay and register recorder factories, the alert service and the tune sources. `DeckBindings` is
 * the one non-port fake: nothing here binds a cartridge. Replays are refused unless a spec brings
 * a runner that answers them.
 */
export function setUpMappingHarness(
  settings: MidiSettingsRecord = EMPTY_SETTINGS,
  replay: ReplayRunner = {
    run: () => Promise.reject(new Error('no replay in this spec')),
    dispose: () => undefined,
  }
): MappingHarness {
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
  const clocks: FakeClock[] = [];
  const resolve = vi.fn();
  const recorder: FakeRegisterRecorder = { requests: [], answer: indexedRecord(RECORD_FRAMES) };

  TestBed.configureTestingModule({
    providers: [
      { provide: MIDI_SETTINGS_REPOSITORY, useValue: repository },
      { provide: ALERT_SERVICE, useValue: alerts },
      {
        provide: DeckBindings,
        useValue: { hydrate: vi.fn(), bindDevice: vi.fn(), enableMidi: vi.fn(), identify: vi.fn() },
      },
      {
        provide: FRAME_CLOCK_FACTORY,
        useValue: (): FakeClock => {
          const clock = new FakeClock();
          clocks.push(clock);
          return clock;
        },
      },
      { provide: REPLAY_RUNNER_FACTORY, useValue: (): ReplayRunner => replay },
      {
        provide: REGISTER_RECORDER_FACTORY,
        useValue: (): RegisterRecorder => ({
          record: async (_bytes, subtune, frames) => {
            recorder.requests.push({ subtune, frames });
            return recorder.answer;
          },
          dispose: () => undefined,
        }),
      },
      { provide: MIDI_ACCESS, useValue: midiAccess },
      { provide: MIDI_INPUT, useValue: midiInput },
      { provide: FILE_CONTENT_SERVICE, useValue: { getFileContent: vi.fn() } },
      { provide: TUNE_INSERTER, useValue: { insert: vi.fn() } },
      { provide: TUNE_RESOLVER, useValue: { resolve } },
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
    clocks,
    recorder,
    resolve,
    alerts,
    repository,
    makeShapeable: (slot) => {
      djStore.setDeckLoaded({ slot, reference: TUNE });
      djStore.setDeckStatus({ slot, status: 'paused' });
    },
    seedSetRows: (count, selectedIndex = 0) => {
      const rows = Array.from({ length: count }, (_, index) =>
        createRow({
          id: `row-${index}`,
          tune: {
            sidHash: `hash-${index}`,
            title: `Tune ${index}`,
            author: 'Author',
            released: '',
            subtuneCount: 1,
            byteLength: 1,
          },
          memory: null,
          startSubtune: 1,
        })
      );
      const set = {
        ...createSet({ id: 'set-1', placeholder: 'Set 1', now: '2026-01-01T00:00:00.000Z' }),
        rows,
      };
      djStore.setSetsLibrary({ summaries: [], current: set });
      djStore.putOpenSet({ set });
      djStore.selectSetRow({ rowId: rows[selectedIndex ?? -1]?.id ?? null, turned: false });
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
        wraps: false,
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
  controllerId = LAUNCH_CONTROL,
  timeStampMs = 0
): SourceEvent {
  return { ...ccSource(number, channel, controllerId), value, pressed: value >= 64, timeStampMs };
}

/** A note message; velocity 0 is the release. */
export function note(
  number: number,
  velocity: number,
  channel = 1,
  controllerId = LAUNCH_CONTROL,
  timeStampMs = 0
): SourceEvent {
  return {
    ...noteSource(number, channel, controllerId),
    value: velocity,
    pressed: velocity > 0,
    timeStampMs,
  };
}

export function pitchBendSource(channel = 1, controllerId = LAUNCH_CONTROL): MidiSource {
  return { controllerId, channel, kind: 'pitch-bend', number: 0 };
}

/** A pitch bend message (0–16383); it reads as a finger down anywhere but centre. */
export function pitchBend(
  value: number,
  timeStampMs = 0,
  channel = 1,
  controllerId = LAUNCH_CONTROL
): SourceEvent {
  return {
    ...pitchBendSource(channel, controllerId),
    value,
    pressed: value !== PITCH_BEND_CENTRE,
    timeStampMs,
  };
}
