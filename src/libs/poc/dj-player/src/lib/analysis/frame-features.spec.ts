import { describe, it, expect } from 'vitest';
import type { SidFile } from '../sid/sid-file.model';
import { ASID_SLOT_COUNT } from '../asid/asid-constants';
import { scanTune } from './scan-tune';
import type { ScanOutput } from './scan-tune';
import {
  buildFeatureMatrix,
  FEATURE_DIMENSIONS,
  FEATURE_DIMENSION_COUNT,
  framesToSeconds,
  readFrameFeatures,
} from './frame-features';

interface CodeBlock {
  readonly at: number;
  readonly bytes: readonly number[];
}

function tune(blocks: readonly CodeBlock[]): SidFile {
  const loadAddress = 0x1000;
  const codeEnd = blocks.reduce((end, block) => Math.max(end, block.at + block.bytes.length), loadAddress);
  const data = new Uint8Array(codeEnd - loadAddress);
  for (const block of blocks) {
    data.set(block.bytes, block.at - loadAddress);
  }
  return {
    format: 'PSID',
    version: 2,
    loadAddress,
    initAddress: loadAddress,
    playAddress: 0x1010,
    songs: 1,
    startSong: 1,
    speedFlags: 0,
    name: '',
    author: '',
    released: '',
    clock: 'pal',
    model: 'unknown',
    secondSidAddress: null,
    thirdSidAddress: null,
    data,
  };
}

const RTS = 0x60;

/** init is a no-op; play increments a zero-page counter and stores it into $D400 every frame. */
const counterTune: SidFile = tune([
  { at: 0x1000, bytes: [RTS] },
  { at: 0x1010, bytes: [0xe6, 0xfb, 0xa5, 0xfb, 0x8d, 0x00, 0xd4, RTS] },
]);

/** Sets, in one frame: voice 1 to noise+gate, voice 2 to triangle+gate, a filter cutoff spanning
 *  both cutoff registers, a resonance/routing value with both nibbles distinct, and a volume — one
 *  write per feature under test, six registers total. */
const knownFeaturesTune: SidFile = tune([
  { at: 0x1000, bytes: [RTS] },
  {
    at: 0x1010,
    bytes: [
      0xa9, 0x81, 0x8d, 0x04, 0xd4, // LDA #$81 (noise+gate); STA $D404 (voice 1 control)
      0xa9, 0x11, 0x8d, 0x0b, 0xd4, // LDA #$11 (triangle+gate); STA $D40B (voice 2 control)
      0xa9, 0x05, 0x8d, 0x15, 0xd4, // LDA #$05; STA $D415 (filter cutoff low)
      0xa9, 0x3c, 0x8d, 0x16, 0xd4, // LDA #$3C; STA $D416 (filter cutoff high)
      0xa9, 0xf3, 0x8d, 0x17, 0xd4, // LDA #$F3; STA $D417 (resonance/routing)
      0xa9, 0x0a, 0x8d, 0x18, 0xd4, // LDA #$0A; STA $D418 (volume)
      RTS,
    ],
  },
]);

/** Sets voice 1's frequency, pulse width, attack/decay and sustain/release each to a distinct value
 *  spanning both registers where the feature is a register pair. */
const voiceDetailTune: SidFile = tune([
  { at: 0x1000, bytes: [RTS] },
  {
    at: 0x1010,
    bytes: [
      0xa9, 0x34, 0x8d, 0x00, 0xd4, // freq lo
      0xa9, 0x12, 0x8d, 0x01, 0xd4, // freq hi
      0xa9, 0xcd, 0x8d, 0x02, 0xd4, // pulse width lo
      0xa9, 0x0f, 0x8d, 0x03, 0xd4, // pulse width hi (low nibble only)
      0xa9, 0x9a, 0x8d, 0x05, 0xd4, // attack/decay
      0xa9, 0x63, 0x8d, 0x06, 0xd4, // sustain/release
      RTS,
    ],
  },
]);

function emptyScan(frames: number, writeCounts?: Uint8Array): ScanOutput {
  return {
    slotValues: new Uint8Array(frames * ASID_SLOT_COUNT),
    writeCounts: writeCounts ?? new Uint8Array(frames),
    frames,
    callsPerFrame: 1,
  };
}

