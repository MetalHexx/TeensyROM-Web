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
});
