/**
 * Real-browser verification for the mixer column's channel faders: the phase plan behind them calls
 * for "one vertical fader per entry in DECKS, above the crossfader, with clear separation between the
 * faders and between them and the crossfader — verified in a browser, not only in a test." jsdom lays
 * nothing out — every `getBoundingClientRect()` it returns is a zero box — so two faders rendered
 * flush against each other, or a fader overlapping the crossfader, is invisible to the jsdom-based
 * `mixer-column.component.spec.ts`, which can only count elements, not measure them. This spec runs
 * the genuine served app in a genuine browser and reads back real geometry instead, mirroring the
 * pattern `dj-poc-marker-moments.cy.ts` established for the same class of gap in the preceding phase.
 */

/** Widths above the mixer column's own band breakpoint (`max-width: 1000px` in
 *  `mixer-column.component.scss`), where the column renders in its default form: the channel faders
 *  stacked above the crossfader. This is the composition the phase plan's "above the crossfader"
 *  wording describes. */
const STACKED_WIDTHS = [1500, 1240] as const;

/** Past the mixer column's band breakpoint the column collapses into a horizontal band — the channel
 *  faders and the crossfader trade their stacked relationship for a side-by-side one. Mirrors the
 *  narrowest width `dj-poc-responsive.cy.ts` and `dj-poc-marker-moments.cy.ts` already exercise.
 *  Separation must still hold in this form, even though "above" no longer describes it. */
const BAND_WIDTH = 999;

function faderRect(deckLabel: string): Cypress.Chainable<DOMRect> {
  return cy
    .get(`[aria-label="Channel fader deck ${deckLabel}"]`)
    .then(([fader]) => fader.getBoundingClientRect());
}

function crossfaderRect(): Cypress.Chainable<DOMRect> {
  return cy
    .get('[aria-label="Crossfader, deck A to deck B"]')
    .then(([crossfader]) => crossfader.getBoundingClientRect());
}

/** True when two rects share no pixel in either axis — the general "does not touch" check, usable
 *  regardless of which side of the other a rect ends up on. */
function rectsAreClear(a: DOMRect, b: DOMRect): boolean {
  return a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
}

describe('DJ Poc mixer column — real-browser channel fader layout', () => {
  beforeEach(() => {
    cy.visit('/dev/dj-poc');
    cy.get('lib-channel-fader').should('have.length', 2);
  });

  STACKED_WIDTHS.forEach((width) => {
    it(`renders both channel faders above the crossfader with a real gap at ${width}px wide`, () => {
      cy.viewport(width, 900);

      faderRect('A').then((faderA) => {
        faderRect('B').then((faderB) => {
          crossfaderRect().then((crossfader) => {
            const lowestFaderBottom = Math.max(faderA.bottom, faderB.bottom);
            expect(
              crossfader.top - lowestFaderBottom,
              'the crossfader sits below both channel faders with a real rendered gap between them'
            ).to.be.greaterThan(4);
          });
        });
      });
    });

    it(`keeps the two channel faders from touching or overlapping at ${width}px wide`, () => {
      cy.viewport(width, 900);

      faderRect('A').then((faderA) => {
        faderRect('B').then((faderB) => {
          const [left, right] = faderA.left <= faderB.left ? [faderA, faderB] : [faderB, faderA];
          expect(
            right.left - left.right,
            'the two channel faders keep a real rendered horizontal gap between them'
          ).to.be.greaterThan(4);
        });
      });
    });
  });

  it(`keeps every fader clear of the crossfader once the mixer column collapses to a band at ${BAND_WIDTH}px wide`, () => {
    cy.viewport(BAND_WIDTH, 900);

    faderRect('A').then((faderA) => {
      faderRect('B').then((faderB) => {
        crossfaderRect().then((crossfader) => {
          expect(
            rectsAreClear(faderA, crossfader),
            'deck A fader does not overlap the crossfader'
          ).to.equal(true);
          expect(
            rectsAreClear(faderB, crossfader),
            'deck B fader does not overlap the crossfader'
          ).to.equal(true);
          expect(
            rectsAreClear(faderA, faderB),
            'the two channel faders do not overlap each other'
          ).to.equal(true);
        });
      });
    });

    cy.screenshot('channel-faders-band-layout');
  });

  it('captures the desktop channel-fader layout for visual record', () => {
    cy.viewport(STACKED_WIDTHS[0], 900);
    cy.screenshot('channel-faders-desktop-layout');
  });
});
