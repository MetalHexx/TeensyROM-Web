import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { vi } from 'vitest';
import {
  DjStore,
  EMPTY_DECK_LOOPS,
  HOME_DECK_PANEL,
  MixerService,
  SidPanelPainter,
  type DeckPanelTargets,
  type Slot,
} from '@teensyrom-nx/application';
import { DjSidPanelComponent } from './dj-sid-panel.component';
import type { DeckRef } from '../deck-ref';

const DECK_A: DeckRef = { slot: 'A', letter: 'A', index: 0 };
const DECK_B: DeckRef = { slot: 'B', letter: 'B', index: 1 };

type Store = InstanceType<typeof DjStore>;
type TuneReference = Parameters<Store['setDeckLoaded']>[0]['reference'];

function createMixerServiceStub() {
  return {
    setVoiceKnob: vi.fn(),
    setFilterKnob: vi.fn(),
    setKeySemitones: vi.fn(),
    pressWaveform: vi.fn(),
    pressSwitch: vi.fn(),
    pressFilterMode: vi.fn(),
    panic: vi.fn(),
    setKeyDisplayFormat: vi.fn(),
  };
}

function render(decks: readonly DeckRef[] = [DECK_A, DECK_B]) {
  const mixer = createMixerServiceStub();
  const detach = vi.fn();
  const painter = {
    attach: vi.fn<(slot: Slot, targets: DeckPanelTargets) => () => void>(() => detach),
  };

  TestBed.configureTestingModule({
    imports: [DjSidPanelComponent],
    providers: [
      provideNoopAnimations(),
      { provide: MixerService, useValue: mixer },
      { provide: SidPanelPainter, useValue: painter },
    ],
  });

  const store = TestBed.inject(DjStore);
  const fixture: ComponentFixture<DjSidPanelComponent> =
    TestBed.createComponent(DjSidPanelComponent);
  fixture.componentRef.setInput('decks', decks);
  fixture.detectChanges();
  return { fixture, store, mixer, painter, detach };
}

/** Puts a settled, shapeable tune on the deck, so its panel controls are live. */
function makeShapeable(store: Store, slot: Slot): void {
  const reference = {
    identity: { sidHash: `hash-${slot}`, subtune: 1 },
    title: 'Test Tune',
    author: 'Test Author',
    released: '2024 Test',
    subtuneCount: 1,
    byteLength: 1024,
  } as TuneReference;
  store.setDeckLoaded({ slot, reference });
  store.setDeckStatus({ slot, status: 'playing' });
}

function find<T extends HTMLElement = HTMLElement>(
  fixture: ComponentFixture<DjSidPanelComponent>,
  selector: string
): T {
  const el = fixture.nativeElement.querySelector(selector);
  if (!el) throw new Error(`nothing matches ${selector}`);
  return el;
}

function button(fixture: ComponentFixture<DjSidPanelComponent>, name: string): HTMLButtonElement {
  return find(fixture, `button[aria-label="${name}"]`);
}

function knobInput(fixture: ComponentFixture<DjSidPanelComponent>, name: string): HTMLInputElement {
  return find(fixture, `input[aria-label="${name}"]`);
}

