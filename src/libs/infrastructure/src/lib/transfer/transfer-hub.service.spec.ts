import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  TeensyStorageType,
  TransferJobState as ApiTransferJobState,
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
  basePath: 'http://127.0.0.1:45123',
  signalRBasePath: 'http://127.0.0.1:45123',
  getBaseUrl: () => 'http://127.0.0.1:45123',
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
  startedUtc: new Date('2026-01-01T00:00:00Z'),
  lastActivityUtc: new Date('2026-01-01T00:01:00Z'),
  error: null,
  failures: [],
  recentCompletions: [],
  bytesPerSecond: 0,
  filesPerSecond: 0,
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

  it('stops the connection on disconnect', async () => {
    await service.subscribe('job-1');

    await service.disconnect();

    expect(mocks.__mockHubConnection.stop).toHaveBeenCalledTimes(1);
  });
});
