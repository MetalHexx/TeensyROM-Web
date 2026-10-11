import { of } from 'rxjs';
import { vi } from 'vitest';
import { Device, IDeviceService } from '@teensyrom-nx/domain';

export function createMockDeviceService(
  overrides: Partial<IDeviceService> = {}
): Partial<IDeviceService> {
  return {
    findDevices: vi.fn().mockReturnValue(of([])),
    resetDevice: vi.fn().mockReturnValue(of(undefined)),
    pingDevice: vi.fn().mockReturnValue(of(undefined)),
    reconnectDevice: vi.fn().mockReturnValue(of({} as Device)),
    forgetDevice: vi.fn().mockReturnValue(of(undefined)),
    renameDevice: vi.fn().mockReturnValue(of({} as Device)),
    ...overrides,
  };
}
