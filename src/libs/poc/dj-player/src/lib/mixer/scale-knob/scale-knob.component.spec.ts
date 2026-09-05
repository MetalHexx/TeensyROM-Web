import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ScaleKnobComponent } from './scale-knob.component';

describe('ScaleKnobComponent', () => {
  let fixture: ComponentFixture<ScaleKnobComponent>;
  let component: ScaleKnobComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScaleKnobComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ScaleKnobComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'Cutoff');
    fixture.componentRef.setInput('accessibleName', 'Cutoff deck A');
    fixture.componentRef.setInput('value', 0);
    fixture.detectChanges();
  });

  function rangeInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input[type="range"]');
  }

  function pointerAngleDeg(): number {
    const pointer = fixture.nativeElement.querySelector('.pointer') as SVGLineElement;
    const dx = Number(pointer.getAttribute('x2')) - 40;
    const dy = Number(pointer.getAttribute('y2')) - 40;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  }

  function valueRing(): SVGPathElement | null {
    return fixture.nativeElement.querySelector('.value-ring');
  }

  it('points straight up at home', () => {
    expect(pointerAngleDeg()).toBeCloseTo(-90, 5);
  });

  it('points to the lower-left at min', () => {
    fixture.componentRef.setInput('value', -1);
    fixture.detectChanges();

    // -225° normalizes (mod 360) to 135°, the same angle the wireframe's lower-left end tick sits at.
    expect(pointerAngleDeg()).toBeCloseTo(135, 5);
  });

  it('points to the lower-right at max', () => {
    fixture.componentRef.setInput('value', 1);
    fixture.detectChanges();

    expect(pointerAngleDeg()).toBeCloseTo(45, 5);
  });

  it('has no value ring at home', () => {
    expect(valueRing()).toBeNull();
  });

  it('draws a value ring once the value departs home', () => {
    fixture.componentRef.setInput('value', 0.5);
    fixture.detectChanges();

    expect(valueRing()).not.toBeNull();
  });

  it('emits the unrounded value on input, holding no local copy of it', () => {
    const emitted: number[] = [];
    component.valueChange.subscribe((v) => emitted.push(v));

    const input = rangeInput();
    input.value = '0.137';
    input.dispatchEvent(new Event('input'));

    expect(emitted).toEqual([0.137]);

    // No local copy: the rendered value is exactly `value()` — pushing a different number through
    // that input re-renders to it rather than to whatever was last typed into the native control.
    fixture.componentRef.setInput('value', 0.5);
    fixture.detectChanges();
    expect(input.value).toBe('0.5');
  });

  it('returns to home on double-click', () => {
    fixture.componentRef.setInput('value', 0.6);
    fixture.componentRef.setInput('home', 0.2);
    fixture.detectChanges();

    const emitted: number[] = [];
    component.valueChange.subscribe((v) => emitted.push(v));

    rangeInput().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(emitted).toEqual([0.2]);
  });

  it('carries the supplied accessible name', () => {
    expect(rangeInput().getAttribute('aria-label')).toBe('Cutoff deck A');
  });

  it('reports "home" as its aria-valuetext at the rest point', () => {
    expect(rangeInput().getAttribute('aria-valuetext')).toBe('home');
  });

  it('reports a signed departure once off home', () => {
    fixture.componentRef.setInput('value', 0.3);
    fixture.detectChanges();

    expect(rangeInput().getAttribute('aria-valuetext')).toBe('+0.3');
  });

  it('hides the decorative dial from assistive technology', () => {
    const svg = fixture.nativeElement.querySelector('svg');

    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('labels itself', () => {
    expect(fixture.nativeElement.querySelector('.scale-knob-label').textContent.trim()).toBe(
      'Cutoff'
    );
  });

  it('renders the supplied readout under the dial', () => {
    fixture.componentRef.setInput('readout', '+2');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.scale-knob-readout').textContent.trim()).toBe(
      '+2'
    );
  });

  describe('vertical pointer drag', () => {
    // jsdom (this workspace's version) has no `PointerEvent` constructor — a `MouseEvent` carries
    // every field the component's handlers actually read (`clientY`, `shiftKey`, `target`) except
    // `pointerId`, which is added directly since dispatch matches on the event's `type` string, not
    // its constructor.
    function pointerEvent(
      type: string,
      init: { clientY: number; pointerId?: number; shiftKey?: boolean }
    ): PointerEvent {
      const event = new MouseEvent(type, {
        bubbles: true,
        clientY: init.clientY,
        shiftKey: init.shiftKey ?? false,
      });
      Object.defineProperty(event, 'pointerId', { value: init.pointerId ?? 1 });
      return event as unknown as PointerEvent;
    }

    it('increases the value when dragging up (decreasing clientY)', () => {
      const emitted: number[] = [];
      component.valueChange.subscribe((v) => emitted.push(v));

      const input = rangeInput();
      input.dispatchEvent(pointerEvent('pointerdown', { clientY: 100 }));
      input.dispatchEvent(pointerEvent('pointermove', { clientY: 50 }));

      // 50px up over a 200px full-range span, on a [-1, 1] range: delta = (50/200) * 2 = 0.5.
      expect(emitted).toEqual([0.5]);
    });

    it('decreases the value when dragging down (increasing clientY)', () => {
      const emitted: number[] = [];
      component.valueChange.subscribe((v) => emitted.push(v));

      const input = rangeInput();
      input.dispatchEvent(pointerEvent('pointerdown', { clientY: 100 }));
      input.dispatchEvent(pointerEvent('pointermove', { clientY: 150 }));

      expect(emitted).toEqual([-0.5]);
    });

    it('reduces sensitivity while shift is held', () => {
      const emitted: number[] = [];
      component.valueChange.subscribe((v) => emitted.push(v));

      const input = rangeInput();
      input.dispatchEvent(pointerEvent('pointerdown', { clientY: 100 }));
      input.dispatchEvent(pointerEvent('pointermove', { clientY: 50, shiftKey: true }));

      // Same 50px delta, but shift quarters sensitivity (800px full range instead of 200px):
      // delta = (50/800) * 2 = 0.125.
      expect(emitted).toEqual([0.125]);
    });

    it('emits nothing for a plain click with no intervening move', () => {
      const emitted: number[] = [];
      component.valueChange.subscribe((v) => emitted.push(v));

      const input = rangeInput();
      input.dispatchEvent(pointerEvent('pointerdown', { clientY: 100 }));
      input.dispatchEvent(pointerEvent('pointerup', { clientY: 100 }));

      expect(emitted).toEqual([]);
    });

    it('tracks drag incrementally, so a value change mid-drag does not cause a jump', () => {
      const emitted: number[] = [];
      component.valueChange.subscribe((v) => emitted.push(v));

      const input = rangeInput();
      input.dispatchEvent(pointerEvent('pointerdown', { clientY: 100 }));
      input.dispatchEvent(pointerEvent('pointermove', { clientY: 80 }));
      fixture.componentRef.setInput('value', emitted[0]);
      fixture.detectChanges();
      input.dispatchEvent(pointerEvent('pointermove', { clientY: 50, shiftKey: true }));

      // Second move: 30px delta at fine sensitivity from the already-updated value.
      expect(emitted[0]).toBeCloseTo(0.2, 5);
      expect(emitted[1]).toBeCloseTo(0.2 + (30 / 800) * 2, 5);
    });

    it('accumulates drag distance internally, so a stepped knob whose bound value rounds every move (e.g. Key, step=1) still tracks the full physical drag instead of losing sub-step fractions each time', () => {
      // Reproduces the Key knob's reported jank: a parent that rounds the emitted value before
      // feeding it back (`MixerService.setKeySemitones`) must not cause the component to forget
      // the fractional progress between two whole-number steps on every single pointermove.
      fixture.componentRef.setInput('min', -12);
      fixture.componentRef.setInput('max', 12);
      fixture.componentRef.setInput('value', 0);
      fixture.detectChanges();

      const emitted: number[] = [];
      component.valueChange.subscribe((v) => emitted.push(v));

      const input = rangeInput();
      input.dispatchEvent(pointerEvent('pointerdown', { clientY: 100 }));
      let clientY = 100;
      for (let i = 0; i < 10; i++) {
        clientY -= 1; // 1px up per move, 10px total.
        input.dispatchEvent(pointerEvent('pointermove', { clientY }));
        // The parent rounds before echoing the value back, exactly like `setKeySemitones` does.
        fixture.componentRef.setInput('value', Math.round(emitted[emitted.length - 1]));
        fixture.detectChanges();
      }

      // 10px over a 200px span on a [-12, 12] (24-wide) range: 10 * (24/200) = 1.2 total — enough to
      // cross a whole semitone. A component that re-derives each move from the rounded bound value
      // would re-emit ~0.12 every time and never accumulate past it.
      expect(emitted[emitted.length - 1]).toBeCloseTo(1.2, 5);
    });

    it('ignores pointermove once the drag has ended', () => {
      const emitted: number[] = [];
      component.valueChange.subscribe((v) => emitted.push(v));

      const input = rangeInput();
      input.dispatchEvent(pointerEvent('pointerdown', { clientY: 100 }));
      input.dispatchEvent(pointerEvent('pointerup', { clientY: 100 }));
      input.dispatchEvent(pointerEvent('pointermove', { clientY: 50 }));

      expect(emitted).toEqual([]);
    });
  });
});
