import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SidVoiceKnob,
  SidVoiceStripComponent,
  SidVoiceStripModel,
  SidVoiceSwitch,
} from './sid-voice-strip.component';
import { WaveformKind } from '../waveform-button/waveform-button.component';

const KNOBS: readonly SidVoiceKnob[] = [
  'coarse',
  'fine',
  'pulseWidth',
  'attack',
  'decay',
  'sustain',
  'release',
];

function makeModel(overrides: Partial<SidVoiceStripModel> = {}): SidVoiceStripModel {
  const knob = (name: string) => ({
    value: 0,
    min: -1,
    max: 1,
    home: 0,
    step: 0.01,
    accessibleName: `Deck A voice 1 ${name}`,
  });
  return {
    title: 'Voice 1',
    knobs: {
      coarse: knob('coarse'),
      fine: knob('fine'),
      pulseWidth: knob('pulse width'),
      attack: knob('attack'),
      decay: knob('decay'),
      sustain: knob('sustain'),
      release: knob('release'),
    },
    waveformLock: null,
    waveformNames: {
      triangle: 'Triangle, voice 1',
      sawtooth: 'Sawtooth, voice 1',
      pulse: 'Pulse, voice 1',
      noise: 'Noise, voice 1',
    },
    switches: {
      ring: { locked: false, accessibleName: 'Ring, voice 1' },
      sync: { locked: false, accessibleName: 'Sync, voice 1' },
      filter: { locked: false, accessibleName: 'Filter, voice 1' },
    },
    disabled: false,
    ...overrides,
  };
}

describe('SidVoiceStripComponent', () => {
  let fixture: ComponentFixture<SidVoiceStripComponent>;
  let component: SidVoiceStripComponent;
  let host: HTMLElement;

  function render(model: SidVoiceStripModel = makeModel()): void {
    fixture.componentRef.setInput('model', model);
    fixture.detectChanges();
  }

  const control = (id: string) => host.querySelector(`[data-control="${id}"]`) as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SidVoiceStripComponent] }).compileComponents();
    fixture = TestBed.createComponent(SidVoiceStripComponent);
    component = fixture.componentInstance;
    host = fixture.nativeElement;
    render();
  });

  it('renders each pinned data-control exactly once', () => {
    const ids = [
      'wave-triangle',
      'wave-sawtooth',
      'wave-pulse',
      'wave-noise',
      'coarse',
      'fine',
      'pulse-width',
      'attack',
      'decay',
      'sustain',
      'release',
      'ring',
      'sync',
      'filter',
    ];
    for (const id of ids) {
      expect(host.querySelectorAll(`[data-control="${id}"]`).length, id).toBe(1);
    }
    expect(host.querySelectorAll('[data-control]').length).toBe(ids.length);
  });

  it('does not set data-voice itself', () => {
    expect(host.hasAttribute('data-voice')).toBe(false);
    expect(host.querySelector('[data-voice]')).toBeNull();
  });

  it('re-emits each knob change with its id', () => {
    const ids: Record<SidVoiceKnob, string> = {
      coarse: 'coarse',
      fine: 'fine',
      pulseWidth: 'pulse-width',
      attack: 'attack',
      decay: 'decay',
      sustain: 'sustain',
      release: 'release',
    };
    const spy = vi.fn();
    component.knobChange.subscribe(spy);

    KNOBS.forEach((knob, i) => {
      const range = control(ids[knob]).querySelector('input[type="range"]') as HTMLInputElement;
      range.value = String((i + 1) / 10);
      range.dispatchEvent(new Event('input'));
      expect(spy).toHaveBeenLastCalledWith({ knob, value: (i + 1) / 10 });
    });
    expect(spy).toHaveBeenCalledTimes(KNOBS.length);
  });

  it('re-emits waveform and switch presses with their ids', () => {
    const waves = vi.fn();
    const switches = vi.fn();
    component.waveformPress.subscribe(waves);
    component.switchPress.subscribe(switches);

    const kinds: WaveformKind[] = ['triangle', 'sawtooth', 'pulse', 'noise'];
    for (const kind of kinds) {
      (control(`wave-${kind}`).querySelector('button') as HTMLButtonElement).click();
    }
    const sw: SidVoiceSwitch[] = ['ring', 'sync', 'filter'];
    for (const id of sw) {
      (control(id).querySelector('button') as HTMLButtonElement).click();
    }

    expect(waves.mock.calls.map((c) => c[0])).toEqual(kinds);
    expect(switches.mock.calls.map((c) => c[0])).toEqual(sw);
  });

  it('reaches aria-pressed through the waveform and switch locks', () => {
    render(
      makeModel({
        waveformLock: 'triangle',
        switches: {
          ring: { locked: false, accessibleName: 'Ring' },
          sync: { locked: true, accessibleName: 'Sync' },
          filter: { locked: false, accessibleName: 'Filter' },
        },
      }),
    );
    const pressed = (id: string) =>
      control(id).querySelector('button')?.getAttribute('aria-pressed');

    expect(pressed('wave-triangle')).toBe('true');
    expect(pressed('wave-sawtooth')).toBe('false');
    expect(pressed('sync')).toBe('true');
    expect(pressed('ring')).toBe('false');
  });

  it('disables every child with the model', () => {
    render(makeModel({ disabled: true }));

    const buttons = host.querySelectorAll('button');
    const ranges = host.querySelectorAll('input[type="range"]');
    expect(buttons.length).toBe(7);
    expect(ranges.length).toBe(7);
    buttons.forEach((b) => expect(b.disabled).toBe(true));
    ranges.forEach((r) => expect((r as HTMLInputElement).disabled).toBe(true));
  });

  it('returns the same child instances in the pinned order', () => {
    const targets = component.liveTargets();

    expect(component.liveTargets().waveforms[0]).toBe(targets.waveforms[0]);
    expect(component.liveTargets().attack).toBe(targets.attack);

    targets.waveforms[1].setLiveLight(true, false);
    expect(control('wave-sawtooth').hasAttribute('data-lit')).toBe(true);
    expect(control('wave-triangle').hasAttribute('data-lit')).toBe(false);

    targets.ring.setLiveLight(true, false);
    targets.filter.setLiveLight(false, true);
    expect(control('ring').hasAttribute('data-lit')).toBe(true);
    expect(control('filter').hasAttribute('data-ghost')).toBe(true);

    targets.pulseWidth.setLiveLevel(0.5);
    const ring = control('pulse-width').querySelector('.live-ring') as SVGPathElement;
    expect(ring.style.strokeDashoffset).toBe('50');
    const other = control('fine').querySelector('.live-ring') as SVGPathElement;
    expect(other.style.strokeDashoffset).toBe('');
  });

  it('keeps every control focusable and in the deck strip order', () => {
    const order = [
      'wave-triangle',
      'wave-sawtooth',
      'wave-pulse',
      'wave-noise',
      'coarse',
      'fine',
      'pulse-width',
      'attack',
      'decay',
      'sustain',
      'release',
      'ring',
      'sync',
      'filter',
    ];
    const focusables = Array.from(
      host.querySelectorAll<HTMLElement>('button, input[type="range"]'),
    );

    expect(focusables.map((el) => el.closest('[data-control]')?.getAttribute('data-control'))).toEqual(
      order,
    );
    for (const el of focusables) {
      expect(el.tabIndex).toBeGreaterThanOrEqual(0);
    }
  });
});
