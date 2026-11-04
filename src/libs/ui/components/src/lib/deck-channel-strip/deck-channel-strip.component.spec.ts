import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DeckChannelStripComponent, DeckChannelStripModel } from './deck-channel-strip.component';

function testModel(overrides: Partial<DeckChannelStripModel> = {}): DeckChannelStripModel {
  return {
    settingsSign: { text: 'Main', own: false, accessibleName: 'Settings in play deck A: Main' },
    voiceAccessibleName: 'Voice deck A',
    speedAccessibleName: 'Speed deck A',
    voices: [1, 2, 3].map((n) => ({
      label: `V${n}`,
      muted: n === 2,
      held: false,
      holdLabel: 'Kill',
      muteAccessibleName: `Mute voice ${n} deck A`,
      holdAccessibleName: `Kill voice ${n} deck A`,
    })),
    speedText: '0.00%',
    nudging: false,
    tapping: false,
    tapAccessibleName: 'Tap the beat deck A',
    fader: {
      value: 1,
      min: 0.5,
      max: 1.5,
      step: 0.0001,
      home: 1,
      accessibleName: 'Speed multiplier deck A',
      valueText: '0.00%',
    },
    nudge: {
      downAccessibleName: 'Nudge speed down deck A',
      upAccessibleName: 'Nudge speed up deck A',
      downHeld: false,
      upHeld: false,
    },
    jumpButtons: [
      { id: 'up', label: '+50%', accessibleName: 'Speed up 50% deck A' },
      { id: 'home', label: 'Home', accessibleName: 'Speed home deck A' },
      { id: 'down', label: '−50%', accessibleName: 'Speed down 50% deck A' },
    ],
    disabled: false,
    ...overrides,
  };
}

