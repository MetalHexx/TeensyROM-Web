import { describe, it, expect, beforeAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DeviceService } from './device.service';
import {
  DevicesApiService,
  Configuration,
} from '@teensyrom-nx/data-access/api-client';
import { ALERT_SERVICE, IAlertService, API_CONFIG, IApiConfig } from '@teensyrom-nx/domain';
import { firstValueFrom } from 'rxjs';

/**
 * Device Service Integration Tests
 *
 * These tests hit a live API at http://localhost:5168 and require a running backend.
 * They are gated behind the RUN_INTEGRATION environment variable.
 *
 * Run with: pnpm nx run infrastructure:test:integration
 *
 * Philosophy: Verify "the API is reachable and returns expected shapes" - nothing more.
 * Error handling and edge cases belong in unit tests with mocks.
 */
describe.runIf(process.env['RUN_INTEGRATION'] === 'true')(
  'DeviceService Integration Tests',
  () => {
    let deviceService: DeviceService;

    beforeAll(() => {
      const config = new Configuration({
        basePath: 'http://localhost:5168',
        fetchApi: fetch,
      });

      const mockAlertService: Partial<IAlertService> = {
        error: () => {
          // No-op for integration tests
        },
      };

      const mockApiConfig: IApiConfig = {
        basePath: 'http://127.0.0.1:45123',
        signalRBasePath: 'http://127.0.0.1:45123',
        getBaseUrl: () => 'http://127.0.0.1:45123',
      };

      TestBed.configureTestingModule({
        providers: [
          DeviceService,
          { provide: DevicesApiService, useValue: new DevicesApiService(config) },
          { provide: ALERT_SERVICE, useValue: mockAlertService },
          { provide: API_CONFIG, useValue: mockApiConfig },
        ],
      });

      deviceService = TestBed.inject(DeviceService);
    });

    it('should find devices and return a list', async () => {
      const devices = await firstValueFrom(deviceService.findDevices());

      expect(devices).toBeDefined();
      expect(Array.isArray(devices)).toBe(true);
      // Don't assert specific devices - hardware-dependent
    }, 40000);
  }
);
