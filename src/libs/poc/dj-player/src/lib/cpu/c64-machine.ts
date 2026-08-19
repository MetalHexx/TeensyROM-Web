import mos6502, { decode } from 'mos6502';
import { SidFile } from '../sid/sid-file.model';
import {
  CIA1_INTERRUPT_CONTROL,
  CIA1_TIMER_A_LATCH_HIGH,
  CIA1_TIMER_A_LATCH_LOW,
  CIA2_INTERRUPT_CONTROL,
  CIA_INTERRUPT_TIMER_A_SET,
  FIRST_RELOCATABLE_PAGE,
  INIT_BUDGET_FRAMES,
  IO_FIRST_PAGE,
  IO_LAST_PAGE,
  IRQ_HANDLER_STUB,
  IRQ_VECTOR_HARDWARE,
  IRQ_VECTOR_KERNAL,
  KERNAL_STUB_ADDRESSES,
  LAST_RELOCATABLE_PAGE,
  MAX_CALLS_PER_FRAME,
  MEMORY_SIZE,
  NTSC_CYCLES_PER_FRAME,
  NTSC_CYCLES_PER_RASTER_LINE,
  NTSC_RASTER_LINES,
  OPCODE_JMP_ABSOLUTE,
  OPCODE_JSR_ABSOLUTE,
  OPCODE_LDA_IMMEDIATE,
  OPCODE_RTI,
  OPCODE_RTS,
  PAL_CYCLES_PER_FRAME,
  PAL_CYCLES_PER_RASTER_LINE,
  PAL_RASTER_LINES,
  PLAY_BUDGET_FRAMES,
  RESET_VECTOR,
  SID_LAST_AUDIBLE_REGISTER,
  SID_RANGE_END,
  SID_RANGE_START,
  SID_REGISTER_MASK,
  TRAMPOLINE_BASE,
  TRAMPOLINE_IDLE_OFFSET,
  TRAMPOLINE_INIT_OFFSET,
  TRAMPOLINE_LENGTH,
  TRAMPOLINE_PLAY_OFFSET,
  TRAMPOLINE_PLAY_TARGET_OFFSET,
  VIC_CONTROL_IDLE_BITS,
  VIC_CONTROL_REGISTER,
  VIC_RASTER_REGISTER,
} from './cpu-constants';

/** Receives every write a tune makes into the SID's address range. */
export interface SidWriteSink {
  /** `register` is 0..24 — the audible registers. Writes to 25..31 never reach here. */
  onSidWrite(register: number, value: number): void;
}

/** The outcome of one emulated routine call. */
export interface FrameResult {
  readonly cyclesUsed: number;
  /** `false` means the cycle budget ran out before the routine returned — the tune is broken. */
  readonly completed: boolean;
}

/** Thrown when a tune exposes no usable play address, so there is nothing to call each frame. */
export class UnplayableTuneError extends Error {}

const ILLEGAL_OPCODE_MNEMONIC = '???';

/** One entry per opcode byte, 1 where the core's decoder falls through to its 2-cycle no-op. */
const ILLEGAL_OPCODES = buildIllegalOpcodeTable();

function buildIllegalOpcodeTable(): Uint8Array {
  const table = new Uint8Array(256);
  for (let opcode = 0; opcode < table.length; opcode++) {
    table[opcode] = decode(opcode).instruction === ILLEGAL_OPCODE_MNEMONIC ? 1 : 0;
  }
  return table;
}

const IDLE_PROCESSOR_STATUS = { info: [], registers: null };

/**
 * `mos6502` with its per-instruction debug work removed.
 *
 * The base class disassembles the current instruction and snapshots the registers on every
 * instruction boundary even with `debug` off — several objects and extra bus reads, purely to fill
 * a return value nothing here reads. `emulate` dispatches on `this`, so shadowing the method on the
 * subclass prototype removes the whole path. It is shadowed rather than declared as an `override`
 * because the base class types it `private`, so TypeScript will not let a subclass redeclare it.
 */
class QuietMos6502 extends mos6502 {}
Object.defineProperty(QuietMos6502.prototype, 'getProcessorStatus', {
  value: () => IDLE_PROCESSOR_STATUS,
});

/**
 * A 64 KB address space with just enough faked C64 hardware — CIA timers, a moving raster counter
 * and ROM vector stubs — for a tune's `init` and `play` routines to run to completion. Every write
 * the tune makes to the SID's address range is handed to the sink.
 */
