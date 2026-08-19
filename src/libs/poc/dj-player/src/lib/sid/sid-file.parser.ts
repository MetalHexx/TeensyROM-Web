import { SidClock, SidFile, SidModel, SidParseError } from './sid-file.model';

const MIN_HEADER_BYTES = 0x08; // magic(4) + version(2) + dataOffset(2) — enough to locate the rest

const OFFSET_VERSION = 0x04;
const OFFSET_DATA_OFFSET = 0x06;
const OFFSET_LOAD_ADDRESS = 0x08;
const OFFSET_INIT_ADDRESS = 0x0a;
const OFFSET_PLAY_ADDRESS = 0x0c;
const OFFSET_SONGS = 0x0e;
const OFFSET_START_SONG = 0x10;
const OFFSET_SPEED = 0x12;
const OFFSET_NAME = 0x16;
const OFFSET_AUTHOR = 0x36;
const OFFSET_RELEASED = 0x56;
const OFFSET_FLAGS = 0x76;
const OFFSET_SECOND_SID = 0x7a;
const OFFSET_THIRD_SID = 0x7b;
const TEXT_FIELD_LENGTH = 32;

/** Parses the raw bytes of a PSID/RSID file into a typed record, throwing `SidParseError` on malformed input. */
export function parseSidFile(bytes: Uint8Array): SidFile {
  if (bytes.length < MIN_HEADER_BYTES) {
    throw new SidParseError(`SID file is too short (${bytes.length} bytes) to contain a header`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (!isSidFormat(magic)) {
    throw new SidParseError(`unrecognized magic "${magic}" — expected PSID or RSID`);
  }

  const version = view.getUint16(OFFSET_VERSION, false);
  if (version < 1 || version > 4) {
    throw new SidParseError(`unsupported SID version ${version} — expected 1-4`);
  }

  const dataOffset = view.getUint16(OFFSET_DATA_OFFSET, false);
  if (bytes.length < dataOffset) {
    throw new SidParseError(
      `truncated SID file: header declares dataOffset ${dataOffset} but the file is only ${bytes.length} bytes`,
    );
  }

  const headerLoadAddress = view.getUint16(OFFSET_LOAD_ADDRESS, false);
  const headerInitAddress = view.getUint16(OFFSET_INIT_ADDRESS, false);
  const playAddress = view.getUint16(OFFSET_PLAY_ADDRESS, false);
  const songs = view.getUint16(OFFSET_SONGS, false);
  const startSong = view.getUint16(OFFSET_START_SONG, false);
  const speedFlags = view.getUint32(OFFSET_SPEED, false);

  const name = readPaddedString(bytes, OFFSET_NAME, TEXT_FIELD_LENGTH);
  const author = readPaddedString(bytes, OFFSET_AUTHOR, TEXT_FIELD_LENGTH);
  const released = readPaddedString(bytes, OFFSET_RELEASED, TEXT_FIELD_LENGTH);

  let clock: SidClock = 'unknown';
  let model: SidModel = 'unknown';
  let secondSidAddress: number | null = null;
  let thirdSidAddress: number | null = null;

  if (version >= 2) {
    const flags = view.getUint16(OFFSET_FLAGS, false);
    clock = decodeClock((flags >> 2) & 0b11);
    model = decodeModel((flags >> 4) & 0b11);
  }
  if (version >= 3) {
    secondSidAddress = decodeExtraSidAddress(bytes[OFFSET_SECOND_SID]);
  }
  if (version >= 4) {
    thirdSidAddress = decodeExtraSidAddress(bytes[OFFSET_THIRD_SID]);
  }

  let loadAddress = headerLoadAddress;
  let data: Uint8Array;
  if (headerLoadAddress === 0) {
    if (bytes.length < dataOffset + 2) {
      throw new SidParseError(
        'load address is embedded in the payload (header load address is 0) but the payload is too short to contain it',
      );
    }
    loadAddress = view.getUint16(dataOffset, true); // embedded load address is little-endian
    data = bytes.slice(dataOffset + 2);
  } else {
    data = bytes.slice(dataOffset);
  }

  const initAddress = headerInitAddress === 0 ? loadAddress : headerInitAddress;

  return {
    format: magic,
    version,
    loadAddress,
    initAddress,
    playAddress,
    songs,
    startSong,
    speedFlags,
    name,
    author,
    released,
    clock,
    model,
    secondSidAddress,
    thirdSidAddress,
    data,
  };
}

/** Whether `song` (1-based) is CIA-timed rather than vertical-blank-timed. Songs past 31 reuse bit 31. */
export function isCiaTimed(file: SidFile, song: number): boolean {
  const bitIndex = Math.min(song - 1, 31);
  return ((file.speedFlags >>> bitIndex) & 1) === 1;
}

function isSidFormat(value: string): value is 'PSID' | 'RSID' {
  return value === 'PSID' || value === 'RSID';
}

function readPaddedString(bytes: Uint8Array, offset: number, length: number): string {
  const field = bytes.subarray(offset, offset + length);
  const terminatorIndex = field.indexOf(0);
  const trimmed = terminatorIndex === -1 ? field : field.subarray(0, terminatorIndex);
  return String.fromCharCode(...trimmed);
}

function decodeClock(bits: number): SidClock {
  switch (bits) {
    case 1:
      return 'pal';
    case 2:
      return 'ntsc';
    case 3:
      return 'any';
    default:
      return 'unknown';
  }
}

function decodeModel(bits: number): SidModel {
  switch (bits) {
    case 1:
      return 'mos6581';
    case 2:
      return 'mos8580';
    case 3:
      return 'any';
    default:
      return 'unknown';
  }
}

function decodeExtraSidAddress(byte: number): number | null {
  return byte === 0 ? null : (0xd000 | (byte << 4));
}
