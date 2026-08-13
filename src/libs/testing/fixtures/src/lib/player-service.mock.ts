import { of } from 'rxjs';
import { vi } from 'vitest';
import { IPlayerService } from '@teensyrom-nx/domain';
import { createTestFileItem } from './file-item.fixture';

export function createMockPlayerService(
  overrides: Partial<IPlayerService> = {}
): Partial<IPlayerService> {
  return {
    launchFile: vi.fn().mockReturnValue(of(createTestFileItem())),
    launchRandom: vi.fn().mockReturnValue(of(createTestFileItem())),
    toggleMusic: vi.fn().mockReturnValue(of(undefined)),
    ...overrides,
  };
}
