import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrackAnalysisPanelComponent } from './track-analysis-panel.component';
import { DjPlayerEngine, EngineStats } from '../../engine/dj-player-engine';
import { ANALYSIS_SCANNER } from '../scan-runner';
import type { AnalysisScanner, ScanResult } from '../scan-runner';
import type { ScanOutput } from '../scan-tune';
import { PRIMARY_SLOT_FOR_REGISTER } from '../../asid/register-frame';
import { ASID_SLOT_COUNT } from '../../asid/asid-constants';
import type { SidFile } from '../../sid/sid-file.model';

const BASE_STATS: EngineStats = {
  framesRendered: 0,
  packetsSent: 0,
  bytesSent: 0,
  suppressedWrites: 0,
  illegalOpcodeCount: 0,
  callsPerFrame: 1,
  effectiveIntervalUs: 0,
  measuredMeanIntervalUs: 0,
  driftMs: 0,
  jitterMs: 0,
  worstGapMs: 0,
  lateCallbacks: 0,
  scheduledFrames: 0,
  lateFrames: 0,
  meanLagMs: 0,
  worstLagMs: 0,
  reorderedFrames: 0,
  clampedFrames: 0,
  cancelSupported: false,
  lastCancelLatencyMs: -1,
};

interface StubEngine {
  currentSubtune: WritableSignal<number>;
  ceilingFrames: WritableSignal<number>;
  stats: WritableSignal<EngineStats>;
  nominalIntervalUs: WritableSignal<number>;
  scrubTo: ReturnType<typeof vi.fn>;
  addMarker: ReturnType<typeof vi.fn>;
}

interface StubScanner {
  scan: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}

function makeEngine(): StubEngine {
  return {
    currentSubtune: signal(1),
    ceilingFrames: signal(10_000),
    stats: signal<EngineStats>(BASE_STATS),
    nominalIntervalUs: signal(19_950),
    scrubTo: vi.fn().mockResolvedValue(undefined),
    addMarker: vi.fn(() => 0),
  };
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
    slotValues: new Uint8Array(frames * ASID_SLOT_COUNT),
    writeCounts: new Uint8Array(frames),
    frames,
    callsPerFrame: 1,
  };
}

function setRegister(scan: ScanOutput, frame: number, register: number, value: number): void {
  const slot = PRIMARY_SLOT_FOR_REGISTER[register];
  scan.slotValues[frame * ASID_SLOT_COUNT + slot] = value;
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
  let engine: StubEngine;
  let scanner: StubScanner;

  async function setup(file: SidFile | null = fakeSidFile()): Promise<void> {
    engine = makeEngine();
    scanner = makeScanner();

    await TestBed.configureTestingModule({
      imports: [TrackAnalysisPanelComponent],
    })
      .overrideComponent(TrackAnalysisPanelComponent, {
        set: {
          providers: [
            { provide: ANALYSIS_SCANNER, useValue: scanner as unknown as AnalysisScanner },
            { provide: DjPlayerEngine, useValue: engine as unknown as DjPlayerEngine },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TrackAnalysisPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('file', file);
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
    engine.currentSubtune.set(2);
    engine.ceilingFrames.set(12_345);
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

  it('converts a clicked candidate into a scrub percentage against ceilingFrames', async () => {
    await completeAnalysis(buildSpikeScan());
    const hit = candidateHits()[0];
    expect(hit).toBeTruthy();

    hit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    const match = readoutValue('Selected candidate').match(/frame ([\d,]+)/);
    expect(match).not.toBeNull();
    const frame = Number((match as RegExpMatchArray)[1].replace(/,/g, ''));

    expect(engine.scrubTo).toHaveBeenCalledWith((frame / engine.ceilingFrames()) * 100);
  });

  it('awaits the jump landing before adding a marker from Copy to marker', async () => {
    await completeAnalysis(buildSpikeScan());
    candidateHits()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    let resolveScrub!: () => void;
    engine.scrubTo.mockImplementation(
      () => new Promise<void>((resolve) => (resolveScrub = resolve))
    );

    const copyButton = fixture.nativeElement.querySelector('.copy-to-marker') as HTMLButtonElement;
    expect(copyButton.disabled).toBe(false);
    copyButton.click();

    expect(engine.addMarker).not.toHaveBeenCalled();

    resolveScrub();
    await Promise.resolve();
    await Promise.resolve();

    expect(engine.addMarker).toHaveBeenCalled();
  });

  it('clears the analysis when the file input changes', async () => {
    await completeAnalysis(buildSpikeScan());
    expect(candidateHits().length).toBeGreaterThan(0);

    fixture.componentRef.setInput('file', fakeSidFile({ name: 'Another tune' }));
    fixture.detectChanges();

    expect(candidateHits().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.analysis-empty')).not.toBeNull();
  });

  it('clears the analysis when the current subtune changes', async () => {
    await completeAnalysis(buildSpikeScan());
    expect(candidateHits().length).toBeGreaterThan(0);

    engine.currentSubtune.set(2);
    fixture.detectChanges();

    expect(candidateHits().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.analysis-empty')).not.toBeNull();
  });

  it('bounds the rendered element count for a long tune, regardless of frame count', async () => {
    await completeAnalysis(buildConstantlyActiveScan(50_000));

    const svg = fixture.nativeElement.querySelector('.lane-stack svg') as SVGSVGElement;
    expect(svg).not.toBeNull();
    expect(svg.querySelectorAll('*').length).toBeLessThan(2000);
  });
});
