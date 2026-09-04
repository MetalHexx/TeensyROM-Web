import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { FilterModeSelectorComponent } from './filter-mode-selector.component';
import { MixerService } from '../mixer.service';
import { DECKS } from '../../deck/deck.config';

describe('FilterModeSelectorComponent', () => {
  let fixture: ComponentFixture<FilterModeSelectorComponent>;
  let mixer: MixerService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilterModeSelectorComponent],
      providers: [MixerService],
    }).compileComponents();

    fixture = TestBed.createComponent(FilterModeSelectorComponent);
    fixture.componentRef.setInput('deck', DECKS[0]);
    mixer = fixture.debugElement.injector.get(MixerService);
    fixture.detectChanges();
  });

  function buttons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('button'));
  }

  function buttonNamed(name: string): HTMLButtonElement {
    const button = buttons().find((candidate) => candidate.getAttribute('aria-label')?.includes(name));
    if (!button) throw new Error(`no button named ${name}`);
    return button;
  }

  it('renders LP, BP, HP and OFF as four adjacent single-tap buttons', () => {
    expect(buttons()).toHaveLength(4);
    for (const button of buttons()) {
      expect(button.getAttribute('type')).toBe('button');
    }
  });

  it('starts with nothing engaged, matching a null (tune) filter mode', () => {
    expect(mixer.filterMode(DECKS[0].id)()).toBeNull();
    for (const button of buttons()) {
      expect(button.getAttribute('aria-pressed')).toBe('false');
    }
  });

  it('engages an option, writes the model and reports it via aria-pressed', () => {
    buttonNamed('band-pass').click();
    fixture.detectChanges();

    expect(mixer.filterMode(DECKS[0].id)()).toBe('bandPass');
    expect(buttonNamed('band-pass').getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking a second option disengages the first — mutually exclusive', () => {
    buttonNamed('low-pass').click();
    fixture.detectChanges();
    buttonNamed('band-pass').click();
    fixture.detectChanges();

    expect(mixer.filterMode(DECKS[0].id)()).toBe('bandPass');
    expect(buttonNamed('low-pass').getAttribute('aria-pressed')).toBe('false');
    expect(buttonNamed('band-pass').getAttribute('aria-pressed')).toBe('true');
  });

  it('re-clicking the engaged option deselects it, returning to null', () => {
    buttonNamed('high-pass').click();
    fixture.detectChanges();
    buttonNamed('high-pass').click();
    fixture.detectChanges();

    expect(mixer.filterMode(DECKS[0].id)()).toBeNull();
    expect(buttonNamed('high-pass').getAttribute('aria-pressed')).toBe('false');
  });

  it('OFF is itself a mode, toggled the same way as the other three', () => {
    buttonNamed('off').click();
    fixture.detectChanges();

    expect(mixer.filterMode(DECKS[0].id)()).toBe('off');

    buttonNamed('off').click();
    fixture.detectChanges();

    expect(mixer.filterMode(DECKS[0].id)()).toBeNull();
  });

  it("does not move the other deck's filter mode", () => {
    buttonNamed('low-pass').click();
    fixture.detectChanges();

    expect(mixer.filterMode(DECKS[1].id)()).toBeNull();
  });

  it('names each option for its deck and mode', () => {
    expect(buttonNamed('low-pass').getAttribute('aria-label')).toBe(
      `Filter mode low-pass deck ${DECKS[0].label}`
    );
    expect(buttonNamed('off').getAttribute('aria-label')).toBe(
      `Filter mode off deck ${DECKS[0].label}`
    );
  });

  it('carries no dropdown', () => {
    expect(fixture.nativeElement.querySelector('select')).toBeNull();
  });
});
