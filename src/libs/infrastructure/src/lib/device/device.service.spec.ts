import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DevicesApiService, ResponseError } from '@teensyrom-nx/data-access/api-client';
import { DeviceService } from './device.service';
import { ALERT_SERVICE, DeviceBusyError } from '@teensyrom-nx/domain';

// Helper to create unavailable storage (backend always returns an object, never null)
const unavailableStorage = (deviceId: string, type: 'SD' | 'USB') => ({
  deviceId,
  type,
  available: false,
  indexExists: false,
});

describe('DeviceService - Alert Integration', () => {
  let service: DeviceService;
  let mockApiService: {
    findDevices: ReturnType<typeof vi.fn>;
    resetDevice: ReturnType<typeof vi.fn>;
    pingDevice: ReturnType<typeof vi.fn>;
    reconnectDevice: ReturnType<typeof vi.fn>;
    forgetDevice: ReturnType<typeof vi.fn>;
    renameDevice: ReturnType<typeof vi.fn>;
  };
  let mockAlertService: {
    error: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockApiService = {
      findDevices: vi.fn(),
      resetDevice: vi.fn(),
      pingDevice: vi.fn(),
      reconnectDevice: vi.fn(),
      forgetDevice: vi.fn(),
      renameDevice: vi.fn(),
    };

    mockAlertService = {
      error: vi.fn(),
      warning: vi.fn(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        DeviceService,
        { provide: DevicesApiService, useValue: mockApiService },
        { provide: ALERT_SERVICE, useValue: mockAlertService },
      ],
    });

    service = TestBed.inject(DeviceService);
  });

  describe('findDevices error handling', () => {
    it('should display friendly error message when API fails', async () => {
      const error = new Error('Some technical error');
      mockApiService.findDevices.mockRejectedValue(error);
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(
        new Promise((resolve, reject) => {
          service.findDevices().subscribe({
            next: resolve,
            error: reject,
          });
        })
      ).rejects.toThrow();

      // Should use friendly message, not technical error message
      expect(mockAlertService.error).toHaveBeenCalledWith('Failed to find devices');
      logSpy.mockRestore();
    });

    it('should always use friendly message regardless of error type', async () => {
      // Even with different error types, friendly message is always used
      const error = { error: { message: 'Some API error message' } };
      mockApiService.findDevices.mockRejectedValue(error);
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(
        new Promise((resolve, reject) => {
          service.findDevices().subscribe({
            next: resolve,
            error: reject,
          });
        })
      ).rejects.toThrow();

      expect(mockAlertService.error).toHaveBeenCalledWith('Failed to find devices');
      logSpy.mockRestore();
    });

    it('should rethrow error after displaying alert', async () => {
      const error = new Error('Network error');
      mockApiService.findDevices.mockRejectedValue(error);
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      let caughtError: Error | null = null;
      await new Promise<void>((resolve) => {
        service.findDevices().subscribe({
          error: (err: Error) => {
            caughtError = err;
            resolve();
          },
        });
      });

      expect(caughtError).toBeDefined();
      expect(caughtError).toBe(error);
      logSpy.mockRestore();
    });
  });

  describe('resetDevice error handling', () => {
    it('should display friendly error message on reset failure', async () => {
      const error = new Error('Some technical error');
      mockApiService.resetDevice.mockRejectedValue(error);
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(
        new Promise((resolve, reject) => {
          service.resetDevice('device-123').subscribe({
            next: resolve,
            error: reject,
          });
        })
      ).rejects.toThrow();

      // Should use friendly message, not technical error message
      expect(mockAlertService.error).toHaveBeenCalledWith('Failed to reset device');
      logSpy.mockRestore();
    });

    it('should always use friendly message regardless of error type', async () => {
      const error = { error: { message: undefined } };
      mockApiService.resetDevice.mockRejectedValue(error);
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(
        new Promise((resolve, reject) => {
          service.resetDevice('device-123').subscribe({
            next: resolve,
            error: reject,
          });
        })
      ).rejects.toThrow();

      expect(mockAlertService.error).toHaveBeenCalledWith('Failed to reset device');
      logSpy.mockRestore();
    });
  });

  describe('pingDevice error handling', () => {
    it('should display friendly error message on ping failure', async () => {
      const error = new Error('Some technical error');
      mockApiService.pingDevice.mockRejectedValue(error);
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(
        new Promise((resolve, reject) => {
          service.pingDevice('device-123').subscribe({
            next: resolve,
            error: reject,
          });
        })
      ).rejects.toThrow();

      // Should use friendly message, not technical error message
      expect(mockAlertService.error).toHaveBeenCalledWith('Failed to ping device');
      logSpy.mockRestore();
    });

    it('should always use friendly message regardless of error type', async () => {
      const error = {};
      mockApiService.pingDevice.mockRejectedValue(error);
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(
        new Promise((resolve, reject) => {
          service.pingDevice('device-123').subscribe({
            next: resolve,
            error: reject,
          });
        })
      ).rejects.toThrow();

      expect(mockAlertService.error).toHaveBeenCalledWith('Failed to ping device');
      logSpy.mockRestore();
    });
  });

  describe('reconnectDevice', () => {
    it('maps the response device through DomainMapper on success', async () => {
      mockApiService.reconnectDevice.mockResolvedValue({
        message: 'reconnected',
        device: {
          deviceId: 'device-1',
          name: 'TeensyROM Device #1',
          comPort: 'COM3',
          fwVersion: '1.0.0',
          isCompatible: true,
          isConnected: true,
          deviceState: 'Connected',
          ipAddress: null,
          tcpPort: null,
          sdStorage: { deviceId: 'device-1', type: 'SD', available: true, indexExists: true },
          usbStorage: unavailableStorage('device-1', 'USB'),
        },
      });

      const result = await new Promise((resolve, reject) => {
        service.reconnectDevice('device-1').subscribe({ next: resolve, error: reject });
      });

      expect(mockApiService.reconnectDevice).toHaveBeenCalledWith({ deviceId: 'device-1' });
      expect(result).toMatchObject({ deviceId: 'device-1', name: 'TeensyROM Device #1' });
    });

    it('raises the not-found alert on a 502', async () => {
      const error = new ResponseError(new Response(null, { status: 502 }), 'Bad Gateway');
      mockApiService.reconnectDevice.mockRejectedValue(error);
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(
        new Promise((resolve, reject) => {
          service.reconnectDevice('device-1').subscribe({ next: resolve, error: reject });
        })
      ).rejects.toThrow();

      expect(mockAlertService.error).toHaveBeenCalledWith(
        'Device could not be found. Check it is powered on and connected.'
      );
      logSpy.mockRestore();
    });

    it('raises the generic reconnect alert on any other failure', async () => {
      const error = new ResponseError(new Response(null, { status: 404 }), 'Not Found');
      mockApiService.reconnectDevice.mockRejectedValue(error);
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(
        new Promise((resolve, reject) => {
          service.reconnectDevice('device-1').subscribe({ next: resolve, error: reject });
        })
      ).rejects.toThrow();

      expect(mockAlertService.error).toHaveBeenCalledWith('Failed to reconnect device');
      logSpy.mockRestore();
    });

    it('raises the generic reconnect alert when the error carries no response', async () => {
      mockApiService.reconnectDevice.mockRejectedValue(new Error('network down'));
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(
        new Promise((resolve, reject) => {
          service.reconnectDevice('device-1').subscribe({ next: resolve, error: reject });
        })
      ).rejects.toThrow();

      expect(mockAlertService.error).toHaveBeenCalledWith('Failed to reconnect device');
      logSpy.mockRestore();
    });
  });

  describe('forgetDevice', () => {
    it('resolves without error on success', async () => {
      mockApiService.forgetDevice.mockResolvedValue({ message: 'forgotten' });

      await expect(
        new Promise((resolve, reject) => {
          service.forgetDevice('device-1').subscribe({ next: resolve, error: reject });
        })
      ).resolves.toBeUndefined();

      expect(mockApiService.forgetDevice).toHaveBeenCalledWith({ deviceId: 'device-1' });
    });

    it('raises the forget alert on failure', async () => {
      const error = new ResponseError(new Response(null, { status: 409 }), 'Conflict');
      mockApiService.forgetDevice.mockRejectedValue(error);
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(
        new Promise((resolve, reject) => {
          service.forgetDevice('device-1').subscribe({ next: resolve, error: reject });
        })
      ).rejects.toThrow();

      expect(mockAlertService.error).toHaveBeenCalledWith('Failed to forget device');
      logSpy.mockRestore();
    });
  });

  describe('renameDevice', () => {
    it('sends the name as the request body and maps the response device', async () => {
      mockApiService.renameDevice.mockResolvedValue({
        message: 'renamed',
        device: {
          deviceId: 'device-1',
          name: 'Living Room',
          comPort: 'COM3',
          fwVersion: '1.0.0',
          isCompatible: true,
          isConnected: true,
          deviceState: 'Connected',
          machine: 'C128',
          videoStandard: 'PAL',
          todClockHz: 50,
          hardwareVariant: 'TeensyRomPlus',
          sdStorage: { deviceId: 'device-1', type: 'SD', available: true, indexExists: true },
          usbStorage: unavailableStorage('device-1', 'USB'),
        },
      });

      const result = await new Promise((resolve, reject) => {
        service.renameDevice('device-1', 'Living Room').subscribe({ next: resolve, error: reject });
      });

      expect(mockApiService.renameDevice).toHaveBeenCalledWith({
        deviceId: 'device-1',
        renameDeviceBody: { name: 'Living Room' },
      });
      expect(result).toMatchObject({
        deviceId: 'device-1',
        name: 'Living Room',
        machine: 'C128',
        todClockHz: 50,
      });
    });

    it('raises the rename alert and rethrows on failure', async () => {
      const error = new ResponseError(new Response(null, { status: 400 }), 'Bad Request');
      mockApiService.renameDevice.mockRejectedValue(error);
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(
        new Promise((resolve, reject) => {
          service.renameDevice('device-1', 'x').subscribe({ next: resolve, error: reject });
        })
      ).rejects.toBe(error);

      expect(mockAlertService.error).toHaveBeenCalledTimes(1);
      expect(mockAlertService.error).toHaveBeenCalledWith('Failed to rename device');
      logSpy.mockRestore();
    });
  });

  describe('Alert service is called exactly once per error', () => {
    it('findDevices should call alert service once', async () => {
      mockApiService.findDevices.mockRejectedValue(new Error('Test'));
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(
        new Promise((resolve, reject) => {
          service.findDevices().subscribe({
            next: resolve,
            error: reject,
          });
        })
      ).rejects.toThrow();

      expect(mockAlertService.error).toHaveBeenCalledTimes(1);
      logSpy.mockRestore();
    });
  });

  describe('API ProblemDetails alert messages', () => {
    const problemDetailsError = (body: unknown): ResponseError =>
      new ResponseError(
        new Response(JSON.stringify(body), {
          status: 502,
          headers: { 'content-type': 'application/problem+json' },
        }),
        'Response returned an error code'
      );

    const findDevices = () =>
      new Promise((resolve, reject) => {
        service.findDevices().subscribe({ next: resolve, error: reject });
      });

    it('alerts the ProblemDetails title and rethrows the original error', async () => {
      const error = problemDetailsError({ title: 'No devices were found' });
      mockApiService.findDevices.mockRejectedValue(error);
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(findDevices()).rejects.toBe(error);

      expect(mockAlertService.error).toHaveBeenCalledWith('No devices were found');
      logSpy.mockRestore();
    });

    it('alerts the ProblemDetails detail when the title is absent', async () => {
      mockApiService.findDevices.mockRejectedValue(
        problemDetailsError({ detail: 'Scan timed out' })
      );
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(findDevices()).rejects.toThrow();

      expect(mockAlertService.error).toHaveBeenCalledWith('Scan timed out');
      logSpy.mockRestore();
    });

    it('alerts the fixed message when the title is NUL-only', async () => {
      mockApiService.findDevices.mockRejectedValue(problemDetailsError({ title: '\u0000 \u0000' }));
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(findDevices()).rejects.toThrow();

      expect(mockAlertService.error).toHaveBeenCalledWith('Failed to find devices');
      logSpy.mockRestore();
    });
  });

  describe('index status alerts', () => {
    describe('Single Device Scenarios', () => {
      it('should alert when SD storage index missing', async () => {
        const mockResponse = {
          devices: [
            {
              deviceId: 'device-1',
              name: 'TeensyROM Device #1',
              comPort: 'COM3',
              fwVersion: '1.0.0',
              isCompatible: true,
              isConnected: true,
              deviceState: 'Online',
              ipAddress: null,
              tcpPort: null,
              sdStorage: {
                deviceId: 'device-1',
                type: 'SD',
                available: true,
                indexExists: false,
              },
              usbStorage: unavailableStorage('device-1', 'USB'),
            },
          ],
        };

        mockApiService.findDevices.mockResolvedValue(mockResponse);

        await new Promise<void>((resolve) => {
          service.findDevices().subscribe({
            next: () => resolve(),
            error: () => resolve(),
          });
        });

        expect(mockAlertService.warning).toHaveBeenCalledTimes(1);
        expect(mockAlertService.warning).toHaveBeenCalledWith('TeensyROM Device #1 SD storage needs indexing');
        });

      it('should alert when USB storage index missing', async () => {
        const mockResponse = {
          devices: [
            {
              deviceId: 'device-1',
              name: 'TeensyROM Device #1',
              comPort: 'COM3',
              fwVersion: '1.0.0',
              isCompatible: true,
              isConnected: true,
              deviceState: 'Online',
              ipAddress: null,
              tcpPort: null,
              sdStorage: unavailableStorage('device-1', 'SD'),
              usbStorage: {
                deviceId: 'device-1',
                type: 'USB',
                available: true,
                indexExists: false,
              },
            },
          ],
        };

        mockApiService.findDevices.mockResolvedValue(mockResponse);

        await new Promise<void>((resolve) => {
          service.findDevices().subscribe({
            next: () => resolve(),
            error: () => resolve(),
          });
        });

        expect(mockAlertService.warning).toHaveBeenCalledTimes(1);
        expect(mockAlertService.warning).toHaveBeenCalledWith('TeensyROM Device #1 USB storage needs indexing');
        });

      it('should alert for both SD and USB when both missing on same device', async () => {
        const mockResponse = {
          devices: [
            {
              deviceId: 'device-1',
              name: 'TeensyROM Device #1',
              comPort: 'COM3',
              fwVersion: '1.0.0',
              isCompatible: true,
              isConnected: true,
              deviceState: 'Online',
              ipAddress: null,
              tcpPort: null,
              sdStorage: {
                deviceId: 'device-1',
                type: 'SD',
                available: true,
                indexExists: false,
              },
              usbStorage: {
                deviceId: 'device-1',
                type: 'USB',
                available: true,
                indexExists: false,
              },
            },
          ],
        };

        mockApiService.findDevices.mockResolvedValue(mockResponse);

        await new Promise<void>((resolve) => {
          service.findDevices().subscribe({
            next: () => resolve(),
            error: () => resolve(),
          });
        });

        expect(mockAlertService.warning).toHaveBeenCalledTimes(2);
        expect(mockAlertService.warning).toHaveBeenCalledWith('TeensyROM Device #1 SD storage needs indexing');
        expect(mockAlertService.warning).toHaveBeenCalledWith('TeensyROM Device #1 USB storage needs indexing');
      });

      it('should not alert when all indexes present', async () => {
        const mockResponse = {
        devices: [
          {
            deviceId: 'device-1',
            name: 'TeensyROM Device #1',
            comPort: 'COM3',
            fwVersion: '1.0.0',
            isCompatible: true,
            isConnected: true,
            deviceState: 'Online',
            ipAddress: null,
            tcpPort: null,
            sdStorage: {
              deviceId: 'device-1',
              type: 'SD',
              available: true,
              indexExists: true,
            },
            usbStorage: {
              deviceId: 'device-1',
              type: 'USB',
              available: true,
              indexExists: true,
            },
          },
        ],
      };

      mockApiService.findDevices.mockResolvedValue(mockResponse);

      await new Promise<void>((resolve) => {
        service.findDevices().subscribe({
          next: () => resolve(),
          error: () => resolve(),
        });
      });

      expect(mockAlertService.warning).not.toHaveBeenCalled();
    });
    });

    describe('Multiple Device Scenarios', () => {
      it('should handle multiple devices with mixed states', async () => {
      const mockResponse = {
        devices: [
          {
            deviceId: 'device-1',
            name: 'TeensyROM Device #1',
            comPort: 'COM3',
            fwVersion: '1.0.0',
            isCompatible: true,
            isConnected: true,
            deviceState: 'Online',
            ipAddress: null,
            tcpPort: null,
            sdStorage: {
              deviceId: 'device-1',
              type: 'SD',
              available: true,
              indexExists: false,
            },
            usbStorage: unavailableStorage('device-1', 'USB'),
          },
          {
            deviceId: 'device-2',
            name: 'TeensyROM Device #2',
            comPort: 'COM4',
            fwVersion: '1.0.0',
            isCompatible: true,
            isConnected: true,
            deviceState: 'Online',
            ipAddress: null,
            tcpPort: null,
            sdStorage: {
              deviceId: 'device-2',
              type: 'SD',
              available: true,
              indexExists: true,
            },
            usbStorage: {
              deviceId: 'device-2',
              type: 'USB',
              available: true,
              indexExists: true,
            },
          },
          {
            deviceId: 'device-3',
            name: 'TeensyROM Device #3',
            comPort: 'COM5',
            fwVersion: '1.0.0',
            isCompatible: true,
            isConnected: true,
            deviceState: 'Online',
            ipAddress: null,
            tcpPort: null,
            sdStorage: unavailableStorage('device-3', 'SD'),
            usbStorage: {
              deviceId: 'device-3',
              type: 'USB',
              available: true,
              indexExists: false,
            },
          },
        ],
      };

      mockApiService.findDevices.mockResolvedValue(mockResponse);

      await new Promise<void>((resolve) => {
        service.findDevices().subscribe({
          next: () => resolve(),
          error: () => resolve(),
        });
      });

      expect(mockAlertService.warning).toHaveBeenCalledTimes(2);
      expect(mockAlertService.warning).toHaveBeenCalledWith('TeensyROM Device #1 SD storage needs indexing');
      expect(mockAlertService.warning).toHaveBeenCalledWith('TeensyROM Device #3 USB storage needs indexing');
    });

      it('should trigger correct number of alerts for multiple missing indexes', async () => {
        const mockResponse = {
          devices: [
            {
              deviceId: 'device-1',
              name: 'Device A',
              comPort: 'COM3',
              fwVersion: '1.0.0',
              isCompatible: true,
              isConnected: true,
              deviceState: 'Online',
              ipAddress: null,
              tcpPort: null,
              sdStorage: {
                deviceId: 'device-1',
                type: 'SD',
                available: true,
                indexExists: false,
              },
              usbStorage: {
                deviceId: 'device-1',
                type: 'USB',
                available: true,
                indexExists: false,
              },
            },
            {
              deviceId: 'device-2',
              name: 'Device B',
              comPort: 'COM4',
              fwVersion: '1.0.0',
              isCompatible: true,
              isConnected: true,
              deviceState: 'Online',
              ipAddress: null,
              tcpPort: null,
              sdStorage: {
                deviceId: 'device-2',
                type: 'SD',
                available: true,
                indexExists: false,
              },
              usbStorage: unavailableStorage('device-1', 'USB'),
            },
          ],
        };

        mockApiService.findDevices.mockResolvedValue(mockResponse);

        await new Promise<void>((resolve) => {
          service.findDevices().subscribe({
            next: () => resolve(),
            error: () => resolve(),
          });
        });

        expect(mockAlertService.warning).toHaveBeenCalledTimes(3);
        expect(mockAlertService.warning).toHaveBeenCalledWith('Device A SD storage needs indexing');
        expect(mockAlertService.warning).toHaveBeenCalledWith('Device A USB storage needs indexing');
        expect(mockAlertService.warning).toHaveBeenCalledWith('Device B SD storage needs indexing');
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty device list without errors', async () => {
        const mockResponse = {
          devices: [],
        };

        mockApiService.findDevices.mockResolvedValue(mockResponse);

        await new Promise<void>((resolve) => {
          service.findDevices().subscribe({
            next: () => resolve(),
            error: () => resolve(),
          });
        });

        expect(mockAlertService.warning).not.toHaveBeenCalled();
      });

      it('should handle device with no storage (both null)', async () => {
        const mockResponse = {
          devices: [
            {
              deviceId: 'device-1',
              name: 'TeensyROM Device #1',
              comPort: 'COM3',
              fwVersion: '1.0.0',
              isCompatible: true,
              isConnected: true,
              deviceState: 'Online',
              ipAddress: null,
              tcpPort: null,
sdStorage: unavailableStorage('device-1', 'SD'),
            usbStorage: unavailableStorage('device-1', 'USB'),
            },
          ],
        };

        mockApiService.findDevices.mockResolvedValue(mockResponse);

        await new Promise<void>((resolve) => {
          service.findDevices().subscribe({
            next: () => resolve(),
            error: () => resolve(),
          });
        });

        expect(mockAlertService.warning).not.toHaveBeenCalled();
      });
  });

    describe('Alert Message Format', () => {
      it('should include device name in alert message', async () => {
        const mockResponse = {
          devices: [
            {
              deviceId: 'device-1',
              name: 'Custom Device Name',
              comPort: 'COM3',
              fwVersion: '1.0.0',
              isCompatible: true,
              isConnected: true,
              deviceState: 'Online',
              ipAddress: null,
              tcpPort: null,
              sdStorage: {
                deviceId: 'device-1',
                type: 'SD',
                available: true,
                indexExists: false,
              },
              usbStorage: unavailableStorage('device-1', 'USB'),
            },
          ],
        };

        mockApiService.findDevices.mockResolvedValue(mockResponse);

        await new Promise<void>((resolve) => {
          service.findDevices().subscribe({
            next: () => resolve(),
            error: () => resolve(),
          });
        });

        expect(mockAlertService.warning).toHaveBeenCalledWith(
          expect.stringContaining('Custom Device Name')
        );
      });

      it('should specify SD storage type in message', async () => {
        const mockResponse = {
          devices: [
            {
              deviceId: 'device-1',
              name: 'Test Device',
              comPort: 'COM3',
              fwVersion: '1.0.0',
              isCompatible: true,
              isConnected: true,
              deviceState: 'Online',
              ipAddress: null,
              tcpPort: null,
              sdStorage: {
                deviceId: 'device-1',
                type: 'SD',
                available: true,
                indexExists: false,
              },
              usbStorage: unavailableStorage('device-1', 'USB'),
            },
          ],
        };

        mockApiService.findDevices.mockResolvedValue(mockResponse);

        await new Promise<void>((resolve) => {
          service.findDevices().subscribe({
            next: () => resolve(),
            error: () => resolve(),
          });
        });

        expect(mockAlertService.warning).toHaveBeenCalledWith(
          expect.stringContaining('SD storage')
        );
        expect(mockAlertService.warning).toHaveBeenCalledWith(
          expect.stringContaining('needs indexing')
        );
      });

      it('should specify USB storage type in message', async () => {
        const mockResponse = {
          devices: [
            {
              deviceId: 'device-1',
              name: 'Test Device',
              comPort: 'COM3',
              fwVersion: '1.0.0',
              isCompatible: true,
              isConnected: true,
              deviceState: 'Online',
              ipAddress: null,
              tcpPort: null,
              sdStorage: unavailableStorage('device-1', 'SD'),
              usbStorage: {
                deviceId: 'device-1',
                type: 'USB',
                available: true,
                indexExists: false,
              },
            },
          ],
        };

        mockApiService.findDevices.mockResolvedValue(mockResponse);

        await new Promise<void>((resolve) => {
          service.findDevices().subscribe({
            next: () => resolve(),
            error: () => resolve(),
          });
        });

        expect(mockAlertService.warning).toHaveBeenCalledWith(
          expect.stringContaining('USB storage')
        );
        expect(mockAlertService.warning).toHaveBeenCalledWith(
          expect.stringContaining('needs indexing')
        );
      });
    });
  });
});

