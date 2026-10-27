import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  TeensyStorageType,
  TransferJobState as ApiTransferJobState,
  TransferLaunchState,
  TransferOriginKind,
} from '@teensyrom-nx/data-access/api-client';
import { API_CONFIG, IApiConfig, TransferJobState, StorageType } from '@teensyrom-nx/domain';
import { TransferHubService } from './transfer-hub.service';

// Mock SignalR - all mocks must be self-contained in the factory
vi.mock('@microsoft/signalr', () => {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  let reconnectedHandler: (() => Promise<void>) | null = null;

  const mockHubConnection = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    invoke: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handler;
    }),
    onreconnected: vi.fn((handler: () => Promise<void>) => {
      reconnectedHandler = handler;
    }),
  };
  const mockBuilder = {
    withUrl: vi.fn().mockReturnThis(),
    withAutomaticReconnect: vi.fn().mockReturnThis(),
    build: vi.fn().mockReturnValue(mockHubConnection),
  };

  return {
    HubConnectionBuilder: vi.fn(() => mockBuilder),
    __mockHubConnection: mockHubConnection,
    __mockBuilder: mockBuilder,
    __handlers: handlers,
    __getReconnectedHandler: () => reconnectedHandler,
  };
});

const getMocks = async () => {
  return (await vi.importMock('@microsoft/signalr')) as unknown as {
    __mockHubConnection: {
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      invoke: ReturnType<typeof vi.fn>;
      on: ReturnType<typeof vi.fn>;
      onreconnected: ReturnType<typeof vi.fn>;
    };
    __mockBuilder: {
      withUrl: ReturnType<typeof vi.fn>;
      withAutomaticReconnect: ReturnType<typeof vi.fn>;
      build: ReturnType<typeof vi.fn>;
    };
    __handlers: Record<string, (...args: unknown[]) => void>;
    __getReconnectedHandler: () => (() => Promise<void>) | null;
  };
};

const mockApiConfig: IApiConfig = {
  basePath: 'http://localhost:10213',
  signalRBasePath: 'http://localhost:10213',
  getBaseUrl: () => 'http://localhost:10213',
};

const jobDto = {
  jobId: 'job-1',
  deviceId: 'device-1',
  storageType: TeensyStorageType.Sd,
  destinationDirectory: '/games/',
  state: ApiTransferJobState.Receiving,
  filesReceived: 1,
  filesSent: 1,
  filesFailed: 0,
  bytesSent: 100,
  totalFiles: 3,
  currentFile: 'a.prg',
  origin: { kind: TransferOriginKind.Upload },
  startedUtc: new Date('2026-01-01T00:00:00Z'),
  lastActivityUtc: new Date('2026-01-01T00:01:00Z'),
  error: null,
  failures: [],
  recentCompletions: [],
  bytesPerSecond: 0,
  filesPerSecond: 0,
  expansionBytesWritten: 0,
  expansionBytesDeclared: 0,
  launchState: TransferLaunchState.None,
};

