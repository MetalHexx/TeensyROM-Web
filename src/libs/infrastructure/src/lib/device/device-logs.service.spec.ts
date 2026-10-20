import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DeviceLogsService } from './device-logs.service';
import { ALERT_SERVICE, IAlertService, API_CONFIG, IApiConfig } from '@teensyrom-nx/domain';

// Mock SignalR - all mocks must be self-contained in the factory
vi.mock('@microsoft/signalr', () => {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  let reconnectedHandler: (() => Promise<void>) | null = null;

  const mockHubConnection = {
    start: vi.fn(),
    stop: vi.fn(),
    invoke: vi.fn(),
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
    build: vi.fn(),
  };

  return {
    HubConnectionBuilder: vi.fn(() => mockBuilder),
    __mockHubConnection: mockHubConnection,
    __mockBuilder: mockBuilder,
    __handlers: handlers,
    __getReconnectedHandler: () => reconnectedHandler,
  };
});

type MockFn = ReturnType<typeof vi.fn>;

interface SignalRMocks {
  __mockHubConnection: { start: MockFn; stop: MockFn; invoke: MockFn; on: MockFn; onreconnected: MockFn };
  __mockBuilder: { withUrl: MockFn; withAutomaticReconnect: MockFn; build: MockFn };
  __handlers: Record<string, (...args: unknown[]) => void>;
  __getReconnectedHandler: () => (() => Promise<void>) | null;
}

const getMocks = async () => (await vi.importMock('@microsoft/signalr')) as unknown as SignalRMocks;

