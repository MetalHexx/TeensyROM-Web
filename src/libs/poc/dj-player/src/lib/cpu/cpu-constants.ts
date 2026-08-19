/** Timing, memory map and stub-code constants for the faked C64 that tune code runs on. */

export const PAL_CYCLES_PER_FRAME = 19656;
export const NTSC_CYCLES_PER_FRAME = 17095;

export const PAL_CYCLES_PER_RASTER_LINE = 63;
export const PAL_RASTER_LINES = 312;
export const NTSC_CYCLES_PER_RASTER_LINE = 65;
export const NTSC_RASTER_LINES = 263;

/** Init routines legitimately spend a long time relocating and precomputing tables. */
export const INIT_BUDGET_FRAMES = 100;
export const PLAY_BUDGET_FRAMES = 2;

/** A multispeed rate above this is not worth chasing; ASID sends one play call per packet. */
export const MAX_CALLS_PER_FRAME = 16;

export const MEMORY_SIZE = 0x10000;

export const SID_RANGE_START = 0xd400;
export const SID_RANGE_END = 0xd7ff;
/** The SID decodes only five address lines, which is what makes the `$D420` tunes work. */
export const SID_REGISTER_MASK = 0x1f;
export const SID_LAST_AUDIBLE_REGISTER = 24;

export const VIC_CONTROL_REGISTER = 0xd011;
export const VIC_RASTER_REGISTER = 0xd012;
/** Screen on, 25 rows, no scroll — the bits a player expects around the raster line's bit 8. */
export const VIC_CONTROL_IDLE_BITS = 0x1b;

export const CIA1_TIMER_A_LATCH_LOW = 0xdc04;
export const CIA1_TIMER_A_LATCH_HIGH = 0xdc05;
export const CIA1_INTERRUPT_CONTROL = 0xdc0d;
export const CIA2_INTERRUPT_CONTROL = 0xdd0d;
/** Timer A underflow set, so a player polling the CIA proceeds instead of spinning forever. */
export const CIA_INTERRUPT_TIMER_A_SET = 0x81;

export const IRQ_HANDLER_STUB = 0xea31;
export const IRQ_VECTOR_KERNAL = 0x0314;
export const RESET_VECTOR = 0xfffc;
export const IRQ_VECTOR_HARDWARE = 0xfffe;

/**
 * The KERNAL entry points tunes call most often. Real KERNAL and BASIC ROM images are copyrighted
 * and are not shipped here, so each of these gets an `RTS` and the call becomes a no-op.
 */
export const KERNAL_STUB_ADDRESSES: readonly number[] = [
  0xffd2, 0xffe4, 0xffcf, 0xff81, 0xff84, 0xff8a, 0xffe7, 0xff90, 0xffb1,
];

export const OPCODE_RTS = 0x60;
export const OPCODE_RTI = 0x40;
export const OPCODE_LDA_IMMEDIATE = 0xa9;
export const OPCODE_JSR_ABSOLUTE = 0x20;
export const OPCODE_JMP_ABSOLUTE = 0x4c;

export const TRAMPOLINE_BASE = 0xea00;
/** `base+0x00` through `base+0x10` inclusive — the final `JMP idle` occupies three of them. */
export const TRAMPOLINE_LENGTH = 0x11;
export const TRAMPOLINE_INIT_OFFSET = 0x00;
export const TRAMPOLINE_PLAY_OFFSET = 0x08;
export const TRAMPOLINE_PLAY_TARGET_OFFSET = 0x09;
export const TRAMPOLINE_IDLE_OFFSET = 0x0e;

/** Relocation skips the zero page, the stack page and the vector page at the top of memory. */
export const FIRST_RELOCATABLE_PAGE = 0x02;
export const LAST_RELOCATABLE_PAGE = 0xfe;
/** `$D000-$DFFF` always decodes as I/O here, so the trampoline can never live there. */
export const IO_FIRST_PAGE = 0xd0;
export const IO_LAST_PAGE = 0xdf;
