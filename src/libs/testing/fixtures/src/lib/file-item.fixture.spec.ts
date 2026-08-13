import { describe, it, expect } from 'vitest';
import { FileItemType } from '@teensyrom-nx/domain';
import { createTestFileItem } from './file-item.fixture';

describe('createTestFileItem', () => {
  it('returns a valid, fully-populated FileItem when called with no overrides', () => {
    const file = createTestFileItem();

    expect(file.name).toBe('test-file.sid');
    expect(file.type).toBe(FileItemType.Song);
    expect(file.isCompatible).toBe(true);
    expect(Array.isArray(file.subtuneLengths)).toBe(true);
    expect(Array.isArray(file.images)).toBe(true);
    expect(Array.isArray(file.links)).toBe(true);
    expect(Array.isArray(file.tags)).toBe(true);
    expect(Array.isArray(file.youTubeVideos)).toBe(true);
    expect(Array.isArray(file.competitions)).toBe(true);
  });

  it('lets overrides win over defaults while leaving other fields untouched', () => {
    const file = createTestFileItem({ name: 'custom.sid', isCompatible: false, ratingCount: 5 });

    expect(file.name).toBe('custom.sid');
    expect(file.isCompatible).toBe(false);
    expect(file.ratingCount).toBe(5);
    expect(file.type).toBe(FileItemType.Song);
    expect(file.path).toBe('/music/test-file.sid');
  });
});
