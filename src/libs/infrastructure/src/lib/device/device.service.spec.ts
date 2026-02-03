import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DevicesApiService } from '@teensyrom-nx/data-access/api-client';
import { DeviceService } from './device.service';
import { ALERT_SERVICE } from '@teensyrom-nx/domain';

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
