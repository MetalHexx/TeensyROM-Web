import { describe, it, expect } from 'vitest';
import { createTestStorageDirectory } from './storage-directory.fixture';
import { createTestFileItem } from './file-item.fixture';

describe('createTestStorageDirectory', () => {
  it('returns a valid StorageDirectory when called with no overrides', () => {
    const directory = createTestStorageDirectory();

    expect(directory.path).toBe('/');
    expect(directory.directories).toEqual([]);
    expect(directory.files).toEqual([]);
  });

  it('lets overrides win over defaults while leaving other fields untouched', () => {
    const file = createTestFileItem({ name: 'song.sid' });
    const directory = createTestStorageDirectory({ path: '/music', files: [file] });

    expect(directory.path).toBe('/music');
    expect(directory.files).toEqual([file]);
    expect(directory.directories).toEqual([]);
  });
});
