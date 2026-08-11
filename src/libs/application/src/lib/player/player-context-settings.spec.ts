import { describe, it, expect, beforeEach } from 'vitest';
import { updateState } from '@angular-architects/ngrx-toolkit';
import type { StateSignals, WritableStateSource } from '@ngrx/signals';
import { PlayerFilterType } from '@teensyrom-nx/domain';
import type { Settings } from '@teensyrom-nx/domain';
import { createPlayerHarness, type PlayerHarness } from './testing/player-context-harness';
import type { SettingsState } from '../settings/settings-state.interface';

type WritableSettingsStore = StateSignals<SettingsState> & WritableStateSource<SettingsState>;

const createTestSettings = (overrides: Partial<Settings['playerSettings']> = {}): Settings => ({
  playerSettings: {
    repeatModeOnStartup: false,
    playTimerEnabled: false,
    muteFastForward: false,
    muteRandomSeek: false,
    startupFilter: PlayerFilterType.All,
    startupLaunchEnabled: false,
    startupLaunchRandom: false,
    ...overrides,
  },
  fileTransferSettings: {
    watchDirectoryLocation: '',
    autoTransferPath: '',
    autoFileCopyEnabled: false,
    autoLaunchOnCopyEnabled: false,
    navToDirOnLaunch: false,
    syncFilesEnabled: false,
  },
  searchSettings: {
    weights: {
      nameWeight: 1,
      titleWeight: 1,
      creatorWeight: 1,
      releaseInfoWeight: 1,
      descriptionWeight: 1,
    },
    stopWords: [],
    bannedDirectories: [],
    bannedFiles: [],
  },
  appSettings: { setupCompleted: false },
  knownDevices: [],
});

describe('PlayerContextService - settings-driven initialization', () => {
  let harness: PlayerHarness;
  const deviceId = 'device-settings';

  beforeEach(() => {
    harness = createPlayerHarness();
  });

  // initializePlayer reads settings synchronously at call time, so settings must be seeded
  // into the real SettingsStore before initializePlayer runs.
  const seedSettings = (settings: Settings | null) => {
    updateState(
      harness.settingsStore as unknown as WritableSettingsStore,
      'test-seed-settings',
      (state) => ({ ...state, settings })
    );
  };

  it('applies the settings-derived startup filter and play-timer flag together', () => {
    seedSettings(createTestSettings({ startupFilter: PlayerFilterType.Games, playTimerEnabled: true }));

    harness.service.initializePlayer(deviceId);

    expect(harness.service.getShuffleSettings(deviceId)()?.filter).toBe(PlayerFilterType.Games);
    expect(harness.service.getPlayTimerConfig(deviceId)()?.enabled).toBe(true);
  });

  it('falls back to the All filter and a disabled timer when settings are null', () => {
    seedSettings(null);

    harness.service.initializePlayer(deviceId);

    expect(harness.service.getShuffleSettings(deviceId)()?.filter).toBe(PlayerFilterType.All);
    expect(harness.service.getPlayTimerConfig(deviceId)()?.enabled).toBe(false);
  });

  it('falls back to the All filter and a disabled timer when playerSettings is missing', () => {
    seedSettings({ playerSettings: undefined } as unknown as Settings);

    harness.service.initializePlayer(deviceId);

    expect(harness.service.getShuffleSettings(deviceId)()?.filter).toBe(PlayerFilterType.All);
    expect(harness.service.getPlayTimerConfig(deviceId)()?.enabled).toBe(false);
  });

  it.each([PlayerFilterType.Games, PlayerFilterType.Music, PlayerFilterType.Hex, PlayerFilterType.Images])(
    'applies a %s startup filter',
    (startupFilter) => {
      seedSettings(createTestSettings({ startupFilter, playTimerEnabled: true }));

      harness.service.initializePlayer(deviceId);

      expect(harness.service.getShuffleSettings(deviceId)()?.filter).toBe(startupFilter);
    }
  );

  it('gives each device its own initialization call carrying the same settings-derived filter', () => {
    seedSettings(createTestSettings({ startupFilter: PlayerFilterType.Games, playTimerEnabled: true }));

    harness.service.initializePlayer('device-a');
    harness.service.initializePlayer('device-b');

    expect(harness.service.getShuffleSettings('device-a')()?.filter).toBe(PlayerFilterType.Games);
    expect(harness.service.getShuffleSettings('device-b')()?.filter).toBe(PlayerFilterType.Games);
    expect(harness.service.getPlayTimerConfig('device-a')()?.enabled).toBe(true);
    expect(harness.service.getPlayTimerConfig('device-b')()?.enabled).toBe(true);
  });

  it('does not reset a manually changed filter when the device is re-initialized', () => {
    seedSettings(createTestSettings({ startupFilter: PlayerFilterType.Games }));
    harness.service.initializePlayer(deviceId);
    harness.service.setFilterMode(deviceId, PlayerFilterType.Music);

    harness.service.initializePlayer(deviceId);

    expect(harness.service.getShuffleSettings(deviceId)()?.filter).toBe(PlayerFilterType.Music);
  });
});
