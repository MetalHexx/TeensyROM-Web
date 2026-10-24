import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SynthKeyComponent } from './synth-key.component';

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
});