describe('TransferHubService', () => {
  let service: TransferHubService;
  let mocks: Awaited<ReturnType<typeof getMocks>>;

  beforeEach(async () => {
    mocks = await getMocks();
    mocks.__mockHubConnection.start.mockResolvedValue(undefined);
    mocks.__mockHubConnection.stop.mockResolvedValue(undefined);
    mocks.__mockHubConnection.invoke.mockResolvedValue({ ...jobDto });
    mocks.__mockBuilder.build.mockReturnValue(mocks.__mockHubConnection);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [TransferHubService, { provide: API_CONFIG, useValue: mockApiConfig }],
    });

    service = TestBed.inject(TransferHubService);

    // resetTestingModule() above destroys the previous test's service, which triggers its
    // ngOnDestroy -> disconnect() -> connection.stop(). Clear call counts recorded from that
    // teardown so each test's assertions only see calls it made itself.
    mocks.__mockHubConnection.start.mockClear();
    mocks.__mockHubConnection.stop.mockClear();
    mocks.__mockHubConnection.invoke.mockClear();
    mocks.__mockBuilder.build.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts the connection, invokes Subscribe with the job id, and returns the mapped snapshot for immediate seeding', async () => {
    const snapshot = await service.subscribe('job-1');

    expect(mocks.__mockHubConnection.start).toHaveBeenCalledTimes(1);
    expect(mocks.__mockHubConnection.invoke).toHaveBeenCalledWith('Subscribe', 'job-1');
    expect(snapshot.jobId).toBe('job-1');
    expect(snapshot.state).toBe(TransferJobState.Receiving);
    expect(snapshot.storageType).toBe(StorageType.Sd);
  });

  it('emits subsequent JobSnapshot pushes on snapshots$', async () => {
    await service.subscribe('job-1');
    const emitted: Array<{ filesReceived: number }> = [];
    service.snapshots$.subscribe((snapshot) => emitted.push(snapshot));

    mocks.__handlers['JobSnapshot']({ ...jobDto, filesReceived: 2 });

    expect(emitted).toHaveLength(1);
    expect(emitted[0].filesReceived).toBe(2);
  });

  it('registers only the JobSnapshot handler on the connection', async () => {
    await service.subscribe('job-1');

    expect(Object.keys(mocks.__handlers)).toEqual(['JobSnapshot']);
  });

  it('re-invokes Subscribe with the same job id on reconnect and resumes emitting snapshots', async () => {
    await service.subscribe('job-1');
    const emitted: Array<{ filesReceived: number }> = [];
    service.snapshots$.subscribe((snapshot) => emitted.push(snapshot));

    mocks.__mockHubConnection.invoke.mockClear();
    mocks.__mockHubConnection.invoke.mockResolvedValue({ ...jobDto, filesReceived: 5 });

    const reconnected = mocks.__getReconnectedHandler();
    expect(reconnected).toBeTruthy();
    await reconnected?.();

    expect(mocks.__mockHubConnection.invoke).toHaveBeenCalledWith('Subscribe', 'job-1');
    expect(emitted).toHaveLength(1);
    expect(emitted[0].filesReceived).toBe(5);
  });

  it('clears the active subscription without surfacing an error when reconnect finds the job evicted', async () => {
    await service.subscribe('job-1');
    const emitted: unknown[] = [];
    service.snapshots$.subscribe((snapshot) => emitted.push(snapshot));

    mocks.__mockHubConnection.invoke.mockClear();
    mocks.__mockHubConnection.invoke.mockRejectedValueOnce(new Error('Unknown job id'));

    const reconnected = mocks.__getReconnectedHandler();
    await expect(reconnected?.()).resolves.not.toThrow();
    expect(emitted).toHaveLength(0);

    // The active job was cleared, so a later reconnect must not re-invoke Subscribe.
    mocks.__mockHubConnection.invoke.mockClear();
    await reconnected?.();
    expect(mocks.__mockHubConnection.invoke).not.toHaveBeenCalled();
  });

  it('invokes Unsubscribe and clears the active job id so a later reconnect does not re-subscribe', async () => {
    await service.subscribe('job-1');
    mocks.__mockHubConnection.invoke.mockClear();
    mocks.__mockHubConnection.invoke.mockResolvedValue(undefined);

    await service.unsubscribe('job-1');

    expect(mocks.__mockHubConnection.invoke).toHaveBeenCalledWith('Unsubscribe', 'job-1');

    mocks.__mockHubConnection.invoke.mockClear();
    const reconnected = mocks.__getReconnectedHandler();
    await reconnected?.();
    expect(mocks.__mockHubConnection.invoke).not.toHaveBeenCalled();
  });

  it('rejoins every subscribed job on reconnect and drops one whose Subscribe is rejected', async () => {
    await service.subscribe('job-1');
    await service.subscribe('job-2');
    const emitted: string[] = [];
    service.snapshots$.subscribe((snapshot) => emitted.push(snapshot.jobId));

    mocks.__mockHubConnection.invoke.mockClear();
    mocks.__mockHubConnection.invoke.mockImplementation(async (_method: string, jobId: string) => {
      if (jobId === 'job-1') throw new Error('Unknown job id');
      return { ...jobDto, jobId, filesReceived: 9 };
    });

    const reconnected = mocks.__getReconnectedHandler();
    await reconnected?.();

    expect(mocks.__mockHubConnection.invoke).toHaveBeenCalledWith('Subscribe', 'job-1');
    expect(mocks.__mockHubConnection.invoke).toHaveBeenCalledWith('Subscribe', 'job-2');
    expect(emitted).toEqual(['job-2']);

    mocks.__mockHubConnection.invoke.mockClear();
    await reconnected?.();
    expect(mocks.__mockHubConnection.invoke).not.toHaveBeenCalledWith('Subscribe', 'job-1');
    expect(mocks.__mockHubConnection.invoke).toHaveBeenCalledWith('Subscribe', 'job-2');
  });

  it('keeps the other jobs subscribed when one is unsubscribed', async () => {
    await service.subscribe('job-1');
    await service.subscribe('job-2');
    await service.unsubscribe('job-1');

    mocks.__mockHubConnection.invoke.mockClear();
    mocks.__mockHubConnection.invoke.mockResolvedValue({ ...jobDto, jobId: 'job-2' });
    await mocks.__getReconnectedHandler()?.();

    expect(mocks.__mockHubConnection.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.__mockHubConnection.invoke).toHaveBeenCalledWith('Subscribe', 'job-2');
  });

  describe('all-transfers subscription', () => {
    it('invokes SubscribeAll and maps the returned list in the order the server sent it', async () => {
      mocks.__mockHubConnection.invoke.mockResolvedValue([
        {
          ...jobDto,
          jobId: 'job-b',
          origin: { kind: TransferOriginKind.WatchFolder, watchFolderPath: 'C:/in' },
        },
        { ...jobDto, jobId: 'job-a', launchState: TransferLaunchState.Pending },
      ]);

      const snapshots = await service.subscribeAll();

      expect(mocks.__mockHubConnection.invoke).toHaveBeenCalledWith('SubscribeAll');
      expect(snapshots.map((s) => s.jobId)).toEqual(['job-b', 'job-a']);
      expect(snapshots[0].origin.watchFolderPath).toBe('C:/in');
      expect(snapshots[1].launchState).toBe('Pending');
    });

    it('re-invokes SubscribeAll on reconnect and emits the full list on allResynced$', async () => {
      mocks.__mockHubConnection.invoke.mockResolvedValue([]);
      await service.subscribeAll();
      const resynced: string[][] = [];
      service.allResynced$.subscribe((list) => resynced.push(list.map((s) => s.jobId)));

      mocks.__mockHubConnection.invoke.mockClear();
      mocks.__mockHubConnection.invoke.mockResolvedValue([
        { ...jobDto, jobId: 'job-1' },
        { ...jobDto, jobId: 'job-2' },
      ]);
      await mocks.__getReconnectedHandler()?.();

      expect(mocks.__mockHubConnection.invoke).toHaveBeenCalledWith('SubscribeAll');
      expect(resynced).toEqual([['job-1', 'job-2']]);
    });

    it('rejoins both a subscribed job and the all group on reconnect', async () => {
      mocks.__mockHubConnection.invoke.mockResolvedValue([]);
      await service.subscribeAll();
      mocks.__mockHubConnection.invoke.mockResolvedValue({ ...jobDto });
      await service.subscribe('job-1');

      mocks.__mockHubConnection.invoke.mockClear();
      mocks.__mockHubConnection.invoke.mockImplementation(async (method: string) =>
        method === 'SubscribeAll' ? [] : { ...jobDto, filesReceived: 7 }
      );
      await mocks.__getReconnectedHandler()?.();

      expect(mocks.__mockHubConnection.invoke).toHaveBeenCalledWith('Subscribe', 'job-1');
      expect(mocks.__mockHubConnection.invoke).toHaveBeenCalledWith('SubscribeAll');
    });

    it('joins the all group on a connection first made by another call after a failed subscribeAll', async () => {
      mocks.__mockHubConnection.start.mockRejectedValueOnce(new Error('engine down'));
      await expect(service.subscribeAll()).rejects.toThrow('engine down');

      const resynced: string[][] = [];
      service.allResynced$.subscribe((list) => resynced.push(list.map((s) => s.jobId)));
      mocks.__mockHubConnection.invoke.mockImplementation(async (method: string) =>
        method === 'SubscribeAll' ? [{ ...jobDto, jobId: 'job-9' }] : { ...jobDto }
      );

      await service.subscribe('job-1');

      expect(mocks.__mockHubConnection.invoke).toHaveBeenCalledWith('SubscribeAll');
      expect(resynced).toEqual([['job-9']]);
    });

    it('does not rejoin the all group on the connection its own subscribeAll built', async () => {
      mocks.__mockHubConnection.invoke.mockResolvedValue([]);
      const resynced: unknown[] = [];
      service.allResynced$.subscribe((list) => resynced.push(list));

      await service.subscribeAll();

      expect(mocks.__mockHubConnection.invoke).toHaveBeenCalledTimes(1);
      expect(resynced).toEqual([]);
    });

    it('invokes UnsubscribeAll and stops rejoining the all group', async () => {
      mocks.__mockHubConnection.invoke.mockResolvedValue([]);
      await service.subscribeAll();
      await service.unsubscribeAll();

      expect(mocks.__mockHubConnection.invoke).toHaveBeenCalledWith('UnsubscribeAll');

      mocks.__mockHubConnection.invoke.mockClear();
      await mocks.__getReconnectedHandler()?.();
      expect(mocks.__mockHubConnection.invoke).not.toHaveBeenCalled();
    });
  });

  describe('duplicate pushes', () => {
    it("drops a push identical to that job's previous push", async () => {
      await service.subscribe('job-1');
      const emitted: unknown[] = [];
      service.snapshots$.subscribe((snapshot) => emitted.push(snapshot));

      mocks.__handlers['JobSnapshot']({ ...jobDto, filesReceived: 2 });
      mocks.__handlers['JobSnapshot']({ ...jobDto, filesReceived: 2 });

      expect(emitted).toHaveLength(1);
    });

    it('forwards a changed push, and the same content again after a different one', async () => {
      await service.subscribe('job-1');
      const emitted: number[] = [];
      service.snapshots$.subscribe((snapshot) => emitted.push(snapshot.filesReceived));

      mocks.__handlers['JobSnapshot']({ ...jobDto, filesReceived: 2 });
      mocks.__handlers['JobSnapshot']({ ...jobDto, filesReceived: 3 });
      mocks.__handlers['JobSnapshot']({ ...jobDto, filesReceived: 2 });

      expect(emitted).toEqual([2, 3, 2]);
    });

    it('tracks repeats per job', async () => {
      await service.subscribe('job-1');
      const emitted: string[] = [];
      service.snapshots$.subscribe((snapshot) => emitted.push(snapshot.jobId));

      mocks.__handlers['JobSnapshot']({ ...jobDto, jobId: 'job-1' });
      mocks.__handlers['JobSnapshot']({ ...jobDto, jobId: 'job-2' });
      mocks.__handlers['JobSnapshot']({ ...jobDto, jobId: 'job-1' });

      expect(emitted).toEqual(['job-1', 'job-2']);
    });

    it('forgets the last pushes on disconnect', async () => {
      await service.subscribe('job-1');
      const emitted: unknown[] = [];
      service.snapshots$.subscribe((snapshot) => emitted.push(snapshot));

      mocks.__handlers['JobSnapshot']({ ...jobDto });
      await service.disconnect();
      mocks.__handlers['JobSnapshot']({ ...jobDto });

      expect(emitted).toHaveLength(2);
    });
  });

  it('stops the connection on disconnect', async () => {
    await service.subscribe('job-1');

    await service.disconnect();

    expect(mocks.__mockHubConnection.stop).toHaveBeenCalledTimes(1);
  });
});
