import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DjPocViewComponent } from './dj-poc-view.component';
import { DECKS } from '../deck/deck.config';

describe('DjPocViewComponent', () => {
  let fixture: ComponentFixture<DjPocViewComponent>;
  let component: DjPocViewComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DjPocViewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DjPocViewComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('composes one deck host per DECKS entry, each carrying its own deck descriptor', () => {
    const hosts: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('lib-deck-host')
    );

    expect(hosts).toHaveLength(DECKS.length);

    const labels = hosts.map((host) =>
      host.querySelector('.binding-deck-label')?.textContent?.trim()
    );
    expect(labels).toEqual(DECKS.map((deck) => `Deck ${deck.label}`));
  });

  it('offers no control to add a deck — N-readiness is proved by DECKS, never a button on the page', () => {
    const controls: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button, [role="button"]')
    );

    expect(controls.some((control) => /add deck/i.test(control.textContent ?? ''))).toBe(false);
  });

  describe('SETUP & DIAGNOSTICS drawer', () => {
    // The main-thread stall control itself now lives in, and is tested by, SetupDrawerComponent —
    // this only proves the drawer actually places it.
    it('fills the drawer with the setup drawer, carrying the stall control once expanded', () => {
      const headers: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.drawer-head')
      );
      const header = headers.find((button) => button.textContent?.includes('SETUP & DIAGNOSTICS'));
      header?.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('lib-setup-drawer')).not.toBeNull();
      const stallButtons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('button')
      ).filter((button) => button.textContent?.trim() === 'Stall');
      expect(stallButtons).toHaveLength(1);
    });
  });

  describe('TRACK ANALYSIS drawer', () => {
    function expandDrawer(): void {
      const headers: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.drawer-head')
      );
      const header = headers.find((button) => button.textContent?.includes('TRACK ANALYSIS'));
      header?.click();
      fixture.detectChanges();
    }

    function deckSelect(): HTMLSelectElement {
      return fixture.nativeElement.querySelector('select[aria-label="Track Analysis deck"]');
    }

    it('offers one option per registered deck and defaults to analysing the first', () => {
      expandDrawer();

      const options = Array.from(deckSelect().options).map((option) => option.textContent?.trim());
      expect(options).toEqual(DECKS.map((deck) => `Deck ${deck.label}`));
      expect(deckSelect().value).toBe(DECKS[0].id);
      expect(fixture.nativeElement.querySelector('lib-track-analysis-panel')).not.toBeNull();
    });

    it('switches which deck Track Analysis inspects when a different deck is picked', () => {
      expandDrawer();

      deckSelect().value = DECKS[1].id;
      deckSelect().dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(deckSelect().value).toBe(DECKS[1].id);
      expect(fixture.nativeElement.querySelector('lib-track-analysis-panel')).not.toBeNull();
    });
  });
});
