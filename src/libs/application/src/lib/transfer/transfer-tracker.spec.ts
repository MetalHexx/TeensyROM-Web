import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import {
  ALERT_SERVICE,
  ITransferHubService,
  StorageType,
  TRANSFER_HUB_SERVICE,
  TRANSFER_SERVICE,
  TransferJobSnapshot,
  TransferJobState,
  TransferLaunchState,
  TransferOriginKind,
} from '@teensyrom-nx/domain';
import { DeviceStore } from '../device/device-store';
import { StorageStore } from '../storage/storage-store';
import { TransferContextService } from './transfer-context.service';
import { TransferHubListener } from './transfer-hub-listener';
import { TransferStore } from './transfer-store';
import { TransferTracker } from './transfer-tracker';

const createSnapshot = (overrides: Partial<TransferJobSnapshot> = {}): TransferJobSnapshot => ({
  jobId: 'job-1',
  deviceId: 'device-1',
  storageType: StorageType.Sd,
  destinationDirectory: '/games/',
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
  expandedFileCount: 0,
  launchState: TransferLaunchState.None,
  launchedPath: null,
  launchError: null,
  ...overrides,
});

const NEWER = new Date('2026-01-01T00:05:00Z');

/** Lets every pending microtask, and so the tracker's whole queue, settle. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('TransferTracker', () => {
  let tracker: TransferTracker;
  let store: InstanceType<typeof TransferStore>;
  let context: TransferContextService;
  let snapshots$: Subject<TransferJobSnapshot>;
  let allResynced$: Subject<TransferJobSnapshot[]>;
  let hub: {
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
    subscribeAll: ReturnType<typeof vi.fn>;
    unsubscribeAll: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    snapshots$: Subject<TransferJobSnapshot>;
    allResynced$: Subject<TransferJobSnapshot[]>;
  };
  let alerts: {
    info: ReturnType<typeof vi.fn>;
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    snapshots$ = new Subject<TransferJobSnapshot>();
    allResynced$ = new Subject<TransferJobSnapshot[]>();
    hub = {
      subscribe: vi.fn(async () => createSnapshot()),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      subscribeAll: vi.fn().mockResolvedValue([]),
      unsubscribeAll: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      snapshots$,
      allResynced$,
    };
    alerts = { info: vi.fn(), success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: TRANSFER_HUB_SERVICE, useValue: hub as unknown as ITransferHubService },
        { provide: TRANSFER_SERVICE, useValue: { cancelJob: vi.fn() } },
        { provide: ALERT_SERVICE, useValue: alerts },
        {
          provide: DeviceStore,
          useValue: { devices: signal([{ deviceId: 'device-1', name: 'My TeensyROM' }]) },
        },
        {
          provide: StorageStore,
          useValue: { getSelectedDirectoryForDevice: vi.fn().mockReturnValue(null) },
        },
      ],
    });

    tracker = TestBed.inject(TransferTracker);
    store = TestBed.inject(TransferStore);
    context = TestBed.inject(TransferContextService);
  });

  afterEach(async () => {
    await tracker.stop();
    vi.useRealTimers();
  });

  const push = async (snapshot: TransferJobSnapshot) => {
    snapshots$.next(snapshot);
    await settle();
  };

  const resync = async (list: TransferJobSnapshot[]) => {
    allResynced$.next(list);
    await settle();
  };

  /** This tab's own drop, with the dialog hidden, whose create response has been applied. */
  const startOwnJob = (snapshot = createSnapshot({ jobId: 'mine' })) => {
    store.beginScan({ deviceId: 'device-1', droppedRootName: 'games', destinationLabel: '/games' });
    store.completeScan({ deviceId: 'device-1', scanTotal: 4 });
    store.beginJob({ deviceId: 'device-1' });
    store.applyJobSnapshot({ deviceId: 'device-1', snapshot });
    store.hideTransferDetails();
  };

  describe('starting', () => {
    it('seeds the store from the all-transfers list without a start alert', async () => {
      hub.subscribeAll.mockResolvedValue([
        createSnapshot({ jobId: 'job-b', deviceId: 'device-2', startedUtc: NEWER }),
        createSnapshot({ jobId: 'job-a', filesSent: 2, totalFiles: 5 }),
      ]);

      await tracker.start();

      expect(store.getLiveTransfers()().map((live) => live.jobId)).toEqual(['job-a', 'job-b']);
      expect(alerts.info).not.toHaveBeenCalled();
    });

    it('marks an ended job in the seed as announced and does not fold it', async () => {
      hub.subscribeAll.mockResolvedValue([
        createSnapshot({ state: TransferJobState.Completed, filesSent: 3 }),
      ]);
      await tracker.start();

      await push(createSnapshot({ state: TransferJobState.Completed, filesSent: 3 }));

      expect(store.transfers()['device-1']).toBeUndefined();
      expect(alerts.success).not.toHaveBeenCalled();
      expect(alerts.error).not.toHaveBeenCalled();
    });

    it('listens to snapshots and resyncs before it joins the group', async () => {
      let listening: boolean[] = [];
      hub.subscribeAll.mockImplementation(async () => {
        listening = [snapshots$.observed, allResynced$.observed];
        return [];
      });

      await tracker.start();

      expect(listening).toEqual([true, true]);
    });

    it('is idempotent', async () => {
      await Promise.all([tracker.start(), tracker.start()]);
      await tracker.start();

      expect(hub.subscribeAll).toHaveBeenCalledTimes(1);
      expect(snapshots$.observers).toHaveLength(1);
    });

    it('retries every 10 seconds after a failed first subscription until one succeeds', async () => {
      vi.useFakeTimers();
      hub.subscribeAll
        .mockRejectedValueOnce(new Error('no engine yet'))
        .mockRejectedValueOnce(new Error('still no engine'))
        .mockResolvedValue([createSnapshot({ filesSent: 1 })]);

      await tracker.start();
      expect(hub.subscribeAll).toHaveBeenCalledTimes(1);
      expect(store.getLiveTransfers()()).toEqual([]);

      await vi.advanceTimersByTimeAsync(9_999);
      expect(hub.subscribeAll).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(hub.subscribeAll).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(10_000);
      expect(hub.subscribeAll).toHaveBeenCalledTimes(3);
      expect(store.getLiveTransfers()()).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(hub.subscribeAll).toHaveBeenCalledTimes(3);
    });

    it('treats the first list a rejoining connection delivers as the seed', async () => {
      vi.useFakeTimers();
      hub.subscribeAll.mockRejectedValue(new Error('no engine yet'));
      await tracker.start();

      allResynced$.next([createSnapshot({ filesSent: 1 })]);
      await vi.advanceTimersByTimeAsync(0);

      expect(store.getLiveTransfers()()).toHaveLength(1);
      expect(alerts.info).not.toHaveBeenCalled();
    });

    it('stop cancels a pending retry and leaves the group', async () => {
      vi.useFakeTimers();
      hub.subscribeAll.mockRejectedValue(new Error('no engine yet'));
      await tracker.start();

      await tracker.stop();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(hub.subscribeAll).toHaveBeenCalledTimes(1);
      expect(hub.unsubscribeAll).toHaveBeenCalledTimes(1);
    });

    it('ignores pushes once stopped', async () => {
      await tracker.start();
      await tracker.stop();

      await push(createSnapshot());

      expect(store.transfers()['device-1']).toBeUndefined();
      expect(alerts.info).not.toHaveBeenCalled();
    });
  });

  describe('start and end alerts', () => {
    beforeEach(async () => {
      await tracker.start();
    });

    it('announces a new job once, folds it, and names the device', async () => {
      await push(createSnapshot({ totalFiles: 3 }));
      await push(createSnapshot({ totalFiles: 3, filesSent: 1 }));

      expect(alerts.info).toHaveBeenCalledTimes(1);
      expect(alerts.info).toHaveBeenCalledWith('Sending 3 files to My TeensyROM');
      expect(store.transfers()['device-1'].job?.filesSent).toBe(1);
    });

    it('falls back to the device id for an unknown device', async () => {
      await push(createSnapshot({ deviceId: 'device-9', jobId: 'job-9' }));

      expect(alerts.info).toHaveBeenCalledWith('Sending files to device-9');
    });

    it('announces a good end once, then takes the ended entry out of the store', async () => {
      await push(createSnapshot({ totalFiles: 3 }));
      const completed = createSnapshot({
        state: TransferJobState.Completed,
        filesSent: 3,
        totalFiles: 3,
      });
      await push(completed);
      await push({ ...completed, lastActivityUtc: NEWER });

      expect(alerts.success).toHaveBeenCalledTimes(1);
      expect(alerts.success).toHaveBeenCalledWith('Sent 3 files to My TeensyROM');
      expect(alerts.error).not.toHaveBeenCalled();
      expect(store.transfers()['device-1'].phase).toBe('idle');
    });

    it('reports every other end as an error', async () => {
      await push(createSnapshot());
      await push(createSnapshot({ state: TransferJobState.Aborted, filesSent: 1, error: 'unplugged' }));

      expect(alerts.error).toHaveBeenCalledWith(
        'Transfer to My TeensyROM stopped: unplugged · 1 file sent'
      );
    });

    it('gives a job first seen already ended only the end alert', async () => {
      await push(
        createSnapshot({ jobId: 'quick', state: TransferJobState.Completed, filesSent: 2 })
      );

      expect(alerts.info).not.toHaveBeenCalled();
      expect(alerts.success).toHaveBeenCalledWith('Sent 2 files to My TeensyROM');
      expect(store.transfers()['device-1'].phase).toBe('idle');
    });

    it('holds the end alert until the launch has settled', async () => {
      await push(createSnapshot());
      const ended = createSnapshot({
        state: TransferJobState.Completed,
        filesSent: 1,
        launchState: TransferLaunchState.Pending,
        launchedPath: '/games/a.prg',
      });
      await push(ended);

      expect(alerts.success).not.toHaveBeenCalled();
      expect(store.transfers()['device-1'].job?.state).toBe(TransferJobState.Completed);

      await push({ ...ended, launchState: TransferLaunchState.Launched });

      expect(alerts.success).toHaveBeenCalledTimes(1);
      expect(alerts.success).toHaveBeenCalledWith('Sent 1 file to My TeensyROM · launched a.prg');
      expect(store.transfers()['device-1'].phase).toBe('idle');
    });

    it('keeps the entry the dialog shows until it is hidden', async () => {
      await push(createSnapshot());
      store.showTransferDetails({ deviceId: 'device-1' });

      await push(createSnapshot({ state: TransferJobState.Completed, filesSent: 1 }));

      expect(alerts.success).toHaveBeenCalledTimes(1);
      expect(store.transfers()['device-1'].job?.state).toBe(TransferJobState.Completed);

      await context.hideDetails();

      expect(store.transfers()['device-1'].phase).toBe('idle');
      expect(store.getDetailsDeviceId()()).toBeNull();
    });

    it('never drops a newer job when an older job launch settles late', async () => {
      await push(createSnapshot({ jobId: 'old' }));
      const oldEnded = createSnapshot({
        jobId: 'old',
        state: TransferJobState.Completed,
        filesSent: 2,
        launchState: TransferLaunchState.Pending,
        launchedPath: '/games/a.prg',
      });
      await push(oldEnded);
      await push(createSnapshot({ jobId: 'new', startedUtc: NEWER }));

      await push({ ...oldEnded, launchState: TransferLaunchState.Launched });

      expect(alerts.success).toHaveBeenCalledTimes(1);
      expect(alerts.info).toHaveBeenCalledTimes(2);
      expect(store.transfers()['device-1'].job?.jobId).toBe('new');
    });

    it('does not bring back an entry for a job whose end was already announced', async () => {
      await push(createSnapshot({ state: TransferJobState.Completed }));
      expect(store.transfers()['device-1'].phase).toBe('idle');

      await push(createSnapshot({ state: TransferJobState.Completed, lastActivityUtc: NEWER }));

      expect(store.transfers()['device-1'].job).toBeNull();
      expect(alerts.success).toHaveBeenCalledTimes(1);
    });

    it('uses the scan total for this tab own drop whose create is still in flight', async () => {
      store.beginScan({ deviceId: 'device-1', droppedRootName: 'games', destinationLabel: '/games' });
      store.completeScan({ deviceId: 'device-1', scanTotal: 4 });
      store.beginJob({ deviceId: 'device-1' });

      await push(createSnapshot({ jobId: 'mine', state: TransferJobState.Created, totalFiles: null }));

      expect(alerts.info).toHaveBeenCalledWith('Sending 4 files to My TeensyROM');
      expect(store.transfers()['device-1'].job).toBeNull();
    });

    it('does not borrow this tab scan total for a job from elsewhere', async () => {
      store.beginScan({ deviceId: 'device-1', droppedRootName: 'games', destinationLabel: '/games' });
      store.completeScan({ deviceId: 'device-1', scanTotal: 4 });
      store.setDeviceBusy({ deviceId: 'device-1', activeForeignJobId: null, error: 'busy' });

      await push(createSnapshot({ jobId: 'theirs' }));

      expect(alerts.info).toHaveBeenCalledWith('Sending files to My TeensyROM');
      expect(store.transfers()['device-1'].activeForeignJobId).toBe('theirs');
    });
  });

  describe('this tab own transfers', () => {
    beforeEach(async () => {
      await tracker.start();
    });

    it('follows the own job through the pushes to the end, then closes it and its subscription', async () => {
      hub.subscribe.mockResolvedValue(createSnapshot({ jobId: 'mine' }));
      startOwnJob();
      await TestBed.inject(TransferHubListener).start('device-1', 'mine');

      await push(createSnapshot({ jobId: 'mine', filesSent: 2 }));
      expect(store.transfers()['device-1'].job?.filesSent).toBe(2);

      await push(createSnapshot({ jobId: 'mine', state: TransferJobState.Completed, filesSent: 4 }));

      expect(alerts.success).toHaveBeenCalledTimes(1);
      expect(hub.unsubscribe).toHaveBeenCalledWith('mine');
      expect(store.transfers()['device-1'].phase).toBe('idle');
    });

    it('lets go of an ended own transfer records before a newer job from elsewhere replaces it', async () => {
      hub.subscribe.mockResolvedValue(createSnapshot({ jobId: 'mine', state: TransferJobState.Completed }));
      startOwnJob(createSnapshot({ jobId: 'mine', state: TransferJobState.Completed }));
      await TestBed.inject(TransferHubListener).start('device-1', 'mine');
      store.showTransferDetails({ deviceId: 'device-1' });

      await push(createSnapshot({ jobId: 'theirs', startedUtc: NEWER }));

      expect(hub.unsubscribe).toHaveBeenCalledWith('mine');
      const entry = store.transfers()['device-1'];
      expect(entry.job?.jobId).toBe('theirs');
      expect(entry.startedHere).toBe(false);
      expect(store.getDetailsDeviceId()()).toBe('device-1');
    });

    it('keeps two own transfers on different devices apart', async () => {
      hub.subscribe.mockImplementation(async (jobId: string) =>
        createSnapshot({ jobId, deviceId: jobId === 'mine-1' ? 'device-1' : 'device-2' })
      );
      startOwnJob(createSnapshot({ jobId: 'mine-1' }));
      store.beginScan({ deviceId: 'device-2', droppedRootName: 'b', destinationLabel: '/b' });
      store.applyJobSnapshot({
        deviceId: 'device-2',
        snapshot: createSnapshot({ jobId: 'mine-2', deviceId: 'device-2' }),
      });
      store.hideTransferDetails();
      const listener = TestBed.inject(TransferHubListener);
      await listener.start('device-1', 'mine-1');
      await listener.start('device-2', 'mine-2');

      await push(createSnapshot({ jobId: 'mine-1', state: TransferJobState.Completed }));

      expect(hub.unsubscribe).toHaveBeenCalledTimes(1);
      expect(hub.unsubscribe).toHaveBeenCalledWith('mine-1');
      expect(store.transfers()['device-1'].phase).toBe('idle');
      expect(store.transfers()['device-2'].job?.jobId).toBe('mine-2');
    });

    it('leaves an own refusal alone when the foreign job behind it ends', async () => {
      store.beginScan({ deviceId: 'device-1', droppedRootName: 'games', destinationLabel: '/games' });
      store.setDeviceBusy({ deviceId: 'device-1', activeForeignJobId: 'theirs', error: 'busy' });

      await push(createSnapshot({ jobId: 'theirs', state: TransferJobState.Completed }));

      const entry = store.transfers()['device-1'];
      expect(entry.phase).toBe('device-busy');
      expect(entry.activeForeignJobId).toBeNull();
      expect(alerts.success).toHaveBeenCalledTimes(1);
    });
  });

  describe('resync after a reconnect', () => {
    beforeEach(async () => {
      hub.subscribeAll.mockResolvedValue([createSnapshot({ filesSent: 1 })]);
      await tracker.start();
    });

    it('announces the end of a job that ended during the gap, once, and drops it', async () => {
      const ended = createSnapshot({ state: TransferJobState.Completed, filesSent: 4 });

      await resync([ended]);
      await resync([ended]);

      expect(alerts.success).toHaveBeenCalledTimes(1);
      expect(alerts.success).toHaveBeenCalledWith('Sent 4 files to My TeensyROM');
      expect(store.transfers()['device-1'].phase).toBe('idle');
    });

    it('waits for the launch of a job that ended during the gap to settle', async () => {
      const pending = createSnapshot({
        state: TransferJobState.Completed,
        launchState: TransferLaunchState.Pending,
        launchedPath: '/games/a.prg',
      });

      await resync([pending]);
      expect(alerts.success).not.toHaveBeenCalled();

      await push({ ...pending, launchState: TransferLaunchState.Launched });
      expect(alerts.success).toHaveBeenCalledTimes(1);
    });

    it('ignores an ended job it never saw', async () => {
      await resync([
        createSnapshot({ jobId: 'job-1', filesSent: 1 }),
        createSnapshot({ jobId: 'old', deviceId: 'device-2', state: TransferJobState.Completed }),
      ]);

      expect(alerts.success).not.toHaveBeenCalled();
      expect(alerts.error).not.toHaveBeenCalled();
      expect(store.transfers()['device-2']).toBeUndefined();
    });

    it('announces a job it never saw that is still running, and folds it', async () => {
      await resync([
        createSnapshot({ jobId: 'job-1', filesSent: 1 }),
        createSnapshot({ jobId: 'new', deviceId: 'device-2', startedUtc: NEWER }),
      ]);

      expect(alerts.info).toHaveBeenCalledTimes(1);
      expect(store.transfers()['device-2'].job?.jobId).toBe('new');
    });

    it('evicts a live entry that is no longer in the list, silently', async () => {
      store.showTransferDetails({ deviceId: 'device-1' });

      await resync([]);

      expect(store.transfers()['device-1'].phase).toBe('idle');
      expect(store.getDetailsDeviceId()()).toBeNull();
      expect(alerts.success).not.toHaveBeenCalled();
      expect(alerts.error).not.toHaveBeenCalled();
    });

    it('does not evict an own entry that has no job yet', async () => {
      store.beginScan({ deviceId: 'device-2', droppedRootName: 'b', destinationLabel: '/b' });

      await resync([createSnapshot({ jobId: 'job-1', filesSent: 1 })]);

      expect(store.transfers()['device-2'].phase).toBe('scanning');
    });

    it('evicts an own live entry whose job is gone, closing its subscription', async () => {
      hub.subscribe.mockResolvedValue(createSnapshot({ jobId: 'mine', deviceId: 'device-2' }));
      store.beginScan({ deviceId: 'device-2', droppedRootName: 'b', destinationLabel: '/b' });
      store.applyJobSnapshot({
        deviceId: 'device-2',
        snapshot: createSnapshot({ jobId: 'mine', deviceId: 'device-2' }),
      });
      await TestBed.inject(TransferHubListener).start('device-2', 'mine');

      await resync([createSnapshot({ jobId: 'job-1', filesSent: 1 })]);

      expect(hub.unsubscribe).toHaveBeenCalledWith('mine');
      expect(store.transfers()['device-2'].phase).toBe('idle');
    });
  });
});
