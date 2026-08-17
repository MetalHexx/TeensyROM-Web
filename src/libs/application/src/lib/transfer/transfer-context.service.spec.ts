import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  TRANSFER_SERVICE,
  ITransferService,
  TransferDeviceBusyError,
  TransferCreateRejectedError,
  TransferJobSnapshot,
  TransferJobState,
  TransferManifestEntry,
  StorageType,
} from '@teensyrom-nx/domain';
import { TransferContextService } from './transfer-context.service';
import { TransferStore } from './transfer-store';
import { StorageStore, SelectedDirectory } from '../storage/storage-store';
import { DropScanner, DropScanResult } from './drop-scanner';
import { UploadPool, UploadPoolCallbacks } from './upload-pool';
import { TransferHubListener } from './transfer-hub-listener';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createEntry(relativePath: string): TransferManifestEntry {
  return { file: new File(['x'], relativePath), relativePath, sizeBytes: 1 };
}

function createSelectedDirectory(overrides: Partial<SelectedDirectory> = {}): SelectedDirectory {
  return { deviceId: 'device-1', storageType: StorageType.Sd, path: '/games', ...overrides };
}

function createSnapshot(overrides: Partial<TransferJobSnapshot> = {}): TransferJobSnapshot {
  return {
    jobId: 'job-1',
    deviceId: 'device-1',
    storageType: StorageType.Sd,
    destinationDirectory: '/games',
    state: TransferJobState.Receiving,
    filesReceived: 0,
    filesSent: 0,
    filesFailed: 0,
    totalFiles: null,
    currentFile: null,
    startedUtc: new Date('2026-01-01T00:00:00Z'),
    error: null,
    failures: [],
    recentCompletions: [],
    bytesPerSecond: 0,
    filesPerSecond: 0,
    ...overrides,
  };
}

function asFileList(files: File[]): FileList {
  return files as unknown as FileList;
}

/** Lets pending microtasks settle without advancing the fake clock. */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

/** Matches the service's private `MIN_STATE_DISPLAY_MS`; there's no export to read it from. */
const STATE_DISPLAY_FLOOR_MS = 1000;

/** Advances the fake clock past both state-display floors (scanning, then starting). */
async function advancePastStateFloors(): Promise<void> {
  await flushMicrotasks();
  await vi.advanceTimersByTimeAsync(STATE_DISPLAY_FLOOR_MS * 2);
  await flushMicrotasks();
}