describe('DeckChannelStripComponent', () => {
  let fixture: ComponentFixture<DeckChannelStripComponent>;
  let muted: { index: number; muted: boolean }[];
  let held: { index: number; held: boolean }[];
  let nudges: { direction: 'up' | 'down'; held: boolean }[];
  let jumps: string[];
  let taps: number;
  let faders: number[];
  let wheels: { clicks: number; timeStampMs: number }[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeckChannelStripComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(DeckChannelStripComponent);
    fixture.componentRef.setInput('model', testModel());
    muted = [];
    held = [];
    nudges = [];
    jumps = [];
    taps = 0;
    faders = [];
    wheels = [];
    const strip = fixture.componentInstance;
    strip.mutedChange.subscribe((e) => muted.push(e));
    strip.heldChange.subscribe((e) => held.push(e));
    strip.nudgeChange.subscribe((e) => nudges.push(e));
    strip.jump.subscribe((id) => jumps.push(id));
    strip.tap.subscribe(() => taps++);
    strip.faderChange.subscribe((v) => faders.push(v));
    strip.faderWheel.subscribe((e) => wheels.push(e));
    fixture.detectChanges();
  });

  const el = (): HTMLElement => fixture.nativeElement;
  const q = <T extends HTMLElement>(selector: string): T => el().querySelector(selector) as T;
  const byName = (name: string): HTMLElement => q(`[aria-label="${name}"]`);

  function setModel(overrides: Partial<DeckChannelStripModel>): void {
    fixture.componentRef.setInput('model', testModel(overrides));
    fixture.detectChanges();
  }

  function keydown(target: HTMLElement): void {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    );
    fixture.detectChanges();
  }

  function keyup(target: HTMLElement): void {
    target.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'Enter', bubbles: true, cancelable: true })
    );
    fixture.detectChanges();
  }

  it('renders the settings sign at the top of the voice section, above V1', () => {
    setModel({
      settingsSign: { text: 'Loop 2', own: true, accessibleName: 'Settings in play deck A: Loop 2' },
    });
    const voices = q('section.voices');
    const sign = voices.querySelector('lib-deck-settings-sign') as HTMLElement;
    expect(sign.getAttribute('aria-label')).toBe('Settings in play deck A: Loop 2');
    expect(sign.hasAttribute('data-own')).toBe(true);
    const first = voices.querySelector('[data-voice="1"]') as HTMLElement;
    expect(sign.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('emits the inverse of the mute with the voice index, and reports mute as aria-pressed', () => {
    expect(byName('Mute voice 2 deck A').getAttribute('aria-pressed')).toBe('true');
    expect(byName('Mute voice 1 deck A').getAttribute('aria-pressed')).toBe('false');

    byName('Mute voice 1 deck A').click();
    byName('Mute voice 2 deck A').click();

    expect(muted).toEqual([
      { index: 0, muted: true },
      { index: 1, muted: false },
    ]);
  });

  it('lights the mute key while the voice plays', () => {
    expect(byName('Mute voice 1 deck A').hasAttribute('data-lit')).toBe(true);
    expect(byName('Mute voice 2 deck A').hasAttribute('data-lit')).toBe(false);
  });

  it('groups each pair under its 1-based voice number', () => {
    const pair = q('[data-voice="3"]');
    expect(pair.querySelector('[data-control="voice-mute"]')).not.toBeNull();
    expect(pair.querySelector('[data-control="voice-hold"]')).not.toBeNull();
  });

  it('emits a voice hold with its index on press and release', () => {
    const pad = byName('Kill voice 3 deck A');
    keydown(pad);
    keyup(pad);
    expect(held).toEqual([
      { index: 2, held: true },
      { index: 2, held: false },
    ]);
  });

  it('emits nudge direction on press and release', () => {
    const down = byName('Nudge speed down deck A');
    const up = byName('Nudge speed up deck A');
    keydown(up);
    keyup(up);
    keydown(down);
    keyup(down);
    expect(nudges).toEqual([
      { direction: 'up', held: true },
      { direction: 'up', held: false },
      { direction: 'down', held: true },
      { direction: 'down', held: false },
    ]);
  });

  it('releases a held nudge once when the strip becomes disabled mid-hold', () => {
    keydown(byName('Nudge speed up deck A'));
    setModel({ disabled: true });
    expect(nudges).toEqual([
      { direction: 'up', held: true },
      { direction: 'up', held: false },
    ]);
  });

  it('emits the jump id and the raw fader value', () => {
    byName('Speed home deck A').click();
    expect(jumps).toEqual(['home']);

    const range = byName('Speed multiplier deck A') as HTMLInputElement;
    range.value = '1.2345';
    range.dispatchEvent(new Event('input'));
    expect(faders).toEqual([1.2345]);
  });

  it('relays the fader wheel and announces the fader value text', () => {
    const range = byName('Speed multiplier deck A') as HTMLInputElement;
    expect(range.getAttribute('aria-valuetext')).toBe('0.00%');

    range.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
    expect(wheels.map((w) => w.clicks)).toEqual([1]);
  });

  it('exposes the anchors by data-control', () => {
    for (const control of [
      'speed',
      'tap',
      'speed-nudge-up',
      'speed-nudge-down',
      'jump-up',
      'jump-home',
      'jump-down',
    ]) {
      expect(q(`[data-control="${control}"]`), control).not.toBeNull();
    }
  });

  it('tints the speed display while nudging, showing only the speed text', () => {
    const display = q('.speed-display');
    expect(display.hasAttribute('data-nudging')).toBe(false);

    setModel({ nudging: true, speedText: '+5.00%' });
    expect(q('.speed-display').hasAttribute('data-nudging')).toBe(true);
    expect(q('.speed-display .percent').textContent?.trim()).toBe('+5.00%');
  });

  it('lights each pad from the model held state, with no pointer', () => {
    const lit = (control: string) =>
      q(`[data-control="${control}"] button`).hasAttribute('data-held');
    expect(['voice-hold', 'speed-nudge-down', 'speed-nudge-up'].map(lit)).toEqual([
      false,
      false,
      false,
    ]);

    setModel({
      voices: testModel().voices.map((voice, i) => ({ ...voice, held: i === 1 })),
      nudge: { ...testModel().nudge, upHeld: true },
    });
    const holds = Array.from(
      fixture.nativeElement.querySelectorAll('[data-control="voice-hold"] button')
    ).map((b) => (b as HTMLElement).hasAttribute('data-held'));
    expect(holds).toEqual([false, true, false]);
    expect([lit('speed-nudge-down'), lit('speed-nudge-up')]).toEqual([false, true]);
    expect(held).toEqual([]);
    expect(nudges).toEqual([]);
  });

  it('shows no tempo until a painter sets one, and writes only the figure of a live BPM', () => {
    const line = q('.speed-display .bpm');
    const figure = q('.speed-display .bpm .figure');
    expect(figure.textContent).toBe('---.--');
    expect(q('.speed-display .bpm .unit').textContent).toBe('BPM');
    expect(line.hasAttribute('data-none')).toBe(true);

    fixture.componentInstance.setLiveBpm('125.31 BPM');
    expect(figure.textContent).toBe('125.31');
    expect(q('.speed-display .bpm .unit').textContent).toBe('BPM');
    expect(line.hasAttribute('data-none')).toBe(false);

    fixture.componentInstance.setLiveBpm('126.00 BPM');
    expect(figure.textContent).toBe('126.00');
    expect(line.hasAttribute('data-none')).toBe(false);

    fixture.componentInstance.setLiveBpm('---.-- BPM');
    expect(figure.textContent).toBe('---.--');
    expect(line.hasAttribute('data-none')).toBe(true);
  });

  it('keeps a live BPM and its lit state through a model change', () => {
    fixture.componentInstance.setLiveBpm('98.50 BPM');
    setModel({ speedText: '+2.00%' });
    expect(q('.speed-display .bpm .figure').textContent).toBe('98.50');
    expect(q('.speed-display .bpm').hasAttribute('data-none')).toBe(false);
  });

  it('emits tap when the Tap key is pressed, and tints it and the display while tapping', () => {
    byName('Tap the beat deck A').click();
    expect(taps).toBe(1);
    expect(q('[data-control="tap"]').hasAttribute('data-tapping')).toBe(false);
    expect(q('.speed-display').hasAttribute('data-tapping')).toBe(false);

    setModel({ tapping: true });
    expect(q('[data-control="tap"]').hasAttribute('data-tapping')).toBe(true);
    expect(q('.speed-display').hasAttribute('data-tapping')).toBe(true);
  });

  it('reports every native control disabled when the strip is disabled', () => {
    setModel({ disabled: true });
    const names = [
      'Speed multiplier deck A',
      'Mute voice 1 deck A',
      'Kill voice 1 deck A',
      'Nudge speed up deck A',
      'Speed home deck A',
      'Tap the beat deck A',
    ];
    for (const name of names) {
      expect((byName(name) as HTMLButtonElement | HTMLInputElement).disabled, name).toBe(true);
    }
  });
});
