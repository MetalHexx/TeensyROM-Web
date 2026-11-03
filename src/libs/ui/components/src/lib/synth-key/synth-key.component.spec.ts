import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SynthKeyComponent } from './synth-key.component';

// jsdom has no `PointerEvent` constructor — a `MouseEvent` carries the `button` the component reads.
function pointerDown(button: number): PointerEvent {
  return new MouseEvent('pointerdown', { bubbles: true, button }) as unknown as PointerEvent;
}

describe('SynthKeyComponent', () => {
  let fixture: ComponentFixture<SynthKeyComponent>;
  let presses: number;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SynthKeyComponent] }).compileComponents();
    fixture = TestBed.createComponent(SynthKeyComponent);
    fixture.componentRef.setInput('accessibleName', 'Play deck A');
    fixture.componentRef.setInput('label', 'Play');
    presses = 0;
    fixture.componentInstance.press.subscribe(() => presses++);
    fixture.detectChanges();
  });

  function button(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button');
  }

  function set(name: string, value: unknown): void {
    fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
  }

  it('carries the accessible name on the native button', () => {
    expect(button().getAttribute('aria-label')).toBe('Play deck A');
  });

  it('is the standard key unless the pill is asked for', () => {
    expect(fixture.nativeElement.getAttribute('data-shape')).toBe('key');
    set('shape', 'pill');
    expect(fixture.nativeElement.getAttribute('data-shape')).toBe('pill');
  });

  it('emits press on click', () => {
    button().click();
    expect(presses).toBe(1);
  });

  it('does not emit press when disabled', () => {
    set('disabled', true);
    button().click();
    expect(button().disabled).toBe(true);
    expect(presses).toBe(0);
  });

  it('has no aria-pressed on a one-shot key', () => {
    expect(button().hasAttribute('aria-pressed')).toBe(false);
  });

  it.each([true, false])('exposes aria-pressed=%s on a latching key', (latched) => {
    set('latched', latched);
    expect(button().getAttribute('aria-pressed')).toBe(String(latched));
  });

  it('lights a latching key while latched, and `lit` overrides the light', () => {
    set('latched', true);
    expect(button().hasAttribute('data-lit')).toBe(true);
    set('lit', false);
    expect(button().hasAttribute('data-lit')).toBe(false);
    set('latched', false);
    set('lit', true);
    expect(button().hasAttribute('data-lit')).toBe(true);
  });

  it('never lights a one-shot key', () => {
    set('lit', true);
    expect(button().hasAttribute('data-lit')).toBe(false);
  });

  it('draws the state light only when asked', () => {
    expect(fixture.nativeElement.querySelector('.state-light')).toBeNull();
    set('stateLight', 'playing');
    expect(fixture.nativeElement.querySelector('.state-light')).not.toBeNull();
    expect(button().getAttribute('data-state-light')).toBe('playing');
  });

  it('omits the label element when the label is empty', () => {
    set('label', '');
    expect(fixture.nativeElement.querySelector('.text')).toBeNull();
  });

  describe('pressOn="down"', () => {
    beforeEach(() => set('pressOn', 'down'));

    it('emits once on a primary pointer down, and ignores the click that follows it', () => {
      button().dispatchEvent(pointerDown(0));
      expect(presses).toBe(1);
      button().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      expect(presses).toBe(1);
    });

    it('ignores a secondary-button pointer down', () => {
      button().dispatchEvent(pointerDown(2));
      expect(presses).toBe(0);
    });

    it('emits once on a keyboard click, which carries no click count', () => {
      button().click();
      expect(presses).toBe(1);
    });

    it('never emits while disabled', () => {
      set('disabled', true);
      button().dispatchEvent(pointerDown(0));
      button().click();
      expect(presses).toBe(0);
    });
  });

  describe('default pressOn', () => {
    it('emits on click and not on pointer down', () => {
      button().dispatchEvent(pointerDown(0));
      expect(presses).toBe(0);
      button().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      expect(presses).toBe(1);
    });
  });
});
