/**
 * ASID SysEx framing and slot-mapping constants, transcribed from the firmware's `IOH_ASID.c`
 * (`teensyrom-hardware-fork`, `Source/Teensy/MinimalBoot/Common/IO_Handlers/IOH_ASID.c`).
 */

export const ASID_SYSEX_START = 0xf0;
export const ASID_SYSEX_END = 0xf7;
export const ASID_MANUFACTURER_ID = 0x2d;

export const ASID_MSG_START = 0x4c;
export const ASID_MSG_STOP = 0x4d;
export const ASID_MSG_SID_DATA = 0x4e;
export const ASID_MSG_DISPLAY_CHARS = 0x4f;
export const ASID_MSG_SID_TYPE = 0x32;

export const SID_REGISTER_COUNT = 25;
export const ASID_SLOT_COUNT = 28;

/**
 * ASID slot -> SID register, i.e. the firmware's `ASIDidToReg[]` transcribed in slot order. Slots
 * 25-27 are secondary slots for registers 4, 11 and 18 (`$D404`, `$D40B`, `$D412`) — the voice
 * gate registers players deliberately write twice in one frame to retrigger a note. See
 * `register-frame.ts` for how the secondary slots get used.
 */
export const ASID_SLOT_TO_REGISTER: readonly number[] = [
  0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 4, 11, 18, 4, 11,
  18,
];

/** 50.125 Hz — real PAL hardware, not the firmware's 19975 compromise value. */
export const PAL_FRAME_INTERVAL_US = 19950;
/** 59.827 Hz. */
export const NTSC_FRAME_INTERVAL_US = 16715;

/** `$D404`, `$D40B`, `$D412` — the per-voice control registers, indexed by voice (0..2). */
export const VOICE_CONTROL_REGISTERS: readonly number[] = [4, 11, 18];
