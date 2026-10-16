import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { DjStore, MixerService, type Slot } from '@teensyrom-nx/application';
import { CrossfaderComponent, DeckStripComponent } from '@teensyrom-nx/ui/components';
import { DjMixerCardComponent } from './dj-mixer-card.component';
import type { DeckRef } from '../deck-ref';

const DECK_A: DeckRef = { slot: 'A', letter: 'A', index: 0 };
const DECK_B: DeckRef = { slot: 'B', letter: 'B', index: 1 };

type Store = InstanceType<typeof DjStore>;
type TuneReference = Parameters<Store['setDeckLoaded']>[0]['reference'];

function createMixerServiceStub() {
  return {
    setLevel: vi.fn(),
    setCrossfader: vi.fn(),
    setKnob: vi.fn(),
    setKeySemitones: vi.fn(),
    setFilterMode: vi.fn(),
    setKeyDisplayFormat: vi.fn(),
  };
}

function render(decks: readonly DeckRef[], showCrossfader: boolean, belowTablet = false) {
  const mixer = createMixerServiceStub();

  TestBed.configureTestingModule({
    imports: [DjMixerCardComponent],
    providers: [
      provideNoopAnimations(),
      { provide: MixerService, useValue: mixer },
      {
        provide: BreakpointObserver,
        useValue: { observe: () => of({ matches: belowTablet, breakpoints: {} }) },
      },
    ],
  });

  const store = TestBed.inject(DjStore);
  const fixture: ComponentFixture<DjMixerCardComponent> =
    TestBed.createComponent(DjMixerCardComponent);
  fixture.componentRef.setInput('decks', decks);
  fixture.componentRef.setInput('showCrossfader', showCrossfader);
  fixture.detectChanges();
  return { fixture, store, mixer };
}

/** Puts a settled, shapeable tune on the deck, so its tune-shaping controls are live. */
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

function strips(fixture: ComponentFixture<DjMixerCardComponent>): DeckStripComponent[] {
  return fixture.debugElement
    .queryAll(By.directive(DeckStripComponent))
    .map((s) => s.componentInstance as DeckStripComponent);
}