const busyBody = {
  type: 'https://tools.ietf.org/html/rfc9110#section-15.5.10',
  title: 'Alpha is busy with a transfer.',
  status: 409,
  code: 'deviceBusyWithTransfer',
  deviceId: 'device-1',
  activeJobId: 'job-7',
};

const busyResponseError = (): ResponseError =>
  new ResponseError(
    new Response(JSON.stringify(busyBody), {
      status: 409,
      headers: { 'content-type': 'application/problem+json' },
    }),
    'Response returned an error code'
  );

const expectBusyRefusal = async (
  action: () => Promise<unknown>,
  alert: { error: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> }
) => {
  const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await expect(action()).rejects.toMatchObject({
    name: 'DeviceBusyError',
    deviceId: 'device-1',
    activeJobId: 'job-7',
    message: 'Alpha is busy with a transfer.',
  });
  expect(alert.warning).toHaveBeenCalledTimes(1);
  expect(alert.warning).toHaveBeenCalledWith('Alpha is busy with a transfer.');
  expect(alert.error).not.toHaveBeenCalled();
  logSpy.mockRestore();
};

describe('DeviceService - device busy', () => {
  let service: DeviceService;
  let mockApi: { resetDevice: ReturnType<typeof vi.fn>; pingDevice: ReturnType<typeof vi.fn> };
  let alert: { error: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockApi = { resetDevice: vi.fn(), pingDevice: vi.fn() };
    alert = { error: vi.fn(), warning: vi.fn() };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        DeviceService,
        { provide: DevicesApiService, useValue: mockApi },
        { provide: ALERT_SERVICE, useValue: alert },
      ],
    });
    service = TestBed.inject(DeviceService);
  });

  it('warns once and throws DeviceBusyError when reset is refused', async () => {
    mockApi.resetDevice.mockRejectedValue(busyResponseError());
    await expectBusyRefusal(() => new Promise((resolve, reject) => service.resetDevice('device-1').subscribe({ next: resolve, error: reject })), alert);
  });

  it('warns once and throws DeviceBusyError when ping is refused', async () => {
    mockApi.pingDevice.mockRejectedValue(busyResponseError());
    await expectBusyRefusal(() => new Promise((resolve, reject) => service.pingDevice('device-1').subscribe({ next: resolve, error: reject })), alert);
  });

  it('throws a DeviceBusyError instance', async () => {
    mockApi.pingDevice.mockRejectedValue(busyResponseError());
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(new Promise((resolve, reject) => service.pingDevice('device-1').subscribe({ next: resolve, error: reject }))).rejects.toBeInstanceOf(DeviceBusyError);
    logSpy.mockRestore();
  });
});

