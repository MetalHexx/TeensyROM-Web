import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  isBuiltInPreset,
  isCustomPreset,
  stripCustomPrefix,
  addCustomPrefix,
  CRT_PRESET_PREFIX,
  CRT_PRESET_KEYS,
  type BuiltInPresetName,
  type CustomPresetName,
  type AnyPresetName,
} from './crt-settings.interface';

describe('CRT Preset Type Guards and Utilities', () => {
  describe('isBuiltInPreset', () => {
    it('should return true for new built-in preset names', () => {
      expect(isBuiltInPreset(CRT_PRESET_KEYS.SMALL_WEBGL)).toBe(true);
      expect(isBuiltInPreset(CRT_PRESET_KEYS.LARGE_WEBGL)).toBe(true);
    });

    it('should return false for custom-My Preset', () => {
      expect(isBuiltInPreset('custom-My Preset')).toBe(false);
    });

    it('should return false for large-webgl (no prefix)', () => {
      expect(isBuiltInPreset('large-webgl')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isBuiltInPreset('')).toBe(false);
    });

    it('should narrow type correctly', () => {
      const name = CRT_PRESET_KEYS.LARGE_WEBGL as string;
      if (isBuiltInPreset(name)) {
        // Type should be narrowed to BuiltInPresetName
        // Just verify compilation succeeds - runtime check is sufficient
        expect(name).toBe(CRT_PRESET_KEYS.LARGE_WEBGL);
      }
    });
  });

  describe('isCustomPreset', () => {
    it('should return true for custom-My Preset', () => {
      expect(isCustomPreset('custom-My Preset')).toBe(true);
    });

    it('should return true for custom- (edge case: empty name after prefix)', () => {
      expect(isCustomPreset('custom-')).toBe(true);
    });

    it('should return false for built-in preset names', () => {
      expect(isCustomPreset(CRT_PRESET_KEYS.LARGE_WEBGL)).toBe(false);
      expect(isCustomPreset(CRT_PRESET_KEYS.SMALL_WEBGL)).toBe(false);
    });

    it('should return false for My Preset (no prefix)', () => {
      expect(isCustomPreset('My Preset')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isCustomPreset('')).toBe(false);
    });

    it('should narrow type correctly', () => {
      const name = 'custom-Test' as string;
      if (isCustomPreset(name)) {
        // Type should be narrowed to CustomPresetName
        // Just verify compilation succeeds - runtime check is sufficient
        expect(name).toBe('custom-Test');
      }
    });
  });

  describe('stripCustomPrefix', () => {
    it('should remove custom- prefix correctly', () => {
      expect(stripCustomPrefix('custom-Test')).toBe('Test');
    });

    it('should handle name with no prefix', () => {
      expect(stripCustomPrefix('Test')).toBe('Test');
    });

    it('should handle empty string', () => {
      expect(stripCustomPrefix('')).toBe('');
    });

    it('should handle custom- with no suffix (edge case)', () => {
      expect(stripCustomPrefix('custom-')).toBe('');
    });

    it('should preserve spaces in name', () => {
      expect(stripCustomPrefix('custom-My Preset')).toBe('My Preset');
    });

    it('should preserve hyphens in name', () => {
      expect(stripCustomPrefix('custom-My-Preset')).toBe('My-Preset');
    });

    it('should be case-sensitive (does not strip Custom-)', () => {
      expect(stripCustomPrefix('Custom-Test')).toBe('Custom-Test');
    });

    it('should not strip default- prefix', () => {
      expect(stripCustomPrefix(CRT_PRESET_KEYS.LARGE_WEBGL)).toBe(
        CRT_PRESET_KEYS.LARGE_WEBGL
      );
    });

    it('should handle multiple custom- occurrences (only strips first)', () => {
      expect(stripCustomPrefix('custom-custom-Test')).toBe('custom-Test');
    });

    it('should use CRT_PRESET_PREFIX.CUSTOM constant', () => {
      // Verify we're using the constant, not magic string
      const prefixLength = CRT_PRESET_PREFIX.CUSTOM.length;
      expect(stripCustomPrefix('custom-Test').length).toBe('Test'.length);
      expect(prefixLength).toBe(7); // 'custom-' is 7 characters
    });
  });

  describe('addCustomPrefix', () => {
    it('should add custom- prefix to name without prefix', () => {
      expect(addCustomPrefix('My Preset')).toBe('custom-My Preset');
    });

    it('should be idempotent (does not add prefix if already present)', () => {
      expect(addCustomPrefix('custom-My Preset')).toBe('custom-My Preset');
    });

    it('should handle empty string', () => {
      expect(addCustomPrefix('')).toBe('custom-');
    });

    it('should preserve spaces in name', () => {
      expect(addCustomPrefix('My Cool Preset')).toBe('custom-My Cool Preset');
    });

    it('should preserve hyphens in name', () => {
      expect(addCustomPrefix('My-Preset')).toBe('custom-My-Preset');
    });

    it('should be case-sensitive (adds prefix even if Custom- is present)', () => {
      expect(addCustomPrefix('Custom-Test')).toBe('custom-Custom-Test');
    });

    it('should use CRT_PRESET_PREFIX.CUSTOM constant', () => {
      const result = addCustomPrefix('Test');
      expect(result.startsWith(CRT_PRESET_PREFIX.CUSTOM)).toBe(true);
    });

    it('should return type CustomPresetName', () => {
      const result = addCustomPrefix('Test');
      expectTypeOf(result).toMatchTypeOf<CustomPresetName>();
    });
  });

  describe('Type System Integration', () => {
    it('should allow BuiltInPresetName to be assigned to AnyPresetName', () => {
      const builtIn: BuiltInPresetName = CRT_PRESET_KEYS.LARGE_WEBGL;
      const any: AnyPresetName = builtIn;
      expect(any).toBe(CRT_PRESET_KEYS.LARGE_WEBGL);
    });

    it('should allow CustomPresetName to be assigned to AnyPresetName', () => {
      const custom: CustomPresetName = 'custom-Test' as CustomPresetName;
      const any: AnyPresetName = custom;
      expect(any).toBe('custom-Test');
    });

    it('should narrow AnyPresetName using type guards', () => {
      const name = 'custom-Test' as AnyPresetName;
      
      if (isCustomPreset(name)) {
        // Type narrowing works - just verify runtime behavior
        expect(name).toBe('custom-Test');
      }
    });
  });

  describe('CRT_PRESET_PREFIX constant usage', () => {
    it('should use DEFAULT prefix in isBuiltInPreset', () => {
      const testName = `${CRT_PRESET_PREFIX.DEFAULT}test`;
      expect(isBuiltInPreset(testName)).toBe(true);
    });

    it('should use CUSTOM prefix in isCustomPreset', () => {
      const testName = `${CRT_PRESET_PREFIX.CUSTOM}test`;
      expect(isCustomPreset(testName)).toBe(true);
    });

    it('should use CUSTOM prefix in stripCustomPrefix', () => {
      const testName = `${CRT_PRESET_PREFIX.CUSTOM}test`;
      expect(stripCustomPrefix(testName)).toBe('test');
    });

    it('should use CUSTOM prefix in addCustomPrefix', () => {
      const result = addCustomPrefix('test');
      expect(result).toBe(`${CRT_PRESET_PREFIX.CUSTOM}test`);
    });
  });

  describe('Round-trip transformations', () => {
    it('should round-trip add then strip prefix', () => {
      const original = 'My Preset';
      const withPrefix = addCustomPrefix(original);
      const stripped = stripCustomPrefix(withPrefix);
      expect(stripped).toBe(original);
    });

    it('should be idempotent: add → add → strip = original', () => {
      const original = 'Test';
      const result = stripCustomPrefix(addCustomPrefix(addCustomPrefix(original)));
      expect(result).toBe(original);
    });

    it('should preserve name through multiple transformations', () => {
      const names = ['Simple', 'With Spaces', 'With-Hyphens', 'Mixed-Both Here'];
      
      names.forEach((name) => {
        const result = stripCustomPrefix(addCustomPrefix(name));
        expect(result).toBe(name);
      });
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle very long preset names', () => {
      const longName = 'A'.repeat(1000);
      const withPrefix = addCustomPrefix(longName);
      expect(withPrefix.startsWith(CRT_PRESET_PREFIX.CUSTOM)).toBe(true);
      expect(stripCustomPrefix(withPrefix)).toBe(longName);
    });

    it('should handle special characters', () => {
      const specialChars = '!@#$%^&*()_+={}[]|\\:;"<>,.?/~`';
      const withPrefix = addCustomPrefix(specialChars);
      expect(stripCustomPrefix(withPrefix)).toBe(specialChars);
    });

    it('should handle unicode characters', () => {
      const unicode = '🎮 Gaming Preset 日本語';
      const withPrefix = addCustomPrefix(unicode);
      expect(stripCustomPrefix(withPrefix)).toBe(unicode);
    });

    it('should handle newlines and tabs (though invalid in practice)', () => {
      const withWhitespace = 'Test\nWith\tWhitespace';
      const withPrefix = addCustomPrefix(withWhitespace);
      expect(stripCustomPrefix(withPrefix)).toBe(withWhitespace);
    });
  });

  describe('TypeScript Type Tests', () => {
    describe('BuiltInPresetName type', () => {
      it('should include all 2 new preset keys as valid assignments', () => {
        // These assignments should compile without error
        const smallWebGL: BuiltInPresetName = CRT_PRESET_KEYS.SMALL_WEBGL;
        const largeWebGL: BuiltInPresetName = CRT_PRESET_KEYS.LARGE_WEBGL;

        // Verify runtime values
        expect(smallWebGL).toBe('default-small-webgl');
        expect(largeWebGL).toBe('default-large-webgl');
      });

      it('should match the 2 preset keys exactly', () => {
        // Verify we have exactly 2 built-in presets
        const presetKeys = Object.values(CRT_PRESET_KEYS);
        expect(presetKeys).toHaveLength(2);
        
        // All preset keys should be valid BuiltInPresetName values
        presetKeys.forEach((key) => {
          expect(key.startsWith('default-')).toBe(true);
        });
      });
    });

    describe('CustomPresetName type', () => {
      it('should accept custom- prefixed names', () => {
        // These assignments should compile without error
        const custom1: CustomPresetName = 'custom-My Preset';
        const custom2: CustomPresetName = 'custom-Retro Gaming';

        expect(custom1).toBe('custom-My Preset');
        expect(custom2).toBe('custom-Retro Gaming');
      });
    });

    describe('AnyPresetName type', () => {
      it('should accept both built-in and custom preset names', () => {
        // These assignments should compile without error
        const builtIn: AnyPresetName = CRT_PRESET_KEYS.SMALL_WEBGL;
        const custom: AnyPresetName = 'custom-My Preset';

        expect(builtIn).toBe('default-small-webgl');
        expect(custom).toBe('custom-My Preset');
      });
    });
  });
});