function moveKnob(
  fixture: ComponentFixture<DjSidPanelComponent>,
  name: string,
  value: string
): void {
  const input = knobInput(fixture, name);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function panicButton(
  fixture: ComponentFixture<DjSidPanelComponent>,
  letter: string
): HTMLButtonElement {
  return find(fixture, `[data-deck="${letter}"] [data-control="panic"] button`);
}

function keyReadoutText(fixture: ComponentFixture<DjSidPanelComponent>, letter: string): string {
  const knob = knobInput(fixture, `Deck ${letter} key`).closest('lib-rotary-knob');
  return knob?.querySelector('.scale-knob-readout')?.textContent?.trim() ?? '';
}

function notationButton(
  fixture: ComponentFixture<DjSidPanelComponent>,
  label: string
): HTMLButtonElement {
  const buttons = Array.from(
    fixture.nativeElement.querySelectorAll('[aria-label="Key notation"] button')
  ) as HTMLButtonElement[];
  const match = buttons.find((b) => b.textContent?.trim() === label);
  if (!match) throw new Error(`no key notation button ${label}`);
  return match;
}

describe('DjSidPanelComponent', () => {
  it('sits in a scaling container, not a compact card', () => {
    const { fixture } = render();
    const host: HTMLElement = fixture.nativeElement;

    expect(host.querySelector('lib-scaling-compact-card')).toBeNull();
    expect(host.querySelector('lib-scaling-container > lib-synth-panel.faceplate')).not.toBeNull();
  });

  describe('the bindings button', () => {
    function bindingsButton(fixture: ComponentFixture<DjSidPanelComponent>): HTMLButtonElement {
      return find(fixture, '.panel-header button');
    }

    it('reports whether the panel is open, and changes its name with it', () => {
      const { fixture } = render();

      expect(bindingsButton(fixture).getAttribute('aria-expanded')).toBe('false');
      const closedName = bindingsButton(fixture).getAttribute('aria-label');

      fixture.componentRef.setInput('bindingsOpen', true);
      fixture.detectChanges();

      expect(bindingsButton(fixture).getAttribute('aria-expanded')).toBe('true');
      expect(bindingsButton(fixture).getAttribute('aria-label')).not.toBe(closedName);
    });

    it('emits bindingsToggle when pressed', () => {
      const { fixture } = render();
      const toggled = vi.fn();
      fixture.componentInstance.bindingsToggle.subscribe(toggled);

      bindingsButton(fixture).click();

      expect(toggled).toHaveBeenCalledTimes(1);
    });

    it('takes keyboard focus from focusBindingsButton', () => {
      const { fixture } = render();
      document.body.appendChild(fixture.nativeElement);

      fixture.componentInstance.focusBindingsButton();

      expect(document.activeElement).toBe(bindingsButton(fixture));
      fixture.nativeElement.remove();
    });
  });

  describe('the anchors', () => {
    it("wraps each deck's controls in its data-deck, with three numbered voice strips", () => {
      const { fixture } = render();
      const wrappers = Array.from(fixture.nativeElement.querySelectorAll('.deck')) as HTMLElement[];

      expect(wrappers.map((w) => w.getAttribute('data-deck'))).toEqual(['A', 'B']);
      for (const wrapper of wrappers) {
        const voices = Array.from(wrapper.querySelectorAll('lib-sid-voice-strip'));
        expect(voices.map((v) => v.getAttribute('data-voice'))).toEqual(['1', '2', '3']);
        expect(wrapper.querySelectorAll('[data-control="key"]')).toHaveLength(1);
        expect(wrapper.querySelectorAll('[data-control="panic"]')).toHaveLength(1);
        expect(wrapper.querySelectorAll('lib-sid-filter-section')).toHaveLength(1);
      }
    });

    it('lists each deck left to right, with the second deck mirrored to Key then Filter', () => {
      const { fixture } = render();
      const order = (letter: string) =>
        Array.from(
          fixture.nativeElement.querySelectorAll(
            `[data-deck="${letter}"] .lower > *`
          ) as NodeListOf<HTMLElement>
        ).map((el) => el.tagName.toLowerCase());

      expect(order('A')).toEqual(['lib-sid-filter-section', 'lib-panel-section']);
      expect(order('B')).toEqual(['lib-panel-section', 'lib-sid-filter-section']);
    });

    it('renders one Camelot / Note switch for both decks', () => {
      const { fixture } = render();

      expect(fixture.nativeElement.querySelectorAll('lib-segmented-control')).toHaveLength(1);
    });
  });

  describe('the models', () => {
    it('disables every control of a deck that cannot be shaped except Panic, and enables the one that can', () => {
      const { fixture, store } = render();
      expect(knobInput(fixture, 'Deck A voice 2 attack').disabled).toBe(true);
      expect(button(fixture, 'Deck A voice 1 ring').disabled).toBe(true);
      expect(panicButton(fixture, 'A').disabled).toBe(false);

      makeShapeable(store, 'A');
      fixture.detectChanges();

      expect(knobInput(fixture, 'Deck A voice 2 attack').disabled).toBe(false);
      expect(button(fixture, 'Deck A voice 1 ring').disabled).toBe(false);
      expect(knobInput(fixture, 'Deck B voice 2 attack').disabled).toBe(true);
    });

    it("shows each deck's own offsets, with Fine stepping one cent from the keys", () => {
      const { fixture, store } = render();
      store.setVoiceStrip({ slot: 'B', voice: 1, patch: { attack: 4, fine: -12.5 } });
      store.setDeckPanel({ slot: 'B', patch: { cutoff: 300, keySemitones: 3 } });
      fixture.detectChanges();

      expect(knobInput(fixture, 'Deck B voice 2 attack').value).toBe('4');
      expect(knobInput(fixture, 'Deck B voice 2 fine').value).toBe('-12.5');
      expect(knobInput(fixture, 'Deck B voice 2 fine').step).toBe('1');
      expect(knobInput(fixture, 'Deck B filter cutoff').value).toBe('300');
      expect(knobInput(fixture, 'Deck B key').value).toBe('3');
      expect(knobInput(fixture, 'Deck A voice 2 attack').value).toBe('0');
    });

    it('marks a locked waveform, switch and filter mode as pressed, and nothing else', () => {
      const { fixture, store } = render();
      store.setVoiceStrip({
        slot: 'A',
        voice: 2,
        patch: { waveformLock: 'pulse', ringLock: false },
      });
      store.setDeckPanel({ slot: 'A', patch: { filterModeLock: 'band-pass' } });
      fixture.detectChanges();
      const pressed = (name: string) => button(fixture, name).getAttribute('aria-pressed');

      expect(pressed('Deck A voice 3 pulse')).toBe('true');
      expect(pressed('Deck A voice 3 noise')).toBe('false');
      expect(pressed('Deck A voice 3 ring')).toBe('true');
      expect(pressed('Deck A voice 3 sync')).toBe('false');
      expect(pressed('Deck A filter band-pass')).toBe('true');
      expect(pressed('Deck A filter low-pass')).toBe('false');
      expect(pressed('Deck B voice 3 pulse')).toBe('false');
    });
  });

  describe('the events', () => {
    it('sends a voice knob to setVoiceKnob with its deck, voice index and knob', () => {
      const { fixture, store, mixer } = render();
      makeShapeable(store, 'B');
      fixture.detectChanges();

      moveKnob(fixture, 'Deck B voice 2 attack', '5');
      moveKnob(fixture, 'Deck B voice 3 pulse width', '-200');

      expect(mixer.setVoiceKnob.mock.calls).toEqual([
        ['B', 1, 'attack', 5],
        ['B', 2, 'pulseWidth', -200],
      ]);
    });

    it('sends the filter knobs to setFilterKnob', () => {
      const { fixture, store, mixer } = render();
      makeShapeable(store, 'A');
      fixture.detectChanges();

      moveKnob(fixture, 'Deck A filter cutoff', '100');
      moveKnob(fixture, 'Deck A filter resonance', '-3');

      expect(mixer.setFilterKnob.mock.calls).toEqual([
        ['A', 'cutoff', 100],
        ['A', 'resonance', -3],
      ]);
    });

    it('sends waveform, switch and filter mode presses with the voice index', () => {
      const { fixture, store, mixer } = render();
      makeShapeable(store, 'A');
      makeShapeable(store, 'B');
      fixture.detectChanges();

      button(fixture, 'Deck A voice 3 pulse').click();
      button(fixture, 'Deck B voice 1 ring').click();
      button(fixture, 'Deck A filter band-pass').click();

      expect(mixer.pressWaveform.mock.calls).toEqual([['A', 2, 'pulse']]);
      expect(mixer.pressSwitch.mock.calls).toEqual([['B', 0, 'ring']]);
      expect(mixer.pressFilterMode.mock.calls).toEqual([['A', 'band-pass']]);
    });

    it('resets only the pressed deck with Panic, even with nothing loaded', () => {
      const { fixture, mixer } = render();

      panicButton(fixture, 'B').click();

      expect(mixer.panic.mock.calls).toEqual([['B']]);
    });

    it('sends the Key knob to setKeySemitones with its deck, and double-click returns it to home', () => {
      const { fixture, store, mixer } = render();
      makeShapeable(store, 'B');
      store.setDeckPanel({ slot: 'B', patch: { keySemitones: 6 } });
      fixture.detectChanges();

      moveKnob(fixture, 'Deck B key', '-5');
      knobInput(fixture, 'Deck B key').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      expect(mixer.setKeySemitones.mock.calls).toEqual([
        ['B', -5],
        ['B', 0],
      ]);
    });

    it("dispatches the chosen notation to setKeyDisplayFormat, with the store's format selected", () => {
      const { fixture, store, mixer } = render();
      expect(notationButton(fixture, 'Camelot').getAttribute('aria-checked')).toBe('true');

      notationButton(fixture, 'Note').click();
      expect(mixer.setKeyDisplayFormat).toHaveBeenLastCalledWith('note');

      store.setKeyDisplayFormat({ format: 'note' });
      fixture.detectChanges();
      expect(notationButton(fixture, 'Note').getAttribute('aria-checked')).toBe('true');

      notationButton(fixture, 'Camelot').click();
      expect(mixer.setKeyDisplayFormat).toHaveBeenLastCalledWith('camelot');
    });
  });

  describe('the Key readout', () => {
    it("shows the detected key in the store's format, and the signed offset when none is detected", () => {
      const { fixture, store } = render();
      store.setDeckDetectedKey({
        slot: 'A',
        detectedKey: { tonic: 1, mode: 'minor', camelot: '8B' },
      });
      store.setDeckPanel({ slot: 'B', patch: { keySemitones: -5 } });
      fixture.detectChanges();

      expect(keyReadoutText(fixture, 'A')).toBe('8B');
      expect(keyReadoutText(fixture, 'B')).toBe('−5');

      store.setKeyDisplayFormat({ format: 'note' });
      fixture.detectChanges();

      expect(keyReadoutText(fixture, 'A')).toBe('C#m');
    });
  });

  describe('the settings sign', () => {
    const marker = (id: string) => ({
      id,
      start: { frame: 100, offsetFrames: 0 },
      end: null,
      voices: [0, 1, 2],
      settings: null,
      ownSettings: true,
      ready: true,
    });

    function sign(fixture: ComponentFixture<DjSidPanelComponent>, letter: string) {
      const el = find(
        fixture,
        `lib-deck-settings-sign[aria-label^="Settings in play deck ${letter}"]`
      );
      return { name: el.getAttribute('aria-label'), own: el.hasAttribute('data-own') };
    }

    it('sits beside each deck label and follows the settings in play per deck', () => {
      const { fixture, store } = render();
      const cells = fixture.nativeElement.querySelectorAll('.deck-label-cell');
      expect(
        Array.from(cells).map((cell) =>
          Array.from((cell as HTMLElement).children).map((child) => child.tagName.toLowerCase())
        )
      ).toEqual(Array(2).fill(['lib-deck-label', 'lib-deck-settings-sign']));
      expect(sign(fixture, 'A')).toEqual({ name: 'Settings in play deck A: Main', own: false });

      store.setDeckLoops({
        slot: 'A',
        loops: {
          ...EMPTY_DECK_LOOPS,
          markers: [marker('a'), marker('b')],
          settingsInPlayId: 'b',
          mainSettings: { panel: HOME_DECK_PANEL, mutes: [false, false, false] },
        },
      });
      fixture.detectChanges();

      expect(sign(fixture, 'A')).toEqual({ name: 'Settings in play deck A: Item 2', own: true });
      expect(sign(fixture, 'B')).toEqual({ name: 'Settings in play deck B: Main', own: false });

      store.setDeckLoops({ slot: 'A', loops: { ...EMPTY_DECK_LOOPS, markers: [marker('a')] } });
      fixture.detectChanges();

      expect(sign(fixture, 'A')).toEqual({ name: 'Settings in play deck A: Main', own: false });
    });
  });

  describe('the painter', () => {
    it('attaches each deck once after render, with three voice strips and the filter targets', () => {
      const { painter } = render();

      expect(painter.attach.mock.calls.map(([slot]) => slot)).toEqual(['A', 'B']);
      for (const [, targets] of painter.attach.mock.calls) {
        expect(targets.voices).toHaveLength(3);
        expect(targets.filterModes).toHaveLength(3);
        expect(typeof targets.cutoff.setLiveLevel).toBe('function');
      }
    });

    it('gives each deck its own strips', () => {
      const { painter } = render();
      const [[, a], [, b]] = painter.attach.mock.calls;

      expect(a.voices[0]).not.toBe(b.voices[0]);
      expect(a.cutoff).not.toBe(b.cutoff);
    });

    it('detaches every deck on destroy, and not before', () => {
      const { fixture, detach } = render();
      fixture.detectChanges();
      expect(detach).not.toHaveBeenCalled();

      fixture.destroy();

      expect(detach).toHaveBeenCalledTimes(2);
    });
  });
});
