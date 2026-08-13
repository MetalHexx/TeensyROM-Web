import { signal } from '@angular/core';
import { vi } from 'vitest';
import type { LaunchedFile } from '@teensyrom-nx/application';
import { StorageType } from '@teensyrom-nx/domain';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';
import { createMockPlayerContext } from './player-context.mock';

describe('createMockPlayerContext', () => {
  it('stubs every member of the contract with a defined default', () => {
    const mock = createMockPlayerContext();

    expect(Object.keys(mock)).toHaveLength(36);
    expect(Object.values(mock).every((member) => member !== undefined)).toBe(true);
  });

  it('merges overrides on top of the defaults', () => {
    const defaultMock = createMockPlayerContext();
    expect(defaultMock.isCurrentFileCompatible?.('device-1')()).toBe(true);

    const overriddenMock = createMockPlayerContext({
      isCurrentFileCompatible: vi.fn().mockReturnValue(signal(false).asReadonly()),
    });

    expect(overriddenMock.isCurrentFileCompatible?.('device-1')()).toBe(false);
  });

  it('lets a spec drive the mock through a supplied signal', () => {
    const currentFileSignal = signal<LaunchedFile | null>(null);
    const mock = createMockPlayerContext({
      getCurrentFile: vi.fn(() => currentFileSignal.asReadonly()),
    });

    expect(mock.getCurrentFile?.('device-1')()).toBeNull();

    const launchedFile: LaunchedFile = {
      storageKey: `device-1-${StorageType.Sd}` as LaunchedFile['storageKey'],
      file: createTestFileItem(),
      parentPath: '/music',
      launchedAt: Date.now(),
      isCompatible: true,
    };
    currentFileSignal.set(launchedFile);

    expect(mock.getCurrentFile?.('device-1')()).toBe(launchedFile);
  });
});
