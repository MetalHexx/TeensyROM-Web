import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import {
  TRANSFER_HUB_SERVICE,
  ITransferHubService,
  TransferJobSnapshot,
  TransferFileCompletion,
  TransferJobState,
  StorageType,
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
  totalFiles: null,
  currentFile: null,
  startedUtc: new Date('2026-01-01T00:00:00Z'),
  error: null,
  failures: [],
  ...overrides,
});

const createCompletion = (overrides: Partial<TransferFileCompletion> = {}): TransferFileCompletion => ({
  jobId: 'job-1',
  relativePath: 'music/song.sid',
  targetPath: '/music/song.sid',
  success: true,
  error: null,
  sizeBytes: 1024,
  ...overrides,
});

describe('TransferHubListener', () => {
  let listener: TransferHubListener;
  let store: InstanceType<typeof TransferStore>;
  let snapshots$: Subject<TransferJobSnapshot>;
  let fileCompletions$: Subject<TransferFileCompletion>;
  let mockHubService: {
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    snapshots$: Subject<TransferJobSnapshot>;
    fileCompletions$: Subject<TransferFileCompletion>;
  };

  beforeEach(() => {
    snapshots$ = new Subject<TransferJobSnapshot>();
    fileCompletions$ = new Subject<TransferFileCompletion>();

    mockHubService = {
      subscribe: vi.fn().mockResolvedValue(createSnapshot()),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      snapshots$,
      fileCompletions$,
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

  it('seeds the store from the snapshot returned by subscribe', async () => {
    await listener.start('device-1', 'job-1');

    expect(mockHubService.subscribe).toHaveBeenCalledWith('job-1');
    expect(store.transfers()['device-1'].phase).toBe('running');
    expect(store.transfers()['device-1'].job?.jobId).toBe('job-1');
  });

  it('folds subsequent snapshots$ pushes into the store', async () => {
    await listener.start('device-1', 'job-1');

    snapshots$.next(createSnapshot({ filesReceived: 5, filesSent: 3 }));

    expect(store.transfers()['device-1'].job?.filesReceived).toBe(5);
    expect(store.transfers()['device-1'].job?.filesSent).toBe(3);
  });

  it('folds fileCompletions$ pushes into the store feed', async () => {
    await listener.start('device-1', 'job-1');

    fileCompletions$.next(createCompletion({ relativePath: 'music/a.sid', success: true }));
    fileCompletions$.next(
      createCompletion({ relativePath: 'music/b.sid', success: false, error: 'disk full' })
    );

    const feed = store.transfers()['device-1'].feed;
    expect(feed).toHaveLength(2);
    expect(feed[0]).toEqual({
      relativePath: 'music/b.sid',
      fileName: 'b.sid',
      success: false,
      reason: 'device write failed — disk full',
    });
    expect(feed[1].success).toBe(true);
    expect(feed[1].reason).toBeNull();
    expect(store.transfers()['device-1'].failures).toHaveLength(1);
  });

  it('unsubscribes from the hub and tears down subscriptions on stop', async () => {
    await listener.start('device-1', 'job-1');
    await listener.stop();

    expect(mockHubService.unsubscribe).toHaveBeenCalledWith('job-1');

    snapshots$.next(createSnapshot({ filesReceived: 99 }));
    expect(store.transfers()['device-1'].job?.filesReceived).not.toBe(99);
  });

  it('stops the previous job before starting a new one', async () => {
    await listener.start('device-1', 'job-1');
    await listener.start('device-2', 'job-2');

    expect(mockHubService.unsubscribe).toHaveBeenCalledWith('job-1');

    snapshots$.next(createSnapshot({ deviceId: 'device-1', filesReceived: 42 }));
    expect(store.transfers()['device-1'].job?.filesReceived).not.toBe(42);
  });

  it('is a no-op when stop is called without an active listener', async () => {
    await expect(listener.stop()).resolves.toBeUndefined();
    expect(mockHubService.unsubscribe).not.toHaveBeenCalled();
  });
});