describe('readFrameFeatures', () => {
  it('decodes gate, waveform, filter cutoff, resonance, routing and volume from known register writes', () => {
    const scan = scanTune(knownFeaturesTune, 1, 1);

    const features = readFrameFeatures(scan, 0);

    expect(features.voices[0].gate).toBe(true);
    expect(features.voices[0].waveform).toBe(0x8); // noise
    expect(features.voices[1].gate).toBe(true);
    expect(features.voices[1].waveform).toBe(0x1); // triangle
    expect(features.cutoff).toBe((0x3c << 3) | 0x05);
    expect(features.resonance).toBe(0xf);
    expect(features.filterRouting).toBe(0x3);
    expect(features.volume).toBe(0xa);
    expect(features.writeCount).toBe(6);
  });

  it('assembles frequency, pulse width, attack/decay and sustain/release from their register pairs', () => {
    const scan = scanTune(voiceDetailTune, 1, 1);

    const voice = readFrameFeatures(scan, 0).voices[0];

    expect(voice.frequency).toBe(0x1234);
    expect(voice.pulseWidth).toBe(0x0fcd);
    expect(voice.attackDecay).toBe(0x9a);
    expect(voice.sustainRelease).toBe(0x63);
  });

  it('reads a register from its ASID slot rather than its register number — register 4 lives at slot 22', () => {
    const scan = emptyScan(1);
    scan.slotValues[22] = 0x11; // triangle + gate, if placed at the register's real slot

    const features = readFrameFeatures(scan, 0);

    expect(features.voices[0].gate).toBe(true);
    expect(features.voices[0].waveform).toBe(0x1);
  });

  it('does not read slot 4 as if it were register 4 — the confusion the slot seam guards against', () => {
    const scan = emptyScan(1);
    scan.slotValues[4] = 0x11; // would be misread as voice 1's control register under an identity mapping

    const features = readFrameFeatures(scan, 0);

    expect(features.voices[0].gate).toBe(false);
    expect(features.voices[0].waveform).toBe(0);
  });
});

describe('buildFeatureMatrix', () => {
  it('produces frames × FEATURE_DIMENSION_COUNT entries, all within 0..1', () => {
    expect(FEATURE_DIMENSIONS.length).toBe(FEATURE_DIMENSION_COUNT);
    expect(FEATURE_DIMENSION_COUNT).toBe(20);

    const scan = scanTune(counterTune, 1, 50);
    const matrix = buildFeatureMatrix(scan);

    expect(matrix.frames).toBe(50);
    expect(matrix.values.length).toBe(50 * FEATURE_DIMENSION_COUNT);
    for (const value of matrix.values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('scales write density against the tune\'s own observed maximum, not a fixed ceiling', () => {
    const scan = emptyScan(3, Uint8Array.from([0, 2, 4]));

    const matrix = buildFeatureMatrix(scan);
    const writeDensityIndex = FEATURE_DIMENSIONS.indexOf('writeDensity');

    expect(matrix.values[writeDensityIndex]).toBe(0);
    expect(matrix.values[FEATURE_DIMENSION_COUNT + writeDensityIndex]).toBe(0.5);
    expect(matrix.values[2 * FEATURE_DIMENSION_COUNT + writeDensityIndex]).toBe(1);
  });

  it('moves the activity dimension as far for a voice dropping out as for one starting', () => {
    const scan = emptyScan(2);
    scan.slotValues[22] = 0x01; // frame 0: voice 1 gate on
    scan.slotValues[ASID_SLOT_COUNT + 22] = 0x00; // frame 1: gate off

    const matrix = buildFeatureMatrix(scan);
    const activityIndex = FEATURE_DIMENSIONS.indexOf('voice0.activity');

    expect(matrix.values[activityIndex]).toBe(1);
    expect(matrix.values[FEATURE_DIMENSION_COUNT + activityIndex]).toBe(0);
  });
});

describe('framesToSeconds', () => {
  it('converts using the nominal interval divided by calls-per-frame', () => {
    expect(framesToSeconds(50, 20_000, 1)).toBeCloseTo(1);
    expect(framesToSeconds(50, 20_000, 2)).toBeCloseTo(0.5);
  });
});