const mockApiConfig: IApiConfig = {
  basePath: 'http://localhost:10213',
  signalRBasePath: 'http://localhost:10213',
  getBaseUrl: () => 'http://localhost:10213',
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('DeviceLogsService', () => {
  let service: DeviceLogsService;
  let mockAlertService: { error: MockFn };
  let mocks: SignalRMocks;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    mocks = await getMocks();
    const connection = mocks.__mockHubConnection;
    connection.start.mockReset().mockResolvedValue(undefined);
    connection.stop.mockReset().mockResolvedValue(undefined);
    connection.invoke.mockReset().mockResolvedValue(undefined);
    connection.on.mockClear();
    connection.onreconnected.mockClear();
    mocks.__mockBuilder.withUrl.mockClear();
    mocks.__mockBuilder.build.mockReset().mockReturnValue(connection);

    mockAlertService = { error: vi.fn() };

    // Suppress console.error for all tests - they intentionally test error scenarios
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        DeviceLogsService,
        { provide: ALERT_SERVICE, useValue: mockAlertService as unknown as IAlertService },
        { provide: API_CONFIG, useValue: mockApiConfig },
      ],
    });

    service = TestBed.inject(DeviceLogsService);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('connect()', () => {
    it('builds a connection to the log hub and subscribes after it starts', async () => {
      service.connect();
      await flush();

      expect(mocks.__mockBuilder.withUrl).toHaveBeenCalledWith('http://localhost:10213/api/logHub');
      expect(mocks.__mockHubConnection.invoke).toHaveBeenCalledWith('Subscribe');
      const startOrder = mocks.__mockHubConnection.start.mock.invocationCallOrder[0];
      const subscribeOrder = mocks.__mockHubConnection.invoke.mock.invocationCallOrder[0];
      expect(startOrder).toBeLessThan(subscribeOrder);
      expect(service.isConnected()).toBe(true);
    });

    it('is not connected until the subscription succeeds', async () => {
      let finishSubscribe: () => void = () => undefined;
      mocks.__mockHubConnection.invoke.mockReturnValue(
        new Promise<void>((resolve) => (finishSubscribe = resolve))
      );

      service.connect();
      await flush();
      expect(service.isConnected()).toBe(false);

      finishSubscribe();
      await flush();
      expect(service.isConnected()).toBe(true);
    });

    it('does nothing when a connection already exists', async () => {
      service.connect();
      service.connect();
      await flush();

      expect(mocks.__mockBuilder.build).toHaveBeenCalledTimes(1);
      expect(mocks.__mockHubConnection.start).toHaveBeenCalledTimes(1);
    });

    it('appends produced log lines and keeps the newest 200', async () => {
      service.connect();
      await flush();

      for (let i = 0; i < 205; i++) {
        mocks.__handlers['LogProduced'](`line ${i}`);
      }

      expect(service.logs()).toHaveLength(200);
      expect(service.logs()[0]).toBe('line 5');
      expect(service.logs()[199]).toBe('line 204');
    });

    it('subscribes again after the connection reconnects', async () => {
      service.connect();
      await flush();
      mocks.__mockHubConnection.invoke.mockClear();

      await mocks.__getReconnectedHandler()?.();

      expect(mocks.__mockHubConnection.invoke).toHaveBeenCalledWith('Subscribe');
    });

    it('alerts when resubscribing after a reconnect fails', async () => {
      service.connect();
      await flush();
      mocks.__mockHubConnection.invoke.mockRejectedValue(new Error('Hub unavailable'));

      await mocks.__getReconnectedHandler()?.();

      expect(mockAlertService.error).toHaveBeenCalledWith('Hub unavailable');
    });

    it('alerts and tears the connection down when start fails', async () => {
      mocks.__mockHubConnection.start.mockRejectedValue(new Error('Engine is not running'));

      service.connect();
      await flush();

      expect(mockAlertService.error).toHaveBeenCalledWith('Engine is not running');
      expect(mocks.__mockHubConnection.invoke).not.toHaveBeenCalled();
      expect(mocks.__mockHubConnection.stop).toHaveBeenCalled();
      expect(service.isConnected()).toBe(false);
    });

    it('uses the fallback message when start fails without an error message', async () => {
      mocks.__mockHubConnection.start.mockRejectedValue({});

      service.connect();
      await flush();

      expect(mockAlertService.error).toHaveBeenCalledWith('Failed to start device logs');
    });

    it('alerts with the fallback message and tears down when Subscribe fails', async () => {
      mocks.__mockHubConnection.invoke.mockRejectedValue({});

      service.connect();
      await flush();

      expect(mockAlertService.error).toHaveBeenCalledWith('Failed to start device logs');
      expect(mocks.__mockHubConnection.stop).toHaveBeenCalled();
      expect(service.isConnected()).toBe(false);
    });

    it('builds a new connection when connecting again after a failed attempt', async () => {
      mocks.__mockHubConnection.start.mockRejectedValueOnce(new Error('Engine is not running'));

      service.connect();
      await flush();
      service.connect();
      await flush();

      expect(mocks.__mockBuilder.build).toHaveBeenCalledTimes(2);
      expect(service.isConnected()).toBe(true);
    });
  });

  describe('disconnect()', () => {
    it('unsubscribes and then stops the connection', async () => {
      service.connect();
      await flush();
      mocks.__mockHubConnection.invoke.mockClear();

      service.disconnect();
      await flush();

      expect(mocks.__mockHubConnection.invoke).toHaveBeenCalledWith('Unsubscribe');
      const unsubscribeOrder = mocks.__mockHubConnection.invoke.mock.invocationCallOrder[0];
      const stopOrder = mocks.__mockHubConnection.stop.mock.invocationCallOrder[0];
      expect(unsubscribeOrder).toBeLessThan(stopOrder);
      expect(service.isConnected()).toBe(false);
    });

    it('alerts when unsubscribing fails and still stops the connection', async () => {
      service.connect();
      await flush();
      mocks.__mockHubConnection.invoke.mockRejectedValue(new Error('Stop logs failed'));

      service.disconnect();
      await flush();

      expect(mockAlertService.error).toHaveBeenCalledWith('Stop logs failed');
      expect(mocks.__mockHubConnection.stop).toHaveBeenCalled();
    });

    it('uses the fallback message when unsubscribing fails without an error message', async () => {
      service.connect();
      await flush();
      mocks.__mockHubConnection.invoke.mockRejectedValue({});

      service.disconnect();
      await flush();

      expect(mockAlertService.error).toHaveBeenCalledWith('Failed to stop device logs');
    });

    it('allows connecting again afterwards', async () => {
      service.connect();
      await flush();
      service.disconnect();
      await flush();

      service.connect();
      await flush();

      expect(mocks.__mockBuilder.build).toHaveBeenCalledTimes(2);
      expect(service.isConnected()).toBe(true);
    });

    it('does nothing without a connection', async () => {
      service.disconnect();
      await flush();

      expect(mocks.__mockHubConnection.invoke).not.toHaveBeenCalled();
      expect(mockAlertService.error).not.toHaveBeenCalled();
    });
  });

  describe('clear()', () => {
    it('clears log lines', async () => {
      service.connect();
      await flush();
      mocks.__handlers['LogProduced']('a line');

      service.clear();

      expect(service.logs()).toEqual([]);
    });
  });
});
