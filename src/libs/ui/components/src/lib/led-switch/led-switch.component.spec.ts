import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LedSwitchComponent } from './led-switch.component';

describe('LedSwitchComponent', () => {
  let fixture: ComponentFixture<LedSwitchComponent>;
  let component: LedSwitchComponent;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LedSwitchComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LedSwitchComponent);
    component = fixture.componentInstance;
    host = fixture.nativeElement;
    fixture.componentRef.setInput('label', 'Ring');
    fixture.componentRef.setInput('accessibleName', 'Ring modulation, voice 1');
    fixture.detectChanges();
  });

  function button(): HTMLButtonElement {
    return host.querySelector('button') as HTMLButtonElement;
  }

  it('is a native, focusable button named by accessibleName', () => {
    expect(button().type).toBe('button');
    expect(button().getAttribute('aria-label')).toBe('Ring modulation, voice 1');
    expect(button().tabIndex).toBeGreaterThanOrEqual(0);
    button().focus();
    expect(document.activeElement).toBe(button());
  });

  it('shows the label input', () => {
    expect(host.textContent).toContain('Ring');
  });

  it('emits press on click', () => {
    const spy = vi.fn();
    component.press.subscribe(spy);

    button().click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emits nothing when disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const spy = vi.fn();
    component.press.subscribe(spy);

    button().click();

    expect(spy).not.toHaveBeenCalled();
  });

  it('reflects locked as aria-pressed and data-locked', () => {
    expect(button().getAttribute('aria-pressed')).toBe('false');
    expect(host.hasAttribute('data-locked')).toBe(false);

    fixture.componentRef.setInput('locked', true);
    fixture.detectChanges();

    expect(button().getAttribute('aria-pressed')).toBe('true');
    expect(host.hasAttribute('data-locked')).toBe(true);
  });

  it('sets and clears data-lit and data-ghost immediately, without change detection', () => {
    component.setLiveLight(true, false);
    expect(host.hasAttribute('data-lit')).toBe(true);
    expect(host.hasAttribute('data-ghost')).toBe(false);

    component.setLiveLight(false, true);
    expect(host.hasAttribute('data-lit')).toBe(false);
    expect(host.hasAttribute('data-ghost')).toBe(true);

    component.setLiveLight(false, false);
    expect(host.hasAttribute('data-lit')).toBe(false);
    expect(host.hasAttribute('data-ghost')).toBe(false);
  });

  it('writes nothing when the same pair is set again', () => {
    component.setLiveLight(true, true);
    const toggle = vi.spyOn(host, 'toggleAttribute');

    component.setLiveLight(true, true);

    expect(toggle).not.toHaveBeenCalled();
  });
});
