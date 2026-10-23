import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DeckChannelStripComponent, DeckChannelStripModel } from './deck-channel-strip.component';

function testModel(overrides: Partial<DeckChannelStripModel> = {}): DeckChannelStripModel {
  return {
    voiceAccessibleName: 'Voice deck A',
    speedAccessibleName: 'Speed deck A',
    voices: [1, 2, 3].map((n) => ({
      label: `V${n}`,
      muted: n === 2,
      holdLabel: 'Kill',
      muteAccessibleName: `Mute voice ${n} deck A`,
      holdAccessibleName: `Kill voice ${n} deck A`,
    })),
    speedText: '1.000×',
    nudging: false,
    fader: {
      value: 1,
      min: 0.5,
      max: 2,
      step: 0.001,
      home: 1,
      accessibleName: 'Speed multiplier deck A',
    },
    nudge: { downAccessibleName: 'Nudge speed down deck A', upAccessibleName: 'Nudge speed up deck A' },
    jumpButtons: [
      { id: 'up', label: '+50%', accessibleName: 'Speed up 50% deck A' },
      { id: 'home', label: '1×', accessibleName: 'Speed home deck A' },
      { id: 'down', label: '-50%', accessibleName: 'Speed down 50% deck A' },
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
  let faders: number[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DeckChannelStripComponent] }).compileComponents();
    fixture = TestBed.createComponent(DeckChannelStripComponent);
    fixture.componentRef.setInput('model', testModel());
    muted = [];
    held = [];
    nudges = [];
    jumps = [];
    faders = [];
    const strip = fixture.componentInstance;
    strip.mutedChange.subscribe((e) => muted.push(e));
    strip.heldChange.subscribe((e) => held.push(e));
    strip.nudgeChange.subscribe((e) => nudges.push(e));
    strip.jump.subscribe((id) => jumps.push(id));
    strip.faderChange.subscribe((v) => faders.push(v));
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
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  function keyup(target: HTMLElement): void {
    target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

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

  it('exposes the anchors by data-control', () => {
    for (const control of ['speed', 'speed-nudge-up', 'speed-nudge-down', 'jump-up', 'jump-home', 'jump-down']) {
      expect(q(`[data-control="${control}"]`), control).not.toBeNull();
    }
  });

  it('tints the speed display while nudging, showing only the speed text', () => {
    const display = q('.speed-display');
    expect(display.hasAttribute('data-nudging')).toBe(false);

    setModel({ nudging: true, speedText: '1.050×' });
    expect(q('.speed-display').hasAttribute('data-nudging')).toBe(true);
    expect(q('.speed-display').textContent?.trim()).toBe('1.050×');
  });

  it('reports every native control disabled when the strip is disabled', () => {
    setModel({ disabled: true });
    const names = [
      'Speed multiplier deck A',
      'Mute voice 1 deck A',
      'Kill voice 1 deck A',
      'Nudge speed up deck A',
      'Speed home deck A',
    ];
    for (const name of names) {
      expect((byName(name) as HTMLButtonElement | HTMLInputElement).disabled, name).toBe(true);
    }
  });
});
