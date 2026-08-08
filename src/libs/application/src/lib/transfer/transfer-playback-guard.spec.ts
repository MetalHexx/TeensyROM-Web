import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PlayerStatus,
  PLAYER_SERVICE,
  DEVICE_SERVICE,
  TransferJobSnapshot,
  TransferJobState,
  StorageType,
} from '@teensyrom-nx/domain';
import { TransferPlaybackGuard } from './transfer-playback-guard';
import { TransferStore } from './transfer-store';
import { PlayerStore } from '../player/player-store';
import { PlayerTimerManager } from '../player/player-timer-manager';
import { PLAYER_STORAGE } from '../player/player-storage.interface';

const createSnapshot = (overrides: Partial<TransferJobSnapshot> = {}): TransferJobSnapshot => ({
  jobId: 'job-1',
  deviceId: 'device-1',
  storageType: StorageType.Sd,
  destinationDirectory: '/music/',
  state: TransferJobState.Receiving,
  filesReceived: 0,
  filesSent: 0,
  filesFailed: 0,
  totalFiles: null,
  currentFile: null,
  startedUtc: new Date('2026-01-01T00:00:00Z'),
  error: null,
  failures: [],
  ...overrides,
});

describe('TransferPlaybackGuard', () => {
  let guard: TransferPlaybackGuard;
  let transferStore: InstanceType<typeof TransferStore>;
  let playerStore: InstanceType<typeof PlayerStore>;
  let mockTimerManager: { destroyTimer: ReturnType<typeof vi.fn> };
  let mockDeviceService: { resetDevice: ReturnType<typeof vi.fn> };
  const deviceId = 'device-1';

  beforeEach(() => {
    mockTimerManager = {
      destroyTimer: vi.fn(),
    };

    mockDeviceService = {
      resetDevice: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        TransferPlaybackGuard,
        TransferStore,
        PlayerStore,
        { provide: PlayerTimerManager, useValue: mockTimerManager },
        { provide: PLAYER_SERVICE, useValue: {} },
        { provide: DEVICE_SERVICE, useValue: mockDeviceService },
        {
          provide: PLAYER_STORAGE,
          useValue: { save: vi.fn(), load: vi.fn(), hasSavedState: vi.fn(), clear: vi.fn() },
        },
      ],
    });

    TestBed.runInInjectionContext(() => {
      guard = TestBed.inject(TransferPlaybackGuard);
    });
    transferStore = TestBed.inject(TransferStore);
    playerStore = TestBed.inject(PlayerStore);

    TestBed.flushEffects();
  });

  it('halts the timer and reflects stopped when this client reaches a job-bearing phase', () => {
    transferStore.applyJobSnapshot({ deviceId, snapshot: createSnapshot() });
    TestBed.flushEffects();

    expect(mockTimerManager.destroyTimer).toHaveBeenCalledWith(deviceId);
    expect(playerStore.players()[deviceId]?.status).toBe(PlayerStatus.Stopped);
  });

  it('halts the timer for a job this client did not start (busy pre-check)', () => {
    transferStore.setActiveForeignJob({ deviceId, activeForeignJobId: 'foreign-job' });
    TestBed.flushEffects();

    expect(mockTimerManager.destroyTimer).toHaveBeenCalledWith(deviceId);
    expect(playerStore.players()[deviceId]?.status).toBe(PlayerStatus.Stopped);
  });

  it('halts the timer when create is refused as a conflict (device-busy phase)', () => {
    transferStore.setDeviceBusy({ deviceId, activeForeignJobId: 'foreign-job', error: 'busy' });
    TestBed.flushEffects();

    expect(mockTimerManager.destroyTimer).toHaveBeenCalledWith(deviceId);
    expect(playerStore.players()[deviceId]?.status).toBe(PlayerStatus.Stopped);
  });

  it('does not re-halt a device that is already suppressed', () => {
    transferStore.applyJobSnapshot({ deviceId, snapshot: createSnapshot() });
    TestBed.flushEffects();

    transferStore.applyJobSnapshot({
      deviceId,
      snapshot: createSnapshot({ filesReceived: 5 }),
    });
    TestBed.flushEffects();

    expect(mockTimerManager.destroyTimer).toHaveBeenCalledTimes(1);
  });

  it('stops suppressing once the device loses its active job, without restarting the timer', () => {
    transferStore.applyJobSnapshot({ deviceId, snapshot: createSnapshot() });
    TestBed.flushEffects();
    expect(mockTimerManager.destroyTimer).toHaveBeenCalledTimes(1);

    transferStore.clearTransfer({ deviceId });
    TestBed.flushEffects();

    // Loss doesn't itself create/restart a timer or issue another halt.
    expect(mockTimerManager.destroyTimer).toHaveBeenCalledTimes(1);
  });

  it('re-halts a device that regains an active job after losing the previous one', () => {
    transferStore.applyJobSnapshot({ deviceId, snapshot: createSnapshot() });
    TestBed.flushEffects();

    transferStore.clearTransfer({ deviceId });
    TestBed.flushEffects();

    transferStore.applyJobSnapshot({ deviceId, snapshot: createSnapshot({ jobId: 'job-2' }) });
    TestBed.flushEffects();

    expect(mockTimerManager.destroyTimer).toHaveBeenCalledTimes(2);
  });

  it('never issues a device command at any point', () => {
    transferStore.applyJobSnapshot({ deviceId, snapshot: createSnapshot() });
    TestBed.flushEffects();

    transferStore.setActiveForeignJob({ deviceId: 'device-2', activeForeignJobId: 'foreign-job' });
    TestBed.flushEffects();

    transferStore.clearTransfer({ deviceId });
    TestBed.flushEffects();

    expect(mockDeviceService.resetDevice).not.toHaveBeenCalled();
    expect(guard).toBeTruthy();
  });
});
