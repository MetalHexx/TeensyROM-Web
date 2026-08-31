import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  it('composes one deck host per DECKS entry, each registered under its own descriptor', () => {
    const hosts: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('lib-deck-host')
    );

    expect(hosts).toHaveLength(DECKS.length);

    const headings = hosts.map((host) => host.querySelector('.deck-heading')?.textContent?.trim());
    expect(headings).toEqual(DECKS.map((deck) => `Deck ${deck.label}`));
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
