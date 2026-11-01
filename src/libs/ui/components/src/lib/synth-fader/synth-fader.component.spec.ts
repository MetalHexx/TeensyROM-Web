import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SynthFaderComponent } from './synth-fader.component';

describe('SynthFaderComponent', () => {
  let fixture: ComponentFixture<SynthFaderComponent>;
  let emitted: number[];
  let wheels: { clicks: number; timeStampMs: number }[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SynthFaderComponent] }).compileComponents();
    fixture = TestBed.createComponent(SynthFaderComponent);
    fixture.componentRef.setInput('value', 1);
    fixture.componentRef.setInput('min', 0.5);
    fixture.componentRef.setInput('max', 2);
    fixture.componentRef.setInput('step', 0.001);
    fixture.componentRef.setInput('accessibleName', 'Speed multiplier deck A');
    emitted = [];
    wheels = [];
    fixture.componentInstance.valueChange.subscribe((v) => emitted.push(v));
    fixture.componentInstance.wheelTurn.subscribe((w) => wheels.push(w));
    fixture.detectChanges();
  });

  function range(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input[type="range"]');
  }

  it('is a native range carrying the accessible name, bounds and value', () => {
    expect(range().getAttribute('aria-label')).toBe('Speed multiplier deck A');
    expect(range().min).toBe('0.5');
    expect(range().max).toBe('2');
    expect(range().step).toBe('0.001');
    expect(range().value).toBe('1');
  });

  it('emits the raw value unrounded', () => {
    range().value = '1.2345';
    range().dispatchEvent(new Event('input'));
    expect(emitted).toEqual([1.2345]);
  });

  it('emits nothing and reports disabled while disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(range().disabled).toBe(true);
    range().dispatchEvent(new Event('input'));
    expect(emitted).toEqual([]);
  });

  function wheel(deltaY: number, deltaMode = 0, timeStamp?: number): WheelEvent {
    const event = new WheelEvent('wheel', { deltaY, deltaMode, bubbles: true, cancelable: true });
    if (timeStamp !== undefined) {
      Object.defineProperty(event, 'timeStamp', { value: timeStamp });
    }
    range().dispatchEvent(event);
    return event;
  }

  describe('wheel', () => {
    it('emits one click per 100 px, upward positive, without scrolling the page', () => {
      const up = wheel(-100, 0, 1234);
      const down = wheel(100);

      expect(wheels.map((w) => w.clicks)).toEqual([1, -1]);
      expect(wheels[0].timeStampMs).toBe(1234);
      expect(up.defaultPrevented).toBe(true);
      expect(down.defaultPrevented).toBe(true);
    });

    it('accumulates small pixel deltas until they make a click', () => {
      wheel(-40);
      wheel(-40);
      expect(wheels).toEqual([]);

      wheel(-40);
      expect(wheels.map((w) => w.clicks)).toEqual([1]);

      wheel(-100);
      expect(wheels.map((w) => w.clicks)).toEqual([1, 1]);
    });

    it('emits several clicks for a large delta and keeps the remainder', () => {
      wheel(-250);
      wheel(-50);
      expect(wheels.map((w) => w.clicks)).toEqual([2, 1]);
    });

    it('counts 3 lines, or one page, as a click', () => {
      wheel(-1, 1);
      wheel(-2, 1);
      wheel(1, 2);

      expect(wheels.map((w) => w.clicks)).toEqual([1, -1]);
    });

    it('emits nothing and lets the page scroll while disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      const event = wheel(-300);

      expect(wheels).toEqual([]);
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('double-click', () => {
    const doubleClick = (): void => {
      range().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    };

    it('emits the home value', () => {
      fixture.componentRef.setInput('home', 1);
      fixture.detectChanges();

      doubleClick();

      expect(emitted).toEqual([1]);
    });

    it('does nothing without a home, or while disabled', () => {
      doubleClick();
      fixture.componentRef.setInput('home', 1);
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      doubleClick();

      expect(emitted).toEqual([]);
    });
  });

  it('announces the value text in place of the number, when given', () => {
    expect(range().hasAttribute('aria-valuetext')).toBe(false);

    fixture.componentRef.setInput('valueText', '+1.25%');
    fixture.detectChanges();

    expect(range().getAttribute('aria-valuetext')).toBe('+1.25%');
  });

  it('draws the home line at the home value along the travel, and none without a home', () => {
    expect(fixture.nativeElement.querySelector('.home')).toBeNull();

    fixture.componentRef.setInput('home', 1.25);
    fixture.detectChanges();
    const home = fixture.nativeElement.querySelector('.home') as HTMLElement;
    expect(Number(home.style.getPropertyValue('--synth-fader-home'))).toBeCloseTo(0.5);
  });
});
