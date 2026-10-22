import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { vi } from 'vitest';
import { DjStore, MixerService, type Slot } from '@teensyrom-nx/application';
import { DjMixerCardComponent } from './dj-mixer-card.component';
import type { DeckRef } from '../deck-ref';

const DECK_A: DeckRef = { slot: 'A', letter: 'A', index: 0 };
const DECK_B: DeckRef = { slot: 'B', letter: 'B', index: 1 };

type Store = InstanceType<typeof DjStore>;
type TuneReference = Parameters<Store['setDeckLoaded']>[0]['reference'];

function createMixerServiceStub() {
  return {
    setKeySemitones: vi.fn(),
    setKeyDisplayFormat: vi.fn(),
  };
}

function render(decks: readonly DeckRef[]) {
  const mixer = createMixerServiceStub();

  TestBed.configureTestingModule({
    imports: [DjMixerCardComponent],
    providers: [provideNoopAnimations(), { provide: MixerService, useValue: mixer }],
  });

  const store = TestBed.inject(DjStore);
  const fixture: ComponentFixture<DjMixerCardComponent> =
    TestBed.createComponent(DjMixerCardComponent);
  fixture.componentRef.setInput('decks', decks);
  fixture.detectChanges();
  return { fixture, store, mixer };
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

function input(fixture: ComponentFixture<DjMixerCardComponent>, name: string): HTMLInputElement {
  const el = fixture.nativeElement.querySelector(`input[aria-label="${name}"]`);
  if (!el) throw new Error(`no input named ${name}`);
  return el;
}

function keyReadoutText(fixture: ComponentFixture<DjMixerCardComponent>, letter: string): string {
  const knob = input(fixture, `Key deck ${letter}`).closest('lib-rotary-knob') as HTMLElement;
  return knob.querySelector('.scale-knob-readout')?.textContent?.trim() ?? '';
}

function keyNotationButton(
  fixture: ComponentFixture<DjMixerCardComponent>,
  label: string
): HTMLButtonElement {
  const buttons = Array.from(
    fixture.nativeElement.querySelectorAll('[role="group"][aria-label="Key notation"] button')
  ) as HTMLButtonElement[];
  const button = buttons.find((b) => b.textContent?.trim() === label);
  if (!button) throw new Error(`no key notation button ${label}`);
  return button;
}

describe('DjMixerCardComponent', () => {
  describe('the Bindings button', () => {
    function bindingsButton(fixture: ComponentFixture<DjMixerCardComponent>): HTMLButtonElement {
      return fixture.nativeElement.querySelector('.bindings-row button');
    }

    it('offers to open the panel while it is closed, and to close it while it is open', () => {
      const { fixture } = render([DECK_A, DECK_B]);

      expect(bindingsButton(fixture).getAttribute('aria-label')).toBe('Open bindings panel');
      expect(bindingsButton(fixture).getAttribute('aria-expanded')).toBe('false');

      fixture.componentRef.setInput('bindingsOpen', true);
      fixture.detectChanges();

      expect(bindingsButton(fixture).getAttribute('aria-label')).toBe('Close bindings panel');
      expect(bindingsButton(fixture).getAttribute('aria-expanded')).toBe('true');
    });

    it('emits bindingsToggle when pressed', () => {
      const { fixture } = render([DECK_A, DECK_B]);
      const toggled = vi.fn();
      fixture.componentInstance.bindingsToggle.subscribe(toggled);

      bindingsButton(fixture).click();

      expect(toggled).toHaveBeenCalledTimes(1);
    });

    it('takes keyboard focus from focusBindingsButton', () => {
      const { fixture } = render([DECK_A, DECK_B]);
      document.body.appendChild(fixture.nativeElement);

      fixture.componentInstance.focusBindingsButton();

      expect(document.activeElement).toBe(bindingsButton(fixture));
      fixture.nativeElement.remove();
    });
  });

  describe('the Key knobs', () => {
    it('renders one per deck, each in its own deck wrapper and anchored as the Key control', () => {
      const { fixture } = render([DECK_A, DECK_B]);
      const root: HTMLElement = fixture.nativeElement;

      const wrappers = Array.from(root.querySelectorAll('[data-deck]'));
      expect(wrappers.map((w) => w.getAttribute('data-deck'))).toEqual(['A', 'B']);
      for (const wrapper of wrappers) {
        expect(wrapper.querySelector('lib-rotary-knob')?.getAttribute('data-control')).toBe('key');
      }
    });

    it('renders a single Key knob for a single deck', () => {
      const { fixture } = render([DECK_A]);

      expect(fixture.nativeElement.querySelectorAll('lib-rotary-knob')).toHaveLength(1);
    });

    it("gives each knob a whole-semitone ±12 range, its deck's name and the store's readout", () => {
      const { fixture } = render([DECK_A, DECK_B]);

      const key = input(fixture, 'Key deck B');
      expect([key.min, key.max, key.step]).toEqual(['-12', '12', '1']);
      expect(keyReadoutText(fixture, 'B')).toBe('0');
    });

    it("shows each deck's own offset", () => {
      const { fixture, store } = render([DECK_A, DECK_B]);
      store.setDeckPanel({ slot: 'B', patch: { keySemitones: 3 } });
      fixture.detectChanges();

      expect(input(fixture, 'Key deck A').value).toBe('0');
      expect(input(fixture, 'Key deck B').value).toBe('3');
    });

    it('disables the knob of a deck that cannot be shaped, and enables the one that can', () => {
      const { fixture, store } = render([DECK_A, DECK_B]);
      expect(input(fixture, 'Key deck A').disabled).toBe(true);

      makeShapeable(store, 'A');
      fixture.detectChanges();

      expect(input(fixture, 'Key deck A').disabled).toBe(false);
      expect(input(fixture, 'Key deck B').disabled).toBe(true);
    });

    it("sends a moved knob to setKeySemitones with its deck's slot", () => {
      const { fixture, store, mixer } = render([DECK_A, DECK_B]);
      makeShapeable(store, 'B');
      fixture.detectChanges();

      const key = input(fixture, 'Key deck B');
      key.value = '-5';
      key.dispatchEvent(new Event('input', { bubbles: true }));

      expect(mixer.setKeySemitones.mock.calls).toEqual([['B', -5]]);
    });

    it('returns the knob to 0 on double-click', () => {
      const { fixture, store, mixer } = render([DECK_A]);
      makeShapeable(store, 'A');
      store.setDeckPanel({ slot: 'A', patch: { keySemitones: 6 } });
      fixture.detectChanges();

      input(fixture, 'Key deck A').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      expect(mixer.setKeySemitones).toHaveBeenCalledWith('A', 0);
    });
  });

  describe('the key notation switch', () => {
    it("is a labelled group of Camelot and Note buttons, with the store's format pressed", () => {
      const { fixture, store } = render([DECK_A, DECK_B]);

      expect(keyNotationButton(fixture, 'Camelot').getAttribute('aria-pressed')).toBe('true');
      expect(keyNotationButton(fixture, 'Note').getAttribute('aria-pressed')).toBe('false');

      store.setKeyDisplayFormat({ format: 'note' });
      fixture.detectChanges();

      expect(keyNotationButton(fixture, 'Camelot').getAttribute('aria-pressed')).toBe('false');
      expect(keyNotationButton(fixture, 'Note').getAttribute('aria-pressed')).toBe('true');
    });

    it('dispatches the chosen format to setKeyDisplayFormat', () => {
      const { fixture, mixer } = render([DECK_A, DECK_B]);

      keyNotationButton(fixture, 'Note').click();
      expect(mixer.setKeyDisplayFormat).toHaveBeenLastCalledWith('note');

      keyNotationButton(fixture, 'Camelot').click();
      expect(mixer.setKeyDisplayFormat).toHaveBeenLastCalledWith('camelot');
    });

    it('is one control in the card body, whatever the number of decks', () => {
      const { fixture } = render([DECK_A, DECK_B]);
      const groups = fixture.nativeElement.querySelectorAll('[aria-label="Key notation"]');

      expect(groups).toHaveLength(1);
      expect(groups[0].closest('.mixer-body')).not.toBeNull();
    });
  });

  describe('the Key knob readout', () => {
    const cSharpMinor = { tonic: 1, mode: 'minor', camelot: '8B' } as const;
    const cMajor = { tonic: 0, mode: 'major', camelot: '8B' } as const;

    it('shows the detected key in Camelot, then as a note name once the format switches, on both decks', () => {
      const { fixture, store } = render([DECK_A, DECK_B]);
      store.setDeckDetectedKey({ slot: 'A', detectedKey: cSharpMinor });
      store.setDeckDetectedKey({ slot: 'B', detectedKey: cMajor });
      fixture.detectChanges();

      expect(keyReadoutText(fixture, 'A')).toBe('8B');
      expect(keyReadoutText(fixture, 'B')).toBe('8B');

      store.setKeyDisplayFormat({ format: 'note' });
      fixture.detectChanges();

      expect(keyReadoutText(fixture, 'A')).toBe('C#m');
      expect(keyReadoutText(fixture, 'B')).toBe('C');
    });

    it("shows the key shifted by the knob's semitone offset", () => {
      const { fixture, store } = render([DECK_A]);
      store.setDeckDetectedKey({ slot: 'A', detectedKey: cSharpMinor });
      store.setDeckPanel({ slot: 'A', patch: { keySemitones: 3 } });
      fixture.detectChanges();

      expect(keyReadoutText(fixture, 'A')).toBe('9A');
    });

    it('falls back to the signed offset when no key is detected, with U+2212 for negatives', () => {
      const { fixture, store } = render([DECK_A, DECK_B]);

      store.setDeckPanel({ slot: 'A', patch: { keySemitones: 3 } });
      store.setDeckPanel({ slot: 'B', patch: { keySemitones: -5 } });
      fixture.detectChanges();

      expect(keyReadoutText(fixture, 'A')).toBe('+3');
      expect(keyReadoutText(fixture, 'B')).toBe('−5');
    });
  });
});
