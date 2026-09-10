import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { StatusLedComponent, StatusLedState } from './status-led.component';

describe('StatusLedComponent', () => {
  let fixture: ComponentFixture<StatusLedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusLedComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatusLedComponent);
    fixture.componentRef.setInput('state', 'stopped' satisfies StatusLedState);
    fixture.componentRef.setInput('label', 'Stopped');
    fixture.detectChanges();
  });

  function dot(): HTMLElement {
    return fixture.nativeElement.querySelector('.led');
  }

  it.each<StatusLedState>(['stopped', 'playing', 'paused', 'ended', 'error', 'analyzing'])(
    'carries the %s modifier class for that state',
    (state) => {
      fixture.componentRef.setInput('state', state);
      fixture.detectChanges();

      expect(dot().classList.contains(`led--${state}`)).toBe(true);
    }
  );

  it('renders the caller-supplied label as text', () => {
    fixture.componentRef.setInput('label', 'Analyzing…');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('Analyzing…');
  });

  it('hides the dot from assistive technology, leaving the label as the accessible content', () => {
    expect(dot().getAttribute('aria-hidden')).toBe('true');
  });
});
