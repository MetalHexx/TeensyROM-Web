import { describe, it, expect, vi } from 'vitest';
import { firstValueFrom, of } from 'rxjs';
import { IDeviceService } from '@teensyrom-nx/domain';
import { createMockDeviceService } from './device-service.mock';

describe('createMockDeviceService', () => {
  it('provides default spies for every contract method', async () => {
    const service = createMockDeviceService() as IDeviceService;

    const devices = await firstValueFrom(service.findDevices());

    expect(devices).toEqual([]);
    expect(service.resetDevice).toBeDefined();
    expect(service.pingDevice).toBeDefined();
  });

  it('lets an override replace one method while the rest keep their defaults', async () => {
    const service = createMockDeviceService({
      pingDevice: vi.fn().mockReturnValue(of(undefined)),
    }) as IDeviceService;

    await expect(firstValueFrom(service.pingDevice('device-1'))).resolves.toBeUndefined();
    await expect(firstValueFrom(service.findDevices())).resolves.toEqual([]);
  });
});
