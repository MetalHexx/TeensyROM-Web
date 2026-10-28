import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import {
  TRANSFER_HUB_SERVICE,
  ITransferHubService,
  TransferJobSnapshot,
  TransferJobState,
  StorageType,
  TransferLaunchState,
  TransferOriginKind,
} from '@teensyrom-nx/domain';
import { TransferHubListener } from './transfer-hub-listener';
import { TransferStore } from './transfer-store';

const createSnapshot = (overrides: Partial<TransferJobSnapshot> = {}): TransferJobSnapshot => ({
  jobId: 'job-1',
  deviceId: 'device-1',
  storageType: StorageType.Sd,
  destinationDirectory: '/music/',
  state: TransferJobState.Receiving,
  filesReceived: 0,
  filesSent: 0,
  filesFailed: 0,
  bytesSent: 0,
  totalFiles: null,
  currentFile: null,
  origin: { kind: TransferOriginKind.Upload, watchFolderId: null, watchFolderPath: null },
  startedUtc: new Date('2026-01-01T00:00:00Z'),
  lastActivityUtc: new Date('2026-01-01T00:00:00Z'),
  error: null,
  failures: [],
  recentCompletions: [],
  bytesPerSecond: 0,
  filesPerSecond: 0,
  expandingArchive: null,
  expansionBytesWritten: 0,
  expansionBytesDeclared: 0,
  expandedFileCount: null,
  launchState: TransferLaunchState.None,
  launchedPath: null,
  launchError: null,
  ...overrides,
});

describe('TransferHubListener', () => {
  let listener: TransferHubListener;
  let store: InstanceType<typeof TransferStore>;
  let snapshots$: Subject<TransferJobSnapshot>;
  let mockHubService: {
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    snapshots$: Subject<TransferJobSnapshot>;
  };

  beforeEach(() => {
    snapshots$ = new Subject<TransferJobSnapshot>();

    mockHubService = {
      subscribe: vi.fn().mockResolvedValue(createSnapshot()),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      snapshots$,
    };

    TestBed.configureTestingModule({
      providers: [
        TransferHubListener,
        TransferStore,
        { provide: TRANSFER_HUB_SERVICE, useValue: mockHubService as unknown as ITransferHubService },
      ],
    });

    listener = TestBed.inject(TransferHubListener);
    store = TestBed.inject(TransferStore);
  });

  const startOwnEntry = (deviceId: string, snapshot: TransferJobSnapshot) => {
    store.beginScan({ deviceId, droppedRootName: 'games', destinationLabel: '/games' });
    store.beginJob({ deviceId });
    store.applyJobSnapshot({ deviceId, snapshot });
  };

  it('folds the snapshot returned by subscribe into the store as the seed', async () => {
    startOwnEntry('device-1', createSnapshot());
    mockHubService.subscribe.mockResolvedValue(createSnapshot({ filesReceived: 4, filesSent: 2 }));

    await listener.start('device-1', 'job-1');

    expect(mockHubService.subscribe).toHaveBeenCalledWith('job-1');
    expect(store.transfers()['device-1'].job?.filesReceived).toBe(4);
    expect(store.transfers()['device-1'].job?.filesSent).toBe(2);
  });

  it('no longer folds snapshots$ pushes itself', async () => {
    startOwnEntry('device-1', createSnapshot());
    await listener.start('device-1', 'job-1');

    snapshots$.next(createSnapshot({ filesReceived: 5, filesSent: 3 }));

    expect(store.transfers()['device-1'].job?.filesReceived).toBe(0);
  });

  it('holds one job subscription per device without stopping the others', async () => {
    mockHubService.subscribe.mockImplementation(async (jobId: string) =>
      createSnapshot({ jobId, deviceId: jobId === 'job-1' ? 'device-1' : 'device-2' })
    );
    startOwnEntry('device-1', createSnapshot());
    startOwnEntry('device-2', createSnapshot({ jobId: 'job-2', deviceId: 'device-2' }));

    await listener.start('device-1', 'job-1');
    await listener.start('device-2', 'job-2');

    expect(mockHubService.subscribe).toHaveBeenCalledWith('job-1');
    expect(mockHubService.subscribe).toHaveBeenCalledWith('job-2');
    expect(mockHubService.unsubscribe).not.toHaveBeenCalled();

    await listener.stop('device-1');

    expect(mockHubService.unsubscribe).toHaveBeenCalledTimes(1);
    expect(mockHubService.unsubscribe).toHaveBeenCalledWith('job-1');

    await listener.stop('device-2');
    expect(mockHubService.unsubscribe).toHaveBeenCalledWith('job-2');
  });

  it('replaces the previous job of the same device', async () => {
    startOwnEntry('device-1', createSnapshot());
    await listener.start('device-1', 'job-1');
    await listener.start('device-1', 'job-2');

    expect(mockHubService.unsubscribe).toHaveBeenCalledWith('job-1');
    expect(mockHubService.unsubscribe).not.toHaveBeenCalledWith('job-2');
  });

  it('stops a device at most once', async () => {
    startOwnEntry('device-1', createSnapshot());
    await listener.start('device-1', 'job-1');

    await listener.stop('device-1');
    await listener.stop('device-1');

    expect(mockHubService.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when stop is called for a device without a subscription', async () => {
    await expect(listener.stop('device-1')).resolves.toBeUndefined();
    expect(mockHubService.unsubscribe).not.toHaveBeenCalled();
  });

  it('survives a failed unsubscribe', async () => {
    startOwnEntry('device-1', createSnapshot());
    await listener.start('device-1', 'job-1');
    mockHubService.unsubscribe.mockRejectedValue(new Error('connection lost'));

    await expect(listener.stop('device-1')).resolves.toBeUndefined();
  });
});
