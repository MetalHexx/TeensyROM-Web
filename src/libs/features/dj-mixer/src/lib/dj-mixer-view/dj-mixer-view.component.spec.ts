import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { DeviceStore } from '@teensyrom-nx/application';
import { ScalingCardComponent } from '@teensyrom-nx/ui/components';
import { DjMixerViewComponent } from './dj-mixer-view.component';

function device(isEnabled: boolean) {
  return { isEnabled };
}

function render(devices: unknown[]) {
  TestBed.configureTestingModule({
    imports: [DjMixerViewComponent],
    providers: [
      provideNoopAnimations(),
      { provide: DeviceStore, useValue: { devices: signal(devices) } },
    ],
  });

  const fixture: ComponentFixture<DjMixerViewComponent> =
    TestBed.createComponent(DjMixerViewComponent);
  fixture.detectChanges();

  return { fixture, component: fixture.componentInstance };
}

function deckLetters(fixture: ComponentFixture<DjMixerViewComponent>): string[] {
  return Array.from(fixture.nativeElement.querySelectorAll('[data-deck]')).map((el) =>
    (el as HTMLElement).getAttribute('data-deck')
  ) as string[];
}

function mixerGrid(fixture: ComponentFixture<DjMixerViewComponent>): HTMLElement {
  return fixture.nativeElement.querySelector('.mixer-grid');
}