export class C64Machine {
  private readonly file: SidFile;
  private readonly sink: SidWriteSink;
  private readonly memory: Uint8Array;
  private readonly cpu: mos6502;
  private readonly cyclesPerFrame: number;
  private readonly cyclesPerRasterLine: number;
  private readonly rasterLineCount: number;

  private trampoline = TRAMPOLINE_BASE;
  private idleAddress = TRAMPOLINE_BASE + TRAMPOLINE_IDLE_OFFSET;
  private playAddress = 0;
  private timerALatch: number | null = null;
  private cyclesThisCall = 0;
  private reachedIdle = false;
  private expectingOpcodeFetch = false;
  private illegalOpcodes = 0;

  constructor(file: SidFile, sink: SidWriteSink) {
    this.file = file;
    this.sink = sink;
    this.memory = new Uint8Array(MEMORY_SIZE);

    const ntsc = file.clock === 'ntsc';
    this.cyclesPerFrame = ntsc ? NTSC_CYCLES_PER_FRAME : PAL_CYCLES_PER_FRAME;
    this.cyclesPerRasterLine = ntsc ? NTSC_CYCLES_PER_RASTER_LINE : PAL_CYCLES_PER_RASTER_LINE;
    this.rasterLineCount = ntsc ? NTSC_RASTER_LINES : PAL_RASTER_LINES;

    // The core resets inside its own constructor, reading $FFFC/$FFFD back through this callback,
    // so the address space has to exist first. The PC it lands on is meaningless — every entry
    // re-points the reset vector and resets again.
    this.cpu = new QuietMos6502(
      (address: number): number => this.read(address),
      (address: number, value: number): void => this.write(address, value)
    );
  }

  /** Cycles between play calls when the tune programmed CIA 1 timer A; `null` for a frame-rate tune. */
  get cyclesPerPlayCall(): number | null {
    return this.timerALatch === null ? null : this.timerALatch + 1;
  }

  /**
   * How many play calls a second of this tune wants per frame, 1..16. This is advice for the
   * caller's clock — `runFrame` still calls the play routine exactly once.
   */
  get callsPerFrame(): number {
    const rate = this.cyclesPerPlayCall;
    if (rate === null || rate <= 0 || rate >= this.cyclesPerFrame) {
      return 1;
    }
    return Math.min(MAX_CALLS_PER_FRAME, Math.max(1, Math.round(this.cyclesPerFrame / rate)));
  }

  /** The address `runFrame` calls: the header's play address, or the vector an RSID installed. */
  get resolvedPlayAddress(): number {
    return this.playAddress;
  }

  /** Where the entry trampoline was written — moved off the default page when the tune covers it. */
  get trampolineBase(): number {
    return this.trampoline;
  }

  /** Undocumented opcodes executed since the last `initSubtune`; each ran as a 2-cycle no-op. */
  get illegalOpcodeCount(): number {
    return this.illegalOpcodes;
  }

  /**
   * Resets the address space, reloads the tune and runs its init routine for the given 1-based
   * subtune, then resolves the play address an RSID installs during init.
   *
   * @throws {RangeError} when `song` is outside the tune's subtune range.
   * @throws {UnplayableTuneError} when init finished but left no play address to call.
   */
  initSubtune(song: number): FrameResult {
    const subtunes = Math.max(1, this.file.songs);
    if (!Number.isInteger(song) || song < 1 || song > subtunes) {
      throw new RangeError(`subtune ${song} is outside 1..${subtunes}`);
    }

    this.memory.fill(0);
    this.timerALatch = null;
    this.illegalOpcodes = 0;

    this.installRomStubs();
    this.loadTune();
    this.writeTrampoline(song);

    const result = this.runRoutine(
      this.trampoline + TRAMPOLINE_INIT_OFFSET,
      this.cyclesPerFrame * INIT_BUDGET_FRAMES
    );

    this.playAddress = this.resolvePlayAddress();
    this.writeWord(this.trampoline + TRAMPOLINE_PLAY_TARGET_OFFSET, this.playAddress);

    if (result.completed && this.playAddress === 0) {
      throw new UnplayableTuneError(
        'the tune installed no interrupt vector during init, so it exposes no play routine'
      );
    }
    return result;
  }

