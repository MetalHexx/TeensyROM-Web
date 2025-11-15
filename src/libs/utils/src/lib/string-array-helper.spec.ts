import { describe, it, expect } from 'vitest';
import { arrayToString, stringToArray } from './string-array-helper';

describe('String Array Helpers', () => {
  describe('arrayToString', () => {
    it('should convert array to comma-separated string', () => {
      const result = arrayToString(['foo', 'bar', 'baz']);
      expect(result).toBe('foo,bar,baz');
    });

    it('should handle empty array', () => {
      const result = arrayToString([]);
      expect(result).toBe('');
    });

    it('should handle single element array', () => {
      const result = arrayToString(['single']);
      expect(result).toBe('single');
    });

    it('should preserve whitespace in elements', () => {
      const result = arrayToString(['foo bar', 'baz qux']);
      expect(result).toBe('foo bar,baz qux');
    });
  });

  describe('stringToArray', () => {
    it('should convert comma-separated string to array', () => {
      const result = stringToArray('foo,bar,baz');
      expect(result).toEqual(['foo', 'bar', 'baz']);
    });

    it('should trim whitespace from elements', () => {
      const result = stringToArray('foo, bar , baz');
      expect(result).toEqual(['foo', 'bar', 'baz']);
    });

    it('should filter out empty elements', () => {
      const result = stringToArray('foo,,bar,,,baz');
      expect(result).toEqual(['foo', 'bar', 'baz']);
    });

    it('should handle empty string', () => {
      const result = stringToArray('');
      expect(result).toEqual([]);
    });

    it('should handle string with only commas', () => {
      const result = stringToArray(',,,');
      expect(result).toEqual([]);
    });

    it('should handle string with only whitespace', () => {
      const result = stringToArray('   ');
      expect(result).toEqual([]);
    });

    it('should handle single element', () => {
      const result = stringToArray('single');
      expect(result).toEqual(['single']);
    });

    it('should preserve internal whitespace after trimming', () => {
      const result = stringToArray('foo bar, baz qux');
      expect(result).toEqual(['foo bar', 'baz qux']);
    });
  });

  describe('roundtrip conversion', () => {
    it('should maintain data integrity through roundtrip', () => {
      const original = ['foo', 'bar', 'baz'];
      const stringified = arrayToString(original);
      const parsed = stringToArray(stringified);
      expect(parsed).toEqual(original);
    });

    it('should handle roundtrip with whitespace normalization', () => {
      const original = ['foo', 'bar', 'baz'];
      const stringWithSpaces = 'foo, bar , baz';
      const parsed = stringToArray(stringWithSpaces);
      expect(parsed).toEqual(original);
    });
  });
});