/** Splits a `grid-template-areas` value into its rows, each row into its named cells. */
function parseGridAreaRows(areas: string): string[][] {
  return (areas.match(/"[^"]*"/g) ?? []).map((row) => row.slice(1, -1).split(' '));
}

describe('DjMixerViewComponent', () => {
  it('renders one deck column per enabled device, lettered in store order, plus a mixer card', () => {
    const { fixture, component } = render([device(true), device(true), device(true)]);

    expect(fixture.nativeElement.querySelectorAll('lib-dj-deck-column').length).toBe(3);
    expect(deckLetters(fixture)).toEqual(['A', 'B', 'C']);
    expect(fixture.nativeElement.querySelectorAll('lib-dj-mixer-card').length).toBe(1);
    expect(component.showCrossfader()).toBe(true);
    expect(component.isMany()).toBe(true);
  });

  it('filters out disabled devices, keeping the enabled-list positions contiguous', () => {
    const { fixture, component } = render([device(true), device(false), device(true)]);

    expect(fixture.nativeElement.querySelectorAll('lib-dj-deck-column').length).toBe(2);
    expect(deckLetters(fixture)).toEqual(['A', 'B']);
    expect(component.showCrossfader()).toBe(true);
    expect(component.isMany()).toBe(false);
  });

  it('renders a single column and mixer card with no crossfader when only one device is enabled', () => {
    const { fixture, component } = render([device(true)]);

    expect(fixture.nativeElement.querySelectorAll('lib-dj-deck-column').length).toBe(1);
    expect(deckLetters(fixture)).toEqual(['A']);
    expect(fixture.nativeElement.querySelectorAll('lib-dj-mixer-card').length).toBe(1);
    expect(component.showCrossfader()).toBe(false);
  });

  it('renders the empty state and no mixer grid when no devices are enabled', () => {
    const { fixture } = render([device(false)]);

    const emptyState = fixture.nativeElement.querySelector('lib-empty-state-message');
    expect(emptyState).toBeTruthy();
    expect(emptyState.querySelector('.empty-state-title')?.textContent?.trim()).toBe(
      'No Enabled Devices'
    );
    expect(fixture.nativeElement.querySelector('.mixer-grid')).toBeNull();
  });

  describe('grid modifier classes', () => {
    it('carries mixer-grid--one for a single enabled device', () => {
      const { fixture } = render([device(true)]);
      const classes = mixerGrid(fixture).classList;

      expect(classes.contains('mixer-grid--one')).toBe(true);
      expect(classes.contains('mixer-grid--two')).toBe(false);
      expect(classes.contains('mixer-grid--many')).toBe(false);
    });

    it('carries mixer-grid--two for two enabled devices', () => {
      const { fixture } = render([device(true), device(true)]);
      const classes = mixerGrid(fixture).classList;

      expect(classes.contains('mixer-grid--one')).toBe(false);
      expect(classes.contains('mixer-grid--two')).toBe(true);
      expect(classes.contains('mixer-grid--many')).toBe(false);
    });

    it('carries mixer-grid--many for three or more enabled devices', () => {
      const { fixture } = render([device(true), device(true), device(true)]);
      const classes = mixerGrid(fixture).classList;

      expect(classes.contains('mixer-grid--one')).toBe(false);
      expect(classes.contains('mixer-grid--two')).toBe(false);
      expect(classes.contains('mixer-grid--many')).toBe(true);
    });
  });

  describe('the --many inline grid-template-areas', () => {
    it('leaves no inline grid-template-areas for one deck — the mixin owns that form', () => {
      const { fixture } = render([device(true)]);

      expect(mixerGrid(fixture).style.gridTemplateAreas).toBe('');
    });

    it('leaves no inline grid-template-areas for two decks — the mixin owns that form', () => {
      const { fixture } = render([device(true), device(true)]);

      expect(mixerGrid(fixture).style.gridTemplateAreas).toBe('');
    });

    it("names every deck's three panel areas and each deck's voice/speed column exactly once per row", () => {
      const { fixture } = render([device(true), device(true), device(true)]);
      const rows = parseGridAreaRows(mixerGrid(fixture).style.gridTemplateAreas);

      for (let deck = 0; deck < 3; deck++) {
        for (const letter of ['t', 'c', 'b']) {
          const matches = rows.filter((row) => row[0] === `${letter}${deck}`);
          expect(matches).toHaveLength(1);
          expect(matches[0][1]).toBe(`vs${deck}`);
        }
      }
    });

    it('places the mixer band in exactly one row, spanning both columns, right after the first deck', () => {
      const { fixture } = render([device(true), device(true), device(true)]);
      const rows = parseGridAreaRows(mixerGrid(fixture).style.gridTemplateAreas);

      const mxRows = rows.filter((row) => row[0] === 'mx');
      expect(mxRows).toHaveLength(1);
      expect(mxRows[0]).toEqual(['mx', 'mx']);
      expect(rows.indexOf(mxRows[0])).toBe(3); // after deck 0's three rows (t0, c0, b0)
    });

    it('places the bottom band in exactly one row, as the last row, at three decks', () => {
      const { fixture } = render([device(true), device(true), device(true)]);
      const rows = parseGridAreaRows(mixerGrid(fixture).style.gridTemplateAreas);

      const bottomRows = rows.filter((row) => row[0] === 'bottom');
      expect(bottomRows).toHaveLength(1);
      expect(bottomRows[0]).toEqual(['bottom', 'bottom']);
      expect(rows.indexOf(bottomRows[0])).toBe(rows.length - 1);
    });
  });

  describe('the bottom band', () => {
    function expectBrowseAndDirectoryListingCards(
      fixture: ComponentFixture<DjMixerViewComponent>
    ): void {
      const band = fixture.debugElement.query(By.css('.bottom-band'));
      const cards = band.queryAll(By.directive(ScalingCardComponent));

      expect(cards.length).toBe(2);
      expect((cards[0].componentInstance as ScalingCardComponent).title()).toBe('Browse');
      expect((cards[1].componentInstance as ScalingCardComponent).title()).toBe(
        'Directory Listing'
      );
    }

    it('renders a Browse card and a Directory Listing card at one enabled device', () => {
      const { fixture } = render([device(true)]);
      expectBrowseAndDirectoryListingCards(fixture);
    });

    it('renders a Browse card and a Directory Listing card at two enabled devices', () => {
      const { fixture } = render([device(true), device(true)]);
      expectBrowseAndDirectoryListingCards(fixture);
    });

    it('renders a Browse card and a Directory Listing card at three-plus enabled devices', () => {
      const { fixture } = render([device(true), device(true), device(true)]);
      expectBrowseAndDirectoryListingCards(fixture);
    });
  });

  describe('the --many host scroll class', () => {
    it('withholds dj-mixer-view--many below three decks', () => {
      const { fixture } = render([device(true), device(true)]);

      expect(fixture.nativeElement.classList.contains('dj-mixer-view--many')).toBe(false);
    });

    it('adds dj-mixer-view--many to the host once three or more decks stack permanently', () => {
      const { fixture } = render([device(true), device(true), device(true)]);

      expect(fixture.nativeElement.classList.contains('dj-mixer-view--many')).toBe(true);
    });
  });
});
