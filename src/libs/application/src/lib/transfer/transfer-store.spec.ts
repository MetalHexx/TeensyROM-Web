import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAction } from '@teensyrom-nx/utils';
import {
  TransferJobSnapshot,
  TransferFileCompletion,
  TransferJobState,
  StorageType,
} from '@teensyrom-nx/domain';
import { TransferStore, TransferModalState } from './transfer-store';
import { TRANSFER_FEED_CAP, TRANSFER_FAILURE_CAP } from './transfer.constants';
import { isTerminalJobState } from './transfer-helpers';

vi.mock('@teensyrom-nx/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@teensyrom-nx/utils')>();
  return {
    ...actual,
    createAction: vi.fn(actual.createAction),
  };
});

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
  recentCompletions: [],
  bytesPerSecond: 0,
  filesPerSecond: 0,
  expandingArchive: null,
  expansionBytesWritten: 0,
  expansionBytesDeclared: 0,
  expandedFileCount: 0,
  ...overrides,
});

const createCompletion = (
  overrides: Partial<TransferFileCompletion> = {}
): TransferFileCompletion => ({
  jobId: 'job-1',
  relativePath: 'music/song.sid',
  targetPath: '/music/song.sid',
  success: true,
  error: null,
  sizeBytes: 1024,
  ...overrides,
});

