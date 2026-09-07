import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrackAnalysisPanelComponent } from './track-analysis-panel.component';
import { frames, microseconds } from '@sidablist/core';
import { ANALYSIS_SCANNER } from '../scan-runner';
import type { AnalysisScanner, ScanResult } from '../scan-runner';
import type { ScanOutput } from '../scan-tune';
import { SID_REGISTER_COUNT } from '@sidablist/core';
import type { SidFile } from '@sidablist/core';
import { PAL_CPU_CLOCK_HZ } from '../notes';
import type { TuneIndexService } from '../tune-index.service';
import { TUNE_INDEX_FORMAT_VERSION } from '../tune-index.model';
import type { TuneIndexRecord } from '../tune-index.model';
import { DEFAULT_CANDIDATE_THRESHOLD } from '../novelty';
import type { PlayRate } from '@sidablist/core';
import { formatDuration } from '../format';
import type { DeckHandle } from '../../deck/deck-registry';
import type { DeckTuneLoader } from '../../deck/deck-tune-loader';
import type { MarkerCollection } from '../../deck/marker-collection';
import {
  createFakeDeckPlayer,
  fakeDeckHandle as buildDeckHandle,
} from '../../../testing/player-doubles';
import type { FakeDeckPlayer } from '../../../testing/player-doubles';

/** Deliberately distinct from the ceiling, so a test that reads this rather than the ceiling proves
 *  jumpToFrame() actually moved onto the basis. */
const POSITION_BASIS_FRAMES = 8_000;
const CEILING_FRAMES = 10_000;

interface StubMarkers {
  addMarker: ReturnType<typeof vi.fn>;
  stopMarkerLoop: ReturnType<typeof vi.fn>;
}

interface StubScanner {
  scan: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}

interface StubTuneIndexService {
  record: WritableSignal<TuneIndexRecord | null>;
  pending: WritableSignal<boolean>;
}

interface StubTuneLoader {
  currentTune: WritableSignal<SidFile | null>;
}

function makeTuneIndexService(): StubTuneIndexService {
  return { record: signal<TuneIndexRecord | null>(null), pending: signal(false) };
}

function makeTuneLoader(file: SidFile | null): StubTuneLoader {
  return { currentTune: signal<SidFile | null>(file) };
}

function fakeDeckHandle(
  id: string,
  label: string,
  player: FakeDeckPlayer,
  markers: StubMarkers,
  tuneIndex: StubTuneIndexService,
  tuneLoader: StubTuneLoader
): DeckHandle {
  return buildDeckHandle(
    { id, label },
    {
      player: player.player,
      view: player.view,
      markers: markers as unknown as MarkerCollection,
      tuneIndex: tuneIndex as unknown as TuneIndexService,
      tuneLoader: tuneLoader as unknown as DeckTuneLoader,
    }
  );
}

/** Moves this deck's basis figures — the two the panel reads apart from the rate. */
function setBasis(player: FakeDeckPlayer, patch: { ceiling?: number; basis?: number }): void {
  player.snapshot.update((snapshot) => ({
    ...snapshot,
    basis: {
      ...snapshot.basis,
      ceilingFrames: frames(patch.ceiling ?? snapshot.basis.ceilingFrames),
      positionBasisFrames: frames(patch.basis ?? snapshot.basis.positionBasisFrames),
    },
  }));
}

function setSubtune(player: FakeDeckPlayer, subtune: number): void {
  player.snapshot.update((snapshot) => ({
    ...snapshot,
    tune: { subtune, subtuneCount: 4, lengthFrames: null },
  }));
}

function setTempoMultiplier(player: FakeDeckPlayer, multiplier: number): void {
  player.snapshot.update((snapshot) => ({
    ...snapshot,
    tempo: { ...snapshot.tempo, multiplier },
  }));
}

function setPlayRate(player: FakeDeckPlayer, rate: PlayRate): void {
  player.snapshot.update((snapshot) => ({
    ...snapshot,
    tempo: { ...snapshot.tempo, rate, callsPerFrame: rate.roundedCallsPerFrame },
  }));
}

