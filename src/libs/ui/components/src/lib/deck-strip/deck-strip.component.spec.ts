import { Component } from '@angular/core';
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

  describe('without a filter model', () => {
    beforeEach(() => {
      const { knobs, fader } = testModel();
      fixture.componentRef.setInput('model', { knobs, fader } satisfies DeckStripModel);
      fixture.detectChanges();
    });

    it('renders no selector element, and the knobs and fader still render', () => {
      expect(fixture.nativeElement.querySelector('lib-filter-mode-selector')).toBeNull();
      expect(fixture.nativeElement.querySelectorAll('lib-rotary-knob')).toHaveLength(4);
      expect(
        fixture.nativeElement.querySelector('input[aria-label="Channel fader deck A"]')
      ).not.toBeNull();
    });

    it('starts the strip with its first knob, so no gap is reserved above it', () => {
      const first = fixture.nativeElement.firstElementChild as HTMLElement;

      expect(first.tagName.toLowerCase()).toBe('lib-rotary-knob');
    });

    it('never emits filterModeSelect', () => {
      const emitted: (FilterModeValue | null)[] = [];
      component.filterModeSelect.subscribe((mode) => emitted.push(mode));

      knobInput('Cutoff').value = '0.4';
      knobInput('Cutoff').dispatchEvent(new Event('input'));

      expect(emitted).toEqual([]);
    });

    it('renders the selector once a filter model is supplied', () => {
      fixture.componentRef.setInput('model', testModel());
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('lib-filter-mode-selector')).not.toBeNull();
    });
  });

  describe("a knob's home", () => {
    it('reaches the inner knob, so one homed at its minimum rests there and double-clicks back to it', () => {
      const model = testModel();
      fixture.componentRef.setInput('model', {
        ...model,
        knobs: [
          {
            id: 'resonance',
            label: 'Resonance',
            accessibleName: 'Resonance deck A',
            value: 0.6,
            min: 0,
            max: 1,
            home: 0,
          },
        ],
      });
      fixture.detectChanges();
      const emitted: { id: string; value: number }[] = [];
      component.knobChange.subscribe((event) => emitted.push(event));

      knobInput('Resonance').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      expect(emitted).toEqual([{ id: 'resonance', value: 0 }]);
      expect(fixture.nativeElement.querySelector('lib-rotary-knob .home-tick')).toBeNull();
    });
  });

  describe('the deckStripAfterKnobs hook', () => {
    @Component({
      imports: [DeckStripComponent],
      template: `<lib-deck-strip [model]="model"
        ><div deckStripAfterKnobs class="hooked"></div
      ></lib-deck-strip>`,
    })
    class HostComponent {
      readonly model = testModel();
    }

    function between(first: Element, middle: Element, last: Element): boolean {
      const follows = (a: Element, b: Element) =>
        Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return follows(first, middle) && follows(middle, last);
    }

    it('renders nothing between the last knob and the fader when nothing is projected', () => {
      const lastKnob = Array.from(
        fixture.nativeElement.querySelectorAll('lib-rotary-knob')
      ).pop() as HTMLElement;

      expect(lastKnob.nextElementSibling?.classList.contains('deck-strip-fader')).toBe(true);
    });

    it('projects marked content between the last knob and the fader', () => {
      const host = TestBed.createComponent(HostComponent);
      host.detectChanges();
      const root: HTMLElement = host.nativeElement;

      const lastKnob = Array.from(root.querySelectorAll('lib-rotary-knob')).pop() as HTMLElement;
      const hooked = root.querySelector('.hooked') as HTMLElement;
      const fader = root.querySelector('.deck-strip-fader') as HTMLElement;

      expect(between(lastKnob, hooked, fader)).toBe(true);
    });
  });

  describe('disabled', () => {
    function channelFader(): HTMLInputElement {
      return fixture.nativeElement.querySelector('input[aria-label="Channel fader deck A"]');
    }

    function filterButtons(): HTMLButtonElement[] {
      return Array.from(fixture.nativeElement.querySelectorAll('lib-filter-mode-selector button'));
    }

    it('leaves every control enabled by default', () => {
      expect(knobInput('Cutoff').disabled).toBe(false);
      expect(filterButtons().every((button) => !button.disabled)).toBe(true);
      expect(channelFader().disabled).toBe(false);
    });

    it('disables only the knobs whose own model says so', () => {
      const model = testModel();
      fixture.componentRef.setInput('model', {
        ...model,
        knobs: model.knobs.map((knob) => ({ ...knob, disabled: knob.id === 'resonance' })),
      });
      fixture.detectChanges();

      expect(knobInput('Resonance').disabled).toBe(true);
      expect(knobInput('Cutoff').disabled).toBe(false);
      expect(knobInput('Key').disabled).toBe(false);
    });

    it('disables the filter selector through the filter model, and no knob or fader with it', () => {
      const model = testModel();
      fixture.componentRef.setInput('model', {
        ...model,
        filter: { ...model.filter, disabled: true },
      });
      fixture.detectChanges();

      expect(filterButtons()).toHaveLength(4);
      expect(filterButtons().every((button) => button.disabled)).toBe(true);
      expect(knobInput('Cutoff').disabled).toBe(false);
      expect(channelFader().disabled).toBe(false);
    });

    it('keeps the channel fader enabled and emitting while every knob and the filter are disabled', () => {
      const model = testModel();
      fixture.componentRef.setInput('model', {
        filter: { ...model.filter, disabled: true },
        knobs: model.knobs.map((knob) => ({ ...knob, disabled: true })),
        fader: model.fader,
      });
      fixture.detectChanges();
      const faderEmitted: number[] = [];
      const knobEmitted: unknown[] = [];
      component.faderChange.subscribe((v) => faderEmitted.push(v));
      component.knobChange.subscribe((e) => knobEmitted.push(e));

      expect(channelFader().disabled).toBe(false);
      channelFader().value = '0.4';
      channelFader().dispatchEvent(new Event('input'));
      knobInput('Cutoff').value = '0.4';
      knobInput('Cutoff').dispatchEvent(new Event('input'));

      expect(faderEmitted).toEqual([0.4]);
      expect(knobEmitted).toEqual([]);
    });
  });
});
