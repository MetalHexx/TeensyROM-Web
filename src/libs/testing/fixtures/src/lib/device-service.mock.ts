import { of } from 'rxjs';
import { vi } from 'vitest';
import { IDeviceService } from '@teensyrom-nx/domain';

export function createMockDeviceService(
  overrides: Partial<IDeviceService> = {}
): Partial<IDeviceService> {
  return {
    findDevices: vi.fn().mockReturnValue(of([])),
    connectTcpDevice: vi.fn().mockReturnValue(of({})),
    resetDevice: vi.fn().mockReturnValue(of(undefined)),
    pingDevice: vi.fn().mockReturnValue(of(undefined)),
    ...overrides,
  };
}
