import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import type { DeckHandle } from '../../deck/deck-registry';
import type { DjPlayerEngine } from '../../engine/dj-player-engine';
import { positionBasisFor } from '../../engine/engine-utils';
import type { DetectedLoopFrames } from '../../engine/engine-utils';
import { asRounded, playCallsPerSecond, playCallsToSeconds } from '../../engine/play-rate';
import type { SidFile } from '../../sid/sid-file.model';
import { ANALYSIS_SCANNER } from '../scan-runner';
import type { ScanRequest, ScanResult } from '../scan-runner';
import { WorkerAnalysisScanner } from '../worker-analysis-scanner';
import type { ScanOutput } from '../scan-tune';
import { buildFeatureMatrix, readFrameFeatures } from '../frame-features';
import type { FeatureMatrix } from '../frame-features';
import {
  computeNovelty,
  candidatesAbove,
  DEFAULT_CANDIDATE_THRESHOLD,
  DEFAULT_FEATURE_WEIGHTS,
} from '../novelty';
import type { Candidate, FeatureWeights, NoveltyResult } from '../novelty';
import { computeStructure } from '../structure';
import type { StructureResult } from '../structure';
import { detectLoop, IDLE_PERIOD_SECONDS, MIN_TAIL_SECONDS } from '../loop-detect';
import type { LoopDetection, LoopDetectOptions } from '../loop-detect';
import { computePulse, impliedTempo } from '../pulse';
import type { PulseResult } from '../pulse';
import { segmentNotes } from '../notes';
import type { Note } from '../notes';
import {
  detectKey,
  detectKeyPerSection,
  isOutOfScale,
  keyName,
  PITCH_CLASS_NAMES,
  soundingKey,
} from '../key';
import type { KeyResult } from '../key';
import { formatCents, formatDuration } from '../format';
import type { TuneIndexService } from '../tune-index.service';
import type { TuneIndexRecord } from '../tune-index.model';

/** Buckets the whole scanned frame range into this many horizontal columns, regardless of how many
 *  frames were scanned — the aggregation that keeps a tune with tens of thousands of frames from
 *  emitting tens of thousands of SVG nodes. */
const COLUMN_COUNT = 240;

const RULER_HEIGHT = 14;
const VOICE_LANE_HEIGHT = 34;
const FILTER_LANE_HEIGHT = 24;
const VOLUME_LANE_HEIGHT = 20;
const DENSITY_LANE_HEIGHT = 16;
const NOVELTY_LANE_HEIGHT = 40;
const CANDIDATE_LANE_HEIGHT = 16;
const PULSE_LANE_HEIGHT = 40;
const LANE_GAP = 2;
const VOICE_BLOCK_HEIGHT = Math.max(2, VOICE_LANE_HEIGHT * 0.16);

/** A thin strip along the top of each voice lane, so an out-of-scale mark never hides the pitch
 *  block it is describing. */
const OUT_OF_SCALE_TICK_HEIGHT = 4;

const CHROMA_BAR_WIDTH = 10;
const CHROMA_BAR_GAP = 2;
const CHROMA_LANE_HEIGHT = 44;

const MIN_WINDOW_FRAMES = 50;

const MAX_CUTOFF_VALUE = 0x07ff;
const MAX_VOLUME_VALUE = 0x0f;
const MAX_LOG_FREQUENCY = Math.log2(0x10000);

type LaneKey = 'voice0' | 'voice1' | 'voice2' | 'filter' | 'volume' | 'density' | 'novelty';

interface LaneToggle {
  readonly key: LaneKey;
  readonly label: string;
}

const LANE_TOGGLES: readonly LaneToggle[] = [
  { key: 'voice0', label: 'V1' },
  { key: 'voice1', label: 'V2' },
  { key: 'voice2', label: 'V3' },
  { key: 'filter', label: 'Filter' },
  { key: 'volume', label: 'Volume' },
  { key: 'density', label: 'Density' },
  { key: 'novelty', label: 'Novelty' },
];

interface WeightField {
  readonly key: keyof FeatureWeights;
  readonly label: string;
}

const WEIGHT_FIELDS: readonly WeightField[] = [
  { key: 'voiceActivity', label: 'Voice activity' },
  { key: 'gate', label: 'Gate' },
  { key: 'cutoff', label: 'Cutoff' },
  { key: 'volume', label: 'Volume' },
  { key: 'waveform', label: 'Waveform' },
  { key: 'pitch', label: 'Pitch' },
  { key: 'envelope', label: 'Envelope' },
  { key: 'writeDensity', label: 'Write density' },
  { key: 'filterRouting', label: 'Filter routing' },
  { key: 'resonance', label: 'Resonance' },
];

interface FrameWindow {
  readonly start: number;
  readonly end: number;
}

interface VoiceBlock {
  readonly x: number;
  readonly y: number;
  readonly color: string;
}

interface DensityBar {
  readonly x: number;
  readonly y: number;
  readonly height: number;
}

interface CandidateMark {
  readonly candidate: Candidate;
  readonly x: number;
  readonly above: boolean;
  readonly selected: boolean;
}

interface HistogramBar {
  readonly interval: number;
  readonly x: number;
  readonly height: number;
  readonly isDominant: boolean;
}

interface ChromaBar {
  readonly name: string;
  readonly height: number;
  readonly inScale: boolean;
  readonly isTonic: boolean;
}

interface ColumnAggregate {
  readonly voiceOn: readonly [boolean, boolean, boolean];
  readonly voicePitch01: readonly [number, number, number];
  readonly voiceColor: readonly [string, string, string];
  readonly cutoff01: number;
  readonly volume01: number;
  readonly writeDensity01: number;
}

interface LaneOffsets {
  readonly voiceY: readonly [number | null, number | null, number | null];
  readonly filterY: number | null;
  readonly volumeY: number | null;
  readonly densityY: number | null;
  readonly noveltyY: number | null;
  readonly pulseY: number | null;
  readonly candidateY: number;
  readonly totalHeight: number;
}

