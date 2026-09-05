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

/** `$D418` — SID master volume. Low nibble is the only volume control the chip has; bits 4-6 select
 *  the filter mode and bit 7 silences voice 3. `register-frame.ts` scales the low nibble by the
 *  deck's gain at the packet boundary; bits 4-6 pass through untouched unless a filter mode is
 *  forced, in which case they're replaced with the forced mode's bits instead. Bit 7 always passes
 *  through raw, belonging to neither control. */
export const SID_VOLUME_REGISTER = 24;

/** `$D415` — filter cutoff low bits, in bits 0-2 only; bits 3-7 are unused and must survive a write. */
export const SID_FILTER_CUTOFF_LOW_REGISTER = 21;
/** `$D416` — filter cutoff high 8 bits, completing the 11-bit cutoff. */
export const SID_FILTER_CUTOFF_HIGH_REGISTER = 22;
/** `$D417` — filter resonance in bits 4-7, voice/external filter routing in bits 0-3. */
export const SID_FILTER_RESONANCE_REGISTER = 23;

/** Voice n's seven registers start at `n * REGISTERS_PER_VOICE`. */
export const REGISTERS_PER_VOICE = 7;
export const VOICE_COUNT = 3;

/**
 * `$D418` bits 4-6 select the filter mode — one bit per pass band, and they combine. All three
 * clear means the filter is out of the signal path.
 */
export const SID_FILTER_MODE_OFF = 0b000;
export const SID_FILTER_MODE_LOW_PASS = 0b001;
export const SID_FILTER_MODE_BAND_PASS = 0b010;
export const SID_FILTER_MODE_HIGH_PASS = 0b100;
export const SID_FILTER_MODE_SHIFT = 4;
export const SID_FILTER_MODE_MASK = 0b111;

// The four filter/voice register numbers above and REGISTERS_PER_VOICE/VOICE_COUNT are also declared
// module-privately in `analysis/frame-features.ts`. The duplication is deliberate, not an oversight:
// analysis already imports from the ASID layer (`PRIMARY_SLOT_FOR_REGISTER`), so sourcing these from
// there would invert the dependency. Consolidating the two is a separate change.
