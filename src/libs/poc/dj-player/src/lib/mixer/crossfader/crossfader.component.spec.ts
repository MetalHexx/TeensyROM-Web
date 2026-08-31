import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { CrossfaderComponent } from './crossfader.component';
import { MixerService } from '../mixer.service';
import { DECKS } from '../../deck/deck.config';

describe('CrossfaderComponent', () => {
  let fixture: ComponentFixture<CrossfaderComponent>;
  let mixer: MixerService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrossfaderComponent],
      providers: [MixerService],
    }).compileComponents();

    fixture = TestBed.createComponent(CrossfaderComponent);
    mixer = fixture.debugElement.injector.get(MixerService);
    fixture.detectChanges();
  });

  function rangeInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input[type="range"]');
  }

  it('rests the thumb at centre on load', () => {
    expect(rangeInput().value).toBe('0');
  });

  it('labels its ends from DECKS, not a hard-coded string', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain(DECKS[0].label);
    expect(text).toContain(DECKS[1].label);
  });

  it('writes an unrounded position straight into the model on input, without re-rounding it', () => {
    const input = rangeInput();
    input.value = '0.137';
    input.dispatchEvent(new Event('input'));

    expect(mixer.crossfaderPosition()).toBe(0.137);
  });
});
