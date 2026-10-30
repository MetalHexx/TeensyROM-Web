import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { RotaryKnobComponent } from './rotary-knob.component';

describe('RotaryKnobComponent', () => {
  let fixture: ComponentFixture<RotaryKnobComponent>;
  let component: RotaryKnobComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RotaryKnobComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RotaryKnobComponent);
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

  it('defaults data-size to large and reflects the size input', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('data-size')).toBe('large');

    fixture.componentRef.setInput('size', 'small');
    fixture.detectChanges();

    expect(host.getAttribute('data-size')).toBe('small');
  });

  describe('resting at its minimum (home equals min)', () => {
    const CENTER = 40;
    const POINTER_RADIUS = 26;

    function needleEnd(): { x: number; y: number } {
      const pointer = fixture.nativeElement.querySelector('.pointer') as SVGLineElement;
      return { x: Number(pointer.getAttribute('x2')), y: Number(pointer.getAttribute('y2')) };
    }

    function expectedNeedleEnd(angleDeg: number): { x: number; y: number } {
      const rad = (angleDeg * Math.PI) / 180;
      return {
        x: Math.round((CENTER + POINTER_RADIUS * Math.cos(rad)) * 100) / 100,
        y: Math.round((CENTER + POINTER_RADIUS * Math.sin(rad)) * 100) / 100,
      };
    }

    function arcFlags(): { largeArc: string; sweep: string } {
      const d = valueRing()?.getAttribute('d') ?? '';
      const match = /A \d+,\d+ 0 (\d),(\d)/.exec(d);
      if (!match) throw new Error(`no arc in ring path "${d}"`);
      return { largeArc: match[1], sweep: match[2] };
    }

    function setValue(value: number): void {
      fixture.componentRef.setInput('value', value);
      fixture.detectChanges();
    }

    beforeEach(() => {
      fixture.componentRef.setInput('min', 0);
      fixture.componentRef.setInput('max', 1);
      fixture.componentRef.setInput('home', 0);
      setValue(0);
    });

    it('rests at the lower-left start, reaches the top halfway and the lower-right end at max', () => {
      expect(needleEnd()).toEqual(expectedNeedleEnd(-225));

      setValue(0.5);
      expect(needleEnd()).toEqual(expectedNeedleEnd(-90));

      setValue(1);
      expect(needleEnd()).toEqual(expectedNeedleEnd(45));
    });

    it('draws no value ring at rest', () => {
      expect(valueRing()).toBeNull();
    });

    it('grows the ring clockwise, taking the long way round only once past half a turn', () => {
      setValue(0.25);
      expect(arcFlags()).toEqual({ largeArc: '0', sweep: '1' });

      setValue(0.75);
      expect(arcFlags()).toEqual({ largeArc: '1', sweep: '1' });
    });

    it('draws no top home tick, leaving the lower-left end tick to mark rest', () => {
      expect(fixture.nativeElement.querySelector('.home-tick')).toBeNull();
      expect(fixture.nativeElement.querySelectorAll('.end-tick')).toHaveLength(2);
    });

    it('still draws the top home tick on a centre-home knob', () => {
      fixture.componentRef.setInput('min', -1);
      fixture.componentRef.setInput('home', 0);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.home-tick')).not.toBeNull();
    });

    it('returns to its minimum on double-click', () => {
      setValue(0.6);
      const emitted: number[] = [];
      component.valueChange.subscribe((v) => emitted.push(v));

      rangeInput().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      expect(emitted).toEqual([0]);
    });

    it('reports its plain value as its aria-valuetext, at rest and turned', () => {
      expect(rangeInput().getAttribute('aria-valuetext')).toBe('0');

      setValue(0.42);
      expect(rangeInput().getAttribute('aria-valuetext')).toBe('0.42');
    });
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
      // feeding it back must not cause the component to forget the fractional progress between
      // two whole-number steps on every single pointermove.
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
        // The parent rounds before echoing the value back, exactly like a stepped consumer would.
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

  describe('disabled', () => {
    function pointerEvent(type: string, clientY: number): PointerEvent {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientY });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      return event as unknown as PointerEvent;
    }

    function disable(): void {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
    }

    it('is enabled by default', () => {
      expect(rangeInput().disabled).toBe(false);
      expect((fixture.nativeElement as HTMLElement).hasAttribute('data-disabled')).toBe(false);
    });

    it('disables the native range input and flags the host', () => {
      disable();

      expect(rangeInput().disabled).toBe(true);
      expect((fixture.nativeElement as HTMLElement).hasAttribute('data-disabled')).toBe(true);
    });

    it('emits nothing on input, double-click or vertical drag', () => {
      disable();
      const emitted: number[] = [];
      component.valueChange.subscribe((v) => emitted.push(v));

      const input = rangeInput();
      input.value = '0.5';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      input.dispatchEvent(pointerEvent('pointerdown', 100));
      input.dispatchEvent(pointerEvent('pointermove', 50));
      input.dispatchEvent(pointerEvent('pointerup', 50));

      expect(emitted).toEqual([]);
    });

    it('leaves pointerdown to the browser rather than preventing its default', () => {
      disable();

      const down = pointerEvent('pointerdown', 100);
      rangeInput().dispatchEvent(down);

      expect(down.defaultPrevented).toBe(false);
    });

    it('abandons a drag disabled mid-way, so re-enabling does not resume it', () => {
      const emitted: number[] = [];
      component.valueChange.subscribe((v) => emitted.push(v));

      const input = rangeInput();
      input.dispatchEvent(pointerEvent('pointerdown', 100));
      input.dispatchEvent(pointerEvent('pointermove', 90));
      expect(emitted).toHaveLength(1);

      disable();
      input.dispatchEvent(pointerEvent('pointermove', 60));
      fixture.componentRef.setInput('disabled', false);
      fixture.detectChanges();
      input.dispatchEvent(pointerEvent('pointermove', 20));

      expect(emitted).toHaveLength(1);
    });

    it('abandons a drag disabled and re-enabled with no pointer event in between', () => {
      const emitted: number[] = [];
      component.valueChange.subscribe((v) => emitted.push(v));

      const input = rangeInput();
      input.dispatchEvent(pointerEvent('pointerdown', 100));
      input.dispatchEvent(pointerEvent('pointermove', 90));
      expect(emitted).toHaveLength(1);

      // The pointer stays down and still while the knob is disabled, and the value is reset
      // underneath it (a new tune loading) — nothing reaches the knob to tell it the drag is over.
      disable();
      fixture.componentRef.setInput('value', 0);
      fixture.componentRef.setInput('disabled', false);
      fixture.detectChanges();
      input.dispatchEvent(pointerEvent('pointermove', 20));

      expect(emitted).toHaveLength(1);
    });

    it('takes a fresh drag after being re-enabled', () => {
      const emitted: number[] = [];
      component.valueChange.subscribe((v) => emitted.push(v));

      const input = rangeInput();
      input.dispatchEvent(pointerEvent('pointerdown', 100));
      disable();
      fixture.componentRef.setInput('disabled', false);
      fixture.detectChanges();
      input.dispatchEvent(pointerEvent('pointerup', 100));

      input.dispatchEvent(pointerEvent('pointerdown', 100));
      input.dispatchEvent(pointerEvent('pointermove', 50));

      expect(emitted).toEqual([0.5]);
    });
  });

  describe('default appearance', () => {
    it('carries no data-appearance attribute', () => {
      expect(fixture.nativeElement.hasAttribute('data-appearance')).toBe(false);
    });

    it('draws none of the panel or live-ring elements, even with liveRing set', () => {
      fixture.componentRef.setInput('liveRing', true);
      fixture.componentRef.setInput('value', 0.5);
      fixture.detectChanges();

      const host: HTMLElement = fixture.nativeElement;
      for (const selector of ['.live-ring', '.live-track', '.knob-skirt', '.knob-cap', '.offset-arc']) {
        expect(host.querySelector(selector)).toBeNull();
      }
    });

    it('treats setLiveLevel as a no-op', () => {
      fixture.componentRef.setInput('liveRing', true);
      fixture.detectChanges();

      expect(() => component.setLiveLevel(0.5)).not.toThrow();
      expect(fixture.nativeElement.querySelector('.live-ring')).toBeNull();
    });

    it('renders no label span for an empty label', () => {
      fixture.componentRef.setInput('label', '');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.scale-knob-label')).toBeNull();
    });

    it('keeps the hyphen-minus for a negative departure, appending the unit', () => {
      fixture.componentRef.setInput('value', -0.2);
      fixture.componentRef.setInput('valueUnit', 'cents');
      fixture.detectChanges();

      expect(rangeInput().getAttribute('aria-valuetext')).toBe('-0.2 cents');
    });
  });

  describe('panel appearance', () => {
    const host = (): HTMLElement => fixture.nativeElement;

    function usePanel(): void {
      fixture.componentRef.setInput('appearance', 'panel');
      fixture.detectChanges();
    }

    it('reflects data-appearance on the host', () => {
      usePanel();

      expect(host().getAttribute('data-appearance')).toBe('panel');
    });

    it('draws skirt, cap and home tick, but no offset arc at home, and not the default dial', () => {
      usePanel();

      expect(host().querySelector('.knob-skirt')).not.toBeNull();
      expect(host().querySelector('.knob-cap')).not.toBeNull();
      expect(host().querySelector('.panel-home-tick')).not.toBeNull();
      expect(host().querySelector('.offset-arc')).toBeNull();
      expect(host().querySelector('.hub')).toBeNull();
    });

    it('draws the offset arc once the value departs home', () => {
      usePanel();
      fixture.componentRef.setInput('value', 0.5);
      fixture.detectChanges();

      expect(host().querySelector('.offset-arc')).not.toBeNull();
    });

    it('omits the home tick on a knob that rests at its minimum', () => {
      fixture.componentRef.setInput('min', 0);
      fixture.componentRef.setInput('max', 1);
      fixture.componentRef.setInput('home', 0);
      usePanel();

      expect(host().querySelector('.panel-home-tick')).toBeNull();
    });

    it('draws no live ring unless liveRing is set', () => {
      usePanel();

      expect(host().querySelector('.live-ring')).toBeNull();
      expect(host().querySelector('.live-track')).toBeNull();
    });

    it('writes the unit and U+2212 into aria-valuetext off home, and "home" at home', () => {
      fixture.componentRef.setInput('min', -24);
      fixture.componentRef.setInput('max', 24);
      fixture.componentRef.setInput('valueUnit', 'semitones');
      usePanel();
      expect(rangeInput().getAttribute('aria-valuetext')).toBe('home');

      fixture.componentRef.setInput('value', 12);
      fixture.detectChanges();
      expect(rangeInput().getAttribute('aria-valuetext')).toBe('+12 semitones');

      fixture.componentRef.setInput('value', -3);
      fixture.detectChanges();
      expect(rangeInput().getAttribute('aria-valuetext')).toBe('\u22123 semitones');
    });
  });

  describe('live ring', () => {
    function ring(): SVGPathElement {
      return fixture.nativeElement.querySelector('.live-ring');
    }

    beforeEach(() => {
      fixture.componentRef.setInput('appearance', 'panel');
      fixture.componentRef.setInput('liveRing', true);
      fixture.detectChanges();
    });

    it('writes the dash offset immediately, without change detection', () => {
      component.setLiveLevel(0.5);

      expect(ring().getAttribute('stroke-dashoffset')).toBe('50');
    });

    it('clamps below 0 to empty, above 1 to full, and reads NaN as empty', () => {
      component.setLiveLevel(2);
      expect(ring().getAttribute('stroke-dashoffset')).toBe('0');

      component.setLiveLevel(-1);
      expect(ring().getAttribute('stroke-dashoffset')).toBe('100');

      component.setLiveLevel(1);
      component.setLiveLevel(Number.NaN);
      expect(ring().getAttribute('stroke-dashoffset')).toBe('100');
    });

    it('shows the level in two hundred steps, half a percent of the sweep each', () => {
      component.setLiveLevel(0.503);
      expect(ring().getAttribute('stroke-dashoffset')).toBe('49.5');

      component.setLiveLevel(0.005);
      expect(ring().getAttribute('stroke-dashoffset')).toBe('99.5');
    });

    it('does not rewrite the offset for a change inside one step', () => {
      component.setLiveLevel(0.5);
      ring().setAttribute('stroke-dashoffset', 'sentinel');

      component.setLiveLevel(0.502);
      expect(ring().getAttribute('stroke-dashoffset')).toBe('sentinel');

      component.setLiveLevel(0.6);
      expect(ring().getAttribute('stroke-dashoffset')).toBe('40');
    });
  });
});
