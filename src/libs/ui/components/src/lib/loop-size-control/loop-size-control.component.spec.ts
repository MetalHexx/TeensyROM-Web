import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, beforeEach } from 'vitest';
import { LoopSizeControlComponent, type LoopLengthModel } from './loop-size-control.component';

const size: LoopLengthModel = {
  text: '4 BEATS',
  options: [
    { beats: 2, label: '2 BEATS', selected: false },
    { beats: 4, label: '4 BEATS', selected: true },
  ],
  halveAccessibleName: 'Halve it',
  doubleAccessibleName: 'Double it',
  pickAccessibleName: 'Pick size',
};

const steps = {
  disabled: false,
  downAccessibleName: 'One beat shorter',
  upAccessibleName: 'One beat longer',
};

describe('LoopSizeControlComponent', () => {
  let fixture: ComponentFixture<LoopSizeControlComponent>;
  let el: HTMLElement;
  let emitted: unknown[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoopSizeControlComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    fixture = TestBed.createComponent(LoopSizeControlComponent);
    el = fixture.nativeElement;
    emitted = [];
    const component = fixture.componentInstance;
    component.halve.subscribe(() => emitted.push('halve'));
    component.double.subscribe(() => emitted.push('double'));
    component.stepLength.subscribe((direction) => emitted.push(['step', direction]));
    component.pickNoEnd.subscribe(() => emitted.push('no end'));
    component.pickLength.subscribe((beats) => emitted.push(['pick', beats]));
    component.wheelTurn.subscribe((turn) => emitted.push(['wheel', turn.clicks]));
    fixture.componentRef.setInput('model', size);
    fixture.detectChanges();
  });

  const byName = (name: string): HTMLButtonElement =>
    el.querySelector(`[aria-label="${name}"]`) as HTMLButtonElement;
  const readout = (): HTMLElement => el.querySelector('.readout') as HTMLElement;
  const set = (name: string, value: unknown): void => {
    fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
  };
  const wheel = (deltaY: number): WheelEvent => {
    const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
    readout().dispatchEvent(event);
    return event;
  };

  const pickerItems = (): string[] =>
    Array.from(
      document.querySelectorAll<HTMLButtonElement>('.cdk-overlay-container .dropdown-menu-item')
    ).map((item) => (item.textContent ?? '').replace(/^s*checks*/, '').trim());

  it('shows the tag as decoration and the readout text', () => {
    expect(el.querySelector('.tag')?.textContent).toBe('Length');
    expect(el.querySelector('.tag')?.getAttribute('aria-hidden')).toBe('true');
    expect(readout().textContent).toContain('4 BEATS');
    expect(readout().getAttribute('aria-label')).toBe('Pick size, 4 BEATS');
  });

  it('emits halve and double from the keys', () => {
    byName('Halve it').click();
    byName('Double it').click();

    expect(emitted).toEqual(['halve', 'double']);
  });

  it('opens the picker and emits the picked beats', () => {
    readout().click();
    fixture.detectChanges();
    const item = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.cdk-overlay-container .dropdown-menu-item')
    ).find((candidate) => candidate.textContent?.includes('2 BEATS'));
    item?.click();

    expect(emitted).toEqual([['pick', 2]]);
  });

  describe('the step keys', () => {
    it('are drawn only with steps, and emit the direction', () => {
      expect(byName('One beat shorter')).toBeNull();
      expect(byName('One beat longer')).toBeNull();

      set('model', { ...size, steps });
      byName('One beat shorter').click();
      byName('One beat longer').click();

      expect(emitted).toEqual([
        ['step', -1],
        ['step', 1],
      ]);
    });

    it('sit between the 1/2 key and the readout, and the readout and the 2× key', () => {
      set('model', { ...size, steps });

      const order = Array.from(el.querySelectorAll('lib-synth-key, .readout')).map(
        (child) => child.textContent?.replace(/\s+/g, '').replace(/▾/, '') ?? ''
      );

      expect(order).toEqual(['1/2', '−', '4BEATS', '+', '2×']);
    });

    it('disable with steps.disabled or disabled, leaving the other keys alone', () => {
      set('model', { ...size, steps: { ...steps, disabled: true } });
      expect(byName('One beat shorter').disabled).toBe(true);
      expect(byName('One beat longer').disabled).toBe(true);
      expect(byName('Halve it').disabled).toBe(false);

      set('model', { ...size, steps });
      expect(byName('One beat shorter').disabled).toBe(false);
      set('disabled', true);
      expect(byName('One beat shorter').disabled).toBe(true);
    });

    it('carry the given data-control ids', () => {
      set('model', { ...size, steps });
      set('stepDownControl', 'loop-length-down');
      set('stepUpControl', 'loop-length-up');

      expect(
        byName('One beat shorter').closest('[data-control]')?.getAttribute('data-control')
      ).toBe('loop-length-down');
      expect(
        byName('One beat longer').closest('[data-control]')?.getAttribute('data-control')
      ).toBe('loop-length-up');
    });
  });

  describe('No End', () => {
    it('is the first picker item only with noEnd, marked selected on a cue, and emits pickNoEnd', () => {
      set('model', {
        ...size,
        options: size.options.map((option) => ({ ...option, selected: false })),
        noEnd: { label: 'NO END', selected: true },
      });
      readout().click();
      fixture.detectChanges();

      expect(pickerItems()).toEqual(['NO END', '2 BEATS', '4 BEATS']);
      const first = document.querySelector<HTMLButtonElement>(
        '.cdk-overlay-container .dropdown-menu-item'
      );
      expect(
        Array.from(
          document.querySelectorAll('.cdk-overlay-container .dropdown-menu-item.selected')
        ).map((item) => (item.textContent ?? '').replace(/^s*checks*/, '').trim())
      ).toEqual(['NO END']);
      first?.click();

      expect(emitted).toEqual(['no end']);
    });

    it('offers no such item without noEnd', () => {
      readout().click();
      fixture.detectChanges();

      expect(pickerItems()).toEqual(['2 BEATS', '4 BEATS']);
    });

    it('makes the readout a picker even with no sizes', () => {
      set('model', {
        ...size,
        text: '7.8s',
        options: [],
        noEnd: { label: 'NO END', selected: false },
      });

      expect(el.querySelector('lib-dropdown-menu')).not.toBeNull();
      readout().click();
      fixture.detectChanges();
      expect(pickerItems()).toEqual(['NO END']);
    });
  });

  it('draws a plain readout with no picker when there are no options', () => {
    set('model', { ...size, text: '—', options: [] });

    expect(el.querySelector('lib-dropdown-menu')).toBeNull();
    expect(readout().tagName.toLowerCase()).toBe('span');
    expect(readout().textContent?.trim()).toBe('—');
  });

  it('disables each key alone, or both with disabled', () => {
    set('halveDisabled', true);
    expect(byName('Halve it').disabled).toBe(true);
    expect(byName('Double it').disabled).toBe(false);

    set('halveDisabled', false);
    set('doubleDisabled', true);
    expect(byName('Halve it').disabled).toBe(false);
    expect(byName('Double it').disabled).toBe(true);

    set('doubleDisabled', false);
    set('disabled', true);
    expect(byName('Halve it').disabled).toBe(true);
    expect(byName('Double it').disabled).toBe(true);
  });

  it('puts the given data-control ids on the readout and the keys, and none without', () => {
    expect(el.querySelector('[data-control]')).toBeNull();

    set('readoutControl', 'live-loop-size');
    set('halveControl', 'live-loop-halve');
    set('doubleControl', 'live-loop-double');

    expect(readout().getAttribute('data-control')).toBe('live-loop-size');
    expect(byName('Halve it').closest('[data-control]')?.getAttribute('data-control')).toBe(
      'live-loop-halve'
    );
    expect(byName('Double it').closest('[data-control]')?.getAttribute('data-control')).toBe(
      'live-loop-double'
    );
  });

  describe('wheel', () => {
    it('emits whole clicks, upward positive, and stops the page scrolling while on', () => {
      set('wheel', true);

      const up = wheel(-100);
      const down = wheel(100);

      expect(emitted).toEqual([
        ['wheel', 1],
        ['wheel', -1],
      ]);
      expect(up.defaultPrevented).toBe(true);
      expect(down.defaultPrevented).toBe(true);
    });

    it('does nothing and lets the page scroll while off', () => {
      const event = wheel(-300);

      expect(emitted).toEqual([]);
      expect(event.defaultPrevented).toBe(false);
    });

    it('listens on the plain readout too', () => {
      set('wheel', true);
      set('model', { ...size, options: [] });

      wheel(-100);

      expect(emitted).toEqual([['wheel', 1]]);
    });
  });
});