function crossfaderOf(fixture: ComponentFixture<DjMixerCardComponent>): CrossfaderComponent {
  return fixture.debugElement.query(By.directive(CrossfaderComponent))
    .componentInstance as CrossfaderComponent;
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
      const { fixture } = render([DECK_A, DECK_B], true);

      expect(bindingsButton(fixture).getAttribute('aria-label')).toBe('Open bindings panel');
      expect(bindingsButton(fixture).getAttribute('aria-expanded')).toBe('false');

      fixture.componentRef.setInput('bindingsOpen', true);
      fixture.detectChanges();

      expect(bindingsButton(fixture).getAttribute('aria-label')).toBe('Close bindings panel');
      expect(bindingsButton(fixture).getAttribute('aria-expanded')).toBe('true');
    });

    it('emits bindingsToggle when pressed', () => {
      const { fixture } = render([DECK_A, DECK_B], true);
      const toggled = vi.fn();
      fixture.componentInstance.bindingsToggle.subscribe(toggled);

      bindingsButton(fixture).click();

      expect(toggled).toHaveBeenCalledTimes(1);
    });
  });

  describe('the mapping anchors', () => {
    it('marks each strip with its deck letter and the crossfader as the crossfader', () => {
      const { fixture } = render([DECK_A, DECK_B], true);
      const root: HTMLElement = fixture.nativeElement;

      expect(
        Array.from(root.querySelectorAll('lib-deck-strip')).map((s) => s.getAttribute('data-deck'))
      ).toEqual(['A', 'B']);
      expect(root.querySelector('lib-crossfader')?.getAttribute('data-control')).toBe('crossfader');
    });
  });

  it('renders one strip and no crossfader for a single deck', () => {
    const { fixture } = render([DECK_A], false);

    expect(strips(fixture).length).toBe(1);
    expect(strips(fixture)[0].model().fader.label).toBe('A');
    expect(fixture.nativeElement.querySelector('lib-crossfader')).toBeNull();
  });

  it('renders two strips and a crossfader named, but not visibly labelled, A to B for two decks', () => {
    const { fixture } = render([DECK_A, DECK_B], true);

    expect(strips(fixture).map((s) => s.model().fader.label)).toEqual(['A', 'B']);

    // The channel faders above already show their own A/B labels, so the crossfader itself renders
    // none — its accessible name still carries the deck letters for assistive technology.
    const crossfader = crossfaderOf(fixture);
    expect(crossfader.startLabel()).toBe('');
    expect(crossfader.endLabel()).toBe('');
    expect(crossfader.accessibleName()).toBe('Crossfader, deck A to deck B');
  });

  describe('the medium column form', () => {
    it('sizes every strip medium and hands it the same travel the crossfader gets', () => {
      const { fixture } = render([DECK_A, DECK_B], true);
      const crossfader = crossfaderOf(fixture);

      expect(strips(fixture).map((s) => s.size())).toEqual(['medium', 'medium']);
      expect(crossfader.trackLength()).toBeTruthy();
      expect(strips(fixture).map((s) => s.faderLength())).toEqual([
        crossfader.trackLength(),
        crossfader.trackLength(),
      ]);
    });

    it('releases both travels in the band form, where the card is no longer a fixed column', () => {
      const { fixture } = render([DECK_A, DECK_B], true, true);

      expect(strips(fixture)[0].faderLength()).toBeNull();
      expect(crossfaderOf(fixture).trackLength()).toBeNull();
    });
  });

  describe('the strip models', () => {
    it("reflect each deck's own store values, with letter-scoped names", () => {
      const { fixture, store } = render([DECK_A, DECK_B], true);
      store.setDeckMix({
        slot: 'B',
        patch: {
          level: 0.4,
          cutoff: 0.25,
          resonance: 0.5,
          pulseWidth: 0.75,
          keySemitones: 3,
        },
      });
      fixture.detectChanges();

      const [a, b] = strips(fixture).map((s) => s.model());

      expect(a.fader.value).toBe(1);
      expect(a.knobs.map((k) => k.value)).toEqual([0, 0, 0, 0]);

      expect(b.fader).toEqual({ value: 0.4, label: 'B', accessibleName: 'Gain deck B' });
      expect(b.knobs.map((k) => [k.id, k.accessibleName, k.value])).toEqual([
        ['cutoff', 'Cutoff deck B', 0.25],
        ['resonance', 'Resonance deck B', 0.5],
        ['pulseWidth', 'Pulse width deck B', 0.75],
        ['key', 'Key deck B', 3],
      ]);
    });

    it('carry no filter selector model, and render no selector', () => {
      const { fixture } = render([DECK_A, DECK_B], true);

      for (const model of strips(fixture).map((s) => s.model())) {
        expect(model.filter).toBeUndefined();
      }
      expect(fixture.nativeElement.querySelector('lib-filter-mode-selector')).toBeNull();
    });

    it('give resonance a 0..1 range resting at 0, and leave cutoff and pulse width on the default range', () => {
      const { fixture } = render([DECK_A], false);

      const [cutoff, resonance, pulseWidth] = strips(fixture)[0].model().knobs;
      expect(resonance).toMatchObject({ min: 0, max: 1, home: 0 });
      for (const knob of [cutoff, pulseWidth]) {
        expect(knob.min).toBeUndefined();
        expect(knob.max).toBeUndefined();
        expect(knob.home).toBeUndefined();
      }

      const resonanceInput = input(fixture, 'Resonance deck A');
      expect(resonanceInput.min).toBe('0');
      expect(resonanceInput.max).toBe('1');
    });

    it('return resonance to 0 on double-click', () => {
      const { fixture, store, mixer } = render([DECK_A], false);
      makeShapeable(store, 'A');
      store.setDeckMix({ slot: 'A', patch: { resonance: 0.6 } });
      fixture.detectChanges();

      input(fixture, 'Resonance deck A').dispatchEvent(
        new MouseEvent('dblclick', { bubbles: true })
      );

      expect(mixer.setKnob).toHaveBeenCalledWith('A', 'resonance', 0);
    });

    it("give the key knob a whole-semitone ±12 range and the store's readout", () => {
      const { fixture } = render([DECK_A], false);

      const key = strips(fixture)[0].model().knobs.find((k) => k.id === 'key');
      expect(key).toMatchObject({ min: -12, max: 12, step: 1, readout: '0' });
    });

    it('disable every knob on a deck that cannot be shaped, never the fader', () => {
      const { fixture } = render([DECK_A, DECK_B], true);

      for (const model of strips(fixture).map((s) => s.model())) {
        expect(model.knobs.every((k) => k.disabled === true)).toBe(true);
      }
      expect(input(fixture, 'Cutoff deck A').disabled).toBe(true);
      expect(input(fixture, 'Gain deck A').disabled).toBe(false);
      expect(input(fixture, 'Gain deck B').disabled).toBe(false);
      expect(fixture.nativeElement.querySelector('lib-crossfader input').disabled).toBe(false);
    });

    it('enable the knobs of the deck that can be shaped and leave the other disabled', () => {
      const { fixture, store } = render([DECK_A, DECK_B], true);
      makeShapeable(store, 'A');
      fixture.detectChanges();

      const [a, b] = strips(fixture).map((s) => s.model());
      expect(a.knobs.every((k) => k.disabled === false)).toBe(true);
      expect(b.knobs.every((k) => k.disabled === true)).toBe(true);
      expect(input(fixture, 'Cutoff deck A').disabled).toBe(false);
      expect(input(fixture, 'Cutoff deck B').disabled).toBe(true);
    });
  });

  describe('dispatch', () => {
    it("sends a shaping knob to setKnob with its deck's slot and the raw value", () => {
      const { fixture, mixer } = render([DECK_A, DECK_B], true);

      strips(fixture)[1].knobChange.emit({ id: 'pulseWidth', value: -0.37 });
      strips(fixture)[0].knobChange.emit({ id: 'cutoff', value: 0.2 });
      strips(fixture)[0].knobChange.emit({ id: 'resonance', value: 0.9 });

      expect(mixer.setKnob.mock.calls).toEqual([
        ['B', 'pulseWidth', -0.37],
        ['A', 'cutoff', 0.2],
        ['A', 'resonance', 0.9],
      ]);
      expect(mixer.setKeySemitones).not.toHaveBeenCalled();
    });

    it('sends the key knob to setKeySemitones and ignores an unknown knob id', () => {
      const { fixture, mixer } = render([DECK_A, DECK_B], true);

      strips(fixture)[1].knobChange.emit({ id: 'key', value: -5 });
      strips(fixture)[0].knobChange.emit({ id: 'mystery', value: 1 });

      expect(mixer.setKeySemitones.mock.calls).toEqual([['B', -5]]);
      expect(mixer.setKnob).not.toHaveBeenCalled();
    });

    it("sends the channel fader to setLevel with its deck's slot", () => {
      const { fixture, mixer } = render([DECK_A, DECK_B], true);

      strips(fixture)[1].faderChange.emit(0.25);

      expect(mixer.setLevel).toHaveBeenCalledWith('B', 0.25);
    });

    it('never sets a filter mode, having no selector to set one from', () => {
      const { fixture, mixer } = render([DECK_A, DECK_B], true);

      strips(fixture)[0].filterModeSelect.emit('highPass');
      strips(fixture)[1].knobChange.emit({ id: 'cutoff', value: 0.2 });

      expect(mixer.setFilterMode).not.toHaveBeenCalled();
    });

    it("sends a moved crossfader to setCrossfader and shows the store's position", () => {
      const { fixture, store, mixer } = render([DECK_A, DECK_B], true);

      crossfaderOf(fixture).valueChange.emit(0.6);
      expect(mixer.setCrossfader).toHaveBeenCalledWith(0.6);

      store.setCrossfader({ position: -0.5 });
      fixture.detectChanges();
      expect(crossfaderOf(fixture).value()).toBe(-0.5);
    });
  });

  describe('the key notation switch', () => {
    it("is a labelled group of Camelot and Note buttons, with the store's format pressed", () => {
      const { fixture, store } = render([DECK_A, DECK_B], true);

      expect(keyNotationButton(fixture, 'Camelot').getAttribute('aria-pressed')).toBe('true');
      expect(keyNotationButton(fixture, 'Note').getAttribute('aria-pressed')).toBe('false');

      store.setKeyDisplayFormat({ format: 'note' });
      fixture.detectChanges();

      expect(keyNotationButton(fixture, 'Camelot').getAttribute('aria-pressed')).toBe('false');
      expect(keyNotationButton(fixture, 'Note').getAttribute('aria-pressed')).toBe('true');
    });

    it('dispatches the chosen format to setKeyDisplayFormat', () => {
      const { fixture, mixer } = render([DECK_A, DECK_B], true);

      keyNotationButton(fixture, 'Note').click();
      expect(mixer.setKeyDisplayFormat).toHaveBeenLastCalledWith('note');

      keyNotationButton(fixture, 'Camelot').click();
      expect(mixer.setKeyDisplayFormat).toHaveBeenLastCalledWith('camelot');
    });

    it('is still offered with a single deck and no crossfader', () => {
      const { fixture } = render([DECK_A], false);

      expect(keyNotationButton(fixture, 'Camelot')).toBeTruthy();
    });

    it('is one control in the strips, between the Key knob and the fader and above the crossfader', () => {
      const { fixture } = render([DECK_A, DECK_B], true);
      const root: HTMLElement = fixture.nativeElement;
      const groups = root.querySelectorAll('[aria-label="Key notation"]');
      const [firstSlot, secondSlot] = Array.from(root.querySelectorAll('.key-notation-slot'));
      const crossfader = root.querySelector('lib-crossfader') as Element;
      const follows = (a: Element, b: Element) =>
        Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

      expect(groups).toHaveLength(1);
      expect(firstSlot.contains(groups[0])).toBe(true);
      expect(secondSlot.childElementCount).toBe(0);
      expect(follows(input(fixture, 'Key deck A'), groups[0])).toBe(true);
      expect(follows(groups[0], input(fixture, 'Gain deck A'))).toBe(true);
      expect(follows(groups[0], crossfader)).toBe(true);
    });

    it('spans as many strips as there are decks', () => {
      const { fixture } = render([DECK_A, DECK_B], true);
      const strips: HTMLElement = fixture.nativeElement.querySelector('.strips');

      expect(strips.style.getPropertyValue('--strip-count')).toBe('2');
    });
  });

  describe('the Key knob readout', () => {
    const cSharpMinor = { tonic: 1, mode: 'minor', camelot: '8B' } as const;
    const cMajor = { tonic: 0, mode: 'major', camelot: '8B' } as const;

    it('shows the detected key in Camelot, then as a note name once the format switches, on both decks', () => {
      const { fixture, store } = render([DECK_A, DECK_B], true);
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
      const { fixture, store } = render([DECK_A], false);
      store.setDeckDetectedKey({ slot: 'A', detectedKey: cSharpMinor });
      store.setDeckMix({ slot: 'A', patch: { keySemitones: 3 } });
      fixture.detectChanges();

      expect(keyReadoutText(fixture, 'A')).toBe('9A');
    });

    it('falls back to the signed offset when no key is detected, with U+2212 for negatives', () => {
      const { fixture, store } = render([DECK_A, DECK_B], true);

      store.setDeckMix({ slot: 'A', patch: { keySemitones: 3 } });
      store.setDeckMix({ slot: 'B', patch: { keySemitones: -5 } });
      fixture.detectChanges();

      expect(keyReadoutText(fixture, 'A')).toBe('+3');
      expect(keyReadoutText(fixture, 'B')).toBe('−5');
    });
  });
});
