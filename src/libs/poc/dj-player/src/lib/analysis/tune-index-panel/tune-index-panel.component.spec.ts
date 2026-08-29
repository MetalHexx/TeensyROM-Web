import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TuneIndexPanelComponent } from './tune-index-panel.component';
import { DjPlayerEngine } from '../../engine/dj-player-engine';
import { TuneIndexService } from '../tune-index.service';
import type { TuneIndexRecord } from '../tune-index.model';

interface StubTuneIndexService {
  record: WritableSignal<TuneIndexRecord | null>;
  pending: WritableSignal<boolean>;
}

interface StubEngine {
  tuneLoopFrame: WritableSignal<number | null>;
  tuneLoopArmed: WritableSignal<boolean>;
  armTuneLoop: ReturnType<typeof vi.fn>;
}

function makeTuneIndexService(): StubTuneIndexService {
  return {
    record: signal<TuneIndexRecord | null>(null),
    pending: signal<boolean>(false),
  };
}

function makeEngine(): StubEngine {
  return {
    tuneLoopFrame: signal<number | null>(null),
    tuneLoopArmed: signal<boolean>(false),
    armTuneLoop: vi.fn(),
  };
}

function fakeRecord(overrides: Partial<TuneIndexRecord> = {}): TuneIndexRecord {
  return {
    filename: 'test.sid',
    subtune: 1,
    nativeLengthSeconds: 134,
    loopFrame: 6700,
    structureConfidence: 'strong',
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
    formatVersion: 1,
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

  it('shows the formatted length, key and confidences once a known record lands', () => {
    tuneIndexService.record.set(fakeRecord());
    fixture.detectChanges();

    expect(component['lengthLabel']()).toBe('2:14');
    expect(component['keyLabel']()).toBe('C major · 8B');
    expect(component['loopConfidenceLabel']()).toBe('strong');
    expect(component['keyConfidenceLabel']()).toBe('weak');
  });

  it('reads a declined answer as "not found" / "no clear key", not an error or a spinner', () => {
    tuneIndexService.record.set(
      fakeRecord({
        nativeLengthSeconds: null,
        tonic: null,
        mode: null,
        camelot: null,
        structureConfidence: 'none',
        keyConfidence: 'none',
      })
    );
    fixture.detectChanges();

    expect(component['lengthLabel']()).toBe('not found');
    expect(component['keyLabel']()).toBe('no clear key');
    expect(component['loopConfidenceLabel']()).toBe('none');
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

  it('disables the loop toggle with no detected loop point, and enables it once one exists', () => {
    expect(component['canLoop']()).toBe(false);

    engine.tuneLoopFrame.set(6700);
    fixture.detectChanges();

    expect(component['canLoop']()).toBe(true);
  });

  it('re-arms the loop through the engine when the toggle is switched on', () => {
    const input = { checked: true } as unknown as HTMLInputElement;

    component['onLoopToggle']({ target: input } as unknown as Event);

    expect(engine.armTuneLoop).toHaveBeenCalledWith(true);
  });
});
