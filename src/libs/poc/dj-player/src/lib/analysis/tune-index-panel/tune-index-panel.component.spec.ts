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
  setTimingMode: ReturnType<typeof vi.fn>;
}

interface StubEngine {
  nominalIntervalUs: WritableSignal<number>;
  playRate: WritableSignal<PlayRate>;
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
    setTimingMode: vi.fn(),
  };
}

function makeEngine(): StubEngine {
  return {
    nominalIntervalUs: signal<number>(20_000),
    playRate: signal<PlayRate>(SINGLE_SPEED),
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

  it('renders no repeat control — it is a transport concern now, not the tune index panel\'s', () => {
    expect(fixture.nativeElement.querySelector('[aria-label="Repeat track"]')).toBeNull();
  });

  it('flags a verified loop whose period is under fifteen seconds as implausible', () => {
    // 500 frames at 50 per second is 10 seconds — under the bar.
    tuneIndexService.record.set(fakeRecord({ loopStartFrame: 0, loopPeriodFrames: 500 }));
    fixture.detectChanges();

    expect(component['loopImplausible']()).toBe(true);
  });

  it('does not flag a verified loop whose period is at or above fifteen seconds', () => {
    // 800 frames at 50 per second is 16 seconds — above the bar.
    tuneIndexService.record.set(fakeRecord({ loopStartFrame: 0, loopPeriodFrames: 800 }));
    fixture.detectChanges();

    expect(component['loopImplausible']()).toBe(false);
  });

  it('flags neither a null record nor a tune that only ends', () => {
    expect(component['loopImplausible']()).toBe(false);

    tuneIndexService.record.set(
      fakeRecord({ loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: 100 })
    );
    fixture.detectChanges();

    expect(component['loopImplausible']()).toBe(false);
  });

  it('has no timing mode to reflect while no record is indexed', () => {
    expect(component['timingMode']()).toBeNull();
  });

  it('disables the timing select with no record, and enables it once one lands', () => {
    const timingSelect = () =>
      fixture.nativeElement.querySelector('[aria-label="Timing mode"]') as HTMLSelectElement;

    expect(timingSelect().disabled).toBe(true);

    tuneIndexService.record.set(fakeRecord({ timingMode: 'exact' }));
    fixture.detectChanges();

    expect(timingSelect().disabled).toBe(false);
  });

  it("reflects the record's persisted timing mode", () => {
    tuneIndexService.record.set(fakeRecord({ timingMode: 'rounded' }));
    fixture.detectChanges();

    expect(component['timingMode']()).toBe('rounded');
  });

  it('sends the selected timing mode to the service on change', () => {
    tuneIndexService.record.set(fakeRecord({ timingMode: 'exact' }));
    fixture.detectChanges();
    const select = { value: 'rounded' } as unknown as HTMLSelectElement;

    component['onTimingModeChange']({ target: select } as unknown as Event);

    expect(tuneIndexService.setTimingMode).toHaveBeenCalledWith('rounded');
  });
});
