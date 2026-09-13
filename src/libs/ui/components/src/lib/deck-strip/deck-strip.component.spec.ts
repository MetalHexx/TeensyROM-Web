import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DeckStripComponent, DeckStripModel } from './deck-strip.component';
import type { FilterModeValue } from '../filter-mode-selector/filter-mode-selector.component';

function testModel(): DeckStripModel {
  return {
    filter: {
      engaged: null,
      groupAccessibleName: 'Filter mode deck A',
      optionAccessibleNames: {
        lowPass: 'Filter mode low-pass deck A',
        bandPass: 'Filter mode band-pass deck A',
        highPass: 'Filter mode high-pass deck A',
        off: 'Filter mode off deck A',
      },
    },
    knobs: [
      { id: 'cutoff', label: 'Cutoff', accessibleName: 'Cutoff deck A', value: 0 },
      { id: 'resonance', label: 'Resonance', accessibleName: 'Resonance deck A', value: 0 },
      { id: 'pulseWidth', label: 'Pulse Width', accessibleName: 'Pulse Width deck A', value: 0 },
      {
        id: 'key',
        label: 'Key',
        accessibleName: 'Key deck A',
        value: 0,
        min: -12,
        max: 12,
        step: 1,
        readout: '0',
      },
    ],
    fader: { value: 1, accessibleName: 'Channel fader deck A', label: 'A' },
  };
}

describe('DeckStripComponent', () => {
  let fixture: ComponentFixture<DeckStripComponent>;
  let component: DeckStripComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DeckStripComponent] }).compileComponents();

    fixture = TestBed.createComponent(DeckStripComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('model', testModel());
    fixture.detectChanges();
  });

  function knobInput(name: string): HTMLInputElement {
    const input = fixture.nativeElement.querySelector(`input[aria-label="${name} deck A"]`);
    if (!input) throw new Error(`no knob named ${name}`);
    return input;
  }

  it('renders one knob per model().knobs entry, in order, plus the filter selector and fader', () => {
    expect(fixture.nativeElement.querySelector('lib-filter-mode-selector')).not.toBeNull();

    const knobLabels = Array.from(
      fixture.nativeElement.querySelectorAll('lib-rotary-knob input')
    ).map((input) => (input as HTMLInputElement).getAttribute('aria-label'));
    expect(knobLabels).toEqual([
      'Cutoff deck A',
      'Resonance deck A',
      'Pulse Width deck A',
      'Key deck A',
    ]);

    expect(
      fixture.nativeElement.querySelector('input[aria-label="Channel fader deck A"]')
    ).not.toBeNull();
  });

  it('carries the moved knob\'s id on knobChange', () => {
    const emitted: { id: string; value: number }[] = [];
    component.knobChange.subscribe((event) => emitted.push(event));

    knobInput('Resonance').value = '0.4';
    knobInput('Resonance').dispatchEvent(new Event('input'));

    expect(emitted).toEqual([{ id: 'resonance', value: 0.4 }]);
  });

  it("falls Key's own bounds through to its knob, unlike the other three", () => {
    const key = knobInput('Key');
    expect(key.min).toBe('-12');
    expect(key.max).toBe('12');
    expect(key.step).toBe('1');

    const cutoff = knobInput('Cutoff');
    expect(cutoff.min).toBe('-1');
    expect(cutoff.max).toBe('1');
    expect(cutoff.step).toBe('0.01');
  });

  it("forwards the fader's valueChange unchanged", () => {
    const emitted: number[] = [];
    component.faderChange.subscribe((value) => emitted.push(value));

    const fader = fixture.nativeElement.querySelector(
      'input[aria-label="Channel fader deck A"]'
    ) as HTMLInputElement;
    fader.value = '0.7';
    fader.dispatchEvent(new Event('input'));

    expect(emitted).toEqual([0.7]);
  });

  function bandPassButton(): HTMLButtonElement {
    return Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLButtonElement).getAttribute('aria-label')?.includes('band-pass')
    ) as HTMLButtonElement;
  }

  it("forwards the filter mode selector's modeSelect unchanged", () => {
    const emitted: (FilterModeValue | null)[] = [];
    component.filterModeSelect.subscribe((mode) => emitted.push(mode));

    bandPassButton().click();

    expect(emitted).toEqual(['bandPass']);
  });

  it('forwards a deselect (re-clicking the engaged option) as null, unchanged', () => {
    const model = testModel();
    fixture.componentRef.setInput('model', {
      ...model,
      filter: { ...model.filter, engaged: 'bandPass' },
    });
    fixture.detectChanges();

    const emitted: (FilterModeValue | null)[] = [];
    component.filterModeSelect.subscribe((mode) => emitted.push(mode));

    bandPassButton().click();

    expect(emitted).toEqual([null]);
  });

  it('forwards size to the filter selector, every knob and the fader, defaulting to large', () => {
    function dataSize(selector: string): string | null {
      return (fixture.nativeElement.querySelector(selector) as HTMLElement).getAttribute(
        'data-size'
      );
    }

    expect(dataSize('lib-filter-mode-selector')).toBe('large');
    expect(dataSize('lib-rotary-knob')).toBe('large');
    expect(dataSize('lib-channel-fader')).toBe('large');

    fixture.componentRef.setInput('size', 'small');
    fixture.detectChanges();

    expect(dataSize('lib-filter-mode-selector')).toBe('small');
    expect(dataSize('lib-rotary-knob')).toBe('small');
    expect(dataSize('lib-channel-fader')).toBe('small');
  });

  it('toggles the fixed-fader wrapper class from faderLength and forwards it to the fader', () => {
    const wrapper = () => fixture.nativeElement.querySelector('.deck-strip-fader') as HTMLElement;
    const fader = () => fixture.nativeElement.querySelector('lib-channel-fader') as HTMLElement;

    expect(wrapper().classList.contains('deck-strip-fader--fixed')).toBe(false);
    expect(fader().hasAttribute('data-fixed-length')).toBe(false);

    fixture.componentRef.setInput('faderLength', '148px');
    fixture.detectChanges();

    expect(wrapper().classList.contains('deck-strip-fader--fixed')).toBe(true);
    expect(fader().hasAttribute('data-fixed-length')).toBe(true);
  });
});
