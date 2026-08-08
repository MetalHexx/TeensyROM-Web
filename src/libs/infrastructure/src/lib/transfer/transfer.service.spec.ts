import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TransfersApiService,
  ResponseError,
  TeensyStorageType,
  TransferJobState as ApiTransferJobState,
} from '@teensyrom-nx/data-access/api-client';
import {
  IApiConfig,
  StorageType,
  TransferJobState,
  TransferDeviceBusyError,
  TransferCreateRejectedError,
  TransferUploadError,
} from '@teensyrom-nx/domain';
import { TransferService } from './transfer.service';

class MockXMLHttpRequest {
  static instances: MockXMLHttpRequest[] = [];

  method = '';
  url = '';
  status = 0;
  headers: Record<string, string> = {};
  sentBody: unknown = null;
  aborted = false;
  timeoutWasSet = false;
  private _timeout = 0;

  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    MockXMLHttpRequest.instances.push(this);
  }

  get timeout(): number {
    return this._timeout;
  }

  set timeout(value: number) {
    this.timeoutWasSet = true;
    this._timeout = value;
  }

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  send(body: unknown): void {
    this.sentBody = body;
  }

  abort(): void {
    this.aborted = true;
    this.onabort?.();
  }
}

describe('TransferService', () => {
  let mockApi: {
    createTransferJob: ReturnType<typeof vi.fn>;
    getActiveTransferJob: ReturnType<typeof vi.fn>;
    sealTransferJob: ReturnType<typeof vi.fn>;
    cancelTransferJob: ReturnType<typeof vi.fn>;
  };
  let apiConfig: IApiConfig;
  let service: TransferService;

  const jobDto = {
    jobId: 'job-1',
    deviceId: 'device-1',
    storageType: TeensyStorageType.Sd,
    destinationDirectory: '/games/',
    state: ApiTransferJobState.Created,
    filesReceived: 0,
    filesSent: 0,
    filesFailed: 0,
    bytesSent: 0,
    totalFiles: null,
    currentFile: null,
    startedUtc: new Date('2026-01-01T00:00:00Z'),
    lastActivityUtc: new Date('2026-01-01T00:00:00Z'),
    error: null,
    failures: [],
  };

  beforeEach(() => {
    mockApi = {
      createTransferJob: vi.fn(),
      getActiveTransferJob: vi.fn(),
      sealTransferJob: vi.fn(),
      cancelTransferJob: vi.fn(),
    };
    apiConfig = {
      basePath: 'http://localhost:5168',
      signalRBasePath: 'http://localhost:5168',
      getBaseUrl: () => 'http://localhost:5168',
    };
    service = new TransferService(mockApi as unknown as TransfersApiService, apiConfig);
  });

  describe('createJob', () => {
    it('maps a successful create response into the domain snapshot', async () => {
      mockApi.createTransferJob.mockResolvedValue({ jobId: 'job-1', job: jobDto });

      const snapshot = await service.createJob('device-1', StorageType.Sd, '/games');

      expect(snapshot.jobId).toBe('job-1');
      expect(snapshot.state).toBe(TransferJobState.Created);
      expect(mockApi.createTransferJob).toHaveBeenCalledWith({
        deviceId: 'device-1',
        storageType: 'SD',
        createJobBody: { destinationDirectory: '/games' },
      });
    });

    it('surfaces TransferDeviceBusyError with the holding job id on a 409', async () => {
      const response = new Response(JSON.stringify({ title: 'Device busy', activeJobId: 'job-42' }), {
        status: 409,
      });
      mockApi.createTransferJob.mockRejectedValue(new ResponseError(response, 'error'));

      const error = await service.createJob('device-1', StorageType.Sd, '/games').catch((e) => e);

      expect(error).toBeInstanceOf(TransferDeviceBusyError);
      expect((error as TransferDeviceBusyError).activeJobId).toBe('job-42');
    });

    it('surfaces TransferCreateRejectedError on a 400', async () => {
      const response = new Response(JSON.stringify({ title: 'Bad destination' }), { status: 400 });
      mockApi.createTransferJob.mockRejectedValue(new ResponseError(response, 'error'));

      const error = await service.createJob('device-1', StorageType.Sd, '/bad').catch((e) => e);

      expect(error).toBeInstanceOf(TransferCreateRejectedError);
    });
  });

  describe('getActiveJob', () => {
    it('returns null for the idle no-active-job case rather than throwing', async () => {
      mockApi.getActiveTransferJob.mockResolvedValue({ job: null });

      await expect(service.getActiveJob('device-1')).resolves.toBeNull();
    });

    it('maps a present active job into the domain snapshot', async () => {
      mockApi.getActiveTransferJob.mockResolvedValue({ job: jobDto });

      const snapshot = await service.getActiveJob('device-1');

      expect(snapshot?.jobId).toBe('job-1');
    });
  });

  describe('sealJob / cancelJob', () => {
    it('seals a job through TransfersApiService', async () => {
      mockApi.sealTransferJob.mockResolvedValue({ job: jobDto });

      await service.sealJob('job-1');

      expect(mockApi.sealTransferJob).toHaveBeenCalledWith({ jobId: 'job-1' });
    });

    it('cancels a job through TransfersApiService', async () => {
      mockApi.cancelTransferJob.mockResolvedValue({ job: jobDto });

      await service.cancelJob('job-1');

      expect(mockApi.cancelTransferJob).toHaveBeenCalledWith({ jobId: 'job-1' });
    });
  });

  describe('uploadFile', () => {
    const originalXhr = globalThis.XMLHttpRequest;

    beforeEach(() => {
      MockXMLHttpRequest.instances = [];
      (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = MockXMLHttpRequest;
    });

    afterEach(() => {
      (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = originalXhr;
    });

    function upload(relativePath: string, signal: AbortSignal): { promise: Promise<void>; xhr: MockXMLHttpRequest } {
      const promise = service.uploadFile('job-1', new File(['data'], 'file.prg'), relativePath, signal);
      const xhr = MockXMLHttpRequest.instances[MockXMLHttpRequest.instances.length - 1];
      return { promise, xhr };
    }

    it('sends the relative path as an encoded Path query parameter', () => {
      const controller = new AbortController();
      const { xhr } = upload('games/sub dir/game.prg', controller.signal);

      expect(xhr.url).toBe(
        `http://localhost:5168/api/transfers/job-1/files?Path=${encodeURIComponent('games/sub dir/game.prg')}`
      );
      expect(xhr.method).toBe('POST');
      expect(xhr.headers['Content-Type']).toBe('application/octet-stream');
    });

    it('sets no timeout on the request', () => {
      const controller = new AbortController();
      const { xhr } = upload('game.prg', controller.signal);

      expect(xhr.timeoutWasSet).toBe(false);
    });

    it('resolves on a 2xx response', async () => {
      const controller = new AbortController();
      const { promise, xhr } = upload('game.prg', controller.signal);

      xhr.status = 200;
      xhr.onload?.();

      await expect(promise).resolves.toBeUndefined();
    });

    it('rejects with a retryable TransferUploadError on a 5xx response', async () => {
      const controller = new AbortController();
      const { promise, xhr } = upload('game.prg', controller.signal);

      xhr.status = 503;
      xhr.onload?.();

      const error = await promise.catch((e) => e);
      expect(error).toBeInstanceOf(TransferUploadError);
      expect((error as TransferUploadError).status).toBe(503);
      expect((error as TransferUploadError).retryable).toBe(true);
    });

    it('rejects with a non-retryable TransferUploadError on a 4xx response', async () => {
      const controller = new AbortController();
      const { promise, xhr } = upload('game.prg', controller.signal);

      xhr.status = 400;
      xhr.onload?.();

      const error = await promise.catch((e) => e);
      expect(error).toBeInstanceOf(TransferUploadError);
      expect((error as TransferUploadError).status).toBe(400);
      expect((error as TransferUploadError).retryable).toBe(false);
    });

    it('rejects with a retryable TransferUploadError on a transport error', async () => {
      const controller = new AbortController();
      const { promise, xhr } = upload('game.prg', controller.signal);

      xhr.onerror?.();

      const error = await promise.catch((e) => e);
      expect(error).toBeInstanceOf(TransferUploadError);
      expect((error as TransferUploadError).status).toBe(0);
      expect((error as TransferUploadError).retryable).toBe(true);
    });

    it('aborts the underlying request when the signal aborts', async () => {
      const controller = new AbortController();
      const { promise, xhr } = upload('game.prg', controller.signal);

      controller.abort();

      await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
      expect(xhr.aborted).toBe(true);
    });
  });
});