/** frame f's bucket range is [start, end) — every bucket is at least one frame wide. */
function bucketRanges(
  window: FrameWindow,
  columnCount: number,
  framesTotal: number
): readonly (readonly [number, number])[] {
  const span = window.end - window.start;
  const ranges: (readonly [number, number])[] = [];
  for (let c = 0; c < columnCount; c++) {
    const start = Math.min(framesTotal, Math.floor(window.start + (c / columnCount) * span));
    const end = Math.min(framesTotal, Math.floor(window.start + ((c + 1) / columnCount) * span));
    ranges.push([start, Math.max(end, start + 1)]);
  }
  return ranges;
}

/** Log-frequency, matching the ear's own sense of pitch distance — a register delta near the bottom
 *  of the range means far more than the same delta near the top. */
function pitchPosition(frequency: number): number {
  return Math.log2(frequency + 1) / MAX_LOG_FREQUENCY;
}

function waveformColor(code: number): string {
  if ((code & 0x8) !== 0) return '#9a8f74'; // noise / percussion
  if ((code & 0x4) !== 0) return '#7f8fa0'; // pulse
  if (code !== 0) return '#6f8478'; // triangle / sawtooth
  return '#555555';
}

function observedWriteCountCeiling(scan: ScanOutput): number {
  let max = 0;
  for (let f = 0; f < scan.frames; f++) {
    if (scan.writeCounts[f] > max) {
      max = scan.writeCounts[f];
    }
  }
  return max;
}

function aggregateColumn(
  scan: ScanOutput,
  range: readonly [number, number],
  writeCountCeiling: number
): ColumnAggregate {
  const [start, end] = range;
  const clampedEnd = Math.min(end, scan.frames);
  const from = Math.min(start, scan.frames - 1);
  const to = Math.max(clampedEnd, from + 1);

  const onCount: [number, number, number] = [0, 0, 0];
  const pitchSum: [number, number, number] = [0, 0, 0];
  const waveformSum: [number, number, number] = [0, 0, 0];
  let cutoffSum = 0;
  let volumeSum = 0;
  let writeSum = 0;
  let sampleCount = 0;

  for (let f = from; f < to; f++) {
    const features = readFrameFeatures(scan, f);
    for (let voice = 0; voice < 3; voice++) {
      const voiceFeatures = features.voices[voice];
      if (voiceFeatures.gate) {
        onCount[voice]++;
        pitchSum[voice] += pitchPosition(voiceFeatures.frequency);
        waveformSum[voice] += voiceFeatures.waveform;
      }
    }
    cutoffSum += features.cutoff;
    volumeSum += features.volume;
    writeSum += features.writeCount;
    sampleCount++;
  }

  const voiceOn: [boolean, boolean, boolean] = [onCount[0] > 0, onCount[1] > 0, onCount[2] > 0];
  const voicePitch01: [number, number, number] = [
    onCount[0] > 0 ? pitchSum[0] / onCount[0] : 0,
    onCount[1] > 0 ? pitchSum[1] / onCount[1] : 0,
    onCount[2] > 0 ? pitchSum[2] / onCount[2] : 0,
  ];
  const voiceColor: [string, string, string] = [
    waveformColor(onCount[0] > 0 ? Math.round(waveformSum[0] / onCount[0]) : 0),
    waveformColor(onCount[1] > 0 ? Math.round(waveformSum[1] / onCount[1]) : 0),
    waveformColor(onCount[2] > 0 ? Math.round(waveformSum[2] / onCount[2]) : 0),
  ];

  return {
    voiceOn,
    voicePitch01,
    voiceColor,
    cutoff01: sampleCount > 0 ? cutoffSum / sampleCount / MAX_CUTOFF_VALUE : 0,
    volume01: sampleCount > 0 ? volumeSum / sampleCount / MAX_VOLUME_VALUE : 0,
    writeDensity01:
      sampleCount > 0 && writeCountCeiling > 0 ? writeSum / sampleCount / writeCountCeiling : 0,
  };
}

function bucketAverage(
  values: Float32Array,
  ranges: readonly (readonly [number, number])[]
): readonly number[] {
  return ranges.map(([start, end]) => {
    const clampedEnd = Math.min(end, values.length);
    const from = Math.min(start, values.length - 1);
    const to = Math.max(clampedEnd, from + 1);
    let sum = 0;
    let count = 0;
    for (let i = from; i < to; i++) {
      sum += values[i];
      count++;
    }
    return count === 0 ? 0 : sum / count;
  });
}

function polylinePoints(values: readonly number[], laneHeight: number): string {
  return values.map((value, index) => `${index + 0.5},${(1 - value) * laneHeight}`).join(' ');
}

/** Contiguous marked columns become one filled run, so a lane's worth of ticks costs one node. */
function tickPath(columns: readonly boolean[], height: number): string {
  const runs: string[] = [];
  let runStart: number | null = null;
  for (let column = 0; column <= columns.length; column++) {
    const marked = column < columns.length && columns[column];
    if (marked && runStart === null) {
      runStart = column;
    } else if (!marked && runStart !== null) {
      const width = column - runStart;
      runs.push(`M${runStart} 0h${width}v${height}h${-width}z`);
      runStart = null;
    }
  }
  return runs.join('');
}

/** 'C major · 8B', or the honest answer. Never a key name without the Camelot number beside it: the
 *  wheel is what a DJ mixes on. */
function keyLabel(key: KeyResult | null): string {
  if (key === null) return '—';
  const name = keyName(key);
  return name === null || key.camelot === null ? 'no clear key' : `${name} · ${key.camelot}`;
}

/** 'C major · 8B · +3.2 cents', appending the sounding tuning's deviation beside the label exactly as
 *  the live-scan path does — the single formatting rule both `keySoundingLabel` branches share. */
function soundingKeyLabel(sounding: KeyResult | null): string {
  if (sounding === null || sounding.tuning === null) return keyLabel(sounding);
  return `${keyLabel(sounding)} · ${formatCents(sounding.tuning.cents)}`;
}

/** Rebuilds the `KeyResult` shape `soundingKey()` expects from a cached record's own fields, so the
 *  cached-record fallback can share the exact same native-to-sounding transposition the live path
 *  uses. Chroma is a zero-filled placeholder: `soundingKey()` only reads it to build a rotated chroma,
 *  and nothing in the label path ever looks at that rotated chroma. */
