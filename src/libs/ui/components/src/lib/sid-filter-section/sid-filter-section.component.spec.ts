import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FilterModeKind,
  SidFilterSectionComponent,
  SidFilterSectionModel,
} from './sid-filter-section.component';

function makeModel(overrides: Partial<SidFilterSectionModel> = {}): SidFilterSectionModel {
  const knob = (name: string) => ({
    value: 0,
    min: -1,
    max: 1,
    home: 0,
    step: 0.01,
    accessibleName: `Deck A filter ${name}`,
  });
  return {
    cutoff: knob('cutoff'),
    resonance: knob('resonance'),
    modeLock: null,
    modeNames: {
      'low-pass': 'Low-pass',
      'band-pass': 'Band-pass',
      'high-pass': 'High-pass',
    },
    disabled: false,
    ...overrides,
  };
}

describe('SidFilterSectionComponent', () => {
  let fixture: ComponentFixture<SidFilterSectionComponent>;
  let component: SidFilterSectionComponent;
  let host: HTMLElement;

  function render(model: SidFilterSectionModel = makeModel()): void {
    fixture.componentRef.setInput('model', model);
    fixture.detectChanges();
  }

  const control = (id: string) => host.querySelector(`[data-control="${id}"]`) as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidFilterSectionComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(SidFilterSectionComponent);
    component = fixture.componentInstance;
    host = fixture.nativeElement;
    render();
  });

  it('renders each pinned data-control exactly once', () => {
    const ids = [
      'filter-cutoff',
      'filter-resonance',
      'filter-low-pass',
      'filter-band-pass',
      'filter-high-pass',
    ];
    for (const id of ids) {
      expect(host.querySelectorAll(`[data-control="${id}"]`).length, id).toBe(1);
    }
    expect(host.querySelectorAll('[data-control]').length).toBe(ids.length);
  });

  it('re-emits each knob change with its id', () => {
    const spy = vi.fn();
    component.knobChange.subscribe(spy);

    for (const [id, knob] of [
      ['filter-cutoff', 'cutoff'],
      ['filter-resonance', 'resonance'],
    ] as const) {
      const range = control(id).querySelector('input[type="range"]') as HTMLInputElement;
      range.value = '0.4';
      range.dispatchEvent(new Event('input'));
      expect(spy).toHaveBeenLastCalledWith({ knob, value: 0.4 });
    }
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('re-emits mode presses with their ids, labelled LP/BP/HP', () => {
    const spy = vi.fn();
    component.modePress.subscribe(spy);
    const modes: FilterModeKind[] = ['low-pass', 'band-pass', 'high-pass'];

    for (const mode of modes) {
      (control(`filter-${mode}`).querySelector('button') as HTMLButtonElement).click();
    }

    expect(spy.mock.calls.map((c) => c[0])).toEqual(modes);
    expect(modes.map((m) => control(`filter-${m}`).textContent?.trim())).toEqual([
      'LP',
      'BP',
      'HP',
    ]);
  });

  it('reaches aria-pressed through the mode lock', () => {
    render(makeModel({ modeLock: 'band-pass' }));
    const pressed = (m: string) =>
      control(`filter-${m}`).querySelector('button')?.getAttribute('aria-pressed');

    expect(pressed('band-pass')).toBe('true');
    expect(pressed('low-pass')).toBe('false');
    expect(pressed('high-pass')).toBe('false');
  });

  it('disables every child with the model', () => {
    render(makeModel({ disabled: true }));

    const buttons = host.querySelectorAll('button');
    const ranges = host.querySelectorAll('input[type="range"]');
    expect(buttons.length).toBe(3);
    expect(ranges.length).toBe(2);
    buttons.forEach((b) => expect(b.disabled).toBe(true));
    ranges.forEach((r) => expect((r as HTMLInputElement).disabled).toBe(true));
  });

  it('returns the same child instances in the pinned order', () => {
    const targets = component.liveTargets();

    expect(component.liveTargets().modes[1]).toBe(targets.modes[1]);

    targets.modes[2].setLiveLight(true, false);
    expect(control('filter-high-pass').hasAttribute('data-lit')).toBe(true);
    expect(control('filter-low-pass').hasAttribute('data-lit')).toBe(false);

    targets.resonance.setLiveLevel(0.5);
    const ring = control('filter-resonance').querySelector('.live-ring') as SVGPathElement;
    expect(ring.style.strokeDashoffset).toBe('50');
    const other = control('filter-cutoff').querySelector('.live-ring') as SVGPathElement;
    expect(other.style.strokeDashoffset).toBe('');
  });

  it('keeps every control focusable and in order', () => {
    const focusables = Array.from(
      host.querySelectorAll<HTMLElement>('button, input[type="range"]'),
    );

    expect(focusables.map((el) => el.closest('[data-control]')?.getAttribute('data-control'))).toEqual(
      [
        'filter-cutoff',
        'filter-resonance',
        'filter-low-pass',
        'filter-band-pass',
        'filter-high-pass',
      ],
    );
    for (const el of focusables) {
      expect(el.tabIndex).toBeGreaterThanOrEqual(0);
    }
  });
});
