import { describe, it, expect } from 'vitest';
import { validatePresetName } from '@teensyrom-nx/domain';

describe('validatePresetName', () => {
  describe('Empty/Whitespace Tests', () => {
    it('should fail validation for empty string', () => {
      const result = validatePresetName('', []);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Preset name cannot be empty');
    });

    it('should fail validation for whitespace-only string', () => {
      const result = validatePresetName('   ', []);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Preset name cannot be empty');
    });

    it('should fail validation for string with only spaces', () => {
      const result = validatePresetName('     ', []);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Preset name cannot be empty');
    });
  });

  describe('Length Tests', () => {
    it('should fail validation for 51-character name', () => {
      const longName = 'A'.repeat(51);
      const result = validatePresetName(longName, []);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Preset name must be between 1 and 50 characters');
    });

    it('should pass validation for 50-character name (boundary)', () => {
      const maxLengthName = 'A'.repeat(50);
      const result = validatePresetName(maxLengthName, []);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should pass validation for 1-character name (boundary)', () => {
      const result = validatePresetName('A', []);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail validation for very long name (60+ chars)', () => {
      const veryLongName = 'A'.repeat(75);
      const result = validatePresetName(veryLongName, []);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Preset name must be between 1 and 50 characters');
    });
  });

  describe('Character Validation Tests', () => {
    it('should fail validation for name with special characters (!@#$%)', () => {
      const result = validatePresetName('My Preset!@#', []);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Preset name can only contain letters, numbers, spaces, hyphens, periods, and underscores');
    });

    it('should pass validation for name with underscores', () => {
      const result = validatePresetName('My_Preset', []);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should pass validation for name with alphanumeric only', () => {
      const result = validatePresetName('MyPreset123', []);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should pass validation for name with spaces', () => {
      const result = validatePresetName('My Cool Preset', []);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should pass validation for name with hyphens', () => {
      const result = validatePresetName('My-Cool-Preset', []);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should pass validation for mixed valid characters', () => {
      const result = validatePresetName('My Cool Preset-123', []);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Reserved Name Tests', () => {
    it('should fail validation for exact match to built-in preset (small-video-webgl)', () => {
      const result = validatePresetName('small-video-webgl', []);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('This name is reserved for a built-in preset');
    });

    it('should fail validation for case-insensitive match (SMALL-VIDEO-WEBGL)', () => {
      const result = validatePresetName('SMALL-VIDEO-WEBGL', []);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('This name is reserved for a built-in preset');
    });

    it('should fail validation for mixed case match (Small-Video-WebGL)', () => {
      const result = validatePresetName('Small-Video-WebGL', []);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('This name is reserved for a built-in preset');
    });

    it('should fail validation for large-video-webgl', () => {
      const result = validatePresetName('large-video-webgl', []);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('This name is reserved for a built-in preset');
    });

    it('should fail validation for Large-Video-Webgl (mixed case)', () => {
      const result = validatePresetName('Large-Video-Webgl', []);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('This name is reserved for a built-in preset');
    });

    it('should pass validation for non-reserved name', () => {
      const result = validatePresetName('My Custom Preset', []);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Uniqueness Tests', () => {
    it('should fail validation for exact match to existing custom name', () => {
      const result = validatePresetName('My Preset', ['My Preset']);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('A preset with this name already exists');
    });

    it('should fail validation for case-insensitive match (my preset vs My Preset)', () => {
      const result = validatePresetName('my preset', ['My Preset']);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('A preset with this name already exists');
    });

    it('should fail validation for uppercase match (MY PRESET vs My Preset)', () => {
      const result = validatePresetName('MY PRESET', ['My Preset']);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('A preset with this name already exists');
    });

    it('should pass validation for unique name with no conflicts', () => {
      const result = validatePresetName('New Preset', ['Existing Preset', 'Another Preset']);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should pass validation when existingCustomNames array is empty', () => {
      const result = validatePresetName('My First Preset', []);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should pass validation for name with leading/trailing spaces (after trim)', () => {
      const result = validatePresetName('  My Preset  ', []);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail validation for name with leading/trailing spaces matching existing (after trim)', () => {
      const result = validatePresetName('  My Preset  ', ['My Preset']);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('A preset with this name already exists');
    });

    it('should fail validation for name with mixed case reserved word (SmAlL-Video-WebGL)', () => {
      const result = validatePresetName('SmAlL-Video-WebGL', []);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('This name is reserved for a built-in preset');
    });

    it('should pass validation for numbers only', () => {
      const result = validatePresetName('12345', []);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should pass validation for hyphens only is technically valid characters but may be edge case', () => {
      const result = validatePresetName('---', []);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
