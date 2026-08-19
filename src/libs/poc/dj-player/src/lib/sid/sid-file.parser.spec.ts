import { describe, it, expect } from 'vitest';
import { parseSidFile, isCiaTimed } from './sid-file.parser';
import { SidFile, SidParseError } from './sid-file.model';
import { BUNDLED_TUNES, decodeBundledTune } from './bundled';

const HEADER_SIZE_V1 = 0x76; // 118 — no flags/model/extra-SID fields
const HEADER_SIZE_V2_PLUS = 0x7c; // 124 — full extended header

interface HeaderOptions {
  magic?: string;
  version?: number;
  dataOffset?: number;
  loadAddress?: number;
  initAddress?: number;
  playAddress?: number;
  songs?: number;
  startSong?: number;
  speedFlags?: number;
  name?: string;
  author?: string;
  released?: string;
  flags?: number;
  secondSidByte?: number;
  thirdSidByte?: number;
  payload?: number[];
}

/** Builds a well-formed PSID/RSID byte array from field overrides, defaulting to a minimal v2 header. */
function buildSidFileBytes(options: HeaderOptions = {}): Uint8Array {
  const version = options.version ?? 2;
  const headerSize = options.dataOffset ?? (version === 1 ? HEADER_SIZE_V1 : HEADER_SIZE_V2_PLUS);
  const payload = options.payload ?? [0xa9, 0x00, 0x60];
  const buffer = new Uint8Array(headerSize + payload.length);
  const view = new DataView(buffer.buffer);

  writeAscii(buffer, 0x00, options.magic ?? 'PSID');
  view.setUint16(0x04, version, false);
  view.setUint16(0x06, headerSize, false);
  view.setUint16(0x08, options.loadAddress ?? 0x1000, false);
  view.setUint16(0x0a, options.initAddress ?? 0x1000, false);
  view.setUint16(0x0c, options.playAddress ?? 0x1003, false);
  view.setUint16(0x0e, options.songs ?? 1, false);
  view.setUint16(0x10, options.startSong ?? 1, false);
  view.setUint32(0x12, options.speedFlags ?? 0, false);
  writeAscii(buffer, 0x16, options.name ?? 'Test Tune');
  writeAscii(buffer, 0x36, options.author ?? 'Test Author');
  writeAscii(buffer, 0x56, options.released ?? '2024 Test');

  if (headerSize >= 0x78 && options.flags !== undefined) {
    view.setUint16(0x76, options.flags, false);
  }
  if (headerSize >= 0x7b && options.secondSidByte !== undefined) {
    buffer[0x7a] = options.secondSidByte;
  }
  if (headerSize >= 0x7c && options.thirdSidByte !== undefined) {
    buffer[0x7b] = options.thirdSidByte;
  }

  buffer.set(payload, headerSize);
  return buffer;
}

function writeAscii(buffer: Uint8Array, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    buffer[offset + i] = text.charCodeAt(i);
  }
}

function fakeSidFile(speedFlags: number): SidFile {
  return {
    format: 'PSID',
    version: 2,
    loadAddress: 0x1000,
    initAddress: 0x1000,
    playAddress: 0x1003,
    songs: 32,
    startSong: 1,
    speedFlags,
    name: '',
    author: '',
    released: '',
    clock: 'unknown',
    model: 'unknown',
    secondSidAddress: null,
    thirdSidAddress: null,
    data: new Uint8Array(),
  };
}

