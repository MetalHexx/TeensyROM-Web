export type SidClock = 'unknown' | 'pal' | 'ntsc' | 'any';
export type SidModel = 'unknown' | 'mos6581' | 'mos8580' | 'any';

/** A parsed PSID/RSID file: header facts plus the C64 payload, excluding the header itself. */
export interface SidFile {
  readonly format: 'PSID' | 'RSID';
  readonly version: number; // 1..4
  readonly loadAddress: number; // resolved, never 0 — see parseSidFile
  readonly initAddress: number; // resolved: 0 in the header means loadAddress
  readonly playAddress: number; // 0 means "the tune installs its own IRQ vector"
  readonly songs: number;
  readonly startSong: number; // 1-based, as stored
  readonly speedFlags: number; // u32, bit per song: 1 = CIA-timed, 0 = vertical blank
  readonly name: string;
  readonly author: string;
  readonly released: string;
  readonly clock: SidClock;
  readonly model: SidModel;
  readonly secondSidAddress: number | null; // absolute, e.g. 0xD420
  readonly thirdSidAddress: number | null;
  readonly data: Uint8Array; // the C64 payload, excluding the header
}

/** Thrown by `parseSidFile` when the bytes are not a well-formed PSID/RSID file. */
export class SidParseError extends Error {}
