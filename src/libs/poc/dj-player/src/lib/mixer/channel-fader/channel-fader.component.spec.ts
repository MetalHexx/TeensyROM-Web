import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ChannelFaderComponent } from './channel-fader.component';
import { MixerService } from '../mixer.service';
import { DECKS } from '../../deck/deck.config';

describe('ChannelFaderComponent', () => {
  let fixture: ComponentFixture<ChannelFaderComponent>;
  let mixer: MixerService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelFaderComponent],
      providers: [MixerService],
    }).compileComponents();

    fixture = TestBed.createComponent(ChannelFaderComponent);
    fixture.componentRef.setInput('deck', DECKS[0]);
    mixer = fixture.debugElement.injector.get(MixerService);
    fixture.detectChanges();
  });

  function rangeInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input[type="range"]');
  }

  it('rests at full gain on load', () => {
    expect(rangeInput().value).toBe('1');
  });

  it('labels itself with its deck letter', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain(DECKS[0].label);
  });

  it('names itself for the deck it serves', () => {
    expect(rangeInput().getAttribute('aria-label')).toBe(`Channel fader deck ${DECKS[0].label}`);
  });

  it('writes an unrounded value straight into the model on input, without re-rounding it', () => {
    const input = rangeInput();
    input.value = '0.137';
    input.dispatchEvent(new Event('input'));

    expect(mixer.deckFader(DECKS[0].id)()).toBe(0.137);
  });

  it('reflects the model rather than local state', () => {
    mixer.setDeckFader(DECKS[0].id, 0.42);
    fixture.detectChanges();

    expect(rangeInput().value).toBe('0.42');
  });

  it("does not move the other deck's fader", () => {
    mixer.setDeckFader(DECKS[0].id, 0.2);
    fixture.detectChanges();

    expect(mixer.deckFader(DECKS[1].id)()).toBe(1);
  });

  it('composes with the crossfader position through gainFor', () => {
    mixer.setDeckFader(DECKS[0].id, 0.5);
    mixer.setCrossfaderPosition(1);

    expect(mixer.gainFor(DECKS[0].id)()).toBe(0);

    mixer.setCrossfaderPosition(0);
    expect(mixer.gainFor(DECKS[0].id)()).toBeCloseTo(0.5, 10);
  });
});
