import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { CrossfaderComponent } from './crossfader.component';

describe('CrossfaderComponent', () => {
  let fixture: ComponentFixture<CrossfaderComponent>;
  let component: CrossfaderComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrossfaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CrossfaderComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('value', 0);
    fixture.componentRef.setInput('startLabel', 'A');
    fixture.componentRef.setInput('endLabel', 'B');
    fixture.componentRef.setInput('accessibleName', 'Crossfader, deck A to deck B');
    fixture.detectChanges();
  });

  function rangeInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input[type="range"]');
  }

  it('emits the raw numeric value unrounded on input', () => {
    const emitted: number[] = [];
    component.valueChange.subscribe((v) => emitted.push(v));

    const input = rangeInput();
    input.value = '0.137';
    input.dispatchEvent(new Event('input'));

    expect(emitted).toEqual([0.137]);
  });

  it('defaults min/max/step onto the underlying range input', () => {
    const input = rangeInput();

    expect(input.min).toBe('-1');
    expect(input.max).toBe('1');
    expect(input.step).toBe('0.01');
  });

  it('reaches custom min/max/step through to the underlying range input', () => {
    fixture.componentRef.setInput('min', 0);
    fixture.componentRef.setInput('max', 100);
    fixture.componentRef.setInput('step', 5);
    fixture.detectChanges();

    const input = rangeInput();
    expect(input.min).toBe('0');
    expect(input.max).toBe('100');
    expect(input.step).toBe('5');
  });

  it('labels its ends from the caller-supplied inputs', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('A');
    expect(text).toContain('B');
  });

  it('names itself from the caller-supplied accessible name', () => {
    expect(rangeInput().getAttribute('aria-label')).toBe('Crossfader, deck A to deck B');
  });

  it('reflects the value input rather than any local state', () => {
    fixture.componentRef.setInput('value', 0.42);
    fixture.detectChanges();

    expect(rangeInput().value).toBe('0.42');
  });
});