describe('DeviceService - launchAsidPlayer', () => {
  let service: DeviceService;
  let mockApi: { launchAsidPlayer: ReturnType<typeof vi.fn> };
  let alert: {
    error: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };

  const problem = (status: number, body: unknown, contentType = 'application/problem+json') =>
    new ResponseError(
      new Response(JSON.stringify(body), { status, headers: { 'content-type': contentType } })
    );

  const launch = () =>
    new Promise((resolve, reject) =>
      service.launchAsidPlayer('device-1').subscribe({ next: resolve, error: reject })
    );

  beforeEach(() => {
    mockApi = { launchAsidPlayer: vi.fn() };
    alert = { error: vi.fn(), warning: vi.fn(), info: vi.fn() };
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        DeviceService,
        { provide: DevicesApiService, useValue: mockApi },
        { provide: ALERT_SERVICE, useValue: alert },
      ],
    });
    service = TestBed.inject(DeviceService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    expect(alert.error).not.toHaveBeenCalled();
    expect(alert.warning).not.toHaveBeenCalled();
    expect(alert.info).not.toHaveBeenCalled();
  });

  it.each([true, false])('maps a success (movedToSerial %s)', async (movedToSerial) => {
    mockApi.launchAsidPlayer.mockResolvedValue({ message: 'ok', movedToSerial });

    await expect(launch()).resolves.toEqual({ launched: true, movedToSerial });
    expect(mockApi.launchAsidPlayer).toHaveBeenCalledWith({ deviceId: 'device-1' });
  });

  it('maps a 404 to notFound with the API message', async () => {
    mockApi.launchAsidPlayer.mockRejectedValue(
      problem(404, 'Device device-1 not found.', 'application/json')
    );

    await expect(launch()).resolves.toEqual({
      launched: false,
      reason: 'notFound',
      message: 'Device device-1 not found.',
    });
  });

  it('maps the busy 409 to busy with the problem title', async () => {
    mockApi.launchAsidPlayer.mockRejectedValue(
      problem(409, {
        title: 'Alpha is busy with a transfer.',
        code: 'deviceBusyWithTransfer',
        deviceId: 'device-1',
      })
    );

    await expect(launch()).resolves.toEqual({
      launched: false,
      reason: 'busy',
      message: 'Alpha is busy with a transfer.',
    });
  });

  it('maps a 502 with the usbUnreachable code to usbUnreachable', async () => {
    mockApi.launchAsidPlayer.mockRejectedValue(
      problem(502, { title: 'The USB port is held by another program.', code: 'usbUnreachable' })
    );

    await expect(launch()).resolves.toEqual({
      launched: false,
      reason: 'usbUnreachable',
      message: 'The USB port is held by another program.',
    });
  });

  it('maps a plain 502 to launchFailed with its title', async () => {
    mockApi.launchAsidPlayer.mockRejectedValue(problem(502, { title: 'The cartridge went away.' }));

    await expect(launch()).resolves.toEqual({
      launched: false,
      reason: 'launchFailed',
      message: 'The cartridge went away.',
    });
  });

  it('carries movedToSerial on a launchFailed outcome when the 502 says the cartridge had moved', async () => {
    mockApi.launchAsidPlayer.mockRejectedValue(
      problem(502, { title: 'It did not start.', movedToSerial: true })
    );

    await expect(launch()).resolves.toEqual({
      launched: false,
      reason: 'launchFailed',
      message: 'It did not start.',
      movedToSerial: true,
    });
  });

  it('falls back to a generic message when the failure carries none', async () => {
    mockApi.launchAsidPlayer.mockRejectedValue(new Error('network down'));

    await expect(launch()).resolves.toEqual({
      launched: false,
      reason: 'launchFailed',
      message: 'The ASID player could not be started.',
    });
  });
});
