import { of } from 'rxjs';
import { vi } from 'vitest';
import { AlertMessage, IAlertService } from '@teensyrom-nx/domain';

export function createMockAlertService(
  overrides: Partial<IAlertService> = {}
): Partial<IAlertService> {
  return {
    alerts$: of([] as AlertMessage[]),
    show: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
    ...overrides,
  };
}
