import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { HoldPadComponent } from './hold-pad.component';

describe('HoldPadComponent', () => {
  let fixture: ComponentFixture<HoldPadComponent>;
  let emitted: boolean[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HoldPadComponent] }).compileComponents();
    fixture = TestBed.createComponent(HoldPadComponent);
    fixture.componentRef.setInput('accessibleName', 'Kill voice 1 deck A');
    fixture.componentRef.setInput('label', 'Kill');
    emitted = [];
    fixture.componentInstance.heldChange.subscribe((held) => emitted.push(held));
    fixture.detectChanges();
  });

  function button(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button');
  }

  function key(type: 'keydown' | 'keyup', k = 'Enter'): void {
    button().dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  it('carries the accessible name', () => {
    expect(button().getAttribute('aria-label')).toBe('Kill voice 1 deck A');
  });

  it.each(['Enter', ' '])('holds on %j and reflects held as data-held and aria-pressed', (k) => {
    expect(button().getAttribute('aria-pressed')).toBe('false');
    expect(button().hasAttribute('data-held')).toBe(false);

    key('keydown', k);
    expect(emitted).toEqual([true]);
    expect(button().getAttribute('aria-pressed')).toBe('true');
    expect(button().hasAttribute('data-held')).toBe(true);

    key('keyup', k);
    expect(emitted).toEqual([true, false]);
    expect(button().getAttribute('aria-pressed')).toBe('false');
    expect(button().hasAttribute('data-held')).toBe(false);
  });

  it('emits one release when disabled mid-hold', () => {
    key('keydown');
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(emitted).toEqual([true, false]);
    expect(button().disabled).toBe(true);
  });

  it('emits nothing while disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    key('keydown');
    expect(emitted).toEqual([]);
  });

  it('reflects the shape on the host', () => {
    expect(fixture.nativeElement.getAttribute('data-shape')).toBe('pill');
    fixture.componentRef.setInput('shape', 'round');
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('data-shape')).toBe('round');
  });
});