function keyResultFromRecord(record: TuneIndexRecord): KeyResult {
  return {
    chroma: new Float32Array(PITCH_CLASS_NAMES.length),
    tonic: record.tonic,
    mode: record.mode,
    camelot: record.camelot,
    confidence: record.keyConfidence,
    tuning:
      record.tuningReferenceHz === null || record.tuningCents === null
        ? null
        : { referenceHz: record.tuningReferenceHz, cents: record.tuningCents },
    scalePitchClasses: record.scalePitchClasses,
  };
}

/** The three nullable loop fields a record stores, read back as the one shape the readout renders —
 *  the inverse of the mapping `TuneIndexService` applies on the way in. */
function loopDetectionFor(record: TuneIndexRecord | null): LoopDetection | null {
  if (record === null) return null;
  const { loopStartFrame, loopPeriodFrames, endedAtFrame } = record;
  if (loopStartFrame !== null && loopPeriodFrames !== null) {
    return { kind: 'loop', startFrame: loopStartFrame, periodFrames: loopPeriodFrames };
  }
  return endedAtFrame === null ? { kind: 'none' } : { kind: 'ended', endFrame: endedAtFrame };
}

/** A live detection in the field shape a record stores it in, so the length below runs through the
 *  same `positionBasisFor` a cached record does rather than a second rule that could drift from it. */
function loopFramesOf(detection: LoopDetection): DetectedLoopFrames {
  return {
    loopStartFrame: detection.kind === 'loop' ? detection.startFrame : null,
    loopPeriodFrames: detection.kind === 'loop' ? detection.periodFrames : null,
    endedAtFrame: detection.kind === 'ended' ? detection.endFrame : null,
  };
}

/** Paints the similarity matrix as one pixel per block — origin top-left, so the main diagonal runs
 *  from the canvas's own corner — then overlays section boundaries as faint grid lines. A canvas
 *  rather than SVG nodes: at up to 256×256 cells, one rect per cell would blow the DOM-node budget
 *  the lane stack elsewhere in this panel is careful to stay under. */
