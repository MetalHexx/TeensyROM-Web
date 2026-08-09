import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { updateState } from '@angular-architects/ngrx-toolkit';
import {
  LaunchMode,
  PlayerStatus,
  PLAYER_SERVICE,
  PlayerScope,
  PlayerFilterType,
  DEVICE_SERVICE,
} from '@teensyrom-nx/domain';
import { DEFAULT_TIMER_MS } from '../player.constants';
import { PlayerStore, PlayerState } from '../player-store';
import { WritableStore } from '../player-helpers';
import { PLAYER_STORAGE } from '../player-storage.interface';

describe('reflectTransferStopped', () => {
  let store: WritableStore<PlayerState>;
  let mockDeviceService: { resetDevice: ReturnType<typeof vi.fn> };
  const deviceId = 'test-device-1';

  beforeEach(() => {
    mockDeviceService = {
      resetDevice: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        PlayerStore,
        { provide: PLAYER_SERVICE, useValue: {} },
        { provide: DEVICE_SERVICE, useValue: mockDeviceService },
        { provide: PLAYER_STORAGE, useValue: { save: vi.fn(), load: vi.fn(), hasSavedState: vi.fn(), clear: vi.fn() } },
      ],
    });

    store = TestBed.inject(PlayerStore) as unknown as WritableStore<PlayerState>;

    updateState(store, 'test-init-player', (state) => ({
      players: {
        ...state.players,
        [deviceId]: {
          deviceId,
          status: PlayerStatus.Playing,
          launchMode: LaunchMode.Directory,
          currentFile: { file: { name: 'song.sid' } } as unknown as PlayerState['players'][string]['currentFile'],
          fileContext: null,
          shuffleSettings: {
            scope: PlayerScope.Storage,
            filter: PlayerFilterType.All,
            startingDirectory: '/',
          },
          playHistory: null,
          historyViewVisible: false,
          playTimerConfig: {
            enabled: true,
            durationMs: 60000,
          },
          isLoading: false,
          lastUpdated: null,
          error: null,
        },
      },
    }));
  });

  it('writes stopped status, clears error, and stamps lastUpdated', () => {
    (store as unknown as InstanceType<typeof PlayerStore>).reflectTransferStopped({ deviceId });

    const playerState = store.players()[deviceId];
    expect(playerState.status).toBe(PlayerStatus.Stopped);
    expect(playerState.error).toBeNull();
    expect(playerState.lastUpdated).not.toBeNull();
  });

  it('leaves the rest of the device player state untouched', () => {
    (store as unknown as InstanceType<typeof PlayerStore>).reflectTransferStopped({ deviceId });

    const playerState = store.players()[deviceId];
    expect(playerState.currentFile).not.toBeNull();
    expect(playerState.launchMode).toBe(LaunchMode.Directory);
  });

  it('never calls the device service', () => {
    (store as unknown as InstanceType<typeof PlayerStore>).reflectTransferStopped({ deviceId });

    expect(mockDeviceService.resetDevice).not.toHaveBeenCalled();
  });

  it('creates a full default player entry when none existed for the device', () => {
    const unseenDeviceId = 'device-with-no-player-entry';
    expect(store.players()[unseenDeviceId]).toBeUndefined();

    (store as unknown as InstanceType<typeof PlayerStore>).reflectTransferStopped({
      deviceId: unseenDeviceId,
    });

    const playerState = store.players()[unseenDeviceId];
    expect(playerState).toBeDefined();
    expect(playerState.deviceId).toBe(unseenDeviceId);
    expect(playerState.status).toBe(PlayerStatus.Stopped);
    expect(playerState.error).toBeNull();
    expect(playerState.lastUpdated).not.toBeNull();
    expect(playerState.launchMode).toBe(LaunchMode.Directory);
    expect(playerState.currentFile).toBeNull();
    expect(playerState.fileContext).toBeNull();
    expect(playerState.playHistory).toBeNull();
    expect(playerState.historyViewVisible).toBe(false);
    expect(playerState.isLoading).toBe(false);
    expect(playerState.shuffleSettings).toEqual({
      scope: PlayerScope.Storage,
      filter: PlayerFilterType.All,
      startingDirectory: undefined,
    });
    expect(playerState.playTimerConfig).toEqual({
      enabled: false,
      durationMs: DEFAULT_TIMER_MS,
    });
  });
});
