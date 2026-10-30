import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { C64ColorSwatchComponent } from './c64-color-swatch.component';

describe('C64ColorSwatchComponent', () => {
  let fixture: ComponentFixture<C64ColorSwatchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [C64ColorSwatchComponent] }).compileComponents();
    fixture = TestBed.createComponent(C64ColorSwatchComponent);
  });

  function render(inputs: Record<string, unknown>): HTMLElement {
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('paints the square with the color and is an image named after it', () => {
    const host = render({ colorIndex: 6 });

    expect(host.querySelector<HTMLElement>('.swatch')?.style.backgroundColor).toBe('rgb(46, 44, 155)');
    expect(host.getAttribute('role')).toBe('img');
    expect(host.getAttribute('aria-label')).toBe('Blue');
  });

  it('shows the name as text and drops the image role when showName is set', () => {
    const host = render({ colorIndex: 14, showName: true });

    expect(host.querySelector('.name')?.textContent).toBe('Light Blue');
    expect(host.getAttribute('role')).toBeNull();
    expect(host.getAttribute('aria-label')).toBeNull();
  });

  it('is hidden from assistive technology when decorative', () => {
    const host = render({ colorIndex: 2, decorative: true });

    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.getAttribute('role')).toBeNull();
  });

  it('renders an empty, named square for an out-of-range index', () => {
    const host = render({ colorIndex: 16 });

    expect(host.querySelector('.swatch--unknown')).toBeTruthy();
    expect(host.querySelector<HTMLElement>('.swatch')?.style.backgroundColor).toBe('');
    expect(host.getAttribute('aria-label')).toBe('Unknown color');
  });
});
