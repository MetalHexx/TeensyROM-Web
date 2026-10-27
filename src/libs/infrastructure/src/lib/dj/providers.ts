import { inject, Provider } from '@angular/core';
import { createWorkerReplayRunner } from '@sidablist/core';
import type { FrameClock, ReplayRunner } from '@sidablist/core';
import { createTuneInserter, createTuneResolver } from '@sidablist/tunes';
import { API_CONFIG, type IApiConfig } from '@teensyrom-nx/domain';
import {
  Configuration,
  DjLibraryApiService,
  MidiSettingsApiService,
} from '@teensyrom-nx/data-access/api-client';
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
} from '@teensyrom-nx/application';
import { IndexedDbTuneStore } from './database';
import { ApiDjLibraryStateRepository, ApiSetStore, ApiTuneMemoryStore } from './dj-library';
import { ApiMidiSettingsRepository } from './midi-settings';
import { WorkerTuneIndexer } from './analysis/worker-tune-indexer';
import { MidiAccessService } from './midi/midi-access.service';
import { MidiInputService } from './midi/midi-input.service';
import { ScriptProcessorFrameClock } from './clock/script-processor-frame-clock';

/**
 * API Client provider for the MIDI settings API.
 * Configures the MidiSettingsApiService with the backend base URL.
 */
export const MIDI_SETTINGS_API_CLIENT_PROVIDER = {
  provide: MidiSettingsApiService,
  useFactory: (apiConfig: IApiConfig) => {
    const config = new Configuration({ basePath: apiConfig.basePath });
    return new MidiSettingsApiService(config);
  },
  deps: [API_CONFIG],
};

/**
 * API Client provider for the DJ library API.
 * Configures the DjLibraryApiService with the backend base URL.
 */
export const DJ_LIBRARY_API_CLIENT_PROVIDER = {
  provide: DjLibraryApiService,
  useFactory: (apiConfig: IApiConfig) => {
    const config = new Configuration({ basePath: apiConfig.basePath });
    return new DjLibraryApiService(config);
  },
  deps: [API_CONFIG],
};

/**
 * Provider configuration for DJ storage infrastructure: the MIDI settings set, and the DJ library
 * (sets, tune memory and which set is current), all kept on the server.
 *
 * `IndexedDbTuneStore` is deliberately not bound here: no application code injects a `TuneStore`
 * directly — it is composed into the tunes inserter and resolver below, and those two are what the
 * application injects. It stays a `providedIn: 'root'` class for that composition.
 */
export const DJ_STORAGE_PROVIDERS: Provider[] = [
  MIDI_SETTINGS_API_CLIENT_PROVIDER,
  { provide: MIDI_SETTINGS_REPOSITORY, useClass: ApiMidiSettingsRepository },
  DJ_LIBRARY_API_CLIENT_PROVIDER,
  { provide: SET_STORE, useClass: ApiSetStore },
  { provide: TUNE_MEMORY_STORE, useClass: ApiTuneMemoryStore },
  { provide: DJ_LIBRARY_STATE_REPOSITORY, useClass: ApiDjLibraryStateRepository },
];

/**
 * Provider configuration for the DJ engine's browser adapters: Web MIDI access, and the two
 * per-deck-slot factories a deck builds its own clock and its own replay threads from. Two frame
 * clocks and four replay workers is the design, not something to hoist "for efficiency" — a deck
 * slot calls the replay factory twice, one worker for jumps and one for prepared builds, and
 * builds its own audio graph, none of it shared with another slot.
 *
 * Also composes the two tunes ports the application injects, over `IndexedDbTuneStore` and a
 * worker-backed `TuneIndexer` — `analysis` is reachable only through `WorkerTuneIndexer`, never
 * from application code.
 */
export const DJ_ENGINE_PROVIDERS: Provider[] = [
  { provide: MIDI_ACCESS, useExisting: MidiAccessService },
  { provide: MIDI_INPUT, useExisting: MidiInputService },
  { provide: FRAME_CLOCK_FACTORY, useValue: (): FrameClock => new ScriptProcessorFrameClock() },
  {
    provide: REPLAY_RUNNER_FACTORY,
    useValue: (): ReplayRunner =>
      createWorkerReplayRunner(
        () =>
          new Worker(new URL('./workers/core-replay.worker', import.meta.url), {
            type: 'module',
          })
      ),
  },
  { provide: TUNE_INSERTER, useFactory: () => createTuneInserter(inject(IndexedDbTuneStore)) },
  {
    provide: TUNE_RESOLVER,
    useFactory: () => createTuneResolver(inject(IndexedDbTuneStore), inject(WorkerTuneIndexer)),
  },
];
