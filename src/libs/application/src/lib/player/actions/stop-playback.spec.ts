import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Subject, throwError } from 'rxjs';
import { updateState } from '@angular-architects/ngrx-toolkit';
import {
  LaunchMode,
  PlayerStatus,
  PLAYER_SERVICE,
  PlayerScope,
  PlayerFilterType,
  DEVICE_SERVICE,
} from '@teensyrom-nx/domain';
import { PlayerStore, PlayerState } from '../player-store';
import { WritableStore } from '../player-helpers';
import { PLAYER_STORAGE } from '../player-storage.interface';

describe('stopPlayback', () => {
  let store: WritableStore<PlayerState>;
  let mockDeviceService: { resetDevice: ReturnType<typeof vi.fn> };
  const deviceId = 'test-device-1';

  const stopPlayback = () =>
    (store as unknown as InstanceType<typeof PlayerStore>).stopPlayback({ deviceId });

  beforeEach(() => {
    mockDeviceService = {
      resetDevice: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        PlayerStore,
        { provide: PLAYER_SERVICE, useValue: {} },
        { provide: DEVICE_SERVICE, useValue: mockDeviceService },
        {
          provide: PLAYER_STORAGE,
          useValue: { save: vi.fn(), load: vi.fn(), hasSavedState: vi.fn(), clear: vi.fn() },
        },
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
          currentFile: {
            file: { name: 'game.prg' },
          } as unknown as PlayerState['players'][string]['currentFile'],
          fileContext: null,
          shuffleSettings: {
            scope: PlayerScope.Storage,
            filter: PlayerFilterType.All,
            startingDirectory: '/',
          },
          playHistory: null,
          historyViewVisible: false,
          playTimerConfig: {
            enabled: false,
            durationMs: 60000,
          },
          isLoading: false,
          isStopping: false,
          lastUpdated: null,
          error: null,
        },
      },
    }));
  });

  it('flags the device as stopping while the reset is in flight, then stops and clears it', async () => {
    const reset = new Subject<void>();
    mockDeviceService.resetDevice.mockReturnValue(reset.asObservable());

    const stopping = stopPlayback();

    expect(store.players()[deviceId].isStopping).toBe(true);
    expect(store.players()[deviceId].status).toBe(PlayerStatus.Playing);

    reset.next();
    reset.complete();
    await stopping;

    const playerState = store.players()[deviceId];
    expect(playerState.isStopping).toBe(false);
    expect(playerState.status).toBe(PlayerStatus.Stopped);
    expect(playerState.error).toBeNull();
    expect(mockDeviceService.resetDevice).toHaveBeenCalledWith(deviceId);
  });

  it('keeps the prior status, clears the stopping flag and records the error when the reset fails', async () => {
    mockDeviceService.resetDevice.mockReturnValue(throwError(() => new Error('Reset failed')));

    await stopPlayback();

    const playerState = store.players()[deviceId];
    expect(playerState.isStopping).toBe(false);
    expect(playerState.status).toBe(PlayerStatus.Playing);
    expect(playerState.error).toBe('Reset failed');
  });
});
