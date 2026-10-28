import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DjLibraryApiService } from '@teensyrom-nx/data-access/api-client';
import { ApiDjLibraryStateRepository } from './api-dj-library-state-repository';

describe('ApiDjLibraryStateRepository', () => {
  let repository: ApiDjLibraryStateRepository;
  let api: {
    getDjLibraryState: ReturnType<typeof vi.fn>;
    saveDjLibraryState: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = {
      getDjLibraryState: vi.fn(),
      saveDjLibraryState: vi.fn().mockResolvedValue({ message: 'saved' }),
    };
    TestBed.configureTestingModule({
      providers: [ApiDjLibraryStateRepository, { provide: DjLibraryApiService, useValue: api }],
    });
    repository = TestBed.inject(ApiDjLibraryStateRepository);
  });

  it('loads the current set id', async () => {
    api.getDjLibraryState.mockResolvedValue({ currentSetId: 'set-1' });

    expect(await repository.load()).toBe('set-1');
  });

  it.each([[{ currentSetId: null }], [{}]])('loads null when the server holds none (%j)', async (response) => {
    api.getDjLibraryState.mockResolvedValue(response);

    expect(await repository.load()).toBeNull();
  });

  it('saves the current set id, or null for none', async () => {
    await repository.save('set-1');
    await repository.save(null);

    expect(api.saveDjLibraryState).toHaveBeenNthCalledWith(1, {
      djLibraryStateDto: { currentSetId: 'set-1' },
    });
    expect(api.saveDjLibraryState).toHaveBeenNthCalledWith(2, {
      djLibraryStateDto: { currentSetId: null },
    });
  });

  it('lets a failed load and a failed save propagate', async () => {
    api.getDjLibraryState.mockRejectedValue(new Error('500'));
    api.saveDjLibraryState.mockRejectedValue(new Error('400'));

    await expect(repository.load()).rejects.toThrow('500');
    await expect(repository.save('set-1')).rejects.toThrow('400');
  });
});