  /**
   * Runs the play routine exactly once. Batching several calls into one frame would collapse them
   * downstream, which is precisely the data a multispeed tune exists to deliver.
   *
   * @throws {UnplayableTuneError} when no play address has been resolved.
   */
  runFrame(): FrameResult {
    if (this.playAddress === 0) {
      throw new UnplayableTuneError('no play address has been resolved — run initSubtune first');
    }
    return this.runRoutine(
      this.trampoline + TRAMPOLINE_PLAY_OFFSET,
      this.cyclesPerFrame * PLAY_BUDGET_FRAMES
    );
  }

  private runRoutine(entryAddress: number, budget: number): FrameResult {
    this.writeWord(RESET_VECTOR, entryAddress);
    this.cyclesThisCall = 0;
    this.reachedIdle = false;
    this.expectingOpcodeFetch = false;
    this.cpu.reset();

    while (!this.reachedIdle && this.cyclesThisCall < budget) {
      // Every read the core makes on a given cycle either starts an instruction or belongs to one
      // already decoded, and only the first read of a cycle can be the opcode fetch.
      this.expectingOpcodeFetch = true;
      this.cpu.emulate();
      this.cyclesThisCall++;
    }

    return { cyclesUsed: this.cyclesThisCall, completed: this.reachedIdle };
  }

  /**
   * The read side of the CPU's bus.
   *
   * The `$01` banking register is stored as ordinary RAM and ignored for decoding: the ranges below
   * always decode as I/O whatever a tune banks in. That is a deliberate simplification, not an
   * oversight — no KERNAL or BASIC ROM image ships here, so there is nothing else to bank to.
   */
  private read(address: number): number {
    const fetchingOpcode = this.expectingOpcodeFetch;
    this.expectingOpcodeFetch = false;

    if (address === this.idleAddress) {
      // The only reason the CPU ever fetches from the idle block is that the routine returned.
      // Detecting it here keeps the hot loop free of the allocations `getState()` would cost.
      this.reachedIdle = true;
    }

    const value = this.readBus(address);
    if (fetchingOpcode && ILLEGAL_OPCODES[value] === 1) {
      this.illegalOpcodes++;
    }
    return value;
  }

  private readBus(address: number): number {
    switch (address) {
      case VIC_CONTROL_REGISTER:
        return VIC_CONTROL_IDLE_BITS | ((this.rasterLine() & 0x100) >> 1);
      case VIC_RASTER_REGISTER:
        return this.rasterLine() & 0xff;
      case CIA1_INTERRUPT_CONTROL:
      case CIA2_INTERRUPT_CONTROL:
        return CIA_INTERRUPT_TIMER_A_SET;
      default:
        return this.memory[address & 0xffff];
    }
  }

  /** The write side of the CPU's bus. See `read` for why banking is ignored. */
  private write(address: number, value: number): void {
    const byte = value & 0xff;
    this.memory[address & 0xffff] = byte;

    if (address >= SID_RANGE_START && address <= SID_RANGE_END) {
      if (!this.isSecondOrThirdSidAddress(address)) {
        const register = address & SID_REGISTER_MASK;
        if (register <= SID_LAST_AUDIBLE_REGISTER) {
          this.sink.onSidWrite(register, byte);
        }
      }
      return;
    }

    if (address === CIA1_TIMER_A_LATCH_LOW || address === CIA1_TIMER_A_LATCH_HIGH) {
      this.timerALatch = this.readWord(CIA1_TIMER_A_LATCH_LOW);
    }
  }

  /**
   * Whether `address` falls in the 32-byte mirrored block of a v3/v4 header's second or third SID
   * address. Those chips are reported to the caller, not emulated, so their writes still land in
   * `this.memory` (above) but must never reach the sink alongside the first chip's registers.
   */
  private isSecondOrThirdSidAddress(address: number): boolean {
    const block = address & ~SID_REGISTER_MASK;
    const { secondSidAddress, thirdSidAddress } = this.file;
    return (
      (secondSidAddress !== null && block === (secondSidAddress & ~SID_REGISTER_MASK)) ||
      (thirdSidAddress !== null && block === (thirdSidAddress & ~SID_REGISTER_MASK))
    );
  }

