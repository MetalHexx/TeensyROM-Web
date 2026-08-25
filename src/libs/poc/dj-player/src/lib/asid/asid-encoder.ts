import type { FrameSnapshot } from './register-frame';
import {
  ASID_MANUFACTURER_ID,
  ASID_MSG_DISPLAY_CHARS,
  ASID_MSG_SID_DATA,
  ASID_MSG_SID_TYPE,
  ASID_MSG_START,
  ASID_MSG_STOP,
  ASID_SYSEX_END,
  ASID_SYSEX_START,
} from './asid-constants';

/** Pure ASID SysEx packet builders — byte layouts only, no I/O. See `asid-constants.ts` for the
 * transcribed protocol values these assemble. */

/** `F0 2D 4E <present masks> <MSB masks> <values> F7`, `12 + values.length` bytes total. */
export function buildSidDataPacket(snapshot: FrameSnapshot): Uint8Array {
  const { presentMask, msbMask, values } = snapshot;
  const packet = new Uint8Array(12 + values.length);
  packet[0] = ASID_SYSEX_START;
  packet[1] = ASID_MANUFACTURER_ID;
  packet[2] = ASID_MSG_SID_DATA;
  packet.set(presentMask, 3);
  packet.set(msbMask, 7);
  packet.set(values, 11);
  packet[packet.length - 1] = ASID_SYSEX_END;
  return packet;
}

export function buildStartPacket(): Uint8Array {
  return Uint8Array.from([ASID_SYSEX_START, ASID_MANUFACTURER_ID, ASID_MSG_START, ASID_SYSEX_END]);
}

export function buildStopPacket(): Uint8Array {
  return Uint8Array.from([ASID_SYSEX_START, ASID_MANUFACTURER_ID, ASID_MSG_STOP, ASID_SYSEX_END]);
}

/**
 * `F0 2D 4F <ascii...> F7` — the cartridge converts the bytes to PETSCII. Every MIDI data byte must
 * be under 0x80 or it corrupts the SysEx stream, so a character outside that range is dropped
 * rather than masked into a different, wrong character.
 */
export function buildDisplayCharsPacket(text: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    }
  }
  return Uint8Array.from([
    ASID_SYSEX_START,
    ASID_MANUFACTURER_ID,
    ASID_MSG_DISPLAY_CHARS,
    ...bytes,
    ASID_SYSEX_END,
  ]);
}

/** `F0 2D 32 <chipIndex> <type> F7` — type bit0: 0 = 6581, 1 = 8580. */
export function buildSidTypePacket(chipIndex: number, is8580: boolean): Uint8Array {
  return Uint8Array.from([
    ASID_SYSEX_START,
    ASID_MANUFACTURER_ID,
    ASID_MSG_SID_TYPE,
    chipIndex & 0x7f,
    is8580 ? 1 : 0,
    ASID_SYSEX_END,
  ]);
}