function fakeTuneIndexRecord(overrides: Partial<TuneIndexRecord> = {}): TuneIndexRecord {
  return {
    filename: 'Test Tune',
    subtune: 1,
    loopStartFrame: 0,
    loopPeriodFrames: 6250,
    endedAtFrame: null,
    sectionBoundaries: [0, 1200, 2400, 3600],
    detectedMoments: [],
    tonic: 0,
    mode: 'major',
    camelot: '8B',
    tuningReferenceHz: 440,
    tuningCents: 3.2,
    keyConfidence: 'strong',
    scalePitchClasses: [0, 2, 4, 5, 7, 9, 11],
    dominantIntervalFrames: 25,
    pulseConfidence: 'strong',
    nativeTempo: 120,
    callsPerFrame: 1,
    exactCallsPerFrame: 1,
    timingMode: 'exact',
    formatVersion: TUNE_INDEX_FORMAT_VERSION,
    computedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makePlayer(): FakeDeckPlayer {
  const fake = createFakeDeckPlayer();
  fake.snapshot.update((snapshot) => ({
    ...snapshot,
    tune: { subtune: 1, subtuneCount: 4, lengthFrames: null },
    tempo: { ...snapshot.tempo, nominalIntervalUs: microseconds(19_950) },
    basis: {
      ...snapshot.basis,
      ceilingFrames: frames(CEILING_FRAMES),
      positionBasisFrames: frames(POSITION_BASIS_FRAMES),
    },
  }));
  return fake;
}

function makeMarkers(): StubMarkers {
  return { addMarker: vi.fn(() => 0), stopMarkerLoop: vi.fn() };
}

function makeScanner(): StubScanner {
  return { scan: vi.fn(), dispose: vi.fn() };
}

function fakeSidFile(overrides: Partial<SidFile> = {}): SidFile {
  return {
    format: 'PSID',
    version: 2,
    loadAddress: 0x1000,
    initAddress: 0x1000,
    playAddress: 0x1003,
    songs: 1,
    startSong: 1,
    speedFlags: 0,
    name: 'Test Tune',
    author: 'Test Author',
    released: '2026',
    clock: 'pal',
    model: 'mos6581',
    secondSidAddress: null,
    thirdSidAddress: null,
    data: new Uint8Array([0]),
    ...overrides,
  };
}

function makeScan(frames: number): ScanOutput {
  return {
    registerValues: new Uint8Array(frames * SID_REGISTER_COUNT),
    writeCounts: new Uint8Array(frames),
    frames,
    callsPerFrame: 1,
  };
}

function setRegister(scan: ScanOutput, frame: number, register: number, value: number): void {
  scan.registerValues[frame * SID_REGISTER_COUNT + register] = value;
}

/** A tiny scan with one unmistakable event: voice 0 is silent for the first half, then gates on at a
 *  fixed pitch for the second half — a single, deterministic novelty spike to click through. */
function buildSpikeScan(frames = 40, spikeFrame = 20): ScanOutput {
  const scan = makeScan(frames);
  for (let f = spikeFrame; f < frames; f++) {
    setRegister(scan, f, 0, 0x00); // voice0 freq lo
    setRegister(scan, f, 1, 0x20); // voice0 freq hi
    setRegister(scan, f, 4, 0x41); // voice0 control: pulse waveform, gate on
  }
  return scan;
}

/** Two events of deliberately unequal size: a full voice-on transition at frame 20 (activity, gate,
 *  waveform and pitch all move at once — the heaviest four weights in the default set), then a
 *  volume-only swing at frame 40 (one mid-weight dimension) — so the second candidate's curve
 *  strength is reliably far below the first's, but still well above zero. */
function buildTwoSpikeScan(frames = 60): ScanOutput {
  const scan = makeScan(frames);
  for (let f = 20; f < frames; f++) {
    setRegister(scan, f, 0, 0x00);
    setRegister(scan, f, 1, 0x20);
    setRegister(scan, f, 4, 0x41);
  }
  for (let f = 40; f < frames; f++) {
    setRegister(scan, f, 24, 0x0f);
  }
  return scan;
}

const REGISTERS_PER_VOICE = 7;
const PULSE_GATE = 0x41;

/** The register a PAL player's frequency table holds for a pitch, given as semitones from A4. */
function registerFor(semitonesFromA4: number): number {
  return Math.round((440 * Math.pow(2, semitonesFromA4 / 12) * 2 ** 24) / PAL_CPU_CLOCK_HZ);
}

function writeVoice(scan: ScanOutput, frame: number, voice: number, semitone: number): void {
  const base = voice * REGISTERS_PER_VOICE;
  const frequency = registerFor(semitone);
  setRegister(scan, frame, base + 0, frequency & 0xff);
  setRegister(scan, frame, base + 1, (frequency >> 8) & 0xff);
  setRegister(scan, frame, base + 4, PULSE_GATE);
}

/** A I–IV–V–I in C major held as sustained chords, one tone per voice — pitches given as semitones
 *  from A4. `intruder` swaps voice 2 onto an out-of-scale pitch for the frames it names. */
function buildCMajorScan(intruder?: {
  readonly semitone: number;
  readonly frames: number;
}): ScanOutput {
  const progression: readonly (readonly [readonly number[], number])[] = [
    [[-9, -5, -2], 48], // C E G
    [[-4, 0, 3], 24], // F A C
    [[-2, 2, 5], 24], // G B D
    [[-9, -5, -2], 48], // C E G
  ];
  const frames = progression.reduce((total, [, length]) => total + length, 0);
  const scan = makeScan(frames);
  let frame = 0;
  for (const [chord, length] of progression) {
    for (let step = 0; step < length; step++) {
      chord.forEach((semitone, voice) => writeVoice(scan, frame, voice, semitone));
      frame++;
    }
  }
  if (intruder !== undefined) {
    for (let offset = 0; offset < intruder.frames; offset++) {
      writeVoice(scan, frames - 1 - offset, 2, intruder.semitone);
    }
  }
  return scan;
}

/** Every frame identical and voice0 gated on throughout — a flat plateau across the whole window, so
 *  the voice lane's aggregation still has to collapse to one block per column rather than one per
 *  frame. */
function buildConstantlyActiveScan(frames: number): ScanOutput {
  const scan = makeScan(frames);
  for (let f = 0; f < frames; f++) {
    setRegister(scan, f, 0, 0x00);
    setRegister(scan, f, 1, 0x20);
    setRegister(scan, f, 4, 0x41);
  }
  return scan;
}

describe('TrackAnalysisPanelComponent', () => {
  let fixture: ComponentFixture<TrackAnalysisPanelComponent>;
  let component: TrackAnalysisPanelComponent;
  let player: FakeDeckPlayer;
  let markers: StubMarkers;
  let scanner: StubScanner;
  let tuneIndex: StubTuneIndexService;
  let tuneLoader: StubTuneLoader;

  async function setup(file: SidFile | null = fakeSidFile()): Promise<void> {
    player = makePlayer();
    markers = makeMarkers();
    scanner = makeScanner();
    tuneIndex = makeTuneIndexService();
    tuneLoader = makeTuneLoader(file);

    await TestBed.configureTestingModule({
      imports: [TrackAnalysisPanelComponent],
    })
      .overrideComponent(TrackAnalysisPanelComponent, {
        set: {
          providers: [
            { provide: ANALYSIS_SCANNER, useValue: scanner as unknown as AnalysisScanner },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TrackAnalysisPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput(
      'deck',
      fakeDeckHandle('a', 'A', player, markers, tuneIndex, tuneLoader)
    );
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await setup();
  });

  function toggle(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.analysis-toggle');
  }

  function expand(): void {
    toggle().click();
    fixture.detectChanges();
  }

  function analyseButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.analysis-run');
  }

  function thresholdInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector('.threshold-input');
  }

  function setThreshold(value: number): void {
    const input = thresholdInput();
    input.value = String(value);
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function candidateHits(): SVGRectElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.candidate-hit'));
  }

  function aboveTickCount(): number {
    return fixture.nativeElement.querySelectorAll('.candidate-tick--above').length;
  }

  function readoutValue(label: string): string {
    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.readout-row'));
    const row = rows.find((r) => r.textContent?.includes(label));
    return row?.querySelector('span:last-child')?.textContent?.trim() ?? '';
  }

  /** Expands the panel, drives a scan to completion with `scan` as its output, and settles the
   *  resulting signal writes — mirrors the manual-resolve pattern used for `scrubTo` elsewhere in
   *  this library's specs, since jsdom has no real `Worker` to resolve the promise for us. */
  async function completeAnalysis(scan: ScanOutput): Promise<void> {
    expand();
    let resolveScan!: (result: ScanResult) => void;
    scanner.scan.mockImplementation(
      () => new Promise<ScanResult>((resolve) => (resolveScan = resolve))
    );
    analyseButton().click();
    fixture.detectChanges();
    resolveScan({ id: 1, kind: 'done', output: scan });
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
  }

  it('creates, collapsed by default with no analysis controls visible', () => {
    expect(component).toBeTruthy();
    expect(analyseButton()).toBeNull();
    expect(fixture.nativeElement.querySelector('.analysis-body')).toBeNull();
  });

  it('requests a scan bounded by ceilingFrames, at the current subtune', () => {
    setSubtune(player, 2);
    setBasis(player, { ceiling: 12_345 });
    scanner.scan.mockReturnValue(new Promise<ScanResult>(() => undefined));

    expand();
    analyseButton().click();

    expect(scanner.scan).toHaveBeenCalledTimes(1);
    const [request] = scanner.scan.mock.calls[0];
    expect(request.maxFrames).toBe(12_345);
    expect(request.subtune).toBe(2);
  });

  it('shows progress, then renders every lane, the candidate rail and the readout', async () => {
    await completeAnalysis(buildSpikeScan());

    expect(fixture.nativeElement.querySelector('.lane-stack svg')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('g rect.lane-bg').length).toBeGreaterThan(0);
    expect(candidateHits().length).toBeGreaterThan(0);
    expect(fixture.nativeElement.querySelector('.readout-panel')).not.toBeNull();
    expect(readoutValue('Frames analysed')).toBe((40).toLocaleString());
  });

  it('re-filters the candidate rail when the threshold moves, without re-scanning', async () => {
    await completeAnalysis(buildTwoSpikeScan());

    setThreshold(0.05);
    expect(aboveTickCount()).toBe(2);

    setThreshold(0.95);
    expect(aboveTickCount()).toBe(1);

    expect(scanner.scan).toHaveBeenCalledTimes(1);
  });

  it('starts and resets the threshold slider at the shared default candidate threshold', () => {
    expand();
    expect(Number(thresholdInput().value)).toBe(DEFAULT_CANDIDATE_THRESHOLD);

    setThreshold(0.9);
    expect(Number(thresholdInput().value)).toBe(0.9);

    // A different tune is different music: the threshold reset is part of what clearAnalysis discards.
    tuneLoader.currentTune.set(fakeSidFile({ name: 'Another tune' }));
    fixture.detectChanges();

    expect(Number(thresholdInput().value)).toBe(DEFAULT_CANDIDATE_THRESHOLD);
  });

  it('converts a clicked candidate into a scrub percentage against positionBasisFrames', async () => {
    await completeAnalysis(buildSpikeScan());
    const hit = candidateHits()[0];
    expect(hit).toBeTruthy();

    hit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    const match = readoutValue('Selected candidate').match(/frame ([\d,]+)/);
    expect(match).not.toBeNull();
    const frame = Number((match as RegExpMatchArray)[1].replace(/,/g, ''));

    // A percentage of the basis, resolved onto the ceiling the player measures a seek against.
    const percent = (frame / POSITION_BASIS_FRAMES) * 100;
    expect(player.player.seek).toHaveBeenCalledWith(
      frames(Math.round((percent / 100) * CEILING_FRAMES))
    );
  });

  it('awaits the jump landing before adding a marker from Copy to marker', async () => {
    await completeAnalysis(buildSpikeScan());
    candidateHits()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    let resolveScrub!: () => void;
    vi.mocked(player.player.seek).mockImplementation(
      () => new Promise<void>((resolve) => (resolveScrub = resolve))
    );

    const copyButton = fixture.nativeElement.querySelector('.copy-to-marker') as HTMLButtonElement;
    expect(copyButton.disabled).toBe(false);
    copyButton.click();

    expect(markers.addMarker).not.toHaveBeenCalled();

    resolveScrub();
    await Promise.resolve();
    await Promise.resolve();

    expect(markers.addMarker).toHaveBeenCalled();
  });

  it("clears the analysis when the deck's loaded tune changes", async () => {
    await completeAnalysis(buildSpikeScan());
    expect(candidateHits().length).toBeGreaterThan(0);

    tuneLoader.currentTune.set(fakeSidFile({ name: 'Another tune' }));
    fixture.detectChanges();

    expect(candidateHits().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.analysis-empty')).not.toBeNull();
  });

  it('clears the analysis when the current subtune changes', async () => {
    await completeAnalysis(buildSpikeScan());
    expect(candidateHits().length).toBeGreaterThan(0);

    setSubtune(player, 2);
    fixture.detectChanges();

    expect(candidateHits().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.analysis-empty')).not.toBeNull();
  });

  it("retargets onto the newly selected deck's own player, tune index and loaded tune when the deck input changes", async () => {
    await completeAnalysis(buildSpikeScan());
    expect(candidateHits().length).toBeGreaterThan(0);
    setBasis(player, { ceiling: 999 }); // proves the outgoing deck's own player is no longer read

    const otherPlayer = makePlayer();
    const otherTuneIndex = makeTuneIndexService();
    const otherTuneLoader = makeTuneLoader(fakeSidFile({ name: 'Deck B tune' }));

    fixture.componentRef.setInput(
      'deck',
      fakeDeckHandle('b', 'B', otherPlayer, makeMarkers(), otherTuneIndex, otherTuneLoader)
    );
    fixture.detectChanges();

    // A different deck is a different tune loaded: the outgoing deck's analysis is cleared rather
    // than surviving the switch.
    expect(candidateHits().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.analysis-empty')).not.toBeNull();

    setBasis(otherPlayer, { ceiling: 54_321 });
    scanner.scan.mockReturnValue(new Promise<ScanResult>(() => undefined));
    (fixture.nativeElement.querySelector('.analysis-run') as HTMLButtonElement).click();

    // The scan request the new deck's own player drives, not the outgoing deck's ceiling.
    const [request] = scanner.scan.mock.calls[scanner.scan.mock.calls.length - 1];
    expect(request.maxFrames).toBe(54_321);
  });

  it('reports the key and its Camelot number, and charts the chroma it came from', async () => {
    await completeAnalysis(buildCMajorScan());

    expect(readoutValue('Key (native)')).toContain('C major');
    expect(readoutValue('Key (native)')).toContain('8B');
    expect(readoutValue('Key confidence')).toBe('strong');
    expect(fixture.nativeElement.querySelectorAll('.key-panel .chroma-bar').length).toBe(12);
  });

  it('reports a sounding key above the native key when the deck is pitched up', async () => {
    await completeAnalysis(buildCMajorScan());
    expect(readoutValue('Key (sounding)')).toContain('C major');

    setTempoMultiplier(player, 1.06);
    fixture.detectChanges();

    expect(readoutValue('Key (native)')).toContain('C major');
    expect(readoutValue('Key (sounding)')).toContain('C# major');
  });

  it('marks notes outside the detected scale in the voice lanes', async () => {
    await completeAnalysis(buildCMajorScan({ semitone: -3, frames: 12 })); // F#, outside C major

    const marked = Array.from(
      fixture.nativeElement.querySelectorAll('.out-of-scale')
    ) as SVGPathElement[];

    expect(readoutValue('Key (native)')).toContain('C major');
    expect(marked.some((path) => (path.getAttribute('d') ?? '').length > 0)).toBe(true);
  });

  it('leaves the voice lanes unmarked when every note is in the key', async () => {
    await completeAnalysis(buildCMajorScan());

    expect(fixture.nativeElement.querySelectorAll('.out-of-scale')).toHaveLength(0);
  });

  it('hides the out-of-scale overlay independently of the voice lanes it lives in', async () => {
    await completeAnalysis(buildCMajorScan({ semitone: -3, frames: 12 })); // F#, outside C major

    expect(fixture.nativeElement.querySelectorAll('.out-of-scale').length).toBeGreaterThan(0);
    const voiceBlocksBefore = fixture.nativeElement.querySelectorAll('.voice-block').length;
    expect(voiceBlocksBefore).toBeGreaterThan(0);

    const overlayToggle = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.lane-toggle')
    ).find((button) => button.textContent?.trim() === 'Out-of-scale');
    expect(overlayToggle).toBeTruthy();
    overlayToggle?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.out-of-scale')).toHaveLength(0);
    expect(fixture.nativeElement.querySelectorAll('.voice-block').length).toBe(voiceBlocksBefore);
  });

  it('bounds the rendered element count for a long tune, regardless of frame count', async () => {
    await completeAnalysis(buildConstantlyActiveScan(50_000));

    const svg = fixture.nativeElement.querySelector('.lane-stack svg') as SVGSVGElement;
    expect(svg).not.toBeNull();
    expect(svg.querySelectorAll('*').length).toBeLessThan(2000);
  });

  it('reads a structure, pulse and key row from a cached index record while no scan has run', () => {
    expand();
    setTempoMultiplier(player, 1.06);
    tuneIndex.record.set(
      fakeTuneIndexRecord({
        loopStartFrame: 500,
        loopPeriodFrames: 6250,
        dominantIntervalFrames: 24,
        nativeTempo: 120,
        tonic: 2,
        mode: 'minor',
        camelot: '5A',
      })
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.analysis-caption')).toBeNull();
    expect(fixture.nativeElement.querySelector('.lane-stack')).toBeNull();
    expect(fixture.nativeElement.querySelector('.structure-square')).toBeNull();
    expect(fixture.nativeElement.querySelector('.readout-panel')).not.toBeNull();
    // Derived from the record's frames at the player's live rate — one intro plus one lap — rather
    // than from a duration frozen into the record at scan time.
    expect(readoutValue('Length')).toBe(formatDuration(((500 + 6250) * 19_950) / 1_000_000));
    expect(readoutValue('Loop')).toContain((500).toLocaleString());
    expect(readoutValue('Loop')).toContain(formatDuration((6250 * 19_950) / 1_000_000));
    expect(readoutValue('Pulse interval')).toBe(`${(24).toLocaleString()} frames`);
    expect(readoutValue('Key (native)')).toContain('D minor');
    expect(readoutValue('Key (native)')).toContain('5A');
    expect(readoutValue('Tempo (sounding)')).toBe(`${(120 * 1.06).toFixed(1)} BPM`);
    expect(readoutValue('Key (sounding)')).toContain('D# minor');
  });

  it('follows the rate in force when reporting a cached length, rather than the one it was scanned at', () => {
    expand();
    tuneIndex.record.set(fakeTuneIndexRecord({ loopStartFrame: 0, loopPeriodFrames: 6000 }));
    fixture.detectChanges();
    const atSingleSpeed = readoutValue('Length');

    setPlayRate(player, {
      callsPerFrame: 2,
      exactCallsPerFrame: 2.4,
      roundedCallsPerFrame: 2,
      mode: 'rounded',
    });
    fixture.detectChanges();

    expect(readoutValue('Length')).toBe(formatDuration((6000 * (19_950 / 2)) / 1_000_000));
    expect(readoutValue('Length')).not.toBe(atSingleSpeed);
  });

  it('reads a cached record that ends rather than loops as an end point, not as no answer', () => {
    expand();
    tuneIndex.record.set(
      fakeTuneIndexRecord({ loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: 4000 })
    );
    fixture.detectChanges();

    expect(readoutValue('Length')).toBe(formatDuration((4000 * 19_950) / 1_000_000));
    expect(readoutValue('Loop')).toContain((4000).toLocaleString());
    expect(readoutValue('Loop')).not.toBe('not found');
  });

  it('reads a cached record that answers nothing as a declined answer, distinct from ended', () => {
    expand();
    tuneIndex.record.set(
      fakeTuneIndexRecord({ loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: null })
    );
    fixture.detectChanges();

    // Both rows report the same declined answer — one word for the same finding, not two.
    expect(readoutValue('Loop')).toBe('not found');
    expect(readoutValue('Length')).toBe('not found');
  });

  it('prefers a completed live scan over a cached index record describing the same tune', async () => {
    tuneIndex.record.set(
      fakeTuneIndexRecord({
        loopStartFrame: 0,
        loopPeriodFrames: 99_999,
        dominantIntervalFrames: 999,
        tonic: 2,
        mode: 'minor',
        camelot: '5A',
      })
    );
    await completeAnalysis(buildCMajorScan());

    expect(readoutValue('Length')).not.toBe(formatDuration((99_999 * 19_950) / 1_000_000));
    expect(readoutValue('Pulse interval')).not.toBe(`${(999).toLocaleString()} frames`);
    expect(readoutValue('Key (native)')).toContain('C major');
    expect(readoutValue('Key (native)')).not.toContain('D minor');
  });
});