  /** Players poll the raster in a spin loop, so a frozen value hangs them. */
  private rasterLine(): number {
    return ((this.cyclesThisCall / this.cyclesPerRasterLine) | 0) % this.rasterLineCount;
  }

  private installRomStubs(): void {
    for (const address of KERNAL_STUB_ADDRESSES) {
      this.memory[address] = OPCODE_RTS;
    }
    this.memory[IRQ_HANDLER_STUB] = OPCODE_RTI;
    this.writeWord(IRQ_VECTOR_KERNAL, IRQ_HANDLER_STUB);
    this.writeWord(IRQ_VECTOR_HARDWARE, IRQ_HANDLER_STUB);
  }

  /** Copies the payload over the stubs, so the tune wins any overlap. */
  private loadTune(): void {
    const available = MEMORY_SIZE - this.file.loadAddress;
    const length = Math.min(this.file.data.length, Math.max(0, available));
    this.memory.set(this.file.data.subarray(0, length), this.file.loadAddress);
  }

  /**
   * Writes the entry trampoline the CPU takes out of reset. The core keeps its registers private,
   * so the accumulator's subtune number and the entry addresses have to come from real code:
   *
   * ```
   * base+0x00:  LDA #(song - 1)   ; the PSID convention is zero-based in A
   * base+0x02:  JSR initAddress
   * base+0x05:  JMP idle
   * base+0x08:  JSR playAddress   ; target patched once an RSID's vector is known
   * base+0x0B:  JMP idle
   * base+0x0E:  JMP idle          ; branches to itself
   * ```
   */
  private writeTrampoline(song: number): void {
    this.trampoline = this.chooseTrampolineBase();
    this.idleAddress = this.trampoline + TRAMPOLINE_IDLE_OFFSET;

    const idleLow = this.idleAddress & 0xff;
    const idleHigh = (this.idleAddress >> 8) & 0xff;
    const initLow = this.file.initAddress & 0xff;
    const initHigh = (this.file.initAddress >> 8) & 0xff;

    this.memory.set(
      [
        OPCODE_LDA_IMMEDIATE,
        (song - 1) & 0xff,
        OPCODE_JSR_ABSOLUTE,
        initLow,
        initHigh,
        OPCODE_JMP_ABSOLUTE,
        idleLow,
        idleHigh,
        OPCODE_JSR_ABSOLUTE,
        0x00,
        0x00,
        OPCODE_JMP_ABSOLUTE,
        idleLow,
        idleHigh,
        OPCODE_JMP_ABSOLUTE,
        idleLow,
        idleHigh,
      ],
      this.trampoline
    );
  }

  private chooseTrampolineBase(): number {
    const start = this.file.loadAddress;
    const end = Math.min(start + this.file.data.length, MEMORY_SIZE);
    const overlapsTune = (base: number): boolean => base < end && start < base + TRAMPOLINE_LENGTH;

    if (!overlapsTune(TRAMPOLINE_BASE)) {
      return TRAMPOLINE_BASE;
    }
    for (let page = FIRST_RELOCATABLE_PAGE; page <= LAST_RELOCATABLE_PAGE; page++) {
      if (page >= IO_FIRST_PAGE && page <= IO_LAST_PAGE) {
        continue;
      }
      const base = page << 8;
      if (!overlapsTune(base)) {
        return base;
      }
    }
    throw new UnplayableTuneError(
      'the tune covers every page — there is nowhere for the trampoline'
    );
  }

  /**
   * A header play address of 0 means the tune installed its own interrupt handler during init.
   * Returns 0 when neither vector moved off the RTI stub, rather than jumping to address 0.
   */
  private resolvePlayAddress(): number {
    if (this.file.playAddress !== 0) {
      return this.file.playAddress;
    }
    const kernalVector = this.readWord(IRQ_VECTOR_KERNAL);
    if (kernalVector !== IRQ_HANDLER_STUB) {
      return kernalVector;
    }
    const hardwareVector = this.readWord(IRQ_VECTOR_HARDWARE);
    return hardwareVector === IRQ_HANDLER_STUB ? 0 : hardwareVector;
  }

  private readWord(address: number): number {
    return this.memory[address] | (this.memory[address + 1] << 8);
  }

  private writeWord(address: number, value: number): void {
    this.memory[address] = value & 0xff;
    this.memory[address + 1] = (value >> 8) & 0xff;
  }
}
