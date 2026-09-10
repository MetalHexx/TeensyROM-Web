import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { MixerColumnComponent } from './mixer-column.component';
import { MixerService } from '../mixer.service';
import { DeckRegistry } from '../../deck/deck-registry';
import { DECKS } from '../../deck/deck.config';
import type { TuneIndexService } from '../../analysis/tune-index.service';
import type { TuneIndexRecord } from '../../analysis/tune-index.model';
import { TUNE_INDEX_FORMAT_VERSION } from '../../analysis/tune-index.model';
import { fakeDeckHandle } from '../../../testing/player-doubles';

function fakeRecord(overrides: Partial<TuneIndexRecord> = {}): TuneIndexRecord {
  return {
    filename: 'test.sid',
    subtune: 1,
    loopStartFrame: null,
    loopPeriodFrames: null,
    endedAtFrame: null,
    sectionBoundaries: [],
    detectedMoments: [],
    tonic: 1,
    mode: 'minor',
    camelot: '8B',
    tuningReferenceHz: 440,
    tuningCents: 0,
    keyConfidence: 'strong',
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

describe('MixerColumnComponent', () => {
  let fixture: ComponentFixture<MixerColumnComponent>;
  let mixer: MixerService;
  let registry: DeckRegistry;

  beforeEach(async () => {
    registry = new DeckRegistry();

    await TestBed.configureTestingModule({
      imports: [MixerColumnComponent],
      providers: [
        { provide: MixerService, useFactory: () => new MixerService(DECKS) },
        { provide: DeckRegistry, useValue: registry },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MixerColumnComponent);
    mixer = fixture.debugElement.injector.get(MixerService);
    fixture.detectChanges();
  });

  function knobInput(name: string, deckLabel: string): HTMLInputElement {
    const input = fixture.nativeElement.querySelector(
      `input[aria-label="${name} deck ${deckLabel}"]`
    );
    if (!input) throw new Error(`no knob named ${name} deck ${deckLabel}`);
    return input;
  }

  function readoutFor(name: string, deckLabel: string): string | null {
    const knobHost = knobInput(name, deckLabel).closest('lib-rotary-knob');
    return knobHost?.querySelector('.scale-knob-readout')?.textContent?.trim() ?? null;
  }

  function faderInput(deckLabel: string): HTMLInputElement {
    return fixture.nativeElement.querySelector(
      `input[aria-label="Channel fader deck ${deckLabel}"]`
    ) as HTMLInputElement;
  }

  function filterButton(name: string, deckLabel: string): HTMLButtonElement {
    const button = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (candidate) =>
        (candidate as HTMLButtonElement).getAttribute('aria-label') ===
        `Filter mode ${name} deck ${deckLabel}`
    ) as HTMLButtonElement | undefined;
    if (!button) throw new Error(`no filter button ${name} deck ${deckLabel}`);
    return button;
  }

  it('renders one deck strip per DECKS entry plus the crossfader, nothing else', () => {
    const root = fixture.nativeElement as HTMLElement;
    const container = root.querySelector('.mixer-column') as HTMLElement;

    expect(container.children).toHaveLength(2);
    expect(root.querySelectorAll('lib-deck-strip')).toHaveLength(DECKS.length);
    expect(root.querySelectorAll('lib-crossfader')).toHaveLength(1);
  });

  it('carries no dropdown selector anywhere in the column', () => {
    expect((fixture.nativeElement as HTMLElement).querySelector('select')).toBeNull();
  });

  it('falls back to the signed semitone string when the deck has no registered handle', () => {
    expect(readoutFor('Key', DECKS[0].label)).toBe('0');

    mixer.setKeySemitones(DECKS[0].id, 3);
    fixture.detectChanges();

    expect(readoutFor('Key', DECKS[0].label)).toBe('+3');
  });

  it('falls back to the signed semitone string when the registered handle has no confident detection', () => {
    const record = signal<TuneIndexRecord | null>(
      fakeRecord({ tonic: null, mode: null, camelot: null })
    );
    registry.register(
      fakeDeckHandle(DECKS[0], { tuneIndex: { record } as unknown as TuneIndexService })
    );
    fixture.detectChanges();

    expect(readoutFor('Key', DECKS[0].label)).toBe('0');
  });

  it("renders the tune's detected key, transposed by the knob, once confidently detected", () => {
    const record = signal<TuneIndexRecord | null>(
      fakeRecord({ tonic: 1, mode: 'minor', camelot: '8B' })
    );
    registry.register(
      fakeDeckHandle(DECKS[0], { tuneIndex: { record } as unknown as TuneIndexService })
    );
    fixture.detectChanges();

    expect(readoutFor('Key', DECKS[0].label)).toBe('8B');

    mixer.setKeySemitones(DECKS[0].id, 3);
    fixture.detectChanges();

    // C# minor (tonic 1) + 3 semitones = E minor, 9A on the wheel.
    expect(readoutFor('Key', DECKS[0].label)).toBe('9A');
  });

  it('writes cutoff for the deck whose knob moved, leaving the other deck untouched', () => {
    const cutoff = knobInput('Cutoff', DECKS[0].label);
    cutoff.value = '0.3';
    cutoff.dispatchEvent(new Event('input'));

    expect(mixer.scalePosition(DECKS[0].id, 'cutoff')()).toBe(0.3);
    expect(mixer.scalePosition(DECKS[1].id, 'cutoff')()).toBe(0);
  });

  it('writes key semitones (not a scale position) for the deck whose Key knob moved', () => {
    const key = knobInput('Key', DECKS[0].label);
    key.value = '5';
    key.dispatchEvent(new Event('input'));

    expect(mixer.keySemitones(DECKS[0].id)()).toBe(5);
  });

  it("writes the deck's own channel fader, leaving the other deck untouched", () => {
    const fader = faderInput(DECKS[0].label);
    fader.value = '0.4';
    fader.dispatchEvent(new Event('input'));

    expect(mixer.deckFader(DECKS[0].id)()).toBe(0.4);
    expect(mixer.deckFader(DECKS[1].id)()).toBe(1);
  });

  it("engages, then on a second click deselects, the deck's own filter mode", () => {
    filterButton('band-pass', DECKS[0].label).click();
    fixture.detectChanges();
    expect(mixer.filterMode(DECKS[0].id)()).toBe('bandPass');

    filterButton('band-pass', DECKS[0].label).click();
    fixture.detectChanges();
    expect(mixer.filterMode(DECKS[0].id)()).toBeNull();
  });

  it('binds and writes the crossfader position, labeled from the first two DECKS entries', () => {
    const crossfader = fixture.nativeElement.querySelector('lib-crossfader input') as HTMLInputElement;
    expect(crossfader.getAttribute('aria-label')).toBe(
      `Crossfader, deck ${DECKS[0].label} to deck ${DECKS[1].label}`
    );
    expect(crossfader.value).toBe('0');

    crossfader.value = '0.6';
    crossfader.dispatchEvent(new Event('input'));
    expect(mixer.crossfaderPosition()).toBe(0.6);

    mixer.setCrossfaderPosition(-0.4);
    fixture.detectChanges();
    expect(crossfader.value).toBe('-0.4');
  });
});