describe('parseSidFile', () => {
  it('extracts big-endian header fields from a v2 PSID header', () => {
    const bytes = buildSidFileBytes({
      loadAddress: 0x1000,
      initAddress: 0x1006,
      playAddress: 0x1009,
      songs: 3,
      startSong: 2,
      speedFlags: 0b101,
      name: 'Some Tune',
      author: 'Some Author',
      released: '2024 Some Label',
    });

    const file = parseSidFile(bytes);

    expect(file.format).toBe('PSID');
    expect(file.version).toBe(2);
    expect(file.loadAddress).toBe(0x1000);
    expect(file.initAddress).toBe(0x1006);
    expect(file.playAddress).toBe(0x1009);
    expect(file.songs).toBe(3);
    expect(file.startSong).toBe(2);
    expect(file.speedFlags).toBe(0b101);
    expect(file.name).toBe('Some Tune');
    expect(file.author).toBe('Some Author');
    expect(file.released).toBe('2024 Some Label');
    expect(file.data).toEqual(new Uint8Array([0xa9, 0x00, 0x60]));
  });

  it('parses RSID magic', () => {
    const file = parseSidFile(buildSidFileBytes({ magic: 'RSID' }));
    expect(file.format).toBe('RSID');
  });

  it('resolves a header playAddress of 0 as "installs its own IRQ vector" (passes through unresolved)', () => {
    const file = parseSidFile(buildSidFileBytes({ playAddress: 0 }));
    expect(file.playAddress).toBe(0);
  });

  it('resolves initAddress of 0 to loadAddress', () => {
    const file = parseSidFile(buildSidFileBytes({ loadAddress: 0x2000, initAddress: 0 }));
    expect(file.initAddress).toBe(0x2000);
  });

  it('resolves an embedded load address (header loadAddress 0) and excludes it from data', () => {
    // Embedded address bytes are little-endian: 0x34, 0x12 -> 0x1234.
    const bytes = buildSidFileBytes({
      loadAddress: 0,
      payload: [0x34, 0x12, 0xa9, 0x00, 0x60],
    });

    const file = parseSidFile(bytes);

    expect(file.loadAddress).toBe(0x1234);
    expect(file.data).toEqual(new Uint8Array([0xa9, 0x00, 0x60]));
  });

  it('uses the v1 dataOffset (0x76) and has no clock/model/extra-SID data', () => {
    const bytes = buildSidFileBytes({ version: 1 });

    const file = parseSidFile(bytes);

    expect(file.version).toBe(1);
    expect(file.clock).toBe('unknown');
    expect(file.model).toBe('unknown');
    expect(file.secondSidAddress).toBeNull();
    expect(file.thirdSidAddress).toBeNull();
    expect(file.data).toEqual(new Uint8Array([0xa9, 0x00, 0x60]));
  });

  it.each([
    [0b0001, 0b0000, 'pal', 'unknown'],
    [0b0010, 0b0000, 'ntsc', 'unknown'],
    [0b0011, 0b0000, 'any', 'unknown'],
    [0b0000, 0b0001, 'unknown', 'mos6581'],
    [0b0000, 0b0010, 'unknown', 'mos8580'],
    [0b0000, 0b0011, 'unknown', 'any'],
    [0b0001, 0b0010, 'pal', 'mos8580'],
  ] as const)('decodes clock/model bits %s/%s as %s/%s', (clockBits, modelBits, clock, model) => {
    const flags = (modelBits << 4) | (clockBits << 2);
    const file = parseSidFile(buildSidFileBytes({ flags }));

    expect(file.clock).toBe(clock);
    expect(file.model).toBe(model);
  });

  it('resolves a v3 secondSidAddress from the encoded byte', () => {
    const file = parseSidFile(buildSidFileBytes({ version: 3, secondSidByte: 0x50 }));
    expect(file.secondSidAddress).toBe(0xd500);
    expect(file.thirdSidAddress).toBeNull();
  });

  it('resolves a v4 thirdSidAddress from the encoded byte', () => {
    const file = parseSidFile(buildSidFileBytes({ version: 4, secondSidByte: 0x50, thirdSidByte: 0x42 }));
    expect(file.secondSidAddress).toBe(0xd500);
    expect(file.thirdSidAddress).toBe(0xd420);
  });

  it('ignores a nonzero extra-SID byte on a v2 file (field is version-gated)', () => {
    const file = parseSidFile(buildSidFileBytes({ version: 2, secondSidByte: 0x50 }));
    expect(file.secondSidAddress).toBeNull();
  });

  it('treats an extra-SID byte of 0 as "none"', () => {
    const file = parseSidFile(buildSidFileBytes({ version: 3, secondSidByte: 0 }));
    expect(file.secondSidAddress).toBeNull();
  });

  it('rejects bytes whose magic is neither PSID nor RSID', () => {
    expect(() => parseSidFile(buildSidFileBytes({ magic: 'XSID' }))).toThrow(SidParseError);
  });

  it('rejects a version outside 1-4', () => {
    expect(() => parseSidFile(buildSidFileBytes({ version: 5 }))).toThrow(SidParseError);
    expect(() => parseSidFile(buildSidFileBytes({ version: 0 }))).toThrow(SidParseError);
  });

  it('rejects a file shorter than its own dataOffset', () => {
    const truncated = buildSidFileBytes().slice(0, 50);
    expect(() => parseSidFile(truncated)).toThrow(SidParseError);
  });

  it('rejects a file too short to contain even the fixed magic/version/dataOffset fields', () => {
    expect(() => parseSidFile(new Uint8Array([0x50, 0x53, 0x49]))).toThrow(SidParseError);
  });

  it('rejects an embedded-load-address file whose payload is too short to hold the address', () => {
    const bytes = buildSidFileBytes({ loadAddress: 0, payload: [] });
    expect(() => parseSidFile(bytes)).toThrow(SidParseError);
  });

  it('throws SidParseError with a readable message naming the problem', () => {
    try {
      parseSidFile(buildSidFileBytes({ magic: 'XSID' }));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SidParseError);
      expect((error as Error).message).toMatch(/magic/i);
    }
  });
});

