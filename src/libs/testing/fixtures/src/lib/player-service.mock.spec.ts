import { describe, it, expect, vi } from 'vitest';
import { firstValueFrom, of } from 'rxjs';
import { IPlayerService, PlayerScope, PlayerFilterType } from '@teensyrom-nx/domain';
import { createMockPlayerService } from './player-service.mock';
import { createTestFileItem } from './file-item.fixture';

describe('createMockPlayerService', () => {
  it('provides default spies for every contract method', async () => {
    const service = createMockPlayerService() as IPlayerService;

    const launched = await firstValueFrom(service.launchFile('device-1', createTestFileItem()));

    expect(launched.name).toBe('test-file.sid');
    expect(service.launchRandom).toBeDefined();
    expect(service.toggleMusic).toBeDefined();
  });

  it('lets an override replace one method while the rest keep their defaults', async () => {
    const overrideFile = createTestFileItem({ name: 'override.sid' });
    const service = createMockPlayerService({
      launchFile: vi.fn().mockReturnValue(of(overrideFile)),
    }) as IPlayerService;

    const launched = await firstValueFrom(service.launchFile('device-1', overrideFile));
    const randomLaunched = await firstValueFrom(
      service.launchRandom('device-1', PlayerScope.Storage, PlayerFilterType.All)
    );

    expect(launched).toBe(overrideFile);
    expect(randomLaunched.name).toBe('test-file.sid');
  });
});
