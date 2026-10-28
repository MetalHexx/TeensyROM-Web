import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageType } from '@teensyrom-nx/domain';
import { logWarn } from '@teensyrom-nx/utils';
import { decodeRowHost, encodeRowHost, formatListingLength } from './row-host';

vi.mock('@teensyrom-nx/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@teensyrom-nx/utils')>();
  return { ...actual, logWarn: vi.fn() };
});

const SOURCE = {
  deviceId: 'device-1',
  storageType: StorageType.Sd,
  path: '/hvsc/a.sid',
  fileName: 'a.sid',
};

describe('row host', () => {
  beforeEach(() => {
    vi.mocked(logWarn).mockClear();
  });

  it('round-trips the file source and the listing lengths, dropping the rest of the source', () => {
    const encoded = encodeRowHost({
      source: { ...SOURCE, title: 'Tune', author: 'Author', playLength: '9:99' },
      lengths: ['3:43', ''],
      playLength: '3:43',
    });

    expect(decodeRowHost(encoded)).toEqual({
      source: SOURCE,
      lengths: ['3:43', ''],
      playLength: '3:43',
    });
    expect(logWarn).not.toHaveBeenCalled();
  });

  it('reads an absent host as none, without a warning', () => {
    expect(decodeRowHost(undefined)).toBeNull();
    expect(logWarn).not.toHaveBeenCalled();
  });

  it.each([
    ['another version', { v: 2, source: SOURCE, lengths: [], playLength: '' }],
    ['no version', { source: SOURCE, lengths: [], playLength: '' }],
    ['a missing source', { v: 1, lengths: [], playLength: '' }],
    ['an unknown storage', { v: 1, source: { ...SOURCE, storageType: 'TAPE' }, lengths: [], playLength: '' }],
    ['lengths that are not text', { v: 1, source: SOURCE, lengths: [1], playLength: '' }],
    ['a non-object', 'a.sid'],
  ])('reads %s as none, warning once', (_label, value) => {
    expect(decodeRowHost(value)).toBeNull();
    expect(logWarn).toHaveBeenCalledTimes(1);
  });
});

describe('formatListingLength', () => {
  it.each([
    ['3:43', '03:43'],
    ['03:43', '03:43'],
    ['3:43.250', '03:43'],
    ['12:05.5', '12:05'],
    ['0:07', '00:07'],
    ['1:02:03', '62:03'],
    ['1:02:03.400', '62:03'],
    ['10:00:00', '600:00'],
    ['', '—'],
    ['unknown', '—'],
    ['3', '—'],
    ['3:7', '—'],
    ['3:75', '—'],
    ['1:75:03', '—'],
    ['-3:43', '—'],
  ])('formats %j as %s', (raw, expected) => {
    expect(formatListingLength(raw)).toBe(expected);
  });
});
