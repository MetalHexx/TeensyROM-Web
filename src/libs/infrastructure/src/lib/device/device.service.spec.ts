import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DevicesApiService } from '@teensyrom-nx/data-access/api-client';
import { DeviceService } from './device.service';
import { ALERT_SERVICE } from '@teensyrom-nx/domain';

describe('DeviceService - Alert Integration', () => {
  let service: DeviceService;
  let mockApiService: {
    findDevices: ReturnType<typeof vi.fn>;
    resetDevice: ReturnType<typeof vi.fn>;
    pingDevice: ReturnType<typeof vi.fn>;
  };
  let mockAlertService: {
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockApiService = {
      findDevices: vi.fn(),
      resetDevice: vi.fn(),
      pingDevice: vi.fn(),
    };

    mockAlertService = {
      error: vi.fn(),
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
});
