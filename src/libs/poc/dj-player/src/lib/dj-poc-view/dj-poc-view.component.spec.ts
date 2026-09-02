import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DjPocViewComponent, computeGridLayout } from './dj-poc-view.component';
import { DECKS } from '../deck/deck.config';

/** Splits a `grid-template-areas` value into its rows, each row into its named cells — the same
 *  shape a browser (or a reviewer) reads the string as. */
function parseGridAreaRows(areas: string): string[][] {
  return (areas.match(/"[^"]*"/g) ?? []).map((row) => row.slice(1, -1).split(' '));
}

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

  describe('grid geometry', () => {
    it("computes the wireframe's exact five-column, three-row template for today's two decks", () => {
      const layout = computeGridLayout(DECKS);

      expect(layout.columns).toBe('minmax(0, 1fr) 64px 208px 64px minmax(0, 1fr)');
      expect(layout.rows).toBe('auto minmax(0, 1fr) auto');
    });

    it("spans voice/speed and the mixer the full height, and keeps each deck's panels confined to its own outer column", () => {
      const layout = computeGridLayout(DECKS);
      const rows = parseGridAreaRows(layout.areas);

      expect(rows).toHaveLength(3);
      for (const row of rows) {
        expect(row).toHaveLength(5);
        // vs0 (deck A voice/speed), mx (mixer) and vs1 (deck B voice/speed) run down every row —
        // the full-height span the wireframe draws.
        expect(row[1]).toBe('vs0');
        expect(row[2]).toBe('mx');
        expect(row[3]).toBe('vs1');
      }

      // Deck A's transport/loops-cues/binding stay in the leftmost column top-to-bottom, deck B's in
      // the rightmost — never transposed into the other deck's column (which would reintroduce
      // mirroring), and each area name appears exactly once.
      expect(rows.map((row) => row[0])).toEqual(['t0', 'c0', 'b0']);
      expect(rows.map((row) => row[4])).toEqual(['t1', 'c1', 'b1']);
    });

    it('binds the computed template straight onto .grid as inline grid-template styles', () => {
      const expected = computeGridLayout(DECKS);
      const gridEl: HTMLElement = fixture.nativeElement.querySelector('.grid');

      expect(gridEl.style.gridTemplateColumns).toBe(expected.columns);
      expect(gridEl.style.gridTemplateRows).toBe(expected.rows);
      expect(gridEl.style.gridTemplateAreas).toBe(expected.areas);
    });
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
