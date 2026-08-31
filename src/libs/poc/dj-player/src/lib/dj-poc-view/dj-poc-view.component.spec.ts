import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DjPocViewComponent } from './dj-poc-view.component';
import { MidiAccessService } from '../midi/midi-access.service';
import type { DeckHandle } from '../deck/deck-registry';
import { DECKS } from '../deck/deck.config';

describe('DjPocViewComponent', () => {
  let fixture: ComponentFixture<DjPocViewComponent>;
  let component: DjPocViewComponent;
  let midiAccess: MidiAccessService;
  let decks: readonly DeckHandle[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DjPocViewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DjPocViewComponent);
    component = fixture.componentInstance;

    // The real service: `claim`/`release`/`send` are plain Map bookkeeping with no browser API
    // dependency, so only the SysEx permission prompt itself needs stubbing.
    midiAccess = fixture.debugElement.injector.get(MidiAccessService);
    vi.spyOn(midiAccess, 'requestAccess').mockImplementation(() => Promise.resolve());

    fixture.detectChanges();
    decks = component['decks']();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('composes one deck host per DECKS entry, each registered under its own descriptor', () => {
    const hosts: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('lib-deck-host')
    );

    expect(hosts).toHaveLength(DECKS.length);
    expect(decks.map((deck) => deck.descriptor.id)).toEqual(DECKS.map((deck) => deck.id));

    const headings = hosts.map((host) => host.querySelector('.deck-heading')?.textContent?.trim());
    expect(headings).toEqual(DECKS.map((deck) => `Deck ${deck.label}`));
  });

  describe('MIDI', () => {
    function enableMidiButton(): HTMLButtonElement {
      return Array.from(fixture.nativeElement.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.trim() === 'Enable MIDI'
      ) as HTMLButtonElement;
    }

    function deckRow(index: number): HTMLElement {
      return fixture.nativeElement.querySelectorAll('.deck-midi-row')[index] as HTMLElement;
    }

    function identifyButton(index: number): HTMLButtonElement {
      return Array.from(deckRow(index).querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.trim() === 'Identify'
      ) as HTMLButtonElement;
    }

    it('renders one row per registered deck', () => {
      expect(fixture.nativeElement.querySelectorAll('.deck-midi-row')).toHaveLength(DECKS.length);
    });

    it("enabling MIDI requests access, then restores every registered deck's own binding", async () => {
      const restoreSpies = decks.map((deck) => vi.spyOn(deck.binding, 'restore'));

      enableMidiButton().click();
      await Promise.resolve();
      await Promise.resolve();

      expect(midiAccess.requestAccess).toHaveBeenCalled();
      for (const spy of restoreSpies) {
        expect(spy).toHaveBeenCalled();
      }
    });

    it('selecting a port for one deck claims it for that deck only, leaving the other deck unselected', () => {
      midiAccess.ports.set([
        { id: 'port-1', name: 'Cart A', manufacturer: 'Acme' },
        { id: 'port-2', name: 'Cart B', manufacturer: 'Acme' },
      ]);
      fixture.detectChanges();

      const select = deckRow(0).querySelector('select') as HTMLSelectElement;
      select.value = 'port-1';
      select.dispatchEvent(new Event('change'));

      expect(decks[0].binding.selectedPortId()).toBe('port-1');
      expect(decks[1].binding.selectedPortId()).toBeNull();
    });

    it("renders a row's own binding error, never the other deck's", () => {
      decks[0].binding.lastError.set('deck A exploded');
      fixture.detectChanges();

      expect(deckRow(0).textContent).toContain('deck A exploded');
      expect(deckRow(1).textContent).not.toContain('deck A exploded');
    });

    it('gates Identify on granted access and a selected port for that deck, independent of the other', () => {
      midiAccess.ports.set([{ id: 'port-1', name: 'Cart A', manufacturer: 'Acme' }]);
      midiAccess.accessState.set('granted');
      fixture.detectChanges();
      const select = deckRow(0).querySelector('select') as HTMLSelectElement;
      select.value = 'port-1';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(identifyButton(0).disabled).toBe(false);
      expect(identifyButton(1).disabled).toBe(true);
    });

    it("identifying a deck sends through that deck's own binding", () => {
      midiAccess.ports.set([{ id: 'port-1', name: 'Cart A', manufacturer: 'Acme' }]);
      midiAccess.accessState.set('granted');
      fixture.detectChanges();
      const select = deckRow(0).querySelector('select') as HTMLSelectElement;
      select.value = 'port-1';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      const identifySpy = vi.spyOn(decks[0].binding, 'identify');

      identifyButton(0).click();

      expect(identifySpy).toHaveBeenCalledWith('ASID-DJ-0 PORT 1');
    });

    it('shows the no-ports-found message once access is granted with an empty port list', () => {
      midiAccess.accessState.set('granted');
      midiAccess.ports.set([]);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent ?? '').toContain(
        'no output ports were found'
      );
    });
  });

  describe('main-thread stall control', () => {
    function stallButton(): HTMLButtonElement {
      const buttons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('[aria-label="Diagnostics"] button')
      );
      return buttons.find((button) => button.textContent?.trim() === 'Stall') as HTMLButtonElement;
    }

    function stallDurationInput(): HTMLInputElement {
      return fixture.nativeElement.querySelector(
        'input[aria-label="Stall duration in milliseconds"]'
      );
    }

    it('updates the configured duration from its own input, reflected back through the bound value', () => {
      const input = stallDurationInput();
      input.value = '300';
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(stallDurationInput().value).toBe('300');
    });

    it('blocks the main thread synchronously for at least the configured duration', () => {
      const input = stallDurationInput();
      input.value = '20'; // short, to keep the test itself fast
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      const before = performance.now();
      stallButton().click();
      const elapsed = performance.now() - before;

      expect(elapsed).toBeGreaterThanOrEqual(20);
    });

    /**
     * Runs the stall against a virtual clock — one that only advances when the busy-wait reads
     * it — and reports how much virtual time the stall consumed before returning. Real time is no
     * use here: the whole point of the ceiling is that the value being defended against would
     * freeze the tab for minutes.
     */
    function virtualStallElapsedMs(): number {
      const button = stallButton();
      const startMs = 1_000_000;
      let nowMs = startMs;
      const clock = vi.spyOn(performance, 'now').mockImplementation(() => nowMs++);
      try {
        button.click();
      } finally {
        clock.mockRestore();
      }
      return nowMs - 1 - startMs;
    }

    it('caps the stall at the ceiling its own input advertises, however large the typed value', () => {
      const ceilingMs = Number(stallDurationInput().max);
      const input = stallDurationInput();
      input.value = String(ceilingMs * 30); // the mistyped-value case the ceiling exists for
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      const elapsed = virtualStallElapsedMs();

      expect(elapsed).toBeGreaterThanOrEqual(ceilingMs);
      expect(elapsed).toBeLessThan(ceilingMs * 2);
    });
  });
});
