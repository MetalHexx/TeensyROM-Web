import { DEVICE_NAME_MAX_LENGTH, validateDeviceName } from './device-name-validation';

describe('validateDeviceName', () => {
  it('rejects an empty name', () => {
    expect(validateDeviceName('')).toEqual({ valid: false, name: '', reason: 'empty' });
  });

  it('rejects a whitespace-only name as empty', () => {
    expect(validateDeviceName('   \t ')).toEqual({ valid: false, name: '', reason: 'empty' });
  });

  it('accepts a single character', () => {
    expect(validateDeviceName('A')).toEqual({ valid: true, name: 'A' });
  });

  it('accepts a name of exactly the maximum length', () => {
    const name = 'x'.repeat(DEVICE_NAME_MAX_LENGTH);
    expect(validateDeviceName(name)).toEqual({ valid: true, name });
  });

  it('rejects a name one character over the maximum', () => {
    const name = 'x'.repeat(DEVICE_NAME_MAX_LENGTH + 1);
    expect(validateDeviceName(name)).toEqual({ valid: false, name, reason: 'too-long' });
  });

  it('trims padding before measuring length and returns the trimmed name', () => {
    const name = 'x'.repeat(DEVICE_NAME_MAX_LENGTH);
    expect(validateDeviceName(`  ${name}  `)).toEqual({ valid: true, name });
  });

  it('returns the trimmed name when invalid', () => {
    const name = 'x'.repeat(DEVICE_NAME_MAX_LENGTH + 1);
    expect(validateDeviceName(` ${name} `).name).toBe(name);
  });

  it.each([
    ['newline', 'Bad\nName'],
    ['tab', 'Bad\tName'],
    ['null', 'Bad\u0000Name'],
    ['delete', 'Bad\u007fName'],
  ])('rejects a %s control character', (_label, raw) => {
    expect(validateDeviceName(raw)).toEqual({
      valid: false,
      name: raw,
      reason: 'control-character',
    });
  });

  it('counts UTF-16 units, so an emoji takes two', () => {
    expect(validateDeviceName('😀'.repeat(12)).valid).toBe(true);
    expect(validateDeviceName('😀'.repeat(13))).toMatchObject({ valid: false, reason: 'too-long' });
  });

  it('does not reject duplicates because it knows nothing about other devices', () => {
    expect(validateDeviceName('Living Room').valid).toBe(true);
    expect(validateDeviceName('Living Room').valid).toBe(true);
  });
});
