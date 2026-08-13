import { describe, it, expect, vi } from 'vitest';
import { firstValueFrom, of } from 'rxjs';
import { IStorageService, StorageType } from '@teensyrom-nx/domain';
import { createMockStorageService } from './storage-service.mock';
import { createTestStorageDirectory } from './storage-directory.fixture';

describe('createMockStorageService', () => {
  it('provides default spies for every contract method', async () => {
    const service = createMockStorageService() as IStorageService;

    const directory = await firstValueFrom(service.getDirectory('device-1', StorageType.Sd, '/'));

    expect(directory.path).toBe('/');
    expect(service.index).toBeDefined();
    expect(service.indexAll).toBeDefined();
    expect(service.search).toBeDefined();
    expect(service.saveFavorite).toBeDefined();
    expect(service.removeFavorite).toBeDefined();
  });

  it('lets an override replace one method while the rest keep their defaults', async () => {
    const overrideDirectory = createTestStorageDirectory({ path: '/music' });
    const service = createMockStorageService({
      getDirectory: vi.fn().mockReturnValue(of(overrideDirectory)),
    }) as IStorageService;

    const directory = await firstValueFrom(
      service.getDirectory('device-1', StorageType.Sd, '/music')
    );
    const searchResults = await firstValueFrom(
      service.search('device-1', 'query', undefined, 0, 10)
    );

    expect(directory).toBe(overrideDirectory);
    expect(searchResults).toEqual([]);
  });
});