function paintStructureCanvas(canvas: HTMLCanvasElement, structure: StructureResult): void {
  const { blockCount, matrix, sectionBoundaries, blockFrames } = structure;
  if (blockCount === 0) return;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;

  const imageData = ctx.createImageData(blockCount, blockCount);
  for (let i = 0; i < matrix.length; i++) {
    const value = Math.min(255, Math.max(0, Math.round(matrix[i] * 255)));
    const offset = i * 4;
    imageData.data[offset] = value;
    imageData.data[offset + 1] = value;
    imageData.data[offset + 2] = value;
    imageData.data[offset + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  ctx.strokeStyle = 'rgba(147, 164, 180, 0.35)';
  ctx.lineWidth = 1;
  for (const boundaryFrame of sectionBoundaries) {
    const block = boundaryFrame / blockFrames;
    ctx.beginPath();
    ctx.moveTo(block, 0);
    ctx.lineTo(block, blockCount);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, block);
    ctx.lineTo(blockCount, block);
    ctx.stroke();
  }
}

/**
 * The Track Analysis section: a collapsible lane stack over a scanned tune, a candidate rail driven
 * by the novelty curve, and the readout P03 adds its own rows to. Everything here is click-to-audition
 * — the workbench only earns its keep once what it finds can be heard.
 *
 * Exempt from the drawer's column-per-deck rule: it is a graphical analysis surface, not a field
 * list, and duplicating it would double an already expensive panel. It carries a deck selector
 * instead — `DjPocViewComponent` owns which deck is selected and hands this panel that deck's own
 * handle through `deck`, so switching the selector retargets every computed below onto the newly
 * chosen deck.
 *
 * Deliberately dependency-light: it reaches only into `engine/dj-player-engine`, the two leaf engine
 * modules it shares arithmetic with (`engine/play-rate`, `engine/engine-utils`) and its own
 * `analysis/*` siblings, never into `replay/`, `clock/`, `midi/` or `engine/marker-state` — the whole
 * section can be deleted with the route it lives on.
 */
@Component({
  selector: 'lib-track-analysis-panel',
  templateUrl: './track-analysis-panel.component.html',
  styleUrl: './track-analysis-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Its own scanner, deliberately not the view's REPLAY_RUNNER: a whole-tune scan must never sit in
  // front of a latency-sensitive scrub, so it gets a worker thread of its own.
  providers: [{ provide: ANALYSIS_SCANNER, useFactory: () => new WorkerAnalysisScanner() }],
})
export class TrackAnalysisPanelComponent implements OnDestroy {
  readonly deck = input.required<DeckHandle>();

  private readonly scanner = inject(ANALYSIS_SCANNER);

  /** This deck's own engine — re-read on every access rather than captured once, since `deck` itself
   *  can change while this panel stays mounted (see the class doc). */
  private get engine(): DjPlayerEngine {
    return this.deck().engine;
  }

  private get tuneIndexService(): TuneIndexService {
    return this.deck().tuneIndex;
  }

  /** The tune this deck currently has loaded — what the retired `file` input used to carry directly. */
  protected readonly file = computed<SidFile | null>(() => this.deck().tuneLoader.currentTune());

  protected readonly collapsed = signal<boolean>(true);

  protected readonly scanOutput = signal<ScanOutput | null>(null);
  protected readonly featureMatrix = signal<FeatureMatrix | null>(null);
  protected readonly noveltyResult = signal<NoveltyResult | null>(null);
  protected readonly structureResult = signal<StructureResult | null>(null);
  protected readonly loopDetection = signal<LoopDetection | null>(null);
  protected readonly pulseResult = signal<PulseResult | null>(null);
  protected readonly notes = signal<readonly Note[]>([]);
  protected readonly keyResult = signal<KeyResult | null>(null);
  protected readonly sectionKeys = signal<readonly KeyResult[]>([]);
  protected readonly threshold = signal<number>(DEFAULT_CANDIDATE_THRESHOLD);
  protected readonly weights = signal<FeatureWeights>(DEFAULT_FEATURE_WEIGHTS);
  protected readonly selectedCandidate = signal<Candidate | null>(null);
  protected readonly scanning = signal<boolean>(false);
  protected readonly scanProgressFrame = signal<number>(0);
  protected readonly scanError = signal<string | null>(null);
  protected readonly viewWindow = signal<FrameWindow | null>(null);

  protected readonly visibleLanes = signal<ReadonlySet<LaneKey>>(
    new Set(LANE_TOGGLES.map((lane) => lane.key))
  );
  protected readonly weightsOpen = signal<boolean>(false);
  protected readonly overlaysVisible = signal<boolean>(true);

  protected readonly laneToggles = LANE_TOGGLES;
  protected readonly weightFields = WEIGHT_FIELDS;
  protected readonly voiceIndices = [0, 1, 2] as const;

  protected readonly viewWidth = COLUMN_COUNT;
  protected readonly rulerHeight = RULER_HEIGHT;
  protected readonly voiceLaneHeight = VOICE_LANE_HEIGHT;
  protected readonly voiceBlockHeight = VOICE_BLOCK_HEIGHT;
  protected readonly filterLaneHeight = FILTER_LANE_HEIGHT;
  protected readonly volumeLaneHeight = VOLUME_LANE_HEIGHT;
  protected readonly densityLaneHeight = DENSITY_LANE_HEIGHT;
  protected readonly noveltyLaneHeight = NOVELTY_LANE_HEIGHT;
  protected readonly candidateLaneHeight = CANDIDATE_LANE_HEIGHT;
  protected readonly pulseLaneHeight = PULSE_LANE_HEIGHT;
  protected readonly chromaLaneHeight = CHROMA_LANE_HEIGHT;
  protected readonly chromaBarWidth = CHROMA_BAR_WIDTH;
  protected readonly chromaBarPitch = CHROMA_BAR_WIDTH + CHROMA_BAR_GAP;
  protected readonly chromaWidth = PITCH_CLASS_NAMES.length * (CHROMA_BAR_WIDTH + CHROMA_BAR_GAP);

  private readonly structureCanvas = viewChild<ElementRef<HTMLCanvasElement>>('structureCanvas');

  private generation = 0;
  private nextRequestId = 0;
  private nextSessionId = 0;

  constructor() {
    // A subtune switch — or a different tune entirely — is different music: leaving a stale scan,
    // stale candidates and a stale threshold describing the previous one is worse than showing
    // nothing.
    effect(() => {
      this.file();
      this.engine.currentSubtune();
      this.clearAnalysis();
    });

    // Repaints whenever the structure result changes (a fresh analysis or a weight edit) and again
    // once the canvas itself exists — jsdom has no 2D context, so painting is a no-op under test.
    effect(() => {
      const structure = this.structureResult();
      const canvasRef = this.structureCanvas();
      if (structure === null || canvasRef === undefined) return;
      paintStructureCanvas(canvasRef.nativeElement, structure);
    });
  }

  ngOnDestroy(): void {
    this.scanner.dispose();
  }

  protected readonly canRunAnalysis = computed<boolean>(
    () => this.file() !== null && !this.scanning()
  );

  protected readonly hasAnalysis = computed<boolean>(() => this.scanOutput() !== null);

  private readonly cachedRecord = computed<TuneIndexRecord | null>(() =>
    this.tuneIndexService.record()
  );

  /** True once either a live scan or a cached index record can back the readout — the signal the
   *  template uses to show the readout panel independently of the visual lane stack, which only a
   *  live scan can ever supply. */
  protected readonly hasCachedRecord = computed<boolean>(() => this.cachedRecord() !== null);

  protected readonly effectiveWindow = computed<FrameWindow>(() => {
    const scan = this.scanOutput();
    const total = scan?.frames ?? 0;
    return this.viewWindow() ?? { start: 0, end: Math.max(total, 1) };
  });

  protected readonly isZoomedFull = computed<boolean>(() => this.viewWindow() === null);

  /** Above-threshold candidates only — a pure filter over already-computed candidates, so moving the
   *  threshold never touches the scanner. */
  protected readonly candidates = computed<readonly Candidate[]>(() => {
    const result = this.noveltyResult();
    return result === null ? [] : candidatesAbove(result, this.threshold());
  });

  protected readonly candidateMarks = computed<readonly CandidateMark[]>(() => {
    const result = this.noveltyResult();
    if (result === null) return [];
    const threshold = this.threshold();
    const selected = this.selectedCandidate();
    const window = this.effectiveWindow();
    const marks: CandidateMark[] = [];
    for (const candidate of result.candidates) {
      if (candidate.frame < window.start || candidate.frame > window.end) {
        continue;
      }
      marks.push({
        candidate,
        x: this.frameToX(candidate.frame),
        above: candidate.strength >= threshold,
        selected: selected !== null && selected.frame === candidate.frame,
      });
    }
    return marks;
  });

  private readonly writeCountCeiling = computed<number>(() => {
    const scan = this.scanOutput();
    return scan === null ? 0 : observedWriteCountCeiling(scan);
  });

  private readonly bucketRangesForWindow = computed<readonly (readonly [number, number])[]>(() => {
    const scan = this.scanOutput();
    return scan === null ? [] : bucketRanges(this.effectiveWindow(), COLUMN_COUNT, scan.frames);
  });

  /** Per-pixel-column aggregates — the single biggest performance decision here. However many
   *  frames were scanned, this is always `COLUMN_COUNT` rows. */
  protected readonly columns = computed<readonly ColumnAggregate[] | null>(() => {
    const scan = this.scanOutput();
    if (scan === null) return null;
    const ceiling = this.writeCountCeiling();
    return this.bucketRangesForWindow().map((range) => aggregateColumn(scan, range, ceiling));
  });

  protected readonly voiceBlocks = computed<readonly (readonly VoiceBlock[])[]>(() => {
    const columns = this.columns();
    if (columns === null) return [[], [], []];
    return [0, 1, 2].map((voice) => {
      const blocks: VoiceBlock[] = [];
      columns.forEach((column, index) => {
        if (!column.voiceOn[voice]) return;
        blocks.push({
          x: index,
          y: (1 - column.voicePitch01[voice]) * (VOICE_LANE_HEIGHT - VOICE_BLOCK_HEIGHT),
          color: column.voiceColor[voice],
        });
      });
      return blocks;
    });
  });

  /**
   * One tick per column holding a note outside the detected scale, drawn as a single path per voice
   * rather than a rect per column — the lane stack's DOM-node budget is the reason every other lane
   * aggregates to columns, and this overlay must not be the one that blows it.
   *
   * This is the key detection's own validation: sparse ticks mean the answer is probably right, a
   * lane full of them means it is not, and neither requires listening.
   */
  protected readonly outOfScalePaths = computed<readonly string[]>(() => {
    const key = this.keyResult();
    const ranges = this.bucketRangesForWindow();
    if (key === null || key.scalePitchClasses.length === 0 || ranges.length === 0) {
      return ['', '', ''];
    }

    const marked = [0, 1, 2].map(() => new Array<boolean>(ranges.length).fill(false));
    for (const note of this.notes()) {
      if (!isOutOfScale(note.hz, key)) continue;
      const from = this.frameToColumn(note.startFrame);
      const to = this.frameToColumn(note.endFrame - 1);
      if (from === null || to === null) continue;
      for (let column = from; column <= to; column++) {
        marked[note.voice][column] = true;
      }
    }
    return marked.map((columns) => tickPath(columns, OUT_OF_SCALE_TICK_HEIGHT));
  });

  protected readonly chromaBars = computed<readonly ChromaBar[]>(() => {
    const key = this.keyResult();
    if (key === null) return [];
    let peak = 0;
    for (let pc = 0; pc < key.chroma.length; pc++) {
      peak = Math.max(peak, key.chroma[pc]);
    }
    return PITCH_CLASS_NAMES.map((name, pc) => ({
      name,
      height: peak > 0 ? (key.chroma[pc] / peak) * CHROMA_LANE_HEIGHT : 0,
      inScale: key.scalePitchClasses.includes(pc),
      isTonic: key.tonic === pc,
    }));
  });

  protected readonly filterPoints = computed<string>(() => {
    const columns = this.columns();
    return columns === null
      ? ''
      : polylinePoints(
          columns.map((column) => column.cutoff01),
          FILTER_LANE_HEIGHT
        );
  });

  protected readonly volumePoints = computed<string>(() => {
    const columns = this.columns();
    return columns === null
      ? ''
      : polylinePoints(
          columns.map((column) => column.volume01),
          VOLUME_LANE_HEIGHT
        );
  });

  protected readonly densityBars = computed<readonly DensityBar[]>(() => {
    const columns = this.columns();
    if (columns === null) return [];
    return columns.map((column, index) => ({
      x: index,
      y: (1 - column.writeDensity01) * DENSITY_LANE_HEIGHT,
      height: column.writeDensity01 * DENSITY_LANE_HEIGHT,
    }));
  });

  protected readonly noveltyPoints = computed<string>(() => {
    const result = this.noveltyResult();
    if (result === null) return '';
    const values = bucketAverage(result.curve, this.bucketRangesForWindow());
    return polylinePoints(values, NOVELTY_LANE_HEIGHT);
  });

  protected readonly pulseHistogramBars = computed<
    readonly {
      readonly interval: number;
      readonly x: number;
      readonly height: number;
      readonly isDominant: boolean;
    }[]
  >(() => {
    const pulse = this.pulseResult();
    if (pulse === null || pulse.histogram.length === 0) return [];

    const histogram = pulse.histogram;
    const dominantInterval = pulse.dominantInterval;

    // Find max histogram value for scaling
    let maxCount = 0;
    for (let i = 0; i < histogram.length; i++) {
      if (histogram[i] > maxCount) {
        maxCount = histogram[i];
      }
    }

    if (maxCount === 0) return [];

    const bars: HistogramBar[] = [];
    const barsPerInterval = Math.max(1, Math.ceil(histogram.length / COLUMN_COUNT));

    for (let col = 0; col < COLUMN_COUNT; col++) {
      const startInterval = col * barsPerInterval;
      const endInterval = Math.min(startInterval + barsPerInterval, histogram.length);

      let maxInRange = 0;
      let representativeInterval = startInterval;
      for (let i = startInterval; i < endInterval; i++) {
        if (histogram[i] > maxInRange) {
          maxInRange = histogram[i];
          representativeInterval = i;
        }
      }

      if (maxInRange > 0) {
        bars.push({
          interval: representativeInterval,
          x: col,
          height: (maxInRange / maxCount) * PULSE_LANE_HEIGHT,
          isDominant: representativeInterval === dominantInterval,
        });
      }
    }

    return bars;
  });

  protected readonly rulerTicks = computed<
    readonly { readonly x: number; readonly label: string }[]
  >(() => {
    const scan = this.scanOutput();
    if (scan === null) return [];
    const window = this.effectiveWindow();
    const span = window.end - window.start;
    const tickCount = 6;
    const ticks: { x: number; label: string }[] = [];
    for (let i = 0; i <= tickCount; i++) {
      const frame = window.start + (span * i) / tickCount;
      ticks.push({ x: (i / tickCount) * COLUMN_COUNT, label: formatDuration(this.toSeconds(frame)) });
    }
    return ticks;
  });

  protected readonly laneOffsets = computed<LaneOffsets>(() => {
    const visible = this.visibleLanes();
    let y = RULER_HEIGHT;
    const voiceY: [number | null, number | null, number | null] = [null, null, null];
    (['voice0', 'voice1', 'voice2'] as const).forEach((key, index) => {
      if (visible.has(key)) {
        voiceY[index] = y;
        y += VOICE_LANE_HEIGHT + LANE_GAP;
      }
    });
    let filterY: number | null = null;
    if (visible.has('filter')) {
      filterY = y;
      y += FILTER_LANE_HEIGHT + LANE_GAP;
    }
    let volumeY: number | null = null;
    if (visible.has('volume')) {
      volumeY = y;
      y += VOLUME_LANE_HEIGHT + LANE_GAP;
    }
    let densityY: number | null = null;
    if (visible.has('density')) {
      densityY = y;
      y += DENSITY_LANE_HEIGHT + LANE_GAP;
    }
    let noveltyY: number | null = null;
    if (visible.has('novelty')) {
      noveltyY = y;
      y += NOVELTY_LANE_HEIGHT + LANE_GAP;
    }
    let pulseY: number | null = null;
    // Pulse lane is always shown if there's analysis, not toggleable yet
    // (in future versions it can be added to LANE_TOGGLES for user control)
    if (this.pulseResult() !== null) {
      pulseY = y;
      y += PULSE_LANE_HEIGHT + LANE_GAP;
    }
    const candidateY = y;
    y += CANDIDATE_LANE_HEIGHT;
    return { voiceY, filterY, volumeY, densityY, noveltyY, pulseY, candidateY, totalHeight: y };
  });

  /** Distinct from the selected candidate on purpose: right after a jump lands they sit at the same
   *  position, and only diverge as playback continues. */
  protected readonly playheadX = computed<number | null>(() => {
    const scan = this.scanOutput();
    if (scan === null) return null;
    const window = this.effectiveWindow();
    const frame = this.engine.stats().framesRendered;
    if (frame < window.start || frame > window.end) return null;
    return this.frameToX(frame);
  });

  protected readonly selectedX = computed<number | null>(() => {
    const candidate = this.selectedCandidate();
    if (candidate === null) return null;
    const window = this.effectiveWindow();
    if (candidate.frame < window.start || candidate.frame > window.end) return null;
    return this.frameToX(candidate.frame);
  });

  protected readonly framesAnalysedLabel = computed<string>(() => {
    const scan = this.scanOutput();
    return scan === null ? '—' : scan.frames.toLocaleString();
  });

  protected readonly peaksAboveThresholdLabel = computed<string>(() =>
    this.candidates().length.toLocaleString()
  );

  protected readonly selectedFrameLabel = computed<string>(() => {
    const candidate = this.selectedCandidate();
    return candidate === null ? '—' : candidate.frame.toLocaleString();
  });

  protected readonly selectedTimeLabel = computed<string>(() => {
    const candidate = this.selectedCandidate();
    if (candidate === null || this.scanOutput() === null) return '—';
    return formatDuration(this.toSeconds(candidate.frame));
  });

  protected readonly selectedCauseLabel = computed<string>(() => {
    const candidate = this.selectedCandidate();
    return candidate === null || candidate.contributors.length === 0
      ? '—'
      : candidate.contributors.join(', ');
  });

  protected readonly scanProgressPercent = computed<number>(() => {
    if (!this.scanning()) return 0;
    const ceiling = this.engine.ceilingFrames();
    return ceiling > 0 ? Math.min(100, (this.scanProgressFrame() / ceiling) * 100) : 0;
  });

  protected readonly structureStartTimeLabel = computed<string>(() => formatDuration(0));

  protected readonly structureEndTimeLabel = computed<string>(() => {
    const scan = this.scanOutput();
    return scan === null ? '—' : formatDuration(this.toSeconds(scan.frames));
  });

  /** The detected loop, however it was reached: a live scan runs the detector itself, a cached record
   *  replays the answer it stored, and everything downstream reads this one signal. */
  private readonly effectiveLoop = computed<LoopDetection | null>(() =>
    this.scanOutput() !== null ? this.loopDetection() : loopDetectionFor(this.cachedRecord())
  );

  /** `ended` and `none` are different findings and read differently — a tune that provably stops is
   *  not a tune nothing could be decided about. */
  protected readonly structureLoopLabel = computed<string>(() => {
    const detection = this.effectiveLoop();
    if (detection === null) return '—';
    switch (detection.kind) {
      case 'loop':
        return `frame ${detection.startFrame.toLocaleString()} · every ${formatDuration(
          this.toSeconds(detection.periodFrames)
        )}`;
      case 'ended':
        return `ends at frame ${detection.endFrame.toLocaleString()}`;
      default:
        return 'not found';
    }
  });

  /** "not found" rather than falling back to the ceiling or any fixed duration — a tune detection
   *  could not answer for genuinely has no known length, the same declined answer the Loop row above
   *  reports, not a second word for it. Derived from frames at display time through the rate in force,
   *  so this panel and the rail's Tune Index panel cannot report different lengths for the same tune,
   *  and both follow the Timing selector. */
  protected readonly structureLengthLabel = computed<string>(() => {
    const detection = this.effectiveLoop();
    const frames = detection === null ? null : positionBasisFor(loopFramesOf(detection));
    return frames === null ? 'not found' : formatDuration(this.toSeconds(frames));
  });

  protected readonly structureSectionsLabel = computed<string>(() => {
    if (this.scanOutput() !== null) {
      const structure = this.structureResult();
      return structure === null ? '—' : structure.sectionBoundaries.length.toLocaleString();
    }
    const record = this.cachedRecord();
    return record === null ? '—' : record.sectionBoundaries.length.toLocaleString();
  });

  protected readonly pulseIntervalLabel = computed<string>(() => {
    if (this.scanOutput() !== null) {
      const pulse = this.pulseResult();
      return pulse === null || pulse.dominantInterval === null
        ? '—'
        : pulse.dominantInterval.toLocaleString();
    }
    const record = this.cachedRecord();
    return record === null || record.dominantIntervalFrames === null
      ? '—'
      : record.dominantIntervalFrames.toLocaleString();
  });

  protected readonly pulseNativeTempoLabel = computed<string>(() => {
    const scan = this.scanOutput();
    if (scan !== null) {
      const pulse = this.pulseResult();
      if (pulse === null || pulse.dominantInterval === null) return '—';
      const { native } = impliedTempo(
        pulse.dominantInterval,
        this.engine.nominalIntervalUs(),
        scan.callsPerFrame,
        1.0
      );
      return native === null ? '—' : native.toFixed(1);
    }
    const record = this.cachedRecord();
    return record === null || record.nativeTempo === null ? '—' : record.nativeTempo.toFixed(1);
  });

  protected readonly pulseSoundingTempoLabel = computed<string>(() => {
    const scan = this.scanOutput();
    if (scan !== null) {
      const pulse = this.pulseResult();
      if (pulse === null || pulse.dominantInterval === null) return '—';
      const { sounding } = impliedTempo(
        pulse.dominantInterval,
        this.engine.nominalIntervalUs(),
        scan.callsPerFrame,
        this.engine.speedMultiplier()
      );
      return sounding === null ? '—' : sounding.toFixed(1);
    }
    const record = this.cachedRecord();
    return record === null || record.nativeTempo === null
      ? '—'
      : (record.nativeTempo * this.engine.speedMultiplier()).toFixed(1);
  });

  protected readonly pulseConfidenceLabel = computed<string>(() => {
    if (this.scanOutput() !== null) {
      const pulse = this.pulseResult();
      return pulse === null ? '—' : pulse.confidence;
    }
    const record = this.cachedRecord();
    return record === null ? '—' : record.pulseConfidence;
  });

  /** The key a pitched deck is actually sounding in. Reported beside the native key exactly as the
   *  tempo readout reports both figures — a deck at +6% is sounding roughly a semitone up. Live-scan
   *  only: the cached-record fallback in `keySoundingLabel` builds its own transposed key rather than
   *  routing through this signal, since it has no live `keyResult()` to transpose. */
  protected readonly soundingKeyResult = computed<KeyResult | null>(() => {
    const key = this.keyResult();
    return key === null ? null : soundingKey(key, this.engine.speedMultiplier());
  });

  protected readonly keyNativeLabel = computed<string>(() => {
    if (this.scanOutput() !== null) return keyLabel(this.keyResult());
    const record = this.cachedRecord();
    if (record === null) return '—';
    return record.tonic === null || record.mode === null || record.camelot === null
      ? 'no clear key'
      : `${PITCH_CLASS_NAMES[record.tonic]} ${record.mode} · ${record.camelot}`;
  });

  protected readonly keySoundingLabel = computed<string>(() => {
    if (this.scanOutput() !== null) {
      return soundingKeyLabel(this.soundingKeyResult());
    }
    const record = this.cachedRecord();
    if (record === null) return '—';
    return soundingKeyLabel(soundingKey(keyResultFromRecord(record), this.engine.speedMultiplier()));
  });

  protected readonly keyConfidenceLabel = computed<string>(() => {
    if (this.scanOutput() !== null) return this.keyResult()?.confidence ?? '—';
    const record = this.cachedRecord();
    return record === null ? '—' : record.keyConfidence;
  });

  protected readonly keyTuningLabel = computed<string>(() => {
    if (this.scanOutput() !== null) {
      const tuning = this.keyResult()?.tuning ?? null;
      if (this.keyResult() === null) return '—';
      return tuning === null
        ? 'not recovered'
        : `${tuning.referenceHz.toFixed(1)} Hz · ${formatCents(tuning.cents)}`;
    }
    const record = this.cachedRecord();
    if (record === null) return '—';
    return record.tuningReferenceHz === null || record.tuningCents === null
      ? 'not recovered'
      : `${record.tuningReferenceHz.toFixed(1)} Hz · ${formatCents(record.tuningCents)}`;
  });

  /** Surfaced only when the sections disagree, so a tune that never modulates shows one answer
   *  rather than a list of identical ones. */
  protected readonly modulationLabels = computed<readonly string[]>(() => {
    const sections = this.sectionKeys();
    if (sections.length < 2) return [];
    const labels = sections.map((section) => keyLabel(section));
    return new Set(labels).size < 2 ? [] : labels;
  });

  protected toggleCollapsed(): void {
    this.collapsed.update((value) => !value);
  }

  protected toggleLane(key: LaneKey): void {
    this.visibleLanes.update((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  protected isLaneVisible(key: LaneKey): boolean {
    return this.visibleLanes().has(key);
  }

  protected toggleWeightsPanel(): void {
    this.weightsOpen.update((open) => !open);
  }

  protected toggleOverlays(): void {
    this.overlaysVisible.update((visible) => !visible);
  }

  protected onThresholdInput(event: Event): void {
    this.threshold.set(Number((event.target as HTMLInputElement).value));
  }

  /** Recomputes the novelty curve from the already-decoded matrix — weights are set once a session,
   *  but never worth a re-scan. */
  protected onWeightInput(key: keyof FeatureWeights, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    const nextWeights: FeatureWeights = { ...this.weights(), [key]: value };
    this.weights.set(nextWeights);
    const matrix = this.featureMatrix();
    if (matrix !== null) {
      const novelty = computeNovelty(matrix, nextWeights);
      this.noveltyResult.set(novelty);
      const structure = computeStructure(matrix, nextWeights);
      this.structureResult.set(structure);
      this.pulseResult.set(computePulse(novelty.candidates));
      // The notes did not move, but the section boundaries did, so the per-section keys would
      // otherwise describe sections the redrawn structure no longer has.
      this.sectionKeys.set(detectKeyPerSection(this.notes(), structure.sectionBoundaries));
    }
  }

  protected zoomIn(): void {
    this.rescale(0.5);
  }

  protected zoomOut(): void {
    this.rescale(2);
  }

  protected panLeft(): void {
    this.pan(-0.25);
  }

  protected panRight(): void {
    this.pan(0.25);
  }

  protected async runAnalysis(): Promise<void> {
    const file = this.file();
    if (file === null || this.scanning()) {
      return;
    }

    const myGeneration = this.generation;
    this.scanning.set(true);
    this.scanProgressFrame.set(0);
    this.scanError.set(null);

    const request: ScanRequest = {
      id: ++this.nextRequestId,
      // A fresh session every run: this panel scans once, to the ceiling, and never deepens, so it
      // must never continue whatever scan the scanner happens to be holding.
      session: ++this.nextSessionId,
      file,
      subtune: this.engine.currentSubtune(),
      maxFrames: this.engine.ceilingFrames(),
    };

    const result: ScanResult = await this.scanner.scan(request, (frame) => {
      if (myGeneration === this.generation) {
        this.scanProgressFrame.set(frame);
      }
    });

    if (myGeneration !== this.generation) {
      return; // superseded by a file or subtune change while the scan was in flight
    }
    this.scanning.set(false);

    if (result.kind === 'failed') {
      this.scanError.set(result.error);
      return;
    }

    this.scanOutput.set(result.output);
    const matrix = buildFeatureMatrix(result.output);
    this.featureMatrix.set(matrix);
    const novelty = computeNovelty(matrix, this.weights());
    this.noveltyResult.set(novelty);
    const structure = computeStructure(matrix, this.weights());
    this.structureResult.set(structure);
    // Independent of the weights, so — unlike the structure square — a weight edit never re-runs it.
    this.loopDetection.set(detectLoop(result.output, this.loopDetectOptions()));
    this.pulseResult.set(computePulse(novelty.candidates));

    const notes = segmentNotes(result.output, file.clock);
    this.notes.set(notes);
    this.keyResult.set(detectKey(notes));
    this.sectionKeys.set(detectKeyPerSection(notes, structure.sectionBoundaries));
  }

  protected onLaneClick(event: MouseEvent): void {
    const svg = event.currentTarget as SVGSVGElement;
    const fraction = this.pointerFraction(event, svg);
    if (fraction === null) return;
    const window = this.effectiveWindow();
    const frame = Math.round(window.start + fraction * (window.end - window.start));
    void this.jumpToFrame(frame);
  }

  /** The lane stack's keyboard equivalent to a click: left/right steps through candidates, the same
   *  audition path the candidate rail's own controls use. */
  protected onLaneKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.onNextCandidate();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.onPreviousCandidate();
    }
  }

  protected onCandidateClick(candidate: Candidate, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedCandidate.set(candidate);
    void this.jumpToFrame(candidate.frame);
  }

  protected onJumpToSelected(): void {
    const candidate = this.selectedCandidate();
    if (candidate === null) return;
    void this.jumpToFrame(candidate.frame);
  }

  protected onPreviousCandidate(): void {
    void this.stepCandidate(-1);
  }

  protected onNextCandidate(): void {
    void this.stepCandidate(1);
  }

  /** The only write this panel performs. `addMarker` captures wherever the playhead currently sits,
   *  so the jump must land — the scrub promise must resolve — before it is called. */
  protected async onCopyToMarker(): Promise<void> {
    const candidate = this.selectedCandidate();
    if (candidate === null) return;
    await this.jumpToFrame(candidate.frame);
    this.engine.addMarker();
  }

  private async stepCandidate(direction: -1 | 1): Promise<void> {
    const list = this.candidates();
    if (list.length === 0) return;
    const current = this.selectedCandidate();
    const currentIndex = current === null ? -1 : list.findIndex((c) => c.frame === current.frame);
    const nextIndex =
      currentIndex === -1
        ? direction === 1
          ? 0
          : list.length - 1
        : (currentIndex + direction + list.length) % list.length;
    const candidate = list[nextIndex];
    this.selectedCandidate.set(candidate);
    await this.jumpToFrame(candidate.frame);
  }

  /**
   * The detector's seconds-valued constants in frames.
   *
   * Converted against the **rounded** rate, never the mode-selected one — the same conversion
   * `TuneIndexService` makes, so this panel's live scan and the background index agree. Both guards
   * are emulation budgets rather than real-time durations, and the measured detection baseline was
   * produced against the rounded rate; the exact rate would shift them by up to ~20% on a CIA-timer
   * tune.
   */
  private loopDetectOptions(): LoopDetectOptions {
    const perSecond = playCallsPerSecond(
      this.engine.nominalIntervalUs(),
      asRounded(this.engine.playRate())
    );
    return {
      minTailFrames: Math.round(MIN_TAIL_SECONDS * perSecond),
      idlePeriodFrames: Math.round(IDLE_PERIOD_SECONDS * perSecond),
    };
  }

  private async jumpToFrame(frame: number): Promise<void> {
    const basis = this.engine.positionBasisFrames();
    if (basis <= 0) return;
    const percent = (frame / basis) * 100;
    await this.engine.scrubTo(percent);
  }

  /** Frames as seconds of music through the rate currently in force — the single conversion every
   *  duration in this panel goes through, so the readout and the ruler can never disagree with each
   *  other or with the rail's Tune Index panel. */
  private toSeconds(frames: number): number {
    return playCallsToSeconds(frames, this.engine.nominalIntervalUs(), this.engine.playRate());
  }

  private frameToX(frame: number): number {
    const window = this.effectiveWindow();
    const span = window.end - window.start;
    if (span <= 0) return 0;
    const clamped = Math.min(Math.max(frame, window.start), window.end);
    return ((clamped - window.start) / span) * COLUMN_COUNT;
  }

  /** null when the frame falls outside the visible window — an overlay must not mark a column for a
   *  note that is not on screen. */
  private frameToColumn(frame: number): number | null {
    const window = this.effectiveWindow();
    const span = window.end - window.start;
    if (span <= 0 || frame < window.start || frame >= window.end) return null;
    const column = Math.floor(((frame - window.start) / span) * COLUMN_COUNT);
    return Math.min(COLUMN_COUNT - 1, Math.max(0, column));
  }

  private pointerFraction(event: MouseEvent, svg: SVGSVGElement): number | null {
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const fraction = (event.clientX - rect.left) / rect.width;
    return Math.min(Math.max(fraction, 0), 1);
  }

  private rescale(factor: number): void {
    const scan = this.scanOutput();
    if (scan === null) return;
    const window = this.effectiveWindow();
    const center = (window.start + window.end) / 2;
    const span = window.end - window.start;
    const nextSpan = Math.min(scan.frames, Math.max(MIN_WINDOW_FRAMES, span * factor));
    this.setWindow(center - nextSpan / 2, center + nextSpan / 2, scan.frames);
  }

  private pan(fraction: number): void {
    const scan = this.scanOutput();
    if (scan === null) return;
    const window = this.effectiveWindow();
    const shift = (window.end - window.start) * fraction;
    this.setWindow(window.start + shift, window.end + shift, scan.frames);
  }

  private setWindow(start: number, end: number, framesTotal: number): void {
    let clampedStart = Math.max(0, start);
    let clampedEnd = Math.min(framesTotal, end);
    if (clampedEnd - clampedStart < MIN_WINDOW_FRAMES) {
      if (clampedStart + MIN_WINDOW_FRAMES <= framesTotal) {
        clampedEnd = clampedStart + MIN_WINDOW_FRAMES;
      } else {
        clampedStart = Math.max(0, framesTotal - MIN_WINDOW_FRAMES);
        clampedEnd = framesTotal;
      }
    }
    if (clampedStart <= 0 && clampedEnd >= framesTotal) {
      this.viewWindow.set(null);
      return;
    }
    this.viewWindow.set({ start: clampedStart, end: clampedEnd });
  }

  private clearAnalysis(): void {
    this.generation++;
    this.scanOutput.set(null);
    this.featureMatrix.set(null);
    this.noveltyResult.set(null);
    this.structureResult.set(null);
    this.loopDetection.set(null);
    this.pulseResult.set(null);
    this.notes.set([]);
    this.keyResult.set(null);
    this.sectionKeys.set([]);
    this.selectedCandidate.set(null);
    this.scanning.set(false);
    this.scanProgressFrame.set(0);
    this.scanError.set(null);
    this.threshold.set(DEFAULT_CANDIDATE_THRESHOLD);
    this.weights.set(DEFAULT_FEATURE_WEIGHTS);
    this.viewWindow.set(null);
  }
}