describe('isCiaTimed', () => {
  it('reads the bit for each 1-based song', () => {
    const file = fakeSidFile(0b101); // songs 1 and 3 are CIA-timed
    expect(isCiaTimed(file, 1)).toBe(true);
    expect(isCiaTimed(file, 2)).toBe(false);
    expect(isCiaTimed(file, 3)).toBe(true);
  });

  it('reuses bit 31 for songs past 31', () => {
    const ciaFile = fakeSidFile(0x80000000); // bit 31 set
    expect(isCiaTimed(ciaFile, 32)).toBe(true);
    expect(isCiaTimed(ciaFile, 100)).toBe(true);

    const vbiFile = fakeSidFile(0x7fffffff); // every bit except 31 set
    expect(isCiaTimed(vbiFile, 32)).toBe(false);
    expect(isCiaTimed(vbiFile, 100)).toBe(false);
  });
});

describe('bundled tunes', () => {
  it('parses InSID3 Out as PSID v2, 1 subtune, CIA-timed, PAL/6581', () => {
    const tune = BUNDLED_TUNES.find((t) => t.id === 'insid3-out');
    if (!tune) {
      throw new Error('bundled tune "insid3-out" not found');
    }

    const file = parseSidFile(decodeBundledTune(tune.base64));

    expect(file.format).toBe('PSID');
    expect(file.version).toBe(2);
    expect(file.songs).toBe(1);
    expect(isCiaTimed(file, 1)).toBe(true);
    expect(file.clock).toBe('pal');
    expect(file.model).toBe('mos6581');
  });

  it('parses Still Time as PSID v2, 1 subtune, VBI-timed, PAL/8580', () => {
    const tune = BUNDLED_TUNES.find((t) => t.id === 'still-time');
    if (!tune) {
      throw new Error('bundled tune "still-time" not found');
    }

    const file = parseSidFile(decodeBundledTune(tune.base64));

    expect(file.format).toBe('PSID');
    expect(file.version).toBe(2);
    expect(file.songs).toBe(1);
    expect(isCiaTimed(file, 1)).toBe(false);
    expect(file.clock).toBe('pal');
    expect(file.model).toBe('mos8580');
  });
});
