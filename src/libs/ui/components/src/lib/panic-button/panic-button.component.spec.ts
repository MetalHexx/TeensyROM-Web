import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PanicButtonComponent } from './panic-button.component';

describe('PanicButtonComponent', () => {
  let fixture: ComponentFixture<PanicButtonComponent>;
  let component: PanicButtonComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PanicButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PanicButtonComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('accessibleName', 'Panic: silence all voices');
    fixture.detectChanges();
  });

  function button(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button');
  }

  it('is a native, focusable button named by accessibleName', () => {
    expect(button().type).toBe('button');
    expect(button().getAttribute('aria-label')).toBe('Panic: silence all voices');
    expect(button().tabIndex).toBeGreaterThanOrEqual(0);
    button().focus();
    expect(document.activeElement).toBe(button());
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
});
