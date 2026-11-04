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
    component.pickLength.subscribe((beats) => emitted.push(['pick', beats]));
    component.wheelTurn.subscribe((turn) => emitted.push(['wheel', turn.clicks]));
    fixture.componentRef.setInput('model', size);
    fixture.componentRef.setInput('tag', 'Size');
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

  it('shows the tag as decoration and the readout text', () => {
    expect(el.querySelector('.tag')?.textContent).toBe('Size');
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
