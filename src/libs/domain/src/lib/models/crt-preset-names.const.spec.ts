import { CRT_PRESET_KEYS, CRT_PRESET_PREFIX, PresetKey } from './crt-preset-names.const';

describe('CRT_PRESET_PREFIX', () => {
  it('should have DEFAULT prefix', () => {
    expect(CRT_PRESET_PREFIX.DEFAULT).toBe('default-');
  });

  it('should have CUSTOM prefix', () => {
    expect(CRT_PRESET_PREFIX.CUSTOM).toBe('custom-');
  });
});

describe('CRT_PRESET_KEYS', () => {
  it('should have exactly 3 preset keys', () => {
    expect(Object.keys(CRT_PRESET_KEYS)).toHaveLength(3);
  });

  it('should have context-based key names', () => {
    expect(CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL).toBeDefined();
    expect(CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL).toBeDefined();
    expect(CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL).toBeDefined();
  });

  it('should use default prefix for all keys', () => {
    Object.values(CRT_PRESET_KEYS).forEach((key) => {
      expect(key).toMatch(/^default-/);
    });
  });

  it('should follow default-{context}-webgl format for all keys', () => {
    expect(CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL).toBe('default-small-video-webgl');
    expect(CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL).toBe('default-large-video-webgl');
    expect(CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL).toBe('default-small-image-webgl');
  });

  it('should have consistent naming convention', () => {
    const pattern = /^default-(small-video|large-video|small-image)-webgl$/;
    Object.values(CRT_PRESET_KEYS).forEach((key) => {
      expect(key).toMatch(pattern);
    });
  });
});

describe('PresetKey type', () => {
  it('should accept all valid preset key values', () => {
    const validKeys: PresetKey[] = [
      CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL,
      CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL,
      CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL,
    ];

    validKeys.forEach((key) => {
      expect(typeof key).toBe('string');
      expect(key).toMatch(/^default-/);
    });
  });

  it('should include all WebGL string literal values', () => {
    const presetKeyValues = Object.values(CRT_PRESET_KEYS);
    expect(presetKeyValues).toHaveLength(3);
    expect(presetKeyValues).toContain('default-small-video-webgl');
    expect(presetKeyValues).toContain('default-large-video-webgl');
    expect(presetKeyValues).toContain('default-small-image-webgl');
  });
});
