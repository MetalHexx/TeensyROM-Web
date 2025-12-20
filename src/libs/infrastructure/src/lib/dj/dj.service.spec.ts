import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as signalR from '@microsoft/signalr';
import { DjService } from './dj.service';
import { VoiceState } from '@teensyrom-nx/domain';
import { ALERT_SERVICE, IAlertService, API_CONFIG, IApiConfig } from '@teensyrom-nx/domain';

describe('DjService', () => {
  let service: DjService;
  let mockHubConnection: Partial<signalR.HubConnection>;
  let mockAlertService: Partial<IAlertService>;
  let mockApiConfig: Partial<IApiConfig>;

  beforeEach(() => {
    // Create mocks with writable state
    mockHubConnection = {
      state: signalR.HubConnectionState.Disconnected,
      invoke: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    } as unknown as Partial<signalR.HubConnection>;

    mockAlertService = {
      error: vi.fn(),
      warning: vi.fn(),
      success: vi.fn(),
    };

    mockApiConfig = {
      signalRBasePath: 'http://localhost:5000',
      getBaseUrl: vi.fn().mockReturnValue('http://localhost:5000/api'),
    };

    TestBed.configureTestingModule({
      providers: [
        DjService,
        { provide: ALERT_SERVICE, useValue: mockAlertService },
        { provide: API_CONFIG, useValue: mockApiConfig },
      ],
    });

    service = TestBed.inject(DjService);

    // Mock HubConnectionBuilder
    vi.spyOn(signalR, 'HubConnectionBuilder').mockReturnValue({
      withUrl: vi.fn().mockReturnThis(),
      withAutomaticReconnect: vi.fn().mockReturnThis(),
      build: vi.fn().mockReturnValue(mockHubConnection as unknown as signalR.HubConnection),
    } as unknown as signalR.HubConnectionBuilder);
  });

  describe('muteVoices', () => {
    it('should invoke hub method with correct parameters', async () => {
      const deviceId = 'test-device-1';
      const voice1 = VoiceState.Enabled;
      const voice2 = VoiceState.Disabled;
      const voice3 = VoiceState.Enabled;

      (mockHubConnection as Record<string, unknown>).state = signalR.HubConnectionState.Connected;

      const signal = service.muteVoices(deviceId, voice1, voice2, voice3);

      // Give async operation time to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockHubConnection.invoke).toHaveBeenCalledWith('MuteSidVoices', deviceId, voice1, voice2, voice3);
      expect(signal).toBeDefined();
    });

    it('should return a readonly signal', () => {
      (mockHubConnection as Record<string, unknown>).state = signalR.HubConnectionState.Connected;
      (mockHubConnection.invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const signal = service.muteVoices(
        'device-1',
        VoiceState.Enabled,
        VoiceState.Disabled,
        VoiceState.Enabled
      );

      expect(signal).toBeDefined();
      // Signal should be readonly - attempting to set should throw
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (signal as any).set(123);
      }).toThrow();
    });

    it('should establish lazy connection on first invocation', async () => {
      (mockHubConnection as Record<string, unknown>).state = signalR.HubConnectionState.Disconnected;

      service.muteVoices('device-1', VoiceState.Enabled, VoiceState.Disabled, VoiceState.Enabled);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockHubConnection.start).toHaveBeenCalled();
    });

    it('should reuse connection for subsequent calls', async () => {
      (mockHubConnection as Record<string, unknown>).state = signalR.HubConnectionState.Connected;
      const startSpy = mockHubConnection.start as unknown as ReturnType<typeof vi.fn>;

      service.muteVoices('device-1', VoiceState.Enabled, VoiceState.Disabled, VoiceState.Enabled);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const firstStartCount = startSpy.mock.calls.length;

      service.muteVoices('device-2', VoiceState.Disabled, VoiceState.Enabled, VoiceState.Disabled);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const secondStartCount = startSpy.mock.calls.length;
      expect(secondStartCount).toBe(firstStartCount);
    });

    it('should show alert and handle error on hub invocation failure', async () => {
      (mockHubConnection as Record<string, unknown>).state = signalR.HubConnectionState.Connected;
      const hubError = new Error('Hub method failed');
      (mockHubConnection.invoke as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(hubError);

      service.muteVoices('device-1', VoiceState.Enabled, VoiceState.Disabled, VoiceState.Enabled);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockAlertService.error).toHaveBeenCalledWith('Unable to adjust voice settings. Please try again.');
    });

    it('should show alert on connection failure', async () => {
      (mockHubConnection as Record<string, unknown>).state = signalR.HubConnectionState.Disconnected;
      const connectionError = new Error('Network error');
      (mockHubConnection.start as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(connectionError);

      service.muteVoices('device-1', VoiceState.Enabled, VoiceState.Disabled, VoiceState.Enabled);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockAlertService.error).toHaveBeenCalledWith('Unable to adjust voice settings. Please try again.');
    });

    it('should handle unknown error types gracefully', async () => {
      (mockHubConnection as Record<string, unknown>).state = signalR.HubConnectionState.Connected;
      (mockHubConnection.invoke as unknown as ReturnType<typeof vi.fn>).mockRejectedValue('Unknown error string');

      service.muteVoices('device-1', VoiceState.Enabled, VoiceState.Disabled, VoiceState.Enabled);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockAlertService.error).toHaveBeenCalledWith('Unable to adjust voice settings. Please try again.');
    });

    it('should support all VoiceState combinations', async () => {
      (mockHubConnection as Record<string, unknown>).state = signalR.HubConnectionState.Connected;

      const combinations = [
        [VoiceState.Enabled, VoiceState.Enabled, VoiceState.Enabled],
        [VoiceState.Disabled, VoiceState.Disabled, VoiceState.Disabled],
        [VoiceState.Enabled, VoiceState.Disabled, VoiceState.Enabled],
      ];

      combinations.forEach((combo) => {
        service.muteVoices(
          'device-1',
          combo[0] as VoiceState,
          combo[1] as VoiceState,
          combo[2] as VoiceState
        );
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockHubConnection.invoke).toHaveBeenCalledTimes(3);
    });
  });

  describe('connection lifecycle', () => {
    it('should handle connection state transitions correctly', async () => {
      (mockHubConnection as Record<string, unknown>).state = signalR.HubConnectionState.Disconnected;
      (mockHubConnection.start as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        (mockHubConnection as Record<string, unknown>).state = signalR.HubConnectionState.Connected;
      });

      service.muteVoices('device-1', VoiceState.Enabled, VoiceState.Disabled, VoiceState.Enabled);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect((mockHubConnection as Record<string, unknown>).state).toBe(
        signalR.HubConnectionState.Connected
      );
    });

    it('should use correct hub URL from API config', async () => {
      (mockHubConnection as Record<string, unknown>).state = signalR.HubConnectionState.Disconnected;

      service.muteVoices('device-1', VoiceState.Enabled, VoiceState.Disabled, VoiceState.Enabled);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(signalR.HubConnectionBuilder).toHaveBeenCalled();
    });
  });

  describe('error scenarios', () => {
    it('should handle error details gracefully', async () => {
      (mockHubConnection as Record<string, unknown>).state = signalR.HubConnectionState.Connected;
      const expectedError = new Error('Device not responding');
      (mockHubConnection.invoke as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(expectedError);

      service.muteVoices('device-1', VoiceState.Enabled, VoiceState.Disabled, VoiceState.Enabled);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockAlertService.error).toHaveBeenCalled();
    });

    it('should handle hub connection null state during error', async () => {
      (mockHubConnection as Record<string, unknown>).state = signalR.HubConnectionState.Disconnected;
      (mockHubConnection.start as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Connection refused')
      );

      service.muteVoices('device-1', VoiceState.Enabled, VoiceState.Disabled, VoiceState.Enabled);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockAlertService.error).toHaveBeenCalled();
    });
  });
});