describe('TransferStore', () => {
  let store: InstanceType<typeof TransferStore>;
  const deviceId = 'device-1';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TransferStore],
    });
    store = TestBed.inject(TransferStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('target device', () => {
    it('should have initial state with null targetDeviceId and empty transfers', () => {
      expect(store.targetDeviceId()).toBeNull();
      expect(store.transfers()).toEqual({});
    });

    it('should set target device', () => {
      store.setTargetDevice({ deviceId: 'device-123' });
      expect(store.targetDeviceId()).toBe('device-123');
      expect(store.transfers()).toEqual({});
    });

    it('should replace target device when setting a new one', () => {
      store.setTargetDevice({ deviceId: 'device-1' });
      store.setTargetDevice({ deviceId: 'device-2' });
      expect(store.targetDeviceId()).toBe('device-2');
    });

    it('should clear target device', () => {
      store.setTargetDevice({ deviceId: 'device-123' });
      store.clearTargetDevice();
      expect(store.targetDeviceId()).toBeNull();
    });

    it('should track targetDeviceId changes as a signal', () => {
      const targetDeviceSignal = store.getTargetDeviceId();
      expect(targetDeviceSignal()).toBeNull();
      store.setTargetDevice({ deviceId: 'device-1' });
      expect(targetDeviceSignal()).toBe('device-1');
    });
  });

  describe('scan and job lifecycle', () => {
    it('begins a scan with a fresh idle-shaped entry', () => {
      store.beginScan({ deviceId, droppedRootName: 'Games', destinationLabel: '/games' });

      const transfer = store.transfers()[deviceId];
      expect(transfer.phase).toBe('scanning');
      expect(transfer.droppedRootName).toBe('Games');
      expect(transfer.destinationLabel).toBe('/games');
      expect(transfer.job).toBeNull();
      expect(transfer.scanFound).toBe(0);
      expect(transfer.scanTotal).toBe(0);
      expect(transfer.archivesSent).toBe(0);
      expect(transfer.isLoading).toBe(true);
    });

    it('ticks scanFound during the walk', () => {
      store.beginScan({ deviceId, droppedRootName: 'Games', destinationLabel: '/games' });
      store.reportScanProgress({ deviceId, scanFound: 12 });
      expect(store.transfers()[deviceId].scanFound).toBe(12);
    });

    it('moves to nothing-to-transfer when the scan matches zero files', () => {
      store.beginScan({ deviceId, droppedRootName: 'Games', destinationLabel: '/games' });
      store.completeScan({ deviceId, scanTotal: 0 });

      const transfer = store.transfers()[deviceId];
      expect(transfer.phase).toBe('nothing-to-transfer');
      expect(transfer.isLoading).toBe(false);
    });

    it('stays out of nothing-to-transfer when the scan matches files', () => {
      store.beginScan({ deviceId, droppedRootName: 'Games', destinationLabel: '/games' });
      store.completeScan({ deviceId, scanTotal: 5 });

      const transfer = store.transfers()[deviceId];
      expect(transfer.phase).not.toBe('nothing-to-transfer');
      expect(transfer.scanTotal).toBe(5);
    });

    it('stores archivesSent alongside scanTotal when the scan completes', () => {
      store.beginScan({ deviceId, droppedRootName: 'Games', destinationLabel: '/games' });
      store.completeScan({ deviceId, scanTotal: 5, archivesSent: 2 });

      const transfer = store.transfers()[deviceId];
      expect(transfer.scanTotal).toBe(5);
      expect(transfer.archivesSent).toBe(2);
    });

    it('defaults archivesSent to 0 for an archive-free drop', () => {
      store.beginScan({ deviceId, droppedRootName: 'Games', destinationLabel: '/games' });
      store.completeScan({ deviceId, scanTotal: 5 });

      expect(store.transfers()[deviceId].archivesSent).toBe(0);
    });

    it('moves to starting when job creation begins, retaining the manifest', () => {
      store.beginScan({ deviceId, droppedRootName: 'Games', destinationLabel: '/games' });
      store.completeScan({ deviceId, scanTotal: 5 });
      store.beginJob({ deviceId });

      const transfer = store.transfers()[deviceId];
      expect(transfer.phase).toBe('starting');
      expect(transfer.scanTotal).toBe(5);
    });

    it('applies a job snapshot, entering running and seeding startedAt from the server', () => {
      store.beginScan({ deviceId, droppedRootName: 'Games', destinationLabel: '/games' });
      store.beginJob({ deviceId });
      store.applyJobSnapshot({ deviceId, snapshot: createSnapshot() });

      const transfer = store.transfers()[deviceId];
      expect(transfer.phase).toBe('running');
      expect(transfer.job?.jobId).toBe('job-1');
      expect(transfer.startedAt).toBe(new Date('2026-01-01T00:00:00Z').getTime());
    });
  });

  describe('snapshot fold and local upload failures', () => {
    it('folds the very first snapshot for a device — no predecessor to dedupe against', () => {
      store.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({
          filesReceived: 1,
          recentCompletions: [createCompletion({ relativePath: 'music/a.sid', success: true })],
        }),
      });

      const transfer = store.transfers()[deviceId];
      expect(transfer.feed).toHaveLength(1);
      expect(transfer.job?.filesReceived).toBe(1);
    });

    it('records the device-write-failed reason for an unsuccessful completion', () => {
      const failure = createCompletion({
        relativePath: 'music/b.sid',
        success: false,
        error: 'disk full',
      });
      store.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({ recentCompletions: [failure], failures: [failure] }),
      });

      const transfer = store.transfers()[deviceId];
      expect(transfer.feed[0]).toEqual({
        relativePath: 'music/b.sid',
        fileName: 'b.sid',
        success: false,
        reason: 'device write failed — disk full',
      });
      expect(transfer.failures).toHaveLength(1);
    });

    it('keeps the feed newest-first, folding only the entries new since the previous snapshot', () => {
      store.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({
          recentCompletions: [createCompletion({ relativePath: 'a.sid' })],
        }),
      });
      store.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({
          recentCompletions: [
            createCompletion({ relativePath: 'b.sid' }),
            createCompletion({ relativePath: 'a.sid' }),
          ],
        }),
      });

      expect(store.transfers()[deviceId].feed[0].relativePath).toBe('b.sid');
      expect(store.transfers()[deviceId].feed[1].relativePath).toBe('a.sid');
    });

    it('does not duplicate feed rows when the same snapshot is applied twice', () => {
      const snapshot = createSnapshot({
        recentCompletions: [createCompletion({ relativePath: 'a.sid' })],
      });
      store.applyJobSnapshot({ deviceId, snapshot });
      store.applyJobSnapshot({ deviceId, snapshot });

      expect(store.transfers()[deviceId].feed).toHaveLength(1);
    });

    it('records a local upload failure without touching the server-facing job', () => {
      store.recordUploadFailure({
        deviceId,
        relativePath: 'music/c.sid',
        reason: 'network timeout',
      });

      const transfer = store.transfers()[deviceId];
      expect(transfer.uploadFailedCount).toBe(1);
      expect(transfer.feed[0]).toEqual({
        relativePath: 'music/c.sid',
        fileName: 'c.sid',
        success: false,
        reason: 'network timeout',
      });
      expect(transfer.localFailures).toHaveLength(1);
      expect(transfer.failures).toHaveLength(0);
    });

    it('folds a local upload failure into failures on the next snapshot, leaving uploadFailedCount untouched', () => {
      store.recordUploadFailure({
        deviceId,
        relativePath: 'music/c.sid',
        reason: 'network timeout',
      });
      store.applyJobSnapshot({ deviceId, snapshot: createSnapshot() });

      const transfer = store.transfers()[deviceId];
      expect(transfer.uploadFailedCount).toBe(1);
      expect(transfer.feed[0].relativePath).toBe('music/c.sid');
      expect(transfer.failures).toHaveLength(1);
      expect(transfer.failures[0].relativePath).toBe('music/c.sid');
    });

    it('does not resurrect a feed row evicted by a local failure when the next snapshot is unchanged', () => {
      const recentCompletions = Array.from({ length: TRANSFER_FEED_CAP }, (_, i) =>
        createCompletion({ relativePath: `music/seed-${i}.sid` })
      );
      const snapshot = createSnapshot({ recentCompletions });
      store.applyJobSnapshot({ deviceId, snapshot });

      const evicted = store.transfers()[deviceId].feed[TRANSFER_FEED_CAP - 1].relativePath;

      store.recordUploadFailure({
        deviceId,
        relativePath: 'music/local-failure.sid',
        reason: 'timeout',
      });
      store.applyJobSnapshot({ deviceId, snapshot });

      const feed = store.transfers()[deviceId].feed;
      expect(feed).toHaveLength(TRANSFER_FEED_CAP);
      expect(feed.some((entry) => entry.relativePath === evicted)).toBe(false);
      expect(feed[0].relativePath).toBe('music/local-failure.sid');
    });

    it('routes a failure past the server failure bound into feed only, not failures', () => {
      const pastBound = createCompletion({
        relativePath: 'music/past-bound.sid',
        success: false,
        error: 'x',
      });
      store.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({ recentCompletions: [pastBound], failures: [] }),
      });

      const transfer = store.transfers()[deviceId];
      expect(transfer.feed.some((entry) => entry.relativePath === 'music/past-bound.sid')).toBe(
        true
      );
      expect(transfer.failures).toHaveLength(0);
    });
  });

  describe('error and busy transitions', () => {
    it('records a device-busy refusal, retaining the manifest', () => {
      store.beginScan({ deviceId, droppedRootName: 'Games', destinationLabel: '/games' });
      store.completeScan({ deviceId, scanTotal: 5 });
      store.setDeviceBusy({ deviceId, activeForeignJobId: 'other-job', error: 'device busy' });

      const transfer = store.transfers()[deviceId];
      expect(transfer.phase).toBe('device-busy');
      expect(transfer.activeForeignJobId).toBe('other-job');
      expect(transfer.error).toBe('device busy');
      expect(transfer.scanTotal).toBe(5);
    });

    it('records a non-retryable transfer error', () => {
      store.setTransferError({ deviceId, error: 'invalid destination' });

      const transfer = store.transfers()[deviceId];
      expect(transfer.phase).toBe('failed');
      expect(transfer.error).toBe('invalid destination');
    });

    it('records the busy-device pre-check independent of phase', () => {
      store.setActiveForeignJob({ deviceId, activeForeignJobId: 'foreign-job' });

      const transfer = store.transfers()[deviceId];
      expect(transfer.phase).toBe('idle');
      expect(transfer.activeForeignJobId).toBe('foreign-job');
    });

    it('resets a device to idle on clear', () => {
      store.beginScan({ deviceId, droppedRootName: 'Games', destinationLabel: '/games' });
      store.applyJobSnapshot({ deviceId, snapshot: createSnapshot() });
      store.clearTransfer({ deviceId });

      const transfer = store.transfers()[deviceId];
      expect(transfer.phase).toBe('idle');
      expect(transfer.job).toBeNull();
      expect(transfer.feed).toEqual([]);
    });
  });

  describe('getTransferModalState', () => {
    const cases: Array<[string, (deviceId: string) => void, TransferModalState | null]> = [
      ['idle', () => undefined, null],
      [
        'scanning',
        (id) => store.beginScan({ deviceId: id, droppedRootName: 'r', destinationLabel: 'd' }),
        'scanning',
      ],
      [
        'nothing-to-transfer',
        (id) => {
          store.beginScan({ deviceId: id, droppedRootName: 'r', destinationLabel: 'd' });
          store.completeScan({ deviceId: id, scanTotal: 0 });
        },
        'nothing-to-transfer',
      ],
      [
        'starting',
        (id) => {
          store.beginScan({ deviceId: id, droppedRootName: 'r', destinationLabel: 'd' });
          store.beginJob({ deviceId: id });
        },
        'starting',
      ],
      [
        'device-busy',
        (id) => store.setDeviceBusy({ deviceId: id, activeForeignJobId: 'x', error: 'busy' }),
        'device-busy',
      ],
      ['failed', (id) => store.setTransferError({ deviceId: id, error: 'nope' }), 'failed'],
      [
        'running/Created -> receiving',
        (id) =>
          store.applyJobSnapshot({
            deviceId: id,
            snapshot: createSnapshot({ state: TransferJobState.Created }),
          }),
        'receiving',
      ],
      [
        'running/Receiving -> receiving',
        (id) =>
          store.applyJobSnapshot({
            deviceId: id,
            snapshot: createSnapshot({ state: TransferJobState.Receiving }),
          }),
        'receiving',
      ],
      [
        'running/Sealed -> draining',
        (id) =>
          store.applyJobSnapshot({
            deviceId: id,
            snapshot: createSnapshot({ state: TransferJobState.Sealed }),
          }),
        'draining',
      ],
      [
        'running/Cancelling -> cancelling',
        (id) =>
          store.applyJobSnapshot({
            deviceId: id,
            snapshot: createSnapshot({ state: TransferJobState.Cancelling }),
          }),
        'cancelling',
      ],
      [
        'running/Completed -> completed',
        (id) =>
          store.applyJobSnapshot({
            deviceId: id,
            snapshot: createSnapshot({ state: TransferJobState.Completed }),
          }),
        'completed',
      ],
      [
        'running/Cancelled -> cancelled',
        (id) =>
          store.applyJobSnapshot({
            deviceId: id,
            snapshot: createSnapshot({ state: TransferJobState.Cancelled }),
          }),
        'cancelled',
      ],
      [
        'running/Aborted -> aborted',
        (id) =>
          store.applyJobSnapshot({
            deviceId: id,
            snapshot: createSnapshot({ state: TransferJobState.Aborted }),
          }),
        'aborted',
      ],
      [
        'running/Abandoned -> abandoned',
        (id) =>
          store.applyJobSnapshot({
            deviceId: id,
            snapshot: createSnapshot({ state: TransferJobState.Abandoned }),
          }),
        'abandoned',
      ],
    ];

    for (const [label, arrange, expected] of cases) {
      it(`maps ${label} to ${expected}`, () => {
        arrange(deviceId);
        expect(store.getTransferModalState(deviceId)()).toBe(expected);
        expect(store.isTransferModalOpen(deviceId)()).toBe(expected !== null);
      });
    }
  });

  describe('getTransferMetrics', () => {
    it('returns zeros with no job, surfacing only local upload failures', () => {
      store.recordUploadFailure({ deviceId, relativePath: 'x.sid', reason: 'timeout' });

      expect(store.getTransferMetrics(deviceId)()).toEqual({
        uploaded: 0,
        written: 0,
        failed: 1,
        apiPct: 0,
        devicePct: 0,
        expandedTotal: null,
        expansionPct: 0,
        expandingArchive: null,
        hasArchive: false,
        expansionComplete: false,
      });
    });

    it('computes the combined failed count from server and local upload failures', () => {
      store.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({ filesReceived: 10, filesSent: 6, filesFailed: 1 }),
      });
      store.recordUploadFailure({ deviceId, relativePath: 'a.sid', reason: 'timeout' });
      store.recordUploadFailure({ deviceId, relativePath: 'b.sid', reason: 'timeout' });

      const metrics = store.getTransferMetrics(deviceId)();
      expect(metrics.failed).toBe(3);
    });

    it('pins apiPct to 100 once Sealed, even when filesReceived trails scanTotal', () => {
      store.beginScan({ deviceId, droppedRootName: 'r', destinationLabel: 'd' });
      store.completeScan({ deviceId, scanTotal: 100 });
      store.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({
          state: TransferJobState.Sealed,
          filesReceived: 40,
          filesSent: 40,
        }),
      });

      const metrics = store.getTransferMetrics(deviceId)();
      expect(metrics.apiPct).toBe(100);
      expect(metrics.devicePct).toBe(40);
    });

    it('derives apiPct from the ratio while still Receiving', () => {
      store.beginScan({ deviceId, droppedRootName: 'r', destinationLabel: 'd' });
      store.completeScan({ deviceId, scanTotal: 100 });
      store.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({
          state: TransferJobState.Receiving,
          filesReceived: 40,
          filesSent: 20,
        }),
      });

      const metrics = store.getTransferMetrics(deviceId)();
      expect(metrics.apiPct).toBe(40);
      expect(metrics.devicePct).toBe(20);
    });

    it('floors devicePct below 100 on a near-miss, rather than rounding up while files remain', () => {
      store.beginScan({ deviceId, droppedRootName: 'r', destinationLabel: 'd' });
      store.completeScan({ deviceId, scanTotal: 60000 });
      store.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({
          state: TransferJobState.Receiving,
          filesReceived: 60000,
          filesSent: 59997,
        }),
      });

      expect(store.getTransferMetrics(deviceId)().devicePct).toBeLessThan(100);
    });

    it('pins devicePct to 100 only once the job is Completed', () => {
      store.beginScan({ deviceId, droppedRootName: 'r', destinationLabel: 'd' });
      store.completeScan({ deviceId, scanTotal: 500 });
      store.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({
          state: TransferJobState.Completed,
          filesReceived: 480,
          filesSent: 480,
        }),
      });

      expect(store.getTransferMetrics(deviceId)().devicePct).toBe(100);
    });

    it('does not pin devicePct for a Cancelled job that stopped early', () => {
      store.beginScan({ deviceId, droppedRootName: 'r', destinationLabel: 'd' });
      store.completeScan({ deviceId, scanTotal: 12480 });
      store.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({
          state: TransferJobState.Cancelled,
          filesReceived: 7003,
          filesSent: 7003,
        }),
      });

      expect(store.getTransferMetrics(deviceId)().devicePct).not.toBe(100);
    });

    it('does not pin devicePct for a merely Sealed job', () => {
      store.beginScan({ deviceId, droppedRootName: 'r', destinationLabel: 'd' });
      store.completeScan({ deviceId, scanTotal: 100 });
      store.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({
          state: TransferJobState.Sealed,
          filesReceived: 90,
          filesSent: 90,
        }),
      });

      expect(store.getTransferMetrics(deviceId)().devicePct).not.toBe(100);
    });

    it('yields 0 for both percentages when scanTotal is still 0', () => {
      store.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({
          state: TransferJobState.Receiving,
          filesReceived: 3,
          filesSent: 1,
        }),
      });

      const metrics = store.getTransferMetrics(deviceId)();
      expect(metrics.apiPct).toBe(0);
      expect(metrics.devicePct).toBe(0);
    });

    it('reads devicePct against scanTotal while expandedTotal does not yet exist, then against the composed total once it does', () => {
      store.beginScan({ deviceId, droppedRootName: 'r', destinationLabel: 'd' });
      store.completeScan({ deviceId, scanTotal: 100, archivesSent: 20 });
      store.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({
          state: TransferJobState.Receiving,
          filesSent: 50,
          expandedFileCount: null,
        }),
      });

      const beforeExpansion = store.getTransferMetrics(deviceId)();
      expect(beforeExpansion.expandedTotal).toBeNull();
      expect(beforeExpansion.devicePct).toBe(50);

      store.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({
          state: TransferJobState.Receiving,
          filesSent: 60,
          expandedFileCount: 30,
        }),
      });

      const afterExpansion = store.getTransferMetrics(deviceId)();
      expect(afterExpansion.expandedTotal).toBe(110);
      expect(afterExpansion.devicePct).toBe(54); // floor(60 / 110 * 100)
      expect(afterExpansion.devicePct).toBeGreaterThanOrEqual(beforeExpansion.devicePct);
    });

    it('reports hasArchive and expansionComplete once every archive in the job has finished', () => {
      store.beginScan({ deviceId, droppedRootName: 'r', destinationLabel: 'd' });
      store.completeScan({ deviceId, scanTotal: 100, archivesSent: 20 });
      store.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({ expandedFileCount: 30 }),
      });

      const metrics = store.getTransferMetrics(deviceId)();
      expect(metrics.hasArchive).toBe(true);
      expect(metrics.expansionComplete).toBe(true);
    });

    it('clamps expansionPct at 100 for an archive stopped after exceeding its declared bytes', () => {
      store.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({
          expandingArchive: 'games/big.zip',
          expansionBytesWritten: 150,
          expansionBytesDeclared: 100,
          expandedFileCount: null,
        }),
      });

      const metrics = store.getTransferMetrics(deviceId)();
      expect(metrics.expansionPct).toBe(100);
      expect(metrics.expandingArchive).toBe('games/big.zip');
    });

    it('pins expansionPct to 100 once expandedFileCount is set, the state-driven pin', () => {
      store.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({
          expansionBytesWritten: 10,
          expansionBytesDeclared: 1000,
          expandedFileCount: 5,
        }),
      });

      expect(store.getTransferMetrics(deviceId)().expansionPct).toBe(100);
    });

    it('produces metrics identical to the archive-free arithmetic when no archive was sent', () => {
      store.beginScan({ deviceId, droppedRootName: 'r', destinationLabel: 'd' });
      store.completeScan({ deviceId, scanTotal: 100 });
      store.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({
          state: TransferJobState.Receiving,
          filesReceived: 40,
          filesSent: 20,
        }),
      });

      const metrics = store.getTransferMetrics(deviceId)();
      expect(metrics.expandedTotal).toBe(100);
      expect(metrics.apiPct).toBe(40);
      expect(metrics.devicePct).toBe(20);
      expect(metrics.hasArchive).toBe(false);
      expect(metrics.expansionComplete).toBe(false);
      expect(metrics.expansionPct).toBe(100); // the state-driven pin is trivially satisfied with no archives
      expect(metrics.expandingArchive).toBeNull();
    });
  });

  describe('isTerminalJobState', () => {
    it('is true for the four terminal states and false for Sealed and the in-flight states', () => {
      expect(isTerminalJobState(TransferJobState.Completed)).toBe(true);
      expect(isTerminalJobState(TransferJobState.Cancelled)).toBe(true);
      expect(isTerminalJobState(TransferJobState.Aborted)).toBe(true);
      expect(isTerminalJobState(TransferJobState.Abandoned)).toBe(true);
      expect(isTerminalJobState(TransferJobState.Sealed)).toBe(false);
      expect(isTerminalJobState(TransferJobState.Receiving)).toBe(false);
    });
  });

  describe('getTransferSummary', () => {
    it('returns a null elapsed label before a job exists', () => {
      store.beginScan({ deviceId, droppedRootName: 'r', destinationLabel: 'd' });
      expect(store.getTransferSummary(deviceId)().elapsedLabel).toBeNull();
    });

    it('formats the elapsed label from startedAt', () => {
      const start = new Date('2026-01-01T00:00:00Z');
      vi.spyOn(Date, 'now').mockReturnValue(start.getTime() + 90_000);

      store.applyJobSnapshot({ deviceId, snapshot: createSnapshot({ startedUtc: start }) });

      expect(store.getTransferSummary(deviceId)().elapsedLabel).toBe('1:30 elapsed');
    });

    it('reports the failure overflow remainder', () => {
      store.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({
          filesFailed: 10,
          failures: [
            createCompletion({ relativePath: 'a.sid', success: false, error: 'x' }),
            createCompletion({ relativePath: 'b.sid', success: false, error: 'x' }),
          ],
        }),
      });

      expect(store.getTransferSummary(deviceId)().failureOverflow).toBe(8);
    });

    it.each([
      [
        TransferJobState.Cancelled,
        'Transfer stopped at your request. Files already written to the device remain.',
      ],
      [TransferJobState.Aborted, 'The device disconnected mid-transfer.'],
      [
        TransferJobState.Abandoned,
        'The server stopped hearing from this browser and closed the job. Files staged but not yet written were discarded.',
      ],
      [TransferJobState.Completed, null],
    ])('surfaces the terminal reason for %s', (state, expected) => {
      store.applyJobSnapshot({ deviceId, snapshot: createSnapshot({ state }) });
      expect(store.getTransferSummary(deviceId)().reason).toBe(expected);
    });

    it('surfaces the create failure message for device-busy and failed', () => {
      store.setDeviceBusy({ deviceId, activeForeignJobId: 'x', error: 'device is busy' });
      expect(store.getTransferSummary(deviceId)().reason).toBe('device is busy');

      store.setTransferError({ deviceId: 'device-2', error: 'bad destination' });
      expect(store.getTransferSummary('device-2')().reason).toBe('bad destination');
    });
  });

  describe('isDeviceBusy', () => {
    it('is false with no transfer state', () => {
      expect(store.isDeviceBusy(deviceId)()).toBe(false);
    });

    it('is true once the pre-check records a foreign active job', () => {
      store.setActiveForeignJob({ deviceId, activeForeignJobId: 'foreign-job' });
      expect(store.isDeviceBusy(deviceId)()).toBe(true);
    });

    it('is true once create is refused as a conflict', () => {
      store.setDeviceBusy({ deviceId, activeForeignJobId: 'foreign-job', error: 'busy' });
      expect(store.isDeviceBusy(deviceId)()).toBe(true);
    });
  });

  describe('feed and failure caps', () => {
    it('holds the feed and failure list at their caps under a large synthetic job', () => {
      const totalFiles = 200;
      const allCompletions = Array.from({ length: totalFiles }, (_, i) =>
        createCompletion({
          relativePath: `music/file-${i}.sid`,
          success: false,
          error: 'device offline',
        })
      );

      for (let i = 0; i < totalFiles; i++) {
        store.applyJobSnapshot({
          deviceId,
          snapshot: createSnapshot({
            filesFailed: i + 1,
            recentCompletions: [allCompletions[i]],
            failures: allCompletions.slice(0, Math.min(i + 1, TRANSFER_FAILURE_CAP)),
          }),
        });
      }

      const transfer = store.transfers()[deviceId];
      expect(transfer.feed).toHaveLength(TRANSFER_FEED_CAP);
      expect(transfer.failures).toHaveLength(TRANSFER_FAILURE_CAP);
      expect(transfer.feed[0].relativePath).toBe(`music/file-${totalFiles - 1}.sid`);

      const overflow = store.getTransferSummary(deviceId)().failureOverflow;
      expect(overflow).toBe(totalFiles - TRANSFER_FAILURE_CAP);
    });
  });

  describe('action message discipline', () => {
    it('carries an action message on every mutation and never patches state directly', () => {
      const createActionSpy = vi.mocked(createAction);

      store.beginScan({ deviceId, droppedRootName: 'r', destinationLabel: 'd' });
      store.reportScanProgress({ deviceId, scanFound: 1 });
      store.completeScan({ deviceId, scanTotal: 1 });
      store.beginJob({ deviceId });
      store.applyJobSnapshot({ deviceId, snapshot: createSnapshot() });
      store.applyJobSnapshot({ deviceId, snapshot: createSnapshot({ filesReceived: 1 }) });
      store.recordUploadFailure({ deviceId, relativePath: 'x.sid', reason: 'timeout' });
      store.setDeviceBusy({ deviceId, activeForeignJobId: 'x', error: 'busy' });
      store.setTransferError({ deviceId, error: 'nope' });
      store.setActiveForeignJob({ deviceId, activeForeignJobId: null });
      store.clearTransfer({ deviceId });
      store.setTargetDevice({ deviceId });
      store.clearTargetDevice();

      const expectedNames = [
        'begin-scan',
        'report-scan-progress',
        'complete-scan',
        'begin-job',
        'apply-job-snapshot',
        'apply-job-snapshot',
        'record-upload-failure',
        'set-device-busy',
        'set-transfer-error',
        'set-active-foreign-job',
        'clear-transfer',
        'set-target-device',
        'clear-target-device',
      ];

      expect(createActionSpy).toHaveBeenCalledTimes(expectedNames.length);
      expectedNames.forEach((name, index) => {
        expect(createActionSpy.mock.calls[index][0]).toBe(name);
        expect(createActionSpy.mock.results[index].value).toEqual(expect.stringContaining(name));
      });
    });
  });
});
