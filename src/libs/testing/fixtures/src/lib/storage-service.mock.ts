import { of } from 'rxjs';
import { vi } from 'vitest';
import { IStorageService } from '@teensyrom-nx/domain';
import { createTestFileItem } from './file-item.fixture';
import { createTestStorageDirectory } from './storage-directory.fixture';

export function createMockStorageService(
  overrides: Partial<IStorageService> = {}
): Partial<IStorageService> {
  return {
    getDirectory: vi.fn().mockReturnValue(of(createTestStorageDirectory())),
    index: vi.fn().mockReturnValue(of(undefined)),
    indexAll: vi.fn().mockReturnValue(of(undefined)),
    search: vi.fn().mockReturnValue(of([])),
    saveFavorite: vi.fn().mockReturnValue(of(createTestFileItem())),
    removeFavorite: vi.fn().mockReturnValue(of(undefined)),
    ...overrides,
  };
}
