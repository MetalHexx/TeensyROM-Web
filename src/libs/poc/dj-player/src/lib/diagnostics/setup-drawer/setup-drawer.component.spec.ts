import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SetupDrawerComponent } from './setup-drawer.component';
import { DeckRegistry } from '../../deck/deck-registry';
import type { DeckHandle } from '../../deck/deck-registry';
import { MixerService } from '../../mixer/mixer.service';
import type { EngineStats, DjPlayerEngine } from '../../engine/dj-player-engine';
import type { PlayRate, TimingMode } from '../../engine/play-rate';
import type { TuneIndexService } from '../../analysis/tune-index.service';
import type { TuneIndexRecord } from '../../analysis/tune-index.model';
import { TUNE_INDEX_FORMAT_VERSION } from '../../analysis/tune-index.model';
import type { DeckTuneLoader } from '../../deck/deck-tune-loader';
import type { SidFile } from '../../sid/sid-file.model';

const EMPTY_STATS: EngineStats = {
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

const SINGLE_SPEED: PlayRate = {
  callsPerFrame: 1,
  exactCallsPerFrame: 1,
  roundedCallsPerFrame: 1,
  mode: 'exact',
};

interface StubEngine {
  nominalIntervalUs: WritableSignal<number>;
  scheduleAheadMs: WritableSignal<number>;
  stats: WritableSignal<EngineStats>;
  trackEndFrame: WritableSignal<number | null>;
  lastError: WritableSignal<string | null>;
  playRate: WritableSignal<PlayRate>;
  setNominalIntervalUs: ReturnType<typeof vi.fn>;
  setScheduleAhead: ReturnType<typeof vi.fn>;
}

interface StubTuneIndex {
  record: WritableSignal<TuneIndexRecord | null>;
  pending: WritableSignal<boolean>;
  setTimingMode: ReturnType<typeof vi.fn>;
}

interface StubTuneLoader {
  currentTune: WritableSignal<SidFile | null>;
}

function fakeEngine(): StubEngine {
  return {
    nominalIntervalUs: signal(19_950),
    scheduleAheadMs: signal(0),
    stats: signal<EngineStats>(EMPTY_STATS),
    trackEndFrame: signal<number | null>(null),
    lastError: signal<string | null>(null),
    playRate: signal<PlayRate>(SINGLE_SPEED),
    setNominalIntervalUs: vi.fn(),
    setScheduleAhead: vi.fn(),
  };
}

function fakeTuneIndex(): StubTuneIndex {
  return {
    record: signal<TuneIndexRecord | null>(null),
    pending: signal<boolean>(false),
    setTimingMode: vi.fn(),
  };
}

function fakeTuneLoader(file: SidFile | null = null): StubTuneLoader {
  return { currentTune: signal<SidFile | null>(file) };
}

function fakeRecord(overrides: Partial<TuneIndexRecord> = {}): TuneIndexRecord {
  return {
    filename: 'test.sid',
    subtune: 1,
    loopStartFrame: 0,
    loopPeriodFrames: 6700,
    endedAtFrame: null,
    sectionBoundaries: [],
    detectedMoments: [],
    tonic: 0,
    mode: 'major',
    camelot: '8B',
    tuningReferenceHz: 440,
    tuningCents: 0,
    keyConfidence: 'weak',
    scalePitchClasses: [],
    dominantIntervalFrames: null,
    pulseConfidence: 'none',
    nativeTempo: null,
    callsPerFrame: 1,
    exactCallsPerFrame: 1,
    timingMode: 'exact' as TimingMode,
    formatVersion: TUNE_INDEX_FORMAT_VERSION,
    computedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function fakeDeck(
  id: string,
  label: string,
  engine: StubEngine,
  tuneIndex: StubTuneIndex,
  tuneLoader: StubTuneLoader
): DeckHandle {
  return {
    descriptor: { id, label },
    engine: engine as unknown as DjPlayerEngine,
    binding: {} as DeckHandle['binding'],
    tuneIndex: tuneIndex as unknown as TuneIndexService,
    tuneLoader: tuneLoader as unknown as DeckTuneLoader,
  };
}

describe('SetupDrawerComponent', () => {
  let fixture: ComponentFixture<SetupDrawerComponent>;
  let registry: DeckRegistry;
  let engineA: StubEngine;
  let engineB: StubEngine;
  let tuneIndexA: StubTuneIndex;
  let tuneIndexB: StubTuneIndex;
  let tuneLoaderA: StubTuneLoader;
  let tuneLoaderB: StubTuneLoader;

  async function setup(): Promise<void> {
    registry = new DeckRegistry();
    engineA = fakeEngine();
    engineB = fakeEngine();
    tuneIndexA = fakeTuneIndex();
    tuneIndexB = fakeTuneIndex();
    tuneLoaderA = fakeTuneLoader();
    tuneLoaderB = fakeTuneLoader();

    registry.register(fakeDeck('a', 'A', engineA, tuneIndexA, tuneLoaderA));
    registry.register(fakeDeck('b', 'B', engineB, tuneIndexB, tuneLoaderB));

    await TestBed.configureTestingModule({
      imports: [SetupDrawerComponent],
      providers: [{ provide: DeckRegistry, useValue: registry }, MixerService],
    }).compileComponents();

    fixture = TestBed.createComponent(SetupDrawerComponent);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await setup();
  });

  it('carries every registered deck label as a column header, across every panel', () => {
    const headers: string[] = Array.from(
      fixture.nativeElement.querySelectorAll('th[scope="col"]')
    )
      .map((th) => (th as HTMLElement).textContent?.trim() ?? '')
      .filter((text) => text.length > 0);

    expect(headers.filter((text) => text === 'Deck A').length).toBeGreaterThan(0);
    expect(headers.filter((text) => text === 'Deck B').length).toBeGreaterThan(0);
  });

  it("renders the nominal frame interval as a per-deck select, writing only to that deck's engine", () => {
    const selectA = fixture.nativeElement.querySelector(
      '[aria-label="Nominal frame interval deck A"]'
    ) as HTMLSelectElement;
    expect(selectA.tagName).toBe('SELECT');

    selectA.value = '19975';
    selectA.dispatchEvent(new Event('change'));

    expect(engineA.setNominalIntervalUs).toHaveBeenCalledWith(19975);
    expect(engineB.setNominalIntervalUs).not.toHaveBeenCalled();
  });

  it("renders Schedule ahead as a per-deck select, writing only to that deck's engine", () => {
    const selectB = fixture.nativeElement.querySelector(
      '[aria-label="Schedule ahead deck B"]'
    ) as HTMLSelectElement;
    expect(selectB.tagName).toBe('SELECT');

    selectB.value = '40';
    selectB.dispatchEvent(new Event('change'));

    expect(engineB.setScheduleAhead).toHaveBeenCalledWith(40);
    expect(engineA.setScheduleAhead).not.toHaveBeenCalled();
  });

  it("renders the Tune Index Timing toggle as a per-deck select, writing only to that deck's tune index", () => {
    tuneIndexA.record.set(fakeRecord({ timingMode: 'exact' }));
    tuneIndexB.record.set(fakeRecord({ timingMode: 'exact' }));
    fixture.detectChanges();

    const selectA = fixture.nativeElement.querySelector(
      '[aria-label="Timing mode deck A"]'
    ) as HTMLSelectElement;
    expect(selectA.tagName).toBe('SELECT');
    expect(selectA.disabled).toBe(false);

    selectA.value = 'rounded';
    selectA.dispatchEvent(new Event('change'));

    expect(tuneIndexA.setTimingMode).toHaveBeenCalledWith('rounded');
    expect(tuneIndexB.setTimingMode).not.toHaveBeenCalled();
  });

  it('disables the Timing toggle for a deck with no indexed record yet', () => {
    const selectA = fixture.nativeElement.querySelector(
      '[aria-label="Timing mode deck A"]'
    ) as HTMLSelectElement;

    expect(selectA.disabled).toBe(true);
  });

  it('reads the cross-deck drift figure over the two registered decks', () => {
    engineA.stats.set({ ...EMPTY_STATS, driftMs: 12.4 });
    engineB.stats.set({ ...EMPTY_STATS, driftMs: 4.0 });
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('.cross-deck-drift') as HTMLElement;
    expect(label.textContent?.trim()).toBe('A−B: +8.4 ms');
  });

  it('reads the cross-deck drift figure as an em dash before a second deck exists', async () => {
    const singleDeckRegistry = new DeckRegistry();
    singleDeckRegistry.register(fakeDeck('a', 'A', fakeEngine(), fakeTuneIndex(), fakeTuneLoader()));

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [SetupDrawerComponent],
        providers: [{ provide: DeckRegistry, useValue: singleDeckRegistry }, MixerService],
      })
      .compileComponents();

    const singleDeckFixture = TestBed.createComponent(SetupDrawerComponent);
    singleDeckFixture.detectChanges();

    const label = singleDeckFixture.nativeElement.querySelector('.cross-deck-drift') as HTMLElement;
    expect(label.textContent?.trim()).toBe('—');
  });

  it('switches the Key knob display format via a single page-level select', () => {
    const mixer = fixture.debugElement.injector.get(MixerService);
    const select = fixture.nativeElement.querySelector(
      '[aria-label="Key display format"]'
    ) as HTMLSelectElement;

    expect(select.tagName).toBe('SELECT');
    expect(select.value).toBe('camelot');

    select.value = 'note';
    select.dispatchEvent(new Event('change'));

    expect(mixer.keyDisplayFormat()).toBe('note');
  });

  it('keeps the stall control singular, with its own editable duration field and button', () => {
    const inputs = fixture.nativeElement.querySelectorAll(
      'input[aria-label="Stall duration in milliseconds"]'
    );
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ).filter((button) => button.textContent?.trim() === 'Stall');

    expect(inputs.length).toBe(1);
    expect(buttons.length).toBe(1);
  });

  it('updates the configured stall duration from its own input', () => {
    const input = fixture.nativeElement.querySelector(
      'input[aria-label="Stall duration in milliseconds"]'
    ) as HTMLInputElement;

    input.value = '300';
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(input.value).toBe('300');
  });

  it('blocks the main thread synchronously for at least the configured duration', () => {
    const input = fixture.nativeElement.querySelector(
      'input[aria-label="Stall duration in milliseconds"]'
    ) as HTMLInputElement;
    input.value = '20'; // short, to keep the test itself fast
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const button = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>('button')
    ).find((candidate) => candidate.textContent?.trim() === 'Stall') as HTMLButtonElement;

    const before = performance.now();
    button.click();
    const elapsed = performance.now() - before;

    expect(elapsed).toBeGreaterThanOrEqual(20);
  });

  it('caps the stall at its own ceiling, however large the typed value', () => {
    const input = fixture.nativeElement.querySelector(
      'input[aria-label="Stall duration in milliseconds"]'
    ) as HTMLInputElement;
    const ceilingMs = Number(input.max);
    input.value = String(ceilingMs * 30); // the mistyped-value case the ceiling exists for
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const button = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>('button')
    ).find((candidate) => candidate.textContent?.trim() === 'Stall') as HTMLButtonElement;

    const startMs = 1_000_000;
    let nowMs = startMs;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => nowMs++);
    try {
      button.click();
    } finally {
      clock.mockRestore();
    }
    const elapsed = nowMs - 1 - startMs;

    expect(elapsed).toBeGreaterThanOrEqual(ceilingMs);
    expect(elapsed).toBeLessThan(ceilingMs * 2);
  });
});
