import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SynthFaderComponent } from './synth-fader.component';

describe('SynthFaderComponent', () => {
  let fixture: ComponentFixture<SynthFaderComponent>;
  let emitted: number[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SynthFaderComponent] }).compileComponents();
    fixture = TestBed.createComponent(SynthFaderComponent);
    fixture.componentRef.setInput('value', 1);
    fixture.componentRef.setInput('min', 0.5);
    fixture.componentRef.setInput('max', 2);
    fixture.componentRef.setInput('step', 0.001);
    fixture.componentRef.setInput('accessibleName', 'Speed multiplier deck A');
    emitted = [];
    fixture.componentInstance.valueChange.subscribe((v) => emitted.push(v));
    fixture.detectChanges();
  });

  function range(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input[type="range"]');
  }

  it('is a native range carrying the accessible name, bounds and value', () => {
    expect(range().getAttribute('aria-label')).toBe('Speed multiplier deck A');
    expect(range().min).toBe('0.5');
    expect(range().max).toBe('2');
    expect(range().step).toBe('0.001');
    expect(range().value).toBe('1');
  });

  it('emits the raw value unrounded', () => {
    range().value = '1.2345';
    range().dispatchEvent(new Event('input'));
    expect(emitted).toEqual([1.2345]);
  });

  it('emits nothing and reports disabled while disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(range().disabled).toBe(true);
    range().dispatchEvent(new Event('input'));
    expect(emitted).toEqual([]);
  });

  it('draws the home line at the home value along the travel, and none without a home', () => {
    expect(fixture.nativeElement.querySelector('.home')).toBeNull();

    fixture.componentRef.setInput('home', 1.25);
    fixture.detectChanges();
    const home = fixture.nativeElement.querySelector('.home') as HTMLElement;
    expect(Number(home.style.getPropertyValue('--synth-fader-home'))).toBeCloseTo(0.5);
  });
});