describe('TransferContextService', () => {
  let service: TransferContextService;
  let store: InstanceType<typeof TransferStore>;
  let mockStorageStore: { getSelectedDirectoryForDevice: ReturnType<typeof vi.fn> };
  let mockDropScanner: { scan: ReturnType<typeof vi.fn> };
  let mockUploadPool: { run: ReturnType<typeof vi.fn> };
  let mockHubListener: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };
  let mockTransferService: {
    createJob: ReturnType<typeof vi.fn>;
    uploadFile: ReturnType<typeof vi.fn>;
    sealJob: ReturnType<typeof vi.fn>;
    cancelJob: ReturnType<typeof vi.fn>;
    getActiveJob: ReturnType<typeof vi.fn>;
  };
  let callOrder: string[];
  let callTimes: Record<string, number>;

  const oneFileScan: DropScanResult = {
    entries: [createEntry('games/a.prg')],
    rootName: 'games',
    archiveCount: 0,
  };
  const emptyScan: DropScanResult = { entries: [], rootName: null, archiveCount: 0 };

  beforeEach(() => {
    vi.useFakeTimers();

    callOrder = [];
    callTimes = {};

    const record = (name: string) => {
      callOrder.push(name);
      callTimes[name] = Date.now();
    };

    mockStorageStore = {
      getSelectedDirectoryForDevice: vi.fn(() => {
        record('capture-destination');
        return createSelectedDirectory();
      }),
    };

    mockDropScanner = {
      scan: vi.fn(async () => {
        record('scan');
        return oneFileScan;
      }),
    };

    mockUploadPool = {
      run: vi.fn(async () => {
        record('upload');
      }),
    };

    mockHubListener = {
      start: vi.fn(async () => {
        record('hub-start');
      }),
      stop: vi.fn(async () => undefined),
    };

    mockTransferService = {
      createJob: vi.fn(async () => {
        record('create-job');
        return createSnapshot();
      }),
      uploadFile: vi.fn(async () => undefined),
      sealJob: vi.fn(async () => {
        record('seal-job');
      }),
      cancelJob: vi.fn(async () => createSnapshot({ state: TransferJobState.Cancelled })),
      getActiveJob: vi.fn(async () => null),
    };

    TestBed.configureTestingModule({
      providers: [
        TransferContextService,
        TransferStore,
        { provide: StorageStore, useValue: mockStorageStore },
        { provide: DropScanner, useValue: mockDropScanner },
        { provide: UploadPool, useValue: mockUploadPool },
        { provide: TransferHubListener, useValue: mockHubListener },
        { provide: TRANSFER_SERVICE, useValue: mockTransferService as unknown as ITransferService },
      ],
    });

    service = TestBed.inject(TransferContextService);
    store = TestBed.inject(TransferStore);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Starts a transfer and advances the fake clock past its state-display floors so it settles. */
  async function runStartTransfer(
    deviceId: string,
    input: DataTransferItemList | FileList
  ): Promise<void> {
    const promise = service.startTransfer(deviceId, input);
    await advancePastStateFloors();
    await promise;
  }

  /** Retries a retained transfer and advances the fake clock past its state-display floor. */
  async function runRetryCreate(deviceId: string): Promise<void> {
    const promise = service.retryCreate(deviceId);
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(STATE_DISPLAY_FLOOR_MS);
    await flushMicrotasks();
    await promise;
  }

  describe('happy path sequencing', () => {
    it('runs a drop end to end: destination, scan, job, hub, upload, seal', async () => {
      await runStartTransfer('device-1', asFileList([]));

      expect(mockStorageStore.getSelectedDirectoryForDevice).toHaveBeenCalledWith('device-1');
      expect(mockTransferService.createJob).toHaveBeenCalledWith(
        'device-1',
        StorageType.Sd,
        '/games',
        0
      );
      expect(mockHubListener.start).toHaveBeenCalledWith('device-1', 'job-1');
      expect(mockUploadPool.run).toHaveBeenCalledWith(
        'job-1',
        oneFileScan.entries,
        expect.any(Object),
        expect.any(Object)
      );
      expect(mockTransferService.sealJob).toHaveBeenCalledWith('job-1');

      expect(callOrder).toEqual([
        'capture-destination',
        'scan',
        'create-job',
        'hub-start',
        'upload',
        'seal-job',
      ]);
    });

    it('subscribes the hub before the first upload, and seals only after the pool resolves', async () => {
      let uploadStartedBeforeSeal = false;
      mockUploadPool.run.mockImplementation(async () => {
        uploadStartedBeforeSeal = mockTransferService.sealJob.mock.calls.length === 0;
        callOrder.push('upload');
      });

      await runStartTransfer('device-1', asFileList([]));

      const hubIndex = callOrder.indexOf('hub-start');
      const uploadIndex = callOrder.indexOf('upload');
      const sealIndex = callOrder.indexOf('seal-job');

      expect(hubIndex).toBeLessThan(uploadIndex);
      expect(uploadIndex).toBeLessThan(sealIndex);
      expect(uploadStartedBeforeSeal).toBe(true);
    });

    it('captures the destination before scanning starts', async () => {
      await runStartTransfer('device-1', asFileList([]));

      expect(callOrder.indexOf('capture-destination')).toBeLessThan(callOrder.indexOf('scan'));
    });

    it('folds an uploaded file and an exhausted file into their own store actions', async () => {
      mockUploadPool.run.mockImplementation(
        async (_jobId: string, _manifest: unknown, callbacks: UploadPoolCallbacks) => {
          callbacks.onFileUploaded(createEntry('games/a.prg'));
          callbacks.onFileFailed(createEntry('games/b.prg'), 'network error');
        }
      );

      await runStartTransfer('device-1', asFileList([]));

      const transfer = store.transfers()['device-1'];
      expect(transfer.uploadFailedCount).toBe(1);
      // `mockHubListener` never pushes a snapshot in this test, so the fold that recomputes
      // `failures` from `localFailures` never runs — the local entry lands in `localFailures`.
      expect(transfer.localFailures).toHaveLength(1);
      expect(transfer.localFailures[0]).toMatchObject({
        relativePath: 'games/b.prg',
        reason: 'network error',
      });
    });
  });

  describe('zero-file scan', () => {
    it('creates no job and stops', async () => {
      mockDropScanner.scan.mockResolvedValue(emptyScan);

      await runStartTransfer('device-1', asFileList([]));

      expect(mockTransferService.createJob).not.toHaveBeenCalled();
      expect(store.transfers()['device-1'].phase).toBe('nothing-to-transfer');
    });
  });

  describe('device-busy conflict', () => {
    it('retains the manifest and retryCreate reuses it without a second scan', async () => {
      mockTransferService.createJob.mockRejectedValueOnce(
        new TransferDeviceBusyError('foreign-job', 'device busy')
      );

      await runStartTransfer('device-1', asFileList([]));

      expect(store.transfers()['device-1'].phase).toBe('device-busy');
      expect(mockDropScanner.scan).toHaveBeenCalledTimes(1);

      mockTransferService.createJob.mockResolvedValueOnce(createSnapshot());

      await runRetryCreate('device-1');

      expect(mockDropScanner.scan).toHaveBeenCalledTimes(1);
      expect(mockTransferService.createJob).toHaveBeenCalledTimes(2);
      expect(mockTransferService.createJob).toHaveBeenLastCalledWith(
        'device-1',
        StorageType.Sd,
        '/games',
        0
      );
      expect(mockHubListener.start).toHaveBeenCalledWith('device-1', 'job-1');
    });
  });

  describe('rejected destination', () => {
    it('fails and is not retried automatically', async () => {
      mockTransferService.createJob.mockRejectedValueOnce(
        new TransferCreateRejectedError('destination rejected')
      );

      await runStartTransfer('device-1', asFileList([]));

      expect(store.transfers()['device-1'].phase).toBe('failed');
      expect(mockHubListener.start).not.toHaveBeenCalled();
      expect(mockUploadPool.run).not.toHaveBeenCalled();
    });
  });

  describe('cancel before a job exists', () => {
    it('aborts the scan and issues no server call', async () => {
      const scanGate = deferred<DropScanResult>();
      let scanSignal: AbortSignal | undefined;
      mockDropScanner.scan.mockImplementation(
        (_input: unknown, _onProgress: unknown, signal: AbortSignal) => {
          scanSignal = signal;
          return scanGate.promise;
        }
      );

      const startPromise = service.startTransfer('device-1', asFileList([]));
      await flushMicrotasks();

      await service.cancelTransfer('device-1');

      expect(scanSignal?.aborted).toBe(true);
      expect(store.transfers()['device-1'].phase).toBe('idle');

      scanGate.resolve(oneFileScan);
      await startPromise;

      expect(mockTransferService.createJob).not.toHaveBeenCalled();
      expect(mockTransferService.cancelJob).not.toHaveBeenCalled();
    });
  });

  describe('cancel once a job exists', () => {
    it('aborts the upload and calls cancelJob on the server', async () => {
      const uploadGate = deferred<void>();
      let uploadSignal: AbortSignal | undefined;
      mockUploadPool.run.mockImplementation(
        (_jobId: string, _manifest: unknown, _callbacks: unknown, signal: AbortSignal) => {
          uploadSignal = signal;
          return uploadGate.promise;
        }
      );

      const startPromise = service.startTransfer('device-1', asFileList([]));
      // Both state-display floors (scanning, starting) must clear before a job exists to cancel.
      await advancePastStateFloors();

      await service.cancelTransfer('device-1');

      expect(uploadSignal?.aborted).toBe(true);
      expect(mockTransferService.cancelJob).toHaveBeenCalledWith('job-1');

      uploadGate.resolve();
      await startPromise;

      expect(mockTransferService.sealJob).not.toHaveBeenCalled();
    });

    it('reply-only: folds the cancel reply into the cancelled state with no hub snapshot arriving', async () => {
      const uploadGate = deferred<void>();
      mockUploadPool.run.mockImplementation(() => uploadGate.promise);

      const startPromise = service.startTransfer('device-1', asFileList([]));
      await advancePastStateFloors();

      await service.cancelTransfer('device-1');

      expect(store.getTransferModalState('device-1')()).toBe('cancelled');

      uploadGate.resolve();
      await startPromise;
    });

    it('hub-only: a hub-pushed terminal snapshot lands cancelled even before the cancel reply resolves late', async () => {
      const uploadGate = deferred<void>();
      mockUploadPool.run.mockImplementation(() => uploadGate.promise);
      const cancelReply = deferred<TransferJobSnapshot>();
      mockTransferService.cancelJob.mockImplementation(() => cancelReply.promise);

      const startPromise = service.startTransfer('device-1', asFileList([]));
      await advancePastStateFloors();

      const cancelPromise = service.cancelTransfer('device-1');
      await flushMicrotasks();

      // The hub push arrives first, ahead of the (still pending) cancel reply.
      store.applyJobSnapshot({
        deviceId: 'device-1',
        snapshot: createSnapshot({ state: TransferJobState.Cancelled }),
      });
      expect(store.getTransferModalState('device-1')()).toBe('cancelled');

      cancelReply.resolve(createSnapshot({ state: TransferJobState.Cancelled }));
      await cancelPromise;

      expect(store.getTransferModalState('device-1')()).toBe('cancelled');

      uploadGate.resolve();
      await startPromise;
    });

    it('surfaces a rejected cancel call as a cancel failure, not a start failure', async () => {
      const uploadGate = deferred<void>();
      mockUploadPool.run.mockImplementation(() => uploadGate.promise);
      mockTransferService.cancelJob.mockRejectedValueOnce(new Error('cancel endpoint unreachable'));

      const startPromise = service.startTransfer('device-1', asFileList([]));
      await advancePastStateFloors();

      await service.cancelTransfer('device-1');

      expect(store.transfers()['device-1'].phase).toBe('cancel-failed');
      expect(store.getTransferModalState('device-1')()).toBe('cancel-failed');
      expect(store.getTransferSummary('device-1')().reason).toBe('cancel endpoint unreachable');

      uploadGate.resolve();
      await startPromise;
    });

    it('keeps the cancelled screen when the hub lands the cancellation before the reply rejects', async () => {
      const uploadGate = deferred<void>();
      mockUploadPool.run.mockImplementation(() => uploadGate.promise);
      const cancelReply = deferred<TransferJobSnapshot>();
      mockTransferService.cancelJob.mockImplementation(() => cancelReply.promise);

      const startPromise = service.startTransfer('device-1', asFileList([]));
      await advancePastStateFloors();

      const cancelPromise = service.cancelTransfer('device-1');
      await flushMicrotasks();

      store.applyJobSnapshot({
        deviceId: 'device-1',
        snapshot: createSnapshot({ state: TransferJobState.Cancelled }),
      });

      cancelReply.reject(new Error('cancel reply lost on the way back'));
      await cancelPromise;

      expect(store.getTransferModalState('device-1')()).toBe('cancelled');

      uploadGate.resolve();
      await startPromise;
    });
  });

  describe('state display floors', () => {
    it('holds scanning and starting for the floor even when the scan and create resolve instantly', async () => {
      await runStartTransfer('device-1', asFileList([]));

      const scanAt = callTimes['scan'];
      const createAt = callTimes['create-job'];
      const hubStartAt = callTimes['hub-start'];

      // 'scanning' must outlive the instantly-resolved scan by the floor before completeScan
      // (and the resulting createJob call) fires.
      expect(createAt - scanAt).toBeGreaterThanOrEqual(STATE_DISPLAY_FLOOR_MS);
      // 'starting' must outlive the instantly-resolved create by the floor before the success
      // path (driven by hubListener.start) is allowed to proceed.
      expect(hubStartAt - createAt).toBeGreaterThanOrEqual(STATE_DISPLAY_FLOOR_MS);
    });

    it('cancelling during the scanning hold produces no createJob call', async () => {
      const startPromise = service.startTransfer('device-1', asFileList([]));
      await flushMicrotasks();

      // The scan itself has resolved, but the scanning floor is still holding.
      await service.cancelTransfer('device-1');
      // Let the scanning floor's own hold resolve so the cancelled startTransfer call can unwind.
      await vi.advanceTimersByTimeAsync(STATE_DISPLAY_FLOOR_MS);
      await startPromise;

      expect(mockTransferService.createJob).not.toHaveBeenCalled();
      expect(store.transfers()['device-1'].phase).toBe('idle');
    });

    it('cancelling during the starting hold cancels the created job on the server and never seals', async () => {
      const startPromise = service.startTransfer('device-1', asFileList([]));
      await flushMicrotasks();
      // Clear the scanning floor and let createJob resolve, landing inside the starting floor.
      await vi.advanceTimersByTimeAsync(STATE_DISPLAY_FLOOR_MS);
      await flushMicrotasks();

      await service.cancelTransfer('device-1');
      // Let the starting floor's own hold resolve so the cancelled createAndRun call can unwind.
      await vi.advanceTimersByTimeAsync(STATE_DISPLAY_FLOOR_MS);
      await startPromise;

      expect(mockTransferService.cancelJob).toHaveBeenCalledWith('job-1');
      expect(mockTransferService.sealJob).not.toHaveBeenCalled();
    });
  });

  describe('closeTransfer', () => {
    it('stops the hub listener, drops the retained manifest, and clears the device state', async () => {
      mockTransferService.createJob.mockRejectedValueOnce(
        new TransferDeviceBusyError('foreign-job', 'device busy')
      );
      await runStartTransfer('device-1', asFileList([]));
      expect(store.transfers()['device-1'].phase).toBe('device-busy');

      await service.closeTransfer('device-1');

      expect(mockHubListener.stop).toHaveBeenCalled();
      expect(store.transfers()['device-1'].phase).toBe('idle');

      await service.retryCreate('device-1');
      expect(mockTransferService.createJob).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshDeviceBusyState', () => {
    it('reads the active job and narrows the busy window', async () => {
      mockTransferService.getActiveJob.mockResolvedValue(createSnapshot({ jobId: 'other-job' }));

      await service.refreshDeviceBusyState('device-1');

      expect(store.transfers()['device-1'].activeForeignJobId).toBe('other-job');
    });

    it('clears the active job id when the device is idle', async () => {
      mockTransferService.getActiveJob.mockResolvedValue(null);

      await service.refreshDeviceBusyState('device-1');

      expect(store.transfers()['device-1'].activeForeignJobId).toBeNull();
    });
  });
});
