import { StorageDirectory } from '@teensyrom-nx/domain';

export const createTestStorageDirectory = (
  overrides: Partial<StorageDirectory> = {}
): StorageDirectory => ({
  path: '/',
  directories: [],
  files: [],
  ...overrides,
});
