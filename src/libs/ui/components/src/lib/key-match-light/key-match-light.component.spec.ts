import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { KeyMatchLightComponent, KeyMatchLightState } from './key-match-light.component';

describe('KeyMatchLightComponent', () => {
  let fixture: ComponentFixture<KeyMatchLightComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [KeyMatchLightComponent] }).compileComponents();
    fixture = TestBed.createComponent(KeyMatchLightComponent);
  });

  function show(state: KeyMatchLightState): void {
    fixture.componentRef.setInput('state', state);
    fixture.detectChanges();
  }

  const host = () => fixture.nativeElement as HTMLElement;

  it.each<[KeyMatchLightState, string]>([
    ['full', 'Key match: full'],
    ['close', 'Key match: close'],
    ['possible', 'Key match: possible'],
    ['clash', 'Key match: clash'],
    ['none', 'Key match: no key'],
  ])('labels the %s state as "%s"', (state, label) => {
    show(state);

    expect(host().getAttribute('role')).toBe('img');
    expect(host().getAttribute('aria-label')).toBe(label);
  });

  it.each<KeyMatchLightState>(['full', 'close', 'possible', 'clash', 'none'])(
    'carries the %s modifier class on a dot hidden from assistive technology',
    (state) => {
      show(state);
      const dot = host().querySelector('.led') as HTMLElement;

      expect(dot.classList.contains(`led--${state}`)).toBe(true);
      expect(dot.getAttribute('aria-hidden')).toBe('true');
    }
  );

  it('is not focusable', () => {
    show('full');

    expect(host().hasAttribute('tabindex')).toBe(false);
    expect(host().querySelector('[tabindex]')).toBeNull();
  });
});
