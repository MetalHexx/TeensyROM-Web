import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { DeckStripComponent } from './deck-strip.component';
import { MixerService } from '../mixer.service';
import { DeckRegistry } from '../../deck/deck-registry';
import type { DeckHandle } from '../../deck/deck-registry';
import type { TuneIndexService } from '../../analysis/tune-index.service';
import type { TuneIndexRecord } from '../../analysis/tune-index.model';
import { TUNE_INDEX_FORMAT_VERSION } from '../../analysis/tune-index.model';
import { DECKS } from '../../deck/deck.config';

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

describe('DeckStripComponent', () => {
  let fixture: ComponentFixture<DeckStripComponent>;
  let mixer: MixerService;
  let registry: DeckRegistry;
  let deckARecord: WritableSignal<TuneIndexRecord | null>;

  beforeEach(async () => {
    registry = new DeckRegistry();
    deckARecord = signal<TuneIndexRecord | null>(null);
    registry.register({
      descriptor: DECKS[0],
      engine: {} as DeckHandle['engine'],
      binding: {} as DeckHandle['binding'],
      tuneIndex: { record: deckARecord } as unknown as TuneIndexService,
      tuneLoader: {} as DeckHandle['tuneLoader'],
    });

    await TestBed.configureTestingModule({
      imports: [DeckStripComponent],
      providers: [MixerService, { provide: DeckRegistry, useValue: registry }],
    }).compileComponents();

    fixture = TestBed.createComponent(DeckStripComponent);
    fixture.componentRef.setInput('deck', DECKS[0]);
    mixer = fixture.debugElement.injector.get(MixerService);
    fixture.detectChanges();
  });

  function knobInput(name: string): HTMLInputElement {
    const input = fixture.nativeElement.querySelector(
      `input[aria-label="${name} deck ${DECKS[0].label}"]`
    );
    if (!input) throw new Error(`no knob named ${name}`);
    return input;
  }

  function readoutFor(name: string): string | null {
    const knobHost = knobInput(name).closest('lib-scale-knob');
    return knobHost?.querySelector('.scale-knob-readout')?.textContent?.trim() ?? null;
  }

  it('renders the filter mode selector, all four knobs and the channel fader, each named for the deck', () => {
    expect(fixture.nativeElement.querySelector('lib-filter-mode-selector')).not.toBeNull();
    expect(knobInput('Cutoff')).not.toBeNull();
    expect(knobInput('Resonance')).not.toBeNull();
    expect(knobInput('Pulse Width')).not.toBeNull();
    expect(knobInput('Key')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector(`input[aria-label="Channel fader deck ${DECKS[0].label}"]`)
    ).not.toBeNull();
  });

  it('writes cutoff for its own deck, holding no local copy', () => {
    knobInput('Cutoff').value = '0.3';
    knobInput('Cutoff').dispatchEvent(new Event('input'));

    expect(mixer.scalePosition(DECKS[0].id, 'cutoff')()).toBe(0.3);
    expect(mixer.scalePosition(DECKS[1].id, 'cutoff')()).toBe(0);

    mixer.setScalePosition(DECKS[0].id, 'cutoff', -0.6);
    fixture.detectChanges();
    expect(knobInput('Cutoff').value).toBe('-0.6');
  });

  it('writes resonance for its own deck', () => {
    knobInput('Resonance').value = '0.5';
    knobInput('Resonance').dispatchEvent(new Event('input'));

    expect(mixer.scalePosition(DECKS[0].id, 'resonance')()).toBe(0.5);
    expect(mixer.scalePosition(DECKS[1].id, 'resonance')()).toBe(0);
  });

  it('writes pulse width for its own deck', () => {
    knobInput('Pulse Width').value = '-0.2';
    knobInput('Pulse Width').dispatchEvent(new Event('input'));

    expect(mixer.scalePosition(DECKS[0].id, 'pulseWidth')()).toBe(-0.2);
    expect(mixer.scalePosition(DECKS[1].id, 'pulseWidth')()).toBe(0);
  });

  it('steps Key in whole semitones between ±12', () => {
    const key = knobInput('Key');
    expect(key.step).toBe('1');
    expect(key.min).toBe('-12');
    expect(key.max).toBe('12');

    key.value = '5';
    key.dispatchEvent(new Event('input'));
    expect(mixer.keySemitones(DECKS[0].id)()).toBe(5);
  });

  it('clamps Key to ±12 in the model, reflected by the knob', () => {
    mixer.setKeySemitones(DECKS[0].id, 20);
    fixture.detectChanges();

    expect(mixer.keySemitones(DECKS[0].id)()).toBe(12);
    expect(knobInput('Key').value).toBe('12');
  });

  it("shows Key's signed offset, and only Key carries a readout", () => {
    mixer.setKeySemitones(DECKS[0].id, 3);
    fixture.detectChanges();
    expect(readoutFor('Key')).toBe('+3');

    mixer.setKeySemitones(DECKS[0].id, 0);
    fixture.detectChanges();
    expect(readoutFor('Key')).toBe('0');

    mixer.setKeySemitones(DECKS[0].id, -5);
    fixture.detectChanges();
    expect(readoutFor('Key')).toBe('-5');

    expect(fixture.nativeElement.querySelectorAll('.scale-knob-readout')).toHaveLength(1);
  });

  it("shows the tune's detected key at home, in the operator's chosen format", () => {
    deckARecord.set(fakeRecord({ tonic: 1, mode: 'minor', camelot: '8B' }));
    fixture.detectChanges();

    expect(readoutFor('Key')).toBe('8B');

    mixer.setKeyDisplayFormat('note');
    fixture.detectChanges();

    expect(readoutFor('Key')).toBe('C#m');
  });

  it('falls back to "0" at home when the deck has no confident key detection', () => {
    deckARecord.set(fakeRecord({ tonic: null, mode: null, camelot: null }));
    fixture.detectChanges();

    expect(readoutFor('Key')).toBe('0');
  });

  it('shows the detected key transposed by the knob once off home, not the raw semitone count', () => {
    deckARecord.set(fakeRecord({ tonic: 1, mode: 'minor', camelot: '8B' }));
    mixer.setKeySemitones(DECKS[0].id, 3);
    fixture.detectChanges();

    // C# minor (tonic 1) + 3 semitones = E minor, 9A on the wheel — so two decks can be dialed to
    // the same Camelot code and read as harmonically matched, the whole point of the knob.
    expect(readoutFor('Key')).toBe('9A');

    mixer.setKeyDisplayFormat('note');
    fixture.detectChanges();

    expect(readoutFor('Key')).toBe('Em');
  });

  it("does not move the other deck's channel fader", () => {
    const fader = fixture.nativeElement.querySelector(
      `input[aria-label="Channel fader deck ${DECKS[0].label}"]`
    ) as HTMLInputElement;
    fader.value = '0.4';
    fader.dispatchEvent(new Event('input'));

    expect(mixer.deckFader(DECKS[0].id)()).toBe(0.4);
    expect(mixer.deckFader(DECKS[1].id)()).toBe(1);
  });
});
