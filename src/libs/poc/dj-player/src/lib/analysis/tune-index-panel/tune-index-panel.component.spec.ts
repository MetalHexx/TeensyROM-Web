import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TuneIndexPanelComponent } from './tune-index-panel.component';
import { DjPlayerEngine } from '../../engine/dj-player-engine';
import type { PlayRate } from '../../engine/play-rate';
import { TuneIndexService } from '../tune-index.service';
import { TUNE_INDEX_FORMAT_VERSION } from '../tune-index.model';
import type { TuneIndexRecord } from '../tune-index.model';

interface StubTuneIndexService {
  record: WritableSignal<TuneIndexRecord | null>;
  pending: WritableSignal<boolean>;
}

interface StubEngine {
  tuneLoopOutFrame: WritableSignal<number | null>;
  tuneLoopArmed: WritableSignal<boolean>;
  nominalIntervalUs: WritableSignal<number>;
  playRate: WritableSignal<PlayRate>;
  armTuneLoop: ReturnType<typeof vi.fn>;
}

/** One play call per 20 ms, so a frame count converts to seconds by a round factor of 50. */
const SINGLE_SPEED: PlayRate = {
  callsPerFrame: 1,
  exactCallsPerFrame: 1,
  roundedCallsPerFrame: 1,
  mode: 'exact',
};

function makeTuneIndexService(): StubTuneIndexService {
  return {
    record: signal<TuneIndexRecord | null>(null),
    pending: signal<boolean>(false),
  };
}

function makeEngine(): StubEngine {
  return {
    tuneLoopOutFrame: signal<number | null>(null),
    tuneLoopArmed: signal<boolean>(false),
    nominalIntervalUs: signal<number>(20_000),
    playRate: signal<PlayRate>(SINGLE_SPEED),
    armTuneLoop: vi.fn(),
  };
}

function fakeRecord(overrides: Partial<TuneIndexRecord> = {}): TuneIndexRecord {
  return {
    filename: 'test.sid',
    subtune: 1,
    loopStartFrame: 0,
    loopPeriodFrames: 6700,
    endedAtFrame: null,
    sectionBoundaries: [],
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
    timingMode: 'exact',
    formatVersion: TUNE_INDEX_FORMAT_VERSION,
    computedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('TuneIndexPanelComponent', () => {
  let fixture: ComponentFixture<TuneIndexPanelComponent>;
  let component: TuneIndexPanelComponent;
  let tuneIndexService: StubTuneIndexService;
  let engine: StubEngine;

  async function setup(): Promise<void> {
    tuneIndexService = makeTuneIndexService();
    engine = makeEngine();

    await TestBed.configureTestingModule({
      imports: [TuneIndexPanelComponent],
      providers: [
        { provide: TuneIndexService, useValue: tuneIndexService as unknown as TuneIndexService },
        { provide: DjPlayerEngine, useValue: engine as unknown as DjPlayerEngine },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TuneIndexPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await setup();
  });

  it('reads as working while a scan is pending, distinct from a declined answer', () => {
    tuneIndexService.pending.set(true);
    fixture.detectChanges();

    // Working must never be mistaken for the completed "no answer" outcome, nor render a stale
    // formatted value left over from before the scan started.
    expect(component['lengthLabel']()).not.toBe('not found');
    expect(component['lengthLabel']()).not.toMatch(/^\d+:\d{2}$/);
    expect(component['keyLabel']()).not.toBe('no clear key');
  });

  it('shows the length, the loop start and period, and the key once a known record lands', () => {
    tuneIndexService.record.set(fakeRecord());
    fixture.detectChanges();

    expect(component['lengthLabel']()).toBe('2:14');
    expect(component['loopStartLabel']()).toBe('0');
    expect(component['loopPeriodLabel']()).toBe('2:14');
    expect(component['keyLabel']()).toBe('C major · 8B');
    expect(component['keyConfidenceLabel']()).toBe('weak');
  });

  it('counts the intro into the length for a tune that only repeats after one', () => {
    tuneIndexService.record.set(fakeRecord({ loopStartFrame: 1500, loopPeriodFrames: 6000 }));
    fixture.detectChanges();

    // One intro plus one lap — 7500 frames at 50 per second.
    expect(component['lengthLabel']()).toBe('2:30');
    expect(component['loopStartLabel']()).toBe((1500).toLocaleString());
    expect(component['loopPeriodLabel']()).toBe('2:00');
  });

  it('derives the length from the rate in force, so the Timing selector moves it', () => {
    tuneIndexService.record.set(fakeRecord({ loopPeriodFrames: 6000 }));
    fixture.detectChanges();
    expect(component['lengthLabel']()).toBe('2:00');

    engine.playRate.set({
      callsPerFrame: 2,
      exactCallsPerFrame: 2.4,
      roundedCallsPerFrame: 2,
      mode: 'rounded',
    });
    fixture.detectChanges();
    expect(component['lengthLabel']()).toBe('1:00');

    engine.playRate.set({
      callsPerFrame: 2.4,
      exactCallsPerFrame: 2.4,
      roundedCallsPerFrame: 2,
      mode: 'exact',
    });
    fixture.detectChanges();
    expect(component['lengthLabel']()).toBe('0:50');
  });

  it('reads a tune that stops as ending rather than as a declined answer', () => {
    tuneIndexService.record.set(
      fakeRecord({ loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: 6700 })
    );
    fixture.detectChanges();

    expect(component['lengthLabel']()).toBe('2:14');
    expect(component['loopStartLabel']()).not.toBe('not found');
    expect(component['loopPeriodLabel']()).toBe(component['loopStartLabel']());
  });

  it('reads a declined answer as "not found" / "no clear key", not an error or a spinner', () => {
    tuneIndexService.record.set(
      fakeRecord({
        loopStartFrame: null,
        loopPeriodFrames: null,
        endedAtFrame: null,
        tonic: null,
        mode: null,
        camelot: null,
        keyConfidence: 'none',
      })
    );
    fixture.detectChanges();

    expect(component['lengthLabel']()).toBe('not found');
    expect(component['loopStartLabel']()).toBe('not found');
    expect(component['loopPeriodLabel']()).toBe('not found');
    expect(component['keyLabel']()).toBe('no clear key');
    expect(component['keyConfidenceLabel']()).toBe('none');
  });

  it('switches from working to the known answer in place once the record lands, with no reload', () => {
    tuneIndexService.pending.set(true);
    fixture.detectChanges();
    expect(component['lengthLabel']()).not.toBe('2:14');

    tuneIndexService.pending.set(false);
    tuneIndexService.record.set(fakeRecord());
    fixture.detectChanges();

    expect(component['lengthLabel']()).toBe('2:14');
  });

  it('disables the loop toggle with no armable loop, and enables it once one exists', () => {
    expect(component['canLoop']()).toBe(false);

    engine.tuneLoopOutFrame.set(6700);
    fixture.detectChanges();

    expect(component['canLoop']()).toBe(true);
  });

  it('re-arms the loop through the engine when the toggle is switched on', () => {
    const input = { checked: true } as unknown as HTMLInputElement;

    component['onLoopToggle']({ target: input } as unknown as Event);

    expect(engine.armTuneLoop).toHaveBeenCalledWith(true);
  });
});
